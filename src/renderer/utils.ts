// @ts-nocheck
// ================== api.ts ==================

export const api = {
  get: async (url: string, options: any = {}) => {
    let fetchOpts: any = { method: options.method || 'GET', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } };
    if (options.signal) fetchOpts.signal = options.signal;
    if (options.body && options.method !== 'GET') fetchOpts.body = JSON.stringify(options.body);
    const res = await fetch(`http://127.0.0.1:3721/api${url}`, fetchOpts);
    if (!res.ok) throw new Error(await res.text());
    if (options.stream) return res.body;
    return res.json();
  },
  post: async (url: string, data: any, options: any = {}) => api.get(url, { ...options, method: 'POST', body: data }),
  put: async (url: string, data: any, options: any = {}) => api.get(url, { ...options, method: 'PUT', body: data }),
  delete: async (url: string, options: any = {}) => api.get(url, { ...options, method: 'DELETE' }),

  // ===== ������� =====
  chat: {
    sendMessage: (conversationId, message, modelId) => 
      api.post('/chat', { conversationId, message, modelId }),
    sendMessageStream: (conversationId, message, attachment, modelId, systemPrompt, temperature, onData) => {
      let currentChatController = new AbortController();
      const signal = currentChatController.signal;

      return (async () => {
        const response = await fetch('http://127.0.0.1:3721/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversationId, message, attachment, modelId, systemPrompt, temperature }),
          signal,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ message: '����ʧ��' }));
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
          buffer = lines.pop();

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
      })();
    },
    abortStream: () => {},
    deleteMessage: (messageId) => api.delete(`/chat/message/${messageId}`),
    getHistory: (conversationId) => api.get(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`),
    getConversations: () => api.get('/chat/conversations'),
    createConversation: (title) => api.post('/chat/conversations', { title }),
    deleteConversation: (conversationId) => api.delete(`/chat/conversations/${conversationId}`),
    renameConversation: (conversationId, title) => api.put(`/chat/conversations/${conversationId}`, { title }),
    exportConversation: (conversationId) => api.get(`/chat/conversations/${conversationId}/export`),
    moveToTrash: (conversationId) => api.post(`/chat/conversations/${conversationId}/trash`, {}),
    getTrash: () => api.get('/chat/trash'),
    getTrashCount: () => api.get('/chat/trash/count'),
    restoreFromTrash: (trashId) => api.post(`/chat/trash/${trashId}/restore`, {}),
    permanentDelete: (trashId) => api.delete(`/chat/trash/${trashId}`),
    emptyTrash: () => api.delete('/chat/trash'),
    clearHistory: (conversationId) => api.delete(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`),
  },
  // ===== ģ����� =====
  model: {
    getModels: () => api.get('/models'),
    setActiveModel: (modelId) => api.put('/models/active', { modelId }),
    getActiveModel: () => api.get('/models/active'),
    addModel: (config) => api.post('/models', config),
    removeModel: (modelId) => api.delete(`/models/${modelId}`),
    getMarketplace: () => api.get('/models/marketplace'),
    syncLocalModels: () => api.post('/models/sync', {}),
    preloadModel: (modelId) => api.post('/models/preload', { modelId }),
    pullModel: (modelId) => api.post('/models/pull', { modelId }, { stream: true }),
    detectLocal: () => api.get('/models/local-detect'),
    getOllamaModels: () => api.get('/models/ollama/list'),
    getLMStudioModels: () => api.get('/models/lmstudio/list'),
    addLocalModel: (provider, modelId, modelName, setDefault) => api.post('/models/local/add', { provider, modelId, modelName, setDefault }),
    proxyFetchModels: (baseUrl, apiKey) => api.post('/models/proxy-fetch', { baseUrl, apiKey }),
    proxyTest: (baseUrl, apiKey) => api.post('/models/proxy-test', { baseUrl, apiKey }),
    deleteLocalModel: (provider, modelId) => api.delete(`/models/local/${provider}/${encodeURIComponent(modelId)}`),
  },
  // ===== ������� =====
  memory: {
    getMemories: (page, pageSize, category) => {
      const params = new URLSearchParams();
      if (page) params.set('page', page);
      if (pageSize) params.set('pageSize', pageSize);
      if (category) params.set('category', category);
      return api.get(`/memory?${params.toString()}`);
    },
    addMemory: (content, category, tags) => api.post('/memory', { content, category, tags }),
    deleteMemory: (id) => api.delete(`/memory/${id}`),
    searchMemory: (query, limit) => api.get(`/memory/search?q=${encodeURIComponent(query)}&limit=${limit || 10}`),
  },
  // ===== �Զ������ =====
  automation: {
    captureScreen: () => api.post('/automation/screenshot', {}),
  },
  // ===== ɳ����� =====
  sandbox: {
    executeCommand: (command, options) => api.post('/sandbox/execute', { command, ...options }),
    getPermissions: () => api.get('/sandbox/permissions'),
    grantPermission: (pattern, permanent) => api.post('/sandbox/permissions', { pattern, permanent }),
    revokePermission: (id) => api.delete(`/sandbox/permissions/${id}`),
    getLogs: (page, pageSize) => api.get(`/sandbox/logs?page=${page || 1}&pageSize=${pageSize || 50}`),
  },
  // ===== ������� =====
  skill: {
    getSkills: () => api.get('/skills'),
    installSkill: (skillId) => api.post('/skills/install', { skillId }),
    removeSkill: (skillId) => api.delete(`/skills/${skillId}`),
    getMarketplace: (type, search) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      return api.get(`/skills/marketplace?${params.toString()}`);
    },
  },
  // ===== ������ =====
  plugin: {
    getPlugins: () => api.get('/plugins'),
    installPlugin: (pluginId) => api.post('/plugins/install', { pluginId }),
    removePlugin: (pluginId) => api.delete(`/plugins/${pluginId}`),
    getMarketplace: () => api.get('/plugins/marketplace'),
    updatePluginConfig: (pluginId, config) => api.put(`/plugins/${pluginId}/config`, { config }),
    connectPlugin: (pluginId) => api.post(`/plugins/${pluginId}/connect`, {}),
    disconnectPlugin: (pluginId) => api.post(`/plugins/${pluginId}/disconnect`, {}),
  },
  // ===== ������� =====
  settings: {
    get: (key) => api.get(`/settings/${key}`),
    set: (key, value) => api.put(`/settings/${key}`, { value }),
    getAll: () => api.get('/settings'),
    updateAll: (settings) => api.put('/settings', settings),
  }
};


// ================== common.ts ==================
/**
 * 公共工具函数模块
 * 统一提供各页面复用的工具函数
 */

/**
 * HTML 转义，防止 XSS
 * @param {string} unsafe - 原始字符串
 * @returns {string} 转义后的安全字符串
 */
export function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 格式化日期为中文本地格式
 * @param {string} dateStr - ISO 日期字符串
 * @returns {string} 格式化后的日期
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

/**
 * 延时函数
 * @param {number} ms - 毫秒数
 * @returns {Promise<void>}
 */
export function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待毫秒数
 * @returns {Function}
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ================== markdown.ts ==================
/**
 * 轻量级 Markdown 解析器
 * 支持：代码块、行内代码、粗体、斜体、引用、换行
 */


/**
 * 将 Markdown 文本转换为 HTML
 * @param {string} md - Markdown 文本
 * @returns {string} HTML 字符串
 */
export function parseMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);

  // 代码块
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background: var(--bg-active); padding:12px; border-radius:8px; overflow-x:auto; margin: 8px 0;"><code style="font-family:Consolas,monospace; font-size:13px;">$2</code></pre>');
  // 行内代码
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-active); padding:2px 4px; border-radius:4px; font-family:Consolas,monospace; font-size:0.9em;">$1</code>');
  // 粗体
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  // 斜体
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  // 引用
  html = html.replace(/&gt; (.*?)(?:\n|$)/g, '<blockquote style="border-left: 3px solid var(--primary); color: var(--text-muted); margin: 4px 0; padding-left: 8px;">$1</blockquote>');
  // 思考过程块 <think> 或 <thought>
  html = html.replace(/&lt;(?:think|thought)&gt;([\s\S]*?)&lt;\/(?:think|thought)&gt;/gi, function(match, content) {
    return `<details style="margin: 8px 0; padding: 12px; background: var(--bg-active); border-radius: 8px; border-left: 3px solid #a259ff; cursor: pointer;"><summary style="color: #a259ff; font-weight: 600; font-size: 13px; user-select: none;">🤔 AI 思考过程</summary><div style="margin-top: 8px; font-size: 13px; color: var(--text-muted); white-space: pre-wrap;">${content}</div></details>`;
  });

  // 换行
  html = html.replace(/\n/g, '<br/>');

  return html;
}

