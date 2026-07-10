export interface Job {
  id: string;
  task_type: string;
  payload: any;
  status: 'pending' | 'processing' | 'retry' | 'completed' | 'failed';
  retry_count: number;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export class PersistentJobQueue {
  constructor(private memoryStore: any) {}

  /**
   * 将后台任务投递并持久化入库
   * @param taskType - 任务类别
   * @param payload - 任务荷载参数
   */
  enqueue(taskType: string, payload: any): Job {
    return this.memoryStore.addJob(taskType, payload);
  }

  /**
   * 拉取所有 pending 或等待重试的任务
   */
  getPendingJobs(): Job[] {
    return this.memoryStore.getPendingJobs();
  }

  /**
   * 更新任务在 SQLite 中的物理状态
   */
  updateJobStatus(id: string, status: Job['status'], error: string | null = null, retryCount: number = 0) {
    this.memoryStore.updateJobStatus(id, status, error, retryCount);
  }

  /**
   * 彻底删除任务
   */
  deleteJob(id: string) {
    this.memoryStore.deleteJob(id);
  }
}
