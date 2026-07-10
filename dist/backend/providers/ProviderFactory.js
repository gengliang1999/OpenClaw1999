"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderFactory = void 0;
const OpenAIProvider_1 = require("./OpenAIProvider");
const OllamaProvider_1 = require("./OllamaProvider");
const AnthropicProvider_1 = require("./AnthropicProvider");
class ProviderFactory {
    static getProvider(model) {
        if (!model)
            throw new Error('模型信息不可为空');
        const providerType = (model.provider || '').toLowerCase();
        // Anthropic / Claude
        if (providerType === 'anthropic' || providerType === 'claude') {
            return new AnthropicProvider_1.AnthropicProvider();
        }
        // Ollama 
        if (providerType === 'ollama' || model.id?.toLowerCase().includes('ollama')) {
            return new OllamaProvider_1.OllamaProvider();
        }
        // OpenAI 兼容 (包括 OpenAI 官方、LM Studio、Llama.cpp、Jan、GPT4All 等)
        // 默认使用 OpenAI 兼容协议
        return new OpenAIProvider_1.OpenAIProvider();
    }
}
exports.ProviderFactory = ProviderFactory;
