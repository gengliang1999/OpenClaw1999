"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmationBus = exports.ConfirmationBus = void 0;
const uuid_1 = require("uuid");
/**
 * S5：确认总线。
 * 解耦「IPC 处理器」与「挂起的 agent-loop」：
 *  - agent-loop 在 needsConfirmation 时调用 wait() 生成 confirmationId 并 await；
 *  - 渲染端用户决策经 IPC 抵达后，由 ipc-handlers 调用 resolve(id) 唤醒对应 await。
 * 默认 5 分钟超时，超时按「拒绝」处理（避免 Agent 永久挂起）。
 */
class ConfirmationBus {
    pending = new Map();
    defaultTimeoutMs;
    constructor(defaultTimeoutMs = 5 * 60 * 1000) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }
    /**
     * 挂起等待一次确认决策。返回 confirmationId 与 Promise。
     */
    wait(timeoutMs) {
        const id = (0, uuid_1.v4)();
        const promise = new Promise((resolve) => {
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
    resolve(id, result) {
        const entry = this.pending.get(id);
        if (!entry)
            return false;
        clearTimeout(entry.timer);
        this.pending.delete(id);
        entry.resolver(result);
        return true;
    }
}
exports.ConfirmationBus = ConfirmationBus;
/** 主进程单例，贯穿 agent-loop 与 ipc-handlers 的生命周期 */
exports.confirmationBus = new ConfirmationBus();
