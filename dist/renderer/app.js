// @ts-nocheck
/**
 * OpenClaw 智能助手 — 主应用入口
 * 负责：Hash 路由管理、侧边栏导航、页面切换动画、全局通知
 */
import toast from './components.js';
import { api, safeImgSrc } from './utils.js';
/* ======================== 路由配置 ======================== */
const ROUTES = [
    { path: 'chat', label: '新建对话', shortLabel: '新建', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', module: './pages/chat.js' },
    { path: 'experts', label: '专家中心', shortLabel: '专家', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>', module: './pages/experts.js' },
    { path: 'memory', label: '核心记忆', shortLabel: '记忆', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>', module: './pages/memory.js' },
    { path: 'knowledge', label: '知识仓库', shortLabel: '知识', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>', module: './pages/knowledge.js' },
    { path: 'skills', label: '技能库', shortLabel: '技能', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>', module: './pages/skills.js' },
    { path: 'plugins', label: '插件市场', shortLabel: '插件', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>', module: './pages/plugins.js' },
    { path: 'market', label: '模型市场', shortLabel: '模型', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>', module: './pages/market.js' },
    { path: 'core-manager', label: '内核管控台', shortLabel: '内核', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></svg>', module: './pages/core-manager.js' },
    { path: 'settings', label: '设置', shortLabel: '设置', icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', module: './pages/settings.js' },
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
    bindGlobalShortcuts();
    // 根据当前 hash 或默认跳转到聊天页
    navigateTo(getRouteFromHash() || 'chat');
}
/**
 * 绑定全局快捷键（如 ESC 关闭弹窗）
 */
function bindGlobalShortcuts() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            // 聊天页弹窗
            const modelSelectionModal = document.getElementById('modelSelectionModal');
            if (modelSelectionModal && modelSelectionModal.style.display === 'flex') {
                modelSelectionModal.style.display = 'none';
                return;
            }
            const attachmentPreview = document.getElementById('attachmentPreview');
            if (attachmentPreview && attachmentPreview.style.display === 'flex') {
                document.getElementById('removeAttachmentBtn')?.click();
                return;
            }
            const quotePreview = document.getElementById('quotePreview');
            if (quotePreview && quotePreview.style.display === 'flex') {
                document.getElementById('closeQuoteBtn')?.click();
                return;
            }
            // 市场页弹窗
            const cloudConfigModal = document.getElementById('cloudConfigModal');
            if (cloudConfigModal && cloudConfigModal.classList.contains('visible')) {
                cloudConfigModal.classList.remove('visible');
                return;
            }
            const installGuideModal = document.getElementById('installGuideModal');
            if (installGuideModal && installGuideModal.style.display === 'flex') {
                installGuideModal.style.display = 'none';
                return;
            }
            const localModelsModal = document.getElementById('localModelsModal');
            if (localModelsModal && localModelsModal.style.display === 'flex') {
                localModelsModal.style.display = 'none';
                return;
            }
            // 全局上下文菜单
            const contextMenus = document.querySelectorAll('.conv-context-menu');
            if (contextMenus.length > 0) {
                contextMenus.forEach(m => m.remove());
                return;
            }
            // 重命名输入框取消
            const renameInputs = document.querySelectorAll('.rename-input-container');
            if (renameInputs.length > 0) {
                document.getElementById('renameCancel')?.click();
                return;
            }
        }
    });
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
      <!-- 拖拽调整宽度的把手 -->
      <div class="sidebar-resizer" id="sidebarResizer" style="display: none;">
        <div class="resizer-handle"></div>
      </div>
      
      <div class="sidebar-logo" id="sidebarLogo" title="点击更换Logo" style="cursor: pointer;">
        <div class="logo-icon" id="logoIcon">🐾</div>
        <span class="logo-text">OpenClaw</span>
      </div>
      <nav class="sidebar-nav" id="sidebarNav">
        ${ROUTES.filter(r => r.path !== 'settings' && r.path !== 'chat').map(r => `
          <div class="sidebar-nav-item" data-route="${r.path}" title="${r.label}">
            <div class="nav-icon">${r.icon}</div>
            <span class="nav-label">${r.label}</span>
          </div>
        `).join('')}

        <!-- 搜索会话 -->
        <div style="padding: 4px;">
          <input type="text" id="sidebarConvSearch" placeholder="🔍 搜索会话..." style="width: 100%; height: 28px; border-radius: 14px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-primary); font-size: 12px; padding: 0 10px; box-sizing: border-box; outline: none;" />
        </div>

        <!-- 新建对话按钮 -->
        <div id="sidebarNewChatBtn" style="margin: 2px 4px; padding: 7px 12px; border-radius: 10px; background: var(--primary); color: #fff; text-align: center; cursor: pointer; font-size: 13px; font-weight: 600; transition: all 0.2s;">
          ✨ 新建对话
        </div>

        <!-- 会话列表 -->
        <div id="sidebarConvList" tabindex="0" style="flex: 1; overflow-y: auto; overflow-x: hidden; padding: 2px; min-height: 0; outline: none; scrollbar-width: thin; scrollbar-color: var(--border-color) transparent;"></div>
      </nav>

      <!-- 底部：垃圾篓 + 设置 + 版本号 -->
      <div id="sidebarTrashArea" style="margin-top: auto; padding-top: 6px; border-top: 1px solid var(--border-light); display: flex; flex-direction: column;">
        <div id="sidebarTrashBtn" style="display: none; margin: 2px 4px 4px 4px; padding: 6px 12px; border-radius: 10px; background: rgba(255,59,48,0.1); color: #ff3b30; text-align: center; cursor: pointer; font-size: 12px; font-weight: 500; transition: all 0.2s; border: 1px solid rgba(255,59,48,0.2);">
          🗑️ 垃圾篓
        </div>
        <div style="display: flex; align-items: center; justify-content: flex-start; gap: 8px; padding: 6px 10px; margin: 4px 6px; background: rgba(0,0,0,0.02); border-radius: var(--radius-sm); border: 1px solid var(--border-light); transition: all 0.25s;" class="sidebar-bottom-controls">
          <!-- 主题切换按钮 -->
          <div id="themeToggleBtn" class="sidebar-bottom-btn" title="切换亮/暗模式">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          </div>
          <!-- 通用设置按钮 (纯图标化并保留路由代理类名) -->
          <div class="sidebar-nav-item sidebar-bottom-btn" data-route="settings" title="设置">
            <div class="nav-icon">${ROUTES.find(r => r.path === 'settings').icon}</div>
          </div>
          <!-- 展开/收起侧边栏按钮 -->
          <div id="sidebarBottomToggleBtn" class="sidebar-bottom-btn sidebar-bottom-toggle" title="展开/收起侧边栏">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
          </div>
        </div>
        <div class="nav-label" style="font-size: 9px; color: var(--text-muted); text-align: center; padding: 2px 0; opacity: 0.6;">v1.0.0</div>
      </div>
    </aside>

    <!-- 主内容区域 -->
    <div class="main-content">
      <!-- 页面容器 -->
      <div class="page-container" id="pageContainer"></div>
    </div>

    <!-- 隐藏的Logo上传输入 -->
    <input type="file" id="logoUploadInput" accept="image/*" style="display: none;" />
  `;
    // 加载会话列表
    loadSidebarConversations();
    // 搜索会话
    document.getElementById('sidebarConvSearch')?.addEventListener('input', (e) => {
        // 搜索时清空批量选择，避免隐藏项被误删
        if (batchMode) {
            batchSelected.clear();
        }
        loadSidebarConversations(e.target.value.trim());
    });
    // 新建对话按钮
    document.getElementById('sidebarNewChatBtn')?.addEventListener('click', async () => {
        if (currentRoute !== 'chat') {
            // 预设 'NEW' 哨兵，让 chat.js init() 知道要创建新对话
            if (typeof window.__setPendingConv === 'function') {
                window.__setPendingConv('NEW');
            }
            await navigateTo('chat');
        }
        else {
            // 已在聊天页，直接创建
            if (typeof window.__createNewChat === 'function') {
                await window.__createNewChat();
            }
        }
    });
    // 垃圾篓按钮
    document.getElementById('sidebarTrashBtn')?.addEventListener('click', () => {
        showTrashPanel();
    });
    // 初始加载垃圾篓状态
    updateTrashBadge();
    // Logo 上传功能
    initLogoUpload();
}
/**
 * 初始化 Logo 上传功能
 */
function initLogoUpload() {
    const logoEl = document.getElementById('sidebarLogo');
    const uploadInput = document.getElementById('logoUploadInput');
    const logoIcon = document.getElementById('logoIcon');
    if (!logoEl || !uploadInput)
        return;
    // 加载保存的自定义 Logo
    const savedLogo = localStorage.getItem('openclaw_custom_logo');
    if (savedLogo) {
        const safeLogo = safeImgSrc(savedLogo);
        if (safeLogo) {
            logoIcon.innerHTML = `<img src="${safeLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
        }
    }
    // 点击 Logo 触发上传
    logoEl.addEventListener('click', (e) => {
        // 如果右键菜单打开则不触发
        if (document.querySelector('.conv-context-menu'))
            return;
        uploadInput.click();
    });
    // 右键 Logo 可恢复默认
    logoEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        if (localStorage.getItem('openclaw_custom_logo')) {
            const menu = document.createElement('div');
            menu.className = 'conv-context-menu';
            menu.style.cssText = `position:fixed; left:${e.clientX}px; top:${e.clientY}px; z-index:100001;`;
            const restoreItem = document.createElement('div');
            restoreItem.className = 'conv-context-item';
            restoreItem.innerHTML = '<span>🔄</span> <span>恢复默认Logo</span>';
            restoreItem.onclick = () => {
                localStorage.removeItem('openclaw_custom_logo');
                logoIcon.innerHTML = '🐾';
                menu.remove();
                window.__toast?.success('已恢复默认Logo');
            };
            menu.appendChild(restoreItem);
            document.body.appendChild(menu);
            setTimeout(() => {
                document.addEventListener('click', () => menu.remove(), { once: true });
            }, 0);
        }
    });
    // 文件选择处理
    uploadInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file)
            return;
        // 验证文件类型
        if (!file.type.startsWith('image/')) {
            window.__toast?.error('请选择图片文件');
            return;
        }
        // 验证文件大小（限制 2MB）
        if (file.size > 2 * 1024 * 1024) {
            window.__toast?.error('图片大小不能超过 2MB');
            return;
        }
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            // 保存到 localStorage
            localStorage.setItem('openclaw_custom_logo', dataUrl);
            // 更新 Logo 显示
            const safeLogo = safeImgSrc(dataUrl);
            if (safeLogo) {
                logoIcon.innerHTML = `<img src="${safeLogo}" style="width:100%; height:100%; object-fit:cover; border-radius:inherit;" />`;
            }
            else {
                window.__toast?.error('Logo 格式不安全，已拒绝显示');
            }
            window.__toast?.success('Logo 已更新');
        };
        reader.readAsDataURL(file);
        // 清空 input 以便重复选择同一文件
        uploadInput.value = '';
    });
}
// 侧边栏会话搜索关键词
let sidebarConvSearchQuery = '';
// 批量管理模式状态
let batchMode = false;
let batchSelected = new Set();
let batchEscHandler = null;
/**
 * 加载侧边栏会话列表
 */
async function loadSidebarConversations(query = '') {
    sidebarConvSearchQuery = query;
    const listEl = document.getElementById('sidebarConvList');
    if (!listEl)
        return;
    let conversations = [];
    try {
        conversations = await api.chat.getConversations() || [];
    }
    catch (e) {
        conversations = [];
    }
    // 按搜索关键词过滤
    if (query) {
        const q = query.toLowerCase();
        conversations = conversations.filter(c => (c.title || '').toLowerCase().includes(q));
    }
    if (conversations.length === 0) {
        listEl.innerHTML = `<div style="text-align:center; padding:16px 8px; color:var(--text-muted); font-size:12px;">${query ? '无匹配会话' : '暂无会话'}</div>`;
        return;
    }
    // 批量管理模式工具栏
    let batchToolbar = '';
    if (batchMode) {
        batchToolbar = `
      <div class="batch-toolbar" style="display:flex; align-items:center; gap:5px; padding:5px 6px; margin-bottom:6px; border-radius:8px; background:var(--bg-hover); border:1px solid var(--border-light); box-shadow:var(--shadow-sm); box-sizing:border-box; width:100%; overflow-x:auto; justify-content:flex-start;">
        <label style="display:flex; align-items:center; gap:3px; font-size:11px; font-weight:500; cursor:pointer; color:var(--text-primary); white-space:nowrap; flex-shrink:0; width:62px;">
          <input type="checkbox" id="batchSelectAll" style="cursor:pointer;" /> 全选${batchSelected.size > 0 ? `(${batchSelected.size})` : ''}
        </label>
        <button id="batchExportBtn" style="font-size:11px; padding:3px 0; width:38px; text-align:center; border-radius:4px; border:1px solid var(--primary); background:transparent; color:var(--primary); cursor:pointer; font-weight:500; white-space:nowrap; flex-shrink:0; transition:all 0.15s;" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background='transparent'">导出</button>
        <button id="batchDeleteBtn" style="font-size:11px; padding:3px 0; width:38px; text-align:center; border-radius:4px; border:none; background:#ff3b30; color:#fff; cursor:pointer; font-weight:500; white-space:nowrap; flex-shrink:0; transition:all 0.15s;" onmouseover="this.style.background='#e0241b'" onmouseout="this.style.background='#ff3b30'">删除</button>
        <button id="batchCancelBtn" style="font-size:11px; padding:3px 0; width:38px; text-align:center; border-radius:4px; border:1px solid var(--border-color); background:transparent; color:var(--text-muted); cursor:pointer; white-space:nowrap; flex-shrink:0; transition:all 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">取消</button>
      </div>
    `;
    }
    listEl.innerHTML = batchToolbar + conversations.map(c => {
        const checked = batchSelected.has(c.id) ? 'checked' : '';
        const checkboxHtml = batchMode ? `<input type="checkbox" class="batch-conv-checkbox" data-conv-id="${c.id}" ${checked} style="flex-shrink:0; cursor:pointer;" />` : '';
        return `
    <div class="sidebar-conv-item" data-conv-id="${c.id}" title="${escapeHtml(c.title || '新对话')}" style="display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:8px; cursor:pointer; transition: background 0.15s; font-size:13px; color:var(--text-primary); overflow:hidden;">
      ${checkboxHtml}
      <span style="flex-shrink:0; font-size:14px;">💬</span>
      <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(c.title || '新对话')}</span>
      ${batchMode ? '' : '<span class="sidebar-conv-more" data-conv-id="' + c.id + '" style="flex-shrink:0; opacity:0; cursor:pointer; font-size:16px; color:var(--text-muted); padding:0 4px; transition:opacity 0.15s; letter-spacing:1px;" title="更多">⋯</span>'}
    </div>
  `;
    }).join('');
    // 批量模式事件
    if (batchMode) {
        const toolbar = document.querySelector('.batch-toolbar');
        if (toolbar) {
            toolbar.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    toolbar.scrollLeft += e.deltaY;
                }
            }, { passive: false });
        }
        const selectAll = document.getElementById('batchSelectAll');
        if (selectAll) {
            selectAll.checked = conversations.length > 0 && conversations.every(c => batchSelected.has(c.id));
            selectAll.addEventListener('change', () => {
                if (selectAll.checked) {
                    conversations.forEach(c => batchSelected.add(c.id));
                }
                else {
                    batchSelected.clear();
                }
                loadSidebarConversations(sidebarConvSearchQuery);
            });
        }
        document.querySelectorAll('.batch-conv-checkbox').forEach(cb => {
            cb.addEventListener('change', () => {
                if (cb.checked)
                    batchSelected.add(cb.dataset.convId);
                else
                    batchSelected.delete(cb.dataset.convId);
            });
        });
        document.getElementById('batchDeleteBtn')?.addEventListener('click', async () => {
            if (batchSelected.size === 0) {
                window.__toast?.info('请先选择要删除的会话');
                return;
            }
            const { showModal } = await import('./components.js');
            const ok = await showModal({ title: '批量删除', content: `确定将选中的 ${batchSelected.size} 个会话移入垃圾篓吗？`, confirmText: '删除', danger: true });
            if (!ok)
                return;
            for (const id of batchSelected) {
                try {
                    await api.chat.moveToTrash(id);
                }
                catch (e) { }
                if (typeof window.__onConvDeleted === 'function')
                    window.__onConvDeleted(id);
            }
            window.__toast?.success(`已将 ${batchSelected.size} 个会话移入垃圾篓`);
            batchSelected.clear();
            exitBatchMode();
            loadSidebarConversations(sidebarConvSearchQuery);
            updateTrashBadge();
        });
        document.getElementById('batchExportBtn')?.addEventListener('click', () => {
            if (batchSelected.size === 0) {
                window.__toast?.info('请先选择要导出的会话');
                return;
            }
            batchExportConversationUI(Array.from(batchSelected));
        });
        document.getElementById('batchCancelBtn')?.addEventListener('click', () => {
            exitBatchMode();
            loadSidebarConversations(sidebarConvSearchQuery);
        });
    }
    // 点击会话 → 跳转聊天页并加载
    listEl.querySelectorAll('.sidebar-conv-item').forEach(el => {
        el.addEventListener('click', async (e) => {
            if (e.target.closest('.batch-conv-checkbox'))
                return;
            if (batchMode)
                return;
            const convId = el.dataset.convId;
            // 预设待加载会话 ID，让 chat.js init() 知道要加载哪个会话
            if (typeof window.__setPendingConv === 'function') {
                window.__setPendingConv(convId);
            }
            const prevRoute = currentRoute;
            await navigateTo('chat');
            // 如果已在 chat 页（navigateTo 早退），init() 不会再执行，直接加载
            if (prevRoute === 'chat' && typeof window.__loadChatHistory === 'function') {
                await window.__loadChatHistory(convId);
            }
        });
        // hover 显示更多按钮由 CSS .sidebar-conv-item:hover .sidebar-conv-more 控制
        // 更多按钮点击事件
        const moreBtn = el.querySelector('.sidebar-conv-more');
        if (moreBtn) {
            moreBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const rect = moreBtn.getBoundingClientRect();
                showConvContextMenu(el.dataset.convId, rect.right, rect.top);
            });
        }
        // 右键上下文菜单
        el.addEventListener('contextmenu', (e) => {
            if (batchMode)
                return;
            e.preventDefault();
            showConvContextMenu(el.dataset.convId, e.clientX, e.clientY);
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
    listEl.onkeydown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            selectedIdx = Math.min(selectedIdx + 1, items.length - 1);
            highlightItem(selectedIdx);
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            selectedIdx = Math.max(selectedIdx - 1, 0);
            highlightItem(selectedIdx);
        }
        else if (e.key === 'Enter' && selectedIdx >= 0 && items[selectedIdx]) {
            e.preventDefault();
            items[selectedIdx].click();
        }
    };
}
/** 进入批量管理模式 */
function enterBatchMode() {
    batchMode = true;
    batchSelected.clear();
    if (!batchEscHandler) {
        batchEscHandler = (e) => {
            if (e.key === 'Escape' && batchMode) {
                exitBatchMode();
                loadSidebarConversations(sidebarConvSearchQuery);
            }
        };
        window.addEventListener('keydown', batchEscHandler);
    }
    loadSidebarConversations(sidebarConvSearchQuery);
}
/** 退出批量管理模式 */
function exitBatchMode() {
    batchMode = false;
    batchSelected.clear();
    if (batchEscHandler) {
        window.removeEventListener('keydown', batchEscHandler);
        batchEscHandler = null;
    }
}
/**
 * 显示会话上下文菜单
 */
function showConvContextMenu(convId, x, y) {
    closeConvContextMenu();
    const menu = document.createElement('div');
    menu.className = 'conv-context-menu';
    menu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:100001;`;
    const items = [
        { icon: '✏️', label: '重命名', action: () => renameConversationUI(convId) },
        { icon: '📤', label: '导出对话', action: () => exportConversationUI(convId) },
        { icon: '🗑️', label: '删除', action: () => deleteConversationUI(convId), danger: true },
        { divider: true },
        { icon: '☑️', label: '批量管理', action: () => enterBatchMode() },
    ];
    items.forEach(item => {
        if (item.divider) {
            const div = document.createElement('div');
            div.className = 'conv-context-divider';
            menu.appendChild(div);
            return;
        }
        const row = document.createElement('div');
        row.className = 'conv-context-item' + (item.danger ? ' danger' : '');
        row.innerHTML = `<span>${item.icon}</span> <span>${item.label}</span>`;
        row.addEventListener('click', () => {
            closeConvContextMenu();
            item.action();
        });
        menu.appendChild(row);
    });
    document.body.appendChild(menu);
    // 边界修正
    const rect = menu.getBoundingClientRect();
    if (rect.right > window.innerWidth)
        menu.style.left = (window.innerWidth - rect.width - 8) + 'px';
    if (rect.bottom > window.innerHeight)
        menu.style.top = (window.innerHeight - rect.height - 8) + 'px';
    if (rect.left < 0)
        menu.style.left = '8px';
    if (rect.top < 0)
        menu.style.top = '8px';
    // 点击外部关闭
    setTimeout(() => {
        document.addEventListener('click', closeConvContextMenuHandler, { once: true });
        document.addEventListener('contextmenu', closeConvContextMenuHandler, { once: true });
    }, 0);
}
function closeConvContextMenuHandler() { closeConvContextMenu(); }
function closeConvContextMenu() {
    document.removeEventListener('click', closeConvContextMenuHandler);
    document.removeEventListener('contextmenu', closeConvContextMenuHandler);
    document.querySelectorAll('.conv-context-menu').forEach(el => el.remove());
}
/**
 * 重命名会话 UI
 */
async function renameConversationUI(convId) {
    const { showModal } = await import('./components.js');
    // 创建带输入框的 modal
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card); border-radius:16px; padding:24px; width:90%; max-width:400px; box-shadow:0 20px 40px rgba(0,0,0,0.2); transform:translateY(20px) scale(0.95); transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);';
    box.innerHTML = `
    <h3 style="margin:0 0 16px; font-size:18px; font-weight:600;">重命名对话</h3>
    <input type="text" id="renameInput" style="width:100%; padding:10px 12px; border-radius:8px; border:1px solid var(--border-color); background:var(--bg-app); color:var(--text-primary); font-size:14px; outline:none; box-sizing:border-box;" />
    <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:20px;">
      <button id="renameCancel" style="padding:8px 16px; border-radius:8px; border:1px solid var(--border-color); background:transparent; color:var(--text-primary); cursor:pointer;">取消</button>
      <button id="renameConfirm" style="padding:8px 16px; border-radius:8px; border:none; background:var(--primary); color:#fff; cursor:pointer; font-weight:500;">确定</button>
    </div>
  `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; box.style.transform = 'translateY(0) scale(1)'; });
    const input = document.getElementById('renameInput');
    // 获取当前标题
    try {
        const convs = await api.chat.getConversations();
        const conv = convs.find(c => c.id === convId);
        if (conv)
            input.value = conv.title || '';
    }
    catch (e) { }
    input.focus();
    input.select();
    return new Promise(resolve => {
        const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); resolve(); };
        document.getElementById('renameCancel').onclick = close;
        overlay.onclick = (e) => { if (e.target === overlay)
            close(); };
        document.getElementById('renameConfirm').onclick = async () => {
            const newTitle = input.value.trim();
            if (!newTitle) {
                window.__toast?.info('标题不能为空');
                return;
            }
            try {
                await api.chat.renameConversation(convId, newTitle);
                window.__toast?.success('已重命名');
                loadSidebarConversations(sidebarConvSearchQuery);
            }
            catch (e) {
                window.__toast?.error('重命名失败: ' + e.message);
            }
            close();
        };
        input.onkeydown = (e) => { if (e.key === 'Enter')
            document.getElementById('renameConfirm').click(); };
    });
}
/**
 * 导出对话 UI - 支持多种格式
 */
async function exportConversationUI(convId) {
    // 格式配置
    const formats = [
        { id: 'json', icon: '📋', label: 'JSON', desc: '完整数据，可备份恢复', ext: '.json' },
        { id: 'markdown', icon: '📝', label: 'Markdown', desc: '易读文本格式', ext: '.md' },
        { id: 'html', icon: '🌐', label: 'HTML', desc: '网页格式，带样式', ext: '.html' },
        { id: 'txt', icon: '📄', label: 'TXT', desc: '纯文本格式', ext: '.txt' },
        { id: 'pdf', icon: '📕', label: 'PDF', desc: '便携文档格式', ext: '.pdf' },
        { id: 'word', icon: '📘', label: 'Word', desc: 'Office 文档格式', ext: '.docx' },
        { id: 'png', icon: '🖼️', label: 'PNG', desc: '长截图格式', ext: '.png' },
    ];
    // 创建格式选择弹窗
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card); border-radius:16px; width:90%; max-width:420px; box-shadow:0 20px 40px rgba(0,0,0,0.2); transform:translateY(20px) scale(0.95); transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);';
    box.innerHTML = `
    <div style="padding:20px 24px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0; font-size:18px; font-weight:600;">📤 导出对话</h3>
      <button id="closeExportBtn" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">&times;</button>
    </div>
    <div style="padding:16px 20px;">
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">选择导出格式：</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${formats.map(f => `
          <div class="export-format-item" data-format="${f.id}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; border:1.5px solid var(--border-light); cursor:pointer; transition:all 0.2s;">
            <span style="font-size:24px;">${f.icon}</span>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:14px;">${f.label}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${f.desc}</div>
            </div>
            <span style="font-size:11px; color:var(--text-muted); background:var(--bg-hover); padding:2px 8px; border-radius:6px;">${f.ext}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; box.style.transform = 'translateY(0) scale(1)'; });
    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };
    document.getElementById('closeExportBtn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay)
        close(); };
    // 格式项 hover 效果
    box.querySelectorAll('.export-format-item').forEach(item => {
        item.onmouseenter = () => { item.style.borderColor = 'var(--primary)'; item.style.background = 'var(--primary-light)'; };
        item.onmouseleave = () => { item.style.borderColor = 'var(--border-light)'; item.style.background = 'transparent'; };
        item.onclick = async () => {
            const format = item.dataset.format;
            close();
            await doExport(convId, format);
        };
    });
}
/**
 * 批量导出对话 UI - 支持多种格式
 */
async function batchExportConversationUI(convIds) {
    const formats = [
        { id: 'json', icon: '📋', label: 'JSON', desc: '完整数据，可备份恢复', ext: '.json' },
        { id: 'markdown', icon: '📝', label: 'Markdown', desc: '易读文本格式', ext: '.md' },
        { id: 'html', icon: '🌐', label: 'HTML', desc: '网页格式，带样式', ext: '.html' },
        { id: 'txt', icon: '📄', label: 'TXT', desc: '纯文本格式', ext: '.txt' },
        { id: 'pdf', icon: '📕', label: 'PDF', desc: '便携文档格式', ext: '.pdf' },
        { id: 'word', icon: '📘', label: 'Word', desc: 'Office 文档格式', ext: '.docx' },
        { id: 'png', icon: '🖼️', label: 'PNG', desc: '长截图格式', ext: '.png' },
    ];
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card); border-radius:16px; width:90%; max-width:420px; box-shadow:0 20px 40px rgba(0,0,0,0.2); transform:translateY(20px) scale(0.95); transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);';
    box.innerHTML = `
    <div style="padding:20px 24px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0; font-size:18px; font-weight:600;">📤 批量导出对话 (${convIds.length} 个)</h3>
      <button id="closeBatchExportBtn" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">&times;</button>
    </div>
    <div style="padding:16px 20px;">
      <div style="font-size:13px; color:var(--text-muted); margin-bottom:12px;">选择导出格式：</div>
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${formats.map(f => `
          <div class="batch-export-format-item" data-format="${f.id}" style="display:flex; align-items:center; gap:12px; padding:12px 16px; border-radius:12px; border:1.5px solid var(--border-light); cursor:pointer; transition:all 0.2s;">
            <span style="font-size:24px;">${f.icon}</span>
            <div style="flex:1;">
              <div style="font-weight:600; font-size:14px;">${f.label}</div>
              <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">${f.desc}</div>
            </div>
            <span style="font-size:11px; color:var(--text-muted); background:var(--bg-hover); padding:2px 8px; border-radius:6px;">${f.ext}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; box.style.transform = 'translateY(0) scale(1)'; });
    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };
    document.getElementById('closeBatchExportBtn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay)
        close(); };
    box.querySelectorAll('.batch-export-format-item').forEach(item => {
        item.onmouseenter = () => { item.style.borderColor = 'var(--primary)'; item.style.background = 'var(--primary-light)'; };
        item.onmouseleave = () => { item.style.borderColor = 'var(--border-light)'; item.style.background = 'transparent'; };
        item.onclick = async () => {
            const format = item.dataset.format;
            close();
            window.__toast?.info(`正在批量导出 ${convIds.length} 个会话...`);
            let successCount = 0;
            let failCount = 0;
            for (const id of convIds) {
                try {
                    await doExport(id, format, true);
                    successCount++;
                }
                catch (e) {
                    failCount++;
                    console.error(`会话 ${id} 导出失败:`, e);
                }
            }
            if (failCount === 0) {
                window.__toast?.success(`🎉 批量导出成功！共导出 ${successCount} 个文件`);
            }
            else {
                window.__toast?.warning(`⚠️ 批量导出完成：成功 ${successCount}，失败 ${failCount}`);
            }
            // 导出完成后退出批量管理模式
            exitBatchMode();
            loadSidebarConversations(sidebarConvSearchQuery);
        };
    });
}
/**
 * 执行导出
 */
async function doExport(convId, format, silent = false) {
    try {
        if (!silent)
            window.__toast?.info('正在导出...');
        const data = await api.chat.exportConversation(convId);
        const safeName = (data.title || '对话').replace(/[<>:"/\\|?*]/g, '_');
        switch (format) {
            case 'json':
                downloadBlob(JSON.stringify(data, null, 2), `${safeName}.json`, 'application/json');
                break;
            case 'markdown':
                downloadBlob(convertToMarkdown(data), `${safeName}.md`, 'text/markdown');
                break;
            case 'html':
                downloadBlob(convertToHTML(data), `${safeName}.html`, 'text/html');
                break;
            case 'txt':
                downloadBlob(convertToTXT(data), `${safeName}.txt`, 'text/plain');
                break;
            case 'pdf':
                await exportToPDF(data, safeName);
                break;
            case 'word':
                await exportToWord(data, safeName);
                break;
            case 'png':
                await exportToPNG(data, safeName);
                break;
        }
        if (!silent)
            window.__toast?.success('导出成功');
    }
    catch (e) {
        console.error('导出失败:', e);
        if (!silent)
            window.__toast?.error('导出失败: ' + e.message);
        throw e;
    }
}
/**
 * 下载 Blob 文件
 */
function downloadBlob(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
/**
 * 转换为 Markdown 格式
 */
function convertToMarkdown(data) {
    let md = `# ${data.title || '对话'}\n\n`;
    md += `> 创建时间：${formatDate(data.created_at)}  \n`;
    md += `> 导出时间：${formatDate(data.exported_at)}\n\n`;
    md += `---\n\n`;
    (data.messages || []).forEach(msg => {
        const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **AI助手**';
        md += `${role}\n\n${msg.content}\n\n---\n\n`;
    });
    return md;
}
/**
 * 转换为 HTML 格式
 */
function convertToHTML(data) {
    const messages = (data.messages || []).map(msg => {
        const isUser = msg.role === 'user';
        return `
      <div class="message ${isUser ? 'user' : 'ai'}">
        <div class="avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="bubble">
          <div class="role">${isUser ? '用户' : 'AI助手'}</div>
          <div class="content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
        </div>
      </div>
    `;
    }).join('');
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title || '对话')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f7; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 24px; border-bottom: 1px solid #eee; }
    .header h1 { font-size: 24px; font-weight: 600; }
    .header .meta { font-size: 13px; color: #86868b; margin-top: 8px; }
    .messages { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
    .message { display: flex; gap: 12px; }
    .message.user { flex-direction: row-reverse; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #f0f0f0; flex-shrink: 0; }
    .message.user .avatar { background: #007aff; }
    .bubble { max-width: 70%; padding: 12px 16px; border-radius: 16px; background: #f0f0f0; }
    .message.user .bubble { background: #007aff; color: #fff; }
    .role { font-size: 12px; font-weight: 600; margin-bottom: 4px; opacity: 0.7; }
    .content { font-size: 14px; line-height: 1.6; }
    .footer { padding: 16px 24px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #86868b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.title || '对话')}</h1>
      <div class="meta">导出时间：${formatDate(data.exported_at)}</div>
    </div>
    <div class="messages">${messages}</div>
    <div class="footer">由 OpenClaw Assistant 导出</div>
  </div>
</body>
</html>`;
}
/**
 * 转换为 TXT 格式
 */
function convertToTXT(data) {
    let txt = `${data.title || '对话'}\n`;
    txt += `${'='.repeat(40)}\n`;
    txt += `创建时间：${formatDate(data.created_at)}\n`;
    txt += `导出时间：${formatDate(data.exported_at)}\n`;
    txt += `${'='.repeat(40)}\n\n`;
    (data.messages || []).forEach(msg => {
        const role = msg.role === 'user' ? '【用户】' : '【AI助手】';
        txt += `${role}\n${msg.content}\n\n${'-'.repeat(40)}\n\n`;
    });
    return txt;
}
/**
 * 动态加载外部脚本
 */
function loadExternalScript(url) {
    return new Promise((resolve, reject) => {
        // 检查是否已加载
        const existing = document.querySelector(`script[src="${url}"]`);
        if (existing) {
            resolve(window[url.split('/').pop().replace('.min.js', '').replace('.js', '')]);
            return;
        }
        const script = document.createElement('script');
        script.src = url;
        script.onload = () => resolve();
        script.onerror = reject;
        document.head.appendChild(script);
    });
}
/**
 * 导出为 PDF
 */
async function exportToPDF(data, filename) {
    // 动态加载 jsPDF
    await loadExternalScript('./assets/lib/jspdf.umd.min.js');
    await loadExternalScript('./assets/lib/html2pdf.bundle.min.js');
    // 创建临时 HTML
    const html = convertToHTML(data);
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    document.body.appendChild(container);
    try {
        await html2pdf().from(container).set({
            margin: 10,
            filename: `${filename}.pdf`,
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        }).save();
    }
    finally {
        container.remove();
    }
}
/**
 * 导出为 Word
 */
async function exportToWord(data, filename) {
    // 动态加载 docx 库
    await loadExternalScript('./assets/lib/docx.umd.js');
    const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;
    const children = [
        new Paragraph({
            children: [new TextRun({ text: data.title || '对话', bold: true, size: 36 })],
            heading: HeadingLevel.HEADING_1,
        }),
        new Paragraph({
            children: [new TextRun({ text: `导出时间：${formatDate(data.exported_at)}`, color: '86868b', size: 20 })],
        }),
        new Paragraph({ text: '' }),
    ];
    (data.messages || []).forEach(msg => {
        const isUser = msg.role === 'user';
        children.push(new Paragraph({
            children: [new TextRun({ text: isUser ? '👤 用户' : '🤖 AI助手', bold: true, size: 24 })],
        }));
        children.push(new Paragraph({
            children: [new TextRun({ text: msg.content, size: 22 })],
        }));
        children.push(new Paragraph({ text: '' }));
    });
    const doc = new Document({ sections: [{ children }] });
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.docx`;
    a.click();
    URL.revokeObjectURL(url);
}
/**
 * 导出为 PNG
 */
async function exportToPNG(data, filename) {
    // 动态加载 html2canvas
    await loadExternalScript('./assets/lib/html2canvas.min.js');
    // 创建临时 HTML 容器
    const html = convertToHTML(data);
    const container = document.createElement('div');
    container.innerHTML = html;
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    document.body.appendChild(container);
    try {
        const canvas = await html2canvas(container.querySelector('.container'), {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
        });
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename}.png`;
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }
    finally {
        container.remove();
    }
}
/**
 * 格式化日期
 */
function formatDate(dateStr) {
    if (!dateStr)
        return '';
    try {
        return new Date(dateStr).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }
    catch {
        return dateStr;
    }
}
/**
 * 删除会话 UI（移入垃圾篓）
 */
async function deleteConversationUI(convId) {
    const { showModal } = await import('./components.js');
    const ok = await showModal({ title: '删除对话', content: '确定将此对话移入垃圾篓吗？', confirmText: '删除', danger: true });
    if (!ok)
        return;
    try {
        await api.chat.moveToTrash(convId);
        window.__toast?.success('已移入垃圾篓');
        loadSidebarConversations(sidebarConvSearchQuery);
        if (typeof window.__onConvDeleted === 'function')
            window.__onConvDeleted(convId);
        updateTrashBadge();
    }
    catch (e) {
        window.__toast?.error('删除失败: ' + e.message);
    }
}
/**
 * 更新垃圾篓按钮显示状态
 */
async function updateTrashBadge() {
    try {
        const res = await api.chat.getTrashCount();
        const btn = document.getElementById('sidebarTrashBtn');
        if (btn)
            btn.style.display = (res && res.count > 0) ? 'block' : 'none';
    }
    catch (e) { }
}
/**
 * 显示垃圾篓面板
 */
async function showTrashPanel() {
    let trashItems = [];
    try {
        trashItems = await api.chat.getTrash() || [];
    }
    catch (e) { }
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed; inset:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(6px); z-index:100000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s;';
    const box = document.createElement('div');
    box.style.cssText = 'background:var(--bg-card); border-radius:16px; width:90%; max-width:480px; max-height:70vh; box-shadow:0 20px 40px rgba(0,0,0,0.2); display:flex; flex-direction:column; overflow:hidden; transform:translateY(20px) scale(0.95); transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);';
    const listHtml = trashItems.length === 0
        ? '<div style="text-align:center; padding:40px 16px; color:var(--text-muted);">垃圾篓为空</div>'
        : trashItems.map(t => `
      <div style="display:flex; align-items:center; gap:8px; padding:10px 12px; border-radius:8px; transition:background 0.15s;" class="trash-item-row">
        <span style="flex-shrink:0;">🗑️</span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:13px;">${escapeHtml(t.title || '无标题')}</span>
        <span style="flex-shrink:0; font-size:11px; color:var(--text-muted);">${new Date(t.deleted_at).toLocaleDateString()}</span>
        <button data-action="restore" data-id="${t.id}" style="font-size:11px; padding:3px 8px; border-radius:6px; border:1px solid var(--border-color); background:transparent; color:var(--text-primary); cursor:pointer;">恢复</button>
        <button data-action="permanent" data-id="${t.id}" style="font-size:11px; padding:3px 8px; border-radius:6px; border:none; background:#ff3b30; color:#fff; cursor:pointer;">永久删除</button>
      </div>
    `).join('');
    box.innerHTML = `
    <div style="padding:16px 20px; border-bottom:1px solid var(--border-light); display:flex; justify-content:space-between; align-items:center;">
      <h3 style="margin:0; font-size:16px;">🗑️ 垃圾篓</h3>
      <div style="display:flex; gap:8px; align-items:center;">
        ${trashItems.length > 0 ? '<button id="emptyTrashBtn" style="font-size:11px; padding:4px 10px; border-radius:6px; border:none; background:#ff3b30; color:#fff; cursor:pointer;">清空垃圾篓</button>' : ''}
        <button id="closeTrashBtn" style="background:none; border:none; font-size:20px; cursor:pointer; color:var(--text-muted);">&times;</button>
      </div>
    </div>
    <div style="flex:1; overflow-y:auto; padding:12px;">${listHtml}</div>
  `;
    overlay.appendChild(box);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => { overlay.style.opacity = '1'; box.style.transform = 'translateY(0) scale(1)'; });
    const close = () => { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); };
    document.getElementById('closeTrashBtn').onclick = close;
    overlay.onclick = (e) => { if (e.target === overlay)
        close(); };
    document.getElementById('emptyTrashBtn')?.addEventListener('click', async () => {
        const { showModal } = await import('./components.js');
        const ok = await showModal({ title: '清空垃圾篓', content: '确定永久删除所有垃圾篓中的对话吗？此操作不可撤销。', confirmText: '清空', danger: true });
        if (!ok)
            return;
        try {
            await api.chat.emptyTrash();
            window.__toast?.success('垃圾篓已清空');
            close();
            updateTrashBadge();
        }
        catch (e) {
            window.__toast?.error('操作失败: ' + e.message);
        }
    });
    box.querySelectorAll('[data-action="restore"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            try {
                await api.chat.restoreFromTrash(btn.dataset.id);
                window.__toast?.success('已恢复');
                close();
                loadSidebarConversations(sidebarConvSearchQuery);
                updateTrashBadge();
            }
            catch (e) {
                window.__toast?.error('恢复失败: ' + e.message);
            }
        });
    });
    box.querySelectorAll('[data-action="permanent"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const { showModal } = await import('./components.js');
            const ok = await showModal({ title: '永久删除', content: '确定永久删除此对话吗？此操作不可撤销。', confirmText: '永久删除', danger: true });
            if (!ok)
                return;
            try {
                await api.chat.permanentDelete(btn.dataset.id);
                window.__toast?.success('已永久删除');
                if (typeof window.__onConvDeleted === 'function')
                    window.__onConvDeleted(btn.dataset.id);
                close();
                updateTrashBadge();
            }
            catch (e) {
                window.__toast?.error('删除失败: ' + e.message);
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
    if (!s)
        return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
/**
 * 绑定路由相关事件和拖拽相关事件
 */
function bindRouteEvents() {
    // 恢复保存的侧边栏状态和宽度
    const sidebar = document.getElementById('sidebar');
    const isCollapsed = localStorage.getItem('sidebarCollapsed') === 'true';
    if (isCollapsed) {
        sidebar.classList.add('collapsed');
    }
    // 侧边栏点击导航（包括底部设置按钮）
    sidebar.addEventListener('click', (e) => {
        // 收缩/展开按钮点击
        if (e.target.closest('#sidebarBottomToggleBtn')) {
            sidebar.classList.toggle('collapsed');
            // 重置拖动带来的内联宽度
            sidebar.style.width = '';
            if (sidebar.classList.contains('collapsed')) {
                localStorage.setItem('sidebarCollapsed', 'true');
            }
            else {
                localStorage.removeItem('sidebarCollapsed');
            }
            return;
        }
        const item = e.target.closest('.sidebar-nav-item');
        if (!item)
            return;
        const route = item.dataset.route;
        if (route)
            navigateTo(route);
    });
    // 侧边栏拖动调整宽度逻辑
    const resizer = document.getElementById('sidebarResizer');
    let isResizing = false;
    let startX = 0;
    let startWidth = 0;
    let rafId = 0;
    const MIN_WIDTH = 150;
    const MAX_WIDTH = 220;
    if (resizer && sidebar) {
        resizer.addEventListener('mousedown', (e) => {
            if (e.button !== 0)
                return;
            isResizing = true;
            resizer.classList.add('active');
            sidebar.style.transition = 'width 0s, padding 0s';
            document.body.style.cursor = 'ew-resize';
            document.body.style.userSelect = 'none';
            startX = e.clientX;
            startWidth = sidebar.offsetWidth;
            if (sidebar.classList.contains('collapsed')) {
                sidebar.classList.remove('collapsed');
                localStorage.removeItem('sidebarCollapsed');
                startWidth = MIN_WIDTH;
            }
        });
        document.addEventListener('mousemove', (e) => {
            if (!isResizing)
                return;
            const deltaX = e.clientX - startX;
            let newWidth = startWidth + deltaX;
            if (newWidth < MIN_WIDTH)
                newWidth = MIN_WIDTH;
            if (newWidth > MAX_WIDTH)
                newWidth = MAX_WIDTH;
            if (rafId)
                cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                sidebar.style.width = newWidth + 'px';
            });
        });
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                if (rafId) {
                    cancelAnimationFrame(rafId);
                    rafId = 0;
                }
                resizer.classList.remove('active');
                sidebar.style.transition = '';
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                if (!sidebar.classList.contains('collapsed')) {
                    localStorage.setItem('sidebarWidth', sidebar.style.width);
                }
            }
        });
    }
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
async function navigateTo(route, params = {}) {
    if (route === currentRoute && Object.keys(params).length === 0)
        return;
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
        // 调用页面渲染函数，传入 params
        if (typeof pageModule.render === 'function') {
            await pageModule.render(pageEl, params);
        }
        // 调用页面初始化函数，传入 params
        if (typeof pageModule.init === 'function') {
            await pageModule.init(pageEl, params);
        }
    }
    catch (err) {
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
    if (!sidebar)
        return;
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
    if (el)
        el.textContent = name;
}
/**
 * 工具函数：延时
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// 将 toast 挂到全局方便页面使用
window.__toast = toast;
window.refreshSidebarConversations = refreshSidebarConversations;
// ==================== 全局 Modal 交互优化 ====================
// 支持 ESC 按键和点击背景关闭所有弹窗
const globalModalIds = [
    'modelSelectionModal',
    'tuningModal',
    'installGuideModal',
    'localModelsModal',
    'cloudConfigModal'
];
function closeActiveModals() {
    let closedAny = false;
    for (const id of globalModalIds) {
        const modal = document.getElementById(id);
        if (modal) {
            if (modal.style.display === 'flex' || modal.classList.contains('visible')) {
                modal.style.display = 'none';
                modal.classList.remove('visible');
                closedAny = true;
            }
        }
    }
    return closedAny;
}
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeActiveModals();
    }
});
document.addEventListener('click', (e) => {
    // 判断点击的是否是 Modal 背景层自身
    if (globalModalIds.includes(e.target.id) || e.target.classList.contains('cloud-config-modal')) {
        e.target.style.display = 'none';
        e.target.classList.remove('visible');
    }
});
/* ======================== 主题管理 (ThemeManager) ======================== */
function initThemeManager() {
    const toggleBtn = document.getElementById('themeToggleBtn');
    const applyTheme = (theme) => {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
            if (toggleBtn)
                toggleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>';
        }
        else {
            document.body.classList.remove('dark-theme');
            if (toggleBtn)
                toggleBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        }
    };
    const evalTheme = () => {
        let saved = localStorage.getItem('oc_theme_pref');
        if (!saved)
            saved = 'auto';
        if (saved === 'auto') {
            const hour = new Date().getHours();
            // 默认 早 7 点 到 晚 7 点为亮色，其余为暗黑
            if (hour >= 7 && hour < 19) {
                applyTheme('light');
            }
            else {
                applyTheme('dark');
            }
        }
        else {
            applyTheme(saved);
        }
    };
    evalTheme();
    // 每隔1分钟重新判定一次时间主题
    setInterval(evalTheme, 60000);
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            const isDark = document.body.classList.contains('dark-theme');
            const newTheme = isDark ? 'light' : 'dark';
            localStorage.setItem('oc_theme_pref', newTheme);
            applyTheme(newTheme);
        });
    }
}
// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    init();
    initThemeManager();
});
