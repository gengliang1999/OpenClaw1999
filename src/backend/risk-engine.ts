/**
 * OpenClaw 风险引擎 (Risk Engine)
 *
 * 命令风险分级策略（替换旧版纯正则分级）：
 *   1. 解释器载体识别（node/python/pwsh/powershell/cmd/sh/bash 等）
 *   2. 参数静态分析（提取 -e/-c/-Command 之后的脚本体做匹配）
 *   3. 危险子串 deny-list（forbidden）分级阻断
 *
 * 风险等级：'forbidden'（直接阻断） | 'high' | 'medium'（需用户确认） | 'low'（可直接执行）
 */

/** 解释器载体白名单：凡经这些解释器执行的命令一律视为需确认（medium） */
export const INTERPRETER_CARRIERS: string[] = [
  'node', 'node.exe', 'python', 'python3', 'pwsh', 'powershell',
  'cmd', 'sh', 'bash', 'ruby', 'perl', 'wscript', 'cscript',
];

/** 禁止清单：命中即直接阻断，绝不执行 */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /\brm\s+-rf\b/i,
  /\bformat\s+[a-z]:/i,
  /\bshutdown\b/i,
  /\bREG\s+ADD\b/i,
  />\s*\/dev\/(sd|hd)/i,
  // 下载并执行（经典 RCE）：下载器管道给解释器/执行器
  /\b(iwr|invoke-webrequest|curl|wget)\b[\s\S]*\|\s*(iex|invoke-expression|sh|bash|powershell|pwsh|cmd|python|python3|perl|ruby)\b/i,
  // 直接执行任意代码的危险别名（PowerShell iex）
  /\biex\b/i,
  // 高危磁盘与系统破坏防御
  /\bdiskpart\b/i,
  /\bnetsh\s+advfirewall\b/i,
  /\bRemove-Item\b[\s\S]*-Recurse[\s\S]*-Force\b/i,
  /\btaskkill\s+\/[fF]\s+\/im\b/i
];

/** 高风险模式：需用户显式确认 */
export const HIGH_PATTERNS: RegExp[] = [
  /\b(del|rmdir|rm|remove-item)\b/i,
  /\b(reg|regedit)\b/i,
  /\b(sc\s+delete|Stop-Service)\b/i,
  /\bInvoke-Expression\b/i,
  /\bSet-ExecutionPolicy\b/i,
];

/** 中风险模式：需用户确认 */
export const MEDIUM_PATTERNS: RegExp[] = [
  /\b(copy|move|rename|mkdir|New-Item)\b/i,
  /\b(net\s+(user|share|use|localgroup))\b/i,
  /\b(pip|npm|yarn)\s+install\b/i,
];

export type RiskLevel = 'forbidden' | 'high' | 'medium' | 'low';

export interface RiskAssessment {
  level: RiskLevel;
  reason?: string;
  decodedScript?: string;
}

interface ParsedCommand {
  interpreter?: string;
  script?: string;
}

/** 尝试解密 Base64 (支持 UTF-16LE 与 UTF-8)，防止 Powershell -EncodedCommand 绕过检测 */
function tryDecodeBase64(base64Str: string): string | undefined {
  try {
    const buf = Buffer.from(base64Str, 'base64');
    const utf16 = buf.toString('utf16le');
    if (/[a-zA-Z0-9_-]/.test(utf16)) return utf16;
    const utf8 = buf.toString('utf8');
    if (/[a-zA-Z0-9_-]/.test(utf8)) return utf8;
  } catch {
    // 忽略无效编码
  }
  return undefined;
}

/**
 * 解析命令：提取首 token（解释器/可执行文件）与 -e/-c/-Command 之后的脚本体。
 */
function parseCommand(command: string): ParsedCommand {
  const trimmed = (command || '').trim();
  if (!trimmed) return {};

  const m = trimmed.match(/^"?([^\s"']+)"?\s*([\s\S]*)$/);
  if (!m) return {};

  let interpreter = m[1].toLowerCase().replace(/\.exe$/i, '');
  const rest = m[2] || '';

  // 提取 -e / -c / -Command / -EncodedCommand 之后的脚本体（去除外层引号）
  const bodyMatch = rest.match(/(?:^|\s)(-e|-c|-Command|-EncodedCommand|-enc)\s+"?([^"]*?)"?(?:\s|$)/i);
  const script = bodyMatch ? bodyMatch[2] : undefined;

  return { interpreter, script };
}

/**
 * 评估命令风险等级，返回详细审计信息。
 */
export function assessRiskDetailed(command: string): RiskAssessment {
  const { interpreter, script } = parseCommand(command);

  let decoded: string | undefined = undefined;
  const encodedMatch = (command || '').match(/(?:-EncodedCommand|-enc)\s+([A-Za-z0-9+/=]+)/i);
  if (encodedMatch && encodedMatch[1]) {
    decoded = tryDecodeBase64(encodedMatch[1]);
  }

  const scanTargets = [command, script, decoded].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );

  for (const p of FORBIDDEN_PATTERNS) {
    if (scanTargets.some(t => p.test(t))) {
      return {
        level: 'forbidden',
        reason: `命中已知高危阻断规则 (${p.source})`,
        decodedScript: decoded
      };
    }
  }

  for (const p of HIGH_PATTERNS) {
    if (scanTargets.some(t => p.test(t))) {
      return {
        level: 'high',
        reason: `包含破坏性系统操作 (${p.source})`,
        decodedScript: decoded
      };
    }
  }

  if (interpreter && INTERPRETER_CARRIERS.includes(interpreter)) {
    return {
      level: 'medium',
      reason: `动态脚本解释器载体 (${interpreter})`,
      decodedScript: decoded
    };
  }

  for (const p of MEDIUM_PATTERNS) {
    if (scanTargets.some(t => p.test(t))) {
      return {
        level: 'medium',
        reason: `敏感文件或软件管理指令 (${p.source})`,
        decodedScript: decoded
      };
    }
  }

  return { level: 'low', decodedScript: decoded };
}

/**
 * 评估命令风险等级（向下兼容原签名）。
 */
export function assessRisk(command: string): RiskLevel {
  return assessRiskDetailed(command).level;
}

