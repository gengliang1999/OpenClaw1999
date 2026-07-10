---
name: llm-connector-expert
description: 当需要调配、诊断、调试本地模型（如 Llama.cpp, Jan, GPT4All, Ollama）或云端大模型 API（如 SiliconFlow, DeepSeek, OpenAI）的 HTTP 连接、流式相应、流式断流、重试退避策略与负载均衡时调用此技能。
---

# LLM Connector Expert (大模型连接与 API 调试专家)

当您在系统日志中看到“模型未运行或连接失败”、“断流”、“连接超时”、“流响应解析错误”等异常时，必须立刻启用此技能开展标准化排查。

## 核心诊断规程

### 1. 本地模型连通性验证 (Local Models)
- **Llama.cpp / Ollama / Jan / GPT4All**:
  - 默认端口检测：
    - Llama.cpp: `http://127.0.0.1:8080/v1`
    - Ollama: `http://127.0.0.1:11434/v1`
    - Jan: `http://127.0.0.1:1337/v1`
  - 使用标准的 HTTP POST 发送最简 payload（如 `{"model": "test", "messages": [{"role": "user", "content": "ping"}]}`）验证端点是否返回合法的 JSON 响应。

### 2. 流式相应 (SSE) 完整性校验
- Electron 与 Node.js 端处理大模型 `stream: true` 时，必须确保 SSE（Server-Sent Events）的解析器能够防范粘包和半包：
  - 流的逐行读取应使用标准的缓冲行拆分器（如逐行读取并匹配 `data: ` 前缀）。
  - 如果收到空行或 `data: [DONE]`，必须安全地关闭 Stream，不能发生挂起或导致渲染进程一直处于 Loading 状态。

### 3. 连接性防灾保障：指数退避与超时控制
- **超时设置**：非流式请求设置不超过 30s 的超时阈值，流式首字（First Token）超时设置不超过 10s，防范渲染进程卡死。
- **重试机制**：使用带有抖动（Jitter）的指数退避重试算法（Exponential Backoff）：
  $$T_{wait} = \min(T_{max}, T_{base} \times 2^{attempt}) \pm \text{Jitter}$$
  避免在 API 网关出现 429 (Too Many Requests) 时盲目重试加重网关崩溃。

## 调试排查清单
1. **网络拦截**：检查本地代理服务器（如 System Proxy, VPN）是否拦截了本地环回地址（`localhost`、`127.0.0.1`）。
2. **API 密钥规范**：对于云端服务，检查 `Authorization` 请求头是否多加/漏加了 `Bearer ` 前缀。
3. **Payload 匹配度**：有些模型不支持 `system` 角色或不支持 `temperature=0` 的边界参数，诊断时必须在 payload 里使用最保守的参数配置测试。
