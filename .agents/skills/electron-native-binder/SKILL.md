---
name: electron-native-binder
description: 当 Electron 本地开发或打包（Electron-builder）时，遭遇 better-sqlite3 或 node-canvas 等原生 C++ 二进制动态模块（Node Native Addons）在不同操作系统（Windows, macOS, Linux）下重新编译失败、abi 匹配报错或打包丢失时调用此技能。
---

# Electron Native Binder (原生模块跨平台编译专家)

当您在开发或打包后启动时，看到诸如 `Error: The specified module could not be found.` 或 `was compiled against a different Node.js version` 等原生 C++ ABI 错误时，必须根据本规程处理。

## 黄金重建流程

### 1. 本地重建 (Rebuild)
- 由于 Electron 内嵌的 Node.js 运行时 ABI（Application Binary Interface）版本通常与您系统上全局安装的 Node.js 不同，因此所有包含 C++ 源码的原生模块必须进行二次编译。
- 使用项目的专用 `electron-rebuild`：
  ```bash
  npx electron-rebuild -f -w better-sqlite3
  ```
- `-f` 代表强制重新编译，`-w` 指定特定包，避免全盘重编浪费时间。

### 2. 跨平台打包构建规程 (Cross-Compilation Rules)
- 使用 `electron-builder` 打包时，确保 `package.json` 中的 `build` 部分配置正确：
  - `asar: true`：如果启用了 ASAR 包，部分原生 `.node` 二进制模块可能无法在 ASAR 中直接加载，必须配置 `asarUnpack`：
    ```json
    "asarUnpack": [
      "**/node_modules/better-sqlite3/**/*"
    ]
  ```
- **Windows 构建**：编译 better-sqlite3 需要本地有 C++ 编译工具链（如 Visual Studio Build Tools 或通过 `npm install --global --production windows-build-tools`）。
- **macOS/Linux**：确保安装了 `make` 和 `g++`。

### 3. ABI 匹配灾备方案
- 如果运行时抛出 `Node-API` 版本不兼容错误，可使用全局环境配置跳过部分校验，或者清理 `node_modules` 下的 `.bin` 缓存，重新执行 `npm rebuild` 或使用匹配 Electron 所需的 node 版本的 prebuild 二进制文件。
