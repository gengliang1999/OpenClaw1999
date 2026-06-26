// @ts-nocheck
/**
 * OpenClaw 智能助手 - 模型管理器
 * 统一管理本地 ggml 模型和云端 API 模型
 */

const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

const ANTHROPIC_PROVIDERS = ['Anthropic', 'claude'];

class ModelManager extends EventEmitter {
  /**
   * @param {string} dataDir - 数据存储目录
   */
  constructor(dataDir) {
    super();
    this.dataDir = dataDir;
    this.configPath = path.join(dataDir, 'models.json');
    this.models = [];
    this.activeModelId = null;
    this.activeProcess = null; // 本地模型进程
    this._loadConfig();
  }

  /**
   * 加载模型配置
   * @private
   */
  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
        this.models = data.models || [];
        this.activeModelId = data.activeModelId || null;
      } else {
        // 默认配置：一个云端 OpenAI 兼容模型
        this.models = [
          {
            id: 'openai-gpt4',
            name: 'GPT-4',
            type: 'cloud',
            provider: 'OpenAI',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            modelName: 'gpt-4',
            maxTokens: 4096,
            temperature: 0.7,
          },
          {
            id: 'openai-gpt35',
            name: 'GPT-3.5 Turbo',
            type: 'cloud',
            provider: 'OpenAI',
            apiKey: '',
            baseUrl: 'https://api.openai.com/v1',
            modelName: 'gpt-3.5-turbo',
            maxTokens: 4096,
            temperature: 0.7,
          },
        ];
        this.activeModelId = 'openai-gpt4';
        this._saveConfig();
      }
    } catch (error) {
      console.error('[模型管理器] 配置加载失败:', error);
      this.models = [];
      this.activeModelId = null;
    }
  }

  /**
   * 保存模型配置
   * @private
   */
  _saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify({
        models: this.models,
        activeModelId: this.activeModelId,
      }, null, 2), 'utf-8');
    } catch (error) {
      console.error('[模型管理器] 配置保存失败:', error);
    }
  }

  /**
   * 获取所有可用模型
   * @returns {Array} 模型列表
   */
  listModels() {
    return this.models.map(m => ({
      id: m.id,
      name: m.name,
      type: m.type,
      provider: m.provider || (m.type === 'local' ? '本地模型' : '云端API'),
      isActive: m.id === this.activeModelId,
      configured: m.type === 'cloud' ? !!m.apiKey : !!m.path,
    }));
  }

  /**
   * 获取当前活跃模型
   * @returns {Object|null} 当前模型信息
   */
  getActiveModel() {
    let model = this.models.find(m => m.id === this.activeModelId);
    
    // 如果没有找到当前活跃的模型，或者还没有设置 activeModelId
    if (!model && this.models.length > 0) {
      // 优先寻找本地模型作为默认
      const isLocal = (m) => m.type === 'local' || m.provider === 'LM Studio' || m.provider === 'Ollama' || m.id.toLowerCase().includes('local') || m.id.toLowerCase().includes('ollama');
      model = this.models.find(m => isLocal(m));
      
      // 如果没有本地模型，再取第一个云端配置好的模型
      if (!model) {
        model = this.models.find(m => m.type === 'cloud' && m.apiKey);
      }
      
      // 最后的兜底
      if (!model) {
        model = this.models[0];
      }
      
      // 自动保存这个新的默认选择
      if (model) {
        this.activeModelId = model.id;
        this._saveConfig();
      }
    }
    
    if (!model) return null;
    return {
      id: model.id,
      name: model.name,
      type: model.type,
      provider: model.provider || (model.type === 'local' ? '本地模型' : '云端API'),
    };
  }

  /**
   * 设置当前活跃模型
   * @param {string} modelId - 模型 ID
   */
  setActiveModel(modelId) {
    const model = this.models.find(m => m.id === modelId);
    if (!model) throw new Error(`模型 ${modelId} 不存在`);
    this.activeModelId = modelId;
    this._saveConfig();
    this.emit('modelChanged', model);
    return this.getActiveModel();
  }

  /**
   * 添加模型配置
   * @param {Object} config - 模型配置
   */
  addModel(config) {
    const id = config.id || `model-${Date.now()}`;
    const model = { ...config, id };
    this.models.push(model);
    this._saveConfig();
    return model;
  }

  /**
   * 删除模型配置
   * @param {string} modelId - 模型 ID
   */
  removeModel(modelId) {
    this.models = this.models.filter(m => m.id !== modelId);
    if (this.activeModelId === modelId) {
      this.activeModelId = this.models.length > 0 ? this.models[0].id : null;
    }
    this._saveConfig();
  }

  /**
   * 同步第三方本地模型 (Ollama & LM Studio)
   * @returns {Promise<number>} 同步成功的模型数量
   */
  async syncThirdPartyLocalModels() {
    let syncedCount = 0;
    
    // 1. 同步 Ollama (默认端口 11434)
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags');
      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        const models = data.models || [];
        for (const m of models) {
          const exists = this.models.some(localM => localM.id === m.name && localM.provider === 'Ollama');
          if (!exists) {
            this.models.push({
              id: m.name,
              name: `[Ollama] ${m.name}`,
              type: 'local',
              provider: 'Ollama',
              sizeGB: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) : 0,
            });
            syncedCount++;
          }
        }
      }
    } catch (e) {
      console.log('[模型管理器] Ollama 未运行或连接失败');
    }

    // 2. 同步 LM Studio (默认端口 1234)
    try {
      const lmRes = await fetch('http://127.0.0.1:1234/v1/models');
      if (lmRes.ok) {
        const data = await lmRes.json();
        const models = data.data || [];
        for (const m of models) {
          const exists = this.models.some(localM => localM.id === m.id && localM.provider === 'LM Studio');
          if (!exists) {
            this.models.push({
              id: m.id,
              name: `[LM Studio] ${m.id.split('/').pop()}`,
              type: 'cloud', // LM Studio 提供 OpenAI 兼容的 API
              provider: 'LM Studio',
              apiKey: 'lm-studio',
              baseUrl: 'http://127.0.0.1:1234/v1',
              modelName: m.id,
              maxTokens: 4096,
              temperature: 0.7
            });
            syncedCount++;
          }
        }
      }
    } catch (e) {
      console.log('[模型管理器] LM Studio 未运行或连接失败');
    }

    if (syncedCount > 0) {
      this._saveConfig();
    }
    return syncedCount;
  }

  /**
   * 统一聊天接口
   * @param {Array} messages - 消息列表 [{ role, content }]
   * @param {Object} options - 选项
   * @returns {Promise<string>} AI 回复
   */
  async chat(messages, options = {}) {
    const modelId = options.modelId || this.activeModelId;
    const model = this.models.find(m => m.id === modelId);
    if (!model) throw new Error('未选择模型或模型不存在');

    if (model.type === 'cloud') {
      return this._chatCloud(model, messages, options);
    } else if (model.type === 'local') {
      return this._chatLocal(model, messages, options);
    }
    throw new Error(`不支持的模型类型: ${model.type}`);
  }

  /**
   * 流式聊天接口
   * @param {Array} messages - 消息列表
   * @param {Object} options - 选项
   * @param {Function} onChunk - 收到数据块时的回调 (text) => void
   * @returns {Promise<string>} 完整的 AI 回复
   */
  async chatStream(messages, options = {}, onChunk) {
    const modelId = options.modelId || this.activeModelId;
    const model = this.models.find(m => m.id === modelId);
    if (!model) throw new Error('未选择模型或模型不存在');

    if (model.type === 'cloud') {
      return this._chatCloudStream(model, messages, options, onChunk);
    } else if (model.type === 'local') {
      return this._chatLocalStream(model, messages, options, onChunk);
    }
    throw new Error(`不支持的模型类型: ${model.type}`);
  }

  /**
   * 等待指定毫秒数
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 重试请求（处理 429 错误）
   * @private
   */
  async _retryRequest(makeRequest, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await makeRequest();
      if (response.ok) {
        return response;
      }
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        const delay = Math.min(retryAfter * 1000, Math.pow(2, attempt) * 1000 + Math.random() * 1000);
        console.log(`[模型管理器] 请求被限流，等待 ${delay}ms 后重试 (第 ${attempt} 次)`);
        await this._delay(delay);
        continue;
      }
      return response;
    }
    throw new Error('重试次数已用完');
  }

  /**
   * 判断是否为 Anthropic/Claude 提供者
   */
  _isAnthropicProvider(model) {
    return ANTHROPIC_PROVIDERS.includes(model.provider);
  }

  /**
   * 构建云端 API 请求配置
   * @private
   */
  _buildCloudRequestConfig(model, messages, options, stream = false) {
    const actualModelName = model.modelName || (model.name ? model.name.replace(/^\[.*?\]\s*/, '') : model.id);
    const isAnthropic = this._isAnthropicProvider(model);
    
    if (isAnthropic) {
      return {
        url: `${model.baseUrl}/messages`,
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': model.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: actualModelName,
          messages: messages,
          max_tokens: options.maxTokens || model.maxTokens || 4096,
          temperature: options.temperature ?? model.temperature ?? 0.7,
          stream,
        }),
      };
    }
    
    return {
      url: `${model.baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: actualModelName,
        messages,
        max_tokens: options.maxTokens || model.maxTokens || 4096,
        temperature: options.temperature ?? model.temperature ?? 0.7,
        stream,
      }),
    };
  }

  /**
   * 解析云端 API 响应
   * @private
   */
  _parseCloudResponse(data, model) {
    const isAnthropic = this._isAnthropicProvider(model);
    if (isAnthropic) {
      return data.content?.[0]?.text || '';
    }
    return data.choices?.[0]?.message?.content || '';
  }

  /**
   * 云端 API 聊天（非流式）
   * @private
   */
  async _chatCloud(model, messages, options) {
    if (!model.apiKey) throw new Error('请先配置 API Key');
    
    const { url, headers, body } = this._buildCloudRequestConfig(model, messages, options, false);
    
    const makeRequest = () => fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const response = await this._retryRequest(makeRequest);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return this._parseCloudResponse(data, model);
  }

  /**
   * 云端 API 流式聊天
   * @private
   */
  async _chatCloudStream(model, messages, options, onChunk) {
    if (!model.apiKey) throw new Error('请先配置 API Key');
    
    const { url, headers, body } = this._buildCloudRequestConfig(model, messages, options, true);
    const isAnthropic = this._isAnthropicProvider(model);
    
    const makeRequest = () => fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: options.signal
    });

    const response = await this._retryRequest(makeRequest);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        buffer += textChunk;
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            
            let content;
            if (isAnthropic) {
              content = data.delta?.text;
            } else {
              content = data.choices?.[0]?.delta?.content;
            }
            
            if (content) {
              fullContent += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[Cloud Stream Error]', err);
      throw err;
    }

    return fullContent;
  }

  /**
   * 本地模型聊天（通过 Ollama 龙虾）
   * @private
   */
  async _chatLocal(model, messages, options) {
    const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
    const actualModelName = model.modelName || (model.name ? model.name.replace(/^\[.*?\]\s*/, '') : model.id);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: actualModelName,
        messages: messages,
        stream: false,
        options: {
          num_ctx: options.maxTokens || model.contextSize || 4096,
          temperature: options.temperature ?? model.temperature ?? 0.7,
        }
      })
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama 接口调用失败: ${err}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }

  /**
   * 本地模型流式聊天（通过 Ollama 龙虾）
   * @private
   */
  async _chatLocalStream(model, messages, options, onChunk) {
    const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
    const actualModelName = model.modelName || (model.name ? model.name.replace(/^\[.*?\]\s*/, '') : model.id);
    console.log('[DEBUG] FOUND MODEL:', JSON.stringify(model));
    console.log('[DEBUG] Sending to Ollama model:', actualModelName, 'Original name:', model.name, 'modelName:', model.modelName);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 120000); // 2分钟超时，防止 Ollama 卡死
    
    // 如果上游传来 signal，可以将它们结合（简易实现：上游 abort 时也 abort 本地）
    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        clearTimeout(timeoutId);
        abortController.abort();
      });
    }

    const ollamaMessages = messages.map(m => {
      if (Array.isArray(m.content)) {
        const textBlock = m.content.find(c => c.type === 'text');
        const imgBlock = m.content.find(c => c.type === 'image_url');
        
        const ollamaMsg = { role: m.role, content: textBlock ? textBlock.text : '' };
        if (imgBlock && imgBlock.image_url) {
           // Ollama expects base64 data without the 'data:image/...;base64,' prefix
           const base64Data = imgBlock.image_url.url.split(',')[1];
           if (base64Data) {
             ollamaMsg.images = [base64Data];
           }
        }
        return ollamaMsg;
      }
      return m;
    });

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: actualModelName,
        messages: ollamaMessages,
        stream: true,
        options: {
          num_ctx: options.maxTokens || model.contextSize || 4096,
          temperature: options.temperature ?? model.temperature ?? 0.7,
        }
      }),
      signal: abortController.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Ollama 接口调用失败: ${err}`);
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        buffer += textChunk;
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);

          const trimmed = line.trim();
          if (!trimmed) continue;
          
          try {
            const data = JSON.parse(trimmed);
            const content = data.message?.content;
            if (content) {
              fullContent += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[Local Stream Error]', err);
      throw err;
    }

    return fullContent;
  }
}

module.exports = { ModelManager };
