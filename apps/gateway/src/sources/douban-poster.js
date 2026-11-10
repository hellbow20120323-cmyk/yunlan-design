/**
 * 豆瓣海报同源代理：浏览器无法携带 movie.douban.com Referer，外链直链会 403/418。
 */
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const REFERER = "https://movie.douban.com/";
const CACHE_DAYS = 14;
const POSTER_DIR = path.join(DATA_DIR, "douban-posters");
const COVER_MAP_PATH = path.join(DATA_DIR, "douban-cover-urls.json");

/** @type {Map<string, { expiresAt: number, buffer: Buffer, contentType: string }>} */
const mem = new Map();

function ensureDir() {
  fs.mkdirSync(POSTER_DIR, { recursive: true, mode: 0o700 });
}

function cacheFilePath(id) {
  return path.join(POSTER_DIR, `${id}.img`);
}

function readDisk(id) {
  const p = cacheFilePath(id);
  if (!fs.existsSync(p)) return null;
  try {
    const st = fs.statSync(p);
    if (Date.now() - st.mtimeMs > CACHE_DAYS * 86400000) return null;
    const buf = fs.readFileSync(p);
    return { buffer: buf, contentType: guessContentType(buf) };
  } catch {
    return null;
  }
}

function writeDisk(id, buffer) {
  ensureDir();
  const tmp = `${cacheFilePath(id)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, buffer);
  fs.renameSync(tmp, cacheFilePath(id));
  try {
    fs.chmodSync(cacheFilePath(id), 0o600);
  } catch {
    /* ignore */
  }
}

function guessContentType(buf) {
  if (buf[0] === 0xff && buf[1] === 0xd8) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50) return "image/png";
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return "image/webp";
  return "image/jpeg";
}

function readCoverMap() {
  try {
    if (!fs.existsSync(COVER_MAP_PATH)) return {};
    const data = JSON.parse(fs.readFileSync(COVER_MAP_PATH, "utf8"));
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function writeCoverMap(map) {
  ensureDir();
  const tmp = `${COVER_MAP_PATH}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(map), { mode: 0o600 });
  fs.renameSync(tmp, COVER_MAP_PATH);
}

/** 抓取热榜时写入 subjectId → 海报直链（文件名与 id 不一一对应） */
export function rememberDoubanCovers(items) {
  if (!Array.isArray(items) || !items.length) return;
  const map = readCoverMap();
  let dirty = false;
  for (const it of items) {
    const id = normalizeDoubanId(it?.id);
    const cover = String(it?.coverUpstream || it?.imageUrl || "");
    if (!id || !cover.includes("doubanio.com")) continue;
    if (map[id] !== cover) {
      map[id] = cover;
      dirty = true;
    }
  }
  if (dirty) writeCoverMap(map);
}

function coverUrlForId(id) {
  return readCoverMap()[id] || "";
}

async function fetchUpstream(id, coverUrl) {
  const mapped = coverUrl || coverUrlForId(id);
  const urls = mapped && mapped.includes("doubanio.com") ? [mapped] : [];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent": UA,
          Referer: REFERER,
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        },
      });
      if (!res.ok) continue;
      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length < 200) continue;
      return { buffer, contentType: res.headers.get("content-type") || guessContentType(buffer) };
    } catch {
      /* next */
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

/** SubHD 对同一豆瓣 id 常有可用海报，作兜底 */
async function fetchSubhdFallback(id) {
  const url = `https://img.subhd.me/poster/douban/${id}_600.webp`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA, Accept: "image/*" },
    });
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 200) return null;
    return { buffer, contentType: res.headers.get("content-type") || "image/webp" };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param {string} rawId 豆瓣 subject id
 * @param {string} [coverUrl] search_subjects 返回的 cover
 */
export async function getDoubanPosterBytes(rawId, coverUrl = "") {
  const id = String(rawId || "").match(/(\d{5,})/)?.[1];
  if (!id) return null;

  const memHit = mem.get(id);
  if (memHit && memHit.expiresAt > Date.now()) {
    return { buffer: memHit.buffer, contentType: memHit.contentType };
  }

  const disk = readDisk(id);
  if (disk) {
    mem.set(id, { ...disk, expiresAt: Date.now() + 3600000 });
    return disk;
  }

  let got = await fetchUpstream(id, coverUrl);
  if (!got) got = await fetchSubhdFallback(id);
  if (!got) return null;

  writeDisk(id, got.buffer);
  mem.set(id, { ...got, expiresAt: Date.now() + 3600000 });
  return got;
}

/** 将热门条目里的豆瓣外链改为同源代理路径 */
export function posterProxyPath(item) {
  const id =
    String(item?.id || "")
      .replace(/^douban-/, "")
      .match(/^\d{5,}$/)?.[0] ||
    String(item?.imageUrl || "").match(/\/subject\/(\d{5,})/)?.[1] ||
    String(item?.imageUrl || "").match(/douban\/(\d{5,})/)?.[1];
  if (!id) return item?.imageUrl || "";
  if (String(item?.imageUrl || "").includes("doubanio.com") || String(item?.id || "").startsWith("douban-")) {
    return `/api/hot/poster/${id}`;
  }
  return item?.imageUrl || "";
}

export function normalizeDoubanId(raw) {
  return String(raw || "").match(/(\d{5,})/)?.[1] || "";
}
