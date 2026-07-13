"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSafeUrl = assertSafeUrl;
/**
 * OpenClaw SSRF 防护 (SSRF Guard)
 *
 * 在发起对外抓取/请求前调用，阻断：
 *   - 非 http/https 协议（file://、ftp://、gopher:// 等）
 *   - 私网 / 回环 / 链路本地地址（10.x、172.16-31.x、192.168.x、127.x、169.254.x、IPv6 等价段）
 *   - 不在白名单域名列表中的目标（可选 allowlist）
 */
const dns_1 = require("dns");
/** 私网 / 回环 / 链路本地 地址段 */
const PRIVATE_RANGES = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^169\.254\./,
    /^::1$/,
    /^fc00:/,
    /^fe80:/,
];
function isPrivateIp(address) {
    return PRIVATE_RANGES.some((re) => re.test(address.trim()));
}
/**
 * 断言 URL 安全可抓取；不安全则抛出 Error。
 * @param url 待校验的 URL
 * @param opts 可选配置（allowlistDomains）
 */
async function assertSafeUrl(url, opts = {}) {
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch (e) {
        throw new Error('invalid url: ' + url);
    }
    // 仅允许 http/https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('scheme blocked: ' + parsed.protocol);
    }
    // 域名白名单
    if (opts.allowlistDomains && opts.allowlistDomains.length > 0) {
        if (!opts.allowlistDomains.includes(parsed.hostname)) {
            throw new Error('domain not in allowlist: ' + parsed.hostname);
        }
    }
    // 解析所有 IP 并拦截私网
    let addresses;
    try {
        addresses = await dns_1.promises.lookup(parsed.hostname, { all: true });
    }
    catch (e) {
        // DNS 解析失败也视为不可信，阻断
        throw new Error('dns resolution failed: ' + parsed.hostname);
    }
    for (const { address } of addresses) {
        if (isPrivateIp(address)) {
            throw new Error('private ip blocked: ' + address);
        }
    }
}
