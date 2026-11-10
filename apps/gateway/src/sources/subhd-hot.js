import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";
import { fetchDoubanHotTv } from "./douban-tv-hot.js";
import { posterProxyPath, rememberDoubanCovers } from "./douban-poster.js";

const CACHE_PATH = path.join(DATA_DIR, "trending-hot.json");
const LEGACY_CACHE_PATH = path.join(DATA_DIR, "subhd-hot.json");
const TZ = process.env.POINTS_TZ || "Asia/Shanghai";
const CACHE_VERSION = 8;
/** 每日定时刷新时刻（与 POINTS_TZ 一致，默认上海 09:00） */
const DAILY_REFRESH_HOUR = Number(process.env.HOT_REFRESH_HOUR ?? 9);
const DAILY_REFRESH_MINUTE = Number(process.env.HOT_REFRESH_MINUTE ?? 0);
const SOURCE_PAGES = [
  { id: "home", url: "https://subhd.tv/" },
  { id: "toptv", url: "https://subhd.tv/sub/toptv" },
  { id: "topmv", url: "https://subhd.tv/sub/topmv" },
];
const UA = "Mozilla/5.0 Yunlan/1.0 (+https://panso.hellbow.xyz)";
const IMG_TAG_RE = /<img[^>]+src="(https:\/\/img\.subhd\.me\/poster\/[^"]+)"[^>]*>/gi;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/** 内存副本：首页每个访客都会请求热榜，不应每次都读盘 + 解析 34KB JSON */
let memo = { path: "", mtimeMs: 0, data: /** @type {any} */ (null) };

function readCache() {
  const pathToRead = fs.existsSync(CACHE_PATH)
    ? CACHE_PATH
    : fs.existsSync(LEGACY_CACHE_PATH)
      ? LEGACY_CACHE_PATH
      : null;
  if (!pathToRead) return null;
  try {
    const mtimeMs = fs.statSync(pathToRead).mtimeMs;
    if (memo.data && memo.path === pathToRead && memo.mtimeMs === mtimeMs) return memo.data;
    const data = JSON.parse(fs.readFileSync(pathToRead, "utf8"));
    memo = { path: pathToRead, mtimeMs, data };
    return data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  ensureDataDir();
  const tmp = `${CACHE_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data), { mode: 0o600 });
  fs.renameSync(tmp, CACHE_PATH);
  memo = { path: CACHE_PATH, mtimeMs: fs.statSync(CACHE_PATH).mtimeMs, data };
}

/** 强制刷新冷却：公开接口的 ?refresh=1 不能被用来持续轰炸上游 */
const FORCE_COOLDOWN_MS = 10 * 60 * 1000;
let lastForceAt = 0;
/** @type {Promise<any> | null} */
let scraping = null;

function decodePosterText(raw) {
  return String(raw || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function keywordFromAlt(alt) {
  const text = decodePosterText(alt);
  if (!text) return "";
  const idx = text.search(/\s+[A-Za-z]/);
  const zh = (idx > 0 ? text.slice(0, idx) : text).trim();
  return zh || text;
}

const LANG_TAG_RE = /<span class="p-1 fw-bold">([^<]+)<\/span>/g;
const TOP_CARD_SPLIT = 'bg-white shadow-sm rounded-3 mb-4';

function parseTopListCards(html) {
  /** @type {Map<string, {id:string,title:string,keyword:string,imageUrl:string,releases:Array<{releaseTitle:string,tags:string[],uploader?:string}>}>} */
  const byWork = new Map();

  const parts = html.split(TOP_CARD_SPLIT);
  for (let i = 1; i < parts.length; i++) {
    const chunk = parts[i];
    const workId =
      chunk.match(/href=['"]\/d\/(\d+)['"]/)?.[1] ||
      chunk.match(/poster\/douban\/(\d+)/)?.[1];
    if (!workId) continue;

    const imageUrl = chunk.match(/src="(https:\/\/img\.subhd\.me\/poster\/[^"]+)"/)?.[1];
    const alt = chunk.match(/\balt="([^"]*)"/)?.[1] || "";
    const fullTitle = decodePosterText(alt);
    const workName =
      decodePosterText(
        chunk.match(/float-start f16 fw-bold[\s\S]*?link-dark align-middle[^>]*>([^<]+)/)?.[1] || "",
      ) || fullTitle;

    const releaseRaw =
      chunk.match(/class="view-text[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/)?.[1] || "";
    const releaseTitle = decodePosterText(releaseRaw);
    const tags = [];
    let tagMatch;
    LANG_TAG_RE.lastIndex = 0;
    while ((tagMatch = LANG_TAG_RE.exec(chunk))) {
      const t = decodePosterText(tagMatch[1]);
      if (t && !tags.includes(t)) tags.push(t);
    }
    const uploader = chunk.match(/发布人[\s\S]*?href=['"]\/u\/([^'"]+)['"]/)?.[1];

    if (!byWork.has(workId)) {
      const keyword = keywordFromAlt(fullTitle || workName);
      byWork.set(workId, {
        id: workId,
        title: fullTitle || workName,
        keyword: keyword || workName,
        imageUrl: imageUrl || `https://img.subhd.me/poster/douban/${workId}_600.webp`,
        releases: [],
      });
    }
    const entry = byWork.get(workId);
    if (releaseTitle && entry.releases.length < 3) {
      entry.releases.push({
        releaseTitle: releaseTitle.length > 120 ? `${releaseTitle.slice(0, 117)}...` : releaseTitle,
        tags: tags.slice(0, 8),
        uploader: uploader || undefined,
      });
    }
  }

  return [...byWork.values()];
}

function parsePosters(html, source) {
  /** @type {Array<{id:string,title:string,keyword:string,imageUrl:string,source:string,detailUrl:string}>} */
  const items = [];
  const seen = new Set();
  let match;
  IMG_TAG_RE.lastIndex = 0;
  while ((match = IMG_TAG_RE.exec(html))) {
    const tag = match[0];
    const imageUrl = match[1];
    const alt = tag.match(/\balt="([^"]*)"/)?.[1];
    const tit = tag.match(/\btitle="([^"]*)"/)?.[1];
    const title = decodePosterText(alt || tit);
    const doubanId = imageUrl.match(/douban\/(\d+)/)?.[1] || imageUrl;
    if (seen.has(doubanId)) continue;
    seen.add(doubanId);
    const keyword = keywordFromAlt(title);
    if (!keyword) continue;
    const kind =
      source === "topmv"
        ? "movie"
        : source === "toptv"
          ? "tv"
          : source === "new"
            ? "latest"
            : "featured";
    items.push({
      id: doubanId,
      title,
      keyword,
      imageUrl,
      source,
      kind,
    });
  }
  return items;
}

async function fetchPage(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`SubHD HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function pickHomeHotSection(html) {
  const start = html.indexOf("热门字幕");
  if (start < 0) return html;
  const end = html.indexOf('<div class="py-5">', start + 20);
  const slice = end > start ? html.slice(start, end) : html.slice(start, start + 200000);
  return slice;
}

function toPublicItem(item) {
  return {
    id: item.id,
    title: item.title,
    keyword: item.keyword,
    imageUrl: posterProxyPath(item),
    kind: item.kind,
  };
}

function toPublicHotListItem(item) {
  return {
    id: item.id,
    title: item.title,
    keyword: item.keyword,
    imageUrl: item.imageUrl,
    releases: item.releases,
  };
}

/** 合并键：同一豆瓣 id 或相同搜索关键词视为同一作品 */
function tvDedupeKey(item) {
  const fromId = String(item?.id || "")
    .replace(/^douban-/, "")
    .match(/^\d{5,}$/)?.[0];
  const fromImg = String(item?.imageUrl || "").match(/douban\/(\d{5,})/)?.[1];
  const doubanId = fromId || fromImg;
  if (doubanId) return `d:${doubanId}`;
  const kw = String(item?.keyword || item?.title || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
  return kw ? `k:${kw}` : `id:${item?.id || Math.random()}`;
}

/**
 * 豆瓣 + SubHD 剧集去重合并，再 Fisher–Yates 随机打乱（每日刷新时固定一种顺序）。
 * @param {Array<{id:string,title:string,keyword:string,imageUrl:string,kind?:string,source?:string}>} doubanRows
 * @param {Array<{id:string,title:string,keyword:string,imageUrl:string,kind?:string,source?:string}>} subhdRows
 * @param {number} [limit]
 */
export function mergeShuffleTvLists(doubanRows, subhdRows, limit = 20) {
  /** @type {Map<string, typeof doubanRows[0]>} */
  const map = new Map();
  const put = (row, preferNew) => {
    const key = tvDedupeKey(row);
    const prev = map.get(key);
    if (!prev) map.set(key, row);
    else if (preferNew) map.set(key, row);
  };
  for (const row of subhdRows || []) put({ ...row, kind: "tv" }, false);
  for (const row of doubanRows || []) put({ ...row, kind: "tv" }, true);
  const merged = [...map.values()];
  for (let i = merged.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [merged[i], merged[j]] = [merged[j], merged[i]];
  }
  return merged.slice(0, limit);
}

async function scrapeSubhdHot() {
  const errors = [];
  /** @type {Array<{id:string,title:string,keyword:string,imageUrl:string,source:string,kind:string}>} */
  let homeGrid = [];
  /** @type {Array<{id:string,title:string,keyword:string,imageUrl:string,source:string,kind:string}>} */
  let movies = [];
  /** @type {Array<{id:string,title:string,keyword:string,imageUrl:string,source:string,kind:string}>} */
  let tv = [];
  /** @type {Array<{id:string,title:string,keyword:string,imageUrl:string,source:string,kind:string}>} */
  let latest = [];
  /** @type {ReturnType<typeof parseTopListCards>} */
  let hotList = [];

  try {
    const newHtml = await fetchPage("https://subhd.tv/sub/new");
    latest = parsePosters(newHtml, "new").slice(0, 12);
  } catch (err) {
    errors.push(`new: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const topHtml = await fetchPage("https://subhd.tv/sub/top");
    hotList = parseTopListCards(topHtml);
  } catch (err) {
    errors.push(`top: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const homeHtml = await fetchPage("https://subhd.tv/");
    homeGrid = parsePosters(pickHomeHotSection(homeHtml), "home").slice(0, 40);
  } catch (err) {
    errors.push(`home: ${err instanceof Error ? err.message : String(err)}`);
  }

  try {
    const mvHtml = await fetchPage("https://subhd.tv/sub/topmv");
    movies = parsePosters(mvHtml, "topmv");
  } catch (err) {
    errors.push(`topmv: ${err instanceof Error ? err.message : String(err)}`);
  }

  let doubanTv = [];
  let subhdTv = [];
  const [doubanSettled, subhdSettled] = await Promise.allSettled([
    fetchDoubanHotTv(50),
    fetchPage("https://subhd.tv/sub/toptv").then((html) => parsePosters(html, "toptv")),
  ]);
  if (doubanSettled.status === "fulfilled") {
    doubanTv = doubanSettled.value.map((row) => ({
      id: row.id,
      title: row.title,
      keyword: row.keyword,
      imageUrl: row.imageUrl,
      coverUpstream: row.coverUpstream,
      source: "douban",
      kind: "tv",
    }));
    rememberDoubanCovers(doubanTv);
  } else {
    errors.push(`douban-tv: ${doubanSettled.reason?.message || doubanSettled.reason}`);
  }
  if (subhdSettled.status === "fulfilled") {
    subhdTv = subhdSettled.value;
  } else {
    errors.push(`toptv: ${subhdSettled.reason?.message || subhdSettled.reason}`);
  }

  const parts = [];
  if (doubanTv.length) parts.push("douban");
  if (subhdTv.length) parts.push("subhd");
  const tvSource = parts.length ? parts.join("+") : "none";
  tv = mergeShuffleTvLists(doubanTv, subhdTv, 50);
  if (!tv.length) {
    errors.push("剧集：豆瓣与 SubHD 均无数据");
  }

  const itemsFromList = hotList.map((h) => ({
    id: h.id,
    title: h.title,
    keyword: h.keyword,
    imageUrl: h.imageUrl,
    kind: "featured",
  }));
  const items = itemsFromList.length
    ? itemsFromList
    : homeGrid.length
      ? homeGrid
      : [...movies, ...tv];
  if (!items.length && !movies.length && !tv.length) {
    throw new Error(errors.join("；") || "未解析到热门条目");
  }

  return {
    cacheVersion: CACHE_VERSION,
    dayKey: todayKey(),
    fetchedAt: new Date().toISOString(),
    timezone: TZ,
    hotList: hotList.map(toPublicHotListItem),
    items: items.map(toPublicItem),
    latest: (latest.length ? latest : items.slice(0, 12)).map(toPublicItem),
    movies: movies.map(toPublicItem),
    tv: tv.map(toPublicItem),
    tvSource,
    errors,
  };
}

/**
 * @param {boolean} [force]
 */
export async function getSubhdHotCached(force = false) {
  const day = todayKey();
  const cached = readCache();
  if (force && Date.now() - lastForceAt < FORCE_COOLDOWN_MS && cached?.items?.length) {
    force = false;
  }
  if (
    !force &&
    cached?.cacheVersion === CACHE_VERSION &&
    cached?.dayKey === day &&
    Array.isArray(cached.items) &&
    cached.items.length >= 20
  ) {
    return { ...cached, stale: false };
  }

  try {
    if (force) lastForceAt = Date.now();
    // 并发请求合并为一次抓取
    scraping ||= scrapeSubhdHot().finally(() => {
      scraping = null;
    });
    const fresh = await scraping;
    writeCache(fresh);
    return { ...fresh, stale: false };
  } catch (err) {
    if (cached?.items?.length) {
      return {
        ...cached,
        stale: true,
        refreshError: err instanceof Error ? err.message : String(err),
      };
    }
    throw err;
  }
}

let refreshing = false;

/** 今天在配置时区下的年月日 + 当前时分（用于判断「今日是否已过 9:00」） */
function nowPartsInTz() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return {
    dayKey: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

function msUntilNextDailyRefresh() {
  const { hour, minute } = nowPartsInTz();
  const now = new Date();
  const afterToday =
    hour > DAILY_REFRESH_HOUR ||
    (hour === DAILY_REFRESH_HOUR && minute >= DAILY_REFRESH_MINUTE);
  const target = new Date(now);
  if (afterToday) target.setDate(target.getDate() + 1);
  // 用上海 +08:00 锚点计算下一次刷新（POINTS_TZ 默认同为 Asia/Shanghai）
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(target);
  const next = new Date(
    `${y}T${String(DAILY_REFRESH_HOUR).padStart(2, "0")}:${String(DAILY_REFRESH_MINUTE).padStart(2, "0")}:00+08:00`
  );
  return Math.max(1000, next.getTime() - now.getTime());
}

/**
 * 启动时：若今日尚未在 9:00 后刷新过，则立即拉取；否则等到下一次 9:00。
 * 豆瓣剧集与 SubHD 电影/榜单合并写入同一份 trending-hot.json。
 */
export async function refreshSubhdHotIfNeeded() {
  const { dayKey, hour, minute } = nowPartsInTz();
  const cached = readCache();
  const pastRefreshTime =
    hour > DAILY_REFRESH_HOUR ||
    (hour === DAILY_REFRESH_HOUR && minute >= DAILY_REFRESH_MINUTE);
  const refreshAnchor = new Date(
    `${dayKey}T${String(DAILY_REFRESH_HOUR).padStart(2, "0")}:${String(DAILY_REFRESH_MINUTE).padStart(2, "0")}:00+08:00`
  ).getTime();

  // 9:00 之前不抢先刷新，继续展示上一版（全新部署无缓存时仍拉一次）
  if (!pastRefreshTime) {
    if (cached?.items?.length) return cached;
  } else if (cached?.cacheVersion === CACHE_VERSION && cached?.fetchedAt && cached.items?.length) {
    const fetchedAt = new Date(cached.fetchedAt).getTime();
    if (fetchedAt >= refreshAnchor) return cached;
  }

  if (refreshing) return cached;
  refreshing = true;
  try {
    return await getSubhdHotCached(true);
  } finally {
    refreshing = false;
  }
}

async function runScheduledHotRefresh() {
  try {
    await getSubhdHotCached(true);
    console.log(
      `[hot] 每日热榜已更新（剧集=豆瓣，${TZ} ${String(DAILY_REFRESH_HOUR).padStart(2, "0")}:${String(DAILY_REFRESH_MINUTE).padStart(2, "0")}）`
    );
  } catch (err) {
    console.warn("[hot] 定时热榜更新失败:", err instanceof Error ? err.message : err);
  }
}

function scheduleNextDailyRefresh() {
  const wait = msUntilNextDailyRefresh();
  const t = setTimeout(() => {
    runScheduledHotRefresh().finally(() => scheduleNextDailyRefresh());
  }, wait);
  t.unref?.();
}

/** 每天 9:00（Asia/Shanghai，可用 HOT_REFRESH_HOUR 覆盖）全量刷新热榜 */
export function scheduleSubhdHotDaily() {
  refreshSubhdHotIfNeeded().catch((err) => {
    console.warn("[hot] 启动热榜刷新失败:", err instanceof Error ? err.message : err);
  });
  scheduleNextDailyRefresh();
  const waitMin = Math.round(msUntilNextDailyRefresh() / 60000);
  console.log(
    `[hot] 下次热榜刷新约 ${waitMin} 分钟后（${TZ} ${String(DAILY_REFRESH_HOUR).padStart(2, "0")}:${String(DAILY_REFRESH_MINUTE).padStart(2, "0")}，剧集来源豆瓣）`
  );
}
