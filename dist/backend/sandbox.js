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
const risk_engine_1 = require("./risk-engine");
const security_utils_1 = require("./security-utils");
/** 无 Docker 降级模式下，从子进程环境中剔除的敏感环境变量（正则） */
const SENSITIVE_ENV = /^(OPENAI_API_KEY|ANTHROPIC_API_KEY|AWS_|AZURE_|GCP_|OPENCLAW_|.*_TOKEN|.*_SECRET|.*API_KEY|.*PASSWORD|.*CREDENTIAL)/i;
/** S6：审计哈希链种子（首条记录的 prevHash）。固定常量，用于检测审计文件被整体替换。 */
const AUDIT_CHAIN_SEED = 'openclaw-sandbox-audit-v1';
class SandboxExecutor {
    dataDir;
    permissionsPath;
    logsPath;
    auditPath;
    permissions = [];
    logs = [];
    enabled = true;
    /** S6：当前审计哈希链末端（内存态），启动时从文件加载 */
    prevAuditHash = AUDIT_CHAIN_SEED;
    /** 无 Docker 时是否允许降级到宿主机执行（默认 true）；high 风险命令在降级模式下仍禁止自动执行 */
    allowHostFallback = true;
    /**
     * @param {string} dataDir - 数据存储目录
     */
    constructor(dataDir) {
        this.dataDir = dataDir;
        this.permissionsPath = path.join(dataDir, 'sandbox-permissions.json');
        this.logsPath = path.join(dataDir, 'sandbox-logs.json');
        this.auditPath = path.join(dataDir, 'sandbox-audit.jsonl');
        this._loadPermissions();
        this._migrateLegacyPermissions();
        this._loadLogs();
        this._loadAuditChain();
    }
    /**
     * S7：旧版以正则 pattern 存储的授权，一次性迁移为规范化指纹。
     * 无法规范化的标记 revoked（不崩、不丢数据，便于用户后续人工复核）。
     * @private
     */
    _migrateLegacyPermissions() {
        let mutated = false;
        for (const perm of this.permissions) {
            if (perm.pattern && !perm.fingerprint) {
                try {
                    perm.fingerprint = (0, security_utils_1.normalizeCommandFingerprint)(perm.pattern);
                    mutated = true;
                }
                catch {
                    perm.revoked = true;
                    mutated = true;
                }
            }
        }
        if (mutated)
            this._savePermissions();
    }
    /**
     * S6：从审计文件加载哈希链末端，保证进程重启后链不断裂。
     * @private
     */
    _loadAuditChain() {
        try {
            if (fs.existsSync(this.auditPath)) {
                const lines = fs.readFileSync(this.auditPath, 'utf-8').split('\n').filter(Boolean);
                if (lines.length > 0) {
                    const last = JSON.parse(lines[lines.length - 1]);
                    if (last && typeof last.recordHash === 'string') {
                        this.prevAuditHash = last.recordHash;
                    }
                }
            }
        }
        catch {
            // 审计链加载失败不阻断主流程，从种子重新开始（verifyAuditChain 可检出历史篡改）
            this.prevAuditHash = AUDIT_CHAIN_SEED;
        }
    }
    /**
     * 加载权限配置
     * @private
     */
    _loadPermissions() {
        try {
            if (fs.existsSync(this.permissionsPath)) {
                const raw = fs.readFileSync(this.permissionsPath, 'utf-8');
                const parsed = JSON.parse(raw);
                this.permissions = Array.isArray(parsed) ? parsed : [];
            }
            else {
                this.permissions = [];
            }
        }
        catch (error) {
            console.error('[沙盒] 权限配置加载失败，尝试从备份恢复:', error);
            const tempPath = this.permissionsPath + '.tmp';
            try {
                if (fs.existsSync(tempPath)) {
                    const raw = fs.readFileSync(tempPath, 'utf-8');
                    const parsed = JSON.parse(raw);
                    this.permissions = Array.isArray(parsed) ? parsed : [];
                    // 成功恢复后同步写盘
                    fs.writeFileSync(this.permissionsPath, JSON.stringify(this.permissions, null, 2), 'utf-8');
                    return;
                }
            }
            catch (backupError) {
                console.error('[沙盒] 备份配置文件读取同样损坏:', backupError);
            }
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
            // 采用“临时写入（.tmp）+ 原子重命名（renameSync）”确保配置落盘的完整性，抗崩溃损坏
            const tempPath = this.permissionsPath + '.tmp';
            fs.writeFileSync(tempPath, JSON.stringify(this.permissions, null, 2), 'utf-8');
            fs.renameSync(tempPath, this.permissionsPath);
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
     * 记录操作日志（含敏感操作审计痕迹）
     * @private
     */
    _logOperation(command, riskLevel, action, result, meta) {
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
        // S6：同步写入独立防篡改审计（command 明文留痕，不进 redactForLog）
        this._appendAudit({
            command,
            riskLevel,
            action,
            result,
            actor: meta?.actor || 'agent',
            source: meta?.source || 'agent-loop',
        });
        return log;
    }
    /**
     * S6：追加一条审计记录，写入独立 sandbox-audit.jsonl，并维护 SHA-256 哈希链。
     * 与 sandbox-logs.json / openclaw.log 物理分离；文件权限 600。
     * @private
     */
    _appendAudit(rec) {
        const timestamp = new Date().toISOString();
        const canonicalPayload = {
            id: (0, uuid_1.v4)(),
            timestamp,
            command: rec.command,
            riskLevel: rec.riskLevel,
            action: rec.action,
            result: rec.result,
            actor: rec.actor,
            source: rec.source,
            prevHash: this.prevAuditHash,
        };
        const record = {
            ...canonicalPayload,
            recordHash: (0, security_utils_1.sha256Hex)(JSON.stringify(canonicalPayload)),
        };
        this.prevAuditHash = record.recordHash;
        try {
            const dir = path.dirname(this.auditPath);
            if (!fs.existsSync(dir))
                fs.mkdirSync(dir, { recursive: true });
            fs.appendFileSync(this.auditPath, JSON.stringify(record) + '\n', 'utf-8');
            try {
                fs.chmodSync(this.auditPath, 0o600);
            }
            catch { /* 权限收紧失败不阻断 */ }
        }
        catch (e) {
            console.error('[沙盒] 审计日志写入失败:', e);
        }
    }
    /**
     * 判断命令的风险等级（代理至 risk-engine 的 assessRisk）。
     * @param {string} command - 要检查的命令
     * @returns {'high'|'medium'|'low'} 风险等级（forbidden 归并为 high 以兼容历史调用方）
     */
    getRiskLevel(command) {
        const r = (0, risk_engine_1.assessRisk)(command);
        return r === 'forbidden' ? 'high' : r;
    }
    /**
     * 检查命令是否已被授权（永久授权白名单）
     * @param {string} command - 要检查的命令
     * @returns {boolean} 是否已授权
     */
    /**
     * 检查命令是否已被授权（永久授权白名单）。
     * S7：改用规范化指纹精确/前缀匹配，彻底弃用脆弱的正则；并校验范围(scope)与到期(expiresAt)。
     * @param {string} command - 要检查的命令
     * @param {object} opts - 可选上下文：riskLevel / cwd，用于范围校验
     * @returns {boolean} 是否已授权
     */
    isAuthorized(command, opts) {
        if (!this.enabled)
            return true;
        const cmdFp = (0, security_utils_1.normalizeCommandFingerprint)(command);
        const now = Date.now();
        for (const perm of this.permissions) {
            if (!perm.permanent)
                continue;
            if (perm.revoked)
                continue;
            if (perm.expiresAt && now > new Date(perm.expiresAt).getTime())
                continue;
            const storedFp = (0, security_utils_1.normalizeCommandFingerprint)(perm.fingerprint || perm.pattern || '');
            if ((0, security_utils_1.matchFingerprint)(storedFp, cmdFp) && (0, security_utils_1.isScopeAllowed)(perm.scope, opts?.riskLevel, opts?.cwd)) {
                return true;
            }
        }
        return false;
    }
    /**
     * 执行命令（风险分级网关）。
     *   - forbidden：直接阻断
     *   - high / medium：返回 needsConfirmation，交由用户确认
     *   - low（或已授权）：直接执行
     * @param {string} command - 要执行的命令
     * @param {ExecuteOptions} options - 执行选项
     */
    async execute(command, options = {}) {
        const risk = (0, risk_engine_1.assessRisk)(command);
        // 禁止清单：直接阻断，绝不执行
        if (risk === 'forbidden') {
            this._logOperation(command, 'high', 'blocked', 'error');
            return {
                blocked: true,
                riskLevel: 'high',
                command,
                message: '⛔ 命令命中禁止清单，已拒绝执行',
            };
        }
        // 高风险 / 中风险：已永久授权则直接执行，否则需要确认（S5 永久授权免确认）
        if (risk === 'high' || risk === 'medium') {
            if (this.isAuthorized(command, { riskLevel: risk, cwd: options.cwd })) {
                const logItem = this._logOperation(command, risk, 'auto-allowed', 'pending', {
                    actor: 'agent',
                    source: 'agent-loop',
                });
                return this._runCommand(command, options, logItem);
            }
            this._logOperation(command, risk, 'allowed', 'pending', { source: 'agent-loop' });
            return {
                needsConfirmation: true,
                riskLevel: risk,
                command,
                message: risk === 'high'
                    ? '⚠️ 此操作可能导致系统损坏或数据丢失，请谨慎确认。'
                    : '⚡ 此操作具有一定风险，请确认后执行。',
            };
        }
        // 低风险或已授权 → 直接执行
        const isAuth = this.isAuthorized(command);
        const action = isAuth ? 'auto-allowed' : 'allowed';
        const logItem = this._logOperation(command, 'low', action, 'pending');
        return this._runCommand(command, options, logItem);
    }
    /**
     * 确认执行命令（用户授权后调用）。
     * @param {string} command - 要执行的命令
     * @param {boolean} permanent - 是否永久授权
     * @param {ExecuteOptions} options - 执行选项
     */
    async executeConfirmed(command, permanent = false, options = {}) {
        const risk = (0, risk_engine_1.assessRisk)(command);
        // 即使已确认，禁止清单命令仍阻断（纵深防御）
        if (risk === 'forbidden') {
            this._logOperation(command, 'high', 'blocked', 'error');
            return {
                blocked: true,
                riskLevel: 'high',
                command,
                message: '⛔ 命令命中禁止清单，已拒绝执行',
            };
        }
        if (permanent) {
            // S7：永久授权复用规范化指纹，并限定风险等级范围 + 默认 30 天到期
            const scope = { riskLevels: [risk] };
            const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
            this.grantPermission(command, true, scope, expiresAt);
        }
        const logItem = this._logOperation(command, risk === 'low' ? 'low' : 'medium', 'allowed', 'pending', {
            source: 'agent-loop',
        });
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
     * 实际执行命令（自适应物理沙盒执行引擎）
     * @private
     */
    async _runCommand(command, options = {}, logItem) {
        const timeoutMs = options.timeout || 30000;
        const cwd = options.cwd || process.cwd();
        // 1. 自适应检测本地 Docker 环境是否可用
        const hasDocker = await this._isDockerAvailable();
        if (hasDocker) {
            console.log(`[沙盒安全中转] 检测到本地 Docker 正在运行，命令将在 python:3.10-alpine 物理隔离硬沙箱中执行: "${(0, security_utils_1.redactForLog)(command)}"`);
            return new Promise((resolve, reject) => {
                let isTimedOut = false;
                const dockerArgs = [
                    'run', '--rm',
                    '-i',
                    '-m', '128m',
                    '--cpus', '0.5',
                    '--network', 'none',
                    '-v', `${cwd}:/workspace`,
                    '-w', '/workspace',
                    'python:3.10-alpine',
                    'sh', '-c', command,
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
        // 2. 无 Docker 环境时，降级至宿主机本地进程执行（强制低权 + 清 env）
        if (!this.allowHostFallback) {
            this._logOperation(command, 'high', 'blocked', 'error');
            return {
                blocked: true,
                riskLevel: 'high',
                command,
                message: '⛔ 当前为宿主机降级模式已被禁用，请安装 Docker 以获得强隔离。',
            };
        }
        // 纵深防御：降级模式下再次评估，high / forbidden 一律禁止自动执行
        const fallbackRisk = (0, risk_engine_1.assessRisk)(command);
        if (fallbackRisk === 'high' || fallbackRisk === 'forbidden') {
            this._logOperation(command, 'high', 'blocked', 'error');
            return {
                blocked: true,
                riskLevel: 'high',
                command,
                message: '⛔ 宿主机降级模式下禁止自动执行高风险命令，请在 Docker 隔离环境中运行。',
            };
        }
        console.warn(`[沙盒安全降级] 宿主机未运行 Docker 守护进程，自适应降级至本地操作系统环境执行: "${(0, security_utils_1.redactForLog)(command)}"`);
        return new Promise((resolve, reject) => {
            const isWindows = process.platform === 'win32';
            const shellName = isWindows ? 'powershell.exe' : 'sh';
            const shellArgs = isWindows ? ['-NoProfile', '-Command', command] : ['-c', command];
            // 裁剪敏感环境变量，避免密钥经子进程泄露
            const safeEnv = {};
            for (const [k, v] of Object.entries(process.env)) {
                if (v === undefined)
                    continue;
                if (SENSITIVE_ENV.test(k))
                    continue;
                safeEnv[k] = v;
            }
            const proc = (0, child_process_1.spawn)(shellName, shellArgs, {
                cwd,
                windowsHide: true,
                env: safeEnv,
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
    /**
     * 授予权限（S7：以规范化指纹存储，支持范围与到期）
     * @param {string} pattern - 命令模式（将规范化为指纹）
     * @param {boolean} permanent - 是否永久
     * @param {PermissionScope} scope - 范围限定（风险等级 / 工作目录）
     * @param {string} expiresAt - 到期时间 ISO；缺省表示永不过期
     * @returns {Permission} 权限记录
     */
    grantPermission(pattern, permanent = false, scope, expiresAt) {
        const permission = {
            id: (0, uuid_1.v4)(),
            pattern,
            fingerprint: (0, security_utils_1.normalizeCommandFingerprint)(pattern),
            permanent,
            grantedAt: new Date().toISOString(),
            scope,
            expiresAt,
        };
        this.permissions.push(permission);
        this._savePermissions();
        return permission;
    }
    /**
     * 撤销权限（S7：软删，标记 revoked 保留以便审计）
     * @param {string} id - 权限 ID
     */
    revokePermission(id) {
        const p = this.permissions.find((x) => x.id === id);
        if (p) {
            p.revoked = true;
            this._savePermissions();
        }
    }
    /**
     * 获取所有有效权限列表（过滤已撤销项）
     * @returns {Permission[]} 权限列表
     */
    getPermissions() {
        return this.permissions.filter((p) => !p.revoked);
    }
    /**
     * 获取操作日志
     * @param {number} page - 页码
     * @param {number} pageSize - 每页数量
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
    // ===== S6：独立防篡改审计（读取 / 校验 / 清空） =====
    /**
     * 获取审计记录（分页）。读取受调用方 RBAC 网关保护。
     */
    getAudit(page = 1, pageSize = 50) {
        let records = [];
        try {
            if (fs.existsSync(this.auditPath)) {
                records = fs.readFileSync(this.auditPath, 'utf-8')
                    .split('\n').filter(Boolean)
                    .map((l) => JSON.parse(l));
            }
        }
        catch {
            records = [];
        }
        records.reverse();
        const start = (page - 1) * pageSize;
        return { items: records.slice(start, start + pageSize), total: records.length };
    }
    /**
     * 校验审计哈希链完整性。任一记录被篡改/删除/重排即返回 false。
     */
    verifyAuditChain() {
        try {
            if (!fs.existsSync(this.auditPath))
                return true;
            const lines = fs.readFileSync(this.auditPath, 'utf-8').split('\n').filter(Boolean);
            let prev = AUDIT_CHAIN_SEED;
            for (const line of lines) {
                const rec = JSON.parse(line);
                if (rec.prevHash !== prev)
                    return false;
                const canonical = JSON.stringify({
                    id: rec.id,
                    timestamp: rec.timestamp,
                    command: rec.command,
                    riskLevel: rec.riskLevel,
                    action: rec.action,
                    result: rec.result,
                    actor: rec.actor,
                    source: rec.source,
                    prevHash: prev,
                });
                if ((0, security_utils_1.sha256Hex)(canonical) !== rec.recordHash)
                    return false;
                prev = rec.recordHash;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 清空审计日志（二次确认由调用方 / IPC 层负责）。
     */
    clearAudit() {
        try {
            if (fs.existsSync(this.auditPath))
                fs.unlinkSync(this.auditPath);
            this.prevAuditHash = AUDIT_CHAIN_SEED;
        }
        catch {
            /* 忽略 */
        }
    }
}
exports.SandboxExecutor = SandboxExecutor;
