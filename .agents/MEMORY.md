# [SYS_MAP]

STACK: [React/Vue, TypeScript, Node.js] # 替换为你的技术栈
CMD_VERIFY: `npm run lint && npm run build` # 替换为你的测试/构建命令

# [DIR_ROUTING]

/src/api -> 网络请求与接口契约
/src/components -> UI渲染与交互
/src/utils -> 纯函数与全局挂载

# [RED_LINES]

1. SECRETS_ONLY_IN_ENV
2. STRICT_TYPE_NO_ANY
3. ATOMIC_WRITE_ONLY
