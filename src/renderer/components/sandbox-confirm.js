/**
 * 沙盒执行代码确认框
 * 用于在助手尝试执行系统命令或脚本前，拦截并请求用户授权
 */

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
    overlay.style.WebkitBackdropFilter = 'blur(8px)';
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
    footer.style.gap = '12px';

    const btnReject = document.createElement('button');
    btnReject.textContent = '拒绝执行';
    btnReject.className = 'btn btn-default';
    btnReject.style.padding = '10px 20px';
    btnReject.style.borderRadius = '8px';
    btnReject.style.border = '1px solid var(--border-light, #555)';
    btnReject.style.background = 'transparent';
    btnReject.style.color = 'var(--text-main, #fff)';
    btnReject.style.cursor = 'pointer';

    const btnAllow = document.createElement('button');
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

function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}