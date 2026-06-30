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
exports.openClawDaemon = exports.OpenClawDaemon = void 0;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
class OpenClawDaemon {
    childProcess = null;
    installDir;
    isRunning = false;
    constructor() {
        this.installDir = path.join(os.homedir(), '.openclaw', 'core-engine');
        this._loadCustomPath();
    }
    _loadCustomPath() {
        try {
            const configPath = path.join(os.homedir(), '.openclaw', 'custom-path.json');
            if (fs.existsSync(configPath)) {
                const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                if (data.installDir) {
                    this.installDir = data.installDir;
                }
            }
        }
        catch (e) { }
    }
    /** 同步修改当前守护进程的目录指针 */
    setInstallDir(newPath) {
        this.installDir = newPath;
    }
    /** 获取运行状态 */
    getStatus() {
        return {
            running: this.isRunning,
            pid: this.childProcess?.pid
        };
    }
    /** 启动核心引擎进程 */
    async start(onLog) {
        if (this.isRunning) {
            onLog('⚠️ 核心引擎已在运行中，无需重复启动。');
            return true;
        }
        try {
            onLog('\n🚀 正在拉起核心引擎守护进程...');
            // 假设基于 Node 的引擎入口通常为 npm start，且防乱码使用 chcp
            const isWin = os.platform() === 'win32';
            const cmd = isWin ? 'npm.cmd' : 'npm';
            this.childProcess = (0, child_process_1.spawn)(cmd, ['start'], {
                cwd: this.installDir,
                env: { ...process.env, FORCE_COLOR: '1' }
            });
            this.isRunning = true;
            onLog(`> 核心引擎已启动 (PID: ${this.childProcess.pid})`);
            this.childProcess.stdout?.on('data', (data) => {
                onLog(data.toString());
            });
            this.childProcess.stderr?.on('data', (data) => {
                onLog(`[ERROR] ${data.toString()}`);
            });
            this.childProcess.on('close', (code) => {
                this.isRunning = false;
                this.childProcess = null;
                onLog(`\n🛑 核心引擎进程已退出 (退出码: ${code})`);
            });
            return true;
        }
        catch (e) {
            onLog(`\n🚨 启动核心引擎失败: ${e.message}`);
            this.isRunning = false;
            return false;
        }
    }
    /** 停止进程 */
    stop(onLog) {
        if (!this.isRunning || !this.childProcess) {
            onLog('⚠️ 当前没有运行的核心引擎进程。');
            return false;
        }
        onLog('\n🛑 正在向核心引擎发送终止信号 (SIGTERM)...');
        try {
            if (os.platform() === 'win32') {
                // Windows 下使用 taskkill 强制结束进程树
                (0, child_process_2.execSync)(`taskkill /pid ${this.childProcess.pid} /T /F`);
            }
            else {
                this.childProcess.kill('SIGTERM');
            }
        }
        catch (e) {
            this.childProcess.kill('SIGKILL');
        }
        this.isRunning = false;
        this.childProcess = null;
        onLog('> 核心引擎已停止。');
        return true;
    }
}
exports.OpenClawDaemon = OpenClawDaemon;
// Windows 下所需的同步调用
const child_process_2 = require("child_process");
exports.openClawDaemon = new OpenClawDaemon();
