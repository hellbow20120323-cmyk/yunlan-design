import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../.data");
const CACHE_PATH = path.join(DATA_DIR, "trending-hot.json");
const LEGACY_CACHE_PATH = path.join(DATA_DIR, "subhd-hot.json");
const TZ = process.env.POINTS_TZ || "Asia/Shanghai";
const CACHE_VERSION = 5;
const SOURCE_PAGES = [
  { id: "home", url: "https://subhd.tv/" },
  { id: "toptv", url: "https://subhd.tv/sub/toptv" },
  { id: "topmv", url: "https://subhd.tv/sub/topmv" },
];
const UA = "Mozilla/5.0 PanFind/1.0 (+https://panso.hellbow.xyz)";
const IMG_TAG_RE = /<img[^>]+src="(https:\/\/img\.subhd\.me\/poster\/[^"]+)"[^>]*>/gi;

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readCache() {
  ensureDataDir();
  const pathToRead = fs.existsSync(CACHE_PATH)
    ? CACHE_PATH
    : fs.existsSync(LEGACY_CACHE_PATH)
      ? LEGACY_CACHE_PATH
      : null;
  if (!pathToRead) return null;
  try {
    return JSON.parse(fs.readFileSync(pathToRead, "utf8"));
  } catch {
    return null;
  }
}

function writeCache(data) {
  ensureDataDir();
  fs.writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), "utf8");
}

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
    imageUrl: item.imageUrl,
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

  try {
    const tvHtml = await fetchPage("https://subhd.tv/sub/toptv");
    tv = parsePosters(tvHtml, "toptv");
  } catch (err) {
    errors.push(`toptv: ${err instanceof Error ? err.message : String(err)}`);
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
    errors,
  };
}

/**
 * @param {boolean} [force]
 */
export async function getSubhdHotCached(force = false) {
  const day = todayKey();
  const cached = readCache();
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
    const fresh = await scrapeSubhdHot();
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

export async function refreshSubhdHotIfNeeded() {
  const day = todayKey();
  const cached = readCache();
  if (cached?.dayKey === day && cached.items?.length) return cached;
  if (refreshing) return cached;
  refreshing = true;
  try {
    return await getSubhdHotCached(true);
  } finally {
    refreshing = false;
  }
}

/** 每小时检查一次，跨日后自动抓取（等价于每日早间更新） */
export function scheduleSubhdHotDaily() {
  refreshSubhdHotIfNeeded().catch((err) => {
    console.warn("[subhd-hot] initial refresh failed:", err.message || err);
  });
  setInterval(() => {
    refreshSubhdHotIfNeeded().catch((err) => {
      console.warn("[subhd-hot] scheduled refresh failed:", err.message || err);
    });
  }, 60 * 60 * 1000).unref?.();
}
