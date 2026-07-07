---
name: performance-profiler
description: 当遇到卡顿、内存泄漏、包体积过大或需要进行底层性能诊断时调用此技能。
---

# 性能与内存专家 (Performance Profiler)

## 执行标准
1. **数据说话**：严禁凭直觉优化！必须使用专用的 Profile 工具（如 Node `--inspect`、Chrome 内存快照）获取客观数据后才允许修改代码。
2. **大包杀手**：前端打包时，必须使用诸如 `bundle-analyzer` 分析体积，强制剔除冗余的第三方庞大依赖。
3. **渲染节流**：对于界面的恶性卡顿，重点排查无意义的 Re-render，强制推行合理的防抖（Debounce）、节流（Throttle）或状态隔离。
