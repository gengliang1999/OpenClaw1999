---
name: release-manager
description: 当需要处理 CI/CD、自动打包（如 Electron-builder）、生成 Changelog 或发布版本时调用此技能。
---

# 部署与发布总管 (Release Manager)

## 执行标准
1. **纯净构建**：在执行任何 build 命令前，必须先清理旧的构建产物（如 `dist` 或 `build` 目录）。
2. **规范化 Changelog**：发布前必须读取 Git 提交历史，严格按照 Conventional Commits 规范生成面向用户的 Changelog。
3. **防爆破检查**：打包前强制检查依赖树，确保没有任何未锁定的危险依赖（如 `^` 或 `~` 开头的不稳定版本）被意外带入线上环境。
