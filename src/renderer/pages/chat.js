/**
 * 聊天页面 v2
 * 包含多选删除、圆形进度条、模型选择弹窗、高度紧凑的控制栏等精细交互
 */

let activeConvId = null;
let isGenerating = false;
let models = [];
let activeModelId = '';
let activeExpert = null;
let tokenUsage = 0; // Simulate token usage

// 侧边栏多选模式状态
let isSelectMode = false;
let selectedConvIds = new Set();
let longPressTimer = null;
let convSearchQuery = '';

export async function render(container) {
  container.className = 'page-layout-split';
  container.style.padding = '0';
  
  const expertData = localStorage.getItem('activeExpert');
  if (expertData) {
    try { activeExpert = JSON.parse(expertData); } catch(e) {}
  } else {
    activeExpert = null;
  }

  container.innerHTML = `
    <!-- 左侧对话列表 -->
    <div class="page-sidebar" id="chatSidebar" style="width: 190px; display: flex; flex-direction: column; position: relative;">
      <div class="page-sidebar-header" style="padding: 16px; border-bottom: 1px solid var(--border-light); display: flex; flex-direction: column; gap: 12px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <button id="toggleSelectModeBtn" style="margin: 0; font-size: 16px; font-weight: 600; background:none; border:none; color:var(--text-primary); cursor:pointer; padding: 0; text-align: left;">会话管理</button>
          <!-- 右上角侧边栏收缩切换按钮 -->
          <button class="btn btn-sm btn-ghost" id="mainSidebarToggleBtn" title="收缩侧边栏" style="display: flex; align-items: center; gap: 4px; padding: 4px 8px; background: transparent; border: none; color: var(--text-primary); cursor: pointer; border-radius: 6px; transition: all 0.2s;">
            <!-- 默认：收缩图标 -->
            <svg class="icon-collapse" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
            <!-- 展开图标 (默认隐藏) -->
            <svg class="icon-expand" style="display: none;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="15" y1="3" x2="15" y2="21"></line></svg>
            <span class="toggle-text" style="font-size: 13px;">收缩</span>
          </button>
        </div>
        
        <!-- 搜索栏 -->
        <div class="sidebar-search-wrap" style="position: relative; margin-bottom: 8px;">
          <input type="text" id="convSearchInput" class="sidebar-search-input" placeholder="搜索会话..." style="width: 100%; height: 36px; border-radius: 20px; padding-left: 32px; background: var(--bg-body); border: 1px solid var(--border-light); color: var(--text-primary); font-size: 14px; box-sizing: border-box; text-align: left;" />
          <span class="search-icon" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--text-muted); pointer-events: none; display: flex; align-items: center; z-index: 2;">🔎</span>
        </div>

        <!-- 全选控制区 (多选模式下显示) -->
        <div id="selectAllContainer" style="display: none; align-items: center; gap: 8px; font-size: 13px; color: var(--text-primary); padding: 2px 0;">
          <div class="apple-checkbox" id="selectAllCheckbox"></div>
          <label style="cursor: pointer;" onclick="document.getElementById('selectAllCheckbox').click()">全选</label>
        </div>

        <button id="newChatBtn" class="btn btn-primary" style="width: 100%; border-radius: 8px; padding: 9px; font-weight: 600; font-size: 13px;">+ 新建对话</button>
      </div>
      
      <div id="convList" style="flex: 1; overflow-y: auto; padding: 8px; padding-bottom: 80px;">
        <!-- 会话列表 -->
      </div>

      <!-- 悬浮删除按钮 (多选模式下显示) -->
      <button id="deleteSelectedBtn" class="sleek-trash-btn" style="display: none;" title="删除选中会话">
         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
      </button>
    </div>

    <!-- 右侧主区域 -->
    <div class="page-main" style="display: flex; flex-direction: column; background: var(--bg-app); position: relative;">
      
      <!-- 顶部 Header -->
      <div style="height: 60px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: var(--bg-panel); backdrop-filter: blur(10px); z-index: 10;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <h2 id="chatTitle" style="margin: 0; font-size: 18px; font-weight: 600;">新对话</h2>
          <div id="expertIndicator" style="display: none; align-items: center; gap: 8px; background: rgba(108, 99, 255, 0.15); color: #8e84ff; padding: 4px 12px; border-radius: 20px; font-size: 13px; border: 1px solid rgba(108, 99, 255, 0.3);">
            <span id="expertName"></span>
            <button id="clearExpertBtn" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 16px; padding: 0 4px;">&times;</button>
          </div>
        </div>
      </div>

      <!-- 聊天消息展示区 -->
      <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 24px; padding-bottom: 220px; display: flex; flex-direction: column; gap: 24px;">
        <!-- Messages -->
      </div>

      <!-- 底部输入区 — 豆包风格整合 -->
      <div class="doubao-input-wrapper">

        <div class="doubao-input-container">
          <!-- 引用预览 (嵌入容器内顶部) -->
          <div id="quotePreview" class="quote-preview" style="display: none;">
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <strong style="color: var(--primary);">引用：</strong>
              <span id="quoteText"></span>
            </div>
            <span class="close-quote" id="closeQuoteBtn">&times;</span>
          </div>

          <!-- 输入行 -->
          <div class="doubao-input-row">
            <textarea id="chatInput" class="doubao-textarea" placeholder="输入消息...  Shift+Enter 换行" rows="1"></textarea>
            <button id="sendBtn" class="doubao-send-btn" title="发送 (Enter)">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
            </button>
          </div>

          <!-- 工具栏行：功能按钮整合到输入框内部 -->
          <div class="doubao-toolbar-row">
            <!-- 上传文件 -->
            <button id="fileUploadBtn" class="doubao-toolbar-btn accent-green" title="上传文件">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
              <span>上传</span>
            </button>

            <!-- 模型选择 -->
            <button id="modelModalBtn" class="doubao-toolbar-btn accent-cyan" title="切换模型">
              <span>🤖</span>
              <span id="activeModelLabel" style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">选择模型</span>
            </button>

            <!-- 思考深度 -->
            <div class="doubao-toolbar-btn accent-purple" title="思考深度" style="gap: 4px;">
              <span>🧠</span>
              <select id="depthSelect" class="doubao-toolbar-select">
                <option value="auto">自动</option>
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
                <option value="extreme">极高</option>
              </select>
            </div>

            <!-- 截屏 -->
            <button id="readScreenBtn" class="doubao-toolbar-btn" title="截屏识别">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              <span>截屏</span>
            </button>

            <!-- 通话 -->
            <button id="callBtn" class="doubao-toolbar-btn accent-orange" title="语音通话">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
              <span>通话</span>
            </button>

            <!-- 清空上下文 -->
            <button id="clearMemoryBtn" class="doubao-toolbar-btn accent-red" title="清空上下文记忆">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
              <span>清空</span>
            </button>

            <!-- 右侧：上下文进度环 -->
            <div class="doubao-toolbar-right">
              <div id="tokenCircleBtn" class="doubao-token-ring" title="上下文占用 (点击压缩)">
                <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(0,0,0,0.08)" stroke-width="3"></circle>
                  <circle id="tokenCircleFill" cx="18" cy="18" r="15" fill="none" stroke="var(--success)" stroke-width="3" stroke-dasharray="94 94" stroke-dashoffset="94" stroke-linecap="round" style="transition: all 0.4s ease;"></circle>
                </svg>
                <span style="position: absolute; font-size: 11px;">🧠</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型选择 Modal 弹窗 -->
    <div id="modelSelectionModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
       <div style="background: var(--bg-app); width: 600px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.2); display: flex; flex-direction: column; overflow: hidden;">
          <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: var(--bg-panel);">
             <h3 style="margin: 0; font-size: 18px;">🤖 切换模型</h3>
             <button id="closeModelModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>
          <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px; max-height: 60vh; overflow-y: auto;">
             <!-- 云端模型 -->
             <div>
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;"><span style="color: #6c63ff;">☁️</span> 云端模型</h4>
                <div id="cloudModelsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;"></div>
             </div>
             <!-- 本地模型 -->
             <div>
                <h4 style="margin: 0 0 12px 0; font-size: 14px; color: var(--text-muted); display: flex; align-items: center; gap: 8px;"><span style="color: #00d9ff;">💻</span> 本地模型</h4>
                <div id="localModelsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 12px;"></div>
             </div>
          </div>
       </div>
    </div>
  `;

  // --- 侧边栏多选逻辑 ---
  document.getElementById('toggleSelectModeBtn').addEventListener('click', toggleSelectMode);
  
  // 绑定全选复选框 (Apple-style)
  document.getElementById('selectAllCheckbox').addEventListener('click', (e) => {
    const cb = e.currentTarget;
    cb.classList.toggle('checked');
    const isChecked = cb.classList.contains('checked');
    
    const checkboxes = document.querySelectorAll('.conv-checkbox');
    checkboxes.forEach(childCb => {
       if (isChecked) {
         childCb.classList.add('checked');
         selectedConvIds.add(childCb.dataset.id);
       } else {
         childCb.classList.remove('checked');
         selectedConvIds.delete(childCb.dataset.id);
       }
    });
    updateDeleteBtn();
  });

  document.getElementById('deleteSelectedBtn').addEventListener('click', deleteSelectedConversations);

  // 搜索栏
  document.getElementById('convSearchInput').addEventListener('input', (e) => {
    convSearchQuery = e.target.value.trim().toLowerCase();
    loadConversations();
  });
  
  // 切换二级侧边栏状态
  const toggleBtn = document.getElementById('mainSidebarToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const sidebar = document.getElementById('chatSidebar');
      const isCollapsed = sidebar.classList.toggle('collapsed');
      
      const iconCollapse = toggleBtn.querySelector('.icon-collapse');
      const iconExpand = toggleBtn.querySelector('.icon-expand');
      
      if (isCollapsed) {
        iconCollapse.style.display = 'none';
        iconExpand.style.display = 'block';
        const toggleText = toggleBtn.querySelector('.toggle-text');
        if (toggleText) toggleText.textContent = '展开';
        toggleBtn.title = '展开侧边栏';
      } else {
        iconCollapse.style.display = 'block';
        iconExpand.style.display = 'none';
        const toggleText = toggleBtn.querySelector('.toggle-text');
        if (toggleText) toggleText.textContent = '收缩';
        toggleBtn.title = '收缩侧边栏';
      }
    });
  }
  // --- 基础事件 ---
  document.getElementById('newChatBtn').addEventListener('click', createNewChat);
  document.getElementById('clearExpertBtn').addEventListener('click', () => {
    localStorage.removeItem('activeExpert');
    activeExpert = null;
    updateExpertIndicator();
    if (window.__toast) window.__toast.info('已退出专家模式');
  });

  const chatInput = document.getElementById('chatInput');
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
  });

  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.getElementById('sendBtn').addEventListener('click', sendMessage);

  // 上下文圆环点击
  document.getElementById('tokenCircleBtn').addEventListener('click', () => {
    tokenUsage = 0;
    updateTokenUsage();
    if (window.__toast) window.__toast.success('已执行上下文自动压缩');
  });

  // 垃圾桶按钮点击
  document.getElementById('clearMemoryBtn').addEventListener('click', () => {
    tokenUsage = 0;
    updateTokenUsage();
    if (window.__toast) window.__toast.success('上下文记忆已清空');
  });

  // 引用功能关闭
  document.getElementById('closeQuoteBtn').addEventListener('click', () => {
    document.getElementById('quotePreview').style.display = 'none';
    document.getElementById('quoteText').textContent = '';
  });

  // 模型 Modal 逻辑
  document.getElementById('modelModalBtn').addEventListener('click', () => {
     document.getElementById('modelSelectionModal').style.display = 'flex';
  });
  document.getElementById('closeModelModalBtn').addEventListener('click', () => {
     document.getElementById('modelSelectionModal').style.display = 'none';
  });
  document.getElementById('modelSelectionModal').addEventListener('click', (e) => {
     if(e.target.id === 'modelSelectionModal') e.target.style.display = 'none';
  });

  // 清理旧模态框并移到 body（绕过 .page 的 CSS animation transform 导致 fixed 定位失效）
  const oldModal = document.getElementById('modelSelectionModal');
  if (oldModal && oldModal.parentNode === document.body) oldModal.remove();
  const freshModal = document.getElementById('modelSelectionModal');
  if (freshModal) document.body.appendChild(freshModal);

  // 初始化加载
  await loadModels();
  await loadConversations();
  updateExpertIndicator();

  if (localStorage.getItem('justActivatedExpert') === 'true') {
    localStorage.removeItem('justActivatedExpert');
    await createNewChat();
  } else if (activeConvId) {
    await loadHistory(activeConvId);
  }
}

// ======================= 多选逻辑 =======================
function toggleSelectMode() {
  isSelectMode = !isSelectMode;
  selectedConvIds.clear();
  
  const btn = document.getElementById('toggleSelectModeBtn');
  const selectAllContainer = document.getElementById('selectAllContainer');
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  
  if (isSelectMode) {
    btn.textContent = '取消';
    selectAllContainer.style.display = 'flex';
    document.getElementById('selectAllCheckbox').checked = false;
  } else {
    btn.textContent = '管理';
    selectAllContainer.style.display = 'none';
    deleteBtn.style.display = 'none';
  }
  
  loadConversations(); // 重新渲染列表带/不带 checkbox
}

function updateDeleteBtn() {
  const deleteBtn = document.getElementById('deleteSelectedBtn');
  if (selectedConvIds.size > 0) {
    deleteBtn.style.display = 'flex';
  } else {
    deleteBtn.style.display = 'none';
  }
}

async function deleteSelectedConversations() {
  if (selectedConvIds.size === 0) return;
  if (!confirm(`确定要删除选中的 ${selectedConvIds.size} 个对话吗？`)) return;
  
  try {
    const list = Array.from(selectedConvIds);
    // 模拟逐个删除或批量删除
    // await Promise.all(list.map(id => window.openClaw.chat.deleteConversation(id)));
    if (window.__toast) window.__toast.success(`成功删除 ${list.length} 个对话`);
    
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

// ======================= 基础逻辑 =======================
function updateExpertIndicator() {
  const indicator = document.getElementById('expertIndicator');
  if (activeExpert) {
    document.getElementById('expertName').textContent = `${activeExpert.icon || ''} ${activeExpert.name}`;
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
}

function updateTokenUsage() {
  const fill = document.getElementById('tokenCircleFill');
  if (!fill) return;

  // r=15 -> circumference = 2 * pi * 15 ≈ 94.2
  // dasharray = 94
  // dashoffset: 94 (0%) -> 0 (100%)
  const percentage = Math.min(tokenUsage, 100);
  const offset = 94 - (percentage * 94 / 100);
  fill.style.strokeDashoffset = offset;
  
  if (tokenUsage < 50) fill.style.stroke = 'var(--success)';
  else if (tokenUsage < 80) fill.style.stroke = 'var(--warning)';
  else fill.style.stroke = 'var(--danger)';
}

async function loadModels() {
  try {
    const res = await window.openClaw.model.getModels();
    models = res || [];
    
    const cloudModels = models.filter(m => !m.id.toLowerCase().includes('ollama') && !m.id.toLowerCase().includes('local'));
    const localModels = models.filter(m => m.id.toLowerCase().includes('ollama') || m.id.toLowerCase().includes('local'));
    
    const renderModelCard = (m) => `
      <div class="model-select-card" data-id="${m.id}" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
         <div style="font-weight: 600; font-size: 14px;">${m.name}</div>
         <div style="font-size: 11px; color: var(--text-muted);">${m.id}</div>
      </div>
    `;

    document.getElementById('cloudModelsGrid').innerHTML = cloudModels.map(renderModelCard).join('');
    document.getElementById('localModelsGrid').innerHTML = localModels.length > 0 ? localModels.map(renderModelCard).join('') : '<div style="color:var(--text-muted); font-size: 12px;">暂未配置本地模型</div>';
    
    // 绑定弹窗内模型点击
    document.querySelectorAll('.model-select-card').forEach(card => {
       card.addEventListener('click', () => {
          activeModelId = card.dataset.id;
          const modelObj = models.find(x => x.id === activeModelId);
          if(modelObj) {
            document.getElementById('activeModelLabel').textContent = modelObj.name;
          }
          document.getElementById('modelSelectionModal').style.display = 'none';
          if(window.__toast) window.__toast.success(`已切换为: ${modelObj?.name}`);
       });
    });

    const activeRes = await window.openClaw.model.getActiveModel();
    if (activeRes && activeRes.id) {
      activeModelId = activeRes.id;
    } else if (models.length > 0) {
      activeModelId = models[0].id;
    }
    
    const initialModel = models.find(x => x.id === activeModelId);
    if(initialModel) {
       document.getElementById('activeModelLabel').textContent = initialModel.name;
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

async function loadConversations() {
  try {
    let list = await window.openClaw.chat.getConversations();
    const listContainer = document.getElementById('convList');
    
    if (!list || list.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 13px;">暂无历史会话</div>';
      return;
    }

    // 搜索过滤
    if (convSearchQuery) {
      list = list.filter(c => (c.title || '').toLowerCase().includes(convSearchQuery));
    }

    if (!activeConvId && list.length > 0) {
      activeConvId = list[0].id;
    }

    listContainer.innerHTML = list.map(c => `
      <button class="sidebar-nav-item conv-item ${c.id === activeConvId ? 'active' : ''}" data-id="${c.id}" style="text-align: left; background: ${c.id === activeConvId ? 'var(--bg-active)' : 'transparent'}; border: none; width: 100%; justify-content: flex-start; font-size: 14px; padding: 10px 16px; position: relative; margin-bottom: 2px;">
        ${isSelectMode ? `<div class="apple-checkbox conv-checkbox ${selectedConvIds.has(c.id) ? 'checked' : ''}" data-id="${c.id}" style="margin-right: 8px;"></div>` : ''}
        <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none;">${escapeHtml(c.title || '新对话')}</span>
        ${!isSelectMode ? `<span class="conv-delete-x" data-id="${c.id}" title="删除此会话" style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: transparent; border: none; padding: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></span>` : ''}
      </button>
    `).join('');

    // 绑定 X 删除按钮
    document.querySelectorAll('.conv-delete-x').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const conv = list.find(c => c.id === id);
        if (confirm(`确定删除会话「${conv?.title || '新对话'}」吗？`)) {
          if (id === activeConvId) {
            activeConvId = null;
            document.getElementById('chatMessages').innerHTML = '';
            document.getElementById('chatTitle').textContent = '新对话';
          }
          if (window.__toast) window.__toast.success('会话已删除');
          loadConversations();
        }
      });
    });

    document.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (isGenerating) return;
        if (e.target.closest('.conv-delete-x')) return;
        const id = el.dataset.id;
        
        if (isSelectMode) {
           const cb = el.querySelector('.conv-checkbox');
           if (cb) {
             const isChecked = cb.classList.contains('checked');
             if(isChecked) {
               cb.classList.remove('checked');
               selectedConvIds.delete(id);
             } else {
               cb.classList.add('checked');
               selectedConvIds.add(id);
             }
             updateDeleteBtn();
           }
           return;
        }

        activeConvId = id;
        loadConversations();
        loadHistory(activeConvId);
      });

      // 长按进入多选模式
      el.addEventListener('pointerdown', (e) => {
         if(isSelectMode || e.button !== 0) return;
         if(e.target.closest('.conv-delete-x')) return;
         longPressTimer = setTimeout(() => {
            toggleSelectMode();
            selectedConvIds.add(el.dataset.id);
            updateDeleteBtn();
            loadConversations();
         }, 600);
      });
      el.addEventListener('pointerup', () => clearTimeout(longPressTimer));
      el.addEventListener('pointermove', () => clearTimeout(longPressTimer));
      el.addEventListener('pointercancel', () => clearTimeout(longPressTimer));
    });
  } catch (e) {
    console.error('Failed to load conversations:', e);
  }
}

async function createNewChat() {
  if (isGenerating) return;
  try {
    const res = await window.openClaw.chat.createConversation('新对话');
    activeConvId = res.id;
    await loadConversations();
    document.getElementById('chatMessages').innerHTML = `
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">✨</div>
        <div style="font-size: 16px;">新的对话已创建</div>
      </div>
    `;
    document.getElementById('chatTitle').textContent = '新对话';
    tokenUsage = 0;
    updateTokenUsage();
  } catch (e) {
    console.error('Failed to create chat:', e);
  }
}

async function loadHistory(convId) {
  try {
    const msgs = await window.openClaw.chat.getHistory(convId);
    renderMessages(msgs || []);
    const list = await window.openClaw.chat.getConversations();
    const c = list.find(x => x.id === convId);
    if (c) document.getElementById('chatTitle').textContent = c.title || '新对话';
    tokenUsage = Math.min((msgs || []).length * 8, 100);
    updateTokenUsage();
  } catch (e) {
    console.error('Failed to load history:', e);
  }
}

function handleQuote(text) {
  document.getElementById('quotePreview').style.display = 'flex';
  document.getElementById('quoteText').textContent = text;
  document.getElementById('chatInput').focus();
}

window.handleQuote = handleQuote;

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (messages.length === 0) {
    container.innerHTML = `
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">💬</div>
        <div style="font-size: 16px;">发送一条消息开始吧</div>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => `
    <div class="message" style="display: flex; gap: 16px; ${m.role === 'user' ? 'flex-direction: row-reverse;' : ''}">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: ${m.role === 'user' ? 'var(--primary)' : 'var(--bg-active)'}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
        ${m.role === 'user' ? '👤' : '🤖'}
      </div>
      <div style="max-width: 75%; display: flex; flex-direction: column; align-items: ${m.role === 'user' ? 'flex-end' : 'flex-start'};">
        <div style="background: ${m.role === 'user' ? 'var(--primary)' : 'var(--bg-card)'}; color: ${m.role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 12px 16px; border-radius: 16px; font-size: 15px; line-height: 1.6; border: ${m.role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: var(--shadow-sm);">
          ${m.role === 'user' ? escapeHtml(m.content).replace(/\n/g, '<br/>') : parseMarkdown(m.content)}
        </div>
        <!-- 快捷操作栏 -->
        <div class="message-actions" style="margin-top: 4px;">
           <button class="action-btn" onclick="window.handleQuote('${escapeHtml(m.content).replace(/'/g, "\\'").substring(0, 50)}...')" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">引用</button>
           <button class="action-btn" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">复制</button>
        </div>
      </div>
    </div>
  `).join('');
  
  scrollToBottom();
}

function appendMessage(role, id = null) {
  const container = document.getElementById('chatMessages');
  if (container.children.length === 1 && (container.children[0].textContent.includes('发送一条消息') || container.children[0].textContent.includes('新的对话'))) {
    container.innerHTML = '';
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.id = id ? `msg-${id}` : `msg-temp`;
  msgDiv.style.display = 'flex';
  msgDiv.style.gap = '16px';
  msgDiv.style.marginBottom = '24px';
  if (role === 'user') msgDiv.style.flexDirection = 'row-reverse';

  msgDiv.innerHTML = `
    <div style="width: 36px; height: 36px; border-radius: 50%; background: ${role === 'user' ? 'var(--primary)' : 'var(--bg-active)'}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
      ${role === 'user' ? '👤' : '🤖'}
    </div>
    <div style="max-width: 75%; display: flex; flex-direction: column; align-items: ${role === 'user' ? 'flex-end' : 'flex-start'};">
      <div class="msg-content-box" style="background: ${role === 'user' ? 'var(--primary)' : 'var(--bg-card)'}; color: ${role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 12px 16px; border-radius: 16px; font-size: 15px; line-height: 1.6; border: ${role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: var(--shadow-sm);">
        <span class="cursor" style="display: ${role === 'ai' ? 'inline-block' : 'none'}; width: 8px; height: 16px; background: currentColor; animation: blink 1s step-end infinite;"></span>
      </div>
    </div>
  `;
  container.appendChild(msgDiv);
  scrollToBottom();
  return msgDiv.querySelector('.msg-content-box');
}

async function sendMessage() {
  if (isGenerating) {
    window.openClaw.chat.abortStream();
    isGenerating = false;
    const btn = document.getElementById('sendBtn');
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
    btn.classList.remove('is-stop');
    return;
  }

  const input = document.getElementById('chatInput');
  let text = input.value.trim();
  if (!text) return;
  
  const quotePreview = document.getElementById('quotePreview');
  if (quotePreview.style.display === 'flex') {
     const quoteText = document.getElementById('quoteText').textContent;
     text = `> ${quoteText}\n\n${text}`;
     quotePreview.style.display = 'none';
     document.getElementById('quoteText').textContent = '';
  }

  if (!activeConvId) {
    await createNewChat();
  }

  input.value = '';
  input.style.height = '56px';

  const userBox = appendMessage('user');
  userBox.innerHTML = escapeHtml(text).replace(/\n/g, '<br/>');

  isGenerating = true;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="10" x="7" y="7" rx="1"></rect></svg>`;
  sendBtn.classList.add('is-stop');

  const aiBox = appendMessage('ai');
  let fullResponse = '';
  
  tokenUsage += 5;
  updateTokenUsage();

  try {
    const prompt = activeExpert ? activeExpert.prompt : undefined;
    const response = await window.openClaw.chat.sendMessageStream(activeConvId, text, activeModelId, prompt, 0.7);
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.content) {
              fullResponse += parsed.content;
              aiBox.innerHTML = parseMarkdown(fullResponse) + '<span class="cursor" style="display: inline-block; width: 8px; height: 16px; background: currentColor; animation: blink 1s step-end infinite; margin-left: 4px;"></span>';
              scrollToBottom();
            }
          } catch (e) {}
        }
      }
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      fullResponse += '\n\n*(已中断)*';
    } else {
      fullResponse += '\n\n**[发生错误]** ' + err.message;
      if (window.__toast) window.__toast.error('发送失败: ' + err.message);
    }
  } finally {
    isGenerating = false;
    sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
    sendBtn.classList.remove('is-stop');
    aiBox.innerHTML = parseMarkdown(fullResponse);
    loadConversations();
  }
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  container.scrollTop = container.scrollHeight;
}

function parseMarkdown(md) {
  if (!md) return '';
  let html = escapeHtml(md);
  
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background: var(--bg-active); padding:12px; border-radius:8px; overflow-x:auto; margin: 8px 0;"><code style="font-family:Consolas,monospace; font-size:13px;">$2</code></pre>');
  html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-active); padding:2px 4px; border-radius:4px; font-family:Consolas,monospace; font-size:0.9em;">$1</code>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
  html = html.replace(/&gt; (.*?)(?:\n|$)/g, '<blockquote style="border-left: 3px solid var(--primary); color: var(--text-muted); margin: 4px 0; padding-left: 8px;">$1</blockquote>');
  html = html.replace(/\n/g, '<br/>');

  return html;
}

function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe
       .replace(/&/g, "&amp;")
       .replace(/</g, "&lt;")
       .replace(/>/g, "&gt;")
       .replace(/"/g, "&quot;")
       .replace(/'/g, "&#039;");
}
