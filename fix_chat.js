const fs = require('fs');
let chatJs = fs.readFileSync('src/renderer/pages/chat.js', 'utf8');

// 1. Modify header structure in render()
chatJs = chatJs.replace(
  /<div class=\"page-sidebar-header\"[\s\S]*?<\/div>[\s\S]*?<!-- 搜索栏 -->/,
  `<div class="page-sidebar-header">
        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; letter-spacing: -0.3px; color: var(--text-primary);">历史对话</h3>
          <!-- 右上角的收缩按钮 -->
          <button id="toggleChatSidebarBtn" class="sidebar-collapse-btn" title="收起/展开列表">
             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
          </button>
        </div>
        
        <!-- 搜索栏 -->`
);

// 2. Add history restore UI at the bottom of the sidebar
chatJs = chatJs.replace(
  /<div id=\"convList\"[\s\S]*?<\/div>/,
  `<div id="convList" style="flex: 1; overflow-y: auto; padding: 8px;">
        <!-- 会话列表 -->
      </div>
      
      <div id="deletedConversationsBtn" class="history-restore-tip" style="cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='var(--text-muted)'">
         🗑️ 最近删除 <span id="deletedCount" style="display:none;"></span>
      </div>`
);

// 3. Remove toggleSelectModeBtn and fix rendering to only show checkboxes on long press
// In loadConversations, we need to hide the normal X button if isSelectMode is active
// Also, soft delete instead of normal delete.
// Let's replace deleteSelectedConversations and the X button logic.

// We will add soft delete state
chatJs = chatJs.replace(
  /let isSelectMode = false;/,
  `let isSelectMode = false;
let showingDeleted = false;
function getDeletedConversations() {
  try { return JSON.parse(localStorage.getItem('deletedConversations') || '[]'); } catch(e) { return []; }
}
function setDeletedConversations(arr) {
  localStorage.setItem('deletedConversations', JSON.stringify(arr));
}
`
);

// Modify loadConversations
chatJs = chatJs.replace(
  /let list = await window\.openClaw\.chat\.getConversations\(\);[\s\S]*?if \(!activeConvId && list\.length > 0\) \{/,
  `let list = await window.openClaw.chat.getConversations();
    const listContainer = document.getElementById('convList');
    
    if (!list) list = [];
    
    // 过滤已删除和未删除
    const deletedIds = getDeletedConversations();
    if (showingDeleted) {
       list = list.filter(c => deletedIds.includes(c.id));
       document.getElementById('deletedConversationsBtn').innerHTML = '← 返回历史对话';
    } else {
       list = list.filter(c => !deletedIds.includes(c.id));
       const count = deletedIds.length;
       const btn = document.getElementById('deletedConversationsBtn');
       if (btn) {
         btn.innerHTML = '🗑️ 最近删除' + (count > 0 ? \` (\${count})\` : '');
         btn.style.display = 'block';
       }
    }

    if (convSearchQuery) {
      list = list.filter(c => (c.title || '').toLowerCase().includes(convSearchQuery));
    }

    if (!activeConvId && list.length > 0 && !showingDeleted) {`
);

// Modify the item render to handle 'showingDeleted' state
chatJs = chatJs.replace(
  /\$\{(!isSelectMode \? .*?: '')\}/g,
  `\${(!isSelectMode && !showingDeleted ? \`<button class="conv-delete-x" data-id="\${c.id}" title="删除此会话"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>\` : '')}
   \${(showingDeleted ? \`<button class="conv-restore-btn" data-id="\${c.id}" title="恢复此会话" style="position:absolute; right:36px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--success); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg></button>
   <button class="conv-hard-delete" data-id="\${c.id}" title="永久删除" style="position:absolute; right:8px; top:50%; transform:translateY(-50%); background:none; border:none; color:var(--danger); cursor:pointer;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>\` : '')}`
);

// Replace X button logic
chatJs = chatJs.replace(
  /document\.querySelectorAll\('\.conv-delete-x'\)\.forEach\(btn => \{[\s\S]*?\}\);/g,
  `document.querySelectorAll('.conv-delete-x').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const conv = list.find(c => c.id === id);
        if (confirm(\`确定删除会话「\${conv?.title || '新对话'}」吗？(可在最近删除中恢复)\`)) {
          if (id === activeConvId) {
             activeConvId = null;
             document.getElementById('chatMessages').innerHTML = '';
             document.getElementById('chatTitle').textContent = '新对话';
          }
          const delArr = getDeletedConversations();
          if(!delArr.includes(id)) {
            delArr.push(id);
            setDeletedConversations(delArr);
          }
          if (window.__toast) window.__toast.success('已移至最近删除');
          loadConversations();
        }
      });
    });

    document.querySelectorAll('.conv-restore-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const delArr = getDeletedConversations().filter(x => x !== id);
        setDeletedConversations(delArr);
        if (window.__toast) window.__toast.success('会话已恢复');
        loadConversations();
      });
    });

    document.querySelectorAll('.conv-hard-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('永久删除后无法恢复，确定删除吗？')) {
           try {
             await window.openClaw.chat.deleteConversation(id);
             const delArr = getDeletedConversations().filter(x => x !== id);
             setDeletedConversations(delArr);
             if (window.__toast) window.__toast.success('已永久删除');
             loadConversations();
           } catch(err) {
             console.error(err);
           }
        }
      });
    });`
);

// Delete Selected overrides
chatJs = chatJs.replace(
  /async function deleteSelectedConversations\(\) \{[\s\S]*?\}\n/g,
  `async function deleteSelectedConversations() {
  if (selectedConvIds.size === 0) return;
  if (!confirm(\`确定要删除选中的 \${selectedConvIds.size} 个对话吗？(可在最近删除中恢复)\`)) return;
  
  try {
    const list = Array.from(selectedConvIds);
    let delArr = getDeletedConversations();
    for(let id of list) {
       if(!delArr.includes(id)) delArr.push(id);
    }
    setDeletedConversations(delArr);
    if (window.__toast) window.__toast.success(\`成功删除 \${list.length} 个对话\`);
    
    if (list.includes(activeConvId)) {
      activeConvId = null;
      document.getElementById('chatMessages').innerHTML = '';
      document.getElementById('chatTitle').textContent = '新对话';
    }
    
    toggleSelectMode(); // 退出选择模式
  } catch(e) {
    console.error('Delete failed', e);
  }
}
`
);

// Remove the old toggleSelectModeBtn listeners
chatJs = chatJs.replace(/document\.getElementById\('toggleSelectModeBtn'\)\.addEventListener\('click', toggleSelectMode\);/, '');

// Add "deletedConversationsBtn" listener in init
chatJs = chatJs.replace(
  /document\.getElementById\('toggleChatSidebarBtn'\)\.addEventListener/,
  `
  document.getElementById('deletedConversationsBtn').addEventListener('click', () => {
    showingDeleted = !showingDeleted;
    if(isSelectMode) toggleSelectMode();
    loadConversations();
  });
  document.getElementById('toggleChatSidebarBtn').addEventListener`
);

// When long pressing, toggle select mode.
// Also we need to make sure select mode hides deleted filter button or is disabled in deleted view
chatJs = chatJs.replace(
  /el\.addEventListener\('pointerdown', \(e\) => \{[\s\S]*?\}, 600\);\n\s*\}\);/,
  `el.addEventListener('pointerdown', (e) => {
         if(showingDeleted) return; // 回收站不支持多选
         if(isSelectMode || e.button !== 0) return;
         if(e.target.closest('.conv-delete-x')) return;
         longPressTimer = setTimeout(() => {
            toggleSelectMode();
            selectedConvIds.add(el.dataset.id);
            updateDeleteBtn();
            loadConversations();
         }, 600);
      });`
);

// Ensure the "toggleSelectMode" hides the "deletedConversationsBtn"
chatJs = chatJs.replace(
  /function toggleSelectMode\(\) \{[\s\S]*?const btn = document\.getElementById\('toggleSelectModeBtn'\);/,
  `function toggleSelectMode() {
  isSelectMode = !isSelectMode;
  selectedConvIds.clear();
  const btn = document.getElementById('deletedConversationsBtn');`
);
// replace btn.textContent = '取消'; with btn.style.display = 'none';
chatJs = chatJs.replace(
  /if \(isSelectMode\) \{\n\s*btn\.textContent = '取消';/g,
  `if (isSelectMode) {
    if(btn) btn.style.display = 'none';`
);
chatJs = chatJs.replace(
  /\} else \{\n\s*btn\.textContent = '管理';/g,
  `} else {
    if(btn) btn.style.display = 'block';`
);


fs.writeFileSync('src/renderer/pages/chat.js', chatJs);
console.log('Fixed chat.js');
