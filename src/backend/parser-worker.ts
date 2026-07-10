import { parentPort } from 'worker_threads';
import * as fs from 'fs';
import * as path from 'path';

if (parentPort) {
  parentPort.on('message', async (message) => {
    let jobId = message.jobId;
    try {
      const { filePath, fileType } = message;
      let result = '';

      if (fileType.includes('image')) {
        const Tesseract = require('tesseract.js');
        const { data: { text } } = await Tesseract.recognize(filePath, 'eng+chi_sim');
        result = `[离线图片OCR提取内容]\n${text}`;
      } else if (fileType.includes('pdf')) {
        const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');
        const data = new Uint8Array(fs.readFileSync(filePath));
        const loadingTask = pdfjsLib.getDocument({ 
          data,
          cMapUrl: 'node_modules/pdfjs-dist/cmaps/',
          cMapPacked: true,
          standardFontDataUrl: 'node_modules/pdfjs-dist/standard_fonts/'
        });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += `--- 第 ${i} 页 ---\n${pageText}\n`;
        }
        result = `[PDF纯净抽取内容]\n${fullText}`;
      }

      parentPort?.postMessage({ jobId, success: true, text: result });
    } catch (error) {
      const errMessage = error instanceof Error ? error.message : String(error);
      parentPort?.postMessage({ jobId, success: false, error: errMessage });
    }
  });
}
