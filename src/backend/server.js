/**
 * OpenClaw 智能助手 - Express API 服务器
 * 提供所有后端功能的 RESTful API
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { ModelManager } = require('./model-manager');
const { MemoryStore } = require('./memory-store');
const { SandboxExecutor } = require('./sandbox');
const { PermissionManager } = require('./permission-manager');
const { AutomationController } = require('./automation');
const systemInfo = require('./system-info');
const { SKILL_MARKET, AUTO_INSTALL_SKILLS } = require('./data/skill-market');
const { OPENHUB_REGISTRY } = require('./data/plugin-registry');
const { MODEL_MARKETPLACE } = require('./data/model-marketplace');

/**
 * 创建并启动 API 服务器
 * @param {number} port - 监听端口
 * @param {string} [rendererPath] - 前端静态文件目录（可选）
 * @returns {Promise<import('http').Server>} HTTP 服务器实例
 */
async function createServer(port = 3721, rendererPath) {
  const app = express();

  // 中间件
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // 提供前端静态文件服务（让 Electron 通过 HTTP 加载，解决 ES Module CORS 问题）
  if (rendererPath) {
    app.use(express.static(rendererPath, {
      setHeaders: (res, filePath) => {
        // 为 JS 文件设置正确的 MIME 类型
        if (filePath.endsWith('.js')) {
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        }
      },
    }));
  }

  const isMac = process.platform === 'darwin';
  const dataDir = path.join(
    process.env.APPDATA || (isMac ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config')),
    'OpenClawAssistant'
  );

  // 初始化各模块
  const modelManager = new ModelManager(dataDir);
  const memoryStore = new MemoryStore(dataDir);
  const sandbox = new SandboxExecutor(dataDir);
  const permissionManager = new PermissionManager(dataDir);
  const automation = new AutomationController(sandbox);

  // 初始化数据库
  await memoryStore.init();
  console.log('[API 服务器] 所有模块初始化完成');

  // ========== 聊天 API ==========
  const chatRouter = require('./routes/chat')({ memoryStore, modelManager, sandbox });
  app.use('/api/chat', chatRouter);

  // ========== 模型 API ==========
  const modelsRouter = require('./routes/models')({ modelManager, dataDir });
  app.use('/api/models', modelsRouter);

  // ========== 记忆 API ==========
  const memoryRouter = require('./routes/memory')({ memoryStore });
  app.use('/api/memory', memoryRouter);

  // ========== 自动化 API ==========
  /** 截屏并返回文件路径 */
  app.post('/api/automation/screenshot', async (req, res) => {
    try {
      const outputPath = await automation.captureScreen();
      res.json({ success: true, path: outputPath });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  });

  // ========== 沙盒 API ==========

  /** 执行沙盒命令 */
  app.post('/api/sandbox/execute', async (req, res) => {
    try {
      const { command, confirmed, permanent, cwd, timeout } = req.body;
      if (!command) return res.status(400).json({ message: '命令不能为空' });

      if (confirmed) {
        const result = await sandbox.executeConfirmed(command, permanent, { cwd, timeout });
        res.json(result);
      } else {
        const result = await sandbox.execute(command, { cwd, timeout });
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取权限列表 */
  app.get('/api/sandbox/permissions', (req, res) => {
    res.json(sandbox.getPermissions());
  });

  /** 授予权限 */
  app.post('/api/sandbox/permissions', (req, res) => {
    try {
      const { pattern, permanent } = req.body;
      const perm = sandbox.grantPermission(pattern, permanent);
      res.json(perm);
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 撤销权限 */
  app.delete('/api/sandbox/permissions/:id', (req, res) => {
    try {
      sandbox.revokePermission(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  /** 获取操作日志 */
  app.get('/api/sandbox/logs', (req, res) => {
    try {
      const { page, pageSize } = req.query;
      res.json(sandbox.getLogs(parseInt(page) || 1, parseInt(pageSize) || 50));
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  // ========== 技能市场 API ==========

  const skillsPath = path.join(dataDir, 'skills.json');
  let installedSkills = [];
  try {
    if (fs.existsSync(skillsPath)) installedSkills = JSON.parse(fs.readFileSync(skillsPath, 'utf8'));
  } catch(e) {}
  const saveSkills = () => fs.writeFileSync(skillsPath, JSON.stringify(installedSkills, null, 2));

  // SKILL_MARKET 和 AUTO_INSTALL_SKILLS 已提取到 data/skill-market.js
  let skillsUpdated = false;
  for (const skillId of AUTO_INSTALL_SKILLS) {
    if (!installedSkills.some(s => s.id === skillId)) {
      const skill = SKILL_MARKET.find(s => s.id === skillId);
      if (skill) {
        installedSkills.push({ ...skill, installedAt: new Date().toISOString() });
        skillsUpdated = true;
        console.log(`[技能市场] 自动安装新技能: ${skill.name}`);
      }
    }
  }
  if (skillsUpdated) saveSkills();

  /** 获取技能市场列表 (带筛选排序) */
  app.get('/api/skills/marketplace', (req, res) => {
    try {
      const { search, type, sort } = req.query;
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

      // 附加已安装状态
      skills = skills.map(s => ({ ...s, status: installedSkills.some(i => i.id === s.id) ? 'installed' : 'not_installed' }));

      const allTypes = [...new Set(SKILL_MARKET.map(s => s.type))];

      res.json({ total: skills.length, filters: { types: allTypes }, items: skills });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 获取已安装技能 */
  app.get('/api/skills', (req, res) => {
    res.json(installedSkills);
  });

  /** 安装技能 */
  app.post('/api/skills/install', (req, res) => {
    const { skillId } = req.body;
    const skill = SKILL_MARKET.find(s => s.id === skillId);
    if (!skill) return res.status(404).json({ message: '技能不存在' });
    if (!installedSkills.some(s => s.id === skillId)) {
      const newSkill = { ...skill, installedAt: new Date().toISOString() };
      installedSkills.push(newSkill);
      saveSkills();
      res.json(newSkill);
    } else {
      res.json({ success: true });
    }
  });

  /** 卸载技能 */
  app.delete('/api/skills/:id', (req, res) => {
    installedSkills = installedSkills.filter(s => s.id !== req.params.id);
    saveSkills();
    res.json({ message: '卸载成功' });
  });

  // ========== 插件市场 API（OpenHub 集成） ==========
  // OPENHUB_REGISTRY 已提取到 data/plugin-registry.js

  const pluginsPath = path.join(dataDir, 'plugins.json');
  let installedPlugins = [];
  try {
    if (fs.existsSync(pluginsPath)) installedPlugins = JSON.parse(fs.readFileSync(pluginsPath, 'utf8'));
  } catch(e) {}
  const savePlugins = () => fs.writeFileSync(pluginsPath, JSON.stringify(installedPlugins, null, 2));

  /**
   * 获取已安装插件
   */
  app.get('/api/plugins', (req, res) => {
    res.json(installedPlugins);
  });

  /**
   * OpenHub 插件市场 — 支持高级筛选、排序
   * 查询参数：
   *   search    — 关键词搜索（名称、描述、标签）
   *   type      — 按类型筛选（通讯、工具、全部）
   *   tag       — 按标签筛选（官方、企业、开源、海外等）
   *   sort      — 排序方式（downloads, stars, rating, updated, trending）
   *   verified  — 仅显示已认证插件（true/false）
   *   page      — 页码
   *   pageSize  — 每页数量
   */
  app.get('/api/plugins/marketplace', (req, res) => {
    try {
      const { search, type, tag, sort, verified, page, pageSize } = req.query;

      let plugins = OPENHUB_REGISTRY.map(p => ({
        ...p,
        installed: installedPlugins.some(ip => ip.id === p.id),
        status: installedPlugins.find(ip => ip.id === p.id)?.status || 'not_installed',
      }));

      // 关键词搜索
      if (search) {
        const q = search.toLowerCase();
        plugins = plugins.filter(p =>
          p.name.toLowerCase().includes(q) ||
          p.nameEn.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.tags.some(t => t.toLowerCase().includes(q)) ||
          (p.sdkName && p.sdkName.toLowerCase().includes(q))
        );
      }

      // 按类型筛选
      if (type && type !== '全部') {
        plugins = plugins.filter(p => p.type === type);
      }

      // 按标签筛选
      if (tag && tag !== '全部') {
        plugins = plugins.filter(p => p.tags.includes(tag));
      }

      // 仅已认证
      if (verified === 'true') {
        plugins = plugins.filter(p => p.verified);
      }

      // 排序
      const sortBy = sort || 'downloads';
      switch (sortBy) {
        case 'downloads':
          plugins.sort((a, b) => b.downloads - a.downloads);
          break;
        case 'stars':
          plugins.sort((a, b) => b.stars - a.stars);
          break;
        case 'rating':
          plugins.sort((a, b) => b.rating - a.rating);
          break;
        case 'updated':
          plugins.sort((a, b) => new Date(b.lastUpdated) - new Date(a.lastUpdated));
          break;
        case 'trending':
          plugins.sort((a, b) => b.weeklyDownloads - a.weeklyDownloads);
          break;
        case 'name':
          plugins.sort((a, b) => a.name.localeCompare(b.name, 'zh'));
          break;
        default:
          plugins.sort((a, b) => b.downloads - a.downloads);
      }

      // 分页
      const p = parseInt(page) || 1;
      const ps = parseInt(pageSize) || 50;
      const total = plugins.length;
      const paged = plugins.slice((p - 1) * ps, p * ps);

      // 聚合标签（用于前端筛选菜单）
      const allTags = [...new Set(OPENHUB_REGISTRY.flatMap(pl => pl.tags))];
      const allTypes = [...new Set(OPENHUB_REGISTRY.map(pl => pl.type))];

      res.json({
        source: 'OpenHub',
        total,
        page: p,
        pageSize: ps,
        filters: { types: allTypes, tags: allTags },
        items: paged,
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 安装插件 */
  app.post('/api/plugins/install', (req, res) => {
    try {
      const { pluginId } = req.body;
      const plugin = OPENHUB_REGISTRY.find(p => p.id === pluginId);
      if (!plugin) return res.status(404).json({ message: '插件不存在' });
      if (installedPlugins.some(p => p.id === pluginId)) {
        return res.status(400).json({ message: '插件已安装' });
      }
      const newPlugin = { ...plugin, status: 'offline', installedAt: new Date().toISOString() };
      installedPlugins.push(newPlugin);
      savePlugins();
      res.json(newPlugin);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 卸载插件 */
  app.delete('/api/plugins/:id', (req, res) => {
    installedPlugins = installedPlugins.filter(p => p.id !== req.params.id);
    savePlugins();
    res.json({ message: '卸载成功' });
  });

  /** 更新插件配置 */
  app.put('/api/plugins/:id/config', (req, res) => {
    try {
      const plugin = installedPlugins.find(p => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ message: '插件未安装' });
      plugin.config = req.body.config || req.body;
      savePlugins();
      res.json(plugin);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 连接插件 */
  app.post('/api/plugins/:id/connect', (req, res) => {
    try {
      const plugin = installedPlugins.find(p => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ message: '插件未安装' });
      plugin.status = 'online';
      res.json({ success: true, status: 'online' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });

  /** 断开插件 */
  app.post('/api/plugins/:id/disconnect', (req, res) => {
    try {
      const plugin = installedPlugins.find(p => p.id === req.params.id);
      if (!plugin) return res.status(404).json({ message: '插件未安装' });
      plugin.status = 'offline';
      res.json({ success: true, status: 'offline' });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  });



  // ========== 设置 API ==========

  const settingsPath = path.join(dataDir, 'settings.json');
  let settings = {};
  try {
    if (require('fs').existsSync(settingsPath)) {
      settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf-8'));
    }
  } catch { settings = {}; }

  function saveSettings() {
    const fss = require('fs');
    const dir = path.dirname(settingsPath);
    if (!fss.existsSync(dir)) fss.mkdirSync(dir, { recursive: true });
    fss.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
  }

  /** 获取所有设置 */
  app.get('/api/settings', (req, res) => {
    res.json(settings);
  });

  /** 获取单个设置 */
  app.get('/api/settings/:key', (req, res) => {
    res.json({ key: req.params.key, value: settings[req.params.key] });
  });

  /** 更新单个设置 */
  app.put('/api/settings/:key', (req, res) => {
    settings[req.params.key] = req.body.value;
    saveSettings();
    res.json({ success: true });
  });

  /** 批量更新设置 */
  app.put('/api/settings', (req, res) => {
    Object.assign(settings, req.body);
    saveSettings();
    res.json({ success: true });
  });

  // ========== 权限 API ==========

  app.get('/api/permissions', (req, res) => {
    res.json(permissionManager.getPermissionConfig());
  });

  app.get('/api/permissions/roles', (req, res) => {
    res.json(permissionManager.getRoles());
  });

  app.put('/api/permissions', (req, res) => {
    try {
      permissionManager.updatePermissionConfig(req.body);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ message: error.message });
    }
  });

  // ========== 健康检查 ==========
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 启动服务器
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      console.log(`[API 服务器] 已启动: http://127.0.0.1:${port}`);
      resolve(server);
    });
    server.on('error', reject);
  });
}

module.exports = { createServer };
