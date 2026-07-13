// @ts-nocheck
import { EventEmitter } from 'events';
import { confirmationBus, ConfirmationResult } from './confirmation-bus';

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
  onRequiresConfirmation: (cmd: string, riskLevel: string, msg: string, confirmationId: string) => void;
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

  async run(context: AgentContext): Promise<string> {
    const { modelManager, sandbox, memoryStore, onChunk, onRequiresConfirmation } = this.deps;
    
    let loopCount = 0;
    let finalMergedResponse = '';

    while (loopCount < this.maxRecursion) {
      loopCount++;
      if (context.signal.aborted) throw new Error('AbortError');
      
      // Open Question 1: 上下文超长截断保护
      const contextStr = JSON.stringify(context.messages);
      if (contextStr.length > 30000) {
        onChunk(`\n\n> ⚠️ **[系统警告]** 累计上下文长度过大 (${contextStr.length} 字符)，截断最旧的 Agent 观察记录。\n\n`);
        // 简单截断：保留 system prompt 和最新的 5 条记录
        if (context.messages.length > 6) {
          const systemMsg = context.messages[0];
          context.messages = [systemMsg, ...context.messages.slice(-5)];
        }
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

      finalMergedResponse += accumulatedReply + '\n\n';

      // 标准化工具拦截器
      let cmdToExecute = null;
      let toolName = '';
      let isFileRead = false;
      let filePath = '';

      // 1. 拦截传统的沙盒 <execute> 命令
      const execMatch = accumulatedReply.match(/<execute>([\s\S]*?)<\/execute>/i);
      if (execMatch) {
        cmdToExecute = execMatch[1].trim();
        toolName = 'sandbox.execute';
      }
      
      // 2. 拦截 Hermes 风格的 JSON Tool Call
      if (!cmdToExecute) {
        const toolMatch = accumulatedReply.match(/```json\s*(\{[\s\S]*?"tool"[\s\S]*?\})\s*```/);
        const rawJsonMatch = accumulatedReply.match(/(\{[\s\S]*?"tool"\s*:\s*"[^"]+"[\s\S]*\})/);
        let payload = null;
        if (toolMatch) {
          try { payload = JSON.parse(toolMatch[1]); } catch(e) {}
        } else if (rawJsonMatch) {
          try { payload = JSON.parse(rawJsonMatch[1]); } catch(e) {}
        }

        if (payload) {
          if (payload.tool === 'run_command' && payload.args?.command) {
            cmdToExecute = payload.args.command;
            toolName = 'sandbox.execute';
          } else if (payload.tool === 'Fs.readFile' && payload.args?.path) {
            isFileRead = true;
            filePath = payload.args.path;
            toolName = 'Fs.readFile';
          }
        }
      }

      // 执行拦截到的文件读取
      if (isFileRead) {
        onChunk(`\n\n> 🤖 **[Agent 执行]** 正在读取文件: \`${filePath}\` ...\n`);
        let outputText = '';
        try {
          const fs = require('fs');
          if (fs.existsSync(filePath)) {
            const fileContent = fs.readFileSync(filePath, 'utf8');
            outputText = `File Content:\n${fileContent.substring(0, 3000)}`;
            onChunk(`> ✅ **[Agent 观察]** 读取成功，正在思考下一步...\n\n`);
          } else {
            outputText = `Error: File not found at path: ${filePath}`;
            onChunk(`> ❌ **[Agent 错误]** 文件不存在...\n\n`);
          }
        } catch (e: any) {
          outputText = `Error reading file: ${e.message}`;
          onChunk(`> ❌ **[Agent 错误]** 读取异常...\n\n`);
        }
        
        context.messages.push({ role: 'assistant', content: accumulatedReply });
        context.messages.push({ role: 'user', content: `[Agent Observation]:\n${outputText}\n请基于此观察结果继续完成任务，如果已完成请直接回答。` });
        continue;
      }

      // 执行拦截到的命令
      if (cmdToExecute && toolName === 'sandbox.execute') {
        try {
          const execResult = await sandbox.execute(cmdToExecute, { timeout: 15000 });
          
          if (execResult.needsConfirmation) {
            // S5：挂起等待用户确认，避免直接 return 导致 Agent 循环断裂（同上下文续跑，非从零重跑）
            const decision = await this._awaitConfirmation(
              cmdToExecute,
              execResult.riskLevel,
              execResult.message || '高危系统命令'
            );

            if (decision.decision === 'rejected' || decision.decision === 'timeout') {
              onChunk(`\n\n> 🚫 **[Agent 观察]** 命令被拒绝执行，正在重新思考策略...\n\n`);
              context.messages.push({ role: 'assistant', content: accumulatedReply });
              context.messages.push({
                role: 'user',
                content: `[Agent Observation]:\n用户拒绝了命令 \`${cmdToExecute}\` 的执行（风险：${execResult.riskLevel}）。请据此调整策略，或向用户说明情况。`,
              });
              continue;
            }

            // 确认：本地执行命令，结果作为 observation 回灌，续跑循环
            onChunk(`\n\n> 🤖 **[Agent 执行]** 正在运行沙盒指令: \`${cmdToExecute}\` ...\n`);
            const confirmedResult = await sandbox.executeConfirmed(
              cmdToExecute,
              decision.permanent,
              { timeout: 15000 }
            );
            let outputText = confirmedResult.stdout || confirmedResult.stderr || '执行成功，无终端输出';
            if (outputText.length > 2000) outputText = outputText.slice(0, 2000) + '\n... (内容过长已截断)';
            onChunk(`> ✅ **[Agent 观察]** 执行完成，正在思考下一步...\n\n`);
            context.messages.push({ role: 'assistant', content: accumulatedReply });
            context.messages.push({
              role: 'user',
              content: `[Agent Observation]:\n命令已执行（风险：${execResult.riskLevel}）。\nstdout:\n${outputText}\nstderr:\n${confirmedResult.stderr || ''}\n退出码: ${confirmedResult.exitCode ?? -1}\n请基于结果继续。`,
            });
            continue;
          }

          onChunk(`\n\n> 🤖 **[Agent 执行]** 正在运行沙盒指令: \`${cmdToExecute}\` ...\n`);
          let outputText = execResult.stdout || execResult.stderr || '执行成功，无终端输出';
          if (outputText.length > 2000) outputText = outputText.slice(0, 2000) + '\n... (内容过长已截断)';
          
          onChunk(`> ✅ **[Agent 观察]** 执行完成，正在思考下一步...\n\n`);
          
          context.messages.push({ role: 'assistant', content: accumulatedReply });
          context.messages.push({ role: 'user', content: `[Agent Observation]:\n${outputText}\n请基于此观察结果继续完成任务，如果已完成请直接回答。` });
          
          continue; // 继续下一次循环
        } catch (e: any) {
          onChunk(`\n\n> 🤖 **[Agent 执行]** 正在运行沙盒指令: \`${cmdToExecute}\` ...\n`);
          onChunk(`> ❌ **[Agent 错误]** 执行失败，尝试重新修正策略...\n\n`);
          
          if (this.deps.evolutionEngine && loopCount === this.maxRecursion - 1) {
            onChunk(`> 🧠 **[系统警告]** 连续失败，即将触发深度自进化反思机制...\n\n`);
            const evolveResult = await this.deps.evolutionEngine.evolve(e.message, cmdToExecute);
            onChunk(evolveResult + '\n\n');
          }

          context.messages.push({ role: 'assistant', content: accumulatedReply });
          context.messages.push({ role: 'user', content: `[Agent Error]: ${e.message}\n请向用户说明情况，或尝试换一种命令和策略解决该问题。` });
          
          continue; // 继续下一次循环
        }
      }

      // 如果没有拦截到任何工具，证明任务结束
      return finalMergedResponse;
    }

    return finalMergedResponse + "\n\n> 🛑 [系统中断] Agent 思考已达到最大深度限制，强制停止。";
  }

  /**
   * S5：生成 confirmationId 并挂起等待用户确认决策。
   * 通过 onRequiresConfirmation 回调把请求下发渲染层，返回 Promise 由 ConfirmationBus 唤醒。
   */
  private async _awaitConfirmation(cmd: string, riskLevel: string, message: string): Promise<ConfirmationResult> {
    const { id, promise } = confirmationBus.wait();
    this.deps.onRequiresConfirmation(cmd, riskLevel, message, id);
    return promise;
  }
}
