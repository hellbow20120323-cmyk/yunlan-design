/**
 * 网关安全基础设施：安全响应头、同源校验、限流、管理员鉴权、URL 白名单。
 * 不引入第三方依赖，保持网关只依赖 express + cors。
 */
import crypto from "node:crypto";

export const IS_PROD = process.env.NODE_ENV === "production";

/** 访问者 IP：依赖 app.set("trust proxy") 的配置，回退到 socket 地址 */
export function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

function isLoopback(ip) {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

/* ------------------------------------------------------------------ */
/* 安全响应头                                                          */
/* ------------------------------------------------------------------ */

/**
 * CSP 说明：
 * - 样式：Tailwind 产出外链 CSS，但 React 会写 inline style，故保留 'unsafe-inline'（仅 style）
 * - 字体：Google Fonts（样式 fonts.googleapis.com、字体文件 fonts.gstatic.com）
 * - 图片：热门海报来自 img.subhd.me，另允许 https 与 data: 以兼容封面/头像
 * - 脚本：仅同源，禁止内联与 eval
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://cloudflareinsights.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

/**
 * /velo 完整静态工坊由单文件 HTML 构成：内联脚本、内联 onclick 与本地托管的
 * Tailwind Play / Chart.js 均需要放行内联脚本。仅对该路径放宽，其余页面保持严格 CSP。
 */
const CSP_VELO = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

export function isVeloPath(pathname) {
  return pathname === "/velo" || String(pathname || "").startsWith("/velo/");
}

export function securityHeaders(req, res, next) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Content-Security-Policy", isVeloPath(req.path) ? CSP_VELO : CSP);
  if (IS_PROD) {
    res.setHeader("Strict-Transport-Security", "max-age=15552000");
  }
  // API 响应默认不缓存（含登录态/额度），静态资源由 static 中间件单独设置
  if (req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }
  next();
}

/* ------------------------------------------------------------------ */
/* CORS / CSRF                                                         */
/* ------------------------------------------------------------------ */

function parseOriginList(raw) {
  return String(raw || "")
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

const EXTRA_ORIGINS = parseOriginList(process.env.CORS_ORIGINS);

function isLocalDevOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
}

/** 同源之外的白名单来源；默认仅非生产环境放行 localhost（Vite 开发服务器） */
export function isAllowedOrigin(origin) {
  if (!origin) return true;
  if (EXTRA_ORIGINS.includes(origin)) return true;
  return !IS_PROD && isLocalDevOrigin(origin);
}

export const corsOptions = {
  origin(origin, cb) {
    // 不在白名单就不返回 CORS 头（浏览器自行拦截），而不是抛错
    cb(null, isAllowedOrigin(origin) ? Boolean(origin) : false);
  },
  credentials: true,
  maxAge: 600,
};

/**
 * 变更类请求的同源校验：带 Origin 头且既非本站、也不在白名单时拒绝。
 * 与 SameSite=Lax Cookie 叠加，作为 CSRF 纵深防御。
 */
export function sameOriginGuard(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  // 支付回调是服务端到服务端调用，靠 HMAC 验签鉴权，与浏览器 CSRF 无关
  if (req.path.startsWith("/api/billing/notify")) return next();
  const origin = req.headers.origin;
  if (!origin) return next();
  // 邮件客户端内置浏览器提交表单时常带 Origin: null，这些路径以 URL 中一次性令牌 + Cookie 鉴权
  if (origin === "null" && (req.path.startsWith("/relay/") || req.path.startsWith("/unsubscribe/"))) {
    return next();
  }
  if (isAllowedOrigin(origin)) return next();
  try {
    const host = String(req.headers.host || "").toLowerCase();
    if (new URL(origin).host.toLowerCase() === host) return next();
  } catch {
    /* fallthrough */
  }
  res.status(403).json({ ok: false, error: "非法来源请求", code: "BAD_ORIGIN" });
}

/* ------------------------------------------------------------------ */
/* 限流（内存固定窗口，单进程够用；窗口过期自动清理）                      */
/* ------------------------------------------------------------------ */

/**
 * @param {object} opts
 * @param {number} opts.windowMs
 * @param {number} opts.max
 * @param {string} [opts.message]
 * @param {(req: import('express').Request) => string} [opts.key]
 */
export function rateLimit({ windowMs, max, message = "请求过于频繁，请稍后再试", key }) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(windowMs, 30_000));
  sweep.unref?.();

  const middleware = (req, res, next) => {
    const k = key ? key(req) : clientIp(req);
    const now = Date.now();
    let rec = hits.get(k);
    if (!rec || rec.resetAt <= now) {
      rec = { count: 0, resetAt: now + windowMs };
      hits.set(k, rec);
    }
    rec.count += 1;
    const remaining = Math.max(0, max - rec.count);
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(remaining));
    if (rec.count > max) {
      const retry = Math.max(1, Math.ceil((rec.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ ok: false, error: message, code: "RATE_LIMITED", retryAfter: retry });
    }
    next();
  };
  /** 登录成功等场景用于清除计数 */
  middleware.reset = (k) => hits.delete(k);
  return middleware;
}

/* ------------------------------------------------------------------ */
/* 管理员鉴权                                                          */
/* ------------------------------------------------------------------ */

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/**
 * 管理接口守卫：
 * - 设置了 ADMIN_TOKEN：需 `Authorization: Bearer <token>` 或 `X-Admin-Token`
 * - 未设置：生产环境一律拒绝；开发环境仅允许本机回环访问
 */
export function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  if ((process.env.ADMIN_TOKEN || "").trim()) {
    return res.status(401).json({ ok: false, error: "需要管理员凭证" });
  }
  return res.status(403).json({ ok: false, error: "管理接口未启用（请设置 ADMIN_TOKEN）" });
}

/** 非中间件版本：用于同一接口按身份返回不同详略（如 /api/health） */
export function isAdmin(req) {
  const token = (process.env.ADMIN_TOKEN || "").trim();
  if (token) {
    const auth = String(req.headers.authorization || "");
    const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : String(req.headers["x-admin-token"] || "");
    return Boolean(given) && safeEqual(given, token);
  }
  return !IS_PROD && isLoopback(clientIp(req));
}

/* ------------------------------------------------------------------ */
/* URL 白名单：上游数据一律不可信，防止 javascript: / data: 注入            */
/* ------------------------------------------------------------------ */

export function isSafeShareUrl(raw) {
  const s = String(raw || "").trim();
  if (!s || s.length > 2048) return false;
  if (/^magnet:\?/i.test(s)) return true;
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** 通用 http(s) 链接清洗（非法返回空串） */
export function safeHttpUrl(raw) {
  const s = String(raw || "").trim();
  return /^https?:\/\//i.test(s) && isSafeShareUrl(s) ? s : "";
}
