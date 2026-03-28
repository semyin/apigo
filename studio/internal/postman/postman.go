package postman

import (
	"context"
	"encoding/json"
	"errors"
	"net/url"
	"strings"

	"apigo/internal/storage"
)

type Collection struct {
	Info struct {
		Name string `json:"name"`
	} `json:"info"`
	Item []Item `json:"item"`
}

type Item struct {
	Name    string   `json:"name"`
	Item    []Item   `json:"item,omitempty"`
	Request *Request `json:"request,omitempty"`
}

type Request struct {
	Method string    `json:"method"`
	Header []Header  `json:"header,omitempty"`
	URL    URL       `json:"url"`
	Body   *Body     `json:"body,omitempty"`
	Auth   *Auth     `json:"auth,omitempty"`
	Desc   string    `json:"description,omitempty"`
}

type Header struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

type URL struct {
	Raw string
}

func (u *URL) UnmarshalJSON(data []byte) error {
	// string
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		u.Raw = s
		return nil
	}

	// object
	var obj struct {
		Raw string `json:"raw"`
	}
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}
	u.Raw = obj.Raw
	return nil
}

type Body struct {
	Mode      string        `json:"mode"`
	Raw       string        `json:"raw,omitempty"`
	URLEncoded []BodyKV      `json:"urlencoded,omitempty"`
	FormData  []FormDataKV  `json:"formdata,omitempty"`
}

type BodyKV struct {
	Key         string `json:"key"`
	Value       string `json:"value"`
	Disabled    bool   `json:"disabled,omitempty"`
	Description string `json:"description,omitempty"`
}

type FormDataKV struct {
	Key         string `json:"key"`
	Value       string `json:"value,omitempty"`
	Src         string `json:"src,omitempty"`
	Type        string `json:"type,omitempty"` // "text" | "file"
	Disabled    bool   `json:"disabled,omitempty"`
	Description string `json:"description,omitempty"`
}

type Auth struct {
	Type   string   `json:"type"`
	Bearer []AuthKV `json:"bearer,omitempty"`
	Basic  []AuthKV `json:"basic,omitempty"`
	APIKey []AuthKV `json:"apikey,omitempty"`
}

type AuthKV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func ImportCollection(ctx context.Context, store *storage.Store, data []byte) (string, error) {
	var col Collection
	if err := json.Unmarshal(data, &col); err != nil {
		return "", err
	}
	name := strings.TrimSpace(col.Info.Name)
	if name == "" {
		name = "Imported Collection"
	}

	project, err := store.CreateProject(ctx, name)
	if err != nil {
		return "", err
	}

	// Create a default environment and make it active.
	env, err := store.SaveEnv(ctx, storage.Environment{
		ProjectID: project.ID,
		Name:      "Imported",
		BaseURL:   "",
		Vars:      map[string]string{},
	})
	if err != nil {
		return "", err
	}
	_ = store.SetActiveEnv(ctx, project.ID, env.ID)

	var importItems func(parentID *string, items []Item) error
	importItems = func(parentID *string, items []Item) error {
		for _, it := range items {
			if len(it.Item) > 0 {
				folder, err := store.CreateFolder(ctx, project.ID, parentID, it.Name)
				if err != nil {
					return err
				}
				if err := importItems(&folder.ID, it.Item); err != nil {
					return err
				}
				continue
			}
			if it.Request == nil {
				continue
			}
			_, req, err := store.CreateRequest(ctx, project.ID, parentID, it.Name)
			if err != nil {
				return err
			}

			mapped := mapRequest(*it.Request, req)
			if err := store.SaveRequest(ctx, mapped); err != nil {
				return err
			}
		}
		return nil
	}

	if err := importItems(nil, col.Item); err != nil {
		return "", err
	}
	return project.ID, nil
}

func mapRequest(pm Request, base storage.Request) storage.Request {
	out := base
	if strings.TrimSpace(pm.Method) != "" {
		out.Method = strings.ToUpper(strings.TrimSpace(pm.Method))
	}

	// URL
	out.URLMode = storage.URLModeFull
	out.Path = ""
	out.URLFull, out.QueryParams = splitURLAndQuery(pm.URL.Raw)

	// Headers
	var headers []storage.KV
	for _, h := range pm.Header {
		if strings.TrimSpace(h.Key) == "" {
			continue
		}
		headers = append(headers, storage.KV{
			Enabled:     !h.Disabled,
			Key:         h.Key,
			Value:       h.Value,
			Type:        storage.KVTypeString,
			Description: "",
		})
	}
	out.Headers = headers

	// Body
	out.Body = storage.Body{Type: storage.BodyTypeNone}
	if pm.Body != nil {
		switch strings.ToLower(pm.Body.Mode) {
		case "raw":
			raw := pm.Body.Raw
			if looksLikeJSON(raw) || hasJSONContentType(headers) {
				out.Body = storage.Body{Type: storage.BodyTypeJSON, JSONText: raw}
			} else {
				out.Body = storage.Body{Type: storage.BodyTypeText, Text: raw}
			}
		case "urlencoded":
			fields := make([]storage.BodyField, 0, len(pm.Body.URLEncoded))
			for _, f := range pm.Body.URLEncoded {
				if strings.TrimSpace(f.Key) == "" {
					continue
				}
				fields = append(fields, storage.BodyField{
					Enabled:     !f.Disabled,
					Key:         f.Key,
					Value:       f.Value,
					Type:        storage.KVTypeString,
					Description: f.Description,
				})
			}
			out.Body = storage.Body{Type: storage.BodyTypeURLEncoded, Fields: fields}
		case "formdata":
			fields := make([]storage.BodyField, 0, len(pm.Body.FormData))
			for _, f := range pm.Body.FormData {
				if strings.TrimSpace(f.Key) == "" {
					continue
				}
				isFile := strings.EqualFold(f.Type, "file")
				fields = append(fields, storage.BodyField{
					Enabled:     !f.Disabled,
					Key:         f.Key,
					Value:       f.Value,
					Description: f.Description,
					IsFile:      isFile,
					FilePath:    f.Src,
					Type:        storage.KVTypeString,
				})
			}
			out.Body = storage.Body{Type: storage.BodyTypeMultipart, Fields: fields}
		}
	}

	// Auth
	out.Auth = storage.Auth{Type: storage.AuthTypeNone}
	if pm.Auth != nil {
		switch strings.ToLower(pm.Auth.Type) {
		case "", "noauth":
			out.Auth = storage.Auth{Type: storage.AuthTypeNone}
		case "bearer":
			out.Auth = storage.Auth{Type: storage.AuthTypeBearer, BearerToken: pickAuthValue(pm.Auth.Bearer, "token")}
		case "basic":
			out.Auth = storage.Auth{
				Type:      storage.AuthTypeBasic,
				BasicUser: pickAuthValue(pm.Auth.Basic, "username"),
				BasicPass: pickAuthValue(pm.Auth.Basic, "password"),
			}
		case "apikey":
			in := pickAuthValue(pm.Auth.APIKey, "in")
			in = strings.ToLower(in)
			apiKeyIn := storage.APIKeyInHeader
			if in == "query" {
				apiKeyIn = storage.APIKeyInQuery
			}
			out.Auth = storage.Auth{
				Type:        storage.AuthTypeAPIKey,
				APIKeyIn:    apiKeyIn,
				APIKeyName:  pickAuthValue(pm.Auth.APIKey, "key"),
				APIKeyValue: pickAuthValue(pm.Auth.APIKey, "value"),
			}
		}
	}

	return out
}

func splitURLAndQuery(raw string) (clean string, params []storage.KV) {
	r := strings.TrimSpace(raw)
	if r == "" {
		return "", []storage.KV{}
	}
	u, err := url.Parse(r)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return r, []storage.KV{}
	}

	q := u.Query()
	for k, vv := range q {
		for _, v := range vv {
			params = append(params, storage.KV{
				Enabled:     true,
				Key:         k,
				Value:       v,
				Type:        storage.KVTypeString,
				Description: "",
			})
		}
	}

	u.RawQuery = ""
	return u.String(), params
}

func hasJSONContentType(headers []storage.KV) bool {
	for _, h := range headers {
		if strings.EqualFold(strings.TrimSpace(h.Key), "Content-Type") &&
			strings.Contains(strings.ToLower(h.Value), "application/json") {
			return true
		}
	}
	return false
}

func looksLikeJSON(s string) bool {
	trim := strings.TrimSpace(s)
	return strings.HasPrefix(trim, "{") || strings.HasPrefix(trim, "[")
}

func pickAuthValue(kvs []AuthKV, key string) string {
	for _, kv := range kvs {
		if strings.EqualFold(kv.Key, key) {
			return kv.Value
		}
	}
	if len(kvs) > 0 {
		return kvs[0].Value
	}
	return ""
}

// Export section

type ExportCollection struct {
	Info ExportInfo  `json:"info"`
	Item []ExportItem `json:"item"`
}

type ExportInfo struct {
	Name   string `json:"name"`
	Schema string `json:"schema"`
}

type ExportItem struct {
	Name    string         `json:"name"`
	Item    []ExportItem   `json:"item,omitempty"`
	Request *ExportRequest `json:"request,omitempty"`
}

type ExportRequest struct {
	Method string        `json:"method"`
	Header []ExportHeader `json:"header,omitempty"`
	URL    ExportURL     `json:"url"`
	Body   *ExportBody   `json:"body,omitempty"`
	Auth   *ExportAuth   `json:"auth,omitempty"`
}

type ExportHeader struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

type ExportURL struct {
	Raw string `json:"raw"`
}

type ExportBody struct {
	Mode      string          `json:"mode"`
	Raw       string          `json:"raw,omitempty"`
	URLEncoded []ExportBodyKV  `json:"urlencoded,omitempty"`
	FormData  []ExportFormData `json:"formdata,omitempty"`
	Options   any             `json:"options,omitempty"`
}

type ExportBodyKV struct {
	Key      string `json:"key"`
	Value    string `json:"value"`
	Disabled bool   `json:"disabled,omitempty"`
}

type ExportFormData struct {
	Key      string `json:"key"`
	Value    string `json:"value,omitempty"`
	Src      string `json:"src,omitempty"`
	Type     string `json:"type,omitempty"`
	Disabled bool   `json:"disabled,omitempty"`
}

type ExportAuth struct {
	Type   string      `json:"type"`
	Bearer []ExportKV  `json:"bearer,omitempty"`
	Basic  []ExportKV  `json:"basic,omitempty"`
	APIKey []ExportKV  `json:"apikey,omitempty"`
}

type ExportKV struct {
	Key   string `json:"key"`
	Value string `json:"value"`
	Type  string `json:"type,omitempty"`
}

func ExportProjectAsCollection(ctx context.Context, store *storage.Store, projectID string) ([]byte, error) {
	project, err := store.GetProject(ctx, projectID)
	if err != nil {
		return nil, err
	}
	tree, err := store.GetTree(ctx, projectID)
	if err != nil {
		return nil, err
	}
	env, _ := store.GetActiveEnv(ctx, projectID)

	var buildItems func(nodes []storage.TreeNode) ([]ExportItem, error)
	buildItems = func(nodes []storage.TreeNode) ([]ExportItem, error) {
		out := make([]ExportItem, 0, len(nodes))
		for _, n := range nodes {
			if n.Type == storage.NodeTypeFolder {
				children, err := buildItems(n.Children)
				if err != nil {
					return nil, err
				}
				out = append(out, ExportItem{Name: n.Name, Item: children})
				continue
			}
			if n.RequestID == nil {
				continue
			}
			req, err := store.GetRequest(ctx, *n.RequestID)
			if err != nil {
				return nil, err
			}
			out = append(out, ExportItem{
				Name: n.Name,
				Request: &ExportRequest{
					Method: strings.ToUpper(strings.TrimSpace(req.Method)),
					Header: exportHeaders(req.Headers),
					URL:    ExportURL{Raw: exportURL(req, env.BaseURL)},
					Body:   exportBody(req.Body),
					Auth:   exportAuth(req.Auth),
				},
			})
		}
		return out, nil
	}

	items, err := buildItems(tree)
	if err != nil {
		return nil, err
	}

	col := ExportCollection{
		Info: ExportInfo{
			Name:   project.Name,
			Schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
		},
		Item: items,
	}

	return json.MarshalIndent(col, "", "  ")
}

func exportHeaders(headers []storage.KV) []ExportHeader {
	out := make([]ExportHeader, 0, len(headers))
	for _, h := range headers {
		if strings.TrimSpace(h.Key) == "" {
			continue
		}
		out = append(out, ExportHeader{
			Key:      h.Key,
			Value:    h.Value,
			Disabled: !h.Enabled,
		})
	}
	return out
}

func exportURL(req storage.Request, baseURL string) string {
	switch req.URLMode {
	case storage.URLModeBasePath:
		base := strings.TrimSpace(baseURL)
		p := strings.TrimSpace(req.Path)
		full := strings.TrimRight(base, "/") + "/" + strings.TrimLeft(p, "/")
		return appendQuery(full, req.QueryParams)
	default:
		return appendQuery(req.URLFull, req.QueryParams)
	}
}

func appendQuery(raw string, params []storage.KV) string {
	r := strings.TrimSpace(raw)
	if r == "" || len(params) == 0 {
		return r
	}
	u, err := url.Parse(r)
	if err != nil {
		return r
	}
	q := u.Query()
	for _, kv := range params {
		if !kv.Enabled || strings.TrimSpace(kv.Key) == "" {
			continue
		}
		q.Add(kv.Key, kv.Value)
	}
	u.RawQuery = q.Encode()
	return u.String()
}

func exportBody(body storage.Body) *ExportBody {
	switch body.Type {
	case storage.BodyTypeNone:
		return nil
	case storage.BodyTypeJSON:
		return &ExportBody{
			Mode: "raw",
			Raw:  body.JSONText,
			Options: map[string]any{
				"raw": map[string]any{
					"language": "json",
				},
			},
		}
	case storage.BodyTypeText:
		return &ExportBody{Mode: "raw", Raw: body.Text}
	case storage.BodyTypeURLEncoded:
		out := &ExportBody{Mode: "urlencoded"}
		for _, f := range body.Fields {
			if strings.TrimSpace(f.Key) == "" {
				continue
			}
			out.URLEncoded = append(out.URLEncoded, ExportBodyKV{
				Key:      f.Key,
				Value:    f.Value,
				Disabled: !f.Enabled,
			})
		}
		return out
	case storage.BodyTypeMultipart:
		out := &ExportBody{Mode: "formdata"}
		for _, f := range body.Fields {
			if strings.TrimSpace(f.Key) == "" {
				continue
			}
			if f.IsFile {
				out.FormData = append(out.FormData, ExportFormData{
					Key:      f.Key,
					Src:      f.FilePath,
					Type:     "file",
					Disabled: !f.Enabled,
				})
			} else {
				out.FormData = append(out.FormData, ExportFormData{
					Key:      f.Key,
					Value:    f.Value,
					Type:     "text",
					Disabled: !f.Enabled,
				})
			}
		}
		return out
	default:
		return nil
	}
}

func exportAuth(auth storage.Auth) *ExportAuth {
	switch auth.Type {
	case storage.AuthTypeNone:
		return &ExportAuth{Type: "noauth"}
	case storage.AuthTypeBearer:
		return &ExportAuth{
			Type: "bearer",
			Bearer: []ExportKV{
				{Key: "token", Value: auth.BearerToken, Type: "string"},
			},
		}
	case storage.AuthTypeBasic:
		return &ExportAuth{
			Type: "basic",
			Basic: []ExportKV{
				{Key: "username", Value: auth.BasicUser, Type: "string"},
				{Key: "password", Value: auth.BasicPass, Type: "string"},
			},
		}
	case storage.AuthTypeAPIKey:
		in := "header"
		if auth.APIKeyIn == storage.APIKeyInQuery {
			in = "query"
		}
		return &ExportAuth{
			Type: "apikey",
			APIKey: []ExportKV{
				{Key: "key", Value: auth.APIKeyName, Type: "string"},
				{Key: "value", Value: auth.APIKeyValue, Type: "string"},
				{Key: "in", Value: in, Type: "string"},
			},
		}
	default:
		return &ExportAuth{Type: "noauth"}
	}
}

func ValidateCollection(data []byte) error {
	var col Collection
	if err := json.Unmarshal(data, &col); err != nil {
		return err
	}
	if strings.TrimSpace(col.Info.Name) == "" {
		return errors.New("invalid postman collection: missing info.name")
	}
	return nil
}

