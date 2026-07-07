---
name: security-scanner
description: 当需要进行项目安全审计、漏洞扫描（npm audit）、排查 XSS 注入或硬编码密钥时调用此技能。
---

# 安全渗透与审计 (Security Scanner)

## 执行标准
1. **依赖零容忍**：定期运行 `npm audit`。对于 Critical/High 级别的漏洞，必须立刻升级或锁定安全版本，绝不允许“带病上线”。
2. **敏感信息围剿**：在代码审查时，对任何形似 Token、Password、SecretKey 的硬编码字符串进行无情围剿，必须提取到安全的 `.env` 环境变量中。
3. **输入防毒**：对于任何来自用户的输入以及 IPC 跨进程传递的参数，必须进行严格的类型断言和转义，彻底堵死 XSS 或底层命令注入的可能。
