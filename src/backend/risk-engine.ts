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

interface ParsedCommand {
  interpreter?: string;
  script?: string;
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
  const bodyMatch = rest.match(/(?:^|\s)(-e|-c|-Command|-EncodedCommand)\s+"?([^"]*?)"?(?:\s|$)/i);
  const script = bodyMatch ? bodyMatch[2] : undefined;

  return { interpreter, script };
}

/**
 * 评估命令风险等级。
 * @param command 待评估的命令字符串
 * @returns 风险等级
 */
export function assessRisk(command: string): RiskLevel {
  const { interpreter, script } = parseCommand(command);
  // 联合扫描：全命令 + 解释器脚本体，防止「载体包裹」绕过禁止清单
  // （例如 node -e "require('child_process').execSync('rm -rf /')" 必须被 forbidden 拦截）
  const scanTargets = [command, script].filter(
    (s): s is string => typeof s === 'string' && s.length > 0
  );

  if (FORBIDDEN_PATTERNS.some((p) => scanTargets.some((t) => p.test(t)))) return 'forbidden';
  if (interpreter && INTERPRETER_CARRIERS.includes(interpreter)) return 'medium';
  if (HIGH_PATTERNS.some((p) => scanTargets.some((t) => p.test(t)))) return 'high';
  if (MEDIUM_PATTERNS.some((p) => scanTargets.some((t) => p.test(t)))) return 'medium';
  return 'low';
}
