"use strict";
// @ts-nocheck
/**
 * OpenClaw 智能助手 - 模型管理器
 * 统一管理本地 ggml 模型和云端 API 模型
 */
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const ANTHROPIC_PROVIDERS = ['Anthropic', 'claude'];
// ========== API Key 安全加解密工具函数 ==========
const FALLBACK_SECRET = 'openclaw-default-api-key-safe-salt';
const ALGORITHM = 'aes-256-cbc';
function encryptText(text) {
    if (!text)
        return '';
    try {
        const { safeStorage } = require('electron');
        if (safeStorage && safeStorage.isEncryptionAvailable()) {
            const encrypted = safeStorage.encryptString(text);
            return 'safeStorage:' + encrypted.toString('base64');
        }
    }
    catch (e) { }
    try {
        const key = crypto.scryptSync(FALLBACK_SECRET, 'salt-claw', 32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        return 'fallback:' + iv.toString('hex') + ':' + encrypted;
    }
    catch (e) {
        return text;
    }
}
function decryptText(text) {
    if (!text)
        return '';
    if (text.startsWith('safeStorage:')) {
        try {
            const { safeStorage } = require('electron');
            const base64Data = text.substring('safeStorage:'.length);
            const buffer = Buffer.from(base64Data, 'base64');
            return safeStorage.decryptString(buffer);
        }
        catch (e) {
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
        }
        catch (e) {
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
            }
            else {
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
        }
        catch (error) {
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
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
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
        }
        catch (error) {
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
        if (!model)
            return null;
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
        if (!model)
            throw new Error(`模型 ${modelId} 不存在`);
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
        this.models = this.models.filter(m => !thirdPartyProviders.includes(m.provider));
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
            }
            catch (e) { }
            if (ollamaRes.ok) {
                const data = await ollamaRes.json();
                const models = data.models || [];
                for (const m of models) {
                    const isCold = !activeModels.some((am) => am.name === m.name);
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
        }
        catch (e) {
            console.log('[模型管理器] Ollama 未运行或连接失败');
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
            }
            catch (e) {
                console.log(`[模型管理器] ${engine.provider} 未运行或连接失败`);
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
        if (!fs.existsSync(lmCacheDir))
            return [];
        let models = [];
        const scanDir = (dir) => {
            try {
                const items = fs.readdirSync(dir);
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    if (fs.statSync(fullPath).isDirectory()) {
                        scanDir(fullPath);
                    }
                    else if (item.endsWith('.gguf')) {
                        const relPath = path.relative(lmCacheDir, fullPath).replace(/\\/g, '/');
                        models.push({ id: relPath, name: item });
                    }
                }
            }
            catch (e) { }
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
        if (!model)
            throw new Error('未选择模型或模型不存在');
        if (model.type === 'cloud' || model.provider === 'LM Studio') {
            return this._chatCloud(model, messages, options);
        }
        else if (model.type === 'local') {
            return this._chatLocal(model, messages, options);
        }
        throw new Error(`不支持的模型类型: ${model.type}`);
    }
    /**
     * 流式聊天接口 (含 Agent Tool Calling 拦截引擎)
     * @param {Array} messages - 消息列表
     * @param {Object} options - 选项，支持 options.agentMode 开启代理执行
     * @param {Function} onChunk - 收到数据块时的回调
     * @returns {Promise<string>} 完整的 AI 回复
     */
    async chatStream(messages, options = {}, onChunk) {
        const modelId = options.modelId || this.activeModelId;
        const model = this.models.find(m => m.id === modelId);
        if (!model)
            throw new Error('未选择模型或模型不存在');
        let currentMessages = [...messages];
        const isAgentMode = options.agentMode === true;
        const maxAgentLoops = 5;
        let loopCount = 0;
        let finalMergedResponse = '';
        if (isAgentMode) {
            const agentSystemPrompt = `You are an Autonomous AI Agent. You have access to system tools. If the user asks you to read files or requires system operations, you MUST use tools by outputting a raw JSON block exactly in this format and STOP generating further text:
\`\`\`json
{
  "tool": "Fs.readFile",
  "args": { "path": "absolute_file_path" }
}
\`\`\`
Supported tools: Fs.readFile.
If no tool is needed, answer the user directly.`;
            if (currentMessages.length > 0 && currentMessages[0].role === 'system') {
                currentMessages[0] = { role: 'system', content: agentSystemPrompt + '\n' + currentMessages[0].content };
            }
            else {
                currentMessages.unshift({ role: 'system', content: agentSystemPrompt });
            }
        }
        while (loopCount < maxAgentLoops) {
            loopCount++;
            let fullResponse = '';
            let jsonInterceptBuffer = '';
            let isIntercepting = false;
            const internalOnChunk = (chunk) => {
                if (!isAgentMode) {
                    onChunk(chunk);
                    return;
                }
                jsonInterceptBuffer += chunk;
                if (jsonInterceptBuffer.includes('```json') || jsonInterceptBuffer.includes('{"tool"')) {
                    isIntercepting = true;
                }
                else {
                    if (jsonInterceptBuffer.length > 30 && !isIntercepting) {
                        onChunk(jsonInterceptBuffer);
                        jsonInterceptBuffer = '';
                    }
                }
            };
            try {
                if (model.type === 'cloud' || model.provider === 'LM Studio') {
                    fullResponse = await this._chatCloudStream(model, currentMessages, options, internalOnChunk);
                }
                else if (model.type === 'local') {
                    fullResponse = await this._chatLocalStream(model, currentMessages, options, internalOnChunk);
                }
                else {
                    throw new Error(`不支持的模型类型: ${model.type}`);
                }
            }
            catch (err) {
                if (err.name === 'AbortError' || err.message === 'AbortError') {
                    throw err; // 如果是被主动打断的，直接向上抛出结束
                }
                throw err;
            }
            if (isAgentMode && !isIntercepting && jsonInterceptBuffer.length > 0) {
                onChunk(jsonInterceptBuffer);
            }
            if (!isAgentMode) {
                return fullResponse;
            }
            // 正则匹配并提取 JSON
            const toolMatch = fullResponse.match(/```json\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/);
            const rawJsonMatch = fullResponse.match(/(\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*\})/);
            let toolPayload = null;
            if (toolMatch) {
                try {
                    toolPayload = JSON.parse(toolMatch[1]);
                }
                catch (e) { }
            }
            else if (rawJsonMatch) {
                try {
                    toolPayload = JSON.parse(rawJsonMatch[1]);
                }
                catch (e) { }
            }
            if (toolPayload && toolPayload.tool) {
                onChunk(`\n\n> ⚡ **[Agent 工具调用]** 正在执行: \`${toolPayload.tool}\` ...\n`);
                let toolResultStr = '';
                try {
                    if (toolPayload.tool === 'Fs.readFile' && toolPayload.args?.path) {
                        const fs = require('fs');
                        if (fs.existsSync(toolPayload.args.path)) {
                            const fileContent = fs.readFileSync(toolPayload.args.path, 'utf8');
                            toolResultStr = `File Content:\n${fileContent.substring(0, 3000)}`;
                            onChunk(`> 🟢 **[执行成功]** 读取了 ${toolPayload.args.path.split(/[\/\\]/).pop()} 的内容。\n\n`);
                        }
                        else {
                            toolResultStr = `Error: File not found at path: ${toolPayload.args.path}`;
                            onChunk(`> 🔴 **[执行失败]** 文件不存在。\n\n`);
                        }
                    }
                    else {
                        toolResultStr = `Tool ${toolPayload.tool} is not supported or missing arguments.`;
                        onChunk(`> 🔴 **[执行失败]** 未知工具。\n\n`);
                    }
                }
                catch (e) {
                    toolResultStr = `Error executing tool: ${e.message}`;
                    onChunk(`> 🔴 **[执行异常]** ${e.message}\n\n`);
                }
                currentMessages.push({ role: 'assistant', content: fullResponse });
                currentMessages.push({ role: 'system', content: `Tool execution result:\n${toolResultStr}` });
                finalMergedResponse += fullResponse + '\n';
                continue;
            }
            else {
                return finalMergedResponse + fullResponse;
            }
        }
        return finalMergedResponse + "\n\n> [系统警告] 已达到最大代理迭代次数 (5次)，强制终止循环。";
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
        if (!model.apiKey && model.provider !== 'LM Studio')
            throw new Error('请先配置 API Key');
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
        if (!model.apiKey && model.provider !== 'LM Studio')
            throw new Error('请先配置 API Key');
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
                if (done)
                    break;
                const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
                buffer += textChunk;
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);
                    const trimmed = line.trim();
                    if (!trimmed || !trimmed.startsWith('data: '))
                        continue;
                    const dataStr = trimmed.slice(6);
                    if (dataStr === '[DONE]')
                        continue;
                    try {
                        const data = JSON.parse(dataStr);
                        let content;
                        if (isAnthropic) {
                            content = data.delta?.text;
                        }
                        else {
                            content = data.choices?.[0]?.delta?.content;
                        }
                        if (content) {
                            fullContent += content;
                            if (onChunk)
                                onChunk(content);
                        }
                    }
                    catch (e) { }
                }
            }
        }
        catch (err) {
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
                if (done)
                    break;
                const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
                buffer += textChunk;
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const data = JSON.parse(trimmed);
                        const content = data.message?.content;
                        if (content) {
                            fullContent += content;
                            if (onChunk)
                                onChunk(content);
                        }
                    }
                    catch (e) { }
                }
            }
        }
        catch (err) {
            console.error('[Local Stream Error]', err);
            throw err;
        }
        return fullContent;
    }
    /**
     * 检测 Ollama 引擎状态
     * @returns {Promise<boolean>}
     */
    async detectOllama() {
        try {
            const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2500) });
            return ollamaRes.ok;
        }
        catch (e) {
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
        }
        catch (e) {
            return false;
        }
    }
    /**
     * 探测所有本地引擎与可用模型
     * @returns {Promise<Object>}
     */
    async detectLocal() {
        const result = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
        try {
            const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) });
            if (ollamaRes.ok) {
                result.ollama.running = true;
                const data = await ollamaRes.json();
                result.ollama.models = (data.models || []).map((m) => ({ id: m.name, name: m.name }));
            }
        }
        catch (e) { }
        try {
            const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(2000) });
            if (lmRes.ok) {
                result.lmstudio.running = true;
                const data = await lmRes.json();
                result.lmstudio.models = (data.data || []).map((m) => ({ id: m.id, name: m.id }));
            }
        }
        catch (e) { }
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
                return { models: (data.models || []).map((m) => ({
                        id: m.name, name: m.name, sizeBytes: m.size || 0,
                        size: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知',
                        parameterSize: m.details?.parameter_size || '',
                        family: m.details?.family || ''
                    })) };
            }
        }
        catch (e) { }
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
                return { models: (data.data || []).map((m) => ({
                        id: m.id, name: m.id.split('/').pop() || m.id, size: '已加载'
                    })) };
            }
        }
        catch (e) {
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
            const headers = {
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
        }
        catch (e) {
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
            }
            else {
                return { success: false, error: fetchRes.error };
            }
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
}
module.exports = { ModelManager };
