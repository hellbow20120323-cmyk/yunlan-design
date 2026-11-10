import { useEffect } from 'react';

const ORIGIN = 'https://panso.hellbow.xyz';
const DEFAULT_TITLE = '云览 YUNLAN - 聚合云盘资源搜索引擎';
const DEFAULT_DESCRIPTION =
  '万象云盘，一览尽搜。专业高效的多网盘聚合搜索引擎，支持夸克网盘、阿里云盘、百度网盘、迅雷云盘、123云盘等主流平台，提供极速检索、文件预览、有效性检测与批量保存。';

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
export function usePageSeo(query: string, total: number | null) {
  useEffect(() => {
    const q = query.trim();
    const title = q
      ? `${q} - ${total != null && total >= 0 ? total : '…'}条网盘资源 | 云览`
      : DEFAULT_TITLE;
    const description = q
      ? `在云览搜索「${q}」，聚合夸克、阿里云盘、百度网盘、迅雷、123 等网盘公开分享${
          total != null && total > 0 ? `，共 ${total} 条结果` : ''
        }。`
      : DEFAULT_DESCRIPTION;
    const canonical = q ? `${ORIGIN}/?q=${encodeURIComponent(q)}` : `${ORIGIN}/`;

    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:url', canonical);
    upsertMeta('property', 'og:site_name', '云览');
    upsertMeta('property', 'og:locale', 'zh_CN');
    upsertMeta('property', 'og:image', `${ORIGIN}/logo.png`);
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertLink('canonical', canonical);

    return () => {
      document.title = DEFAULT_TITLE;
    };
  }, [query, total]);
}
