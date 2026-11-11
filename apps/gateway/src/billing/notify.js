/**
 * 渠道无关的支付回调验签。
 *
 * 渠道规则（写进对接文档或渠道后台的 Webhook 配置）：
 * - Header：X-Yunlan-Timestamp（毫秒或秒）、X-Yunlan-Nonce、X-Yunlan-Signature
 * - 签名原文：`${timestamp}.${nonce}.` + 原始请求体字节
 * - Signature = hex(HMAC-SHA256(BILLING_NOTIFY_SECRET, 签名原文))
 */
import crypto from "node:crypto";

export const DEFAULT_TOLERANCE_MS = 5 * 60_000;

export function buildNotifySignature({ secret, timestamp, nonce, rawBody }) {
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${nonce}.`)
    .update(body)
    .digest("hex");
}

/**
 * @param {{
 *   secret?: string,
 *   timestamp?: string,
 *   nonce?: string,
 *   rawBody?: Buffer | string,
 *   signature?: string,
 *   now?: number,
 *   toleranceMs?: number,
 * }} input
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function verifyNotifySignature({
  secret,
  timestamp,
  nonce,
  rawBody,
  signature,
  now = Date.now(),
  toleranceMs = DEFAULT_TOLERANCE_MS,
}) {
  if (!secret) return { ok: false, status: 503, error: "支付回调未配置" };

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return { ok: false, status: 401, error: "回调时间戳无效" };
  // 兼容秒级时间戳；签名仍按请求原样的 timestamp 字符串计算
  const tsMs = ts < 1e12 ? ts * 1000 : ts;
  if (Math.abs(now - tsMs) > toleranceMs) {
    return { ok: false, status: 401, error: "回调时间戳已过期" };
  }

  const nonceStr = String(nonce || "");
  if (!nonceStr || nonceStr.length > 128) {
    return { ok: false, status: 400, error: "回调 nonce 无效" };
  }

  const given = String(signature || "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) {
    return { ok: false, status: 401, error: "回调签名格式错误" };
  }

  const expected = buildNotifySignature({ secret, timestamp, nonce: nonceStr, rawBody });
  const a = Buffer.from(given, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: "回调签名校验失败" };
  }
  return { ok: true };
}
