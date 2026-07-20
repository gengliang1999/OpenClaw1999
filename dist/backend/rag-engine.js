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
    // 智能标点截断辅助方法：在指定目标长度附近寻找最合适的标点符号分割点
    findSmartBoundary(text, targetLength) {
        if (text.length <= targetLength)
            return text.length;
        const delimiters = ['\n\n', '\n', '。', '！', '？', '.', '!', '?'];
        for (const delim of delimiters) {
            const idx = text.lastIndexOf(delim, targetLength);
            if (idx > targetLength * 0.4) {
                return idx + delim.length;
            }
        }
        return targetLength;
    }
    // 1. 滑动窗口分块存入 (支持直接传入父子分块，或基于标点断句的智能父子切片)
    addDocument(convId, fileName, data) {
        if (Array.isArray(data)) {
            for (const c of data) {
                this.chunks.push({
                    convId,
                    fileName,
                    text: c.childContent || c.text || '',
                    bigrams: this.getBigrams(c.childContent || c.text || ''),
                    parentText: c.parentContent
                });
            }
        }
        else {
            let cursor = 0;
            const parentTargetSize = 800;
            const childTargetSize = 250;
            const childOverlap = 50;
            while (cursor < data.length) {
                const parentLen = this.findSmartBoundary(data.slice(cursor), parentTargetSize);
                const parentContent = data.slice(cursor, cursor + parentLen);
                // 在父块内进一步切分为子块
                let childCursor = 0;
                while (childCursor < parentContent.length) {
                    const childLen = this.findSmartBoundary(parentContent.slice(childCursor), childTargetSize);
                    const childContent = parentContent.slice(childCursor, childCursor + childLen);
                    if (childContent.trim().length > 0) {
                        this.chunks.push({
                            convId,
                            fileName,
                            text: childContent,
                            bigrams: this.getBigrams(childContent),
                            parentText: parentContent
                        });
                    }
                    if (childCursor + childLen >= parentContent.length)
                        break;
                    childCursor += Math.max(1, childLen - childOverlap);
                }
                cursor += parentLen;
            }
        }
    }
    // 2. 检索并计算 Jaccard 相似度归一化评分
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
            if (matchCount === 0)
                return { chunk, score: 0 };
            // Jaccard 归一化评分 = 匹配项 / 并集大小
            const unionSize = queryBigrams.size + chunk.bigrams.size - matchCount;
            const jaccardScore = unionSize > 0 ? matchCount / unionSize : 0;
            // 结合召回率得分权重
            const recallScore = matchCount / queryBigrams.size;
            const finalScore = Number((jaccardScore * 0.6 + recallScore * 0.4).toFixed(4));
            return { chunk, score: finalScore };
        })
            .filter(c => c.score >= 0.05) // 过滤无意义的杂音分块
            .sort((a, b) => b.score - a.score);
        return scoredChunks.slice(0, topK).map(c => ({
            fileName: c.chunk.fileName,
            chunkText: c.chunk.parentText || c.chunk.text, // 优先使用父分块的大段上下文，解决断章取义问题
            score: c.score
        }));
    }
    // 3. 清理指定会话的知识库
    clearForConversation(convId) {
        this.chunks = this.chunks.filter(c => c.convId !== convId);
    }
}
exports.ragEngine = new RagEngine();
