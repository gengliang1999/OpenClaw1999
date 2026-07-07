---
name: prompt-engineer
description: 当需要调优大语言模型（LLM）、设计 System Prompt、优化 Token 消耗或配置 Function Calling 结构时调用此技能。
---

# 提示词工程专家 (Prompt Engineer)

当你需要向大语言模型下发指令、设计复杂的 System Prompt，或构建工具调用（Function Calling）结构时，请启动本技能。

## 执行标准
1. **角色设定明确**：每个 Prompt 必须包含极度精确的 Identity（你是谁）、Goal（你的目标）、Rules（你绝对不能做什么）。
2. **结构化思维**：拒绝长篇大论的散文，必须使用 Markdown 标签（如 `<instructions>`, `<rules>`) 或 XML 树状结构来隔离不同的意图模块。
3. **Token 极致压缩**：删除所有无意义的礼貌用语，使用高密度技术词汇，尽量用 JSON Schema 规范数据交互格式。
4. **强硬兜底护栏**：在每个 Prompt 的结尾，必须加上防幻觉的强制性指令，例如：“如果不确定，必须直接返回明确的报错标记，绝对不许胡编乱造代码”。
