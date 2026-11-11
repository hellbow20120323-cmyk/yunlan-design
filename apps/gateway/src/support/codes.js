/**
 * 支持申请：口令、一次性链接、Cookie 与退订令牌。
 * 所有随机值均来自 node:crypto，不使用 Math.random。
 */
import crypto from "node:crypto";
import { getAuthSecret } from "../auth/crypto.js";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email) {
  return String(email || "")
    .trim()
    .toLowerCase();
}

export function isValidEmail(email) {
  const e = normalizeEmail(email);
  return e.length > 0 && e.length <= 254 && EMAIL_RE.test(e);
}

/** 弱口令：四位相同（0000）或顺子（0123 / 3210 / 7890 / 0987） */
export function isWeakCode(code) {
  const s = String(code || "");
  if (!/^\d{4}$/.test(s)) return true;
  if (/^(\d)\1{3}$/.test(s)) return true;
  const digits = s.split("").map(Number);
  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i += 1) {
    const diff = (digits[i] - digits[i - 1] + 10) % 10;
    if (diff !== 1) asc = false;
    if (diff !== 9) desc = false;
  }
  return asc || desc;
}

/**
 * 生成 4 位纯数字口令，排除弱号与已被占用的口令。
 * @param {Set<string> | string[]} [taken]
 */
export function generateCode(taken = []) {
  const used = taken instanceof Set ? taken : new Set(taken);
  for (let i = 0; i < 200; i += 1) {
    const n = crypto.randomInt(0, 10000);
    const code = String(n).padStart(4, "0");
    if (isWeakCode(code)) continue;
    if (used.has(code)) continue;
    return code;
  }
  // 极端情况下（口令池耗尽）退回随机值，由调用方继续校验唯一性
  return String(crypto.randomInt(0, 10000)).padStart(4, "0");
}

export function generateLinkToken() {
  // 128 bit 足够抗枚举；base64url 后约 22 字符，兼顾短链接
  return crypto.randomBytes(16).toString("base64url");
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function hmac(input) {
  return crypto.createHmac("sha256", getAuthSecret()).update(input).digest("base64url");
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** 申请状态页 Cookie：appId.exp.signature */
export function signAppSession(appId, ttlMs = 30 * 86400000) {
  const exp = Date.now() + ttlMs;
  const body = `${appId}.${exp}`;
  return `${body}.${hmac(`app:${body}`)}`;
}

export function verifyAppSession(token) {
  const raw = String(token || "");
  if (!raw || raw.length > 512) return null;
  const parts = raw.split(".");
  if (parts.length !== 3) return null;
  const [appId, expRaw, sig] = parts;
  if (!/^[0-9a-f-]{36}$/i.test(appId)) return null;
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;
  const expected = hmac(`app:${appId}.${expRaw}`);
  if (!safeEqual(sig, expected)) return null;
  return appId;
}

/** 退订令牌长期有效：unsub.appId.signature */
export function signUnsubscribeToken(appId) {
  return `${appId}.${hmac(`unsub:${appId}`)}`;
}

export function verifyUnsubscribeToken(token) {
  const raw = String(token || "");
  if (!raw || raw.length > 512) return null;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const appId = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^[0-9a-f-]{36}$/i.test(appId)) return null;
  if (!safeEqual(sig, hmac(`unsub:${appId}`))) return null;
  return appId;
}

export function maskEmail(email) {
  const e = normalizeEmail(email);
  const at = e.indexOf("@");
  if (at <= 0) return "";
  const name = e.slice(0, at);
  const domain = e.slice(at);
  const head = name.slice(0, Math.min(2, name.length));
  return `${head}${"*".repeat(Math.max(2, name.length - head.length))}${domain}`;
}
