/**
 * OpenClaw 智能助手 - Electron 主进程
 * 负责创建主窗口、启动本地 API 服务器、注册 IPC 通信处理器
 */

const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');

// 本地 API 服务器
let apiServer = null;
let mainWindow = null;

/**
 * 创建主窗口
 */
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'OpenClaw 智能助手',
    frame: true,
    backgroundColor: '#0a0a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    show: true,
  });

  // 通过本地 HTTP 服务器加载页面（解决 file:// 协议下 ES Module CORS 问题）
  mainWindow.loadURL('http://127.0.0.1:3721');

  // 窗口准备好后再显示，避免闪烁
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER] ${message} (${sourceId}:${line})`);
  });

  // 窗口关闭事件
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 阻止新窗口打开，改用系统浏览器
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 开发模式下打开开发者工具
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

/**
 * 启动本地 API 服务器（同时提供前端静态文件服务）
 */
async function startApiServer() {
  try {
    const { createServer } = require('../backend/server');
    const rendererPath = path.join(__dirname, '..', 'renderer');
    apiServer = await createServer(3721, rendererPath);
    console.log('[主进程] API 服务器已启动，端口: 3721');
  } catch (error) {
    console.error('[主进程] API 服务器启动失败:', error);
    dialog.showErrorBox('启动错误', `API 服务器启动失败: ${error.message}`);
  }
}

/**
 * 注册 IPC 通信处理器
 */
function registerIpcHandlers() {
  // 系统信息
  ipcMain.handle('system:getInfo', () => {
    return {
      platform: process.platform,
      arch: process.arch,
      version: app.getVersion(),
      appPath: app.getPath('userData'),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
    };
  });

  // 打开外部链接
  ipcMain.handle('system:openExternal', (_, url) => {
    return shell.openExternal(url);
  });

  // 选择文件
  ipcMain.handle('system:selectFile', async (_, options) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options?.filters || [],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // 选择目录
  ipcMain.handle('system:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  // 窗口控制
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
}

// 应用准备就绪
app.whenReady().then(async () => {
  registerIpcHandlers();
  await startApiServer();
  createMainWindow();

  // macOS 点击 dock 图标重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 应用退出前清理
app.on('before-quit', () => {
  if (apiServer) {
    apiServer.close();
    console.log('[主进程] API 服务器已关闭');
  }
});
