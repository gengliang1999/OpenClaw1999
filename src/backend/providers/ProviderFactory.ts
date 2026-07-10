// @ts-nocheck
import { IModelProvider } from './IModelProvider';
import { OpenAIProvider } from './OpenAIProvider';
import { OllamaProvider } from './OllamaProvider';
import { AnthropicProvider } from './AnthropicProvider';

export class ProviderFactory {
  static getProvider(model: any): IModelProvider {
    if (!model) throw new Error('模型信息不可为空');

    const providerType = (model.provider || '').toLowerCase();
    
    // Anthropic / Claude
    if (providerType === 'anthropic' || providerType === 'claude') {
      return new AnthropicProvider();
    }
    
    // Ollama 
    if (providerType === 'ollama' || model.id?.toLowerCase().includes('ollama')) {
      return new OllamaProvider();
    }
    
    // OpenAI 兼容 (包括 OpenAI 官方、LM Studio、Llama.cpp、Jan、GPT4All 等)
    // 默认使用 OpenAI 兼容协议
    return new OpenAIProvider();
  }
}
