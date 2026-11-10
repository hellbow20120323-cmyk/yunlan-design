import crypto from "node:crypto";
import { signSessionToken, verifySessionToken } from "./crypto.js";

const TOKEN_COOKIE = "yl_token";
const CLIENT_COOKIE = "yl_cid";
/** 旧版 Cookie 名：读取时兼容，避免改名后用户掉登录、额度归零 */
const LEGACY_TOKEN_COOKIE = "pf_token";
const LEGACY_CLIENT_COOKIE = "pf_cid";
const MAX_AGE_MS = 7 * 86400000;
/** 客户端 ID 仅允许 UUID 风格字符，防止被当作任意键写入额度表 */
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;

function safeDecode(v) {
  try {
    return decodeURIComponent(v);
  } catch {
    return "";
  }
}

export function parseCookieHeader(header) {
  const out = {};
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    // 同名 Cookie 以第一个为准，且不允许 __proto__ 之类的键污染对象
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (Object.prototype.hasOwnProperty.call(out, k)) continue;
    out[k] = safeDecode(rest.join("=") || "");
  }
  return out;
}

/**
 * 是否按 HTTPS 访问。Cloudflare → nginx(http) → 网关 链路里，
 * nginx 会把 X-Forwarded-Proto 覆盖成 http，所以额外看 CF-Visitor。
 * 可用 COOKIE_SECURE=1/0 强制开关。
 */
function isSecureRequest(req) {
  const forced = String(process.env.COOKIE_SECURE ?? "").toLowerCase();
  if (["1", "true", "yes"].includes(forced)) return true;
  if (["0", "false", "no"].includes(forced)) return false;
  if (!req) return false;
  if (req.secure) return true;
  const xfp = String(req.headers?.["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  if (xfp === "https") return true;
  return /"scheme"\s*:\s*"https"/i.test(String(req.headers?.["cf-visitor"] || ""));
}

function cookieAttrs(req, maxAgeSec) {
  return `Path=/; Max-Age=${maxAgeSec}; SameSite=Lax; HttpOnly${isSecureRequest(req) ? "; Secure" : ""}`;
}

export function getSessionFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const token = cookies[TOKEN_COOKIE] || cookies[LEGACY_TOKEN_COOKIE];
  return verifySessionToken(token);
}

export function getOrCreateClientId(req, res) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const headerCid = req.headers["x-yunlan-client"] ? String(req.headers["x-yunlan-client"]).trim() : "";
  let cid = [headerCid, cookies[CLIENT_COOKIE], cookies[LEGACY_CLIENT_COOKIE]].find((c) =>
    CLIENT_ID_RE.test(c || "")
  );
  if (!cid) cid = crypto.randomUUID();
  if (res && cookies[CLIENT_COOKIE] !== cid) {
    res.append("Set-Cookie", `${CLIENT_COOKIE}=${encodeURIComponent(cid)}; ${cookieAttrs(req, 365 * 86400)}`);
  }
  return cid;
}

export function setSessionCookie(res, user, req) {
  const token = signSessionToken({ uid: user.id, email: user.email }, MAX_AGE_MS);
  res.append(
    "Set-Cookie",
    `${TOKEN_COOKIE}=${encodeURIComponent(token)}; ${cookieAttrs(req, Math.floor(MAX_AGE_MS / 1000))}`
  );
}

export function clearSessionCookie(res, req) {
  res.append("Set-Cookie", `${TOKEN_COOKIE}=; ${cookieAttrs(req, 0)}`);
  res.append("Set-Cookie", `${LEGACY_TOKEN_COOKIE}=; ${cookieAttrs(req, 0)}`);
}
