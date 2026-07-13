import * as fs from 'fs';
import * as path from 'path';
import os from 'os';

// 模拟无 electron 环境：safeStorage 不可用 → 走每机派生文件兜底
jest.mock('electron', () => ({ safeStorage: undefined }), { virtual: true });

const { getMasterKey } = require('../../src/backend/secret-store');

describe('secret-store / getMasterKey (P0/T6)', () => {
  const tmp = path.join(os.tmpdir(), 'oc-test-keyring-' + Date.now());

  afterAll(() => {
    if (fs.existsSync(tmp)) fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('无 safeStorage 时派生 32 字节主密钥文件', () => {
    const k1 = getMasterKey(tmp);
    expect(Buffer.isBuffer(k1)).toBe(true);
    expect(k1.length).toBe(32);
    const keyPath = path.join(tmp, '.keyring', 'app.key');
    expect(fs.existsSync(keyPath)).toBe(true);
  });

  it('同一 dataDir 派生结果确定性一致（可重复解密）', () => {
    const k1 = getMasterKey(tmp);
    const k2 = getMasterKey(tmp);
    expect(k2.equals(k1)).toBe(true);
  });

  it('源码不包含任何硬编码明文密钥常量', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/backend/secret-store.ts'), 'utf8');
    expect(src).not.toContain('openclaw-default-api-key-safe-salt');
  });
});
