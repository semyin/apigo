package storage

import "database/sql"

func migrate(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS projects (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			active_env_id TEXT
		);`,
		`CREATE TABLE IF NOT EXISTS nodes (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			parent_id TEXT,
			type TEXT NOT NULL CHECK(type IN ('folder','request')),
			name TEXT NOT NULL,
			sort_index INTEGER NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
			FOREIGN KEY(parent_id) REFERENCES nodes(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS requests (
			id TEXT PRIMARY KEY,
			node_id TEXT NOT NULL UNIQUE,
			method TEXT NOT NULL,
			url_mode TEXT NOT NULL CHECK(url_mode IN ('full','basepath')),
			url_full TEXT NOT NULL,
			path TEXT NOT NULL,
			query_params_json TEXT NOT NULL,
			headers_json TEXT NOT NULL,
			body_json TEXT NOT NULL,
			auth_json TEXT NOT NULL,
			description TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY(node_id) REFERENCES nodes(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS environments (
			id TEXT PRIMARY KEY,
			project_id TEXT NOT NULL,
			name TEXT NOT NULL,
			base_url TEXT NOT NULL,
			vars_json TEXT NOT NULL,
			updated_at INTEGER NOT NULL,
			FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value_json TEXT NOT NULL,
			updated_at INTEGER NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS history (
			id TEXT PRIMARY KEY,
			request_id TEXT NOT NULL,
			started_at INTEGER NOT NULL,
			duration_ms INTEGER NOT NULL,
			status INTEGER NOT NULL,
			req_snapshot_json TEXT NOT NULL,
			res_snapshot_json TEXT NOT NULL,
			FOREIGN KEY(request_id) REFERENCES requests(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_nodes_project_parent_sort ON nodes(project_id, parent_id, sort_index);`,
		`CREATE INDEX IF NOT EXISTS idx_env_project ON environments(project_id);`,
		`CREATE INDEX IF NOT EXISTS idx_hist_req_started ON history(request_id, started_at DESC);`,
	}

	for _, stmt := range stmts {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}

