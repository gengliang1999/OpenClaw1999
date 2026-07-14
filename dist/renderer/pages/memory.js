// @ts-nocheck
/**
 * 记忆管理页面 - Jarvis 核心记忆神经元
 * 采用 Glassmorphism 赛博朋克深色主题
 */
import { api } from '../utils.js';
import { escapeHtml, debounce } from '../utils.js';
let memories = [];
let currentPage = 1;
let currentSearch = '';
export async function render(container) {
    let globalConfig = {};
    let recentDbs = [];
    try {
        globalConfig = (await api.get('/system/global-config')) || {};
        const recentRes = await api.get('/system/memory/recent-dbs');
        if (recentRes && recentRes.success) {
            recentDbs = recentRes.recent || [];
        }
    }
    catch (e) {
        console.error('加载记忆文件配置失败', e);
    }
    container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 16px 24px; display: flex; flex-direction: column; height: 100%; position: relative; box-sizing: border-box;">
      
      <!-- Ambient Background Glow -->
      <div style="position: absolute; top: -100px; left: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(108,99,255,0.15) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; animation: fadeInDown 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 4px 0; background: linear-gradient(135deg, var(--primary), #4facfe); background-size: 200% 200%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: gradientPulse 3s ease infinite;">🧠 AI 的永久记忆</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 13px; line-height: 1.5; letter-spacing: 0.5px;">
            <span style="color: var(--text-primary); font-weight: 600;">这里存放着 AI 记住的关于你的所有事情。</span>
            <span style="opacity: 0.75; margin-left: 6px;">💡 提示：点击卡片上的【📌 置顶】按钮可让该设定常驻对话。</span>
          </p>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 12px; backdrop-filter: blur(10px); box-shadow: var(--shadow-sm); flex-shrink: 0;">
          <div style="position: relative; width: 200px; flex-shrink: 0;">
            <input type="text" id="searchMemoryInput" placeholder="🔍 搜索记忆..." class="input" style="width: 100%; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-primary); font-size: 13px; outline: none; transition: all 0.3s; box-sizing: border-box;" onfocus="this.style.border='1px solid var(--primary)'; this.style.boxShadow='0 0 10px rgba(0,122,255,0.15)'" onblur="this.style.border='1px solid var(--border-light)'; this.style.boxShadow='none'">
          </div>
          <button id="addMemoryBtn" class="btn btn-primary" style="height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--primary); background: var(--primary-light); color: var(--primary); cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;" onmouseover="this.style.background='var(--primary)'; this.style.color='#fff'; this.style.boxShadow='0 0 15px rgba(0,122,255,0.3)'" onmouseout="this.style.background='var(--primary-light)'; this.style.color='var(--primary)'; this.style.boxShadow='none'">+ 添加</button>
          <button id="importMemoryBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-light); background: rgba(255,255,255,0.02); color: var(--text-primary); cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">📥 导入</button>
          <button id="exportMemoryBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-light); background: rgba(255,255,255,0.02); color: var(--text-primary); cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;" onmouseover="this.style.background='var(--bg-hover)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">📤 导出</button>
          <button id="clearMemoryBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid rgba(255,59,48,0.3); background: rgba(255,59,48,0.05); color: #ff3b30; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; box-sizing: border-box; white-space: nowrap; flex-shrink: 0;" onmouseover="this.style.background='#ff3b30'; this.style.color='#fff'; this.style.boxShadow='0 0 15px rgba(255,59,48,0.3)'" onmouseout="this.style.background='rgba(255,59,48,0.05)'; this.style.color='#ff3b30'; this.style.boxShadow='none'">🧹 清空</button>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; padding: 8px 4px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;">
        <div id="memoryList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">
          <!-- List renders here -->
        </div>
      </div>
      
      <div style="padding: 24px 0 0 0; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
        <div style="display: flex; gap: 16px; align-items: center; background: rgba(255,255,255,0.02); backdrop-filter: blur(16px); padding: 8px 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
          <button id="prevPageBtn" class="btn" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-secondary)'">&lt; 向上回溯</button>
          <span id="pageInfo" style="font-size: 14px; font-weight: 600; color: var(--text-primary); background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px;">Node 1</span>
          <button id="nextPageBtn" class="btn" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-secondary)'">深度下潜 &gt;</button>
        </div>
      </div>
    </div>
  `;
    document.getElementById('searchMemoryInput').addEventListener('input', debounce((e) => {
        currentSearch = e.target.value.trim();
        currentPage = 1;
        loadData();
    }, 300));
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            loadData();
        }
    });
    document.getElementById('nextPageBtn').addEventListener('click', () => {
        currentPage++;
        loadData();
    });
    document.getElementById('addMemoryBtn').addEventListener('click', async () => {
        const content = await asyncPrompt('请输入你想让 AI 永久记住的事情：');
        if (content && content.trim()) {
            addMemory(content.trim());
        }
    });
    document.getElementById('clearMemoryBtn').addEventListener('click', async () => {
        if (await asyncConfirm('危险警告：此操作将清空当前数据库内的全部记忆，清空后 AI 将不再记得这些事。是否确定执行？')) {
            try {
                await api.post('/memory/clear-all');
                if (window.__toast)
                    window.__toast.success('已成功清空 AI 的全部记忆');
                else
                    alert('已成功清空 AI 的全部记忆！');
                currentPage = 1;
                loadData();
            }
            catch (e) {
                if (window.__toast)
                    window.__toast.error('重置失败: ' + e.message);
                else
                    alert('重置失败: ' + e.message);
            }
        }
    });
    document.getElementById('importMemoryBtn').addEventListener('click', async () => {
        try {
            const chooseMode = await asyncConfirmCustom('请选择导入记忆的冲突处理策略', '合并追加 (推荐)：将备份内容合并入当前记忆，并自动向量排重', '完全覆写：彻底清除当前数据库的所有记忆及向量，并装载该备份内容');
            if (chooseMode === null)
                return;
            const overwrite = chooseMode === 'overwrite';
            const res = await api.post('/memory/import', { overwrite });
            if (res && res.success) {
                alert(`成功导入 ${res.importedCount} 条核心记忆及对应的高维向量！`);
                currentPage = 1;
                loadData();
            }
            else if (res && res.message) {
                if (window.__toast)
                    window.__toast.info(res.message);
            }
        }
        catch (e) {
            alert('导入备份失败: ' + e.message);
        }
    });
    document.getElementById('exportMemoryBtn').addEventListener('click', async () => {
        try {
            const res = await api.post('/memory/export', {});
            if (res && res.success) {
                alert(`核心记忆及高维向量已成功安全打包导出至:\n${res.filePath}`);
            }
            else if (res && res.message) {
                if (window.__toast)
                    window.__toast.info(res.message);
            }
        }
        catch (e) {
            alert('导出备份失败: ' + e.message);
        }
    });
    await loadData();
}
async function loadData() {
    const container = document.getElementById('memoryList');
    container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 16px;">神经元突触链接中...</div>';
    try {
        let res;
        let total = 0;
        if (currentSearch) {
            res = await api.memory.searchMemory(currentSearch, 20);
            memories = res || [];
            total = memories.length;
        }
        else {
            res = await api.memory.getMemories(currentPage, 20);
            memories = res?.data || [];
            total = res?.total || 0;
        }
        // 强制按是否置顶（is_pinned = 1）进行前置升排序，第二维度按创建时间倒序
        memories.sort((a, b) => {
            const aPinned = a.is_pinned === 1 || a.isPinned ? 1 : 0;
            const bPinned = b.is_pinned === 1 || b.isPinned ? 1 : 0;
            if (aPinned !== bPinned) {
                return bPinned - aPinned;
            }
            const aTime = new Date(a.created_at || a.createdAt).getTime();
            const bTime = new Date(b.created_at || b.createdAt).getTime();
            return bTime - aTime;
        });
        // 动态控制底部分页器的显示与置灰
        const totalPages = Math.ceil(total / 20);
        const paginationContainer = document.getElementById('prevPageBtn')?.parentElement;
        if (paginationContainer) {
            paginationContainer.style.display = totalPages <= 1 ? 'none' : 'flex';
        }
        const prevBtn = document.getElementById('prevPageBtn');
        const nextBtn = document.getElementById('nextPageBtn');
        if (prevBtn && nextBtn) {
            prevBtn.disabled = currentPage <= 1;
            prevBtn.style.opacity = currentPage <= 1 ? '0.4' : '1';
            prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';
            nextBtn.disabled = currentPage >= totalPages;
            nextBtn.style.opacity = currentPage >= totalPages ? '0.4' : '1';
            nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
        }
        document.getElementById('pageInfo').textContent = `Node ${currentPage}`;
        renderList();
    }
    catch (e) {
        console.error('Failed to load memories:', e);
        container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #ff3b30;">节点崩溃: ${escapeHtml(e.message)}</div>`;
    }
}
function getTagHtml(tag) {
    let bg = 'rgba(0,122,255,0.1)';
    let border = 'rgba(0,122,255,0.2)';
    let color = 'var(--primary)';
    let displayText = tag;
    if (tag === 'auto') {
        bg = 'rgba(0,122,255,0.08)';
        border = 'rgba(0,122,255,0.15)';
        color = 'var(--primary)';
        displayText = '🤖 自动';
    }
    else if (tag === 'promoted') {
        bg = 'rgba(255,159,10,0.08)';
        border = 'rgba(255,159,10,0.15)';
        color = '#ff9f0a';
        displayText = '🚀 晋升';
    }
    else {
        bg = 'rgba(52,199,89,0.08)';
        border = 'rgba(52,199,89,0.15)';
        color = '#30d158';
        displayText = (tag === 'User Node' || tag === 'Manual Override' || tag === 'manual') ? '✍️ 手动' : `✍️ ${tag}`;
    }
    return `<span style="display: inline-block; padding: 4px 8px; background: ${bg}; color: ${color}; border-radius: 6px; font-size: 11.5px; font-weight: 600; border: 1px solid ${border}; white-space: nowrap; flex-shrink: 0;">${escapeHtml(displayText)}</span>`;
}
function renderList() {
    const container = document.getElementById('memoryList');
    if (memories.length === 0) {
        container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 80px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📭</div>
        <div style="font-size: 18px; font-weight: 500;">未检索到任何记忆事实</div>
        <div style="font-size: 14px; margin-top: 8px;">在聊天时发给 AI 的设定或规则，会被自动记住并整理在这里</div>
      </div>
    `;
        return;
    }
    container.innerHTML = memories.map((m, idx) => {
        let tagsHtml = '';
        let isPromoted = false;
        try {
            const parsedTags = typeof m.tags === 'string' ? JSON.parse(m.tags) : (m.tags || []);
            isPromoted = parsedTags.includes('promoted');
            const showTags = parsedTags.length > 0 ? parsedTags : ['User Node'];
            tagsHtml = showTags.map(t => getTagHtml(t)).join(' ');
        }
        catch (e) {
            tagsHtml = getTagHtml('User Node');
        }
        const isEvolution = m.type === 'Self-Evolution';
        const mainColor = isEvolution ? '#ff3b30' : 'var(--primary)';
        // 生成排重晋升按钮
        const promoteBtn = isPromoted
            ? `<span style="background: rgba(52, 199, 89, 0.15); color: #34c759; border: 1px solid rgba(52, 199, 89, 0.3); padding: 4px 6px; border-radius: 4px; font-size: 11px; font-weight:600; flex-shrink:0;" title="已晋升">🚀</span>`
            : `<button class="promote-btn" onclick="window._promoteMemory('${m.id}')" style="background: rgba(0,122,255,0.1); border: none; color: var(--primary); border-radius: 4px; padding: 4px 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(0,122,255,0.2)'" onmouseout="this.style.background='rgba(0,122,255,0.1)'" title="晋升脑皮层">🚀</button>`;
        const isPinned = m.is_pinned === 1 || m.isPinned;
        const pinBtn = `<button class="pin-btn" onclick="window._togglePinMemory('${m.id}', ${isPinned ? 0 : 1})" style="background: ${isPinned ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.05)'}; border: none; color: ${isPinned ? '#ff9f0a' : 'var(--text-muted)'}; border-radius: 4px; padding: 4px 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;" title="${isPinned ? '取消置顶' : '置顶常驻'}" onmouseover="this.style.background='rgba(255,159,10,0.25)'" onmouseout="this.style.background='${isPinned ? 'rgba(255,159,10,0.15)' : 'rgba(255,255,255,0.05)'}'">${isPinned ? '📌' : '📍'}</button>`;
        // 动态提取标题和预览正文逻辑
        let cardTitle = '';
        let cardPreview = '';
        const contentLines = m.content.split('\n').map(l => l.trim()).filter(Boolean);
        if (contentLines.length > 1) {
            cardTitle = contentLines[0];
            cardPreview = contentLines.slice(1).join('\n');
        }
        else {
            if (m.content.length <= 25) {
                cardTitle = m.content;
                cardPreview = '';
            }
            else {
                cardTitle = m.content.substring(0, 15) + '...';
                cardPreview = m.content;
            }
        }
        const shadowColor = 'rgba(255, 159, 10, 0.15)';
        const shadowColorHover = 'rgba(255, 159, 10, 0.26)';
        const cardBorder = isPinned ? '1px solid rgba(255, 159, 10, 0.45)' : '1px solid rgba(255, 255, 255, 0.08)';
        const cardShadow = isPinned
            ? `0 8px 30px ${shadowColor}, 0 2px 8px rgba(0, 0, 0, 0.3)`
            : '0 8px 30px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.15)';
        const hoverBorderColor = isPinned ? 'rgba(255, 159, 10, 0.85)' : 'rgba(255, 255, 255, 0.18)';
        const hoverShadow = isPinned
            ? `0 14px 44px ${shadowColorHover}, 0 4px 16px rgba(0, 0, 0, 0.45)`
            : '0 14px 44px rgba(0, 0, 0, 0.55), 0 4px 16px rgba(0, 0, 0, 0.25)';
        const outBorderColor = isPinned ? 'rgba(255, 159, 10, 0.45)' : 'rgba(255, 255, 255, 0.08)';
        const outShadow = cardShadow;
        // 更改置顶后的动画背景色及过渡呼吸效果
        const cardBg = isPinned
            ? 'linear-gradient(135deg, rgba(255, 159, 10, 0.06) 0%, rgba(255, 255, 255, 0.03) 100%)'
            : 'rgba(255, 255, 255, 0.04)';
        const hoverBg = isPinned
            ? 'linear-gradient(135deg, rgba(255, 159, 10, 0.12) 0%, rgba(255, 255, 255, 0.05) 100%)'
            : 'rgba(255, 255, 255, 0.07)';
        const outBg = cardBg;
        const dateObj = new Date(m.created_at || m.createdAt);
        const shortTime = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        const previewHtml = cardPreview
            ? `<div class="card-content-wrapper" style="color: var(--text-secondary); font-size: 13px; line-height: 1.55; word-break: break-word; padding-left: 10px; max-height: 48px; overflow: hidden; transition: max-height 0.3s ease; white-space: pre-wrap;">${escapeHtml(cardPreview)}</div>`
            : '';
        const toggleHtml = cardPreview
            ? `<div class="expand-toggle-btn" style="padding-left: 10px; font-size: 11.5px; color: var(--primary); cursor: pointer; display: none; align-items: center; gap: 4px; font-weight: 600; margin-top: 4px;">展开全文 ▾</div>`
            : '';
        return `
      <div class="memory-card" style="position: relative; background: ${cardBg}; backdrop-filter: blur(16px); border-radius: 12px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; border: ${cardBorder}; overflow: hidden; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); cursor: default; box-shadow: ${cardShadow}; animation: fadeInUp 0.4s ease forwards; animation-delay: ${idx * 0.05}s; opacity: 0; transform: translateY(10px);" 
           onmouseover="this.style.transform='translateY(-4px) scale(1.01)'; this.style.borderColor='${hoverBorderColor}'; this.style.boxShadow='${hoverShadow}'; this.style.background='${hoverBg}'" 
           onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.borderColor='${outBorderColor}'; this.style.boxShadow='${outShadow}'; this.style.background='${outBg}'">
        
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${isPinned ? 'linear-gradient(to bottom, #ff9f0a, #ffcc00)' : (isEvolution ? 'linear-gradient(to bottom, #ff3b30, #ff9f0a)' : 'linear-gradient(to bottom, var(--primary), #5856d6)')};"></div>
        
        <div style="display: flex; justify-content: space-between; align-items: center; padding-left: 10px; width: 100%; min-height: 24px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${tagsHtml}
            <span style="font-size: 10.5px; color: var(--text-muted); opacity: 0.7; font-family: monospace;">${shortTime}</span>
          </div>
          <div class="card-actions" style="display: flex; gap: 4px; align-items: center; opacity: 0.75; transition: opacity 0.2s;">
            ${pinBtn}
            ${promoteBtn}
            <button class="edit-btn" onclick="window._editMemory('${m.id}')" style="background: rgba(0,242,254,0.1); border: none; color: #00f2fe; border-radius: 4px; padding: 4px 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;" title="修改记忆">✏️</button>
            <button class="del-btn" onclick="window._deleteMemory('${m.id}')" style="background: rgba(255,59,48,0.1); border: none; color: #ff3b30; border-radius: 4px; padding: 4px 6px; font-size: 11px; cursor: pointer; transition: all 0.2s;" title="抹除记忆">🗑️</button>
          </div>
        </div>
        
        <div style="display: flex; flex-direction: column; flex: 1; min-height: 0; gap: 4px;">
          <div style="font-weight: 700; font-size: 14px; color: var(--text-primary); margin-bottom: 2px; padding-left: 10px; word-break: break-word;">
            📌 ${escapeHtml(cardTitle)}
          </div>
          ${previewHtml}
          ${toggleHtml}
        </div>
      </div>
    `;
    }).join('');
    container.querySelectorAll('.memory-card').forEach((card) => {
        // 鼠标悬停显示控制按钮
        card.addEventListener('mouseover', () => {
            const actions = card.querySelector('.card-actions');
            if (actions)
                actions.style.opacity = '1';
        });
        card.addEventListener('mouseout', () => {
            const actions = card.querySelector('.card-actions');
            if (actions)
                actions.style.opacity = '0.75';
        });
        // 折叠与展开交互绑定
        const wrapper = card.querySelector('.card-content-wrapper');
        const toggleBtn = card.querySelector('.expand-toggle-btn');
        if (wrapper && toggleBtn) {
            if (wrapper.scrollHeight > 48) {
                toggleBtn.style.display = 'flex';
            }
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = wrapper.style.maxHeight === '48px' || wrapper.style.maxHeight === '';
                if (isCollapsed) {
                    wrapper.style.maxHeight = '1000px';
                    toggleBtn.innerHTML = '收起全文 ▴';
                }
                else {
                    wrapper.style.maxHeight = '48px';
                    toggleBtn.innerHTML = '展开全文 ▾';
                }
            });
        }
    });
}
// 修改记忆事件
window._editMemory = async (id) => {
    const memory = memories.find((m) => m.id === id);
    if (!memory)
        return;
    const newContent = await asyncPrompt('修改核心记忆：', memory.content);
    if (newContent !== null && newContent.trim() && newContent.trim() !== memory.content) {
        try {
            await api.put(`/memory/${id}`, { content: newContent.trim() });
            if (window.__toast)
                window.__toast.success('记忆神经元修改成功，后台将同步更新向量库');
            else
                alert('记忆修改成功，后台已启动向量重算！');
            loadData();
        }
        catch (e) {
            if (window.__toast)
                window.__toast.error('修改失败: ' + e.message);
            else
                alert('修改失败: ' + e.message);
        }
    }
};
// 抹除记忆事件
window._deleteMemory = async (id) => {
    if (await asyncConfirm('警告：抹除神经元可能导致智能体行为回档，是否继续？')) {
        try {
            await api.memory.deleteMemory(id);
            if (window.__toast)
                window.__toast.success('节点已擦除');
            loadData();
        }
        catch (e) {
            if (window.__toast)
                window.__toast.error('擦除失败: ' + e.message);
        }
    }
};
// 记忆晋升二段式事件
window._promoteMemory = async (id) => {
    const targetCategory = '默认知识库';
    // 创建并显示加载弹层
    const loading = document.createElement('div');
    loading.style.position = 'fixed';
    loading.style.top = '0';
    loading.style.left = '0';
    loading.style.width = '100vw';
    loading.style.height = '100vh';
    loading.style.background = 'rgba(0,0,0,0.5)';
    loading.style.backdropFilter = 'blur(6px)';
    loading.style.display = 'flex';
    loading.style.justifyContent = 'center';
    loading.style.alignItems = 'center';
    loading.style.zIndex = '2000';
    loading.style.color = '#fff';
    loading.style.fontSize = '15px';
    loading.style.fontWeight = '600';
    loading.innerHTML = '🧬 正在调用大模型将碎事实扩写为 Markdown 草稿，请稍候...';
    document.body.appendChild(loading);
    try {
        const res = await api.post('/memory/promote/generate', { memoryId: id, targetCategory });
        loading.remove();
        if (res && res.success) {
            showPromoteModal(id, targetCategory, res.draftMarkdown);
        }
    }
    catch (e) {
        loading.remove();
        alert('生成扩写草稿失败: ' + e.message);
    }
};
// 晋升草稿二次确认和审查模态窗口
function showPromoteModal(memoryId, targetCategory, draftText) {
    const modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.6)';
    modal.style.backdropFilter = 'blur(15px)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = '1999';
    modal.innerHTML = `
    <div style="width: 700px; max-width: 90%; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px; box-shadow: 0 20px 40px rgba(0,0,0,0.3); box-sizing: border-box; animation: scaleUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;">
      <div>
        <h3 style="margin: 0 0 6px 0; font-size: 18px; color: var(--text-primary); display:flex; align-items:center; gap:6px;">
          <span>📝</span> 审核记忆晋升草稿 (防幻觉核对)
        </h3>
        <p style="margin: 0; color: var(--text-secondary); font-size: 12px;">AI 已将碎片事实整理为标准 Markdown 格式。请审阅或微调后正式提交入库。</p>
      </div>

      <textarea id="promoteTextarea" style="width: 100%; height: 350px; padding: 12px; border-radius: 8px; border: 1px solid var(--border-color); background: var(--bg-input); color: var(--text-primary); font-family: monospace; font-size: 13px; line-height: 1.5; resize: none; outline: none; box-sizing: border-box;"></textarea>

      <div style="display: flex; justify-content: flex-end; gap: 12px; margin-top: 10px;">
        <button id="cancelPromoteBtn" style="padding: 10px 20px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-secondary); cursor: pointer; font-size: 13px;">取消</button>
        <button id="confirmPromoteBtn" style="padding: 10px 20px; border-radius: 8px; border: none; background: var(--primary); color: #fff; cursor: pointer; font-size: 13px; font-weight: 600; box-shadow: 0 4px 12px rgba(0,122,255,0.2);">✔️ 确认晋升</button>
      </div>
    </div>
  `;
    document.body.appendChild(modal);
    const textarea = modal.querySelector('#promoteTextarea');
    textarea.value = draftText;
    const cancelBtn = modal.querySelector('#cancelPromoteBtn');
    const confirmBtn = modal.querySelector('#confirmPromoteBtn');
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.innerText = '正在入库...';
        try {
            await api.post('/memory/promote/confirm', {
                memoryId,
                targetCategory,
                markdownContent: textarea.value
            });
            modal.remove();
            if (window.__toast)
                window.__toast.success('记忆晋升正式入库成功！');
            else
                alert('记忆晋升入库成功！');
            // 重新加载记忆页面刷新已晋升状态
            loadData();
        }
        catch (e) {
            alert('晋升入库失败: ' + e.message);
            confirmBtn.disabled = false;
            confirmBtn.innerText = '✔️ 确认晋升';
        }
    });
}
async function addMemory(content) {
    try {
        await api.memory.addMemory(content, 'User Node', ['Manual Override']);
        if (window.__toast)
            window.__toast.success('新神经元凝结成功');
        loadData();
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('写入失败: ' + e.message);
    }
}
function asyncPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px);';
        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-card);padding:24px;border-radius:12px;width:400px;max-width:90%;box-shadow:var(--shadow-lg);border:1px solid var(--border-light);';
        const title = document.createElement('div');
        title.textContent = message;
        title.style.cssText = 'margin-bottom:16px;font-size:16px;font-weight:bold;color:var(--text-primary);';
        const input = document.createElement('textarea');
        input.value = defaultValue;
        input.style.cssText = 'width:100%;height:100px;padding:12px;border:1px solid var(--border-light);border-radius:8px;background:var(--bg-body);color:var(--text-primary);resize:vertical;font-family:inherit;';
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;margin-top:16px;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:1px solid var(--border-light);background:transparent;color:var(--text-primary);cursor:pointer;';
        const okBtn = document.createElement('button');
        okBtn.textContent = '确认';
        okBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:var(--primary);color:white;cursor:pointer;';
        cancelBtn.onclick = () => { document.body.removeChild(overlay); resolve(null); };
        okBtn.onclick = () => { document.body.removeChild(overlay); resolve(input.value); };
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);
        box.appendChild(title);
        box.appendChild(input);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        input.focus();
    });
}
function asyncConfirm(message) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px);';
        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-card);padding:24px;border-radius:12px;width:400px;max-width:90%;box-shadow:var(--shadow-lg);border:1px solid var(--border-light);';
        const title = document.createElement('div');
        title.textContent = message;
        title.style.cssText = 'margin-bottom:24px;font-size:16px;font-weight:bold;color:var(--text-primary);';
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:1px solid var(--border-light);background:transparent;color:var(--text-primary);cursor:pointer;';
        const okBtn = document.createElement('button');
        okBtn.textContent = '确认';
        okBtn.style.cssText = 'padding:8px 16px;border-radius:6px;border:none;background:#ff3b30;color:white;cursor:pointer;';
        cancelBtn.onclick = () => { document.body.removeChild(overlay); resolve(false); };
        okBtn.onclick = () => { document.body.removeChild(overlay); resolve(true); };
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);
        box.appendChild(title);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}
function asyncConfirmCustom(titleText, mergeText, overwriteText) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px);';
        const box = document.createElement('div');
        box.style.cssText = 'background:var(--bg-card);padding:24px;border-radius:16px;width:480px;max-width:90%;box-shadow:var(--shadow-lg);border:1px solid var(--border-light);box-sizing:border-box;';
        const title = document.createElement('div');
        title.textContent = titleText;
        title.style.cssText = 'margin-bottom:16px;font-size:16px;font-weight:bold;color:var(--text-primary);';
        const desc = document.createElement('div');
        desc.style.cssText = 'font-size:13px;color:var(--text-secondary);margin-bottom:20px;line-height:1.6;display:flex;flex-direction:column;gap:12px;';
        desc.innerHTML = `
      <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;background:rgba(255,255,255,0.02);padding:12px;border-radius:8px;border:1px solid var(--border-light);">
        <input type="radio" name="importMode" value="merge" checked style="margin-top:3px;">
        <div>
          <div style="font-weight:600;color:var(--primary);">合并追加模式 (推荐)</div>
          <div style="font-size:12px;opacity:0.8;margin-top:2px;">${mergeText}</div>
        </div>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;background:rgba(255,59,48,0.02);padding:12px;border-radius:8px;border:1px solid rgba(255,59,48,0.2);">
        <input type="radio" name="importMode" value="overwrite" style="margin-top:3px;">
        <div>
          <div style="font-weight:600;color:#ff3b30;">完全覆写模式 (高危)</div>
          <div style="font-size:12px;opacity:0.8;margin-top:2px;">${overwriteText}</div>
        </div>
      </label>
    `;
        const btnRow = document.createElement('div');
        btnRow.style.cssText = 'display:flex;justify-content:flex-end;gap:12px;';
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:1px solid var(--border-light);background:transparent;color:var(--text-primary);cursor:pointer;font-size:13px;';
        const okBtn = document.createElement('button');
        okBtn.textContent = '开始导入';
        okBtn.style.cssText = 'padding:8px 16px;border-radius:8px;border:none;background:var(--primary);color:white;cursor:pointer;font-weight:600;font-size:13px;';
        cancelBtn.onclick = () => { document.body.removeChild(overlay); resolve(null); };
        okBtn.onclick = () => {
            const selected = box.querySelector('input[name="importMode"]:checked').value;
            document.body.removeChild(overlay);
            resolve(selected);
        };
        btnRow.appendChild(cancelBtn);
        btnRow.appendChild(okBtn);
        box.appendChild(title);
        box.appendChild(desc);
        box.appendChild(btnRow);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
    });
}
// 置顶/取消置顶核心切换事件
window._togglePinMemory = async (id, pinState) => {
    try {
        await api.put(`/memory/${id}/pin`, { isPinned: pinState === 1 });
        if (window.__toast)
            window.__toast.success(pinState === 1 ? '已成功置顶常驻该记忆' : '已成功取消该记忆的常驻置顶');
        else
            alert(pinState === 1 ? '已置顶常驻该记忆！' : '已取消常驻置顶！');
        loadData();
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('置顶操作失败: ' + e.message);
        else
            alert('置顶操作失败: ' + e.message);
    }
};
