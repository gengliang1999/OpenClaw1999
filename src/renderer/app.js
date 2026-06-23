/**
 * OpenClaw 智能助手 — 主应用入口
 * 负责：Hash 路由管理、侧边栏导航、页面切换动画、全局通知
 */

import toast from './components/toast.js';

/* ======================== 路由配置 ======================== */
const ROUTES = [
  { path: 'chat',    label: '新建对话', shortLabel: '新建', icon: '💬', module: './pages/chat.js' },
  { path: 'experts', label: '专家中心', shortLabel: '专家', icon: '👨‍🏫', module: './pages/experts.js' },
  { path: 'memory',  label: '记忆',     shortLabel: '记忆', icon: '🧠', module: './pages/memory.js' },
  { path: 'skills',  label: '技能库',   shortLabel: '技能', icon: '🛠️', module: './pages/skills.js' },
  { path: 'plugins', label: '应用市场', shortLabel: '插件', icon: '🔌', module: './pages/plugins.js' },
  { path: 'market',  label: '模型市场', shortLabel: '模型', icon: '🛒', module: './pages/market.js' },
  { path: 'settings',label: '设置',     shortLabel: '设置', icon: '⚙️', module: './pages/settings.js' },
];

// 页面模块缓存
const pageModules = {};
// 当前路由
let currentRoute = '';
// 当前模型名称
let currentModel = 'GPT-4o';

/* ======================== 应用初始化 ======================== */
function init() {
  renderShell();
  bindRouteEvents();
  // 根据当前 hash 或默认跳转到聊天页
  navigateTo(getRouteFromHash() || 'chat');
}

/**
 * 从 URL hash 中提取路由路径
 */
function getRouteFromHash() {
  const hash = window.location.hash.replace('#/', '').replace('#', '');
  return hash || '';
}

/**
 * 渲染应用外壳（侧边栏 + 主内容区域）
 */
function renderShell() {
  const root = document.getElementById('root');
  root.innerHTML = `
    <!-- 顶部拖拽区 -->
    <div class="drag-region"></div>

    <!-- 侧边栏 -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-logo">
        <div class="logo-icon">🐾</div>
        <span class="logo-text">OpenClaw</span>
      </div>
      <nav class="sidebar-nav" id="sidebarNav">
        ${ROUTES.filter(r => r.path !== 'settings' && r.path !== 'chat').map(r => `
          <div class="sidebar-nav-item" data-route="${r.path}" title="${r.label}">
            <span class="nav-label">${r.label}</span>
          </div>
        `).join('')}
      </nav>

      <!-- 新建对话按钮 -->
      <div id="sidebarNewChatBtn" style="margin: 8px 4px; padding: 8px 12px; border-radius: 10px; background: var(--primary); color: #fff; text-align: center; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
        ✨ 新建对话
      </div>

      <!-- 搜索会话 -->
      <div class="nav-label" style="padding: 8px 4px; margin-top: 8px;">
        <input type="text" id="sidebarConvSearch" placeholder="🔍 搜索会话..." style="width: 100%; height: 30px; border-radius: 16px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 12px; padding: 0 10px; box-sizing: border-box; outline: none;" />
      </div>

      <!-- 会话列表 -->
      <div id="sidebarConvList" tabindex="0" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 4px; min-height: 0; outline: none; scrollbar-width: thin; scrollbar-color: var(--border-color) transparent;"></div>

      <!-- 底部：版本 + 设置 -->
      <div style="margin-top: auto; padding-top: 8px; border-top: 1px solid var(--border-light);">
        <div class="sidebar-nav-item" data-route="settings" title="设置" style="margin-bottom: 4px;">
          <span class="nav-label">设置</span>
        </div>
        <div class="nav-label" style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 4px 0;">v1.0.0</div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 页面容器 -->
      <div class="page-container" id="pageContainer"></div>
    </div>
  `;

  // 加载会话列表
  loadSidebarConversations();

  // 搜索会话
  document.getElementById('sidebarConvSearch')?.addEventListener('input', (e) => {
    loadSidebarConversations(e.target.value.trim());
  });

  // 新建对话按钮
  document.getElementById('sidebarNewChatBtn')?.addEventListener('click', async () => {
    if (currentRoute !== 'chat') {
      await navigateTo('chat');
    }
    // 等 chat 页面 render 完成后调用
    setTimeout(() => {
      if (typeof window.__createNewChat === 'function') {
        window.__createNewChat();
      }
    }, 200);
  });
}

// 侧边栏会话搜索关键词
let sidebarConvSearchQuery = '';

/**
 * 加载侧边栏会话列表
 */
async function loadSidebarConversations(query = '') {
  sidebarConvSearchQuery = query;
  const listEl = document.getElementById('sidebarConvList');
  if (!listEl) return;

  let conversations = [];
  try {
    conversations = await window.openClaw.chat.getConversations() || [];
  } catch(e) { conversations = []; }

  // 过滤
  if (query) {
    const q = query.toLowerCase();
    conversations = conversations.filter(c => (c.title || '').toLowerCase().includes(q));
  }

  if (conversations.length === 0) {
    listEl.innerHTML = `<div style="text-align:center; padding:16px 8px; color:var(--text-muted); font-size:12px;">${query ? '无匹配会话' : '暂无会话'}</div>`;
    return;
  }

  listEl.innerHTML = conversations.map(c => `
    <div class="sidebar-conv-item" data-conv-id="${c.id}" title="${escapeHtml(c.title || '新对话')}" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer; transition: background 0.15s; font-size:13px; color:var(--text-primary); overflow:hidden;">
      <span style="flex-shrink:0; font-size:14px;">💬</span>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.title || '新对话')}</span>
      <span class="sidebar-conv-delete" data-conv-id="${c.id}" style="flex-shrink:0; opacity:0; cursor:pointer; font-size:14px; color:var(--text-muted); padding:0 2px; transition:opacity 0.15s;" title="删除">&times;</span>
    </div>
  `).join('');

  // 点击会话 → 跳转聊天页并加载
  listEl.querySelectorAll('.sidebar-conv-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.sidebar-conv-delete')) return;
      const convId = el.dataset.convId;
      navigateTo('chat');
      // 等页面加载完成后加载历史
      setTimeout(() => {
        if (typeof window.__loadChatHistory === 'function') {
          window.__loadChatHistory(convId);
        }
      }, 300);
    });

    // hover 显示删除按钮
    el.addEventListener('mouseenter', () => {
      const del = el.querySelector('.sidebar-conv-delete');
      if (del) del.style.opacity = '1';
    });
    el.addEventListener('mouseleave', () => {
      const del = el.querySelector('.sidebar-conv-delete');
      if (del) del.style.opacity = '0';
    });
  });

  // 高亮当前选中项
  let selectedIdx = -1;
  const items = listEl.querySelectorAll('.sidebar-conv-item');
  function highlightItem(idx) {
    items.forEach((it, i) => {
      it.style.background = i === idx ? 'var(--bg-hover)' : '';
    });
    if (idx >= 0 && items[idx]) {
      items[idx].scrollIntoView({ block: 'nearest' });
    }
  }

  // 键盘方向键导航
  listEl.onkeydown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
      highlightItem(selectedIdx);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIdx = Math.max(selectedIdx - 1, 0);
      highlightItem(selectedIdx);
    } else if (e.key === 'Enter' && selectedIdx >= 0 && items[selectedIdx]) {
      e.preventDefault();
      items[selectedIdx].click();
    }
  };

  // 删除会话
  listEl.querySelectorAll('.sidebar-conv-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const convId = btn.dataset.convId;
      try {
        await window.openClaw.chat.deleteConversation(convId);
        window.__toast?.success('会话已删除');
        loadSidebarConversations(sidebarConvSearchQuery);
        // 如果删除的是当前活跃会话，通知聊天页
        if (typeof window.__onConvDeleted === 'function') {
          window.__onConvDeleted(convId);
        }
      } catch(err) {
        window.__toast?.error('删除失败: ' + err.message);
      }
    });
  });
}

/**
 * 刷新侧边栏会话列表（供聊天页调用）
 */
export function refreshSidebarConversations() {
  loadSidebarConversations(sidebarConvSearchQuery);
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * 绑定路由相关事件
 */
function bindRouteEvents() {
  // 侧边栏点击导航（包括底部设置按钮）
  const sidebar = document.getElementById('sidebar');
  sidebar.addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-nav-item');
    if (!item) return;
    const route = item.dataset.route;
    if (route) navigateTo(route);
  });

  // 浏览器 hash 变化
  window.addEventListener('hashchange', () => {
    const route = getRouteFromHash();
    if (route && route !== currentRoute) {
      navigateTo(route);
    }
  });
}

/**
 * 导航到指定页面
 * @param {string} route - 路由路径
 */
async function navigateTo(route) {
  if (route === currentRoute) return;

  const routeConfig = ROUTES.find(r => r.path === route);
  if (!routeConfig) {
    toast.error(`未知页面：${route}`);
    return;
  }

  // 更新 hash（不触发重复导航）
  window.location.hash = `#/${route}`;
  currentRoute = route;

  // 更新侧边栏激活状态
  updateActiveNav(route);

  // 加载并渲染页面
  const container = document.getElementById('pageContainer');

  try {
    // 页面切出动画
    if (container.firstElementChild) {
      container.firstElementChild.style.animation = 'fadeOut 0.15s ease forwards';
      await sleep(150);
    }

    // 清空容器
    container.innerHTML = '';

    // 动态导入页面模块（带缓存）
    if (!pageModules[route]) {
      pageModules[route] = await import(routeConfig.module);
    }

    const pageModule = pageModules[route];

    // 创建页面容器
    const pageEl = document.createElement('div');
    pageEl.className = 'page';
    pageEl.id = `page-${route}`;
    container.appendChild(pageEl);

    // 调用页面渲染函数
    if (typeof pageModule.render === 'function') {
      await pageModule.render(pageEl);
    }

    // 调用页面初始化函数（绑定事件等）
    if (typeof pageModule.init === 'function') {
      await pageModule.init(pageEl);
    }
  } catch (err) {
    console.error(`加载页面 [${route}] 失败:`, err);
    container.innerHTML = `
      <div class="page" style="display:flex;align-items:center;justify-content:center;">
        <div class="empty-state">
          <div class="empty-icon">😵</div>
          <div class="empty-title">页面加载失败</div>
          <div class="empty-desc" style="white-space:pre-wrap;text-align:left;">${err.message}\n${err.stack}</div>
          <button class="btn btn-primary" onclick="location.reload()">重新加载</button>
        </div>
      </div>
    `;
    toast.error(`加载页面失败：${err.message}`);
  }
}

/**
 * 更新侧边栏导航激活状态
 */
function updateActiveNav(route) {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.querySelectorAll('.sidebar-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.route === route);
  });
}

/**
 * 更新顶部模型名称
 * @param {string} name - 模型名称
 */
export function setModelName(name) {
  currentModel = name;
  const el = document.getElementById('modelName');
  if (el) el.textContent = name;
}

/**
 * 工具函数：延时
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 将 toast 挂到全局方便页面使用
window.__toast = toast;

// 启动应用
document.addEventListener('DOMContentLoaded', init);
