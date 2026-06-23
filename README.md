# OpenClaw 智能助手

> 基于 OpenClaw 框架的桌面 AI 助手平台，面向普通用户，零门槛部署。

## ✨ 核心功能

- 🤖 **双模型支持** — 本地 ggml 模型 (llama.cpp) + 云端 API (OpenAI 兼容)，灵活切换
- 🧠 **持久化记忆** — 长期上下文管理，跨会话记忆
- 🛡️ **沙盒安全** — 命令风险检测，单次确认/永久授权
- 🔐 **权限管理** — 细粒度角色权限控制 (管理员/用户/访客)
- 🛠️ **技能市场** — 安装和管理各类 AI 技能
- 🔌 **插件市场** — 接入微信、QQ、飞书、Telegram 等通讯平台
- 🖥️ **桌面自动化** — 键盘鼠标控制、窗口管理、截屏
- 🎨 **精美 UI** — 深色主题 + 玻璃拟态 + 流畅动画

## 🚀 快速开始

### 环境要求
- Node.js 18+
- npm 9+

### 安装与运行

```bash
# 克隆项目
cd d:/Code/OpenClawAssistant

# 安装依赖
npm install

# 开发模式运行（带开发者工具）
npm run dev

# 正常运行
npm start

# 构建安装包
npm run build:win
```

## 📁 项目结构

```
OpenClawAssistant/
├── src/
│   ├── main/               # Electron 主进程
│   │   ├── main.js          # 主入口
│   │   └── preload.js       # 预加载脚本
│   ├── backend/             # 后端服务
│   │   ├── server.js        # Express API 服务器
│   │   ├── model-manager.js # 模型管理器
│   │   ├── memory-store.js  # 记忆存储 (SQLite)
│   │   ├── sandbox.js       # 沙盒执行器
│   │   ├── permission-manager.js # 权限管理
│   │   └── automation.js    # 桌面自动化
│   └── renderer/            # 前端 UI
│       ├── index.html       # 入口页面
│       ├── index.css        # 全局样式系统
│       ├── app.js           # 主应用 (路由管理)
│       ├── pages/           # 页面模块
│       │   ├── chat.js      # 聊天
│       │   ├── memory.js    # 记忆管理
│       │   ├── skills.js    # 技能市场
│       │   ├── plugins.js   # 插件市场
│       │   └── settings.js  # 设置
│       └── components/      # 通用组件
│           ├── toast.js     # 通知
│           ├── modal.js     # 弹窗
│           └── sandbox-confirm.js # 沙盒确认
├── package.json
└── README.md
```

## 🔧 技术栈

- **前端**: 原生 JavaScript + CSS (深色主题设计系统)
- **桌面**: Electron
- **后端**: Express + sql.js
- **本地模型**: llama.cpp (ggml 格式)
- **安装包**: Electron Builder (NSIS)

## 📄 许可证

MIT License
