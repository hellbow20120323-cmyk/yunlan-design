/**
 * 搜索结果页 SEO：改写首页 HTML 的 title/description/canonical，
 * 对搜索引擎爬虫额外预渲染结果列表（不扣积分）。
 */
import fs from "node:fs";
import path from "node:path";
import { WEB_DIST } from "./paths.js";
import { ALL_CLOUD_TYPES } from "./search.js";
import { searchMulti } from "./sources/aggregate.js";

export const PUBLIC_ORIGIN = (process.env.PUBLIC_ORIGIN || "https://panso.hellbow.xyz").replace(/\/$/, "");

export const DEFAULT_TITLE = "云览 YUNLAN - 免费在线文档与文本工具站";
export const DEFAULT_DESCRIPTION =
  "云览提供免费的在线文档资料检索、文本统计与格式化、Base64 / URL 编解码、JSON 格式化校验、图片转 Base64 等工具，全部在浏览器本地处理，无需注册。";

/** 搜索入口开关：false 时站点对外只呈现工具页，搜索相关路由与内容全部隐藏 */
export function isSearchEnabled() {
  return !["0", "false", "no", "off"].includes(
    String(process.env.SEARCH_ENABLED ?? "true").toLowerCase()
  );
}

/** 合规工具页的标题与描述（同时用于 sitemap 与页面 meta） */
export const TOOL_PAGES = {
  "": {
    title: "免费在线工具 - 文档检索、文本处理、格式转换 | 云览",
    description:
      "云览免费在线工具箱：文本统计与格式化、Base64 / URL 编解码、JSON 格式化校验、图片转 Base64，以及公开文档资料检索，全部本地处理，不上传文件。",
  },
  text: {
    title: "在线文本统计与格式化工具 - 字数统计、去重、排序 | 云览",
    description:
      "免费在线文本处理工具：实时统计字数、字符数与行数，一键去除空行、去重、排序、大小写转换，纯浏览器本地处理。",
  },
  base64: {
    title: "Base64 与 URL 编码解码工具 - 在线转换 | 云览",
    description:
      "免费在线 Base64 / URL 编解码工具，支持中文 UTF-8，编码解码结果实时生成，数据仅在浏览器本地处理。",
  },
  json: {
    title: "JSON 格式化与校验工具 - 在线美化、压缩 | 云览",
    description:
      "免费在线 JSON 工具：一键格式化美化、压缩、语法校验并定位错误，适合接口调试与配置整理，本地处理不上传。",
  },
  image: {
    title: "图片转 Base64 在线工具 - 本地转换 | 云览",
    description:
      "免费在线图片转 Base64 工具，支持 PNG / JPG / GIF / WebP，直接生成 Data URL，可复制用于 HTML 或 CSS，图片不上传服务器。",
  },
};

export const TOOL_SLUGS = Object.keys(TOOL_PAGES).filter(Boolean);

const BOT_RE =
  /baiduspider|googlebot|bingbot|duckduckbot|yandex|sogou|360spider|bytespider|twitterbot|facebookexternalhit|linkedinbot|slackbot|discordbot|whatsapp|telegrambot|applebot|petalbot|yeti|ia_archiver/i;

const SEO_SEARCH_TIMEOUT_MS = Number(process.env.SEO_SEARCH_TIMEOUT_MS || 12_000);
const SEO_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SEO_CACHE_MAX = 300;

/** @type {Map<string, { at: number, value: { total: number, results: Array<{ title: string, url: string, cloudType: string }> } }>} */
const prerenderCache = new Map();

export function isSeoBot(ua) {
  return BOT_RE.test(String(ua || ""));
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function searchPageTitle(kw, total) {
  const q = String(kw || "").trim();
  if (!q) return DEFAULT_TITLE;
  const n = Number.isFinite(total) && total >= 0 ? total : null;
  return n == null ? `${q} - 公开资料检索 | 云览` : `${q} - ${n}条公开资料 | 云览`;
}

export function searchPageDescription(kw, total) {
  const q = String(kw || "").trim();
  if (!q) return DEFAULT_DESCRIPTION;
  const n = Number.isFinite(total) && total > 0 ? `${total} 条` : "多条";
  return `在云览检索「${q}」相关的公开文档与资料索引，共 ${n} 结果，支持格式筛选与有效性标注。`;
}

export function searchCanonical(kw) {
  const q = String(kw || "").trim();
  if (!q) return `${PUBLIC_ORIGIN}/`;
  return `${PUBLIC_ORIGIN}/?q=${encodeURIComponent(q)}`;
}

function upsertMeta(html, attr, key, content) {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n</head>`);
}

function upsertLink(html, rel, href) {
  const re = new RegExp(`<link[^>]+rel=["']${rel}["'][^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}" />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace("</head>", `  ${tag}\n</head>`);
}

function upsertTitle(html, title) {
  if (/<title>[\s\S]*?<\/title>/i.test(html)) {
    return html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
  }
  return html.replace("</head>", `  <title>${escapeHtml(title)}</title>\n</head>`);
}

function websiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "云览",
    alternateName: "YUNLAN",
    url: `${PUBLIC_ORIGIN}/`,
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: `${PUBLIC_ORIGIN}/?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

function itemListJsonLd(kw, results) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${kw} 公开资料`,
    numberOfItems: results.length,
    itemListElement: results.slice(0, 20).map((r, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: r.title,
      url: r.url,
    })),
  };
}

function injectJsonLd(html, objects) {
  const block = objects
    .map(
      (obj) =>
        `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`
    )
    .join("\n  ");
  return html.replace("</head>", `  ${block}\n</head>`);
}

function crawlerBody(kw, pack) {
  const items = pack?.results || [];
  const lis = items
    .slice(0, 30)
    .map((r) => {
      const href = escapeHtml(r.url);
      const title = escapeHtml(r.title || r.url);
      const type = escapeHtml(r.cloudType || "");
      return `<li><a href="${href}" rel="nofollow noopener">${title}</a>${type ? ` <span>${type}</span>` : ""}</li>`;
    })
    .join("");
  const h1 = escapeHtml(`${kw} 公开资料`);
  const desc = escapeHtml(searchPageDescription(kw, pack?.total ?? items.length));
  return `<div id="root"><main><h1>${h1}</h1><p>${desc}</p>${
    lis ? `<ol>${lis}</ol>` : "<p>暂无公开结果。</p>"
  }</main></div>`;
}

function replaceRoot(html, inner) {
  if (/<div id="root"><\/div>/.test(html)) {
    return html.replace(/<div id="root"><\/div>/, inner);
  }
  return html.replace(/<div id="root">[\s\S]*?<\/div>/, inner);
}

let indexTemplate = "";
let indexMtime = 0;

export function readIndexHtml() {
  const file = path.join(WEB_DIST, "index.html");
  try {
    const mtime = fs.statSync(file).mtimeMs;
    if (indexTemplate && indexMtime === mtime) return indexTemplate;
    indexTemplate = fs.readFileSync(file, "utf8");
    indexMtime = mtime;
    return indexTemplate;
  } catch {
    return "";
  }
}

/**
 * @param {string} html
 * @param {{ kw?: string, total?: number, results?: Array<{ title: string, url: string, cloudType?: string }>, prerender?: boolean, path?: string, searchEnabled?: boolean }} opts
 */
export function applySeoToHtml(html, opts = {}) {
  const searchEnabled = opts.searchEnabled ?? isSearchEnabled();
  /** 搜索入口关闭时，忽略查询词，页面保持工具站定位 */
  const kw = searchEnabled ? String(opts.kw || "").trim() : "";
  const total = opts.total;
  const pathname = normalizePath(opts.path);
  const toolMeta = toolMetaForPath(pathname);
  const noindex = pathname === "/support" || pathname.startsWith("/support/");
  const title = toolMeta ? toolMeta.title : searchPageTitle(kw, total);
  const description = toolMeta ? toolMeta.description : searchPageDescription(kw, total);
  const canonical = toolMeta ? `${PUBLIC_ORIGIN}${pathname}` : searchCanonical(kw);
  let out = html;
  out = upsertTitle(out, title);
  out = upsertMeta(out, "name", "description", description);
  out = upsertMeta(out, "name", "robots", noindex ? "noindex,follow" : "index,follow");
  out = upsertMeta(out, "property", "og:title", title);
  out = upsertMeta(out, "property", "og:description", description);
  out = upsertMeta(out, "property", "og:url", canonical);
  out = upsertMeta(out, "property", "og:type", "website");
  out = upsertMeta(out, "property", "og:site_name", "云览");
  out = upsertMeta(out, "property", "og:locale", "zh_CN");
  out = upsertMeta(out, "property", "og:image", `${PUBLIC_ORIGIN}/logo.png`);
  out = upsertMeta(out, "name", "twitter:card", "summary_large_image");
  out = upsertMeta(out, "name", "twitter:title", title);
  out = upsertMeta(out, "name", "twitter:description", description);
  out = upsertLink(out, "canonical", canonical);
  const ld = [websiteJsonLd()];
  if (kw && Array.isArray(opts.results) && opts.results.length) {
    ld.push(itemListJsonLd(kw, opts.results));
  }
  out = injectJsonLd(out, ld);
  if (opts.prerender && kw) {
    out = replaceRoot(out, crawlerBody(kw, { total, results: opts.results || [] }));
  }
  return out;
}

function normalizePath(pathname) {
  const p = String(pathname || "/").split("?")[0].replace(/\/+$/, "");
  return p || "/";
}

/** @returns {{ title: string, description: string } | null} */
function toolMetaForPath(pathname) {
  if (pathname === "/tools") return TOOL_PAGES[""];
  const match = /^\/tools\/([a-z0-9-]+)$/.exec(pathname);
  if (!match) return null;
  return TOOL_PAGES[match[1]] || TOOL_PAGES[""];
}

async function prerenderSearch(kw) {
  const key = kw.trim().toLowerCase();
  const hit = prerenderCache.get(key);
  if (hit && Date.now() - hit.at < SEO_CACHE_TTL_MS) return hit.value;

  const running = prerenderSearch._inflight?.get(key);
  if (running) return running;

  const task = (async () => {
    const started = Date.now();
    try {
      const pack = await Promise.race([
        searchMulti({
          kw,
          cloudTypes: ALL_CLOUD_TYPES,
          engineUrl: (process.env.ENGINE_URL || "").trim(),
          forceDemo: ["1", "true", "yes"].includes(String(process.env.DEMO_MODE || "").toLowerCase()),
          enableExt: !["0", "false", "no"].includes(String(process.env.ENABLE_EXT_SOURCES ?? "1").toLowerCase()),
          enableWeibo: false,
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("seo search timeout")), SEO_SEARCH_TIMEOUT_MS)
        ),
      ]);
      const results = (pack.results || []).slice(0, 30).map((r) => ({
        title: String(r.title || "").slice(0, 160),
        url: String(r.url || ""),
        cloudType: String(r.cloudType || ""),
      }));
      const value = { total: pack.results?.length ?? results.length, results, tookMs: Date.now() - started };
      if (prerenderCache.size >= SEO_CACHE_MAX) {
        const oldest = prerenderCache.keys().next().value;
        if (oldest !== undefined) prerenderCache.delete(oldest);
      }
      prerenderCache.set(key, { at: Date.now(), value });
      return value;
    } catch {
      return { total: 0, results: [], tookMs: Date.now() - started };
    } finally {
      prerenderSearch._inflight?.delete(key);
    }
  })();

  prerenderSearch._inflight ||= new Map();
  prerenderSearch._inflight.set(key, task);
  return task;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function sendSeoIndex(req, res) {
  const html = readIndexHtml();
  if (!html) {
    res.status(404).json({ error: "Web UI 未构建，请先 npm run build 或分别启动 gateway/web" });
    return;
  }
  const searchEnabled = isSearchEnabled();
  const kw = searchEnabled
    ? String(req.query?.q || req.query?.kw || "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 80)
    : "";
  const bot = isSeoBot(req.headers["user-agent"]);
  /** @type {{ total?: number, results?: any[] }} */
  let pack = {};
  if (kw && bot) {
    pack = await prerenderSearch(kw);
  }
  const out = applySeoToHtml(html, {
    kw,
    total: pack.total,
    results: pack.results,
    prerender: Boolean(kw && bot),
    path: req.path,
    searchEnabled,
  });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", kw ? "public, max-age=300" : "no-cache");
  res.send(out);
}

/**
 * @param {Array<{ keyword?: string, title?: string }>} hotItems
 * @param {{ searchEnabled?: boolean }} [opts]
 */
export function buildSitemapXml(hotItems = [], opts = {}) {
  const searchEnabled = opts.searchEnabled ?? isSearchEnabled();
  const urls = [`${PUBLIC_ORIGIN}/`, `${PUBLIC_ORIGIN}/tools`];
  const seen = new Set();
  for (const slug of TOOL_SLUGS) {
    urls.push(`${PUBLIC_ORIGIN}/tools/${slug}`);
  }
  if (searchEnabled) {
    for (const item of hotItems) {
      const kw = String(item?.keyword || item?.title || "")
        .trim()
        .slice(0, 80);
      if (!kw || seen.has(kw)) continue;
      seen.add(kw);
      urls.push(searchCanonical(kw));
      if (urls.length >= 200) break;
    }
  }
  const body = urls
    .map(
      (loc) =>
        `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <changefreq>${loc === `${PUBLIC_ORIGIN}/` ? "daily" : "weekly"}</changefreq>\n  </url>`
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}
