/**
 * 轻量级文档解析与分块器 (Chunker)
 * 纯 TypeScript 实现，用于将大篇幅文本安全地切割为便于 Embedding 的 Chunk。
 */

export interface Chunk {
  content: string;
  index: number;
}

export class DocumentParser {
  
  /**
   * 离线多模态解析管道 (ONNX PaddleOCR / PDF.js 架构桩代码)
   * 避免由于超大数据传给大型 VLM 导致的内存爆炸与机密外泄。
   */
  static async extractTextFromMultiModal(filePath: string, fileType: string): Promise<string> {
    const { Worker } = require('worker_threads');
    const path = require('path');
    
    return new Promise((resolve) => {
      // 在生产环境中 worker 文件被编译在 dist/backend 目录下
      // 当前文件路径为 dist/backend/document-parser.js
      const workerPath = path.join(__dirname, 'parser-worker.js');
      console.log(`[DocumentParser] 唤起独立解析线程: ${workerPath}`);
      const worker = new Worker(workerPath);
      const jobId = Date.now().toString() + Math.random().toString();

      worker.on('message', (msg) => {
        if (msg.jobId === jobId) {
          if (msg.success) {
            resolve(msg.text);
          } else {
            console.error('[DocumentParser] Worker 线程解析失败:', msg.error);
            resolve('');
          }
          worker.terminate();
        }
      });

      worker.on('error', (err) => {
        console.error('[DocumentParser] Worker 线程致命错误:', err);
        resolve('');
        worker.terminate();
      });

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[DocumentParser] Worker 线程异常退出, 退出码 ${code}`);
          resolve('');
        }
      });

      worker.postMessage({ filePath, fileType, jobId });
    });
  }

  /**
   * 将长文本切分为适合向量化的片段
   * @param text 原始文本
   * @param chunkSize 每个切片的最大字符数
   * @param chunkOverlap 重叠的字符数，防止语义被硬切断
   */
  static splitTextIntoChunks(text: string, chunkSize: number = 500, chunkOverlap: number = 50): Chunk[] {
    const chunks: Chunk[] = [];
    let currentIndex = 0;
    let chunkId = 0;

    // 清理连续的冗余空白字符与换行
    const cleanText = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');

    while (currentIndex < cleanText.length) {
      // 找到 chunkSize 左右合适的切分点
      let end = currentIndex + chunkSize;
      
      if (end >= cleanText.length) {
        end = cleanText.length;
      } else {
        // 尝试向前寻找标点符号换行点
        const fallbackEnd = end;
        while (end > currentIndex + chunkOverlap && !['\n', '。', '！', '？', '.', '!', '?'].includes(cleanText[end])) {
          end--;
        }
        if (end === currentIndex + chunkOverlap) {
          end = fallbackEnd; // 如果找不到标点符号，只能硬切
        } else {
          end++; // 包含标点本身
        }
      }

      chunks.push({
        content: cleanText.substring(currentIndex, end).trim(),
        index: chunkId++
      });

      currentIndex = end - chunkOverlap;
    }

    return chunks;
  }
}
