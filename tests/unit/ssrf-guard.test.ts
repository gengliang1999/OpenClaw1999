// 离线、确定性：mock dns.lookup，避免真实 DNS 依赖
jest.mock('dns', () => ({
  promises: {
    lookup: jest.fn(),
  },
}));

import dns from 'dns';
import { assertSafeUrl } from '../../src/backend/ssrf-guard';

const lookupMock = (dns.promises as any).lookup as jest.Mock;

describe('ssrf-guard / assertSafeUrl (P0/T5)', () => {
  afterEach(() => lookupMock.mockReset());

  it('拦截非 http/https 协议', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow();
    await expect(assertSafeUrl('ftp://example.com')).rejects.toThrow();
    await expect(assertSafeUrl('gopher://x')).rejects.toThrow();
  });

  it('拦截回环地址', async () => {
    lookupMock.mockResolvedValue([{ address: '127.0.0.1' }]);
    await expect(assertSafeUrl('http://127.0.0.1:8080/')).rejects.toThrow(/private ip blocked/);
  });

  it('拦截链路本地/云元数据地址', async () => {
    lookupMock.mockResolvedValue([{ address: '169.254.169.254' }]);
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(/private ip blocked/);
  });

  it('拦截内网私网地址', async () => {
    lookupMock.mockResolvedValue([{ address: '192.168.1.1' }]);
    await expect(assertSafeUrl('http://192.168.1.1/admin')).rejects.toThrow(/private ip blocked/);
    lookupMock.mockResolvedValue([{ address: '10.0.0.5' }]);
    await expect(assertSafeUrl('http://10.0.0.5/')).rejects.toThrow(/private ip blocked/);
    lookupMock.mockResolvedValue([{ address: '172.16.0.1' }]);
    await expect(assertSafeUrl('http://172.16.0.1/')).rejects.toThrow(/private ip blocked/);
  });

  it('放行公网地址', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34' }]);
    await expect(assertSafeUrl('https://example.com/page')).resolves.toBeUndefined();
  });

  it('域名白名单：非白名单域名被拒，白名单域名且公网 IP 放行', async () => {
    lookupMock.mockResolvedValue([{ address: '93.184.216.34' }]);
    await expect(assertSafeUrl('https://evil.com', { allowlistDomains: ['example.com'] })).rejects.toThrow(/domain not in allowlist/);
    await expect(assertSafeUrl('https://example.com', { allowlistDomains: ['example.com'] })).resolves.toBeUndefined();
  });
});
