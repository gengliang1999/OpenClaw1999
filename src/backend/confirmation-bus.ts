import { v4 as uuidv4 } from 'uuid';

export type ConfirmationDecision = 'confirmed' | 'rejected' | 'timeout';

export interface ConfirmationResult {
  decision: ConfirmationDecision;
  permanent: boolean;
}

type Resolver = (result: ConfirmationResult) => void;

interface PendingEntry {
  resolver: Resolver;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * S5：确认总线。
 * 解耦「IPC 处理器」与「挂起的 agent-loop」：
 *  - agent-loop 在 needsConfirmation 时调用 wait() 生成 confirmationId 并 await；
 *  - 渲染端用户决策经 IPC 抵达后，由 ipc-handlers 调用 resolve(id) 唤醒对应 await。
 * 默认 5 分钟超时，超时按「拒绝」处理（避免 Agent 永久挂起）。
 */
export class ConfirmationBus {
  private pending = new Map<string, PendingEntry>();
  private readonly defaultTimeoutMs: number;

  constructor(defaultTimeoutMs: number = 5 * 60 * 1000) {
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  /**
   * 挂起等待一次确认决策。返回 confirmationId 与 Promise。
   */
  wait(timeoutMs?: number): { id: string; promise: Promise<ConfirmationResult> } {
    const id = uuidv4();
    const promise = new Promise<ConfirmationResult>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        resolve({ decision: 'timeout', permanent: false });
      }, timeoutMs ?? this.defaultTimeoutMs);
      this.pending.set(id, { resolver: resolve, timer });
    });
    return { id, promise };
  }

  /**
   * 回灌用户决策，唤醒挂起的 agent-loop。
   * @returns 是否成功唤醒（id 存在且未超时）
   */
  resolve(id: string, result: ConfirmationResult): boolean {
    const entry = this.pending.get(id);
    if (!entry) return false;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    entry.resolver(result);
    return true;
  }
}

/** 主进程单例，贯穿 agent-loop 与 ipc-handlers 的生命周期 */
export const confirmationBus = new ConfirmationBus();
