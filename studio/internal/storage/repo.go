package storage

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"strings"

	"github.com/google/uuid"
)

const settingsKeyApp = "app"

func (s *Store) EnsureSeed(ctx context.Context) (projectID string, requestID string, err error) {
	projects, err := s.ListProjects(ctx)
	if err != nil {
		return "", "", err
	}
	if len(projects) > 0 {
		projectID = projects[0].ID
		requestID, _ = s.firstRequestID(ctx, projectID)
		if requestID != "" {
			return projectID, requestID, nil
		}
		// Project exists but no request yet, ensure at least one request.
		_, req, err := s.CreateRequest(ctx, projectID, nil, "New Request")
		if err != nil {
			return projectID, "", err
		}
		return projectID, req.ID, nil
	}

	now := s.Now()
	projectID = uuid.NewString()

	// Seed data mirrors the UI template to make first run feel familiar.
	envDevID := uuid.NewString()
	envStagingID := uuid.NewString()
	envProdID := uuid.NewString()

	folderUsersID := uuid.NewString()
	folderOrdersID := uuid.NewString()

	reqListNodeID := uuid.NewString()
	reqCreateNodeID := uuid.NewString()
	reqDeleteNodeID := uuid.NewString()
	requestID = uuid.NewString() // selected by default
	createReqID := uuid.NewString()
	deleteReqID := uuid.NewString()

	devEnv := Environment{
		ID:        envDevID,
		ProjectID: projectID,
		Name:      "Development",
		BaseURL:   "https://api.example.com",
		Vars: map[string]string{
			"TOKEN": "",
			"API_KEY": "",
		},
		UpdatedAt: now,
	}
	stagingEnv := Environment{
		ID:        envStagingID,
		ProjectID: projectID,
		Name:      "Staging",
		BaseURL:   "https://staging.api.example.com",
		Vars:      map[string]string{},
		UpdatedAt: now,
	}
	prodEnv := Environment{
		ID:        envProdID,
		ProjectID: projectID,
		Name:      "Production",
		BaseURL:   "https://api.example.com",
		Vars:      map[string]string{},
		UpdatedAt: now,
	}

	listReq := Request{
		ID:      requestID,
		NodeID:  reqListNodeID,
		Method:  "GET",
		URLMode: URLModeFull,
		URLFull: "https://api.example.com/v1/users",
		Path:    "",
		QueryParams: []KV{
			{Enabled: true, Key: "page", Value: "1", Type: KVTypeInteger, Description: "Page number"},
			{Enabled: true, Key: "limit", Value: "10", Type: KVTypeInteger, Description: ""},
		},
		Headers: []KV{
			{Enabled: true, Key: "Accept", Value: "application/json", Type: KVTypeString, Description: ""},
		},
		Body: Body{Type: BodyTypeNone},
		Auth: Auth{Type: AuthTypeBearer, BearerToken: "{{TOKEN}}"},
		Description: "",
		UpdatedAt:   now,
	}
	createReq := Request{
		ID:      createReqID,
		NodeID:  reqCreateNodeID,
		Method:  "POST",
		URLMode: URLModeFull,
		URLFull: "https://api.example.com/v1/users",
		Path:    "",
		QueryParams: []KV{},
		Headers: []KV{
			{Enabled: true, Key: "Content-Type", Value: "application/json", Type: KVTypeString, Description: ""},
		},
		Body: Body{Type: BodyTypeJSON, JSONText: "{\n  \"username\": \"admin_fox\"\n}"},
		Auth: Auth{Type: AuthTypeBearer, BearerToken: "{{TOKEN}}"},
		Description: "",
		UpdatedAt:   now,
	}
	deleteReq := Request{
		ID:      deleteReqID,
		NodeID:  reqDeleteNodeID,
		Method:  "DELETE",
		URLMode: URLModeFull,
		URLFull: "https://api.example.com/v1/users/{{id}}",
		Path:    "",
		QueryParams: []KV{},
		Headers: []KV{},
		Body:    Body{Type: BodyTypeNone},
		Auth:    Auth{Type: AuthTypeBearer, BearerToken: "{{TOKEN}}"},
		Description: "",
		UpdatedAt:   now,
	}

	defaultSettings := Settings{
		Theme:            "system",
		Language:         "zh",
		RequestTimeoutMs: 30000,
		AutoSave:         true,
	}

	err = s.WithTx(ctx, func(tx *sql.Tx) error {
		// Settings
		_, err := tx.ExecContext(ctx, `INSERT INTO settings(key,value_json,updated_at) VALUES(?,?,?)`, settingsKeyApp, mustJSON(defaultSettings), now)
		if err != nil {
			// Ignore duplicate settings row.
			// This can happen if previous run created settings but not the project due to crash.
			if !strings.Contains(err.Error(), "UNIQUE") {
				return wrapErr("insert settings", err)
			}
		}

		// Project
		_, err = tx.ExecContext(ctx, `INSERT INTO projects(id,name,created_at,updated_at,active_env_id) VALUES(?,?,?,?,?)`,
			projectID, "Studio", now, now, envDevID,
		)
		if err != nil {
			return wrapErr("insert project", err)
		}

		// Environments
		for _, e := range []Environment{devEnv, stagingEnv, prodEnv} {
			_, err = tx.ExecContext(ctx, `INSERT INTO environments(id,project_id,name,base_url,vars_json,updated_at) VALUES(?,?,?,?,?,?)`,
				e.ID, e.ProjectID, e.Name, e.BaseURL, mustJSON(e.Vars), e.UpdatedAt,
			)
			if err != nil {
				return wrapErr("insert env", err)
			}
		}

		// Folder nodes
		_, err = tx.ExecContext(ctx, `INSERT INTO nodes(id,project_id,parent_id,type,name,sort_index,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
			folderUsersID, projectID, nil, NodeTypeFolder, "User Management", 0, now, now,
		)
		if err != nil {
			return wrapErr("insert folder", err)
		}
		_, err = tx.ExecContext(ctx, `INSERT INTO nodes(id,project_id,parent_id,type,name,sort_index,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
			folderOrdersID, projectID, nil, NodeTypeFolder, "Orders API", 1, now, now,
		)
		if err != nil {
			return wrapErr("insert folder", err)
		}

		// Request nodes + records
		type seedReq struct {
			NodeID string
			Name   string
			Sort   int64
			Req    Request
		}
		for _, sr := range []seedReq{
			{NodeID: reqListNodeID, Name: "List Users", Sort: 0, Req: listReq},
			{NodeID: reqCreateNodeID, Name: "Create User", Sort: 1, Req: createReq},
			{NodeID: reqDeleteNodeID, Name: "Delete User", Sort: 2, Req: deleteReq},
		} {
			_, err = tx.ExecContext(ctx, `INSERT INTO nodes(id,project_id,parent_id,type,name,sort_index,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)`,
				sr.NodeID, projectID, folderUsersID, NodeTypeRequest, sr.Name, sr.Sort, now, now,
			)
			if err != nil {
				return wrapErr("insert request node", err)
			}
			_, err = tx.ExecContext(ctx, `INSERT INTO requests(id,node_id,method,url_mode,url_full,path,query_params_json,headers_json,body_json,auth_json,description,updated_at)
				VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
				sr.Req.ID,
				sr.Req.NodeID,
				sr.Req.Method,
				sr.Req.URLMode,
				sr.Req.URLFull,
				sr.Req.Path,
				mustJSON(sr.Req.QueryParams),
				mustJSON(sr.Req.Headers),
				mustJSON(sr.Req.Body),
				mustJSON(sr.Req.Auth),
				sr.Req.Description,
				sr.Req.UpdatedAt,
			)
			if err != nil {
				return wrapErr("insert request", err)
			}
		}

		return nil
	})

	return projectID, requestID, err
}

func (s *Store) firstRequestID(ctx context.Context, projectID string) (string, error) {
	var id string
	err := s.db.QueryRowContext(ctx, `
		SELECT r.id
		FROM requests r
		JOIN nodes n ON n.id = r.node_id
		WHERE n.project_id = ?
		ORDER BY r.updated_at DESC
		LIMIT 1
	`, projectID).Scan(&id)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return id, err
}

func (s *Store) ListProjects(ctx context.Context) ([]Project, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,name,active_env_id,created_at,updated_at FROM projects ORDER BY updated_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Project
	for rows.Next() {
		var p Project
		var active sql.NullString
		if err := rows.Scan(&p.ID, &p.Name, &active, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		if active.Valid {
			p.ActiveEnvID = &active.String
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (s *Store) GetProject(ctx context.Context, projectID string) (Project, error) {
	var p Project
	var active sql.NullString
	err := s.db.QueryRowContext(ctx, `SELECT id,name,active_env_id,created_at,updated_at FROM projects WHERE id=?`, projectID).
		Scan(&p.ID, &p.Name, &active, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return Project{}, err
	}
	if active.Valid {
		p.ActiveEnvID = &active.String
	}
	return p, nil
}

func (s *Store) GetProjectIDByRequestID(ctx context.Context, requestID string) (string, error) {
	var pid string
	err := s.db.QueryRowContext(ctx, `
		SELECT n.project_id
		FROM nodes n
		JOIN requests r ON r.node_id = n.id
		WHERE r.id = ?
	`, requestID).Scan(&pid)
	if err != nil {
		return "", err
	}
	return pid, nil
}

func (s *Store) GetActiveEnv(ctx context.Context, projectID string) (Environment, error) {
	p, err := s.GetProject(ctx, projectID)
	if err != nil {
		return Environment{}, err
	}
	if p.ActiveEnvID == nil || *p.ActiveEnvID == "" {
		envs, err := s.ListEnvs(ctx, projectID)
		if err != nil {
			return Environment{}, err
		}
		if len(envs) == 0 {
			return Environment{}, errors.New("no environments")
		}
		return envs[0], nil
	}

	var e Environment
	var varsJSON string
	err = s.db.QueryRowContext(ctx, `SELECT id,project_id,name,base_url,vars_json,updated_at FROM environments WHERE id=?`, *p.ActiveEnvID).
		Scan(&e.ID, &e.ProjectID, &e.Name, &e.BaseURL, &varsJSON, &e.UpdatedAt)
	if err != nil {
		return Environment{}, err
	}
	if err := fromJSON(varsJSON, &e.Vars); err != nil {
		e.Vars = map[string]string{}
	}
	return e, nil
}

func (s *Store) CreateProject(ctx context.Context, name string) (Project, error) {
	now := s.Now()
	id := uuid.NewString()
	p := Project{ID: id, Name: name, CreatedAt: now, UpdatedAt: now}
	_, err := s.db.ExecContext(ctx, `INSERT INTO projects(id,name,created_at,updated_at,active_env_id) VALUES(?,?,?,?,NULL)`, p.ID, p.Name, p.CreatedAt, p.UpdatedAt)
	return p, err
}

func (s *Store) DeleteProject(ctx context.Context, projectID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM projects WHERE id = ?`, projectID)
	return err
}

func (s *Store) ListEnvs(ctx context.Context, projectID string) ([]Environment, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT id,project_id,name,base_url,vars_json,updated_at FROM environments WHERE project_id=? ORDER BY updated_at DESC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Environment
	for rows.Next() {
		var e Environment
		var varsJSON string
		if err := rows.Scan(&e.ID, &e.ProjectID, &e.Name, &e.BaseURL, &varsJSON, &e.UpdatedAt); err != nil {
			return nil, err
		}
		if err := fromJSON(varsJSON, &e.Vars); err != nil {
			e.Vars = map[string]string{}
		}
		out = append(out, e)
	}
	return out, rows.Err()
}

func (s *Store) SaveEnv(ctx context.Context, env Environment) (Environment, error) {
	now := s.Now()
	if env.ID == "" {
		env.ID = uuid.NewString()
	}
	env.UpdatedAt = now
	if env.Vars == nil {
		env.Vars = map[string]string{}
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO environments(id,project_id,name,base_url,vars_json,updated_at)
		VALUES(?,?,?,?,?,?)
		ON CONFLICT(id) DO UPDATE SET
			name=excluded.name,
			base_url=excluded.base_url,
			vars_json=excluded.vars_json,
			updated_at=excluded.updated_at
	`, env.ID, env.ProjectID, env.Name, env.BaseURL, mustJSON(env.Vars), env.UpdatedAt)
	return env, err
}

func (s *Store) DeleteEnv(ctx context.Context, envID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM environments WHERE id = ?`, envID)
	return err
}

func (s *Store) SetActiveEnv(ctx context.Context, projectID, envID string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE projects SET active_env_id=?, updated_at=? WHERE id=?`, envID, s.Now(), projectID)
	return err
}

func (s *Store) GetSettings(ctx context.Context) (Settings, error) {
	var sjson string
	err := s.db.QueryRowContext(ctx, `SELECT value_json FROM settings WHERE key=?`, settingsKeyApp).Scan(&sjson)
	if errors.Is(err, sql.ErrNoRows) {
		return Settings{
			Theme:            "system",
			Language:         "zh",
			RequestTimeoutMs: 30000,
			AutoSave:         true,
		}, nil
	}
	if err != nil {
		return Settings{}, err
	}
	var out Settings
	if err := fromJSON(sjson, &out); err != nil {
		return Settings{}, err
	}
	return out, nil
}

func (s *Store) SaveSettings(ctx context.Context, settings Settings) error {
	now := s.Now()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO settings(key,value_json,updated_at)
		VALUES(?,?,?)
		ON CONFLICT(key) DO UPDATE SET
			value_json=excluded.value_json,
			updated_at=excluded.updated_at
	`, settingsKeyApp, mustJSON(settings), now)
	return err
}

func (s *Store) nextSortIndex(ctx context.Context, projectID string, parentID *string) (int64, error) {
	var idx int64
	if parentID == nil {
		err := s.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_index), -1) + 1 FROM nodes WHERE project_id=? AND parent_id IS NULL`, projectID).Scan(&idx)
		return idx, err
	}
	err := s.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(sort_index), -1) + 1 FROM nodes WHERE project_id=? AND parent_id=?`, projectID, *parentID).Scan(&idx)
	return idx, err
}

func (s *Store) CreateFolder(ctx context.Context, projectID string, parentID *string, name string) (Node, error) {
	now := s.Now()
	id := uuid.NewString()
	sortIndex, err := s.nextSortIndex(ctx, projectID, parentID)
	if err != nil {
		return Node{}, err
	}

	_, err = s.db.ExecContext(ctx, `
		INSERT INTO nodes(id,project_id,parent_id,type,name,sort_index,created_at,updated_at)
		VALUES(?,?,?,?,?,?,?,?)
	`, id, projectID, parentID, NodeTypeFolder, name, sortIndex, now, now)
	if err != nil {
		return Node{}, err
	}

	return Node{
		ID:        id,
		ProjectID: projectID,
		ParentID:  parentID,
		Type:      NodeTypeFolder,
		Name:      name,
		SortIndex: sortIndex,
		CreatedAt: now,
		UpdatedAt: now,
	}, nil
}

func (s *Store) CreateRequest(ctx context.Context, projectID string, parentID *string, name string) (Node, Request, error) {
	now := s.Now()
	nodeID := uuid.NewString()
	reqID := uuid.NewString()
	sortIndex, err := s.nextSortIndex(ctx, projectID, parentID)
	if err != nil {
		return Node{}, Request{}, err
	}

	n := Node{
		ID:        nodeID,
		ProjectID: projectID,
		ParentID:  parentID,
		Type:      NodeTypeRequest,
		Name:      name,
		SortIndex: sortIndex,
		CreatedAt: now,
		UpdatedAt: now,
	}

	req := Request{
		ID:          reqID,
		NodeID:      nodeID,
		Method:      "GET",
		URLMode:     URLModeFull,
		URLFull:     "",
		Path:        "",
		QueryParams: []KV{},
		Headers:     []KV{},
		Body:        Body{Type: BodyTypeNone},
		Auth:        Auth{Type: AuthTypeNone},
		Description: "",
		UpdatedAt:   now,
	}

	err = s.WithTx(ctx, func(tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO nodes(id,project_id,parent_id,type,name,sort_index,created_at,updated_at)
			VALUES(?,?,?,?,?,?,?,?)
		`, n.ID, n.ProjectID, n.ParentID, n.Type, n.Name, n.SortIndex, n.CreatedAt, n.UpdatedAt)
		if err != nil {
			return err
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO requests(id,node_id,method,url_mode,url_full,path,query_params_json,headers_json,body_json,auth_json,description,updated_at)
			VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
		`, req.ID, req.NodeID, req.Method, req.URLMode, req.URLFull, req.Path, mustJSON(req.QueryParams), mustJSON(req.Headers), mustJSON(req.Body), mustJSON(req.Auth), req.Description, req.UpdatedAt)
		return err
	})
	if err != nil {
		return Node{}, Request{}, err
	}

	return n, req, nil
}

func (s *Store) RenameNode(ctx context.Context, nodeID, name string) error {
	_, err := s.db.ExecContext(ctx, `UPDATE nodes SET name=?, updated_at=? WHERE id=?`, name, s.Now(), nodeID)
	return err
}

func (s *Store) DeleteNode(ctx context.Context, nodeID string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM nodes WHERE id=?`, nodeID)
	return err
}

func (s *Store) GetRequest(ctx context.Context, requestID string) (Request, error) {
	var req Request
	var qpJSON, hdrJSON, bodyJSON, authJSON string
	err := s.db.QueryRowContext(ctx, `
		SELECT id,node_id,method,url_mode,url_full,path,query_params_json,headers_json,body_json,auth_json,description,updated_at
		FROM requests WHERE id=?
	`, requestID).Scan(
		&req.ID,
		&req.NodeID,
		&req.Method,
		&req.URLMode,
		&req.URLFull,
		&req.Path,
		&qpJSON,
		&hdrJSON,
		&bodyJSON,
		&authJSON,
		&req.Description,
		&req.UpdatedAt,
	)
	if err != nil {
		return Request{}, err
	}
	_ = fromJSON(qpJSON, &req.QueryParams)
	_ = fromJSON(hdrJSON, &req.Headers)
	_ = fromJSON(bodyJSON, &req.Body)
	_ = fromJSON(authJSON, &req.Auth)
	return req, nil
}

func (s *Store) SaveRequest(ctx context.Context, req Request) error {
	now := s.Now()
	req.UpdatedAt = now
	if req.QueryParams == nil {
		req.QueryParams = []KV{}
	}
	if req.Headers == nil {
		req.Headers = []KV{}
	}

	_, err := s.db.ExecContext(ctx, `
		UPDATE requests
		SET method=?,
			url_mode=?,
			url_full=?,
			path=?,
			query_params_json=?,
			headers_json=?,
			body_json=?,
			auth_json=?,
			description=?,
			updated_at=?
		WHERE id=?
	`, req.Method, req.URLMode, req.URLFull, req.Path, mustJSON(req.QueryParams), mustJSON(req.Headers), mustJSON(req.Body), mustJSON(req.Auth), req.Description, req.UpdatedAt, req.ID)
	return err
}

func (s *Store) GetTree(ctx context.Context, projectID string) ([]TreeNode, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id,parent_id,type,name,sort_index
		FROM nodes
		WHERE project_id=?
	`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type row struct {
		ID        string
		ParentID  *string
		Type      NodeType
		Name      string
		SortIndex int64
	}

	var nodes []row
	var requestNodeIDs []string
	for rows.Next() {
		var r row
		var parent sql.NullString
		if err := rows.Scan(&r.ID, &parent, &r.Type, &r.Name, &r.SortIndex); err != nil {
			return nil, err
		}
		if parent.Valid {
			r.ParentID = &parent.String
		}
		nodes = append(nodes, r)
		if r.Type == NodeTypeRequest {
			requestNodeIDs = append(requestNodeIDs, r.ID)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Map node_id -> request_id
	type reqMeta struct {
		ID     string
		Method string
	}
	nodeToRequest := map[string]reqMeta{}
	if len(requestNodeIDs) > 0 {
		placeholders := strings.TrimRight(strings.Repeat("?,", len(requestNodeIDs)), ",")
		q := `SELECT id,node_id,method FROM requests WHERE node_id IN (` + placeholders + `)`
		args := make([]any, 0, len(requestNodeIDs))
		for _, id := range requestNodeIDs {
			args = append(args, id)
		}
		rrows, err := s.db.QueryContext(ctx, q, args...)
		if err != nil {
			return nil, err
		}
		for rrows.Next() {
			var rid, nid, method string
			if err := rrows.Scan(&rid, &nid, &method); err != nil {
				_ = rrows.Close()
				return nil, err
			}
			nodeToRequest[nid] = reqMeta{ID: rid, Method: method}
		}
		_ = rrows.Close()
	}

	children := map[string][]row{}
	for _, n := range nodes {
		p := ""
		if n.ParentID != nil {
			p = *n.ParentID
		}
		children[p] = append(children[p], n)
	}

	for k := range children {
		sort.SliceStable(children[k], func(i, j int) bool {
			a, b := children[k][i], children[k][j]
			if a.SortIndex != b.SortIndex {
				return a.SortIndex < b.SortIndex
			}
			return a.Name < b.Name
		})
	}

	var build func(parent string) []TreeNode
	build = func(parent string) []TreeNode {
		var out []TreeNode
		for _, n := range children[parent] {
			tn := TreeNode{ID: n.ID, Type: n.Type, Name: n.Name}
			if n.Type == NodeTypeRequest {
				if meta, ok := nodeToRequest[n.ID]; ok {
					tn.RequestID = &meta.ID
					tn.Method = meta.Method
				}
			} else {
				tn.Children = build(n.ID)
			}
			out = append(out, tn)
		}
		return out
	}

	return build(""), nil
}

func (s *Store) DuplicateRequest(ctx context.Context, requestID string) (Node, Request, error) {
	// Minimal v1: create a new request node at root with copied request data.
	req, err := s.GetRequest(ctx, requestID)
	if err != nil {
		return Node{}, Request{}, err
	}
	var projectID string
	var parent sql.NullString
	var nodeName string
	err = s.db.QueryRowContext(ctx, `SELECT project_id,parent_id,name FROM nodes WHERE id=?`, req.NodeID).Scan(&projectID, &parent, &nodeName)
	if err != nil {
		return Node{}, Request{}, err
	}
	var parentID *string
	if parent.Valid {
		parentID = &parent.String
	}
	newNode, newReq, err := s.CreateRequest(ctx, projectID, parentID, nodeName+" Copy")
	if err != nil {
		return Node{}, Request{}, err
	}
	newReq.Method = req.Method
	newReq.URLMode = req.URLMode
	newReq.URLFull = req.URLFull
	newReq.Path = req.Path
	newReq.QueryParams = req.QueryParams
	newReq.Headers = req.Headers
	newReq.Body = req.Body
	newReq.Auth = req.Auth
	newReq.Description = req.Description
	if err := s.SaveRequest(ctx, newReq); err != nil {
		return Node{}, Request{}, err
	}
	return newNode, newReq, nil
}
