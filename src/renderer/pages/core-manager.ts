// @ts-nocheck
/**
 * 引擎内核管控台 (App In App Installer)
 * 允许用户一键拉取、安装并管理原版 OpenClaw 核心套件
 */

import { api, escapeHtml } from '../utils.js';

let logContainer: HTMLElement;
let statusDot: HTMLElement;
let statusText: HTMLElement;

export async function render(container) {
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 40px; display: flex; flex-direction: column; height: 100%;">
      
      <!-- 头部介绍 -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; flex-shrink: 0; animation: fadeInDown 0.5s ease;">
        <div>
          <h2 style="font-size: 32px; font-weight: 800; margin: 0 0 8px 0; background: linear-gradient(90deg, #00d2ff, #3a7bd5); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">⚡ 内核引擎管控台</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 15px;">通过一键安装，将 OpenClaw 完整原生内核与多平台接口嵌套注入当前客户端。完全自动化，适合中国宝宝体质。</p>
        </div>
        <div style="display: flex; gap: 12px; align-items: center; background: var(--bg-panel); padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-light);">
          <div id="cm-status-dot" style="width: 12px; height: 12px; border-radius: 50%; background: var(--text-muted); box-shadow: 0 0 10px rgba(0,0,0,0.1);"></div>
          <span id="cm-status-text" style="font-weight: bold; color: var(--text-primary); font-size: 14px;">状态检索中...</span>
        </div>
      </div>
      
      <!-- 当前挂载路径 -->
      <div style="margin-bottom: 24px; font-size: 13px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.2); padding: 12px 16px; border-radius: 8px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>📂 当前挂载路径:</span>
          <span id="cm-current-path" style="font-family: monospace; color: var(--primary);">/加载中...</span>
        </div>
        <button id="btn-bind" style="background: transparent; border: 1px solid var(--primary); color: var(--primary); padding: 4px 12px; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
          🔗 绑定本地已有内核
        </button>
      </div>

      <!-- 控制面板 (4大按钮) -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 32px; flex-shrink: 0;">
        <button id="btn-install" class="btn btn-primary" style="height: 60px; font-size: 16px; border-radius: 16px; background: linear-gradient(135deg, #11998e, #38ef7d); border: none;">
          ⬇️ 一键克隆与部署
        </button>
        <button id="btn-update" class="btn btn-primary" style="height: 60px; font-size: 16px; border-radius: 16px; background: linear-gradient(135deg, #2193b0, #6dd5ed); border: none;">
          🔄 强制同步最新版
        </button>
        <button id="btn-start" class="btn btn-primary" style="height: 60px; font-size: 16px; border-radius: 16px; background: linear-gradient(135deg, #f12711, #f5af19); border: none;">
          🚀 拉起引擎守护进程
        </button>
        <button id="btn-stop" class="btn btn-default" style="height: 60px; font-size: 16px; border-radius: 16px;">
          🛑 紧急制动 / 停止
        </button>
      </div>

      <!-- 实时执行日志黑窗口 -->
      <div style="flex: 1; background: #0d1117; border-radius: 16px; border: 1px solid #30363d; overflow: hidden; display: flex; flex-direction: column; box-shadow: inset 0 0 20px rgba(0,0,0,0.5);">
        <div style="padding: 12px 20px; background: #161b22; border-bottom: 1px solid #30363d; display: flex; justify-content: space-between; align-items: center;">
          <span style="color: #8b949e; font-family: monospace; font-size: 13px;">> 终端执行流水线 (Terminal Output)</span>
          <button id="btn-clear-log" style="background: none; border: none; color: #8b949e; cursor: pointer; font-size: 13px;">[ 清空日志 ]</button>
        </div>
        <div id="cm-log-container" style="flex: 1; padding: 20px; overflow-y: auto; color: #58a6ff; font-family: 'Consolas', 'Courier New', monospace; font-size: 13px; line-height: 1.6; white-space: pre-wrap;"></div>
      </div>
      
      <!-- 危险操作区 -->
      <div style="margin-top: 20px; display: flex; justify-content: flex-end;">
        <button id="btn-uninstall" style="background: transparent; border: 1px solid #ff4d4f; color: #ff4d4f; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all 0.2s;">
          ⚠️ 无痕抹除一切引擎数据
        </button>
      </div>

    </div>
  `;

  logContainer = document.getElementById('cm-log-container') as HTMLElement;
  statusDot = document.getElementById('cm-status-dot') as HTMLElement;
  statusText = document.getElementById('cm-status-text') as HTMLElement;

  // 绑定按钮事件
  document.getElementById('btn-install')?.addEventListener('click', () => sendAction('install'));
  document.getElementById('btn-update')?.addEventListener('click', () => sendAction('update'));
  document.getElementById('btn-start')?.addEventListener('click', () => sendAction('start'));
  document.getElementById('btn-stop')?.addEventListener('click', () => sendAction('stop'));
  document.getElementById('btn-clear-log')?.addEventListener('click', () => { logContainer.innerHTML = ''; });
  
  document.getElementById('btn-uninstall')?.addEventListener('click', () => {
    if (confirm('警告：此操作将彻底删除本地已安装的 OpenClaw 内核引擎及所有依赖！是否继续？')) {
      sendAction('uninstall');
    }
  });

  document.getElementById('btn-bind')?.addEventListener('click', async () => {
    try {
      if (!window.openClaw?.system?.selectDirectory) return;
      const result = await window.openClaw.system.selectDirectory();
      if (!result) return;
      
      appendLog(`\n[Client] 正在申请重定向挂载目录至 -> ${result}`);
      const res = await api.post('/core-manager/bind-path', { targetPath: result });
      if (res && res.message) {
        if (window.__toast) window.__toast.success(res.message);
        appendLog(`> ✅ 挂载成功！`);
        fetchStatus();
      }
    } catch (e: any) {
      appendLog(`[Client Error] 挂载失败: ${e.message}`);
      if (window.__toast) window.__toast.error(e.message);
    }
  });

  // 挂载日志监听器
  if (window.openClaw && window.openClaw.onCoreManagerLog) {
    window.openClaw.onCoreManagerLog((msg: string) => {
      appendLog(msg);
    });
  }

  // 初始获取并定期轮询状态
  fetchStatus();
  const statusTimer = setInterval(fetchStatus, 3000);

  // 清理函数（切换页面时触发）
  container._destroy = () => {
    clearInterval(statusTimer);
    if (window.openClaw && window.openClaw.offCoreManagerLog) {
      window.openClaw.offCoreManagerLog();
    }
  };
}

/** 获取状态并刷新 UI */
async function fetchStatus() {
  try {
    const res = await api.get('/core-manager/status');
    const { installStatus, daemonStatus, currentDir } = res as any;

    const pathEl = document.getElementById('cm-current-path');
    if (pathEl && currentDir) {
      pathEl.textContent = currentDir;
    }

    if (daemonStatus.running) {
      statusDot.style.background = '#38ef7d';
      statusDot.style.boxShadow = '0 0 12px #38ef7d';
      statusText.textContent = '引擎运行中 (PID: ' + daemonStatus.pid + ')';
    } else if (installStatus.processing) {
      statusDot.style.background = '#f5af19';
      statusDot.style.boxShadow = '0 0 12px #f5af19';
      statusText.textContent = '管道流水线作业中...';
    } else if (installStatus.installed) {
      statusDot.style.background = '#2193b0';
      statusDot.style.boxShadow = '0 0 12px #2193b0';
      statusText.textContent = '引擎就绪 (休眠)';
    } else {
      statusDot.style.background = '#ff4d4f';
      statusDot.style.boxShadow = '0 0 12px #ff4d4f';
      statusText.textContent = '核心未就绪';
    }
  } catch (e) {
    console.error('获取引擎状态失败', e);
  }
}

/** 发送控制指令 */
async function sendAction(action: string) {
  try {
    appendLog(`\n[Client] 发送指令 -> ${action}...`);
    const res = await api.get(`/core-manager/action/${action}`);
    if (res && res.message) {
      if (window.__toast) window.__toast.info(res.message);
    }
    setTimeout(fetchStatus, 500);
  } catch (e: any) {
    appendLog(`[Client Error] ${e.message}`);
    if (window.__toast) window.__toast.error(e.message);
  }
}

/** 向终端追加日志并滚动到底部 */
function appendLog(msg: string) {
  if (!logContainer) return;
  const span = document.createElement('span');
  
  // 简单的控制台色彩解析 (红黄绿)
  let color = '#58a6ff';
  if (msg.includes('ERROR') || msg.includes('❌') || msg.includes('🚨')) color = '#ff7b72';
  else if (msg.includes('WARN') || msg.includes('⚠️')) color = '#d2a8ff';
  else if (msg.includes('✅') || msg.includes('🎉') || msg.includes('🚀')) color = '#3fb950';

  span.style.color = color;
  span.textContent = msg;
  logContainer.appendChild(span);
  
  // 自动滚动到底部
  logContainer.scrollTop = logContainer.scrollHeight;
}
