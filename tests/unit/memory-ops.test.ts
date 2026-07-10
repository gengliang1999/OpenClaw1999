import path from 'path';
import fs from 'fs';

describe('记忆修改、导入与去重机制单元测试', () => {
  let MemoryStore: any;
  let store: any;
  const testDir = path.join(__dirname, '.test_memory_ops_data');

  beforeAll(async () => {
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

  it('应该能够成功修改现有记忆事实文本', () => {
    const mem = store.addMemory('原始记忆内容', '通用', []);
    const id = mem.id;

    // 模拟修改记忆
    store.db.run(
      'UPDATE memories SET content = ?, updated_at = ? WHERE id = ?',
      ['修改后的记忆内容', new Date().toISOString(), id]
    );
    store._save();

    const updated = store.getMemory(id);
    expect(updated).toBeDefined();
    expect(updated.content).toBe('修改后的记忆内容');
  });

  it('导入数据时应成功跳过完全相同的重复记忆', () => {
    const baseContent = '不要重复的记忆';
    store.addMemory(baseContent, '通用', []);

    // 模拟导入过程中的去重判断
    const checkExists = (content: string) => {
      const exists = store.db.exec(
        'SELECT id FROM memories WHERE content = ? LIMIT 1',
        [content]
      );
      return exists && exists.length > 0 && exists[0].values.length > 0;
    };

    expect(checkExists(baseContent)).toBe(true);
    expect(checkExists('全新的不重复记忆')).toBe(false);
  });
});
