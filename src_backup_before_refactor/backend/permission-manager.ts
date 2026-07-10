// @ts-nocheck
/**
 * OpenClaw 智能助手 - 权限管理器
 * 细粒度的角色权限控制系统
 */

const fs = require('fs');
const path = require('path');

/** 默认权限配置 */
const DEFAULT_PERMISSIONS = {
  roles: {
    admin: {
      name: '管理员',
      description: '拥有所有权限',
      permissions: {
        chat:       { read: true, write: true, delete: true },
        model:      { read: true, write: true, delete: true },
        memory:     { read: true, write: true, delete: true },
        sandbox:    { read: true, write: true, delete: true, execute: true },
        skill:      { read: true, write: true, delete: true, install: true },
        plugin:     { read: true, write: true, delete: true, install: true },
        settings:   { read: true, write: true },
        automation: { read: true, write: true, execute: true },
      },
    },
    user: {
      name: '普通用户',
      description: '日常使用权限',
      permissions: {
        chat:       { read: true, write: true, delete: true },
        model:      { read: true, write: false, delete: false },
        memory:     { read: true, write: true, delete: true },
        sandbox:    { read: true, write: false, delete: false, execute: false },
        skill:      { read: true, write: false, delete: false, install: true },
        plugin:     { read: true, write: false, delete: false, install: true },
        settings:   { read: true, write: false },
        automation: { read: true, write: false, execute: false },
      },
    },
    guest: {
      name: '访客',
      description: '仅限查看权限',
      permissions: {
        chat:       { read: true, write: true, delete: false },
        model:      { read: true, write: false, delete: false },
        memory:     { read: true, write: false, delete: false },
        sandbox:    { read: false, write: false, delete: false, execute: false },
        skill:      { read: true, write: false, delete: false, install: false },
        plugin:     { read: true, write: false, delete: false, install: false },
        settings:   { read: true, write: false },
        automation: { read: false, write: false, execute: false },
      },
    },
  },
  currentRole: 'admin', // 默认管理员角色
};

class PermissionManager {
  /**
   * @param {string} dataDir - 数据存储目录
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.configPath = path.join(dataDir, 'permissions.json');
    this.config = null;
    this._loadConfig();
  }

  /**
   * 加载权限配置
   * @private
   */
  _loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));
      } else {
        this.config = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
        this._saveConfig();
      }
    } catch (error) {
      console.error('[权限管理] 配置加载失败:', error);
      this.config = JSON.parse(JSON.stringify(DEFAULT_PERMISSIONS));
    }
  }

  /**
   * 保存权限配置
   * @private
   */
  _saveConfig() {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (error) {
      console.error('[权限管理] 配置保存失败:', error);
    }
  }

  /**
   * 检查当前角色是否有指定权限
   * @param {string} resource - 资源类型 (chat, model, memory, sandbox, skill, plugin, settings, automation)
   * @param {string} action - 操作类型 (read, write, delete, execute, install)
   * @param {string} [role] - 角色（默认使用当前角色）
   * @returns {boolean} 是否有权限
   */
  checkPermission(resource, action, role) {
    const roleName = role || this.config.currentRole;
    const roleConfig = this.config.roles[roleName];
    
    if (!roleConfig) {
      console.warn(`[权限管理] 未知角色: ${roleName}`);
      return false;
    }

    const resourcePerms = roleConfig.permissions[resource];
    if (!resourcePerms) {
      console.warn(`[权限管理] 未知资源: ${resource}`);
      return false;
    }

    return resourcePerms[action] === true;
  }

  /**
   * 获取当前角色
   * @returns {string} 当前角色名
   */
  getCurrentRole() {
    return this.config.currentRole;
  }

  /**
   * 设置当前角色
   * @param {string} role - 角色名
   */
  setCurrentRole(role) {
    if (!this.config.roles[role]) {
      throw new Error(`未知角色: ${role}`);
    }
    this.config.currentRole = role;
    this._saveConfig();
  }

  /**
   * 获取权限配置
   * @returns {Object} 完整权限配置
   */
  getPermissionConfig() {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * 更新权限配置
   * @param {Object} config - 新的权限配置
   */
  updatePermissionConfig(config) {
    if (config.roles) {
      this.config.roles = { ...this.config.roles, ...config.roles };
    }
    if (config.currentRole) {
      this.config.currentRole = config.currentRole;
    }
    this._saveConfig();
  }

  /**
   * 获取指定角色的权限列表（用于 UI 展示）
   * @param {string} [role] - 角色（默认当前角色）
   * @returns {Array} 权限列表
   */
  getPermissionList(role) {
    const roleName = role || this.config.currentRole;
    const roleConfig = this.config.roles[roleName];
    if (!roleConfig) return [];

    const resourceNames = {
      chat: '聊天', model: '模型', memory: '记忆',
      sandbox: '沙盒', skill: '技能', plugin: '插件',
      settings: '设置', automation: '自动化',
    };

    const actionNames = {
      read: '读取', write: '编辑', delete: '删除',
      execute: '执行', install: '安装',
    };

    const list = [];
    for (const [resource, perms] of Object.entries(roleConfig.permissions)) {
      for (const [action, allowed] of Object.entries(perms)) {
        list.push({
          resource,
          resourceName: resourceNames[resource] || resource,
          action,
          actionName: actionNames[action] || action,
          allowed,
        });
      }
    }
    return list;
  }

  /**
   * 获取所有角色列表
   * @returns {Array} 角色列表
   */
  getRoles() {
    return Object.entries(this.config.roles).map(([id, role]) => ({
      id,
      name: role.name,
      description: role.description,
      isCurrent: id === this.config.currentRole,
    }));
  }
}

module.exports = { PermissionManager };
