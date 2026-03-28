package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"

	"apigo/internal/appdata"
	"apigo/internal/httpclient"
	"apigo/internal/openapi"
	"apigo/internal/postman"
	"apigo/internal/storage"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// App struct
type App struct {
	ctx context.Context
	store *storage.Store
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	dbPath, err := appdata.DBPath()
	if err != nil {
		runtime.LogErrorf(ctx, "db path error: %v", err)
		return
	}

	store, err := storage.Open(dbPath)
	if err != nil {
		runtime.LogErrorf(ctx, "open db error: %v", err)
		return
	}
	a.store = store
}

func (a *App) shutdown(ctx context.Context) {
	if a.store != nil {
		_ = a.store.Close()
	}
}

type BootstrapData struct {
	Settings          storage.Settings      `json:"settings"`
	Projects          []storage.Project     `json:"projects"`
	ActiveProjectID   string                `json:"activeProjectId"`
	Environments      []storage.Environment `json:"environments"`
	ActiveEnvID       string                `json:"activeEnvId"`
	Tree              []storage.TreeNode    `json:"tree"`
	SelectedRequestID string                `json:"selectedRequestId"`
	SelectedRequest   storage.Request       `json:"selectedRequest"`
}

func (a *App) Bootstrap() (BootstrapData, error) {
	if a.store == nil {
		return BootstrapData{}, errors.New("store not ready")
	}

	ctx := a.ctx
	activeProjectID, selectedRequestID, err := a.store.EnsureSeed(ctx)
	if err != nil {
		return BootstrapData{}, err
	}

	settings, err := a.store.GetSettings(ctx)
	if err != nil {
		return BootstrapData{}, err
	}

	projects, err := a.store.ListProjects(ctx)
	if err != nil {
		return BootstrapData{}, err
	}

	envs, err := a.store.ListEnvs(ctx, activeProjectID)
	if err != nil {
		return BootstrapData{}, err
	}

	activeEnv, err := a.store.GetActiveEnv(ctx, activeProjectID)
	if err != nil {
		return BootstrapData{}, err
	}

	tree, err := a.store.GetTree(ctx, activeProjectID)
	if err != nil {
		return BootstrapData{}, err
	}

	req, err := a.store.GetRequest(ctx, selectedRequestID)
	if err != nil {
		return BootstrapData{}, err
	}

	return BootstrapData{
		Settings:          settings,
		Projects:          projects,
		ActiveProjectID:   activeProjectID,
		Environments:      envs,
		ActiveEnvID:       activeEnv.ID,
		Tree:              tree,
		SelectedRequestID: selectedRequestID,
		SelectedRequest:   req,
	}, nil
}

func (a *App) ListProjects() ([]storage.Project, error) {
	if a.store == nil {
		return nil, errors.New("store not ready")
	}
	return a.store.ListProjects(a.ctx)
}

func (a *App) CreateProject(name string) (storage.Project, error) {
	if a.store == nil {
		return storage.Project{}, errors.New("store not ready")
	}
	return a.store.CreateProject(a.ctx, name)
}

func (a *App) DeleteProject(projectID string) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.DeleteProject(a.ctx, projectID)
}

func (a *App) GetTree(projectID string) ([]storage.TreeNode, error) {
	if a.store == nil {
		return nil, errors.New("store not ready")
	}
	return a.store.GetTree(a.ctx, projectID)
}

func (a *App) CreateFolder(projectID string, parentID *string, name string) (storage.Node, error) {
	if a.store == nil {
		return storage.Node{}, errors.New("store not ready")
	}
	return a.store.CreateFolder(a.ctx, projectID, parentID, name)
}

type CreateRequestResult struct {
	Node    storage.Node    `json:"node"`
	Request storage.Request `json:"request"`
}

func (a *App) CreateRequest(projectID string, parentID *string, name string) (CreateRequestResult, error) {
	if a.store == nil {
		return CreateRequestResult{}, errors.New("store not ready")
	}
	n, r, err := a.store.CreateRequest(a.ctx, projectID, parentID, name)
	if err != nil {
		return CreateRequestResult{}, err
	}
	return CreateRequestResult{Node: n, Request: r}, nil
}

func (a *App) DuplicateRequest(requestID string) (CreateRequestResult, error) {
	if a.store == nil {
		return CreateRequestResult{}, errors.New("store not ready")
	}
	n, r, err := a.store.DuplicateRequest(a.ctx, requestID)
	if err != nil {
		return CreateRequestResult{}, err
	}
	return CreateRequestResult{Node: n, Request: r}, nil
}

func (a *App) RenameNode(nodeID, name string) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.RenameNode(a.ctx, nodeID, name)
}

func (a *App) DeleteNode(nodeID string) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.DeleteNode(a.ctx, nodeID)
}

func (a *App) GetRequest(requestID string) (storage.Request, error) {
	if a.store == nil {
		return storage.Request{}, errors.New("store not ready")
	}
	return a.store.GetRequest(a.ctx, requestID)
}

func (a *App) SaveRequest(req storage.Request) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.SaveRequest(a.ctx, req)
}

func (a *App) ListEnvs(projectID string) ([]storage.Environment, error) {
	if a.store == nil {
		return nil, errors.New("store not ready")
	}
	return a.store.ListEnvs(a.ctx, projectID)
}

func (a *App) SaveEnv(env storage.Environment) (storage.Environment, error) {
	if a.store == nil {
		return storage.Environment{}, errors.New("store not ready")
	}
	return a.store.SaveEnv(a.ctx, env)
}

func (a *App) DeleteEnv(envID string) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.DeleteEnv(a.ctx, envID)
}

func (a *App) SetActiveEnv(projectID, envID string) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.SetActiveEnv(a.ctx, projectID, envID)
}

func (a *App) GetSettings() (storage.Settings, error) {
	if a.store == nil {
		return storage.Settings{}, errors.New("store not ready")
	}
	return a.store.GetSettings(a.ctx)
}

func (a *App) SaveSettings(settings storage.Settings) error {
	if a.store == nil {
		return errors.New("store not ready")
	}
	return a.store.SaveSettings(a.ctx, settings)
}

func (a *App) SendRequest(requestID string) (storage.SendResult, error) {
	if a.store == nil {
		return storage.SendResult{OK: false, Error: "store not ready"}, errors.New("store not ready")
	}

	ctx := a.ctx
	req, err := a.store.GetRequest(ctx, requestID)
	if err != nil {
		return storage.SendResult{OK: false, Error: err.Error()}, err
	}
	projectID, err := a.store.GetProjectIDByRequestID(ctx, requestID)
	if err != nil {
		return storage.SendResult{OK: false, Error: err.Error()}, err
	}
	env, err := a.store.GetActiveEnv(ctx, projectID)
	if err != nil {
		return storage.SendResult{OK: false, Error: err.Error()}, err
	}
	settings, _ := a.store.GetSettings(ctx)

	res := httpclient.Send(ctx, httpclient.SendInput{
		Request: req,
		Env:     env,
		Timeout: time.Duration(settings.RequestTimeoutMs) * time.Millisecond,
	})
	if !res.OK {
		return res, errors.New(res.Error)
	}
	return res, nil
}

func (a *App) ImportPostmanFromDialog() (string, error) {
	if a.store == nil {
		return "", errors.New("store not ready")
	}
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Import Postman Collection",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", err
	}
	if path == "" {
		return "", nil
	}
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	if err := postman.ValidateCollection(data); err != nil {
		return "", err
	}
	return postman.ImportCollection(a.ctx, a.store, data)
}

func (a *App) ExportPostmanFromDialog(projectID string) (string, error) {
	if a.store == nil {
		return "", errors.New("store not ready")
	}
	project, err := a.store.GetProject(a.ctx, projectID)
	if err != nil {
		return "", err
	}
	defaultName := sanitizeFileName(project.Name)
	if defaultName == "" {
		defaultName = "collection"
	}
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export Postman Collection",
		DefaultFilename: defaultName + ".postman_collection.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil
	}
	b, err := postman.ExportProjectAsCollection(a.ctx, a.store, projectID)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(savePath), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(savePath, b, 0o644); err != nil {
		return "", err
	}
	return savePath, nil
}

func (a *App) ExportOpenAPIFromDialog(projectID string) (string, error) {
	if a.store == nil {
		return "", errors.New("store not ready")
	}
	project, err := a.store.GetProject(a.ctx, projectID)
	if err != nil {
		return "", err
	}
	defaultName := sanitizeFileName(project.Name)
	if defaultName == "" {
		defaultName = "openapi"
	}
	savePath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "Export OpenAPI (JSON)",
		DefaultFilename: defaultName + ".openapi.json",
		Filters: []runtime.FileFilter{
			{DisplayName: "JSON", Pattern: "*.json"},
		},
	})
	if err != nil {
		return "", err
	}
	if savePath == "" {
		return "", nil
	}
	b, err := openapi.ExportProject(a.ctx, a.store, projectID)
	if err != nil {
		return "", err
	}
	if err := os.MkdirAll(filepath.Dir(savePath), 0o755); err != nil {
		return "", err
	}
	if err := os.WriteFile(savePath, b, 0o644); err != nil {
		return "", err
	}
	return savePath, nil
}

func sanitizeFileName(name string) string {
	// Extremely small helper: keep it conservative.
	name = filepath.Clean(name)
	name = filepath.Base(name)
	name = strings.TrimSpace(name)
	if name == "." || name == ".." {
		return ""
	}
	name = strings.ReplaceAll(name, ":", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	name = strings.ReplaceAll(name, "/", "_")
	name = strings.ReplaceAll(name, "*", "_")
	name = strings.ReplaceAll(name, "?", "_")
	name = strings.ReplaceAll(name, "\"", "_")
	name = strings.ReplaceAll(name, "<", "_")
	name = strings.ReplaceAll(name, ">", "_")
	name = strings.ReplaceAll(name, "|", "_")
	return name
}
