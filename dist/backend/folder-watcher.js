"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FolderWatcherManager = void 0;
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const chokidar = __importStar(require("chokidar"));
const document_parser_1 = require("./document-parser");
const vector_db_manager_1 = require("./vector-db-manager");
class FolderWatcherManager {
    queueManager;
    baseDataDir;
    watchers = new Map();
    constructor(queueManager, baseDataDir) {
        this.queueManager = queueManager;
        this.baseDataDir = baseDataDir;
    }
    /**
     * 启动监控
     * @param folders - 被监控的文件夹配置列表
     */
    startWatching(folders) {
        this.stopWatching(); // 清理旧的监控
        console.log(`[Watcher] 📡 正在启动本地文件夹自律同步监控（共 ${folders.length} 个监测点）...`);
        for (const config of folders) {
            if (!fs.existsSync(config.path)) {
                console.warn(`[Watcher] ⚠️ 监控路径不存在，跳过: ${config.path}`);
                continue;
            }
            console.log(`[Watcher] 👁️ 开启监控 ➜ 文件夹: "${config.path}" ➜ 分类库: "${config.category}"`);
            // 使用 chokidar 建立 recursive 监控，并支持 Unicode（中文路径）和写缓冲保护
            const watcher = chokidar.watch(config.path, {
                persistent: true,
                ignoreInitial: true, // 忽略首次加载历史，只监控增量变化
                awaitWriteFinish: {
                    stabilityThreshold: 2000, // 确保文件在 2 秒内不再被写入（拷贝完成）后才读取
                    pollInterval: 100
                },
                ignored: /(^|[\/\\])\../, // 忽略隐藏文件
                depth: 5 // 支持最多 5 层子目录递归
            });
            // 监听新增/修改事件
            watcher.on('add', (filePath) => this.handleFileAdded(filePath, config));
            watcher.on('change', (filePath) => this.handleFileChanged(filePath, config));
            // 监听删除事件
            watcher.on('unlink', (filePath) => this.handleFileDeleted(filePath, config));
            watcher.on('error', (err) => {
                console.error(`[Watcher] 监控错误 [${config.path}]:`, err.message);
            });
            this.watchers.set(config.path, watcher);
        }
    }
    /**
     * 停止所有监控
     */
    stopWatching() {
        for (const [path, watcher] of this.watchers.entries()) {
            watcher.close();
            console.log(`[Watcher] 🛑 已停止监控: ${path}`);
        }
        this.watchers.clear();
    }
    async handleFileAdded(filePath, config) {
        const ext = path.extname(filePath).slice(1).toLowerCase();
        const supportedExts = ['txt', 'md', 'docx', 'pptx', 'xlsx', 'odt', 'pdf', 'png', 'jpg', 'jpeg', 'webp'];
        if (!supportedExts.includes(ext)) {
            return; // 过滤不支持的垃圾后缀
        }
        const fileName = path.basename(filePath);
        console.log(`[Watcher] 📥 检测到文件拷入: "${fileName}"`);
        try {
            // 1. 同步解析文件正文
            const text = await this.extractFileText(filePath, ext);
            // 2. 推送提炼任务给 IngestionQueue 进行向量化和原始拷贝归档（默认设为 trusted，直接同步入主库）
            const trust = config.trustLevel || 'trusted';
            this.queueManager.addTask('text', text, fileName, 'system-auto-watcher', {
                filePath,
                category: config.category,
                trustLevel: trust
            });
            console.log(`[Watcher] 📡 成功将 "${fileName}" 压入 RAG 提炼队列`);
        }
        catch (err) {
            console.error(`[Watcher] 解析新增文件 "${fileName}" 失败:`, err.message);
        }
    }
    async handleFileChanged(filePath, config) {
        const fileName = path.basename(filePath);
        console.log(`[Watcher] 🔄 检测到文件修改: "${fileName}"，触发重新提炼...`);
        // 修改相当于：先删除旧的分块，再当作新文件导入
        await this.handleFileDeleted(filePath, config);
        await this.handleFileAdded(filePath, config);
    }
    async handleFileDeleted(filePath, config) {
        const fileName = path.basename(filePath);
        console.log(`[Watcher] 🗑️ 检测到文件删除: "${fileName}"，同步删除对应向量索引与物理源文件...`);
        try {
            const dbPath = path.join(this.baseDataDir, 'knowledge', `${config.category}.json`);
            // 使用统一并发写锁管理器来执行文件删除，避免并发冲突写穿
            await vector_db_manager_1.vectorDbManager.executeWrite(dbPath, async (store) => {
                await store.removeBySource(fileName);
            });
            console.log(`[Watcher] 🧹 成功清空向量库 ${config.category} 中关于 "${fileName}" 的所有切片索引`);
            // 物理删除 sources 目录下对应的原始物理备份文件
            const sourcePath = path.join(this.baseDataDir, 'knowledge', `${config.category}_sources`, fileName);
            if (fs.existsSync(sourcePath)) {
                fs.unlinkSync(sourcePath);
                console.log(`[Watcher] 🧹 物理归档备份文件已同步删除: ${sourcePath}`);
            }
        }
        catch (err) {
            console.error(`[Watcher] 删除同步失败 [${fileName}]:`, err.message);
        }
    }
    async extractFileText(filePath, ext) {
        const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'];
        if (imageExts.includes(ext)) {
            return await document_parser_1.DocumentParser.extractTextFromMultiModal(filePath, `image/${ext}`);
        }
        else if (ext === 'pdf') {
            return await document_parser_1.DocumentParser.extractTextFromMultiModal(filePath, 'application/pdf');
        }
        else {
            const officeExts = ['docx', 'pptx', 'xlsx', 'odt', 'odp', 'ods', 'rtf'];
            if (officeExts.includes(ext)) {
                const officeParser = require('officeparser');
                const parsedResult = await officeParser.parseOffice(filePath);
                return typeof parsedResult === 'string' ? parsedResult : parsedResult.toText();
            }
            else {
                return fs.readFileSync(filePath, 'utf8');
            }
        }
    }
}
exports.FolderWatcherManager = FolderWatcherManager;
