package openapi

import (
	"context"
	"encoding/json"
	"net/url"
	"regexp"
	"strings"

	"apigo/internal/storage"
)

func ExportProject(ctx context.Context, store *storage.Store, projectID string) ([]byte, error) {
	project, err := store.GetProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	envs, err := store.ListEnvs(ctx, projectID)
	if err != nil {
		return nil, err
	}
	tree, err := store.GetTree(ctx, projectID)
	if err != nil {
		return nil, err
	}

	servers := make([]map[string]any, 0)
	seenServer := map[string]bool{}
	for _, e := range envs {
		s := strings.TrimSpace(e.BaseURL)
		if s == "" || seenServer[s] {
			continue
		}
		seenServer[s] = true
		servers = append(servers, map[string]any{"url": s, "description": e.Name})
	}

	paths := map[string]any{}
	components := map[string]any{
		"securitySchemes": map[string]any{},
	}
	securitySchemes := components["securitySchemes"].(map[string]any)

	var walk func(nodes []storage.TreeNode) error
	walk = func(nodes []storage.TreeNode) error {
		for _, n := range nodes {
			if n.Type == storage.NodeTypeFolder {
				if err := walk(n.Children); err != nil {
					return err
				}
				continue
			}
			if n.RequestID == nil {
				continue
			}
			req, err := store.GetRequest(ctx, *n.RequestID)
			if err != nil {
				return err
			}
			pathKey := resolvePath(req)
			if pathKey == "" {
				continue
			}

			method := strings.ToLower(strings.TrimSpace(req.Method))
			if method == "" {
				method = "get"
			}

			op := map[string]any{
				"summary": n.Name,
			}

			params := make([]any, 0)
			for _, p := range req.QueryParams {
				if !p.Enabled || strings.TrimSpace(p.Key) == "" {
					continue
				}
				params = append(params, map[string]any{
					"in":          "query",
					"name":        p.Key,
					"required":    false,
					"description": p.Description,
					"schema":      schemaForKVType(p.Type),
				})
			}
			for _, h := range req.Headers {
				if !h.Enabled || strings.TrimSpace(h.Key) == "" {
					continue
				}
				params = append(params, map[string]any{
					"in":          "header",
					"name":        h.Key,
					"required":    false,
					"description": h.Description,
					"schema":      schemaForKVType(h.Type),
				})
			}
			if len(params) > 0 {
				op["parameters"] = params
			}

			if rb := requestBodyFor(req.Body); rb != nil {
				op["requestBody"] = rb
			}

			if sec := securityFor(req.Auth, securitySchemes); sec != nil {
				op["security"] = []any{sec}
			}

			// Basic 200 response placeholder
			op["responses"] = map[string]any{
				"200": map[string]any{"description": "OK"},
			}

			pathItem, ok := paths[pathKey].(map[string]any)
			if !ok {
				pathItem = map[string]any{}
				paths[pathKey] = pathItem
			}
			pathItem[method] = op
		}
		return nil
	}
	if err := walk(tree); err != nil {
		return nil, err
	}

	spec := map[string]any{
		"openapi": "3.0.3",
		"info": map[string]any{
			"title":   project.Name,
			"version": "1.0.0",
		},
		"paths":       paths,
		"components":  components,
		"servers":     servers,
	}

	return json.MarshalIndent(spec, "", "  ")
}

func resolvePath(req storage.Request) string {
	switch req.URLMode {
	case storage.URLModeBasePath:
		p := strings.TrimSpace(req.Path)
		if p == "" {
			return "/"
		}
		if !strings.HasPrefix(p, "/") {
			p = "/" + p
		}
		return p
	default:
		raw := strings.TrimSpace(req.URLFull)
		u, err := url.Parse(raw)
		if err != nil {
			return ""
		}
		p := u.Path
		if p == "" {
			p = "/"
		}
		return p
	}
}

func schemaForKVType(t storage.KVType) map[string]any {
	switch t {
	case storage.KVTypeInteger:
		return map[string]any{"type": "integer"}
	case storage.KVTypeNumber:
		return map[string]any{"type": "number"}
	case storage.KVTypeBoolean:
		return map[string]any{"type": "boolean"}
	default:
		return map[string]any{"type": "string"}
	}
}

func requestBodyFor(body storage.Body) map[string]any {
	switch body.Type {
	case storage.BodyTypeJSON:
		return map[string]any{
			"required": false,
			"content": map[string]any{
				"application/json": map[string]any{
					"schema": map[string]any{"type": "object"},
				},
			},
		}
	case storage.BodyTypeText:
		return map[string]any{
			"required": false,
			"content": map[string]any{
				"text/plain": map[string]any{
					"schema": map[string]any{"type": "string"},
				},
			},
		}
	case storage.BodyTypeURLEncoded:
		return map[string]any{
			"required": false,
			"content": map[string]any{
				"application/x-www-form-urlencoded": map[string]any{
					"schema": fieldsSchema(body.Fields, false),
				},
			},
		}
	case storage.BodyTypeMultipart:
		return map[string]any{
			"required": false,
			"content": map[string]any{
				"multipart/form-data": map[string]any{
					"schema": fieldsSchema(body.Fields, true),
				},
			},
		}
	default:
		return nil
	}
}

func fieldsSchema(fields []storage.BodyField, allowFile bool) map[string]any {
	props := map[string]any{}
	for _, f := range fields {
		if !f.Enabled || strings.TrimSpace(f.Key) == "" {
			continue
		}
		if allowFile && f.IsFile {
			props[f.Key] = map[string]any{"type": "string", "format": "binary"}
		} else {
			props[f.Key] = map[string]any{"type": "string"}
		}
	}
	return map[string]any{"type": "object", "properties": props}
}

var nonIdent = regexp.MustCompile(`[^a-zA-Z0-9_]+`)

func securityFor(auth storage.Auth, schemes map[string]any) map[string]any {
	switch auth.Type {
	case storage.AuthTypeBearer:
		schemes["bearerAuth"] = map[string]any{
			"type":         "http",
			"scheme":       "bearer",
			"bearerFormat": "JWT",
		}
		return map[string]any{"bearerAuth": []any{}}
	case storage.AuthTypeBasic:
		schemes["basicAuth"] = map[string]any{
			"type":   "http",
			"scheme": "basic",
		}
		return map[string]any{"basicAuth": []any{}}
	case storage.AuthTypeAPIKey:
		name := strings.TrimSpace(auth.APIKeyName)
		if name == "" {
			name = "X-API-Key"
		}
		in := "header"
		if auth.APIKeyIn == storage.APIKeyInQuery {
			in = "query"
		}
		key := "apiKey_" + strings.ToLower(nonIdent.ReplaceAllString(name, "_")) + "_" + in
		schemes[key] = map[string]any{
			"type": "apiKey",
			"in":   in,
			"name": name,
		}
		return map[string]any{key: []any{}}
	default:
		return nil
	}
}
