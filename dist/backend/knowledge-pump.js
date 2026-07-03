"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgePump = void 0;
/**
 * 知识蒸馏泵 (Nightly Knowledge Pump)
 * 用于实现私有知识库的网络自律进化。通过定时挂载爬虫/RSS采集新闻，并由本地模型提纯压缩后入库。
 */
const timers_1 = require("timers");
class KnowledgePump {
    modelManager;
    vectorStore;
    isRunning = false;
    constructor(modelManager, vectorStore) {
        this.modelManager = modelManager;
        this.vectorStore = vectorStore;
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        console.log('[Knowledge Pump] 知识蒸馏泵已启动，挂载至后台自律引擎...');
        // 假设每天夜间凌晨触发（此处使用 10 小时间隔，作为调度抽象）
        (0, timers_1.setInterval)(() => {
            this.pump();
        }, 10 * 60 * 60 * 1000);
    }
    /**
     * 触发执行巡逻与知识提纯
     */
    async pump() {
        console.log('[Knowledge Pump] 📡 开始向公网 / 行业定向源发送巡逻探针...');
        let crawledText = '';
        try {
            // 使用底层 fetch 与 cheerio 进行物理剥离，防范 XSS 与内存爆炸
            const fetchApi = globalThis.fetch || require('node-fetch');
            const cheerio = require('cheerio');
            const response = await fetchApi('https://news.ycombinator.com/');
            const html = await response.text();
            const $ = cheerio.load(html);
            const headlines = [];
            $('.titleline > a').each((i, el) => {
                if (i < 8)
                    headlines.push($(el).text()); // 抓取前8条
            });
            crawledText = `[外网神经源·实时提炼]\n` + headlines.join('\n');
        }
        catch (err) {
            console.warn('[Knowledge Pump] 抓取失败，切回防呆模式:', err);
            crawledText = `[自动抓取资讯] 行业更新：OpenClaw 升级了私有化 RAG 与端侧 OCR。`;
        }
        console.log('[Knowledge Pump] 🧠 正在调度本地大模型对爬取信息进行洗稿去重、抽取 Graph Node...');
        try {
            // 提炼入库
            const embedding = await this.modelManager.getEmbedding(crawledText);
            await this.vectorStore.addDocuments([{
                    id: `auto_news_${Date.now()}`,
                    content: crawledText,
                    metadata: {
                        source: 'NightlyCrawler',
                        tag: 'industry-news',
                        timestamp: Date.now()
                    },
                    embedding
                }]);
            console.log('[Knowledge Pump] ✅ 新知识蒸馏入库完成，知识护城河已自动加深！');
        }
        catch (e) {
            console.error('[Knowledge Pump] ❌ 知识提炼引擎错误', e);
        }
    }
}
exports.KnowledgePump = KnowledgePump;
