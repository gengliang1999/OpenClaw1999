// @ts-nocheck
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
    if (error.code === 'EADDRINUSE') {
      console.warn('[主进程] 端口 3721 已被占用。假设 OpenClaw 后端已在运行，继续启动...');
    } else {
      console.error('[主进程] API 服务器启动失败:', error);
      dialog.showErrorBox('启动错误', `API 服务器启动失败: ${error.message}`);
    }
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
  ipcMain.handle('window:hide', () => mainWindow?.hide());
  ipcMain.handle('window:show', () => mainWindow?.show());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());

  // 重启应用
  ipcMain.handle('app:restart', () => {
    app.relaunch();
    app.exit(0);
  });
  // 截屏所需的方法
  ipcMain.handle('system:getScreenCapture', async () => {
    const { desktopCapturer, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;
    
    // 获取屏幕的完整截图
    const sources = await desktopCapturer.getSources({ 
      types: ['screen'], 
      thumbnailSize: { width: width * scaleFactor, height: height * scaleFactor } 
    });
    
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    }
    return null;
  });

  let captureWin = null;
  function initCaptureWin() {
    if (captureWin) return;
    const { BrowserWindow, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    captureWin = new BrowserWindow({
      x: primaryDisplay.bounds.x,
      y: primaryDisplay.bounds.y,
      width: primaryDisplay.bounds.width,
      height: primaryDisplay.bounds.height,
      transparent: true,
      frame: false,
      fullscreen: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      autoHideMenuBar: true,
      resizable: false,
      movable: false,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    });
    captureWin.loadFile(path.join(__dirname, '../renderer/screenshot.html'));
  }

  // 初始化隐藏的截屏窗口
  app.whenReady().then(initCaptureWin);

  // 区域截图
  ipcMain.handle('system:captureScreenArea', async () => {
    return new Promise(async (resolve) => {
      const { ipcMain: ipc, desktopCapturer, screen } = require('electron');
      const primaryDisplay = screen.getPrimaryDisplay();
      const { width, height } = primaryDisplay.size;
      const scaleFactor = primaryDisplay.scaleFactor;
      
      // 在 mainWindow 被完全隐藏后再抓取屏幕（这里已经隐藏完毕）
      const sources = await desktopCapturer.getSources({ 
        types: ['screen'], 
        thumbnailSize: { width: width, height: height } // 移除 scaleFactor 以大幅加快底层 C++ 捕捉速度
      });
      
      let dataUrl = null;
      if (sources.length > 0) {
        // 使用 JPEG 编码代替默认的 PNG(toDataURL)，大幅减少压缩和转换时间
        const buffer = sources[0].thumbnail.toJPEG(100);
        dataUrl = 'data:image/jpeg;base64,' + buffer.toString('base64');
      }
      
      if (!dataUrl) return resolve(null);
      if (!captureWin) initCaptureWin();
      
      captureWin.webContents.send('screenshot:start', dataUrl);
      captureWin.show();
      
      const onDone = (event, resultUrl) => {
        resolve(resultUrl);
        ipc.removeListener('system:captureScreenArea-done', onDone);
        if (captureWin && !captureWin.isDestroyed()) {
          captureWin.hide();
        }
      };
      
      ipc.once('system:captureScreenArea-done', onDone);
    });
  });
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
