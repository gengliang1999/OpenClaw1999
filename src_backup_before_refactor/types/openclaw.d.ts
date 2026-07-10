/**
 * OpenClaw 智能助手 - 全局类型声明
 * 定义 window.openClaw 的完整类型
 */

// ==================== 通用类型 ====================
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

interface ModelConfig {
  id: string;
  name: string;
  type: 'cloud' | 'local';
  provider: string;
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  maxTokens?: number;
  temperature?: number;
}

interface ActiveModel {
  id: string;
  name: string;
  provider: string;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  conversationId: string;
  createdAt: string;
}

interface Memory {
  id: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: string;
}

interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

interface Permission {
  id: string;
  pattern: string;
  permanent: boolean;
}

interface Skill {
  id: string;
  name: string;
  description: string;
  installed: boolean;
}

interface Plugin {
  id: string;
  name: string;
  description: string;
  installed: boolean;
  connected: boolean;
}

interface HardwareInfo {
  cpuModel: string;
  totalRamGB: number;
  freeRamGB: number;
  hasGpu: boolean;
  gpuModel?: string;
}

interface MarketplaceData {
  models: any[];
  hardware: HardwareInfo;
}

interface LocalRuntimeStatus {
  ollama: { running: boolean; models: any[] };
  lmstudio: { running: boolean; models: any[] };
}

interface LocalModel {
  id: string;
  name: string;
  size?: string;
  parameterSize?: string;
  family?: string;
  owned_by?: string;
}

interface SystemInfo {
  platform: string;
  arch: string;
  version: string;
}

// ==================== window.openClaw ====================
interface OpenClawAPI {
  chat: {
    sendMessage(conversationId: string, message: string, modelId: string): Promise<any>;
    sendMessageStream(conversationId: string, message: string, modelId: string, systemPrompt?: string, temperature?: number): Promise<Response>;
    abortStream(): void;
    deleteMessage(messageId: string): Promise<any>;
    getHistory(conversationId?: string): Promise<ChatMessage[]>;
    getConversations(): Promise<Conversation[]>;
    createConversation(title: string): Promise<Conversation>;
    deleteConversation(conversationId: string): Promise<any>;
    clearHistory(conversationId?: string): Promise<any>;
  };

  model: {
    getModels(): Promise<ModelConfig[]>;
    setActiveModel(modelId: string): Promise<any>;
    getActiveModel(): Promise<ActiveModel>;
    addModel(config: ModelConfig): Promise<any>;
    removeModel(modelId: string): Promise<any>;
    getMarketplace(): Promise<MarketplaceData>;
    syncLocalModels(): Promise<any>;
    preloadModel(modelId: string): Promise<any>;
    pullModel(modelId: string): Promise<Response>;
    detectLocal(): Promise<LocalRuntimeStatus>;
    getOllamaModels(): Promise<{ models: LocalModel[] }>;
    getLMStudioModels(): Promise<{ models: LocalModel[] }>;
    addLocalModel(provider: string, modelId: string, modelName: string, setDefault: boolean): Promise<any>;
  };

  memory: {
    getMemories(page?: string, pageSize?: string, category?: string): Promise<{ data: Memory[]; total: number }>;
    addMemory(content: string, category: string, tags?: string[]): Promise<Memory>;
    deleteMemory(id: string): Promise<any>;
    searchMemory(query: string, limit?: number): Promise<Memory[]>;
  };

  sandbox: {
    executeCommand(command: string, options?: Record<string, any>): Promise<SandboxResult>;
    getPermissions(): Promise<Permission[]>;
    grantPermission(pattern: string, permanent?: boolean): Promise<any>;
    revokePermission(id: string): Promise<any>;
    getLogs(page?: number, pageSize?: number): Promise<any>;
  };

  skill: {
    getSkills(): Promise<Skill[]>;
    installSkill(skillId: string): Promise<any>;
    removeSkill(skillId: string): Promise<any>;
    getMarketplace(type?: string, search?: string): Promise<Skill[]>;
  };

  plugin: {
    getPlugins(): Promise<Plugin[]>;
    installPlugin(pluginId: string): Promise<any>;
    removePlugin(pluginId: string): Promise<any>;
    getMarketplace(): Promise<Plugin[]>;
    updatePluginConfig(pluginId: string, config: Record<string, any>): Promise<any>;
    connectPlugin(pluginId: string): Promise<any>;
    disconnectPlugin(pluginId: string): Promise<any>;
  };

  settings: {
    get(key: string): Promise<any>;
    set(key: string, value: any): Promise<any>;
    getAll(): Promise<Record<string, any>>;
    updateAll(settings: Record<string, any>): Promise<any>;
  };

  system: {
    getInfo(): Promise<SystemInfo>;
    openExternal(url: string): Promise<void>;
    selectFile(options?: { filters?: { name: string; extensions: string[] }[] }): Promise<string | null>;
    selectDirectory(): Promise<string | null>;
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
  };
}

// ==================== 全局扩展 ====================
declare global {
  interface Window {
    openClaw: OpenClawAPI;
    __toast?: {
      success(msg: string): void;
      error(msg: string): void;
      warning(msg: string): void;
      info(msg: string): void;
    };
  }
}

export {};
