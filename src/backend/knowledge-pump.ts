/**
 * 知识蒸馏泵 (Nightly Knowledge Pump)
 * 挂载至后台的定时采集源探针。爬取到的内容自动推入 IngestionQueueManager 队列进行隔离鉴伪提炼。
 *
 * 安全约束（P0/T5）：默认关闭自动爬网。仅当用户在 settings.json 显式配置
 *   crawlingEnabled: true 且 crawlingSources 非空 时，才按白名单推送外联任务。
 * 任何对外抓取均经 SSRF 防护（由 DataCrawler.crawlUrl 内部 assertSafeUrl 保证），
 * 且此处对每次外联做 append-only 审计记录。
 */
import { setInterval } from 'timers';
import * as path from 'path';
import * as fs from 'fs';

export class KnowledgePump {
  private isRunning = false;
  /** 外联审计日志路径 */
  private auditLogPath: string;

  constructor(
    private modelManager: any,
    private vectorStore: any,
    private baseDataDir: string,
    private queueManager: any
  ) {
    this.auditLogPath = path.join(baseDataDir, 'knowledge-pump-audit.log');
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Knowledge Pump] 🛡️ 知识蒸馏巡逻泵已启动（默认关闭自动爬网，仅当 settings.crawlingEnabled=true 且配置采集源时推送）。');

    // 定时触发自律巡逻（每 6 小时扫描一次）
    setInterval(() => {
      this.pump();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * 追加一行 append-only 审计记录（外联 URL / 时间 / 结果）
   * @private
   */
  private _audit(source: string, result: string): void {
    try {
      const line = `[${new Date().toISOString()}] source=${source} result=${result}\n`;
      fs.appendFileSync(this.auditLogPath, line, 'utf8');
    } catch (e) {
      console.error('[Knowledge Pump] 审计日志写入失败:', e);
    }
  }

  /**
   * 触发自律扫描并将任务推送给队列。
   * 默认 urls=[]（关闭自动爬网）；仅当 settings.crawlingEnabled=true 且 crawlingSources 非空才推送。
   */
  async pump() {
    const settingsPath = path.join(this.baseDataDir, 'settings.json');
    let settings: any = {};
    try {
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      }
    } catch (e: any) {
      console.error('[Knowledge Pump] 读取 settings.json 失败:', e.message);
    }

    const crawlingEnabled = settings.crawlingEnabled === true;
    const sources: string[] = Array.isArray(settings.crawlingSources) ? settings.crawlingSources : [];

    // 默认关闭：未显式开启或源为空 → 不推送任何外联任务
    if (!crawlingEnabled || sources.length === 0) {
      console.log('[Knowledge Pump] 📡 自动爬网未启用或采集源为空，跳过本次巡逻。');
      return;
    }

    console.log(`[Knowledge Pump] 📡 开始扫描 settings.json 载入的自定义采集白名单（${sources.length} 个源）...`);

    for (const url of sources) {
      try {
        console.log(`[Knowledge Pump] 📡 正在将自律采集源推送至提炼队列: ${url}`);
        this.queueManager.addTask('url', url, url, 'system-auto-pump');
        this._audit(url, 'queued');
      } catch (err: any) {
        console.error(`[Knowledge Pump] 采集源 ${url} 推送至队列失败:`, err.message);
        this._audit(url, 'failed:' + err.message);
      }
    }
  }
}
