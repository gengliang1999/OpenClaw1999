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
const worker_threads_1 = require("worker_threads");
const fs = __importStar(require("fs"));
if (worker_threads_1.parentPort) {
    worker_threads_1.parentPort.on('message', async (message) => {
        let jobId = message.jobId;
        try {
            const { filePath, fileType } = message;
            let result = '';
            if (fileType.includes('image')) {
                const Tesseract = require('tesseract.js');
                const { data: { text } } = await Tesseract.recognize(filePath, 'eng+chi_sim');
                result = `[离线图片OCR提取内容]\n${text}`;
            }
            else if (fileType.includes('pdf')) {
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
                    const pageText = textContent.items.map((item) => item.str).join(' ');
                    fullText += `--- 第 ${i} 页 ---\n${pageText}\n`;
                }
                result = `[PDF纯净抽取内容]\n${fullText}`;
            }
            worker_threads_1.parentPort?.postMessage({ jobId, success: true, text: result });
        }
        catch (error) {
            const errMessage = error instanceof Error ? error.message : String(error);
            worker_threads_1.parentPort?.postMessage({ jobId, success: false, error: errMessage });
        }
    });
}
