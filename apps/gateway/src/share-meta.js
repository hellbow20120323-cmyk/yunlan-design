const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAIL_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 2000;
const MAX_REQUESTS_PER_SHARE = 30;
const PAGE_SIZE = 100;
const CACHE_KEY_PREFIX = "v2:";

/** 详情弹窗只展示前若干个文件，完整目录仍去官网看 */
export const TREE_MAX_FILES = 40;
export const NAME_MAX_LEN = 180;
export const PATH_MAX_LEN = 240;

/** @type {Map<string, { expiresAt: number, value: ShareMeta }>} */
const cache = new Map();

/**
 * @typedef {Object} ShareFilePreview
 * @property {string} name
 * @property {string} path
 * @property {number} sizeBytes
 */

/**
 * @typedef {Object} ShareMeta
 * @property {number} fileCount
 * @property {number} sizeBytes
 * @property {boolean} partial
 * @property {boolean} [treeTruncated]
 * @property {string} provider
 * @property {string} [error]
 * @property {ShareFilePreview[]} [files]
 */

export function parseShare(url) {
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
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    if (host === "alipan.com" || host === "aliyundrive.com") {
      return {
        provider: "aliyun",
        shareId: match[1],
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function passwordFromShareUrl(url) {
  try {
    const u = new URL(url);
    return (u.searchParams.get("pwd") || u.searchParams.get("password") || "").slice(0, 16);
  } catch {
    return "";
  }
}

export function sanitizeShareName(raw) {
  const cleaned = String(raw || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[\\/]+/g, "_")
    .trim();
  if (!cleaned) return "未命名";
  return cleaned.length > NAME_MAX_LEN ? cleaned.slice(0, NAME_MAX_LEN) : cleaned;
}

export function joinSharePath(parent, name) {
  const base = String(parent || "").replace(/^\/+|\/+$/g, "");
  const joined = base ? `${base}/${name}` : name;
  return joined.length > PATH_MAX_LEN ? joined.slice(0, PATH_MAX_LEN) : joined;
}

export function isShareDir(item) {
  const kind = String(item?.type || "").toLowerCase();
  if (kind === "folder" || kind === "dir") return true;
  if (kind === "file") return false;
  return Boolean(item?.dir) || Number(item?.file_type) === 0;
}

export function itemFileId(item) {
  if (item?.fid != null && String(item.fid)) return String(item.fid);
  if (item?.file_id != null && String(item.file_id)) return String(item.file_id);
  return "";
}

export function itemFileName(item) {
  return sanitizeShareName(item?.file_name || item?.filename || item?.name || item?.title || "");
}

/**
 * 把一页分享列表记入计数与目录预览。不收录 fid、下载地址、缩略图等字段。
 * @param {object} item
 * @param {string} parentPath
 * @param {{ fileCount: number, sizeBytes: number, files: ShareFilePreview[], dirQueue: Array<{fid: string, path: string}>, treeTruncated: boolean }} state
 * @param {{ maxFiles?: number }} [limits]
 */
export function applyShareListItem(item, parentPath, state, limits = {}) {
  const maxFiles = Number(limits.maxFiles) > 0 ? Number(limits.maxFiles) : TREE_MAX_FILES;
  const name = itemFileName(item);
  const path = joinSharePath(parentPath, name);
  if (isShareDir(item)) {
    const fid = itemFileId(item);
    if (fid) state.dirQueue.push({ fid, path });
    return;
  }
  state.fileCount += 1;
  state.sizeBytes += Math.max(0, Number(item.size) || 0);
  if (state.files.length < maxFiles) {
    state.files.push({ name, path, sizeBytes: Math.max(0, Number(item.size) || 0) });
  } else {
    state.treeTruncated = true;
  }
}

function emptyMeta(provider, error) {
  return {
    fileCount: 0,
    sizeBytes: 0,
    partial: false,
    treeTruncated: false,
    provider,
    files: [],
    ...(error ? { error } : {}),
  };
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

async function fetchAliyunJson(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0 Yunlan/1.0",
        Referer: "https://www.alipan.com/",
        Origin: "https://www.alipan.com",
        ...(options.headers || {}),
      },
    });
    let body = {};
    try {
      body = await res.json();
    } catch {
      body = {};
    }
    const code = body?.code ? String(body.code) : "";
    if (code) {
      if (/SharePwd|share_pwd/i.test(code)) throw new Error("需要提取码或提取码错误");
      if (/Cancelled/i.test(code)) throw new Error("分享已被取消");
      if (/Expired|Forbidden/i.test(code)) throw new Error("分享已失效");
      throw new Error(body.message || code);
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return body;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveAliyunShare(parsed, password = "") {
  const tokenBody = await fetchAliyunJson(
    "https://api.aliyundrive.com/v2/share_link/get_share_token",
    {
      method: "POST",
      body: JSON.stringify({
        share_id: parsed.shareId,
        share_pwd: password || "",
      }),
    }
  );
  const shareToken = tokenBody?.share_token;
  if (!shareToken) throw new Error("分享口令无效或链接已失效");

  const state = {
    fileCount: 0,
    sizeBytes: 0,
    files: /** @type {ShareFilePreview[]} */ ([]),
    dirQueue: [{ fid: "root", path: "" }],
    treeTruncated: false,
  };
  const seenDirs = new Set();
  let requestCount = 0;
  let partial = false;

  while (state.dirQueue.length && requestCount < MAX_REQUESTS_PER_SHARE) {
    const dir = state.dirQueue.shift();
    if (!dir || seenDirs.has(dir.fid)) continue;
    seenDirs.add(dir.fid);
    let marker = "";

    while (requestCount < MAX_REQUESTS_PER_SHARE) {
      const body = await fetchAliyunJson(
        "https://api.aliyundrive.com/adrive/v2/file/list_by_share",
        {
          method: "POST",
          headers: { "x-share-token": shareToken },
          body: JSON.stringify({
            share_id: parsed.shareId,
            parent_file_id: dir.fid,
            limit: PAGE_SIZE,
            order_by: "name",
            order_direction: "ASC",
            marker,
          }),
        }
      );
      requestCount += 1;
      const list = Array.isArray(body?.items) ? body.items : [];
      for (const item of list) {
        applyShareListItem(item, dir.path, state);
      }
      marker = String(body?.next_marker || "");
      if (!marker || list.length === 0) break;
    }
  }

  if (state.dirQueue.length || requestCount >= MAX_REQUESTS_PER_SHARE) partial = true;
  const files = [...state.files].sort((a, b) => a.path.localeCompare(b.path, "zh"));
  return {
    fileCount: state.fileCount,
    sizeBytes: state.sizeBytes,
    partial,
    treeTruncated: state.treeTruncated || partial,
    provider: parsed.provider,
    files,
  };
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

  const state = {
    fileCount: 0,
    sizeBytes: 0,
    files: /** @type {ShareFilePreview[]} */ ([]),
    dirQueue: [{ fid: "0", path: "" }],
    treeTruncated: false,
  };
  const seenDirs = new Set();
  let requestCount = 0;
  let partial = false;

  while (state.dirQueue.length && requestCount < MAX_REQUESTS_PER_SHARE) {
    const dir = state.dirQueue.shift();
    if (!dir || seenDirs.has(dir.fid)) continue;
    seenDirs.add(dir.fid);
    let page = 1;

    while (requestCount < MAX_REQUESTS_PER_SHARE) {
      const params = new URLSearchParams({
        pr: parsed.product,
        fr: "pc",
        pwd_id: parsed.shareId,
        stoken,
        pdir_fid: dir.fid,
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
        applyShareListItem(item, dir.path, state);
      }

      const total = Number(body?.metadata?._total ?? list.length);
      if (page * PAGE_SIZE >= total || list.length === 0) break;
      page += 1;
    }
  }

  if (state.dirQueue.length || requestCount >= MAX_REQUESTS_PER_SHARE) partial = true;
  const files = [...state.files].sort((a, b) => a.path.localeCompare(b.path, "zh"));
  return {
    fileCount: state.fileCount,
    sizeBytes: state.sizeBytes,
    partial,
    treeTruncated: state.treeTruncated || partial,
    provider: parsed.provider,
    files,
  };
}

export async function resolveShareMeta(url, password = "") {
  const parsed = parseShare(url);
  if (!parsed) {
    return emptyMeta("unsupported", "目前仅支持夸克 / UC / 阿里云盘公开分享的目录预览");
  }
  const pass = String(password || passwordFromShareUrl(url) || "").slice(0, 16);

  const key = `${CACHE_KEY_PREFIX}${parsed.provider}:${parsed.shareId}:${pass}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  // 同一分享并发请求只打一次上游
  const running = inflight.get(key);
  if (running) return running;

  const task = (async () => {
    try {
      const value =
        parsed.provider === "aliyun"
          ? await resolveAliyunShare(parsed, pass)
          : await resolveUcodeShare(parsed, pass);
      setCache(key, value, CACHE_TTL_MS);
      return value;
    } catch (err) {
      const value = emptyMeta(
        parsed.provider,
        err instanceof Error ? err.message : String(err)
      );
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
      const password = String(item.password || passwordFromShareUrl(url) || "").slice(0, 16);
      out[url] = await resolveShareMeta(url, password);
    }
  }

  await Promise.all(Array.from({ length: Math.min(3, input.length) }, () => worker()));
  return out;
}
