// API 服务器地址
const API_BASE = 'http://localhost:3721/api';

/**
 * 封装 HTTP 请求方法
 */
export async function apiRequest(endpoint, options = {}) {
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

let currentChatController = null;

export const api = {
  // ===== 聊天相关 =====
  chat: {
    sendMessage: (conversationId, message, modelId) => 
      apiRequest('/chat', { method: 'POST', body: { conversationId, message, modelId } }),
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

        if (buffer.startsWith('data: ')) {
          const data = buffer.slice(6);
          try {
            const parsed = JSON.parse(data);
            if (onData) onData(parsed);
          } catch (e) {}
        }
      })();
    },
    abortStream: () => {
      if (currentChatController) {
        currentChatController.abort();
        currentChatController = null;
      }
    },
    deleteMessage: (messageId) => apiRequest(`/chat/message/${messageId}`, { method: 'DELETE' }),
    getHistory: (conversationId) => apiRequest(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`),
    getConversations: () => apiRequest('/chat/conversations'),
    createConversation: (title) => apiRequest('/chat/conversations', { method: 'POST', body: { title } }),
    deleteConversation: (conversationId) => apiRequest(`/chat/conversations/${conversationId}`, { method: 'DELETE' }),
    renameConversation: (conversationId, title) => apiRequest(`/chat/conversations/${conversationId}`, { method: 'PUT', body: { title } }),
    exportConversation: (conversationId) => apiRequest(`/chat/conversations/${conversationId}/export`),
    moveToTrash: (conversationId) => apiRequest(`/chat/conversations/${conversationId}/trash`, { method: 'POST' }),
    getTrash: () => apiRequest('/chat/trash'),
    getTrashCount: () => apiRequest('/chat/trash/count'),
    restoreFromTrash: (trashId) => apiRequest(`/chat/trash/${trashId}/restore`, { method: 'POST' }),
    permanentDelete: (trashId) => apiRequest(`/chat/trash/${trashId}`, { method: 'DELETE' }),
    emptyTrash: () => apiRequest('/chat/trash', { method: 'DELETE' }),
    clearHistory: (conversationId) => apiRequest(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`, { method: 'DELETE' }),
  },
  // ===== 模型相关 =====
  model: {
    getModels: () => apiRequest('/models'),
    setActiveModel: (modelId) => apiRequest('/models/active', { method: 'PUT', body: { modelId } }),
    getActiveModel: () => apiRequest('/models/active'),
    addModel: (config) => apiRequest('/models', { method: 'POST', body: config }),
    removeModel: (modelId) => apiRequest(`/models/${modelId}`, { method: 'DELETE' }),
    getMarketplace: () => apiRequest('/models/marketplace'),
    syncLocalModels: () => apiRequest('/models/sync', { method: 'POST' }),
    preloadModel: (modelId) => apiRequest('/models/preload', { method: 'POST', body: { modelId } }),
    pullModel: (modelId) => apiRequest('/models/pull', { method: 'POST', body: { modelId }, stream: true }),
    detectLocal: () => apiRequest('/models/local-detect'),
    getOllamaModels: () => apiRequest('/models/ollama/list'),
    getLMStudioModels: () => apiRequest('/models/lmstudio/list'),
    addLocalModel: (provider, modelId, modelName, setDefault) => apiRequest('/models/local/add', { method: 'POST', body: { provider, modelId, modelName, setDefault } }),
    proxyFetchModels: (baseUrl, apiKey) => apiRequest('/models/proxy-fetch', { method: 'POST', body: { baseUrl, apiKey } }),
    proxyTest: (baseUrl, apiKey) => apiRequest('/models/proxy-test', { method: 'POST', body: { baseUrl, apiKey } }),
    deleteLocalModel: (provider, modelId) => apiRequest(`/models/local/${provider}/${encodeURIComponent(modelId)}`, { method: 'DELETE' }),
  },
  // ===== 记忆相关 =====
  memory: {
    getMemories: (page, pageSize, category) => {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (pageSize) params.set('pageSize', pageSize);
      if (category) params.set('category', category);
      return apiRequest(`/memory?${params.toString()}`);
    },
    addMemory: (content, category, tags) => apiRequest('/memory', { method: 'POST', body: { content, category, tags } }),
    deleteMemory: (id) => apiRequest(`/memory/${id}`, { method: 'DELETE' }),
    searchMemory: (query, limit) => apiRequest(`/memory/search?q=${encodeURIComponent(query)}&limit=${limit || 10}`),
  },
  // ===== 自动化相关 =====
  automation: {
    captureScreen: () => apiRequest('/automation/screenshot', { method: 'POST' }),
  },
  // ===== 沙盒相关 =====
  sandbox: {
    executeCommand: (command, options) => apiRequest('/sandbox/execute', { method: 'POST', body: { command, ...options } }),
    getPermissions: () => apiRequest('/sandbox/permissions'),
    grantPermission: (pattern, permanent) => apiRequest('/sandbox/permissions', { method: 'POST', body: { pattern, permanent } }),
    revokePermission: (id) => apiRequest(`/sandbox/permissions/${id}`, { method: 'DELETE' }),
    getLogs: (page, pageSize) => apiRequest(`/sandbox/logs?page=${page || 1}&pageSize=${pageSize || 50}`),
  },
  // ===== 技能相关 =====
  skill: {
    getSkills: () => apiRequest('/skills'),
    installSkill: (skillId) => apiRequest('/skills/install', { method: 'POST', body: { skillId } }),
    removeSkill: (skillId) => apiRequest(`/skills/${skillId}`, { method: 'DELETE' }),
    getMarketplace: (type, search) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      return apiRequest(`/skills/marketplace?${params.toString()}`);
    },
  },
  // ===== 插件相关 =====
  plugin: {
    getPlugins: () => apiRequest('/plugins'),
    installPlugin: (pluginId) => apiRequest('/plugins/install', { method: 'POST', body: { pluginId } }),
    removePlugin: (pluginId) => apiRequest(`/plugins/${pluginId}`, { method: 'DELETE' }),
    getMarketplace: () => apiRequest('/plugins/marketplace'),
    updatePluginConfig: (pluginId, config) => apiRequest(`/plugins/${pluginId}/config`, { method: 'PUT', body: { config } }),
    connectPlugin: (pluginId) => apiRequest(`/plugins/${pluginId}/connect`, { method: 'POST' }),
    disconnectPlugin: (pluginId) => apiRequest(`/plugins/${pluginId}/disconnect`, { method: 'POST' }),
  },
  // ===== 设置相关 =====
  settings: {
    get: (key) => apiRequest(`/settings/${key}`),
    set: (key, value) => apiRequest(`/settings/${key}`, { method: 'PUT', body: { value } }),
    getAll: () => apiRequest('/settings'),
    updateAll: (settings) => apiRequest('/settings', { method: 'PUT', body: settings }),
  }
};
