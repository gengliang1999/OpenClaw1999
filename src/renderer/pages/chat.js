/**
 * 聊天页面 v3 — 全宽聊天界面，会话管理已移至主侧边栏
 */

let activeConvId = null;
let isGenerating = false;
let models = [];
let activeModelId = '';
let activeExpert = null;
let tokenUsage = 0;
let pendingAttachmentData = null;
let pendingLoadConvId = null; // 从侧边栏点击时预设的会话 ID

export async function render(container) {
  container.className = 'page';
  container.style.padding = '0';

  const expertData = localStorage.getItem('activeExpert');
  if (expertData) {
    try { activeExpert = JSON.parse(expertData); } catch(e) {}
  } else {
    activeExpert = null;
  }

  container.innerHTML = `
    <div style="display: flex; flex-direction: column; background: var(--bg-app); position: absolute; inset: 0;">

      <!-- 顶部 Header -->
      <div style="height: 56px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: var(--bg-panel); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); z-index: 10;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <h2 id="chatTitle" style="margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.2px;">新对话</h2>
          <div id="expertIndicator" style="display: none; align-items: center; gap: 6px; background: linear-gradient(135deg, rgba(108,99,255,0.12), rgba(88,86,214,0.12)); color: #7c6fff; padding: 3px 12px; border-radius: 20px; font-size: 12px; border: 1px solid rgba(108,99,255,0.2); font-weight: 500;">
            <span id="expertName"></span>
            <button id="clearExpertBtn" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0 2px; opacity: 0.7;">&times;</button>
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

          <!-- 截图预览 -->
          <div id="attachmentPreview" style="display: none; padding: 8px 16px; align-items: center; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.02);">
            <div style="position: relative; display: inline-block;">
              <img id="attachmentImg" style="height: 60px; border-radius: 8px; border: 1px solid var(--border-light); box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
              <button id="removeAttachmentBtn" style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--danger, #ff4d4f); color: white; border: none; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">&times;</button>
            </div>
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
            <!-- 新建对话 -->
            <button id="newChatBtn" class="doubao-toolbar-btn" title="新建对话">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
              <span>新对话</span>
            </button>

            <!-- 上传文件 -->
            <button id="fileUploadBtn" class="doubao-toolbar-btn" title="上传文件">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>上传</span>
            </button>

            <!-- 模型选择 -->
            <button id="modelModalBtn" class="doubao-toolbar-btn" title="切换模型">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4"/><path d="M12 19v4"/><path d="m4.2 4.2 2.8 2.8"/><path d="m17 17 2.8 2.8"/><path d="M1 12h4"/><path d="M19 12h4"/><path d="m4.2 19.8 2.8-2.8"/><path d="m17 7 2.8-2.8"/></svg>
              <span id="activeModelLabel" style="max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">选择模型</span>
            </button>

            <!-- 思考深度 -->
            <div class="doubao-toolbar-btn" title="思考深度" style="gap: 4px;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
              <select id="depthSelect" class="doubao-toolbar-select">
                <option value="auto">自动</option>
                <option value="low">浅</option>
                <option value="medium">中</option>
                <option value="high">深</option>
                <option value="extreme">极深</option>
              </select>
            </div>

            <!-- 清空上下文 -->
            <button id="clearMemoryBtn" class="doubao-toolbar-btn" title="清空上下文记忆">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
              <span>清空</span>
            </button>

            <!-- 右侧：截图 + 上下文进度环 -->
            <div class="doubao-toolbar-right" style="display: flex; align-items: center; gap: 6px;">
              <!-- 截图 -->
              <button id="readScreenBtn" class="doubao-toolbar-btn" title="截取屏幕">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9h2"/><path d="M19 9h2"/></svg>
                <span>截图</span>
              </button>

              <div id="tokenCircleBtn" class="doubao-token-ring" title="上下文占用 (点击压缩)">
                <svg viewBox="0 0 36 36" style="width: 100%; height: 100%; transform: rotate(-90deg);">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="2.5"></circle>
                  <circle id="tokenCircleFill" cx="18" cy="18" r="15" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-dasharray="94 94" stroke-dashoffset="94" stroke-linecap="round" style="transition: all 0.4s ease;"></circle>
                </svg>
                <span style="position: absolute; display: flex; align-items: center; justify-content: center;">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--text-muted);"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
                </span>
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
             <h3 style="margin: 0; font-size: 18px;">切换模型</h3>
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

  // 垃圾桶按钮点击 (情况当前上下文)
  document.getElementById('clearMemoryBtn').addEventListener('click', async () => {
    if (activeConvId) {
      try {
        await window.openClaw.chat.clearHistory(activeConvId);
        document.getElementById('chatMessages').innerHTML = `
          <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
            <div style="font-size: 48px;">💬</div>
            <div style="font-size: 16px;">上下文已清空，发送一条新消息开始吧</div>
          </div>
        `;
        tokenUsage = 0;
        updateTokenUsage();
        if (window.__toast) window.__toast.success('上下文记忆已彻底清空');
      } catch(e) {
        if (window.__toast) window.__toast.error('清空上下文失败');
      }
    }
  });

  // 引用功能关闭
  document.getElementById('closeQuoteBtn').addEventListener('click', () => {
    document.getElementById('quotePreview').style.display = 'none';
    document.getElementById('quoteText').textContent = '';
  });

  // 截图功能
  document.getElementById('readScreenBtn').addEventListener('click', async () => {
    try {
      if (window.__toast) window.__toast.info('请在屏幕上框选截图区域...');
      // 隐藏窗口以便截图
      await window.openClaw.system.hide();
      
      const dataUrl = await window.openClaw.system.captureScreenArea();
      
      // 截图完成后重新显示窗口
      await window.openClaw.system.show();

      if (dataUrl) {
        if (window.__toast) window.__toast.success('截图成功');
        pendingAttachmentData = dataUrl;
        document.getElementById('attachmentImg').src = dataUrl;
        document.getElementById('attachmentPreview').style.display = 'flex';
        document.getElementById('chatInput').focus();
      } else {
        if (window.__toast) window.__toast.info('截图已取消');
      }
    } catch (e) {
      if (window.__toast) window.__toast.error('截图失败: ' + e.message);
    }
  });

  document.getElementById('removeAttachmentBtn').addEventListener('click', () => {
    pendingAttachmentData = null;
    document.getElementById('attachmentImg').src = '';
    document.getElementById('attachmentPreview').style.display = 'none';
  });

  // 上传文件按钮（触发隐藏的 input type="file"）
  document.getElementById('fileUploadBtn').addEventListener('click', () => {
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e2) => {
        const dataUrl = e2.target.result;
        pendingAttachmentData = dataUrl;
        document.getElementById('attachmentImg').src = dataUrl;
        document.getElementById('attachmentPreview').style.display = 'flex';
        document.getElementById('chatInput').focus();
        if (window.__toast) window.__toast.success('图片已附加');
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
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

  // 全局回调供主侧边栏调用
  window.__createNewChat = createNewChat;
  window.__loadChatHistory = async (convId) => {
    activeConvId = convId;
    await loadHistory(convId);
  };
  // 供侧边栏在 navigateTo 之前设置待加载会话 ID
  // 'NEW' = 创建新对话, 具体 ID = 加载已有对话, null = 显示空状态
  window.__setPendingConv = (convId) => {
    pendingLoadConvId = convId;
  };
  window.__onConvDeleted = (convId) => {
    if (convId === activeConvId) {
      activeConvId = null;
      document.getElementById('chatMessages').innerHTML = '';
      document.getElementById('chatTitle').textContent = '新对话';
    }
  };

  // 初始化加载
  await loadModels();
  updateExpertIndicator();

  if (localStorage.getItem('justActivatedExpert') === 'true') {
    localStorage.removeItem('justActivatedExpert');
    await createNewChat();
  } else if (pendingLoadConvId === 'NEW') {
    // 侧边栏"新建对话"按钮触发
    pendingLoadConvId = null;
    await createNewChat();
  } else if (pendingLoadConvId) {
    // 从侧边栏点击了已有会话，加载它
    const convId = pendingLoadConvId;
    pendingLoadConvId = null;
    activeConvId = convId;
    await loadHistory(convId);
  } else {
    // 默认：显示空状态（不自动创建对话）
    document.getElementById('chatMessages').innerHTML = `
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">💬</div>
        <div style="font-size: 16px;">发送一条消息开始吧</div>
      </div>
    `;
    document.getElementById('chatTitle').textContent = '新对话';
    tokenUsage = 0;
    updateTokenUsage();
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

const cloudVendors = [
  { id: 'openai', name: 'OpenAI', icon: '🌌', color: '#10a37f' },
  { id: 'anthropic', name: 'Anthropic', icon: '🧠', color: '#d97757' },
  { id: 'gemini', name: 'Google Gemini', icon: '✨', color: '#4285f4' },
  { id: 'groq', name: 'Groq', icon: '⚡', color: '#f55036' },
  { id: 'mistral', name: 'Mistral AI', icon: '🌀', color: '#ff7000' },
  { id: 'deepseek', name: 'DeepSeek', icon: '🐳', color: '#4d6bfe' },
  { id: 'qwen', name: '通义千问', icon: '☁️', color: '#615ced' },
  { id: 'zhipu', name: '智谱 AI', icon: '🔮', color: '#3269ff' },
  { id: 'moonshot', name: '月之暗面 (Kimi)', icon: '🌙', color: '#000' },
  { id: 'baidu', name: '百度文心', icon: '🐻', color: '#2932e1' },
  { id: 'bytedance', name: '豆包 (字节)', icon: '🫘', color: '#fe2c55' },
  { id: 'minimax', name: 'MiniMax', icon: '🔵', color: '#1677ff' },
  { id: 'iflytek', name: '讯飞星火', icon: '🔥', color: '#ff6a00' },
  { id: 'yi', name: '零一万物', icon: '🌱', color: '#00c853' }
];

async function loadModels() {
  try {
    const res = await window.openClaw.model.getModels();
    
    // 移除重复模型，保留最新/唯一的 ID
    const uniqueMap = new Map();
    (res || []).forEach(m => uniqueMap.set(m.id, m));
    models = Array.from(uniqueMap.values());
    
    // 判断本地模型的更严谨逻辑
    const isLocal = (m) => m.type === 'local' || m.provider === 'LM Studio' || m.provider === 'Ollama' || m.id.toLowerCase().includes('local') || m.id.toLowerCase().includes('ollama');
    
    const localModels = models.filter(m => isLocal(m));
    const cloudModelsConfigured = models.filter(m => !isLocal(m) && m.configured !== false);
    
    // 渲染云端模型（展示为厂商，如果配了多个模型则默认选择第一个）
    const renderedCloud = cloudVendors.map(vendor => {
      // 检查是否已配置该厂商的模型
      const matchedModels = cloudModelsConfigured.filter(m => 
         (m.provider && m.provider.toLowerCase() === vendor.name.toLowerCase()) || 
         (m.provider && m.provider.toLowerCase() === vendor.id.toLowerCase()) ||
         m.id.toLowerCase().includes(vendor.id.toLowerCase())
      );
      
      const isConfigured = matchedModels.length > 0;
      const targetModelId = isConfigured ? matchedModels[0].id : vendor.id;
      
      return `
        <div class="model-select-card" data-id="${targetModelId}" data-vendor="${vendor.id}" data-configured="${isConfigured}" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
           <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
             <span>${vendor.icon}</span> ${vendor.name}
           </div>
           <div style="font-size: 11px; color: ${isConfigured ? 'var(--success)' : 'var(--text-muted)'};">${isConfigured ? '✓ 已配置' : '去配置 &rarr;'}</div>
        </div>
      `;
    }).join('');

    const renderLocalCard = (m) => `
      <div class="model-select-card" data-id="${m.id}" data-configured="true" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
         <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
           <span>💻</span> ${m.name}
         </div>
         <div style="font-size: 11px; color: var(--text-muted);">${m.id}</div>
      </div>
    `;

    document.getElementById('cloudModelsGrid').innerHTML = renderedCloud;
    document.getElementById('localModelsGrid').innerHTML = localModels.length > 0 ? localModels.map(renderLocalCard).join('') : '<div style="color:var(--text-muted); font-size: 12px;">暂未配置本地模型</div>';
    
    // 绑定弹窗内模型点击
    document.querySelectorAll('.model-select-card').forEach(card => {
       card.addEventListener('click', async () => {
          const isConfigured = card.dataset.configured === 'true';
          const vendorId = card.dataset.vendor;
          const id = card.dataset.id;
          
          if (!isConfigured && vendorId) {
            // 未配置，跳转至模型市场配置
            document.getElementById('modelSelectionModal').style.display = 'none';
            if (window.navigateTo) {
              window.navigateTo('market', { openConfig: vendorId });
            }
            return;
          }

          activeModelId = id;
          const modelObj = models.find(x => x.id === activeModelId);
          if(modelObj) {
            document.getElementById('activeModelLabel').textContent = modelObj.name;
          } else {
            // 如果是按厂商展示的，我们通过 DOM 更新显示名字
            const nameEl = card.querySelector('div').textContent.replace(/[^\w\s\u4e00-\u9fa5]/gi, '').trim();
            document.getElementById('activeModelLabel').textContent = nameEl;
          }
          
          // 通知后端更新 activeModelId
          if (window.openClaw.model && window.openClaw.model.setActiveModel) {
            await window.openClaw.model.setActiveModel(id).catch(e=>console.error(e));
          }

          document.getElementById('modelSelectionModal').style.display = 'none';
          if(window.__toast) window.__toast.success(`已切换为: ${modelObj?.name || id}`);
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
    } else if (activeModelId) {
       document.getElementById('activeModelLabel').textContent = activeModelId;
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

async function createNewChat() {
  if (isGenerating) return;
  try {
    const res = await window.openClaw.chat.createConversation('新对话');
    activeConvId = res.id;
    await window.refreshSidebarConversations?.();
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

function handleQuote(btn) {
  let text = btn.dataset.text;
  if (!text) return;
  if (text.length > 50) text = text.substring(0, 50) + '...';
  document.getElementById('quotePreview').style.display = 'flex';
  document.getElementById('quoteText').textContent = text;
  document.getElementById('chatInput').focus();
}

async function handleCopy(btn) {
  let text = btn.dataset.text;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    if (window.__toast) window.__toast.success('已复制');
  } catch (e) {
    if (window.__toast) window.__toast.error('复制失败');
  }
}

window.handleQuote = handleQuote;
window.handleCopy = handleCopy;

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (messages.length === 0) {
    container.innerHTML = `
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 12px;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.3;"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>
        <div style="font-size: 14px; font-weight: 500;">发送一条消息开始对话</div>
      </div>
    `;
    return;
  }

  container.innerHTML = messages.map(m => {
    let textContent = '';
    let attachmentHtml = '';
    if (Array.isArray(m.content)) {
      const textBlock = m.content.find(c => c.type === 'text');
      const imgBlock = m.content.find(c => c.type === 'image_url');
      if (textBlock) textContent = textBlock.text;
      if (imgBlock && imgBlock.image_url) attachmentHtml = `<div style="margin-top: 8px;"><img src="${imgBlock.image_url.url}" style="max-height: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div>`;
    } else {
      textContent = m.content || '';
    }
    
    let renderedHtml = m.role === 'user' ? escapeHtml(textContent).replace(/\n/g, '<br/>') : parseMarkdown(textContent);
    renderedHtml += attachmentHtml;

    const avatarUser = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const avatarAI = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
    return `
    <div class="message" style="display: flex; gap: 12px; ${m.role === 'user' ? 'flex-direction: row-reverse;' : ''}">
      <div style="width: 32px; height: 32px; border-radius: 10px; background: ${m.role === 'user' ? 'linear-gradient(135deg, var(--primary), #5856d6)' : 'var(--bg-card)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; ${m.role === 'user' ? '' : 'border: 1px solid var(--border-light);'} box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
        ${m.role === 'user' ? avatarUser : avatarAI}
      </div>
      <div style="max-width: 78%; display: flex; flex-direction: column; align-items: ${m.role === 'user' ? 'flex-end' : 'flex-start'};">
        <div style="background: ${m.role === 'user' ? 'linear-gradient(135deg, var(--primary), #5856d6)' : 'var(--bg-card)'}; color: ${m.role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 10px 14px; border-radius: ${m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; font-size: 14px; line-height: 1.65; border: ${m.role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
          ${renderedHtml}
        </div>
        <div class="message-actions" style="margin-top: 3px; opacity: 0; transition: opacity 0.15s;">
           <button class="action-btn" onclick="window.handleQuote(this)" data-text="${escapeHtml(textContent)}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 3px 6px; border-radius: 4px; transition: background 0.15s;">引用</button>
           <button class="action-btn" onclick="window.handleCopy(this)" data-text="${escapeHtml(textContent)}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 3px 6px; border-radius: 4px; transition: background 0.15s;">复制</button>
        </div>
      </div>
    </div>
  `}).join('');
  
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

  const avatarUser = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
  const avatarAI = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
  msgDiv.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 10px; background: ${role === 'user' ? 'linear-gradient(135deg, var(--primary), #5856d6)' : 'var(--bg-card)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; ${role === 'user' ? '' : 'border: 1px solid var(--border-light);'} box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      ${role === 'user' ? avatarUser : avatarAI}
    </div>
    <div style="max-width: 78%; display: flex; flex-direction: column; align-items: ${role === 'user' ? 'flex-end' : 'flex-start'};">
      <div class="msg-content-box" style="background: ${role === 'user' ? 'linear-gradient(135deg, var(--primary), #5856d6)' : 'var(--bg-card)'}; color: ${role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 10px 14px; border-radius: ${role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; font-size: 14px; line-height: 1.65; border: ${role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
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
  if (!text && !pendingAttachmentData) return;
  
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

  const attachmentData = pendingAttachmentData;
  if (attachmentData) {
    document.getElementById('removeAttachmentBtn').click(); // Clean UI state
  }

  const userBox = appendMessage('user');
  let userHtml = escapeHtml(text).replace(/\n/g, '<br/>');
  if (attachmentData) {
    userHtml += `<div style="margin-top: 8px;"><img src="${attachmentData}" style="max-height: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div>`;
  }
  userBox.innerHTML = userHtml;

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
    await window.openClaw.chat.sendMessageStream(activeConvId, text, attachmentData, activeModelId, prompt, 0.7, (parsed) => {
      if (parsed.type === 'error') {
        fullResponse += `\n\n> ❌ **错误**: ${parsed.message}`;
        aiBox.innerHTML = parseMarkdown(fullResponse);
        scrollToBottom();
        return;
      }
      if (parsed.type === 'conversation' && parsed.id) {
        activeConvId = parsed.id;
      }
      if (parsed.content) {
        fullResponse += parsed.content;
        aiBox.innerHTML = parseMarkdown(fullResponse) + '<span class="cursor" style="display: inline-block; width: 8px; height: 16px; background: currentColor; animation: blink 1s step-end infinite; margin-left: 4px;"></span>';
        scrollToBottom();
      }
    });
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
    
    // 为用户消息和 AI 消息动态添加快捷操作栏
    const addActions = (box, text) => {
       const actionsHtml = `
         <div class="message-actions" style="margin-top: 4px;">
            <button class="action-btn" onclick="window.handleQuote(this)" data-text="${escapeHtml(text)}" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">引用</button>
            <button class="action-btn" onclick="window.handleCopy(this)" data-text="${escapeHtml(text)}" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">复制</button>
         </div>
       `;
       const actionsDiv = document.createElement('div');
       actionsDiv.innerHTML = actionsHtml;
       box.parentElement.appendChild(actionsDiv.firstElementChild);
    };
    if (aiBox && aiBox.parentElement) {
      addActions(aiBox, fullResponse);
    }
    if (userBox && userBox.parentElement) {
      addActions(userBox, text);
    }
    
    window.refreshSidebarConversations?.();
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
