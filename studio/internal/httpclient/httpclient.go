package httpclient

import (
	"bytes"
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"apigo/internal/storage"
)

var varPattern = regexp.MustCompile(`{{\s*([^{}\s]+)\s*}}`)

func applyVars(in string, vars map[string]string) string {
	if in == "" {
		return ""
	}
	return varPattern.ReplaceAllStringFunc(in, func(m string) string {
		sub := varPattern.FindStringSubmatch(m)
		if len(sub) != 2 {
			return m
		}
		key := sub[1]
		switch key {
		case "{{$timestamp}}":
			return fmt.Sprintf("%d", time.Now().Unix())
		case "{{$uuid}}":
			return uuid.NewString()
		}
		if vars != nil {
			if v, ok := vars[key]; ok {
				return v
			}
		}
		return m
	})
}

type SendInput struct {
	Request storage.Request     `json:"request"`
	Env     storage.Environment `json:"env"`
	Timeout time.Duration       `json:"-"`
}

func Send(ctx context.Context, in SendInput) storage.SendResult {
	start := time.Now()
	timeout := in.Timeout
	if timeout <= 0 {
		timeout = 30 * time.Second
	}

	vars := in.Env.Vars

	method := strings.ToUpper(strings.TrimSpace(in.Request.Method))
	if method == "" {
		method = "GET"
	}

	finalURL, err := buildURL(in.Request, in.Env, vars)
	if err != nil {
		return storage.SendResult{OK: false, Error: err.Error()}
	}

	var bodyReader io.Reader
	var contentType string
	switch in.Request.Body.Type {
	case storage.BodyTypeNone:
		// nothing
	case storage.BodyTypeJSON:
		bodyReader = strings.NewReader(applyVars(in.Request.Body.JSONText, vars))
		contentType = "application/json"
	case storage.BodyTypeText:
		bodyReader = strings.NewReader(applyVars(in.Request.Body.Text, vars))
		contentType = "text/plain; charset=utf-8"
	case storage.BodyTypeURLEncoded:
		form := url.Values{}
		for _, f := range in.Request.Body.Fields {
			if !f.Enabled {
				continue
			}
			k := applyVars(f.Key, vars)
			v := applyVars(f.Value, vars)
			if k == "" {
				continue
			}
			form.Add(k, v)
		}
		bodyReader = strings.NewReader(form.Encode())
		contentType = "application/x-www-form-urlencoded"
	case storage.BodyTypeMultipart:
		var buf bytes.Buffer
		w := multipart.NewWriter(&buf)
		for _, f := range in.Request.Body.Fields {
			if !f.Enabled {
				continue
			}
			key := applyVars(f.Key, vars)
			if key == "" {
				continue
			}
			if f.IsFile {
				fp := applyVars(f.FilePath, vars)
				if fp == "" {
					continue
				}
				file, err := os.Open(fp)
				if err != nil {
					_ = w.Close()
					return storage.SendResult{OK: false, Error: err.Error()}
				}
				defer file.Close()
				part, err := w.CreateFormFile(key, filepath.Base(fp))
				if err != nil {
					_ = w.Close()
					return storage.SendResult{OK: false, Error: err.Error()}
				}
				if _, err := io.Copy(part, file); err != nil {
					_ = w.Close()
					return storage.SendResult{OK: false, Error: err.Error()}
				}
			} else {
				_ = w.WriteField(key, applyVars(f.Value, vars))
			}
		}
		_ = w.Close()
		bodyReader = &buf
		contentType = w.FormDataContentType()
	default:
		return storage.SendResult{OK: false, Error: "unsupported body type"}
	}

	req, err := http.NewRequestWithContext(ctx, method, finalURL, bodyReader)
	if err != nil {
		return storage.SendResult{OK: false, Error: err.Error()}
	}

	// Explicit headers
	for _, h := range in.Request.Headers {
		if !h.Enabled {
			continue
		}
		k := strings.TrimSpace(applyVars(h.Key, vars))
		v := strings.TrimSpace(applyVars(h.Value, vars))
		if k == "" {
			continue
		}
		req.Header.Add(k, v)
	}

	// Auth helper
	applyAuth(req, &in.Request, vars)

	// Content-Type (do not override explicit user header)
	if contentType != "" && req.Header.Get("Content-Type") == "" {
		req.Header.Set("Content-Type", contentType)
	}

	client := &http.Client{Timeout: timeout}
	resp, err := client.Do(req)
	if err != nil {
		return storage.SendResult{OK: false, Error: err.Error()}
	}
	defer resp.Body.Close()

	const maxBody = 10 << 20 // 10MiB
	bodyBytes, readErr := io.ReadAll(io.LimitReader(resp.Body, maxBody+1))
	if readErr != nil {
		return storage.SendResult{OK: false, Error: readErr.Error()}
	}
	truncated := int64(0)
	if int64(len(bodyBytes)) > maxBody {
		truncated = int64(len(bodyBytes)) - maxBody
		bodyBytes = bodyBytes[:maxBody]
	}

	bodyStr := string(bodyBytes)
	// If the payload is not valid UTF-8, show base64 instead.
	if !utf8Like(bodyBytes) {
		bodyStr = base64.StdEncoding.EncodeToString(bodyBytes)
	}

	duration := time.Since(start)
	size := int64(len(bodyBytes))
	if truncated > 0 {
		size += truncated
	}

	out := storage.SendResult{
		OK:         true,
		Status:     resp.StatusCode,
		StatusText: resp.Status,
		DurationMs: duration.Milliseconds(),
		SizeBytes:  size,
		Headers:    map[string][]string(resp.Header),
		Body:       bodyStr,
	}
	return out
}

func buildURL(req storage.Request, env storage.Environment, vars map[string]string) (string, error) {
	switch req.URLMode {
	case storage.URLModeFull:
		raw := strings.TrimSpace(applyVars(req.URLFull, vars))
		if raw == "" {
			return "", errors.New("url is empty")
		}
		u, err := url.Parse(raw)
		if err != nil {
			return "", err
		}
		q := u.Query()
		for _, p := range req.QueryParams {
			if !p.Enabled {
				continue
			}
			k := applyVars(p.Key, vars)
			v := applyVars(p.Value, vars)
			if strings.TrimSpace(k) == "" {
				continue
			}
			q.Add(k, v)
		}
		applyAPIKeyQuery(req.Auth, q, vars)
		u.RawQuery = q.Encode()
		return u.String(), nil

	case storage.URLModeBasePath:
		baseRaw := strings.TrimSpace(applyVars(env.BaseURL, vars))
		if baseRaw == "" {
			return "", errors.New("base url is empty")
		}
		base, err := url.Parse(baseRaw)
		if err != nil {
			return "", err
		}
		p := strings.TrimSpace(applyVars(req.Path, vars))
		if p == "" {
			p = "/"
		}
		base.Path = joinURLPath(base.Path, p)

		q := base.Query()
		for _, kv := range req.QueryParams {
			if !kv.Enabled {
				continue
			}
			k := applyVars(kv.Key, vars)
			v := applyVars(kv.Value, vars)
			if strings.TrimSpace(k) == "" {
				continue
			}
			q.Add(k, v)
		}
		applyAPIKeyQuery(req.Auth, q, vars)
		base.RawQuery = q.Encode()
		return base.String(), nil

	default:
		return "", errors.New("unknown url mode")
	}
}

func joinURLPath(basePath, addPath string) string {
	a := strings.TrimRight(basePath, "/")
	b := strings.TrimLeft(addPath, "/")
	if a == "" {
		return "/" + b
	}
	if b == "" {
		return a
	}
	return a + "/" + b
}

func applyAPIKeyQuery(auth storage.Auth, q url.Values, vars map[string]string) {
	if auth.Type != storage.AuthTypeAPIKey {
		return
	}
	if auth.APIKeyIn != storage.APIKeyInQuery {
		return
	}
	name := strings.TrimSpace(applyVars(auth.APIKeyName, vars))
	if name == "" {
		return
	}
	value := applyVars(auth.APIKeyValue, vars)
	q.Set(name, value)
}

func applyAuth(r *http.Request, req *storage.Request, vars map[string]string) {
	switch req.Auth.Type {
	case storage.AuthTypeNone:
		return
	case storage.AuthTypeBearer:
		token := strings.TrimSpace(applyVars(req.Auth.BearerToken, vars))
		if token == "" {
			return
		}
		r.Header.Set("Authorization", "Bearer "+token)
	case storage.AuthTypeBasic:
		u := applyVars(req.Auth.BasicUser, vars)
		p := applyVars(req.Auth.BasicPass, vars)
		r.SetBasicAuth(u, p)
	case storage.AuthTypeAPIKey:
		if req.Auth.APIKeyIn != storage.APIKeyInHeader {
			return
		}
		name := strings.TrimSpace(applyVars(req.Auth.APIKeyName, vars))
		if name == "" {
			return
		}
		value := applyVars(req.Auth.APIKeyValue, vars)
		r.Header.Set(name, value)
	}
}

func utf8Like(b []byte) bool {
	// Quick heuristic: reject obvious binary (NUL byte).
	for _, c := range b {
		if c == 0 {
			return false
		}
	}
	return true
}

