/**
 * 对话导出工具模块
 * 支持 JSON / Markdown / HTML / TXT / PDF / Word / PNG 格式
 */

import { escapeHtml, formatDate } from './common.js';
import { api } from './api.js';

/**
 * 动态加载外部 CDN 脚本
 */
function loadExternalScript(url) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing) {
      resolve(window[url.split('/').pop().replace('.min.js', '').replace('.js', '')]);
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * 下载 Blob 文件
 */
function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 转换为 Markdown 格式
 */
function convertToMarkdown(data) {
  let md = `# ${data.title || '对话'}\n\n`;
  md += `> 创建时间：${formatDate(data.created_at)}  \n`;
  md += `> 导出时间：${formatDate(data.exported_at)}\n\n`;
  md += `---\n\n`;

  (data.messages || []).forEach(msg => {
    const role = msg.role === 'user' ? '👤 **用户**' : '🤖 **AI助手**';
    md += `${role}\n\n${msg.content}\n\n---\n\n`;
  });

  return md;
}

/**
 * 转换为 HTML 格式
 */
function convertToHTML(data) {
  const messages = (data.messages || []).map(msg => {
    const isUser = msg.role === 'user';
    return `
      <div class="message ${isUser ? 'user' : 'ai'}">
        <div class="avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="bubble">
          <div class="role">${isUser ? '用户' : 'AI助手'}</div>
          <div class="content">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>
        </div>
      </div>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(data.title || '对话')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f7; padding: 40px 20px; }
    .container { max-width: 800px; margin: 0 auto; background: #fff; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow: hidden; }
    .header { padding: 24px; border-bottom: 1px solid #eee; }
    .header h1 { font-size: 24px; font-weight: 600; }
    .header .meta { font-size: 13px; color: #86868b; margin-top: 8px; }
    .messages { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
    .message { display: flex; gap: 12px; }
    .message.user { flex-direction: row-reverse; }
    .avatar { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 18px; background: #f0f0f0; flex-shrink: 0; }
    .message.user .avatar { background: #007aff; }
    .bubble { max-width: 70%; padding: 12px 16px; border-radius: 16px; background: #f0f0f0; }
    .message.user .bubble { background: #007aff; color: #fff; }
    .role { font-size: 12px; font-weight: 600; margin-bottom: 4px; opacity: 0.7; }
    .content { font-size: 14px; line-height: 1.6; }
    .footer { padding: 16px 24px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #86868b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${escapeHtml(data.title || '对话')}</h1>
      <div class="meta">导出时间：${formatDate(data.exported_at)}</div>
    </div>
    <div class="messages">${messages}</div>
    <div class="footer">由 OpenClaw Assistant 导出</div>
  </div>
</body>
</html>`;
}

/**
 * 转换为 TXT 格式
 */
function convertToTXT(data) {
  let txt = `${data.title || '对话'}\n`;
  txt += `${'='.repeat(40)}\n`;
  txt += `创建时间：${formatDate(data.created_at)}\n`;
  txt += `导出时间：${formatDate(data.exported_at)}\n`;
  txt += `${'='.repeat(40)}\n\n`;

  (data.messages || []).forEach(msg => {
    const role = msg.role === 'user' ? '【用户】' : '【AI助手】';
    txt += `${role}\n${msg.content}\n\n${'-'.repeat(40)}\n\n`;
  });

  return txt;
}

/**
 * 导出为 PDF
 */
async function exportToPDF(data, filename) {
  await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
  await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js');

  const html = convertToHTML(data);
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  document.body.appendChild(container);

  try {
    await html2pdf().from(container).set({
      margin: 10,
      filename: `${filename}.pdf`,
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).save();
  } finally {
    container.remove();
  }
}

/**
 * 导出为 Word
 */
async function exportToWord(data, filename) {
  await loadExternalScript('https://unpkg.com/docx@8.5.0/build/index.umd.js');

  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = window.docx;

  const children = [
    new Paragraph({
      children: [new TextRun({ text: data.title || '对话', bold: true, size: 36 })],
      heading: HeadingLevel.HEADING_1,
    }),
    new Paragraph({
      children: [new TextRun({ text: `导出时间：${formatDate(data.exported_at)}`, color: '86868b', size: 20 })],
    }),
    new Paragraph({ text: '' }),
  ];

  (data.messages || []).forEach(msg => {
    const isUser = msg.role === 'user';
    children.push(new Paragraph({
      children: [new TextRun({ text: isUser ? '👤 用户' : '🤖 AI助手', bold: true, size: 24 })],
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: msg.content, size: 22 })],
    }));
    children.push(new Paragraph({ text: '' }));
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 导出为 PNG
 */
async function exportToPNG(data, filename) {
  await loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');

  const html = convertToHTML(data);
  const container = document.createElement('div');
  container.innerHTML = html;
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container.querySelector('.container'), {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } finally {
    container.remove();
  }
}

/**
 * 执行导出
 * @param {string} convId - 对话 ID
 * @param {string} format - 导出格式 (json/markdown/html/txt/pdf/word/png)
 */
export async function doExport(convId, format) {
  try {
    window.__toast?.info('正在导出...');
    const data = await api.chat.exportConversation(convId);
    const safeName = (data.title || '对话').replace(/[<>:"/\\|?*]/g, '_');

    switch (format) {
      case 'json':
        downloadBlob(JSON.stringify(data, null, 2), `${safeName}.json`, 'application/json');
        break;
      case 'markdown':
        downloadBlob(convertToMarkdown(data), `${safeName}.md`, 'text/markdown');
        break;
      case 'html':
        downloadBlob(convertToHTML(data), `${safeName}.html`, 'text/html');
        break;
      case 'txt':
        downloadBlob(convertToTXT(data), `${safeName}.txt`, 'text/plain');
        break;
      case 'pdf':
        await exportToPDF(data, safeName);
        break;
      case 'word':
        await exportToWord(data, safeName);
        break;
      case 'png':
        await exportToPNG(data, safeName);
        break;
    }
    window.__toast?.success('导出成功');
  } catch(e) {
    console.error('导出失败:', e);
    window.__toast?.error('导出失败: ' + e.message);
  }
}
