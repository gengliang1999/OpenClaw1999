"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistentJobQueue = void 0;
class PersistentJobQueue {
    memoryStore;
    constructor(memoryStore) {
        this.memoryStore = memoryStore;
    }
    /**
     * 将后台任务投递并持久化入库
     * @param taskType - 任务类别
     * @param payload - 任务荷载参数
     */
    enqueue(taskType, payload) {
        return this.memoryStore.addJob(taskType, payload);
    }
    /**
     * 拉取所有 pending 或等待重试的任务
     */
    getPendingJobs() {
        return this.memoryStore.getPendingJobs();
    }
    /**
     * 更新任务在 SQLite 中的物理状态
     */
    updateJobStatus(id, status, error = null, retryCount = 0) {
        this.memoryStore.updateJobStatus(id, status, error, retryCount);
    }
    /**
     * 彻底删除任务
     */
    deleteJob(id) {
        this.memoryStore.deleteJob(id);
    }
}
exports.PersistentJobQueue = PersistentJobQueue;
