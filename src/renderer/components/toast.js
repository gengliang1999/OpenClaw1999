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
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    
    // 内联基础样式，防止外部样式缺失时完全失效
    toastContainer.style.position = 'fixed';
    toastContainer.style.top = '24px';
    toastContainer.style.right = '24px';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '12px';
    toastContainer.style.pointerEvents = 'none';
    
    document.body.appendChild(toastContainer);
  }
}

export function showToast(message, type = 'info', duration = 3000) {
  ensureContainer();

  const toast = document.createElement('div');
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

// 绑定全局以便其他非模块代码调用
window.__toast = {
  success: (msg, d) => showToast(msg, 'success', d),
  error: (msg, d) => showToast(msg, 'error', d),
  warning: (msg, d) => showToast(msg, 'warning', d),
  info: (msg, d) => showToast(msg, 'info', d)
};

export default window.__toast;