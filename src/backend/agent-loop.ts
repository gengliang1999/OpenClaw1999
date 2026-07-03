// @ts-nocheck
import { EventEmitter } from 'events';

export interface AgentContext {
  convId: string;
  messages: any[];
  modelId: string;
  temperature: number;
  signal: AbortSignal;
}

export interface AgentDependencies {
  modelManager: any;
  sandbox: any;
  memoryStore: any;
  evolutionEngine?: any;
  onChunk: (chunk: string) => void;
  onRequiresConfirmation: (cmd: string, riskLevel: string, msg: string) => void;
}

/**
 * 核心任务代理引擎 (Jarvis ReAct Loop)
 * 职责：接管大模型流式输出，拦截 <execute> 或 ```json Function Calling，
 * 放入沙盒执行，并将观察结果喂给大模型进行下一轮思考。
 */
export class AgentLoop extends EventEmitter {
  private maxRecursion = 3;
  
  constructor(private deps: AgentDependencies) {
    super();
  }

  async run(context: AgentContext, recursionCount = 0): Promise<string> {
    const { modelManager, sandbox, memoryStore, onChunk, onRequiresConfirmation } = this.deps;
    
    if (context.signal.aborted) throw new Error('AbortError');
    if (recursionCount >= this.maxRecursion) {
      return "\n\n> 🛑 [系统中断] Agent 思考已达到最大深度限制，强制停止。";
    }

    let accumulatedReply = '';
    const fullReply = await modelManager.chatStream(
      context.messages, 
      { modelId: context.modelId, temperature: context.temperature, signal: context.signal, agentMode: true }, 
      (chunk: string) => {
        accumulatedReply += chunk;
        onChunk(chunk);
      }
    );

    // 标准化工具拦截器：兼容 Hermes JSON 调用与 OpenClaw 传统 XML
    let cmdToExecute = null;
    let toolName = '';

    // 1. 拦截传统的沙盒 <execute> 命令
    const execMatch = accumulatedReply.match(/<execute>([\s\S]*?)<\/execute>/i);
    if (execMatch) {
      cmdToExecute = execMatch[1].trim();
      toolName = 'sandbox.execute';
    }
    
    // 2. 拦截 Hermes 风格的 JSON Tool Call (兜底容错)
    if (!cmdToExecute) {
      const toolMatch = accumulatedReply.match(/```json\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/);
      if (toolMatch) {
        try {
          const payload = JSON.parse(toolMatch[1]);
          if (payload.tool === 'run_command' && payload.args?.command) {
            cmdToExecute = payload.args.command;
            toolName = 'sandbox.execute';
          }
        } catch (e) {}
      }
    }

    // 执行拦截到的工具
    if (cmdToExecute && toolName === 'sandbox.execute') {
      try {
        const execResult = await sandbox.execute(cmdToExecute, { timeout: 15000 });
        
        // 触发安全警报：Human-in-the-loop
        if (execResult.needsConfirmation) {
          onRequiresConfirmation(cmdToExecute, execResult.riskLevel, execResult.message || '高危系统命令');
          memoryStore.saveMessage(context.convId, 'assistant', accumulatedReply);
          return accumulatedReply;
        }

        onChunk(`\n\n> 🤖 **[Agent 执行]** 正在运行沙盒指令: \`${cmdToExecute}\` ...\n`);
        let outputText = execResult.stdout || execResult.stderr || '执行成功，无终端输出';
        if (outputText.length > 2000) outputText = outputText.slice(0, 2000) + '\n... (内容过长已截断)';
        
        onChunk(`> ✅ **[Agent 观察]** 执行完成，正在思考下一步...\n\n`);
        
        context.messages.push({ role: 'assistant', content: accumulatedReply });
        context.messages.push({ role: 'user', content: `[Agent Observation]:\n${outputText}\n请基于此观察结果继续完成任务，如果已完成请直接回答。` });
        
        return accumulatedReply + '\n\n' + await this.run(context, recursionCount + 1);
      } catch (e: any) {
        onChunk(`\n\n> 🤖 **[Agent 执行]** 正在运行沙盒指令: \`${cmdToExecute}\` ...\n`);
        onChunk(`> ❌ **[Agent 错误]** 执行失败，尝试重新修正策略...\n\n`);
        
        // [Task 4.1] 触发自进化反思
        if (this.deps.evolutionEngine && recursionCount === this.maxRecursion - 1) {
          onChunk(`> 🧠 **[系统警告]** 连续失败，即将触发深度自进化反思机制...\n\n`);
          const evolveResult = await this.deps.evolutionEngine.evolve(e.message, cmdToExecute);
          onChunk(evolveResult + '\n\n');
        }

        context.messages.push({ role: 'assistant', content: accumulatedReply });
        context.messages.push({ role: 'user', content: `[Agent Error]: ${e.message}\n请向用户说明情况，或尝试换一种命令和策略解决该问题。` });
        
        return accumulatedReply + '\n\n' + await this.run(context, recursionCount + 1);
      }
    }

    return accumulatedReply;
  }
}
