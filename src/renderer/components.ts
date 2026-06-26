// @ts-nocheck
// ================== modal.ts ==================
/**
 * 全局 Modal 模态框组件
 * 支持简单的标题、内容、确认/取消按钮
 */

export function showModal({
  title = '提示',
  content = '',
  confirmText = '确定',
  cancelText = '取消',
  onConfirm = null,
  onCancel = null,
  danger = false
}) {
  return new Promise((resolve) => {
    const overlay = (document.createElement('div') as any);
    overlay.className = 'modal-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0, 0, 0, 0.5)';
    overlay.style.backdropFilter = 'blur(6px)';
    overlay.style.WebkitBackdropFilter = 'blur(6px)';
    overlay.style.zIndex = '100001';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.2s ease';

    const modal = (document.createElement('div') as any);
    modal.className = 'modal-box';
    modal.style.background = 'var(--bg-card, #ffffff)';
    modal.style.borderRadius = '16px';
    modal.style.boxShadow = '0 20px 40px rgba(0, 0, 0, 0.2)';
    modal.style.width = '90%';
    modal.style.maxWidth = '420px';
    modal.style.padding = '24px';
    modal.style.transform = 'translateY(20px) scale(0.95)';
    modal.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    modal.style.color = 'var(--text-main, #333)';

    // header
    const header = (document.createElement('h3') as any);
    header.style.margin = '0 0 16px 0';
    header.style.fontSize = '20px';
    header.style.fontWeight = '600';
    header.textContent = title;

    // body
    const body = (document.createElement('div') as any);
    body.style.fontSize = '15px';
    body.style.color = 'var(--text-secondary, #666)';
    body.style.lineHeight = '1.6';
    body.style.marginBottom = '24px';
    body.innerHTML = content;

    // footer
    const footer = (document.createElement('div') as any);
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '12px';

    const btnCancel = (document.createElement('button') as any);
    btnCancel.textContent = cancelText;
    btnCancel.className = 'btn btn-default';
    btnCancel.style.padding = '8px 16px';
    btnCancel.style.borderRadius = '8px';
    btnCancel.style.border = '1px solid var(--border-light, #ddd)';
    btnCancel.style.background = 'transparent';
    btnCancel.style.color = 'var(--text-main, #333)';
    btnCancel.style.cursor = 'pointer';

    const btnConfirm = (document.createElement('button') as any);
    btnConfirm.textContent = confirmText;
    btnConfirm.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    btnConfirm.style.padding = '8px 16px';
    btnConfirm.style.borderRadius = '8px';
    btnConfirm.style.border = 'none';
    btnConfirm.style.background = danger ? '#ff3b30' : 'var(--primary, #007aff)';
    btnConfirm.style.color = '#fff';
    btnConfirm.style.cursor = 'pointer';
    btnConfirm.style.fontWeight = '500';

    const closeModal = () => {
      overlay.style.opacity = '0';
      modal.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    };

    btnCancel.addEventListener('click', () => {
      closeModal();
      if (onCancel) onCancel();
      resolve(false);
    });

    btnConfirm.addEventListener('click', () => {
      closeModal();
      if (onConfirm) onConfirm();
      resolve(true);
    });

    footer.appendChild(btnCancel);
    footer.appendChild(btnConfirm);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    // 点击背景关闭
    overlay.addEventListener('click', (e) => {
      if ((e.target as any) === overlay) {
        closeModal();
        resolve(false);
      }
    });

    // trigger animation
    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'translateY(0) scale(1)';
    });
  });
}
// ================== toast.ts ==================
/**
 * Toast 全局通知组件
 * 现代风格的轻量级通知，支持不同的状态。
 */

let toastContainer = null;

const ICONS = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️'
};

function ensureContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = (document.createElement('div') as any);
    toastContainer.className = 'toast-container';
    
    // 内联基础样式，防止外部样式缺失时完全失效
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '24px';
    toastContainer.style.right = '24px';
    toastContainer.style.zIndex = '999999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '12px';
    toastContainer.style.pointerEvents = 'none';
    
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message, type = 'info', duration = 3000) {
  ensureContainer();

  const toast = (document.createElement('div') as any);
  toast.style.pointerEvents = 'auto';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '12px';
  toast.style.padding = '12px 16px';
  toast.style.background = 'rgba(30, 30, 30, 0.85)';
  toast.style.backdropFilter = 'blur(12px)';
  toast.style.WebkitBackdropFilter = 'blur(12px)';
  toast.style.color = '#fff';
  toast.style.borderRadius = '12px';
  toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '500';
  toast.style.transform = 'translateX(120%)';
  toast.style.opacity = '0';
  toast.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
  
  if (type === 'success') toast.style.borderLeft = '4px solid #34c759';
  else if (type === 'error') toast.style.borderLeft = '4px solid #ff3b30';
  else if (type === 'warning') toast.style.borderLeft = '4px solid #ffcc00';
  else toast.style.borderLeft = '4px solid #007aff';

  toast.innerHTML = `
    <span style="font-size: 16px;">${ICONS[type] || ICONS.info}</span>
    <span style="flex: 1; word-break: break-all;">${message}</span>
    <button class="toast-close-btn" style="background: transparent; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 16px; padding: 0; margin-left: 8px;">&times;</button>
  `;

  const closeBtn = toast.querySelector('.toast-close-btn');
  closeBtn.addEventListener('click', () => removeToast(toast));

  toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  let timer = setTimeout(() => removeToast(toast), duration);

  toast.addEventListener('mouseenter', () => clearTimeout(timer));
  toast.addEventListener('mouseleave', () => {
    timer = setTimeout(() => removeToast(toast), 1500);
  });
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;
  toast.style.transform = 'translateX(120%)';
  toast.style.opacity = '0';
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 400); // Wait for transition
}

/** Toast 快捷方法对象 */
const toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error: (msg, d) => showToast(msg, 'error', d),
  warning: (msg, d) => showToast(msg, 'warning', d),
  info: (msg, d) => showToast(msg, 'info', d),
};

// 绑定全局以便非模块代码调用
window.__toast = toast;

export default toast;
// ================== sandbox-confirm.ts ==================
/**
 * 沙盒执行代码确认框
 * 用于在助手尝试执行系统命令或脚本前，拦截并请求用户授权
 */

import { escapeHtml } from '../utils.js';

export function showSandboxConfirm(command, details = '') {
  return new Promise((resolve) => {
    const overlay = (document.createElement('div') as any);
    overlay.className = 'modal-overlay sandbox-confirm-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100vw';
    overlay.style.height = '100vh';
    overlay.style.background = 'rgba(0, 0, 0, 0.6)';
    overlay.style.backdropFilter = 'blur(8px)';
    overlay.style.WebkitBackdropFilter = 'blur(8px)';
    overlay.style.zIndex = '10001';
    overlay.style.display = 'flex';
    overlay.style.justifyContent = 'center';
    overlay.style.alignItems = 'center';
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.25s ease';

    const modal = (document.createElement('div') as any);
    modal.className = 'modal-box';
    modal.style.background = 'var(--bg-card, #2c2c2e)';
    modal.style.borderRadius = '16px';
    modal.style.border = '1px solid var(--border-light, #444)';
    modal.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.4)';
    modal.style.width = '90%';
    modal.style.maxWidth = '540px';
    modal.style.padding = '0';
    modal.style.transform = 'translateY(20px) scale(0.95)';
    modal.style.transition = 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    modal.style.overflow = 'hidden';

    // Header
    const header = (document.createElement('div') as any);
    header.style.padding = '20px 24px';
    header.style.background = 'linear-gradient(90deg, rgba(255, 59, 48, 0.1) 0%, transparent 100%)';
    header.style.borderBottom = '1px solid var(--border-light, #444)';
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.gap = '12px';

    header.innerHTML = `
      <span style="font-size: 24px; color: #ff3b30;">🛡️</span>
      <div>
        <h3 style="margin: 0; font-size: 18px; color: var(--text-main, #fff);">权限请求：执行命令</h3>
        <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary, #aaa);">助手请求在您的计算机上执行以下操作，请谨慎审核。</p>
      </div>
    `;

    // Body
    const body = (document.createElement('div') as any);
    body.style.padding = '24px';
    
    body.innerHTML = `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary, #aaa); margin-bottom: 8px; text-transform: uppercase;">请求执行的命令 / 脚本</div>
        <div style="background: #1e1e1e; padding: 16px; border-radius: 8px; border: 1px solid #333; overflow-x: auto;">
          <code style="font-family: Consolas, monospace; color: #00ff00; font-size: 14px; white-space: pre-wrap; word-break: break-all;">${escapeHtml(command)}</code>
        </div>
      </div>
      ${details ? `
      <div>
        <div style="font-size: 13px; font-weight: 600; color: var(--text-secondary, #aaa); margin-bottom: 8px; text-transform: uppercase;">附加信息</div>
        <div style="font-size: 14px; color: var(--text-main, #ddd); line-height: 1.5;">${escapeHtml(details)}</div>
      </div>
      ` : ''}
    `;

    // Footer
    const footer = (document.createElement('div') as any);
    footer.style.padding = '16px 24px';
    footer.style.background = 'var(--bg-body, #1c1c1e)';
    footer.style.borderTop = '1px solid var(--border-light, #444)';
    footer.style.display = 'flex';
    footer.style.justifyContent = 'flex-end';
    footer.style.gap = '12px';

    const btnReject = (document.createElement('button') as any);
    btnReject.textContent = '拒绝执行';
    btnReject.className = 'btn btn-default';
    btnReject.style.padding = '10px 20px';
    btnReject.style.borderRadius = '8px';
    btnReject.style.border = '1px solid var(--border-light, #555)';
    btnReject.style.background = 'transparent';
    btnReject.style.color = 'var(--text-main, #fff)';
    btnReject.style.cursor = 'pointer';

    const btnAllow = (document.createElement('button') as any);
    btnAllow.textContent = '允许一次';
    btnAllow.className = 'btn btn-primary';
    btnAllow.style.padding = '10px 20px';
    btnAllow.style.borderRadius = '8px';
    btnAllow.style.border = 'none';
    btnAllow.style.background = '#007aff';
    btnAllow.style.color = '#fff';
    btnAllow.style.cursor = 'pointer';
    btnAllow.style.fontWeight = '500';

    const closeModal = () => {
      overlay.style.opacity = '0';
      modal.style.transform = 'translateY(20px) scale(0.95)';
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 250);
    };

    btnReject.addEventListener('click', () => {
      closeModal();
      resolve(false);
    });

    btnAllow.addEventListener('click', () => {
      closeModal();
      resolve(true);
    });

    footer.appendChild(btnReject);
    footer.appendChild(btnAllow);

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.opacity = '1';
      modal.style.transform = 'translateY(0) scale(1)';
    });
  });
}


