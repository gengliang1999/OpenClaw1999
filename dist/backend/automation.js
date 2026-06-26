"use strict";
// @ts-nocheck
/**
 * OpenClaw 智能助手 - 本地自动化控制
 * 通过 PowerShell 实现键盘、鼠标、窗口管理等桌面自动化能力
 */
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
class AutomationController {
    /**
     * @param {Object} sandbox - 沙盒执行器实例（用于权限控制）
     */
    constructor(sandbox) {
        this.sandbox = sandbox;
        this.enabled = false;
    }
    /**
     * 设置启用状态
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
    /**
     * 检查是否已启用
     * @private
     */
    _checkEnabled() {
        if (!this.enabled) {
            throw new Error('自动化控制未启用，请在设置中开启');
        }
    }
    /**
     * 执行 PowerShell 命令（内部方法）
     * @private
     */
    async _execPS(script) {
        this._checkEnabled();
        return new Promise((resolve, reject) => {
            const proc = spawn('powershell.exe', [
                '-NoProfile', '-NonInteractive', '-Command', script,
            ], { windowsHide: true });
            let stdout = '';
            let stderr = '';
            proc.stdout.on('data', (d) => { stdout += d.toString(); });
            proc.stderr.on('data', (d) => { stderr += d.toString(); });
            proc.on('close', (code) => {
                if (code === 0)
                    resolve(stdout.trim());
                else
                    reject(new Error(stderr || `退出码: ${code}`));
            });
            proc.on('error', reject);
        });
    }
    // ===== 键盘控制 =====
    /**
     * 模拟键盘输入文本
     * @param {string} text - 要输入的文本
     */
    async typeText(text) {
        const escaped = text.replace(/'/g, "''");
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait('${escaped}')
    `;
        return this._execPS(script);
    }
    /**
     * 模拟按键组合
     * @param {string} keys - 按键（如 '{ENTER}', '^c' = Ctrl+C, '%{F4}' = Alt+F4）
     */
    async sendKeys(keys) {
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.SendKeys]::SendWait('${keys}')
    `;
        return this._execPS(script);
    }
    // ===== 鼠标控制 =====
    /**
     * 移动鼠标到指定位置
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     */
    async moveMouse(x, y) {
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
    `;
        return this._execPS(script);
    }
    /**
     * 鼠标点击
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {'left'|'right'} button - 鼠标按键
     */
    async clickMouse(x, y, button = 'left') {
        const buttonCode = button === 'right' ? '0x0008' : '0x0002';
        const buttonUp = button === 'right' ? '0x0010' : '0x0004';
        const script = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class MouseOps {
          [DllImport("user32.dll")]
          public static extern bool SetCursorPos(int x, int y);
          [DllImport("user32.dll")]
          public static extern void mouse_event(int dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
        }
"@
      [MouseOps]::SetCursorPos(${x}, ${y})
      Start-Sleep -Milliseconds 50
      [MouseOps]::mouse_event(${buttonCode}, 0, 0, 0, 0)
      [MouseOps]::mouse_event(${buttonUp}, 0, 0, 0, 0)
    `;
        return this._execPS(script);
    }
    // ===== 窗口管理 =====
    /**
     * 获取所有可见窗口列表
     * @returns {Array<{title: string, processName: string, handle: string}>}
     */
    async getWindows() {
        const script = `
      Get-Process | Where-Object {$_.MainWindowTitle -ne ''} | 
      Select-Object ProcessName, MainWindowTitle, MainWindowHandle | 
      ConvertTo-Json
    `;
        const result = await this._execPS(script);
        try {
            const data = JSON.parse(result);
            const arr = Array.isArray(data) ? data : [data];
            return arr.map(w => ({
                title: w.MainWindowTitle,
                processName: w.ProcessName,
                handle: String(w.MainWindowHandle),
            }));
        }
        catch {
            return [];
        }
    }
    /**
     * 切换到指定窗口（通过标题）
     * @param {string} title - 窗口标题（部分匹配）
     */
    async focusWindow(title) {
        const escaped = title.replace(/'/g, "''");
        const script = `
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class WinOps {
          [DllImport("user32.dll")]
          public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")]
          public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
        }
"@
      $proc = Get-Process | Where-Object {$_.MainWindowTitle -like '*${escaped}*'} | Select-Object -First 1
      if ($proc) {
        [WinOps]::ShowWindow($proc.MainWindowHandle, 9)
        [WinOps]::SetForegroundWindow($proc.MainWindowHandle)
        Write-Output "已切换到窗口: $($proc.MainWindowTitle)"
      } else {
        Write-Error "未找到匹配窗口: ${escaped}"
      }
    `;
        return this._execPS(script);
    }
    // ===== 截屏 =====
    /**
     * 截取全屏并保存到文件
     * @param {string} savePath - 保存路径（可选，默认保存到数据目录）
     * @returns {string} 截图文件路径
     */
    async captureScreen(savePath) {
        const outputPath = savePath || path.join(this.sandbox?.dataDir || '.', `screenshot-${Date.now()}.png`);
        const escaped = outputPath.replace(/\\/g, '\\\\');
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
      $bmp.Save('${escaped}')
      $g.Dispose()
      $bmp.Dispose()
      Write-Output '${escaped}'
    `;
        await this._execPS(script);
        return outputPath;
    }
    // ===== 文件系统操作 =====
    /**
     * 列出目录内容
     * @param {string} dirPath - 目录路径
     * @returns {Array} 文件列表
     */
    async listDirectory(dirPath) {
        const escaped = dirPath.replace(/'/g, "''");
        const script = `
      Get-ChildItem -Path '${escaped}' | 
      Select-Object Name, Length, LastWriteTime, 
        @{Name='IsDirectory';Expression={$_.PSIsContainer}} | 
      ConvertTo-Json
    `;
        const result = await this._execPS(script);
        try {
            const data = JSON.parse(result);
            return Array.isArray(data) ? data : [data];
        }
        catch {
            return [];
        }
    }
    /**
     * 打开文件或目录
     * @param {string} filePath - 文件路径
     */
    async openFile(filePath) {
        const escaped = filePath.replace(/'/g, "''");
        const script = `Start-Process '${escaped}'`;
        return this._execPS(script);
    }
    /**
     * 打开应用程序
     * @param {string} appName - 应用程序名或路径
     */
    async launchApp(appName) {
        const escaped = appName.replace(/'/g, "''");
        const script = `Start-Process '${escaped}'`;
        return this._execPS(script);
    }
}
module.exports = { AutomationController };
