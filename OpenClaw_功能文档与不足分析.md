# OpenClaw 智能助手 — 功能文档与不足分析

> 分析对象：`D:\Code\OpenClawAssistant_Source`（基于 Electron 的桌面 AI 助手）
> 分析视角：产品经理（功能梳理 + 功能/交互层面不足分析）
> 方法：在架构师《架构与代码分析报告》基础上，逐文件阅读前端页面（`src/renderer/pages/*`、`app.ts`、`float.ts`、`screenshot.ts`、`utils.ts`、`components.ts`）、主进程路由（`src/main/ipc-handlers.ts`、`preload.ts`）与关键 backend 模块，所有结论均附 `文件:行号` 证据。
> 说明：本报告为**纯分析**，未修改任何源文件。标注「疑似未实现/占位」者均给出核实过程。

---

## 0. 证据与术语约定

- **前端功能层**：渲染进程（Chromium），原生 TS + Hash 路由，无 React/Vue。
- **通信桥梁**：`utils.ts` 的 `api` 对象把请求包装成 `apiCall(url, options)` → `ipcRenderer.invoke('api:call', …)`；流式对话走 `api:chat:stream` + `api:chat:chunk` 事件（`utils.ts:5-40`）。
- **"伪 REST" 路由**：`ipc-handlers.ts` 用 `if (url === …)` 字符串匹配分发，无强类型契约（架构报告 A1/A2）。
- 关于"是否已实现"的判断：当且仅当前端调用的 IPC 路由在 `ipc-handlers.ts` 中存在对应处理分支、且前端事件已正确绑定，才判定为"可用"；否则按"死代码/占位/不可达"标注。

---

## 1. 全量功能模块清单

### 1.0 功能总览表

| # | 功能模块 | 对应前端文件 | 核心 IPC 路由 | 后端依赖 | 状态 |
|---|----------|--------------|---------------|----------|------|
| 1 | AI 对话（流式/RAG/Agent） | `pages/chat.ts`, `app.ts` | `api:chat:stream`, `/chat/...` | dialogue-orchestrator, agent-loop, retrieval-orchestrator, memory-engine, rag-engine, model-manager | ✅ 可用（HITL 失效，见 F1） |
| 2 | 记忆管理 | `pages/memory.ts` | `/memory*`, `/memory/promote/*` | memory-store, memory-engine, vector-db-manager | ✅ 可用 |
| 3 | 知识库（摄取/检索/暂存/作业） | `pages/knowledge.ts` | `/knowledge/*`, `/system/background-jobs` | ingestion-queue, document-parser, data-crawler, verification-agent, vector-store, vector-db-manager | ✅ 可用 |
| 4 | 专家系统 | `pages/experts.ts` | 无（纯前端 + localStorage） | 无 | ✅ 可用（仅前端角色切换） |
| 5 | 技能市场 | `pages/skills.ts` | `/skills`, `/skills/install`, `/skills/marketplace` | registry（静态数据） | ⚠️ 仅写 JSON，不加载代码（F6/A6） |
| 6 | 插件市场 | `pages/plugins.ts` | `/plugins*`, `/plugins/marketplace` | registry（静态数据） | ⚠️ 仅写 JSON，不加载代码（F6/A6）；connect/disconnect UI 缺失 |
| 7 | 模型市场/管理 | `pages/market.ts`, `chat.ts` 模型弹窗 | `/models*`, `/settings` | model-manager, registry | ✅ 可用（配置中心） |
| 8 | 模型大市场（下载） | `pages/model-market.ts` | `/models/marketplace` | model-manager | ❌ 不可达 + 下载为桩（F5） |
| 9 | 核心引擎管控台 | `pages/core-manager.ts` | `/core-manager/*` | openclaw-installer, openclaw-daemon | ✅ UI 可用（后端供应链风险 S6） |
| 10 | 设置与配置 | `pages/settings.ts` | `/system/global-config`, `/api/settings`(错) | system-info, settings 文件 | ⚠️ 多数控件未接线（F3/F4） |
| 11 | 会话管理/导出/垃圾篓 | `app.ts` | `/chat/conversations*`, `/chat/trash*`, `/chat/.../export` | memory-store | ✅ 可用（导出 PDF/Word/PNG 依赖外网 CDN） |
| 12 | 悬浮球 + 截图识屏 | `float.ts`, `screenshot.ts` | `system:captureScreenArea` 等 | main.ts 截屏 | ✅ 可用 |
| 13 | 桌面自动化 / 沙盒确认 | （无前端页） | `/automation/screenshot`, `/sandbox/*` | automation, sandbox, permission-manager | ❌ 沙盒 UI 完全缺失（F2）；确认回路失效（F1） |

---

### 1.1 AI 对话（流式 / RAG / Agent 工具调用）

**文件**：`pages/chat.ts`、`app.ts`

**功能描述（用户视角）**：用户与 AI 对话，支持流式逐字输出、多轮历史、上下文压缩、@专家、附件/截图、独立思考深度（low/high/extreme）、Agent 模式（让 AI 自主调用本地命令/工具）、提示词调优、语音输入、对话压缩（token 圈）。

**输入 / IPC 路由**：
- 主对话：`api.chat.sendMessageStream(convId, text, attachment, modelId, systemPrompt, temp, agentMode, onData)` → `api:chat:stream`（`utils.ts:20-40`；`ipc-handlers.ts:1450` 的 `ContextAggregator.executeChatStream`）。
- 附件/截图：`/system/parseDocument`（`chat.ts:703`）、`system:captureScreenArea`（`preload.ts:35`）。
- 删除消息：`DELETE /chat/message/{id}`（`chat.ts:46` → `ipc-handlers.ts:149`）。
- 模型选择/切换：`/models`, `/models/active`, `/models/local/add` 等（详见 1.7）。
- OCR：`POST /chat/ocr`（`chat.ts:763`）。

**输出**：流式 chunk 渲染到对话气泡；`[思考过程]/<think>` 折叠面板；"计算指示灯"（LOCAL ROUTER / CLOUD REASONER / SANDBOX EXEC）随内容切换（`chat.ts:1438-1459`）；回复落库（`memoryStore.saveMessage`，`dialogue-orchestrator.ts:145`）。

**依赖后端**：`dialogue-orchestrator`（历史压缩+多路召回+驱动 Agent）、`retrieval-orchestrator`、`memory-engine`、`rag-engine`、`agent-loop`、`model-manager`。

**已知问题（详见第 4、5 节）**：
- HITL 确认回路失效（F1）：`chat.ts` 流处理器只处理 `error/conversation/content` 三类 chunk（`chat.ts:1417-1495`），对 `requires_confirmation` 无处理逻辑。
- "提示词优化"按钮失效（F4）：`chat.ts:529` 调用不存在的 `api.chat.optimizePromptStream`。

---

### 1.2 记忆管理（核心记忆神经元）

**文件**：`pages/memory.ts`

**功能描述**：以卡片网格展示自动/手动沉淀的长期记忆；支持搜索、分页、手动刻印、导入/导出备份、编辑、抹除、以及"记忆晋升"（把碎片事实扩写为知识库 Markdown 草稿并经二次审核入库）。

**输入 / IPC 路由**：
- 列表：`GET /memory?page&pageSize&category`（`memory.ts:119` → `ipc-handlers.ts:351`）、`GET /memory/search`（`memory.ts:116` → `ipc-handlers.ts:368`）。
- 新增：`POST /memory`（`memory.ts:354` → `ipc-handlers.ts:377`）。
- 编辑：`PUT /memory/{id}`（`memory.ts:224` → `ipc-handlers.ts:323`）。
- 删除：`DELETE /memory/{id}`（`memory.ts:239` → `ipc-handlers.ts:415`）。
- 固定：`PUT /memory/{id}/pin`（`utils.ts:91` → `ipc-handlers.ts:436`）。
- 导入/导出：`POST /memory/import`（`memory.ts:80` → `ipc-handlers.ts:279`）、`POST /memory/export`（`memory.ts:95` → `ipc-handlers.ts:266`）。
- 晋升二段式：`POST /memory/promote/generate`（`memory.ts:272` → `ipc-handlers.ts:182`）、`POST /memory/promote/confirm`（`memory.ts:333` → `ipc-handlers.ts:219`）。

**输出**：记忆卡片网格；晋升草稿审核模态框；toast 反馈。

**依赖后端**：`memory-store`、`memory-engine`、`vector-db-manager`、LLM（扩写草稿）。

**评价**：功能完整、空/错态处理到位（空态插画、错误红字 `memory.ts:127`）。"晋升"是较有特色的功能。

---

### 1.3 知识库（摄取 / 检索 / 暂存审查 / 作业队列）

**文件**：`pages/knowledge.ts`

**功能描述**：本地私有知识引擎管理。支持拖拽/点击上传文档（自动清洗、切片、Embedding、LLM 鉴伪核查入正式库）；暂存隔离区人工审批（批准/丢弃）；后台作业队列（3 秒轮询）；RAG 语义检索测试（含"二次 Rerank"）；整文编辑/删除；批量导入/导出物理备份。

**输入 / IPC 路由**：
- 上传：`POST /knowledge/add`（`knowledge.ts:430` → `ipc-handlers.ts:454`）。
- 正式库：`GET /knowledge/files?category`（`knowledge.ts:148` → `ipc-handlers.ts:596`）、`DELETE /knowledge/files`（`knowledge.ts:222` → `ipc-handlers.ts:613`）、`GET /knowledge/files/content`（`knowledge.ts:545` → `ipc-handlers.ts:574`）、`POST /knowledge/files/update`（`knowledge.ts:607` → `ipc-handlers.ts:709`）。
- 暂存区：`GET /knowledge/staging`（`knowledge.ts:161` → `ipc-handlers.ts:855`）、`POST /knowledge/staging/action`（`knowledge.ts:282/300` → `ipc-handlers.ts:803`）。
- 作业队列：`GET /system/background-jobs`（`knowledge.ts:319` → `ipc-handlers.ts:49`）。
- 检索测试：`POST /knowledge/search`（`knowledge.ts:459` → `ipc-handlers.ts:472`）。
- 导入/导出：`POST /knowledge/import`（`knowledge.ts:488` → `ipc-handlers.ts:772`）、`POST /knowledge/export`（`knowledge.ts:503` → `ipc-handlers.ts:739`）。

**输出**：三 Tab 工作台；检索结果带 Score 展示；作业队列状态徽章（排队/提炼/重试/失败）与错误报告。

**依赖后端**：`ingestion-queue`、`document-parser`、`data-crawler`、`verification-agent`、`vector-store`、`vector-db-manager`、`model-manager`（Embedding/Rerank）。

**评价**：交互最完整、状态反馈最丰富的页面（加载中、空态、错误态、轮询）。

**备注**：后端还存在 `knowledge.ts` 未使用的路由：`/knowledge/ingest-url`、`/knowledge/queue(/pause|/resume|/clear)`、`/knowledge/sources`、`/knowledge/transfer`、`/knowledge/watched-folders`、`/knowledge/files/rename`（`ipc-handlers.ts:511/521/542/879/905/666`）——属"后端已实现、前端未暴露"的孤儿能力（如文件夹监听 `folder-watcher` 无对应 UI 开关）。

---

### 1.4 专家系统

**文件**：`pages/experts.ts`

**功能描述**：内置 20 个领域专家角色（硬编码 `EXPERTS` 数组 `experts.ts:50-222`），按分类筛选/搜索；点击"与 X 对话"将角色 System Prompt 写入 `localStorage` 并跳转到对话页。

**输入 / IPC 路由**：**无**（纯前端）。仅 `init()` 时读 `api.skill.getSkills()` 把已安装技能也展示为"专家"（`experts.ts:230,238-247`）。

**输出**：专家卡片网格；激活后 `localStorage.setItem('activeExpert', …)` → `chat.ts` 在发送时读取该 prompt（`chat.ts:1415`）。

**依赖后端**：无（角色切换完全在前端）。

**评价**：轻量、可用；但专家仅为"System Prompt 模板"，无独立后端能力/隔离会话。

---

### 1.5 技能市场

**文件**：`pages/skills.ts`

**功能描述**：展示已掌握/未解锁技能，"载入核心链路"安装、"强制剥离突触"卸载。

**输入 / IPC 路由**：`GET /skills`（`skills.ts:48` → `ipc-handlers.ts:1181`）、`POST /skills/install`（`skills.ts:141` → `ipc-handlers.ts:1185`）、`DELETE /skills/{id}`（`skills.ts:152` → `ipc-handlers.ts:1226`）、`GET /skills/marketplace`（`skills.ts:49` → `ipc-handlers.ts:1199`）。

**输出**：技能卡片；安装/卸载 toast。

**依赖后端**：`registry`（静态 `SKILL_MARKET` 数据）。

**不足（F6/A6）**：安装仅把技能元数据写入 `skills.json`，**不加载/执行任何代码**（`ipc-handlers.ts:1247-1257` 区域为写 JSON）；UI 在拿不到市场数据时回退到硬编码 mock 列表（`skills.ts:50-55`）。即"技能"本质是只读元数据，与"系统在沙盒中生成的底层 TS 脚本"的产品叙事不符。

---

### 1.6 插件市场

**文件**：`pages/plugins.ts`

**功能描述**：展示已安装/市场插件，"安装/卸载"。

**输入 / IPC 路由**：`GET /plugins`（`plugins.ts:44`）、`POST /plugins/install`（`plugins.ts:116`）、`DELETE /plugins/{id}`（`plugins.ts:127`）、`GET /plugins/marketplace`（`plugins.ts:45`）；后端另提供 `PUT /plugins/{id}/config`、`POST /plugins/{id}/connect`、`POST /plugins/{id}/disconnect`（`ipc-handlers.ts:1309/1318/1326`），但 **UI 未暴露**这些操作。

**输出**：插件卡片；安装/卸载 toast。

**依赖后端**：`registry`（静态 `OPENHUB_REGISTRY`）。

**不足**：同技能——安装仅写 JSON（不加载代码）；connect/disconnect/config 路由存在但无任何界面入口（死路由）。市场数据同样有 mock 兜底（`plugins.ts:46-50`）。

---

### 1.7 模型市场 / 模型管理（配置中心）

**文件**：`pages/market.ts`、`chat.ts` 模型选择弹窗

**功能描述**：云端厂商（OpenAI/Anthropic/国内源等）API Key 配置与代理探测；本地运行时（Ollama / LM Studio）自动检测与模型拉取；模型市场平台导航链接；激活模型切换。

**输入 / IPC 路由**：`GET/POST /models`（`ipc-handlers.ts:940`）、`/models/active`（`:948`）、`/models/{id}` DELETE（`:956`）、`/models/marketplace`（`:962`，来自 `registry.MODEL_MARKETPLACE`）、`/models/sync`（`:967`）、`/models/local-detect`（`:972`）、`/models/ollama|lmstudio/list`（`:976/980`）、`/models/local/add`（`:984`）、`/models/local/{provider}/{id}` DELETE（`:1011`）、`/models/proxy-fetch|proxy-test`（`:1023/1028`）、`/settings`（`:1351`）。

**输出**：厂商卡片、本地运行时状态、模型列表；代理测试 toast。

**依赖后端**：`model-manager`、`registry`。

**评价**：作为"模型配置中心"功能较完整。注意 `app.ts` 侧边栏"模型市场"指向的是本页（`market.ts`），而非 1.8 的 `model-market.ts`。

---

### 1.8 模型大市场（下载页）— 不可达 + 占位

**文件**：`pages/model-market.ts`

**功能描述（设计意图）**：Provider → Series → Version 三级钻取，展示硬件兼容性并"下载安装"本地模型。

**输入 / IPC 路由**：`GET /models/marketplace`（`model-market.ts:79`）。

**状态**：**❌ 死代码 + 桩实现**
- 不可达：`app.ts` 的 `ROUTES`（`:11-21`）中**没有** `model-market` 项，全代码库也无 `import('./pages/model-market.js')` 调用（仅 CSS/registry/market.ts 中出现同名字符串）。
- 下载为桩：`startDownload()` 仅弹出 toast"本地模型流式下载管线正在重构为 IPC，请使用外部工具下载"并复位，不发起任何实际下载（`model-market.ts:208-223`）。

**依赖后端**：`model-manager`（仅读取市场列表）。

---

### 1.9 核心引擎管控台

**文件**：`pages/core-manager.ts`

**功能描述**：一键克隆/部署、同步、拉起/停止内核守护进程；绑定本地已有内核目录；实时日志黑窗；危险卸载。

**输入 / IPC 路由**：`GET /core-manager/status`（`core-manager.ts:134` → `ipc-handlers.ts:1370`）、`GET /core-manager/action/{action}`（`core-manager.ts:168` → `ipc-handlers.ts:1387`）、`POST /core-manager/bind-path`（`core-manager.ts:99` → `ipc-handlers.ts:1377`）、日志经 `onCoreManagerLog`（`preload.ts:25`）。

**输出**：状态灯（颜色随安装/运行态变化）、终端日志流、3 秒轮询。

**依赖后端**：`openclaw-installer`、`openclaw-daemon`。

**不足（S6）**：后端从第三方镜像浅克隆并无 commit pin/签名校验后 `npm install` + `npm start`（架构报告），UI 层面无法审计；属供应链风险，但 UI 本身功能完整。

---

### 1.10 设置与配置

**文件**：`pages/settings.ts`

**功能描述（预期）**：存储路径、外观（主题/字号）、行为（开机自启/发送方式/流式）、快捷入口、数据管理。

**实际实现**：
- 存储路径：三个目录选择按钮均接线并 `POST /system/global-config` 后重启（`:163-234`，对应 `ipc-handlers.ts:23/34`）。✅
- **错误端点**：`:13` 调用 `api.get("/api/settings")`，但 `ipc-handlers.ts` 只有 `/settings`（`:1343/1351`），**无 `/api/settings` 路由** → 该请求必失败（被 try/catch 吞掉，`settings` 始终为空且后续未使用）。属死读取（F3）。
- **未接线控件（F4）**：主题选择 `#themeSelect`、字号 `#fontSizeSelect`、开机自启 `#autoStartToggle`、发送方式 `#sendModeSelect`、流式 `#streamToggle` 以及"导出所有会话记录""清空所有数据"按钮，在 `settings.ts` 中**均无任何事件监听器**（文件 `:162-234` 仅绑定了目录按钮）。用户改动这些控件无任何效果、也不落库。

**依赖后端**：`system-info`、配置文件读写。

---

### 1.11 会话管理 / 导出 / 垃圾篓

**文件**：`app.ts`

**功能描述**：侧边栏会话列表、搜索、新建、批量管理、右键菜单（重命名/导出/删除/批量）、垃圾篓（恢复/永久删除/清空）、可拖拽调宽/折叠侧边栏、自定义 Logo、7 种格式导出（JSON/Markdown/HTML/TXT/PDF/Word/PNG）。

**输入 / IPC 路由**：`/chat/conversations*`（`ipc-handlers.ts:80-136`）、`/chat/trash*`（`:157-175`）、`GET /chat/conversations/{id}/export`（`:97`）、`DELETE /chat/history`（`:141`）。

**输出**：侧边栏会话项、重命名/导出弹窗、垃圾篓面板、下载文件。

**依赖后端**：`memory-store`。

**备注**：PDF/Word/PNG 导出在运行时从外网 CDN 动态加载 `jsPDF/html2pdf/docx/html2canvas`（`app.ts:811/841/882`），**离线或 CDN 不可达时导出失败**（无本地兜底）。

---

### 1.12 悬浮球 + 截图识屏

**文件**：`float.ts`、`screenshot.ts`、`float.html`、`screenshot.html`

**功能描述**：桌面悬浮球（拖拽、贴边磁吸、双击唤起主窗、展开快捷面板含输入框/截图/打开主窗）；框选截图（半透明遮罩、浮动工具栏 explain/translate/ocr/send）。

**输入 / IPC 路由**：`system:captureScreenArea`、`system:resizeFloat`、`system:dragStartFloat`、`system:toggleMain`、`system:sendQuickPrompt`、`system:onFloatStatus`（`preload.ts:24-95`）；截图结果经 `system:finishScreenCapture` 回传。

**输出**：快捷提问（跨窗口 `sendQuickPrompt`）、截图区域 dataURL 回传主窗处理。

**依赖后端/主进程**：`main.ts` 截屏与窗口管理。

**评价**：交互细腻（磁吸、读秒、ESC 取消、工具栏自适应定位），是本产品体验亮点。

---

### 1.13 桌面自动化 / 沙盒确认（前端缺失）

**对应文件**：**无独立前端页**。`utils.ts:95-104` 暴露 `api.automation`（仅 `captureScreen`）、`api.sandbox`（execute/permissions/logs），但**渲染层没有任何页面调用 `api.sandbox.*`**（全仓库仅 `utils.ts:100` 定义，无任何 UI 入口，见 F2）。

**后端能力（存在但前端不可用）**：
- `/sandbox/execute`（`ipc-handlers.ts:1142`，支持 `confirmed` 标志 → `sandbox.executeConfirmed`）、`/sandbox/permissions`、`/sandbox/logs`、`/permissions`、`/permissions/roles`（`ipc-handlers.ts:1416-1424`）。
- Agent 工具调用由 `agent-loop` 在对话中**自动**触发（见 1.1），不经任何 UI 确认。

**结论**：产品显然规划了沙盒权限管理与 HITL 确认 UI（`components.ts:251` 的 `showSandboxConfirm`、权限路由、`executeConfirmed`），但**前端从未接线**——这是最大的"功能缺位"。

---

## 2. 模块间依赖关系（前端功能 → 后端服务映射）

| 前端功能 | 调用的 IPC 路由 | 后端服务（模块） |
|----------|----------------|------------------|
| 对话（流式） | `api:chat:stream` | ContextAggregator → AgentLoop / ModelManager / Sandbox |
| 对话（RAG 检索） | （链内） | RetrievalOrchestrator → MemoryEngine + RagEngine |
| 对话（历史压缩/记忆抽取） | （链内） | MemoryStore + MemoryEngine + PersistentJobQueue |
| 记忆 CRUD/搜索 | `/memory*`, `/memory/promote/*` | MemoryStore, MemoryEngine, VectorDbManager |
| 知识库上传/检索/暂存/作业 | `/knowledge*`, `/system/background-jobs` | IngestionQueue, DocumentParser, DataCrawler, VerificationAgent, VectorStore, VectorDbManager, ModelManager |
| 专家切换 | 无（localStorage） | 无 |
| 技能/插件 安装卸载/市场 | `/skills*`, `/plugins*` | Registry（静态 JSON） |
| 模型配置/切换/检测 | `/models*`, `/settings` | ModelManager, Registry |
| 内核管控 | `/core-manager/*` | OpenClawInstaller, OpenClawDaemon |
| 设置（路径） | `/system/global-config` | SystemInfo / 配置文件 |
| 设置（外观/行为） | —（控件未接线） | — |
| 会话 CRUD/导出/垃圾篓 | `/chat/conversations*`, `/chat/trash*`, `/chat/.../export` | MemoryStore |
| 悬浮球/截图 | `system:captureScreenArea` 等 | Main 进程窗口/截屏 |
| 沙盒执行/权限/日志 | `/sandbox/*`（**无 UI 调用**） | Sandbox, PermissionManager（**未接入鉴权**） |
| 桌面自动化截图 | `/automation/screenshot`（仅定义） | Automation |

**映射结论**：
- 绝大部分"用户可点"的功能都能映射到真实后端服务；但**沙盒/权限/确认**这一整条能力链在前端是空的。
- "技能/插件/模型市场"依赖 `registry.ts` 静态数据（硬编码 + UI mock 兜底），并非动态后端。

---

## 3. 用户交互分析

### 3.1 整体交互流程
1. **入口**：启动进入 `chat`（默认路由 `app.ts:36`）。侧边栏 9 项导航（专家/记忆/知识/技能/插件/模型/内核/设置，`app.ts:11-21`，其中 chat/settings 不出现在侧栏列表但可直达）。
2. **路由切换**：Hash 路由 + 动态 `import()` 页面模块（`app.ts:1191-1211`），带淡出(150ms)/淡入动画与加载失败兜底页（`app.ts:1214-1223`）。
3. **对话流**：输入框 → 附件/截图/@专家 → 发送 → 流式 chunk 渲染（带"读秒加载器"消除卡死假象，`chat.ts:1386-1393`）→ 计算指示灯 → 落库 → 后台记忆抽取。
4. **确认弹窗**：通用 `showModal`（危险操作用 `danger` 红）、原生 `confirm()`（记忆/知识/内核等处）、`showSandboxConfirm`（**定义但从未调用**）。
5. **反馈**：`showToast`（成功/错误/警告/信息，2s 自动消失，hover 暂停，`components.ts:168-229`）。
6. **悬浮球/截图**：独立窗口，磁吸/快捷面板/框选识别。

### 3.2 合理性评价
- **优点**：对话页功能密度高且反馈充分（loading 计时、思考折叠、错误友好提示）；知识库页状态/轮询完备；悬浮球交互打磨细致；导出格式丰富；路由切换有动画与错误边界。
- **问题（详见第 5 节）**：HITL 确认在 Agent 模式下的"静默失效"会严重误导用户；设置页大量控件"点了没反应"；主题有两套互斥机制（`app.ts` 侧边栏开关可用，`settings.ts` 下拉框无效）；模型大市场页不可达却存在。

---

## 4. 不足分析 — 功能层面（附代码证据）

> 优先级：🔴 高（功能缺失/失效/误导）｜🟠 中（不完整/占位）｜🟡 低（死代码/一致性）

### F1 🔴 HITL 沙盒确认回路完全失效（最严重）
- 后端：`agent-loop.ts:82-86` 在命令 `needsConfirmation` 时调用 `onRequiresConfirmation` 并**直接 return**（不执行、不进入下一轮）；`dialogue-orchestrator.ts:121-129` 将该事件作为 `type:'requires_confirmation'` 的 `api:chat:chunk` 发往渲染端。
- 前端：全仓库仅 `test_agent.ts` 消费该类型（Grep 确认）；`chat.ts:1417-1495` 的流处理器只处理 `error/conversation/content`，**对 `requires_confirmation` 无任何分支**；本应有的确认弹窗 `components.ts:251 showSandboxConfirm` **从未被任何代码调用**（Grep `showSandboxConfirm` 仅定义处）。
- 后果：Agent 模式试图执行**中/高风险**命令时，后端要求确认但前端静默丢弃 → 命令既不执行也无提示；Agent 只能静默执行**低风险**命令（且按架构报告 S1/S2，无 Docker 时低风险命令直接在宿主机以当前用户权限执行、免确认）。用户既无控制权、也无感知。**功能层面属于"已规划但未实现"。**

### F2 🔴 沙盒 / 权限管理 UI 完全缺失
- `utils.ts:95-104` 定义了 `api.sandbox`（execute/permissions/logs），`ipc-handlers.ts:1142-1170` 实现了对应路由，`ipc-handlers.ts:1416-1424` 还有 `/permissions`、`/permissions/roles`；但**渲染层无任何页面调用 `api.sandbox.*`**（Grep 确认仅 `utils.ts:100` 一处定义）。
- 后果：用户无法查看/授予/撤销沙盒权限，无法查看执行日志；`PermissionManager`（RBAC）的 `checkPermission` 也从未被调用（架构报告 A4）。整条"安全管控"能力对终端用户不可见。

### F3 🟠 设置页错误端点 `/api/settings`
- `settings.ts:13` 调用 `api.get("/api/settings")`，而 `ipc-handlers.ts` 仅有 `/settings`（`:1343/1351`）。该请求必失败被吞，`settings` 变量永为空且后续未使用。属死读取 + 明显笔误（应为 `/settings`）。

### F4 🔴 设置页多数控件未接线（"点击无反应"）
- `settings.ts` 的 `#themeSelect`、`#fontSizeSelect`、`#autoStartToggle`、`#sendModeSelect`、`#streamToggle` 以及"导出所有会话记录""清空所有数据"按钮，在 `:162-234` 区间内**完全没有 `addEventListener`**（仅目录按钮有）。用户调整外观/行为/数据管理均不生效、不落库。属明显功能缺位。

### F5 🔴 模型大市场页：不可达 + 下载为桩
- 不可达：`app.ts:11-21` 的 `ROUTES` 无 `model-market`；全库无 `import('./pages/model-market.js')`（Grep `model-market` 仅命中 CSS/registry/market.ts 字符串）。
- 桩：`model-market.ts:208-223` 的 `startDownload` 仅弹 toast"请使用外部工具下载"并复位，不发起下载。属占位/死代码。

### F6 🟠 技能/插件"安装"不加载代码（产品叙事不符）
- `ipc-handlers.ts`（技能 `:1185`、插件 `:1247` 区域）安装仅写 JSON 元数据，不加载/执行任何代码；UI 拿不到市场数据时回退硬编码 mock（`skills.ts:50-55`、`plugins.ts:46-50`）。结果是"技能/插件"只是只读卡片，与"凝结为永久技能/让助手访问互联网"的文案不符。

### F7 🟡 插件 connect/disconnect/config 死路由
- 后端提供 `POST /plugins/{id}/connect|disconnect`、`PUT /plugins/{id}/config`（`ipc-handlers.ts:1318/1326/1309`），`utils.ts` 也定义了 `api.plugin.connectPlugin` 等，但 `plugins.ts` 仅调用 install/remove/marketplace。属"后端已实现、前端未暴露"。

### F8 🟡 `api` 中的孤儿方法（无后端路由）
- `utils.ts:18` `api.chat.sendMessage` → `POST /chat`：无对应 handler（`chat.ts` 实际用 `sendMessageStream`）；`utils.ts:70` `preloadModel` → `/models/preload`、`utils.ts:71` `pullModel` → `/models/pull`：后端均无该路由（Grep 确认）。属死 API 方法。

### F9 🔴 "提示词优化"按钮失效
- `chat.ts:529` 调用 `api.chat.optimizePromptStream(text, activeModelId, cb)`，但 `utils.ts` 的 `api.chat` 对象**没有** `optimizePromptStream` 方法（已通读 `utils.ts` 确认），且无 `/optimize` 后端路由。点击即抛 `TypeError`（未被捕获 → 按钮"看似无用"）。属明确 bug。

### F10 🟠 两套主题机制互斥/不一致
- `app.ts:1300-1342` 的 `#themeToggleBtn` 可用，持久化到 `localStorage.oc_theme_pref`（含 auto，按 7–19 点判亮/暗）；`settings.ts` 的 `#themeSelect`（含 system/light/dark）则完全无效且语义不同。两处入口行为不一，用户易困惑。

### F11 🟡 专家仅为前端 Prompt 模板
- `experts.ts` 全程纯前端，无独立会话隔离或后端能力；"专家"与其他功能（记忆/知识）无联动。属产品深度不足，非 bug。

### F12 🟢 已确认可用的功能（避免误报）
- 记忆管理（含晋升）、知识库（含摄取/暂存/作业/检索）、会话 CRUD/导出/垃圾篓、模型配置中心、内核管控台、悬浮球/截图、对话流式/RAG —— 这些前端路由与后端处理分支均对应，**判定为可用**。

---

## 5. 不足分析 — 交互层面（附代码证据）

### I1 🔴 Agent 模式下"无反馈的阻断"
- 当用户开启 Agent 模式且模型产出中/高风险命令时，对话会因 `requires_confirmation` 被前端丢弃而**戛然而止**（`agent-loop.ts:82-86` + `chat.ts` 不处理）。用户看到 AI 停下却无任何弹窗/说明，体验断点明显（结合 F1）。

### I2 🟠 原生 `confirm()/prompt()` 与定制弹窗风格割裂
- 记忆页、知识页、内核页大量使用浏览器原生 `confirm()`/`prompt()`（`memory.ts:72/221/237`、`knowledge.ts:218/297`、`core-manager.ts:87`），与精心设计的 `showModal`/`showSandboxConfirm`（毛玻璃、圆角、品牌色）风格不一致，且原生对话框在深色主题下观感突兀。

### I3 🟠 设置页"静默无响应"
- 主题/字号/自启/发送方式/流式及数据管理按钮点击无任何 toast 或视觉变化（`settings.ts` 未接线，F4），用户无法判断是"已保存"还是"坏了"，属典型的"静默失败"交互。

### I4 🟠 深色主题一致性风险
- 主题靠 `body.dark-theme` 切换（`app.ts:1305`）；但多个内联 `style` 硬编码浅色（如 `memory.ts` 空态 `#ff3b30`、`knowledge.ts` 日志区 `#0d1117` 黑窗、`core-manager.ts` 终端固定黑底），以及 `showModal` 用 `var(--bg-card,#ffffff)` 浅色兜底（`components.ts:37`）。在深色模式下部分弹窗/卡片可能仍是浅色底+深色字或反之，存在对比度问题。需专项走查。

### I5 🟡 错误反馈友好度参差
- 对话错误有较友好的中文翻译（401/ECONNREFUSED/500，`chat.ts:1420-1426`）；但知识/记忆/技能等页多数仅 `alert(err.message)`（`knowledge.ts:225/289/506`、`memory.ts:280`），且 `alert` 同样与主题割裂。统一错误呈现缺失。

### I6 🟡 加载/空/错误态覆盖不均
- 知识库、记忆页空/错态完善；但对话页首次无历史、`market.ts` 加载失败仅 toast（`market.ts:87`），无空态插画；模型大市场若可达也会因桩下载让用户疑惑。

### I7 🟡 路由切换的潜在竞态
- 知识库作业轮询用 `setInterval`（`knowledge.ts:171`），切页时 `unmount()` 清除（`knowledge.ts:517-523`）；但 `chat.ts` 的流式监听 `onChatChunk` 在每次发送前 `offChatChunk()` 再绑定（`utils.ts:23`），若快速切换会话/页面，存在 chunk 回调指向已销毁 DOM 的风险（代码未显式在 `chat.ts` 卸载时 offChatChunk）。

### I8 🟡 离线依赖（导出/供应链）
- 导出 PDF/Word/PNG 在运行时从公网 CDN 拉库（`app.ts:811/841/882`），离线即失败且无降级提示；内核管控台拉取依赖外网镜像（S6）。对"桌面本地助手"定位而言，关键路径不应强依赖外网。

---

## 6. 待明确事项（产品 / 体验视角，与架构师互补）

1. **HITL 确认的产品定义**：F1 中确认弹窗缺失，是"暂未实现"还是"有意去掉"？若保留，需把 `chat.ts` 对 `requires_confirmation` 的处理接上 `showSandboxConfirm` 并回调 `/sandbox/execute?confirmed=true`（后端 `executeConfirmed` 已就绪）。建议产品明确 Agent 模式的安全交互规范。
2. **沙盒/权限面板是否要做**：F2 显示权限/日志路由与 `PermissionManager` 均存在但无 UI。是否需要在设置或独立页暴露"沙盒权限授予/撤销/执行日志"？还是代理模式中完全自动执行（则需重新评估 S1/S2 的安全默认）。
3. **设置页控件范围**：F3/F4 的"外观/行为/数据管理"控件是计划补齐还是从设置页移除？建议至少补齐主题/字号/流式开关，并修复 `/api/settings` → `/settings`。
4. **模型大市场页去留**：F5 的 `model-market.ts` 不可达且下载为桩，是与 `market.ts` 重复还是废弃？建议删除或合并，避免维护歧义。
5. **技能/插件的产品定义**：F6 当前"安装=写 JSON"，是否符合"插件/技能"的产品预期？若需真实能力扩展，需定义沙箱化加载与权限边界。
6. **提示词优化功能**：F9 的按钮调用了不存在的方法，是遗漏实现还是应移除入口？
7. **主题统一管理**：I4/I10 两套主题入口（侧栏开关 vs 设置下拉）是否合并为单一可信入口（建议以设置页为准，侧栏开关同步）。
8. **离线能力边界**：I8 导出与内核拉取强依赖外网，是否需内置依赖或给出离线降级提示？
9. **原生对话框替代**：I2 是否将 `confirm()/prompt()` 全量替换为定制 `showModal`/`showPrompt`（`components.ts` 已提供 `showPrompt`），以统一深色体验？
10. **专家系统深度**：I11 专家是否要支持独立会话、与记忆/知识联动，或仅作为 Prompt 模板即可？

---

## 附：功能 → 代码证据索引

| 主题 | 文件:行 |
|------|---------|
| 对话流式/IPC 桥接 | `utils.ts:5-40`；`preload.ts:14-22` |
| 对话流处理器（缺 requires_confirmation 分支） | `chat.ts:1417-1495` |
| 提示词优化调用不存在方法 | `chat.ts:529` |
| 沙盒确认弹窗（定义未调用） | `components.ts:251`；Grep 全仓无调用 |
| HITL 后端发确认 + 直接 return | `agent-loop.ts:82-86`；`dialogue-orchestrator.ts:121-129` |
| requires_confirmation 仅 test_agent 消费 | Grep 确认 |
| 沙盒/权限路由存在但无 UI 调用 | `ipc-handlers.ts:1142-1170,1416-1424`；`utils.ts:100`（仅定义） |
| 记忆管理全路由 | `memory.ts:116-349`；`ipc-handlers.ts:182/219/262-451` |
| 知识库全路由 | `knowledge.ts:148-607`；`ipc-handlers.ts:454-799` |
| 设置错误端点/控件未接线 | `settings.ts:13,162-234`；`ipc-handlers.ts:1343/1351` |
| 模型大市场不可达+下载桩 | `app.ts:11-21`（无 model-market）；`model-market.ts:208-223` |
| 路由表/主题管理 | `app.ts:11-21,1300-1342` |
| 会话导出（CDN 依赖） | `app.ts:648-911,811/841/882` |
| 技能/插件仅写 JSON | `ipc-handlers.ts:1185,1247`；`skills.ts:50-55`,`plugins.ts:46-50` |
| 孤儿 API 方法 | `utils.ts:18,70,71`；后端无 `/chat` POST、`/models/pull`、`/models/preload` |
| 专家纯前端 | `experts.ts:50-222,360-377` |
| 悬浮球/截图 | `float.ts` 全；`screenshot.ts` 全；`preload.ts:24-95` |
| /memory 重复处理 | `ipc-handlers.ts:262-451` 与 `1034-1058`（架构报告 A1） |
