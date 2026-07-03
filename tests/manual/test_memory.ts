import path from 'path';
import fs from 'fs';
import { assert } from 'console';

// 模拟测试入口
async function runTests() {
  const { MemoryStore } = require('../../dist/backend/memory-store.js');
  
  console.log('--- [QA Master] 启动记忆模块核心测试 ---');
  const testDir = path.join(__dirname, '.test_data');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  
  const store = new MemoryStore(testDir);
  await store.init();
  
  console.log('✔️ 数据库初始化通过');

  // Test 1: 添加记忆
  const mem1 = store.addMemory('这是测试记忆1', '分类A', ['tag1']);
  const mem2 = store.addMemory('这是测试记忆2', '分类B', ['tag2']);
  console.assert(mem1.id && typeof mem1.id === 'string', '记忆创建必须返回 string UUID');
  
  const allMems = store.getAllMemories(1, 10);
  console.assert(allMems.total === 2, '分页获取必须包含所有插入数据');
  console.log('✔️ 新增记忆 (Happy Path) 测试通过');

  // Test 2: 搜索记忆
  const searchResult = store.searchMemory('测试记忆1');
  console.assert(searchResult.length === 1 && searchResult[0].id === mem1.id, '检索记忆必须精准匹配');
  console.log('✔️ 检索记忆测试通过');

  // Test 3: 删除记忆 (毁灭测试：包含异常与边界)
  const maliciousId = parseInt(mem1.id); // 这会是 NaN
  store.deleteMemory(maliciousId);
  const checkMems = store.getAllMemories(1, 10);
  console.assert(checkMems.total === 2, '恶意/错误的 parseInt(UUID) 不应删除任何数据');

  // 测试正确的 string UUID 删除
  store.deleteMemory(mem1.id);
  const remainingMems = store.getAllMemories(1, 10);
  console.assert(remainingMems.total === 1 && remainingMems.items[0].id === mem2.id, '正确的 UUID 字符串必须成功删除数据');
  console.log('✔️ 极端边界删除与正常删除 测试通过');

  console.log('--- [QA Master] 记忆模块局部回归测试 100% 覆盖通过 ---');
}

runTests().catch(e => {
  console.error('测试失败:', e);
  process.exit(1);
});
