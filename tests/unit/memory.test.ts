import path from 'path';
import fs from 'fs';

describe('MemoryStore', () => {
  let MemoryStore: any;
  let store: any;
  const testDir = path.join(__dirname, '.test_data');

  beforeAll(async () => {
    // 强制使用编译后的模块进行测试，保证 E2E 真实性
    MemoryStore = require('../../dist/backend/memory-store.js').MemoryStore;
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
    store = new MemoryStore(testDir);
    await store.init();
  });

  afterAll(() => {
    if (store && typeof store.close === 'function') {
      try { store.close(); } catch (e) { /* 忽略关闭时的写盘异常 */ }
    }
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('应该成功添加新的记忆突触 (Happy Path)', () => {
    const mem1 = store.addMemory('第一条记忆', '核心分类', ['tag1']);
    expect(mem1.id).toBeDefined();
    expect(typeof mem1.id).toBe('string');
    expect(mem1.content).toBe('第一条记忆');

    const result = store.getAllMemories(1, 10);
    expect(result.total).toBeGreaterThan(0);
    expect(result.items.some((m: any) => m.id === mem1.id)).toBeTruthy();
  });

  it('使用恶意解析的 parseInt(UUID) 不应导致删除正常记忆', () => {
    const mem2 = store.addMemory('要保护的记忆', '安全', []);
    const initialTotal = store.getAllMemories(1, 10).total;

    const maliciousId = parseInt(mem2.id); // UUID 往往解析为 NaN
    store.deleteMemory(maliciousId); // 执行删除操作
    
    const newTotal = store.getAllMemories(1, 10).total;
    expect(newTotal).toBe(initialTotal); // 确保记录总数未变
  });

  it('正确的 UUID 字符串应该能够成功删除记忆', () => {
    const mem3 = store.addMemory('将被删除的记忆', '清理', []);
    const initialTotal = store.getAllMemories(1, 10).total;

    store.deleteMemory(mem3.id); // 使用正确的 String UUID 执行删除操作
    
    const newTotal = store.getAllMemories(1, 10).total;
    expect(newTotal).toBe(initialTotal - 1); // 确保记录总数正确减少
    const checkResult = store.getAllMemories(1, 10);
    expect(checkResult.items.some((m: any) => m.id === mem3.id)).toBeFalsy();
  });
});
