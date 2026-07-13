/**
 * OpenClaw 密钥库 (Secret Store)
 *
 * 主密钥（MASTER_KEY）获取策略：
 *   1. 优先使用 Electron `safeStorage`（系统密钥库托管），密钥密文落盘于 `.keyring/app.key.enc`；
 *   2. 不可用时回退至「每机派生」密钥文件 `.keyring/app.key`，文件权限严格 600。
 *
 * 任何 API Key / 凭据的加解密一律通过本模块的 getMasterKey() 获取主密钥，
 * 禁止在源码中硬编码任何密钥 / token / salt。
 */
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

/** 安全获取 Electron safeStorage（仅在主进程、Electron 运行时可用；否则返回 undefined） */
function getSafeStorage(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const electron = require('electron');
    return electron && electron.safeStorage ? electron.safeStorage : undefined;
  } catch {
    return undefined;
  }
}

/**
 * 获取（或派生）主密钥。
 * @param dataDir 应用数据目录，密钥文件将存储于其下的 `.keyring/` 子目录
 * @returns 32 字节主密钥 Buffer（用于 aes-256 系列算法）
 */
export function getMasterKey(dataDir: string): Buffer {
  const keyringDir = path.join(dataDir, '.keyring');
  const encPath = path.join(keyringDir, 'app.key.enc');
  const plainPath = path.join(keyringDir, 'app.key');

  const safeStorage = getSafeStorage();
  if (safeStorage && typeof safeStorage.isEncryptionAvailable === 'function' && safeStorage.isEncryptionAvailable()) {
    if (!fs.existsSync(encPath)) {
      const k = crypto.randomBytes(32).toString('hex');
      fs.mkdirSync(keyringDir, { recursive: true });
      // 系统密钥库托管：密文写入 app.key.enc
      fs.writeFileSync(encPath, safeStorage.encryptString(k));
    }
    const enc = fs.readFileSync(encPath);
    return Buffer.from(safeStorage.decryptString(enc), 'hex');
  }

  // 兜底：每机派生密钥文件，权限严格 600
  if (!fs.existsSync(plainPath)) {
    fs.mkdirSync(keyringDir, { recursive: true });
    fs.writeFileSync(plainPath, crypto.randomBytes(32), { mode: 0o600 });
  }
  return fs.readFileSync(plainPath);
}
