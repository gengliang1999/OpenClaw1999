// @ts-nocheck
/**
 * 记忆管理页面
 * 瀑布流/卡片式的“记忆胶囊”页面
 */
import { api } from '../utils/api.js';
import { escapeHtml, debounce } from '../utils/common.js';
let memories = [];
let currentPage = 1;
let currentSearch = '';
export async function render(container) {
    container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 40px; display: flex; flex-direction: column; height: 100%;">
      
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 32px; flex-shrink: 0; animation: fadeInDown 0.5s ease;">
        <div>
          <h2 style="font-size: 32px; font-weight: 800; margin: 0 0 8px 0; background: linear-gradient(90deg, #6c63ff, #ff6b6b); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">🧠 记忆胶囊</h2>
          <p style="margin: 0; color: var(--text-secondary); font-size: 15px;">助手会在对话中无感提取并永久记住您的偏好、事实与习惯。</p>
        </div>
        <div style="display: flex; gap: 16px; align-items: center;">
          <div style="position: relative; width: 280px;">
            <input type="text" id="searchMemoryInput" placeholder="搜索记忆..." class="input" style="width: 100%; padding: 12px 16px 12px 40px; border-radius: 24px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-primary); font-size: 14px; outline: none; transition: all 0.3s;" onfocus="this.style.boxShadow='0 0 0 2px rgba(108,99,255,0.2)'" onblur="this.style.boxShadow='none'">
            <span style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); font-size: 16px;">🔍</span>
          </div>
          <button id="addMemoryBtn" class="btn btn-primary" style="padding: 12px 24px; border-radius: 24px; border: none; background: linear-gradient(135deg, #6c63ff, #5856d6); color: white; cursor: pointer; font-weight: 600; transition: transform 0.2s; box-shadow: 0 4px 12px rgba(108,99,255,0.3);" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">+ 手动添加</button>
        </div>
      </div>

      <div style="flex: 1; overflow-y: auto; padding: 8px 4px;">
        <div id="memoryList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px;">
          <!-- List renders here -->
        </div>
      </div>
      
      <div style="padding: 20px 0 0 0; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
        <div style="display: flex; gap: 16px; align-items: center; background: var(--bg-card); padding: 8px 16px; border-radius: 24px; border: 1px solid var(--border-light); box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
          <button id="prevPageBtn" class="btn" style="background: transparent; border: none; color: var(--text-primary); cursor: pointer; font-weight: 500; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">&lt; 上一页</button>
          <span id="pageInfo" style="font-size: 14px; font-weight: 600; color: var(--text-secondary);">第 1 页</span>
          <button id="nextPageBtn" class="btn" style="background: transparent; border: none; color: var(--text-primary); cursor: pointer; font-weight: 500; opacity: 0.7; transition: opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.7">下一页 &gt;</button>
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
    document.getElementById('addMemoryBtn').addEventListener('click', () => {
        const content = prompt('请输入要让助手强制记住的事实或偏好：');
        if (content && content.trim()) {
            addMemory(content.trim());
        }
    });
    await loadData();
}
async function loadData() {
    const container = document.getElementById('memoryList');
    container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 16px;">加载中...</div>';
    try {
        let res;
        if (currentSearch) {
            res = await api.memory.searchMemory(currentSearch, 20);
            memories = res || [];
        }
        else {
            res = await api.memory.getMemories(currentPage, 20);
            memories = res?.data || [];
        }
        document.getElementById('pageInfo').textContent = `第 ${currentPage} 页`;
        renderList();
    }
    catch (e) {
        console.error('Failed to load memories:', e);
        container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #ff3b30;">加载失败: ${escapeHtml(e.message)}</div>`;
    }
}
function renderList() {
    const container = document.getElementById('memoryList');
    if (memories.length === 0) {
        container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 80px 20px; text-align: center; color: var(--text-muted);">
        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.5;">📭</div>
        <div style="font-size: 18px; font-weight: 500;">${currentSearch ? '未搜索到包含该关键字的记忆' : '记忆库空空如也'}</div>
        <div style="font-size: 14px; margin-top: 8px;">在聊天时告诉助手您的习惯，它会自动记住</div>
      </div>
    `;
        return;
    }
    container.innerHTML = memories.map((m, idx) => {
        let tagsHtml = '';
        try {
            const parsedTags = typeof m.tags === 'string' ? JSON.parse(m.tags) : (m.tags || ['User Preference']);
            tagsHtml = parsedTags.map(t => `<span style="display: inline-block; padding: 4px 10px; background: rgba(108,99,255, 0.1); color: #6c63ff; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid rgba(108,99,255,0.2);">${escapeHtml(t)}</span>`).join(' ');
        }
        catch (e) {
            tagsHtml = `<span style="display: inline-block; padding: 4px 10px; background: rgba(108,99,255, 0.1); color: #6c63ff; border-radius: 12px; font-size: 12px; font-weight: 600; border: 1px solid rgba(108,99,255,0.2);">User Preference</span>`;
        }
        return `
      <div class="memory-card" style="position: relative; background: var(--bg-card); padding: 24px; border-radius: 20px; border: 1px solid var(--border-light); box-shadow: 0 4px 16px rgba(0,0,0,0.04); transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1); display: flex; flex-direction: column; gap: 16px; animation: fadeInUp 0.4s ease forwards; animation-delay: ${idx * 0.05}s; opacity: 0; transform: translateY(10px);" 
           onmouseover="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 24px rgba(0,0,0,0.08)'; this.querySelector('.del-btn').style.opacity='1'" 
           onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 16px rgba(0,0,0,0.04)'; this.querySelector('.del-btn').style.opacity='0'">
        
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            ${tagsHtml}
          </div>
          <button class="del-btn" onclick="window._deleteMemory('${m.id}')" style="background: rgba(255,59,48,0.1); border: none; color: #ff3b30; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; opacity: 0; transition: all 0.2s;" title="遗忘这条记忆">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
          </button>
        </div>
        
        <div style="color: var(--text-primary); font-size: 15px; line-height: 1.6; word-break: break-word; flex: 1;">
          ${escapeHtml(m.content)}
        </div>
        
        <div style="color: var(--text-muted); font-size: 12px; margin-top: auto; padding-top: 12px; border-top: 1px dashed var(--border-light);">
          📅 记忆时间: ${new Date(m.created_at || m.createdAt).toLocaleString()}
        </div>
      </div>
    `;
    }).join('');
}
window._deleteMemory = async (id) => {
    if (confirm('确定要让助手遗忘这条记忆吗？')) {
        try {
            await api.memory.deleteMemory(id);
            if (window.__toast)
                window.__toast.success('已遗忘');
            loadData();
        }
        catch (e) {
            if (window.__toast)
                window.__toast.error('删除失败: ' + e.message);
        }
    }
};
async function addMemory(content) {
    try {
        await api.memory.addMemory(content, 'User Preference', ['Manual']);
        if (window.__toast)
            window.__toast.success('记忆已烙印');
        loadData();
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('添加失败: ' + e.message);
    }
}
