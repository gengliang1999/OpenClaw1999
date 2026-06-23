const fs = require('fs');
let appJs = fs.readFileSync('src/renderer/app.js', 'utf8');

const newRenderShell = `function renderShell() {
  const root = document.getElementById('root');
  root.innerHTML = \`
    <!-- 顶部拖拽区 -->
    <div class="drag-region"></div>

    <!-- 主导航侧边栏（纯文字，宽度自适应） -->
    <aside class="primary-nav" id="primaryNav">
      <div class="primary-nav-logo">
      </div>

      <nav class="primary-nav-list" id="primaryNavList">
        \${ROUTES.map(r => \`
          <div class="primary-nav-item" data-route="\${r.path}" title="\${r.label}">
            <span class="primary-nav-label">\${r.label}</span>
          </div>
        \`).join('')}
      </nav>

      <div class="primary-nav-footer">
        <span class="primary-nav-version">v1.0.0</span>
      </div>
    </aside>

    <!-- 全局二级侧边栏 -->
    <aside class="page-sidebar" id="globalSidebar" style="display: none;">
      <div class="page-sidebar-header">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <h3 id="globalSidebarTitle" style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.3px; color: var(--text-primary);">标题</h3>
          <button id="toggleGlobalSidebarBtn" class="sidebar-collapse-btn" title="收起/展开列表">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        </div>
        <!-- 各页面可在此注入如搜索栏等头部内容 -->
        <div id="globalSidebarHeaderExtra"></div>
      </div>
      
      <!-- 各页面可在此注入列表内容 -->
      <div id="globalSidebarContent" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;"></div>
      
      <!-- 各页面可在此注入底部工具栏内容 (例如垃圾篓) -->
      <div id="globalSidebarFooter"></div>
    </aside>

    <!-- 主内容区域 -->
    <div class="main-content" style="flex: 1; min-width: 0;">
      <div class="page-container" id="pageContainer"></div>
    </div>
  \`;

  // 绑定全局侧边栏的收缩事件
  document.getElementById('toggleGlobalSidebarBtn').addEventListener('click', () => {
    document.getElementById('globalSidebar').classList.toggle('collapsed');
  });
}

// 暴露给各页面的全局 API
window.__app = {
  setSidebar: (title, headerExtraHTML = '', contentHTML = '', footerHTML = '') => {
    const sidebar = document.getElementById('globalSidebar');
    sidebar.style.display = 'flex';
    document.getElementById('globalSidebarTitle').textContent = title;
    document.getElementById('globalSidebarHeaderExtra').innerHTML = headerExtraHTML;
    document.getElementById('globalSidebarContent').innerHTML = contentHTML;
    document.getElementById('globalSidebarFooter').innerHTML = footerHTML;
  },
  hideSidebar: () => {
    const sidebar = document.getElementById('globalSidebar');
    sidebar.style.display = 'none';
    document.getElementById('globalSidebarTitle').textContent = '';
    document.getElementById('globalSidebarHeaderExtra').innerHTML = '';
    document.getElementById('globalSidebarContent').innerHTML = '';
    document.getElementById('globalSidebarFooter').innerHTML = '';
  }
};
`;

appJs = appJs.replace(/function renderShell\(\) \{[\s\S]*?\}<\/div>\s*<\/div>\s*`;\s*\}/, newRenderShell);
fs.writeFileSync('src/renderer/app.js', appJs);
console.log('Modified app.js successfully.');
