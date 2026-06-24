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
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.dbPath = path.join(dataDir, 'memory.db');
    this.db = null;
    this._initialized = false;
  }

  /**
   * 初始化数据库
   */
  async init() {
    if (this._initialized) return;
    
    const SQL = await initSqlJs();
    
    // 确保数据目录存在
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    // 打开或创建数据库
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // 创建表结构
    this.db.run(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        category TEXT DEFAULT '通用',
        tags TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

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

    // 对话分组表
    this.db.run(`
      CREATE TABLE IF NOT EXISTS conversation_groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT DEFAULT '📁',
        color TEXT DEFAULT '#007aff',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT NOT NULL
      )
    `);

    // 为 conversations 表添加 group_id 字段（如果不存在）
    try {
      this.db.run('ALTER TABLE conversations ADD COLUMN group_id TEXT DEFAULT NULL');
    } catch (e) {
      // 字段已存在，忽略错误
    }

    // 创建索引
    this.db.run('CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_conversations_group ON conversations(group_id)');

    this._save();
    this._initialized = true;
    console.log('[记忆存储] 数据库初始化完成');
  }

  /**
   * 保存数据库到磁盘
   * @private
   */
  _save() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (error) {
      console.error('[记忆存储] 数据库保存失败:', error);
    }
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
    
    this.db.run(
      'INSERT INTO memories (id, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, content, category, JSON.stringify(tags), now, now]
    );
    this._save();

    return { id, content, category, tags, created_at: now, updated_at: now };
  }

  /**
   * 搜索记忆（关键词匹配）
   * @param {string} query - 搜索关键词
   * @param {number} limit - 结果数量限制
   * @returns {Array} 匹配的记忆列表
   */
  searchMemory(query, limit = 10) {
    const results = this.db.exec(
      'SELECT * FROM memories WHERE content LIKE ? OR tags LIKE ? ORDER BY updated_at DESC LIMIT ?',
      [`%${query}%`, `%${query}%`, limit]
    );
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

  /**
   * 删除记忆
   * @param {string} id - 记忆 ID
   */
  deleteMemory(id) {
    this.db.run('DELETE FROM memories WHERE id = ?', [id]);
    this._save();
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
    
    this.db.run(
      'INSERT INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [id, title, now, now]
    );
    this._save();

    return { id, title, created_at: now, updated_at: now };
  }

  /**
   * 获取所有对话列表
   * @param {string|null} groupId - 分组 ID，null 表示全部
   * @returns {Array} 对话列表
   */
  getConversations(groupId = null) {
    let sql = 'SELECT * FROM conversations';
    const params = [];
    if (groupId) {
      sql += ' WHERE group_id = ?';
      params.push(groupId);
    }
    sql += ' ORDER BY updated_at DESC';
    const results = this.db.exec(sql, params);
    return this._parseResults(results, 'conversations');
  }

  // ===== 分组管理 =====

  /**
   * 获取所有分组
   * @returns {Array} 分组列表
   */
  getGroups() {
    const results = this.db.exec('SELECT * FROM conversation_groups ORDER BY sort_order ASC, created_at ASC');
    return this._parseResults(results, 'conversation_groups');
  }

  /**
   * 创建分组
   * @param {string} name - 分组名称
   * @param {string} icon - 图标
   * @param {string} color - 颜色
   * @returns {Object} 新创建的分组
   */
  createGroup(name, icon = '📁', color = '#007aff') {
    const id = uuidv4();
    const now = new Date().toISOString();
    this.db.run(
      'INSERT INTO conversation_groups (id, name, icon, color, sort_order, created_at) VALUES (?, ?, ?, ?, 0, ?)',
      [id, name, icon, color, now]
    );
    this._save();
    return { id, name, icon, color, sort_order: 0, created_at: now };
  }

  /**
   * 更新分组
   * @param {string} groupId - 分组 ID
   * @param {Object} updates - 更新字段 { name, icon, color, sort_order }
   */
  updateGroup(groupId, updates) {
    const fields = [];
    const params = [];
    if (updates.name !== undefined) { fields.push('name = ?'); params.push(updates.name); }
    if (updates.icon !== undefined) { fields.push('icon = ?'); params.push(updates.icon); }
    if (updates.color !== undefined) { fields.push('color = ?'); params.push(updates.color); }
    if (updates.sort_order !== undefined) { fields.push('sort_order = ?'); params.push(updates.sort_order); }
    if (fields.length === 0) return;
    params.push(groupId);
    this.db.run(`UPDATE conversation_groups SET ${fields.join(', ')} WHERE id = ?`, params);
    this._save();
  }

  /**
   * 删除分组（对话移回未分组）
   * @param {string} groupId - 分组 ID
   */
  deleteGroup(groupId) {
    this.db.run('UPDATE conversations SET group_id = NULL WHERE group_id = ?', [groupId]);
    this.db.run('DELETE FROM conversation_groups WHERE id = ?', [groupId]);
    this._save();
  }

  /**
   * 移动对话到分组
   * @param {string} conversationId - 对话 ID
   * @param {string|null} groupId - 目标分组 ID，null 表示取消分组
   */
  moveConversationToGroup(conversationId, groupId) {
    this.db.run('UPDATE conversations SET group_id = ? WHERE id = ?', [groupId, conversationId]);
    this._save();
  }

  /**
   * 获取分组下的对话数量
   * @returns {Object} { groupId: count }
   */
  getGroupCounts() {
    const results = this.db.exec('SELECT group_id, COUNT(*) as count FROM conversations WHERE group_id IS NOT NULL GROUP BY group_id');
    const counts = {};
    if (results.length > 0) {
      results[0].values.forEach(row => {
        counts[row[0]] = row[1];
      });
    }
    return counts;
  }

  /**
   * 删除对话及其所有消息（硬删除）
   * @param {string} conversationId - 对话 ID
   */
  deleteConversation(conversationId) {
    this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
    this._save();
  }

  /**
   * 重命名对话
   * @param {string} conversationId - 对话 ID
   * @param {string} newTitle - 新标题
   */
  renameConversation(conversationId, newTitle) {
    const now = new Date().toISOString();
    this.db.run('UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?', [newTitle, now, conversationId]);
    this._save();
  }

  /**
   * 将对话移入垃圾篓（软删除）
   * @param {string} conversationId - 对话 ID
   */
  moveToTrash(conversationId) {
    const convResults = this.db.exec('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    if (!convResults.length || !convResults[0].values.length) return;
    const columns = convResults[0].columns;
    const row = convResults[0].values[0];
    const conv = {};
    columns.forEach((col, i) => { conv[col] = row[i]; });

    const messages = this.getConversationHistory(conversationId);
    const now = new Date().toISOString();

    this.db.run(
      'INSERT OR REPLACE INTO deleted_conversations (id, title, messages_json, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?)',
      [conv.id, conv.title, JSON.stringify(messages), conv.created_at, conv.updated_at, now]
    );

    this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    this.db.run('DELETE FROM conversations WHERE id = ?', [conversationId]);
    this._save();
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
    if (!results.length || !results[0].values.length) return;
    const columns = results[0].columns;
    const row = results[0].values[0];
    const item = {};
    columns.forEach((col, i) => { item[col] = row[i]; });

    this.db.run(
      'INSERT OR REPLACE INTO conversations (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [item.id, item.title, item.created_at, item.updated_at]
    );

    let messages = [];
    try { messages = JSON.parse(item.messages_json || '[]'); } catch(e) {}
    for (const msg of messages) {
      this.db.run(
        'INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
        [msg.id, item.id, msg.role, msg.content, msg.created_at]
      );
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
    if (!convResults.length || !convResults[0].values.length) return null;
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
    
    this.db.run(
      'INSERT INTO messages (id, conversation_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, conversationId, role, content, now]
    );
    
    // 更新对话的更新时间
    this.db.run(
      'UPDATE conversations SET updated_at = ? WHERE id = ?',
      [now, conversationId]
    );
    
    // 如果是第一条用户消息，自动更新对话标题
    const msgCount = this.db.exec(
      'SELECT COUNT(*) FROM messages WHERE conversation_id = ?',
      [conversationId]
    );
    if (msgCount.length > 0 && msgCount[0].values[0][0] === 1 && role === 'user') {
      const title = content.slice(0, 30) + (content.length > 30 ? '...' : '');
      this.db.run('UPDATE conversations SET title = ? WHERE id = ?', [title, conversationId]);
    }
    
    this._save();
    return { id, conversation_id: conversationId, role, content, created_at: now };
  }

  /**
   * 获取对话历史消息
   * @param {string} conversationId - 对话 ID
   * @returns {Array} 消息列表
   */
  getConversationHistory(conversationId) {
    const results = this.db.exec(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC',
      [conversationId]
    );
    return this._parseResults(results, 'messages');
  }

  /**
   * 清空对话消息
   * @param {string} conversationId - 对话 ID（不传则清空所有）
   */
  clearHistory(conversationId) {
    if (conversationId) {
      this.db.run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
    } else {
      this.db.run('DELETE FROM messages');
      this.db.run('DELETE FROM conversations');
    }
    this._save();
  }

  /**
   * 删除指定的单条消息
   * @param {string} messageId - 消息 ID
   */
  deleteMessage(messageId) {
    this.db.run('DELETE FROM messages WHERE id = ?', [messageId]);
    this._save();
  }

  /**
   * 解析 sql.js 查询结果为对象数组
   * @private
   */
  _parseResults(results) {
    if (!results || results.length === 0) return [];
    const { columns, values } = results[0];
    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        if (col === 'tags') {
          try { obj[col] = JSON.parse(row[i]); } catch { obj[col] = []; }
        } else {
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
        this.db.run(
          'INSERT OR REPLACE INTO memories (id, content, category, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
          [m.id, m.content, m.category, JSON.stringify(m.tags || []), m.created_at, m.updated_at]
        );
      }
    }
    this._save();
  }

  /**
   * 关闭数据库
   */
  close() {
    if (this.db) {
      this._save();
      this.db.close();
      this.db = null;
      this._initialized = false;
    }
  }
}

module.exports = { MemoryStore };
