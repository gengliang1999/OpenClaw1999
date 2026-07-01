const { ragEngine } = require('./rag-engine');

async function runTests() {
  console.log('--- 开始 RAG 引擎性能与准确率测试 ---');
  
  const conversationId = 'test-conv-123';
  const dummyText = `
    OpenClaw 是一个开源的桌面端大模型助手。
    它的核心优势在于轻量级、无需外部依赖。
    在处理长文档时，OpenClaw 采用了基于内存的 RAG (检索增强生成) 引擎。
    该引擎能够对文本进行切片，并在提问时快速召回最相关的上下文，从而大幅节省 Token 开销。
    多模态方面，OpenClaw 支持图片、Word 文档、PDF 的一键挂载。
    它的模型配置界面经过精心设计，未配置的模型会有半透明的磨砂玻璃效果。
  `;

  console.time('文本切片与加载耗时');
  await ragEngine.addDocument(conversationId, 'openclaw-intro.txt', dummyText);
  console.timeEnd('文本切片与加载耗时');
  
  const query = 'OpenClaw 是如何处理长文本的？会不会占用很多上下文？';
  console.log('\\n测试查询:', query);
  
  console.time('检索召回耗时');
  const results = await ragEngine.search(conversationId, query, 3);
  console.timeEnd('检索召回耗时');
  
  console.log('\\n召回结果片段:');
  results.forEach((r, i) => {
    console.log(`[${i+1}] 相似度: ${r.score.toFixed(3)} | 内容: ${r.content.trim()}`);
  });

  if (results.length > 0 && results[0].content.includes('RAG')) {
    console.log('\\n✅ 测试通过: 成功召回了最相关的 RAG 架构描述。');
  } else {
    console.log('\\n❌ 测试失败: 召回准确率不达标。');
  }
}

runTests();
