const fs = require('fs');

const code = `/**
 * 聊天页面
 */

let activeConvId = null;
let isGenerating = false;
let models = [];
let activeModelId = '';
let activeExpert = null;
let tokenUsage = 0; // Simulate token usage

export async function render(container) {
  container.className = 'page-layout-split';
  container.style.padding = '0';
  
  const expertData = localStorage.getItem('activeExpert');
  if (expertData) {
    try { activeExpert = JSON.parse(expertData); } catch(e) {}
  } else {
    activeExpert = null;
  }

  container.innerHTML = \\`
    <!-- 左侧对话列表 -->
    <div class="page-sidebar" style="width: 260px; display: flex; flex-direction: column;">
      <div class="page-sidebar-header" style="padding: 20px; border-bottom: 1px solid var(--border-light);">
        <h3 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600;">💬 会话历史</h3>
        <button id="newChatBtn" class="btn btn-primary" style="width: 100%; border-radius: 8px; padding: 10px; font-weight: 600;">+ 新建对话</button>
      </div>
      <div id="convList" style="flex: 1; overflow-y: auto; padding: 12px;">
        <!-- 会话列表 -->
      </div>
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
        
        <div class="chat-toolbar-advanced">
          <!-- 这里原本放模型下拉框，现在已移到底部 -->
        </div>
      </div>

      <!-- 聊天消息展示区 -->
      <div id="chatMessages" style="flex: 1; overflow-y: auto; padding: 24px; display: flex; flex-direction: column; gap: 24px;">
        <!-- Messages -->
      </div>

      <!-- 底部输入区 -->
      <div style="padding: 20px 24px; background: var(--bg-app); border-top: 1px solid var(--border-light); display: flex; flex-direction: column; align-items: center;">
        
        <!-- Apple-style Glassmorphism Controls -->
        <div class="chat-input-controls-glass" style="width: 100%; max-width: 850px; justify-content: flex-start; gap: 12px; padding: 8px 16px;">
          
          <!-- 文件上传 -->
          <button id="fileUploadBtn" class="toolbar-btn" title="上传文件">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
            上传文件
          </button>

          <!-- 模型选择 -->
          <div class="sleek-select-wrapper" style="background: rgba(0, 217, 255, 0.1); border-radius: 20px; padding-left: 12px; border: 1px solid rgba(0, 217, 255, 0.2);">
            <span class="icon">🤖</span>
            <select id="modelSelect" class="sleek-select" style="font-weight: 600; width: 140px; color: var(--text-primary);"></select>
            <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>

          <!-- 思考深度 -->
          <div class="sleek-select-wrapper" style="background: rgba(108, 99, 255, 0.1); border-radius: 20px; padding-left: 12px; border: 1px solid rgba(108, 99, 255, 0.2);">
            <span class="icon">🧠</span>
            <select id="depthSelect" class="sleek-select" style="font-weight: 600; width: 80px; color: var(--text-primary);">
              <option value="auto">自动</option>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="extreme">极高</option>
            </select>
            <svg class="chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>

          <!-- 通话 -->
          <button id="callBtn" class="toolbar-btn" title="通话 (语音/视频)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
            通话
          </button>

          <!-- 右侧上下文状态 -->
          <div style="margin-left: auto; display: flex; align-items: center; gap: 12px;">
             <!-- 清理记忆 -->
             <button id="clearMemoryBtn" class="action-btn delete" title="清理记忆 / 压缩上下文" style="font-size: 16px;">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
             </button>
             <!-- 进度条 -->
             <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-end;" title="上下文占用率">
               <div class="token-usage-bar" style="background: rgba(0,0,0,0.1);">
                 <div class="token-usage-fill" id="tokenUsageFill" style="width: 0%; background: var(--success);"></div>
               </div>
             </div>
          </div>
        </div>

        <div style="width: 100%; max-width: 850px; position: relative;">
          <!-- 引用预览区 (默认隐藏) -->
          <div id="quotePreview" class="quote-preview" style="display: none;">
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <strong style="color: var(--primary);">引用：</strong>
              <span id="quoteText"></span>
            </div>
            <span class="close-quote" id="closeQuoteBtn">&times;</span>
          </div>

          <textarea id="chatInput" placeholder="输入消息，Shift + Enter 换行..." style="width: 100%; min-height: 56px; max-height: 200px; padding: 16px 60px 16px 20px; border-radius: 16px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-primary); font-size: 15px; resize: none; overflow-y: auto; outline: none; font-family: inherit; box-shadow: 0 4px 12px rgba(0,0,0,0.1); line-height: 1.5;"></textarea>
          
          <button id="sendBtn" class="chat-send-btn" style="position: absolute; right: 12px; bottom: 12px; width: 36px; height: 36px; border-radius: 50%; background: var(--primary); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
          </button>
        </div>
      </div>
    </div>
  \\`;

  // 绑定基础事件
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
  
  document.getElementById('modelSelect').addEventListener('change', (e) => {
    activeModelId = e.target.value;
  });

  document.getElementById('clearMemoryBtn').addEventListener('click', () => {
    tokenUsage = 0;
    updateTokenUsage();
    if (window.__toast) window.__toast.success('上下文已压缩！记忆释放完毕。');
  });

  document.getElementById('closeQuoteBtn').addEventListener('click', () => {
    document.getElementById('quotePreview').style.display = 'none';
    document.getElementById('quoteText').textContent = '';
  });

  // 初始化加载
  await loadModels();
  await loadConversations();
  updateExpertIndicator();

  // 如果刚选择了专家，自动新建一个会话
  if (localStorage.getItem('justActivatedExpert') === 'true') {
    localStorage.removeItem('justActivatedExpert');
    await createNewChat();
  } else if (activeConvId) {
    await loadHistory(activeConvId);
  }
}

function updateExpertIndicator() {
  const indicator = document.getElementById('expertIndicator');
  if (activeExpert) {
    document.getElementById('expertName').textContent = \\`\${activeExpert.icon || ''} \${activeExpert.name}\\`;
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
}

function updateTokenUsage() {
  const fill = document.getElementById('tokenUsageFill');
  if (!fill) return;
  fill.style.width = \`\${Math.min(tokenUsage, 100)}%\`;
  if (tokenUsage < 50) fill.style.background = 'var(--success)';
  else if (tokenUsage < 80) fill.style.background = 'var(--warning)';
  else fill.style.background = 'var(--danger)';
}

async function loadModels() {
  try {
    const res = await window.openClaw.model.getModels();
    models = res || [];
    const select = document.getElementById('modelSelect');
    
    // 显示本地还是云端模型名称
    select.innerHTML = models.map(m => {
      const isLocal = m.id.toLowerCase().includes('ollama') || m.id.toLowerCase().includes('local');
      const prefix = isLocal ? '💻 本地 | ' : '☁️ 云端 | ';
      return \\`<option value="\${m.id}">\${prefix}\${m.name}</option>\\`;
    }).join('');
    
    const activeRes = await window.openClaw.model.getActiveModel();
    if (activeRes && activeRes.id) {
      activeModelId = activeRes.id;
      select.value = activeModelId;
    } else if (models.length > 0) {
      activeModelId = models[0].id;
      select.value = activeModelId;
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}

async function loadConversations() {
  try {
    const list = await window.openClaw.chat.getConversations();
    const listContainer = document.getElementById('convList');
    
    if (!list || list.length === 0) {
      listContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: var(--text-muted); font-size: 13px;">暂无历史会话</div>';
      return;
    }

    if (!activeConvId && list.length > 0) {
      activeConvId = list[0].id;
    }

    listContainer.innerHTML = list.map(c => \\`
      <div class="conv-item \${c.id === activeConvId ? 'active' : ''}" data-id="\${c.id}" style="padding: 12px 16px; margin-bottom: 8px; border-radius: 8px; cursor: pointer; transition: all 0.2s; background: \${c.id === activeConvId ? 'var(--bg-active)' : 'transparent'};">
        <div style="font-weight: 500; font-size: 14px; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">\${escapeHtml(c.title || '新对话')}</div>
        <div style="font-size: 12px; color: var(--text-muted);">\${new Date(c.updated_at || c.created_at).toLocaleString()}</div>
      </div>
    \\`).join('');

    document.querySelectorAll('.conv-item').forEach(el => {
      el.addEventListener('click', () => {
        if (isGenerating) return;
        activeConvId = el.dataset.id;
        loadConversations();
        loadHistory(activeConvId);
      });
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
    document.getElementById('chatMessages').innerHTML = \\`
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">✨</div>
        <div style="font-size: 16px;">新的对话已创建</div>
      </div>
    \\`;
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
    // 模拟 token usage
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

// 供全局或事件绑定调用的引用方法
window.handleQuote = handleQuote;

function renderMessages(messages) {
  const container = document.getElementById('chatMessages');
  if (messages.length === 0) {
    container.innerHTML = \\`
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">💬</div>
        <div style="font-size: 16px;">发送一条消息开始吧</div>
      </div>
    \\`;
    return;
  }

  container.innerHTML = messages.map(m => \\`
    <div class="message" style="display: flex; gap: 16px; \${m.role === 'user' ? 'flex-direction: row-reverse;' : ''}">
      <div style="width: 36px; height: 36px; border-radius: 50%; background: \${m.role === 'user' ? 'var(--primary)' : 'var(--bg-active)'}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
        \${m.role === 'user' ? '👤' : '🤖'}
      </div>
      <div style="max-width: 75%; display: flex; flex-direction: column; align-items: \${m.role === 'user' ? 'flex-end' : 'flex-start'};">
        <div style="background: \${m.role === 'user' ? 'var(--primary)' : 'var(--bg-card)'}; color: \${m.role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 12px 16px; border-radius: 16px; font-size: 15px; line-height: 1.6; border: \${m.role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: var(--shadow-sm);">
          \${m.role === 'user' ? escapeHtml(m.content).replace(/\\n/g, '<br/>') : parseMarkdown(m.content)}
        </div>
        <!-- 快捷操作栏 -->
        <div class="message-actions">
           <button class="action-btn" onclick="window.handleQuote(\`\${escapeHtml(m.content).substring(0, 50)}...\`)">引用</button>
           <button class="action-btn">复制</button>
        </div>
      </div>
    </div>
  \\`).join('');
  
  scrollToBottom();
}

function appendMessage(role, id = null) {
  const container = document.getElementById('chatMessages');
  if (container.children.length === 1 && (container.children[0].textContent.includes('发送一条消息') || container.children[0].textContent.includes('新的对话'))) {
    container.innerHTML = '';
  }

  const msgDiv = document.createElement('div');
  msgDiv.className = 'message';
  msgDiv.id = id ? \`msg-\${id}\` : \`msg-temp\`;
  msgDiv.style.display = 'flex';
  msgDiv.style.gap = '16px';
  msgDiv.style.marginBottom = '24px';
  if (role === 'user') msgDiv.style.flexDirection = 'row-reverse';

  msgDiv.innerHTML = \\`
    <div style="width: 36px; height: 36px; border-radius: 50%; background: \${role === 'user' ? 'var(--primary)' : 'var(--bg-active)'}; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">
      \${role === 'user' ? '👤' : '🤖'}
    </div>
    <div style="max-width: 75%; display: flex; flex-direction: column; align-items: \${role === 'user' ? 'flex-end' : 'flex-start'};">
      <div class="msg-content-box" style="background: \${role === 'user' ? 'var(--primary)' : 'var(--bg-card)'}; color: \${role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 12px 16px; border-radius: 16px; font-size: 15px; line-height: 1.6; border: \${role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: var(--shadow-sm);">
        <span class="cursor" style="display: \${role === 'ai' ? 'inline-block' : 'none'}; width: 8px; height: 16px; background: currentColor; animation: blink 1s step-end infinite;"></span>
      </div>
    </div>
  \\`;
  container.appendChild(msgDiv);
  scrollToBottom();
  return msgDiv.querySelector('.msg-content-box');
}

async function sendMessage() {
  if (isGenerating) {
    window.openClaw.chat.abortStream();
    isGenerating = false;
    document.getElementById('sendBtn').innerHTML = \\`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>\\`;
    document.getElementById('sendBtn').style.background = 'var(--primary)';
    return;
  }

  const input = document.getElementById('chatInput');
  let text = input.value.trim();
  if (!text) return;
  
  const quotePreview = document.getElementById('quotePreview');
  if (quotePreview.style.display === 'flex') {
     const quoteText = document.getElementById('quoteText').textContent;
     text = \\`> \${quoteText}\\n\\n\${text}\\`;
     quotePreview.style.display = 'none';
     document.getElementById('quoteText').textContent = '';
  }

  if (!activeConvId) {
    await createNewChat();
  }

  input.value = '';
  input.style.height = '56px';

  const userBox = appendMessage('user');
  userBox.innerHTML = escapeHtml(text).replace(/\\n/g, '<br/>');

  isGenerating = true;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.innerHTML = \\`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="10" x="7" y="7" rx="1"></rect></svg>\\`;
  sendBtn.style.background = 'var(--danger)';

  const aiBox = appendMessage('ai');
  let fullResponse = '';
  
  // 模拟 token 上涨
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
      const lines = chunk.split('\\n');
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
      fullResponse += '\\n\\n*(已中断)*';
    } else {
      fullResponse += '\\n\\n**[发生错误]** ' + err.message;
      if (window.__toast) window.__toast.error('发送失败: ' + err.message);
    }
  } finally {
    isGenerating = false;
    sendBtn.innerHTML = \\`<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>\\`;
    sendBtn.style.background = 'var(--primary)';
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
  
  html = html.replace(/\`\`\`(\\w*)\\n([\\s\\S]*?)\`\`\`/g, '<pre style="background: var(--bg-active); padding:12px; border-radius:8px; overflow-x:auto; margin: 8px 0;"><code style="font-family:Consolas,monospace; font-size:13px;">$2</code></pre>');
  html = html.replace(/\`([^\`]+)\`/g, '<code style="background:var(--bg-active); padding:2px 4px; border-radius:4px; font-family:Consolas,monospace; font-size:0.9em;">$1</code>');
  html = html.replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>');
  html = html.replace(/\\*(.*?)\\*/g, '<em>$1</em>');
  html = html.replace(/&gt; (.*?)(?:\\n|$)/g, '<blockquote style="border-left: 3px solid var(--primary); color: var(--text-muted); margin: 4px 0; padding-left: 8px;">$1</blockquote>');
  html = html.replace(/\\n/g, '<br/>');

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
`;

fs.writeFileSync('src/renderer/pages/chat.js', code);
console.log('Built chat.js');
