/**
 * 记忆管理页面
 * 查看和管理助手的长期记忆
 */

let memories = [];
let currentPage = 1;
let currentSearch = '';

export async function render(container) {
  container.innerHTML = `
    <div style="max-width: 1000px; margin: 0 auto; padding: 40px; display: flex; flex-direction: column; height: 100%;">
      
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; flex-shrink: 0;">
        <div>
          <h2 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">🧠 长期记忆库</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 15px;">助手会在对话中自动提取和记忆您的偏好与关键信息。</p>
        </div>
        <div style="position: relative; width: 300px;">
          <input type="text" id="searchMemoryInput" placeholder="搜索记忆..." class="input" style="width: 100%; padding: 10px 16px 10px 40px; border-radius: 20px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-primary); font-size: 14px;">
          <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 14px;">🔍</span>
        </div>
      </div>

      <div style="background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; flex: 1; overflow-y: auto; display: flex; flex-direction: column;">
        <div style="display: flex; padding: 16px 24px; border-bottom: 1px solid var(--border-light); font-weight: 600; color: var(--text-secondary); font-size: 14px; position: sticky; top: 0; background: rgba(44, 44, 46, 0.95); backdrop-filter: blur(8px); z-index: 1;">
          <div style="flex: 2;">内容</div>
          <div style="flex: 1;">标签</div>
          <div style="width: 150px;">时间</div>
          <div style="width: 80px; text-align: right;">操作</div>
        </div>
        
        <div id="memoryList" style="flex: 1; overflow-y: auto; position: relative;">
          <!-- List renders here -->
        </div>
        
        <div style="padding: 16px 24px; border-top: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
          <button id="addMemoryBtn" class="btn btn-primary" style="padding: 8px 16px; border-radius: 8px; border: none; background: var(--primary, #007aff); color: white; cursor: pointer; font-weight: 500;">+ 手动添加</button>
          <div style="display: flex; gap: 12px; align-items: center; color: var(--text-secondary); font-size: 14px;">
            <button id="prevPageBtn" class="btn" style="background: transparent; border: none; color: inherit; cursor: pointer;">&lt; 上一页</button>
            <span id="pageInfo">第 1 页</span>
            <button id="nextPageBtn" class="btn" style="background: transparent; border: none; color: inherit; cursor: pointer;">下一页 &gt;</button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('searchMemoryInput').addEventListener('input', (e) => {
    currentSearch = e.target.value.trim();
    currentPage = 1;
    loadData();
  });

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

  document.getElementById('addMemoryBtn').addEventListener('click', () => {
    const content = prompt('请输入要让助手记住的内容：');
    if (content && content.trim()) {
      addMemory(content.trim());
    }
  });

  await loadData();
}

async function loadData() {
  const container = document.getElementById('memoryList');
  container.innerHTML = '<div style="padding: 40px; text-align: center; color: #666;">加载中...</div>';
  
  try {
    let res;
    if (currentSearch) {
      res = await window.openClaw.memory.searchMemory(currentSearch, 20);
      memories = res || [];
    } else {
      res = await window.openClaw.memory.getMemories(currentPage, 20);
      memories = res?.data || [];
    }
    
    document.getElementById('pageInfo').textContent = `第 ${currentPage} 页`;
    renderList();
  } catch (e) {
    console.error('Failed to load memories:', e);
    container.innerHTML = `<div style="padding: 40px; text-align: center; color: #ff3b30;">加载失败: ${escapeHtml(e.message)}</div>`;
  }
}

function renderList() {
  const container = document.getElementById('memoryList');
  if (memories.length === 0) {
    container.innerHTML = `
      <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; color: var(--text-muted);">
        <div style="font-size: 48px; margin-bottom: 16px;">📭</div>
        <div style="font-size: 16px;">${currentSearch ? '没有找到包含该内容的记忆' : '记忆库是空的'}</div>
      </div>
    `;
    return;
  }

  container.innerHTML = memories.map(m => `
    <div style="display: flex; padding: 16px 24px; border-bottom: 1px solid var(--border-light); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
      <div style="flex: 2; padding-right: 16px; color: var(--text-primary); font-size: 14px; line-height: 1.5; word-break: break-all;">
        ${escapeHtml(m.content)}
      </div>
      <div style="flex: 1; padding-right: 16px;">
        ${(m.tags || ['User Preference']).map(t => `<span style="display: inline-block; padding: 2px 8px; background: rgba(52, 199, 89, 0.1); color: #34c759; border-radius: 4px; font-size: 12px; margin-right: 4px; margin-bottom: 4px;">${escapeHtml(t)}</span>`).join('')}
      </div>
      <div style="width: 150px; color: var(--text-muted); font-size: 13px;">
        ${new Date(m.createdAt).toLocaleString()}
      </div>
      <div style="width: 80px; text-align: right;">
        <button onclick="window._deleteMemory(${m.id})" class="btn" style="background: transparent; border: 1px solid #ff3b30; color: #ff3b30; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer;">删除</button>
      </div>
    </div>
  `).join('');
}

window._deleteMemory = async (id) => {
  if (confirm('确定要删除这条记忆吗？')) {
    try {
      await window.openClaw.memory.deleteMemory(id);
      if(window.__toast) window.__toast.success('已删除');
      loadData();
    } catch (e) {
      if(window.__toast) window.__toast.error('删除失败: ' + e.message);
    }
  }
};

async function addMemory(content) {
  try {
    await window.openClaw.memory.addMemory(content, 'user', ['Manual']);
    if(window.__toast) window.__toast.success('记忆已添加');
    loadData();
  } catch (e) {
    if(window.__toast) window.__toast.error('添加失败: ' + e.message);
  }
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}