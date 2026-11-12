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
      "云览免费在线工具箱：Unix 时间戳转换、文本统计与格式化、Base64 / URL 编解码、JSON 格式化校验、哈希计算、随机密码生成、图片转 Base64，以及骑行与家酿啤酒计算器，全部本地处理。",
  },
  timestamp: {
    title: "Unix 时间戳转换工具 - 时间戳与日期互转 | 云览",
    description:
      "免费在线 Unix 时间戳转换工具，支持秒级与毫秒级时间戳，一键在时间戳、本地日期与 UTC ISO 之间互转，本地计算不上传。",
  },
  dev: {
    title: "文本与开发工具 - 编码转换、哈希、时间戳 | 云览",
    description:
      "云览文本与开发工具合集：文本统计与格式化、Unix 时间戳转换、Base64 / URL 编解码、JSON 格式化校验、哈希计算、随机密码生成、图片转 Base64。",
  },
  cycling: {
    title: "骑行计算工具 - 齿比、踏频、轮组与功率 | 云览",
    description:
      "云览骑行计算工具合集：齿比与行进距离、踏频配速换算、链条节数、轮组周长、最佳胎压、爬坡坡度等级与骑行功率估算。",
  },
  brewing: {
    title: "家酿啤酒计算工具 - ABV、IBU、SRM 与补糖 | 云览",
    description:
      "云览家酿啤酒计算工具合集：ABV 酒精度、IBU 苦度、SRM 色度、酵母投放量、装瓶补糖、桶装碳酸化、管路平衡、热量与 BAC 估算。",
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
  hash: {
    title: "在线文本哈希计算工具 - SHA-1 / SHA-256 / SHA-512 | 云览",
    description:
      "免费在线哈希计算工具，支持 SHA-1、SHA-256、SHA-384、SHA-512 文本摘要，十六进制结果实时生成，全部在浏览器本地计算。",
  },
  password: {
    title: "随机密码生成器 - 在线生成强密码 | 云览",
    description:
      "免费在线随机密码生成器，可自定义长度与大小写字母、数字、符号组合，使用浏览器加密随机数生成，密码不离开本地。",
  },
  gear: {
    title: "自行车齿比与行进距离计算器 - Gear Inches | 云览",
    description:
      "免费在线自行车齿比计算器，输入牙盘与飞轮齿数即可得到齿比、Gear Inches 与每踩踏一圈的前进距离。",
  },
  cadence: {
    title: "踏频与速度换算器 - 自行车配速计算 | 云览",
    description:
      "免费在线踏频换算工具，根据踏频、齿比与轮胎周长估算理论车速，并可对比不同踏频区间的速度。",
  },
  chain: {
    title: "自行车链条节数计算器 - 链长精确计算 | 云览",
    description:
      "免费在线链条节数计算器，按最大牙盘、最大飞轮与后下叉长度估算链条节数与长度，支持带后拨车架。",
  },
  wheel: {
    title: "轮组与外胎真实周长计算器 - 码表设置 | 云览",
    description:
      "免费在线轮组周长计算器，按轮圈 BSD 与外胎宽度计算滚动直径、真实周长与每公里圈数，方便码表设置。",
  },
  pressure: {
    title: "自行车轮胎最佳胎压计算器 - 前后轮建议 | 云览",
    description:
      "免费在线公路车胎压计算器，按人车总重量、胎宽与真空胎设置估算前后轮推荐胎压，兼顾滚阻与舒适性。",
  },
  climb: {
    title: "爬坡坡度与等级判定计算器 | 云览",
    description:
      "免费在线爬坡计算器，输入累计爬升与坡段长度，计算平均坡度、倾角与 HC/1/2/3/4 级爬坡等级。",
  },
  power: {
    title: "骑行功率估算器 - Watts 与 W/kg | 云览",
    description:
      "免费在线骑行功率估算工具，按体重、车速、坡度与风阻估算所需 Watts 与功率体重比，并拆分风阻、滚阻与重力。",
  },
  abv: {
    title: "ABV 酒精度计算器 - OG/FG 换算 | 云览",
    description:
      "免费在线啤酒酒精度计算器，输入初始比重与最终比重即可计算 ABV，支持 SG 与 Brix 糖度切换。",
  },
  ibu: {
    title: "IBU 苦度计算器 - Tinseth 公式 | 云览",
    description:
      "免费在线 IBU 苦度计算器，按批次体积、OG、啤酒花重量、Alpha 酸与煮沸时间用 Tinseth 公式累加苦度，支持多组酒花。",
  },
  srm: {
    title: "SRM / EBC 啤酒颜色计算器 - Morey 公式 | 云览",
    description:
      "免费在线啤酒色度计算器，按麦芽重量与 Lovibond 色值用 Morey 公式估算 SRM / EBC，并提供成品颜色预览。",
  },
  yeast: {
    title: "酵母投放量计算器 - 细胞数与扩培建议 | 云览",
    description:
      "免费在线酵母投放量计算器，按麦汁体积、OG、干/液体酵母与生产日期估算所需细胞数、包装数量与是否需要 Starter。",
  },
  priming: {
    title: "装瓶补糖计算器 - CO2 体积换算 | 云览",
    description:
      "免费在线啤酒装瓶补糖计算器，按体积、发酵温度与目标 CO2 体积计算葡萄糖、蔗糖与干麦芽精用量，附风格预设。",
  },
  keg: {
    title: "生啤强制碳酸化计算器 - PSI 查表 | 云览",
    description:
      "免费在线桶装啤酒碳酸化计算器，按冷藏温度与目标 CO2 体积给出建议 PSI，并提供温度 × 体积查表矩阵。",
  },
  line: {
    title: "生啤管路长度平衡计算器 | 云览",
    description:
      "免费在线酒管长度计算器，按酒桶压力、高度差与软管内径推荐管长，减少倒酒泡沫。",
  },
  calories: {
    title: "啤酒热量计算器 - 酒精与碳水拆分 | 云览",
    description:
      "免费在线啤酒热量计算器，按 OG、FG 与饮用体积计算总热量，并拆分酒精与碳水化合物贡献。",
  },
  bac: {
    title: "BAC 血液酒精浓度估算器 - Widmark 公式 | 云览",
    description:
      "免费在线 BAC 估算工具，按性别、体重、饮酒量与时长用 Widmark 公式估算峰值与当前血液酒精浓度，仅供了解代谢，不具法律效力。",
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
