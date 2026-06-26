// @ts-nocheck
/**
 * OpenClaw 智能助手 - 沙盒执行器
 * 在受限环境中安全执行命令，提供权限管理和操作日志
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/** 高危命令模式列表 */
const HIGH_RISK_PATTERNS = [
  // 文件删除
  /\b(del|rmdir|rm|remove-item)\b/i,
  /\b(format)\s+[a-z]:/i,
  // 注册表操作
  /\b(reg|regedit|registry)\b/i,
  /\bNew-ItemProperty\b/i,
  /\bSet-ItemProperty\b.*Registry/i,
  // 系统修改
  /\b(shutdown|restart|logoff)\b/i,
  /\b(sfc|dism|bcdedit)\b/i,
  /\b(net\s+user|net\s+localgroup)\b/i,
  // 网络相关
  /\b(netsh|route|arp)\b/i,
  /\b(Invoke-WebRequest|curl|wget|iwr)\b/i,
  // 服务管理
  /\b(sc\s+delete|sc\s+stop|Stop-Service)\b/i,
  // 任务计划
  /\b(schtasks|at\s+\d)\b/i,
  // PowerShell 危险操作
  /\bInvoke-Expression\b/i,
  /\bStart-Process\b.*-Verb\s+RunAs/i,
  /\b(Set-ExecutionPolicy)\b/i,
  // 磁盘操作
  /\b(diskpart|cipher)\b/i,
];

/** 中等风险命令模式 */
const MEDIUM_RISK_PATTERNS = [
  /\b(copy|move|rename|ren)\b/i,
  /\b(mkdir|md|New-Item)\b/i,
  /\b(icacls|takeown|cacls)\b/i,
  /\b(net\s+share|net\s+use)\b/i,
  /\b(powershell|cmd|wscript|cscript)\b/i,
  /\b(pip|npm|yarn)\s+install/i,
];

class SandboxExecutor {
  /**
   * @param {string} dataDir - 数据存储目录
   */
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.permissionsPath = path.join(dataDir, 'sandbox-permissions.json');
    this.logsPath = path.join(dataDir, 'sandbox-logs.json');
    this.permissions = [];
    this.logs = [];
    this.enabled = true;
    this._loadPermissions();
    this._loadLogs();
  }

  /**
   * 加载权限配置
   * @private
   */
  _loadPermissions() {
    try {
      if (fs.existsSync(this.permissionsPath)) {
        this.permissions = JSON.parse(fs.readFileSync(this.permissionsPath, 'utf-8'));
      }
    } catch (error) {
      console.error('[沙盒] 权限配置加载失败:', error);
      this.permissions = [];
    }
  }

  /**
   * 保存权限配置
   * @private
   */
  _savePermissions() {
    try {
      const dir = path.dirname(this.permissionsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.permissionsPath, JSON.stringify(this.permissions, null, 2), 'utf-8');
    } catch (error) {
      console.error('[沙盒] 权限配置保存失败:', error);
    }
  }

  /**
   * 加载操作日志
   * @private
   */
  _loadLogs() {
    try {
      if (fs.existsSync(this.logsPath)) {
        this.logs = JSON.parse(fs.readFileSync(this.logsPath, 'utf-8'));
      }
    } catch (error) {
      this.logs = [];
    }
  }

  /**
   * 保存操作日志
   * @private
   */
  _saveLogs() {
    try {
      // 仅保留最近 1000 条日志
      if (this.logs.length > 1000) {
        this.logs = this.logs.slice(-1000);
      }
      fs.writeFileSync(this.logsPath, JSON.stringify(this.logs, null, 2), 'utf-8');
    } catch (error) {
      console.error('[沙盒] 日志保存失败:', error);
    }
  }

  /**
   * 记录操作日志
   * @private
   */
  _logOperation(command, riskLevel, action, result) {
    const log = {
      id: uuidv4(),
      command,
      riskLevel,
      action, // 'allowed' | 'blocked' | 'auto-allowed'
      result, // 'success' | 'error' | 'pending'
      timestamp: new Date().toISOString(),
    };
    this.logs.push(log);
    this._saveLogs();
    return log;
  }

  /**
   * 判断命令的风险等级
   * @param {string} command - 要检查的命令
   * @returns {'high'|'medium'|'low'} 风险等级
   */
  getRiskLevel(command) {
    for (const pattern of HIGH_RISK_PATTERNS) {
      if (pattern.test(command)) return 'high';
    }
    for (const pattern of MEDIUM_RISK_PATTERNS) {
      if (pattern.test(command)) return 'medium';
    }
    return 'low';
  }

  /**
   * 检查命令是否已被授权
   * @param {string} command - 要检查的命令
   * @returns {boolean} 是否已授权
   */
  isAuthorized(command) {
    if (!this.enabled) return true;
    
    for (const perm of this.permissions) {
      if (!perm.permanent) continue;
      try {
        const regex = new RegExp(perm.pattern, 'i');
        if (regex.test(command)) return true;
      } catch {
        if (command.includes(perm.pattern)) return true;
      }
    }
    return false;
  }

  /**
   * 执行命令
   * @param {string} command - 要执行的命令
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} 执行结果 { stdout, stderr, exitCode }
   */
  async execute(command, options = {}) {
    const riskLevel = this.getRiskLevel(command);
    const isAuth = this.isAuthorized(command);

    // 低风险或已授权的命令直接执行
    if (riskLevel === 'low' || isAuth) {
      const action = isAuth ? 'auto-allowed' : 'allowed';
      this._logOperation(command, riskLevel, action, 'pending');
      return this._runCommand(command, options);
    }

    // 高风险/中风险未授权 → 需要确认
    return {
      needsConfirmation: true,
      riskLevel,
      command,
      message: riskLevel === 'high' 
        ? '⚠️ 此操作可能导致系统损坏或数据丢失，请谨慎确认。'
        : '⚡ 此操作具有一定风险，请确认后执行。',
    };
  }

  /**
   * 确认执行命令（用户授权后调用）
   * @param {string} command - 要执行的命令
   * @param {boolean} permanent - 是否永久授权
   * @param {Object} options - 执行选项
   * @returns {Promise<Object>} 执行结果
   */
  async executeConfirmed(command, permanent = false, options = {}) {
    const riskLevel = this.getRiskLevel(command);
    
    // 永久授权
    if (permanent) {
      this.grantPermission(command, true);
    }

    this._logOperation(command, riskLevel, 'allowed', 'pending');
    return this._runCommand(command, options);
  }

  /**
   * 实际执行命令
   * @private
   */
    _runCommand(command, options = {}) {
    return new Promise((resolve, reject) => {
      const timeoutMs = options.timeout || 30000; // 默认 30 秒超时
      const cwd = options.cwd || process.cwd();
      
      // 使用 PowerShell 执行命令
      const proc = spawn('powershell.exe', ['-NoProfile', '-Command', command], {
        cwd,
        windowsHide: true,
        env: { ...process.env },
      });

      let stdout = '';
      let stderr = '';
      let isTimedOut = false;

      const timer = setTimeout(() => {
        isTimedOut = true;
        proc.kill('SIGKILL');
        if (this.logs.length > 0) {
          this.logs[this.logs.length - 1].result = 'error';
          this._saveLogs();
        }
        reject(new Error(`沙盒防卡死机制触发：命令执行超时 (${timeoutMs}ms)`));
      }, timeoutMs);

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (exitCode) => {
        clearTimeout(timer);
        if (isTimedOut) return;
        
        // 更新最后一条日志的结果
        if (this.logs.length > 0) {
          this.logs[this.logs.length - 1].result = exitCode === 0 ? 'success' : 'error';
          this._saveLogs();
        }

        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          success: exitCode === 0,
        });
      });

      proc.on('error', (err) => {
        clearTimeout(timer);
        if (isTimedOut) return;
        
        if (this.logs.length > 0) {
          this.logs[this.logs.length - 1].result = 'error';
          this._saveLogs();
        }
        reject(new Error(`命令执行失败: ${err.message}`));
      });
    });
  }

  /**
   * 授予权限
   * @param {string} pattern - 命令模式（支持正则）
   * @param {boolean} permanent - 是否永久
   * @returns {Object} 权限记录
   */
  grantPermission(pattern, permanent = false) {
    const permission = {
      id: uuidv4(),
      pattern,
      permanent,
      grantedAt: new Date().toISOString(),
    };
    this.permissions.push(permission);
    this._savePermissions();
    return permission;
  }

  /**
   * 撤销权限
   * @param {string} id - 权限 ID
   */
  revokePermission(id) {
    this.permissions = this.permissions.filter(p => p.id !== id);
    this._savePermissions();
  }

  /**
   * 获取所有权限列表
   * @returns {Array} 权限列表
   */
  getPermissions() {
    return this.permissions;
  }

  /**
   * 获取操作日志
   * @param {number} page - 页码
   * @param {number} pageSize - 每页数量
   * @returns {Object} { items, total }
   */
  getLogs(page = 1, pageSize = 50) {
    const sorted = [...this.logs].reverse();
    const start = (page - 1) * pageSize;
    return {
      items: sorted.slice(start, start + pageSize),
      total: this.logs.length,
    };
  }

  /**
   * 设置沙盒启用状态
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.enabled = enabled;
  }
}

module.exports = { SandboxExecutor };
