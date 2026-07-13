// P0/T1 + T2：IPC api:call 统一安全网关实测
// 通过 mock electron 的 ipcMain.handle 捕获注册的处理器，再直接调用模拟 event/options。

const mockRegisteredHandlers: Record<string, Function> = {};

jest.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, fn: Function) => {
      mockRegisteredHandlers[channel] = fn;
    }
  },
  safeStorage: undefined
}), { virtual: true });

const { registerApiIpc } = require('../../src/main/ipc-handlers');

describe('IPC api:call 安全网关 (P0/T1 来源+令牌, T2 RBAC)', () => {
  const EXPECTED_TOKEN = 'test-api-token-123';
  let permissionManager: any;

  beforeAll(() => {
    // 默认策略：除 sandbox/execute 外全部放行，便于命中 RBAC 拦截分支
    permissionManager = {
      checkPermission: jest.fn((resource: string, action: string) => {
        if (resource === 'sandbox' && action === 'execute') return false;
        return true;
      })
    };

    const deps: any = {
      memoryStore: {},
      modelManager: {},
      sandbox: {},
      permissionManager,
      automation: {},
      baseDataDir: '/tmp/oc-base',
      // 指向不存在的文件，使 global-config GET 走默认值分支
      globalConfigPath: '/tmp/oc-base/__nonexistent_global_config.json',
      dataDir: '/tmp/oc-data',
      queueManager: {},
      folderWatcher: {},
      jobQueue: {}
    };

    registerApiIpc(deps, () => null, EXPECTED_TOKEN);
  });

  function getHandler(): Function {
    const h = mockRegisteredHandlers['api:call'];
    if (!h) throw new Error('api:call 处理器未被注册 —— 网关可能未接线');
    return h;
  }

  it('伪造来源（http://evil）被来源白名单拦截', async () => {
    const handler = getHandler();
    const event = { sender: { getURL: () => 'http://evil.example.com' } };
    await expect(
      handler(event, {
        url: '/sandbox/execute',
        options: { __token: EXPECTED_TOKEN, method: 'POST', body: { command: 'rm -rf /' } }
      })
    ).rejects.toThrow(/FORBIDDEN: invalid origin/);
  });

  it('令牌缺失或错误均被拦截', async () => {
    const handler = getHandler();
    const event = { senderFrame: { url: 'claw://app/index.html' } };
    await expect(
      handler(event, { url: '/system/global-config', options: { method: 'GET' } })
    ).rejects.toThrow(/FORBIDDEN: invalid api token/);

    await expect(
      handler(event, { url: '/system/global-config', options: { __token: 'wrong-token', method: 'GET' } })
    ).rejects.toThrow(/FORBIDDEN: invalid api token/);
  });

  it('RBAC 越权（sandbox/execute 无权限）被拒绝', async () => {
    const handler = getHandler();
    const event = { senderFrame: { url: 'claw://app/index.html' } };
    await expect(
      handler(event, {
        url: '/sandbox/execute',
        options: { __token: EXPECTED_TOKEN, method: 'POST', body: { command: 'echo hi' } }
      })
    ).rejects.toThrow(/FORBIDDEN: insufficient permission/);
  });

  it('file:// 来源同样被允许（与 claw:// 等价）', async () => {
    const handler = getHandler();
    const event = { senderFrame: { url: 'file:///index.html' } };
    const res = await handler(event, {
      url: '/system/global-config',
      options: { __token: EXPECTED_TOKEN, method: 'GET' }
    });
    expect(res).toHaveProperty('customDataDir', '/tmp/oc-base');
  });

  it('来源 + 令牌 + 权限齐备时网关放行到路由层', async () => {
    const handler = getHandler();
    const event = { senderFrame: { url: 'claw://app/index.html' } };
    // /system/global-config 无 ROUTE_PERMISSIONS 条目，断言网关放行后命中路由
    const res = await handler(event, {
      url: '/system/global-config',
      options: { __token: EXPECTED_TOKEN, method: 'GET' }
    });
    expect(res).toHaveProperty('customDataDir', '/tmp/oc-base');
    expect(res).toHaveProperty('customDownloadDir', '/tmp/oc-base');
  });
});
