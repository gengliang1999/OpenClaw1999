# OpenClaw Assistant - 架构地图与全局状态 (MEMORY)

> **重要提示**: 接手非 HOTFIX 任务前，请优先阅读此文档，了解核心模块拓扑、IPC 通信接口以及全局桥接函数挂载情况，防范跨模块调用由于上下文断层导致的静默失败。

## 1. 核心模块拓扑 (Architecture Topology)

本项目基于 Electron (Main/Renderer) 架构构建：
- **主进程 (Main Process)**: 负责系统级操作（文件选择、截图、窗口控制）和与 Node.js 原生模块交互的后端逻辑。
- **渲染进程 (Renderer Process)**: 负责 UI 渲染（Vanilla JS/TS + HTML/CSS），通过基于 `hash` 的轻量级路由 (`app.ts` -> `navigateTo`) 实现单页面应用 (SPA)。
- **持久化层**: 依赖于本地 SQLite 数据库（使用 `better-sqlite3`），并具有异步的后台任务队列 (Job Worker) 进行长期记忆固化。

## 2. 全局桥接清单 (Global Window Bridges)

渲染进程各模块之间、或从 `app.ts` 容器向独立页面通信时，依赖挂载在 `window` 对象上的全局函数。调用时**必须**校验其存在性。

### 核心路由与导航
- `window.navigateTo(route: string, params?: object)`: 挂载于 `app.ts`。触发页面切换（带动画和重渲染）。

### 侧边栏与会话状态
- `window.refreshSidebarConversations()`: 挂载于 `app.ts`。刷新左侧会话列表。
- `window.__createNewChat()`: 挂载于 `chat.ts`。
- `window.__loadChatHistory(convId: string)`: 挂载于 `chat.ts`。
- `window.__setPendingConv(convId: string)`: 挂载于 `chat.ts`。设置准备加载但还未正式渲染的会话。
- `window.__onConvDeleted(convId: string)`: 挂载于 `chat.ts`。当会话在侧边栏被删除时，通知聊天视图清理状态。

### 全局 UI 提示
- `window.__toast`: 挂载于 `components.ts` / `app.ts`。轻量级通知组件（`.success`, `.error`, `.info`）。

### 技能与插件 (Skills & Plugins)
- `window._installSkill(id: string)` / `window._uninstallSkill(id: string)`: 挂载于 `skills.ts`。
- `window._installPlugin(id: string)` / `window._uninstallPlugin(id: string)`: 挂载于 `plugins.ts`。

### 记忆管理 (Memory)
- `window._editMemory(id: string)`
- `window._deleteMemory(id: string)`
- `window._reinforceMemory(id: string)`
- `window._promoteMemory(id: string)`
- `window._togglePinMemory(id: string, pinState: number)`
（上述均挂载于 `memory.ts`，供动态生成的 HTML DOM 回调使用）

## 3. IPC 通信通道 (IPC Channels)

渲染进程通过 `window.openClaw` 或直接通过 `ipcRenderer` 与主进程通信。

### System & Window 级通道 (Main -> Handle)
- `system:getInfo`
- `system:openExternal`
- `system:selectFile` / `system:selectDirectory`
- `system:getScreenCapture` / `system:captureScreenArea`
- `window:minimize`, `window:hide`, `window:show`, `window:maximize`, `window:close`, `window:toggleMain`
- `app:restart`

### API & 核心业务级通道 (Main -> Handle)
- `api:call` (通用 HTTP 请求代理)
- `api:chat:stream` (流式模型对话)
- `api:chat:abort` (中断流式对话)
- `api:chat:optimize-stream` (流式提示词优化)
