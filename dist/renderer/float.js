"use strict";
const ball = document.getElementById('ball');
const logoBtn = document.getElementById('logoBtn');
const appContainer = document.getElementById('appContainer');
const quickPanel = document.getElementById('quickPanel');
const quickInput = document.getElementById('quickInput');
const closePanelBtn = document.getElementById('closePanelBtn');
const quickCaptureBtn = document.getElementById('quickCaptureBtn');
const openMainBtn = document.getElementById('openMainBtn');
let sideState = 'none'; // 'left' | 'right' | 'none'
let isExpanded = false;
// 缓存窗口最初始的定位尺寸与位置，以便折叠时精确还原
let collapsedBounds = { width: 60, height: 60, x: 0, y: 0 };
// 1. 监听主进程的贴边磁吸状态广播
if (window.openClaw && window.openClaw.system && window.openClaw.system.onFloatStatus) {
    window.openClaw.system.onFloatStatus((side) => {
        sideState = side;
        // 更新容器的 CSS 类控制贴边半隐藏隐藏
        appContainer.className = `app-container side-${side}`;
    });
}
// 2. 拖拽控制与防误触逻辑
let floatStartX = 0;
let floatStartY = 0;
let isMoving = false;
logoBtn.addEventListener('pointerdown', (e) => {
    logoBtn.setPointerCapture(e.pointerId);
    floatStartX = e.screenX;
    floatStartY = e.screenY;
    isMoving = false;
    if (window.openClaw && window.openClaw.system && window.openClaw.system.dragStartFloat) {
        window.openClaw.system.dragStartFloat();
    }
});
// 拦截原生右键菜单，防止在按住右键拖拽时弹出丑陋的浏览器菜单
window.addEventListener('contextmenu', (e) => e.preventDefault());
logoBtn.addEventListener('pointermove', (e) => {
    if (logoBtn.hasPointerCapture(e.pointerId)) {
        if (e.buttons === 1 || e.buttons === 2) {
            const dist = Math.sqrt(Math.pow(e.screenX - floatStartX, 2) + Math.pow(e.screenY - floatStartY, 2));
            if (dist > 5) {
                isMoving = true;
                if (window.openClaw && window.openClaw.system && window.openClaw.system.moveFloatBy) {
                    window.openClaw.system.moveFloatBy(e.movementX, e.movementY);
                }
            }
        }
    }
});
logoBtn.addEventListener('pointerup', (e) => {
    if (logoBtn.hasPointerCapture(e.pointerId)) {
        logoBtn.releasePointerCapture(e.pointerId);
    }
    if (window.openClaw && window.openClaw.system && window.openClaw.system.dragEndFloat) {
        window.openClaw.system.dragEndFloat();
    }
    if (isMoving) {
        isMoving = false;
        return;
    }
    toggleQuickMenu();
});
// 新增悬浮球双击直接唤起主界面逻辑
logoBtn.addEventListener('dblclick', () => {
    if (window.openClaw && window.openClaw.system && window.openClaw.system.toggleMain) {
        window.openClaw.system.toggleMain();
    }
});
// 3. 动态展开与折叠快捷菜单
function toggleQuickMenu() {
    if (isExpanded) {
        collapseMenu();
    }
    else {
        expandMenu();
    }
}
function expandMenu() {
    if (isExpanded)
        return;
    isExpanded = true;
    // 记录折叠时的位置，用于回退
    const curX = window.screenX;
    const curY = window.screenY;
    collapsedBounds = { width: 60, height: 60, x: curX, y: curY };
    // 展开后新窗口大小为 340x220
    const expandW = 340;
    const expandH = 220;
    // 确定展开的方向与坐标：
    let targetX = curX;
    if (sideState === 'right') {
        // 吸附在右边时，窗口必须往左平移，把小球撑在最右边，面板在左边展示
        targetX = curX - (expandW - 60);
    }
    // 将小球固定定位
    if (sideState === 'left') {
        ball.style.left = '5px';
        ball.style.right = 'auto';
    }
    else if (sideState === 'right') {
        ball.style.right = '5px';
        ball.style.left = 'auto';
    }
    // 1. 调用主进程 resizeFloat 放大窗口尺寸与调整位置
    if (window.openClaw && window.openClaw.system && window.openClaw.system.resizeFloat) {
        window.openClaw.system.resizeFloat({
            width: expandW,
            height: expandH,
            x: targetX,
            y: curY - 60 // 稍微往上提一点以防被边缘挤掉
        });
    }
    // 2. 显示面板
    quickPanel.style.display = 'flex';
    setTimeout(() => {
        quickInput.focus();
    }, 100);
}
function collapseMenu() {
    if (!isExpanded)
        return;
    isExpanded = false;
    // 1. 隐藏面板
    quickPanel.style.display = 'none';
    // 2. 还原小球位置样式
    if (sideState === 'left') {
        ball.style.left = '-24px';
    }
    else if (sideState === 'right') {
        ball.style.right = '-24px';
    }
    // 3. 调用主进程还原窗口 60x60 大小与坐标
    if (window.openClaw && window.openClaw.system && window.openClaw.system.resizeFloat) {
        window.openClaw.system.resizeFloat({
            width: 60,
            height: 60,
            x: sideState === 'right' ? collapsedBounds.x + (340 - 60) : collapsedBounds.x,
            y: collapsedBounds.y + 60
        });
    }
}
// 点击面板上的关闭按钮
closePanelBtn.addEventListener('click', collapseMenu);
// 点击打开主面板
openMainBtn.addEventListener('click', () => {
    collapseMenu();
    if (window.openClaw && window.openClaw.system && window.openClaw.system.toggleMain) {
        window.openClaw.system.toggleMain();
    }
});
// 点击截图识屏
quickCaptureBtn.addEventListener('click', () => {
    collapseMenu();
    if (window.openClaw && window.openClaw.system && window.openClaw.system.captureScreenArea) {
        // 隐藏悬浮球自己以免被截进图中
        if (window.openClaw.system.hide) {
            window.openClaw.system.hide();
        }
        setTimeout(async () => {
            // 弹出截图画板，在截图释放松开时，自动把图片传回给主窗口处理
            const resultObj = await window.openClaw.system.captureScreenArea();
            if (window.openClaw.system.show) {
                window.openClaw.system.show();
            }
            // 如果有结果，并且大窗口当前隐藏，自动打开大窗口去展示/处理
            if (resultObj && resultObj.dataUrl) {
                if (window.openClaw.system.show) {
                    window.openClaw.system.show(); // 强制展示主窗口
                }
            }
        }, 150);
    }
});
// 原地输入框 Enter 发送 AI 快捷会话
quickInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const text = quickInput.value.trim();
        if (!text)
            return;
        // 跨进程发送给主窗口，主窗口会自动聚焦发送
        if (window.openClaw && window.openClaw.system && window.openClaw.system.sendQuickPrompt) {
            window.openClaw.system.sendQuickPrompt(text);
            quickInput.value = '';
            collapseMenu();
        }
    }
});
