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
exports.KnowledgePump = void 0;
/**
 * 知识蒸馏泵 (Nightly Knowledge Pump)
 * 挂载至后台的定时采集源探针。爬取到的内容自动推入 IngestionQueueManager 队列进行隔离鉴伪提炼。
 */
const timers_1 = require("timers");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class KnowledgePump {
    modelManager;
    vectorStore;
    baseDataDir;
    queueManager;
    isRunning = false;
    constructor(modelManager, vectorStore, baseDataDir, queueManager) {
        this.modelManager = modelManager;
        this.vectorStore = vectorStore;
        this.baseDataDir = baseDataDir;
        this.queueManager = queueManager;
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('[Knowledge Pump] 🛡️ 知识蒸馏巡逻泵已启动，已挂载至队列管理器...');
        // 定时触发自律巡逻 (每 6 小时扫描一次，自动压入队列)
        (0, timers_1.setInterval)(() => {
            this.pump();
        }, 6 * 60 * 60 * 1000);
    }
    /**
     * 触发自律扫描并将任务推送给队列
     */
    async pump() {
        console.log('[Knowledge Pump] 📡 开始扫描 settings.json 载入的自定义采集白名单...');
        let urls = ['https://news.ycombinator.com/']; // 默认兜底站
        const settingsPath = path.join(this.baseDataDir, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            try {
                const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                if (settings.crawlingSources && Array.isArray(settings.crawlingSources) && settings.crawlingSources.length > 0) {
                    urls = settings.crawlingSources;
                }
            }
            catch (e) {
                console.error('[Knowledge Pump] 读取 settings.json 失败，采用默认源:', e.message);
            }
        }
        for (const url of urls) {
            try {
                console.log(`[Knowledge Pump] 📡 正在将自律采集源推送至提炼队列: ${url}`);
                this.queueManager.addTask('url', url, url, 'system-auto-pump');
            }
            catch (err) {
                console.error(`[Knowledge Pump] 采集源 ${url} 推送至队列失败:`, err.message);
            }
        }
    }
}
exports.KnowledgePump = KnowledgePump;
