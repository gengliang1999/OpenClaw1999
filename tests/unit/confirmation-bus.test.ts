const { ConfirmationBus, confirmationBus } = require('../../src/backend/confirmation-bus');

describe('ConfirmationBus (S5 确认回灌)', () => {
  it('wait 返回 id 与 promise，resolve 唤醒并回传决策', async () => {
    const bus = new ConfirmationBus();
    const { id, promise } = bus.wait(1000);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    const resolvePromise = bus.resolve(id, { decision: 'confirmed', permanent: true });
    expect(resolvePromise).toBe(true);
    const result = await promise;
    expect(result).toEqual({ decision: 'confirmed', permanent: true });
  });

  it('resolve 未知 id 返回 false', () => {
    const bus = new ConfirmationBus();
    expect(bus.resolve('not-exist', { decision: 'rejected', permanent: false })).toBe(false);
  });

  it('同一 confirmationId 仅消费一次（二次 resolve 无效）', async () => {
    const bus = new ConfirmationBus();
    const { id, promise } = bus.wait(1000);
    expect(bus.resolve(id, { decision: 'confirmed', permanent: false })).toBe(true);
    // 第二次 resolve 同一 id 已失效
    expect(bus.resolve(id, { decision: 'rejected', permanent: true })).toBe(false);
    // promise 仍是最初的 confirmed 结果
    const result = await promise;
    expect(result).toEqual({ decision: 'confirmed', permanent: false });
  });

  it('超时按 timeout 决策 settle（不永久挂起）', async () => {
    const bus = new ConfirmationBus();
    const { promise } = bus.wait(20); // 20ms 后超时
    const result = await promise;
    expect(result).toEqual({ decision: 'timeout', permanent: false });
  });

  it('单例 confirmationBus 可用', () => {
    expect(confirmationBus).toBeDefined();
    expect(typeof confirmationBus.wait).toBe('function');
  });
});
