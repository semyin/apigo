# Apigo 桌面版 (Go + Wails + React) 实现计划

基于现有静态模板 [`D:\workspace\semyin\apigo\API-Studio-Pro.html`](./API-Studio-Pro.html) 做一个单机桌面 API 调试与管理工具：Go 负责存储(SQLite)、HTTP 请求发送、Postman/OpenAPI 导入导出；React 负责 UI（尽量复刻模板布局、交互、主题、可拖拽列宽）。完全离线可用，中英可切换，URL 同时支持“完整 URL”和“BaseURL(环境)+Path(请求)”。

## Summary

- 桌面框架：Wails v2（Go 后端 + React 前端打包）。
- 前端：React + TypeScript + Vite + Tailwind（构建态，不用 CDN）。
- 离线资源：字体用 `@fontsource/inter`、`@fontsource/jetbrains-mono`；图标用 `lucide-react`（替换模板里的 FontAwesome class）。
- 后端：Go `net/http` 发送请求；SQLite（推荐 `modernc.org/sqlite` + `database/sql`，避免 cgo）。

## Key Changes (Architecture + Interfaces)

### 技术栈与项目结构（落在 `D:\workspace\semyin\apigo\`）

- 桌面框架：Wails v2（Go 后端 + React 前端打包）。
- 前端：React + TypeScript + Vite + Tailwind（构建态，不用 CDN）。
- 离线资源：字体用 `@fontsource/inter`、`@fontsource/jetbrains-mono`；图标用 `lucide-react`（替换模板里的 FontAwesome class）。
- 后端：Go `net/http` 发送请求；SQLite（推荐 `modernc.org/sqlite` + `database/sql`，避免 cgo）。

### Go 后端模块划分（Wails 绑定方法）

- `storage`：SQLite 初始化、迁移、CRUD。
- `httpclient`：组装请求（URL/params/headers/body/auth/变量替换/timeout）并返回响应（status/headers/body/duration/size）。
- `importer/postman`：Postman v2.1 JSON 导入为项目树与请求模型。
- `exporter/postman`：导出 Postman v2.1 JSON（与导入闭环）。
- `exporter/openapi`：导出 OpenAPI 3.x（尽量可用且可被下游工具接受）。

Wails 暴露给前端的核心方法（决定完成，不留给实现者选择）：

- Project: `ListProjects()`, `CreateProject(name)`, `DeleteProject(id)`, `ImportPostman(filePath)`, `ExportPostman(projectId, filePath)`, `ExportOpenAPI(projectId, filePath, opts)`
- Tree: `GetTree(projectId)`, `CreateFolder(parentId, name)`, `CreateRequest(parentId, name)`, `RenameNode(id, name)`, `MoveNode(id, newParentId, newIndex)`, `DeleteNode(id)`
- Request: `GetRequest(requestId)`, `SaveRequest(request)`, `DuplicateRequest(requestId)`, `SendRequest(requestId, runtimeOverrides?)`
- Env: `ListEnvs(projectId)`, `SaveEnv(env)`, `DeleteEnv(envId)`, `SetActiveEnv(projectId, envId)`
- Settings: `GetSettings()`, `SaveSettings(settings)`
- File dialogs：由前端触发后端 `OpenFileDialog()/SaveFileDialog()`（Wails runtime）

### 数据模型与 SQLite Schema（最小但可导出 OpenAPI）

- `projects(id, name, created_at, updated_at, active_env_id)`
- `nodes(id, project_id, parent_id, type['folder'|'request'], name, sort_index, created_at, updated_at)`
- `requests(id, node_id, method, url_mode['full'|'basepath'], url_full, path, query_params_json, headers_json, body_json, auth_json, description, updated_at)`
- `environments(id, project_id, name, base_url, vars_json, updated_at)`
- `settings(key, value_json, updated_at)`
- `history(id, request_id, started_at, duration_ms, status, req_snapshot_json, res_snapshot_json)`（可限制保留条数，比如每请求 50 条）

其中 `query_params_json/headers_json` 统一用数组结构：

- `[{ enabled: bool, key: string, value: string, type: 'String'|'Integer'|'Boolean'|'Number', description: string }]`

`body_json`：

- `{ type: 'none'|'json'|'text'|'urlencoded'|'multipart', jsonText?: string, text?: string, fields?: [{enabled,key,value,type?,description?,isFile?,filePath?}] }`

`auth_json`：

- `{'type':'none'|'bearer'|'basic'|'apikey', bearerToken?, basicUser?, basicPass?, apiKeyIn:'header'|'query', apiKeyName?, apiKeyValue? }`

### 变量与 URL 解析规则（决定完成）

- 变量语法：`{{VAR_NAME}}`，支持出现在 BaseURL、Path、完整 URL、Params、Headers、Body 中。
- 变量来源优先级：内置变量（如 `{{$timestamp}}`, `{{$uuid}}`）> 当前环境 `vars_json` >（可选）全局变量（存到 `settings`，若无则跳过）。
- URL 模式：
  - `full`：直接用 `url_full`（变量替换后）。
  - `basepath`：最终 URL = `env.base_url` + `path`（两端斜杠归一化），再叠加 `query_params`（enabled=true 的项）。
- OpenAPI 导出：
  - servers：优先用所有 environments 的 `base_url`；若请求是 `full` 且解析出 host 不同，则补充为额外 server。
  - paths：`basepath` 用 `path`；`full` 从 URL 解析 path。
  - securitySchemes：根据请求 auth 收集并去重；operation.security 按请求设置。

## UI Implementation (React, 复刻模板交互)

- 主布局：左侧项目树 + 中间请求编辑器 + 右侧响应面板；顶部含环境选择、主题切换、设置按钮。
- 左侧树：文件夹/请求，右键菜单（新建/重命名/删除/复制）；拖拽移动与排序（MVP 可先做“移动到文件夹”按钮，第二步再做拖拽）。
- 请求编辑器：
  - 方法下拉（GET/POST/PUT/DELETE/PATCH）
  - URL 输入：提供“完整 URL / Base+Path”切换；Base+Path 模式下 Base 来自环境只读显示，编辑 Path。
  - Tabs：Params / Headers / Body / Auth（按模板）
  - Params/Headers：支持 enabled 勾选、Key/Type/Value/Description 列；列宽拖拽（CSS 变量 + mouse events）
  - Body：JSON/Text 编辑器（CodeMirror 6）；urlencoded 为表格；multipart 支持文件选择（Wails file dialog，存 filePath）
  - Auth：No Auth/Bearer/Basic/API Key（header/query）
- 响应面板：
  - 状态码、耗时、大小
  - Tabs：Body / Headers；Body 自动检测 JSON 并可 pretty；支持复制/保存到文件
- 中英切换：`react-i18next`，语言选择存 `settings`；默认按系统语言。
- 离线：去掉模板中 Google Fonts、Tailwind CDN、FontAwesome CDN 的依赖，全部走构建产物。

## Import/Export (Decision Complete)

- Postman 导入：支持 v2.1；递归 item；folder->nodes(folder)；request->nodes(request)+requests；映射 method/url/headers/body/auth；尽量保留原始信息（如 raw body）。
- Postman 导出：按当前项目树导出 v2.1 collection；环境变量单独提供“导出环境”为 Postman environment JSON（按钮在环境管理页）。
- OpenAPI 导出：输出 OpenAPI 3.x JSON（或 YAML 二选一，默认 JSON）；参数来自 Params/Headers（enabled=true）；Body 根据类型映射到 requestBody；auth 映射到 securitySchemes。

## Test Plan (最少但关键)

- Go 单元测试：
  - Postman 导入：包含 folder + 多种 body/auth 的样例 JSON 能完整导入；请求数、树结构、关键字段一致。
  - Postman 导出：导入后再导出，关键字段保持一致（允许排序差异）。
  - OpenAPI 导出：生成的 JSON 可通过基础 schema 校验（至少能被 swagger-parser/openapi tools 读取）。
  - URL 拼装与变量替换：覆盖 full/basepath、query 合并、斜杠、缺失变量处理。
- 手工验收（桌面端）：
  - 新建项目->新建请求->发送->显示响应；重启应用数据仍在。
  - 导入一个真实 Postman collection，能打开请求并发送。
  - 导出 Postman 与 OpenAPI 文件可被 Postman/Swagger UI 打开。

## Assumptions / Defaults

- 只做 HTTP/HTTPS（REST），不做 WebSocket/gRPC。
- 单用户无登录；数据存 SQLite（AppData 目录下）。
- OAuth2、Mock、测试断言、团队协作不做进 MVP。
- 树的拖拽排序若影响进度，可先用“移动到…”对话框替代，后续再补拖拽。

