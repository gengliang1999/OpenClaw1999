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
async function apiRequest(endpoint, options = {}) {
  const { method = 'GET', body, stream = false, signal } = options;
  
  const fetchOptions = {
    method,
    headers: { 'Content-Type': 'application/json' },
    signal,
  };
  
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }
  
  if (stream) {
    return response; // 返回原始响应用于流式处理
  }
  
  return response.json();
}

/**
 * 暴露给渲染进程的安全 API
 */
let currentChatController = null;

contextBridge.exposeInMainWorld('openClaw', {
  // ===== 聊天相关 =====
  chat: {
    /** 发送聊天消息 */
    sendMessage: (conversationId, message, modelId) => 
      apiRequest('/chat', { 
        method: 'POST', 
        body: { conversationId, message, modelId } 
      }),
    
    /** 发送流式聊天消息 — 在 preload 中消费流，通过回调传递解析后的 SSE 事件 */
    sendMessageStream: (conversationId, message, attachment, modelId, systemPrompt, temperature, onData) => {
      if (currentChatController) currentChatController.abort();
      currentChatController = new AbortController();
      const signal = currentChatController.signal;

      return (async () => {
        const response = await fetch(`${API_BASE}/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message, attachment, modelId, systemPrompt, temperature }),
          signal,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ message: '请求失败' }));
          throw new Error(errBody.message || `HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // 保留未完成的行

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              try {
                const parsed = JSON.parse(data);
                if (onData) onData(parsed);
              } catch (e) {}
            }
          }
        }

        // 处理 buffer 中残留的最后一行
        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (onData) onData(parsed);
          } catch (e) {}
        }
      })();
    },

    /** 中断生成 */
    abortStream: () => {
      if (currentChatController) {
        currentChatController.abort();
        currentChatController = null;
      }
    },
    
    /** 删除单条消息 */
    deleteMessage: (messageId) => 
      apiRequest(`/chat/message/${messageId}`, { method: 'DELETE' }),
    
    /** 获取聊天历史 */
    getHistory: (conversationId) => 
      apiRequest(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`),
    
    /** 获取所有对话列表 */
    getConversations: () => apiRequest('/chat/conversations'),
    
    /** 创建新对话 */
    createConversation: (title) => 
      apiRequest('/chat/conversations', { method: 'POST', body: { title } }),
    
    /** 删除对话 */
    deleteConversation: (conversationId) =>
      apiRequest(`/chat/conversations/${conversationId}`, { method: 'DELETE' }),

    /** 重命名对话 */
    renameConversation: (conversationId, title) =>
      apiRequest(`/chat/conversations/${conversationId}`, { method: 'PUT', body: { title } }),

    /** 导出对话 */
    exportConversation: (conversationId) =>
      apiRequest(`/chat/conversations/${conversationId}/export`),

    /** 移入垃圾篓 */
    moveToTrash: (conversationId) =>
      apiRequest(`/chat/conversations/${conversationId}/trash`, { method: 'POST' }),

    /** 获取垃圾篓列表 */
    getTrash: () => apiRequest('/chat/trash'),

    /** 获取垃圾篓数量 */
    getTrashCount: () => apiRequest('/chat/trash/count'),

    /** 从垃圾篓恢复 */
    restoreFromTrash: (trashId) =>
      apiRequest(`/chat/trash/${trashId}/restore`, { method: 'POST' }),

    /** 永久删除垃圾篓条目 */
    permanentDelete: (trashId) =>
      apiRequest(`/chat/trash/${trashId}`, { method: 'DELETE' }),

    /** 清空垃圾篓 */
    emptyTrash: () => apiRequest('/chat/trash', { method: 'DELETE' }),

    /** 清空聊天历史 */
    clearHistory: (conversationId) => 
      apiRequest(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`, { method: 'DELETE' }),
  },

  // ===== 模型相关 =====
  model: {
    /** 获取所有可用模型 */
    getModels: () => apiRequest('/models'),
    
    /** 设置当前活跃模型 */
    setActiveModel: (modelId) => 
      apiRequest('/models/active', { method: 'PUT', body: { modelId } }),
    
    /** 获取当前活跃模型 */
    getActiveModel: () => apiRequest('/models/active'),
    
    /** 添加模型配置 */
    addModel: (config) => 
      apiRequest('/models', { method: 'POST', body: config }),
    
    /** 删除模型配置 */
    removeModel: (modelId) => 
      apiRequest(`/models/${modelId}`, { method: 'DELETE' }),
    
    /** 获取模型市场 */
    getMarketplace: () => apiRequest('/models/marketplace'),

    /** 同步第三方本地模型 */
    syncLocalModels: () => apiRequest('/models/sync', { method: 'POST' }),

    /** 预加载本地模型到显存 */
    preloadModel: (modelId) => apiRequest('/models/preload', { method: 'POST', body: { modelId } }),

    /** 拉取模型 (流式) */
    pullModel: (modelId) =>
      apiRequest('/models/pull', { method: 'POST', body: { modelId }, stream: true }),

    /** 检测本地运行时状态 (Ollama & LM Studio) */
    detectLocal: () => apiRequest('/models/local-detect'),

    /** 获取 Ollama 已安装模型列表 */
    getOllamaModels: () => apiRequest('/models/ollama/list'),

    /** 获取 LM Studio 已加载模型列表 */
    getLMStudioModels: () => apiRequest('/models/lmstudio/list'),

    /** 添加本地模型并可选设为默认 */
    addLocalModel: (provider, modelId, modelName, setDefault) =>
      apiRequest('/models/local/add', { method: 'POST', body: { provider, modelId, modelName, setDefault } }),

    /** 代理获取外部 API 模型列表 */
    proxyFetchModels: (baseUrl, apiKey) =>
      apiRequest('/models/proxy-fetch', { method: 'POST', body: { baseUrl, apiKey } }),

    /** 代理连通测试 */
    proxyTest: (baseUrl, apiKey) =>
      apiRequest('/models/proxy-test', { method: 'POST', body: { baseUrl, apiKey } }),

    /** 删除本地模型 */
    deleteLocalModel: (provider, modelId) =>
      apiRequest(`/models/local/${provider}/${encodeURIComponent(modelId)}`, { method: 'DELETE' }),
  },

  // ===== 记忆相关 =====
  memory: {
    /** 获取记忆列表 */
    getMemories: (page, pageSize, category) => {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (pageSize) params.set('pageSize', pageSize);
      if (category) params.set('category', category);
      return apiRequest(`/memory?${params.toString()}`);
    },
    
    /** 添加记忆 */
    addMemory: (content, category, tags) => 
      apiRequest('/memory', { method: 'POST', body: { content, category, tags } }),
    
    /** 删除记忆 */
    deleteMemory: (id) => 
      apiRequest(`/memory/${id}`, { method: 'DELETE' }),
    
    /** 搜索记忆 */
    searchMemory: (query, limit) => 
      apiRequest(`/memory/search?q=${encodeURIComponent(query)}&limit=${limit || 10}`),
  },

  // ===== 自动化相关 =====
  automation: {
    /** 截取全屏 */
    captureScreen: () => apiRequest('/automation/screenshot', { method: 'POST' }),
  },

  // ===== 沙盒相关 =====
  sandbox: {
    /** 执行沙盒命令 */
    executeCommand: (command, options) => 
      apiRequest('/sandbox/execute', { method: 'POST', body: { command, ...options } }),
    
    /** 获取权限列表 */
    getPermissions: () => apiRequest('/sandbox/permissions'),
    
    /** 授予权限 */
    grantPermission: (pattern, permanent) => 
      apiRequest('/sandbox/permissions', { method: 'POST', body: { pattern, permanent } }),
    
    /** 撤销权限 */
    revokePermission: (id) => 
      apiRequest(`/sandbox/permissions/${id}`, { method: 'DELETE' }),
    
    /** 获取操作日志 */
    getLogs: (page, pageSize) => 
      apiRequest(`/sandbox/logs?page=${page || 1}&pageSize=${pageSize || 50}`),
  },

  // ===== 技能相关 =====
  skill: {
    /** 获取已安装技能列表 */
    getSkills: () => apiRequest('/skills'),
    
    /** 安装技能 */
    installSkill: (skillId) => 
      apiRequest('/skills/install', { method: 'POST', body: { skillId } }),
    
    /** 卸载技能 */
    removeSkill: (skillId) => 
      apiRequest(`/skills/${skillId}`, { method: 'DELETE' }),
    
    /** 获取技能市场 */
    getMarketplace: (type, search) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      return apiRequest(`/skills/marketplace?${params.toString()}`);
    },
  },

  // ===== 插件相关 =====
  plugin: {
    /** 获取已安装插件列表 */
    getPlugins: () => apiRequest('/plugins'),
    
    /** 安装插件 */
    installPlugin: (pluginId) => 
      apiRequest('/plugins/install', { method: 'POST', body: { pluginId } }),
    
    /** 卸载插件 */
    removePlugin: (pluginId) => 
      apiRequest(`/plugins/${pluginId}`, { method: 'DELETE' }),
    
    /** 获取插件市场 */
    getMarketplace: () => apiRequest('/plugins/marketplace'),
    
    /** 更新插件配置 */
    updatePluginConfig: (pluginId, config) => 
      apiRequest(`/plugins/${pluginId}/config`, { method: 'PUT', body: { config } }),
    
    /** 连接插件 */
    connectPlugin: (pluginId) => 
      apiRequest(`/plugins/${pluginId}/connect`, { method: 'POST' }),
    
    /** 断开插件 */
    disconnectPlugin: (pluginId) => 
      apiRequest(`/plugins/${pluginId}/disconnect`, { method: 'POST' }),
  },

  // ===== 设置相关 =====
  settings: {
    /** 获取单个设置项 */
    get: (key) => apiRequest(`/settings/${key}`),
    
    /** 设置单个设置项 */
    set: (key, value) => 
      apiRequest(`/settings/${key}`, { method: 'PUT', body: { value } }),
    
    /** 获取所有设置 */
    getAll: () => apiRequest('/settings'),
    
    /** 批量更新设置 */
    updateAll: (settings) => 
      apiRequest('/settings', { method: 'PUT', body: settings }),
  },

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
