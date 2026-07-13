"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeCommandFingerprint = normalizeCommandFingerprint;
exports.matchFingerprint = matchFingerprint;
exports.isScopeAllowed = isScopeAllowed;
exports.redactForLog = redactForLog;
exports.sha256Hex = sha256Hex;
const crypto_1 = require("crypto");
/**
 * S7：规范化命令指纹。
 * 规则（取合理折中，过宽会弱化安全、过窄会频繁重复确认）：
 *  1) 全局 trim，折叠连续空白为单空格
 *  2) 展开环境变量 $HOME / $USER / ~ 为占位符 <HOME> / <USER>
 *  3) 剔除易变参数：ISO 时间戳、UUID、/tmp 下的随机段
 *  4) 保留命令名与关键参数顺序（不归一化普通数字，避免 python3 / node18 之类被错配）
 */
function normalizeCommandFingerprint(cmd) {
    if (!cmd)
        return '';
    let s = cmd.trim().replace(/\s+/g, ' ');
    s = s.replace(/\$(HOME|USER)/gi, '<$1>');
    s = s.replace(/^~(?=\/|$)/, '<HOME>');
    // ISO 时间戳
    s = s.replace(/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?Z?\b/g, '<TS>');
    // UUID
    s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<UUID>');
    // /tmp / /Temp 下的随机段（如 /tmp/abc123）
    s = s.replace(/(\/tmp|\/Temp|\.tmp)\/[A-Za-z0-9_-]+/gi, '$1/<RAND>');
    return s;
}
/**
 * S7：匹配存储指纹与待执行命令指纹。
 *  - 精确相等即通过
 *  - 前缀匹配：存储指纹是命令指纹的「词前缀」（存储指纹后必须紧跟空格或结束），避免 `npm` 误匹配 `npmrm`
 * 绝不使用正则，杜绝元字符误匹配。
 */
function matchFingerprint(stored, cmd) {
    if (!stored || !cmd)
        return false;
    if (stored === cmd)
        return true;
    if (cmd.startsWith(stored + ' '))
        return true;
    return false;
}
/**
 * S7：校验授权范围（风险等级白名单 + 工作目录约束）。
 * scope 为空表示不限。
 */
function isScopeAllowed(scope, riskLevel, cwd) {
    if (!scope)
        return true;
    if (scope.riskLevels && scope.riskLevels.length > 0) {
        if (riskLevel && !scope.riskLevels.includes(riskLevel))
            return false;
    }
    if (scope.cwd && cwd) {
        if (cwd !== scope.cwd && !cwd.startsWith(scope.cwd + '/'))
            return false;
    }
    return true;
}
/* ------------------------------------------------------------------ */
const SENSITIVE_KEY_RE = [
    // OpenAI / 通用 sk- 密钥
    /sk-[A-Za-z0-9]{10,}/g,
    // AWS Access Key
    /AKIA[0-9A-Z]{16}/g,
    // Anthropic 等以值形式出现的 key/token/secret/password
    /(api[_-]?key|access[_-]?token|secret|password|apikey|passwd)\s*[:=]\s*['"]?[A-Za-z0-9\-_.]{8,}/gi,
];
/**
 * I6：日志落盘脱敏。仅遮罩明确敏感内容，保证「落盘无完整明文密钥」。
 *  - 密钥类：保留前缀 4 位 + '***'
 *  - Home 目录绝对路径：展开为 <HOME>，避免泄漏用户名
 * 命令原文本身保留（便于调试），但其中若内嵌密钥则被上述规则脱敏。
 */
function redactForLog(line) {
    if (!line)
        return line;
    let s = line;
    for (const re of SENSITIVE_KEY_RE) {
        s = s.replace(re, (m, p1) => {
            if (p1 && /key|token|secret|password|passwd/i.test(p1)) {
                // key=xxxx → key=***
                return `${p1}=***`;
            }
            return m.slice(0, 4) + '***';
        });
    }
    // 展开 Home 绝对路径（/home/<user> 或 C:\Users\<user>）
    s = s.replace(/\/home\/[A-Za-z0-9_.-]+/g, '/home/<USER>');
    s = s.replace(/C:\\Users\\[A-Za-z0-9_.-]+/gi, 'C:\\Users\\<USER>');
    return s;
}
function sha256Hex(input) {
    return (0, crypto_1.createHash)('sha256').update(input, 'utf8').digest('hex');
}
