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