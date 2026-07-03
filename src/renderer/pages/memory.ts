// @ts-nocheck
/**
 * 记忆管理页面 - Jarvis 核心记忆神经元
 * 采用 Glassmorphism 赛博朋克深色主题
 */

import { api } from '../utils.js';
import { escapeHtml, debounce } from '../utils.js';
import { showPrompt } from '../components.js';

let memories = [];
let currentPage = 1;
let currentSearch = '';

export async function render(container) {
  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 40px; display: flex; flex-direction: column; height: 100%; position: relative;">
      
      <!-- Ambient Background Glow -->
      <div style="position: absolute; top: -100px; left: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(108,99,255,0.15) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; flex-shrink: 0; animation: fadeInDown 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);">
        <div>
          <h2 style="font-size: 36px; font-weight: 800; margin: 0 0 8px 0; background: linear-gradient(135deg, #00f2fe, #4facfe, #00f2fe); background-size: 200% 200%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: gradientPulse 3s ease infinite;">🧠 核心记忆神经元</h2>
          <p style="margin: 0; color: rgba(255, 255, 255, 0.6); font-size: 15px; letter-spacing: 0.5px;">正在同步 RAG 向量引擎... AI 会在这里无感提取并永久刻印您的偏好、事实与习惯。</p>
        </div>
        <div style="display: flex; gap: 16px; align-items: center;">
          <div style="position: relative; width: 320px;">
            <input type="text" id="searchMemoryInput" placeholder="输入向量探测特征码..." class="input" style="width: 100%; padding: 12px 16px 12px 40px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); background: rgba(20,20,25,0.6); backdrop-filter: blur(10px); color: #fff; font-size: 14px; outline: none; transition: all 0.3s;" onfocus="this.style.border='1px solid rgba(0, 242, 254, 0.5)'; this.style.boxShadow='0 0 15px rgba(0,242,254,0.2)'" onblur="this.style.border='1px solid rgba(255,255,255,0.1)'; this.style.boxShadow='none'">
            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 16px; opacity: 0.7;">📡</span>
          </div>
          <button id="addMemoryBtn" class="btn btn-primary" style="padding: 12px 24px; border-radius: 12px; border: 1px solid rgba(0, 242, 254, 0.3); background: rgba(0, 242, 254, 0.1); color: #00f2fe; cursor: pointer; font-weight: 600; transition: all 0.2s; backdrop-filter: blur(4px);" onmouseover="this.style.background='rgba(0,242,254,0.2)'; this.style.boxShadow='0 0 20px rgba(0,242,254,0.4)'" onmouseout="this.style.background='rgba(0, 242, 254, 0.1)'; this.style.boxShadow='none'">+ 手动刻印突触</button>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; padding: 8px 4px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;">
        <div id="memoryList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 24px;">
          <!-- List renders here -->
        </div>
      </div>
      
      <div style="padding: 24px 0 0 0; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
        <div style="display: flex; gap: 16px; align-items: center; background: rgba(20,20,25,0.6); backdrop-filter: blur(12px); padding: 8px 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 16px rgba(0,0,0,0.2);">
          <button id="prevPageBtn" class="btn" style="background: transparent; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.color='#00f2fe'" onmouseout="this.style.color='rgba(255,255,255,0.7)'">&lt; 向上回溯</button>
          <span id="pageInfo" style="font-size: 14px; font-weight: 600; color: #fff; background: rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 8px;">Node 1</span>
          <button id="nextPageBtn" class="btn" style="background: transparent; border: none; color: rgba(255,255,255,0.7); cursor: pointer; font-weight: 500; transition: all 0.2s;" onmouseover="this.style.color='#00f2fe'" onmouseout="this.style.color='rgba(255,255,255,0.7)'">深度下潜 &gt;</button>
        </div>
      </div>
    </div>
  `;

  (document.getElementById('searchMemoryInput') as any).addEventListener('input', debounce((e) => {
    currentSearch = (e.target as any).value.trim();
    currentPage = 1;
    loadData();
  }, 300));

  (document.getElementById('prevPageBtn') as any).addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadData();
    }
  });

  (document.getElementById('nextPageBtn') as any).addEventListener('click', () => {
    currentPage++;
    loadData();
  });

  (document.getElementById('addMemoryBtn') as any).addEventListener('click', async () => {
    const content = prompt('请输入要让助手强制刻印在突触中的事实：');
    if (content && content.trim()) {
      addMemory(content.trim());
    }
  });

  await loadData();
}

async function loadData() {
  const container = (document.getElementById('memoryList') as any);
  container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: rgba(255,255,255,0.5); font-size: 16px;">神经元突触链接中...</div>';
  
  try {
    let res;
    if (currentSearch) {
      res = await api.memory.searchMemory(currentSearch, 20);
      memories = res || [];
    } else {
      res = await api.memory.getMemories(currentPage, 20);
      memories = res?.data || [];
    }
    
    (document.getElementById('pageInfo') as any).textContent = `Node ${currentPage}`;
    renderList();
  } catch (e) {
    console.error('Failed to load memories:', e);
    container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #ff3b30;">节点崩溃: ${escapeHtml(e.message)}</div>`;
  }
}

function renderList() {
  const container = (document.getElementById('memoryList') as any);
  if (memories.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 80px 20px; text-align: center; color: rgba(255,255,255,0.4);">
        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📭</div>
        <div style="font-size: 18px; font-weight: 500;">${currentSearch ? '未检测到匹配的特征码序列' : '突触库空载'}</div>
        <div style="font-size: 14px; margin-top: 8px;">在聊天时下达的规则，将自动凝结为神经元结构</div>
      </div>
    `;
    return;
  }

  container.innerHTML = memories.map((m, idx) => {
    let tagsHtml = '';
    try {
       const parsedTags = typeof m.tags === 'string' ? JSON.parse(m.tags) : (m.tags || ['User Node']);
       tagsHtml = parsedTags.map(t => `<span style="display: inline-block; padding: 4px 10px; background: rgba(0,242,254, 0.1); color: #00f2fe; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid rgba(0,242,254,0.2);">${escapeHtml(t)}</span>`).join(' ');
    } catch(e) {
       tagsHtml = `<span style="display: inline-block; padding: 4px 10px; background: rgba(0,242,254, 0.1); color: #00f2fe; border-radius: 6px; font-size: 12px; font-weight: 600; border: 1px solid rgba(0,242,254,0.2);">User Node</span>`;
    }

    const isEvolution = m.type === 'Self-Evolution';
    const mainColor = isEvolution ? '#ff0844' : '#00f2fe';
    const bgColor = isEvolution ? 'rgba(255,8,68,0.05)' : 'rgba(30, 30, 35, 0.6)';

    return `
      <div class="memory-card" style="position: relative; background: ${bgColor}; backdrop-filter: blur(12px); border-radius: 16px; padding: 24px; display: flex; flex-direction: column; gap: 16px; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1); cursor: default; box-shadow: 0 4px 20px rgba(0,0,0,0.3); animation: fadeInUp 0.4s ease forwards; animation-delay: ${idx * 0.05}s; opacity: 0; transform: translateY(10px);" 
           onmouseover="this.style.transform='translateY(-4px) scale(1.02)'; this.style.border='1px solid ${mainColor}'; this.style.boxShadow='0 10px 30px rgba(${isEvolution ? '255,8,68' : '0,242,254'},0.2)'" 
           onmouseout="this.style.transform='translateY(0) scale(1)'; this.style.border='1px solid rgba(255,255,255,0.05)'; this.style.boxShadow='0 4px 20px rgba(0,0,0,0.3)'">
        
        <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${isEvolution ? 'linear-gradient(to bottom, #ff0844, #ffb199)' : 'linear-gradient(to bottom, #00f2fe, #4facfe)'};"></div>
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-left: 12px;">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${tagsHtml}
          </div>
          <button class="del-btn" onclick="window._deleteMemory('${m.id}')" style="background: rgba(255,59,48,0.1); border: none; color: #ff3b30; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; opacity: 0; transition: all 0.2s;" title="抹除神经元" onmouseover="this.style.background='rgba(255,59,48,0.2)'" onmouseout="this.style.background='rgba(255,59,48,0.1)'">
            抹除
          </button>
        </div>
        
        <div style="color: rgba(255,255,255,0.9); font-size: 15px; line-height: 1.6; word-break: break-word; flex: 1; padding-left: 12px;">
          ${escapeHtml(m.content)}
        </div>
        
        <div style="color: rgba(255,255,255,0.3); font-size: 12px; margin-top: auto; padding-top: 12px; border-top: 1px dashed rgba(255,255,255,0.1); padding-left: 12px; font-family: monospace;">
          [TS_STAMP]: ${new Date(m.created_at || m.createdAt).getTime()} // ${new Date(m.created_at || m.createdAt).toLocaleString()}
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.memory-card').forEach(card => {
    card.addEventListener('mouseover', () => {
      const delBtn = card.querySelector('.del-btn');
      if(delBtn) delBtn.style.opacity = '1';
    });
    card.addEventListener('mouseout', () => {
      const delBtn = card.querySelector('.del-btn');
      if(delBtn) delBtn.style.opacity = '0';
    });
  });
}

window._deleteMemory = async (id) => {
  if (confirm('警告：抹除神经元可能导致智能体行为回档，是否继续？')) {
    try {
      await api.memory.deleteMemory(id);
      if(window.__toast) window.__toast.success('节点已擦除');
      loadData();
    } catch (e) {
      if(window.__toast) window.__toast.error('擦除失败: ' + e.message);
    }
  }
};

async function addMemory(content) {
  try {
    await api.memory.addMemory(content, 'User Node', ['Manual Override']);
    if(window.__toast) window.__toast.success('新神经元凝结成功');
    loadData();
  } catch (e) {
    if(window.__toast) window.__toast.error('写入失败: ' + e.message);
  }
}
