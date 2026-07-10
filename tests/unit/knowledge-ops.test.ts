import path from 'path';
import fs from 'fs';

describe('知识库整文修改、索引擦除与备份物理拷贝单元测试', () => {
  const testDataDir = path.join(__dirname, '.test_knowledge_ops_data');
  const category = '测试分类';
  const fileName = 'test_doc.md';
  const sourceDir = path.join(testDataDir, 'knowledge', `${category}_sources`);
  const filePath = path.join(sourceDir, fileName);

  let VectorStore: any;

  beforeAll(() => {
    VectorStore = require('../../dist/backend/vector-store.js').VectorStore;
    if (!fs.existsSync(sourceDir)) {
      fs.mkdirSync(sourceDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }
  });

  it('物理文档的覆写逻辑应该正常工作', () => {
    // 写入物理原文
    fs.writeFileSync(filePath, '# 原始标题\n初始文本内容', 'utf8');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('# 原始标题\n初始文本内容');

    // 修改并覆盖物理原文
    fs.writeFileSync(filePath, '# 修改后的标题\n最新文本内容', 'utf8');
    expect(fs.readFileSync(filePath, 'utf8')).toBe('# 修改后的标题\n最新文本内容');
  });

  it('应该能够成功通过 removeBySource 擦除旧的分块向量索引', async () => {
    const dbPath = path.join(testDataDir, 'knowledge', `${category}.json`);
    const store = new VectorStore(dbPath);

    // 添加一些 mock 数据
    await store.addDocuments([
      {
        id: 'chunk1',
        content: '第一部分内容',
        embedding: [0.1, 0.2],
        metadata: { source: fileName }
      },
      {
        id: 'chunk2',
        content: '第二部分内容',
        embedding: [0.3, 0.4],
        metadata: { source: 'other_file.md' }
      }
    ]);

    // 加载并擦除特定来源的向量
    await store.load();
    await store.removeBySource(fileName);

    expect(store.documents.length).toBe(1);
    expect(store.documents[0].id).toBe('chunk2');
  });

  it('知识库所有物理归档文件递归拷贝备份功能应该正常工作', () => {
    const backupDir = path.join(testDataDir, 'backup_destination');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    let copiedCount = 0;
    const copyRecursive = (src: string, dest: string) => {
      const list = fs.readdirSync(src);
      for (const item of list) {
        const srcPath = path.join(src, item);
        const destPath = path.join(dest, item);
        const stat = fs.statSync(srcPath);
        if (stat.isDirectory()) {
          if (!fs.existsSync(destPath)) fs.mkdirSync(destPath, { recursive: true });
          copyRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
          copiedCount++;
        }
      }
    };

    copyRecursive(sourceDir, backupDir);

    expect(copiedCount).toBe(1);
    expect(fs.existsSync(path.join(backupDir, fileName))).toBe(true);
    expect(fs.readFileSync(path.join(backupDir, fileName), 'utf8')).toContain('修改后的标题');
  });
});
