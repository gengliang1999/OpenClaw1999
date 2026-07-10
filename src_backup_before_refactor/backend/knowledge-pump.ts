/**
 * 知识蒸馏泵 (Nightly Knowledge Pump)
 * 挂载至后台的定时采集源探针。爬取到的内容自动推入 IngestionQueueManager 队列进行隔离鉴伪提炼。
 */
import { setInterval } from 'timers';
import * as path from 'path';
import * as fs from 'fs';

export class KnowledgePump {
  private isRunning = false;

  constructor(
    private modelManager: any, 
    private vectorStore: any,
    private baseDataDir: string,
    private queueManager: any
  ) {}

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    console.log('[Knowledge Pump] 🛡️ 知识蒸馏巡逻泵已启动，已挂载至队列管理器...');
    
    // 定时触发自律巡逻 (每 6 小时扫描一次，自动压入队列)
    setInterval(() => {
      this.pump();
    }, 6 * 60 * 60 * 1000);
  }

  /**
   * 触发自律扫描并将任务推送给队列
   */
  async pump() {
    console.log('[Knowledge Pump] 📡 开始扫描 settings.json 载入的自定义采集白名单...');
    
    let urls: string[] = ['https://news.ycombinator.com/']; // 默认兜底站
    const settingsPath = path.join(this.baseDataDir, 'settings.json');
    
    if (fs.existsSync(settingsPath)) {
      try {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settings.crawlingSources && Array.isArray(settings.crawlingSources) && settings.crawlingSources.length > 0) {
          urls = settings.crawlingSources;
        }
      } catch (e: any) {
        console.error('[Knowledge Pump] 读取 settings.json 失败，采用默认源:', e.message);
      }
    }

    for (const url of urls) {
      try {
        console.log(`[Knowledge Pump] 📡 正在将自律采集源推送至提炼队列: ${url}`);
        this.queueManager.addTask('url', url, url, 'system-auto-pump');
      } catch (err: any) {
        console.error(`[Knowledge Pump] 采集源 ${url} 推送至队列失败:`, err.message);
      }
    }
  }
}
