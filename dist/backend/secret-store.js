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
exports.getMasterKey = getMasterKey;
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
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
/** 安全获取 Electron safeStorage（仅在主进程、Electron 运行时可用；否则返回 undefined） */
function getSafeStorage() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const electron = require('electron');
        return electron && electron.safeStorage ? electron.safeStorage : undefined;
    }
    catch {
        return undefined;
    }
}
/**
 * 获取（或派生）主密钥。
 * @param dataDir 应用数据目录，密钥文件将存储于其下的 `.keyring/` 子目录
 * @returns 32 字节主密钥 Buffer（用于 aes-256 系列算法）
 */
function getMasterKey(dataDir) {
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
        try {
            return Buffer.from(safeStorage.decryptString(enc), 'hex');
        }
        catch (e) {
            console.warn('[SecretStore] safeStorage 密钥解密失败，将重新生成密钥:', e.message);
            try {
                fs.unlinkSync(encPath);
            }
            catch { }
            const k = crypto.randomBytes(32).toString('hex');
            fs.writeFileSync(encPath, safeStorage.encryptString(k));
            return Buffer.from(k, 'hex');
        }
    }
    // 兜底：每机派生密钥文件，权限严格 600
    if (!fs.existsSync(plainPath)) {
        fs.mkdirSync(keyringDir, { recursive: true });
        fs.writeFileSync(plainPath, crypto.randomBytes(32), { mode: 0o600 });
    }
    return fs.readFileSync(plainPath);
}
