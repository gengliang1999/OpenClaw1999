/**
 * OpenClaw 智能助手 - 预加载脚本
 * 通过 contextBridge 安全地暴露 API 给渲染进程
 */

const { contextBridge, ipcRenderer } = require('electron');

// 同步向主进程索取 API 鉴权 Token
const apiToken = ipcRenderer.sendSync('system:getApiToken');

/**
 * 封装 HTTP 请求方法
 */
contextBridge.exposeInMainWorld('openClaw', {
  apiToken,
  
  /** 全链路原生 IPC 通信通道 */
  apiCall: (url, options) => ipcRenderer.invoke('api:call', { url, options }),
  apiCallStream: (payload) => ipcRenderer.invoke('api:chat:stream', payload),
  abortStream: () => ipcRenderer.invoke('api:chat:abort'),
  onChatChunk: (callback) => ipcRenderer.on('api:chat:chunk', (event, data) => callback(data)),
  offChatChunk: () => ipcRenderer.removeAllListeners('api:chat:chunk'),
  
  /** 接收引擎管理日志 */
  onCoreManagerLog: (callback) => ipcRenderer.on('api:core-manager:log', (event, data) => callback(data)),
  offCoreManagerLog: () => ipcRenderer.removeAllListeners('api:core-manager:log'),
  
  /** 接收全局截屏快捷键触发 */
  onShortcutCaptureScreen: (callback) => ipcRenderer.on('shortcut:captureScreen', callback),
  offShortcutCaptureScreen: () => ipcRenderer.removeAllListeners('shortcut:captureScreen'),

  // ===== 系统相关 =====
  system: {
    /** 框选截图 */
    captureScreenArea: () => ipcRenderer.invoke('system:captureScreenArea'),

    /** 获取系统信息 */
    getInfo: () => ipcRenderer.invoke('system:getInfo'),
    
    /** 打开外部链接 */
    openExternal: (url) => {
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          return ipcRenderer.invoke('system:openExternal', url);
        }
      } catch (e) {}
      console.warn(`[安全拦截] 前端拦截非 http/https 协议打开请求: ${url}`);
      return Promise.reject(new Error('仅允许打开 http/https 链接'));
    },
    
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

    /** 快捷唤出主窗口 */
    toggleMain: () => ipcRenderer.invoke('window:toggleMain'),

    /** 悬浮球移动与通信 */
    dragStartFloat: () => ipcRenderer.send('float:drag-start'),
    dragEndFloat: () => ipcRenderer.send('float:drag-end'),
    moveFloatBy: (dx, dy) => ipcRenderer.send('float:move-by', dx, dy),
    resizeFloat: (bounds) => ipcRenderer.send('float:resize', bounds),
    onFloatStatus: (callback) => ipcRenderer.on('float:status', (event, side) => callback(side)),
    offFloatStatus: () => ipcRenderer.removeAllListeners('float:status'),
    
    /** 跨窗口提问 */
    sendQuickPrompt: (text) => ipcRenderer.send('quick-prompt:send', text),
    onQuickPrompt: (callback) => ipcRenderer.on('quick-prompt:received', (event, text) => callback(text)),
    offQuickPrompt: () => ipcRenderer.removeAllListeners('quick-prompt:received'),
  },
});

export {};
