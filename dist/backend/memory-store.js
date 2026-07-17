"use strict";
// @ts-nocheck
/**
 * OpenClaw 智能助手 - 记忆存储
 * 使用 sql.js 实现持久化记忆系统和对话历史管理
 */
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
class MemoryStore {
    /**
     * @param {string} dataDir - 数据存储目录
     * @param {string|null} customDbPath - 自定义数据库文件物理路径
     */
    constructor(dataDir, customDbPath = null) {
        this.dataDir = customDbPath ? path.dirname(customDbPath) : dataDir;
        this.dbPath = customDbPath ? customDbPath : path.join(dataDir, 'memory.db');
        this.db = null;
        this._initialized = false;
        this._saveTimer = null; // 节流写盘定时器
    }
    /**
     * 初始化数据库
     */
    async init() {
        if (this._initialized)
            return;
        const SQL = await initSqlJs();
        console.log('[记忆存储] 💡 正在连接物理数据库文件路径:', this.dbPath);
        // 确保数据目录存在
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
        // 打开或创建数据库
        if (fs.existsSync(this.dbPath)) {
            const buffer = fs.readFileSync(this.dbPath);
            this.db = new SQL.Database(buffer);
        }
        else {
            this.db = new SQL.Database();
        }
        // 创建表结构
        this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT DEFAULT '通用',
        tags TEXT DEFAULT '[]',
        recall_count INTEGER DEFAULT 0,
        last_recalled_at TEXT,
        is_pinned INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
        // 安全追加新列（兼容旧数据库，如果列已存在则静默跳过）
        try {
            this.db.run('ALTER TABLE memories ADD COLUMN recall_count INTEGER DEFAULT 0');
        }
        catch (e) { }
        try {
            this.db.run('ALTER TABLE memories ADD COLUMN last_recalled_at TEXT');
        }
        catch (e) { }
        try {
            this.db.run('ALTER TABLE memories ADD COLUMN is_pinned INTEGER DEFAULT 0');
        }
        catch (e) { }
        this.db.run(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
        this.db.run(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      )
    `);
        // 垃圾篓表（软删除）
        this.db.run(`
      CREATE TABLE IF NOT EXISTS deleted_conversations (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        messages_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT NOT NULL
      )
    `);
        // 实体关系三元组表（轻量图谱联想）
        this.db.run(`
      CREATE TABLE IF NOT EXISTS entity_relationships (
        id TEXT PRIMARY KEY,
        subject TEXT NOT NULL,
        predicate TEXT NOT NULL,
        object TEXT NOT NULL,
        source_memory_id TEXT,
        created_at TEXT NOT NULL
      )
    `);
        // 情景记忆摘要表（跨对话回忆）
        this.db.run(`
      CREATE TABLE IF NOT EXISTS memory_episodes (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        summary TEXT NOT NULL,
        topics_json TEXT DEFAULT '[]',
        created_at TEXT NOT NULL
      )
    `);
        // 后台持久化任务表
        this.db.run(`
      CREATE TABLE IF NOT EXISTS background_jobs (
        id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);
        // 创建索引
        this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_entity_subject ON entity_relationships(subject)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_entity_object ON entity_relationships(object)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_episodes_conv ON memory_episodes(conversation_id)');
        this.db.run('CREATE INDEX IF NOT EXISTS idx_jobs_status ON background_jobs(status)');
        this._save();
        this._initialized = true;
        console.log('[记忆存储] 数据库初始化完成（含实体关系表、情景记忆表与任务表）');
    }
    /**
     * 原子写盘保护：先写 .tmp 临时文件再 rename，防止断电损坏主库
     * @private
     */
    _save() {
        try {
            const data = this.db.export();
            const buffer = Buffer.from(data);
            const tmpPath = this.dbPath + '.tmp';
            fs.writeFileSync(tmpPath, buffer);
            let retries = 3;
            while (retries > 0) {
                try {
                    fs.renameSync(tmpPath, this.dbPath);
                    break;
                }
                catch (renameErr) {
                    retries--;
                    if (retries === 0)
                        throw renameErr;
                    // 睡眠 30ms 后重试
                    const execSync = require('child_process').execSync;
                    try {
                        execSync('choice /t 1 /d y /n >nul', { timeout: 30 });
                    }
                    catch (e) { }
                }
            }
        }
        catch (error) {
            console.error('[记忆存储] 数据库物理存盘发生异常（已拦截以防崩溃）:', error);
        }
    }
    /**
     * 节流写盘（Debounce 500ms）：高频写入时仅在最后一次操作后 500ms 才真正落盘
     * @private
     */
    _debouncedSave() {
        if (this._saveTimer)
            clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(() => {
            this._save();
            this._saveTimer = null;
        }, 500);
    }
    // ===== 记忆管理 =====
    /**
     * 添加记忆
     * @param {string} content - 记忆内容
     * @param {string} category - 分类
     * @param {string[]} tags - 标签列表
     * @returns {Object} 新创建的记忆
     */
    addMemory(content, category = '通用', tags = []) {
        const id = uuidv4();
        const now = new Date().toISOString();
        this.db.run('INSERT INTO memories (id, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, content, category, JSON.stringify(tags), now, now]);
        this._debouncedSave();
        return { id, content, category, tags, created_at: now, updated_at: now };
    }
    /**
     * 获取所有置顶/锁定的长期记忆（人设常驻指令）
     * @returns {Array} 置顶记忆列表
     */
    getPinnedMemories() {
        const results = this.db.exec('SELECT * FROM memories WHERE is_pinned = 1 ORDER BY updated_at DESC');
        return this._parseResults(results, 'memories');
    }
    /**
     * 搜索记忆（关键词匹配）
     * @param {string} query - 搜索关键词
     * @param {number} limit - 结果数量限制
     * @returns {Array} 匹配的记忆列表
     */
    searchMemory(query, limit = 10) {
        const results = this.db.exec('SELECT * FROM memories WHERE content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC LIMIT ?', [`%${query}%`, `%${query}%`, limit]);
        return this._parseResults(results, 'memories');
    }
    /**
     * 获取所有记忆（分页）
     * @param {number} page - 页码（从 1 开始）
     * @param {number} pageSize - 每页数量
     * @param {string} category - 按分类筛选
     * @returns {Object} { items, total, page, pageSize }
     */
    getAllMemories(page = 1, pageSize = 20, category = null) {
        let countSql = 'SELECT COUNT(*) as count FROM memories';
        let querySql = 'SELECT * FROM memories';
        const params = [];
        if (category && category !== '全部') {
            countSql += ' WHERE category = ?';
            querySql += ' WHERE category = ?';
            params.push(category);
        }
        querySql += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
        const countResult = this.db.exec(countSql, params);
        const total = countResult.length > 0 ? countResult[0].values[0][0] : 0;
        const allParams = [...params, pageSize, (page - 1) * pageSize];
        const results = this.db.exec(querySql, allParams);
        const items = this._parseResults(results, 'memories');
        return { items, total, page, pageSize };
    }
    deleteMemory(id) {
        this.db.run('DELETE FROM memories WHERE id = ?', [id]);
        this._debouncedSave();
    }
    /**
     * 根据 ID 获取单个记忆详情
     * @param {string} id - 记忆 ID
     * @returns {Object|null}
     */
    getMemory(id) {
        const results = this.db.exec('SELECT * FROM memories WHERE id = ?', [id]);
        const items = this._parseResults(results);
        return items.length > 0 ? items[0] : null;
    }
    // ===== 对话管理 =====
    /**
     * 创建新对话
     * @param {string} title - 对话标题
     * @returns {Object} 新创建的对话
     */
    createConversation(title = '新对话') {
        const id = uuidv4();
        const now = new Date().toISOString();
        this.db.run('INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [id, title, now, now]);
        this._debouncedSave();
        return { id, title, created_at: now, updated_at: now };
    }
    /**
     * 获取所有对话列表
     * @returns {Array} 对话列表
     */
    getConversations() {
        const results = this.db.exec('SELECT * FROM conversations ORDER BY updated_at DESC');
        return this._parseResults(results, 'conversations');
    }
    /**
     * 删除对话及其所有消息（硬删除）
     * @param {string} conversationId - 对话 ID
     */
    deleteConversation(conversationId) {
        this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
        this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
        this._debouncedSave();
    }
    /**
     * 重命名对话
     * @param {string} conversationId - 对话 ID
     * @param {string} newTitle - 新标题
     */
    renameConversation(conversationId, newTitle) {
        const now = new Date().toISOString();
        this.db.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [newTitle, now, conversationId]);
        this._debouncedSave();
    }
    /**
     * 将对话移入垃圾篓（软删除）
     * @param {string} conversationId - 对话 ID
     */
    moveToTrash(conversationId) {
        const convResults = this.db.exec('SELECT * FROM conversations WHERE id = ?', [conversationId]);
        if (!convResults.length || !convResults[0].values.length)
            return;
        const columns = convResults[0].columns;
        const row = convResults[0].values[0];
        const conv = {};
        columns.forEach((col, i) => { conv[col] = row[i]; });
        const messages = this.getConversationHistory(conversationId);
        const now = new Date().toISOString();
        this.db.run('INSERT OR REPLACE INTO deleted_conversations (id, title, messages_json, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)', [conv.id, conv.title, JSON.stringify(messages), conv.created_at, conv.updated_at, now]);
        this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
        this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
        this._debouncedSave();
    }
    /**
     * 获取垃圾篓列表
     * @returns {Array}
     */
    getTrash() {
        const results = this.db.exec('SELECT id, title, created_at, updated_at, deleted_at FROM deleted_conversations ORDER BY deleted_at DESC');
        return this._parseResults(results, 'deleted_conversations');
    }
    /**
     * 从垃圾篓恢复对话
     * @param {string} trashId - 垃圾篓条目 ID
     */
    restoreFromTrash(trashId) {
        const results = this.db.exec('SELECT * FROM deleted_conversations WHERE id = ?', [trashId]);
        if (!results.length || !results[0].values.length)
            return;
        const columns = results[0].columns;
        const row = results[0].values[0];
        const item = {};
        columns.forEach((col, i) => { item[col] = row[i]; });
        this.db.run('INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [item.id, item.title, item.created_at, item.updated_at]);
        let messages = [];
        try {
            messages = JSON.parse(item.messages_json || '[]');
        }
        catch (e) { }
        for (const msg of messages) {
            this.db.run('INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', [msg.id, item.id, msg.role, msg.content, msg.created_at]);
        }
        this.db.run('DELETE FROM deleted_conversations WHERE id = ?', [trashId]);
        this._save();
    }
    /**
     * 永久删除垃圾篓条目
     * @param {string} trashId - 垃圾篓条目 ID
     */
    permanentDelete(trashId) {
        this.db.run('DELETE FROM deleted_conversations WHERE id = ?', [trashId]);
        this._save();
    }
    /**
     * 清空垃圾篓
     */
    emptyTrash() {
        this.db.run('DELETE FROM deleted_conversations');
        this._save();
    }
    /**
     * 获取垃圾篓条目数量
     * @returns {number}
     */
    getTrashCount() {
        const results = this.db.exec('SELECT COUNT(*) as count FROM deleted_conversations');
        return results.length > 0 ? results[0].values[0][0] : 0;
    }
    /**
     * 导出对话（含消息）
     * @param {string} conversationId - 对话 ID
     * @returns {Object|null}
     */
    exportConversation(conversationId) {
        const convResults = this.db.exec('SELECT * FROM conversations WHERE id = ?', [conversationId]);
        if (!convResults.length || !convResults[0].values.length)
            return null;
        const columns = convResults[0].columns;
        const row = convResults[0].values[0];
        const conv = {};
        columns.forEach((col, i) => { conv[col] = row[i]; });
        const messages = this.getConversationHistory(conversationId);
        return { ...conv, messages, exportedAt: new Date().toISOString() };
    }
    /**
     * 保存消息
     * @param {string} conversationId - 对话 ID
     * @param {string} role - 角色 (user/assistant/system)
     * @param {string} content - 消息内容
     * @returns {Object} 新保存的消息
     */
    saveMessage(conversationId, role, content) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
        this.db.run('INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)', [id, conversationId, role, contentStr, now]);
        // 更新对话的更新时间
        this.db.run('UPDATE conversations SET updated_at = ? WHERE id = ?', [now, conversationId]);
        // 如果是第一条用户消息，自动更新对话标题
        const msgCount = this.db.exec('SELECT COUNT(*) FROM messages WHERE conversation_id = ?', [conversationId]);
        if (msgCount.length > 0 && msgCount[0].values[0][0] === 1 && role === 'user') {
            let rawText = '';
            if (typeof content === 'string') {
                rawText = content;
            }
            else if (Array.isArray(content)) {
                const textBlock = content.find((c) => c.type === 'text');
                rawText = textBlock ? textBlock.text : '多模态消息';
            }
            const title = rawText.slice(0, 30) + (rawText.length > 30 ? '...' : '');
            this.db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, conversationId]);
        }
        this._debouncedSave();
        return { id, conversation_id: conversationId, role, content, created_at: now };
    }
    /**
     * 获取对话历史消息
     * @param {string} conversationId - 对话 ID
     * @returns {Array} 消息列表
     */
    getConversationHistory(conversationId) {
        const results = this.db.exec('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', [conversationId]);
        const messages = this._parseResults(results, 'messages');
        return messages.map((m) => {
            let content = m.content;
            if (typeof content === 'string' && content.startsWith('[')) {
                try {
                    content = JSON.parse(content);
                }
                catch (e) { }
            }
            return { ...m, content };
        });
    }
    /**
     * 清空对话消息
     * @param {string} conversationId - 对话 ID（不传则清空所有）
     */
    clearHistory(conversationId) {
        if (conversationId) {
            this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
        }
        else {
            this.db.run('DELETE FROM messages');
            this.db.run('DELETE FROM conversations');
        }
        // 强制同步清理 RAG 引擎的关联记忆
        try {
            const { ragEngine } = require('./rag-engine');
            if (ragEngine && typeof ragEngine.clearForConversation === 'function') {
                ragEngine.clearForConversation(conversationId);
            }
        }
        catch (e) {
            console.error('清理 RAG 引擎数据失败:', e);
        }
        this._save();
    }
    /**
     * 删除指定的单条消息
     * @param {string} messageId - 消息 ID
     */
    deleteMessage(messageId) {
        this.db.run('DELETE FROM messages WHERE id = ?', [messageId]);
        this._debouncedSave();
    }
    /**
     * 解析 sql.js 查询结果为对象数组
     * @private
     */
    _parseResults(results) {
        if (!results || results.length === 0)
            return [];
        const { columns, values } = results[0];
        return values.map(row => {
            const obj = {};
            columns.forEach((col, i) => {
                if (col === 'tags') {
                    try {
                        obj[col] = JSON.parse(row[i]);
                    }
                    catch {
                        obj[col] = [];
                    }
                }
                else if (col === 'payload') {
                    try {
                        obj[col] = JSON.parse(row[i]);
                    }
                    catch {
                        obj[col] = row[i];
                    }
                }
                else {
                    obj[col] = row[i];
                }
            });
            return obj;
        });
    }
    /**
     * 导出所有记忆数据
     * @returns {Object} 导出数据
     */
    exportData() {
        const memories = this._parseResults(this.db.exec('SELECT * FROM memories'));
        const conversations = this._parseResults(this.db.exec('SELECT * FROM conversations'));
        return { memories, conversations, exportedAt: new Date().toISOString() };
    }
    /**
     * 导入记忆数据
     * @param {Object} data - 导入数据
     */
    importData(data) {
        if (data.memories) {
            for (const m of data.memories) {
                this.db.run('INSERT OR REPLACE INTO memories (id, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [m.id, m.content, m.category, JSON.stringify(m.tags || []), m.created_at, m.updated_at]);
            }
        }
        this._save();
    }
    /**
     * 关闭数据库
     */
    close() {
        if (this._saveTimer) {
            clearTimeout(this._saveTimer);
            this._saveTimer = null;
        }
        if (this.db) {
            this._save();
            this.db.close();
            this.db = null;
            this._initialized = false;
        }
    }
    // ===== 实体关系管理 (Entity Graph) =====
    /**
     * 添加实体关系三元组
     * @param {string} subject - 主体（如"用户"）
     * @param {string} predicate - 谓词/关系（如"儿子"）
     * @param {string} object - 客体（如"小明"）
     * @param {string} sourceMemoryId - 来源记忆 ID
     */
    addEntityRelation(subject, predicate, object, sourceMemoryId = null) {
        const id = uuidv4();
        const now = new Date().toISOString();
        this.db.run('INSERT INTO entity_relationships (id, subject, predicate, object, source_memory_id, created_at) VALUES (?, ?, ?, ?, ?, ?)', [id, subject, predicate, object, sourceMemoryId, now]);
        this._debouncedSave();
        return { id, subject, predicate, object };
    }
    /**
     * 查询某个实体的所有关联关系（正向+反向）
     * @param {string} entity - 实体名称
     * @returns {Array}
     */
    queryEntityRelations(entity) {
        const querySql = `
      SELECT r.* FROM entity_relationships r
      LEFT JOIN memories m ON r.source_memory_id = m.id
      WHERE (r.subject LIKE ? OR r.object LIKE ?)
        AND (m.id IS NULL OR m.tags NOT LIKE '%promoted%')
    `;
        const forward = this.db.exec(querySql, [`%${entity}%`, `%${entity}%`]);
        return this._parseResults(forward);
    }
    // ===== 情景记忆管理 (Episodic Memory) =====
    /**
     * 保存对话情景摘要
     * @param {string} conversationId - 对话 ID
     * @param {string} summary - 摘要内容
     * @param {string[]} topics - 主题标签
     */
    saveEpisode(conversationId, summary, topics = []) {
        const id = uuidv4();
        const now = new Date().toISOString();
        this.db.run('INSERT INTO memory_episodes (id, conversation_id, summary, topics_json, created_at) VALUES (?, ?, ?, ?, ?)', [id, conversationId, summary, JSON.stringify(topics), now]);
        this._debouncedSave();
        return { id, conversationId, summary, topics };
    }
    /**
     * 获取最近的情景摘要
     * @param {number} limit - 返回数量
     * @returns {Array}
     */
    getRecentEpisodes(limit = 10) {
        const results = this.db.exec('SELECT * FROM memory_episodes ORDER BY created_at DESC LIMIT ?', [limit]);
        return this._parseResults(results);
    }
    // ===== 记忆召回计数与衰减权重 =====
    /**
     * 增加记忆召回计数（每次被 AI 召回时调用）
     * @param {string} memoryId - 记忆 ID
     */
    bumpRecallCount(memoryId) {
        const now = new Date().toISOString();
        this.db.run('UPDATE memories SET recall_count = recall_count + 1, last_recalled_at = ? WHERE id = ?', [now, memoryId]);
        this._debouncedSave();
    }
    /**
     * 更新记忆内容（用于 LLM 冲突合并后的覆写）
     * @param {string} memoryId - 记忆 ID
     * @param {string} newContent - 新内容
     */
    updateMemoryContent(memoryId, newContent) {
        const now = new Date().toISOString();
        this.db.run('UPDATE memories SET content = ?, updated_at = ? WHERE id = ?', [newContent, now, memoryId]);
        this._debouncedSave();
    }
    /**
     * 给记忆标记特定的标签（如 pending_vectorization）
     * @param {string} memoryId - 记忆 ID
     * @param {string} tag - 要添加的标签
     */
    tagMemory(memoryId, tag) {
        const mem = this.getMemory(memoryId);
        if (!mem)
            return;
        let tagsArray = [];
        try {
            tagsArray = typeof mem.tags === 'string' ? JSON.parse(mem.tags) : (mem.tags || []);
            if (!Array.isArray(tagsArray))
                tagsArray = [];
        }
        catch (e) {
            tagsArray = [];
        }
        if (!tagsArray.includes(tag)) {
            tagsArray.push(tag);
            const now = new Date().toISOString();
            this.db.run('UPDATE memories SET tags = ?, updated_at = ? WHERE id = ?', [JSON.stringify(tagsArray), now, memoryId]);
            this._debouncedSave();
        }
    }
    /**
     * 移除记忆的特定标签
     * @param {string} memoryId - 记忆 ID
     * @param {string} tag - 要移除的标签
     */
    untagMemory(memoryId, tag) {
        const mem = this.getMemory(memoryId);
        if (!mem)
            return;
        let tagsArray = [];
        try {
            tagsArray = typeof mem.tags === 'string' ? JSON.parse(mem.tags) : (mem.tags || []);
            if (!Array.isArray(tagsArray))
                tagsArray = [];
        }
        catch (e) {
            tagsArray = [];
        }
        if (tagsArray.includes(tag)) {
            tagsArray = tagsArray.filter(t => t !== tag);
            const now = new Date().toISOString();
            this.db.run('UPDATE memories SET tags = ?, updated_at = ? WHERE id = ?', [JSON.stringify(tagsArray), now, memoryId]);
            this._debouncedSave();
        }
    }
    // ===== 任务队列管理 =====
    /**
     * 添加后台任务
     * @param {string} taskType - 任务类型
     * @param {Object|string} payload - 任务参数
     * @returns {Object}
     */
    addJob(taskType, payload) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const payloadStr = typeof payload === 'string' ? payload : JSON.stringify(payload);
        this.db.run('INSERT INTO background_jobs (id, task_type, payload, status, retry_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [id, taskType, payloadStr, 'pending', 0, now, now]);
        this._debouncedSave();
        return { id, taskType, payload: payloadStr, status: 'pending', retry_count: 0, created_at: now, updated_at: now };
    }
    /**
     * 获取所有待处理/重试的任务
     * @returns {Array}
     */
    getPendingJobs() {
        const results = this.db.exec("SELECT * FROM background_jobs WHERE status = 'pending' OR status = 'retry' ORDER BY created_at ASC");
        return this._parseResults(results);
    }
    /**
     * 更新任务状态
     * @param {string} id - 任务 ID
     * @param {string} status - 状态
     * @param {string|null} error - 错误信息
     * @param {number} retryCount - 重试次数
     */
    updateJobStatus(id, status, error = null, retryCount = 0) {
        const now = new Date().toISOString();
        this.db.run('UPDATE background_jobs SET status = ?, last_error = ?, retry_count = ?, updated_at = ? WHERE id = ?', [status, error, retryCount, now, id]);
        this._debouncedSave();
    }
    /**
     * 删除任务
     * @param {string} id - 任务 ID
     */
    deleteJob(id) {
        this.db.run('DELETE FROM background_jobs WHERE id = ?', [id]);
        this._debouncedSave();
    }
}
module.exports = { MemoryStore };
