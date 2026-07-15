// @ts-nocheck
/**
 * OpenClaw 智能助手 - 原生 IPC API 处理器
 * 彻底消灭本地 HTTP API 服务器后，由本模块接管所有渲染进程发起的业务请求
 */

import { ipcMain } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { openClawInstaller } from '../backend/openclaw-installer';
import { openClawDaemon } from '../backend/openclaw-daemon';
import { confirmationBus } from '../backend/confirmation-bus';

export function registerApiIpc(dependencies, mainWindowRef, expectedToken) {
  const { memoryStore, modelManager, sandbox, permissionManager, automation, baseDataDir, globalConfigPath, dataDir, queueManager, folderWatcher, jobQueue } = dependencies;
  const EXPECTED_TOKEN = expectedToken;
  const { vectorDbManager } = require('../backend/vector-db-manager');

  // ================== P0/T1：来源白名单校验 ==================
  function assertOrigin(event: any) {
    const url = (event.senderFrame && event.senderFrame.url) ? event.senderFrame.url : event.sender.getURL();
    if (!url.startsWith('claw://') && !url.startsWith('file://')) {
      throw new Error('FORBIDDEN: invalid origin ' + url);
    }
  }

  // ================== P0/T2：路由 → 资源-动作矩阵（RBAC 网关） ==================
  const ROUTE_PERMISSIONS: Record<string, { resource: string; action: string }> = {
    '/sandbox/execute':       { resource: 'sandbox',    action: 'execute' },
    '/sandbox/audit':         { resource: 'sandbox',    action: 'read' },
    '/sandbox/audit/clear':   { resource: 'sandbox',    action: 'write' },
    '/sandbox/permissions':   { resource: 'sandbox',    action: 'write' },
    '/knowledge/ingest-url':  { resource: 'skill',      action: 'write' },
    '/knowledge/sources':     { resource: 'skill',      action: 'write' },
    '/automation/screenshot': { resource: 'automation', action: 'execute' },
    '/settings':              { resource: 'settings',   action: 'write' },
    '/models':                { resource: 'model',      action: 'write' },
    '/permissions':           { resource: 'settings',   action: 'write' },
    '/permissions/roles':     { resource: 'settings',   action: 'read' },
  };

  function assertPermission(url: string, method: string) {
    const perm = ROUTE_PERMISSIONS[url];
    if (perm && !permissionManager.checkPermission(perm.resource, perm.action)) {
      throw new Error('FORBIDDEN: insufficient permission for ' + url);
    }
  }

  // 统一的 API 原生 IPC 通道分发器
  ipcMain.handle('api:call', async (event, { url, options = {} }) => {
    const method = options.method || 'GET';
    const body = options.body || {};

    // ================== P0/T1+T2：统一安全网关 ==================
    assertOrigin(event);                                  // ① 来源白名单（claw:// | file://）
    const token = (options as any).__token;
    if (token !== EXPECTED_TOKEN) {                       // ② 令牌校验（preload 自动注入）
      throw new Error('FORBIDDEN: invalid api token');
    }
    assertPermission(url, method);                        // ③ RBAC 资源-动作授权

    try {
      // ================== 系统配置 ==================
      if (url === '/system/global-config') {
        if (method === 'GET') {
          let config: any = {};
          if (fs.existsSync(globalConfigPath)) {
            config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
          }
          return {
            customDataDir: config.customDataDir || '',
            customDownloadDir: config.customDownloadDir || '',
            customLogDir: config.customLogDir || '',
            customMemoryDbPath: config.customMemoryDbPath || ''
          };
        } else if (method === 'POST') {
          const { customDataDir, customDownloadDir, customLogDir, customMemoryDbPath } = body;
          let config: any = {};
          if (fs.existsSync(globalConfigPath)) {
            config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
          }
          if (customDataDir !== undefined) config.customDataDir = customDataDir;
          if (customDownloadDir !== undefined) config.customDownloadDir = customDownloadDir;
          if (customLogDir !== undefined) config.customLogDir = customLogDir;
          if (customMemoryDbPath !== undefined) config.customMemoryDbPath = customMemoryDbPath;
          fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf8');
          return { success: true, message: '全局配置已保存，重启生效', config };
        }
      }

      // ================== 记忆文件自定义路径管理 ==================
      if (url === '/system/memory/select-db' && method === 'POST') {
        const { dialog } = require('electron');
        const result = await dialog.showSaveDialog(mainWindowRef(), {
          title: '选择或创建记忆数据库文件',
          defaultPath: path.join(dataDir, 'memory.db'),
          filters: [
            { name: 'SQLite 数据库', extensions: ['db'] }
          ],
          buttonLabel: '确定'
        });
        if (result.canceled || !result.filePath) {
          return { success: false, message: '操作已取消' };
        }
        
        const newPath = result.filePath;
        let config: any = {};
        if (fs.existsSync(globalConfigPath)) {
          config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        }
        config.customMemoryDbPath = newPath;
        
        let recent = config.recentMemoryDbs || [];
        if (!recent.includes(newPath)) {
          recent.unshift(newPath);
        } else {
          recent = recent.filter((p: string) => p !== newPath);
          recent.unshift(newPath);
        }
        config.recentMemoryDbs = recent.slice(0, 5);
        fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf8');

        return { success: true, filePath: newPath };
      }

      if (url === '/system/memory/recent-dbs' && method === 'GET') {
        let config: any = {};
        if (fs.existsSync(globalConfigPath)) {
          config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        }
        let recent = config.recentMemoryDbs || [];
        recent = recent.filter((p: string) => fs.existsSync(p));
        if (recent.length !== (config.recentMemoryDbs || []).length) {
          config.recentMemoryDbs = recent;
          fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf8');
        }
        return { success: true, recent };
      }

      if (url === '/system/memory/switch-db' && method === 'POST') {
        const { dbPath } = body;
        if (!dbPath) throw new Error('数据库路径不能为空');
        if (!fs.existsSync(dbPath)) throw new Error('指定的数据库物理文件不存在');

        let config: any = {};
        if (fs.existsSync(globalConfigPath)) {
          config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        }
        config.customMemoryDbPath = dbPath;
        
        let recent = config.recentMemoryDbs || [];
        if (!recent.includes(dbPath)) {
          recent.unshift(dbPath);
        } else {
          recent = recent.filter((p: string) => p !== dbPath);
          recent.unshift(dbPath);
        }
        config.recentMemoryDbs = recent.slice(0, 5);
        fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf8');
        
        return { success: true };
      }

      if (url === '/system/memory/rename-db' && method === 'POST') {
        const { oldPath, newName } = body;
        if (!oldPath || !newName) throw new Error('参数缺失');
        if (!fs.existsSync(oldPath)) throw new Error('原数据库文件不存在');
        
        const newDbPath = path.join(path.dirname(oldPath), newName.endsWith('.db') ? newName : `${newName}.db`);
        if (fs.existsSync(newDbPath)) throw new Error('新文件名已存在，请换一个名称');

        fs.renameSync(oldPath, newDbPath);

        const oldDir = path.dirname(oldPath);
        const oldBase = path.basename(oldPath, path.extname(oldPath));
        const oldVecPath = path.join(oldDir, `${oldBase}_vectors.json`);
        const oldEpPath = path.join(oldDir, `${oldBase}_episodes.json`);

        const newDir = path.dirname(newDbPath);
        const newBase = path.basename(newDbPath, path.extname(newDbPath));
        const newVecPath = path.join(newDir, `${newBase}_vectors.json`);
        const newEpPath = path.join(newDir, `${newBase}_episodes.json`);

        if (fs.existsSync(oldVecPath)) {
          fs.renameSync(oldVecPath, newVecPath);
        }
        if (fs.existsSync(oldEpPath)) {
          fs.renameSync(oldEpPath, newEpPath);
        }

        let config: any = {};
        if (fs.existsSync(globalConfigPath)) {
          config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
        }
        if (config.customMemoryDbPath === oldPath) {
          config.customMemoryDbPath = newDbPath;
        }
        let recent = config.recentMemoryDbs || [];
        recent = recent.map((p: string) => p === oldPath ? newDbPath : p);
        config.recentMemoryDbs = recent.filter((p: string) => fs.existsSync(p));
        fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf8');

        return { success: true, newPath: newDbPath };
      }

      // ================== 系统后台作业队列 ==================
      if (url === '/system/background-jobs' && method === 'GET') {
        const results = memoryStore.db.exec("SELECT * FROM background_jobs ORDER BY created_at DESC");
        return memoryStore._parseResults(results);
      }

      // ================== 聊天管理 ==================
      if (url === '/chat/ocr' && method === 'POST') {
        const { image, mode } = body;
        if (!image) throw new Error('图片数据不能为空');
        const activeModelId = modelManager.activeModelId;
        const systemPrompt = "你是一个高精度的 OCR 文字与表格识别提取助手。";
        let userPrompt = "请识别提取这张截图中的所有文字，按原本的排版顺序输出。不要有任何多余的废话、解释，仅输出识别到的文本内容。";
        if (mode === 'table') {
          userPrompt = "请识别提取这张截图中的表格，并将其转换为标准的 Markdown 表格格式输出。不要有任何多余的废话，仅输出 Markdown 表格。";
        }
        
        const messages = [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: image } }
            ]
          }
        ];
        
        const reply = await modelManager.chatStream(messages, { modelId: activeModelId, temperature: 0.1 }, () => {});
        return { text: reply };
      }

      if (url === '/chat/conversations') {
        if (method === 'GET') return memoryStore.getConversations();
        if (method === 'POST') {
          const conv = memoryStore.createConversation(body.title || '新对话');
          return conv;
        }
      }

      if (url.startsWith('/chat/conversations/')) {
        const parts = url.split('/');
        let id;
        if (url.endsWith('/export') || url.endsWith('/trash')) {
          id = parts[parts.length - 2];
        } else {
          id = parts[parts.length - 1];
        }

        if (url.endsWith('/export')) {
          const data = memoryStore.exportConversation(id);
          if (!data) throw new Error('对话不存在');
          return data;
        } else if (url.endsWith('/trash')) {
          // [Advanced Memory] 对话移入垃圾篓前，异步生成情景摘要
          setImmediate(async () => {
            try {
              const { MemoryEngine } = require('../backend/memory-engine');
              const memoryEngine = new MemoryEngine(modelManager, memoryStore, dataDir);
              await memoryEngine.generateEpisodeSummary(id);
            } catch (e) {
              console.warn('[情景摘要] 对话归档摘要生成失败（非致命）:', e);
            }
          });
          memoryStore.moveToTrash(id);
          return { success: true };
        } else {
          if (method === 'DELETE') {
            // [Advanced Memory] 硬删除前也尝试生成情景摘要
            setImmediate(async () => {
              try {
                const { MemoryEngine } = require('../backend/memory-engine');
                const memoryEngine = new MemoryEngine(modelManager, memoryStore, dataDir);
                await memoryEngine.generateEpisodeSummary(id);
              } catch (e) {
                console.warn('[情景摘要] 对话删除前摘要生成失败（非致命）:', e);
              }
            });
            memoryStore.deleteConversation(id);
            try {
              const { ragEngine } = require('../backend/rag-engine');
              ragEngine.clearForConversation(id);
            } catch (e) {}
            return { success: true };
          } else if (method === 'PUT') {
            if (!body.title) throw new Error('标题不能为空');
            memoryStore.renameConversation(id, body.title);
            return { success: true };
          }
        }
      }

      if (url.startsWith('/chat/history')) {
        // 解析 query params
        const conversationId = getQueryParam(url, 'conversationId');
        if (method === 'GET') {
          return memoryStore.getConversationHistory(conversationId);
        } else if (method === 'DELETE') {
          memoryStore.clearHistory(conversationId);
          const { ragEngine } = require('../backend/rag-engine');
          ragEngine.clearForConversation(conversationId);
          return { success: true };
        }
      }

      if (url.startsWith('/chat/message/')) {
        const id = url.split('/').pop();
        if (method === 'DELETE') {
          memoryStore.deleteMessage(id);
          return { success: true };
        }
      }

      if (url === '/chat/trash') {
        if (method === 'GET') return memoryStore.getTrash();
        if (method === 'DELETE') {
          memoryStore.emptyTrash();
          return { success: true };
        }
      }

      if (url === '/chat/trash/count') {
        return { count: memoryStore.getTrashCount() };
      }

      if (url.startsWith('/chat/trash/') && url.endsWith('/restore')) {
        const id = url.split('/')[3];
        memoryStore.restoreFromTrash(id);
        return { success: true };
      }

      if (url.startsWith('/chat/trash/') && method === 'DELETE') {
        const id = url.split('/').pop();
        memoryStore.permanentDelete(id);
        return { success: true };
      }

      // [Red Team Refactor] 将记忆晋升拆分为两步，拦截大模型直接落盘幻觉
      if (url === '/memory/promote/generate' && method === 'POST') {
        const { memoryId, targetCategory = '默认知识库' } = body;
        if (!memoryId) throw new Error('memoryId 不能为空');

        // 1. 获取零碎记忆内容
        const memory = memoryStore.getMemory(memoryId);
        if (!memory) throw new Error('未找到对应的记忆条目');

        // 2. 调用大模型将零碎事实扩写为标准 Markdown 文档 (仅生成草稿，不写盘)
        const activeModelId = modelManager.activeModelId;
        const prompt = [
          {
            role: 'system',
            content: '你是一个精通技术文档与业务指南编写的专业文档工程师。请将以下用户提供的零碎事实/记忆，整理扩写为一篇格式优美、标题清晰、逻辑完整的 Markdown 文档。仅输出 Markdown 正文，请不要包含任何前后缀的客套废话或 explanation 解释。'
          },
          {
            role: 'user',
            content: `零碎事实事实内容：\n「${memory.content}」\n\n请根据上述事实整理出一份专业的 Markdown 知识库文档：`
          }
        ];

        let markdownContent = '';
        try {
          markdownContent = await modelManager.chat(prompt, { modelId: activeModelId, temperature: 0.3 });
        } catch (e: any) {
          throw new Error(`大模型文档扩写失败: ${e.message}`);
        }

        return {
          success: true,
          memoryId,
          targetCategory,
          draftMarkdown: markdownContent
        };
      }

      // [Red Team Refactor] 前端用户确认无幻觉后，提交此接口正式入库
      if (url === '/memory/promote/confirm' && method === 'POST') {
        const { memoryId, targetCategory, markdownContent } = body;
        if (!memoryId || !markdownContent) throw new Error('缺少必要参数');

        const memory = memoryStore.getMemory(memoryId);
        if (!memory) throw new Error('未找到对应的记忆条目');

        // 1. 拟定文件名
        const safeFactName = (memory.content || '').slice(0, 10).replace(/[\\/:*?"<>|]/g, '_').trim();
        const now = new Date();
        const pad = (n: number) => n.toString().padStart(2, '0');
        const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
        const fileName = `[记忆晋升]_[${memory.category || '通用'}]_${safeFactName}_${dateStr}.md`;

        // 2. 调用 IngestionQueue 分配物理路径与异步归档 (绕过 Staging 暂存区验证)
        queueManager.addTask('text', markdownContent, fileName, 'memory-promotion', {
          category: targetCategory,
          trustLevel: 'trusted',
          sourceMemoryId: memoryId
        });

        // 3. 更新 SQLite 记忆的标签为已晋升
        let currentTags = [];
        try {
          currentTags = JSON.parse(memory.tags || '[]');
        } catch (e) {}
        if (!currentTags.includes('promoted')) {
          currentTags.push('promoted');
        }
        memoryStore.db.run(
          'UPDATE memories SET tags = ?, updated_at = ? WHERE id = ?',
          [JSON.stringify(currentTags), new Date().toISOString(), memoryId]
        );
        memoryStore._save();

        return {
          success: true,
          fileName,
          targetCategory
        };
      }

      // ================== 核心记忆管理接口 (Memory CRUD) ==================
      if (url.startsWith('/memory')) {
        const { VectorStore } = require('../backend/vector-store');

        // 0. 记忆导出与导入备份
        if (url === '/memory/export' && method === 'POST') {
          const memoriesList = memoryStore._parseResults(memoryStore.db.exec("SELECT * FROM memories")) || [];
          const episodesList = memoryStore._parseResults(memoryStore.db.exec("SELECT * FROM memory_episodes")) || [];
          const entitiesList = memoryStore._parseResults(memoryStore.db.exec("SELECT * FROM entities")) || [];
          const relationsList = memoryStore._parseResults(memoryStore.db.exec("SELECT * FROM entity_relations")) || [];
          let vectorsList = [];

          const currentMemoriesDbPath = memoryStore.dbPath;
          let currentMemoriesVectorsPath = path.join(memoryStore.dataDir, 'memories_vectors.json');
          if (currentMemoriesDbPath && !currentMemoriesDbPath.endsWith('memory.db')) {
            const dbDir = path.dirname(currentMemoriesDbPath);
            const dbName = path.basename(currentMemoriesDbPath, path.extname(currentMemoriesDbPath));
            currentMemoriesVectorsPath = path.join(dbDir, `${dbName}_vectors.json`);
          }

          try {
            await vectorDbManager.executeRead(currentMemoriesVectorsPath, async (store: any) => {
              vectorsList = store.documents || [];
            });
          } catch (e: any) {
            console.error('[主进程] 导出读取向量失败:', e.message);
          }

          const exportObj = {
            memories: memoriesList,
            episodes: episodesList,
            entities: entitiesList,
            relations: relationsList,
            vectors: vectorsList
          };

          const { dialog } = require('electron');
          const { canceled, filePath } = await dialog.showSaveDialog(mainWindowRef(), {
            title: '导出记忆神经元备份',
            defaultPath: 'openclaw_memories_backup.json',
            filters: [{ name: 'JSON 备份文件', extensions: ['json'] }]
          });
          if (canceled || !filePath) return { success: false, message: '操作已取消' };
          fs.writeFileSync(filePath, JSON.stringify(exportObj, null, 2), 'utf8');
          return { success: true, filePath };
        }

        if (url === '/memory/import' && method === 'POST') {
          const { overwrite = false } = body;
          const { dialog } = require('electron');
          const { canceled, filePaths } = await dialog.showOpenDialog(mainWindowRef(), {
            title: '导入记忆神经元备份',
            filters: [{ name: 'JSON 备份文件', extensions: ['json'] }],
            properties: ['openFile']
          });
          if (canceled || filePaths.length === 0) return { success: false, message: '操作已取消' };
          
          const rawData = fs.readFileSync(filePaths[0], 'utf8');
          let parsedData: any;
          try {
            parsedData = JSON.parse(rawData);
          } catch (e: any) {
            return { success: false, message: '导入失败：备份文件内容为空或非合法的 JSON 格式' };
          }
          
          const list = Array.isArray(parsedData) ? parsedData : (parsedData.memories || []);
          const episodes = parsedData.episodes || [];
          const entities = parsedData.entities || [];
          const relations = parsedData.relations || [];
          const vectors = parsedData.vectors || [];

          const currentMemoriesDbPath = memoryStore.dbPath;
          let currentMemoriesVectorsPath = path.join(memoryStore.dataDir, 'memories_vectors.json');
          if (currentMemoriesDbPath && !currentMemoriesDbPath.endsWith('memory.db')) {
            const dbDir = path.dirname(currentMemoriesDbPath);
            const dbName = path.basename(currentMemoriesDbPath, path.extname(currentMemoriesDbPath));
            currentMemoriesVectorsPath = path.join(dbDir, `${dbName}_vectors.json`);
          }

          if (overwrite) {
            memoryStore.db.run("DELETE FROM memories");
            memoryStore.db.run("DELETE FROM memory_episodes");
            memoryStore.db.run("DELETE FROM entities");
            memoryStore.db.run("DELETE FROM entity_relations");
            memoryStore._save();

            await vectorDbManager.executeWrite(currentMemoriesVectorsPath, async (store: any) => {
              store.documents = [];
            }, false);
          }

          let importedCount = 0;
          for (const item of list) {
            const content = item.content;
            const category = item.category || '通用';
            let tags = [];
            try {
              tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : (item.tags || []);
            } catch (e) {
              tags = [];
            }
            if (!content) continue;

            let exists = false;
            if (!overwrite) {
              const check = memoryStore.db.exec('SELECT id FROM memories WHERE content = ? LIMIT 1', [content]);
              exists = check && check.length > 0 && check[0].values.length > 0;
            }
            if (!exists) {
              memoryStore.addMemory(content, category, tags);
              importedCount++;
            }
          }

          if (overwrite) {
            for (const ep of episodes) {
              memoryStore.db.run('INSERT INTO memory_episodes (id, conversation_id, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [ep.id, ep.conversation_id, ep.summary, ep.created_at, ep.updated_at]);
            }
            for (const ent of entities) {
              memoryStore.db.run('INSERT INTO entities (id, name, type, description, first_mentioned_at) VALUES (?, ?, ?, ?, ?)', [ent.id, ent.name, ent.type, ent.description, ent.first_mentioned_at]);
            }
            for (const rel of relations) {
              memoryStore.db.run('INSERT INTO entity_relations (id, source_id, target_id, relation_type, description, first_mentioned_at) VALUES (?, ?, ?, ?, ?, ?)', [rel.id, rel.source_id, rel.target_id, rel.relation_type, rel.description, rel.first_mentioned_at]);
            }
          } else {
            for (const ep of episodes) {
              const check = memoryStore.db.exec('SELECT id FROM memory_episodes WHERE id = ? LIMIT 1', [ep.id]);
              if (!(check && check.length > 0 && check[0].values.length > 0)) {
                memoryStore.db.run('INSERT INTO memory_episodes (id, conversation_id, summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [ep.id, ep.conversation_id, ep.summary, ep.created_at, ep.updated_at]);
              }
            }
            for (const ent of entities) {
              const check = memoryStore.db.exec('SELECT id FROM entities WHERE name = ? LIMIT 1', [ent.name]);
              if (!(check && check.length > 0 && check[0].values.length > 0)) {
                memoryStore.db.run('INSERT INTO entities (id, name, type, description, first_mentioned_at) VALUES (?, ?, ?, ?, ?)', [ent.id, ent.name, ent.type, ent.description, ent.first_mentioned_at]);
              }
            }
            for (const rel of relations) {
              const check = memoryStore.db.exec('SELECT id FROM entity_relations WHERE source_id = ? AND target_id = ? AND relation_type = ? LIMIT 1', [rel.source_id, rel.target_id, rel.relation_type]);
              if (!(check && check.length > 0 && check[0].values.length > 0)) {
                memoryStore.db.run('INSERT INTO entity_relations (id, source_id, target_id, relation_type, description, first_mentioned_at) VALUES (?, ?, ?, ?, ?, ?)', [rel.id, rel.source_id, rel.target_id, rel.relation_type, rel.description, rel.first_mentioned_at]);
              }
            }
          }
          memoryStore._save();

          try {
            await vectorDbManager.executeWrite(currentMemoriesVectorsPath, async (store: any) => {
              if (overwrite) {
                store.documents = vectors;
              } else {
                for (const vec of vectors) {
                  const checkExist = store.documents.some((doc: any) => doc.content === vec.content);
                  if (!checkExist) {
                    store.documents.push(vec);
                  }
                }
              }
            }, false);
          } catch (e: any) {
            console.error('[主进程] 导入写入向量库失败:', e.message);
          }

          return { success: true, importedCount };
        }

        // 修改记忆内容 (PUT /memory/:id)
        if (url.startsWith('/memory/') && !url.endsWith('/pin') && method === 'PUT') {
          const parts = url.split('/');
          const id = parts[2];
          const { content } = body;
          if (!content) throw new Error('记忆内容不能为空');
          const oldMemory = memoryStore.getMemory(id);
          if (!oldMemory) throw new Error('未找到对应的记忆条目');
          memoryStore.db.run('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?', [content, new Date().toISOString(), id]);
          memoryStore._save();
          setImmediate(async () => {
            try {
              const embedding = await modelManager.getEmbedding(content);
              await vectorDbManager.executeWrite(path.join(dataDir, 'memories_vectors.json'), async (store: any) => {
                await store.removeBySource(oldMemory.content, false);
                if (Array.isArray(embedding) && embedding.length > 0) {
                  await store.addDocuments([{
                    id: require('crypto').randomUUID(),
                    content,
                    metadata: { source: content, memoryId: id, timestamp: new Date().toISOString() },
                    embedding
                  }], false);
                } else {
                  memoryStore.tagMemory(id, 'pending_vectorization');
                }
              });
            } catch (e) {}
          });
          return { success: true };
        }

        // 1. 获取记忆列表 (支持分页与分类筛选)
        if (url.startsWith('/memory?') || url === '/memory') {
          if (method === 'GET') {
            const page = parseInt(getQueryParam(url, 'page') || '1', 10);
            const pageSize = parseInt(getQueryParam(url, 'pageSize') || '20', 10);
            const category = getQueryParam(url, 'category') || null;
            
            const result = memoryStore.getAllMemories(page, pageSize, category);
            return {
              data: result.items,
              total: result.total,
              page,
              pageSize
            };
          }
        }

        // 2. 搜索记忆 (传统 SQLite LIKE 检索)
        if (url.startsWith('/memory/search')) {
          if (method === 'GET') {
            const query = getQueryParam(url, 'q') || '';
            const limit = parseInt(getQueryParam(url, 'limit') || '10', 10);
            return memoryStore.searchMemory(query, limit);
          }
        }

        // 3. 手动添加记忆 (同步写入 SQLite 与向量库)
        if (url === '/memory' && method === 'POST') {
          const { content, category = '通用', tags = [] } = body;
          if (!content) throw new Error('记忆内容不能为空');

          const memory = memoryStore.addMemory(content, category, tags);
          
          // 同步写入向量库 (加并发锁保护，并将 Embedding 提到锁外部执行)
          try {
            const embedding = await modelManager.getEmbedding(content);
            if (Array.isArray(embedding) && embedding.length > 0) {
              await vectorDbManager.executeWrite(path.join(dataDir, 'memories_vectors.json'), async (store: any) => {
                await store.addDocuments([{
                  id: require('crypto').randomUUID(),
                  content,
                  metadata: { source: content, memoryId: memory.id, timestamp: new Date().toISOString() },
                  embedding
                }], false); // 传入 false 避免二次物理写盘
              });
            } else {
              memoryStore.tagMemory(memory.id, 'pending_vectorization');
            }
            console.log('[主进程] 手动添加记忆并向量化成功:', content);
          } catch (e: any) {
            console.error('[主进程] 记忆向量化失败:', e.message);
          }

          // 异步提炼实体关系三元组，使手动偏好也能享受实体图谱检索
          setImmediate(async () => {
            try {
              const { MemoryEngine } = require('../backend/memory-engine');
              const tempEngine = new MemoryEngine(modelManager, memoryStore, dataDir);
              await tempEngine.extractAndStoreEntities(content, memory.id);
              console.log('[主进程] 后台异步提取手动记忆实体关系成功');
            } catch (e: any) {
              console.warn('[主进程] 后台异步提取手动记忆实体关系失败:', e.message);
            }
          });

          return memory;
        }

        // 4. 删除单个记忆 (同步删除 SQLite 与向量库)
        if (url.startsWith('/memory/') && method === 'DELETE') {
          const id = url.split('/').pop();
          if (!id) throw new Error('memoryId 不能为空');

          const memory = memoryStore.getMemory(id);
          if (memory) {
            try {
              await vectorDbManager.executeWrite(path.join(dataDir, 'memories_vectors.json'), async (store: any) => {
                await store.removeBySource(memory.content, false); // 传入 false 避免二次落盘
              });
              console.log('[主进程] 成功从向量库移除记忆分块:', memory.content);
            } catch (e: any) {
              console.error('[主进程] 从向量库移除记忆分块失败:', e.message);
            }
          }

          memoryStore.deleteMemory(id);
          return { success: true };
        }

        // 5. 记忆置顶/锁定切换 (PUT /memory/:id/pin)
        if (url.startsWith('/memory/') && url.endsWith('/pin') && method === 'PUT') {
          const parts = url.split('/');
          const id = parts[2]; // /memory/:id/pin
          const { isPinned } = body;
          if (isPinned === undefined) throw new Error('isPinned 参数不能为空');

          const pinValue = isPinned ? 1 : 0;
          memoryStore.db.run(
            'UPDATE memories SET is_pinned = ?, updated_at = ? WHERE id = ?',
            [pinValue, new Date().toISOString(), id]
          );
          memoryStore._save();
          console.log(`[主进程] 成功切换记忆置顶状态: ID=${id}, isPinned=${isPinned}`);
          return { success: true, isPinned };
        }

        // 6. 生成记忆晋升的扩写草稿 (POST /memory/promote/generate)
        if (url === '/memory/promote/generate' && method === 'POST') {
          const { memoryId, targetCategory = '默认知识库' } = body;
          if (!memoryId) throw new Error('memoryId 不能为空');

          const memory = memoryStore.getMemory(memoryId);
          if (!memory) throw new Error('未找到该记忆条目');

          const prompt = [
            {
              role: 'system',
              content: '你是一个系统自进化知识库整理专家。请将以下零碎的用户记忆事实，扩写为一篇格式工整、条理清晰的 Markdown 格式知识草稿。要求：保留原始记忆中的核心名词、姓名、称呼或技术习惯；补充必要的场景说明或推荐建议，不要胡乱捏造不存在的物理路径或机密。直接输出 Markdown 正文，不要用 ```markdown 或任何 markdown 外层文字包装。'
            },
            { role: 'user', content: `记忆事实：「${memory.content}」，分类标签：「${memory.category}」` }
          ];

          try {
            const draftMarkdown = await modelManager.chat(prompt, { temperature: 0.3 });
            return { success: true, draftMarkdown: draftMarkdown.trim() };
          } catch (e: any) {
            console.error('[主进程] 扩写记忆草稿失败:', e.message);
            throw new Error('大模型扩写失败: ' + e.message);
          }
        }

        // 7. 确认记忆晋升为隔离知识库 (POST /memory/promote/confirm)
        if (url === '/memory/promote/confirm' && method === 'POST') {
          const { memoryId } = body;
          const draftMarkdown = body.draftMarkdown || body.markdownContent;
          if (!memoryId) throw new Error('memoryId 不能为空');
          if (!draftMarkdown || !draftMarkdown.trim()) throw new Error('草稿内容不能为空');

          const memory = memoryStore.getMemory(memoryId);
          if (!memory) throw new Error('未找到该记忆条目');

          // 物理隔离知识库存放地址
          const knowledgeDir = path.join(dataDir, 'knowledge');
          if (!fs.existsSync(knowledgeDir)) {
            fs.mkdirSync(knowledgeDir, { recursive: true });
          }
          const promotedPath = path.join(knowledgeDir, 'promoted_memories.json');

          // 将 Markdown 草稿进行高维向量提取并物理写入 promoted_memories.json 向量库
          try {
            const embedding = await modelManager.getEmbedding(draftMarkdown);
            if (Array.isArray(embedding) && embedding.length > 0) {
              await vectorDbManager.executeWrite(promotedPath, async (store: any) => {
                await store.addDocuments([{
                  id: require('crypto').randomUUID(),
                  content: draftMarkdown,
                  metadata: {
                    source: draftMarkdown,
                    memoryId,
                    timestamp: new Date().toISOString(),
                    parentContent: draftMarkdown
                  },
                  embedding
                }], false);
              });
              console.log('[主进程] 成功将记忆晋升草稿向量化并写入 promoted_memories.json');
            } else {
              throw new Error('无法提取有效的向量，请检查 Embedding 引擎连接');
            }
          } catch (e: any) {
            console.error('[主进程] 记忆晋升向量化写入失败:', e.message);
            throw new Error('写入向量库失败: ' + e.message);
          }

          // 在 SQLite 中给该条记忆追加 promoted 标签
          let tagsArray = [];
          try {
            tagsArray = typeof memory.tags === 'string' ? JSON.parse(memory.tags) : (memory.tags || []);
          } catch (e) {}
          if (!tagsArray.includes('promoted')) {
            tagsArray.push('promoted');
            memoryStore.db.run(
              'UPDATE memories SET tags = ?, updated_at = ? WHERE id = ?',
              [JSON.stringify(tagsArray), new Date().toISOString(), memoryId]
            );
            memoryStore._save();
          }

          return { success: true };
        }

        // 8. 清空所有记忆 (POST /memory/clear-all)
        if (url === '/memory/clear-all' && method === 'POST') {
          memoryStore.db.run('DELETE FROM memories');
          memoryStore._save();

          const vectorPath = path.join(dataDir, 'memory_vectors.json');
          if (fs.existsSync(vectorPath)) {
            try {
              fs.writeFileSync(vectorPath, JSON.stringify([], null, 2));
            } catch (e) {
              console.error('[主进程] 清空向量文件失败:', e.message);
            }
          }
          console.log('[主进程] 已成功重置清空全部长期记忆及向量索引');
          return { success: true };
        }
      }

      // ================== 知识库引擎 (RAG) ==================
      if (url === '/knowledge/add' && method === 'POST') {
        const { files, category = '默认知识库', trustLevel = 'trusted' } = body;
        const { DocumentParser } = require('../backend/document-parser');
        
        let totalChunks = 0;
        for (const file of files) {
           const chunks = DocumentParser.splitTextIntoParentChild(file.content || '');
           totalChunks += chunks.length;
           
           // 手动上传的文件压入 IngestionQueue 队列进行后台队列化物理提炼与归档
           queueManager.addTask('text', file.content || '', file.name, 'system-manual-upload', {
             category,
             trustLevel
           });
        }
        return { success: true, chunksGenerated: totalChunks };
      }

      if (url === '/knowledge/search' && method === 'POST') {
        const { query, category = '默认知识库' } = body;
        const { VectorStore } = require('../backend/vector-store');
        
        let dbPath = path.join(dataDir, 'knowledge', `${category}.json`);
        // 兼容旧版 vectors.json 以免用户数据丢失
        if ((category === '默认知识库' || category === 'default') && !fs.existsSync(dbPath)) {
          const oldPath = path.join(dataDir, 'vectors.json');
          if (fs.existsSync(oldPath)) dbPath = oldPath;
        }

        const store = new VectorStore(dbPath);
        await store.load();
        
        // 获取真实的 query embedding 并启动双路混合召回 (粗排召回放大为 10)
        const queryEmbedding = await modelManager.getEmbedding(query);
        const candidates = await store.search(queryEmbedding, query, 10);
        
        // 深度重排 (Reranker)
        for (const item of candidates) {
          const rrScore = await modelManager.getRerankScore(query, item.doc.content);
          // Rerank 分数赋予更高权重
          item.score = (item.score * 0.4) + (rrScore * 0.6); 
        }
        
        // 重排后截断，仅允许最高精度的 Top-3 送入大模型，并将结果映射为对应的 Parent 完整上下文，防止断章取义
        candidates.sort((a, b) => b.score - a.score);
        const results = candidates.slice(0, 3).map(item => ({
          doc: {
            ...item.doc,
            content: item.doc.metadata?.parentContent || item.doc.content // 优先使用父切片上下文
          },
          score: item.score
        }));
        
        return { results };
      }

      // ================== 智能采集与知识管理 (RAG Management) ==================
      if (url === '/knowledge/ingest-url' && method === 'POST') {
        const { url: targetUrl, convId } = body;
        if (!targetUrl) throw new Error('超链接 URL 不能为空');
        if (!convId) throw new Error('必须关联会话 ID');
        
        queueManager.addTask('url', targetUrl, targetUrl, convId);
        return { success: true, enqueue: true, summary: '超链接提取与事实核查任务已排入自愈提炼队列。' };
      }

      // ================== 自愈队列控制接口 ==================
      if (url === '/knowledge/queue') {
        if (method === 'GET') {
          return queueManager.getQueueInfo();
        }
      }

      if (url === '/knowledge/queue/pause' && method === 'POST') {
        queueManager.pause();
        return { success: true, state: 'paused' };
      }

      if (url === '/knowledge/queue/resume' && method === 'POST') {
        queueManager.resume();
        return { success: true, state: 'running' };
      }

      if (url === '/knowledge/queue/clear' && method === 'POST') {
        queueManager.clearHistory();
        return { success: true };
      }

      if (url === '/knowledge/sources') {
        const settingsPath = path.join(dataDir, 'settings.json');
        let settings: any = {};
        try {
          if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {}
        if (!settings.crawlingSources) settings.crawlingSources = [];

        if (method === 'GET') {
          return settings.crawlingSources;
        } else if (method === 'POST') {
          const { sourceUrl } = body;
          if (!sourceUrl) throw new Error('源地址不能为空');
          if (!settings.crawlingSources.includes(sourceUrl)) {
            settings.crawlingSources.push(sourceUrl);
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
          }
          return { success: true, sources: settings.crawlingSources };
        } else if (method === 'DELETE') {
          const { sourceUrl } = body;
          if (!sourceUrl) throw new Error('源地址不能为空');
          settings.crawlingSources = settings.crawlingSources.filter((s: string) => s !== sourceUrl);
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
          return { success: true, sources: settings.crawlingSources };
        }
      }

      if (url.startsWith('/knowledge/files')) {
        const category = getQueryParam(url, 'category') || '默认知识库';
        const { vectorDbManager } = require('../backend/vector-db-manager');
        
        // 获取文档纯文本原文内容 (GET /knowledge/files/content?source=...)
        if (url.startsWith('/knowledge/files/content') && method === 'GET') {
          const sourceName = getQueryParam(url, 'source');
          if (!sourceName) throw new Error('缺少 source 文件名');
          const rootPath = path.join(dataDir, 'knowledge', `${category}_sources`, sourceName);
          const promoPath = path.join(dataDir, 'knowledge', `${category}_sources`, 'promotions', sourceName);
          let fileContent = '';
          if (fs.existsSync(rootPath)) {
            fileContent = fs.readFileSync(rootPath, 'utf8');
          } else if (fs.existsSync(promoPath)) {
            fileContent = fs.readFileSync(promoPath, 'utf8');
          } else {
            fileContent = '该知识条目为直接抽取的文本片段或无物理归档，无法查看全文。';
          }
          return { success: true, content: fileContent };
        }

        let dbPath = path.join(dataDir, 'knowledge', `${category}.json`);
        if ((category === '默认知识库' || category === 'default') && !fs.existsSync(dbPath)) {
          const oldPath = path.join(dataDir, 'vectors.json');
          if (fs.existsSync(oldPath)) dbPath = oldPath;
        }

        if (method === 'GET') {
          return await vectorDbManager.executeRead(dbPath, (store: any) => {
            const fileMap: Record<string, { source: string, chunkCount: number, timestamp: number }> = {};
            // @ts-ignore
            for (const doc of store.documents) {
              const src = doc.metadata?.source || '未知来源';
              if (!fileMap[src]) {
                fileMap[src] = {
                  source: src,
                  chunkCount: 0,
                  timestamp: doc.metadata?.timestamp || Date.now()
                };
              }
              fileMap[src].chunkCount++;
            }
            return Object.values(fileMap);
          });
        } else if (method === 'DELETE') {
          const { source } = body;
          if (!source) throw new Error('必须指定要删除的来源名称');
          
          await vectorDbManager.executeWrite(dbPath, async (store: any) => {
            // 联动还原：若该知识文件由记忆晋升而来，删除文件时应恢复其在 SQLite 中的原始记忆活力
            try {
              // @ts-ignore
              const docsToDelete = store.documents.filter((d: any) => d.metadata && d.metadata.source === source);
              const sourceMemoryId = docsToDelete.find((d: any) => d.metadata && d.metadata.sourceMemoryId)?.metadata?.sourceMemoryId;
              if (sourceMemoryId) {
                const mem = memoryStore.getMemory(sourceMemoryId);
                if (mem) {
                  let tagsArray = [];
                  try {
                    tagsArray = typeof mem.tags === 'string' ? JSON.parse(mem.tags) : (mem.tags || []);
                  } catch (e) {}
                  tagsArray = tagsArray.filter((t: string) => t !== 'promoted');
                  // [Red Team Fix] 赋予被剥夺 promoted 资格的记忆满级唤醒复活无敌帧，避免立刻被艾宾浩斯判定过滤
                  const newRecallCount = (mem.recall_count || 0) + 1;
                  memoryStore.db.run(
                    'UPDATE memories SET tags = ?, updated_at = ?, last_recalled_at = ?, recall_count = ? WHERE id = ?',
                    [JSON.stringify(tagsArray), new Date().toISOString(), new Date().toISOString(), newRecallCount, sourceMemoryId]
                  );
                  memoryStore._save();
                  console.log(`[记忆引擎] 🔄 知识文件已物理删除，原记忆已解除 promoted 标签并恢复日常检索满血活力: ${sourceMemoryId}`);
                }
              }
            } catch (e: any) {
              console.error('[记忆引擎] 恢复晋升记忆标志失败:', e.message);
            }

            await store.removeBySource(source);
          });
          
          // 物理清除 sources 目录下同名源文件归档 (兼容根目录与 promotions 隔离子目录)
          try {
            const rootPath = path.join(dataDir, 'knowledge', `${category}_sources`, source);
            const promoPath = path.join(dataDir, 'knowledge', `${category}_sources`, 'promotions', source);
            
            if (fs.existsSync(rootPath)) {
              fs.unlinkSync(rootPath);
              console.log(`[RAG] 物理归档源文件已清除(普通): ${rootPath}`);
            } else if (fs.existsSync(promoPath)) {
              fs.unlinkSync(promoPath);
              console.log(`[RAG] 物理归档源文件已清除(记忆晋升): ${promoPath}`);
            }
          } catch (e) {}
          
          return { success: true };
        }
      }

      if (url === '/knowledge/files/rename' && method === 'PUT') {
        const { oldName, newName, category = '默认知识库' } = body;
        if (!oldName || !newName) throw new Error('旧名称和新名称均不能为空');
        
        const { vectorDbManager } = require('../backend/vector-db-manager');
        let dbPath = path.join(dataDir, 'knowledge', `${category}.json`);
        if ((category === '默认知识库' || category === 'default') && !fs.existsSync(dbPath)) {
          const oldPath = path.join(dataDir, 'vectors.json');
          if (fs.existsSync(oldPath)) dbPath = oldPath;
        }

        let renamedCount = 0;
        await vectorDbManager.executeWrite(dbPath, async (store: any) => {
          // @ts-ignore
          store.documents = store.documents.map((doc: any) => {
            if (doc.metadata && doc.metadata.source === oldName) {
              doc.metadata.source = newName;
              renamedCount++;
            }
            return doc;
          });
        });
        
        if (renamedCount > 0) {
          // 同时物理重命名 sources 文件夹里的原始文件 (兼容根目录与 promotions 子目录)
          try {
            const oldRootPath = path.join(dataDir, 'knowledge', `${category}_sources`, oldName);
            const newRootPath = path.join(dataDir, 'knowledge', `${category}_sources`, newName);
            const oldPromoPath = path.join(dataDir, 'knowledge', `${category}_sources`, 'promotions', oldName);
            const newPromoPath = path.join(dataDir, 'knowledge', `${category}_sources`, 'promotions', newName);

            if (fs.existsSync(oldRootPath)) {
              fs.renameSync(oldRootPath, newRootPath);
              console.log(`[RAG] 物理文件已同步重命名(普通): ${oldName} -> ${newName}`);
            } else if (fs.existsSync(oldPromoPath)) {
              fs.renameSync(oldPromoPath, newPromoPath);
              console.log(`[RAG] 物理文件已同步重命名(记忆晋升): ${oldName} -> ${newName}`);
            }
          } catch (e) {}
        }
        return { success: true, renamedCount };
      }

      if (url === '/knowledge/files/update' && method === 'POST') {
        const { source, content, category = '默认知识库' } = body;
        if (!source || content === undefined) throw new Error('缺少必要参数');
        const rootPath = path.join(dataDir, 'knowledge', `${category}_sources`, source);
        const promoPath = path.join(dataDir, 'knowledge', `${category}_sources`, 'promotions', source);
        if (fs.existsSync(rootPath)) {
          fs.writeFileSync(rootPath, content, 'utf8');
        } else if (fs.existsSync(promoPath)) {
          fs.writeFileSync(promoPath, content, 'utf8');
        } else {
          const dir = path.join(dataDir, 'knowledge', `${category}_sources`);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(rootPath, content, 'utf8');
        }
        const { vectorDbManager } = require('../backend/vector-db-manager');
        let dbPath = path.join(dataDir, 'knowledge', `${category}.json`);
        if ((category === '默认知识库' || category === 'default') && !fs.existsSync(dbPath)) {
          const oldPath = path.join(dataDir, 'vectors.json');
          if (fs.existsSync(oldPath)) dbPath = oldPath;
        }
        await vectorDbManager.executeWrite(dbPath, async (store: any) => {
          await store.removeBySource(source);
        });
        queueManager.addTask('text', content, source, 'system-manual-edit', {
          category,
          trustLevel: 'trusted'
        });
        return { success: true, message: '文档已保存，后台重新提炼中...' };
      }

      if (url === '/knowledge/export' && method === 'POST') {
        const { category = '默认知识库' } = body;
        const { dialog } = require('electron');
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindowRef(), {
          title: '选择导出备份的目标文件夹',
          properties: ['openDirectory', 'createDirectory']
        });
        if (canceled || filePaths.length === 0) return { success: false, message: '操作已取消' };
        const exportDir = filePaths[0];
        const sourcesDir = path.join(dataDir, 'knowledge', `${category}_sources`);
        if (!fs.existsSync(sourcesDir)) {
          return { success: true, exportedCount: 0, message: '无可导出文件' };
        }
        let copiedCount = 0;
        const copyRecursive = (src, dest) => {
          const list = fs.readdirSync(src);
          for (const item of list) {
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
              if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
              copyRecursive(srcPath, destPath);
            } else {
              fs.copyFileSync(srcPath, destPath);
              copiedCount++;
            }
          }
        };
        copyRecursive(sourcesDir, exportDir);
        return { success: true, exportedCount: copiedCount, exportDir };
      }

      if (url === '/knowledge/import' && method === 'POST') {
        const { category = '默认知识库' } = body;
        const { dialog } = require('electron');
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindowRef(), {
          title: '选择要导入的本地文档 (支持 .txt, .md, .json)',
          filters: [{ name: '文档文件', extensions: ['txt', 'md', 'json'] }],
          properties: ['openFile', 'multiSelections']
        });
        if (canceled || filePaths.length === 0) return { success: false, message: '操作已取消' };
        let fileCount = 0;
        for (const filePath of filePaths) {
          try {
            const fileName = path.basename(filePath);
            const content = fs.readFileSync(filePath, 'utf8');
            queueManager.addTask('text', content, fileName, 'system-manual-import', {
              category,
              trustLevel: 'untrusted',
              filePath
            });
            fileCount++;
          } catch (err: any) {
            console.error('[主进程] 导入文件失败:', filePath, err.message);
          }
        }
        return { success: true, importedCount: fileCount };
      }

      if (url.startsWith('/knowledge/staging')) {
        const { vectorDbManager } = require('../backend/vector-db-manager');
        const stagingPath = path.join(dataDir, 'knowledge', `vectors_staging_inbox.json`);

        if (url.startsWith('/knowledge/staging/action') && method === 'POST') {
          const { source, action, category = '默认知识库' } = body;
          if (!source || !action) throw new Error('来源和操作类型不能为空');
          
          if (action === 'reject') {
            await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
              await stagingStore.removeBySource(source);
            });
            return { success: true };
          } else if (action === 'approve') {
            // [Red Team Fix] 避免锁死锁，先剥离再写入
            let docsToMove: any[] = [];
            let targetCategory = category;
            
            await vectorDbManager.executeWrite(stagingPath, async (stagingStore: any) => {
              // @ts-ignore
              docsToMove = stagingStore.documents.filter((doc: any) => doc.metadata?.source === source);
              if (docsToMove.length > 0) {
                targetCategory = docsToMove[0].metadata?.category || category;
                await stagingStore.removeBySource(source);
              }
            });

            if (docsToMove.length === 0) throw new Error('待考证区未找到该来源文档');
            
            const mainPath = path.join(dataDir, 'knowledge', `${targetCategory}.json`);
            await vectorDbManager.executeWrite(mainPath, async (mainStore: any) => {
              const verifiedDocs = docsToMove.map((doc: any) => {
                doc.metadata.status = 'verified';
                if (doc.metadata.category) doc.metadata.category = targetCategory;
                delete doc.metadata.failType;
                delete doc.metadata.failReason;
                return doc;
              });
              await mainStore.addDocuments(verifiedDocs);
            });

            // 联动补漏：手动审批通过时，自动将源内容物理写入/拷贝至 sources/ 目录下归档，维持数据一致性
            try {
              const task = queueManager.getTask(source);
              if (task) {
                queueManager.archivePhysicalFile(task, targetCategory);
              }
            } catch (e: any) {
              console.error('[RAG Staging] 手动审批时物理文件写盘失败:', e.message);
            }

            return { success: true };
          }
          throw new Error('不支持的操作类型: ' + action);
        }

        if (method === 'GET') {
          return await vectorDbManager.executeRead(stagingPath, (stagingStore: any) => {
            const stagingMap: Record<string, { source: string, chunkCount: number, status: string, failReason?: string, failType?: string, timestamp: number, category?: string }> = {};
            // @ts-ignore
            for (const doc of stagingStore.documents) {
              const src = doc.metadata?.source || '未知来源';
              if (!stagingMap[src]) {
                stagingMap[src] = {
                  source: src,
                  chunkCount: 0,
                  status: doc.metadata?.status || 'pending',
                  failReason: doc.metadata?.failReason,
                  failType: doc.metadata?.failType,
                  timestamp: doc.metadata?.timestamp || Date.now(),
                  category: doc.metadata?.category || '默认知识库'
                };
              }
              stagingMap[src].chunkCount++;
            }
            return Object.values(stagingMap);
          });
        }
      }

      if (url.startsWith('/knowledge/transfer')) {
        const category = getQueryParam(url, 'category') || '默认知识库';
        const { vectorDbManager } = require('../backend/vector-db-manager');
        
        let dbPath = path.join(dataDir, 'knowledge', `${category}.json`);
        if ((category === '默认知识库' || category === 'default') && !fs.existsSync(dbPath)) {
          const oldPath = path.join(dataDir, 'vectors.json');
          if (fs.existsSync(oldPath)) dbPath = oldPath;
        }

        if (method === 'GET') {
          return await vectorDbManager.executeRead(dbPath, (store: any) => {
            // @ts-ignore
            return { documents: store.documents };
          });
        } else if (method === 'POST') {
          const { documents } = body;
          if (!documents || !Array.isArray(documents)) throw new Error('导入的文档列表非法');
          
          await vectorDbManager.executeWrite(dbPath, async (store: any) => {
            await store.addDocuments(documents);
          });
          return { success: true, importedCount: documents.length };
        }
      }

      if (url === '/knowledge/watched-folders') {
        const settingsPath = path.join(dataDir, 'settings.json');
        let settings: any = {};
        try {
          if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        } catch (e) {}
        if (!settings.watchedFolders) settings.watchedFolders = [];

        if (method === 'GET') {
          return settings.watchedFolders;
        } else if (method === 'POST') {
          const { folderPath, category, trustLevel = 'trusted' } = body;
          if (!folderPath || !category) throw new Error('监控路径和目标分类不能为空');
          
          const exists = settings.watchedFolders.some((f: any) => f.path === folderPath);
          if (!exists) {
            settings.watchedFolders.push({ path: folderPath, category, trustLevel });
            fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
            // 热重载
            folderWatcher.startWatching(settings.watchedFolders);
          }
          return { success: true, watchedFolders: settings.watchedFolders };
        } else if (method === 'DELETE') {
          const { folderPath } = body;
          if (!folderPath) throw new Error('监控路径不能为空');
          
          settings.watchedFolders = settings.watchedFolders.filter((f: any) => f.path !== folderPath);
          fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
          // 热重载
          folderWatcher.startWatching(settings.watchedFolders);
          return { success: true, watchedFolders: settings.watchedFolders };
        }
      }

      // ================== 模型管理 ==================
      if (url === '/models') {
        if (method === 'GET') return modelManager.listModels();
        if (method === 'POST') {
          const result = modelManager.addModel(body);
          return result;
        }
      }

      if (url === '/models/active') {
        if (method === 'GET') return { modelId: modelManager.activeModelId };
        if (method === 'PUT') {
          modelManager.setActiveModel(body.modelId);
          return { success: true };
        }
      }

      if (url.startsWith('/models/') && method === 'DELETE') {
        const id = url.split('/').pop();
        modelManager.removeModel(id);
        return { success: true };
      }

      if (url === '/models/marketplace') {
        const { MODEL_MARKETPLACE } = require('../backend/registry');
        return MODEL_MARKETPLACE;
      }

      if (url === '/models/sync') {
        await modelManager.syncThirdPartyLocalModels();
        return { success: true };
      }

      if (url === '/models/local-detect') {
        return await modelManager.detectLocal();
      }

      if (url === '/models/ollama/list') {
        return await modelManager.getOllamaModels();
      }

      if (url === '/models/lmstudio/list') {
        return await modelManager.getLMStudioModels();
      }

      if (url === '/models/local/add') {
        const { provider, modelId, modelName, setDefault } = body;
        const globalId = provider === 'ollama' ? modelId : `lmstudio_${modelId}`;
        
        let existing = modelManager.models.find((m:any) => m.id === globalId);
        let newModel;
        if (!existing) {
          const config = {
            id: globalId,
            name: modelName || modelId,
            type: 'local',
            provider: provider === 'ollama' ? 'Ollama' : 'LM Studio',
            modelName: modelId,
            baseUrl: provider === 'ollama' ? 'http://127.0.0.1:11434' : 'http://127.0.0.1:1234/v1',
            apiKey: 'not-needed'
          };
          newModel = modelManager.addModel(config);
        } else {
          newModel = existing;
        }

        if (setDefault) {
          modelManager.setActiveModel(globalId);
        }
        return newModel;
      }

      if (url.startsWith('/models/local/')) {
        // 格式：/models/local/:provider/:modelId
        if (method === 'DELETE') {
          const parts = url.split('/');
          const provider = parts[3];
          const modelId = decodeURIComponent(parts[4]);
          const globalId = provider === 'ollama' ? modelId : `lmstudio_${modelId}`;
          modelManager.removeModel(globalId);
          return { success: true };
        }
      }

      if (url === '/models/proxy-fetch') {
        const { baseUrl, apiKey } = body;
        return modelManager.proxyFetchModels(baseUrl, apiKey);
      }

      if (url === '/models/proxy-test') {
        const { baseUrl, apiKey } = body;
        return modelManager.proxyTest(baseUrl, apiKey);
      }

      // ================== 记忆管理 ==================
      if (url.startsWith('/memory')) {
        if (url === '/memory' && method === 'POST') {
          const { content, category, tags } = body;
          const memory = memoryStore.addMemory(content, category, tags);
          return memory;
        }
        if (url.startsWith('/memory/search')) {
          const q = getQueryParam(url, 'q');
          const limit = parseInt(getQueryParam(url, 'limit')) || 10;
          return memoryStore.searchMemory(q, limit);
        }
        if (url.startsWith('/memory/') && method === 'DELETE') {
          const id = url.split('/').pop();
          memoryStore.deleteMemory(id);
          return { success: true };
        }
        // 分页获取
        const page = parseInt(getQueryParam(url, 'page')) || 1;
        const pageSize = parseInt(getQueryParam(url, 'pageSize')) || 50;
        const category = getQueryParam(url, 'category');
        return memoryStore.getAllMemories(page, pageSize, category);
      }

      // ================== 自动控制 ==================
      if (url === '/automation/screenshot') {
        const outputPath = await automation.captureScreen();
        return { success: true, path: outputPath };
      }

      // ================== 文件读取为 DataURL（图片预览用） ==================
      if (url === '/system/readFileAsDataUrl' && method === 'POST') {
        const { filePath } = body;
        if (!filePath) throw new Error('文件路径不能为空');
        const fs = require('fs');
        const path = require('path');
        const { nativeImage } = require('electron');
        if (!fs.existsSync(filePath)) throw new Error('文件不存在');

        const ext = path.extname(filePath).toLowerCase().replace('.', '');
        const mimeMap: Record<string, string> = {
          'png': 'image/png', 'jpg': 'image/jpeg', 'jpeg': 'image/jpeg',
          'gif': 'image/gif', 'bmp': 'image/bmp', 'webp': 'image/webp',
          'svg': 'image/svg+xml'
        };
        const mime = mimeMap[ext] || 'application/octet-stream';
        
        // [OOM Fix] 使用 Electron nativeImage 进行图片压缩与降级，防止超大图片撑爆内存
        let base64 = '';
        if (['png', 'jpg', 'jpeg', 'bmp', 'webp'].includes(ext)) {
          const image = nativeImage.createFromPath(filePath);
          const size = image.getSize();
          // 如果图片宽或高超过 1600px，则等比例缩放
          if (size.width > 1600 || size.height > 1600) {
             const ratio = Math.min(1600 / size.width, 1600 / size.height);
             const resized = image.resize({ 
               width: Math.floor(size.width * ratio), 
               height: Math.floor(size.height * ratio) 
             });
             base64 = resized.toJPEG(75).toString('base64');
          } else {
             // 即使尺寸不大，也压缩质量防止原图体积过大
             base64 = image.toJPEG(80).toString('base64');
          }
        } else {
          // 对于 gif, svg 等不支持压缩的格式，回退为原始读取
          const buffer = fs.readFileSync(filePath);
          base64 = buffer.toString('base64');
        }
        
        return { data: `data:${mime};base64,${base64}` };
      }

      // ================== 沙盒控制 ==================
      if (url === '/system/parseDocument' && method === 'POST') {
        const { filePath, convId } = body;
        if (!filePath) throw new Error('文件路径不能为空');
        if (!convId) throw new Error('必须提供关联的 Conversation ID');
        const fs = require('fs');
        if (!fs.existsSync(filePath)) throw new Error('文件不存在');
        
        try {
          const ext = filePath.split('.').pop().toLowerCase();
          const fileName = require('path').basename(filePath);
          const { DocumentParser } = require('../backend/document-parser');
          
          let textFilePath = filePath;
          let totalLength = 0;
          
          const pureTextExts = ['txt', 'md', 'json', 'csv', 'html', 'xml', 'log'];
          const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
          
          if (pureTextExts.includes(ext)) {
            // [OOM Fix & 全量注入] 纯文本文件直接返回物理路径，由大模型 Provider 拦截并 JIT 组装为全量 Context
            const fs = require('fs');
            const stats = fs.statSync(filePath);
            totalLength = stats.size; // 粗略用字节数替代
          } else if (!imageExts.includes(ext)) {
            // 需要提炼的富文本文档 (PDF, Office 等)
            let parsedText = '';
            if (ext === 'pdf') {
              parsedText = await DocumentParser.extractTextFromMultiModal(filePath, 'application/pdf');
            } else {
              const officeExts = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'rtf'];
              if (officeExts.includes(ext)) {
                const officeParser = require('officeparser');
                const parsedResult = await officeParser.parseOffice(filePath);
                parsedText = typeof parsedResult === 'string' ? parsedResult : parsedResult.toText();
              } else {
                parsedText = require('fs').readFileSync(filePath, 'utf8');
              }
            }
            
            if (!parsedText || parsedText.trim().length === 0) {
              throw new Error('未从文档中提取到任何可识别文字内容。');
            }
            
            totalLength = parsedText.length;
            
            // 将提取出的纯文本缓存到临时物理目录
            const path = require('path');
            const fs = require('fs');
            const tempDir = path.join(dataDir, 'temp_attachments');
            if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
            
            textFilePath = path.join(tempDir, `${convId}_${fileName}.txt`);
            fs.writeFileSync(textFilePath, parsedText, 'utf8');
          }
          
          return { 
            success: true, 
            textFilePath,
            length: totalLength
          };
        } catch (e: any) {
          throw new Error(`文档解析失败: ${e.message}`);
        }
      }

      if (url === '/system/saveToKnowledge' && method === 'POST') {
        const { filePath, convId } = body;
        if (!filePath || !convId) throw new Error('缺少必要参数');
        const fs = require('fs');
        if (!fs.existsSync(filePath)) throw new Error('文件不存在');
        try {
          const ext = filePath.split('.').pop().toLowerCase();
          const fileName = require('path').basename(filePath);
          const { DocumentParser } = require('../backend/document-parser');
          
          let parsedText = '';
          const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
          if (imageExts.includes(ext)) {
            parsedText = await DocumentParser.extractTextFromMultiModal(filePath, `image/${ext}`);
          } else if (ext === 'pdf') {
            parsedText = await DocumentParser.extractTextFromMultiModal(filePath, 'application/pdf');
          } else {
            const officeExts = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'rtf'];
            if (officeExts.includes(ext)) {
              const officeParser = require('officeparser');
              const parsedResult = await officeParser.parseOffice(filePath);
              parsedText = typeof parsedResult === 'string' ? parsedResult : parsedResult.toText();
            } else {
              // [OOM Fix] 纯文本文件：流式分块读取并分批投递任务，防止撑爆内存和 LLM 上下文
              await DocumentParser.parseTextFileStream(filePath, async (chunks) => {
                const chunkText = chunks.map((c: any) => c.parentContent).join('\n\n');
                if (chunkText.trim().length > 0) {
                  // 分批投递任务，限制单次提取的文本长度
                  queueManager.addTask('text', chunkText, fileName, convId, { 
                    source: 'MANUAL_IMPORT_CHUNKED', 
                    priority: 'normal' // 后续切片使用普通优先级，防止阻塞
                  });
                }
              }, 10000, 500, 2000, 200); // 使用极大的切片尺寸专供 LLM 提炼

              return { success: true };
            }
          }
          
          if (!parsedText || parsedText.trim().length === 0) {
            throw new Error('未从文档中提取到任何可识别文字内容。');
          }

          // 用户手动导入的非纯文本知识（通常较小），加入元数据区分其积极性
          queueManager.addTask('text', parsedText, fileName, convId, { 
            source: 'MANUAL_IMPORT', 
            priority: 'high' 
          });

          return { success: true };
        } catch (e: any) {
          throw new Error(`知识库保存失败: ${e.message}`);
        }
      }

      if (url === '/sandbox/execute') {
        const { command, confirmed, permanent, cwd, timeout, confirmationId } = body;
        if (!command) throw new Error('命令不能为空');
        // S5：Agent 模式确认回灌——若存在 confirmationId，说明是渲染端对挂起确认的回应，
        // 直接唤醒 agent-loop，由它在本地执行（避免此处二次执行）。
        if (confirmationId) {
          const ok = confirmationBus.resolve(confirmationId, {
            decision: confirmed ? 'confirmed' : 'rejected',
            permanent: !!permanent,
          });
          return { acknowledged: true, resolved: ok };
        }
        if (confirmed) {
          return sandbox.executeConfirmed(command, permanent, { cwd, timeout });
        } else {
          return sandbox.execute(command, { cwd, timeout });
        }
      }

      // S6：独立防篡改审计（读取受 RBAC sandbox:read 保护；清空需 sandbox:write）
      if (url === '/sandbox/audit') {
        const page = parseInt(getQueryParam(url, 'page')) || 1;
        const pageSize = parseInt(getQueryParam(url, 'pageSize')) || 50;
        return sandbox.getAudit(page, pageSize);
      }
      if (url === '/sandbox/audit/clear') {
        sandbox.clearAudit();
        return { success: true };
      }

      if (url === '/sandbox/permissions') {
        if (method === 'GET') return sandbox.getPermissions();
        if (method === 'POST') {
          const { pattern, permanent } = body;
          return sandbox.grantPermission(pattern, permanent);
        }
      }

      if (url.startsWith('/sandbox/permissions/') && method === 'DELETE') {
        const id = url.split('/').pop();
        sandbox.revokePermission(id);
        return { success: true };
      }

      if (url.startsWith('/sandbox/logs')) {
        const page = parseInt(getQueryParam(url, 'page')) || 1;
        const pageSize = parseInt(getQueryParam(url, 'pageSize')) || 50;
        return sandbox.getLogs(page, pageSize);
      }

      // ================== 技能管理 ==================
      if (url.startsWith('/skills')) {
        const skillsPath = path.join(dependencies.dataDir, 'skills.json');
        let installedSkills = [];
        try {
          if (fs.existsSync(skillsPath)) installedSkills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
        } catch(e) {}
        const saveSkills = () => fs.writeFileSync(skillsPath, JSON.stringify(installedSkills, null, 2));

        if (url === '/skills' && method === 'GET') {
          return installedSkills;
        }

        if (url === '/skills/install' && method === 'POST') {
          const { skillId } = body;
          const { SKILL_MARKET } = require('../backend/registry');
          const skill = SKILL_MARKET.find(s => s.id === skillId);
          if (!skill) throw new Error('技能不存在');
          if (!installedSkills.some(s => s.id === skillId)) {
            const newSkill = { ...skill, installedAt: new Date().toISOString() };
            installedSkills.push(newSkill);
            saveSkills();
            return newSkill;
          }
          return { success: true };
        }

        if (url.startsWith('/skills/marketplace')) {
          const { SKILL_MARKET } = require('../backend/registry');
          const search = getQueryParam(url, 'search');
          const type = getQueryParam(url, 'type');
          const sort = getQueryParam(url, 'sort');
          let skills = [...SKILL_MARKET];

          if (search) {
            const q = search.toLowerCase();
            skills = skills.filter(s => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q));
          }

          if (type && type !== '全部') {
            skills = skills.filter(s => s.type === type);
          }

          const sortBy = sort || 'downloads';
          if (sortBy === 'downloads') skills.sort((a, b) => b.downloads - a.downloads);
          if (sortBy === 'rating') skills.sort((a, b) => b.rating - a.rating);
          if (sortBy === 'updated') skills.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));

          skills = skills.map(s => ({ ...s, status: installedSkills.some(i => i.id === s.id) ? 'installed' : 'not_installed' }));
          const allTypes = [...new Set(SKILL_MARKET.map(s => s.type))];

          return { total: skills.length, filters: { types: allTypes }, items: skills };
        }

        if (method === 'DELETE') {
          const id = url.split('/').pop();
          installedSkills = installedSkills.filter(s => s.id !== id);
          saveSkills();
          return { success: true };
        }
      }

      // ================== 插件管理 ==================
      if (url.startsWith('/plugins')) {
        const pluginsPath = path.join(dependencies.dataDir, 'plugins.json');
        let installedPlugins = [];
        try {
          if (fs.existsSync(pluginsPath)) installedPlugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
        } catch(e) {}
        const savePlugins = () => fs.writeFileSync(pluginsPath, JSON.stringify(installedPlugins, null, 2));

        if (url === '/plugins' && method === 'GET') {
          return installedPlugins;
        }

        if (url === '/plugins/install' && method === 'POST') {
          const { pluginId } = body;
          const { OPENHUB_REGISTRY } = require('../backend/registry');
          const plugin = OPENHUB_REGISTRY.find(p => p.id === pluginId);
          if (!plugin) throw new Error('插件不存在');
          if (installedPlugins.some(p => p.id === pluginId)) throw new Error('插件已安装');
          const newPlugin = { ...plugin, status: 'offline', installedAt: new Date().toISOString() };
          installedPlugins.push(newPlugin);
          savePlugins();
          return newPlugin;
        }

        if (url.startsWith('/plugins/marketplace')) {
          const { OPENHUB_REGISTRY } = require('../backend/registry');
          const search = getQueryParam(url, 'search');
          const type = getQueryParam(url, 'type');
          const tag = getQueryParam(url, 'tag');
          const sort = getQueryParam(url, 'sort');
          const verified = getQueryParam(url, 'verified');
          const page = parseInt(getQueryParam(url, 'page')) || 1;
          const pageSize = parseInt(getQueryParam(url, 'pageSize')) || 50;

          let plugins = OPENHUB_REGISTRY.map(p => ({
            ...p,
            installed: installedPlugins.some(ip => ip.id === p.id),
            status: installedPlugins.find(ip => ip.id === p.id)?.status || 'not_installed',
          }));

          if (search) {
            const q = search.toLowerCase();
            plugins = plugins.filter(p =>
              p.name.toLowerCase().includes(q) ||
              p.nameEn.toLowerCase().includes(q) ||
              p.description.toLowerCase().includes(q) ||
              p.tags.some(t => t.toLowerCase().includes(q))
            );
          }

          if (type && type !== '全部') plugins = plugins.filter(p => p.type === type);
          if (tag && tag !== '全部') plugins = plugins.filter(p => p.tags.includes(tag));
          if (verified === 'true') plugins = plugins.filter(p => p.verified);

          const sortBy = sort || 'downloads';
          if (sortBy === 'downloads') plugins.sort((a, b) => b.downloads - a.downloads);
          if (sortBy === 'stars') plugins.sort((a, b) => b.stars - a.stars);
          if (sortBy === 'rating') plugins.sort((a, b) => b.rating - a.rating);

          const total = plugins.length;
          const paged = plugins.slice((page - 1) * pageSize, page * pageSize);
          const allTags = OPENHUB_REGISTRY ? [...new Set(OPENHUB_REGISTRY.flatMap((pl:any) => pl.tags || []))] : [];
          const allTypes = OPENHUB_REGISTRY ? [...new Set(OPENHUB_REGISTRY.map((pl:any) => pl.type))] : [];

          return {
            source: 'OpenHub',
            total,
            page,
            pageSize,
            filters: { types: allTypes, tags: allTags },
            items: paged,
          };
        }

        if (url.endsWith('/config') && method === 'PUT') {
          const id = url.split('/')[2];
          const plugin = installedPlugins.find(p => p.id === id);
          if (!plugin) throw new Error('插件未安装');
          plugin.config = body.config || body;
          savePlugins();
          return plugin;
        }

        if (url.endsWith('/connect') && method === 'POST') {
          const id = url.split('/')[2];
          const plugin = installedPlugins.find(p => p.id === id);
          if (!plugin) throw new Error('插件未安装');
          plugin.status = 'online';
          return { success: true, status: 'online' };
        }

        if (url.endsWith('/disconnect') && method === 'POST') {
          const id = url.split('/')[2];
          const plugin = installedPlugins.find(p => p.id === id);
          if (!plugin) throw new Error('插件未安装');
          plugin.status = 'offline';
          return { success: true, status: 'offline' };
        }

        if (method === 'DELETE') {
          const id = url.split('/').pop();
          installedPlugins = installedPlugins.filter(p => p.id !== id);
          savePlugins();
          return { success: true };
        }
      }

      // ================== 系统设置 ==================
      if (url.startsWith('/settings')) {
        const settingsPath = path.join(dependencies.dataDir, 'settings.json');
        let settings = {};
        try {
          if (fs.existsSync(settingsPath)) settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
        } catch { settings = {}; }
        const saveSettings = () => fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');

        if (url === '/settings') {
          if (method === 'GET') return settings;
          if (method === 'PUT') {
            Object.assign(settings, body);
            saveSettings();
            return { success: true };
          }
        } else {
          const key = url.split('/').pop();
          if (method === 'GET') return { key, value: settings[key] };
          if (method === 'PUT') {
            settings[key] = body.value;
            saveSettings();
            return { success: true };
          }
        }
      }

      // ================== 原版引擎核心套件管理 (Core Manager) ==================
      if (url === '/core-manager/status') {
        const installStatus = openClawInstaller.getStatus();
        const daemonStatus = openClawDaemon.getStatus();
        // 加入当前配置的路径给前端展示
        return { installStatus, daemonStatus, currentDir: openClawInstaller.getInstallDir() };
      }

      if (url === '/core-manager/bind-path' && method === 'POST') {
        const { targetPath } = body;
        if (!targetPath) throw new Error('目标路径为空');
        openClawInstaller.setCustomDir(targetPath);
        openClawDaemon.setInstallDir(targetPath);
        return { success: true, message: '已成功挂载外部引擎目录', path: targetPath };
      }


      // 这些是极耗时的黑盒操作，直接用Promise包裹，内部通过IPC向外广播日志
      if (url.startsWith('/core-manager/action/')) {
        const action = url.split('/').pop();
        const mainWindow = mainWindowRef();
        // 定义专属的日志流式输出回调，通过一个新的事件名下发给前端
        const onLog = (msg: string) => {
          if (mainWindow) {
            mainWindow.webContents.send('api:core-manager:log', msg + '\n');
          }
        };

        if (action === 'install') {
          openClawInstaller.install(onLog).catch(e => onLog(`[ERROR] ${e.message}`));
          return { success: true, message: '安装进程已转入后台流水线执行' };
        } else if (action === 'update') {
          openClawInstaller.update(onLog).catch(e => onLog(`[ERROR] ${e.message}`));
          return { success: true, message: '更新进程已在后台执行' };
        } else if (action === 'uninstall') {
          openClawInstaller.uninstall(onLog).catch(e => onLog(`[ERROR] ${e.message}`));
          return { success: true, message: '卸载进程已在后台执行' };
        } else if (action === 'start') {
          openClawDaemon.start(onLog).catch(e => onLog(`[ERROR] ${e.message}`));
          return { success: true, message: '拉起进程指令已下达' };
        } else if (action === 'stop') {
          openClawDaemon.stop(onLog);
          return { success: true, message: '终止进程指令已下达' };
        }
      }

      // ================== 权限管理 ==================
      if (url === '/permissions') {
        if (method === 'GET') return permissionManager.getPermissionConfig();
        if (method === 'PUT') {
          permissionManager.updatePermissionConfig(body);
          return { success: true };
        }
      }

      if (url === '/permissions/roles') {
        return permissionManager.getRoles();
      }

      throw new Error(`未找到匹配的本地 IPC API 路由: ${url}`);
    } catch (err: any) {
      console.error(`[IPC API 路由错误] ${method} ${url}:`, err);
      throw err;
    }
  });

  // ================== 特殊：大模型流式对话 IPC 接口 ==================
  let activeAbortController: AbortController | null = null;

  ipcMain.handle('api:chat:stream', async (event, payload) => {
    const { conversationId, message, attachment, modelId, systemPrompt, temperature, agentMode } = payload;
    const mainWindow = mainWindowRef();
    if (!mainWindow) throw new Error('主窗口未就绪');

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const signal = activeAbortController.signal;

    try {
      const { ContextAggregator } = require('../backend/dialogue-orchestrator');
      const aggregator = new ContextAggregator({
        modelManager,
        memoryStore,
        sandbox,
        dataDir,
        mainWindowRef,
        jobQueue
      });
      
      await aggregator.executeChatStream(payload, signal);
    } catch (err: any) {
      if (err.name === 'AbortError' || err.message === 'AbortError') {
        console.log('[流式对话] 推理请求已被主动中断。');
      } else {
        console.error('[流式对话错误]：', err);
        mainWindow.webContents.send('api:chat:chunk', { type: 'error', message: err.message });
      }
    } finally {
      activeAbortController = null;
    }
  });

  // 主动中断对话流
  ipcMain.handle('api:chat:abort', () => {
    if (activeAbortController) {
      activeAbortController.abort();
      activeAbortController = null;
      console.log('[主进程] 已接收前端指令，强制 Abort 取消大模型对话推理流');
      return { success: true };
    }
    return { success: false };
  });

  // 流式提示词优化句柄
  ipcMain.handle('api:chat:optimize-stream', async (event, payload) => {
    const { text, modelId } = payload;
    const mainWindow = mainWindowRef();
    if (!mainWindow) throw new Error('主窗口未就绪');

    const systemPrompt = `你是一个世界顶尖的提示词工程专家，擅长将普通用户的简短、模糊需求重构成高度专业、执行力极强的提示词（Prompt）。请执行以下步骤来理解并优化用户的原始输入：

1. 意图深度分析与分类：
   - 在 <thought> 标签内简短说明你的分析（不超过100字）：识别用户输入是属于“工具/特定角色/自动化办公/系统级操控/复杂编程类”还是“内容创作/日常润色/知识问答类”，并梳理其缺失的关键背景、限制条件和改进方向。

2. 提示词自适应优化原则：
   根据意图分类，在 <optimized_prompt> 标签内输出重构后的提示词，必须符合以下两个场景之一的规范：

   【场景 A：工具/特定角色/自动化办公/系统级操控/复杂编程类】
   吸收“字节 Trae”多阶段任务拆解及“马维斯/Workbuddy”的核心思想，将模糊意图转化为极具工程遵循性、有边界的控制指令。必须使用 Markdown 框架重写：
   - ## Role (角色设定): 赋予大模型极其专业且符合该场景的顶尖专家身份。
   - ## Profile (画像设定): 设定思考模式、技术偏好与专业素养。
   - ## Context (环境上下文): 明确该任务所处的软件环境、当前代码上下文，并提示用户将 # 相关文件或路径填入此处。
   - ## Multi-Phase Workflow (多阶段渐进式工作流 - Trae 核心):
     - 如果任务十分复杂或庞大，绝对禁止要求模型一次性生成所有成果。你必须强制重构为“分阶段渐进式 Todo 列表”（如 Phase 1, Phase 2, Phase 3...）。
     - 在每个阶段的末尾，默认追加强制性控制契约：“此阶段执行完毕并输出结果后，请立即在此处暂停，向我请示确认。禁止擅自执行下一阶段的代码或指令编写。”
   - ## Variables (变量插槽): 若需求缺少物理路径、配置等，使用 [变量名，如：待整理的文件夹路径] 格式标记占位符，引导用户在使用此提示词前手动替换。
   - ## Constraints & Safety (约束与技术防线): 
     1. 制定强约束条件（格式要求、禁止行为、边界场景处理）。
     2. 涉及编程任务时，强制写入技术契约（如：代码高内聚低耦合、强类型约束、包含详尽异常捕获、禁止污染全局变量等）。
     3. 涉及高危文件操作，必须写入物理防线（如：“仅提供修改预览或详细方案建议，在获得我口头确认前，严禁直接执行写入、覆盖或删除操作”）。
     4. 默认追加一句人机回环追问防错声明：“如果在执行本任务时遇到任何关键参数缺失或逻辑冲突，请务必立即暂停并向我提问确认，不要擅自做出任何主观假设。”

   【场景 B：即兴创作/文章润色/日常问答类】
   对于非流程化的创作，扩充为细节饱满、要求具体的段落化指令，涵盖：
   - 明确的上下文背景与应用场景。
   - 指定具体的目标受众、语气风格（如专业、通俗、幽默、严谨）。
   - 细化文章或回答的结构层次，避免笼统要求。
   - 规定内容深度、避免的常见雷区或无意义的官话。

3. 输出格式控制：
   - 只能且必须输出包含 <thought>...</thought> 和 <optimized_prompt>...</optimized_prompt> 两个标签的内容，不要输出 any 其他的解释或多余的引导语。
   - 优化后的提示词内容必须全部使用简体中文（除非用户原意图有翻译或特定外语要求）。
   - <optimized_prompt> 内部的内容应当可直接复制使用。`;

    try {
      await modelManager.chatStream(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        { modelId, temperature: 0.2 },
        (chunk) => {
          if (!mainWindow.webContents.isDestroyed()) {
            mainWindow.webContents.send('api:chat:optimize-chunk', { type: 'chunk', content: chunk });
          }
        }
      );
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('api:chat:optimize-chunk', { type: 'done' });
      }
    } catch (err: any) {
      console.error('[优化提示词 IPC 异常]：', err);
      if (!mainWindow.webContents.isDestroyed()) {
        mainWindow.webContents.send('api:chat:optimize-chunk', { type: 'error', message: err.message });
      }
    }
  });
}

// 辅助方法：从 URL 字符串解析查询参数
function getQueryParam(url: string, param: string): string {
  try {
    const qPart = url.split('?')[1];
    if (!qPart) return '';
    const params = qPart.split('&');
    for (const p of params) {
      const [k, v] = p.split('=');
      if (k === param) return decodeURIComponent(v || '');
    }
  } catch {}
  return '';
}
