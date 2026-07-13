import os from 'os';
const { redactForLog, normalizeCommandFingerprint, matchFingerprint, isScopeAllowed, sha256Hex } = require('../../src/backend/security-utils');

describe('security-utils S7/I6 纯函数', () => {
  describe('normalizeCommandFingerprint', () => {
    it('折叠连续空白并 trim', () => {
      expect(normalizeCommandFingerprint('  ls   -la   ')).toBe('ls -la');
    });
    it('展开 $HOME / $USER / ~ 为占位符', () => {
      expect(normalizeCommandFingerprint('cat $HOME/.bashrc')).toBe('cat <HOME>/.bashrc');
      expect(normalizeCommandFingerprint('cp a $USER/b')).toBe('cp a <USER>/b');
      expect(normalizeCommandFingerprint('~/bin/run')).toBe('<HOME>/bin/run');
    });
    it('剔除 ISO 时间戳', () => {
      expect(normalizeCommandFingerprint('log 2026-07-13T02:52:49Z done')).toBe('log <TS> done');
    });
    it('剔除 UUID', () => {
      expect(normalizeCommandFingerprint('id 123e4567-e89b-12d3-a456-426614174000 x')).toBe('id <UUID> x');
    });
    it('剔除 /tmp 下的随机段', () => {
      expect(normalizeCommandFingerprint('mv f /tmp/abc123XYZ')).toBe('mv f /tmp/<RAND>');
    });
    it('空输入返回空串', () => {
      expect(normalizeCommandFingerprint('')).toBe('');
    });
  });

  describe('matchFingerprint', () => {
    it('精确相等通过', () => {
      expect(matchFingerprint('ls -la', 'ls -la')).toBe(true);
    });
    it('词前缀匹配（存储指纹是命令前缀）通过', () => {
      expect(matchFingerprint('npm run', 'npm run build')).toBe(true);
    });
    it('非前缀子串不匹配（npm 不误配 npmrm）', () => {
      expect(matchFingerprint('npm', 'npmrm -rf')).toBe(false);
    });
    it('空值安全返回 false', () => {
      expect(matchFingerprint('', 'ls')).toBe(false);
      expect(matchFingerprint('ls', '')).toBe(false);
    });
  });

  describe('isScopeAllowed', () => {
    it('scope 为空表示不限', () => {
      expect(isScopeAllowed(undefined, 'high')).toBe(true);
    });
    it('riskLevel 在白名单内放行', () => {
      expect(isScopeAllowed({ riskLevels: ['high', 'medium'] }, 'medium')).toBe(true);
    });
    it('riskLevel 不在白名单内拒绝', () => {
      expect(isScopeAllowed({ riskLevels: ['low'] }, 'high')).toBe(false);
    });
    it('cwd 约束：匹配前缀放行', () => {
      expect(isScopeAllowed({ riskLevels: ['high'], cwd: '/work' }, 'high', '/work/sub')).toBe(true);
    });
    it('cwd 约束：越界拒绝', () => {
      expect(isScopeAllowed({ riskLevels: ['high'], cwd: '/work' }, 'high', '/etc')).toBe(false);
    });
  });

  describe('redactForLog (I6)', () => {
    it('sk- 密钥遮罩为前缀4位+***', () => {
      const out = redactForLog('token=sk-abcdefghijklmnop secret');
      expect(out).toContain('sk-a***');
      expect(out).not.toContain('sk-abcdefghijklmnop');
    });
    it('AWS AKIA 密钥遮罩', () => {
      const out = redactForLog('key=AKIA1234567890ABCDEF');
      expect(out).toContain('AKIA***');
      expect(out).not.toContain('AKIA1234567890ABCDEF');
    });
    it('key=xxx 形式遮罩', () => {
      const out = redactForLog('api_key="supersecretvalue"');
      expect(out).toContain('api_key=***');
      expect(out).not.toContain('supersecretvalue');
    });
    it('Home 路径展开为 <USER>', () => {
      const home = os.homedir();
      const out = redactForLog('open ' + home + '/file');
      expect(out).not.toContain(home);
      expect(out).toContain('<USER>');
    });
    it('非敏感内容原样返回', () => {
      expect(redactForLog('user ran ls -la')).toBe('user ran ls -la');
    });
  });

  describe('sha256Hex', () => {
    it('与 node crypto 一致', () => {
      const { createHash } = require('crypto');
      const input = 'openclaw-sandbox-audit-v1';
      expect(sha256Hex(input)).toBe(createHash('sha256').update(input, 'utf8').digest('hex'));
    });
  });
});
