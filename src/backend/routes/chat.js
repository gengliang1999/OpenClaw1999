const express = require('express');

module.exports = function(dependencies) {
  const router = express.Router();
  const { memoryStore, modelManager, sandbox } = dependencies;

/** 发送聊天消息（非流式） */
  router.post('/', async (req, res) => {
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
  router.post('/stream', async (req, res) => {
    try {
      const { conversationId, message, attachment, modelId, systemPrompt, temperature } = req.body;
      console.log(`[API /api/chat/stream] Body:`, { conversationId, message: message ? '...text...' : null, attachment: attachment ? '...image...' : null, modelId, temperature });
      
      if (!message && !attachment) return res.status(400).json({ message: '消息不能为空' });

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
      if (history.length > 20) history = history.slice(history.length - 20);
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
        } catch(e) {}
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
  router.get('/conversations', (req, res) => {
    try {
      const conversations = memoryStore.getConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 创建新对话 */
  router.post('/conversations', (req, res) => {
    try {
      const { title } = req.body;
      const conv = memoryStore.createConversation(title || '新对话');
      res.json(conv);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 删除对话 */
  router.delete('/conversations/:id', (req, res) => {
    try {
      memoryStore.deleteConversation(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取聊天历史 */
  router.get('/history', (req, res) => {
    try {
      const { conversationId } = req.query;
      const history = memoryStore.getConversationHistory(conversationId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 清空聊天历史 */
  router.delete('/history', (req, res) => {
    try {
      const { conversationId } = req.query;
      memoryStore.clearHistory(conversationId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 删除单条消息 */
  router.delete('/message/:id', (req, res) => {
    try {
      memoryStore.deleteMessage(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 重命名对话 */
  router.put('/conversations/:id', (req, res) => {
    try {
      const { title } = req.body;
      if (!title) return res.status(400).json({ message: '标题不能为空' });
      memoryStore.renameConversation(req.params.id, title);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 导出对话 */
  router.get('/conversations/:id/export', (req, res) => {
    try {
      const data = memoryStore.exportConversation(req.params.id);
      if (!data) return res.status(404).json({ message: '对话不存在' });
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 移入垃圾篓 */
  router.post('/conversations/:id/trash', (req, res) => {
    try {
      memoryStore.moveToTrash(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取垃圾篓列表 */
  router.get('/trash', (req, res) => {
    try {
      const trash = memoryStore.getTrash();
      res.json(trash);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取垃圾篓数量 */
  router.get('/trash/count', (req, res) => {
    try {
      const count = memoryStore.getTrashCount();
      res.json({ count });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 从垃圾篓恢复 */
  router.post('/trash/:id/restore', (req, res) => {
    try {
      memoryStore.restoreFromTrash(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 永久删除垃圾篓条目 */
  router.delete('/trash/:id', (req, res) => {
    try {
      memoryStore.permanentDelete(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 清空垃圾篓 */
  router.delete('/trash', (req, res) => {
    try {
      memoryStore.emptyTrash();
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  
  return router;
};
