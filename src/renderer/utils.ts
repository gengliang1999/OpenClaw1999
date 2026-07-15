// ================== api.ts ==================

export const api = {
  get: async (url: string, options: any = {}) => {
    if (window.openClaw && window.openClaw.apiCall) {
      // 通过原生安全的 IPC 管道直接分发 API，无 TCP 端口开销，防御跨源攻击
      return window.openClaw.apiCall(url, { ...options, method: options.method || 'GET' });
    }
    throw new Error('原生安全 IPC 管道不可用');
  },
  post: async (url: string, data: any, options: any = {}) => api.get(url, { ...options, method: 'POST', body: data }),
  put: async (url: string, data: any, options: any = {}) => api.get(url, { ...options, method: 'PUT', body: data }),
  delete: async (url: string, options: any = {}) => {
    const body = options.body || { ...options };
    // 移除特殊的 method 属性以防冲突
    delete body.method; 
    return api.get(url, { method: 'DELETE', body });
  },

  // ===== 业务接口 =====
  chat: {
    sendMessage: (conversationId: string, message: string, modelId: string) => 
      api.post('/chat', { conversationId, message, modelId }),
    sendMessageStream: (conversationId: string, message: string, attachment: any, modelId: string, systemPrompt: string, temperature: number, agentMode: string, onData: (data: any) => void) => {
      if (window.openClaw && window.openClaw.onChatChunk) {
        // 先解绑历史监听，状态更新唯一性防竞态 Bug
        window.openClaw.offChatChunk();
        
        window.openClaw.onChatChunk((data: any) => {
          if (data.type === 'done' || data.type === 'error') {
            window.openClaw.offChatChunk();
          }
          if (onData) onData(data);
        });

        // 异步发起流式 IPC 响应，并在主进程触发 Abort 闭环
        window.openClaw.apiCallStream({ conversationId, message, attachment, modelId, systemPrompt, temperature, agentMode }).catch((err: any) => {
          console.error('[流式 IPC 管道异常]', err);
          window.openClaw.offChatChunk();
          if (onData) onData({ type: 'error', message: err.message });
        });
      }
      return Promise.resolve();
    },
    abortStream: () => {
      if (window.openClaw && window.openClaw.abortStream) {
        window.openClaw.abortStream();
      }
    },
    deleteMessage: (messageId: string) => api.delete(`/chat/message/${messageId}`),
    getHistory: (conversationId?: string) => api.get(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`),
    getConversations: () => api.get('/chat/conversations'),
    createConversation: (title: string) => api.post('/chat/conversations', { title }),
    deleteConversation: (conversationId: string) => api.delete(`/chat/conversations/${conversationId}`),
    renameConversation: (conversationId: string, title: string) => api.put(`/chat/conversations/${conversationId}`, { title }),
    exportConversation: (conversationId: string) => api.get(`/chat/conversations/${conversationId}/export`),
    moveToTrash: (conversationId: string) => api.post(`/chat/conversations/${conversationId}/trash`, {}),
    getTrash: () => api.get('/chat/trash'),
    getTrashCount: () => api.get('/chat/trash/count'),
    restoreFromTrash: (trashId: string) => api.post(`/chat/trash/${trashId}/restore`, {}),
    permanentDelete: (trashId: string) => api.delete(`/chat/trash/${trashId}`),
    emptyTrash: () => api.delete('/chat/trash'),
    clearHistory: (conversationId?: string) => api.delete(`/chat/history${conversationId ? `?conversationId=${conversationId}` : ''}`),
    optimizePromptStream: (text: string, modelId: string, onData: (data: any) => void) => {
      if (window.openClaw && window.openClaw.onOptimizeChunk) {
        window.openClaw.offOptimizeChunk();
        window.openClaw.onOptimizeChunk((data: any) => {
          if (data.type === 'done' || data.type === 'error') {
            window.openClaw.offOptimizeChunk();
          }
          if (onData) onData(data);
        });
        window.openClaw.apiOptimizeStream({ text, modelId }).catch((err: any) => {
          console.error('[优化提示词流管道异常]', err);
          window.openClaw.offOptimizeChunk();
          if (onData) onData({ type: 'error', message: err.message });
        });
      }
      return Promise.resolve();
    },
  },
  // ===== 模型接口 =====
  model: {
    getModels: () => api.get('/models'),
    setActiveModel: (modelId: string) => api.put('/models/active', { modelId }),
    getActiveModel: () => api.get('/models/active'),
    addModel: (config: any) => api.post('/models', config),
    removeModel: (modelId: string) => api.delete(`/models/${modelId}`),
    getMarketplace: () => api.get('/models/marketplace'),
    syncLocalModels: () => api.post('/models/sync', {}),
    preloadModel: (modelId: string) => api.post('/models/preload', { modelId }),
    pullModel: (modelId: string) => api.post('/models/pull', { modelId }, { stream: true }),
    detectLocal: () => api.get('/models/local-detect'),
    getOllamaModels: () => api.get('/models/ollama/list'),
    getLMStudioModels: () => api.get('/models/lmstudio/list'),
    addLocalModel: (provider: string, modelId: string, modelName: string, setDefault: boolean) => api.post('/models/local/add', { provider, modelId, modelName, setDefault }),
    proxyFetchModels: (baseUrl: string, apiKey: string) => api.post('/models/proxy-fetch', { baseUrl, apiKey }),
    proxyTest: (baseUrl: string, apiKey: string) => api.post('/models/proxy-test', { baseUrl, apiKey }),
    deleteLocalModel: (provider: string, modelId: string) => api.delete(`/models/local/${provider}/${encodeURIComponent(modelId)}`),
  },
  // ===== 记忆接口 =====
  memory: {
    getMemories: (page?: number | string, pageSize?: number | string, category?: string) => {
      const params = new URLSearchParams();
      if (page) params.set('page', String(page));
      if (pageSize) params.set('pageSize', String(pageSize));
      if (category) params.set('category', category);
      return api.get(`/memory?${params.toString()}`);
    },
    addMemory: (content: string, category: string, tags: string[]) => api.post('/memory', { content, category, tags }),
    deleteMemory: (id: string | number) => api.delete(`/memory/${id}`),
    pinMemory: (id: string | number, isPinned: boolean) => api.put(`/memory/${id}/pin`, { isPinned }),
    searchMemory: (query: string, limit?: number) => api.get(`/memory/search?q=${encodeURIComponent(query)}&limit=${limit || 10}`),
  },
  // ===== 自动化接口 =====
  automation: {
    captureScreen: () => api.post('/automation/screenshot', {}),
  },
  // ===== 沙盒接口 =====
  sandbox: {
    executeCommand: (command: string, options: any = {}) => api.post('/sandbox/execute', { command, confirmed: false, permanent: false, ...options }),
    getPermissions: () => api.get('/sandbox/permissions'),
    grantPermission: (pattern: string, permanent: boolean) => api.post('/sandbox/permissions', { pattern, permanent }),
    revokePermission: (id: string | number) => api.delete(`/sandbox/permissions/${id}`),
    getLogs: (page?: number, pageSize?: number) => api.get(`/sandbox/logs?page=${page || 1}&pageSize=${pageSize || 50}`),
  },
  // ===== 技能接口 =====
  skill: {
    getSkills: () => api.get('/skills'),
    installSkill: (skillId: string) => api.post('/skills/install', { skillId }),
    removeSkill: (skillId: string) => api.delete(`/skills/${skillId}`),
    getMarketplace: (type?: string, search?: string) => {
      const params = new URLSearchParams();
      if (type) params.set('type', type);
      if (search) params.set('search', search);
      return api.get(`/skills/marketplace?${params.toString()}`);
    },
  },
  // ===== 插件接口 =====
  plugin: {
    getPlugins: () => api.get('/plugins'),
    installPlugin: (pluginId: string) => api.post('/plugins/install', { pluginId }),
    removePlugin: (pluginId: string) => api.delete(`/plugins/${pluginId}`),
    getMarketplace: () => api.get('/plugins/marketplace'),
    updatePluginConfig: (pluginId: string, config: any) => api.put(`/plugins/${pluginId}/config`, { config }),
    connectPlugin: (pluginId: string) => api.post(`/plugins/${pluginId}/connect`, {}),
    disconnectPlugin: (pluginId: string) => api.post(`/plugins/${pluginId}/disconnect`, {}),
  },
  // ===== 设置接口 =====
  settings: {
    get: (key: string) => api.get(`/settings/${key}`),
    set: (key: string, value: any) => api.put(`/settings/${key}`, { value }),
    getAll: () => api.get('/settings'),
    updateAll: (settings: any) => api.put('/settings', settings),
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
export function escapeHtml(unsafe: string): string {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * I4：校验 <img src> 类 URL 是否安全。
 * 允许：data:image（排除 svg，因其可含脚本）/ https?:// / file://（本地资源）。
 * 禁止：javascript: / vbscript: / data:image/svg+xml 等。
 * @returns 安全 URL 原样返回，不安全返回 null（调用方应丢弃或降级显示）
 */
export function safeImgSrc(src: string | null | undefined): string | null {
  if (!src || typeof src !== 'string') return null;
  const s = src.trim();
  if (/^data:image\/(?!svg)[a-z0-9.+-]+;/.test(s)) return s;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^file:\/\//i.test(s)) return s;
  return null;
}

/**
 * 格式化日期为中文本地格式
 * @param {string} dateStr - ISO 日期字符串
 * @returns {string} 格式化后的日期
 */
export function formatDate(dateStr: string): string {
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
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 防抖函数
 * @param {Function} func - 需要防抖的函数
 * @param {number} wait - 等待毫秒数
 * @returns {Function}
 */
export function debounce<T extends (...args: any[]) => any>(func: T, wait: number): (...args: Parameters<T>) => void {
  let timeout: any;
  return function executedFunction(...args: Parameters<T>) {
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
export function parseMarkdown(md: string): string {
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
