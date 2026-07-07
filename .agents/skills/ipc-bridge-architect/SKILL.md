---
name: ipc-bridge-architect
description: 当需要处理桌面端应用（如 Electron）的主进程与渲染进程通信、设计 IPC 接口及安全沙盒时调用此技能。
---

# 跨进程架构师 (IPC Bridge Architect)

当你负责开发混合应用中的 IPC（进程间通信）机制，或需要在 UI 侧调用底层系统 API（文件、终端、网络）时，请启动本技能。

## 执行标准
1. **沙盒安全第一 (Context Isolation)**：绝对禁止在渲染进程（前端）中开启 `nodeIntegration`。所有通信必须基于强隔离沙盒。
2. **严密的 Preload 桥接**：所有 IPC 调用必须经过 `preload.js` 暴露的严格白名单 API（如 `contextBridge.exposeInMainWorld`），严禁将原生的 `ipcRenderer` 实例直接暴露给前端。
3. **强类型通道约束**：IPC 的 Channel 名称、请求参数和返回值，必须在主进程和渲染进程之间共享同一套 TypeScript Type/Enum，实现 100% 静态类型安全，绝对拒绝使用硬编码的裸字符串。
4. **非阻塞与日志追踪**：对于耗时的 OS 底层计算或 IO，主进程必须异步处理以防卡死 UI。每一次 IPC 通信的跨界调用，都必须在控制台打印 `[IPC Request]` 和 `[IPC Response]` 以便于排障。
