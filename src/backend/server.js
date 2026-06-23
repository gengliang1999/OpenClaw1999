/**
 * OpenClaw 智能助手 - Express API 服务器
 * 提供所有后端功能的 RESTful API
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { ModelManager } = require('./model-manager');
const { MemoryStore } = require('./memory-store');
const { SandboxExecutor } = require('./sandbox');
const { PermissionManager } = require('./permission-manager');
const { AutomationController } = require('./automation');
const systemInfo = require('./system-info');

/**
 * 创建并启动 API 服务器
 * @param {number} port - 监听端口
 * @param {string} [rendererPath] - 前端静态文件目录（可选）
 * @returns {Promise<import('http').Server>} HTTP 服务器实例
 */
async function createServer(port = 3721, rendererPath) {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 提供前端静态文件服务（让 Electron 通过 HTTP 加载，解决 ES Module CORS 问题）
  if (rendererPath) {
    app.use(express.static(rendererPath, {
      setHeaders: (res, filePath) => {
        // 为 JS 文件设置正确的 MIME 类型
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      },
    }));
  }

  const isMac = process.platform === 'darwin';
  const dataDir = path.join(
    process.env.APPDATA || (isMac ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config')),
    'OpenClawAssistant'
  );

  // 初始化各模块
  const modelManager = new ModelManager(dataDir);
  const memoryStore = new MemoryStore(dataDir);
  const sandbox = new SandboxExecutor(dataDir);
  const permissionManager = new PermissionManager(dataDir);
  const automation = new AutomationController(sandbox);

  // 初始化数据库
  await memoryStore.init();
  console.log('[API 服务器] 所有模块初始化完成');

  // ========== 聊天 API ==========

  /** 发送聊天消息（非流式） */
  app.post('/api/chat', async (req, res) => {
    try {
      const { conversationId, message, modelId, systemPrompt } = req.body;
      if (!message) return res.status(400).json({ message: '消息不能为空' });

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
      if (history.length > 20) history = history.slice(history.length - 20);
      let messages = history.map(m => ({ role: m.role, content: m.content }));

      if (systemPrompt) {
        messages.unshift({ role: 'system', content: systemPrompt });
      }

      // 调用模型
      const reply = await modelManager.chat(messages, { modelId });

      // 保存 AI 回复
      memoryStore.saveMessage(convId, 'assistant', reply);

      res.json({ conversationId: convId, reply });
    } catch (error) {
      console.error('[聊天] 错误:', error);
      res.status(500).json({ message: error.message });
    }
  });

  /** 流式聊天（SSE） */
  app.post('/api/chat/stream', async (req, res) => {
    try {
      const { conversationId, message, modelId, systemPrompt, temperature } = req.body;
      if (!message) return res.status(400).json({ message: '消息不能为空' });

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

      memoryStore.saveMessage(convId, 'user', message);

      let history = memoryStore.getConversationHistory(convId);
      // [上下文压缩] 保留最后20条，避免爆显存
      if (history.length > 20) history = history.slice(history.length - 20);
      let messages = history.map(m => ({ role: m.role, content: m.content }));

      // RAG 记忆检索与注入
      const relevantMemories = memoryStore.searchMemory(message, 3);
      let augmentedSystemPrompt = systemPrompt || '你是一个有用的、无所不知的人工智能助手。';
      
      if (relevantMemories && relevantMemories.length > 0) {
        const memoryContext = relevantMemories.map(m => `- ${m.content}`).join('\n');
        augmentedSystemPrompt += `\n\n[用户相关的长期记忆（仅供参考）：]\n${memoryContext}`;
      }

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
            if (outputText.length > 2000) outputText = outputText.slice(0, 2000) + '\n... (内容过长已截断)';
            
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: `> ✅ 执行完成，继续响应中...\n\n` })}\n\n`);
            
            currentMessages.push({ role: 'assistant', content: accumulatedReply });
            currentMessages.push({ role: 'user', content: `[沙盒命令执行结果]:\n${outputText}\n请基于此结果继续回答。` });
            
            return accumulatedReply + '\n\n' + await chatRecursion(currentMessages, recursionCount + 1);
          } catch (e) {
            res.write(`data: ${JSON.stringify({ type: 'chunk', content: `> ❌ 执行失败，继续响应中...\n\n` })}\n\n`);
            currentMessages.push({ role: 'assistant', content: accumulatedReply });
            currentMessages.push({ role: 'user', content: `[沙盒执行失败]: ${e.message}\n请向用户说明情况，或尝试其他命令。` });
            return accumulatedReply + '\n\n' + await chatRecursion(currentMessages, recursionCount + 1);
          }
        }
        return accumulatedReply;
      };

      const finalReply = await chatRecursion(messages);

      memoryStore.saveMessage(convId, 'assistant', finalReply);
      res.write(`data: ${JSON.stringify({ type: 'done', conversationId: convId })}\n\n`);
      res.end();
    } catch (error) {
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
  app.get('/api/chat/conversations', (req, res) => {
    try {
      const conversations = memoryStore.getConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 创建新对话 */
  app.post('/api/chat/conversations', (req, res) => {
    try {
      const { title } = req.body;
      const conv = memoryStore.createConversation(title || '新对话');
      res.json(conv);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 删除对话 */
  app.delete('/api/chat/conversations/:id', (req, res) => {
    try {
      memoryStore.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取聊天历史 */
  app.get('/api/chat/history', (req, res) => {
    try {
      const { conversationId } = req.query;
      const history = memoryStore.getConversationHistory(conversationId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 清空聊天历史 */
  app.delete('/api/chat/history', (req, res) => {
    try {
      const { conversationId } = req.query;
      memoryStore.clearHistory(conversationId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 删除单条消息 */
  app.delete('/api/chat/message/:id', (req, res) => {
    try {
      memoryStore.deleteMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== 模型 API ==========

  /** 获取所有模型 */
  app.get('/api/models', (req, res) => {
    res.json(modelManager.listModels());
  });

  /** 获取当前活跃模型 */
  app.get('/api/models/active', (req, res) => {
    res.json(modelManager.getActiveModel());
  });

  /** 设置活跃模型 */
  app.put('/api/models/active', (req, res) => {
    try {
      const result = modelManager.setActiveModel(req.body.modelId);
      res.json(result);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 添加模型 */
  app.post('/api/models', (req, res) => {
    try {
      const model = modelManager.addModel(req.body);
      res.json(model);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 删除模型 */
  app.delete('/api/models/:id', (req, res) => {
    try {
      modelManager.removeModel(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 获取旗舰级本地模型市场列表（附带硬件评估） */
  app.get('/api/models/marketplace', async (req, res) => {
    try {
      const hwInfo = await systemInfo.getHardwareInfo();
      const marketData = [
        {
          provider: 'Alibaba',
          logo: '🅰️',
          description: '阿里巴巴通义千问系列，中文能力极佳。',
          series: [
            {
              name: 'Qwen 2.5',
              description: '最新一代 Qwen 模型，代码与数学能力大幅提升。',
              versions: [
                { id: 'qwen2.5:7b', name: '7B Instruct', sizeGB: 4.7, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-7B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-7b-instruct-q4_k_m.gguf' },
                { id: 'qwen2.5:14b', name: '14B Instruct', sizeGB: 8.5, paramsBillion: 14, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-14B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-14b-instruct-q4_k_m.gguf' },
                { id: 'qwen2.5:32b', name: '32B Instruct', sizeGB: 19.2, paramsBillion: 32, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-32B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-32b-instruct-q4_k_m.gguf' }
              ]
            },
            {
              name: 'Qwen 2.5 Coder',
              description: '专为代码生成优化的模型系列。',
              versions: [
                { id: 'qwen2.5-coder:7b', name: '7B Coder', sizeGB: 4.7, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/qwen/Qwen2.5-Coder-7B-Instruct-GGUF/repo?Revision=master&FilePath=qwen2.5-coder-7b-instruct-q4_k_m.gguf' }
              ]
            }
          ]
        },
        {
          provider: 'DeepSeek',
          logo: '🐋',
          description: '深度求索，开源代码模型霸主。',
          series: [
            {
              name: 'DeepSeek Coder V2',
              description: '当前最强开源代码模型，MoE 架构。',
              versions: [
                { id: 'deepseek-coder-v2:16b', name: '16B Lite', sizeGB: 8.9, paramsBillion: 16, ggufUrl: 'https://modelscope.cn/api/v1/models/deepseek-ai/DeepSeek-Coder-V2-Lite-Instruct-GGUF/repo?Revision=main&FilePath=DeepSeek-Coder-V2-Lite-Instruct-Q4_K_M.gguf' }
              ]
            }
          ]
        },
        {
          provider: 'Baichuan',
          logo: '🌊',
          description: '百川智能，在中文常识与文本生成上表现卓越。',
          series: [
            {
              name: 'Baichuan 2',
              description: '新一代开源大语言模型，医疗/法律等专业领域极强。',
              versions: [
                { id: 'baichuan2:7b', name: '7B Chat', sizeGB: 4.6, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/baichuan-inc/Baichuan2-7B-Chat-GGUF/repo?Revision=master&FilePath=baichuan2-7b-chat-q4_k_m.gguf' },
                { id: 'baichuan2:13b', name: '13B Chat', sizeGB: 8.1, paramsBillion: 13, ggufUrl: 'https://modelscope.cn/api/v1/models/baichuan-inc/Baichuan2-13B-Chat-GGUF/repo?Revision=master&FilePath=baichuan2-13b-chat-q4_k_m.gguf' }
              ]
            }
          ]
        },
        {
          provider: '01.AI',
          logo: '⚡',
          description: '零一万物，李开复博士创办，拥有极强的双语与代码表现。',
          series: [
            {
              name: 'Yi 1.5',
              description: '大幅提升代码生成与数学逻辑能力。',
              versions: [
                { id: 'yi1.5:9b', name: '9B Chat', sizeGB: 5.6, paramsBillion: 9, ggufUrl: 'https://modelscope.cn/api/v1/models/01ai/Yi-1.5-9B-Chat-GGUF/repo?Revision=master&FilePath=Yi-1.5-9B-Chat-Q4_K_M.gguf' },
                { id: 'yi1.5:34b', name: '34B Chat', sizeGB: 20.1, paramsBillion: 34, ggufUrl: 'https://modelscope.cn/api/v1/models/01ai/Yi-1.5-34B-Chat-GGUF/repo?Revision=master&FilePath=Yi-1.5-34B-Chat-Q4_K_M.gguf' }
              ]
            }
          ]
        },
        {
          provider: 'InternLM',
          logo: '🎓',
          description: '上海人工智能实验室 (书生·浦语系列)。',
          series: [
            {
              name: 'InternLM 2.5',
              description: '长文本与复杂推理能力登顶开源榜单前列。',
              versions: [
                { id: 'internlm2.5:7b', name: '7B Chat', sizeGB: 4.7, paramsBillion: 7, ggufUrl: 'https://modelscope.cn/api/v1/models/Shanghai_AI_Laboratory/internlm2_5-7b-chat-gguf/repo?Revision=main&FilePath=internlm2_5-7b-chat-q4_k_m.gguf' }
              ]
            }
          ]
        },
        {
          provider: 'SenseTime',
          logo: '👁️',
          description: '商汤科技 SenseNova 日日新大模型。',
          series: [
            {
              name: 'SenseNova 5.0',
              description: '极高的人文对话与知识推理表现。',
              versions: [
                { id: 'sensenova5:8b', name: '8B Instruct', sizeGB: 5.1, paramsBillion: 8, ggufUrl: 'https://modelscope.cn/api/v1/models/sensetime/SenseNova-5.0-8B-Instruct-GGUF/repo?Revision=main&FilePath=sensenova-5.0-8b-instruct-q4_k_m.gguf' }
              ]
            }
          ]
        },
        {
          provider: 'Meta',
          logo: '♾️',
          description: 'Llama 系列，全球最强开源基座。',
          series: [
            {
              name: 'Llama 3.1',
              description: '128K 上下文，多语言支持大幅增强。',
              versions: [
                { id: 'llama3.1:8b', name: '8B Instruct', sizeGB: 4.7, paramsBillion: 8, ggufUrl: 'https://hf-mirror.com/lmstudio-community/Meta-Llama-3.1-8B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-8B-Instruct-Q4_K_M.gguf' },
                { id: 'llama3.1:70b', name: '70B Instruct', sizeGB: 39.5, paramsBillion: 70, ggufUrl: 'https://hf-mirror.com/lmstudio-community/Meta-Llama-3.1-70B-Instruct-GGUF/resolve/main/Meta-Llama-3.1-70B-Instruct-Q4_K_M.gguf' }
              ]
            }
          ]
        },
        {
          provider: 'Google',
          logo: '🔍',
          description: 'Gemma 系列，基于 Gemini 架构。',
          series: [
            {
              name: 'Gemma 2',
              description: '性能与效率的最佳平衡。',
              versions: [
                { id: 'gemma2:9b', name: '9B Instruct', sizeGB: 5.4, paramsBillion: 9, ggufUrl: 'https://modelscope.cn/api/v1/models/LLM-Research/gemma-2-9b-it-GGUF/repo?Revision=master&FilePath=gemma-2-9b-it-Q4_K_M.gguf' }
              ]
            }
          ]
        }
      ];

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
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 同步第三方本地模型 (Ollama / LM Studio) */
  app.post('/api/models/sync', async (req, res) => {
    try {
      const count = await modelManager.syncThirdPartyLocalModels();
      res.json({ success: true, count });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  /** 检测本地运行时状态（Ollama / LM Studio） */
  app.get('/api/models/local-detect', async (req, res) => {
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
    } catch (e) { /* Ollama 未运行 */ }

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
    } catch (e) { /* LM Studio 未运行 */ }

    res.json(result);
  });

  /** 获取 Ollama 已安装模型列表（详细） */
  app.get('/api/models/ollama/list', async (req, res) => {
    try {
      const ollamaRes = await fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(5000) });
      if (!ollamaRes.ok) throw new Error('Ollama 连接失败');
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
    } catch (error) {
      res.status(503).json({ success: false, message: 'Ollama 未运行: ' + error.message });
    }
  });

  /** 获取 LM Studio 已加载模型列表 */
  app.get('/api/models/lmstudio/list', async (req, res) => {
    try {
      const lmRes = await fetch('http://127.0.0.1:1234/v1/models', { signal: AbortSignal.timeout(5000) });
      if (!lmRes.ok) throw new Error('LM Studio 连接失败');
      const data = await lmRes.json();
      const models = (data.data || []).map(m => ({
        id: m.id,
        name: m.id.split('/').pop() || m.id,
        fullName: m.id,
        owned_by: m.owned_by || '',
      }));
      res.json({ success: true, models });
    } catch (error) {
      res.status(503).json({ success: false, message: 'LM Studio 未运行: ' + error.message });
    }
  });

  /** 添加本地模型到已配置列表并可选设为默认 */
  app.post('/api/models/local/add', async (req, res) => {
    try {
      const { provider, modelId, modelName, setDefault } = req.body;
      if (!modelId) return res.status(400).json({ message: 'modelId 不能为空' });

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
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 预加载模型到显存 */
  app.post('/api/models/preload', async (req, res) => {
    try {
      const { modelId } = req.body;
      const model = modelManager.models.find(m => m.id === modelId);
      if (!model) return res.status(404).json({ message: '模型不存在' });
      
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
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 触发 Ollama 自动拉取模型或国内源拉取 */
  app.post('/api/models/pull', async (req, res) => {
    try {
      const { modelName, ggufUrl } = req.body;
      if (!modelName) return res.status(400).json({ message: 'Missing modelName' });

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
              } catch(e) {}
            }
          }
          res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
        } catch (err) {
          res.write(`data: ${JSON.stringify({ error: 'Stream error: ' + err.message })}\n\n`);
        }
        return res.end();
      }

      // 国内镜像源拉取
      try {
        const tempDir = path.join(dataDir, 'temp_downloads');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        
        const filePath = path.join(tempDir, `${modelName.replace(/:/g, '_')}.gguf`);
        
        res.write(`data: ${JSON.stringify({ status: 'connecting', detail: '连接到国内镜像源...' })}\n\n`);
        
        const response = await fetch(ggufUrl);
        if (!response.ok) throw new Error('镜像源连接失败');
        
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
            } catch(e) {}
          }
        }
        
        // 清理临时文件 (可选，或让用户自行处理)
        try {
          fs.unlinkSync(filePath);
          fs.unlinkSync(modelfilePath);
        } catch(e) {
          console.error('清理临时文件失败', e);
        }
        
        res.write(`data: ${JSON.stringify({ status: 'success' })}\n\n`);
        res.end();
      } catch (err) {
        res.write(`data: ${JSON.stringify({ error: 'GGUF下载失败: ' + err.message })}\n\n`);
        res.end();
      }

    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  });

  // ========== 记忆 API ==========

  /** 获取记忆列表 */
  app.get('/api/memory', (req, res) => {
    try {
      const { page, pageSize, category } = req.query;
      const result = memoryStore.getAllMemories(
        parseInt(page) || 1,
        parseInt(pageSize) || 20,
        category
      );
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 添加记忆 */
  app.post('/api/memory', (req, res) => {
    try {
      const { content, category, tags } = req.body;
      if (!content) return res.status(400).json({ message: '内容不能为空' });
      const memory = memoryStore.addMemory(content, category, tags);
      res.json(memory);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 删除记忆 */
  app.delete('/api/memory/:id', (req, res) => {
    try {
      memoryStore.deleteMemory(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 搜索记忆 */
  app.get('/api/memory/search', (req, res) => {
    try {
      const { q, limit } = req.query;
      const results = memoryStore.searchMemory(q || '', parseInt(limit) || 10);
      res.json(results);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 导出记忆 */
  app.get('/api/memory/export', (req, res) => {
    try {
      const data = memoryStore.exportData();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 导入记忆 */
  app.post('/api/memory/import', (req, res) => {
    try {
      memoryStore.importData(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== 沙盒 API ==========

  /** 执行沙盒命令 */
  app.post('/api/sandbox/execute', async (req, res) => {
    try {
      const { command, confirmed, permanent, cwd, timeout } = req.body;
      if (!command) return res.status(400).json({ message: '命令不能为空' });

      if (confirmed) {
        const result = await sandbox.executeConfirmed(command, permanent, { cwd, timeout });
        res.json(result);
      } else {
        const result = await sandbox.execute(command, { cwd, timeout });
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取权限列表 */
  app.get('/api/sandbox/permissions', (req, res) => {
    res.json(sandbox.getPermissions());
  });

  /** 授予权限 */
  app.post('/api/sandbox/permissions', (req, res) => {
    try {
      const { pattern, permanent } = req.body;
      const perm = sandbox.grantPermission(pattern, permanent);
      res.json(perm);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 撤销权限 */
  app.delete('/api/sandbox/permissions/:id', (req, res) => {
    try {
      sandbox.revokePermission(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 获取操作日志 */
  app.get('/api/sandbox/logs', (req, res) => {
    try {
      const { page, pageSize } = req.query;
      res.json(sandbox.getLogs(parseInt(page) || 1, parseInt(pageSize) || 50));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== 技能市场 API ==========

  const skillsPath = path.join(dataDir, 'skills.json');
  let installedSkills = [];
  try {
    if (fs.existsSync(skillsPath)) installedSkills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
  } catch(e) {}
  const saveSkills = () => fs.writeFileSync(skillsPath, JSON.stringify(installedSkills, null, 2));

  // 首次启动时自动安装新增技能
  const AUTO_INSTALL_SKILLS = ['skill-security', 'skill-crawler', 'skill-prompt', 'skill-math', 'skill-aiart', 'skill-resume'];
  let skillsUpdated = false;
  for (const skillId of AUTO_INSTALL_SKILLS) {
    if (!installedSkills.some(s => s.id === skillId)) {
      const skill = SKILL_MARKET.find(s => s.id === skillId);
      if (skill) {
        installedSkills.push({ ...skill, installedAt: new Date().toISOString() });
        skillsUpdated = true;
        console.log(`[技能市场] 自动安装新技能: ${skill.name}`);
      }
    }
  }
  if (skillsUpdated) saveSkills();

  const SKILL_MARKET = [
    { id: 'skill-writer', name: '文章写作专家', icon: '📝', description: '专为撰写高质量文章、报告而生的 AI 技能。', author: 'OpenClaw', type: '创作', downloads: 12000, rating: 4.8, lastUpdated: '2026-06-10', prompt: '你是一位资深的媒体主编和文案专家。你的写作兼具深度与可读性，能够根据不同的目标受众和发布平台（公众号、知乎、博客等）灵活调整风格。请严格遵循 Markdown 格式输出，确保结构清晰。' },
    { id: 'skill-coder', name: '全栈编程助手', icon: '💻', description: '精通多语言编程，自动生成代码和定位 Bug。', author: 'OpenClaw', type: '开发', downloads: 35000, rating: 4.9, lastUpdated: '2026-06-12', prompt: '你是一位资深全栈工程师，精通 JavaScript/TypeScript、Python、Go 等主流语言。回答时请直接给出可运行的代码，包含关键注释，并主动考虑边界情况和安全性问题。' },
    { id: 'skill-translator', name: '本地化翻译', icon: '🌐', description: '高精度的多语言翻译技能，保持语境和专业术语。', author: 'Community', type: '工具', downloads: 8000, rating: 4.5, lastUpdated: '2026-05-20', prompt: '你是一位专业的本地化翻译专家。翻译时请保持原文的语气、风格和专业术语，必要时进行文化适应性调整（本地化）。不要添加额外解释，直接输出翻译结果。' },
    { id: 'skill-analyst', name: '数据分析师', icon: '📊', description: '上传数据文件，自动生成分析结论和可视化代码。', author: 'Community', type: '效率', downloads: 6500, rating: 4.6, lastUpdated: '2026-06-01', prompt: '你是一位高级数据分析师。请使用 Python（pandas + matplotlib/seaborn）进行数据分析。回答时请：1. 先理解数据结构；2. 给出分析思路；3. 提供可直接运行的代码；4. 对结果进行业务解读。' },
    { id: 'skill-search', name: '深度搜索者', icon: '🔍', description: '接入搜索引擎，自动抓取多网页信息进行总结。', author: 'OpenClaw', type: '工具', downloads: 22000, rating: 4.7, lastUpdated: '2026-06-15', prompt: '你是一位信息检索与知识整合专家。请根据用户的问题，利用系统提供的沙盒执行能力（执行 curl 等命令抓取网页），搜索并整合多源信息，给出全面、准确、有来源标注的回答。' },
    { id: 'skill-sysadmin', name: '运维诊断师', icon: '🔧', description: 'ClawPanel 专属：自动诊断系统错误日志，提供修复建议。', author: 'OpenClaw', type: '开发', downloads: 18000, rating: 5.0, lastUpdated: '2026-06-16', prompt: '你是一位资深的 DevOps 运维工程师。请使用沙盒执行能力（systemctl、journalctl、docker 等命令）自动诊断系统问题。分析日志时请按照：1. 定位根因；2. 评估影响范围；3. 给出修复命令；4. 提供预防建议。' },
    // ===== 新增技能 =====
    { id: 'skill-security', name: '网络安全顾问', icon: '🛡️', description: '精通渗透测试与安全加固，分析代码漏洞并提供修复方案。', author: 'OpenClaw', type: '开发', downloads: 15200, rating: 4.9, lastUpdated: '2026-06-20', prompt: '你是一位资深的网络安全工程师（OSCP/CISSP 持证）。请从攻击者视角审视用户提供的代码或架构，识别 OWASP Top 10 漏洞（如 SQL 注入、XSS、CSRF、SSRF 等），并提供具体的修复代码和加固建议。回答需包含：风险等级（高/中/低）、漏洞原理、PoC 示例、修复方案。' },
    { id: 'skill-crawler', name: '数据采集专家', icon: '🕷️', description: '精通网页爬虫与数据清洗，快速构建高效稳定的数据采集管道。', author: 'Community', type: '开发', downloads: 9800, rating: 4.6, lastUpdated: '2026-06-18', prompt: '你是一位精通网络爬虫的数据采集工程师。请使用 Python（requests/httpx + BeautifulSoup/lxml）编写爬虫代码。注意：1. 自动处理反爬机制（UA轮换、代理池、验证码识别思路）；2. 遵守 robots.txt 规范；3. 数据清洗与结构化存储（CSV/JSON/SQLite）；4. 异步并发提升效率。' },
    { id: 'skill-prompt', name: '提示词工程师', icon: '🪄', description: '专业优化 AI 提示词，帮助你获得更精准、更高质量的 AI 输出。', author: 'OpenClaw', type: '效率', downloads: 28500, rating: 4.9, lastUpdated: '2026-06-22', prompt: '你是一位世界顶级的提示词工程师（Prompt Engineer）。请帮助用户优化他们给 AI 的提示词。你的方法论包括：1. 明确角色设定（Role）；2. 拆解任务（Chain of Thought）；3. 添加约束条件与输出格式；4. 提供 Few-shot 示例；5. 使用结构化标记。请给出优化前后的对比，并解释每处修改的原因。' },
    { id: 'skill-math', name: '数学解题大师', icon: '🧮', description: '精通从初等数学到高等数学的解题，步骤详细、思路清晰。', author: 'Community', type: '教育', downloads: 11200, rating: 4.7, lastUpdated: '2026-06-15', prompt: '你是一位数学教授，精通代数、几何、微积分、线性代数、概率论与数理统计。解题时请：1. 先分析题意，识别考查知识点；2. 分步骤推导，每步给出详细理由；3. 使用 LaTeX 格式书写数学公式；4. 最后进行验算和总结。如果题目有多种解法，请给出最优解并说明其他解法的优劣。' },
    { id: 'skill-aiart', name: 'AI 绘画提示词师', icon: '🎨', description: '精通 Midjourney/Stable Diffusion/DALL-E 提示词，生成精美画面描述。', author: 'OpenClaw', type: '创作', downloads: 19700, rating: 4.8, lastUpdated: '2026-06-21', prompt: '你是一位专业的 AI 绘画提示词工程师，精通 Midjourney、Stable Diffusion 和 DALL-E 的提示词语法。请根据用户的创意需求，生成结构化的英文提示词，包含：主体描述、艺术风格、光照效果、镜头参数、色调氛围、画面质量词（如 8K、masterpiece 等）。同时提供中文解释，并给出 2-3 个不同风格的变体供选择。' },
    { id: 'skill-resume', name: '简历优化顾问', icon: '📄', description: '专业 HR 视角优化简历，让你的简历在 3 秒内抓住面试官眼球。', author: 'Community', type: '效率', downloads: 14600, rating: 4.7, lastUpdated: '2026-06-19', prompt: '你是一位拥有 15 年经验的猎头顾问和职业规划师。请帮助用户优化简历。你的方法论：1. 用 STAR 法则（情境-任务-行动-结果）重写工作经历；2. 量化成果（提升 XX%、节省 XX 万等）；3. 针对目标岗位调整关键词密度；4. 优化排版层次，确保 3 秒原则（HR 前 3 秒能抓住核心亮点）。请直接输出优化后的简历内容。' },
  ];

  /** 获取技能市场列表 (带筛选排序) */
  app.get('/api/skills/marketplace', (req, res) => {
    try {
      const { search, type, sort } = req.query;
      let skills = [...SKILL_MARKET];

      if (search) {
        const q = search.toLowerCase();
        skills = skills.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
      }

      if (type && type !== '全部') {
        skills = skills.filter(s => s.type === type);
      }

      const sortBy = sort || 'downloads';
      if (sortBy === 'downloads') skills.sort((a, b) => b.downloads - a.downloads);
      if (sortBy === 'rating') skills.sort((a, b) => b.rating - a.rating);
      if (sortBy === 'updated') skills.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

      // 附加已安装状态
      skills = skills.map(s => ({ ...s, status: installedSkills.some(i => i.id === s.id) ? 'installed' : 'not_installed' }));

      const allTypes = [...new Set(SKILL_MARKET.map(s => s.type))];

      res.json({ total: skills.length, filters: { types: allTypes }, items: skills });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取已安装技能 */
  app.get('/api/skills', (req, res) => {
    res.json(installedSkills);
  });

  /** 安装技能 */
  app.post('/api/skills/install', (req, res) => {
    const { skillId } = req.body;
    const skill = SKILL_MARKET.find(s => s.id === skillId);
    if (!skill) return res.status(404).json({ message: '技能不存在' });
    if (!installedSkills.some(s => s.id === skillId)) {
      const newSkill = { ...skill, installedAt: new Date().toISOString() };
      installedSkills.push(newSkill);
      saveSkills();
      res.json(newSkill);
    } else {
      res.json({ success: true });
    }
  });

  /** 卸载技能 */
  app.delete('/api/skills/:id', (req, res) => {
    installedSkills = installedSkills.filter(s => s.id !== req.params.id);
    saveSkills();
    res.json({ message: '卸载成功' });
  });

  // ========== 插件市场 API（OpenHub 集成） ==========

  /**
   * OpenHub 插件注册中心数据
   * 模拟 OpenHub 远程注册中心，真实环境中通过 HTTPS API 获取
   * 每个插件包含：元数据、统计数据、标签、官方认证信息
   */
  const OPENHUB_REGISTRY = [
    // ===== 通讯平台插件（官方 SDK） =====
    {
      id: 'wechat-official',
      name: '微信公众平台',
      nameEn: 'WeChat Official',
      icon: '💚',
      type: '通讯',
      tags: ['即时通讯', '官方', '微信生态'],
      description: '基于微信公众平台官方 SDK 的接入插件。通过 WeChat MP API 实现服务号/订阅号消息自动回复、模板消息、自定义菜单等功能。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-wechat-official',
      version: '2.1.0',
      sdkName: 'wechat-mp-sdk',
      officialApi: '微信公众平台 API (mp.weixin.qq.com)',
      stars: 2340,
      forks: 312,
      downloads: 45800,
      weeklyDownloads: 1230,
      rating: 4.8,
      ratingCount: 386,
      lastUpdated: '2026-06-10T08:00:00Z',
      createdAt: '2025-03-15T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: true,
      features: ['服务号消息回复', '模板消息推送', '自定义菜单', '素材管理', '用户管理', 'OAuth 授权登录'],
      configFields: [
        { key: 'appId', label: '公众号 AppID', type: 'text', placeholder: '在 mp.weixin.qq.com 获取', required: true },
        { key: 'appSecret', label: '公众号 AppSecret', type: 'password', placeholder: '在 mp.weixin.qq.com 获取', required: true },
        { key: 'token', label: '服务器 Token', type: 'text', placeholder: '自定义验证 Token', required: true },
        { key: 'encodingAESKey', label: '消息加密密钥', type: 'password', placeholder: '43 位字符串（可选）' },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'wechat-work',
      name: '企业微信',
      nameEn: 'WeCom / WeChat Work',
      icon: '🏢',
      type: '通讯',
      tags: ['即时通讯', '官方', '企业', '微信生态'],
      description: '基于企业微信官方 Server API 的接入插件。支持应用消息推送、群聊机器人、审批流程、日程同步等企业级功能。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-wecom',
      version: '1.8.0',
      sdkName: 'wecom-server-api',
      officialApi: '企业微信 Server API (work.weixin.qq.com)',
      stars: 1560,
      forks: 203,
      downloads: 28900,
      weeklyDownloads: 870,
      rating: 4.7,
      ratingCount: 214,
      lastUpdated: '2026-06-08T12:00:00Z',
      createdAt: '2025-05-20T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: false,
      features: ['应用消息推送', '群聊机器人', '审批流', '日程同步', '通讯录管理', '素材管理'],
      configFields: [
        { key: 'corpId', label: '企业 ID', type: 'text', placeholder: '在 work.weixin.qq.com 获取', required: true },
        { key: 'agentId', label: '应用 AgentId', type: 'text', placeholder: '自建应用的 AgentId', required: true },
        { key: 'secret', label: '应用 Secret', type: 'password', placeholder: '自建应用的 Secret', required: true },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'qq-bot-official',
      name: 'QQ 官方机器人',
      nameEn: 'QQ Bot (Official)',
      icon: '🐧',
      type: '通讯',
      tags: ['即时通讯', '官方', 'QQ生态'],
      description: '基于 QQ 开放平台官方 Bot SDK 的接入插件。通过 QQ Bot API v2 实现频道消息、群消息、私聊、富文本消息卡片等功能。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-qqbot',
      version: '2.0.3',
      sdkName: 'qq-bot-sdk (官方 v2 API)',
      officialApi: 'QQ 开放平台 Bot API (q.qq.com)',
      stars: 1890,
      forks: 256,
      downloads: 38200,
      weeklyDownloads: 1050,
      rating: 4.6,
      ratingCount: 298,
      lastUpdated: '2026-06-12T06:00:00Z',
      createdAt: '2025-04-01T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: true,
      features: ['频道消息收发', '群聊消息', '私聊消息', 'Markdown 消息', '消息按钮', '富文本卡片', '事件订阅'],
      configFields: [
        { key: 'appId', label: '机器人 AppID', type: 'text', placeholder: '在 q.qq.com 开放平台获取', required: true },
        { key: 'clientSecret', label: 'ClientSecret', type: 'password', placeholder: '在 q.qq.com 获取', required: true },
        { key: 'sandbox', label: '沙箱模式', type: 'switch', value: true },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'feishu-official',
      name: '飞书机器人',
      nameEn: 'Feishu / Lark Bot',
      icon: '🔷',
      type: '通讯',
      tags: ['即时通讯', '官方', '企业', '飞书生态'],
      description: '基于飞书开放平台官方 SDK 的接入插件。支持消息卡片、事件订阅、机器人指令、多维表格、审批等能力。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-feishu',
      version: '3.2.0',
      sdkName: '@larksuiteoapi/node-sdk (官方)',
      officialApi: '飞书开放平台 API (open.feishu.cn)',
      stars: 2100,
      forks: 278,
      downloads: 42500,
      weeklyDownloads: 1150,
      rating: 4.9,
      ratingCount: 356,
      lastUpdated: '2026-06-14T10:00:00Z',
      createdAt: '2025-02-10T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: true,
      features: ['消息卡片', '事件订阅', '机器人指令', '群组管理', '多维表格', '审批流程', '日历集成'],
      configFields: [
        { key: 'appId', label: '应用 App ID', type: 'text', placeholder: '在 open.feishu.cn 获取', required: true },
        { key: 'appSecret', label: 'App Secret', type: 'password', placeholder: '在 open.feishu.cn 获取', required: true },
        { key: 'encryptKey', label: 'Encrypt Key', type: 'password', placeholder: '事件订阅加密密钥' },
        { key: 'verificationToken', label: 'Verification Token', type: 'text', placeholder: '事件订阅验证 Token' },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'dingtalk-official',
      name: '钉钉机器人',
      nameEn: 'DingTalk Bot',
      icon: '🔵',
      type: '通讯',
      tags: ['即时通讯', '官方', '企业', '钉钉生态'],
      description: '基于钉钉开放平台官方 SDK 的接入插件。支持企业内部应用机器人、群聊机器人、卡片消息、互动卡片等能力。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-dingtalk',
      version: '2.5.1',
      sdkName: '@anthropic-ai/dingtalk-sdk (官方)',
      officialApi: '钉钉开放平台 API (open.dingtalk.com)',
      stars: 1780,
      forks: 231,
      downloads: 35600,
      weeklyDownloads: 980,
      rating: 4.7,
      ratingCount: 267,
      lastUpdated: '2026-06-11T04:00:00Z',
      createdAt: '2025-04-15T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: false,
      features: ['群聊机器人', '应用机器人', '互动卡片', 'Webhook 推送', '工作通知', '审批集成'],
      configFields: [
        { key: 'appKey', label: 'AppKey', type: 'text', placeholder: '在 open.dingtalk.com 获取', required: true },
        { key: 'appSecret', label: 'AppSecret', type: 'password', placeholder: '在 open.dingtalk.com 获取', required: true },
        { key: 'robotCode', label: '机器人编码', type: 'text', placeholder: '机器人唯一标识' },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'telegram-bot',
      name: 'Telegram Bot',
      nameEn: 'Telegram',
      icon: '✈️',
      type: '通讯',
      tags: ['即时通讯', '官方', '海外', '开源'],
      description: '基于 Telegram Bot API (官方) 的接入插件。支持消息收发、Inline 查询、自定义键盘、Webhook 等全部 Bot API 功能。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-telegram',
      version: '2.3.0',
      sdkName: 'node-telegram-bot-api',
      officialApi: 'Telegram Bot API (core.telegram.org)',
      stars: 3200,
      forks: 420,
      downloads: 62000,
      weeklyDownloads: 1800,
      rating: 4.9,
      ratingCount: 528,
      lastUpdated: '2026-06-15T14:00:00Z',
      createdAt: '2025-01-20T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: true,
      features: ['消息收发', 'Inline 查询', '自定义键盘', 'Webhook', '文件发送', '群组管理', '频道管理'],
      configFields: [
        { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '从 @BotFather 获取', required: true },
        { key: 'webhookUrl', label: 'Webhook URL（可选）', type: 'text', placeholder: 'https://...' },
        { key: 'proxyUrl', label: '代理地址（可选）', type: 'text', placeholder: 'socks5://127.0.0.1:1080' },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'slack-bot',
      name: 'Slack Bot',
      nameEn: 'Slack',
      icon: '💜',
      type: '通讯',
      tags: ['即时通讯', '官方', '海外', '企业'],
      description: '基于 Slack Bolt SDK (官方) 的接入插件。支持频道消息、线程回复、Slash 命令、交互组件等全部 Slack App 功能。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-slack',
      version: '1.9.0',
      sdkName: '@slack/bolt (官方)',
      officialApi: 'Slack API (api.slack.com)',
      stars: 1450,
      forks: 189,
      downloads: 24500,
      weeklyDownloads: 720,
      rating: 4.6,
      ratingCount: 178,
      lastUpdated: '2026-06-09T16:00:00Z',
      createdAt: '2025-06-01T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: false,
      features: ['频道消息', '线程回复', 'Slash 命令', 'Block Kit', '交互组件', '文件共享', 'App Home'],
      configFields: [
        { key: 'botToken', label: 'Bot Token (xoxb-)', type: 'password', placeholder: 'xoxb-...', required: true },
        { key: 'signingSecret', label: 'Signing Secret', type: 'password', placeholder: '在 api.slack.com 获取', required: true },
        { key: 'appToken', label: 'App Token (xapp-)', type: 'password', placeholder: 'xapp-...' },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },
    {
      id: 'discord-bot',
      name: 'Discord Bot',
      nameEn: 'Discord',
      icon: '🎮',
      type: '通讯',
      tags: ['即时通讯', '官方', '海外', '社区'],
      description: '基于 discord.js (官方推荐) 的接入插件。支持服务器消息、斜杠命令、按钮交互、嵌入消息等全部 Discord Bot 功能。',
      author: 'OpenClaw Official',
      authorVerified: true,
      license: 'MIT',
      repository: 'https://github.com/openclaw/plugin-discord',
      version: '2.0.1',
      sdkName: 'discord.js (官方推荐)',
      officialApi: 'Discord API (discord.com/developers)',
      stars: 2680,
      forks: 356,
      downloads: 51200,
      weeklyDownloads: 1420,
      rating: 4.8,
      ratingCount: 412,
      lastUpdated: '2026-06-13T18:00:00Z',
      createdAt: '2025-02-28T00:00:00Z',
      status: 'not_installed',
      verified: true,
      trending: true,
      features: ['消息收发', '斜杠命令', '按钮交互', '嵌入消息', '语音频道', '服务器管理', '权限控制'],
      configFields: [
        { key: 'botToken', label: 'Bot Token', type: 'password', placeholder: '在 discord.com/developers 获取', required: true },
        { key: 'clientId', label: 'Client ID', type: 'text', placeholder: '应用 Client ID', required: true },
        { key: 'guildId', label: '服务器 ID（可选）', type: 'text', placeholder: '限定到特定服务器' },
        { key: 'autoReply', label: '自动回复', type: 'switch', value: true },
      ],
    },

    // ===== 工具类插件 =====
    {
      id: 'webhook-bridge',
      name: 'Webhook 通用桥接',
      nameEn: 'Webhook Bridge',
      icon: '🔗',
      type: '工具',
      tags: ['集成', '自定义', '通用'],
      description: '通用 Webhook 桥接插件。支持接入任何 Webhook 兼容的服务，可自定义消息格式和认证方式。',
      author: 'OpenClaw Community',
      authorVerified: false,
      license: 'Apache-2.0',
      repository: 'https://github.com/openclaw-community/webhook-bridge',
      version: '1.5.0',
      stars: 890,
      forks: 134,
      downloads: 18200,
      weeklyDownloads: 560,
      rating: 4.4,
      ratingCount: 123,
      lastUpdated: '2026-06-05T10:00:00Z',
      createdAt: '2025-07-01T00:00:00Z',
      status: 'not_installed',
      verified: false,
      trending: false,
      features: ['自定义 Webhook', '消息转发', '格式映射', '认证配置', '批量处理'],
      configFields: [
        { key: 'webhookUrl', label: 'Webhook URL', type: 'text', placeholder: 'https://...', required: true },
        { key: 'secret', label: '签名密钥', type: 'password', placeholder: '可选' },
        { key: 'contentType', label: '内容类型', type: 'text', placeholder: 'application/json' },
      ],
    },
    {
      id: 'email-smtp',
      name: '邮件 SMTP',
      nameEn: 'Email SMTP',
      icon: '📧',
      type: '工具',
      tags: ['邮件', '通知', '通用'],
      description: '通过 SMTP 协议发送和接收邮件。支持 Gmail、Outlook、QQ 邮箱等主流邮件服务。',
      author: 'OpenClaw Community',
      authorVerified: false,
      license: 'MIT',
      repository: 'https://github.com/openclaw-community/email-smtp',
      version: '1.2.0',
      stars: 620,
      forks: 87,
      downloads: 12800,
      weeklyDownloads: 380,
      rating: 4.3,
      ratingCount: 89,
      lastUpdated: '2026-05-28T14:00:00Z',
      createdAt: '2025-08-15T00:00:00Z',
      status: 'not_installed',
      verified: false,
      trending: false,
      features: ['SMTP 发送', 'IMAP 接收', '附件支持', '模板消息', 'HTML 邮件'],
      configFields: [
        { key: 'smtpHost', label: 'SMTP 服务器', type: 'text', placeholder: 'smtp.gmail.com', required: true },
        { key: 'smtpPort', label: '端口', type: 'text', placeholder: '465', required: true },
        { key: 'username', label: '邮箱账号', type: 'text', placeholder: 'user@example.com', required: true },
        { key: 'password', label: '密码/授权码', type: 'password', placeholder: '授权码', required: true },
      ],
    },
    {
      id: 'matrix-bridge',
      name: 'Matrix 协议',
      nameEn: 'Matrix Protocol',
      icon: '🟢',
      type: '通讯',
      tags: ['即时通讯', '开源', '去中心化', '海外'],
      description: '基于 Matrix 开放协议的接入插件。支持 Element、FluffyChat 等客户端互通，去中心化通讯。',
      author: 'OpenClaw Community',
      authorVerified: false,
      license: 'Apache-2.0',
      repository: 'https://github.com/openclaw-community/matrix-bridge',
      version: '1.0.2',
      stars: 430,
      forks: 56,
      downloads: 6800,
      weeklyDownloads: 210,
      rating: 4.2,
      ratingCount: 45,
      lastUpdated: '2026-05-20T08:00:00Z',
      createdAt: '2025-10-01T00:00:00Z',
      status: 'not_installed',
      verified: false,
      trending: false,
      features: ['端到端加密', '房间管理', '桥接其他平台', '文件传输', '去中心化'],
      configFields: [
        { key: 'homeserver', label: 'Homeserver URL', type: 'text', placeholder: 'https://matrix.org', required: true },
        { key: 'accessToken', label: 'Access Token', type: 'password', placeholder: '用户 Access Token', required: true },
      ],
    },
  ];

  const pluginsPath = path.join(dataDir, 'plugins.json');
  let installedPlugins = [];
  try {
    if (fs.existsSync(pluginsPath)) installedPlugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
  } catch(e) {}
  const savePlugins = () => fs.writeFileSync(pluginsPath, JSON.stringify(installedPlugins, null, 2));

  /**
   * 获取已安装插件
   */
  app.get('/api/plugins', (req, res) => {
    res.json(installedPlugins);
  });

  /**
   * OpenHub 插件市场 — 支持高级筛选、排序
   * 查询参数：
   *   search    — 关键词搜索（名称、描述、标签）
   *   type      — 按类型筛选（通讯、工具、全部）
   *   tag       — 按标签筛选（官方、企业、开源、海外等）
   *   sort      — 排序方式（downloads, stars, rating, updated, trending）
   *   verified  — 仅显示已认证插件（true/false）
   *   page      — 页码
   *   pageSize  — 每页数量
   */
  app.get('/api/plugins/marketplace', (req, res) => {
    try {
      const { search, type, tag, sort, verified, page, pageSize } = req.query;

      let plugins = OPENHUB_REGISTRY.map(p => ({
        ...p,
        installed: installedPlugins.some(ip => ip.id === p.id),
        status: installedPlugins.find(ip => ip.id === p.id)?.status || 'not_installed',
      }));

      // 关键词搜索
      if (search) {
        const q = search.toLowerCase();
        plugins = plugins.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          (p.sdkName && p.sdkName.toLowerCase().includes(q))
        );
      }

      // 按类型筛选
      if (type && type !== '全部') {
        plugins = plugins.filter(p => p.type === type);
      }

      // 按标签筛选
      if (tag && tag !== '全部') {
        plugins = plugins.filter(p => p.tags.includes(tag));
      }

      // 仅已认证
      if (verified === 'true') {
        plugins = plugins.filter(p => p.verified);
      }

      // 排序
      const sortBy = sort || 'downloads';
      switch (sortBy) {
        case 'downloads':
          plugins.sort((a, b) => b.downloads - a.downloads);
          break;
        case 'stars':
          plugins.sort((a, b) => b.stars - a.stars);
          break;
        case 'rating':
          plugins.sort((a, b) => b.rating - a.rating);
          break;
        case 'updated':
          plugins.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
          break;
        case 'trending':
          plugins.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
          break;
        case 'name':
          plugins.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
          break;
        default:
          plugins.sort((a, b) => b.downloads - a.downloads);
      }

      // 分页
      const p = parseInt(page) || 1;
      const ps = parseInt(pageSize) || 50;
      const total = plugins.length;
      const paged = plugins.slice((p - 1) * ps, p * ps);

      // 聚合标签（用于前端筛选菜单）
      const allTags = [...new Set(OPENHUB_REGISTRY.flatMap(pl => pl.tags))];
      const allTypes = [...new Set(OPENHUB_REGISTRY.map(pl => pl.type))];

      res.json({
        source: 'OpenHub',
        total,
        page: p,
        pageSize: ps,
        filters: { types: allTypes, tags: allTags },
        items: paged,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 安装插件 */
  app.post('/api/plugins/install', (req, res) => {
    try {
      const { pluginId } = req.body;
      const plugin = OPENHUB_REGISTRY.find(p => p.id === pluginId);
      if (!plugin) return res.status(404).json({ message: '插件不存在' });
      if (installedPlugins.some(p => p.id === pluginId)) {
        return res.status(400).json({ message: '插件已安装' });
      }
      const newPlugin = { ...plugin, status: 'offline', installedAt: new Date().toISOString() };
      installedPlugins.push(newPlugin);
      savePlugins();
      res.json(newPlugin);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 卸载插件 */
  app.delete('/api/plugins/:id', (req, res) => {
    installedPlugins = installedPlugins.filter(p => p.id !== req.params.id);
    savePlugins();
    res.json({ message: '卸载成功' });
  });

  /** 更新插件配置 */
  app.put('/api/plugins/:id/config', (req, res) => {
    try {
      const plugin = installedPlugins.find(p => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ message: '插件未安装' });
      plugin.config = req.body.config || req.body;
      savePlugins();
      res.json(plugin);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 连接插件 */
  app.post('/api/plugins/:id/connect', (req, res) => {
    try {
      const plugin = installedPlugins.find(p => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ message: '插件未安装' });
      plugin.status = 'online';
      res.json({ success: true, status: 'online' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 断开插件 */
  app.post('/api/plugins/:id/disconnect', (req, res) => {
    try {
      const plugin = installedPlugins.find(p => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ message: '插件未安装' });
      plugin.status = 'offline';
      res.json({ success: true, status: 'offline' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });



  // ========== 设置 API ==========

  const settingsPath = path.join(dataDir, 'settings.json');
  let settings = {};
  try {
    if (require('fs').existsSync(settingsPath)) {
      settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf-8'));
    }
  } catch { settings = {}; }

  function saveSettings() {
    const fss = require('fs');
    const dir = path.dirname(settingsPath);
    if (!fss.existsSync(dir)) fss.mkdirSync(dir, { recursive: true });
    fss.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  /** 获取所有设置 */
  app.get('/api/settings', (req, res) => {
    res.json(settings);
  });

  /** 获取单个设置 */
  app.get('/api/settings/:key', (req, res) => {
    res.json({ key: req.params.key, value: settings[req.params.key] });
  });

  /** 更新单个设置 */
  app.put('/api/settings/:key', (req, res) => {
    settings[req.params.key] = req.body.value;
    saveSettings();
    res.json({ success: true });
  });

  /** 批量更新设置 */
  app.put('/api/settings', (req, res) => {
    Object.assign(settings, req.body);
    saveSettings();
    res.json({ success: true });
  });

  // ========== 权限 API ==========

  app.get('/api/permissions', (req, res) => {
    res.json(permissionManager.getPermissionConfig());
  });

  app.get('/api/permissions/roles', (req, res) => {
    res.json(permissionManager.getRoles());
  });

  app.put('/api/permissions', (req, res) => {
    try {
      permissionManager.updatePermissionConfig(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== 健康检查 ==========
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 启动服务器
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`[API 服务器] 已启动: http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = { createServer };
