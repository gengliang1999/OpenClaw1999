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
exports.DataCrawler = void 0;
const cheerio = __importStar(require("cheerio"));
class DataCrawler {
    /**
     * 抓取 URL 内容，并使用 cheerio 清洗出网页干净的文本内容
     * @param url - 目标网址
     * @returns 过滤出的纯文本正文
     */
    static async crawlUrl(url) {
        const fetchFn = globalThis.fetch || require('node-fetch');
        const response = await fetchFn(url, { signal: AbortSignal.timeout(5000) });
        if (!response.ok) {
            throw new Error(`HTTP 抓取失败，状态码: ${response.status}`);
        }
        const html = await response.text();
        const $ = cheerio.load(html);
        const paragraphs = [];
        $('p').each((i, el) => {
            if (i < 30) { // 限制初筛前 30 个段落，防止侧边栏杂音
                const txt = $(el).text().trim();
                if (txt.length > 10)
                    paragraphs.push(txt);
            }
        });
        const rawText = paragraphs.join('\n');
        if (!rawText || rawText.trim().length < 20) {
            throw new Error('提取到的有效正文字数过短（小于 20 字），可能被防爬拦截或内容为空');
        }
        return rawText;
    }
}
exports.DataCrawler = DataCrawler;
