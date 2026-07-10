import path from 'path';
import fs from 'fs';

describe('VectorDatabaseManager 锁与异常传染测试', () => {
  let vectorDbManager: any;
  const testDbPath = path.join(__dirname, 'test_lock_propagation.json');

  beforeAll(() => {
    vectorDbManager = require('../../dist/backend/vector-db-manager.js').vectorDbManager;
  });

  afterAll(() => {
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    vectorDbManager.clearCache(testDbPath);
  });

  it('前一次写入发生报错不应影响后续写入 (防止锁异常传染死锁)', async () => {
    // 1. 发起第一次写入，故意抛出异常
    let firstErrorOccurred = false;
    try {
      await vectorDbManager.executeWrite(testDbPath, async (store: any) => {
        throw new Error('First Write Custom Error');
      });
    } catch (e: any) {
      if (e.message === 'First Write Custom Error') {
        firstErrorOccurred = true;
      }
    }
    expect(firstErrorOccurred).toBe(true);

    // 2. 发起第二次写入，应该是可以正常工作的
    let secondWriteSuccess = false;
    try {
      await vectorDbManager.executeWrite(testDbPath, async (store: any) => {
        // 模拟向 store 添加一个 mock 向量
        store.documents = [{ id: 'mock', content: 'test', embedding: [1, 2, 3] }];
      });
      secondWriteSuccess = true;
    } catch (e: any) {
      console.error('第二次写入失败（死锁或传染报错）：', e.message);
    }

    // 在未修复时，这里会失败，因为第二次写入也会抛出 'First Write Custom Error'
    expect(secondWriteSuccess).toBe(true);

    // 验证第二次数据确实成功写入并能读取
    const readDocs = await vectorDbManager.executeRead(testDbPath, (store: any) => {
      return store.documents;
    });
    expect(readDocs).toBeDefined();
    expect(readDocs.length).toBe(1);
    expect(readDocs[0].id).toBe('mock');
  });
});
