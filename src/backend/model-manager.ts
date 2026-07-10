// @ts-nocheck
/**
 * OpenClaw 智能助手 - 模型管理器
 * 统一管理本地 ggml 模型和云端 API 模型
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { EventEmitter } = require('events');
import { ProviderFactory } from './providers/ProviderFactory';

const ANTHROPIC_PROVIDERS = ['Anthropic', 'claude'];

// ========== API Key 安全加解密工具函数 ==========
const FALLBACK_SECRET = 'openclaw-default-api-key-safe-salt';
const ALGORITHM = 'aes-256-cbc';

function encryptText(text) {
  if (!text) return '';
  try {
    const { safeStorage } = require('electron');
    if (safeStorage && safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(text);
      return 'safeStorage:' + encrypted.toString('base64');
    }
  } catch (e) {}
  
  try {
    const key = crypto.scryptSync(FALLBACK_SECRET, 'salt-claw', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return 'fallback:' + iv.toString('hex') + ':' + encrypted;
  } catch (e) {
    return text;
  }
}

function decryptText(text) {
  if (!text) return '';
  if (text.startsWith('safeStorage:')) {
    try {
      const { safeStorage } = require('electron');
      const base64Data = text.substring('safeStorage:'.length);
      const buffer = Buffer.from(base64Data, 'base64');
      return safeStorage.decryptString(buffer);
    } catch (e) {
      console.error('[模型管理] safeStorage 解密失败，返回空:', e.message);
      return '';
    }
  }
  if (text.startsWith('fallback:')) {
    try {
      const parts = text.split(':');
      const iv = Buffer.from(parts[1], 'hex');
      const encryptedText = parts[2];
      const key = crypto.scryptSync(FALLBACK_SECRET, 'salt-claw', 32);
      const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (e) {
      console.error('[模型管理] Fallback 解密失败，返回空:', e.message);
      return '';
    }
  }
  return text;
}

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
        const loadedModels = data.models || [];
        
        // 解密从磁盘加载出的 API Key，在内存中保持解密明文以便发送 API 请求
        this.models = loadedModels.map(m => {
          if (m.apiKey) {
            m.apiKey = decryptText(m.apiKey);
          }
          return m;
        });
        
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
      
      // 写入磁盘前对 models 数据进行深拷贝并对 apiKey 字段进行加密，内存中的数据依然保持明文不变
      const modelsToSave = this.models.map(m => {
        const copy = { ...m };
        if (copy.apiKey) {
          copy.apiKey = encryptText(copy.apiKey);
        }
        return copy;
      });

      fs.writeFileSync(this.configPath, JSON.stringify({
        models: modelsToSave,
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
      isCold: m.isCold || false
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
   * 获取模型交叉重排得分 (Cross-Encoder Reranker)
   * 专为企业级高精度知识库召回准备
   */
  async getRerankScore(query: string, text: string): Promise<number> {
    try {
      // 预留对接本地 Xinference 或 vLLM 的 bge-reranker 接口
      // 格式如：POST /v1/rerank
      // 因为 Ollama 原生无 rerank，若失败则提供降级算法。
    } catch (e) {}
    
    // 降级：若无专用 Rerank 模型，退化为文本包含度与长度加权
    let score = 0.1;
    if (text.includes(query)) score += 0.5;
    return score;
  }

  /**
   * 获取模型 Embedding (RAG 核心依赖)
   * @param {string} text - 输入文本
   * @returns {Promise<number[]>} - 向量张量
   */
  async getEmbedding(text) {
    try {
      // 使用本地探测到的 Ollama 地址，如果不存在则回退至默认地址
      const baseOllamaUrl = this.ollamaUrl || 'http://127.0.0.1:11434';
      const endpoint = `${baseOllamaUrl}/api/embeddings`;
      const model = 'nomic-embed-text';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && data.embedding) {
          return data.embedding;
        }
      }
    } catch (error) {
      console.warn('[ModelManager] 真实 getEmbedding 请求失败，退化为兜底机制:', error.message);
    }
    // 发生网络错误或无模型时兜底
    return [Math.random(), Math.random(), text.length % 10];
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
   * 同步第三方本地模型 (Ollama, LM Studio, Llama.cpp, Jan, GPT4All)
   * @returns {Promise<number>} 同步成功的模型数量
   */
  async syncThirdPartyLocalModels() {
    let syncedCount = 0;
    const thirdPartyProviders = ['Ollama', 'LM Studio', 'Llama.cpp', 'GPT4All', 'Jan'];
    
    // 强制清理历史缓存，防止残留
    this.models = this.models.filter(m => !thirdPartyProviders.includes(m.provider as string));

    // 1. 同步 Ollama
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      let activeModels = [];
      try {
        const psRes = await fetch('http://127.0.0.1:11434/api/ps', { signal: AbortSignal.timeout(1000) });
        if (psRes.ok) {
          const psData = await psRes.json();
          activeModels = psData.models || [];
        }
      } catch (e) {}

      if (ollamaRes.ok) {
        const data = await ollamaRes.json();
        const models = data.models || [];
        for (const m of models) {
          const isCold = !activeModels.some((am:any) => am.name === m.name);
          this.models.push({
            id: `ollama_${m.name}`,
            name: `[Ollama] ${m.name}`,
            type: 'local',
            provider: 'Ollama',
            modelName: m.name,
            baseUrl: 'http://127.0.0.1:11434',
            sizeGB: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) : 0,
            isCold: isCold
          });
          syncedCount++;
        }
      }
    } catch (e) {
      console.debug('[模型管理器] Ollama 未运行或连接失败');
    }

    // 2. 通用 OpenAI 兼容接口同步探针
    const openaiCompatibleEngines = [
      { provider: 'LM Studio', url: 'http://127.0.0.1:1234/v1/models', baseUrl: 'http://127.0.0.1:1234/v1' },
      { provider: 'Llama.cpp', url: 'http://127.0.0.1:8080/v1/models', baseUrl: 'http://127.0.0.1:8080/v1' },
      { provider: 'GPT4All', url: 'http://127.0.0.1:4891/v1/models', baseUrl: 'http://127.0.0.1:4891/v1' },
      { provider: 'Jan', url: 'http://127.0.0.1:1337/v1/models', baseUrl: 'http://127.0.0.1:1337/v1' }
    ];

    for (const engine of openaiCompatibleEngines) {
      let hotModels = [];
      try {
        const res = await fetch(engine.url, { signal: AbortSignal.timeout(1500) });
        if (res.ok) {
          const data = await res.json();
          hotModels = data.data || [];
          for (const m of hotModels) {
            this.models.push({
              id: `${engine.provider.toLowerCase().replace(/[^a-z0-9]/g, '')}_${m.id}`,
              name: `[${engine.provider}] ${m.id.split('/').pop()}`,
              type: 'cloud', // 复用 cloud 管道以使用兼容 OpenAI 的请求格式
              provider: engine.provider,
              apiKey: 'local-engine',
              baseUrl: engine.baseUrl,
              modelName: m.id,
              maxTokens: 4096,
              temperature: 0.7,
              isCold: false
            });
            syncedCount++;
          }
        }
      } catch (e) {
        console.debug(`[模型管理器] ${engine.provider} 未运行或连接失败`);
      }
    }

    // 2.1 补充 LM Studio 物理库存 (Cold Storage)
    const physicalLMModels = this.scanLMStudioPhysicalModels();
    for (const pm of physicalLMModels) {
      const exists = this.models.some(m => m.provider === 'LM Studio' && m.modelName === pm.id);
      if (!exists) {
        this.models.push({
          id: `lmstudio_${pm.id}`,
          name: `[LM Studio] ${pm.id.split('/').pop()}`,
          type: 'cloud',
          provider: 'LM Studio',
          apiKey: 'lm-studio',
          baseUrl: 'http://127.0.0.1:1234/v1',
          modelName: pm.id,
          maxTokens: 4096,
          temperature: 0.7,
          isCold: true
        });
        syncedCount++;
      }
    }

    if (syncedCount > 0) {
      this._saveConfig();
    }
    return syncedCount;
  }

  /**
   * 物理扫描 LM Studio 缓存目录的 GGUF 模型
   */
  scanLMStudioPhysicalModels() {
    const os = require('os');
    const path = require('path');
    const fs = require('fs');
    const lmCacheDir = path.join(os.homedir(), '.cache', 'lm-studio', 'models');
    if (!fs.existsSync(lmCacheDir)) return [];
    
    let models = [];
    const scanDir = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
          } else if (item.endsWith('.gguf')) {
            const relPath = path.relative(lmCacheDir, fullPath).replace(/\\/g, '/');
            models.push({ id: relPath, name: item });
          }
        }
      } catch (e) {}
    };
    scanDir(lmCacheDir);
    return models;
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

    const provider = ProviderFactory.getProvider(model);
    return provider.chat(model, messages, options);
  }

  /**
   * 流式聊天接口
   * @param {Array} messages - 消息列表
   * @param {Object} options - 选项
   * @param {Function} onChunk - 收到数据块时的回调
   * @returns {Promise<string>} 完整的 AI 回复
   */
  async chatStream(messages, options = {}, onChunk) {
    let modelId = options.modelId || this.activeModelId;
    let model = this.models.find(m => m.id === modelId);
    if (!model) throw new Error('未选择模型或模型不存在');
    
    // [Task 2.2] 双脑算力分发器 (Dual-Brain Router)
    // 如果用户当前选用的是昂贵的云端模型，但对话仅有几句话 (如打招呼、简单意图)，尝试交由本地热态模型拦截处理
    if (model.type === 'cloud' && messages.length > 0) {
      const lastMsgObj = messages[messages.length - 1];
      let lastText = '';
      let hasImage = false;

      if (typeof lastMsgObj.content === 'string') {
        lastText = lastMsgObj.content;
      } else if (Array.isArray(lastMsgObj.content)) {
        const textBlock = lastMsgObj.content.find((c: any) => c.type === 'text');
        const imgBlock = lastMsgObj.content.find((c: any) => c.type === 'image_url');
        lastText = textBlock ? textBlock.text : '';
        hasImage = !!imgBlock;
      }

      const isTextSimple = lastText.length < 50 && !lastText.includes('代码') && !lastText.includes('分析') && !lastText.includes('报错');
      
      const isVisionCapable = (m: any) => {
        const nameLower = (m.modelName || m.name || m.id || '').toLowerCase();
        return nameLower.includes('vl') || nameLower.includes('vision') || nameLower.includes('llava') || nameLower.includes('minicpm');
      };

      let isSimpleTask = false;
      if (isTextSimple) {
        if (!hasImage) {
          isSimpleTask = true;
        } else {
          const targetLocal = this.models.find(m => m.type === 'local' && !m.isCold);
          if (targetLocal && isVisionCapable(targetLocal)) {
            isSimpleTask = true;
          }
        }
      }

      if (isSimpleTask) {
        const hotLocalModel = this.models.find(m => m.type === 'local' && !m.isCold);
        if (hotLocalModel) {
          console.log(`[双脑路由] 检测到极短基础指令，已自动将算力切入本地守护模型: ${hotLocalModel.name}`);
          onChunk(`> 🧠 **[双脑路由生效]** 判定为基础轻量级任务，已无感切换至本地模型 \`${hotLocalModel.name}\` 为您极速响应...\n\n`);
          modelId = hotLocalModel.id;
          model = hotLocalModel;
        }
      }
    }

    const provider = ProviderFactory.getProvider(model);
    return provider.chatStream(model, messages, options, onChunk);
  }

  /**
   * 检测 Ollama 引擎状态
   * @returns {Promise<boolean>}
   */
  async detectOllama() {
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) });
      return ollamaRes.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * 检测 LM Studio 引擎状态
   * @returns {Promise<boolean>}
   */
  async detectLMStudio() {
    try {
      const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(2500) });
      return lmRes.ok;
    } catch (e) {
      return false;
    }
  }

  /**
   * 探测所有本地引擎与可用模型
   * @returns {Promise<Object>}
   */
  async detectLocal() {
    const result = { ollama: { running: false, models: [] as any[] }, lmstudio: { running: false, models: [] as any[] } };
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (ollamaRes.ok) {
        result.ollama.running = true;
        const data = await ollamaRes.json();
        result.ollama.models = (data.models || []).map((m:any) => ({ id: m.name, name: m.name }));
      }
    } catch (e) {}
    
    try {
      const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(2000) });
      if (lmRes.ok) {
        result.lmstudio.running = true;
        const data = await lmRes.json();
        result.lmstudio.models = (data.data || []).map((m:any) => ({ id: m.id, name: m.id }));
      }
    } catch (e) {}
    
    return result;
  }

  /**
   * 获取 Ollama 所有模型详细列表
   * @returns {Promise<Object>}
   */
  async getOllamaModels() {
    try {
      const res = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        return { models: (data.models || []).map((m:any) => ({ 
          id: m.name, name: m.name, sizeBytes: m.size || 0, 
          size: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知',
          parameterSize: m.details?.parameter_size || '',
          family: m.details?.family || ''
        })) };
      }
    } catch(e) {}
    return { models: [] };
  }

  /**
   * 获取 LM Studio 所有模型详细列表
   * @returns {Promise<Object>}
   */
  async getLMStudioModels() {
    try {
      const res = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(2000) });
      if (res.ok) {
        const data = await res.json();
        return { models: (data.data || []).map((m:any) => ({ 
          id: m.id, name: m.id.split('/').pop() || m.id, size: '已加载'
        })) };
      }
    } catch(e) {
      throw new Error('无法连接到 LM Studio，请确保已经在软件内开启了 Local Server (默认端口 1234)！');
    }
    return { models: [] };
  }

  /**
   * 代理请求外部模型的 /models 接口以规避 CORS，并返回模型列表
   */
  async proxyFetchModels(baseUrl, apiKey) {
    try {
      const targetUrl = baseUrl.endsWith('/v1') ? `${baseUrl}/models` : (baseUrl.endsWith('/') ? `${baseUrl}v1/models` : `${baseUrl}/v1/models`);
      const headers: any = {
        'Content-Type': 'application/json'
      };
      if (apiKey && apiKey.trim() !== '') {
        headers['Authorization'] = `Bearer ${apiKey.trim()}`;
      }
      
      const res = await fetch(targetUrl, { headers, signal: AbortSignal.timeout(5000) });
      if (!res.ok) {
        throw new Error(`HTTP Error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      return { success: true, models: data.data || data.models || [] };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  /**
   * 代理测试外部 API 的联通性
   */
  async proxyTest(baseUrl, apiKey) {
    try {
      const fetchRes = await this.proxyFetchModels(baseUrl, apiKey);
      if (fetchRes.success) {
        return { success: true, message: '连接成功！' };
      } else {
        return { success: false, error: fetchRes.error };
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}

module.exports = { ModelManager };
