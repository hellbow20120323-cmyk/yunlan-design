import cors from "cors";
import express from "express";
import path from "node:path";
import {
  publicWeiboConfigView,
  readWeiboFileConfig,
  uidsFromFile,
  weiboConfigPath,
  writeWeiboFileConfig,
} from "./config/weibo-store.js";
import { normalizeCloudTypes, probeEngine } from "./search.js";
import { WEB_DIST } from "./paths.js";
import { searchMulti } from "./sources/aggregate.js";
import { hunhepanEndpoints } from "./sources/hunhepan.js";
import { resolveWeiboConfig, weiboStatusSummary } from "./sources/weibo.js";
import { createAuthRouter } from "./auth/routes.js";
import { getOrCreateClientId, getSessionFromRequest } from "./auth/cookies.js";
import { createBillingRouter } from "./billing/routes.js";
import { consumeSearchPoint, getQuotaStatus } from "./points/quota.js";
import { getVersionInfo, getVersionSummary } from "./version.js";
import { resolveShareMetaBatch } from "./share-meta.js";
import { getSubhdHotCached, scheduleSubhdHotDaily } from "./sources/subhd-hot.js";

const PORT = Number(process.env.PORT || 8787);
const ENGINE_URL = (process.env.ENGINE_URL || "").trim();
const FORCE_DEMO = ["1", "true", "yes"].includes(String(process.env.DEMO_MODE || "").toLowerCase());
const ENABLE_EXT = !["0", "false", "no"].includes(String(process.env.ENABLE_EXT_SOURCES ?? "1").toLowerCase());
const ENGINE_FORCE_REFRESH = ["1", "true", "yes"].includes(
  String(process.env.ENGINE_FORCE_REFRESH || "").toLowerCase()
);
const VERSION = getVersionSummary();

const app = express();
app.use(cors({ origin: true, credentials: "include" }));
app.use(express.json({ limit: "256kb" }));

app.use("/api/auth", createAuthRouter());
app.use("/api/billing", createBillingRouter());

app.get("/api/points", (req, res) => {
  const clientId = getOrCreateClientId(req, res);
  const session = getSessionFromRequest(req);
  res.json({
    ok: true,
    points: getQuotaStatus({ userId: session?.uid, clientId }),
  });
});

async function handleTrendingHot(req, res) {
  try {
    const force = ["1", "true", "yes"].includes(String(req.query.refresh || "").toLowerCase());
    const data = await getSubhdHotCached(force);
    res.json({ ok: true, ...data });
  } catch (err) {
    res.status(502).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

app.get("/api/hot/trending", handleTrendingHot);
app.get("/api/hot/subhd", handleTrendingHot);

app.post("/api/share-meta/batch", async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 12) {
      return res.status(400).json({ error: "单次最多查询 12 个分享链接" });
    }
    const metadata = await resolveShareMetaBatch(items);
    res.json({ ok: true, metadata });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/health", async (_req, res) => {
  let engine = null;
  if (ENGINE_URL && !FORCE_DEMO) {
    engine = await probeEngine(ENGINE_URL);
  }
  const engineOk = Boolean(ENGINE_URL) && !FORCE_DEMO && Boolean(engine?.ok);
  const weibo = weiboStatusSummary();
  const liveReady = !FORCE_DEMO && (engineOk || ENABLE_EXT || (weibo.enabled && (weibo.configured || weibo.allowDemo)));
  const demoMode = FORCE_DEMO;
  let modeLabel = "演示模式";
  if (FORCE_DEMO) modeLabel = "演示模式（强制 DEMO_MODE）";
  else {
    const bits = [];
    if (engineOk) bits.push("云览引擎");
    if (ENABLE_EXT) bits.push("混合盘系");
    if (weibo.enabled && weibo.configured) bits.push("微博");
    else if (weibo.enabled && weibo.allowDemo) bits.push("微博演示");
    modeLabel = bits.length ? `多源实时（${bits.join(" + ")}）` : "演示模式（未配置上游）";
  }

  res.json({
    ok: true,
    product: "云览",
    version: VERSION.version,
    buildTime: VERSION.buildTime,
    channel: VERSION.channel,
    demoMode,
    liveReady,
    modeLabel,
    engineConfigured: Boolean(ENGINE_URL),
    engineUrl: ENGINE_URL || null,
    engineOk: engine ? engine.ok : null,
    engine: engine?.detail ?? null,
    extSourcesEnabled: ENABLE_EXT,
    extSources: ENABLE_EXT ? hunhepanEndpoints() : [],
    weibo,
  });
});

/** 版本摘要 */
app.get("/api/version", (_req, res) => {
  res.json({ ok: true, ...getVersionSummary() });
});

/** 变更说明（中文 changelog） */
app.get("/api/changelog", (_req, res) => {
  const info = getVersionInfo();
  res.json({
    ok: true,
    version: info.version,
    buildTime: info.buildTime,
    name: info.name,
    changelog: info.changelog,
  });
});

/** 产品内微博配置（脱敏）；Cookie 永不回传明文 */
app.get("/api/config/weibo", (_req, res) => {
  const file = readWeiboFileConfig();
  const resolved = resolveWeiboConfig();
  res.json({ ok: true, config: publicWeiboConfigView(file, resolved) });
});

/**
 * 保存微博配置到本机 .data/weibo-config.json（gitignored）。
 * body: {
 *   enabled, cookie?, cookieWeiboCom?, cookieMWeibo?,
 *   clearCookie?, clearCookieWeiboCom?, clearCookieMWeibo?,
 *   bloggers?, uids?, fetchComments?, maxPages?, allowDemo?
 * }
 */
app.put("/api/config/weibo", (req, res) => {
  try {
    const body = req.body || {};
    const prev = readWeiboFileConfig();
    /** @type {import('./config/weibo-store.js').WeiboFileConfig} */
    const next = { ...prev };

    if (typeof body.enabled === "boolean") next.enabled = body.enabled;
    if (typeof body.fetchComments === "boolean") next.fetchComments = body.fetchComments;
    if (typeof body.allowDemo === "boolean") next.allowDemo = body.allowDemo;
    if (body.maxPages !== undefined) {
      const n = Number(body.maxPages);
      if (Number.isFinite(n)) next.maxPages = Math.min(5, Math.max(1, n));
    }

    // Dual Cookie slots (v0.3.3+)
    if (body.clearCookieWeiboCom === true) {
      next.cookieWeiboCom = "";
    } else if (typeof body.cookieWeiboCom === "string" && body.cookieWeiboCom.trim()) {
      next.cookieWeiboCom = body.cookieWeiboCom.trim();
    }
    if (body.clearCookieMWeibo === true) {
      next.cookieMWeibo = "";
    } else if (typeof body.cookieMWeibo === "string" && body.cookieMWeibo.trim()) {
      next.cookieMWeibo = body.cookieMWeibo.trim();
    }

    // Legacy single cookie / clear-all
    if (body.clearCookie === true) {
      next.cookie = "";
      if (body.clearCookieWeiboCom !== false && body.cookieWeiboCom === undefined) {
        next.cookieWeiboCom = "";
      }
      if (body.clearCookieMWeibo !== false && body.cookieMWeibo === undefined) {
        next.cookieMWeibo = "";
      }
    } else if (typeof body.cookie === "string" && body.cookie.trim()) {
      const c = body.cookie.trim();
      next.cookie = c;
      // Seed empty dedicated slots for migration (do not overwrite existing slots)
      const hasCom = typeof next.cookieWeiboCom === "string" && next.cookieWeiboCom.trim();
      const hasM = typeof next.cookieMWeibo === "string" && next.cookieMWeibo.trim();
      if (!hasCom && body.cookieWeiboCom === undefined) next.cookieWeiboCom = c;
      if (!hasM && body.cookieMWeibo === undefined) next.cookieMWeibo = c;
    }

    if (Array.isArray(body.bloggers)) {
      next.bloggers = body.bloggers
        .map((b) => {
          const uidMatch = String(b?.uid || "").match(/(\d{5,})/);
          if (!uidMatch) return null;
          return {
            uid: uidMatch[1],
            nick: String(b?.nick || "").trim().slice(0, 40),
          };
        })
        .filter(Boolean);
      next.uids = next.bloggers.map((b) => b.uid);
    } else if (Array.isArray(body.uids)) {
      next.uids = body.uids
        .map((s) => {
          const m = String(s).match(/(\d{5,})/);
          return m ? m[1] : "";
        })
        .filter(Boolean);
      next.bloggers = next.uids.map((uid) => ({ uid, nick: "" }));
    }

    const saved = writeWeiboFileConfig(next);
    const resolved = resolveWeiboConfig();
    res.json({
      ok: true,
      config: publicWeiboConfigView(saved, resolved),
      message: `已保存到 ${weiboConfigPath()}`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

async function handleSearch(req, res) {
  const started = Date.now();
  const body = req.method === "GET" ? req.query : req.body || {};
  const kw = String(body.kw || body.q || "").trim();
  if (!kw) {
    return res.status(400).json({ error: "缺少关键词 kw", code: "MISSING_KW" });
  }
  if (kw.length > 80) {
    return res.status(400).json({ error: "关键词过长", code: "KW_TOO_LONG" });
  }

  const clientId = getOrCreateClientId(req, res);
  const session = getSessionFromRequest(req);
  let pointsAfter;
  try {
    pointsAfter = consumeSearchPoint({ userId: session?.uid, clientId });
  } catch (err) {
    if (err?.code === "INSUFFICIENT_POINTS") {
      return res.status(402).json({
        error: err.message,
        code: "INSUFFICIENT_POINTS",
        paywall: true,
        points: getQuotaStatus({ userId: session?.uid, clientId }),
      });
    }
    throw err;
  }

  const cloudTypes = normalizeCloudTypes(body.cloud_types || body.cloudTypes);
  const enableExt =
    body.enable_ext === undefined
      ? ENABLE_EXT
      : !["0", "false", "no"].includes(String(body.enable_ext).toLowerCase());
  const resolvedWeibo = resolveWeiboConfig();
  const enableWeibo =
    body.enable_weibo === undefined
      ? resolvedWeibo.enabled
      : !["0", "false", "no"].includes(String(body.enable_weibo).toLowerCase());

  const forceRefresh =
    ENGINE_FORCE_REFRESH ||
    ["1", "true", "yes"].includes(String(body.refresh || body.force_refresh || "").toLowerCase());

  const { results, demoMode, modeLabel, sourceStats, queryHint } = await searchMulti({
    kw,
    cloudTypes,
    engineUrl: ENGINE_URL,
    forceDemo: FORCE_DEMO,
    enableExt,
    enableWeibo,
    forceRefresh,
  });

  res.json({
    query: kw,
    demoMode,
    modeLabel: queryHint ? `${modeLabel} · ${queryHint}` : modeLabel,
    queryHint,
    total: results.length,
    results,
    cloudTypes,
    tookMs: Date.now() - started,
    sourceStats,
    points: pointsAfter,
  });
}

app.get("/api/search", (req, res) => {
  handleSearch(req, res).catch((e) => {
    res.status(500).json({ error: e.message || "search failed" });
  });
});

app.post("/api/search", (req, res) => {
  handleSearch(req, res).catch((e) => {
    res.status(500).json({ error: e.message || "search failed" });
  });
});

app.use(express.static(WEB_DIST));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) return next();
  res.sendFile(path.join(WEB_DIST, "index.html"), (err) => {
    if (err) res.status(404).json({ error: "Web UI 未构建，请先 npm run build 或分别启动 gateway/web" });
  });
});

app.listen(PORT, "0.0.0.0", () => {
  scheduleSubhdHotDaily();
  const w = resolveWeiboConfig();
  console.log(`[yunlan] gateway http://0.0.0.0:${PORT} v${VERSION.version} (${VERSION.buildTime})`);
  console.log(
    `[yunlan] ENGINE_URL=${ENGINE_URL || "(none)"} EXT=${ENABLE_EXT} WEIBO=${w.enabled} mode=${w.searchModeHint} DEMO=${FORCE_DEMO}`
  );
  console.log(`[yunlan] 微博配置文件 ${weiboConfigPath()}（UIDs 来自文件=${uidsFromFile(readWeiboFileConfig()).length}）`);
});
