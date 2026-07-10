import * as path from 'path';
import * as fs from 'fs';
import { VectorStore } from './vector-store';
import { DocumentParser } from './document-parser';

export interface IngestionTask {
  id: string;
  type: 'url' | 'text';
  target: string; // url 或者是已提取的文本内容
  fileName: string;
  convId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  failReason?: string;
  timestamp: number;
  metadata?: Record<string, any>; // 保存附加信息如 filePath, category, trustLevel
}

export class IngestionQueueManager {
  private queuePath: string;
  private state: 'idle' | 'running' | 'paused' = 'idle';
  private tasks: IngestionTask[] = [];
  private isProcessing = false;

  constructor(
    private modelManager: any,
    private baseDataDir: string
  ) {
    this.queuePath = path.join(this.baseDataDir, 'ingestion_queue.json');
    this.loadQueue();
  }

  private loadQueue() {
    try {
      if (fs.existsSync(this.queuePath)) {
        const data = JSON.parse(fs.readFileSync(this.queuePath, 'utf8'));
        this.tasks = data.tasks || [];
        this.state = data.state === 'running' ? 'paused' : (data.state || 'idle'); // 重启强制置为 paused
      }
    } catch (e: any) {
      console.error('[Queue] 加载队列文件失败:', e.message);
      this.tasks = [];
      this.state = 'idle';
    }
  }

  private saveQueue() {
    try {
      const tempPath = this.queuePath + '.tmp';
      fs.writeFileSync(tempPath, JSON.stringify({
        state: this.state,
        tasks: this.tasks
      }, null, 2), 'utf8');
      fs.renameSync(tempPath, this.queuePath);
    } catch (e: any) {
      console.error('[Queue] 保存队列文件失败:', e.message);
    }
  }

  /**
   * 添加任务到队列
   * @param metadata - 附加元数据，包含 { category, filePath, trustLevel }
   */
  addTask(type: 'url' | 'text', target: string, fileName: string, convId: string, metadata?: any) {
    const task: IngestionTask = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substring(2, 5),
      type,
      target,
      fileName,
      convId,
      status: 'pending',
      timestamp: Date.now(),
      metadata
    };
    this.tasks.push(task);
    if (this.state === 'idle') {
      this.state = 'running';
    }
    this.saveQueue();
    
    if (this.state === 'running') {
      this.triggerLoop();
    }
    return task;
  }

  pause() {
    if (this.state === 'running') {
      this.state = 'paused';
      this.saveQueue();
      console.log('[Queue] 📡 收到手动暂停信令，将在当前原子任务处理完后挂起。');
    }
  }

  resume() {
    if (this.state === 'paused' || this.state === 'idle') {
      this.state = 'running';
      this.saveQueue();
      console.log('[Queue] 📡 收到手动恢复信令，开启后台提炼工作流。');
      this.triggerLoop();
    }
  }

  getQueueInfo() {
    return {
      state: this.state,
      tasks: this.tasks.map(t => ({
        id: t.id,
        type: t.type,
        fileName: t.fileName,
        status: t.status,
        failReason: t.failReason,
        timestamp: t.timestamp,
        metadata: t.metadata
      }))
    };
  }

  clearHistory() {
    this.tasks = this.tasks.filter(t => t.status === 'pending' || t.status === 'processing');
    if (this.tasks.length === 0) {
      this.state = 'idle';
    }
    this.saveQueue();
  }

  private triggerLoop() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    this.processLoop().finally(() => {
      this.isProcessing = false;
    });
  }

  private getTargetModel(): any {
    const settingsPath = path.join(this.baseDataDir, 'settings.json');
    let mode = 'active';
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        if (settings.extractionModelMode) mode = settings.extractionModelMode;
      }
    } catch (e) {}

    const allModels = this.modelManager.models;
    const activeModel = this.modelManager.getActiveModel();

    if (mode === 'local_only') {
      const isLocal = (m: any) => m.type === 'local' || m.provider === 'LM Studio' || m.provider === 'Ollama' || m.id.toLowerCase().includes('local') || m.id.toLowerCase().includes('ollama');
      const local = allModels.find(isLocal);
      if (local) return local;
    } else if (mode === 'cloud_only') {
      const isCloud = (m: any) => m.type === 'cloud' && m.provider !== 'LM Studio' && m.provider !== 'Llama.cpp' && m.provider !== 'GPT4All' && m.provider !== 'Jan';
      const cloud = allModels.find(isCloud);
      if (cloud) return cloud;
    }

    return activeModel ? allModels.find((m: any) => m.id === activeModel.id) : allModels[0];
  }

  private async processLoop() {
    while (this.state === 'running') {
      const task = this.tasks.find(t => t.status === 'pending');
      if (!task) {
        this.state = 'idle';
        this.saveQueue();
        break;
      }

      task.status = 'processing';
      this.saveQueue();
      console.log(`[Queue] ⏳ 开始处理任务: [${task.type}] ${task.fileName}`);

      try {
        await this.executeTask(task);
        task.status = 'completed';
        console.log(`[Queue] ✅ 任务处理成功: ${task.fileName}`);
      } catch (err: any) {
        task.status = 'failed';
        task.failReason = err.message;
        console.error(`[Queue] ❌ 任务处理失败: ${task.fileName}, 原因:`, err.message);
      }
      
      this.saveQueue();
    }
  }

  private async executeTask(task: IngestionTask) {
    let rawText = '';
    let sourceName = task.fileName;
    const category = task.metadata?.category || '默认知识库';
    const trustLevel = task.metadata?.trustLevel || 'untrusted'; // 默认需真伪校验

    // 1. 确保目标文件夹存在
    const knowledgeDir = path.join(this.baseDataDir, 'knowledge');
    if (!fs.existsSync(knowledgeDir)) {
      fs.mkdirSync(knowledgeDir, { recursive: true });
    }

    // 2. 使用 DataCrawler 获取正文
    if (task.type === 'url') {
      const { DataCrawler } = require('./data-crawler');
      rawText = await DataCrawler.crawlUrl(task.target);
      sourceName = task.target;
    } else {
      rawText = task.target;
    }

    if (!rawText || rawText.trim().length < 20) {
      throw new Error('提取到的有效正文文本过短，拒绝入库');
    }

    // 3. 切分父子分块
    const chunks = DocumentParser.splitTextIntoParentChild(rawText);

    // 4. 定向数据库文件物理路径 (现在 Staging 是全局统一收件箱)
    const stagingPath = path.join(knowledgeDir, `vectors_staging_inbox.json`);
    const mainPath = path.join(knowledgeDir, `${category}.json`);
    const { vectorDbManager } = require('./vector-db-manager');

    // 5. 将分块暂时存入全局暂存隔离区 (Staging Database)
    const stagingDocs = [];
    const sourceId = `queue_crawled_${Date.now()}`;
    for (const c of chunks) {
      if (this.state as string === 'paused') {
        throw new Error('任务被手动暂停挂起');
      }
      const embedding = await this.modelManager.getEmbedding(c.childContent);
      stagingDocs.push({
        id: require('crypto').randomUUID(),
        content: c.childContent,
        metadata: {
          source: sourceName,
          sourceId,
          index: c.childIndex,
          parentContent: c.parentContent,
          status: 'pending',
          category, // 记录未来要去的目标分类
          convId: task.convId,
          timestamp: Date.now(),
          sourceMemoryId: task.metadata?.sourceMemoryId
        },
        embedding
      });
    }
    
    await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
      await stagingStore.addDocuments(stagingDocs);
    });

    // 6. 如果是绝对信任的数据（例如手动记忆晋升），则绕过核实直接晋升
    if (trustLevel === 'trusted') {
      console.log(`[Queue] 🛡️ 该任务标记为高信任源，跳过事实核查，直接自动晋升...`);
      await vectorDbManager.executeWrite(mainPath, async (mainStore: any) => {
        const verifiedDocs = stagingDocs.map(doc => {
          doc.metadata.status = 'verified';
          return doc;
        });
        await mainStore.addDocuments(verifiedDocs);
      });
      await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
        await stagingStore.removeBySource(sourceName);
      });
      
      this.archivePhysicalFile(task, category);
      return;
    }

    // 7. 使用 VerificationAgent 进行事实安全核实与鉴伪
    const targetModel = this.getTargetModel();
    if (!targetModel) {
      await vectorDbManager.executeWrite(mainPath, async (mainStore: any) => {
        const verifiedDocs = stagingDocs.map(doc => { doc.metadata.status = 'verified'; return doc; });
        await mainStore.addDocuments(verifiedDocs);
      });
      await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
        await stagingStore.removeBySource(sourceName);
      });
      this.archivePhysicalFile(task, category);
      return;
    }

    const { VerificationAgent } = require('./verification-agent');
    const verificationAgent = new VerificationAgent(this.modelManager);
    const result = await verificationAgent.verifyContent(rawText, targetModel);

    if (result.judgment === 'PASS') {
      await vectorDbManager.executeWrite(mainPath, async (mainStore: any) => {
        const verifiedDocs = stagingDocs.map(doc => {
          doc.metadata.status = 'verified';
          return doc;
        });
        await mainStore.addDocuments(verifiedDocs);
      });
      await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
        await stagingStore.removeBySource(sourceName);
      });
      
      this.archivePhysicalFile(task, category);
      console.log(`[Queue] 🎉 事实核实通过，${sourceName} 自动晋升正式知识库: ${category}`);
    } else {
      await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
        stagingStore.documents = stagingStore.documents.map((d: any) => {
          if (d.metadata.sourceId === sourceId) {
            d.metadata.status = 'failed_verification';
            d.metadata.failType = 'FAIL';
            d.metadata.failReason = result.reason;
          }
          return d;
        });
      });
      console.warn(`[Queue] 🚨 事实核实拦截，已被隔离！原因: ${result.reason}`);
    }
  }

  /**
   * 根据文件名或数据源寻找队列中的历史任务
   */
  getTask(fileName: string) {
    return this.tasks.find(t => t.fileName === fileName || t.target === fileName);
  }

  /**
   * 物理归档原始投喂文件到对应的 sources 文件夹
   * - 用户上传、文件夹同步任务：保存在 {category}_sources/ 根目录下
   * - 记忆晋升任务 (task.source === 'memory-promotion')：保存在 {category}_sources/promotions/ 子目录下，并在磁盘真实写入 Markdown 文件
   */
  public archivePhysicalFile(task: IngestionTask, category: string) {
    try {
      const sourcesDir = path.join(this.baseDataDir, 'knowledge', `${category}_sources`);
      
      // 区分来源：如果是记忆晋升任务，将文件归档存放在独立的 promotions/ 子目录下
      const isPromotion = task.convId === 'memory-promotion';
      const targetDir = isPromotion ? path.join(sourcesDir, 'promotions') : sourcesDir;

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const destPath = path.join(targetDir, task.fileName);

      if (isPromotion) {
        // 记忆晋升任务：直接将 Markdown 正文写入磁盘物理文件，满足用户的保存直观感
        if (!fs.existsSync(destPath)) {
          fs.writeFileSync(destPath, task.target, 'utf8');
          console.log(`[Queue] 📂 记忆晋升的 Markdown 物理文件已自动生成并保存至: ${destPath}`);
        }
      } else {
        // 用户上传/监视同步任务：拷贝物理文件
        if (task.metadata?.filePath && fs.existsSync(task.metadata.filePath)) {
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(task.metadata.filePath, destPath);
            console.log(`[Queue] 📂 原始物理文件已归档拷贝至: ${destPath}`);
          }
        } else if (task.type === 'text' || task.type === 'url') {
          // 暂存库手工审批通过等无物理路径任务：直接将正文内容写盘为 Markdown/TXT 文件，补充物理文件防止一致性漏洞
          if (!fs.existsSync(destPath)) {
            fs.writeFileSync(destPath, task.target, 'utf8');
            console.log(`[Queue] 📂 手工通过的暂存正文已自动写盘归档至: ${destPath}`);
          }
        }
      }
    } catch (err: any) {
      console.error('[Queue] 归档保存物理源文件失败:', err.message);
    }
  }
}
