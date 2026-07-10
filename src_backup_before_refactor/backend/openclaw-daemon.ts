import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as os from 'os';

import * as fs from 'fs';

export class OpenClawDaemon {
  private childProcess: ChildProcess | null = null;
  private installDir: string;
  private isRunning: boolean = false;

  constructor() {
    this.installDir = path.join(os.homedir(), '.openclaw', 'core-engine');
    this._loadCustomPath();
  }

  private _loadCustomPath() {
    try {
      const configPath = path.join(os.homedir(), '.openclaw', 'custom-path.json');
      if (fs.existsSync(configPath)) {
        const data = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        if (data.installDir) {
          this.installDir = data.installDir;
        }
      }
    } catch (e) {}
  }

  /** 同步修改当前守护进程的目录指针 */
  public setInstallDir(newPath: string) {
    this.installDir = newPath;
  }

  /** 获取运行状态 */
  public getStatus(): { running: boolean; pid?: number } {
    return {
      running: this.isRunning,
      pid: this.childProcess?.pid
    };
  }

  /** 启动核心引擎进程 */
  public async start(onLog: (msg: string) => void): Promise<boolean> {
    if (this.isRunning) {
      onLog('⚠️ 核心引擎已在运行中，无需重复启动。');
      return true;
    }

    try {
      onLog('\n🚀 正在拉起核心引擎守护进程...');
      // 假设基于 Node 的引擎入口通常为 npm start，且防乱码使用 chcp
      const isWin = os.platform() === 'win32';
      const cmd = isWin ? 'npm.cmd' : 'npm';

      this.childProcess = spawn(cmd, ['start'], {
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
    } catch (e: any) {
      onLog(`\n🚨 启动核心引擎失败: ${e.message}`);
      this.isRunning = false;
      return false;
    }
  }

  /** 停止进程 */
  public stop(onLog: (msg: string) => void): boolean {
    if (!this.isRunning || !this.childProcess) {
      onLog('⚠️ 当前没有运行的核心引擎进程。');
      return false;
    }

    onLog('\n🛑 正在向核心引擎发送终止信号 (SIGTERM)...');
    try {
      if (os.platform() === 'win32') {
        // Windows 下使用 taskkill 强制结束进程树
        execSync(`taskkill /pid ${this.childProcess.pid} /T /F`);
      } else {
        this.childProcess.kill('SIGTERM');
      }
    } catch (e) {
      this.childProcess.kill('SIGKILL');
    }

    this.isRunning = false;
    this.childProcess = null;
    onLog('> 核心引擎已停止。');
    return true;
  }
}

// Windows 下所需的同步调用
import { execSync } from 'child_process';

export const openClawDaemon = new OpenClawDaemon();
