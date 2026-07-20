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
  let globalConfig: any = {};
  let recentDbs: string[] = [];
  try {
    globalConfig = (await api.get('/system/global-config')) || {};
    const recentRes = await api.get('/system/memory/recent-dbs');
    if (recentRes && recentRes.success) {
      recentDbs = recentRes.recent || [];
    }
  } catch (e) {
    console.error('加载记忆文件配置失败', e);
  }

  container.innerHTML = `
    <div style="max-width: 1200px; margin: 0 auto; padding: 16px 24px; display: flex; flex-direction: column; height: 100%; position: relative; box-sizing: border-box;">
      
      <!-- Ambient Background Glow -->
      <div style="position: absolute; top: -100px; left: -100px; width: 300px; height: 300px; background: radial-gradient(circle, rgba(108,99,255,0.15) 0%, rgba(0,0,0,0) 70%); border-radius: 50%; filter: blur(40px); pointer-events: none;"></div>
      
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-shrink: 0; animation: fadeInDown 0.6s cubic-bezier(0.2, 0.8, 0.2, 1);">
        <div>
          <h2 style="font-size: 22px; font-weight: 800; margin: 0 0 4px 0; background: linear-gradient(135deg, var(--primary, #1677ff), #4facfe); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">🧠 AI 的永久记忆</h2>
          <p style="margin: 0; color: var(--text-secondary, #595959); font-size: 13px; line-height: 1.5; letter-spacing: 0.5px;">
            <span style="color: var(--text-primary, #1f2329); font-weight: 600;">这里存放着 AI 记住的关于你的所有事情。</span>
            <span style="opacity: 0.75; margin-left: 6px;">💡 提示：支持基于艾宾浩斯遗忘曲线的动态留存计算与一键全量复习。</span>
          </p>
        </div>
        <div style="display: flex; gap: 6px; align-items: center; background: rgba(0,0,0,0.02); border: 1px solid var(--border-light, #eaedf1); padding: 4px 8px; border-radius: 12px; flex-shrink: 0;">
          <div style="position: relative; width: 170px; flex-shrink: 0;">
            <input type="text" id="searchMemoryInput" placeholder="🔍 搜索记忆..." class="input" style="width: 100%; height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--border-light, #d9d9d9); background: var(--bg-card, #ffffff); color: var(--text-main, #262626); font-size: 13px; outline: none; transition: all 0.3s; box-sizing: border-box;">
          </div>
          <button id="addMemoryBtn" class="btn btn-primary" style="height: 34px; padding: 0 12px; border-radius: 8px; border: 1px solid #1677ff; background: #e6f4ff; color: #1677ff; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;">+ 添加</button>
          <button id="batchReinforceBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid #91d5ff; background: #e6f7ff; color: #1890ff; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;" title="一键将所有记忆保留率恢复为 100%">🔄 全量复习</button>
          <button id="importMemoryBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-light, #d9d9d9); background: rgba(0,0,0,0.02); color: var(--text-main, #262626); cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;">📥 导入</button>
          <button id="exportMemoryBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid var(--border-light, #d9d9d9); background: rgba(0,0,0,0.02); color: var(--text-main, #262626); cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;">📤 导出</button>
          <button id="clearMemoryBtn" class="btn" style="height: 34px; padding: 0 10px; border-radius: 8px; border: 1px solid #ffa39e; background: #fff1f0; color: #ff4d4f; cursor: pointer; font-weight: 500; font-size: 13px; transition: all 0.2s; white-space: nowrap; flex-shrink: 0;">🧹 清空</button>
        </div>
      </div>

      <!-- 神经元健康度统计 Banner -->
      <div id="memoryStatsBanner" style="display: flex; gap: 16px; align-items: center; background: var(--bg-card, #ffffff); border: 1px solid var(--border-light, #eaedf1); padding: 8px 16px; border-radius: 10px; margin-bottom: 12px; font-size: 12px; color: var(--text-main, #262626); box-shadow: 0 2px 8px rgba(0,0,0,0.02); flex-shrink: 0; white-space: nowrap; overflow-x: auto;">
        <span>🧠 神经元总量: <strong id="statTotalNodes" style="color: var(--primary, #1677ff);">0</strong></span>
        <span style="opacity:0.3;">|</span>
        <span>📈 平均保留率: <strong id="statAvgRetention" style="color: #52c41a;">100%</strong></span>
        <span style="opacity:0.3;">|</span>
        <span>🟢 鲜活节点: <strong id="statFreshNodes" style="color: #52c41a;">0</strong></span>
        <span style="opacity:0.3;">|</span>
        <span>🟡 衰退/濒危节点: <strong id="statFadingNodes" style="color: #faad14;">0</strong></span>
      </div>
      
      <div style="flex: 1; overflow-y: auto; padding: 8px 4px; scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.1) transparent;">
        <div id="memoryList" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px;">
          <!-- List renders here -->
        </div>
      </div>
      
      <div style="padding: 24px 0 0 0; display: flex; justify-content: center; align-items: center; flex-shrink: 0;">
        <div style="display: flex; gap: 16px; align-items: center; background: rgba(255,255,255,0.02); backdrop-filter: blur(16px); padding: 8px 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.2);">
          <button id="prevPageBtn" class="btn" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-weight: 500; transition: all 0.2s;">&lt; 向上回溯</button>
          <span id="pageInfo" style="font-size: 14px; font-weight: 600; color: var(--text-primary); background: rgba(255,255,255,0.05); padding: 4px 12px; border-radius: 8px;">Node 1</span>
          <button id="nextPageBtn" class="btn" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; font-weight: 500; transition: all 0.2s;">深度下潜 &gt;</button>
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
    const content = await asyncPrompt('请输入你想让 AI 永久记住的事情：');
    if (content && content.trim()) {
      addMemory(content.trim());
    }
  });

  (document.getElementById('batchReinforceBtn') as any).addEventListener('click', async () => {
    if (memories.length === 0) {
      if (window.__toast) window.__toast.info('当前暂无记忆可以复习');
      return;
    }
    if (await asyncConfirm(`确定要依据艾宾浩斯遗忘曲线一键复习当前 ${memories.length} 条记忆吗？保留率将重置提升至 100%！`)) {
      try {
        const nowStr = new Date().toISOString();
        for (const m of memories) {
          await api.put(`/memory/${m.id}`, { content: m.content, updated_at: nowStr });
        }
        if (window.__toast) window.__toast.success('全量记忆复习成功！保留率已全部提升为 100%');
        else alert('全量记忆复习成功！');
        loadData();
      } catch (e: any) {
        if (window.__toast) window.__toast.error('全量复习失败: ' + e.message);
        else alert('全量复习失败: ' + e.message);
      }
    }
  });

  (document.getElementById('clearMemoryBtn') as any).addEventListener('click', async () => {
    if (await asyncConfirm('危险警告：此操作将清空当前数据库内的全部记忆，清空后 AI 将不再记得这些事。是否确定执行？')) {
      try {
        await api.post('/memory/clear-all');
        if (window.__toast) window.__toast.success('已成功清空 AI 的全部记忆');
        else alert('已成功清空 AI 的全部记忆！');
        currentPage = 1;
        loadData();
      } catch (e: any) {
        if (window.__toast) window.__toast.error('重置失败: ' + e.message);
        else alert('重置失败: ' + e.message);
      }
    }
  });

  (document.getElementById('importMemoryBtn') as any).addEventListener('click', async () => {
    try {
      const chooseMode = await asyncConfirmCustom(
        '请选择导入记忆的冲突处理策略',
        '合并追加 (推荐)：将备份内容合并入当前记忆，并自动向量排重',
        '完全覆写：彻底清除当前数据库的所有记忆及向量，并装载该备份内容'
      );
      if (chooseMode === null) return;
      
      const overwrite = chooseMode === 'overwrite';
      const res = await api.post('/memory/import', { overwrite });
      if (res && res.success) {
        alert(`成功导入 ${res.importedCount} 条核心记忆及对应的高维向量！`);
        currentPage = 1;
        loadData();
      } else if (res && res.message) {
        if (window.__toast) window.__toast.info(res.message);
      }
    } catch (e: any) {
      alert('导入备份失败: ' + e.message);
    }
  });

  (document.getElementById('exportMemoryBtn') as any).addEventListener('click', async () => {
    try {
      const res = await api.post('/memory/export', {});
      if (res && res.success) {
        alert(`核心记忆及高维向量已成功安全打包导出至:\n${res.filePath}`);
      } else if (res && res.message) {
        if (window.__toast) window.__toast.info(res.message);
      }
    } catch (e: any) {
      alert('导出备份失败: ' + e.message);
    }
  });

  const memoryListEl = document.getElementById('memoryList');
  if (memoryListEl) {
    memoryListEl.addEventListener('click', async (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      if (!action || !id) return;

      if (action === 'edit') {
        window._editMemory(id);
      } else if (action === 'delete') {
        window._deleteMemory(id);
      } else if (action === 'pin') {
        const isPinned = btn.getAttribute('data-pinned') === '1';
        window._togglePinMemory(id, isPinned ? 0 : 1);
      } else if (action === 'promote') {
        window._promoteMemory(id);
      } else if (action === 'reinforce') {
        window._reinforceMemory(id);
      }
    });
  }

  await loadData();
}

async function loadData() {
  const container = (document.getElementById('memoryList') as any);
  container.innerHTML = '<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); font-size: 16px;">神经元突触链接中...</div>';
  
  try {
    let res;
    let total = 0;
    if (currentSearch) {
      res = await api.memory.searchMemory(currentSearch, 20);
      memories = res || [];
      total = memories.length;
    } else {
      res = await api.memory.getMemories(currentPage, 20);
      memories = res?.data || [];
      total = res?.total || 0;
    }

    // 强制按是否置顶（is_pinned = 1）进行前置升排序，第二维度按创建时间倒序
    memories.sort((a: any, b: any) => {
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

    const prevBtn = document.getElementById('prevPageBtn') as HTMLButtonElement;
    const nextBtn = document.getElementById('nextPageBtn') as HTMLButtonElement;
    if (prevBtn && nextBtn) {
      prevBtn.disabled = currentPage <= 1;
      prevBtn.style.opacity = currentPage <= 1 ? '0.4' : '1';
      prevBtn.style.cursor = currentPage <= 1 ? 'not-allowed' : 'pointer';

      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.style.opacity = currentPage >= totalPages ? '0.4' : '1';
      nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }

    (document.getElementById('pageInfo') as any).textContent = `Node ${currentPage}`;

    // 动态更新神经元健康度统计 Banner
    const totalCount = total;
    let freshCount = 0;
    let fadingCount = 0;
    let retentionSum = 0;

    memories.forEach((m: any) => {
      const isPinned = m.is_pinned === 1 || m.isPinned;
      const parsedTags = parseTagsHelper(m.tags);
      const isPromoted = parsedTags.includes('promoted');
      const ret = calculateEbbinghausRetention(m.updated_at || m.created_at || m.createdAt, isPinned, isPromoted, m.reinforce_count || 0);
      retentionSum += ret.retention;
      if (ret.retention >= 75) {
        freshCount++;
      } else {
        fadingCount++;
      }
    });

    const avgRet = memories.length > 0 ? Math.round(retentionSum / memories.length) : 100;
    const totalEl = document.getElementById('statTotalNodes');
    const avgEl = document.getElementById('statAvgRetention');
    const freshEl = document.getElementById('statFreshNodes');
    const fadingEl = document.getElementById('statFadingNodes');

    if (totalEl) totalEl.textContent = String(totalCount);
    if (avgEl) avgEl.textContent = `${avgRet}%`;
    if (freshEl) freshEl.textContent = String(freshCount);
    if (fadingEl) fadingEl.textContent = String(fadingCount);

    renderList();
  } catch (e) {
    console.error('Failed to load memories:', e);
    container.innerHTML = `<div style="grid-column: 1 / -1; padding: 40px; text-align: center; color: #ff3b30;">节点崩溃: ${escapeHtml(e.message)}</div>`;
  }
}

function parseTagsHelper(tagsInput: any): string[] {
  if (!tagsInput) return [];
  if (Array.isArray(tagsInput)) return tagsInput;
  if (typeof tagsInput === 'string') {
    try {
      const parsed = JSON.parse(tagsInput);
      return Array.isArray(parsed) ? parsed : [String(parsed)];
    } catch(e) {
      return [tagsInput];
    }
  }
  return [];
}

function calculateEbbinghausRetention(createdAt: string | number, isPinned: boolean, isPromoted: boolean, reinforceCount: number = 0): { retention: number; label: string; color: string } {
  if (isPinned || isPromoted) {
    return { retention: 100, label: '🧠 固化常驻', color: '#52c41a' };
  }

  const rawDate = createdAt ? new Date(createdAt).getTime() : Date.now();
  const createdTime = isNaN(rawDate) ? Date.now() : rawDate;
  const now = Date.now();
  
  // 经过的小时数 (最小 0.1)
  const hours = Math.max(0.1, (now - createdTime) / (1000 * 60 * 60));
  
  // 记忆稳定性 S，基础为 24 小时，每次强化/复习增加 48 小时
  const stability = 24 + ((reinforceCount || 0) * 48);
  
  // R = e^(-t / S)
  let retention = Math.round(100 * Math.exp(-hours / stability));
  if (isNaN(retention)) retention = 100;
  retention = Math.max(15, Math.min(100, retention));

  let label = '🟢 鲜活';
  let color = '#52c41a';

  if (retention >= 80) {
    label = '🟢 鲜活';
    color = '#52c41a';
  } else if (retention >= 60) {
    label = '🔵 稳固';
    color = '#1890ff';
  } else if (retention >= 40) {
    label = '🟡 衰退';
    color = '#faad14';
  } else {
    label = '🔴 濒危';
    color = '#ff4d4f';
  }

  return { retention, label, color };
}

function generateEbbinghausSparkline(retention: number, color: string, id: string): string {
  const width = 180;
  const height = 22;
  // 计算当前保留率在 X/Y 轴上的坐标点 (15% ~ 100%)
  const safeRetention = isNaN(retention) ? 100 : Math.max(15, Math.min(100, retention));
  const safeId = id || Math.random().toString(36).substring(2, 9);

  let currentX = Math.round((1 - (safeRetention - 15) / 85) * (width - 12) + 6);
  let currentY = Math.round(3 + (1 - (safeRetention - 15) / 85) * (height - 6));
  
  if (isNaN(currentX)) currentX = 6;
  if (isNaN(currentY)) currentY = 3;

  const pathD = `M 4,3 C 40,5 80,10 120,16 C 150,18 170,19 176,19`;
  const areaD = `${pathD} L 176,${height} L 4,${height} Z`;
  const gradientId = `ebbGrad_${String(safeId).replace(/[^a-zA-Z0-9]/g, '_')}`;

  return `
    <div style="width: 100%; height: ${height}px; margin-top: 2px; position: relative;">
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" style="overflow: visible; display: block;">
        <defs>
          <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="${color || '#52c41a'}" stop-opacity="0.35" />
            <stop offset="100%" stop-color="${color || '#52c41a'}" stop-opacity="0.0" />
          </linearGradient>
        </defs>
        <path d="${areaD}" fill="url(#${gradientId})" />
        <path d="${pathD}" fill="none" stroke="${color || '#52c41a'}" stroke-width="2" stroke-linecap="round" />
        <circle cx="${currentX}" cy="${currentY}" r="3.5" fill="${color || '#52c41a'}" stroke="#ffffff" stroke-width="1.5" />
      </svg>
    </div>
  `;
}

function getTagHtml(tag: string) {
  let bg = '#e6f4ff';
  let border = '#91caff';
  let color = '#0958d9';
  let displayText = tag;

  if (tag === 'auto') {
    bg = '#e6f4ff';
    border = '#91caff';
    color = '#0958d9';
    displayText = '🤖 自动';
  } else if (tag === 'promoted') {
    bg = '#fff7e6';
    border = '#ffd591';
    color = '#d46b08';
    displayText = '🚀 精选';
  } else {
    bg = '#f6ffed';
    border = '#b7eb8f';
    color = '#389e0d';
    displayText = (tag === 'User Node' || tag === 'Manual Override' || tag === 'manual') ? '✍️ 手动' : `✍️ ${tag}`;
  }

  return `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; background: ${bg}; color: ${color}; border-radius: 6px; font-size: 11px; font-weight: 500; border: 1px solid ${border}; white-space: nowrap; flex-shrink: 0;">${escapeHtml(displayText)}</span>`;
}

function renderList() {
  const container = (document.getElementById('memoryList') as any);
  if (!container) return;
  if (!Array.isArray(memories) || memories.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 80px 20px; text-align: center; color: var(--text-muted, #8c8c8c);">
        <div style="font-size: 64px; margin-bottom: 20px; opacity: 0.3;">📭</div>
        <div style="font-size: 16px; font-weight: 500;">未检索到任何记忆事实</div>
        <div style="font-size: 13px; margin-top: 8px;">在聊天时发给 AI 的设定或规则，会被自动记住并整理在这里</div>
      </div>
    `;
    return;
  }

  container.innerHTML = memories.map((m, idx) => {
    try {
      if (!m) return '';
      let tagsHtml = '';
      let isPromoted = false;
      const parsedTags = parseTagsHelper(m.tags);
      isPromoted = parsedTags.includes('promoted');
      const showTags = parsedTags.length > 0 ? parsedTags : ['User Node'];
      tagsHtml = showTags.map(t => getTagHtml(t)).join(' ');

      const isEvolution = m.type === 'Self-Evolution';
      const isPinned = m.is_pinned === 1 || m.isPinned;

      // 置顶徽章
      const pinnedBadge = isPinned 
        ? `<span style="display: inline-flex; align-items: center; gap: 3px; font-size: 11px; font-weight: 600; color: #fa8c16; background: #fff7e6; padding: 2px 8px; border-radius: 6px; border: 1px solid #ffd591; white-space: nowrap;">📌 置顶</span>`
        : '';

      // 卡片背景与边框
      const cardBorder = isPinned 
        ? '1px solid #ffd591' 
        : '1px solid var(--border-light, #eaedf1)';
        
      const cardBg = isPinned 
        ? 'var(--bg-card, #ffffff)' 
        : 'var(--bg-card, #ffffff)';

      const leftIndicator = isPinned 
        ? '#fa8c16' 
        : (isEvolution ? '#ff4d4f' : 'var(--primary, #1677ff)');

      // 艾宾浩斯遗忘曲线计算与 SVG 折线图
      const ebbinghaus = calculateEbbinghausRetention(m.updated_at || m.created_at || m.createdAt, isPinned, isPromoted, m.reinforce_count || 0);
      const sparklineSvg = generateEbbinghausSparkline(ebbinghaus.retention, ebbinghaus.color, String(m.id || idx));

      const ebbinghausBarHtml = `
        <div style="margin-top: 10px; padding: 8px 12px; background: rgba(0,122,255,0.03); border-radius: 8px; border: 1px solid rgba(0,122,255,0.15); display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <span style="font-size: 11.5px; color: var(--text-main, #262626); font-weight: 500;">
              📉 记忆保留率: <strong style="color: ${ebbinghaus.color}; font-weight: 700;">${ebbinghaus.retention}%</strong> (${ebbinghaus.label})
            </span>
            <button class="btn-action-reinforce" data-action="reinforce" data-id="${m.id}" style="display: inline-flex; align-items: center; gap: 3px; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 600; background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: all 0.2s;" title="依据艾宾浩斯遗忘曲线重置并复习此记忆">🔄 复习</button>
          </div>
          ${sparklineSvg}
        </div>
      `;

      // 底部 Action 按钮 (强制 white-space: nowrap 防止竖向折行)
      const btnStyle = "display: inline-flex; align-items: center; justify-content: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: all 0.2s; border: 1px solid transparent;";

      const pinBtn = `<button class="btn-action-pin" data-action="pin" data-id="${m.id}" data-pinned="${isPinned ? 1 : 0}" style="${btnStyle} background: ${isPinned ? '#fff7e6' : 'rgba(0,0,0,0.03)'}; color: ${isPinned ? '#fa8c16' : 'var(--text-main, #262626)'}; border-color: ${isPinned ? '#ffd591' : 'transparent'};" title="${isPinned ? '取消置顶' : '置顶常驻'}">${isPinned ? '📌 置顶' : '📍 置顶'}</button>`;
      
      const promoteBtn = isPromoted 
        ? `<span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; background: #f6ffed; color: #52c41a; border: 1px solid #b7eb8f; white-space: nowrap; flex-shrink: 0;" title="已精选">🚀 精选</span>`
        : `<button class="btn-action-promote" data-action="promote" data-id="${m.id}" style="${btnStyle} background: #f9f0ff; color: #722ed1; border-color: #d3adf7;" title="晋升脑皮层">🚀 晋升</button>`;

      const editBtn = `<button class="btn-action-edit" data-action="edit" data-id="${m.id}" style="${btnStyle} background: rgba(0,0,0,0.03); color: var(--text-main, #262626);" title="修改记忆">✏️ 编辑</button>`;
      const delBtn = `<button class="btn-action-del" data-action="delete" data-id="${m.id}" style="${btnStyle} background: #fff1f0; color: #ff4d4f; border-color: #ffa39e;" title="抹除记忆">🗑️ 抹除</button>`;

      // 动态提取标题和预览正文逻辑
      let cardTitle = '';
      let cardPreview = '';
      const rawContent = m.content || m.text || '';
      const contentLines = String(rawContent).split('\n').map(l => l.trim()).filter(Boolean);
      if (contentLines.length > 1) {
        cardTitle = contentLines[0];
        cardPreview = contentLines.slice(1).join('\n');
      } else {
        if (rawContent.length <= 30) {
          cardTitle = rawContent;
          cardPreview = '';
        } else {
          cardTitle = rawContent.substring(0, 25) + '...';
          cardPreview = rawContent;
        }
      }

      let shortTime = '近期';
      try {
        const dateObj = new Date(m.created_at || m.createdAt || Date.now());
        if (!isNaN(dateObj.getTime())) {
          shortTime = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
        }
      } catch (e) {}

      const previewHtml = cardPreview
        ? `<div class="card-content-wrapper" style="color: var(--text-muted, #595959); font-size: 13px; line-height: 1.5; word-break: break-word; max-height: 40px; overflow: hidden; transition: max-height 0.2s ease; white-space: pre-wrap; margin-top: 4px;">${escapeHtml(cardPreview)}</div>`
        : '';
      const toggleHtml = cardPreview
        ? `<div class="expand-toggle-btn" data-action="toggle-expand" style="font-size: 12px; color: var(--primary, #1677ff); cursor: pointer; display: none; align-items: center; gap: 2px; font-weight: 500; margin-top: 4px;">展开 ▾</div>`
        : '';

      return `
        <div class="memory-card-node" style="position: relative; background: ${cardBg}; border: ${cardBorder}; border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; justify-content: space-between; gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.03); transition: all 0.2s ease;">
          
          <!-- 左侧指示条 -->
          <div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${leftIndicator}; border-radius: 4px 0 0 4px;"></div>
          
          <!-- 卡片头部：标签 + 状态 + 时间 -->
          <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
            <div style="display: flex; align-items: center; gap: 6px;">
              ${tagsHtml}
              ${pinnedBadge}
            </div>
            <span style="font-size: 11px; color: var(--text-muted, #8c8c8c); font-family: monospace;">${shortTime}</span>
          </div>
          
          <!-- 卡片主体：标题与内容 -->
          <div style="display: flex; flex-direction: column; flex: 1;">
            <div style="font-weight: 600; font-size: 15px; color: var(--text-main, #1f2329); line-height: 1.4; word-break: break-word;">
              ${escapeHtml(cardTitle)}
            </div>
            ${previewHtml}
            ${toggleHtml}
            ${ebbinghausBarHtml}
          </div>

          <!-- 卡片底部：极简按钮工具栏 -->
          <div class="card-actions" style="display: flex; justify-content: flex-end; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid var(--border-light, #f0f0f0); width: 100%; box-sizing: border-box;">
            ${pinBtn}
            ${promoteBtn}
            ${editBtn}
            ${delBtn}
          </div>
        </div>
      `;
    } catch (err) {
      console.error('渲染单个记忆卡片异常隔离:', err);
      return '';
    }
  }).join('');

  // 绑定完全兼容 CSP 的展开折叠处理
  container.querySelectorAll('.memory-card-node').forEach((card: HTMLElement) => {
    const wrapper = card.querySelector('.card-content-wrapper') as HTMLElement;
    const toggleBtn = card.querySelector('.expand-toggle-btn') as HTMLElement;
    if (wrapper && toggleBtn) {
      if (wrapper.scrollHeight > 40) {
        toggleBtn.style.display = 'inline-flex';
        toggleBtn.onclick = (e) => {
          e.stopPropagation();
          const isExpanded = wrapper.style.maxHeight === 'none';
          wrapper.style.maxHeight = isExpanded ? '40px' : 'none';
          toggleBtn.textContent = isExpanded ? '展开 ▾' : '收起 ▴';
        };
      }
    }
  });
}

// 修改记忆事件
window._editMemory = async (id: string) => {
  const memory = memories.find((m: any) => m.id === id);
  if (!memory) return;
  const newContent = await asyncPrompt('修改核心记忆：', memory.content);
  if (newContent !== null && newContent.trim() && newContent.trim() !== memory.content) {
    try {
      await api.put(`/memory/${id}`, { content: newContent.trim() });
      if (window.__toast) window.__toast.success('记忆神经元修改成功，后台将同步更新向量库');
      else alert('记忆修改成功，后台已启动向量重算！');
      loadData();
    } catch (e: any) {
      if (window.__toast) window.__toast.error('修改失败: ' + e.message);
      else alert('修改失败: ' + e.message);
    }
  }
};

// 抹除记忆事件
window._deleteMemory = async (id) => {
  if (await asyncConfirm('警告：抹除神经元可能导致智能体行为回档，是否继续？')) {
    try {
      await api.memory.deleteMemory(id);
      if(window.__toast) window.__toast.success('节点已擦除');
      loadData();
    } catch (e: any) {
      if(window.__toast) window.__toast.error('擦除失败: ' + e.message);
    }
  }
};

// 艾宾浩斯曲线记忆复习刷新
window._reinforceMemory = async (id: string) => {
  const memory = memories.find((m: any) => m.id === id);
  try {
    await api.put(`/memory/${id}`, { 
      content: memory ? memory.content : undefined,
      updated_at: new Date().toISOString() 
    });
    if (window.__toast) window.__toast.success('已依据艾宾浩斯遗忘曲线成功复习此记忆，保留率提升至 100%！');
    else alert('记忆复习成功！保留率已恢复至 100%');
    loadData();
  } catch (e: any) {
    if (window.__toast) window.__toast.error('复习失败: ' + e.message);
    else alert('复习失败: ' + e.message);
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
  } catch (e: any) {
    loading.remove();
    alert('生成扩写草稿失败: ' + e.message);
  }
};

// 晋升草稿二次确认和审查模态窗口
function showPromoteModal(memoryId: string, targetCategory: string, draftText: string) {
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

  const textarea = modal.querySelector('#promoteTextarea') as HTMLTextAreaElement;
  textarea.value = draftText;

  const cancelBtn = modal.querySelector('#cancelPromoteBtn') as HTMLButtonElement;
  const confirmBtn = modal.querySelector('#confirmPromoteBtn') as HTMLButtonElement;

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
      if (window.__toast) window.__toast.success('记忆晋升正式入库成功！');
      else alert('记忆晋升入库成功！');
      
      // 重新加载记忆页面刷新已晋升状态
      loadData();
    } catch (e: any) {
      alert('晋升入库失败: ' + e.message);
      confirmBtn.disabled = false;
      confirmBtn.innerText = '✔️ 确认晋升';
    }
  });
}

async function addMemory(content) {
  try {
    await api.memory.addMemory(content, 'User Node', ['Manual Override']);
    if(window.__toast) window.__toast.success('新神经元凝结成功');
    loadData();
  } catch (e) {
    if(window.__toast) window.__toast.error('写入失败: ' + e.message);
  }
}

function asyncPrompt(message: string, defaultValue: string = ''): Promise<string | null> {
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

function asyncConfirm(message: string): Promise<boolean> {
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

function asyncConfirmCustom(titleText: string, mergeText: string, overwriteText: string): Promise<'merge' | 'overwrite' | null> {
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
      const selected = (box.querySelector('input[name="importMode"]:checked') as HTMLInputElement).value as any;
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
window._togglePinMemory = async (id: string, pinState: number) => {
  try {
    await api.put(`/memory/${id}/pin`, { isPinned: pinState === 1 });
    if (window.__toast) window.__toast.success(pinState === 1 ? '已成功置顶常驻该记忆' : '已成功取消该记忆的常驻置顶');
    else alert(pinState === 1 ? '已置顶常驻该记忆！' : '已取消常驻置顶！');
    loadData();
  } catch (e: any) {
    if (window.__toast) window.__toast.error('置顶操作失败: ' + e.message);
    else alert('置顶操作失败: ' + e.message);
  }
};
