import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt);
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export const PASSWORD_MAX_LENGTH = 128;

/** 异步哈希：scryptSync 会阻塞事件循环（单次约 50ms），并发登录可被用来拖垮整站 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 32, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("base64")}$${Buffer.from(hash).toString("base64")}`;
}

export async function verifyPassword(password, encoded) {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, saltB64, hashB64] = encoded.split("$");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = Buffer.from(await scrypt(password, salt, 32, SCRYPT_PARAMS));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** 用户不存在时也做一次等价耗时的哈希，避免通过响应时间枚举邮箱 */
let dummyHashPromise = null;
export function burnPasswordTime(password) {
  dummyHashPromise ||= hashPassword("yunlan-dummy-password");
  return dummyHashPromise.then((h) => verifyPassword(password, h)).then(() => false);
}

let ephemeralSecret = null;

/**
 * 会话签名密钥。
 * - 生产：必须通过 AUTH_SECRET 提供（≥32 字符），否则拒绝启动，绝不使用写死在源码里的默认值
 * - 开发：每次启动随机生成，重启后旧会话失效
 */
export function getAuthSecret() {
  const fromEnv = (process.env.AUTH_SECRET || "").trim();
  if (fromEnv.length >= 32) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须设置 AUTH_SECRET（至少 32 个字符）");
  }
  if (!ephemeralSecret) {
    ephemeralSecret = crypto.randomBytes(32).toString("hex");
    console.warn("[yunlan] 未设置 AUTH_SECRET，使用临时随机密钥（仅开发环境；重启后需重新登录）");
  }
  return ephemeralSecret;
}

export function signSessionToken(payload, ttlMs = 7 * 86400000) {
  const body = {
    ...payload,
    exp: Date.now() + ttlMs,
  };
  const json = JSON.stringify(body);
  const sig = crypto.createHmac("sha256", getAuthSecret()).update(json).digest("base64url");
  return `${Buffer.from(json, "utf8").toString("base64url")}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token || typeof token !== "string" || token.length > 2048) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const jsonStr = Buffer.from(token.slice(0, dot), "base64url").toString("utf8");
  const sig = token.slice(dot + 1);
  const expected = crypto
    .createHmac("sha256", getAuthSecret())
    .update(jsonStr)
    .digest("base64url");
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  let body;
  try {
    body = JSON.parse(jsonStr);
  } catch {
    return null;
  }
  if (!body?.uid || !body?.email || !(body.exp >= Date.now())) return null;
  return { uid: body.uid, email: body.email };
}
