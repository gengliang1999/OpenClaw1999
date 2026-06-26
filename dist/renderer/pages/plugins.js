// @ts-nocheck
import { api } from '../utils.js';
/**
 * 插件管理页面
 * 查看已安装的插件和插件市场
 */
let installedPlugins = [];
let marketPlugins = [];
export async function render(container) {
    container.innerHTML = `
    <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
        <div>
          <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">🧩 插件管理</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 15px;">通过安装插件，让助手能够访问互联网、操作本地文件、执行代码等。</p>
        </div>
        <div style="display: flex; gap: 8px; background: var(--bg-card); padding: 4px; border-radius: 12px; border: 1px solid var(--border-light);">
          <button id="tabInstalled" class="btn active" style="padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary, #007aff); color: white; cursor: pointer; font-weight: 500;">已安装</button>
          <button id="tabMarket" class="btn" style="padding: 8px 16px; border-radius: 8px; border: none; background: transparent; color: var(--text-primary); cursor: pointer; font-weight: 500;">插件市场</button>
        </div>
      </div>

      <div id="pluginContent">
        <!-- List renders here -->
      </div>
    </div>
  `;
    document.getElementById('tabInstalled').addEventListener('click', (e) => {
        switchTab('installed', e.target);
    });
    document.getElementById('tabMarket').addEventListener('click', (e) => {
        switchTab('market', e.target);
    });
    await loadData();
    renderList('installed');
}
async function loadData() {
    try {
        installedPlugins = await api.plugin.getPlugins() || [];
        const res = await api.plugin.getMarketplace();
        marketPlugins = (res && res.items) ? res.items : [
            { id: 'web-search', name: 'Web Search', description: '允许助手搜索互联网信息', version: '1.0.0', author: 'OpenClaw' },
            { id: 'local-fs', name: 'Local FileSystem', description: '允许助手读写本地文件', version: '1.1.0', author: 'OpenClaw' },
            { id: 'code-runner', name: 'Code Runner', description: '在沙盒中安全执行 Python/Node 代码', version: '2.0.0', author: 'OpenClaw' }
        ]; // mock fallback
    }
    catch (e) {
        console.error('Failed to load plugins:', e);
    }
}
function switchTab(tab, btnElement) {
    document.querySelectorAll('#tabInstalled, #tabMarket').forEach(b => {
        b.style.background = 'transparent';
        b.style.color = 'var(--text-primary)';
    });
    btnElement.style.background = 'var(--primary, #007aff)';
    btnElement.style.color = 'white';
    renderList(tab);
}
function renderList(tab) {
    const container = document.getElementById('pluginContent');
    let list = tab === 'installed' ? installedPlugins : marketPlugins;
    if (!list || list.length === 0) {
        container.innerHTML = `
      <div style="text-align: center; padding: 80px 0; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">📦</div>
        <div style="font-size: 16px;">${tab === 'installed' ? '您还没有安装任何插件' : '市场里暂时没有可用插件'}</div>
      </div>
    `;
        return;
    }
    container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">
      ${list.map(p => {
        const isInstalled = installedPlugins.some(ip => ip.id === p.id);
        return `
          <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 24px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
            <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(0, 122, 255, 0.1); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                ${p.icon || '🧩'}
              </div>
              <div style="flex: 1;">
                <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">${escapeHtml(p.name)}</h3>
                <div style="font-size: 12px; color: var(--text-muted);">v${escapeHtml(p.version || '1.0.0')} · ${escapeHtml(p.author || 'Unknown')}</div>
              </div>
            </div>
            <p style="margin: 0 0 24px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5; flex: 1;">
              ${escapeHtml(p.description)}
            </p>
            <div style="display: flex; gap: 12px; margin-top: auto;">
              ${isInstalled && tab === 'installed'
            ? `<button class="btn btn-danger" onclick="window._uninstallPlugin('${p.id}')" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #ff3b30; background: transparent; color: #ff3b30; cursor: pointer; font-weight: 500;">卸载</button>`
            : `<button class="btn btn-primary" onclick="window._installPlugin('${p.id}')" ${isInstalled ? 'disabled' : ''} style="flex: 1; padding: 10px; border-radius: 8px; border: none; background: ${isInstalled ? '#444' : '#007aff'}; color: ${isInstalled ? '#888' : '#fff'}; cursor: ${isInstalled ? 'not-allowed' : 'pointer'}; font-weight: 500;">${isInstalled ? '已安装' : '安装'}</button>`}
            </div>
          </div>
        `;
    }).join('')}
    </div>
  `;
}
window._installPlugin = async (id) => {
    try {
        if (window.__toast)
            window.__toast.info('正在安装...');
        await api.plugin.installPlugin(id);
        if (window.__toast)
            window.__toast.success('安装成功');
        await loadData();
        renderList('market');
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('安装失败: ' + e.message);
    }
};
window._uninstallPlugin = async (id) => {
    try {
        await api.plugin.removePlugin(id);
        if (window.__toast)
            window.__toast.success('已卸载');
        await loadData();
        renderList('installed');
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('卸载失败: ' + e.message);
    }
};
function escapeHtml(unsafe) {
    if (!unsafe)
        return '';
    return String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
