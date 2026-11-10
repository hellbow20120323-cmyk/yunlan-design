import crypto from "node:crypto";

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 32, SCRYPT_PARAMS);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password, encoded) {
  if (!encoded?.startsWith("scrypt$")) return false;
  const [, saltB64, hashB64] = encoded.split("$");
  if (!saltB64 || !hashB64) return false;
  const salt = Buffer.from(saltB64, "base64");
  const expected = Buffer.from(hashB64, "base64");
  const actual = crypto.scryptSync(password, salt, 32, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(expected, actual);
}

export function getAuthSecret() {
  const fromEnv = (process.env.AUTH_SECRET || "").trim();
  if (fromEnv.length >= 32) return fromEnv;
  return "yunlan-dev-secret-change-in-production-32chars!";
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
  if (!token || typeof token !== "string") return null;
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
  if (!body?.uid || !body?.email || body.exp < Date.now()) return null;
  return { uid: body.uid, email: body.email };
}
