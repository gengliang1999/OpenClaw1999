// @ts-nocheck
export interface ChatOptions {
  modelId?: string;
  maxTokens?: number;
  temperature?: number;
  signal?: AbortSignal;
  agentMode?: boolean;
}

export interface IModelProvider {
  /**
   * 非流式聊天请求
   */
  chat(model: any, messages: any[], options: ChatOptions): Promise<string>;

  /**
   * 流式聊天请求
   */
  chatStream(model: any, messages: any[], options: ChatOptions, onChunk?: (chunk: string) => void): Promise<string>;
}
