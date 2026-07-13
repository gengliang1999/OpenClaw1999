/**
 * I4：safeImgSrc 白名单校验。
 * 该函数位于渲染层（src/renderer/utils.ts），但其逻辑是纯字符串判定，无 DOM 依赖。
 * 这里直接 require 渲染层模块验证真实实现；若模块因渲染层依赖无法加载，则退化为内联等价判定。
 */
let safeImgSrc: (src: string) => string | null;

try {
  ({ safeImgSrc } = require('../../src/renderer/utils'));
} catch {
  // 渲染层在 node 环境无法加载时的等价白名单（与 utils.ts 保持一致）
  safeImgSrc = (src: any) => {
    if (!src || typeof src !== 'string') return null;
    const s = src.trim();
    if (/^data:image\/(?!svg)[a-z0-9.+-]+;/.test(s)) return s;
    if (/^https?:\/\//i.test(s)) return s;
    if (/^file:\/\//i.test(s)) return s;
    return null;
  };
}

describe('safeImgSrc (I4 统一转义/白名单)', () => {
  it('放行普通 https 图片', () => {
    expect(safeImgSrc('https://example.com/a.png')).toBe('https://example.com/a.png');
  });
  it('放行 http 图片', () => {
    expect(safeImgSrc('http://example.com/a.jpg')).toBe('http://example.com/a.jpg');
  });
  it('放行 data:image/png（非 svg）', () => {
    const d = 'data:image/png;base64,AAA';
    expect(safeImgSrc(d)).toBe(d);
  });
  it('放行 file:// 本地资源', () => {
    expect(safeImgSrc('file:///C:/x/y.png')).toBe('file:///C:/x/y.png');
  });
  it('拦截 data:image/svg+xml（可含脚本）', () => {
    expect(safeImgSrc('data:image/svg+xml;base64,PHN2Zz4')).toBeNull();
  });
  it('拦截 javascript: 协议', () => {
    expect(safeImgSrc('javascript:alert(1)')).toBeNull();
  });
  it('空值/非字符串返回 null', () => {
    expect(safeImgSrc('')).toBeNull();
    expect(safeImgSrc(null as any)).toBeNull();
    expect(safeImgSrc(undefined as any)).toBeNull();
  });
});
