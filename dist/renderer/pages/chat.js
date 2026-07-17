// @ts-nocheck
/**
 * 聊天页面 v3 — 全宽聊天界面，会话管理已移至主侧边栏
 */
import { api } from '../utils.js';
import { escapeHtml } from '../utils.js';
import { parseMarkdown } from '../utils.js';
import { EXPERTS } from './experts.js';
import { showSandboxConfirm } from '../components.js';
let activeConvId = null;
const generatingStates = new Map();
let currentAiBox = null;
function updateSendButtonState() {
    const btn = document.getElementById('sendBtn');
    if (!btn)
        return;
    const curGenerating = generatingStates.get(activeConvId)?.isGenerating || false;
    if (curGenerating) {
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--danger);"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>`;
        btn.classList.add('is-stop');
    }
    else {
        btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
        btn.classList.remove('is-stop');
    }
}
function initThinkingBox(aiBox) {
    aiBox.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 14px;">
      <svg style="animation: spin 1s linear infinite;" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      <span>正在思考...</span>
      <span class="loading-timer" style="font-family: monospace; color: var(--primary);">0.0s</span>
    </div>
  `;
}
function startThinkingTimer(aiBox, startTime, state) {
    const timerId = setInterval(() => {
        if (!state.isGenerating || !document.body.contains(aiBox)) {
            clearInterval(timerId);
            return;
        }
        const seconds = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
        const timerEl = aiBox.querySelector('.loading-timer');
        if (timerEl)
            timerEl.textContent = seconds;
        const thinkTimerEl = aiBox.querySelector('.thinking-timer');
        if (thinkTimerEl)
            thinkTimerEl.textContent = seconds;
    }, 100);
    return timerId;
}
function updateAiBoxContent(aiBox, fullText) {
    let displayResponse = fullText
        .replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '')
        .replace(/\[SAVE_MEMORY:[\s\S]*$/, '');
    if (!displayResponse.trim()) {
        return;
    }
    displayResponse = displayResponse.replace(/<think>([\s\S]*?)<\/think>/gi, (match, p1) => {
        return `<details style="margin-bottom: 12px; border: 1px solid var(--border-light); border-radius: 8px; background: rgba(0,0,0,0.1); padding: 8px;"><summary style="cursor: pointer; color: var(--text-muted); font-size: 13px; user-select: none;">💡 思考过程展开</summary><div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--text-muted); white-space: pre-wrap;">${p1}</div></details>`;
    });
    displayResponse = displayResponse.replace(/<think>([\s\S]*)$/i, (match, p1) => {
        return `<details open style="margin-bottom: 12px; border: 1px solid var(--border-light); border-radius: 8px; background: rgba(0,0,0,0.1); padding: 8px; border-left: 3px solid var(--primary);"><summary style="cursor: pointer; color: var(--primary); font-size: 13px; font-weight: bold; user-select: none;"><svg style="animation: spin 1s linear infinite; vertical-align: text-bottom; margin-right:4px;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 模型深度思考中... <span class="thinking-timer" style="font-family: monospace; margin-left: 6px; color: var(--primary);">0.0s</span></summary><div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--text-muted); white-space: pre-wrap;">${p1}</div></details>`;
    });
    const codeBlockCount = (displayResponse.match(/\`\`\`/g) || []).length;
    if (codeBlockCount % 2 !== 0) {
        displayResponse += '\n\`\`\`';
    }
    aiBox.innerHTML = parseMarkdown(displayResponse);
}
function adjustTextareaHeight(textarea) {
    if (!textarea)
        return;
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}
let models = [];
let activeModelId = '';
let activeExpert = null;
let tokenUsage = 0;
let pendingAttachmentData = null;
let pendingLoadConvId = null; // 从侧边栏点击时预设的会话 ID
let reloadModelsCallback = null;
let isAgentModeEnabled = false;
export async function init(container) {
    if (reloadModelsCallback) {
        await reloadModelsCallback();
    }
}
export async function render(container) {
    container.className = 'page';
    container.style.padding = '0';
    const expertData = localStorage.getItem('activeExpert');
    if (expertData) {
        try {
            activeExpert = JSON.parse(expertData);
        }
        catch (e) { }
    }
    else {
        activeExpert = null;
    }
    container.innerHTML = `
    <style>
      /* 高级零延迟 CSS 气泡 Tooltip 体系 */
      [data-tooltip] {
        position: relative !important;
      }

      [data-tooltip]::after {
        content: attr(data-tooltip) !important;
        position: absolute !important;
        bottom: 125% !important;
        left: 50% !important;
        transform: translate(-50%, 4px) scale(0.95) !important;
        background: rgba(15, 23, 42, 0.96) !important;
        color: #ffffff !important;
        padding: 5px 9px !important;
        font-size: 11px !important;
        font-weight: 500 !important;
        border-radius: 6px !important;
        white-space: nowrap !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: all 0.15s cubic-bezier(0.4, 0, 0.2, 1) !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(255, 255, 255, 0.08) !important;
        z-index: 10000 !important;
      }

      [data-tooltip]:hover::after {
        opacity: 1 !important;
        transform: translate(-50%, 0) scale(1) !important;
      }

      /* 工具栏通用高质感按钮微交互 */
      .toolbar-action-btn {
        height: 32px;
        min-width: 32px;
        border-radius: 10px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        padding: 4px 8px !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.01) !important;
        box-sizing: border-box !important;
        border: 1px solid transparent !important;
      }

      .toolbar-action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.04);
      }

      .toolbar-action-btn:active {
        transform: translateY(0);
      }

      /* 莫兰迪暖透微色彩配置 */
      
      /* 模型选择 */
      #modelModalBtn {
        background: rgba(0, 122, 255, 0.05) !important;
        border-color: rgba(0, 122, 255, 0.1) !important;
        color: var(--primary) !important;
      }
      #modelModalBtn:hover {
        background: rgba(0, 122, 255, 0.08) !important;
        border-color: rgba(0, 122, 255, 0.2) !important;
      }
      #activeModelLabel {
        max-width: 80px !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        white-space: nowrap !important;
        display: inline-block !important;
        vertical-align: bottom !important;
      }

      /* 思考深度 */
      .depth-select-container {
        background: rgba(0, 217, 255, 0.04) !important;
        border-color: rgba(0, 217, 255, 0.1) !important;
        color: #00b0ff !important;
      }
      .depth-select-container:hover {
        background: rgba(0, 217, 255, 0.08) !important;
        border-color: rgba(0, 217, 255, 0.2) !important;
      }

      /* 智能代理 */
      #agentModeBtn {
        background: rgba(128, 128, 128, 0.04) !important;
        border-color: rgba(128, 128, 128, 0.08) !important;
        color: var(--text-secondary) !important;
      }
      #agentModeBtn:hover {
        background: rgba(128, 128, 128, 0.08) !important;
        border-color: rgba(128, 128, 128, 0.15) !important;
      }
      #agentModeBtn.active {
        background: rgba(76, 175, 80, 0.08) !important;
        border-color: rgba(76, 175, 80, 0.2) !important;
        color: #4CAF50 !important;
      }
      #agentModeBtn.active:hover {
        background: rgba(76, 175, 80, 0.12) !important;
        border-color: rgba(76, 175, 80, 0.3) !important;
      }

      /* 提示词优化 */
      #optimizePromptBtn {
        background: rgba(162, 89, 255, 0.04) !important;
        border-color: rgba(162, 89, 255, 0.08) !important;
        color: #a259ff !important;
      }
      #optimizePromptBtn:hover {
        background: rgba(162, 89, 255, 0.1) !important;
        border-color: rgba(162, 89, 255, 0.2) !important;
      }

      /* 语音输入 */
      #voiceBtn {
        background: rgba(128, 128, 128, 0.03) !important;
        border-color: rgba(128, 128, 128, 0.06) !important;
        color: var(--text-secondary) !important;
      }

      /* 顶部 Header 独立管理组按钮 */
      .header-action-btn {
        height: 28px !important;
        width: 28px !important;
        border-radius: 8px !important;
        background: var(--bg-hover) !important;
        border: 1px solid var(--border-light) !important;
        color: var(--text-secondary) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1) !important;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.01) !important;
        box-sizing: border-box !important;
      }
      
      .header-action-btn:hover {
        background: var(--border-light) !important;
        color: var(--text-primary) !important;
        transform: translateY(-1px);
      }

      .header-action-btn:active {
        transform: translateY(0);
      }

      #clearMemoryBtn.header-action-btn:hover {
        background: rgba(255, 59, 48, 0.08) !important;
        border-color: rgba(255, 59, 48, 0.2) !important;
        color: #ff3b30 !important;
      }

      #tokenCircleBtn.header-action-btn:hover {
        background: rgba(255, 152, 0, 0.08) !important;
        border-color: rgba(255, 152, 0, 0.2) !important;
        color: #ff9800 !important;
      }

      /* 顶栏右侧按钮气泡防溢出与边界阻挡修复 (向下弹出) */
      .header-action-btn[data-tooltip]::after {
        bottom: auto !important;
        top: 125% !important;
        left: auto !important;
        right: 0 !important;
        transform: translate(0, -4px) scale(0.95) !important;
      }
      
      .header-action-btn[data-tooltip]:hover::after {
        opacity: 1 !important;
        transform: translate(0, 0) scale(1) !important;
      }
    </style>
    <div style="display: flex; flex-direction: column; background: var(--bg-app); position: absolute; inset: 0;">

      <!-- 顶部 Header -->
      <div style="height: 56px; border-bottom: 1px solid var(--border-light); display: flex; align-items: center; justify-content: space-between; padding: 0 24px; background: var(--bg-panel); backdrop-filter: var(--blur-material); -webkit-backdrop-filter: var(--blur-material); z-index: 10;">
        
        <!-- 左侧区域 -->
        <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
          <h2 id="chatTitle" style="margin: 0; font-size: 17px; font-weight: 600; letter-spacing: -0.2px; color: var(--text-primary);">新对话</h2>
          <div id="expertIndicator" style="display: none; align-items: center; gap: 6px; background: var(--primary-light); color: var(--primary); padding: 3px 12px; border-radius: 20px; font-size: 12px; border: 1px solid rgba(0,122,255,0.1); font-weight: 500;">
            <span id="expertName"></span>
            <button id="clearExpertBtn" style="background: none; border: none; color: inherit; cursor: pointer; font-size: 14px; padding: 0 2px; opacity: 0.7;">&times;</button>
          </div>
        </div>

        <!-- 居中空白 -->
        <div style="flex: 1;"></div>

        <!-- 右侧区域 -->
        <div style="flex: 1; display: flex; justify-content: flex-end; gap: 10px; align-items: center;">
          <!-- 顶部管理组 -->
          <div style="display: flex; gap: 6px; align-items: center; position: relative;">
            <!-- 上下文压缩 (多层堆叠图标) -->
            <button id="tokenCircleBtn" class="header-action-btn" data-tooltip="压缩上下文">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: #ff9800;"><path d="m12 4-10 5 10 5 10-5-10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 13 10 5 10-5"/></svg>
            </button>
            
            <!-- 清空上下文 (垃圾桶图标) -->
            <button id="clearMemoryBtn" class="header-action-btn" data-tooltip="清空上下文记忆">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: #ff3b30;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
            </button>
          </div>

        </div>
      </div>

      <!-- 聊天消息展示区 -->
      <div id="chatMessages" class="chat-messages-container">
        <!-- Messages -->
      </div>

      <!-- 底部输入区 — 极简收纳风格 -->
      <div class="doubao-input-wrapper" style="padding-bottom: 24px;">
        <div id="mentionPopup" class="mention-popup" style="display: none; position: absolute; bottom: 100%; left: 16px; margin-bottom: 8px;"></div>
        <div class="doubao-input-container">
          <!-- 引用预览 -->
          <div id="quotePreview" class="quote-preview" style="display: none;">
            <div style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              <strong style="color: var(--primary);">引用：</strong>
              <span id="quoteText"></span>
            </div>
            <span class="close-quote" id="closeQuoteBtn">&times;</span>
          </div>

          <!-- 截图预览 -->
          <div id="attachmentPreview" style="display: none; padding: 8px 16px; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.02); border-radius: 12px 12px 0 0;">
            <div style="position: relative; display: inline-block;">
              <img id="attachmentImg" style="height: 60px; border-radius: 8px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm);" />
              <button id="removeAttachmentBtn" style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--danger); color: white; border: none; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">&times;</button>
            </div>
            <!-- OCR 提取控制 -->
            <div style="display: flex; gap: 8px;">
              <button id="ocrTextBtn" class="btn-ghost" style="padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; color: var(--primary); background: rgba(0, 122, 255, 0.08); border: 1px solid rgba(0, 122, 255, 0.15); display: flex; align-items: center; gap: 4px; cursor: pointer;" onmouseover="this.style.background='rgba(0,122,255,0.15)';" onmouseout="this.style.background='rgba(0,122,255,0.08)';">
                🤖 提取文字 (OCR)
              </button>
              <button id="ocrTableBtn" class="btn-ghost" style="padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; color: #00c853; background: rgba(0, 200, 83, 0.08); border: 1px solid rgba(0, 200, 83, 0.15); display: flex; align-items: center; gap: 4px; cursor: pointer;" onmouseover="this.style.background='rgba(0,200,83,0.15)';" onmouseout="this.style.background='rgba(0,200,83,0.08)';">
                📊 提取表格
              </button>
            </div>
          </div>

          <!-- 输入行：内部嵌入左右控制区 -->
          <div class="doubao-input-row">
            <textarea id="chatInput" class="doubao-textarea" placeholder="发送消息给 Assistant...  @呼叫专家  Shift+Enter 换行" rows="1"></textarea>
            
            <!-- 底部操作栏 -->
            <div class="doubao-input-tools">
              
              <!-- 左侧：附件与设定 -->
              <div style="display: flex; gap: 6px; position: relative; align-items: center;">
                <button id="plusMenuBtn" class="btn-icon" data-tooltip="附加操作">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                </button>
                <!-- 隐藏的+号悬浮菜单 -->
                <div id="plusMenu" class="popover-menu" style="display: none; bottom: 100%; left: 0; margin-bottom: 8px; width: 140px;">
                  <button id="fileUploadBtn" class="popover-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    上传文件
                  </button>
                  <button id="readScreenBtn" class="popover-item">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M3 9h2"/><path d="M19 9h2"/></svg>
                    截取屏幕
                  </button>
                </div>

                <!-- 切换大模型 -->
                <button id="modelModalBtn" class="toolbar-action-btn" data-tooltip="切换大模型">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px;"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                  <span id="activeModelLabel">选择模型</span>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5; margin-left: 4px;"><path d="m6 9 6 6 6-6"/></svg>
                </button>

                <!-- 思考深度 -->
                <div class="toolbar-action-btn depth-select-container" data-tooltip="思考深度" style="gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #00d9ff;"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
                  <select id="depthSelect" style="background:transparent; border:none; color:inherit; outline:none; cursor:pointer;">
                    <option value="auto">自动</option>
                    <option value="low">浅度思考</option>
                    <option value="medium">中度思考</option>
                    <option value="high">深度思考</option>
                    <option value="extreme">极度推理</option>
                  </select>
                </div>

                <!-- 代理模式 (Agent Tool Calling) 开关 -->
                <button id="agentModeBtn" class="toolbar-action-btn" data-tooltip="智能代理: 关">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M9 1v3"/><path d="M15 1v3"/><path d="M9 20v3"/><path d="M15 20v3"/><path d="M20 9h3"/><path d="M20 15h3"/><path d="M1 9h3"/><path d="M1 15h3"/></svg>
                </button>
              </div>

              <!-- 右侧：发送组 -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <!-- 语音输入 -->
                <button id="voiceBtn" class="toolbar-action-btn" data-tooltip="语音输入" style="opacity: 0.5;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                </button>

                <!-- 提示词优化 -->
                <button id="optimizePromptBtn" class="toolbar-action-btn" data-tooltip="提示词优化">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v2"/><path d="M4 4h2"/><path d="M19 19v2"/><path d="M18 20h2"/></svg>
                </button>

                <button id="sendBtn" class="doubao-send-btn" data-tooltip="发送 (Enter)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 模型选择 Modal 弹窗 -->
    <div id="modelSelectionModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 99999; align-items: center; justify-content: center; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
       <div style="background: var(--bg-app); width: 660px; max-width: 92%; border-radius: 24px; box-shadow: 0 32px 64px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.06); display: flex; flex-direction: column; overflow: hidden; animation: modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <div style="padding: 20px 28px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, rgba(108,99,255,0.08), rgba(0,217,255,0.05));">
             <h3 style="margin: 0; font-size: 18px; font-weight: 700; display: flex; align-items: center; gap: 10px;">切换模型</h3>
             <button id="closeModelModalBtn" style="background: rgba(128,128,128,0.15); border: none; font-size: 18px; cursor: pointer; color: var(--text-muted); width: 32px; height: 32px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,59,48,0.15)'; this.style.color='#ff3b30';" onmouseout="this.style.background='rgba(128,128,128,0.15)'; this.style.color='var(--text-muted)';">&times;</button>
          </div>
          <div style="padding: 24px 28px; display: flex; flex-direction: column; gap: 24px; max-height: 65vh; overflow-y: auto;">
             <!-- 云端模型 -->
             <div>
                <h4 style="margin: 0 0 14px 0; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;"><span style="display: inline-block; width: 4px; height: 16px; border-radius: 2px; background: linear-gradient(180deg, #6c63ff, #af52de);"></span> 云端模型</h4>
                <div id="cloudModelsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 10px;"></div>
             </div>
             <!-- 本地模型 -->
             <div>
                <h4 style="margin: 0 0 14px 0; font-size: 13px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;"><span style="display: inline-block; width: 4px; height: 16px; border-radius: 2px; background: linear-gradient(180deg, #00d9ff, #00c853);"></span> 本地模型</h4>
                <div id="localModelsGrid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(175px, 1fr)); gap: 10px;"></div>
             </div>
          </div>
       </div>
    </div>



    <!-- OCR 识别结果浮窗 -->
    <div id="ocrResultModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.55); z-index: 100000; align-items: center; justify-content: center; backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);">
      <div style="background: var(--bg-app); width: 500px; max-width: 90%; border-radius: 16px; box-shadow: 0 24px 48px rgba(0,0,0,0.3); display: flex; flex-direction: column; overflow: hidden; animation: modalSlideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
        <div style="padding: 16px 20px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, rgba(0,200,83,0.05), rgba(0,122,255,0.05));">
          <h4 style="margin: 0; font-size: 15px; font-weight: 700; color: var(--text-primary); display: flex; align-items: center; gap: 8px;">🤖 AI OCR 提取识别结果</h4>
          <button id="closeOcrModalBtn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: var(--text-muted);">&times;</button>
        </div>
        <div style="padding: 20px; flex: 1; overflow-y: auto;">
          <textarea id="ocrResultText" style="width: 100%; height: 160px; border: 1px solid var(--border-light); border-radius: 8px; padding: 12px; font-family: monospace; font-size: 13px; background: rgba(0,0,0,0.02); color: var(--text-primary); resize: none; outline: none; box-sizing: border-box; line-height: 1.5;"></textarea>
        </div>
        <div style="padding: 12px 20px; border-top: 1px solid var(--border-light); display: flex; justify-content: flex-end; gap: 8px; background: rgba(0,0,0,0.01);">
          <button id="copyOcrBtn" class="btn btn-default" style="border-radius: 8px; font-size: 13px; padding: 6px 14px; cursor: pointer;">复制到剪贴板</button>
          <button id="insertOcrBtn" class="btn btn-primary" style="border-radius: 8px; font-size: 13px; padding: 6px 14px; border: none; cursor: pointer;">插入到输入框</button>
        </div>
      </div>
    </div>
  `;
    // --- 基础事件 ---
    document.getElementById('agentModeBtn').addEventListener('click', () => {
        isAgentModeEnabled = !isAgentModeEnabled;
        const btn = document.getElementById('agentModeBtn');
        if (isAgentModeEnabled) {
            btn.classList.add('active');
            btn.setAttribute('data-tooltip', '智能代理: 开');
            if (window.__toast)
                window.__toast.success('⚡ 智能代理模式已开启');
        }
        else {
            btn.classList.remove('active');
            btn.setAttribute('data-tooltip', '智能代理: 关');
            if (window.__toast)
                window.__toast.info('⚡ 智能代理模式已关闭');
        }
    });
    document.getElementById('clearExpertBtn').addEventListener('click', () => {
        localStorage.removeItem('activeExpert');
        activeExpert = null;
        updateExpertIndicator();
        if (window.__toast)
            window.__toast.info('已退出专家模式');
    });
    const chatInput = document.getElementById('chatInput');
    const plusMenuBtn = document.getElementById('plusMenuBtn');
    const plusMenu = document.getElementById('plusMenu');
    if (plusMenuBtn && plusMenu) {
        plusMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            plusMenu.style.display = plusMenu.style.display === 'none' ? 'flex' : 'none';
        });
        document.addEventListener('click', (e) => {
            if (!plusMenuBtn.contains(e.target) && !plusMenu.contains(e.target)) {
                plusMenu.style.display = 'none';
            }
        });
    }
    // Hide popover if item is clicked
    document.querySelectorAll('.popover-item').forEach(item => {
        item.addEventListener('click', () => {
            if (plusMenu)
                plusMenu.style.display = 'none';
        });
    });
    // --- Mention Popup (@呼叫专家) 逻辑 ---
    let mentionActive = false;
    let mentionQuery = '';
    let selectedExpertIndex = 0;
    let filteredExperts = [];
    const mentionPopup = document.getElementById('mentionPopup');
    const renderMentionPopup = () => {
        if (!mentionActive) {
            mentionPopup.style.display = 'none';
            return;
        }
        filteredExperts = EXPERTS.filter(exp => exp.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
            (exp.description && exp.description.toLowerCase().includes(mentionQuery.toLowerCase())));
        if (filteredExperts.length === 0) {
            mentionPopup.style.display = 'none';
            return;
        }
        selectedExpertIndex = Math.max(0, Math.min(selectedExpertIndex, filteredExperts.length - 1));
        mentionPopup.innerHTML = filteredExperts.map((exp, idx) => `
      <div class="mention-popup-item ${idx === selectedExpertIndex ? 'active' : ''}" data-idx="${idx}">
        <div class="icon" style="background: ${exp.color}15;">${exp.icon}</div>
        <div class="info">
          <div class="name">${escapeHtml(exp.name)}</div>
          <div class="desc">${escapeHtml(exp.description || '')}</div>
        </div>
      </div>
    `).join('');
        mentionPopup.style.display = 'flex';
        // 绑定点击事件
        mentionPopup.querySelectorAll('.mention-popup-item').forEach(item => {
            item.addEventListener('click', () => {
                const idx = parseInt(item.getAttribute('data-idx'));
                selectExpert(filteredExperts[idx]);
            });
            item.addEventListener('mouseenter', () => {
                selectedExpertIndex = parseInt(item.getAttribute('data-idx'));
                renderMentionPopup();
            });
        });
    };
    const selectExpert = (expert) => {
        // 替换输入框中的 @query 为空，然后聚焦
        const val = chatInput.value;
        const atIndex = val.lastIndexOf('@');
        if (atIndex !== -1) {
            chatInput.value = val.substring(0, atIndex) + val.substring(atIndex + mentionQuery.length + 1).trim();
        }
        mentionActive = false;
        renderMentionPopup();
        // 激活专家
        activeExpert = expert;
        localStorage.setItem('activeExpert', JSON.stringify(expert));
        updateExpertIndicator();
        if (window.__toast)
            window.__toast.success(`已切换至专家模式：${expert.name}`);
        chatInput.focus();
    };
    chatInput.addEventListener('input', (e) => {
        const val = chatInput.value;
        const lastAtIndex = val.lastIndexOf('@');
        if (lastAtIndex !== -1) {
            // 检查 @ 之后是否有空格，如果有空格则取消激活
            const afterAt = val.substring(lastAtIndex + 1);
            if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
                mentionActive = true;
                mentionQuery = afterAt;
                selectedExpertIndex = 0;
                renderMentionPopup();
            }
            else {
                mentionActive = false;
                renderMentionPopup();
            }
        }
        else {
            mentionActive = false;
            renderMentionPopup();
        }
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 200) + 'px';
    });
    chatInput.addEventListener('keydown', (e) => {
        if (mentionActive && filteredExperts.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedExpertIndex = (selectedExpertIndex + 1) % filteredExperts.length;
                renderMentionPopup();
                return;
            }
            else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedExpertIndex = (selectedExpertIndex - 1 + filteredExperts.length) % filteredExperts.length;
                renderMentionPopup();
                return;
            }
            else if (e.key === 'Enter') {
                e.preventDefault();
                selectExpert(filteredExperts[selectedExpertIndex]);
                return;
            }
            else if (e.key === 'Escape') {
                mentionActive = false;
                renderMentionPopup();
                return;
            }
        }
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    // 提示词魔法优化按钮
    document.getElementById('optimizePromptBtn').addEventListener('click', async () => {
        const input = document.getElementById('chatInput');
        const btn = document.getElementById('optimizePromptBtn');
        let text = input.value.trim();
        if (!text) {
            if (window.__toast)
                window.__toast.info('请先输入需要优化的原始需求');
            return;
        }
        const originalText = text;
        let accumulated = '';
        // 禁用按钮并显示施法中状态
        const originalHtml = btn.innerHTML;
        btn.innerHTML = `<svg style="animation: spin 1s linear infinite;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
        btn.disabled = true;
        input.readOnly = true; // 优化中设为只读，防止用户再次输入冲突
        const sendBtn = document.getElementById('sendBtn');
        if (sendBtn)
            sendBtn.disabled = true; // 禁用发送按钮，防止发送未完成内容
        input.value = ''; // 清空输入框准备流式写入
        // 检查是否存在 spin 动画，如果没有则动态注入
        if (!document.getElementById('spinKeyframe')) {
            const style = document.createElement('style');
            style.id = 'spinKeyframe';
            style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
            document.head.appendChild(style);
        }
        try {
            await new Promise((resolve, reject) => {
                api.chat.optimizePromptStream(text, activeModelId, (parsed) => {
                    if (parsed.type === 'chunk') {
                        accumulated += parsed.content;
                        const startIndex = accumulated.indexOf('<optimized_prompt>');
                        if (startIndex !== -1) {
                            let promptContent = accumulated.substring(startIndex + '<optimized_prompt>'.length);
                            const endIndex = promptContent.indexOf('</optimized_prompt>');
                            if (endIndex !== -1) {
                                promptContent = promptContent.substring(0, endIndex);
                            }
                            input.value = promptContent.trim();
                            input.dispatchEvent(new Event('input')); // 触发自适应高度调整
                            input.scrollTop = input.scrollHeight; // 滚动到底部
                        }
                    }
                    else if (parsed.type === 'error') {
                        reject(new Error(parsed.message));
                    }
                    else if (parsed.type === 'done') {
                        resolve();
                    }
                });
            });
            // 兜底校验：如果生成结束输入框内容仍为空，将积累的原始内容清洗后写入或回退
            if (!input.value.trim()) {
                const cleaned = accumulated.replace(/<[^>]*>/g, '').trim();
                input.value = cleaned || originalText;
                input.dispatchEvent(new Event('input'));
            }
            input.focus();
            if (window.__toast)
                window.__toast.success('✨ 提示词智能优化完成！');
        }
        catch (err) {
            if (window.__toast)
                window.__toast.error('优化失败: ' + err.message);
            input.value = originalText; // 失败则回退为原文本，保护输入安全
            input.dispatchEvent(new Event('input'));
        }
        finally {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            input.readOnly = false; // 恢复可编辑状态
            if (sendBtn)
                sendBtn.disabled = false; // 恢复发送按钮
        }
    });
    document.getElementById('sendBtn').addEventListener('click', sendMessage);
    // 上下文圆环点击（执行真正的上下文压缩：删除一半最老的消息）
    document.getElementById('tokenCircleBtn').addEventListener('click', async () => {
        if (!activeConvId) {
            if (window.__toast)
                window.__toast.info('暂无上下文可压缩');
            return;
        }
        try {
            if (window.__toast)
                window.__toast.info('正在压缩上下文...');
            const history = await api.chat.getHistory(activeConvId);
            // 如果历史少于4条，不值得压缩
            if (!history || history.length < 4) {
                if (window.__toast)
                    window.__toast.success('当前上下文已是最佳状态，无需压缩');
                return;
            }
            // 删除前一半的消息 (保留最新的)
            const toDeleteCount = Math.floor(history.length / 2);
            for (let i = 0; i < toDeleteCount; i++) {
                if (history[i].id) {
                    await api.chat.deleteMessage(history[i].id).catch(e => console.error(e));
                }
            }
            // 更新前端 token 模拟使用量
            tokenUsage = Math.max(0, tokenUsage - Math.floor(tokenUsage * 0.5));
            updateTokenUsage();
            if (window.__toast)
                window.__toast.success(`上下文压缩完成！已清理 ${toDeleteCount} 条早期记忆`);
        }
        catch (e) {
            if (window.__toast)
                window.__toast.error('上下文压缩失败');
            console.error(e);
        }
    });
    // 垃圾桶按钮点击 (情况当前上下文)
    document.getElementById('clearMemoryBtn').addEventListener('click', async () => {
        if (activeConvId) {
            try {
                await api.chat.clearHistory(activeConvId);
                document.getElementById('chatMessages').innerHTML = `
          <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
            <div style="font-size: 48px;">💬</div>
            <div style="font-size: 16px;">上下文已清空，发送一条新消息开始吧</div>
          </div>
        `;
                tokenUsage = 0;
                updateTokenUsage();
                if (window.__toast)
                    window.__toast.success('上下文记忆已彻底清空');
            }
            catch (e) {
                if (window.__toast)
                    window.__toast.error('清空上下文失败');
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
            if (window.__toast)
                window.__toast.info('请在屏幕上框选截图区域...');
            // 隐藏窗口以便截图
            await window.openClaw.system.hide();
            const resultObj = await window.openClaw.system.captureScreenArea();
            // 截图完成后重新显示窗口
            await window.openClaw.system.show();
            if (resultObj && resultObj.dataUrl) {
                const { dataUrl, action } = resultObj;
                pendingAttachmentData = dataUrl;
                document.getElementById('attachmentImg').src = dataUrl;
                document.getElementById('attachmentPreview').style.display = 'flex';
                if (action === 'send') {
                    if (window.__toast)
                        window.__toast.success('截图已附加');
                    document.getElementById('chatInput').focus();
                }
                else if (action === 'ocr') {
                    // 异步触发 OCR 文字提取
                    handleOcr('text');
                }
                else if (action === 'explain') {
                    // AI 解释
                    const input = document.getElementById('chatInput');
                    input.value = '请详细解释和分析这张截图中的内容。';
                    const sendBtn = document.getElementById('sendBtn');
                    if (sendBtn)
                        sendBtn.click();
                }
                else if (action === 'translate') {
                    // AI 翻译
                    const input = document.getElementById('chatInput');
                    input.value = '请帮我精准翻译这张截图中的文本内容。';
                    const sendBtn = document.getElementById('sendBtn');
                    if (sendBtn)
                        sendBtn.click();
                }
            }
            else {
                if (window.__toast)
                    window.__toast.info('截图已取消');
            }
        }
        catch (e) {
            if (window.__toast)
                window.__toast.error('截图失败: ' + e.message);
        }
    });
    async function handleFileByPath(filePath) {
        if (!filePath)
            return;
        const ext = filePath.split('.').pop()?.toLowerCase() || '';
        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
        const isImage = imageExts.includes(ext);
        if (isImage) {
            try {
                if (window.__toast)
                    window.__toast.info('\u6b63\u5728\u52a0\u8f7d\u56fe\u7247...');
                const dataUrl = await api.post('/system/readFileAsDataUrl', { filePath });
                if (dataUrl && dataUrl.data) {
                    pendingAttachmentData = dataUrl.data;
                    const imgEl = document.getElementById('attachmentImg');
                    imgEl.src = dataUrl.data;
                    document.getElementById('attachmentPreview').style.display = 'flex';
                    document.getElementById('chatInput').focus();
                    if (window.__toast)
                        window.__toast.success('\u56fe\u7247\u5df2\u9644\u52a0');
                }
            }
            catch (err) {
                if (window.__toast)
                    window.__toast.error(`\u56fe\u7247\u52a0\u8f7d\u5931\u8d25: ${err.message}`);
            }
        }
        else {
            try {
                if (!activeConvId) {
                    await createNewChat();
                }
                if (window.__toast)
                    window.__toast.info('\u6b63\u5728\u89e3\u6790\u6587\u6863...');
                const res = await api.post('/system/parseDocument', { filePath, convId: activeConvId });
                if (res && res.success) {
                    pendingAttachmentData = `file:///${res.textFilePath.replace(/\\/g, '/')}`;
                    const imgEl = document.getElementById('attachmentImg');
                    imgEl.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="%2300f2fe" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>';
                    document.getElementById('attachmentPreview').style.display = 'flex';
                    document.getElementById('chatInput').focus();
                    if (window.__toast)
                        window.__toast.success(`\u6587\u6863\u5df2\u4f5c\u4e3a\u9644\u4ef6\u6dfb\u52a0！`);
                }
            }
            catch (err) {
                if (window.__toast)
                    window.__toast.error(`\u6587\u6863\u89e3\u6790\u5931\u8d25: ${err.message}`);
            }
        }
    }
    document.getElementById('removeAttachmentBtn').addEventListener('click', () => {
        pendingAttachmentData = null;
        document.getElementById('attachmentImg').src = '';
        document.getElementById('attachmentPreview').style.display = 'none';
    });
    // 上传文件按钮（使用原生系统对话框获取真实文件路径）
    document.getElementById('fileUploadBtn').addEventListener('click', async () => {
        try {
            const filePath = await window.openClaw.system.selectFile({
                filters: [
                    { name: '所有支持的文件', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'json', 'csv', 'html', 'xml', 'rtf', 'odt'] },
                    { name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] },
                    { name: '文档', extensions: ['pdf', 'docx', 'pptx', 'xlsx', 'txt', 'md', 'json', 'csv', 'html', 'xml', 'rtf', 'odt'] },
                    { name: '所有文件', extensions: ['*'] }
                ]
            });
            if (!filePath)
                return; // 用户取消选择
            await handleFileByPath(filePath);
        }
        catch (err) {
            if (window.__toast)
                window.__toast.error(`文件选择失败: ${err.message}`);
        }
    });
    // 模型 Modal 逻辑
    document.getElementById('modelModalBtn').addEventListener('click', async () => {
        await loadModels();
        document.getElementById('modelSelectionModal').style.display = 'flex';
    });
    document.getElementById('closeModelModalBtn').addEventListener('click', () => {
        document.getElementById('modelSelectionModal').style.display = 'none';
    });
    document.getElementById('modelSelectionModal').addEventListener('click', (e) => {
        if (e.target.id === 'modelSelectionModal')
            e.target.style.display = 'none';
    });
    // ================== OCR 提取逻辑 ==================
    const ocrTextBtn = document.getElementById('ocrTextBtn');
    const ocrTableBtn = document.getElementById('ocrTableBtn');
    const ocrResultModal = document.getElementById('ocrResultModal');
    const ocrResultText = document.getElementById('ocrResultText');
    const closeOcrModalBtn = document.getElementById('closeOcrModalBtn');
    const copyOcrBtn = document.getElementById('copyOcrBtn');
    const insertOcrBtn = document.getElementById('insertOcrBtn');
    // 将 OCR 模态框也挂载到 body 下避开 transform 影响
    if (ocrResultModal) {
        const oldOcr = document.body.querySelector('#ocrResultModal');
        if (oldOcr && oldOcr.parentNode === document.body && oldOcr !== ocrResultModal)
            oldOcr.remove();
        document.body.appendChild(ocrResultModal);
    }
    async function handleOcr(mode) {
        if (!pendingAttachmentData) {
            if (window.__toast)
                window.__toast.error('未检测到截图附件');
            return;
        }
        try {
            if (window.__toast)
                window.__toast.info('AI 正在高精度识别截图中，请稍候...');
            const res = await api.post('/chat/ocr', {
                image: pendingAttachmentData,
                mode
            });
            if (res && res.text) {
                if (window.__toast)
                    window.__toast.success('识别成功！');
                ocrResultText.value = res.text;
                ocrResultModal.style.display = 'flex';
            }
            else {
                throw new Error('未返回识别内容');
            }
        }
        catch (e) {
            if (window.__toast)
                window.__toast.error('OCR 识别失败: ' + e.message);
        }
    }
    if (ocrTextBtn)
        ocrTextBtn.addEventListener('click', () => handleOcr('text'));
    if (ocrTableBtn)
        ocrTableBtn.addEventListener('click', () => handleOcr('table'));
    if (closeOcrModalBtn) {
        closeOcrModalBtn.addEventListener('click', () => {
            ocrResultModal.style.display = 'none';
        });
    }
    if (copyOcrBtn) {
        copyOcrBtn.addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(ocrResultText.value);
                if (window.__toast)
                    window.__toast.success('已复制到剪贴板');
            }
            catch (e) {
                if (window.__toast)
                    window.__toast.error('复制失败');
            }
        });
    }
    if (insertOcrBtn) {
        insertOcrBtn.addEventListener('click', () => {
            const input = document.getElementById('chatInput');
            if (input) {
                input.value += (input.value ? '\n' : '') + ocrResultText.value;
                ocrResultModal.style.display = 'none';
                input.focus();
                if (window.__toast)
                    window.__toast.success('已插入到输入框');
            }
        });
    }
    // 清理旧模态框并移到 body（绕过 .page 的 CSS animation transform 导致 fixed 定位失效）
    const oldModal = document.getElementById('modelSelectionModal');
    if (oldModal && oldModal.parentNode === document.body)
        oldModal.remove();
    const freshModal = document.getElementById('modelSelectionModal');
    if (freshModal)
        document.body.appendChild(freshModal);
    // 全局回调供主侧边栏调用
    window.__createNewChat = createNewChat;
    window.__loadChatHistory = async (convId) => {
        // [并发安全] activeConvId 的更新移入 loadHistory 内部，在 DOM 就绪后再赋值
        // 防止 await getHistory() 期间 done 事件因 activeConvId 已切换而错误触发渲染
        await loadHistory(convId);
    };
    // ================== 语音与安全控制 ==================
    const chatInputArea = document.getElementById('chatInput');
    if (chatInputArea) {
        chatInputArea.addEventListener('paste', async (e) => {
            const clipboardData = e.clipboardData;
            if (!clipboardData)
                return;
            const files = Array.from(clipboardData.files);
            if (files.length > 0) {
                e.preventDefault();
                const file = files[0];
                const filePath = file.path;
                if (filePath) {
                    await handleFileByPath(filePath);
                }
                else if (file.type.startsWith('image/')) {
                    // 剪贴板截图直接粘贴的 raw 数据，无物理路径，转为 base64 预览与上传
                    const reader = new FileReader();
                    reader.onload = (e2) => {
                        const dataUrl = e2.target?.result;
                        if (!dataUrl)
                            return;
                        pendingAttachmentData = dataUrl;
                        const imgEl = document.getElementById('attachmentImg');
                        imgEl.src = dataUrl;
                        document.getElementById('attachmentPreview').style.display = 'flex';
                        chatInputArea.focus();
                        if (window.__toast)
                            window.__toast.success('\u5df2\u4ece\u526a\u8d34\u677f\u7c98\u8d34\u622a\u56fe');
                    };
                    reader.readAsDataURL(file);
                }
                return;
            }
            const text = clipboardData.getData('text');
            if (text && /(sk-[a-zA-Z0-9]{32,}|Bearer\s+[a-zA-Z0-9\-_\.]{32,})/.test(text)) {
                e.preventDefault();
                const safeText = text.replace(/(sk-[a-zA-Z0-9]{32,}|Bearer\s+[a-zA-Z0-9\-_\.]{32,})/g, '[REDACTED API KEY]');
                chatInputArea.setRangeText(safeText, chatInputArea.selectionStart, chatInputArea.selectionEnd, 'end');
                if (window.__toast)
                    window.__toast.error('\u68c0\u6d4b\u5230\u654f\u611f API Key，\u5df2\u81ea\u52a8\u8131\u654f\u4fdd\u62a4！');
            }
        });
    }
    // ================== 拖拽文件/图片到聊天区域上传 ==================
    const chatContainer = document.getElementById('chatMessages') || document.querySelector('.doubao-chat-page');
    if (chatContainer) {
        chatContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatContainer.style.outline = '2px dashed var(--primary)';
            chatContainer.style.outlineOffset = '-4px';
        });
        chatContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            chatContainer.style.outline = 'none';
        });
        chatContainer.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            chatContainer.style.outline = 'none';
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0)
                return;
            const file = files[0];
            const filePath = file.path;
            if (filePath) {
                await handleFileByPath(filePath);
            }
            else {
                if (file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e2) => {
                        const dataUrl = e2.target?.result;
                        if (!dataUrl)
                            return;
                        pendingAttachmentData = dataUrl;
                        const imgEl = document.getElementById('attachmentImg');
                        imgEl.src = dataUrl;
                        document.getElementById('attachmentPreview').style.display = 'flex';
                        document.getElementById('chatInput').focus();
                        if (window.__toast)
                            window.__toast.success('\u5df2\u62d6\u5165\u56fe\u7247');
                    };
                    reader.readAsDataURL(file);
                }
                else {
                    if (window.__toast)
                        window.__toast.error('\u65e0\u6cd5\u83b7\u53d6\u62d6\u62fd\u6567\u4ef6\u8def\u5f84');
                }
            }
        });
    }
    // ================== 引用与复制功能事件委托绑定 (合规且防崩) ==================
    const chatMessagesContainer = document.getElementById('chatMessages');
    if (chatMessagesContainer) {
        chatMessagesContainer.addEventListener('click', (e) => {
            const target = e.target;
            if (!target)
                return;
            // 1. 如果点击了“引用”按钮
            if (target.classList.contains('quote-btn') || target.closest('.quote-btn')) {
                const btn = target.classList.contains('quote-btn') ? target : target.closest('.quote-btn');
                const quoteText = btn.getAttribute('data-text') || '';
                const quotePreview = document.getElementById('quotePreview');
                const quoteSpan = document.getElementById('quoteText');
                const chatInput = document.getElementById('chatInput');
                if (quotePreview && quoteSpan && chatInput) {
                    quoteSpan.textContent = quoteText;
                    quotePreview.style.display = 'flex';
                    chatInput.focus();
                }
            }
            // 2. 如果点击了“复制”按钮
            if (target.classList.contains('copy-btn') || target.closest('.copy-btn')) {
                const btn = target.classList.contains('copy-btn') ? target : target.closest('.copy-btn');
                const copyText = btn.getAttribute('data-text') || '';
                navigator.clipboard.writeText(copyText).then(() => {
                    if (window.__toast)
                        window.__toast.success('📋 复制成功');
                }).catch((err) => {
                    console.error('Failed to copy message:', err);
                    if (window.__toast)
                        window.__toast.error('❌ 复制失败');
                });
            }
        });
    }
    const closeQuoteBtn = document.getElementById('closeQuoteBtn');
    if (closeQuoteBtn) {
        closeQuoteBtn.addEventListener('click', () => {
            const quotePreview = document.getElementById('quotePreview');
            const quoteSpan = document.getElementById('quoteText');
            if (quotePreview && quoteSpan) {
                quoteSpan.textContent = '';
                quotePreview.style.display = 'none';
            }
        });
    }
    const voiceBtn = document.getElementById('voiceBtn');
    let isRecording = false;
    let recognition = null;
    if (voiceBtn && ('webkitSpeechRecognition' in window)) {
        const SpeechRecognition = window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'zh-CN';
        recognition.onstart = () => {
            isRecording = true;
            voiceBtn.style.color = '#ff3b30';
            voiceBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';
            if (window.__toast)
                window.__toast.info('正在聆听...');
        };
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript && chatInputArea) {
                chatInputArea.value += finalTranscript;
            }
        };
        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            isRecording = false;
            resetVoiceBtn();
        };
        recognition.onend = () => {
            isRecording = false;
            resetVoiceBtn();
        };
        const resetVoiceBtn = () => {
            if (!voiceBtn)
                return;
            voiceBtn.style.color = 'var(--text-secondary)';
            voiceBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>';
        };
        voiceBtn.addEventListener('click', () => {
            if (isRecording) {
                recognition.stop();
            }
            else {
                recognition.start();
            }
        });
    }
    else if (voiceBtn) {
        voiceBtn.title = "浏览器不支持语音输入";
        voiceBtn.style.opacity = '0.5';
    }
    // ================== 跨窗口快捷提问监听 ==================
    if (window.openClaw && window.openClaw.system && window.openClaw.system.onQuickPrompt) {
        window.openClaw.system.offQuickPrompt(); // 状态唯一性：防重复监听与内存泄漏
        window.openClaw.system.onQuickPrompt((text) => {
            console.log('[主窗口] 接收到跨窗口快捷提问并自动发送:', text);
            const chatInput = document.getElementById('chatInput');
            const sendBtn = document.getElementById('sendBtn');
            if (chatInput && sendBtn) {
                chatInput.value = text;
                chatInput.focus();
                sendBtn.click();
            }
        });
    }
    // 供侧边栏在 navigateTo 之前设置待加载会话 ID
    // 'NEW' = 创建新对话, 具体 ID = 加载已有对话, null = 显示空状态
    window.__setPendingConv = (convId) => {
        pendingLoadConvId = convId;
    };
    window.__onConvDeleted = (convId) => {
        if (convId === activeConvId) {
            activeConvId = null;
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages) {
                chatMessages.innerHTML = '';
            }
            const chatTitle = document.getElementById('chatTitle');
            if (chatTitle) {
                chatTitle.textContent = '新对话';
            }
        }
    };
    // 初始化加载
    reloadModelsCallback = loadModels;
    await loadModels();
    updateExpertIndicator();
    if (localStorage.getItem('justActivatedExpert') === 'true') {
        localStorage.removeItem('justActivatedExpert');
        await createNewChat();
    }
    else if (pendingLoadConvId === 'NEW') {
        // 侧边栏"新建对话"按钮触发
        pendingLoadConvId = null;
        await createNewChat();
    }
    else if (pendingLoadConvId) {
        // 从侧边栏点击了已有会话，加载它
        const convId = pendingLoadConvId;
        pendingLoadConvId = null;
        activeConvId = convId;
        await loadHistory(convId);
    }
    else {
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
    }
    else {
        indicator.style.display = 'none';
    }
}
function updateTokenUsage() {
    const fill = document.getElementById('tokenCircleFill');
    if (!fill)
        return;
    // r=15 -> circumference = 2 * pi * 15 ≈ 94.2
    // dasharray = 94
    // dashoffset: 94 (0%) -> 0 (100%)
    const percentage = Math.min(tokenUsage, 100);
    const offset = 94 - (percentage * 94 / 100);
    fill.style.strokeDashoffset = offset;
    if (tokenUsage < 50)
        fill.style.stroke = 'var(--success)';
    else if (tokenUsage < 80)
        fill.style.stroke = 'var(--warning)';
    else
        fill.style.stroke = 'var(--danger)';
}
let cloudVendors = [];
async function loadModels() {
    try {
        if (cloudVendors.length === 0) {
            try {
                const res = await fetch('./assets/data/cloud-vendors.json');
                if (res.ok) {
                    cloudVendors = await res.json();
                }
            }
            catch (e) {
                console.warn('Failed to fetch cloud-vendors in chat.ts', e);
            }
        }
        // 触发后端探测本地与云端模型的最新状态
        if (api.model && api.model.syncLocalModels) {
            await api.model.syncLocalModels().catch(e => console.warn('Sync models failed:', e));
        }
        const res = await api.model.getModels();
        let allSettings = {};
        try {
            allSettings = await api.settings.getAll() || {};
        }
        catch (e) { }
        // 移除重复模型，保留最后一个唯一 ID
        const uniqueMap = new Map();
        (res || []).forEach(m => uniqueMap.set(m.id, m));
        models = Array.from(uniqueMap.values());
        const activeRes = await api.model.getActiveModel();
        const activeId = activeRes?.id || activeRes?.modelId;
        if (activeRes && activeId) {
            activeModelId = activeId;
        }
        else if (models.length > 0) {
            activeModelId = models[0].id;
        }
        // 判断本地模型的更严谨逻辑
        const isLocal = (m) => m.type === 'local' || ['LM Studio', 'Ollama', 'Llama.cpp', 'GPT4All', 'Jan'].includes(m.provider) || m.id.toLowerCase().includes('local') || m.id.toLowerCase().includes('ollama');
        const localModels = models.filter(m => isLocal(m));
        const cloudModelsConfigured = models.filter(m => !isLocal(m) && m.configured !== false);
        // 已配置的云端模型独立渲染
        const renderedConfiguredCloud = cloudModelsConfigured.map(m => {
            const vendor = cloudVendors.find(v => (m.provider && m.provider.toLowerCase() === v.name.toLowerCase()) ||
                (m.provider && m.provider.toLowerCase() === v.id.toLowerCase()) ||
                m.id.toLowerCase().includes(v.id.toLowerCase())) || { id: m.provider || m.id, name: m.provider || m.name || m.id, icon: '🔗', color: '#007aff' };
            const vendorSettings = allSettings[vendor.id] || {};
            const modelNameDisplay = vendorSettings.defaultModel || m.name || m.modelName || m.id;
            const isActive = m.id === activeModelId;
            const activeStyle = isActive ? `border: 2px solid ${vendor.color || 'var(--primary)'}; background: ${vendor.color || 'var(--primary)'}15;` : 'border: 1px solid var(--border-light); background: var(--bg-card);';
            const statusTextContent = isActive ? '🔥正在使用' : '✅已配置';
            const statusColorClass = isActive ? (vendor.color || 'var(--primary)') : 'var(--success)';
            return `
        <div class="model-select-card" data-id="${m.id}" data-vendor="${vendor.id}" data-configured="true" style="padding: 14px; border-radius: 16px; cursor: pointer; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); display: flex; flex-direction: column; gap: 10px; ${activeStyle} box-shadow: 0 4px 12px rgba(0,0,0,0.03);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px rgba(0,0,0,0.06)';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.03)';">
           <div style="display: flex; align-items: center; gap: 10px;">
             <div style="width: 32px; height: 32px; border-radius: 10px; background: ${vendor.color || 'var(--primary)'}20; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0;">${vendor.icon}</div>
             <div style="display: flex; flex-direction: column; flex: 1; overflow: hidden; justify-content: center;">
               <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2;" title="${modelNameDisplay}">${vendor.name} - ${modelNameDisplay}</div>
               <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; gap: 4px; line-height: 1.2; margin-top: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                 <span style="opacity: 0.8;">[${vendor.name}]</span>
               </div>
             </div>
             ${isActive ? `<div style="width: 8px; height: 8px; border-radius: 50%; background: ${vendor.color || 'var(--primary)'}; box-shadow: 0 0 8px ${vendor.color || 'var(--primary)'}; flex-shrink: 0;"></div>` : `<div style="width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 8px var(--success); flex-shrink: 0;"></div>`}
           </div>
           <div style="font-size: 12px; font-weight: 500; color: ${statusColorClass}; display: flex; align-items: center; gap: 4px; background: ${isActive ? `${vendor.color || 'var(--primary)'}15` : 'rgba(52, 199, 89, 0.1)'}; padding: 4px 8px; border-radius: 6px; width: fit-content;">
             ${statusTextContent}
           </div>
        </div>
      `;
        });
        // 未配置的厂商（占位卡片）
        const renderedUnconfiguredCloud = cloudVendors
            .filter(vendor => !cloudModelsConfigured.some(m => (m.provider && m.provider.toLowerCase() === vendor.name.toLowerCase()) ||
            (m.provider && m.provider.toLowerCase() === vendor.id.toLowerCase()) ||
            m.id.toLowerCase().includes(vendor.id.toLowerCase())))
            .map(vendor => {
            return `
        <div class="model-select-card" data-vendor="${vendor.id}" data-configured="false" style="padding: 14px; border: 1px solid ${vendor.color}30; border-radius: 16px; cursor: pointer; transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); background: linear-gradient(135deg, ${vendor.color}05 0%, ${vendor.color}15 100%); display: flex; flex-direction: column; gap: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 24px ${vendor.color}30';" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.02)';">
           <div style="display: flex; align-items: center; gap: 10px;">
             <div style="width: 32px; height: 32px; border-radius: 10px; background: ${vendor.color}25; backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; box-shadow: 0 2px 6px rgba(0,0,0,0.04);">${vendor.icon}</div>
             <div style="display: flex; flex-direction: column; flex: 1; justify-content: center;">
               <div style="font-weight: 600; font-size: 14px; color: var(--text-primary); line-height: 1.2;">${vendor.name}</div>
               <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px; line-height: 1.2;">尚未配置 API Key</div>
             </div>
           </div>
           <div style="font-size: 12px; font-weight: 600; color: ${vendor.color}; display: flex; align-items: center; justify-content: center; gap: 4px; background: ${vendor.color}20; padding: 6px 10px; border-radius: 8px; width: fit-content; transition: all 0.2s; margin-top: 2px;" onmouseover="this.style.background='${vendor.color}35'; this.style.transform='scale(1.02)';" onmouseout="this.style.background='${vendor.color}20'; this.style.transform='scale(1)';">
             立即配置 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
           </div>
        </div>
        `;
        });
        const renderedCloudHtml = [...renderedConfiguredCloud, ...renderedUnconfiguredCloud].join('');
        document.getElementById('cloudModelsGrid').innerHTML = renderedCloudHtml;
        document.getElementById('localModelsGrid').innerHTML = localModels.length > 0 ? localModels.map(m => {
            const isCold = m.isCold === true;
            const icon = isCold ? '⏾' : '💻';
            const statusColor = isCold ? '#9ca3af' : '#00c853';
            const isActive = m.id === activeModelId;
            const activeStyle = isActive ? 'border: 2px solid var(--primary); background: rgba(var(--primary-rgb), 0.05);' : 'border: 1px solid var(--border-light); background: var(--bg-card);';
            const statusTextContent = isActive ? '✅ 正在使用' : (isCold ? '💤 本地休眠 (Cold)' : '🚀 显存就绪 (Hot)');
            const statusColorClass = isActive ? 'var(--primary)' : statusColor;
            return `
      <div class="model-select-card" data-id="${m.id}" data-configured="true" data-iscold="${isCold}" style="padding: 12px; border-radius: 12px; cursor: pointer; transition: all 0.2s; display: flex; flex-direction: column; gap: 4px; ${activeStyle}">
         <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
           <span>${icon}</span> ${m.name}
           <span style="display: inline-block; width: 8px; height: 8px; background-color: ${statusColor}; border-radius: 50%; box-shadow: 0 0 8px ${statusColor}; margin-left: 6px;" title="${isCold ? 'Cold' : 'Hot'}"></span>
         </div>
         <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
           <span style="color: ${statusColorClass}; font-weight: ${isActive ? '600' : '500'};">${statusTextContent}</span>
           <span title="底层调用模型名称">[${m.modelName || m.id}]</span>
         </div>
      </div>
    `;
        }).join('') : '<div style="color:var(--text-muted); font-size: 12px;">暂未发现本地模型</div>';
        // 绑定弹窗内模型点击
        document.querySelectorAll('.model-select-card').forEach(card => {
            card.addEventListener('click', async () => {
                const isConfigured = card.dataset.configured === 'true';
                const vendorId = card.dataset.vendor;
                if (!isConfigured && vendorId) {
                    // 未配置，跳转至模型市场配置
                    document.getElementById('modelSelectionModal').style.display = 'none';
                    if (window.navigateTo) {
                        window.navigateTo('market', { openConfig: vendorId });
                    }
                    return;
                }
                const id = card.getAttribute('data-id');
                const isCold = card.getAttribute('data-iscold') === 'true';
                activeModelId = id;
                const modelObj = models.find(x => x.id === activeModelId);
                if (modelObj) {
                    document.getElementById('activeModelLabel').textContent = modelObj.name;
                }
                else {
                    const nameEl = card.querySelector('div').textContent.replace(/[^\w\s\u4e00-\u9fa5]/gi, '').trim();
                    document.getElementById('activeModelLabel').textContent = nameEl;
                }
                // 触发热启动 UI
                if (isCold) {
                    if (window.__toast)
                        window.__toast.info('🚀 正在将本地模型调入显存 (Warming up...)', 3000);
                    document.getElementById('activeModelLabel').innerHTML = `<svg style="animation: spin 1s linear infinite; margin-right:4px;" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> 模型预热中...`;
                    setTimeout(() => {
                        document.getElementById('activeModelLabel').textContent = modelObj?.name || id;
                        if (window.__toast)
                            window.__toast.success('显存加载完毕！');
                    }, 2500); // 模拟感知预热
                }
                if (api.model && api.model.setActiveModel) {
                    await api.model.setActiveModel(id).catch(e => console.error(e));
                }
                document.getElementById('modelSelectionModal').style.display = 'none';
                if (!isCold && window.__toast)
                    window.__toast.success(`已切换为: ${modelObj?.name || id}`);
            });
        });
        const initialModel = models.find(x => x.id === activeModelId);
        if (initialModel) {
            document.getElementById('activeModelLabel').textContent = initialModel.name;
        }
        else if (activeModelId) {
            document.getElementById('activeModelLabel').textContent = activeModelId;
        }
    }
    catch (e) {
        console.error('Failed to load models:', e);
    }
}
async function createNewChat() {
    try {
        const res = await api.chat.createConversation('新对话');
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
    }
    catch (e) {
        console.error('Failed to create chat:', e);
    }
}
async function loadHistory(convId) {
    try {
        const msgs = await api.chat.getHistory(convId);
        renderMessages(msgs || []);
        // [并发安全] DOM 已就绪：此刻才正式将活跃会话 ID 切换为目标会话
        // 此后到来的 chunk 事件可以正确判断 thisConvId === activeConvId 并写入 DOM
        activeConvId = convId;
        const list = await api.chat.getConversations();
        const c = list.find(x => x.id === convId);
        if (c)
            document.getElementById('chatTitle').textContent = c.title || '新对话';
        tokenUsage = Math.min((msgs || []).length * 8, 100);
        updateTokenUsage();
        // 当用户切回正处于后台生成的会话时，自动在其历史记录末尾追加新气泡，续接流式显示
        const state = generatingStates.get(convId);
        if (state && state.isGenerating) {
            const container = document.getElementById('chatMessages');
            if (container) {
                if (container.children.length === 1 && (container.children[0].textContent.includes('发送一条消息') || container.children[0].textContent.includes('新的对话'))) {
                    container.innerHTML = '';
                }
                const newAiBox = appendMessage('assistant');
                state.aiBox = newAiBox;
                currentAiBox = newAiBox;
                if (newAiBox) {
                    if (state.generatingFullResponse) {
                        updateAiBoxContent(newAiBox, state.generatingFullResponse);
                    }
                    else {
                        initThinkingBox(newAiBox);
                    }
                    if (state.timerId)
                        clearInterval(state.timerId);
                    state.timerId = startThinkingTimer(newAiBox, state.startTime, state);
                }
                scrollToBottom();
            }
        }
        updateSendButtonState();
    }
    catch (e) {
        console.error('Failed to load history:', e);
    }
}
function handleQuote(btn) {
    let text = btn.dataset.text;
    if (!text)
        return;
    if (text.length > 50)
        text = text.substring(0, 50) + '...';
    document.getElementById('quotePreview').style.display = 'flex';
    document.getElementById('quoteText').textContent = text;
    document.getElementById('chatInput').focus();
}
async function handleCopy(btn) {
    let text = btn.dataset.text;
    if (!text)
        return;
    try {
        await navigator.clipboard.writeText(text);
        if (window.__toast)
            window.__toast.success('已复制');
    }
    catch (e) {
        if (window.__toast)
            window.__toast.error('复制失败');
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
            if (textBlock)
                textContent = textBlock.text;
            if (imgBlock && imgBlock.image_url) {
                const url = imgBlock.image_url.url;
                const isImage = (url.startsWith('data:image/') && !url.startsWith('data:image/svg+xml')) ||
                    (url.startsWith('file:///') && /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(url));
                if (isImage) {
                    if (url.startsWith('file:///')) {
                        const placeholderId = `img-local-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
                        attachmentHtml = `<div style="margin-top: 8px;"><img id="${placeholderId}" data-local-src="${url}" src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'><rect width='18' height='18' x='3' y='3' rx='2'/><circle cx='9' cy='9' r='2'/><path d='m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21'/></svg>" style="max-height: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2); opacity: 0.6;"></div>`;
                    }
                    else {
                        attachmentHtml = `<div style="margin-top: 8px;"><img src="${url}" style="max-height: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div>`;
                    }
                }
                else {
                    const svgIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`;
                    attachmentHtml = `<div style="margin-top: 8px; display: flex; align-items: center; background: rgba(0,0,0,0.05); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">${svgIcon} <span style="font-size: 13px; font-weight: 500;">已附加文件</span></div>`;
                }
            }
        }
        else {
            textContent = m.content || '';
        }
        // [核心修复] 对历史记录里的思考链进行防崩转义
        let safeContent = textContent || '';
        if (m.role !== 'user') {
            safeContent = safeContent.replace(/<think>([\s\S]*?)<\/think>/gi, (match, p1) => {
                return `<details style="margin-bottom: 12px; border: 1px solid var(--border-light); border-radius: 8px; background: rgba(0,0,0,0.1); padding: 8px;"><summary style="cursor: pointer; color: var(--text-muted); font-size: 13px; user-select: none;">💡 思考过程展开</summary><div style="font-size: 13px; color: var(--text-secondary); margin-top: 8px; padding-left: 12px; border-left: 2px solid var(--text-muted); white-space: pre-wrap;">${p1}</div></details>`;
            });
        }
        let renderedHtml = m.role === 'user' ? escapeHtml(safeContent).replace(/\n/g, '<br/>') : parseMarkdown(safeContent);
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
        <div class="message-actions" style="margin-top: 3px; transition: opacity 0.15s;">
           <button class="action-btn quote-btn" data-text="${escapeHtml(textContent)}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 3px 6px; border-radius: 4px; transition: background 0.15s;">引用</button>
           <button class="action-btn copy-btn" data-text="${escapeHtml(textContent)}" style="font-size: 11px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 3px 6px; border-radius: 4px; transition: background 0.15s;">复制</button>
        </div>
      </div>
    </div>
  `;
    }).join('');
    // 异步加载本地 file:/// 图片资源，避开 Chromium 跨域安全拦截
    setTimeout(async () => {
        const localImgs = container.querySelectorAll('img[data-local-src]');
        for (const img of Array.from(localImgs)) {
            const srcUrl = img.getAttribute('data-local-src');
            if (!srcUrl)
                continue;
            const filePath = decodeURIComponent(srcUrl.replace('file:///', ''));
            try {
                const res = await api.post('/system/readFileAsDataUrl', { filePath });
                if (res && res.data) {
                    img.src = res.data;
                    img.style.opacity = '1';
                }
            }
            catch (e) {
                console.error('Failed to load local image in history:', e);
            }
        }
    }, 50);
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
    if (role === 'user')
        msgDiv.style.flexDirection = 'row-reverse';
    const avatarUser = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
    const avatarAI = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;
    msgDiv.innerHTML = `
    <div style="width: 32px; height: 32px; border-radius: 10px; background: ${role === 'user' ? 'linear-gradient(135deg, var(--primary), #5856d6)' : 'var(--bg-card)'}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; ${role === 'user' ? '' : 'border: 1px solid var(--border-light);'} box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
      ${role === 'user' ? avatarUser : avatarAI}
    </div>
    <div style="max-width: 78%; display: flex; flex-direction: column; align-items: ${role === 'user' ? 'flex-end' : 'flex-start'};">
      <div class="msg-content-box" style="background: ${role === 'user' ? 'linear-gradient(135deg, var(--primary), #5856d6)' : 'var(--bg-card)'}; color: ${role === 'user' ? '#fff' : 'var(--text-primary)'}; padding: 10px 14px; border-radius: ${role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px'}; font-size: 14px; line-height: 1.65; border: ${role === 'user' ? 'none' : '1px solid var(--border-light)'}; overflow-x: auto; box-shadow: 0 1px 4px rgba(0,0,0,0.04);">
      </div>
    </div>
  `;
    container.appendChild(msgDiv);
    scrollToBottom();
    return msgDiv.querySelector('.msg-content-box');
}
async function sendMessage() {
    const curGenerating = generatingStates.get(activeConvId)?.isGenerating || false;
    if (curGenerating) {
        api.chat.abortStream(activeConvId);
        const state = generatingStates.get(activeConvId);
        if (state) {
            state.isGenerating = false;
            if (state.timerId)
                clearInterval(state.timerId);
            generatingStates.delete(activeConvId);
        }
        updateSendButtonState();
        return;
    }
    const input = document.getElementById('chatInput');
    let text = input.value.trim();
    if (!text && !pendingAttachmentData)
        return;
    const quotePreview = document.getElementById('quotePreview');
    if (quotePreview.style.display === 'flex') {
        const quoteText = document.getElementById('quoteText').textContent;
        text = `> ${quoteText}\n\n${text}`;
        quotePreview.style.display = 'none';
        document.getElementById('quoteText').textContent = '';
    }
    // [并发关键] 使用 let 而非 const，在收到 type:'conversation' 事件时同步更新
    // 防止 ID 被后端迁移后，后续 chunk/done 事件在 generatingStates 中查不到状态而静默丢弃
    let thisConvId = activeConvId;
    const startTime = Date.now();
    const state = {
        isGenerating: true,
        generatingFullResponse: '',
        startTime: startTime
    };
    generatingStates.set(thisConvId, state);
    const userBox = appendMessage('user');
    if (userBox) {
        userBox.innerHTML = escapeHtml(text).replace(/\n/g, '<br/>');
    }
    input.value = '';
    input.focus();
    adjustTextareaHeight(input);
    const aiBox = appendMessage('assistant');
    state.aiBox = aiBox;
    currentAiBox = aiBox;
    initThinkingBox(aiBox);
    state.timerId = startThinkingTimer(aiBox, startTime, state);
    updateSendButtonState();
    const attachmentData = pendingAttachmentData;
    pendingAttachmentData = null;
    document.getElementById('attachmentPreview').style.display = 'none';
    const addActions = (box, textVal) => {
        const actionsHtml = `
       <div class="message-actions" style="margin-top: 4px;">
          <button class="action-btn quote-btn" data-text="${escapeHtml(textVal)}" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">引用</button>
          <button class="action-btn copy-btn" data-text="${escapeHtml(textVal)}" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">复制</button>
       </div>
     `;
        const actionsDiv = document.createElement('div');
        actionsDiv.innerHTML = actionsHtml;
        box.parentElement.appendChild(actionsDiv.firstElementChild);
    };
    window.__onConvDeleted = (id) => {
        const s = generatingStates.get(id);
        if (s) {
            api.chat.abortStream(id);
            s.isGenerating = false;
            if (s.timerId)
                clearInterval(s.timerId);
            generatingStates.delete(id);
        }
        if (id === activeConvId) {
            updateSendButtonState();
        }
    };
    try {
        let temp = 0.7;
        let extraPrompt = '';
        const depth = document.getElementById('depthSelect').value;
        if (depth === 'low') {
            temp = 0.8;
            extraPrompt = '\n\n【系统提示：请尽可能简明扼要、直接了当地回答。】';
        }
        else if (depth === 'high') {
            temp = 0.3;
            extraPrompt = '\n\n【系统提示：请进行深思熟虑。一步一步地拆解问题，考虑各种边界情况和深层逻辑，提供详尽且富有洞察力的回答。】';
        }
        else if (depth === 'extreme') {
            temp = 0.1;
            extraPrompt = '\n\n【系统提示：启用深度推理模式。你必须极其彻底地思考此问题，展开所有可能的推理链条，检查每一个假设，并且以长篇幅的深度分析来回复。】';
        }
        const prompt = (activeExpert ? activeExpert.prompt : '') + extraPrompt;
        await api.chat.sendMessageStream(thisConvId, text, attachmentData, activeModelId, prompt, temp, isAgentModeEnabled, (parsed) => {
            const s = generatingStates.get(thisConvId);
            if (!s)
                return;
            if (parsed.type === 'requires_confirmation') {
                window.__toast?.info('⚠️ 助手请求执行命令，等待您授权…');
                showSandboxConfirm(parsed.command, parsed.message).then((decision) => {
                    api.sandbox.executeCommand(parsed.command, {
                        confirmed: decision.confirmed,
                        permanent: decision.permanent,
                        confirmationId: parsed.confirmationId,
                    });
                    if (decision.confirmed) {
                        window.__toast?.success(decision.permanent ? '✅ 已授权（已记住 30 天）' : '✅ 已授权执行一次');
                    }
                    else {
                        window.__toast?.warn('🚫 已拒绝执行');
                    }
                });
                return;
            }
            if (parsed.type === 'error') {
                let errorMsg = parsed.message || '未知错误';
                if (errorMsg.toLowerCase().includes('401') || errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('auth')) {
                    errorMsg = '当前选择的模型 API Key 未配置或不正确，请在左侧「模型市场」重新配置。';
                }
                else if (errorMsg.includes('ECONNREFUSED') || errorMsg.toLowerCase().includes('fetch')) {
                    errorMsg = '网络连接失败，或者您配置的本地模型未启动。';
                }
                else if (errorMsg.includes('500') || errorMsg.includes('JSON')) {
                    errorMsg = '服务端发生了异常，请检查该模型是否可用。';
                }
                s.generatingFullResponse += `\n\n> ❌ **无法回复**: ${errorMsg}`;
                s.isGenerating = false;
                if (s.timerId)
                    clearInterval(s.timerId);
                generatingStates.delete(thisConvId);
                if (thisConvId === activeConvId && s.aiBox) {
                    updateAiBoxContent(s.aiBox, s.generatingFullResponse);
                    scrollToBottom();
                    updateSendButtonState();
                    if (s.aiBox.parentElement) {
                        addActions(s.aiBox, s.generatingFullResponse);
                    }
                    if (userBox && userBox.parentElement) {
                        addActions(userBox, text);
                    }
                }
                return;
            }
            if (parsed.type === 'conversation' && parsed.id) {
                if (generatingStates.has(thisConvId)) {
                    const oldState = generatingStates.get(thisConvId);
                    generatingStates.delete(thisConvId);
                    generatingStates.set(parsed.id, oldState);
                }
                if (activeConvId === thisConvId) {
                    activeConvId = parsed.id;
                }
                // [并发关键] 闭包内的 ID 引用同步更新，后续 chunk/done 事件才能在 Map 中查到正确的状态
                thisConvId = parsed.id;
            }
            if (parsed.type === 'done') {
                s.isGenerating = false;
                if (s.timerId)
                    clearInterval(s.timerId);
                const savedAiBox = s.aiBox;
                const finalResponse = s.generatingFullResponse;
                generatingStates.delete(thisConvId);
                if (thisConvId === activeConvId) {
                    updateSendButtonState();
                    if (savedAiBox && document.body.contains(savedAiBox)) {
                        // 正常情况：aiBox 仍在 DOM 中，直接渲染最终内容
                        updateAiBoxContent(savedAiBox, finalResponse);
                        if (savedAiBox.parentElement) {
                            addActions(savedAiBox, finalResponse);
                        }
                        if (userBox && userBox.parentElement) {
                            addActions(userBox, text);
                        }
                    }
                    else {
                        // aiBox 已被 loadHistory 的 renderMessages 销毁（用户切走又切回，且 done 恰好在 DOM 重建前到来）
                        // 此时回复已由 orchestrator 存入 DB，强制刷新当前视图以从 DB 加载最终结果
                        loadHistory(thisConvId);
                    }
                    window.refreshSidebarConversations?.();
                }
                return;
            }
            if (parsed.content) {
                s.generatingFullResponse += parsed.content;
                // 同时检查 DOM 在线状态：防止对 renderMessages 已销毁的 aiBox 发起无效更新
                if (thisConvId === activeConvId && s.aiBox && document.body.contains(s.aiBox)) {
                    updateAiBoxContent(s.aiBox, s.generatingFullResponse);
                    scrollToBottom();
                }
            }
        });
    }
    catch (err) {
        const s = generatingStates.get(thisConvId);
        let fullText = s ? s.generatingFullResponse : '';
        if (err.name === 'AbortError') {
            fullText += '\n\n*(已中断)*';
        }
        else {
            let errorMsg = err.message || '未知错误';
            if (errorMsg.toLowerCase().includes('401') || errorMsg.toLowerCase().includes('key')) {
                errorMsg = 'API Key 似乎未配置，请前往设置检查。';
            }
            fullText += '\n\n**[请求失败]** ' + errorMsg;
            if (window.__toast)
                window.__toast.error('发送失败: ' + errorMsg);
        }
        let savedAiBox = s ? s.aiBox : null;
        if (s) {
            s.generatingFullResponse = fullText;
            s.isGenerating = false;
            if (s.timerId)
                clearInterval(s.timerId);
            generatingStates.delete(thisConvId);
        }
        if (thisConvId === activeConvId && savedAiBox) {
            updateAiBoxContent(savedAiBox, fullText);
            scrollToBottom();
            updateSendButtonState();
            if (savedAiBox.parentElement) {
                addActions(savedAiBox, fullText);
            }
            if (userBox && userBox.parentElement) {
                addActions(userBox, text);
            }
            window.refreshSidebarConversations?.();
        }
    }
}
function scrollToBottom() {
    const container = document.getElementById('chatMessages');
    if (!container)
        return;
    container.scrollTop = container.scrollHeight;
}
