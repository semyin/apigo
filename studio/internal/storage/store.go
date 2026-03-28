package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
	db *sql.DB
}

func Open(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, err
	}

	// SQLite has a single-writer locking model. Multiple pooled connections can easily
	// trigger SQLITE_BUSY under concurrent UI actions, so we serialize DB access.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	// Best effort pragmas.
	_, _ = db.Exec("PRAGMA journal_mode = WAL")
	_, _ = db.Exec("PRAGMA busy_timeout = 5000")
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		_ = db.Close()
		return nil, err
	}

	if err := migrate(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) Now() int64 {
	return time.Now().UnixMilli()
}

func (s *Store) WithTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	if err := fn(tx); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

func toJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(b), nil
}

func mustJSON(v any) string {
	s, err := toJSON(v)
	if err != nil {
		// This should never happen for our own structs. Fail hard to avoid writing corrupt rows.
		panic(err)
	}
	return s
}

func fromJSON[T any](s string, v *T) error {
	if s == "" {
		return errors.New("empty json")
	}
	return json.Unmarshal([]byte(s), v)
}

func wrapErr(op string, err error) error {
	if err == nil {
		return nil
	}
	return fmt.Errorf("%s: %w", op, err)
}
