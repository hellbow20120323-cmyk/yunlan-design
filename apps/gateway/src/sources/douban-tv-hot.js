/**
 * 豆瓣热播剧集（movie.douban.com/j/search_subjects）
 * 用于首页「热门剧集」海报与搜索关键词。
 */
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const API = "https://movie.douban.com/j/search_subjects";
const TAGS = ["热门", "电视剧"];
const TIMEOUT_MS = 12_000;

/**
 * @param {string} title
 */
export function keywordFromDoubanTitle(title) {
  const t = String(title || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return "";
  // 去掉常见副标题：英文名、季数等
  const cut = t.split(/\s+[A-Za-z]|\s+第[0-9一二三四五六七八九十两]+季|\s+Season\s/i)[0].trim();
  return cut || t;
}

/**
 * @param {any} row
 */
function mapSubject(row) {
  const id = String(row?.id || "").trim();
  const title = String(row?.title || "").trim();
  if (!id || !title) return null;
  const cover = String(row?.cover || "").trim();
  const imageUrl =
    cover ||
    `https://img2.doubanio.com/view/photo/s_ratio_poster/public/default_webp.png`;
  const keyword = keywordFromDoubanTitle(title);
  return {
    id: `douban-${id}`,
    title,
    keyword: keyword || title,
    imageUrl,
    coverUpstream: cover,
    kind: "tv",
    source: "douban",
    detailUrl: String(row?.url || `https://movie.douban.com/subject/${id}/`),
    rate: row?.rate ? String(row.rate) : "",
    episodesInfo: row?.episodes_info ? String(row.episodes_info) : "",
  };
}

async function fetchTag(tag, pageLimit, pageStart = 0) {
  const params = new URLSearchParams({
    type: "tv",
    tag,
    sort: "recommend",
    page_limit: String(pageLimit),
    page_start: String(pageStart),
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API}?${params}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        Referer: "https://movie.douban.com/tv/",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`豆瓣 HTTP ${res.status}`);
    const body = await res.json();
    const list = Array.isArray(body?.subjects) ? body.subjects : [];
    return list.map(mapSubject).filter(Boolean);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {number} [limit]
 * @returns {Promise<Array<ReturnType<typeof mapSubject>>>}
 */
export async function fetchDoubanHotTv(limit = 50) {
  const cap = Math.min(50, Math.max(4, limit));
  /** @type {Map<string, NonNullable<ReturnType<typeof mapSubject>>>} */
  const byId = new Map();
  const errors = [];

  for (const tag of TAGS) {
    for (const start of [0, 20, 40]) {
      if (byId.size >= cap) break;
      try {
        const batch = await fetchTag(tag, 20, start);
        for (const item of batch) {
          if (byId.size >= cap) break;
          if (!byId.has(item.id)) byId.set(item.id, item);
        }
        if (batch.length < 10) break;
      } catch (err) {
        errors.push(`${tag}@${start}: ${err instanceof Error ? err.message : String(err)}`);
        break;
      }
    }
  }

  const items = [...byId.values()];
  if (!items.length) {
    throw new Error(errors.join("；") || "豆瓣未返回剧集");
  }
  return items.slice(0, cap);
}
