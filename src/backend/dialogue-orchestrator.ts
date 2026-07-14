import { MemoryEngine } from './memory-engine';
import { AgentLoop } from './agent-loop';
import { EvolutionEngine } from './evolution-engine';

export interface DialogueDependencies {
  modelManager: any;
  memoryStore: any;
  sandbox: any;
  dataDir: string;
  mainWindowRef: () => any;
  jobQueue?: any;
}

/**
 * 统一对话上下文调度器 (Context Aggregator)
 * 作为深模块，彻底接管从 IPC 收到的原始对话意图，负责历史滑窗压缩、多路 RAG 融合检索、
 * 组装大模型 Prompt 并调度 AgentLoop 循环。
 */
export class ContextAggregator {
  constructor(private deps: DialogueDependencies) {}

  public async executeChatStream(payload: any, signal: AbortSignal) {
    const { conversationId, message, attachment, modelId, systemPrompt, temperature } = payload;
    const { modelManager, memoryStore, sandbox, dataDir, mainWindowRef, jobQueue } = this.deps;
    const mainWindow = mainWindowRef();
    if (!mainWindow) throw new Error('主窗口未就绪');

    // 1. 初始化对话或补齐 ID
    let convId = conversationId;
    if (!convId) {
      const conv = memoryStore.createConversation('新对话');
      convId = conv.id;
      mainWindow.webContents.send('api:chat:chunk', { type: 'conversation', id: convId });
    }

    let finalContent = message;
    if (attachment) {
      const isTextAttachment = attachment.toLowerCase().endsWith('.txt') || 
                               attachment.toLowerCase().includes('temp_attachments');
      if (isTextAttachment) {
        try {
          const fs = require('fs');
          const path = require('path');
          const cleanPath = attachment.replace(/^file:\/\/\//i, '').replace(/\//g, path.sep);
          if (fs.existsSync(cleanPath)) {
            const fileText = fs.readFileSync(cleanPath, 'utf8');
            const { ragEngine } = require('./rag-engine');
            const fileName = path.basename(cleanPath);
            ragEngine.addDocument(convId, fileName, fileText);
            console.log(`[对话枢纽] 成功将非图片富文本附件灌入 RagEngine: ${fileName}`);
          }
        } catch (e: any) {
          console.error('[对话枢纽] 读取非图片富文本附件灌入 RagEngine 失败:', e.message);
        }
        finalContent = message;
      } else {
        finalContent = [
          { type: 'text', text: message },
          { type: 'image_url', image_url: { url: attachment } }
        ];
      }
    }
    memoryStore.saveMessage(convId, 'user', finalContent);

    // 2. 获取并压缩历史上下文（动态滑窗策略）
    let history = memoryStore.getConversationHistory(convId);
    const MAX_RECENT = 12;
    let historySummaryPrefix = '';
    
    if (history.length > MAX_RECENT) {
      const olderMessages = history.slice(0, history.length - MAX_RECENT);
      const recentMessages = history.slice(history.length - MAX_RECENT);
      
      const olderTranscript = olderMessages
        .map((m: any) => `${m.role === 'user' ? '用户' : 'AI'}：${(typeof m.content === 'string' ? m.content : '[多模态内容]').slice(0, 150)}`)
        .join('\n');
      
      if (olderMessages.length > 10) {
        try {
          const summaryResult = await modelManager.chat([
            { role: 'system', content: '请用 3-5 句话精炼总结以下对话历史的要点，仅保留关键信息。直接输出摘要文本，不要加任何前缀。' },
            { role: 'user', content: olderTranscript }
          ], { temperature: 0.2 });
          historySummaryPrefix = `\n\n[本次对话的早期历史摘要：]\n${summaryResult}`;
        } catch (e) {
          historySummaryPrefix = `\n\n[本次对话的早期历史摘要：]\n${olderTranscript.slice(0, 500)}...`;
        }
      } else {
        historySummaryPrefix = `\n\n[本次对话的早期历史摘要：]\n${olderTranscript}`;
      }
      history = recentMessages;
    }
    
    let messages = history.map((m: any, index: number) => {
      let content = m.content;
      let parsed = null;
      
      if (typeof content === 'string' && content.startsWith('[')) {
        try {
          parsed = JSON.parse(content);
        } catch (e) {}
      } else if (Array.isArray(content)) {
        parsed = content;
      }
      
      if (parsed) {
        if (index < history.length - 1) {
          const textBlock = parsed.find((c: any) => c.type === 'text');
          content = textBlock ? textBlock.text : '[历史图片]';
        } else {
          content = parsed;
        }
      }
      
      return { role: m.role, content: content };
    });

    // 3. 构建超级 Prompt 并执行多路召回融合与预算裁剪
    const { RetrievalOrchestrator } = require('./retrieval-orchestrator');
    const orchestrator = new RetrievalOrchestrator(modelManager, memoryStore, dataDir);

    let augmentedSystemPrompt = systemPrompt || '你是一个有用的、无所不知的人工智能助手。';
    
    // 无条件将标记为置顶（is_pinned = 1）的长期记忆作为常驻最高系统指令注入，防止遗忘
    try {
      const pinnedMemories = memoryStore.getPinnedMemories();
      if (pinnedMemories && pinnedMemories.length > 0) {
        const pinnedContext = pinnedMemories.map((m: any) => `- ${m.content}`).join('\n');
        augmentedSystemPrompt += `\n\n[常驻系统契约指令（最高优先级，必须绝对遵守）：]\n${pinnedContext}`;
      }
    } catch (e: any) {
      console.warn('[DialogueOrchestrator] 获取置顶记忆失败:', e.message);
    }

    if (historySummaryPrefix) {
      augmentedSystemPrompt += historySummaryPrefix;
    }

    const retrievalAugmentation = await orchestrator.retrieveAndOrchestrate(message, convId);
    augmentedSystemPrompt += retrievalAugmentation;

    const memoryEngine = new MemoryEngine(modelManager, memoryStore, dataDir);
    if (memoryEngine.supportsToolCall()) {
      augmentedSystemPrompt += `\n\n[长期记忆能力]: 你拥有 save_memory 和 search_memory 工具，当你发现用户或你自己（AI助手，例如用户给你起的名字、对你的角色定位）的持久性事实、偏好或习惯时，请主动调用 save_memory 工具保存。`;
    } else {
      augmentedSystemPrompt += `\n\n[长期记忆能力]: 当你在对话中获取了关于用户或你自己（AI助手，例如用户给你起的名字、对你的角色定位或设定）的持久性事实、偏好或习惯时，请在回复的最后加上 \`[SAVE_MEMORY|分类] 事实内容\`。分类可选：个人信息、技术偏好、工作项目、兴趣爱好、通用。例如：\`[SAVE_MEMORY|技术偏好] 用户喜欢使用 TypeScript\` 或 \`[SAVE_MEMORY|个人信息] 用户把AI的名字起为小爪\`。`;
    }

    const toolPrompt = `\n\n[系统能力]: 你拥有沙盒环境执行能力。如果用户要求运行脚本、查看本地环境、读取文件、操作目录等，请直接输出 <execute>具体的系统命令</execute> 。你会自动收到命令执行结果，并基于结果继续回答。请不要在执行前编造执行结果。`;
    augmentedSystemPrompt += toolPrompt;
    messages.unshift({ role: 'system', content: augmentedSystemPrompt });

    // 4. 驱动 Agent 思考与流式输出
    const evolutionEngine = new EvolutionEngine(dataDir, memoryStore, modelManager);
    const agentLoop = new AgentLoop({
      modelManager,
      sandbox,
      memoryStore,
      evolutionEngine,
      onChunk: (chunk: string) => {
        mainWindow.webContents.send('api:chat:chunk', { type: 'chunk', content: chunk });
      },
      onRequiresConfirmation: (cmd: string, riskLevel: string, msg: string, confirmationId: string) => {
        mainWindow.webContents.send('api:chat:chunk', { 
          type: 'requires_confirmation', 
          command: cmd,
          riskLevel: riskLevel,
          message: msg,
          confirmationId: confirmationId,
          conversationId: convId
        });
      }
    });

    const finalReply = await agentLoop.run({
      convId,
      messages,
      modelId,
      temperature,
      signal
    });

    // 5. 收尾清洗与异步自愈分发
    const cleanReply = finalReply
      .replace(/\[SAVE_MEMORY\|[^\]]*\]\s*[^。！？\r\n]*[。！？]?/g, '')
      .replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '')
      .trim();
    memoryStore.saveMessage(convId, 'assistant', cleanReply);
    mainWindow.webContents.send('api:chat:chunk', { type: 'done', conversationId: convId });

    if (jobQueue) {
      jobQueue.enqueue('memory-extraction', { replyText: finalReply });
      console.log('[对话枢纽] 已将后台记忆抽取作业持久化投递至 PersistentJobQueue');
    } else {
      setImmediate(async () => {
        try {
          await memoryEngine.processMemoryExtractionAsync(finalReply);
          console.log('[记忆引擎] 后台异步记忆处理完成 (内存降级模式)');
        } catch (e) {
          console.error('[记忆引擎] 后台异步处理失败 (内存降级模式):', e);
        }
      });
    }
  }
}
