"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolutionEngine = void 0;
// @ts-nocheck
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class EvolutionEngine {
    skillsDir;
    memoryStore;
    modelManager;
    constructor(baseDataDir, memoryStore, modelManager) {
        this.skillsDir = path.join(baseDataDir, '.agents', 'skills');
        this.memoryStore = memoryStore;
        this.modelManager = modelManager;
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }
    /**
     * 触发自我反思与技能固化
     * @param errorContext 失败的上下文或执行报错
     * @param taskGoal 最初试图达成的目标
     */
    async evolve(errorContext, taskGoal) {
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
        const response = await this.modelManager.chat([{ role: 'system', content: prompt }], { temperature: 0.2 } // 低温度保证代码严肃性
        );
        const codeMatch = response.match(/```typescript([\s\S]*?)```/);
        if (codeMatch) {
            const code = codeMatch[1].trim();
            const skillId = 'skill_' + Date.now();
            const skillPath = path.join(this.skillsDir, `${skillId}.ts`);
            fs.writeFileSync(skillPath, code, 'utf-8');
            // 保存一条全局突触记忆，宣告技能进化成功
            this.memoryStore.addMemory(`我已经学会了如何处理 "${taskGoal}"，并将技能固化在 ${skillId}.ts 中，下次遇到类似问题请直接调用该脚本。`, 'Self-Evolution', '["system-auto"]');
            return `> 🧬 **[系统进化完成]** 经过深度反思，我已将报错的解决方案提炼为物理级永久技能，固化在: \`${skillId}.ts\`。`;
        }
        return `> 🧬 **[系统进化中止]** 反思过程未能生成有效的底层代码。`;
    }
}
exports.EvolutionEngine = EvolutionEngine;
