// @ts-nocheck
import { api } from '../utils.js';
/**
 * 技能管理页面 - 进化树节点
 * 采用 Glassmorphism 赛博朋克深色主题
 */
let installedSkills = [];
let marketSkills = [];
export async function render(container) {
    container.innerHTML = `
    <div style="max-width: 1100px; margin: 0 auto; padding: 40px; position: relative;">
      
      <!-- Ambient Background Glow -->
      <div style="position: absolute; top: -50px; right: -50px; width: 400px; height: 400px; background: radial-gradient(circle, rgba(255,149,0,0.15) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; filter: blur(50px); pointer-events: none;"></div>

      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; position: relative; z-index: 1;">
        <div>
          <h2 style="font-size: 36px; font-weight: 800; margin: 0 0 8px 0; background: linear-gradient(135deg, #ff9500, #ffcc00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: gradientPulse 3s ease infinite;">🧬 进化技能树</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 15px; letter-spacing: 0.5px;">系统在沙盒中通过「自反思机制」生成的底层 TS 脚本，将在此处凝结为永久技能。</p>
        </div>
        <div style="display: flex; gap: 8px; background: var(--bg-card); backdrop-filter: blur(12px); padding: 6px; border-radius: 12px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm);">
          <button id="tabSkillInstalled" class="btn active" style="padding: 10px 20px; border-radius: 8px; border: none; background: rgba(255,149,0,0.15); color: #ff9500; cursor: pointer; font-weight: 600; box-shadow: 0 0 10px rgba(255,149,0,0.1); transition: all 0.3s;">已掌握突触</button>
          <button id="tabSkillMarket" class="btn" style="padding: 10px 20px; border-radius: 8px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-weight: 600; transition: all 0.3s;">未解锁技能</button>
          <button id="tabSkillMcp" class="btn" style="padding: 10px 20px; border-radius: 8px; border: none; background: transparent; color: var(--text-secondary); cursor: pointer; font-weight: 600; transition: all 0.3s;">🔌 MCP 插件</button>
        </div>
      </div>

      <div id="skillContent" style="position: relative; z-index: 1;">
        <!-- List renders here -->
      </div>
    </div>
  `;
    document.getElementById('tabSkillInstalled').addEventListener('click', (e) => {
        switchTab('installed', e.target);
    });
    document.getElementById('tabSkillMarket').addEventListener('click', (e) => {
        switchTab('market', e.target);
    });
    document.getElementById('tabSkillMcp').addEventListener('click', (e) => {
        switchTab('mcp', e.target);
    });
    await loadData();
    renderList('installed');
}
async function loadData() {
    try {
        installedSkills = await api.skill.getSkills() || [];
        const res = await api.skill.getMarketplace();
        marketSkills = (res && res.items) ? res.items : [
            { id: 'skill-coder', name: '全栈编程助手', description: '精通多语言编程，自动生成代码和定位 Bug。', author: 'OpenClaw System', icon: '💻', type: 'Core' },
            { id: 'skill-search', name: '深度搜索者', description: '接入搜索引擎，自动抓取多网页信息进行总结。', author: 'OpenClaw System', icon: '🔍', type: 'Core' },
            { id: 'skill-security', name: '网络安全顾问', description: '精通渗透测试与安全加固，分析代码漏洞并提供修复方案。', author: 'Evolution Engine', icon: '🛡️', type: 'Evolution' },
            { id: 'skill-crawler', name: '数据采集专家', description: '精通网页爬虫与数据清洗，快速构建高效稳定的数据采集管道。', author: 'Community', icon: '🕷️', type: 'Community' }
        ];
    }
    catch (e) {
        console.error('Failed to load skills:', e);
    }
}
function switchTab(tab, btnElement) {
    const installedBtn = document.getElementById('tabSkillInstalled');
    const marketBtn = document.getElementById('tabSkillMarket');
    const mcpBtn = document.getElementById('tabSkillMcp');
    [installedBtn, marketBtn, mcpBtn].forEach(b => {
        if (b) {
            b.style.background = 'transparent';
            b.style.color = 'var(--text-secondary)';
            b.style.boxShadow = 'none';
        }
    });
    btnElement.style.background = 'rgba(255,149,0,0.15)';
    btnElement.style.color = '#ff9500';
    btnElement.style.boxShadow = '0 0 10px rgba(255,149,0,0.1)';
    renderList(tab);
}
function renderList(tab) {
    const container = document.getElementById('skillContent');
    if (tab === 'mcp') {
        const mcpServers = [
            { id: 'mcp-filesystem', name: 'FileSystem MCP', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-filesystem', desc: '提供安全的本地文件读写与搜索能力', status: '可连接' },
            { id: 'mcp-postgres', name: 'Postgres DB MCP', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-postgres', desc: '连接关系型数据库并查询 Schema 与 SQL', status: '可连接' },
            { id: 'mcp-github', name: 'GitHub API MCP', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-github', desc: '集成 GitHub Issue、PR 与代码检索', status: '可连接' },
            { id: 'mcp-puppeteer', name: 'Puppeteer Web MCP', type: 'stdio', command: 'npx -y @modelcontextprotocol/server-puppeteer', desc: '自动化无头浏览器渲染与截屏', status: '可连接' }
        ];
        container.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px;">
        ${mcpServers.map(s => `
          <div style="background: var(--bg-card); border-radius: 16px; padding: 24px; border: 1px solid var(--border-light); position: relative;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="margin: 0; font-size: 18px; font-weight: 700;">${s.name}</h3>
              <span style="font-size: 12px; background: rgba(0,122,255,0.1); color: #007aff; padding: 4px 8px; border-radius: 6px; font-weight: 600;">${s.type}</span>
            </div>
            <p style="font-size: 13px; color: var(--text-secondary); margin: 0 0 16px 0; line-height: 1.5;">${s.desc}</p>
            <div style="font-size: 11px; font-family: monospace; background: rgba(0,0,0,0.05); padding: 8px; border-radius: 6px; word-break: break-all; margin-bottom: 16px;">
              ${s.command}
            </div>
            <button class="btn btn-primary" style="width: 100%; border-radius: 8px; font-size: 13px;">挂载 MCP 服务</button>
          </div>
        `).join('')}
      </div>
    `;
        return;
    }
    let list = tab === 'installed' ? installedSkills : marketSkills;
    if (!list || list.length === 0) {
        container.innerHTML = `
      <div style="text-align: center; padding: 100px 0; color: var(--text-muted);">
        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">🪄</div>
        <div style="font-size: 18px; font-weight: 500;">${tab === 'installed' ? '尚未产生自进化节点' : '技能链路池为空'}</div>
        <div style="font-size: 14px; margin-top: 8px;">让 Agent 遇到困难时，它会自动在这里写入新的物理级技能</div>
      </div>
    `;
        return;
    }
    container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px;">
      ${list.map((s, idx) => {
        const isInstalled = installedSkills.some(is => is.id === s.id);
        const isEvolution = s.type === 'Evolution' || (s.author && s.author.includes('Evolution'));
        const mainColor = isEvolution ? '#ff0844' : '#ff9500';
        const bgAccent = isEvolution ? 'rgba(255,8,68,0.1)' : 'rgba(255,149,0,0.1)';
        return `
          <div style="background: var(--bg-card); backdrop-filter: blur(12px); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); box-shadow: var(--shadow-sm); position: relative; overflow: hidden; animation: fadeInUp 0.4s ease forwards; animation-delay: ${idx * 0.05}s; opacity: 0; transform: translateY(10px);" 
               onmouseover="this.style.transform='translateY(-4px) scale(1.02)'; this.style.boxShadow='var(--shadow-md)'; this.style.borderColor='${mainColor}'" 
               onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.boxShadow='var(--shadow-sm)'; this.style.borderColor='var(--border-light)'">
            
            <div style="position: absolute; top: 0; right: 0; padding: 4px 12px; background: ${bgAccent}; color: ${mainColor}; border-bottom-left-radius: 12px; font-size: 11px; font-weight: 700; letter-spacing: 1px;">
              ${isEvolution ? 'AUTO-GENERATED' : 'CORE-SKILL'}
            </div>

            <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 20px; margin-top: 8px;">
              <div style="width: 54px; height: 54px; border-radius: 14px; background: ${bgAccent}; display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid var(--border-light);">
                ${s.icon || '🪄'}
              </div>
              <div style="flex: 1; padding-top: 4px;">
                <h3 style="margin: 0 0 6px 0; font-size: 18px; font-weight: 700; color: var(--text-primary);">${escapeHtml(s.name)}</h3>
                <div style="font-size: 12px; color: var(--text-muted); font-family: monospace;">BY: ${escapeHtml(s.author || 'Unknown')}</div>
              </div>
            </div>
            
            <p style="margin: 0 0 24px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.6; flex: 1;">
              ${escapeHtml(s.description)}
            </p>
            
            <div style="display: flex; gap: 12px; margin-top: auto;">
              ${isInstalled && tab === 'installed'
            ? `<button class="btn btn-danger" onclick="window._uninstallSkill('${s.id}')" style="flex: 1; padding: 12px; border-radius: 10px; border: 1px solid rgba(255,59,48,0.5); background: rgba(255,59,48,0.1); color: #ff3b30; cursor: pointer; font-weight: 600; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,59,48,0.2)'" onmouseout="this.style.background='rgba(255,59,48,0.1)'">强制剥离突触</button>`
            : `<button class="btn btn-primary" onclick="window._installSkill('${s.id}')" ${isInstalled ? 'disabled' : ''} style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: ${isInstalled ? 'var(--bg-hover)' : 'linear-gradient(135deg, #ff9500, #ffcc00)'}; color: ${isInstalled ? 'var(--text-muted)' : '#fff'}; cursor: ${isInstalled ? 'not-allowed' : 'pointer'}; font-weight: 700; transition: all 0.2s; box-shadow: ${isInstalled ? 'none' : '0 4px 15px rgba(255,149,0,0.4)'};" ${!isInstalled ? `onmouseover="this.style.transform='scale(1.02)'" onmouseout="this.style.transform='scale(1)'"` : ''}>${isInstalled ? '已连接' : '载入核心链路'}</button>`}
            </div>
          </div>
        `;
    }).join('')}
    </div>
  `;
}
window._installSkill = async (id) => {
    try {
        if (window.__toast)
            window.__toast.info('正在载入技能突触...');
        await api.skill.installSkill(id);
        if (window.__toast)
            window.__toast.success('节点载入成功');
        await loadData();
        renderList('market');
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('载入失败: ' + e.message);
    }
};
window._uninstallSkill = async (id) => {
    try {
        await api.skill.removeSkill(id);
        if (window.__toast)
            window.__toast.success('技能节点已剥离');
        await loadData();
        renderList('installed');
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('剥离失败: ' + e.message);
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
