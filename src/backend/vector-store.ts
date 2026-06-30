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
   * 相似度搜索
   */
  async search(queryEmbedding: number[], topK: number = 3): Promise<Array<{doc: VectorDocument, score: number}>> {
    const results = this.documents.map(doc => ({
      doc,
      score: this.cosineSimilarity(queryEmbedding, doc.embedding)
    }));

    // 降序排序，取最高相似度的几个切片
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }
}
