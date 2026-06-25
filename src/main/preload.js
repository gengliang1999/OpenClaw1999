/**
 * OpenClaw 智能助手 - 预加载脚本
 * 通过 contextBridge 安全地暴露 API 给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron');

// API 服务器地址
const API_BASE = 'http://localhost:3721/api';

/**
 * 封装 HTTP 请求方法
 */
contextBridge.exposeInMainWorld('openClaw', {
  // ===== 系统相关 =====
  system: {
    /** 框选截图 */
    captureScreenArea: () => ipcRenderer.invoke('system:captureScreenArea'),

    /** 获取系统信息 */
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    
    /** 打开外部链接 */
    openExternal: (url) => ipcRenderer.invoke('system:openExternal', url),
    
    /** 选择文件 */
    selectFile: (options) => ipcRenderer.invoke('system:selectFile', options),
    
    /** 选择目录 */
    selectDirectory: () => ipcRenderer.invoke('system:selectDirectory'),
    
    /** 窗口最小化 */
    minimize: () => ipcRenderer.invoke('window:minimize'),
    
    /** 窗口隐藏 */
    hide: () => ipcRenderer.invoke('window:hide'),
    
    /** 窗口显示 */
    show: () => ipcRenderer.invoke('window:show'),
    
    /** 窗口最大化/还原 */
    maximize: () => ipcRenderer.invoke('window:maximize'),
    
    /** 截图画板相关通信 */
    getScreenCapture: () => ipcRenderer.invoke('system:getScreenCapture'),
    finishScreenCapture: (dataUrl) => ipcRenderer.send('system:captureScreenArea-done', dataUrl),
    onScreenshotStart: (callback) => ipcRenderer.on('screenshot:start', (event, dataUrl) => callback(dataUrl)),
    
    /** 关闭窗口 */
    close: () => ipcRenderer.invoke('window:close'),

    /** 重启应用 */
    restart: () => ipcRenderer.invoke('app:restart'),
  },
});
