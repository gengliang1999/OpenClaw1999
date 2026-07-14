import { MemoryEngine } from './memory-engine';
import { ragEngine } from './rag-engine';

export interface RetrievalResult {
  source: '用户记忆' | '知识库' | '历史对话' | '实体图谱';
  content: string;
  score?: number;
}

export class RetrievalOrchestrator {
  private memoryEngine: MemoryEngine;

  constructor(
    private modelManager: any,
    private memoryStore: any,
    private dataDir: string
  ) {
    this.memoryEngine = new MemoryEngine(modelManager, memoryStore, dataDir);
  }

  /**
   * 编排合并检索，执行 Token / 字符级预算分配控制
   * @param query - 用户当前输入
   * @param convId - 对话 ID
   * @param maxChars - 允许的最大上下文长度（默认 15000 字符，约 4000-5000 Tokens）
   */
  public async retrieveAndOrchestrate(query: string, convId: string, maxChars = 15000): Promise<string> {
    const gathered: { [key: string]: string[] } = {
      '用户记忆': [],
      '知识库': [],
      '自进化知识': [],
      '历史对话': [],
      '实体图谱': []
    };

    // 1. 三路并发召回 (长期记忆 + 实体关系 + 历史对话召回)
    try {
      const memoryResults = await this.memoryEngine.unifiedRetrieval(query);
      if (memoryResults && memoryResults.length > 0) {
        for (const item of memoryResults) {
          if (gathered[item.source]) {
            gathered[item.source].push(item.content);
          }
        }
      }
    } catch (e: any) {
      console.warn('[Orchestrator] 记忆三路召回发生错误，进行跳过处理:', e.message);
    }

    // 2. 双保险召回 (RAG 检索引擎召回)
    try {
      const ragChunks = ragEngine.searchRelevant(convId, query, 5); // 增加初筛数量以备预算分配
      if (ragChunks && ragChunks.length > 0) {
        for (const chunk of ragChunks) {
          gathered['知识库'].push(`[文本切片: ${chunk.fileName}]\n${chunk.chunkText}`);
        }
      }
    } catch (e: any) {
      console.warn('[Orchestrator] RAG 搜索引擎召回异常:', e.message);
    }

    // 3. 执行 Token 字符预算滑动分配算法
    const budgetRatios: { [key: string]: number } = {
      '知识库': 0.40,
      '自进化知识': 0.15,
      '用户记忆': 0.15,
      '历史对话': 0.15,
      '实体图谱': 0.15
    };

    const budgetLimits: { [key: string]: number } = {};
    for (const key of Object.keys(budgetRatios)) {
      budgetLimits[key] = Math.floor(maxChars * budgetRatios[key]);
    }

    // 统计各部分的实际字符长度
    const actualLengths: { [key: string]: number } = {};
    for (const key of Object.keys(gathered)) {
      actualLengths[key] = gathered[key].join('\n').length;
    }

    // 计算盈余预算 (Under-budget parts)
    let leftoverBudget = 0;
    const overBudgets: string[] = [];

    for (const key of Object.keys(gathered)) {
      if (actualLengths[key] < budgetLimits[key]) {
        leftoverBudget += (budgetLimits[key] - actualLengths[key]);
      } else {
        overBudgets.push(key);
      }
    }

    // 动态把盈余预算均分给超标部分
    if (leftoverBudget > 0 && overBudgets.length > 0) {
      const addedShare = Math.floor(leftoverBudget / overBudgets.length);
      for (const key of overBudgets) {
        budgetLimits[key] += addedShare;
      }
    }

    // 执行滑动截断
    const formattedBlocks: { [key: string]: string } = {};

    for (const key of Object.keys(gathered)) {
      const items = gathered[key];
      if (items.length === 0) continue;

      let combined = '';
      const limit = budgetLimits[key];

      if (key === '知识库') {
        // 知识库按切片逐条装入，装不下则丢弃后面的切片
        for (const item of items) {
          const checkStr = combined ? combined + '\n\n---\n\n' + item : item;
          if (checkStr.length > limit) {
            // 如果单条就超了，做强制剪裁
            if (combined.length === 0) {
              combined = item.substring(0, limit) + '\n...[已超出预算截断]';
            }
            break;
          }
          combined = checkStr;
        }
      } else {
        // 记忆与图谱：按条组合，超预算后截断
        for (const item of items) {
          const itemStr = `- ${item}`;
          const checkStr = combined ? combined + '\n' + itemStr : itemStr;
          if (checkStr.length > limit) {
            if (combined.length === 0) {
              combined = itemStr.substring(0, limit) + '...';
            }
            break;
          }
          combined = checkStr;
        }
      }

      formattedBlocks[key] = combined;
    }

    // 4. 组装增强的 System Prompt Context
    let promptAugmentation = '';

    if (formattedBlocks['用户记忆']) {
      promptAugmentation += `\n\n[用户相关的长期记忆（仅供参考）：]\n${formattedBlocks['用户记忆']}`;
    }
    if (formattedBlocks['自进化知识']) {
      promptAugmentation += `\n\n[系统进化知识（由用户先前记忆晋升而来，可作决策参考）：]\n${formattedBlocks['自进化知识']}`;
    }
    if (formattedBlocks['知识库']) {
      promptAugmentation += `\n\n[参考知识库（RAG 检索到的相关文档）：]\n${formattedBlocks['知识库']}`;
    }
    if (formattedBlocks['历史对话']) {
      promptAugmentation += `\n\n[过去相关的对话回忆：]\n${formattedBlocks['历史对话']}`;
    }
    if (formattedBlocks['实体图谱']) {
      promptAugmentation += `\n\n[相关实体关系：]\n${formattedBlocks['实体图谱']}`;
    }

    return promptAugmentation;
  }
}
