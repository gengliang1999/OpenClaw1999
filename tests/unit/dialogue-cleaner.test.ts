describe('Dialogue Cleaner 正则清洗测试', () => {
  it('应该只清洗 SAVE_MEMORY 标签本身，而不误伤后面的正常正文回复', () => {
    // 模拟一段 AI 回复，中间带记忆标签，标签后还有其他正常话语
    const finalReply = '好的，我记住了。[SAVE_MEMORY|技术偏好] 用户喜欢使用 TypeScript。你今天过得怎么样？';

    // 运行当前的正则清洗逻辑
    const cleanReply = finalReply
      .replace(/\[SAVE_MEMORY\|[^\]]*\]\s*[^。！？\r\n]*[。！？]?/g, '')
      .replace(/\[SAVE_MEMORY:[\s\S]*?\]/g, '')
      .trim();

    // 未修复时，此测试将失败，因为 cleanReply 会被截断为 "好的，我记住了。"
    expect(cleanReply).toBe('好的，我记住了。你今天过得怎么样？');
  });
});
