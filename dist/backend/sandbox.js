"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxExecutor = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const uuid_1 = require("uuid");
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
    dataDir;
    permissionsPath;
    logsPath;
    permissions = [];
    logs = [];
    enabled = true;
    /**
     * @param {string} dataDir - 数据存储目录
     */
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.permissionsPath = path.join(dataDir, 'sandbox-permissions.json');
        this.logsPath = path.join(dataDir, 'sandbox-logs.json');
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
        }
        catch (error) {
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
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(this.permissionsPath, JSON.stringify(this.permissions, null, 2), 'utf-8');
        }
        catch (error) {
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
        }
        catch (error) {
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
        }
        catch (error) {
            console.error('[沙盒] 日志保存失败:', error);
        }
    }
    /**
     * 记录操作日志
     * @private
     */
    _logOperation(command, riskLevel, action, result) {
        const log = {
            id: (0, uuid_1.v4)(),
            command,
            riskLevel,
            action,
            result,
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
            if (pattern.test(command))
                return 'high';
        }
        for (const pattern of MEDIUM_RISK_PATTERNS) {
            if (pattern.test(command))
                return 'medium';
        }
        return 'low';
    }
    /**
     * 检查命令是否已被授权
     * @param {string} command - 要检查的命令
     * @returns {boolean} 是否已授权
     */
    isAuthorized(command) {
        if (!this.enabled)
            return true;
        for (const perm of this.permissions) {
            if (!perm.permanent)
                continue;
            try {
                const regex = new RegExp(perm.pattern, 'i');
                if (regex.test(command))
                    return true;
            }
            catch {
                if (command.includes(perm.pattern))
                    return true;
            }
        }
        return false;
    }
    /**
     * 执行命令
     * @param {string} command - 要执行的命令
     * @param {ExecuteOptions} options - 执行选项
     * @returns {Promise<ExecuteResult>} 执行结果
     */
    async execute(command, options = {}) {
        const riskLevel = this.getRiskLevel(command);
        const isAuth = this.isAuthorized(command);
        // 低风险或已授权的命令直接执行
        if (riskLevel === 'low' || isAuth) {
            const action = isAuth ? 'auto-allowed' : 'allowed';
            const logItem = this._logOperation(command, riskLevel, action, 'pending');
            return this._runCommand(command, options, logItem);
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
     * @param {ExecuteOptions} options - 执行选项
     * @returns {Promise<ExecuteResult>} 执行结果
     */
    async executeConfirmed(command, permanent = false, options = {}) {
        const riskLevel = this.getRiskLevel(command);
        // 永久授权
        if (permanent) {
            this.grantPermission(command, true);
        }
        const logItem = this._logOperation(command, riskLevel, 'allowed', 'pending');
        return this._runCommand(command, options, logItem);
    }
    /**
     * 检测宿主机 Docker 服务是否正常运行
     * @private
     */
    async _isDockerAvailable() {
        return new Promise((resolve) => {
            const proc = (0, child_process_1.spawn)('docker', ['info'], { windowsHide: true });
            proc.on('close', (code) => {
                resolve(code === 0);
            });
            proc.on('error', () => {
                resolve(false);
            });
        });
    }
    /**
     * 实际执行命令 (自适应物理沙盒执行引擎)
     * @private
     */
    async _runCommand(command, options = {}, logItem) {
        const timeoutMs = options.timeout || 30000; // 默认 30 秒超时
        const cwd = options.cwd || process.cwd();
        // 1. 自适应检测本地 Docker 环境是否可用
        const hasDocker = await this._isDockerAvailable();
        if (hasDocker) {
            console.log(`[沙盒安全中转] 检测到本地 Docker 正在运行，命令将在 python:3.10-alpine 物理隔离硬沙箱中执行: "${command}"`);
            return new Promise((resolve, reject) => {
                let isTimedOut = false;
                // 构造 Docker 物理资源受限运行指令：限制128m内存，0.5核，禁用网络防发包，挂载工作区共享文件
                const dockerArgs = [
                    'run', '--rm',
                    '-i',
                    '-m', '128m',
                    '--cpus', '0.5',
                    '--network', 'none',
                    '-v', `${cwd}:/workspace`,
                    '-w', '/workspace',
                    'python:3.10-alpine',
                    'sh', '-c', command
                ];
                const proc = (0, child_process_1.spawn)('docker', dockerArgs, { windowsHide: true });
                let stdout = '';
                let stderr = '';
                const timer = setTimeout(() => {
                    isTimedOut = true;
                    proc.kill('SIGKILL');
                    if (logItem) {
                        logItem.result = 'error';
                        this._saveLogs();
                    }
                    reject(new Error(`[🐳 Docker沙箱超时] 命令在隔离沙箱容器中执行超时 (${timeoutMs}ms)`));
                }, timeoutMs);
                proc.stdout.on('data', (data) => { stdout += data.toString(); });
                proc.stderr.on('data', (data) => { stderr += data.toString(); });
                proc.on('close', (exitCode) => {
                    clearTimeout(timer);
                    if (isTimedOut)
                        return;
                    if (logItem) {
                        logItem.result = exitCode === 0 ? 'success' : 'error';
                        this._saveLogs();
                    }
                    resolve({
                        stdout: `[🐳 Docker Alpine 沙盒]\n` + stdout.trim(),
                        stderr: stderr.trim(),
                        exitCode: exitCode !== null ? exitCode : -1,
                        success: exitCode === 0,
                    });
                });
                proc.on('error', (err) => {
                    clearTimeout(timer);
                    if (isTimedOut)
                        return;
                    if (logItem) {
                        logItem.result = 'error';
                        this._saveLogs();
                    }
                    reject(new Error(`Docker 容器拉起失败: ${err.message}`));
                });
            });
        }
        // 2. 无 Docker 环境时，自动降级至宿主机本地进程中执行
        console.warn(`[沙盒安全降级] 宿主机未运行 Docker 守护进程，自适应降级至本地操作系统环境执行: "${command}"`);
        return new Promise((resolve, reject) => {
            const timeoutMs = options.timeout || 30000;
            const cwd = options.cwd || process.cwd();
            const isWindows = process.platform === 'win32';
            const shellName = isWindows ? 'powershell.exe' : 'sh';
            const shellArgs = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];
            const proc = (0, child_process_1.spawn)(shellName, shellArgs, {
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
                if (logItem) {
                    logItem.result = 'error';
                    this._saveLogs();
                }
                reject(new Error(`[本地沙箱超时] 命令执行超时 (${timeoutMs}ms)`));
            }, timeoutMs);
            proc.stdout.on('data', (data) => { stdout += data.toString(); });
            proc.stderr.on('data', (data) => { stderr += data.toString(); });
            proc.on('close', (exitCode) => {
                clearTimeout(timer);
                if (isTimedOut)
                    return;
                if (logItem) {
                    logItem.result = exitCode === 0 ? 'success' : 'error';
                    this._saveLogs();
                }
                resolve({
                    stdout: `[⚠️ 本地宿主机降级环境]\n` + stdout.trim(),
                    stderr: stderr.trim(),
                    exitCode: exitCode !== null ? exitCode : -1,
                    success: exitCode === 0,
                });
            });
            proc.on('error', (err) => {
                clearTimeout(timer);
                if (isTimedOut)
                    return;
                if (logItem) {
                    logItem.result = 'error';
                    this._saveLogs();
                }
                reject(new Error(`本地命令执行失败: ${err.message}`));
            });
        });
    }
    /**
     * 授予权限
     * @param {string} pattern - 命令模式（支持正则）
     * @param {boolean} permanent - 是否永久
     * @returns {Permission} 权限记录
     */
    grantPermission(pattern, permanent = false) {
        const permission = {
            id: (0, uuid_1.v4)(),
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
     * @returns {Permission[]} 权限列表
     */
    getPermissions() {
        return this.permissions;
    }
    /**
     * 获取操作日志
     * @param {number} page - 页码
     * @param {number} pageSize - 每页数量
     * @returns {{ items: SandboxLog[], total: number }} { items, total }
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
exports.SandboxExecutor = SandboxExecutor;
