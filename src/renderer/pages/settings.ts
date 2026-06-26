/**
 * 设置页面 - 通用偏好
 * 模型配置已合并至模型市场
 */

import { api } from '../utils.js';

let settings = {};
let globalConfig: any = {};

export async function render(container) {
  try {
    settings = (await api.get("/api/settings")) || {};
  } catch(e) {
    settings = {};
  }
  
  try {
    const res = await fetch('/api/system/global-config');
    if (res.ok) {
      globalConfig = await res.json();
    }
  } catch(e) {
    console.error('Failed to load global config', e);
  }
  
  container.className = 'page-layout-full';

  container.innerHTML = `
    <div class="page-header">
      <h2 style="margin: 0; font-size: 24px; font-weight: 600;">⚙️ 通用设置</h2>
    </div>
    
    <div class="page-content" style="padding-top: 24px; flex: 1; overflow-y: auto; overflow-x: hidden;">
      <div style="max-width: 640px; display: flex; flex-direction: column; gap: 24px;">

        <!-- 存储与路径设置 -->
        <div class="card" style="padding: 24px;">
           <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">📁 存储与路径设置</h3>
           <div style="display: flex; flex-direction: column; gap: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 15px;">用户数据存放地址</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; word-break: break-all;">当前: ${globalConfig.customDataDir || '默认'}</div>
                </div>
                <button class="btn btn-secondary" id="changeDataDirBtn" style="border-radius: 8px;">更改目录</button>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 15px;">软件下载与沙盒运行地址</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; word-break: break-all;">当前: ${globalConfig.customDownloadDir || '默认'}</div>
                </div>
                <button class="btn btn-secondary" id="changeDownloadDirBtn" style="border-radius: 8px;">更改目录</button>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="flex: 1;">
                  <div style="font-weight: 500; font-size: 15px;">日志文件保存地址</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px; word-break: break-all;">当前: ${globalConfig.customLogDir || '默认'}</div>
                </div>
                <button class="btn btn-secondary" id="changeLogDirBtn" style="border-radius: 8px;">更改目录</button>
              </div>
              <div style="font-size: 12px; color: var(--warning); background: rgba(255,165,0,0.1); padding: 12px; border-radius: 8px;">
                ⚠️ 提示：更改用户数据地址后，原有的聊天记录不会自动迁移。重启软件后生效。
              </div>
           </div>
        </div>

        <!-- 快捷入口 -->
        <div class="card" style="padding: 24px;">
           <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">🎨 外观</h3>
           <div style="display: flex; flex-direction: column; gap: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 500; font-size: 15px;">系统主题</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">选择你偏好的外观模式</div>
                </div>
                <select class="input" id="themeSelect" style="width: 180px;">
                   <option value="system">跟随系统</option>
                   <option value="light">浅色模式</option>
                   <option value="dark">深色模式</option>
                </select>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 500; font-size: 15px;">字体大小</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">聊天消息的默认字体大小</div>
                </div>
                <select class="input" id="fontSizeSelect" style="width: 180px;">
                   <option value="14">14px (小)</option>
                   <option value="15" selected>15px (默认)</option>
                   <option value="16">16px (大)</option>
                   <option value="18">18px (特大)</option>
                </select>
              </div>
           </div>
        </div>

        <!-- 行为设置 -->
        <div class="card" style="padding: 24px;">
           <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">⚡ 行为</h3>
           <div style="display: flex; flex-direction: column; gap: 20px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 500; font-size: 15px;">开机自启</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">在系统启动时自动运行 OpenClaw</div>
                </div>
                <label style="position: relative; display: inline-block; width: 48px; height: 28px;">
                  <input type="checkbox" id="autoStartToggle" style="opacity: 0; width: 0; height: 0;">
                  <span style="position: absolute; cursor: pointer; inset: 0; background: var(--bg-active); border-radius: 14px; transition: 0.3s;"></span>
                </label>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 500; font-size: 15px;">发送方式</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">回车键的行为</div>
                </div>
                <select class="input" id="sendModeSelect" style="width: 180px;">
                   <option value="enter">Enter 发送</option>
                   <option value="ctrl-enter">Ctrl+Enter 发送</option>
                </select>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="font-weight: 500; font-size: 15px;">流式输出</div>
                  <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">AI 回复是否逐字打出</div>
                </div>
                <label style="position: relative; display: inline-block; width: 48px; height: 28px;">
                  <input type="checkbox" id="streamToggle" checked style="opacity: 0; width: 0; height: 0;">
                  <span style="position: absolute; cursor: pointer; inset: 0; background: var(--primary); border-radius: 14px; transition: 0.3s;"></span>
                </label>
              </div>
           </div>
        </div>

        <!-- 快捷入口 -->
        <div class="card" style="padding: 24px;">
           <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">🔗 快捷入口</h3>
           <div style="display: flex; gap: 12px; flex-wrap: wrap;">
             <button class="btn btn-secondary" onclick="window.location.hash='#/market'" style="border-radius: 12px;">🛒 模型配置中心</button>
             <button class="btn btn-secondary" onclick="window.location.hash='#/experts'" style="border-radius: 12px;">👨‍🏫 专家角色中心</button>
             <button class="btn btn-secondary" onclick="window.location.hash='#/memory'" style="border-radius: 12px;">🧠 记忆管理</button>
           </div>
        </div>

        <!-- 数据管理 -->
        <div class="card" style="padding: 24px;">
           <h3 style="margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">🗄️ 数据管理</h3>
           <div style="display: flex; flex-direction: column; gap: 16px;">
              <button class="btn btn-secondary" style="width: 100%; border-radius: 12px; justify-content: flex-start;">📤 导出所有会话记录</button>
              <button class="btn" style="width: 100%; border-radius: 12px; justify-content: flex-start; color: var(--danger); border: 1px solid var(--danger); background: transparent;">🗑️ 清空所有数据（不可恢复）</button>
           </div>
        </div>

        <!-- 关于 -->
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px;">
          OpenClaw Assistant v1.0.0 &middot; Made with ❤️
        </div>
      </div>
    </div>
  `;

  // 绑定事件
  const changeDataDirBtn = (document.getElementById('changeDataDirBtn') as any);
  const changeDownloadDirBtn = (document.getElementById('changeDownloadDirBtn') as any);
  const changeLogDirBtn = (document.getElementById('changeLogDirBtn') as any);

  if (changeDataDirBtn) {
    changeDataDirBtn.addEventListener('click', async () => {
      try {
        const result = await window.openClaw.system.selectDirectory();
        if (result && !result.canceled && result.filePaths.length > 0) {
          const newPath = result.filePaths[0];
          const confirmRes = confirm(`确定要将数据存放地址更改为：\n${newPath}\n\n更改后需要重启应用才能生效！`);
          if (confirmRes) {
            await fetch('/api/system/global-config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ customDataDir: newPath })
            });
            if (window.__toast) window.__toast.success('配置已保存，应用即将重启...');
            setTimeout(async () => {
              if (window.openClaw && window.openClaw.system && window.openClaw.system.restart) {
                await window.openClaw.system.restart();
              } else {
                window.location.reload();
              }
            }, 1500);
          }
        }
      } catch (e) {
        console.error('Failed to change data dir', e);
      }
    });
  }

  if (changeDownloadDirBtn) {
    changeDownloadDirBtn.addEventListener('click', async () => {
      try {
        const result = await window.openClaw.system.selectDirectory();
        if (result && !result.canceled && result.filePaths.length > 0) {
          const newPath = result.filePaths[0];
          await fetch('/api/system/global-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customDownloadDir: newPath })
          });
          if (window.__toast) window.__toast.success('配置已保存，应用即将重启生效...');
          setTimeout(async () => {
            if (window.openClaw && window.openClaw.system && window.openClaw.system.restart) {
              await window.openClaw.system.restart();
            } else {
              window.location.reload();
            }
          }, 1500);
        }
      } catch (e) {
        console.error('Failed to change download dir', e);
      }
    });
  }

  if (changeLogDirBtn) {
    changeLogDirBtn.addEventListener('click', async () => {
      try {
        const result = await window.openClaw.system.selectDirectory();
        if (result && !result.canceled && result.filePaths.length > 0) {
          const newPath = result.filePaths[0];
          await fetch('/api/system/global-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customLogDir: newPath })
          });
          if (window.__toast) window.__toast.success('配置已保存，应用即将重启生效...');
          setTimeout(async () => {
            if (window.openClaw && window.openClaw.system && window.openClaw.system.restart) {
              await window.openClaw.system.restart();
            } else {
              window.location.reload();
            }
          }, 1500);
        }
      } catch (e) {
        console.error('Failed to change log dir', e);
      }
    });
  }
}
