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
// Mouse events
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0)
        return; // Only left click
    isDrawing = true;
    startX = e.clientX;
    startY = e.clientY;
    currentX = e.clientX;
    currentY = e.clientY;
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
        cropAndSend(x, y, w, h);
    }
    else {
        // Clicked without dragging, reset
        startX = 0;
        startY = 0;
        currentX = 0;
        currentY = 0;
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
function cropAndSend(x, y, w, h) {
    // Create an off-screen canvas to crop the image
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = w;
    cropCanvas.height = h;
    const cropCtx = cropCanvas.getContext('2d');
    cropCtx.drawImage(bgImage, x, y, w, h, 0, 0, w, h);
    const croppedDataUrl = cropCanvas.toDataURL('image/png');
    window.openClaw.system.finishScreenCapture(croppedDataUrl);
}
function cancel() {
    window.openClaw.system.finishScreenCapture(null);
}
