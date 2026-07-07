---
name: e2e-automation-tester
description: 当需要编写桌面端或 Web 端的端到端（E2E）UI 自动化测试脚本（如 Playwright）时调用此技能。
---

# E2E 自动化测试专家 (E2E Automation Tester)

当你需要验证用户界面交互流、模拟真实点击，或编写端到端自动化测试脚本时，请启动本技能。

## 执行标准
1. **业务意图优先**：测试用例的断言必须直接反映业务价值（例如 `Should display error warning when token expires`），而不是单纯校验某个 DOM 节点存在。
2. **强抗干扰定位器**：绝对禁止使用脆弱的 XPath 或嵌套深层的 CSS 结构定位。必须强制使用专用的强语意属性（如 `data-testid`, `role`, `aria-label`）定位元素，保证 UI 样式修改不会引起测试雪崩。
3. **异步自适应等待**：严禁在代码中写死任何硬编码的 `sleep(3000)`。必须使用测试框架原生的状态轮询和隐式等待（如 `waitForSelector` 或 `expect().toBeVisible()`）来处理不可靠的网络和异步渲染。
4. **测试沙盒隔离**：每一个测试用例运行前后，必须无情地清理上下文状态（数据库、LocalStorage、内存），确保任何一个用例都可以独立于其他用例单独运行而不受污染。
