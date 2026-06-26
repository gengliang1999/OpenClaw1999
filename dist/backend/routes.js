"use strict";
// @ts-nocheck
const express = require('express');
const fs = require('fs');
const path = require('path');
const systemInfo = require('./system-info');
const { MODEL_MARKETPLACE } = require('./registry');
// ================== chat.ts ==================
const express = require('express');
module.exports.createChatRouter = function (dependencies) {
    const router = express.Router();
    const { memoryStore, modelManager, sandbox } = dependencies;
    /** 发送聊天消息（非流式） */
    router.post('/', async (req, res) => {
        try {
            const { conversationId, message, modelId, systemPrompt } = req.body;
            if (!message)
                return res.status(400).json({ message: '消息不能为空' });
            // 获取或创建对话
            let convId = conversationId;
            if (!convId) {
                const conv = memoryStore.createConversation('新对话');
                convId = conv.id;
            }
            // 保存用户消息
            memoryStore.saveMessage(convId, 'user', message);
            // 获取对话历史
            let history = memoryStore.getConversationHistory(convId);
            if (history.length > 20)
                history = history.slice(history.length - 20);
            let messages = history.map(m => ({ role: m.role, content: m.content }));
            if (systemPrompt) {
                messages.unshift({ role: 'system', content: systemPrompt });
            }
            // 调用模型
            const reply = await modelManager.chat(messages, { modelId });
            // 保存 AI 回复
            memoryStore.saveMessage(convId, 'assistant', reply);
            res.json({ conversationId: convId, reply });
        }
        catch (error) {
            console.error('[聊天] 错误:', error);
            res.status(500).json({ message: error.message });
        }
    });
    /** 流式聊天（SSE） */
    router.post('/stream', async (req, res) => {
        try {
            const { conversationId, message, attachment, modelId, systemPrompt, temperature } = req.body;
            console.log(`[API /api/chat/stream] Body:`, { conversationId, message: message ? '...text...' : null, attachment: attachment ? '...image...' : null, modelId, temperature });
            if (!message && !attachment)
                return res.status(400).json({ message: '消息不能为空' });
            // SSE 头部
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            let convId = conversationId;
            if (!convId) {
                const conv = memoryStore.createConversation('新对话');
                convId = conv.id;
                res.write(`data: ${JSON.stringify({ type: 'conversation', id: convId })}\n\n`);
            }
            const abortController = new AbortController();
            let finalContent = message;
            if (attachment) {
                finalContent = [
                    { type: 'text', text: message },
                    { type: 'image_url', image_url: { url: attachment } }
                ];
            }
            memoryStore.saveMessage(convId, 'user', finalContent);
            let history = memoryStore.getConversationHistory(convId);
            // [上下文压缩] 保留最后20条，避免爆显存
            if (history.length > 20)
                history = history.slice(history.length - 20);
            let messages = history.map((m, index) => {
                let content = m.content;
                try {
                    // Check if content is a JSON string of array (from SQLite)
                    if (typeof content === 'string' && content.startsWith('[')) {
                        content = JSON.parse(content);
                        // 历史记录中的图片不再发送给模型，防止文本模型崩溃并节省大量 Token
                        if (index < history.length - 1) {
                            const textBlock = content.find(c => c.type === 'text');
                            content = textBlock ? textBlock.text : '[历史图片]';
                        }
                    }
                }
                catch (e) { }
                return { role: m.role, content: content };
            });
            // RAG 记忆检索与注入
            const relevantMemories = memoryStore.searchMemory(message, 3);
            let augmentedSystemPrompt = systemPrompt || '你是一个有用的、无所不知的人工智能助手。';
            if (relevantMemories && relevantMemories.length > 0) {
                const memoryContext = relevantMemories.map(m => `- ${m.content}`).join('\n');
                augmentedSystemPrompt += `\n\n[用户相关的长期记忆（仅供参考）：]\n${memoryContext}`;
            }
            // Semantic Memory 能力注入
            const semanticMemoryPrompt = `\n\n[长期记忆能力]: 当你在对话中获取了关于用户的持久性事实、偏好或习惯时，请在回复的最后加上 \`[SAVE_MEMORY: 事实内容]\`，以便系统为你永久记住它。例如：\`[SAVE_MEMORY: 用户是一名后端开发工程师]\`。`;
            augmentedSystemPrompt += semanticMemoryPrompt;
            // Function Calling 能力注入
            const toolPrompt = `\n\n[系统能力]: 你拥有沙盒环境执行能力。如果用户要求运行脚本、查看本地环境、读取文件、操作目录等，请直接输出 <execute>具体的系统命令</execute> 。你会自动收到命令执行结果，并基于结果继续回答。请不要在执行前编造执行结果。`;
            augmentedSystemPrompt += toolPrompt;
            messages.unshift({ role: 'system', content: augmentedSystemPrompt });
            const chatRecursion = async (currentMessages, recursionCount = 0) => {
                let accumulatedReply = '';
                const fullReply = await modelManager.chatStream(currentMessages, { modelId, temperature, signal: abortController.signal }, (chunk) => {
                    accumulatedReply += chunk;
                    res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
                });
                const execMatch = accumulatedReply.match(/<execute>([\s\S]*?)<\/execute>/i);
                if (execMatch && recursionCount < 3) {
                    const cmd = execMatch[1].trim();
                    res.write(`data: ${JSON.stringify({ type: 'chunk', content: `\n\n> 🤖 [系统工具] 正在执行命令: \`${cmd}\` ...\n` })}\n\n`);
                    try {
                        const execResult = await sandbox.executeConfirmed(cmd, false, { timeout: 15000 });
                        let outputText = execResult.output || execResult.error || '执行成功，无终端输出';
                        if (outputText.length > 2000)
                            outputText = outputText.slice(0, 2000) + '\n... (内容过长已截断)';
                        res.write(`data: ${JSON.stringify({ type: 'chunk', content: `> ✅ 执行完成，继续响应中...\n\n` })}\n\n`);
                        currentMessages.push({ role: 'assistant', content: accumulatedReply });
                        currentMessages.push({ role: 'user', content: `[沙盒命令执行结果]:\n${outputText}\n请基于此结果继续回答。` });
                        return accumulatedReply + '\n\n' + await chatRecursion(currentMessages, recursionCount + 1);
                    }
                    catch (e) {
                        res.write(`data: ${JSON.stringify({ type: 'chunk', content: `> ❌ 执行失败，继续响应中...\n\n` })}\n\n`);
                        currentMessages.push({ role: 'assistant', content: accumulatedReply });
                        currentMessages.push({ role: 'user', content: `[沙盒执行失败]: ${e.message}\n请向用户说明情况，或尝试其他命令。` });
                        return accumulatedReply + '\n\n' + await chatRecursion(currentMessages, recursionCount + 1);
                    }
                }
                return accumulatedReply;
            };
            const finalReply = await chatRecursion(messages);
            // 解析 SAVE_MEMORY 并在后端存入数据库
            const memoryMatches = finalReply.match(/\[SAVE_MEMORY:([\s\S]*?)\]/g);
            if (memoryMatches) {
                memoryMatches.forEach(match => {
                    const fact = match.replace(/\[SAVE_MEMORY:/, '').replace(/\]$/, '').trim();
                    if (fact) {
                        memoryStore.addMemory(fact, 'User Preference', '["auto"]');
                        console.log('[自动提取语义记忆]', fact);
                    }
                });
            }
            // 将去除了标记的纯净回复存入历史，防止下次继续带入占用 token
            const cleanReply = finalReply.replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '').trim();
            memoryStore.saveMessage(convId, 'assistant', cleanReply);
            res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
            res.end();
        }
        catch (error) {
            if (error.name === 'AbortError') {
                console.error('[流式聊天] 客户端断开连接或发生 AbortError');
                res.end();
                return;
            }
            console.error('[流式聊天] 错误:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    });
    /** 获取对话列表 */
    router.get('/conversations', (req, res) => {
        try {
            const conversations = memoryStore.getConversations();
            res.json(conversations);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 创建新对话 */
    router.post('/conversations', (req, res) => {
        try {
            const { title } = req.body;
            const conv = memoryStore.createConversation(title || '新对话');
            res.json(conv);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 删除对话 */
    router.delete('/conversations/:id', (req, res) => {
        try {
            memoryStore.deleteConversation(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 获取聊天历史 */
    router.get('/history', (req, res) => {
        try {
            const { conversationId } = req.query;
            const history = memoryStore.getConversationHistory(conversationId);
            res.json(history);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 清空聊天历史 */
    router.delete('/history', (req, res) => {
        try {
            const { conversationId } = req.query;
            memoryStore.clearHistory(conversationId);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 删除单条消息 */
    router.delete('/message/:id', (req, res) => {
        try {
            memoryStore.deleteMessage(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 重命名对话 */
    router.put('/conversations/:id', (req, res) => {
        try {
            const { title } = req.body;
            if (!title)
                return res.status(400).json({ message: '标题不能为空' });
            memoryStore.renameConversation(req.params.id, title);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 导出对话 */
    router.get('/conversations/:id/export', (req, res) => {
        try {
            const data = memoryStore.exportConversation(req.params.id);
            if (!data)
                return res.status(404).json({ message: '对话不存在' });
            res.json(data);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 移入垃圾篓 */
    router.post('/conversations/:id/trash', (req, res) => {
        try {
            memoryStore.moveToTrash(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 获取垃圾篓列表 */
    router.get('/trash', (req, res) => {
        try {
            const trash = memoryStore.getTrash();
            res.json(trash);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 获取垃圾篓数量 */
    router.get('/trash/count', (req, res) => {
        try {
            const count = memoryStore.getTrashCount();
            res.json({ count });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 从垃圾篓恢复 */
    router.post('/trash/:id/restore', (req, res) => {
        try {
            memoryStore.restoreFromTrash(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 永久删除垃圾篓条目 */
    router.delete('/trash/:id', (req, res) => {
        try {
            memoryStore.permanentDelete(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 清空垃圾篓 */
    router.delete('/trash', (req, res) => {
        try {
            memoryStore.emptyTrash();
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 流式重写提示词 */
    router.post('/prompt-optimize', async (req, res) => {
        try {
            const { message, modelId } = req.body;
            if (!message)
                return res.status(400).json({ message: '消息不能为空' });
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            const systemPrompt = `你现在是全球顶尖的 Prompt 工程师。用户的原始需求可能非常简短或粗糙，你的任务是将其“扩写”为一段极其专业、详细、逻辑严密且具有专家级框架（如角色设定、任务目标、思维链要求、约束条件）的高级提示词。
规则：
1. 只输出最终优化好的提示词，绝不要在开头或结尾输出“好的，这是优化后的提示词”等任何废话。
2. 输出的内容必须直接是对 AI 说的话（即可以直接被用作发送给其他 AI 的指令）。
3. 提示词结构必须专业，推荐使用 Markdown（如 # 角色, # 任务, # 约束）。`;
            const messages = [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `请优化以下原始需求：\n${message}` }
            ];
            const abortController = new AbortController();
            await modelManager.chatStream(messages, { modelId, temperature: 0.5, signal: abortController.signal }, (chunk) => {
                res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
            });
            res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            res.end();
        }
        catch (error) {
            console.error('[流式提示词优化] 错误:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
            res.end();
        }
    });
    return router;
};
// ================== memory.ts ==================
const express = require('express');
module.exports.createMemoryRouter = function (dependencies) {
    const router = express.Router();
    const { memoryStore } = dependencies;
    /** 获取记忆列表 */
    router.get('/', (req, res) => {
        try {
            const { page, pageSize, category } = req.query;
            const result = memoryStore.getAllMemories(parseInt(page) || 1, parseInt(pageSize) || 20, category);
            res.json(result);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 添加记忆 */
    router.post('/', (req, res) => {
        try {
            const { content, category, tags } = req.body;
            if (!content)
                return res.status(400).json({ message: '内容不能为空' });
            const memory = memoryStore.addMemory(content, category, tags);
            res.json(memory);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 删除记忆 */
    router.delete('/:id', (req, res) => {
        try {
            memoryStore.deleteMemory(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 搜索记忆 */
    router.get('/search', (req, res) => {
        try {
            const { q, limit } = req.query;
            const results = memoryStore.searchMemory(q || '', parseInt(limit) || 10);
            res.json(results);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 导出记忆 */
    router.get('/export', (req, res) => {
        try {
            const data = memoryStore.exportData();
            res.json(data);
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 导入记忆 */
    router.post('/import', (req, res) => {
        try {
            memoryStore.importData(req.body);
            res.json({ success: true });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    return router;
};
// ================== models.ts ==================
const express = require('express');
const fs = require('fs');
const path = require('path');
const systemInfo = require('../system-info');
const { MODEL_MARKETPLACE } = require('../registry');
module.exports.createModelsRouter = function (dependencies) {
    const router = express.Router();
    const { modelManager, dataDir } = dependencies;
    /** 获取所有模型 */
    router.get('/', (req, res) => {
        res.json(modelManager.listModels());
    });
    /** 获取当前活跃模型 */
    router.get('/active', (req, res) => {
        res.json(modelManager.getActiveModel());
    });
    /** 设置活跃模型 */
    router.put('/active', (req, res) => {
        try {
            const result = modelManager.setActiveModel(req.body.modelId);
            res.json(result);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    });
    /** 添加模型 */
    router.post('/', (req, res) => {
        try {
            const model = modelManager.addModel(req.body);
            res.json(model);
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    });
    /** 删除模型 */
    router.delete('/:id', (req, res) => {
        try {
            modelManager.removeModel(req.params.id);
            res.json({ success: true });
        }
        catch (error) {
            res.status(400).json({ message: error.message });
        }
    });
    /** 获取旗舰级本地模型市场列表（附带硬件评估） */
    router.get('/marketplace', async (req, res) => {
        try {
            const hwInfo = await systemInfo.getHardwareInfo();
            const marketData = MODEL_MARKETPLACE;
            // 递归评估所有版本的硬件兼容性
            const evaluatedData = marketData.map(provider => ({
                ...provider,
                series: provider.series.map(series => ({
                    ...series,
                    versions: series.versions.map(version => {
                        const compatibility = systemInfo.evaluateCompatibility(version.paramsBillion);
                        return {
                            ...version,
                            compatibility
                        };
                    })
                }))
            }));
            res.json({
                hardware: hwInfo,
                models: evaluatedData
            });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 同步第三方本地模型 (Ollama / LM Studio) */
    router.post('/sync', async (req, res) => {
        try {
            const count = await modelManager.syncThirdPartyLocalModels();
            res.json({ success: true, count });
        }
        catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    });
    /** 检测本地运行时状态（Ollama / LM Studio） */
    router.get('/local-detect', async (req, res) => {
        const result = { ollama: { running: false, models: [] }, lmstudio: { running: false, models: [] } };
        // 检测 Ollama
        try {
            const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(3000) });
            if (ollamaRes.ok) {
                result.ollama.running = true;
                const data = await ollamaRes.json();
                result.ollama.models = (data.models || []).map(m => ({
                    id: m.name,
                    name: m.name,
                    size: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知',
                    sizeBytes: m.size || 0,
                    modified: m.modified_at || '',
                    details: m.details || {},
                }));
            }
        }
        catch (e) { /* Ollama 未运行 */ }
        // 检测 LM Studio
        try {
            const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(3000) });
            if (lmRes.ok) {
                result.lmstudio.running = true;
                const data = await lmRes.json();
                result.lmstudio.models = (data.data || []).map(m => ({
                    id: m.id,
                    name: m.id.split('/').pop() || m.id,
                    size: '已加载',
                }));
            }
        }
        catch (e) { /* LM Studio 未运行 */ }
        res.json(result);
    });
    /** 获取 Ollama 已安装模型列表（详细） */
    router.get('/ollama/list', async (req, res) => {
        try {
            const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
            if (!ollamaRes.ok)
                throw new Error('Ollama 连接失败');
            const data = await ollamaRes.json();
            const models = (data.models || []).map(m => ({
                id: m.name,
                name: m.name,
                size: m.size ? (m.size / 1024 / 1024 / 1024).toFixed(1) + ' GB' : '未知',
                sizeBytes: m.size || 0,
                modified: m.modified_at || '',
                family: m.details?.family || '',
                format: m.details?.format || '',
                parameterSize: m.details?.parameter_size || '',
            }));
            res.json({ success: true, models });
        }
        catch (error) {
            res.status(503).json({ success: false, message: 'Ollama 未运行: ' + error.message });
        }
    });
    /** 获取 LM Studio 已加载模型列表 */
    router.get('/lmstudio/list', async (req, res) => {
        try {
            const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(5000) });
            if (!lmRes.ok)
                throw new Error('LM Studio 连接失败');
            const data = await lmRes.json();
            const models = (data.data || []).map(m => ({
                id: m.id,
                name: m.id.split('/').pop() || m.id,
                fullName: m.id,
                owned_by: m.owned_by || '',
            }));
            res.json({ success: true, models });
        }
        catch (error) {
            res.status(503).json({ success: false, message: 'LM Studio 未运行: ' + error.message });
        }
    });
    /** 添加本地模型到已配置列表并可选设为默认 */
    router.post('/local/add', async (req, res) => {
        try {
            const { provider, modelId, modelName, setDefault } = req.body;
            if (!modelId)
                return res.status(400).json({ message: 'modelId 不能为空' });
            const id = provider === 'ollama' ? modelId : `lmstudio_${modelId}`;
            const exists = modelManager.models.find(m => m.id === id);
            if (!exists) {
                const modelConfig = provider === 'ollama'
                    ? { id, name: `[Ollama] ${modelName || modelId}`, type: 'local', provider: 'Ollama', sizeGB: 0 }
                    : { id, name: `[LM Studio] ${modelName || modelId}`, type: 'cloud', provider: 'LM Studio', apiKey: 'lm-studio', baseUrl: 'http://127.0.0.1:1234/v1', modelName: modelId, maxTokens: 4096, temperature: 0.7 };
                modelManager.addModel(modelConfig);
            }
            if (setDefault) {
                modelManager.setActiveModel(id);
            }
            res.json({ success: true, model: modelManager.models.find(m => m.id === id) });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 代理请求外部 API 的 /models 端点（解决 CORS） */
    router.post('/proxy-fetch', async (req, res) => {
        try {
            const { baseUrl, apiKey } = req.body;
            if (!baseUrl)
                return res.status(400).json({ message: 'baseUrl 不能为空' });
            const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models';
            const headers = { 'Accept': 'application/json' };
            if (apiKey)
                headers['Authorization'] = `Bearer ${apiKey}`;
            const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) });
            if (!resp.ok)
                return res.status(resp.status).json({ message: `上游返回 HTTP ${resp.status}` });
            const data = await resp.json();
            res.json(data);
        }
        catch (error) {
            res.status(502).json({ message: `请求失败: ${error.message}` });
        }
    });
    /** 代理连通测试 */
    router.post('/proxy-test', async (req, res) => {
        try {
            const { baseUrl, apiKey } = req.body;
            if (!baseUrl)
                return res.status(400).json({ message: 'baseUrl 不能为空' });
            const modelsUrl = baseUrl.replace(/\/+$/, '') + '/models';
            const headers = { 'Accept': 'application/json' };
            if (apiKey)
                headers['Authorization'] = `Bearer ${apiKey}`;
            const resp = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(10000) });
            if (!resp.ok)
                return res.json({ ok: false, status: resp.status, message: `HTTP ${resp.status}` });
            const data = await resp.json();
            const count = Array.isArray(data.data) ? data.data.length : Array.isArray(data.models) ? data.models.length : 0;
            res.json({ ok: true, count, message: `连接成功，共 ${count} 个模型` });
        }
        catch (error) {
            res.json({ ok: false, message: `连接失败: ${error.message}` });
        }
    });
    /** 删除本地模型（Ollama） */
    router.delete('/local/:provider/:modelId', async (req, res) => {
        try {
            const { provider, modelId } = req.params;
            if (provider === 'ollama') {
                const resp = await fetch('http://127.0.0.1:11434/api/delete', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: modelId })
                });
                if (!resp.ok && resp.status !== 200) {
                    // Ollama 有些版本返回 200 无 body
                    const text = await resp.text().catch(() => '');
                    if (text)
                        return res.status(resp.status).json({ message: text });
                }
                // 同时从已配置列表移除
                modelManager.removeModel(modelId).catch(() => { });
                res.json({ success: true });
            }
            else {
                // LM Studio 没有标准删除 API，只从配置移除
                modelManager.removeModel(`lmstudio_${modelId}`).catch(() => { });
                res.json({ success: true });
            }
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 预加载模型到显存 */
    router.post('/preload', async (req, res) => {
        try {
            const { modelId } = req.body;
            const model = modelManager.models.find(m => m.id === modelId);
            if (!model)
                return res.status(404).json({ message: '模型不存在' });
            if (model.provider === 'Ollama') {
                const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
                const modelName = model.modelName || model.name.replace(/^\[.*?\]\s*/, '');
                // 发送一个空请求让 Ollama 将模型加载进显存
                fetch(`${baseUrl}/api/generate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ model: modelName })
                }).catch(e => console.log('Ollama preload skip:', e.message));
                return res.json({ success: true, message: '已发送预加载请求' });
            }
            res.json({ success: true, message: '该模型无需或不支持预加载' });
        }
        catch (error) {
            res.status(500).json({ message: error.message });
        }
    });
    /** 触发 Ollama 自动拉取模型或国内源拉取 */
    router.post('/pull', async (req, res) => {
        try {
            const { modelName, ggufUrl } = req.body;
            if (!modelName)
                return res.status(400).json({ message: 'Missing modelName' });
            // 发送一个异步任务给本地 ollama 服务，流式返回进度
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            if (!ggufUrl) {
                // Fallback: 官方源拉取
                const ollamaRes = await fetch('http://127.0.0.1:11434/api/pull', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: modelName })
                });
                if (!ollamaRes.ok) {
                    res.write(`data: ${JSON.stringify({ error: 'Ollama pull failed' })}\n\n`);
                    return res.end();
                }
                const decoder = new TextDecoder();
                try {
                    for await (const chunk of ollamaRes.body) {
                        const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
                        const lines = textChunk.split('\n').filter(Boolean);
                        for (const line of lines) {
                            try {
                                const data = JSON.parse(line);
                                res.write(`data: ${JSON.stringify(data)}\n\n`);
                            }
                            catch (e) { }
                        }
                    }
                    res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
                }
                catch (err) {
                    res.write(`data: ${JSON.stringify({ error: 'Stream error: ' + err.message })}\n\n`);
                }
                return res.end();
            }
            // 国内镜像源拉取
            try {
                const tempDir = path.join(dataDir, 'temp_downloads');
                if (!fs.existsSync(tempDir))
                    fs.mkdirSync(tempDir, { recursive: true });
                const filePath = path.join(tempDir, `${modelName.replace(/:/g, '_')}.gguf`);
                res.write(`data: ${JSON.stringify({ status: 'connecting', detail: '连接到国内镜像源...' })}\n\n`);
                const response = await fetch(ggufUrl);
                if (!response.ok)
                    throw new Error('镜像源连接失败');
                const totalBytes = parseInt(response.headers.get('content-length'), 10) || 0;
                let downloadedBytes = 0;
                const dest = fs.createWriteStream(filePath);
                let lastReportTime = Date.now();
                let lastReportBytes = 0;
                // 使用 ReadableStream 异步迭代
                for await (const chunk of response.body) {
                    dest.write(chunk);
                    downloadedBytes += chunk.length;
                    const now = Date.now();
                    if (now - lastReportTime > 500) {
                        const speed = (downloadedBytes - lastReportBytes) / ((now - lastReportTime) / 1000); // Bytes per sec
                        const speedMB = (speed / 1024 / 1024).toFixed(2);
                        res.write(`data: ${JSON.stringify({
                            status: 'downloading',
                            detail: `正在极速下载 GGUF (国内节点) ... ${speedMB} MB/s`,
                            completed: downloadedBytes,
                            total: totalBytes
                        })}\n\n`);
                        lastReportTime = now;
                        lastReportBytes = downloadedBytes;
                    }
                }
                dest.end();
                res.write(`data: ${JSON.stringify({ status: 'creating', detail: '下载完成，正在转换为本地可运行模型...' })}\n\n`);
                const modelfilePath = path.join(tempDir, `Modelfile_${modelName.replace(/:/g, '_')}`);
                // Windows 环境下路径需处理斜杠
                const normalizedFilePath = filePath.replace(/\\/g, '/');
                fs.writeFileSync(modelfilePath, `FROM ${normalizedFilePath}\n`);
                const createRes = await fetch('http://127.0.0.1:11434/api/create', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: modelName, path: modelfilePath })
                });
                const decoder = new TextDecoder();
                for await (const chunk of createRes.body) {
                    const textChunk = typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
                    const lines = textChunk.split('\n').filter(Boolean);
                    for (const line of lines) {
                        try {
                            const data = JSON.parse(line);
                            res.write(`data: ${JSON.stringify({ status: 'pulling', detail: data.status || '配置模型中...' })}\n\n`);
                        }
                        catch (e) { }
                    }
                }
                // 清理临时文件 (可选，或让用户自行处理)
                try {
                    fs.unlinkSync(filePath);
                    fs.unlinkSync(modelfilePath);
                }
                catch (e) {
                    console.error('清理临时文件失败', e);
                }
                res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
                res.end();
            }
            catch (err) {
                res.write(`data: ${JSON.stringify({ error: 'GGUF下载失败: ' + err.message })}\n\n`);
                res.end();
            }
        }
        catch (error) {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
            res.end();
        }
    });
    return router;
};
