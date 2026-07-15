"use strict";
/**
 * OpenClaw 智能助手 - Electron 主进程
 * 负责创建主窗口、启动本地 API 服务器、注册 IPC 通信处理器
 */
Object.defineProperty(exports, "__esModule", { value: true });
const { app, BrowserWindow, ipcMain, shell, dialog, Menu, protocol, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
// [P0 缓存崩溃防御] 强行禁用 GPU 和 Disk Cache，并将 UserData 挂载到安全目录
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
const userDataPath = path.join(os.homedir(), '.openclaw', 'app-data');
app.setPath('userData', userDataPath);
// 生成防本地攻击的安全随机 Token (保持前端向下兼容)
const nodeCrypto = require('crypto');
const apiToken = nodeCrypto.randomBytes(32).toString('hex');
process.env.OPENCLAW_API_TOKEN = apiToken;
// [P1/I6] 日志脱敏工具（与后端共享模块，避免密钥/敏感路径明文落盘）
const { redactForLog } = require('../backend/security-utils');
// 注册自定义协议特权 scheme，保障本地静态文件同源 ES Modules 安全加载
protocol.registerSchemesAsPrivileged([
    {
        scheme: 'claw',
        privileges: {
            secure: true,
            standard: true,
            supportFetchAPI: true,
            corsEnabled: true,
            stream: true,
        }
    }
]);
let mainWindow = null;
let floatWindow = null;
let activeFolderWatcher = null;
let activeJobWorker = null;
// [P0 单例锁防御] 避免多实例启动导致端口冲突与资源占用
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
    process.exit(0);
}
else {
    app.on('second-instance', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });
}
/**
 * 创建主窗口
 */
function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 900,
        minHeight: 600,
        title: 'OpenClaw 智能助手',
        frame: true,
        backgroundColor: '#0a0a1a',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            webSecurity: true,
            allowRunningInsecureContent: false,
        },
        show: false,
        autoHideMenuBar: true,
    });
    mainWindow.setMenu(null);
    // 通过原生自定义安全协议加载本地页面（支持同源 ES Module，消除网络端口依赖与 CORS 问题）
    mainWindow.loadURL('claw://app/index.html');
    // 窗口准备好后再显示，避免闪烁
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    // [自愈按键守卫] 挂载开发期热键监听，实现 F5/Ctrl+R 重新加载、F12/Ctrl+Shift+I 唤起控制台
    mainWindow.webContents.on('before-input-event', (event, input) => {
        if ((input.control && input.key.toLowerCase() === 'r') || input.key === 'F5') {
            mainWindow.webContents.reload();
            event.preventDefault();
        }
        if ((input.control && input.shift && input.key.toLowerCase() === 'i') || input.key === 'F12') {
            mainWindow.webContents.toggleDevTools();
            event.preventDefault();
        }
    });
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        console.log(`[RENDERER] ${message} (${sourceId}:${line})`);
    });
    // 窗口关闭事件
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    // 阻止新窗口打开，改用系统浏览器（强制实施 URL 安全强拦截）
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                shell.openExternal(url);
            }
            else {
                console.warn(`[安全拦截] 拦截到新窗口打开非安全协议链接: ${url}`);
            }
        }
        catch (e) {
            console.warn(`[安全拦截] 非法的新窗口 URL: ${url}`);
        }
        return { action: 'deny' };
    });
    // 开发模式下打开开发者工具
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}
/**
 * 创建系统级常驻悬浮球窗口
 */
function createFloatWindow() {
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    floatWindow = new BrowserWindow({
        width: 60,
        height: 60,
        x: screenWidth - 80,
        y: screenHeight / 2 - 30,
        type: 'toolbar', // 避免在 Windows 任务栏显示
        frame: false,
        transparent: true,
        backgroundColor: '#00000000', // 强制透明消除底纹
        hasShadow: false, // 取消原生阴影消除黑边
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            webSecurity: true
        }
    });
    floatWindow.loadURL('claw://app/float.html');
    floatWindow.once('ready-to-show', () => {
        floatWindow.show();
    });
    // 自动贴边磁吸吸附机制（防止遮挡工作区，拖拽停止 300ms 后吸附）
    let snapTimer = null;
    let isDragging = false;
    ipcMain.on('float:drag-start', () => { isDragging = true; });
    ipcMain.on('float:drag-end', () => {
        isDragging = false;
        if (floatWindow && !floatWindow.isDestroyed()) {
            floatWindow.emit('move'); // 触发归位
        }
    });
    floatWindow.on('move', () => {
        if (snapTimer)
            clearTimeout(snapTimer);
        snapTimer = setTimeout(() => {
            if (!floatWindow || floatWindow.isDestroyed())
                return;
            if (isDragging)
                return; // 正在拖拽时绝对禁止系统抢夺焦点并强制归位
            const [x, y] = floatWindow.getPosition();
            const [w, h] = floatWindow.getSize();
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width: sW, height: sH } = primaryDisplay.workAreaSize;
            let targetX = x;
            if (x < 80) {
                targetX = 0; // 吸附左侧
            }
            else if (x > sW - w - 80) {
                targetX = sW - w; // 吸附右侧
            }
            let targetY = Math.max(10, Math.min(sH - h - 10, y));
            let side = 'none';
            if (targetX === 0) {
                side = 'left';
            }
            else if (targetX === sW - w) {
                side = 'right';
            }
            floatWindow.webContents.send('float:status', side);
            if (targetX !== x || targetY !== y) {
                floatWindow.setPosition(targetX, targetY, true);
            }
        }, 300);
    });
    // 支持悬浮窗自适应动态拉伸（菜单展开与收回）
    ipcMain.on('float:resize', (event, { width, height, x, y }) => {
        if (floatWindow && !floatWindow.isDestroyed()) {
            floatWindow.setBounds({ x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) }, true);
        }
    });
    // 支持前端基于鼠标偏移量的原生级拖动 (取代容易引发闪屏的绝对定位)
    ipcMain.on('float:move-by', (event, dx, dy) => {
        if (floatWindow && !floatWindow.isDestroyed()) {
            const [x, y] = floatWindow.getPosition();
            floatWindow.setPosition(x + dx, y + dy, false);
        }
    });
    floatWindow.on('closed', () => {
        floatWindow = null;
    });
}
/**
 * 注册 IPC 通信处理器
 */
function registerIpcHandlers() {
    // 同步获取 API Token
    ipcMain.on('system:getApiToken', (event) => {
        const senderUrl = event.sender.getURL();
        if (senderUrl.startsWith('claw://') || senderUrl.startsWith('file:///')) {
            event.returnValue = apiToken;
        }
        else {
            event.returnValue = null;
        }
    });
    // 系统信息
    ipcMain.handle('system:getInfo', () => {
        return {
            platform: process.platform,
            arch: process.arch,
            version: app.getVersion(),
            appPath: app.getPath('userData'),
            electronVersion: process.versions.electron,
            nodeVersion: process.versions.node,
        };
    });
    // 打开外部链接
    ipcMain.handle('system:openExternal', (_, url) => {
        try {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                return shell.openExternal(url);
            }
            console.warn(`[安全拦截] 拦截到非安全协议的外部链接打开请求: ${url}`);
            return Promise.reject(new Error('仅允许打开 http/https 链接'));
        }
        catch (e) {
            console.warn(`[安全拦截] 非法的外部链接格式: ${url}`);
            return Promise.reject(new Error('无效的 URL 格式'));
        }
    });
    // 选择文件
    ipcMain.handle('system:selectFile', async (_, options) => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openFile'],
            filters: options?.filters || [],
        });
        return result.canceled ? null : result.filePaths[0];
    });
    // 选择目录
    ipcMain.handle('system:selectDirectory', async () => {
        const result = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory'],
        });
        return result.canceled ? null : result.filePaths[0];
    });
    // 窗口控制
    ipcMain.handle('window:minimize', () => mainWindow?.minimize());
    ipcMain.handle('window:hide', () => mainWindow?.hide());
    ipcMain.handle('window:show', () => mainWindow?.show());
    ipcMain.handle('window:maximize', () => {
        if (mainWindow?.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow?.maximize();
        }
    });
    ipcMain.handle('window:close', () => mainWindow?.close());
    ipcMain.handle('window:toggleMain', () => {
        if (!mainWindow)
            return;
        if (mainWindow.isVisible()) {
            mainWindow.hide();
        }
        else {
            mainWindow.show();
            mainWindow.focus();
        }
    });
    // 重启应用
    ipcMain.handle('app:restart', () => {
        cleanupBackgroundServices();
        app.relaunch();
        app.exit(0);
    });
    // 截屏所需的方法
    ipcMain.handle('system:getScreenCapture', async () => {
        const { desktopCapturer, screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width, height } = primaryDisplay.size;
        const scaleFactor = primaryDisplay.scaleFactor;
        // 获取屏幕的完整截图
        const sources = await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: width * scaleFactor, height: height * scaleFactor }
        });
        if (sources.length > 0) {
            return sources[0].thumbnail.toDataURL();
        }
        return null;
    });
    // 跨窗口快捷提问 IPC 转发
    ipcMain.on('quick-prompt:send', (event, text) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('quick-prompt:received', text);
        }
    });
    let captureWin = null;
    function initCaptureWin() {
        if (captureWin)
            return;
        const { BrowserWindow, screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        captureWin = new BrowserWindow({
            x: primaryDisplay.bounds.x,
            y: primaryDisplay.bounds.y,
            width: primaryDisplay.bounds.width,
            height: primaryDisplay.bounds.height,
            transparent: true,
            frame: false,
            fullscreen: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            autoHideMenuBar: true,
            resizable: false,
            movable: false,
            show: false,
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true
            }
        });
        captureWin.loadURL('claw://app/screenshot.html');
    }
    // 初始化隐藏的截屏窗口
    app.whenReady().then(initCaptureWin);
    // 区域截图
    ipcMain.handle('system:captureScreenArea', async () => {
        return new Promise(async (resolve) => {
            const { ipcMain: ipc, desktopCapturer, screen } = require('electron');
            const primaryDisplay = screen.getPrimaryDisplay();
            const { width, height } = primaryDisplay.size;
            const scaleFactor = primaryDisplay.scaleFactor;
            // 在 mainWindow 被完全隐藏后再抓取屏幕（这里已经隐藏完毕）
            const sources = await desktopCapturer.getSources({
                types: ['screen'],
                thumbnailSize: { width: width, height: height } // 移除 scaleFactor 以大幅加快底层 C++ 捕捉速度
            });
            let dataUrl = null;
            if (sources.length > 0) {
                // 使用 JPEG 编码代替默认的 PNG(toDataURL)，大幅减少压缩和转换时间
                const buffer = sources[0].thumbnail.toJPEG(100);
                dataUrl = 'data:image/jpeg;base64,' + buffer.toString('base64');
            }
            if (!dataUrl)
                return resolve(null);
            if (!captureWin)
                initCaptureWin();
            captureWin.webContents.send('screenshot:start', dataUrl);
            captureWin.show();
            const onDone = (event, resultUrl) => {
                resolve(resultUrl);
                ipc.removeListener('system:captureScreenArea-done', onDone);
                if (captureWin && !captureWin.isDestroyed()) {
                    captureWin.hide();
                }
            };
            ipc.once('system:captureScreenArea-done', onDone);
        });
    });
}
// 应用准备就绪
app.whenReady().then(async () => {
    // 1. 注册 claw 自定义安全协议的本地文件加载拦截处理器
    protocol.handle('claw', (request) => {
        const url = request.url;
        const parsedPath = url.replace('claw://app/', '');
        // assets/ 前缀的资源存放在 dist/assets/ 而非 dist/renderer/assets/
        let filePath;
        if (parsedPath.startsWith('assets/')) {
            filePath = path.join(__dirname, '..', parsedPath);
        }
        else {
            filePath = path.join(__dirname, '..', 'renderer', parsedPath || 'index.html');
        }
        const { net } = require('electron');
        const pathToFile = path.normalize(filePath);
        // [P0/T1] 目录穿越防护：仅允许访问 dist 渲染目录，拒绝 .. 越权路径
        const allowedRoot = path.resolve(__dirname, '..');
        const resolved = path.resolve(pathToFile);
        if (resolved !== allowedRoot && !resolved.startsWith(allowedRoot + path.sep)) {
            console.warn(`[安全拦截] 拒绝访问越权路径: ${request.url}`);
            return new Response('Forbidden', { status: 403 });
        }
        return net.fetch(`file://${pathToFile}`);
    });
    const template = [
        {
            label: '编辑',
            submenu: [
                { label: '撤销', role: 'undo' },
                { label: '重做', role: 'redo' },
                { type: 'separator' },
                { label: '剪切', role: 'cut' },
                { label: '复制', role: 'copy' },
                { label: '粘贴', role: 'paste' },
                { label: '全选', role: 'selectall' }
            ]
        }
    ];
    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
    registerIpcHandlers();
    // 2. 初始化本地数据目录与后端业务实例 (零 TCP 端口监听，全内存数据流转)
    const os = require('os');
    const isMac = process.platform === 'darwin';
    const baseDataDir = path.join(process.env.APPDATA || (isMac ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config')), 'OpenClawAssistant');
    if (!fs.existsSync(baseDataDir)) {
        fs.mkdirSync(baseDataDir, { recursive: true });
    }
    let dataDir = baseDataDir;
    let downloadDir = baseDataDir;
    let logDir = path.join(baseDataDir, 'logs');
    let customMemoryDbPath = null;
    const globalConfigPath = path.join(baseDataDir, 'global-config.json');
    if (fs.existsSync(globalConfigPath)) {
        try {
            const globalConfig = JSON.parse(fs.readFileSync(globalConfigPath, 'utf8'));
            if (globalConfig.customDataDir && fs.existsSync(globalConfig.customDataDir)) {
                dataDir = globalConfig.customDataDir;
            }
            if (globalConfig.customDownloadDir) {
                downloadDir = globalConfig.customDownloadDir;
                if (!fs.existsSync(downloadDir)) {
                    fs.mkdirSync(downloadDir, { recursive: true });
                }
            }
            if (globalConfig.customLogDir) {
                logDir = globalConfig.customLogDir;
            }
            if (globalConfig.customMemoryDbPath) {
                customMemoryDbPath = globalConfig.customMemoryDbPath;
            }
        }
        catch (e) {
            console.error('[主进程] 加载 global-config 失败', e);
        }
    }
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    // 重定向 console.log 到物理日志文件（落盘前脱敏敏感字段，终端输出保持原文）
    const logFilePath = path.join(logDir, 'openclaw.log');
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    console.log = function (...args) {
        originalConsoleLog(...args);
        try {
            const line = `[INFO] ${new Date().toISOString()} ${args.join(' ')}`;
            fs.appendFileSync(logFilePath, redactForLog(line) + '\n', 'utf8');
        }
        catch (e) { }
    };
    console.error = function (...args) {
        originalConsoleError(...args);
        try {
            const line = `[ERROR] ${new Date().toISOString()} ${args.join(' ')}`;
            fs.appendFileSync(logFilePath, redactForLog(line) + '\n', 'utf8');
        }
        catch (e) { }
    };
    const { ModelManager } = require('../backend/model-manager');
    const { MemoryStore } = require('../backend/memory-store');
    const { SandboxExecutor } = require('../backend/sandbox');
    const { PermissionManager } = require('../backend/permission-manager');
    const { AutomationController } = require('../backend/automation');
    const modelManager = new ModelManager(dataDir);
    const memoryStore = new MemoryStore(dataDir, customMemoryDbPath);
    const sandbox = new SandboxExecutor(downloadDir);
    const permissionManager = new PermissionManager(dataDir);
    const automation = new AutomationController(sandbox);
    await memoryStore.init();
    // 自适应映射向量数据库同名同目录路径，保证中文命名及自定义路径绑定一致性
    let memoriesVectorsPath = path.join(memoryStore.dataDir, 'memories_vectors.json');
    if (customMemoryDbPath) {
        const dbDir = path.dirname(customMemoryDbPath);
        const dbName = path.basename(customMemoryDbPath, path.extname(customMemoryDbPath));
        memoriesVectorsPath = path.join(dbDir, `${dbName}_vectors.json`);
    }
    console.log('[主进程] 绑定长期记忆向量库物理路径为:', memoriesVectorsPath);
    console.log('[主进程] 本地数据库与后端核心业务模块初始化成功。');
    // 初始化持久化任务队列与后台任务守护进程
    const { PersistentJobQueue } = require('../backend/persistent-job-queue');
    const { BackgroundJobWorker } = require('../backend/background-job-worker');
    const { MemoryEngine } = require('../backend/memory-engine');
    const jobQueue = new PersistentJobQueue(memoryStore);
    const jobWorker = new BackgroundJobWorker(jobQueue, memoryStore);
    const memoryEngine = new MemoryEngine(modelManager, memoryStore, memoryStore.dataDir);
    // 注册大模型异步记忆抽取任务处理器
    jobWorker.registerHandler('memory-extraction', async (payload) => {
        const { replyText } = payload;
        await memoryEngine.processMemoryExtractionAsync(replyText);
    });
    // 注册大模型记忆向量化异步提炼任务处理器
    const { VectorStore: LocalVectorStore } = require('../backend/vector-store');
    const { vectorDbManager } = require('../backend/vector-db-manager');
    jobWorker.registerHandler('memory-vectorization', async (payload) => {
        const { memoryId, content } = payload;
        // 锁外异步提取 Embedding，完美剥离网络 API 请求时间
        const embedding = await modelManager.getEmbedding(content);
        if (Array.isArray(embedding) && embedding.length > 0) {
            await vectorDbManager.executeWrite(memoriesVectorsPath, async (store) => {
                await store.addDocuments([{
                        id: require('crypto').randomUUID(),
                        content,
                        metadata: { source: content, memoryId, timestamp: new Date().toISOString() },
                        embedding
                    }], false); // 避免二次冗余落盘
            });
        }
        else {
            // 提炼失败，标记 pending 标签以防持久丢失，供后续自愈扫描
            memoryStore.tagMemory(memoryId, 'pending_vectorization');
            console.warn(`[主进程] 提炼记忆 Embedding 失败，已将记忆 ID ${memoryId} 标记为待补偿向量化`);
        }
    });
    // 注册大模型记忆向量化待补偿自愈任务处理器
    jobWorker.registerHandler('memory-vectorization-retry', async () => {
        console.log('[自愈 Worker] 🧠 开始扫描本地 SQLite 中待补偿向量化的盲区记忆...');
        try {
            const results = memoryStore.db.exec("SELECT * FROM memories WHERE tags LIKE '%pending_vectorization%'");
            const pendingMemories = memoryStore._parseResults(results);
            if (pendingMemories.length === 0) {
                console.log('[自愈 Worker] 🟢 未发现待补偿向量化的记忆');
                return;
            }
            console.log(`[自愈 Worker] ⏳ 发现 ${pendingMemories.length} 条待补偿记忆，开始逐条重试提取...`);
            for (const mem of pendingMemories) {
                try {
                    const embedding = await modelManager.getEmbedding(mem.content);
                    if (Array.isArray(embedding) && embedding.length > 0) {
                        await vectorDbManager.executeWrite(memoriesVectorsPath, async (store) => {
                            await store.addDocuments([{
                                    id: require('crypto').randomUUID(),
                                    content: mem.content,
                                    metadata: { source: mem.content, memoryId: mem.id, timestamp: new Date().toISOString() },
                                    embedding
                                }], false);
                        });
                        memoryStore.untagMemory(mem.id, 'pending_vectorization');
                        console.log(`[自愈 Worker] 🎉 记忆 ID ${mem.id} 补偿向量化成功，并已移去 SQLite 挂起标记`);
                    }
                }
                catch (e) {
                    console.warn(`[自愈 Worker] ⚠️ 记忆 ID ${mem.id} 补偿重试单条失败: ${e.message}`);
                }
            }
        }
        catch (err) {
            console.error('[自愈 Worker] 补偿向量化流程异常:', err.message);
        }
    });
    // 注册大模型记忆消重反刍任务处理器
    const { MemoryConsolidationPipeline } = require('../backend/memory-consolidation-pipeline');
    const consolidationPipeline = new MemoryConsolidationPipeline(modelManager, memoryStore);
    jobWorker.registerHandler('memory-consolidation', async () => {
        await consolidationPipeline.consolidate();
    });
    activeJobWorker = jobWorker;
    jobWorker.start();
    // 启动时投递一次记忆整理任务与向量化补偿自愈任务
    jobQueue.enqueue('memory-consolidation', {});
    jobQueue.enqueue('memory-vectorization-retry', {});
    // 每 2 小时自动向队列投递一次记忆消重整理任务
    setInterval(() => {
        try {
            jobQueue.enqueue('memory-consolidation', {});
        }
        catch (e) { }
    }, 2 * 60 * 60 * 1000);
    // 每 10 分钟自动投递一次向量化补偿自愈任务
    setInterval(() => {
        try {
            jobQueue.enqueue('memory-vectorization-retry', {});
        }
        catch (e) { }
    }, 10 * 60 * 1000);
    // 挂载并启动知识蒸馏泵 (Nightly Knowledge Pump)
    const { VectorStore } = require('../backend/vector-store');
    const vectorStore = new VectorStore(path.join(dataDir, 'vectors.json'));
    await vectorStore.load();
    const { IngestionQueueManager } = require('../backend/ingestion-queue');
    const queueManager = new IngestionQueueManager(modelManager, dataDir);
    const { KnowledgePump } = require('../backend/knowledge-pump');
    const knowledgePump = new KnowledgePump(modelManager, vectorStore, dataDir, queueManager);
    knowledgePump.start();
    // 加载本地被监控文件夹列表
    const settingsPath = path.join(dataDir, 'settings.json');
    let watchedFolders = [];
    if (fs.existsSync(settingsPath)) {
        try {
            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (settings.watchedFolders && Array.isArray(settings.watchedFolders)) {
                watchedFolders = settings.watchedFolders;
            }
        }
        catch (e) { }
    }
    const { FolderWatcherManager } = require('../backend/folder-watcher');
    const folderWatcher = new FolderWatcherManager(queueManager, dataDir);
    activeFolderWatcher = folderWatcher;
    folderWatcher.startWatching(watchedFolders);
    // 3. 注册全链路原生 IPC API 路由分发器，彻底替代 Express 路由
    const { registerApiIpc } = require('./ipc-handlers');
    registerApiIpc({
        memoryStore,
        modelManager,
        sandbox,
        permissionManager,
        automation,
        baseDataDir,
        globalConfigPath,
        dataDir,
        queueManager,
        folderWatcher,
        jobQueue
    }, () => mainWindow, apiToken);
    createMainWindow();
    createFloatWindow();
    // 注册全局截图快捷键
    globalShortcut.register('CommandOrControl+Shift+A', () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('shortcut:captureScreen');
        }
    });
    // macOS 点击 dock 图标重新创建窗口
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});
// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
function cleanupBackgroundServices() {
    try {
        const { openClawDaemon } = require('../backend/openclaw-daemon');
        openClawDaemon.stop(() => { });
    }
    catch (e) { }
    try {
        if (activeFolderWatcher) {
            activeFolderWatcher.stopWatching();
        }
    }
    catch (e) { }
    try {
        if (activeJobWorker) {
            activeJobWorker.stop();
        }
    }
    catch (e) { }
}
// 强退守卫：防止后台悬挂的 Job Worker / watch 句柄阻止 Electron 进程正常退出
app.on('before-quit', () => {
    try {
        globalShortcut.unregisterAll();
    }
    catch (e) { }
    cleanupBackgroundServices();
    process.exit(0);
});
