"use strict";
// @ts-nocheck
/**
 * OpenClaw 智能助手 - 本地自动化控制
 * 通过 PowerShell 实现键盘、鼠标、窗口管理等桌面自动化能力。
 *
 * 安全约束（P0/T4）：所有用户可控输入一律经参数化/转义处理，杜绝命令注入：
 *   - 文本类（typeText/sendKeys）：Base64 编码后在 PS 侧解码，绝不将明文字面量拼入脚本；
 *   - 路径类（openFile/launchApp/listDirectory/captureScreen/focusWindow）：使用 Start-Process -LiteralPath
 *     或单引号包裹的转义路径，不交给 shell 解释；
 *   - 数值类（moveMouse/clickMouse）：经 Number() 校验，拒绝非数值注入。
 *
 * 自动化默认关闭，需前端显式开启（RCE 风险提示由 UI 负责）。
 */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
/**
 * 转义 PowerShell 路径参数：用单引号包裹，内部单引号以 '' 转义。
 * 用于 -LiteralPath / 路径字面量，确保路径被当作单一字面量而非命令序列。
 */
function escapePowerShellPath(p) {
    const s = String(p == null ? '' : p);
    return `'${s.replace(/'/g, "''")}'`;
}
/**
 * 数值参数校验：拒绝非有限数值。
 * @returns {number} 解析后的数值
 * @throws {Error} 非法数值
 */
function requireNumber(value, name) {
    const n = Number(value);
    if (!Number.isFinite(n)) {
        throw new Error(`参数 ${name} 必须为数值，收到: ${value}`);
    }
    return n;
}
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
     * 模拟键盘输入文本（Base64 编码，PS 侧解码，不拼入脚本字面量）
     * @param {string} text - 要输入的文本
     */
    async typeText(text) {
        const encoded = Buffer.from(String(text == null ? '' : text), 'utf16le').toString('base64');
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $t = [System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('${encoded}'))
      [System.Windows.Forms.SendKeys]::SendWait($t)`;
        return this._execPS(script);
    }
    /**
     * 模拟按键组合（Base64 编码，PS 侧解码）
     * @param {string} keys - 按键（如 '{ENTER}', '^c'）
     */
    async sendKeys(keys) {
        const encoded = Buffer.from(String(keys == null ? '' : keys), 'utf16le').toString('base64');
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $t = [System.Text.Encoding]::Unicode.GetString([System.Convert]::FromBase64String('${encoded}'))
      [System.Windows.Forms.SendKeys]::SendWait($t)`;
        return this._execPS(script);
    }
    // ===== 鼠标控制 =====
    /**
     * 移动鼠标到指定位置（数值参数校验）
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     */
    async moveMouse(x, y) {
        const nx = requireNumber(x, 'x');
        const ny = requireNumber(y, 'y');
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${nx}, ${ny})`;
        return this._execPS(script);
    }
    /**
     * 鼠标点击（数值参数校验）
     * @param {number} x - X 坐标
     * @param {number} y - Y 坐标
     * @param {'left'|'right'} button - 鼠标按键
     */
    async clickMouse(x, y, button = 'left') {
        const nx = requireNumber(x, 'x');
        const ny = requireNumber(y, 'y');
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
      [MouseOps]::SetCursorPos(${nx}, ${ny})
      Start-Sleep -Milliseconds 50
      [MouseOps]::mouse_event(${buttonCode}, 0, 0, 0, 0)
      [MouseOps]::mouse_event(${buttonUp}, 0, 0, 0, 0)
    `;
        return this._execPS(script);
    }
    // ===== 窗口管理 =====
    /**
     * 获取所有可见窗口列表
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
     * 切换到指定窗口（标题经转义，防注入）
     * @param {string} title - 窗口标题（部分匹配）
     */
    async focusWindow(title) {
        const escaped = escapePowerShellPath(title);
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
      $proc = Get-Process | Where-Object {$_.MainWindowTitle -like ${escaped}} | Select-Object -First 1
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
     * 截取全屏并保存到文件（路径经转义）
     * @param {string} savePath - 保存路径（可选）
     * @returns {string} 截图文件路径
     */
    async captureScreen(savePath) {
        const outputPath = savePath || path.join(this.sandbox?.dataDir || '.', `screenshot-${Date.now()}.png`);
        const escaped = escapePowerShellPath(outputPath);
        const script = `
      Add-Type -AssemblyName System.Windows.Forms
      Add-Type -AssemblyName System.Drawing
      $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      $bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
      $g = [System.Drawing.Graphics]::FromImage($bmp)
      $g.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
      $bmp.Save(${escaped})
      $g.Dispose()
      $bmp.Dispose()
      Write-Output ${escaped}
    `;
        await this._execPS(script);
        return outputPath;
    }
    // ===== 文件系统操作 =====
    /**
     * 列出目录内容（路径经转义）
     * @param {string} dirPath - 目录路径
     */
    async listDirectory(dirPath) {
        const escaped = escapePowerShellPath(dirPath);
        const script = `
      Get-ChildItem -Path ${escaped} |
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
     * 打开文件或目录（Start-Process -LiteralPath，路径作字面量处理）
     * @param {string} filePath - 文件路径
     */
    async openFile(filePath) {
        const escaped = escapePowerShellPath(filePath);
        const script = `Start-Process -LiteralPath ${escaped}`;
        return this._execPS(script);
    }
    /**
     * 打开应用程序（Start-Process -LiteralPath，路径作字面量处理）
     * @param {string} appName - 应用程序名或路径
     */
    async launchApp(appName) {
        const escaped = escapePowerShellPath(appName);
        const script = `Start-Process -LiteralPath ${escaped}`;
        return this._execPS(script);
    }
}
module.exports = { AutomationController };
