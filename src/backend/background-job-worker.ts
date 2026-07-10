import { PersistentJobQueue, Job } from './persistent-job-queue';

export type JobHandler = (payload: any) => Promise<void>;

export class BackgroundJobWorker {
  private handlers = new Map<string, JobHandler>();
  private isProcessing = false;
  private timer: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private queue: PersistentJobQueue,
    private memoryStore: any
  ) {}

  /**
   * 注册任务处理器
   */
  registerHandler(taskType: string, handler: JobHandler) {
    this.handlers.set(taskType, handler);
  }

  /**
   * 启动后台轮询工作协程
   * @param intervalMs - 轮询间隔（默认 5 秒）
   */
  start(intervalMs = 5000) {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Job Worker] 🚀 持久化后台任务守护进程已启动...');

    // 引导恢复：重置由于意外崩溃挂起的 'processing' 状态任务
    this.recoverSuspendedJobs();

    this.timer = setInterval(() => {
      this.tick();
    }, intervalMs);

    // 立即执行一次 tick
    setImmediate(() => this.tick());
  }

  /**
   * 关闭轮询协程
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.isRunning = false;
    console.log('[Job Worker] 🛑 后台任务守护进程已停止。');
  }

  /**
   * 重置由于意外死机导致悬挂在 processing 状态的作业
   */
  private recoverSuspendedJobs() {
    try {
      this.memoryStore.db.run(
        "UPDATE background_jobs SET status = 'pending', last_error = 'Host process killed unexpectedly' WHERE status = 'processing'"
      );
      this.memoryStore._save();
      console.log('[Job Worker] 🛡️ 进程崩溃守护：已重置所有意外中断的悬挂作业为 pending');
    } catch (e: any) {
      console.error('[Job Worker] 崩溃恢复操作失败:', e.message);
    }
  }

  /**
   * 轮询并消费待处理队列
   */
  private async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const pendingJobs = this.queue.getPendingJobs();
      if (pendingJobs.length === 0) return;

      const backoffSeconds = [5, 15, 45]; // 重试指数退避间隔

      for (const job of pendingJobs) {
        if (!this.isRunning) break;

        // 如果是处于 retry 状态，计算退避时间是否已过
        if (job.status === 'retry') {
          const delay = backoffSeconds[job.retry_count - 1] || 45;
          const timePassed = (Date.now() - new Date(job.updated_at).getTime()) / 1000;
          if (timePassed < delay) {
            continue; // 未到重试窗口，跳过
          }
        }

        await this.executeJob(job);
      }
    } catch (err: any) {
      console.error('[Job Worker] 轮询执行循环报错:', err.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 单个任务的安全执行与重试编排
   */
  private async executeJob(job: Job) {
    const handler = this.handlers.get(job.task_type);
    if (!handler) {
      console.error(`[Job Worker] ❌ 未注册任务 [${job.task_type}] 的处理器，跳过任务`);
      this.queue.updateJobStatus(job.id, 'failed', `No handler registered for task_type: ${job.task_type}`);
      return;
    }

    console.log(`[Job Worker] ⏳ 正在消费作业 [${job.task_type}] ID: ${job.id}`);
    this.queue.updateJobStatus(job.id, 'processing');

    try {
      await handler(job.payload);
      // 执行成功，彻底删除任务释放数据库空间
      this.queue.deleteJob(job.id);
      console.log(`[Job Worker] 🎉 作业消费成功并出队 [${job.task_type}] ID: ${job.id}`);
    } catch (err: any) {
      const nextRetryCount = job.retry_count + 1;
      const lastError = err.message || String(err);

      if (nextRetryCount >= 3) {
        // 重试耗尽，宣告死亡进入 failed 状态，不再重试
        console.error(`[Job Worker] 🚨 作业 [${job.task_type}] ID: ${job.id} 重试次数耗尽，宣告失败！原因: ${lastError}`);
        this.queue.updateJobStatus(job.id, 'failed', lastError, nextRetryCount);
      } else {
        // 进入 retry 状态，等待指数退避窗口
        console.warn(`[Job Worker] ⚠️ 作业 [${job.task_type}] ID: ${job.id} 发生异常，进入下一次重试调度。当前重试次数: ${nextRetryCount}, 异常: ${lastError}`);
        this.queue.updateJobStatus(job.id, 'retry', lastError, nextRetryCount);
      }
    }
  }
}
