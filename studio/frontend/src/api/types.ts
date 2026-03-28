export type NodeType = 'folder' | 'request'

export type KVType = 'String' | 'Integer' | 'Number' | 'Boolean' | 'Array' | 'Object'

export type KV = {
  enabled: boolean
  key: string
  value: string
  type: KVType
  description: string
}

export type BodyType = 'none' | 'json' | 'text' | 'urlencoded' | 'multipart'

export type BodyField = {
  enabled: boolean
  key: string
  value?: string
  type?: KVType
  description?: string
  isFile?: boolean
  filePath?: string
}

export type Body = {
  type: BodyType
  jsonText?: string
  text?: string
  fields?: BodyField[]
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey' | 'oauth2'
export type APIKeyIn = 'header' | 'query'

export type Auth = {
  type: AuthType
  bearerToken?: string
  basicUser?: string
  basicPass?: string
  apiKeyIn?: APIKeyIn
  apiKeyName?: string
  apiKeyValue?: string
}

export type URLMode = 'full' | 'basepath'

export type Request = {
  id: string
  nodeId: string
  method: string
  urlMode: URLMode
  urlFull: string
  path: string
  queryParams: KV[]
  headers: KV[]
  body: Body
  auth: Auth
  description: string
  updatedAt: number
}

export type TreeNode = {
  id: string
  type: NodeType
  name: string
  requestId?: string
  method?: string
  children?: TreeNode[]
}

export type Project = {
  id: string
  name: string
  activeEnvId?: string
  createdAt: number
  updatedAt: number
}

export type Node = {
  id: string
  projectId: string
  parentId?: string
  type: NodeType
  name: string
  sortIndex: number
  createdAt: number
  updatedAt: number
}

export type CreateRequestResult = {
  node: Node
  request: Request
}

export type Environment = {
  id: string
  projectId: string
  name: string
  baseUrl: string
  vars: Record<string, string>
  updatedAt: number
}

export type Settings = {
  theme: 'light' | 'dark' | 'system'
  language: 'zh' | 'en'
  requestTimeoutMs: number
  autoSave: boolean
}

export type BootstrapData = {
  settings: Settings
  projects: Project[]
  activeProjectId: string
  environments: Environment[]
  activeEnvId: string
  tree: TreeNode[]
  selectedRequestId: string
  selectedRequest: Request
}

export type SendResult = {
  ok: boolean
  error?: string
  status: number
  statusText?: string
  durationMs: number
  sizeBytes: number
  headers: Record<string, string[]>
  body: string
}

export type HistoryItem = {
  id: string
  requestId: string
  requestName: string
  method: string
  urlMode: URLMode
  urlFull: string
  path: string
  startedAt: number
  durationMs: number
  status: number
  ok: boolean
  error?: string
}
