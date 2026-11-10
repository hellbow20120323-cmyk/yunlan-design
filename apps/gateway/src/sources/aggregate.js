import {
  ALL_CLOUD_TYPES,
  countByCloudType,
  filterHitsByCloudTypes,
  searchDemo,
  searchEngine,
} from "../search.js";
import { prepareSearchKeywords } from "../queryOptimize.js";
import { searchHunhepanFamily } from "./hunhepan.js";
import { searchWeibo, weiboConfigFromEnv } from "./weibo.js";
import { isSafeShareUrl, safeHttpUrl } from "../security.js";

/**
 * Normalize share URL for dedupe.
 * @param {string} url
 */
export function canonicalUrl(url) {
  const raw = String(url || "").trim();
  if (/^magnet:/i.test(raw)) {
    return raw.split("#")[0];
  }
  try {
    const u = new URL(raw);
    u.hash = "";
    const keep = new URLSearchParams();
    const pwd = u.searchParams.get("pwd") || u.searchParams.get("password");
    if (pwd) keep.set("pwd", pwd);
    u.search = keep.toString() ? `?${keep}` : "";
    return `${u.origin}${u.pathname}${u.search}`.replace(/\/$/, "");
  } catch {
    return raw.split("#")[0];
  }
}

const MERGE_POOL_LIMIT = 240;
const RESULT_LIMIT = 120;
const MAGNET_BLEND_RATIO = 0.15;
const MAGNET_BLEND_MIN = 10;
const MAGNET_EVERY_N_PAN = 5;

/**
 * 综合搜索时为磁力预留席位，避免全被网盘高分挤掉。
 * @param {import('../types.js').SearchHit[]} hits
 * @param {string[]} cloudTypes
 * @param {number} [limit]
 */
export function finalizeMergedHits(hits, cloudTypes, limit = RESULT_LIMIT) {
  const sorted = [...(hits || [])].sort((a, b) => b.score - a.score);
  const types = cloudTypes?.length ? cloudTypes : [...ALL_CLOUD_TYPES];
  const panTypes = types.filter((t) => t !== "magnet");
  const blend = types.includes("magnet") && panTypes.length > 0;

  if (!blend) return sorted.slice(0, limit);

  const magnets = sorted.filter((h) => h.cloudType === "magnet");
  const pans = sorted.filter((h) => h.cloudType !== "magnet");
  if (!magnets.length) return pans.slice(0, limit);

  const magnetTake = Math.min(
    magnets.length,
    Math.max(MAGNET_BLEND_MIN, Math.floor(limit * MAGNET_BLEND_RATIO))
  );
  const panTake = Math.min(pans.length, Math.max(0, limit - magnetTake));
  const m = magnets.slice(0, magnetTake);
  const p = pans.slice(0, panTake);

  /** @type {import('../types.js').SearchHit[]} */
  const out = [];
  let pi = 0;
  let mi = 0;
  while (out.length < limit && (pi < p.length || mi < m.length)) {
    for (let i = 0; i < MAGNET_EVERY_N_PAN && pi < p.length && out.length < limit; i++) {
      out.push(p[pi++]);
    }
    if (mi < m.length && out.length < limit) out.push(m[mi++]);
  }
  while (pi < p.length && out.length < limit) out.push(p[pi++]);
  while (mi < m.length && out.length < limit) out.push(m[mi++]);
  return out;
}

/**
 * @param {import('../types.js').SearchHit[][]} batches
 * @param {number} limit
 */
export function mergeAndDedupe(batches, limit = 120) {
  /** @type {Map<string, import('../types.js').SearchHit>} */
  const map = new Map();
  for (const batch of batches) {
    for (const hit of batch) {
      // 上游数据不可信：只放行 http(s)/magnet，杜绝 javascript:/data: 链接进入前端 href
      if (!hit?.url || !isSafeShareUrl(hit.url)) continue;
      if (hit.weiboPostUrl && !safeHttpUrl(hit.weiboPostUrl)) hit.weiboPostUrl = "";
      const key = `${hit.cloudType}|${canonicalUrl(hit.url)}`;
      const prev = map.get(key);
      if (!prev || hit.score > prev.score) {
        map.set(key, {
          ...hit,
          sizeBytes: hit.sizeBytes || prev?.sizeBytes || 0,
          fileCount: hit.fileCount || prev?.fileCount || 0,
          metaPartial: hit.metaPartial ?? prev?.metaPartial,
        });
      } else if (prev && hit.source && !String(prev.source).includes(String(hit.source).split(":")[0])) {
        prev.source = `${prev.source}+${hit.source.split(":")[0]}`;
        if (!prev.sizeBytes && hit.sizeBytes) prev.sizeBytes = hit.sizeBytes;
        if (!prev.fileCount && hit.fileCount) prev.fileCount = hit.fileCount;
        if (prev.metaPartial === undefined && hit.metaPartial !== undefined) {
          prev.metaPartial = hit.metaPartial;
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

/**
 * Parallel multi-source search.
 * @param {object} opts
 * @param {string} opts.kw
 * @param {('baidu'|'quark'|'xunlei'|'uc')[]} opts.cloudTypes
 * @param {string} [opts.engineUrl]
 * @param {boolean} opts.forceDemo
 * @param {boolean} [opts.enableExt=true]
 * @param {boolean} [opts.enableWeibo]
 */
/**
 * @param {string} kw
 * @param {object} opts
 */
async function collectSearchBatches(kw, opts) {
  const {
    cloudTypes,
    engineUrl,
    forceDemo,
    enableExt = true,
    enableWeibo = weiboConfigFromEnv().enabled,
  } = opts;

  /** @type {Record<string, any>} */
  const sourceStats = {};
  /** @type {import('../types.js').SearchHit[][]} */
  const batches = [];
  const tasks = [];

  if (!forceDemo && engineUrl) {
    tasks.push(
      (async () => {
        const t0 = Date.now();
        try {
          const { hits, meta } = await searchEngine(
            engineUrl,
            kw,
            cloudTypes,
            45000,
            Boolean(opts.forceRefresh)
          );
          const warn =
            Array.isArray(meta?.warnings) && meta.warnings.length
              ? meta.warnings.join("；")
              : "";
          sourceStats.engine = {
            ok: true,
            count: hits.length,
            tookMs: Date.now() - t0,
            byType: meta?.byType || {},
            detail: meta,
          };
          if (warn) sourceStats.engine.warning = warn;
          batches.push(hits);
        } catch (err) {
          sourceStats.engine = {
            ok: false,
            count: 0,
            error: err instanceof Error ? err.message : String(err),
            tookMs: Date.now() - t0,
          };
        }
      })()
    );
  }

  if (!forceDemo && enableExt) {
    tasks.push(
      (async () => {
        const t0 = Date.now();
        try {
          const { hits, meta } = await searchHunhepanFamily(kw, cloudTypes);
          const warn =
            Array.isArray(meta?.warnings) && meta.warnings.length
              ? meta.warnings.join("；")
              : "";
          sourceStats.hunhepanFamily = {
            ok: true,
            count: hits.length,
            tookMs: Date.now() - t0,
            byType: meta?.byType || {},
            detail: meta,
          };
          if (warn) sourceStats.hunhepanFamily.warning = warn;
          batches.push(hits);
        } catch (err) {
          sourceStats.hunhepanFamily = {
            ok: false,
            count: 0,
            error: err instanceof Error ? err.message : String(err),
            tookMs: Date.now() - t0,
          };
        }
      })()
    );
  }

  if (!forceDemo && enableWeibo) {
    tasks.push(
      (async () => {
        const t0 = Date.now();
        try {
          const { hits, meta } = await searchWeibo(kw, cloudTypes);
          const liveEmpty =
            meta?.mode === "live" && hits.length === 0;
          const errMsg =
            meta?.error ||
            (Array.isArray(meta?.errors) && meta.errors[0]) ||
            meta?.reason ||
            (liveEmpty ? "微博实时检索 0 条（见 detail）" : "");
          const warnMsg =
            meta?.warning ||
            (Array.isArray(meta?.warnings) && meta.warnings[0]) ||
            "";
          sourceStats.weibo = {
            ok: meta?.ok === true || (hits.length > 0 && meta?.mode === "demo"),
            count: hits.length,
            tookMs: Date.now() - t0,
            byType: countByCloudType(hits),
            detail: meta,
            configured: Boolean(weiboConfigFromEnv().cookie),
          };
          if (errMsg) sourceStats.weibo.error = errMsg;
          if (warnMsg) sourceStats.weibo.warning = warnMsg;
          if (hits.length) batches.push(hits);
        } catch (err) {
          sourceStats.weibo = {
            ok: false,
            count: 0,
            error: err instanceof Error ? err.message : String(err),
            tookMs: Date.now() - t0,
          };
        }
      })()
    );
  }

  await Promise.all(tasks);
  return { batches, sourceStats };
}

function finalizeSearchRun(batches, sourceStats, kw, cloudTypes, forceDemo) {
  let merged = mergeAndDedupe(batches, MERGE_POOL_LIMIT);
  let results = filterHitsByCloudTypes(finalizeMergedHits(merged, cloudTypes), cloudTypes);
  let demoMode = false;
  let modeLabel = "多源实时聚合";

  const anyLive = Object.values(sourceStats).some((s) => s.ok && s.count > 0);
  if (!anyLive) {
    results = filterHitsByCloudTypes(searchDemo(kw, cloudTypes), cloudTypes);
    demoMode = true;
    modeLabel = forceDemo ? "演示模式（强制）" : "演示模式（无可用上游）";
    return { results, demoMode, modeLabel, sourceStats, anyLive: false };
  }

  {
    const parts = [];
    if (sourceStats.engine?.ok) parts.push(`云览引擎 ${sourceStats.engine.count}`);
    if (sourceStats.hunhepanFamily?.ok) parts.push(`混合盘系 ${sourceStats.hunhepanFamily.count}`);
    if (sourceStats.weibo?.count > 0) {
      const sm = sourceStats.weibo.detail?.searchMode;
      const mode =
        sourceStats.weibo.detail?.mode === "demo"
          ? "微博演示"
          : sm === "keyword"
            ? "微博关键词"
            : sm === "uids"
              ? "微博博主"
              : "微博";
      parts.push(`${mode} ${sourceStats.weibo.count}`);
    }
    modeLabel = `多源实时（${parts.join(" + ")} → 去重 ${results.length}）`;
    // Partial demo: weibo fixtures mixed with live — mark demoMode only if ALL batches are demo-ish
    const onlyWeiboDemo =
      !sourceStats.engine?.count &&
      !sourceStats.hunhepanFamily?.count &&
      sourceStats.weibo?.detail?.mode === "demo";
    if (onlyWeiboDemo) {
      demoMode = true;
      modeLabel = `演示（微博夹具 ${sourceStats.weibo.count}；请配置 Cookie 切实时）`;
    }
  }

  return { results, demoMode, modeLabel, sourceStats, anyLive: true };
}

const SEARCH_CACHE_TTL_MS = Number(process.env.SEARCH_CACHE_TTL_MS || 90_000);
const SEARCH_CACHE_MAX = 200;
/** @type {Map<string, { expiresAt: number, value: any }>} */
const searchCache = new Map();
/** @type {Map<string, Promise<any>>} */
const searchInflight = new Map();

function searchCacheKey(opts) {
  return JSON.stringify([
    String(opts.kw).trim().toLowerCase(),
    [...(opts.cloudTypes || [])].sort(),
    Boolean(opts.enableExt),
    Boolean(opts.enableWeibo),
    Boolean(opts.forceDemo),
    opts.engineUrl || "",
  ]);
}

/**
 * 带短 TTL 缓存与并发合并的聚合搜索。
 * 热门词在几十秒内被多人搜索时，上游（引擎 / 混合盘 / 微博）只会被打一次；
 * 积分仍按每次请求独立扣除，不影响计费。forceRefresh 会跳过读缓存但会回写。
 */
export async function searchMulti(opts) {
  if (SEARCH_CACHE_TTL_MS <= 0) return searchMultiUncached(opts);
  const key = searchCacheKey(opts);
  const now = Date.now();

  if (!opts.forceRefresh) {
    const hit = searchCache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
    const running = searchInflight.get(key);
    if (running) return running;
  }

  const task = searchMultiUncached(opts)
    .then((value) => {
      // 全部上游失败回落演示数据时不缓存，让下一次请求尽快重试真实上游
      if (!value.demoMode) {
        if (searchCache.size >= SEARCH_CACHE_MAX) {
          const oldest = searchCache.keys().next().value;
          if (oldest !== undefined) searchCache.delete(oldest);
        }
        searchCache.set(key, { expiresAt: Date.now() + SEARCH_CACHE_TTL_MS, value });
      }
      return value;
    })
    .finally(() => {
      if (searchInflight.get(key) === task) searchInflight.delete(key);
    });
  searchInflight.set(key, task);
  return task;
}

async function searchMultiUncached(opts) {
  const prepared = prepareSearchKeywords(opts.kw);
  const { cloudTypes, forceDemo } = opts;

  /** @type {{ results: any[], demoMode: boolean, modeLabel: string, sourceStats: object, searchTerm: string, anyLive: boolean } | null} */
  let best = null;

  for (const term of prepared.upstreamTerms) {
    const { batches, sourceStats } = await collectSearchBatches(term, opts);
    const pack = finalizeSearchRun(batches, sourceStats, term, cloudTypes, forceDemo);
    best = { ...pack, searchTerm: term };
    if (pack.anyLive && pack.results.length > 0 && !pack.demoMode) break;
    if (pack.anyLive && pack.results.length > 0) break;
  }

  if (!best) {
    best = finalizeSearchRun([], {}, prepared.normalized, cloudTypes, forceDemo);
    best.searchTerm = prepared.normalized;
  }

  /** @type {string|undefined} */
  let queryHint;
  if (prepared.corrected) {
    queryHint = `已自动将检索词纠正为「${prepared.normalized}」`;
  } else if (best.searchTerm !== prepared.original && best.results.length > 0 && !best.demoMode) {
    queryHint = `已改用「${best.searchTerm}」检索以匹配更多结果`;
  }

  return {
    results: best.results,
    demoMode: best.demoMode,
    modeLabel: best.modeLabel,
    sourceStats: best.sourceStats,
    queryHint,
    searchTerm: best.searchTerm,
  };
}
