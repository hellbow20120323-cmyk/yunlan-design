const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAIL_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;
const MAX_REQUESTS_PER_SHARE = 30;
const PAGE_SIZE = 100;

/** @type {Map<string, { expiresAt: number, value: ShareMeta }>} */
const cache = new Map();

/**
 * @typedef {Object} ShareMeta
 * @property {number} fileCount
 * @property {number} sizeBytes
 * @property {boolean} partial
 * @property {string} provider
 * @property {string} [error]
 */

function parseShare(url) {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/s\/([a-zA-Z0-9_-]+)/);
    if (!match) return null;
    if (u.hostname === "pan.quark.cn") {
      return {
        provider: "quark",
        shareId: match[1],
        host: "https://drive-pc.quark.cn",
        product: "ucpro",
      };
    }
    if (u.hostname === "drive.uc.cn" || u.hostname === "pan.uc.cn") {
      return {
        provider: "uc",
        shareId: match[1],
        host: "https://pc-api.uc.cn",
        product: "UCBrowser",
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function fetchJson(url, options = {}, timeoutMs = 4500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 Yunlan/1.0",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    if (body?.code !== undefined && Number(body.code) !== 0) {
      throw new Error(body.message || `code ${body.code}`);
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveUcodeShare(parsed, password = "") {
  const common = new URLSearchParams({ pr: parsed.product, fr: "pc" });
  const token = await fetchJson(
    `${parsed.host}/1/clouddrive/share/sharepage/token?${common}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pwd_id: parsed.shareId, passcode: password || "" }),
    }
  );
  const stoken = token?.data?.stoken;
  if (!stoken) throw new Error("分享口令无效或链接已失效");

  /** @type {string[]} */
  const queue = ["0"];
  const seenDirs = new Set();
  let fileCount = 0;
  let sizeBytes = 0;
  let requestCount = 0;
  let partial = false;

  while (queue.length && requestCount < MAX_REQUESTS_PER_SHARE) {
    const dirId = queue.shift();
    if (seenDirs.has(dirId)) continue;
    seenDirs.add(dirId);
    let page = 1;

    while (requestCount < MAX_REQUESTS_PER_SHARE) {
      const params = new URLSearchParams({
        pr: parsed.product,
        fr: "pc",
        pwd_id: parsed.shareId,
        stoken,
        pdir_fid: dirId,
        force: "0",
        _page: String(page),
        _size: String(PAGE_SIZE),
        _fetch_total: "1",
        _sort: "file_type:asc,updated_at:desc",
      });
      const body = await fetchJson(
        `${parsed.host}/1/clouddrive/share/sharepage/detail?${params}`
      );
      requestCount += 1;
      const list = Array.isArray(body?.data?.list) ? body.data.list : [];

      for (const item of list) {
        const isDir = Boolean(item.dir) || Number(item.file_type) === 0;
        if (isDir && item.fid) {
          queue.push(String(item.fid));
        } else {
          fileCount += 1;
          sizeBytes += Math.max(0, Number(item.size) || 0);
        }
      }

      const total = Number(body?.metadata?._total ?? list.length);
      if (page * PAGE_SIZE >= total || list.length === 0) break;
      page += 1;
    }
  }

  if (queue.length || requestCount >= MAX_REQUESTS_PER_SHARE) partial = true;
  return { fileCount, sizeBytes, partial, provider: parsed.provider };
}

export async function resolveShareMeta(url, password = "") {
  const parsed = parseShare(url);
  if (!parsed) {
    return {
      fileCount: 0,
      sizeBytes: 0,
      partial: false,
      provider: "unsupported",
      error: "暂不支持该网盘的目录统计",
    };
  }

  const key = `${parsed.provider}:${parsed.shareId}:${password}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // 同一分享并发请求只打一次上游
  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const value = await resolveUcodeShare(parsed, password);
      setCache(key, value, CACHE_TTL_MS);
      return value;
    } catch (err) {
      const value = {
        fileCount: 0,
        sizeBytes: 0,
        partial: false,
        provider: parsed.provider,
        error: err instanceof Error ? err.message : String(err),
      };
      // 失败也短暂缓存，避免失效链接被反复刷新时持续打上游
      setCache(key, value, FAIL_TTL_MS);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, task);
  return task;
}

/** @type {Map<string, Promise<ShareMeta>>} */
const inflight = new Map();

function setCache(key, value, ttl) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    // Map 按插入顺序迭代，先删最旧的一批
    const drop = Math.ceil(CACHE_MAX_ENTRIES * 0.1);
    let i = 0;
    for (const k of cache.keys()) {
      cache.delete(k);
      if (++i >= drop) break;
    }
  }
  cache.set(key, { expiresAt: Date.now() + ttl, value });
}

export async function resolveShareMetaBatch(items) {
  const input = Array.isArray(items) ? items.slice(0, 12) : [];
  const out = Object.create(null);
  let cursor = 0;

  async function worker() {
    while (cursor < input.length) {
      const index = cursor++;
      const item = input[index];
      if (!item || typeof item !== "object") continue;
      const url = String(item.url || "").slice(0, 300);
      if (!url) continue;
      const password = String(item.password || "").slice(0, 16);
      out[url] = await resolveShareMeta(url, password);
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, input.length) }, () => worker()));
  return out;
}
