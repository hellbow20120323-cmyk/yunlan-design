/**
 * 搜索联想：本地热门/常搜词前缀匹配 + 百度联想（「星球」→「星球大战」）。
 * 百度失败时仍返回本地结果，不让联想框报错。
 */

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BAIDU_SUGGEST = "https://www.baidu.com/sugrec";
const TIMEOUT_MS = 2500;
const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_ITEMS = 8;

/** 百度挂了时仍能扩出常见片名 */
export const WELL_KNOWN_TITLES = [
  "星球大战",
  "星球大战：帝国反击战",
  "星球大战：绝地归来",
  "星际穿越",
  "流浪地球",
  "流浪地球2",
  "三体",
  "哈利波特",
  "指环王",
  "霍比特人",
  "复仇者联盟",
  "蜘蛛侠",
  "蜘蛛侠：英雄归来",
  "蜘蛛侠：纵横宇宙",
  "蝙蝠侠",
  "盗梦空间",
  "阿凡达",
  "泰坦尼克号",
  "肖申克的救赎",
  "让子弹飞",
  "哪吒之魔童闹海",
  "哪吒之魔童降世",
  "奥本海默",
  "沙丘",
  "沙丘2",
  "权力的游戏",
  "绝命毒师",
  "狂飙",
  "庆余年",
  "琅琊榜",
  "甄嬛传",
  "黑神话悟空",
  "周杰伦",
  "FLAC无损音乐",
];

const cache = new Map();

export function normalizeSuggestQuery(q) {
  return String(q || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

export function isSuggestableQuery(q) {
  const t = String(q || "").trim();
  if (t.length < 1 || t.length > 40) return false;
  if (/^[A-Za-z0-9.+-]+$/.test(t) && t.length < 2) return false;
  return true;
}

/**
 * @param {string} query
 * @param {string[]} corpus
 * @param {number} [limit]
 * @returns {string[]}
 */
export function rankLocalSuggestions(query, corpus, limit = MAX_ITEMS) {
  const q = normalizeSuggestQuery(query);
  if (!q) return [];
  const prefix = [];
  const contains = [];
  const seen = new Set();
  for (const raw of corpus) {
    const text = String(raw || "").replace(/\s+/g, " ").trim();
    if (!text) continue;
    const n = normalizeSuggestQuery(text);
    if (!n || n === q || seen.has(n)) continue;
    if (n.startsWith(q)) {
      prefix.push(text);
      seen.add(n);
    } else if (n.includes(q)) {
      contains.push(text);
      seen.add(n);
    }
  }
  return [...prefix, ...contains].slice(0, limit);
}

export function titlesFromHotPayload(data) {
  const out = [];
  if (!data || typeof data !== "object") return out;
  for (const list of [data.movies, data.tv, data.items, data.latest]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (item?.keyword) out.push(String(item.keyword));
      if (item?.title) out.push(String(item.title));
    }
  }
  return out;
}

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return hit.items;
}

function cacheSet(key, items) {
  cache.set(key, { at: Date.now(), items });
  if (cache.size > 300) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
}

/**
 * @param {string} q
 * @returns {Promise<string[]>}
 */
export async function fetchBaiduSuggest(q) {
  const key = normalizeSuggestQuery(q);
  const cached = cacheGet(key);
  if (cached) return cached;

  const url = `${BAIDU_SUGGEST}?${new URLSearchParams({ prod: "pc", wd: q })}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "zh-CN,zh;q=0.9",
      },
    });
    if (!res.ok) throw new Error(`baidu suggest HTTP ${res.status}`);
    const body = await res.json();
    const rows = Array.isArray(body?.g) ? body.g : [];
    const items = [];
    const seen = new Set();
    for (const row of rows) {
      const text = String(row?.q || "").replace(/\s+/g, " ").trim();
      const n = normalizeSuggestQuery(text);
      if (!text || n === key || seen.has(n) || text.length > 40) continue;
      if (/图片|壁纸|表情包|翻译|是什么意思|多少钱|app下载|官网$/.test(text)) continue;
      seen.add(n);
      items.push(text);
    }
    cacheSet(key, items);
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} query
 * @param {string[]} extraLocal
 * @returns {Promise<{ text: string, source: 'local' | 'remote' }[]>}
 */
export async function collectSuggestions(query, extraLocal = []) {
  const q = String(query || "").trim();
  if (!isSuggestableQuery(q)) return [];

  const local = rankLocalSuggestions(q, [...WELL_KNOWN_TITLES, ...extraLocal], MAX_ITEMS);
  let remote = [];
  try {
    remote = await fetchBaiduSuggest(q);
  } catch {
    remote = [];
  }

  const out = [];
  const seen = new Set();
  const push = (text, source) => {
    const n = normalizeSuggestQuery(text);
    if (!n || n === normalizeSuggestQuery(q) || seen.has(n)) return;
    seen.add(n);
    out.push({ text, source });
  };
  for (const text of local) push(text, "local");
  for (const text of remote) push(text, "remote");
  return out.slice(0, MAX_ITEMS);
}
