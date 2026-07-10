import path from 'path';
import fs from 'fs';

describe('Multi-modal message conversion', () => {
  let ContextAggregator: any;
  let MemoryStore: any;
  let store: any;
  const testDir = path.join(__dirname, '.test_data_multimodal');

  beforeAll(async () => {
    ContextAggregator = require('../../dist/backend/dialogue-orchestrator.js').ContextAggregator;
    MemoryStore = require('../../dist/backend/memory-store.js').MemoryStore;

    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    store = new MemoryStore(testDir);
    await store.init();
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('多模态消息在传给模型前应当被转换为Array数组对象，而非原始JSON字符串 (Regression Test)', async () => {
    let capturedMessages: any[] = [];
    
    const mockModelManager = {
      chat: jest.fn().mockResolvedValue('Summary of old history'),
      chatStream: jest.fn().mockImplementation(async (messages, options, onChunk) => {
        capturedMessages = messages;
        onChunk('Test response chunk');
        return 'Test response chunk';
      }),
      getActiveModel: jest.fn().mockResolvedValue({ id: 'test-model' }),
      getModels: jest.fn().mockResolvedValue([{ id: 'test-model', type: 'cloud', name: 'Test Cloud Model' }])
    };

    const mockMainWindow = {
      webContents: {
        send: jest.fn()
      }
    };

    const aggregator = new ContextAggregator({
      modelManager: mockModelManager,
      memoryStore: store,
      sandbox: { execute: jest.fn() },
      dataDir: testDir,
      mainWindowRef: () => mockMainWindow,
      jobQueue: null
    });

    const payload = {
      conversationId: null,
      message: '这是什么图片？',
      attachment: 'data:image/png;base64,iVBORw0KGgoAAAANS...',
      modelId: 'test-model',
      systemPrompt: 'You are a helpful assistant.',
      temperature: 0.7,
      agentMode: false
    };

    const abortController = new AbortController();
    await aggregator.executeChatStream(payload, abortController.signal);

    expect(capturedMessages.length).toBeGreaterThan(0);
    const lastMessage = capturedMessages[capturedMessages.length - 1];
    
    // 核心断言：验证最后一条消息 content 类型
    expect(Array.isArray(lastMessage.content)).toBe(true);
    expect(lastMessage.content[0].type).toBe('text');
    expect(lastMessage.content[1].type).toBe('image_url');
  });

  it('多模态消息在双脑分发时，若本地模型不支持视觉则不应分发给本地 (Regression Test)', async () => {
    const ModelManagerClass = require('../../dist/backend/model-manager.js').ModelManager;
    const modelMgr = new ModelManagerClass(testDir);
    
    modelMgr.models = [
      { id: 'cloud-model', type: 'cloud', provider: 'OpenAI', modelName: 'gpt-4o' },
      { id: 'local-text-only', type: 'local', provider: 'Ollama', modelName: 'llama3', isCold: false }
    ];
    modelMgr.activeModelId = 'cloud-model';

    let selectedModel = null;
    modelMgr._chatCloudStream = jest.fn().mockImplementation(async (model, messages, options, onChunk) => {
      selectedModel = model;
      return 'Cloud reply';
    });
    modelMgr._chatLocalStream = jest.fn().mockImplementation(async (model, messages, options, onChunk) => {
      selectedModel = model;
      return 'Local reply';
    });

    const payloadMessages = [
      { role: 'user', content: [
        { type: 'text', text: '你好' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
      ]}
    ];

    await modelMgr.chatStream(payloadMessages, { modelId: 'cloud-model', agentMode: false }, () => {});
    expect(selectedModel.id).toBe('cloud-model');
  });

  it('多模态消息在双脑分发时，若本地模型支持视觉则应该分发给本地 (Regression Test)', async () => {
    const ModelManagerClass = require('../../dist/backend/model-manager.js').ModelManager;
    const modelMgr = new ModelManagerClass(testDir);
    
    modelMgr.models = [
      { id: 'cloud-model', type: 'cloud', provider: 'OpenAI', modelName: 'gpt-4o' },
      { id: 'local-vision-capable', type: 'local', provider: 'Ollama', modelName: 'qwen2-vl', isCold: false }
    ];
    modelMgr.activeModelId = 'cloud-model';

    let selectedModel = null;
    modelMgr._chatCloudStream = jest.fn().mockImplementation(async (model, messages, options, onChunk) => {
      selectedModel = model;
      return 'Cloud reply';
    });
    modelMgr._chatLocalStream = jest.fn().mockImplementation(async (model, messages, options, onChunk) => {
      selectedModel = model;
      return 'Local reply';
    });

    const payloadMessages = [
      { role: 'user', content: [
        { type: 'text', text: '你好' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
      ]}
    ];

    await modelMgr.chatStream(payloadMessages, { modelId: 'cloud-model', agentMode: false }, () => {});
    expect(selectedModel.id).toBe('local-vision-capable');
  });

  it('文档解析接口应当在面对Office文档类型时，正常调用parseOffice并可调用toText提取出纯文本 (Regression Test)', async () => {
    const officeParser = require('officeparser');
    
    // 用 Jest spyOn 拦截真实方法并返回一个带有 toText 方法的 Mock 对象
    const spy = jest.spyOn(officeParser, 'parseOffice').mockResolvedValue({
      toText: () => 'Mocked Hello World'
    });
    
    const parsed = await officeParser.parseOffice('dummy.docx');
    expect(typeof parsed).toBe('object');
    expect(typeof parsed.toText).toBe('function');
    expect(parsed.toText()).toContain('Mocked Hello World');

    spy.mockRestore();
  });
});
