import * as cheerio from 'cheerio';
import { assertSafeUrl } from './ssrf-guard';

export class DataCrawler {
  /**
   * 抓取 URL 内容，并使用 cheerio 清洗出网页干净的文本内容。
   * 调用前强制经过 SSRF 防护（assertSafeUrl）：阻断私网 / 回环 / 非 http(s) / 不在白名单的地址。
   * @param url - 目标网址
   * @param opts - 可选配置（allowlistDomains 域名白名单）
   * @returns 过滤出的纯文本正文
   */
  public static async crawlUrl(url: string, opts: { allowlistDomains?: string[] } = {}): Promise<string> {
    // SSRF 防护：先校验 URL 与目标地址安全性
    await assertSafeUrl(url, { allowlistDomains: opts.allowlistDomains });

    const fetchFn = (globalThis as any).fetch || require('node-fetch');
    const response = await fetchFn(url, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`HTTP 抓取失败，状态码: ${response.status}`);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const paragraphs: string[] = [];
    $('p').each((i: number, el: any) => {
      if (i < 30) { // 限制初筛前 30 个段落，防止侧边栏杂音
        const txt = $(el).text().trim();
        if (txt.length > 10) paragraphs.push(txt);
      }
    });

    const rawText = paragraphs.join('\n');
    if (!rawText || rawText.trim().length < 20) {
      throw new Error('提取到的有效正文字数过短（小于 20 字），可能被防爬拦截或内容为空');
    }

    return rawText;
  }
}
