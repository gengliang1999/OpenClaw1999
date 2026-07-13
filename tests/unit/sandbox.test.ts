import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

const { SandboxExecutor } = require('../../src/backend/sandbox');

describe('SandboxExecutor 风险网关 (P0/T3)', () => {
  const tmp = path.join(os.tmpdir(), 'oc-test-sandbox-' + Date.now());
  let sb: any;

  beforeAll(() => {
    sb = new SandboxExecutor(tmp);
  });

  afterAll(() => {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('命中禁止清单的命令被直接阻断，不进入执行', async () => {
    const r = await sb.execute('rm -rf /');
    expect(r.blocked).toBe(true);
    expect(r.needsConfirmation).toBeFalsy();
  });

  it('解释器载体命令触发确认，不静默执行', async () => {
    const r = await sb.execute('node -e "process.exit(1)"');
    expect(r.needsConfirmation).toBe(true);
    expect(r.riskLevel).toBe('medium');
  });

  it('高风险命令触发确认', async () => {
    const r = await sb.execute('del /f secret.txt');
    expect(r.needsConfirmation).toBe(true);
    expect(r.riskLevel).toBe('high');
  });

  it('良性命令风险等级为 low', () => {
    expect(sb.getRiskLevel('echo hi')).toBe('low');
  });

  it('用户确认后解释器载体命令转为执行（不再阻断）', async () => {
    const r = await sb.executeConfirmed('node -e "process.exit(0)"', false);
    // 不再返回 blocked / needsConfirmation；实际是否成功取决于环境，但必须不是被拦截
    expect(r.blocked).toBeFalsy();
    expect(r.needsConfirmation).toBeFalsy();
  });
});
