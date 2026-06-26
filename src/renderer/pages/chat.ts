// @ts-nocheck
/**
 * 聊天页面 v3 — 全宽聊天界面，会话管理已移至主侧边栏
 */

import { api } from '../utils.js';

import { escapeHtml } from '../utils.js';
import { parseMarkdown } from '../utils.js';
import { EXPERTS } from './experts.js';

let activeConvId = null;
let isGenerating = false;
let models = [];
let activeModelId = '';
let activeExpert = null;
let tokenUsage = 0;
let pendingAttachmentData = null;
let pendingLoadConvId = null; // 从侧边栏点击时预设的会话 ID
let reloadModelsCallback = null;

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
    try { activeExpert = JSON.parse(expertData); } catch (e) { }
  } else {
    activeExpert = null;
  }

  container.innerHTML = `
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

        <!-- 居中区域：模型切换器 (ChatGPT风格) -->
        <div style="flex: 1; display: flex; justify-content: center;">
          <button id="modelModalBtn" class="btn-ghost" style="display: flex; align-items: center; gap: 6px; border-radius: 20px; padding: 6px 16px; font-weight: 600; font-size: 14px; background: rgba(120, 120, 150, 0.1); border: 1px solid rgba(120, 120, 150, 0.2); backdrop-filter: blur(10px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer;" onmouseover="this.style.background='rgba(120, 120, 150, 0.2)'; this.style.transform='translateY(-1px)';" onmouseout="this.style.background='rgba(120, 120, 150, 0.1)'; this.style.transform='translateY(0)';">
            <span id="activeModelLabel" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">选择模型</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="opacity: 0.5;"><path d="m6 9 6 6 6-6"/></svg>
          </button>
        </div>

        <!-- 右侧区域 (已将功能移至输入框下方) -->
        <div style="flex: 1; display: flex; justify-content: flex-end; gap: 8px;">
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
          <div id="attachmentPreview" style="display: none; padding: 8px 16px; align-items: center; border-bottom: 1px solid var(--border-light); background: rgba(0,0,0,0.02); border-radius: 12px 12px 0 0;">
            <div style="position: relative; display: inline-block;">
              <img id="attachmentImg" style="height: 60px; border-radius: 8px; border: 1px solid var(--border-light); box-shadow: var(--shadow-sm);" />
              <button id="removeAttachmentBtn" style="position: absolute; top: -6px; right: -6px; width: 20px; height: 20px; border-radius: 50%; background: var(--danger); color: white; border: none; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-sm);">&times;</button>
            </div>
          </div>

          <!-- 输入行：内部嵌入左右控制区 -->
          <div class="doubao-input-row">
            <textarea id="chatInput" class="doubao-textarea" placeholder="发送消息给 Assistant...  @呼叫专家  Shift+Enter 换行" rows="1"></textarea>
            
            <!-- 底部操作栏 -->
            <div class="doubao-input-tools">
              
              <!-- 左侧：附件与设定 -->
              <div style="display: flex; gap: 4px; position: relative;">
                <button id="plusMenuBtn" class="btn-icon" title="附加操作">
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

                <!-- 思考深度 -->
                <div class="btn-ghost" title="思考深度" style="border-radius: var(--radius-sm); padding: 4px 8px; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #00d9ff;"><path d="M2 20h.01"/><path d="M7 20v-4"/><path d="M12 20v-8"/><path d="M17 20V8"/><path d="M22 4v16"/></svg>
                  <select id="depthSelect" style="background:transparent; border:none; color:inherit; outline:none; cursor:pointer;">
                    <option value="auto">自动</option>
                    <option value="low">浅度思考</option>
                    <option value="medium">中度思考</option>
                    <option value="high">深度思考</option>
                    <option value="extreme">极度推理</option>
                  </select>
                </div>

                <!-- 清空上下文 -->
                <button id="clearMemoryBtn" class="btn-ghost" title="清空上下文记忆" style="border-radius: var(--radius-sm); padding: 4px 8px; font-size: 13px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: -2px; color: #ff3b30;"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                  清空上下文
                </button>

                <!-- 思考设定 -->
                <button id="tuningModalBtn" class="btn-ghost" title="系统思考设定" style="border-radius: var(--radius-sm); padding: 4px 8px; font-size: 13px;">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: -2px;"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                  高级设定
                </button>
                
                <!-- 新建对话 -->
                <button id="newChatBtn" class="btn-ghost" title="新建对话" style="border-radius: var(--radius-sm); padding: 4px 8px; font-size: 13px; color: var(--primary);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 4px; vertical-align: -2px;"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  新对话
                </button>
              </div>

              <!-- 右侧：发送组 -->
              <div style="display: flex; align-items: center; gap: 8px;">
                <button id="tokenCircleBtn" class="btn-ghost" title="上下文压缩" style="display: flex; align-items: center; gap: 6px; border-radius: 12px; padding: 4px 10px; font-size: 13px; color: var(--text-secondary); height: 32px;">
                  <div style="position: relative; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 36 36" style="position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg);">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border-color)" stroke-width="4"></circle>
                      <circle id="tokenCircleFill" cx="18" cy="18" r="15" fill="none" stroke="var(--primary)" stroke-width="4" stroke-dasharray="94 94" stroke-dashoffset="94" stroke-linecap="round" style="transition: stroke-dashoffset 0.4s ease;"></circle>
                    </svg>
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="color: inherit; z-index: 1;"><path d="M12 3v8"/><path d="M8 7l4 4 4-4"/><path d="M12 21v-8"/><path d="M16 17l-4-4-4 4"/></svg>
                  </div>
                  压缩
                </button>

                <button id="optimizePromptBtn" class="btn-ghost" title="提示词优化" style="display: flex; align-items: center; gap: 5px; border-radius: 12px; padding: 4px 10px; font-size: 13px; color: #a259ff; height: 32px; background: rgba(162, 89, 255, 0.08);">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>
                  魔法优化
                </button>
                <button id="sendBtn" class="doubao-send-btn" title="发送 (Enter)">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
                </button>
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

    <!-- 思考设定 (Tuning Modal) -->
    <div id="tuningModal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; align-items: center; justify-content: center; backdrop-filter: blur(4px);">
       <div style="background: var(--bg-app); width: 480px; max-width: 90%; border-radius: 20px; box-shadow: 0 24px 48px rgba(0,0,0,0.25); overflow: hidden; display: flex; flex-direction: column;">
          <div style="padding: 20px 24px; border-bottom: 1px solid var(--border-light); display: flex; justify-content: space-between; align-items: center;">
             <h3 style="margin: 0; font-size: 18px; display: flex; align-items: center; gap: 8px;">🧠 思考设定 <span style="font-size: 12px; font-weight: normal; color: var(--text-muted); background: var(--bg-hover); padding: 2px 8px; border-radius: 10px;">微调 AI 性格与思考方式</span></h3>
             <button id="closeTuningModalBtn" style="background: none; border: none; font-size: 24px; cursor: pointer; color: var(--text-muted);">&times;</button>
          </div>
          <div style="padding: 24px; display: flex; flex-direction: column; gap: 24px; max-height: 60vh; overflow-y: auto;">
             
             <!-- 系统设定 (System Prompt) -->
             <div class="config-form-group">
                <label style="font-weight: 600; font-size: 14px;">🎭 角色与背景设定 (System Prompt)</label>
                <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">赋予 AI 特定的身份、语气和知识背景（例如：“你是一个暴躁的老板”或“你是一位专业的法律顾问”）。</div>
                <textarea id="tuningSystemPrompt" class="input" style="height: 100px; resize: vertical;" placeholder="默认：你是一个乐于助人的智能助手。"></textarea>
             </div>

             <!-- 发散程度 (Temperature) -->
             <div class="tuning-slider-container">
                <div class="tuning-slider-header">
                   <div class="tuning-slider-label">🌡️ 发散程度 (Temperature)</div>
                   <div class="tuning-slider-value" id="tuningTempValue">1.0</div>
                </div>
                <div class="tuning-slider-desc" style="margin-bottom: 6px;">较小的值回答更精确严谨；较大的值回答更具创造力和想象力。</div>
                <input type="range" id="tuningTemp" class="tuning-slider" min="0" max="2" step="0.1" value="1.0">
             </div>

             <!-- 记忆深度 (Max History) -->
             <div class="tuning-slider-container">
                <div class="tuning-slider-header">
                   <div class="tuning-slider-label">📚 记忆深度 (Context Size)</div>
                   <div class="tuning-slider-value" id="tuningHistoryValue">10 轮</div>
                </div>
                <div class="tuning-slider-desc" style="margin-bottom: 6px;">AI 单次对话能记住的上下文轮数。调大更聪明，但消耗更多算力。</div>
                <input type="range" id="tuningHistory" class="tuning-slider" min="0" max="50" step="1" value="10">
             </div>

          </div>
          <div style="padding: 16px 24px; border-top: 1px solid var(--border-light); background: var(--bg-panel); display: flex; justify-content: flex-end; gap: 12px;">
             <button id="resetTuningBtn" class="btn btn-default" style="border-radius: 10px;">恢复默认</button>
             <button id="saveTuningBtn" class="btn btn-primary" style="border-radius: 10px; padding: 0 24px;">保存设定</button>
          </div>
       </div>
    </div>
  `;

  // --- 基础事件 ---
  (document.getElementById('newChatBtn') as any).addEventListener('click', createNewChat);
  (document.getElementById('clearExpertBtn') as any).addEventListener('click', () => {
    localStorage.removeItem('activeExpert');
    activeExpert = null;
    updateExpertIndicator();
    if (window.__toast) window.__toast.info('已退出专家模式');
  });

  const chatInput = (document.getElementById('chatInput') as any);

  // --- Tuning Modal 逻辑 ---
  const tuningModalBtn = (document.getElementById('tuningModalBtn') as any);
  const tuningModal = (document.getElementById('tuningModal') as any);
  const closeTuningModalBtn = (document.getElementById('closeTuningModalBtn') as any);
  const tuningTemp = (document.getElementById('tuningTemp') as any);
  const tuningTempValue = (document.getElementById('tuningTempValue') as any);
  const tuningHistory = (document.getElementById('tuningHistory') as any);
  const tuningHistoryValue = (document.getElementById('tuningHistoryValue') as any);
  const tuningSystemPrompt = (document.getElementById('tuningSystemPrompt') as any);
  const saveTuningBtn = (document.getElementById('saveTuningBtn') as any);
  const resetTuningBtn = (document.getElementById('resetTuningBtn') as any);
  const plusMenuBtn = (document.getElementById('plusMenuBtn') as any);
  const plusMenu = (document.getElementById('plusMenu') as any);

  if (plusMenuBtn && plusMenu) {
    plusMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      plusMenu.style.display = plusMenu.style.display === 'none' ? 'flex' : 'none';
    });
    document.addEventListener('click', (e) => {
      if (!plusMenuBtn.contains((e.target as any)) && !plusMenu.contains((e.target as any))) {
        plusMenu.style.display = 'none';
      }
    });
  }

  // Hide popover if item is clicked
  document.querySelectorAll('.popover-item').forEach(item => {
    item.addEventListener('click', () => {
      if (plusMenu) plusMenu.style.display = 'none';
    });
  });

  // 初始化 sessionConfig
  window.sessionConfig = window.sessionConfig || { temp: 1.0, maxHistory: 10, systemPrompt: '' };

  const openTuningModal = () => {
    tuningTemp.value = window.sessionConfig.temp;
    tuningTempValue.textContent = parseFloat(window.sessionConfig.temp).toFixed(1);
    tuningHistory.value = window.sessionConfig.maxHistory;
    tuningHistoryValue.textContent = window.sessionConfig.maxHistory + ' 轮';
    tuningSystemPrompt.value = window.sessionConfig.systemPrompt || '';
    tuningModal.style.display = 'flex';
  };

  tuningModalBtn.addEventListener('click', openTuningModal);
  closeTuningModalBtn.addEventListener('click', () => tuningModal.style.display = 'none');

  tuningTemp.addEventListener('input', (e) => {
    tuningTempValue.textContent = parseFloat((e.target as any).value).toFixed(1);
  });
  tuningHistory.addEventListener('input', (e) => {
    tuningHistoryValue.textContent = (e.target as any).value + ' 轮';
  });

  saveTuningBtn.addEventListener('click', () => {
    window.sessionConfig.temp = parseFloat(tuningTemp.value);
    window.sessionConfig.maxHistory = parseInt(tuningHistory.value);
    window.sessionConfig.systemPrompt = tuningSystemPrompt.value.trim();
    tuningModal.style.display = 'none';
    if (window.__toast) window.__toast.success('🧠 思考设定已保存，将在下一次对话生效');
  });

  resetTuningBtn.addEventListener('click', () => {
    tuningTemp.value = 1.0;
    tuningTempValue.textContent = '1.0';
    tuningHistory.value = 10;
    tuningHistoryValue.textContent = '10 轮';
    tuningSystemPrompt.value = '';
  });

  // --- Mention Popup (@呼叫专家) 逻辑 ---
  let mentionActive = false;
  let mentionQuery = '';
  let selectedExpertIndex = 0;
  let filteredExperts = [];
  const mentionPopup = (document.getElementById('mentionPopup') as any);

  const renderMentionPopup = () => {
    if (!mentionActive) {
      mentionPopup.style.display = 'none';
      return;
    }

    filteredExperts = EXPERTS.filter(exp =>
      exp.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      (exp.description && exp.description.toLowerCase().includes(mentionQuery.toLowerCase()))
    );

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
    if (window.__toast) window.__toast.success(`已切换至专家模式：${expert.name}`);

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
      } else {
        mentionActive = false;
        renderMentionPopup();
      }
    } else {
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
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedExpertIndex = (selectedExpertIndex - 1 + filteredExperts.length) % filteredExperts.length;
        renderMentionPopup();
        return;
      } else if (e.key === 'Enter') {
        e.preventDefault();
        selectExpert(filteredExperts[selectedExpertIndex]);
        return;
      } else if (e.key === 'Escape') {
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
  (document.getElementById('optimizePromptBtn') as any).addEventListener('click', async () => {
    const input = (document.getElementById('chatInput') as any);
    const btn = (document.getElementById('optimizePromptBtn') as any);
    let text = input.value.trim();
    if (!text) {
      if (window.__toast) window.__toast.info('请先输入需要优化的原始需求');
      return;
    }

    // 禁用按钮并显示施法中状态
    const originalHtml = btn.innerHTML;
    btn.innerHTML = `<svg style="animation: spin 1s linear infinite;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span style="font-size: 13px">魔法注入中...</span>`;
    btn.disabled = true;
    input.value = ''; // 清空输入框准备流式写入

    // 检查是否存在 spin 动画，如果没有则动态注入
    if (!(document.getElementById('spinKeyframe') as any)) {
      const style = (document.createElement('style') as any);
      style.id = 'spinKeyframe';
      style.innerHTML = `@keyframes spin { 100% { transform: rotate(360deg); } }`;
      document.head.appendChild(style);
    }

    try {
      await new Promise((resolve, reject) => {
        const { promise } = api.chat.optimizePromptStream(text, activeModelId, (parsed) => {
          if (parsed.type === 'chunk') {
            input.value += parsed.content;
            input.dispatchEvent(new Event('input')); // 触发自适应高度调整
            input.scrollTop = input.scrollHeight; // 滚动到底部
          } else if (parsed.type === 'error') {
            reject(new Error(parsed.message));
          } else if (parsed.type === 'done') {
            resolve();
          }
        });

        promise.catch(reject);
      });

      input.focus();
      if (window.__toast) window.__toast.success('✨ 提示词已注入大模型灵魂！');
    } catch (err) {
      if (window.__toast) window.__toast.error('优化失败: ' + err.message);
      input.value = text; // 失败则回退为原文本
    } finally {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  });

  (document.getElementById('sendBtn') as any).addEventListener('click', sendMessage);

  // 上下文圆环点击（执行真正的上下文压缩：删除一半最老的消息）
  (document.getElementById('tokenCircleBtn') as any).addEventListener('click', async () => {
    if (!activeConvId) {
      if (window.__toast) window.__toast.info('暂无上下文可压缩');
      return;
    }
    try {
      if (window.__toast) window.__toast.info('正在压缩上下文...');
      const history = await api.chat.getHistory(activeConvId);
      // 如果历史少于4条，不值得压缩
      if (!history || history.length < 4) {
        if (window.__toast) window.__toast.success('当前上下文已是最佳状态，无需压缩');
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
      if (window.__toast) window.__toast.success(`上下文压缩完成！已清理 ${toDeleteCount} 条早期记忆`);
    } catch (e) {
      if (window.__toast) window.__toast.error('上下文压缩失败');
      console.error(e);
    }
  });

  // 垃圾桶按钮点击 (情况当前上下文)
  (document.getElementById('clearMemoryBtn') as any).addEventListener('click', async () => {
    if (activeConvId) {
      try {
        await api.chat.clearHistory(activeConvId);
        (document.getElementById('chatMessages') as any).innerHTML = `
          <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
            <div style="font-size: 48px;">💬</div>
            <div style="font-size: 16px;">上下文已清空，发送一条新消息开始吧</div>
          </div>
        `;
        tokenUsage = 0;
        updateTokenUsage();
        if (window.__toast) window.__toast.success('上下文记忆已彻底清空');
      } catch (e) {
        if (window.__toast) window.__toast.error('清空上下文失败');
      }
    }
  });

  // 引用功能关闭
  (document.getElementById('closeQuoteBtn') as any).addEventListener('click', () => {
    (document.getElementById('quotePreview') as any).style.display = 'none';
    (document.getElementById('quoteText') as any).textContent = '';
  });

  // 截图功能
  (document.getElementById('readScreenBtn') as any).addEventListener('click', async () => {
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
        (document.getElementById('attachmentImg') as any).src = dataUrl;
        (document.getElementById('attachmentPreview') as any).style.display = 'flex';
        (document.getElementById('chatInput') as any).focus();
      } else {
        if (window.__toast) window.__toast.info('截图已取消');
      }
    } catch (e) {
      if (window.__toast) window.__toast.error('截图失败: ' + e.message);
    }
  });

  (document.getElementById('removeAttachmentBtn') as any).addEventListener('click', () => {
    pendingAttachmentData = null;
    (document.getElementById('attachmentImg') as any).src = '';
    (document.getElementById('attachmentPreview') as any).style.display = 'none';
  });

  // 上传文件按钮（触发隐藏的 input type="file"）
  (document.getElementById('fileUploadBtn') as any).addEventListener('click', () => {
    const fileInput = (document.createElement('input') as any);
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = (e) => {
      const file = (e.target as any).files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e2) => {
        const dataUrl = e2.target.result;
        pendingAttachmentData = dataUrl;
        (document.getElementById('attachmentImg') as any).src = dataUrl;
        (document.getElementById('attachmentPreview') as any).style.display = 'flex';
        (document.getElementById('chatInput') as any).focus();
        if (window.__toast) window.__toast.success('图片已附加');
      };
      reader.readAsDataURL(file);
    };
    fileInput.click();
  });

  // 模型 Modal 逻辑
  (document.getElementById('modelModalBtn') as any).addEventListener('click', () => {
    (document.getElementById('modelSelectionModal') as any).style.display = 'flex';
  });
  (document.getElementById('closeModelModalBtn') as any).addEventListener('click', () => {
    (document.getElementById('modelSelectionModal') as any).style.display = 'none';
  });
  (document.getElementById('modelSelectionModal') as any).addEventListener('click', (e) => {
    if ((e.target as any).id === 'modelSelectionModal') (e.target as any).style.display = 'none';
  });

  // 清理旧模态框并移到 body（绕过 .page 的 CSS animation transform 导致 fixed 定位失效）
  const oldModal = (document.getElementById('modelSelectionModal') as any);
  if (oldModal && oldModal.parentNode === document.body) oldModal.remove();
  const freshModal = (document.getElementById('modelSelectionModal') as any);
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
      (document.getElementById('chatMessages') as any).innerHTML = '';
      (document.getElementById('chatTitle') as any).textContent = '新对话';
    }
  };

  // 初始化加载
  reloadModelsCallback = loadModels;
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
    (document.getElementById('chatMessages') as any).innerHTML = `
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">💬</div>
        <div style="font-size: 16px;">发送一条消息开始吧</div>
      </div>
    `;
    (document.getElementById('chatTitle') as any).textContent = '新对话';
    tokenUsage = 0;
    updateTokenUsage();
  }
}

// ======================= 基础逻辑 =======================
function updateExpertIndicator() {
  const indicator = (document.getElementById('expertIndicator') as any);
  if (activeExpert) {
    (document.getElementById('expertName') as any).textContent = `${activeExpert.icon || ''} ${activeExpert.name}`;
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
}

function updateTokenUsage() {
  const fill = (document.getElementById('tokenCircleFill') as any);
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
    const res = await api.model.getModels();

    // 移除重复模型，保留最后一个唯一 ID
    const uniqueMap = new Map();
    (res || []).forEach(m => uniqueMap.set(m.id, m));
    models = Array.from(uniqueMap.values());

    // 判断本地模型的更严谨逻辑
    const isLocal = (m) => m.type === 'local' || m.provider === 'LM Studio' || m.provider === 'Ollama' || m.id.toLowerCase().includes('local') || m.id.toLowerCase().includes('ollama');

    const localModels = models.filter(m => isLocal(m));
    const cloudModelsConfigured = models.filter(m => !isLocal(m) && m.configured !== false);

    // 渲染云端模型（按厂商列表展示，保留 icon/logo）
    const matchedIds = new Set();
    const renderedCloud = cloudVendors.map(vendor => {
      // 检查是否已配置该厂商的模型
      const matchedModels = cloudModelsConfigured.filter(m => {
        const match = (m.provider && m.provider.toLowerCase() === vendor.name.toLowerCase()) ||
          (m.provider && m.provider.toLowerCase() === vendor.id.toLowerCase()) ||
          m.id.toLowerCase().includes(vendor.id.toLowerCase());
        return match;
      });

      matchedModels.forEach(m => matchedIds.add(m.id));
      const isConfigured = matchedModels.length > 0;
      const targetModelId = isConfigured ? matchedModels[0].id : vendor.id;
      const configuredModelName = isConfigured ? (matchedModels[0].modelName || '默认模型') : '';

      // 状态灯：已配置且可连通的厂商显示绿色呼吸灯
      const statusLight = isConfigured
        ? `<span style="display: inline-block; width: 8px; height: 8px; background-color: #00c853; border-radius: 50%; box-shadow: 0 0 8px #00c853; margin-left: 6px;" title="已连通"></span>`
        : '';

      return `
        <div class="model-select-card" data-id="${targetModelId}" data-vendor="${vendor.id}" data-configured="${isConfigured}" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
           <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
             <span>${vendor.icon}</span> ${vendor.name}${statusLight}
           </div>
           <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
             <span style="color: ${isConfigured ? 'var(--success)' : 'inherit'};">${isConfigured ? '✅ 已配置' : '去配置&rarr;'}</span>
             ${isConfigured ? `<span title="底层调用模型名称">[${configuredModelName}]</span>` : ''}
           </div>
        </div>
      `;
    }).join('');

    const customCloudModels = cloudModelsConfigured.filter(m => !matchedIds.has(m.id));
    const renderedCustomCloud = customCloudModels.map(m => `
      <div class="model-select-card" data-id="${m.id}" data-configured="true" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
         <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
           <span>🔗</span> ${m.name || m.id}
           <span style="display: inline-block; width: 8px; height: 8px; background-color: #00c853; border-radius: 50%; box-shadow: 0 0 8px #00c853; margin-left: 6px;" title="已连通"></span>
         </div>
         <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
           <span style="color: var(--success);">✅ 已配置</span>
           <span title="底层调用模型名称">[${m.modelName || '未知'}]</span>
         </div>
      </div>
    `).join('');

    (document.getElementById('cloudModelsGrid') as any).innerHTML = renderedCloud + renderedCustomCloud;
    (document.getElementById('localModelsGrid') as any).innerHTML = localModels.length > 0 ? localModels.map(m => `
      <div class="model-select-card" data-id="${m.id}" data-configured="true" style="padding: 12px; border: 1px solid var(--border-light); border-radius: 12px; cursor: pointer; transition: all 0.2s; background: var(--bg-card); display: flex; flex-direction: column; gap: 4px;">
         <div style="font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px;">
           <span>💻</span> ${m.name}
           <span style="display: inline-block; width: 8px; height: 8px; background-color: #00c853; border-radius: 50%; box-shadow: 0 0 8px #00c853; margin-left: 6px;" title="已连通"></span>
         </div>
         <div style="font-size: 11px; color: var(--text-muted); display: flex; align-items: center; justify-content: space-between;">
           <span style="color: var(--success);">✅ 已本地化</span>
           <span title="底层调用模型名称">[${m.modelName || m.id}]</span>
         </div>
      </div>
    `).join('') : '<div style="color:var(--text-muted); font-size: 12px;">暂未配置本地模型</div>';

    // 绑定弹窗内模型点击
    document.querySelectorAll('.model-select-card').forEach(card => {
      card.addEventListener('click', async () => {
        const isConfigured = card.dataset.configured === 'true';
        const vendorId = card.dataset.vendor;

        if (!isConfigured && vendorId) {
          // 未配置，跳转至模型市场配置
          (document.getElementById('modelSelectionModal') as any).style.display = 'none';
          if (window.navigateTo) {
            window.navigateTo('market', { openConfig: vendorId });
          }
          return;
        }

        const id = card.getAttribute('data-id');
        activeModelId = id;
        const modelObj = models.find(x => x.id === activeModelId);
        if (modelObj) {
          (document.getElementById('activeModelLabel') as any).textContent = modelObj.name;
        } else {
          // 如果是按厂商展示的，我们通过 DOM 更新显示名字
          const nameEl = card.querySelector('div').textContent.replace(/[^\w\s\u4e00-\u9fa5]/gi, '').trim();
          (document.getElementById('activeModelLabel') as any).textContent = nameEl;
        }

        // 通知后端更新 activeModelId
        if (api.model && api.model.setActiveModel) {
          await api.model.setActiveModel(id).catch(e => console.error(e));
        }

        (document.getElementById('modelSelectionModal') as any).style.display = 'none';
        if (window.__toast) window.__toast.success(`已切换为: ${modelObj?.name || id}`);
      });
    });

    const activeRes = await api.model.getActiveModel();
    if (activeRes && activeRes.id) {
      activeModelId = activeRes.id;
    } else if (models.length > 0) {
      activeModelId = models[0].id;
    }

    const initialModel = models.find(x => x.id === activeModelId);
    if (initialModel) {
      (document.getElementById('activeModelLabel') as any).textContent = initialModel.name;
    } else if (activeModelId) {
      (document.getElementById('activeModelLabel') as any).textContent = activeModelId;
    }
  } catch (e) {
    console.error('Failed to load models:', e);
  }
}


async function createNewChat() {
  if (isGenerating) return;
  try {
    const res = await api.chat.createConversation('新对话');
    activeConvId = res.id;
    await window.refreshSidebarConversations?.();
    (document.getElementById('chatMessages') as any).innerHTML = `
      <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: var(--text-muted); flex-direction: column; gap: 16px;">
        <div style="font-size: 48px;">✨</div>
        <div style="font-size: 16px;">新的对话已创建</div>
      </div>
    `;
    (document.getElementById('chatTitle') as any).textContent = '新对话';
    tokenUsage = 0;
    updateTokenUsage();
  } catch (e) {
    console.error('Failed to create chat:', e);
  }
}

async function loadHistory(convId) {
  try {
    const msgs = await api.chat.getHistory(convId);
    renderMessages(msgs || []);
    const list = await api.chat.getConversations();
    const c = list.find(x => x.id === convId);
    if (c) (document.getElementById('chatTitle') as any).textContent = c.title || '新对话';
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
  (document.getElementById('quotePreview') as any).style.display = 'flex';
  (document.getElementById('quoteText') as any).textContent = text;
  (document.getElementById('chatInput') as any).focus();
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
  const container = (document.getElementById('chatMessages') as any);
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
  const container = (document.getElementById('chatMessages') as any);
  if (container.children.length === 1 && (container.children[0].textContent.includes('发送一条消息') || container.children[0].textContent.includes('新的对话'))) {
    container.innerHTML = '';
  }

  const msgDiv = (document.createElement('div') as any);
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
    api.chat.abortStream();
    isGenerating = false;
    const btn = (document.getElementById('sendBtn') as any);
    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
    btn.classList.remove('is-stop');
    return;
  }

  const input = (document.getElementById('chatInput') as any);
  let text = input.value.trim();
  if (!text && !pendingAttachmentData) return;

  const quotePreview = (document.getElementById('quotePreview') as any);
  if (quotePreview.style.display === 'flex') {
    const quoteText = (document.getElementById('quoteText') as any).textContent;
    text = `> ${quoteText}\n\n${text}`;
    quotePreview.style.display = 'none';
    (document.getElementById('quoteText') as any).textContent = '';
  }

  if (!activeConvId) {
    await createNewChat();
  }

  input.value = '';
  input.style.height = '56px';

  const attachmentData = pendingAttachmentData;
  if (attachmentData) {
    (document.getElementById('removeAttachmentBtn') as any).click(); // Clean UI state
  }

  const userBox = appendMessage('user');
  let userHtml = escapeHtml(text).replace(/\n/g, '<br/>');
  if (attachmentData) {
    userHtml += `<div style="margin-top: 8px;"><img src="${attachmentData}" style="max-height: 120px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.2);"></div>`;
  }
  userBox.innerHTML = userHtml;

  isGenerating = true;
  const sendBtn = (document.getElementById('sendBtn') as any);
  sendBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="10" x="7" y="7" rx="1"></rect></svg>`;
  sendBtn.classList.add('is-stop');

  const aiBox = appendMessage('ai');
  let fullResponse = '';

  tokenUsage += 5;
  updateTokenUsage();

  try {
    let temp = 0.7;
    let extraPrompt = '';
    const depth = (document.getElementById('depthSelect') as any).value;

    if (depth === 'low') {
      temp = 0.8;
      extraPrompt = '\n\n【系统提示：请尽可能简明扼要、直接了当地回答。】';
    } else if (depth === 'high') {
      temp = 0.3;
      extraPrompt = '\n\n【系统提示：请进行深思熟虑。一步一步地拆解问题，考虑各种边界情况和深层逻辑，提供详尽且富有洞察力的回答。】';
    } else if (depth === 'extreme') {
      temp = 0.1;
      extraPrompt = '\n\n【系统提示：启用深度推理模式。你必须极其彻底地思考此问题，展开所有可能的推理链条，检查每一个假设，并且以长篇幅的深度分析来回复。】';
    }

    const prompt = (activeExpert ? activeExpert.prompt : '') + extraPrompt;

    await api.chat.sendMessageStream(activeConvId, text, attachmentData, activeModelId, prompt, temp, (parsed) => {
      if (parsed.type === 'error') {
        let errorMsg = parsed.message || '未知错误';
        if (errorMsg.toLowerCase().includes('401') || errorMsg.toLowerCase().includes('key') || errorMsg.toLowerCase().includes('auth')) {
          errorMsg = '当前选择的模型 API Key 未配置或不正确，请在左侧「模型市场」重新配置。';
        } else if (errorMsg.includes('ECONNREFUSED') || errorMsg.toLowerCase().includes('fetch')) {
          errorMsg = '网络连接失败，或者您配置的本地模型未启动。';
        } else if (errorMsg.includes('500') || errorMsg.includes('JSON')) {
          errorMsg = '服务端发生了异常，请检查该模型是否可用。';
        }
        fullResponse += `\n\n> ❌ **无法回复**: ${errorMsg}`;
        let displayResponse = fullResponse.replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '');
        aiBox.innerHTML = parseMarkdown(displayResponse);
        scrollToBottom();
        return;
      }
      if (parsed.type === 'conversation' && parsed.id) {
        activeConvId = parsed.id;
      }
      if (parsed.content) {
        fullResponse += parsed.content;

        // 隐藏已完整闭合的和正在流式生成的记忆标签
        let displayResponse = fullResponse
          .replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '')
          .replace(/\[SAVE_MEMORY:[\s\S]*$/, '');

        // 如果代码块未闭合，补全它以防 UI 错乱
        const codeBlockCount = (displayResponse.match(/```/g) || []).length;
        if (codeBlockCount % 2 !== 0) {
          displayResponse += '\n```';
        }

        aiBox.innerHTML = parseMarkdown(displayResponse) + '<span class="cursor" style="display: inline-block; width: 8px; height: 16px; background: currentColor; animation: blink 1s step-end infinite; margin-left: 4px;"></span>';
        scrollToBottom();
      }
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      fullResponse += '\n\n*(已中断)*';
    } else {
      let errorMsg = err.message || '未知错误';
      if (errorMsg.toLowerCase().includes('401') || errorMsg.toLowerCase().includes('key')) {
        errorMsg = 'API Key 似乎未配置，请前往设置检查。';
      }
      fullResponse += '\n\n**[请求失败]** ' + errorMsg;
      if (window.__toast) window.__toast.error('发送失败: ' + errorMsg);
    }
  } finally {
    isGenerating = false;
    sendBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>`;
    sendBtn.classList.remove('is-stop');
    let finalDisplayResponse = fullResponse.replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '');
    aiBox.innerHTML = parseMarkdown(finalDisplayResponse);

    // 为用户消息和 AI 消息动态添加快捷操作栏
    const addActions = (box, text) => {
      const actionsHtml = `
         <div class="message-actions" style="margin-top: 4px;">
            <button class="action-btn" onclick="window.handleQuote(this)" data-text="${escapeHtml(text)}" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">引用</button>
            <button class="action-btn" onclick="window.handleCopy(this)" data-text="${escapeHtml(text)}" style="font-size: 12px; color: var(--text-muted); cursor: pointer; background: none; border: none; padding: 4px;">复制</button>
         </div>
       `;
      const actionsDiv = (document.createElement('div') as any);
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
  const container = (document.getElementById('chatMessages') as any);
  container.scrollTop = container.scrollHeight;
}


