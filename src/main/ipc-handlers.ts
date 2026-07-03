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

export function registerApiIpc(dependencies, mainWindowRef) {
  const { memoryStore, modelManager, sandbox, permissionManager, automation, baseDataDir, globalConfigPath } = dependencies;

  // 统一的 API 原生 IPC 通道分发器
  ipcMain.handle('api:call', async (event, { url, options = {} }) => {
    const method = options.method || 'GET';
    const body = options.body || {};
    
    try {
      // ================== 系统配置 ==================
      if (url === '/system/global-config') {
        if (method === 'GET') {
          let config: any = {};
          if (fs.existsSync(globalConfigPath)) {
            config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
          }
          return {
            customDataDir: config.customDataDir || baseDataDir,
            customDownloadDir: config.customDownloadDir || baseDataDir,
            customLogDir: config.customLogDir || baseDataDir
          };
        } else if (method === 'POST') {
          const { customDataDir, customDownloadDir, customLogDir } = body;
          let config: any = {};
          if (fs.existsSync(globalConfigPath)) {
            config = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
          }
          if (customDataDir !== undefined) config.customDataDir = customDataDir;
          if (customDownloadDir !== undefined) config.customDownloadDir = customDownloadDir;
          if (customLogDir !== undefined) config.customLogDir = customLogDir;
          fs.writeFileSync(globalConfigPath, JSON.stringify(config, null, 2), 'utf8');
          return { success: true, message: '全局配置已保存，重启生效', config };
        }
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
          memoryStore.moveToTrash(id);
          return { success: true };
        } else {
          if (method === 'DELETE') {
            memoryStore.deleteConversation(id);
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

      // ================== 知识库引擎 (RAG) ==================
      if (url === '/knowledge/add' && method === 'POST') {
        const { files } = body; // 假定前端传来了文件内容数组 {name, content}
        const { VectorStore } = require('../backend/vector-store');
        const { DocumentParser } = require('../backend/document-parser');
        const store = new VectorStore(path.join(baseDataDir, 'vectors.json'));
        await store.load();
        
        let totalChunks = 0;
        for (const file of files) {
           const chunks = DocumentParser.splitTextIntoChunks(file.content || '');
           const docs = [];
           for (const c of chunks) {
             const embedding = await modelManager.getEmbedding(c.content);
             docs.push({
               id: require('crypto').randomUUID(),
               content: c.content,
               metadata: { source: file.name, index: c.index },
               embedding
             });
           }
           await store.addDocuments(docs);
           totalChunks += docs.length;
        }
        return { success: true, chunksGenerated: totalChunks };
      }

      if (url === '/knowledge/search' && method === 'POST') {
        const { query } = body;
        const { VectorStore } = require('../backend/vector-store');
        const store = new VectorStore(path.join(baseDataDir, 'vectors.json'));
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
        
        // 重排后截断，仅允许最高精度的 Top-3 送入大模型，零上下文污染
        candidates.sort((a, b) => b.score - a.score);
        const results = candidates.slice(0, 3);
        
        return { results };
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
          memoryStore.deleteMemory(parseInt(id));
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

      // ================== 沙盒控制 ==================
      if (url === '/system/parseDocument' && method === 'POST') {
        const { filePath, convId } = body;
        if (!filePath) throw new Error('文件路径不能为空');
        if (!convId) throw new Error('必须提供关联的 Conversation ID');
        const fs = require('fs');
        if (!fs.existsSync(filePath)) throw new Error('文件不存在');
        
        try {
          const ext = filePath.split('.').pop().toLowerCase();
          const officeParser = require('officeparser');
          
          let parsedText = '';
          const officeExts = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'pdf', 'rtf'];
          if (officeExts.includes(ext)) {
            parsedText = await officeParser.parseOfficeAsync(filePath);
          } else {
            // 纯文本后备处理
            parsedText = fs.readFileSync(filePath, 'utf8');
          }
          
          // 写入 RAG 引擎
          const { ragEngine } = require('../backend/rag-engine');
          const fileName = require('path').basename(filePath);
          ragEngine.addDocument(convId, fileName, parsedText);
          
          return { success: true, length: parsedText.length };
        } catch (e: any) {
          throw new Error(`文档解析失败: ${e.message}`);
        }
      }

      if (url === '/sandbox/execute') {
        const { command, confirmed, permanent, cwd, timeout } = body;
        if (!command) throw new Error('命令不能为空');
        if (confirmed) {
          return sandbox.executeConfirmed(command, permanent, { cwd, timeout });
        } else {
          return sandbox.execute(command, { cwd, timeout });
        }
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
      let convId = conversationId;
      if (!convId) {
        const conv = memoryStore.createConversation('新对话');
        convId = conv.id;
        mainWindow.webContents.send('api:chat:chunk', { type: 'conversation', id: convId });
      }

      let finalContent = message;
      if (attachment) {
        finalContent = [
          { type: 'text', text: message },
          { type: 'image_url', image_url: { url: attachment } }
        ];
      }

      memoryStore.saveMessage(convId, 'user', finalContent);

      let history = memoryStore.getConversationHistory(convId);
      if (history.length > 20) history = history.slice(history.length - 20);
      let messages = history.map((m, index) => {
        let content = m.content;
        try {
          if (typeof content === 'string' && content.startsWith('[')) {
             content = JSON.parse(content);
             if (index < history.length - 1) {
               const textBlock = content.find(c => c.type === 'text');
               content = textBlock ? textBlock.text : '[历史图片]';
             }
          }
        } catch(e) {}
        return { role: m.role, content: content };
      });

      // [Task 2.3] 使用高级双路召回 (BM25 + Dense) 来匹配相关的长期记忆
      const { VectorStore } = require('../backend/vector-store');
      const memoryVecStore = new VectorStore(path.join(baseDataDir, 'memories_vectors.json'));
      await memoryVecStore.load();
      
      let augmentedSystemPrompt = systemPrompt || '你是一个有用的、无所不知的人工智能助手。';
      
      try {
        const msgEmbedding = await modelManager.getEmbedding(message);
        const relevantMemories = await memoryVecStore.search(msgEmbedding, message, 3);
        
        if (relevantMemories && relevantMemories.length > 0) {
          const memoryContext = relevantMemories.map(m => `- ${m.doc.content}`).join('\n');
          augmentedSystemPrompt += `\n\n[用户相关的长期记忆（仅供参考）：]\n${memoryContext}`;
        }
      } catch (e) {
        console.log('[语义记忆检索跳过]', e.message);
      }

      // 动态检索 RAG 知识库
      const { ragEngine } = require('../backend/rag-engine');
      const ragChunks = ragEngine.searchRelevant(convId, message, 3);
      if (ragChunks && ragChunks.length > 0) {
        const ragContext = ragChunks.map(c => `[文本切片: ${c.fileName}]\n${c.chunkText}`).join('\n\n---\n\n');
        augmentedSystemPrompt += `\n\n[参考知识库（这是通过 RAG 检索引擎查找到的与用户当前提问最相关的文档片段。如果与提问相关，请优先参考这些内容作答）：]\n${ragContext}`;
      }

      const semanticMemoryPrompt = `\n\n[长期记忆能力]: 当你在对话中获取了关于用户的持久性事实、偏好或习惯时，请在回复的最后加上 \`[SAVE_MEMORY: 事实内容]\`，以便系统为你永久记住它。例如：\`[SAVE_MEMORY: 用户是一名后端开发工程师]\`。`;
      augmentedSystemPrompt += semanticMemoryPrompt;

      const toolPrompt = `\n\n[系统能力]: 你拥有沙盒环境执行能力。如果用户要求运行脚本、查看本地环境、读取文件、操作目录等，请直接输出 <execute>具体的系统命令</execute> 。你会自动收到命令执行结果，并基于结果继续回答。请不要在执行前编造执行结果。`;
      augmentedSystemPrompt += toolPrompt;

      messages.unshift({ role: 'system', content: augmentedSystemPrompt });

      const chatRecursion = async (currentMessages, recursionCount = 0) => {
        if (signal.aborted) throw new Error('AbortError');
        let accumulatedReply = '';
        const fullReply = await modelManager.chatStream(currentMessages, { modelId, temperature, signal, agentMode }, (chunk) => {
          accumulatedReply += chunk;
          mainWindow.webContents.send('api:chat:chunk', { type: 'chunk', content: chunk });
        });

        const execMatch = accumulatedReply.match(/<execute>([\s\S]*?)<\/execute>/i);
        if (execMatch && recursionCount < 3) {
          const cmd = execMatch[1].trim();
          
          try {
            const execResult = await sandbox.execute(cmd, { timeout: 15000 });
            if (execResult.needsConfirmation) {
              mainWindow.webContents.send('api:chat:chunk', { 
                type: 'requires_confirmation', 
                command: cmd,
                riskLevel: execResult.riskLevel,
                message: execResult.message,
                conversationId: convId
              });
              memoryStore.saveMessage(convId, 'assistant', accumulatedReply);
              return accumulatedReply;
            }

            mainWindow.webContents.send('api:chat:chunk', { type: 'chunk', content: `\n\n> 🤖 [系统工具] 正在执行命令: \`${cmd}\` ...\n` });
            let outputText = execResult.stdout || execResult.stderr || '执行成功，无终端输出';
            if (outputText.length > 2000) outputText = outputText.slice(0, 2000) + '\n... (内容过长已截断)';
            
            mainWindow.webContents.send('api:chat:chunk', { type: 'chunk', content: `> ✅ 执行完成，继续响应中...\n\n` });
            
            currentMessages.push({ role: 'assistant', content: accumulatedReply });
            currentMessages.push({ role: 'user', content: `[沙盒命令执行结果]:\n${outputText}\n请基于此结果继续回答。` });
            
            return accumulatedReply + '\n\n' + await chatRecursion(currentMessages, recursionCount + 1);
          } catch (e: any) {
            mainWindow.webContents.send('api:chat:chunk', { type: 'chunk', content: `\n\n> 🤖 [系统工具] 正在执行命令: \`${cmd}\` ...\n` });
            mainWindow.webContents.send('api:chat:chunk', { type: 'chunk', content: `> ❌ 执行失败，继续响应中...\n\n` });
            currentMessages.push({ role: 'assistant', content: accumulatedReply });
            currentMessages.push({ role: 'user', content: `[沙盒执行失败]: ${e.message}\n请向用户说明情况，或尝试其他命令。` });
            return accumulatedReply + '\n\n' + await chatRecursion(currentMessages, recursionCount + 1);
          }
        }
        return accumulatedReply;
      };

      const finalReply = await chatRecursion(messages);

      const memoryMatches = finalReply.match(/\[SAVE_MEMORY:([\s\S]*?)\]/g);
      if (memoryMatches) {
        // [Task 2.1] 获取或实例化独立的语义记忆存储库
        const { VectorStore } = require('../backend/vector-store');
        const memoryVecStore = new VectorStore(path.join(baseDataDir, 'memories_vectors.json'));
        await memoryVecStore.load();
        
        for (const match of memoryMatches) {
          const fact = match.replace(/\[SAVE_MEMORY:/, '').replace(/\]$/, '').trim();
          if (fact) {
            // 写入传统的关系型 SQLite (用于界面展示和管理)
            memoryStore.addMemory(fact, 'User Preference', '["auto"]');
            
            // 写入高端向量倒排库 (用于无感语义召回)
            try {
              const embedding = await modelManager.getEmbedding(fact);
              await memoryVecStore.addDocuments([{
                id: require('crypto').randomUUID(),
                content: fact,
                metadata: { source: 'auto_extraction', timestamp: new Date().toISOString() },
                embedding
              }]);
              console.log('[自动提取语义记忆并入库]', fact);
            } catch (e) {
              console.error('[记忆向量化失败]', e.message);
            }
          }
        }
      }

      const cleanReply = finalReply.replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '').trim();
      memoryStore.saveMessage(convId, 'assistant', cleanReply);
      mainWindow.webContents.send('api:chat:chunk', { type: 'done', conversationId: convId });
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
