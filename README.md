# API Studio

基于静态模板 [`API-Studio-Pro.html`](./API-Studio-Pro.html) 打造的桌面 API 调试与管理工具（类似 ApiFox）。使用 **Wails v2 (Go 后端 + React 前端)**，离线可用。

## 功能概览

- 目录树：文件夹/接口展开动画、右键菜单（新增/重命名/删除），最多 4 层嵌套
- 多 Tab：新增/关闭、右键菜单（关闭全部/关闭其他/关闭已保存），空 Tab 时自动打开 `New Request`
- 环境：Development / Staging / Production，支持在设置中编辑与新增（环境可新增不可删除），可配置 `baseUrl`
- 请求编辑：Params / Headers / Body / Auth
- 响应区：可拖动调整高度；JSON `Pretty / Raw` 切换；复制与全选复制（`Ctrl+A` / `Cmd+A`）支持 toast 提示
- 历史记录：左侧底部可折叠，支持右键删除
- 主题与语言：Light / Dark / System，中文 / English

## 开发与构建

项目主体在 [`./studio`](./studio)。

### 依赖

- Go（`studio/go.mod` 目前为 `go 1.25.0`）
- Node.js + npm
- Wails CLI v2

### 本地开发

```powershell
cd .\studio
wails dev
```

浏览器调试入口（可直接调用已绑定的 Go 方法）：终端会输出类似 `http://localhost:34115` 的地址。

### 构建打包

```powershell
cd .\studio
wails build
```

Windows 产物默认在 `studio/build/bin/studio.exe`。

## 环境 baseUrl 说明

- 若当前环境配置了 `baseUrl` 且请求为 `basepath` 模式：发送时会用 `baseUrl + path` 组装最终 URL。
- 地址栏不会显示 `baseUrl`（只显示 `path + query`），便于在不同环境间切换。

## 数据存储位置

SQLite 数据库位于系统 `UserConfigDir` 下的 `api-studio/api-studio.db`（应用会自动创建目录；若存在旧位置的数据库会尝试迁移）。

