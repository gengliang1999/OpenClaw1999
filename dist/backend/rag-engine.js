"use strict";
/**
 * 本地轻量级 RAG 引擎 (Zero-Dependency)
 * 采用 Bi-gram 分词 + 词频相似度算法，完美支持中英文混排，替代无法在 sql.js 启用的 FTS5。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragEngine = void 0;
class RagEngine {
    chunks = [];
    // 获取文本的 Bi-gram (2-gram) 特征，自动转小写
    getBigrams(text) {
        const bigrams = new Set();
        const normalized = text.toLowerCase().replace(/\s+/g, '');
        if (normalized.length < 2) {
            if (normalized.length === 1)
                bigrams.add(normalized);
            return bigrams;
        }
        for (let i = 0; i < normalized.length - 1; i++) {
            bigrams.add(normalized.substring(i, i + 2));
        }
        return bigrams;
    }
    // 1. 滑动窗口分块存入
    addDocument(convId, fileName, text) {
        const chunkSize = 500;
        const overlap = 100;
        let i = 0;
        while (i < text.length) {
            const chunkText = text.slice(i, i + chunkSize);
            this.chunks.push({
                convId,
                fileName,
                text: chunkText,
                bigrams: this.getBigrams(chunkText)
            });
            i += (chunkSize - overlap);
        }
    }
    // 2. 检索并计算 Jaccard 相似度变形
    searchRelevant(convId, query, topK = 3) {
        const queryBigrams = this.getBigrams(query);
        if (queryBigrams.size === 0)
            return [];
        const scoredChunks = this.chunks
            .filter(c => c.convId === convId)
            .map(chunk => {
            let matchCount = 0;
            for (const qGram of queryBigrams) {
                if (chunk.bigrams.has(qGram)) {
                    matchCount++;
                }
            }
            // 简单打分：匹配的 bigram 数量
            return { chunk, score: matchCount };
        })
            .filter(c => c.score > 0)
            .sort((a, b) => b.score - a.score);
        return scoredChunks.slice(0, topK).map(c => ({
            fileName: c.chunk.fileName,
            chunkText: c.chunk.text,
            score: c.score
        }));
    }
    // 3. 清理指定会话的知识库
    clearForConversation(convId) {
        this.chunks = this.chunks.filter(c => c.convId !== convId);
    }
}
exports.ragEngine = new RagEngine();
