import type {
  BootstrapData,
  CreateRequestResult,
  Environment,
  HistoryItem,
  Node,
  Project,
  Request,
  SendResult,
  Settings,
  TreeNode,
} from './types'

function app(): any {
  const a = (window as any)?.go?.main?.App
  if (!a) throw new Error('Backend not ready (window.go.main.App missing)')
  return a
}

export const backend = {
  bootstrap: (): Promise<BootstrapData> => app().Bootstrap(),

  listProjects: (): Promise<Project[]> => app().ListProjects(),
  createProject: (name: string): Promise<Project> => app().CreateProject(name),
  deleteProject: (projectId: string): Promise<void> => app().DeleteProject(projectId),

  getTree: (projectId: string): Promise<TreeNode[]> => app().GetTree(projectId),
  createFolder: (
    projectId: string,
    parentId: string | null,
    name: string
  ): Promise<Node> => app().CreateFolder(projectId, parentId, name),
  createRequest: (
    projectId: string,
    parentId: string | null,
    name: string
  ): Promise<CreateRequestResult> => app().CreateRequest(projectId, parentId, name),
  duplicateRequest: (requestId: string): Promise<CreateRequestResult> =>
    app().DuplicateRequest(requestId),
  renameNode: (nodeId: string, name: string): Promise<void> => app().RenameNode(nodeId, name),
  moveNode: (nodeId: string, parentId: string | null): Promise<void> =>
    app().MoveNode(nodeId, parentId),
  deleteNode: (nodeId: string): Promise<void> => app().DeleteNode(nodeId),

  getRequest: (requestId: string): Promise<Request> => app().GetRequest(requestId),
  saveRequest: (req: Request): Promise<void> => app().SaveRequest(req),
  sendRequest: (requestId: string): Promise<SendResult> => app().SendRequest(requestId),

  listHistory: (projectId: string, limit: number): Promise<HistoryItem[]> =>
    app().ListHistory(projectId, limit),
  getHistory: (historyId: string): Promise<SendResult> => app().GetHistory(historyId),
  deleteHistory: (historyId: string): Promise<void> => app().DeleteHistory(historyId),

  listEnvs: (projectId: string): Promise<Environment[]> => app().ListEnvs(projectId),
  saveEnv: (env: Environment): Promise<Environment> => app().SaveEnv(env),
  deleteEnv: (envId: string): Promise<void> => app().DeleteEnv(envId),
  setActiveEnv: (projectId: string, envId: string): Promise<void> =>
    app().SetActiveEnv(projectId, envId),

  getSettings: (): Promise<Settings> => app().GetSettings(),
  saveSettings: (settings: Settings): Promise<void> => app().SaveSettings(settings),

  importPostmanFromDialog: (): Promise<string> => app().ImportPostmanFromDialog(),
  exportPostmanFromDialog: (projectId: string): Promise<string> =>
    app().ExportPostmanFromDialog(projectId),
  exportOpenAPIFromDialog: (projectId: string): Promise<string> =>
    app().ExportOpenAPIFromDialog(projectId),
}
