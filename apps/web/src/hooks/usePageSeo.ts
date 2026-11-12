import { useEffect } from 'react';

const ORIGIN = 'https://panso.hellbow.xyz';
const DEFAULT_TITLE = '自行车与家酿 VELO & BREW - 骑行计算、家酿啤酒与在线工具站';
const DEFAULT_DESCRIPTION =
  '自行车与家酿提供骑行工程计算、手工车架涂装、精酿啤酒配方与文本开发工具，全部在浏览器本地运行，不上传文件、无需注册。';

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const sel = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector(sel) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  el.href = href;
}

/** 搜索完成后更新标题、描述、canonical（JSON-LD 由网关写入 HTML，避免 CSP 拦内联脚本） */
export function usePageSeo(query: string, total: number | null, searchEnabled = true) {
  useEffect(() => {
    const q = searchEnabled ? query.trim() : '';
    const title = q
      ? `${q} - ${total != null && total >= 0 ? total : '…'}条公开资料 | 自行车与家酿`
      : DEFAULT_TITLE;
    const description = q
      ? `在自行车与家酿检索「${q}」相关的公开文档与资料索引${
          total != null && total > 0 ? `，共 ${total} 条结果` : ''
        }。`
      : DEFAULT_DESCRIPTION;
    const canonical = q ? `${ORIGIN}/?q=${encodeURIComponent(q)}` : `${ORIGIN}/`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:site_name', '自行车与家酿');
    upsertMeta('property', 'og:locale', 'zh_CN');
    upsertMeta('property', 'og:image', `${ORIGIN}/logo.png`);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertLink('canonical', canonical);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [query, total, searchEnabled]);
}
