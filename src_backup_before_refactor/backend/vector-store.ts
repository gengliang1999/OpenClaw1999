/**
 * 纯 TypeScript 实现的轻量级向量存储引擎 (In-Memory)
 * 遵循非阻塞与防腐红线：采用原子重命名实现持久化，杜绝采用 C++ 编译的底层库导致系统不稳定。
 */
import fs from 'fs/promises';
import path from 'path';

export interface VectorDocument {
  id: string;
  content: string;
  metadata?: Record<string, any>;
  embedding: number[];
}

export class VectorStore {
  private documents: VectorDocument[] = [];
  private dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * 初始化/加载存储
   */
  async load() {
    try {
      const data = await fs.readFile(this.dbPath, 'utf8');
      this.documents = JSON.parse(data);
    } catch (e) {
      this.documents = [];
    }
  }

  /**
   * 落盘持久化（采用原子重命名防止掉电数据损坏）
   */
  async save() {
    const tempPath = this.dbPath + '.tmp';
    await fs.writeFile(tempPath, JSON.stringify(this.documents), 'utf8');
    await fs.rename(tempPath, this.dbPath);
  }

  /**
   * 添加向量数据
   */
  async addDocuments(docs: VectorDocument[]) {
    this.documents.push(...docs);
    await this.save();
  }

  /**
   * 移除特定来源的文档
   */
  async removeBySource(sourceId: string) {
    this.documents = this.documents.filter(doc => doc.metadata?.source !== sourceId);
    await this.save();
  }

  /**
   * 计算余弦相似度 (Cosine Similarity)
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * 严谨的 BM25 算分核心机制 (基于文档库动态 IDF 计算)
   */
  private calculateBM25(doc: VectorDocument, keywords: string[], N: number, df: Record<string, number>, avgdl: number): number {
    if (keywords.length === 0 || avgdl === 0) return 0;
    const k1 = 1.5;
    const b = 0.75;
    const D = doc.content.length;
    let score = 0;

    for (const kw of keywords) {
      const nq = df[kw] || 0;
      if (nq === 0) continue;
      
      const idf = Math.log((N - nq + 0.5) / (nq + 0.5) + 1);
      
      // 计算词频 (简单实现：匹配出现次数)
      let fq = 0;
      let pos = doc.content.indexOf(kw);
      while (pos !== -1) {
        fq++;
        pos = doc.content.indexOf(kw, pos + 1);
      }
      
      if (fq > 0) {
        const numerator = fq * (k1 + 1);
        const denominator = fq + k1 * (1 - b + b * (D / avgdl));
        score += idf * (numerator / denominator);
      }
    }
    
    // 简单归一化映射到 [0, 1] 左右
    return score / (keywords.length * 3); 
  }

  /**
   * 混合相似度搜索 (Dense Vector + BM25)
   * @param queryEmbedding - 向量表征
   * @param queryText - 原始文本，用于双路召回补偿 (避免专有名词漏召回)
   * @param topK - 返回数量
   */
  async search(queryEmbedding: number[], queryText?: string, topK: number = 3): Promise<Array<{doc: VectorDocument, score: number}>> {
    let keywords: string[] = [];
    if (queryText) {
      // Jieba 等分词器较重，这里使用简易的 2-gram 结合单字切分作为基础倒排检索粒度
      const textOnly = queryText.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, '');
      const charArray = Array.from(textOnly);
      for (let i = 0; i < charArray.length; i++) {
        keywords.push(charArray[i]);
        if (i < charArray.length - 1) {
          keywords.push(charArray[i] + charArray[i+1]);
        }
      }
      keywords = Array.from(new Set(keywords)).filter(k => k.trim());
    }

    // 计算当前库的全局统计 (IDF 所需)
    const N = this.documents.length;
    let totalLen = 0;
    const df: Record<string, number> = {};
    
    for (const d of this.documents) {
      totalLen += d.content.length;
      for (const kw of keywords) {
        if (d.content.includes(kw)) {
          df[kw] = (df[kw] || 0) + 1;
        }
      }
    }
    const avgdl = N > 0 ? totalLen / N : 0;

    const results = this.documents.map(doc => {
      const vecScore = this.cosineSimilarity(queryEmbedding, doc.embedding);
      const bm25Score = this.calculateBM25(doc, keywords, N, df, avgdl);
      
      // BM25 和 Cosine 都是分数，进行 RRF (Reciprocal Rank Fusion) 或简单的加权融合
      // 此处因性能考量采用线性加权：语义占60%，精确匹配占40%
      const finalScore = (vecScore * 0.6) + (bm25Score * 0.4);
      
      return {
        doc,
        score: finalScore,
        vecScore, // 保留用于调试
        bm25Score
      };
    });

    // 降序排序，取最高相似度的几个切片
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
