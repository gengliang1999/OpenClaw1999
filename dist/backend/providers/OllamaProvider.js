"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OllamaProvider = void 0;
class OllamaProvider {
    _formatMessages(messages) {
        return messages.map(m => {
            if (Array.isArray(m.content)) {
                const textBlock = m.content.find(c => c.type === 'text');
                const imgBlock = m.content.find(c => c.type === 'image_url');
                const ollamaMsg = { role: m.role, content: textBlock ? textBlock.text : '' };
                if (imgBlock && imgBlock.image_url) {
                    const url = imgBlock.image_url.url;
                    let base64Data = '';
                    if (url.startsWith('file:///')) {
                        const filePath = decodeURIComponent(url.replace('file:///', ''));
                        const ext = filePath.split('.').pop()?.toLowerCase() || '';
                        const pureTextExts = ['txt', 'md', 'json', 'csv', 'html', 'xml', 'log'];
                        if (pureTextExts.includes(ext)) {
                            // [全量上下文注入] JIT 提取文本，安全截断后组装给大模型
                            try {
                                const fs = require('fs');
                                if (fs.existsSync(filePath)) {
                                    let docText = fs.readFileSync(filePath, 'utf8');
                                    if (docText.length > 100000) {
                                        docText = docText.substring(0, 100000) + '\n\n[由于长度限制，截断至前 100,000 字符]';
                                    }
                                    ollamaMsg.content += `\n\n<document>\n${docText}\n</document>\n`;
                                }
                            }
                            catch (e) {
                                console.error('[OllamaProvider] Failed to read local document:', e);
                            }
                        }
                        else {
                            // [OOM Fix] JIT (Just-In-Time) 从磁盘读取图片，用完即毁
                            try {
                                const { nativeImage } = require('electron');
                                const fs = require('fs');
                                if (fs.existsSync(filePath)) {
                                    const image = nativeImage.createFromPath(filePath);
                                    const size = image.getSize();
                                    if (size.width > 1600 || size.height > 1600) {
                                        const ratio = Math.min(1600 / size.width, 1600 / size.height);
                                        const resized = image.resize({
                                            width: Math.floor(size.width * ratio),
                                            height: Math.floor(size.height * ratio)
                                        });
                                        base64Data = resized.toJPEG(75).toString('base64');
                                    }
                                    else {
                                        base64Data = image.toJPEG(80).toString('base64');
                                    }
                                }
                            }
                            catch (e) {
                                console.error('[OllamaProvider] Failed to read local image:', e);
                            }
                        }
                    }
                    else if (url.startsWith('data:image/')) {
                        // 兼容遗留的旧版 Base64 消息
                        base64Data = url.split(',')[1];
                    }
                    if (base64Data) {
                        ollamaMsg.images = [base64Data];
                    }
                }
                return ollamaMsg;
            }
            return m;
        });
    }
    async chat(model, messages, options) {
        const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
        const actualModelName = model.modelName || (model.name ? model.name.replace(/^\[.*?\]\s*/, '') : model.id);
        const ollamaMessages = this._formatMessages(messages);
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: actualModelName,
                messages: ollamaMessages,
                stream: false,
                options: {
                    num_ctx: options.maxTokens || model.contextSize || 4096,
                    temperature: options.temperature ?? model.temperature ?? 0.7,
                }
            })
        });
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama 接口调用失败: ${err}`);
        }
        const data = await response.json();
        return data.message?.content || '';
    }
    async chatStream(model, messages, options, onChunk) {
        const baseUrl = model.baseUrl || 'http://127.0.0.1:11434';
        const actualModelName = model.modelName || (model.name ? model.name.replace(/^\[.*?\]\s*/, '') : model.id);
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 120000);
        if (options.signal) {
            options.signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                abortController.abort();
            });
        }
        const ollamaMessages = this._formatMessages(messages);
        const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: actualModelName,
                messages: ollamaMessages,
                stream: true,
                options: {
                    num_ctx: options.maxTokens || model.contextSize || 4096,
                    temperature: options.temperature ?? model.temperature ?? 0.7,
                }
            }),
            signal: abortController.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Ollama 接口调用失败: ${err}`);
        }
        const decoder = new TextDecoder();
        let fullContent = '';
        let buffer = '';
        try {
            const reader = response.body.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
                buffer += textChunk;
                let newlineIndex;
                while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
                    const line = buffer.slice(0, newlineIndex);
                    buffer = buffer.slice(newlineIndex + 1);
                    const trimmed = line.trim();
                    if (!trimmed)
                        continue;
                    try {
                        const data = JSON.parse(trimmed);
                        const content = data.message?.content;
                        if (content) {
                            fullContent += content;
                            if (onChunk)
                                onChunk(content);
                        }
                    }
                    catch (e) { }
                }
            }
        }
        catch (err) {
            console.error('[Local Stream Error]', err);
            throw err;
        }
        return fullContent;
    }
}
exports.OllamaProvider = OllamaProvider;
