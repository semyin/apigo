package storage

type Project struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	ActiveEnvID *string `json:"activeEnvId,omitempty"`
	CreatedAt   int64   `json:"createdAt"`
	UpdatedAt   int64   `json:"updatedAt"`
}

type NodeType string

const (
	NodeTypeFolder  NodeType = "folder"
	NodeTypeRequest NodeType = "request"
)

type Node struct {
	ID        string   `json:"id"`
	ProjectID string   `json:"projectId"`
	ParentID  *string  `json:"parentId,omitempty"`
	Type      NodeType `json:"type"`
	Name      string   `json:"name"`
	SortIndex int64    `json:"sortIndex"`
	CreatedAt int64    `json:"createdAt"`
	UpdatedAt int64    `json:"updatedAt"`
}

type TreeNode struct {
	ID        string     `json:"id"`
	Type      NodeType   `json:"type"`
	Name      string     `json:"name"`
	RequestID *string    `json:"requestId,omitempty"`
	Method    string     `json:"method,omitempty"`
	Children  []TreeNode `json:"children,omitempty"`
}

type KVType string

const (
	KVTypeString  KVType = "String"
	KVTypeInteger KVType = "Integer"
	KVTypeNumber  KVType = "Number"
	KVTypeBoolean KVType = "Boolean"
)

type KV struct {
	Enabled     bool   `json:"enabled"`
	Key         string `json:"key"`
	Value       string `json:"value"`
	Type        KVType `json:"type"`
	Description string `json:"description"`
}

type BodyType string

const (
	BodyTypeNone      BodyType = "none"
	BodyTypeJSON      BodyType = "json"
	BodyTypeText      BodyType = "text"
	BodyTypeURLEncoded BodyType = "urlencoded"
	BodyTypeMultipart BodyType = "multipart"
)

type BodyField struct {
	Enabled     bool   `json:"enabled"`
	Key         string `json:"key"`
	Value       string `json:"value,omitempty"`
	Type        KVType `json:"type,omitempty"`
	Description string `json:"description,omitempty"`
	IsFile      bool   `json:"isFile,omitempty"`
	FilePath    string `json:"filePath,omitempty"`
}

type Body struct {
	Type     BodyType    `json:"type"`
	JSONText string      `json:"jsonText,omitempty"`
	Text     string      `json:"text,omitempty"`
	Fields   []BodyField `json:"fields,omitempty"`
}

type AuthType string

const (
	AuthTypeNone   AuthType = "none"
	AuthTypeBearer AuthType = "bearer"
	AuthTypeBasic  AuthType = "basic"
	AuthTypeAPIKey AuthType = "apikey"
)

type APIKeyIn string

const (
	APIKeyInHeader APIKeyIn = "header"
	APIKeyInQuery  APIKeyIn = "query"
)

type Auth struct {
	Type        AuthType `json:"type"`
	BearerToken string   `json:"bearerToken,omitempty"`
	BasicUser   string   `json:"basicUser,omitempty"`
	BasicPass   string   `json:"basicPass,omitempty"`
	APIKeyIn    APIKeyIn `json:"apiKeyIn,omitempty"`
	APIKeyName  string   `json:"apiKeyName,omitempty"`
	APIKeyValue string   `json:"apiKeyValue,omitempty"`
}

type URLMode string

const (
	URLModeFull     URLMode = "full"
	URLModeBasePath URLMode = "basepath"
)

type Request struct {
	ID          string  `json:"id"`
	NodeID      string  `json:"nodeId"`
	Method      string  `json:"method"`
	URLMode     URLMode `json:"urlMode"`
	URLFull     string  `json:"urlFull"`
	Path        string  `json:"path"`
	QueryParams []KV    `json:"queryParams"`
	Headers     []KV    `json:"headers"`
	Body        Body    `json:"body"`
	Auth        Auth    `json:"auth"`
	Description string  `json:"description"`
	UpdatedAt   int64   `json:"updatedAt"`
}

type Environment struct {
	ID        string            `json:"id"`
	ProjectID string            `json:"projectId"`
	Name      string            `json:"name"`
	BaseURL   string            `json:"baseUrl"`
	Vars      map[string]string `json:"vars"`
	UpdatedAt int64             `json:"updatedAt"`
}

type Settings struct {
	Theme            string `json:"theme"` // "light" | "dark" | "system"
	Language         string `json:"language"` // "zh" | "en"
	RequestTimeoutMs int64  `json:"requestTimeoutMs"`
	AutoSave         bool   `json:"autoSave"`
}

type SendResult struct {
	OK         bool                `json:"ok"`
	Error      string              `json:"error,omitempty"`
	Status     int                 `json:"status"`
	StatusText string              `json:"statusText,omitempty"`
	DurationMs int64               `json:"durationMs"`
	SizeBytes  int64               `json:"sizeBytes"`
	Headers    map[string][]string `json:"headers"`
	Body       string              `json:"body"`
}
