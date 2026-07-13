import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const { SandboxExecutor } = require('../../src/backend/sandbox');

describe('SandboxExecutor 审计哈希链 (P1/P2 S6)', () => {
  const tmp = path.join(os.tmpdir(), 'oc-test-audit-' + Date.now());
  let sb: any;

  beforeAll(() => {
    sb = new SandboxExecutor(tmp);
  });

  afterAll(() => {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('空审计时 verifyAuditChain 返回 true', () => {
    expect(sb.verifyAuditChain()).toBe(true);
  });

  it('拦截命令会写入审计记录', async () => {
    await sb.execute('rm -rf /');
    await sb.execute('rm -rf /');
    const { total, items } = sb.getAudit();
    expect(total).toBeGreaterThanOrEqual(2);
    expect(items.some((r: any) => r.action === 'blocked')).toBe(true);
  });

  it('正常追加后哈希链完整（verifyAuditChain 返回 true）', async () => {
    await sb.execute('rm -rf /');
    await sb.execute('rm -rf /');
    await sb.execute('rm -rf /');
    expect(sb.verifyAuditChain()).toBe(true);
  });

  it('篡改中部记录的 command 后链校验失败', async () => {
    await sb.execute('rm -rf /');
    await sb.execute('rm -rf /');
    const auditPath = path.join(tmp, 'sandbox-audit.jsonl');
    const lines = fs.readFileSync(auditPath, 'utf-8').split('\n').filter(Boolean);
    const rec = JSON.parse(lines[1]); // 改中部记录
    rec.command = 'TAMPERED_COMMAND_XYZ';
    lines[1] = JSON.stringify(rec);
    fs.writeFileSync(auditPath, lines.join('\n') + '\n', 'utf-8');
    expect(sb.verifyAuditChain()).toBe(false);
  });

  it('篡改中部记录的 prevHash 后链校验失败', async () => {
    const auditPath = path.join(tmp, 'sandbox-audit.jsonl');
    const lines = fs.readFileSync(auditPath, 'utf-8').split('\n').filter(Boolean);
    const rec = JSON.parse(lines[1]);
    rec.prevHash = 'forged-prev-hash';
    lines[1] = JSON.stringify(rec);
    fs.writeFileSync(auditPath, lines.join('\n') + '\n', 'utf-8');
    expect(sb.verifyAuditChain()).toBe(false);
  });

  it('clearAudit 清空后链恢复为 true', async () => {
    sb.clearAudit();
    expect(sb.verifyAuditChain()).toBe(true);
    expect(sb.getAudit().total).toBe(0);
  });
});
