import * as fs from 'fs';
import * as path from 'path';

export interface TokenUsageRecord {
  id: string;
  timestamp: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCostUSD: number;
  convId?: string;
}

export interface TokenStats {
  todayPromptTokens: number;
  todayCompletionTokens: number;
  todayTotalTokens: number;
  todayCostUSD: number;
  allTimeTotalTokens: number;
  allTimeCostUSD: number;
  dailyBudgetLimit: number;
  isOverBudget: boolean;
}

// 常见模型单价配置 (每 1k Token / USD)
const PRICING_TABLE: Record<string, { prompt: number; completion: number }> = {
  'gpt-4o': { prompt: 0.0025, completion: 0.01 },
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'claude-3-5-sonnet': { prompt: 0.003, completion: 0.015 },
  'claude-3-haiku': { prompt: 0.00025, completion: 0.00125 },
  'deepseek-chat': { prompt: 0.00014, completion: 0.00028 },
  'deepseek-coder': { prompt: 0.00014, completion: 0.00028 },
  'default': { prompt: 0.0015, completion: 0.003 }
};

export class TokenTracker {
  private logPath: string;
  private records: TokenUsageRecord[] = [];
  private dailyBudgetLimit: number = 1000000; // 默认 1M tokens

  constructor(customPath?: string) {
    const defaultDir = path.join(process.env.USERPROFILE || process.env.HOME || '.', '.openclaw', 'stats');
    this.logPath = customPath || path.join(defaultDir, 'token-usage.json');
    this.init();
  }

  private init() {
    try {
      const dir = path.dirname(this.logPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      if (fs.existsSync(this.logPath)) {
        const raw = fs.readFileSync(this.logPath, 'utf-8');
        this.records = JSON.parse(raw);
      }
    } catch {
      this.records = [];
    }
  }

  private save() {
    try {
      if (this.records.length > 5000) {
        this.records = this.records.slice(-5000);
      }
      fs.writeFileSync(this.logPath, JSON.stringify(this.records, null, 2), 'utf-8');
    } catch (e) {
      console.error('[TokenTracker] 保存失败:', e);
    }
  }

  public calculateCost(modelId: string, promptTokens: number, completionTokens: number): number {
    const key = Object.keys(PRICING_TABLE).find(k => modelId.toLowerCase().includes(k)) || 'default';
    const pricing = PRICING_TABLE[key];
    const cost = (promptTokens / 1000) * pricing.prompt + (completionTokens / 1000) * pricing.completion;
    return Number(cost.toFixed(6));
  }

  public recordUsage(
    modelId: string,
    promptTokens: number,
    completionTokens: number,
    convId?: string
  ): TokenUsageRecord {
    const totalTokens = promptTokens + completionTokens;
    const estimatedCostUSD = this.calculateCost(modelId, promptTokens, completionTokens);
    const record: TokenUsageRecord = {
      id: Math.random().toString(36).substring(2, 11),
      timestamp: new Date().toISOString(),
      modelId,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedCostUSD,
      convId
    };

    this.records.push(record);
    this.save();
    return record;
  }

  public setDailyBudgetLimit(limitTokens: number) {
    this.dailyBudgetLimit = limitTokens;
  }

  public getStats(): TokenStats {
    const todayStr = new Date().toISOString().slice(0, 10);
    let todayPromptTokens = 0;
    let todayCompletionTokens = 0;
    let todayTotalTokens = 0;
    let todayCostUSD = 0;

    let allTimeTotalTokens = 0;
    let allTimeCostUSD = 0;

    for (const r of this.records) {
      allTimeTotalTokens += r.totalTokens;
      allTimeCostUSD += r.estimatedCostUSD;

      if (r.timestamp.startsWith(todayStr)) {
        todayPromptTokens += r.promptTokens;
        todayCompletionTokens += r.completionTokens;
        todayTotalTokens += r.totalTokens;
        todayCostUSD += r.estimatedCostUSD;
      }
    }

    return {
      todayPromptTokens,
      todayCompletionTokens,
      todayTotalTokens,
      todayCostUSD: Number(todayCostUSD.toFixed(4)),
      allTimeTotalTokens,
      allTimeCostUSD: Number(allTimeCostUSD.toFixed(4)),
      dailyBudgetLimit: this.dailyBudgetLimit,
      isOverBudget: todayTotalTokens >= this.dailyBudgetLimit
    };
  }
}

export const tokenTracker = new TokenTracker();
