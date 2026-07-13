// @ts-nocheck
import * as fs from 'fs';
import * as path from 'path';

export class EvolutionEngine {
  private skillsDir: string;
  private proposalsDir: string;
  private memoryStore: any;
  private modelManager: any;

  /**
   * 是否将反思生成的代码自动落盘。
   * 安全约束（P0/T5）：默认 false —— 仅返回文本，绝不自动写盘/加载可执行代码。
   * 仅在用户显式开启后方写入隔离区（.agents/skill-proposals），且绝不被任何 require/加载路径引用。
   */
  private autoPersistCode: boolean;

  constructor(baseDataDir: string, memoryStore: any, modelManager: any, options: { autoPersistCode?: boolean } = {}) {
    this.skillsDir = path.join(baseDataDir, '.agents', 'skills');
    // 隔离区：仅用于人工审阅，绝不可被加载路径引用
    this.proposalsDir = path.join(baseDataDir, '.agents', 'skill-proposals');
    this.memoryStore = memoryStore;
    this.modelManager = modelManager;
    this.autoPersistCode = options.autoPersistCode === true;

    if (!fs.existsSync(this.proposalsDir)) {
      fs.mkdirSync(this.proposalsDir, { recursive: true });
    }
  }

  /**
   * 触发自我反思与技能固化
   * @param errorContext 失败的上下文或执行报错
   * @param taskGoal 最初试图达成的目标
   */
  async evolve(errorContext: string, taskGoal: string): Promise<string> {
    console.log('[自我进化引擎] 触发反思机制...');

    const prompt = `
[自我进化系统核心指令]
你刚才在尝试完成目标: "${taskGoal}" 时遇到了阻碍或报错:
"${errorContext}"

为了不再犯同样的错误，并掌握这一新技能，请你反思刚才的错误原因，并输出一段稳健的、没有任何占位符的 TypeScript 可执行脚本。
请使用以下格式输出，系统将自动为你持久化到物理硬盘：

\`\`\`typescript
// 文件名: solve_task.ts
// 目标: [你的反思与总结]
export async function execute(sandbox, args) {
  // 你的坚如磐石的修复代码
}
\`\`\`
    `;

    // 使用当前的最强云端大模型进行深度反思
    const response = await this.modelManager.chat(
      [{ role: 'system', content: prompt }],
      { temperature: 0.2 } // 低温度保证代码严肃性
    );

    const codeMatch = response.match(/```typescript([\s\S]*?)```/);
    if (codeMatch) {
      const code = codeMatch[1].trim();
      const skillId = 'skill_' + Date.now();

      // 仅当用户显式开启 autoPersistCode 时才落盘到隔离区（绝不被加载路径引用）
      if (this.autoPersistCode) {
        const proposalPath = path.join(this.proposalsDir, `${skillId}.ts`);
        fs.writeFileSync(proposalPath, code, 'utf-8');

        // 保存一条全局突触记忆，宣告技能进化成功（待人工审阅，未自动加载）
        this.memoryStore.addMemory(
          `生成技能提案 ${skillId}.ts，等待人工审阅（未自动加载）`,
          'Self-Evolution',
          '["system-pending"]'
        );

        return `🧬 已生成技能提案（待人工审阅）: ${skillId}.ts`;
      }

      // 默认：仅返回文本，绝不落盘
      return `🧬 反思生成以下修复脚本（未自动保存）:\n\`\`\`typescript\n${code}\n\`\`\``;
    }

    return `> 🧬 **[系统进化中止]** 反思过程未能生成有效的底层代码。`;
  }
}
