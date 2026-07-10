export class MemoryConsolidationPipeline {
  constructor(
    private modelManager: any,
    private memoryStore: any
  ) {}

  /**
   * 执行记忆整合反刍，消除冗余、消除矛盾
   */
  public async consolidate(): Promise<void> {
    console.log('[Memory Consolidation] 🧠 开始分析并整理 SQLite 长期记忆库...');

    // 1. 获取所有分类
    const categories = ['通用', '个人信息', '技术偏好', '工作项目', '兴趣爱好'];
    
    // 我们选择一个可用的模型来进行整理任务（优先用云端，本地模型次之）
    const targetModel = this.modelManager.getActiveModel() || this.modelManager.models[0];
    if (!targetModel) {
      console.warn('[Memory Consolidation] 未找到可用模型，跳过整理');
      return;
    }

    for (const category of categories) {
      try {
        // 2. 捞取该分类下所有没有被晋升的原子记忆
        const sql = `SELECT * FROM memories WHERE category = ? AND tags NOT LIKE '%promoted%'`;
        const results = this.memoryStore.db.exec(sql, [category]);
        const memories = this.memoryStore._parseResults(results);

        if (memories.length < 2) {
          // 记忆过少，不需要整理消重，跳过
          continue;
        }

        console.log(`[Memory Consolidation] 🧠 正在分析 [${category}] 分类下的 ${memories.length} 条记忆...`);

        // 3. 格式化记忆提供给 LLM
        const memoryTranscript = memories
          .map((m: any) => `ID: ${m.id} | 更新时间: ${m.updated_at} | 记忆内容: ${m.content}`)
          .join('\n');

        const systemPrompt = `你是一个长期记忆整合与净化专家。请对用户提供的原子记忆列表进行深度整合，消除冗余、消除矛盾。
规则：
1. 语义消重：合并表达相同偏好、习惯或事实的记忆（例如“喜欢用 TypeScript” 与 “偏爱用 TS 开发项目”），合并为一条最完整、最自然的描述。
2. 矛盾仲裁：如果发现互相冲突的记忆（例如“喜欢香蕉”与“对香蕉过敏”），请根据它们提供的时间戳，以“最新时间戳”所载的事实为准进行保留或合并。
3. 仅输出 JSON：必须严格以 JSON 格式输出修改计划，不要包含 markdown 块或任何解释。
格式：
{
  "updates": [
    {"id": "记忆的UUID", "content": "合并/整理后的最完整新内容"}
  ],
  "deletes": [
    "被合并或废弃的冗余记忆的UUID",
    "被判定过时且需删除的冲突记忆的UUID"
  ]
}
如果没有任何需要合并或删除的记忆，请返回 {"updates": [], "deletes": []}`;

        const prompt = [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: memoryTranscript }
        ];

        // 4. 调用大模型分析
        const reply = await this.modelManager.chat(prompt, { modelId: targetModel.id, temperature: 0.1 });
        const cleanReply = reply.replace(/```json/g, '').replace(/```/g, '').trim();
        const plan = JSON.parse(cleanReply);

        let actionCount = 0;

        // 5. 执行更新
        if (plan.updates && Array.isArray(plan.updates)) {
          for (const item of plan.updates) {
            this.memoryStore.updateMemoryContent(item.id, item.content);
            actionCount++;
          }
        }

        // 6. 执行删除
        if (plan.deletes && Array.isArray(plan.deletes)) {
          for (const id of plan.deletes) {
            this.memoryStore.deleteMemory(id);
            actionCount++;
          }
        }

        if (actionCount > 0) {
          console.log(`[Memory Consolidation] 🎉 [${category}] 记忆整理成功！执行了 ${actionCount} 次更新/删除`);
        }
      } catch (err: any) {
        console.error(`[Memory Consolidation] 整理分类 [${category}] 时出错:`, err.message);
      }
    }
  }
}
