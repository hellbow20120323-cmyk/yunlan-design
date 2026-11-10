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
import { createBillingRouter, MOCK_ENABLED } from "./billing/routes.js";
import { getAuthSecret } from "./auth/crypto.js";
import { flushAllStores } from "./json-store.js";
import {
  IS_PROD,
  clientIp,
  corsOptions,
  isAdmin,
  rateLimit,
  requireAdmin,
  sameOriginGuard,
  securityHeaders,
} from "./security.js";
import { consumeSearchPoint, getQuotaStatus } from "./points/quota.js";
import { getVersionInfo, getVersionSummary } from "./version.js";
import { resolveShareMetaBatch } from "./share-meta.js";
import { getSubhdHotCached, scheduleSubhdHotDaily } from "./sources/subhd-hot.js";
import { getDoubanPosterBytes, normalizeDoubanId } from "./sources/douban-poster.js";
import { buildSitemapXml, sendSeoIndex } from "./seo.js";

const PORT = Number(process.env.PORT || 8787);
const ENGINE_URL = (process.env.ENGINE_URL || "").trim();
const FORCE_DEMO = ["1", "true", "yes"].includes(String(process.env.DEMO_MODE || "").toLowerCase());
const ENABLE_EXT = !["0", "false", "no"].includes(String(process.env.ENABLE_EXT_SOURCES ?? "1").toLowerCase());
const ENGINE_FORCE_REFRESH = ["1", "true", "yes"].includes(
  String(process.env.ENGINE_FORCE_REFRESH || "").toLowerCase()
);
const VERSION = getVersionSummary();

const HOST = (process.env.HOST || "127.0.0.1").trim();

// 启动前自检：生产环境缺少 AUTH_SECRET 直接拒绝启动（见 auth/crypto.js）
getAuthSecret();
if (IS_PROD && MOCK_ENABLED) {
  console.warn("[yunlan][安全警告] 生产环境开启了 BILLING_MOCK，任何登录用户都可免费开通会员！");
}

const app = express();
app.disable("x-powered-by");
/**
 * 反向代理层数：Cloudflare → nginx → 网关 共 2 跳，req.ip 才是真实访客 IP。
 * 直连 nginx（无 Cloudflare）时 2 也同样得到正确结果。可用 TRUST_PROXY 覆盖。
 */
{
  const raw = (process.env.TRUST_PROXY ?? "").trim();
  if (raw === "") app.set("trust proxy", IS_PROD ? 2 : "loopback");
  else if (/^\d+$/.test(raw)) app.set("trust proxy", Number(raw));
  else if (["true", "false"].includes(raw)) app.set("trust proxy", raw === "true");
  else app.set("trust proxy", raw);
}
app.use(securityHeaders);
app.use(cors(corsOptions));
app.use(express.json({ limit: "64kb" }));
app.use(sameOriginGuard);

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
    console.warn("[hot] 热榜获取失败:", err instanceof Error ? err.message : err);
    res.status(502).json({ ok: false, error: "热榜暂时不可用" });
  }
}

const hotLimiter = rateLimit({ windowMs: 60_000, max: 60 });
app.get("/api/hot/trending", hotLimiter, handleTrendingHot);
app.get("/api/hot/subhd", hotLimiter, handleTrendingHot);

const posterLimiter = rateLimit({ windowMs: 60_000, max: 120 });
app.get("/api/hot/poster/:doubanId", posterLimiter, async (req, res) => {
  const id = normalizeDoubanId(req.params.doubanId);
  if (!id) return res.status(400).send("invalid id");
  try {
    const hit = await getDoubanPosterBytes(id);
    if (!hit) return res.status(404).send("poster not found");
    res.setHeader("Content-Type", hit.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=604800");
    res.send(hit.buffer);
  } catch (err) {
    console.warn("[hot/poster] 失败:", id, err instanceof Error ? err.message : err);
    res.status(502).send("poster fetch failed");
  }
});

const shareMetaLimiter = rateLimit({ windowMs: 60_000, max: 30 });
app.post("/api/share-meta/batch", shareMetaLimiter, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (items.length > 12) {
      return res.status(400).json({ error: "单次最多查询 12 个分享链接" });
    }
    const metadata = await resolveShareMetaBatch(items);
    res.json({ ok: true, metadata });
  } catch (err) {
    console.warn("[share-meta] 失败:", err instanceof Error ? err.message : err);
    res.status(500).json({ ok: false, error: "分享信息解析失败" });
  }
});

/** 引擎探活结果缓存：/api/health 无需鉴权，不能每次访问都向引擎发起请求 */
let engineProbeCache = { at: 0, value: /** @type {any} */ (null) };
async function probeEngineCached() {
  if (Date.now() - engineProbeCache.at < 10_000) return engineProbeCache.value;
  const value = await probeEngine(ENGINE_URL);
  engineProbeCache = { at: Date.now(), value };
  return value;
}

app.get("/api/health", rateLimit({ windowMs: 60_000, max: 120 }), async (req, res) => {
  let engine = null;
  if (ENGINE_URL && !FORCE_DEMO) {
    engine = await probeEngineCached();
  }
  const admin = isAdmin(req);
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
    engineOk: engine ? engine.ok : null,
    extSourcesEnabled: ENABLE_EXT,
    // 内网地址、上游端点、引擎插件清单、微博细节仅管理员可见，避免向公网暴露拓扑
    ...(admin
      ? {
          engineUrl: ENGINE_URL || null,
          engine: engine?.detail ?? null,
          extSources: ENABLE_EXT ? hunhepanEndpoints() : [],
          weibo,
        }
      : { weibo: { enabled: weibo.enabled, configured: weibo.configured } }),
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
app.get("/api/config/weibo", requireAdmin, (_req, res) => {
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
app.put("/api/config/weibo", requireAdmin, (req, res) => {
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
    console.warn("[config/weibo] 保存失败:", err instanceof Error ? err.message : err);
    res.status(500).json({ ok: false, error: "保存失败" });
  }
});

/** 每个 IP 每分钟 30 次搜索：配合积分额度，防止脚本批量刷上游 */
const searchLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: "搜索过于频繁，请稍后再试",
});

async function handleSearch(req, res) {
  const started = Date.now();
  const body = req.method === "GET" ? req.query : req.body || {};
  // 去掉控制字符，避免污染日志与上游请求
  const kw = String(body.kw || body.q || "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim();
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
    pointsAfter = consumeSearchPoint({ userId: session?.uid, clientId, ip: clientIp(req) });
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
  // 客户端开关只能「关闭」服务端已启用的源，不能越权开启服务端关闭的源
  const optedOut = (v) => v !== undefined && ["0", "false", "no"].includes(String(v).toLowerCase());
  const enableExt = ENABLE_EXT && !optedOut(body.enable_ext);
  const resolvedWeibo = resolveWeiboConfig();
  const enableWeibo = resolvedWeibo.enabled && !optedOut(body.enable_weibo);

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

function searchFailed(res, e) {
  // 内部错误细节只写日志，不回给访客
  console.error("[search] 失败:", e instanceof Error ? e.stack || e.message : e);
  if (!res.headersSent) res.status(500).json({ error: "搜索服务暂时不可用，请稍后重试" });
}

app.get("/api/search", searchLimiter, (req, res) => {
  handleSearch(req, res).catch((e) => searchFailed(res, e));
});

app.post("/api/search", searchLimiter, (req, res) => {
  handleSearch(req, res).catch((e) => searchFailed(res, e));
});

/**
 * 静态资源缓存策略：
 * - 构建产物目录 /yl/ 带内容哈希 → 一年 immutable
 * - index.html 永远回源校验，保证发版后用户立刻拿到新入口
 * - 其他（logo 等）缓存一天
 */
app.use(
  express.static(WEB_DIST, {
    index: false,
    setHeaders(res, filePath) {
      if (filePath.includes(`${path.sep}yl${path.sep}`)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

app.use("/api", (_req, res) => {
  res.status(404).json({ ok: false, error: "接口不存在" });
});

app.get("/sitemap.xml", async (_req, res) => {
  try {
    const hot = await getSubhdHotCached(false).catch(() => null);
    const keywords = [...(hot?.movies || []), ...(hot?.tv || []), ...(hot?.items || [])];
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(buildSitemapXml(keywords));
  } catch (err) {
    console.warn("[seo] sitemap 失败:", err instanceof Error ? err.message : err);
    res.status(500).type("text/plain").send("sitemap unavailable");
  }
});

app.get("*", (req, res) => {
  sendSeoIndex(req, res).catch((err) => {
    console.warn("[seo] 首页渲染失败:", err instanceof Error ? err.message : err);
    if (!res.headersSent) {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(WEB_DIST, "index.html"), (fileErr) => {
        if (fileErr && !res.headersSent) {
          res.status(404).json({ error: "Web UI 未构建，请先 npm run build 或分别启动 gateway/web" });
        }
      });
    }
  });
});

// 统一错误出口：请求体过大 / JSON 非法等不再返回带堆栈的默认 HTML 页面
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err?.status || err?.statusCode || 500;
  if (status >= 500) console.error("[gateway] 未处理错误:", err);
  const msg =
    status === 413 ? "请求体过大" : status === 400 ? "请求格式不正确" : "服务器内部错误";
  if (!res.headersSent) res.status(status >= 400 && status < 600 ? status : 500).json({ ok: false, error: msg });
});

const server = app.listen(PORT, HOST, () => {
  scheduleSubhdHotDaily();
  const w = resolveWeiboConfig();
  console.log(`[yunlan] gateway http://${HOST}:${PORT} v${VERSION.version} (${VERSION.buildTime})`);
  console.log(
    `[yunlan] ENGINE_URL=${ENGINE_URL || "(none)"} EXT=${ENABLE_EXT} WEIBO=${w.enabled} mode=${w.searchModeHint} DEMO=${FORCE_DEMO}`
  );
  console.log(`[yunlan] 微博配置文件 ${weiboConfigPath()}（UIDs 来自文件=${uidsFromFile(readWeiboFileConfig()).length}）`);
});

// 慢速连接防护：请求头 / 请求体必须在限定时间内收完（响应时长不受影响）
server.headersTimeout = 30_000;
server.requestTimeout = 60_000;

function shutdown(signal) {
  console.log(`[yunlan] 收到 ${signal}，正在关闭…`);
  flushAllStores();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => shutdown(sig));
