const fs = require('fs');
let chatJs = fs.readFileSync('src/renderer/pages/chat.js', 'utf8');

// 1. Remove the page-sidebar container from render()
chatJs = chatJs.replace(
  /<div class=\"page-sidebar-header\">[\s\S]*?<!-- 搜索栏 -->[\s\S]*?<div class=\"sidebar-search-wrap\">[\s\S]*?<\/div>[\s\S]*?<\/div>[\s\S]*?<div style=\"padding: 0 16px 12px 16px;\">[\s\S]*?<\/div>[\s\S]*?<div id=\"convList\"[\s\S]*?<\/div>\s*<div id=\"deletedConversationsBtn\"[\s\S]*?<\/div>\s*<\/div>/,
  `// SIDEBAR HTML REMOVED`
);

chatJs = chatJs.replace(/<div class=\"page-layout-split\">/, '');
chatJs = chatJs.replace(/<div class=\"page-main\">/, '<div class="page-layout-full" style="height: 100%; display: flex; flex-direction: column;">');
chatJs = chatJs.replace(/<\/div>\s*<\/div>\s*`;/, '</div>\n  `;');

// 2. Modify render() or init() to call window.__app.setSidebar
// In render, after container.innerHTML = ..., we should call setSidebar
chatJs = chatJs.replace(
  /container\.innerHTML = `[\s\S]*?<\/div>\\n  `;/,
  (match) => match + `

  if (window.__app && window.__app.setSidebar) {
    const searchHTML = \`
      <div class="sidebar-search-wrap">
        <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="convSearchInput" placeholder="搜索..." />
      </div>
      <div style="padding: 12px 0 0 0;">
        <button class="btn btn-primary" id="newChatBtn" style="width: 100%; padding: 8px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 6px;">
            <line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>新建对话
        </button>
      </div>
      
      <!-- 多选管理工具栏 -->
      <div id="selectAllContainer" style="display: none; justify-content: space-between; align-items: center; margin-top: 12px; padding: 0 4px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13px; color:var(--text-secondary);">
          <div class="apple-checkbox" id="selectAllCheckbox"></div>全选
        </label>
        <button id="toggleSelectModeBtn" style="background:none; border:none; color:var(--primary); cursor:pointer; font-size:13px;">完成</button>
      </div>
    \`;

    const contentHTML = \`
      <div id="convList" style="flex: 1; overflow-y: auto; padding: 8px;">
        <!-- 会话列表 -->
      </div>
      <div id="deletedConversationsBtn" class="history-restore-tip" style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">
         🗑️ 最近删除 <span id="deletedCount" style="display:none;"></span>
      </div>
    \`;

    const footerHTML = \`
      <!-- 批量删除按钮 -->
      <button id="deleteSelectedBtn" class="sleek-trash-btn" style="display:none;" title="删除选中">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
      </button>
    \`;

    window.__app.setSidebar('历史对话', searchHTML, contentHTML, footerHTML);
  }
`
);

// We need to re-bind events since the buttons moved to globalSidebar
// They are actually bound in `init(container)`. Since they are in globalSidebar, `document.getElementById` still works perfectly!
// However, toggleSelectModeBtn was removed previously. Let me make sure it is bound.
chatJs = chatJs.replace(
  /document\.getElementById\('newChatBtn'\)\.addEventListener/,
  `document.getElementById('newChatBtn').addEventListener`
);

// We should also add back the event listener for toggleSelectModeBtn
chatJs = chatJs.replace(
  /document\.getElementById\('convSearchInput'\)\.addEventListener\('input', \(e\) => \{/,
  `document.getElementById('convSearchInput').addEventListener('input', (e) => {
  document.getElementById('toggleSelectModeBtn')?.addEventListener('click', toggleSelectMode);`
);


fs.writeFileSync('src/renderer/pages/chat.js', chatJs);
console.log('Modified chat.js successfully.');
