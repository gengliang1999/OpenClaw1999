// ================== modal.ts ==================
/**
 * 全局 Modal 模态框组件
 * 支持简单的标题、内容、确认/取消按钮
 */
export function showModal({ title = '提示', content = '', confirmText = '确定', cancelText = '取消', onConfirm = null, onCancel = null, danger = false } = {}) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0, 0, 0, 0.5)';
        overlay.style.backdropFilter = 'blur(6px)';
        overlay.style.setProperty('-webkit-backdrop-filter', 'blur(6px)');
        overlay.style.zIndex = '100001';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        const modal = document.createElement('div');
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
        const header = document.createElement('h3');
        header.style.margin = '0 0 16px 0';
        header.style.fontSize = '20px';
        header.style.fontWeight = '600';
        header.textContent = title;
        // body
        const body = document.createElement('div');
        body.style.fontSize = '15px';
        body.style.color = 'var(--text-secondary, #666)';
        body.style.lineHeight = '1.6';
        body.style.marginBottom = '24px';
        body.innerHTML = content;
        // footer
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '12px';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = cancelText;
        btnCancel.className = 'btn btn-default';
        btnCancel.style.padding = '8px 16px';
        btnCancel.style.borderRadius = '8px';
        btnCancel.style.border = '1px solid var(--border-light, #ddd)';
        btnCancel.style.background = 'transparent';
        btnCancel.style.color = 'var(--text-main, #333)';
        btnCancel.style.cursor = 'pointer';
        const btnConfirm = document.createElement('button');
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
                if (overlay.parentNode)
                    overlay.parentNode.removeChild(overlay);
            }, 200);
        };
        btnCancel.addEventListener('click', () => {
            closeModal();
            if (onCancel)
                onCancel();
            resolve(false);
        });
        btnConfirm.addEventListener('click', () => {
            closeModal();
            if (onConfirm)
                onConfirm();
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
            if (e.target === overlay) {
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
        toastContainer = document.createElement('div');
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
export function showToast(message, type = 'info', duration = 2000) {
    ensureContainer();
    if (!toastContainer)
        return;
    const toast = document.createElement('div');
    toast.style.pointerEvents = 'auto';
    toast.style.display = 'flex';
    toast.style.alignItems = 'center';
    toast.style.gap = '12px';
    toast.style.padding = '12px 16px';
    toast.style.background = 'rgba(30, 30, 30, 0.85)';
    toast.style.backdropFilter = 'blur(12px)';
    toast.style.setProperty('-webkit-backdrop-filter', 'blur(12px)');
    toast.style.color = '#fff';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 8px 32px rgba(0, 0, 0, 0.2)';
    toast.style.fontSize = '14px';
    toast.style.fontWeight = '500';
    toast.style.transform = 'translateX(120%)';
    toast.style.opacity = '0';
    toast.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    toast.style.maxWidth = '360px';
    if (type === 'success')
        toast.style.borderLeft = '4px solid #34c759';
    else if (type === 'error')
        toast.style.borderLeft = '4px solid #ff3b30';
    else if (type === 'warning')
        toast.style.borderLeft = '4px solid #ffcc00';
    else
        toast.style.borderLeft = '4px solid #007aff';
    toast.innerHTML = `
    <span style="font-size: 16px;">${ICONS[type] || ICONS.info}</span>
    <span style="flex: 1; word-break: break-all;">${message}</span>
    <button class="toast-close-btn" style="background: transparent; border: none; color: rgba(255,255,255,0.6); cursor: pointer; font-size: 16px; padding: 0; margin-left: 8px;">&times;</button>
  `;
    const closeBtn = toast.querySelector('.toast-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => removeToast(toast));
    }
    toastContainer.appendChild(toast);
    // Trigger animation
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });
    let timer = setTimeout(() => removeToast(toast), duration);
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
        timer = setTimeout(() => removeToast(toast), 1000);
    });
}
function removeToast(toast) {
    if (!toast || !toast.parentNode)
        return;
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
    warn: (msg, d) => showToast(msg, 'warning', d),
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
import { escapeHtml } from './utils.js';
export function showSandboxConfirm(command, details = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay sandbox-confirm-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0, 0, 0, 0.6)';
        overlay.style.backdropFilter = 'blur(8px)';
        overlay.style.setProperty('-webkit-backdrop-filter', 'blur(8px)');
        overlay.style.zIndex = '10001';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.25s ease';
        const modal = document.createElement('div');
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
        const header = document.createElement('div');
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
        const body = document.createElement('div');
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
        const footer = document.createElement('div');
        footer.style.padding = '16px 24px';
        footer.style.background = 'var(--bg-body, #1c1c1e)';
        footer.style.borderTop = '1px solid var(--border-light, #444)';
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.alignItems = 'center';
        footer.style.gap = '12px';
        // S5：永久授权勾选
        const permanentWrap = document.createElement('label');
        permanentWrap.style.display = 'flex';
        permanentWrap.style.alignItems = 'center';
        permanentWrap.style.gap = '6px';
        permanentWrap.style.marginRight = 'auto';
        permanentWrap.style.cursor = 'pointer';
        permanentWrap.style.fontSize = '13px';
        permanentWrap.style.color = 'var(--text-secondary, #aaa)';
        const permanentChk = document.createElement('input');
        permanentChk.type = 'checkbox';
        permanentChk.style.cursor = 'pointer';
        const permanentLabel = document.createElement('span');
        permanentLabel.textContent = '记住此命令（永久授权，30 天）';
        permanentWrap.appendChild(permanentChk);
        permanentWrap.appendChild(permanentLabel);
        const btnReject = document.createElement('button');
        btnReject.textContent = '拒绝执行';
        btnReject.className = 'btn btn-default';
        btnReject.style.display = 'inline-flex';
        btnReject.style.alignItems = 'center';
        btnReject.style.justifyContent = 'center';
        btnReject.style.height = '38px';
        btnReject.style.padding = '0 20px';
        btnReject.style.borderRadius = '8px';
        btnReject.style.border = '1px solid var(--border-color, #555)';
        btnReject.style.background = 'transparent';
        btnReject.style.color = 'var(--text-primary, #fff)';
        btnReject.style.cursor = 'pointer';
        btnReject.style.fontSize = '14px';
        btnReject.style.transition = 'all 0.2s ease';
        btnReject.addEventListener('mouseover', () => {
            btnReject.style.background = 'var(--bg-hover, rgba(255, 255, 255, 0.08))';
        });
        btnReject.addEventListener('mouseout', () => {
            btnReject.style.background = 'transparent';
        });
        const btnAllow = document.createElement('button');
        btnAllow.textContent = '允许一次';
        btnAllow.className = 'btn btn-primary';
        btnAllow.style.display = 'inline-flex';
        btnAllow.style.alignItems = 'center';
        btnAllow.style.justifyContent = 'center';
        btnAllow.style.height = '38px';
        btnAllow.style.padding = '0 20px';
        btnAllow.style.borderRadius = '8px';
        btnAllow.style.border = 'none';
        btnAllow.style.background = '#007aff';
        btnAllow.style.color = '#fff';
        btnAllow.style.cursor = 'pointer';
        btnAllow.style.fontWeight = '500';
        btnAllow.style.fontSize = '14px';
        btnAllow.style.transition = 'all 0.2s ease';
        btnAllow.addEventListener('mouseover', () => {
            btnAllow.style.background = '#0066cc';
        });
        btnAllow.addEventListener('mouseout', () => {
            btnAllow.style.background = '#007aff';
        });
        const closeModal = () => {
            overlay.style.opacity = '0';
            modal.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => {
                if (overlay.parentNode)
                    overlay.parentNode.removeChild(overlay);
            }, 250);
        };
        btnReject.addEventListener('click', () => {
            closeModal();
            resolve({ confirmed: false, permanent: false });
        });
        btnAllow.addEventListener('click', () => {
            closeModal();
            resolve({ confirmed: true, permanent: !!permanentChk.checked });
        });
        footer.appendChild(permanentWrap);
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
export function showPrompt(message, defaultValue = '') {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.style.position = 'fixed';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100vw';
        overlay.style.height = '100vh';
        overlay.style.background = 'rgba(0, 0, 0, 0.5)';
        overlay.style.backdropFilter = 'blur(6px)';
        overlay.style.zIndex = '100001';
        overlay.style.display = 'flex';
        overlay.style.justifyContent = 'center';
        overlay.style.alignItems = 'center';
        overlay.style.opacity = '0';
        overlay.style.transition = 'opacity 0.2s ease';
        const modal = document.createElement('div');
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
        const msgEl = document.createElement('p');
        msgEl.textContent = message;
        msgEl.style.margin = '0 0 16px 0';
        msgEl.style.fontSize = '16px';
        const input = document.createElement('input');
        input.type = 'text';
        input.value = defaultValue;
        input.style.width = '100%';
        input.style.padding = '12px';
        input.style.borderRadius = '8px';
        input.style.border = '1px solid var(--border-light, #ddd)';
        input.style.background = 'var(--bg-input, #f9f9f9)';
        input.style.color = 'var(--text-main, #333)';
        input.style.fontSize = '14px';
        input.style.outline = 'none';
        input.style.marginBottom = '24px';
        input.style.boxSizing = 'border-box';
        input.onfocus = () => input.style.borderColor = 'var(--theme-primary, #6c63ff)';
        input.onblur = () => input.style.borderColor = 'var(--border-light, #ddd)';
        const footer = document.createElement('div');
        footer.style.display = 'flex';
        footer.style.justifyContent = 'flex-end';
        footer.style.gap = '12px';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = '取消';
        btnCancel.className = 'btn';
        btnCancel.style.padding = '8px 16px';
        btnCancel.style.borderRadius = '8px';
        btnCancel.style.border = '1px solid var(--border-light, #ddd)';
        btnCancel.style.background = 'transparent';
        btnCancel.style.color = 'var(--text-main, #333)';
        btnCancel.style.cursor = 'pointer';
        const btnConfirm = document.createElement('button');
        btnConfirm.textContent = '确定';
        btnConfirm.className = 'btn btn-primary';
        btnConfirm.style.padding = '8px 16px';
        btnConfirm.style.borderRadius = '8px';
        btnConfirm.style.border = 'none';
        btnConfirm.style.background = 'var(--theme-primary, #6c63ff)';
        btnConfirm.style.color = '#fff';
        btnConfirm.style.cursor = 'pointer';
        const close = (result) => {
            overlay.style.opacity = '0';
            modal.style.transform = 'translateY(20px) scale(0.95)';
            setTimeout(() => document.body.removeChild(overlay), 300);
            resolve(result);
        };
        btnCancel.onclick = () => close(null);
        btnConfirm.onclick = () => close(input.value);
        input.onkeydown = (e) => {
            if (e.key === 'Enter')
                close(input.value);
            if (e.key === 'Escape')
                close(null);
        };
        footer.appendChild(btnCancel);
        footer.appendChild(btnConfirm);
        modal.appendChild(msgEl);
        modal.appendChild(input);
        modal.appendChild(footer);
        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'translateY(0) scale(1)';
            input.focus();
        });
    });
}
export function createThinkingCard({ title = 'AI 思考过程与工具调用', content = '', toolName = '', durationMs = 0, expanded = false }) {
    const container = document.createElement('div');
    container.className = 'thinking-card-container';
    container.style.margin = '8px 0';
    container.style.borderRadius = '12px';
    container.style.border = '1px solid var(--border-light, rgba(0, 0, 0, 0.1))';
    container.style.background = 'var(--bg-secondary, rgba(240, 240, 245, 0.5))';
    container.style.overflow = 'hidden';
    container.style.transition = 'all 0.2s ease';
    // 头部
    const header = document.createElement('div');
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.justifyContent = 'space-between';
    header.style.padding = '8px 12px';
    header.style.cursor = 'pointer';
    header.style.userSelect = 'none';
    header.style.fontSize = '13px';
    header.style.color = 'var(--text-secondary, #666)';
    const leftBadge = document.createElement('div');
    leftBadge.style.display = 'flex';
    leftBadge.style.alignItems = 'center';
    leftBadge.style.gap = '6px';
    const icon = document.createElement('span');
    icon.innerHTML = '🧠';
    icon.style.fontSize = '14px';
    const titleEl = document.createElement('span');
    titleEl.style.fontWeight = '500';
    titleEl.textContent = toolName ? `执行工具: ${toolName}` : title;
    leftBadge.appendChild(icon);
    leftBadge.appendChild(titleEl);
    const rightBadge = document.createElement('div');
    rightBadge.style.display = 'flex';
    rightBadge.style.alignItems = 'center';
    rightBadge.style.gap = '8px';
    if (durationMs > 0) {
        const timeEl = document.createElement('span');
        timeEl.style.fontSize = '11px';
        timeEl.style.opacity = '0.7';
        timeEl.textContent = `${(durationMs / 1000).toFixed(1)}s`;
        rightBadge.appendChild(timeEl);
    }
    const arrow = document.createElement('span');
    arrow.style.transition = 'transform 0.2s ease';
    arrow.textContent = expanded ? '▲' : '▼';
    rightBadge.appendChild(arrow);
    header.appendChild(leftBadge);
    header.appendChild(rightBadge);
    // 内容区
    const body = document.createElement('div');
    body.style.display = expanded ? 'block' : 'none';
    body.style.padding = '10px 12px';
    body.style.borderTop = '1px solid var(--border-light, rgba(0, 0, 0, 0.05))';
    body.style.fontSize = '12px';
    body.style.fontFamily = 'monospace';
    body.style.whiteSpace = 'pre-wrap';
    body.style.maxHeight = '240px';
    body.style.overflowY = 'auto';
    body.style.color = 'var(--text-muted, #555)';
    body.style.background = 'var(--bg-code, rgba(0, 0, 0, 0.02))';
    body.textContent = content;
    let isExpanded = expanded;
    header.onclick = () => {
        isExpanded = !isExpanded;
        body.style.display = isExpanded ? 'block' : 'none';
        arrow.style.transform = isExpanded ? 'rotate(180deg)' : 'rotate(0deg)';
    };
    container.appendChild(header);
    container.appendChild(body);
    return container;
}
