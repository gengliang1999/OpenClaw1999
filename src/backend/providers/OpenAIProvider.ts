// @ts-nocheck
import { IModelProvider, ChatOptions } from './IModelProvider';

export class OpenAIProvider implements IModelProvider {
  private _delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async _retryRequest(makeRequest: () => Promise<Response>, maxRetries = 3): Promise<Response> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const response = await makeRequest();
      if (response.ok) {
        return response;
      }
      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '5');
        const delay = Math.min(retryAfter * 1000, Math.pow(2, attempt) * 1000 + Math.random() * 1000);
        console.log(`[OpenAIProvider] 请求被限流，等待 ${delay}ms 后重试 (第 ${attempt} 次)`);
        await this._delay(delay);
        continue;
      }
      return response;
    }
    throw new Error('重试次数已用完');
  }

  private async _formatMessages(messages: any[]) {
    const formatted = [];
    for (const m of messages) {
      if (Array.isArray(m.content)) {
        const newContent = [];
        for (const block of m.content) {
          if (block.type === 'image_url' && block.image_url) {
            const url = block.image_url.url;
            if (url.startsWith('file:///')) {
              try {
                const filePath = decodeURIComponent(url.replace('file:///', ''));
                const fs = require('fs');
                if (fs.existsSync(filePath)) {
                  const ext = filePath.split('.').pop()?.toLowerCase() || '';
                  const pureTextExts = ['txt', 'md', 'json', 'csv', 'html', 'xml', 'log'];
                  
                  if (pureTextExts.includes(ext)) {
                    let docText = fs.readFileSync(filePath, 'utf8');
                    if (docText.length > 100000) {
                      docText = docText.substring(0, 100000) + '\n\n[由于长度限制，截断至前 100,000 字符]';
                    }
                    newContent.push({ type: 'text', text: `\n\n<document>\n${docText}\n</document>\n` });
                  } else {
                    const { nativeImage } = require('electron');
                    const image = nativeImage.createFromPath(filePath);
                    const size = image.getSize();
                    let base64Data = '';
                    if (size.width > 1600 || size.height > 1600) {
                       const ratio = Math.min(1600 / size.width, 1600 / size.height);
                       const resized = image.resize({ 
                         width: Math.floor(size.width * ratio), 
                         height: Math.floor(size.height * ratio) 
                       });
                       base64Data = resized.toJPEG(75).toString('base64');
                    } else {
                       base64Data = image.toJPEG(80).toString('base64');
                    }
                    newContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Data}` } });
                  }
                }
              } catch (e) {
                console.error('[OpenAIProvider] Failed to read local file:', e);
              }
            } else {
              newContent.push(block);
            }
          } else {
            newContent.push(block);
          }
        }
        const hasImage = newContent.some(c => c.type === 'image_url');
        if (hasImage) {
          formatted.push({ role: m.role, content: newContent });
        } else {
          const mergedText = newContent.map(c => c.text || '').join('\n');
          formatted.push({ role: m.role, content: mergedText });
        }
      } else {
        formatted.push(m);
      }
    }
    return formatted;
  }

  private _buildRequestConfig(model: any, formattedMessages: any[], options: ChatOptions, stream = false) {
    const actualModelName = model.modelName || (model.name ? model.name.replace(/^\[.*?\]\s*/, '') : model.id);
    return {
      url: `${model.baseUrl}/chat/completions`,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${model.apiKey}`,
      },
      body: JSON.stringify({
        model: actualModelName,
        messages: formattedMessages,
        max_tokens: options.maxTokens || model.maxTokens || 4096,
        temperature: options.temperature ?? model.temperature ?? 0.7,
        stream,
      }),
    };
  }

  async chat(model: any, messages: any[], options: ChatOptions): Promise<string> {
    if (!model.apiKey && model.provider !== 'LM Studio') throw new Error('请先配置 API Key');
    
    const formattedMessages = await this._formatMessages(messages);
    const { url, headers, body } = this._buildRequestConfig(model, formattedMessages, options, false);
    
    const makeRequest = () => fetch(url, {
      method: 'POST',
      headers,
      body,
    });

    const response = await this._retryRequest(makeRequest);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async chatStream(model: any, messages: any[], options: ChatOptions, onChunk?: (chunk: string) => void): Promise<string> {
    if (!model.apiKey && model.provider !== 'LM Studio') throw new Error('请先配置 API Key');
    
    const formattedMessages = await this._formatMessages(messages);
    const { url, headers, body } = this._buildRequestConfig(model, formattedMessages, options, true);
    
    const makeRequest = () => fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: options.signal
    });

    const response = await this._retryRequest(makeRequest);

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API 调用失败 (${response.status}): ${err}`);
    }

    const decoder = new TextDecoder();
    let fullContent = '';
    let buffer = '';

    try {
      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const textChunk = typeof value === 'string' ? value : decoder.decode(value, { stream: true });
        buffer += textChunk;
        
        let newlineIndex;
        while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const dataStr = trimmed.slice(6);
          if (dataStr === '[DONE]') continue;

          try {
            const data = JSON.parse(dataStr);
            const content = data.choices?.[0]?.delta?.content;
            
            if (content) {
              fullContent += content;
              if (onChunk) onChunk(content);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error('[OpenAI Stream Error]', err);
      throw err;
    }

    return fullContent;
  }
}
