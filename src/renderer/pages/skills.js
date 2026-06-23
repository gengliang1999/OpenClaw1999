/**
 * 技能管理页面
 * 技能是包含特定的 Prompt 和执行逻辑的高级插件
 */

let installedSkills = [];
let marketSkills = [];

export async function render(container) {
  container.innerHTML = `
    <div style="max-width: 1000px; margin: 0 auto; padding: 40px;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px;">
        <div>
          <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">🎯 技能实验室</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 15px;">技能可以扩展助手的专业能力，安装后会在“专家角色中心”中显示。</p>
        </div>
        <div style="display: flex; gap: 8px; background: var(--bg-card); padding: 4px; border-radius: 12px; border: 1px solid var(--border-light);">
          <button id="tabSkillInstalled" class="btn active" style="padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary, #007aff); color: white; cursor: pointer; font-weight: 500;">已掌握</button>
          <button id="tabSkillMarket" class="btn" style="padding: 8px 16px; border-radius: 8px; border: none; background: transparent; color: var(--text-primary); cursor: pointer; font-weight: 500;">技能市场</button>
        </div>
      </div>

      <div id="skillContent">
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

  await loadData();
  renderList('installed');
}

async function loadData() {
  try {
    installedSkills = await window.openClaw.skill.getSkills() || [];
    marketSkills = await window.openClaw.skill.getMarketplace() || [
      { id: 'skill-coder', name: '全自动写代码', description: '一键生成项目代码并自动写入文件系统', author: 'OpenClaw', icon: '👨‍💻' },
      { id: 'skill-researcher', name: '深度研究员', description: '自动在网络上搜索资料并生成长篇综述报告', author: 'OpenClaw', icon: '🕵️‍♂️' }
    ];
  } catch (e) {
    console.error('Failed to load skills:', e);
  }
}

function switchTab(tab, btnElement) {
  document.querySelectorAll('#tabSkillInstalled, #tabSkillMarket').forEach(b => {
    b.style.background = 'transparent';
    b.style.color = 'var(--text-primary)';
  });
  btnElement.style.background = 'var(--primary, #007aff)';
  btnElement.style.color = 'white';

  renderList(tab);
}

function renderList(tab) {
  const container = document.getElementById('skillContent');
  let list = tab === 'installed' ? installedSkills : marketSkills;
  
  if (!list || list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 80px 0; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">🪄</div>
        <div style="font-size: 16px;">${tab === 'installed' ? '您还没有学习任何技能' : '市场里暂时没有新技能'}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;">
      ${list.map(s => {
        const isInstalled = installedSkills.some(is => is.id === s.id);
        
        return `
          <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 24px rgba(0,0,0,0.2)'" onmouseout="this.style.transform='translateY(0)';this.style.boxShadow='none'">
            <div style="display: flex; align-items: flex-start; gap: 16px; margin-bottom: 16px;">
              <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(255, 149, 0, 0.1); display: flex; align-items: center; justify-content: center; font-size: 24px;">
                ${s.icon || '🪄'}
              </div>
              <div style="flex: 1;">
                <h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600;">${escapeHtml(s.name)}</h3>
                <div style="font-size: 12px; color: var(--text-muted);">${escapeHtml(s.author || 'Unknown')}</div>
              </div>
            </div>
            <p style="margin: 0 0 24px 0; font-size: 14px; color: var(--text-secondary); line-height: 1.5; flex: 1;">
              ${escapeHtml(s.description)}
            </p>
            <div style="display: flex; gap: 12px; margin-top: auto;">
              ${isInstalled && tab === 'installed' 
                ? `<button class="btn btn-danger" onclick="window._uninstallSkill('${s.id}')" style="flex: 1; padding: 10px; border-radius: 8px; border: 1px solid #ff3b30; background: transparent; color: #ff3b30; cursor: pointer; font-weight: 500;">遗忘该技能</button>`
                : `<button class="btn btn-primary" onclick="window._installSkill('${s.id}')" ${isInstalled ? 'disabled' : ''} style="flex: 1; padding: 10px; border-radius: 8px; border: none; background: ${isInstalled ? '#444' : '#ff9500'}; color: ${isInstalled ? '#888' : '#fff'}; cursor: ${isInstalled ? 'not-allowed' : 'pointer'}; font-weight: 500;">${isInstalled ? '已掌握' : '学习技能'}</button>`
              }
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

window._installSkill = async (id) => {
  try {
    if(window.__toast) window.__toast.info('正在学习新技能...');
    await window.openClaw.skill.installSkill(id);
    if(window.__toast) window.__toast.success('学习成功');
    await loadData();
    renderList('market');
  } catch (e) {
    if(window.__toast) window.__toast.error('学习失败: ' + e.message);
  }
};

window._uninstallSkill = async (id) => {
  try {
    await window.openClaw.skill.removeSkill(id);
    if(window.__toast) window.__toast.success('已遗忘技能');
    await loadData();
    renderList('installed');
  } catch (e) {
    if(window.__toast) window.__toast.error('遗忘失败: ' + e.message);
  }
};

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}