import { exec, spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

export class OpenClawInstaller {
  private installDir: string;
  private repoUrl: string = 'https://kgithub.com/gengliang1999/OpenClaw1999.git'; // 国内加速源占位
  private isProcessing: boolean = false;

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

  /** 手动绑定自定义安装目录 */
  public setCustomDir(newPath: string) {
    this.installDir = newPath;
    try {
      const dir = path.join(os.homedir(), '.openclaw');
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'custom-path.json'), JSON.stringify({ installDir: newPath }));
    } catch (e) {}
  }

  /** 获取核心引擎的安装目录 */
  public getInstallDir(): string {
    return this.installDir;
  }

  /** 获取安装状态 */
  public getStatus(): { installed: boolean; path: string; processing: boolean } {
    return {
      installed: fs.existsSync(path.join(this.installDir, 'package.json')),
      path: this.installDir,
      processing: this.isProcessing
    };
  }

  /** 执行命令并向外部流式输出日志 */
  private async execCommand(command: string, cwd: string, onLog: (msg: string) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      onLog(`\n> 执行指令: ${command}`);
      const child = exec(command, { cwd, maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer

      child.stdout?.on('data', (data) => {
        onLog(data.toString());
      });

      child.stderr?.on('data', (data) => {
        onLog(`[WARN] ${data.toString()}`);
      });

      child.on('close', (code) => {
        if (code === 0) {
          onLog(`> ✅ 指令执行成功`);
          resolve();
        } else {
          onLog(`> ❌ 指令执行失败，退出码: ${code}`);
          reject(new Error(`Command failed with code ${code}`));
        }
      });
    });
  }

  /** 检查基础环境 (Git, Node) */
  public async checkEnvironment(onLog: (msg: string) => void): Promise<boolean> {
    try {
      onLog('正在检查 Git 环境...');
      await this.execCommand('git --version', os.homedir(), onLog);
      onLog('正在检查 Node.js 环境...');
      await this.execCommand('node --version', os.homedir(), onLog);
      onLog('正在检查 NPM 环境...');
      await this.execCommand('npm --version', os.homedir(), onLog);
      return true;
    } catch (e: any) {
      onLog(`\n❌ 环境检查不通过！请确保您的电脑已安装 Git 和 Node.js。`);
      return false;
    }
  }

  /** 一键安装 / 修复 */
  public async install(onLog: (msg: string) => void): Promise<boolean> {
    if (this.isProcessing) {
      onLog('❌ 当前有其他任务正在执行中，请勿重复操作。');
      return false;
    }
    this.isProcessing = true;

    try {
      const envOk = await this.checkEnvironment(onLog);
      if (!envOk) throw new Error('Environment check failed');

      if (!fs.existsSync(this.installDir)) {
        onLog(`\n--- 步骤 1: 开始克隆核心引擎 ---`);
        fs.mkdirSync(path.dirname(this.installDir), { recursive: true });
        // 为了防止克隆卡死，使用 depth 1 浅克隆加速
        await this.execCommand(`git clone --depth 1 ${this.repoUrl} core-engine`, path.dirname(this.installDir), onLog);
      } else {
        onLog(`\n--- 步骤 1: 发现已存在目录，尝试更新代码 ---`);
        await this.execCommand('git pull', this.installDir, onLog);
      }

      onLog(`\n--- 步骤 2: 安装依赖 (使用国内淘宝镜像源加速) ---`);
      await this.execCommand('npm install --registry=https://registry.npmmirror.com', this.installDir, onLog);

      onLog(`\n🎉 安装/修复 流程全部完成！OpenClaw 核心引擎已就绪。`);
      this.isProcessing = false;
      return true;
    } catch (e: any) {
      onLog(`\n🚨 安装过程中发生错误: ${e.message}`);
      this.isProcessing = false;
      return false;
    }
  }

  /** 一键更新 */
  public async update(onLog: (msg: string) => void): Promise<boolean> {
    if (this.isProcessing) return false;
    this.isProcessing = true;
    try {
      if (!fs.existsSync(this.installDir)) {
        throw new Error('目录不存在，请先执行安装！');
      }
      onLog(`\n--- 开始拉取最新更新 ---`);
      await this.execCommand('git pull', this.installDir, onLog);
      onLog(`\n--- 同步最新依赖 ---`);
      await this.execCommand('npm install --registry=https://registry.npmmirror.com', this.installDir, onLog);
      onLog(`\n🎉 更新成功！请重启引擎。`);
      this.isProcessing = false;
      return true;
    } catch (e: any) {
      onLog(`\n🚨 更新失败: ${e.message}`);
      this.isProcessing = false;
      return false;
    }
  }

  /** 一键卸载 */
  public async uninstall(onLog: (msg: string) => void): Promise<boolean> {
    if (this.isProcessing) return false;
    this.isProcessing = true;
    try {
      onLog(`\n--- 正在无痕清理核心引擎及所有依赖 ---`);
      if (fs.existsSync(this.installDir)) {
         fs.rmSync(this.installDir, { recursive: true, force: true });
      }
      onLog(`\n🗑️ 卸载完成！核心目录已抹除。`);
      this.isProcessing = false;
      return true;
    } catch (e: any) {
      onLog(`\n🚨 卸载时发生错误: ${e.message}`);
      this.isProcessing = false;
      return false;
    }
  }
}

// 导出单例
export const openClawInstaller = new OpenClawInstaller();
