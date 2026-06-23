const fs = require('fs');
let css = fs.readFileSync('src/renderer/index.css', 'utf8');

if (!css.includes('.primary-nav {')) {
css += `
/* ================== 主导航栏（纯文字，宽度自适应） ================== */
.primary-nav {
  display: flex;
  flex-direction: column;
  width: max-content;
  min-width: 80px;
  max-width: 160px;
  height: 100%;
  background: var(--bg-sidebar);
  backdrop-filter: var(--blur-material);
  -webkit-backdrop-filter: var(--blur-material);
  border-right: 1px solid var(--border-color);
  padding: 44px 8px 16px 8px;
  z-index: 10;
  position: relative;
  flex-shrink: 0;
}

.primary-nav-logo {
  padding: 0 8px 20px;
  display: flex;
  align-items: center;
}

.logo-wordmark {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary);
  white-space: nowrap;
}

.primary-nav-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.primary-nav-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  font-weight: 500;
  font-size: 13px;
  white-space: nowrap;
}

.primary-nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.primary-nav-item.active {
  background: var(--primary);
  color: #fff;
  box-shadow: var(--shadow-sm);
}

.primary-nav-label {
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
}

.primary-nav-footer {
  padding-top: 12px;
  text-align: center;
}

.primary-nav-version {
  font-size: 11px;
  color: var(--text-muted);
}
`;
}

css += `
/* ================== 二级侧边栏（全局） ================== */
.page-sidebar {
  width: 260px;
  min-width: 260px;
  border-right: 1px solid var(--border-color);
  background: var(--bg-card);
  display: flex;
  flex-direction: column;
  transition: width 0.3s cubic-bezier(0.25, 1, 0.5, 1),
              min-width 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  overflow: hidden;
  position: relative;
}

/* 收缩态：留 48px 让收缩按钮可见 */
.page-sidebar.collapsed {
  width: 48px !important;
  min-width: 48px !important;
}

.page-sidebar.collapsed .page-sidebar-header h3,
.page-sidebar.collapsed .sidebar-search-wrap,
.page-sidebar.collapsed #newChatBtn,
.page-sidebar.collapsed #convList,
.page-sidebar.collapsed .history-restore-tip,
.page-sidebar.collapsed #deletedConversationsBtn {
  opacity: 0;
  pointer-events: none;
  max-height: 0;
  overflow: hidden;
  margin: 0;
  padding: 0;
  border: none;
}

/* 收缩按钮：固定在右上角 */
.sidebar-collapse-btn {
  position: absolute;
  top: 12px;
  right: 10px;
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-muted);
  z-index: 20;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.sidebar-collapse-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
.sidebar-collapse-btn svg {
  transition: transform 0.3s cubic-bezier(0.25, 1, 0.5, 1);
}
.page-sidebar.collapsed .sidebar-collapse-btn svg {
  transform: rotate(180deg);
}

.page-sidebar-header {
  padding: 16px 16px 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;
  position: relative;
}
`;

fs.writeFileSync('src/renderer/index.css', css);
console.log('Appended all styles to index.css safely.');
