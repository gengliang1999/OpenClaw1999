/**
 * 轻量级 Markdown 解析器
 * 支持：代码块、行内代码、粗体、斜体、引用、换行
 */
import { escapeHtml } from './common.js';
/**
 * 将 Markdown 文本转换为 HTML
 * @param {string} md - Markdown 文本
 * @returns {string} HTML 字符串
 */
export function parseMarkdown(md) {
    if (!md)
        return '';
    let html = escapeHtml(md);
    // 代码块
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background: var(--bg-active); padding:12px; border-radius:8px; overflow-x:auto; margin: 8px 0;"><code style="font-family:Consolas,monospace; font-size:13px;">$2</code></pre>');
    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code style="background:var(--bg-active); padding:2px 4px; border-radius:4px; font-family:Consolas,monospace; font-size:0.9em;">$1</code>');
    // 粗体
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // 斜体
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // 引用
    html = html.replace(/&gt; (.*?)(?:\n|$)/g, '<blockquote style="border-left: 3px solid var(--primary); color: var(--text-muted); margin: 4px 0; padding-left: 8px;">$1</blockquote>');
    // 思考过程块 <think> 或 <thought>
    html = html.replace(/&lt;(?:think|thought)&gt;([\s\S]*?)&lt;\/(?:think|thought)&gt;/gi, function (match, content) {
        return `<details style="margin: 8px 0; padding: 12px; background: var(--bg-active); border-radius: 8px; border-left: 3px solid #a259ff; cursor: pointer;"><summary style="color: #a259ff; font-weight: 600; font-size: 13px; user-select: none;">🤔 AI 思考过程</summary><div style="margin-top: 8px; font-size: 13px; color: var(--text-muted); white-space: pre-wrap;">${content}</div></details>`;
    });
    // 换行
    html = html.replace(/\n/g, '<br/>');
    return html;
}
