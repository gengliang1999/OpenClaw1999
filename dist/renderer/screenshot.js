"use strict";
const canvas = document.getElementById('screenshotCanvas');
const ctx = canvas.getContext('2d');
let bgImage = new Image();
let isDrawing = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;
window.openClaw.system.onScreenshotStart((dataUrl) => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (!dataUrl) {
        cancel();
        return;
    }
    // 先立刻画一层黑色半透明遮罩，利用透明窗口的特性，让用户的屏幕看起来瞬间变暗，提供秒开反馈
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    bgImage.onload = () => {
        draw();
    };
    bgImage.src = dataUrl;
});
function draw() {
    // Draw full background
    ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    // Draw dim overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (isDrawing || (startX !== currentX && startY !== currentY)) {
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const w = Math.abs(currentX - startX);
        const h = Math.abs(currentY - startY);
        // Clear the dim overlay in the selected area to show original background
        ctx.clearRect(x, y, w, h);
        ctx.drawImage(bgImage, x, y, w, h, x, y, w, h);
        // Draw selection border
        ctx.strokeStyle = '#1e90ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
    }
}
// 浮动工具栏元素
const floatToolbar = document.getElementById('floatingToolbar');
let selectedArea = null;
// Mouse events
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0)
        return; // 只响应左键点击
    // 如果点击的是工具栏或工具栏的子元素，则不要重置截图选区
    if (floatToolbar.contains(e.target))
        return;
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;
    // 隐藏工具栏
    floatToolbar.classList.remove('show');
    floatToolbar.style.display = 'none';
});
canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing)
        return;
    currentX = e.clientX;
    currentY = e.clientY;
    draw();
});
canvas.addEventListener('mouseup', (e) => {
    if (!isDrawing)
        return;
    isDrawing = false;
    currentX = e.clientX;
    currentY = e.clientY;
    const x = Math.min(startX, currentX);
    const y = Math.min(startY, currentY);
    const w = Math.abs(currentX - startX);
    const h = Math.abs(currentY - startY);
    if (w > 10 && h > 10) {
        selectedArea = { x, y, w, h };
        // 计算工具栏坐标
        const tbW = 380; // 工具栏大概宽度
        const tbH = 40; // 工具栏大概高度
        let tbX = x + w - tbW;
        if (tbX < 10)
            tbX = 10;
        let tbY = y + h + 10;
        if (tbY + tbH > window.innerHeight) {
            tbY = y - tbH - 10; // 底部空间不足时放选区上方
        }
        if (tbY < 10)
            tbY = 10;
        floatToolbar.style.left = `${tbX}px`;
        floatToolbar.style.top = `${tbY}px`;
        floatToolbar.style.display = 'flex';
        setTimeout(() => floatToolbar.classList.add('show'), 50);
    }
    else {
        // 未拖动直接点击，隐藏工具栏并重置
        floatToolbar.classList.remove('show');
        setTimeout(() => floatToolbar.style.display = 'none', 200);
        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;
        selectedArea = null;
        draw();
    }
});
// Keyboard events (ESC to cancel)
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        cancel();
    }
});
// Right click to cancel
canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    cancel();
});
// 绑定工具栏按钮点击事件
document.getElementById('btnExplain')?.addEventListener('click', () => triggerAction('explain'));
document.getElementById('btnTranslate')?.addEventListener('click', () => triggerAction('translate'));
document.getElementById('btnOcr')?.addEventListener('click', () => triggerAction('ocr'));
document.getElementById('btnSend')?.addEventListener('click', () => triggerAction('send'));
document.getElementById('btnCancel')?.addEventListener('click', () => cancel());
function triggerAction(action) {
    if (!selectedArea)
        return;
    const { x, y, w, h } = selectedArea;
    // 在内存画板进行裁剪
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(bgImage, x, y, w, h, 0, 0, w, h);
    const croppedDataUrl = cropCanvas.toDataURL('image/png');
    // 带上动作特征回传给主窗口，例如 { dataUrl, action }
    window.openClaw.system.finishScreenCapture({ dataUrl: croppedDataUrl, action });
}
function cancel() {
    window.openClaw.system.finishScreenCapture({ dataUrl: null, action: 'cancel' });
}
