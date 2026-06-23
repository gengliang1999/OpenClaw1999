/**
 * OpenClaw 智能助手 — 主应用入口
 * 负责：Hash 路由管理、侧边栏导航、页面切换动画、全局通知
 */

import toast from './components/toast.js';

/* ======================== 路由配置 ======================== */
const ROUTES = [
  { path: 'chat',    label: '聊天对话', shortLabel: '聊天会话', icon: '💬', module: './pages/chat.js' },
  { path: 'experts', label: '专家中心', shortLabel: '专家中心', icon: '👨‍🏫', module: './pages/experts.js' },
  { path: 'memory',  label: '记忆',     shortLabel: '记忆', icon: '🧠', module: './pages/memory.js' },
  { path: 'skills',  label: '技能库',   shortLabel: '技能库', icon: '🛠️', module: './pages/skills.js' },
  { path: 'plugins', label: '应用市场', shortLabel: '插件库', icon: '🔌', module: './pages/plugins.js' },
  { path: 'market',  label: '模型市场', shortLabel: '模型市场', icon: '🛒', module: './pages/market.js' },
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
        ${ROUTES.map(r => `
          <div class="sidebar-nav-item" data-route="${r.path}" title="${r.label}">
            <span class="nav-label">${r.label}</span>
          </div>
        `).join('')}
      </nav>
      <div style="margin-top: auto; padding-top: 12px;">
        <div class="nav-label" style="font-size: 11px; color: var(--text-muted); text-align: center;">v1.0.0</div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 页面容器 -->
      <div class="page-container" id="pageContainer"></div>
    </div>
  `;
}

/**
 * 绑定路由相关事件
 */
function bindRouteEvents() {
  // 侧边栏点击导航
  const nav = document.getElementById('sidebarNav');
  nav.addEventListener('click', (e) => {
    const item = e.target.closest('.sidebar-nav-item');
    if (!item) return;
    const route = item.dataset.route;
    navigateTo(route);
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
  const navItems = document.querySelectorAll('.sidebar-nav-item');
  navItems.forEach(item => {
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
