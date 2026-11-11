/**
 * 微信支付 APIv3 Native 扫码下单 + 支付通知验签/解密。
 * 仅依赖 Node 内置 crypto 与全局 fetch，不引入支付 SDK。
 */
import crypto from "node:crypto";
import { readKeyMaterial } from "./keys.js";

const DEFAULT_API_BASE = "https://api.mch.weixin.qq.com";
const NATIVE_PATH = "/v3/pay/transactions/native";
export const DEFAULT_TOLERANCE_MS = 5 * 60_000;

function env(name) {
  return String(process.env[name] || "").trim();
}

function safeRead(pathEnv, inlineEnv = "") {
  try {
    return readKeyMaterial(env(pathEnv), env(inlineEnv));
  } catch (err) {
    console.warn(`[billing][wechat] 读取密钥失败 ${pathEnv}:`, err instanceof Error ? err.message : err);
    return "";
  }
}

export function wechatConfig() {
  return {
    appId: env("WECHAT_APP_ID"),
    mchId: env("WECHAT_MCH_ID"),
    serialNo: env("WECHAT_MCH_SERIAL_NO"),
    notifyUrl: env("WECHAT_NOTIFY_URL"),
    apiBase: env("WECHAT_API_BASE") || DEFAULT_API_BASE,
    privateKeyPem: safeRead("WECHAT_PRIVATE_KEY_PATH", "WECHAT_PRIVATE_KEY"),
    apiV3Key: env("WECHAT_API_V3_KEY"),
    platformKeyPem: safeRead("WECHAT_PLATFORM_CERT_PATH", "WECHAT_PLATFORM_PUBLIC_KEY"),
  };
}

export function isWechatEnabled() {
  const cfg = wechatConfig();
  return Boolean(cfg.appId && cfg.mchId && cfg.serialNo && cfg.notifyUrl && cfg.privateKeyPem);
}

function buildAuthorization({ method, path, body, cfg }) {
  if (!cfg.privateKeyPem) throw new Error("微信支付未配置商户私钥");
  const nonce = crypto.randomBytes(16).toString("hex");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const message = `${method}\n${path}\n${timestamp}\n${nonce}\n${body}\n`;
  const signature = crypto.createSign("RSA-SHA256").update(message, "utf8").sign(cfg.privateKeyPem, "base64");
  return (
    `WECHATPAY2-SHA256-RSA2048 mchid="${cfg.mchId}",nonce_str="${nonce}",` +
    `signature="${signature}",timestamp="${timestamp}",serial_no="${cfg.serialNo}"`
  );
}

/**
 * Native 下单，返回二维码内容 code_url。
 * @param {{ id: string, amountCny: number, planLabel: string }} order
 * @returns {Promise<{ codeUrl: string }>}
 */
export async function createWechatNativeOrder(order) {
  const cfg = wechatConfig();
  if (!isWechatEnabled()) {
    throw new Error("微信支付未配置（需要 WECHAT_APP_ID/MCH_ID/MCH_SERIAL_NO/私钥/NOTIFY_URL）");
  }
  const body = JSON.stringify({
    appid: cfg.appId,
    mchid: cfg.mchId,
    description: `云览 VIP ${order.planLabel}`.slice(0, 127),
    out_trade_no: order.id,
    notify_url: cfg.notifyUrl,
    amount: {
      total: Math.round(Number(order.amountCny) * 100),
      currency: "CNY",
    },
  });

  const res = await fetch(`${cfg.apiBase}${NATIVE_PATH}`, {
    method: "POST",
    headers: {
      Authorization: buildAuthorization({ method: "POST", path: NATIVE_PATH, body, cfg }),
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "yunlan-gateway",
    },
    body,
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`微信支付下单失败（HTTP ${res.status}）：${text.slice(0, 200)}`);
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("微信支付返回内容不是合法 JSON");
  }
  if (!data?.code_url) throw new Error("微信支付未返回 code_url");
  return { codeUrl: String(data.code_url) };
}

function platformPublicKey(cfg) {
  if (!cfg.platformKeyPem) return null;
  if (cfg.platformKeyPem.includes("BEGIN CERTIFICATE")) {
    return new crypto.X509Certificate(cfg.platformKeyPem).publicKey;
  }
  return cfg.platformKeyPem;
}

/**
 * 通知验签：签名原文 `timestamp\nnonce\nbody\n`，使用微信支付平台证书公钥验 RSA-SHA256。
 * @param {{ headers?: Record<string, unknown>, rawBody?: Buffer | string, now?: number, toleranceMs?: number }} input
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function verifyWechatNotify({ headers, rawBody, now = Date.now(), toleranceMs = DEFAULT_TOLERANCE_MS }) {
  const cfg = wechatConfig();
  if (!cfg.platformKeyPem) {
    return { ok: false, status: 503, error: "未配置微信支付平台证书" };
  }
  const timestamp = String(headers?.["wechatpay-timestamp"] || "");
  const nonce = String(headers?.["wechatpay-nonce"] || "");
  const signature = String(headers?.["wechatpay-signature"] || "");
  if (!timestamp || !nonce || !signature) {
    return { ok: false, status: 401, error: "缺少微信支付签名头" };
  }
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(now - ts * 1000) > toleranceMs) {
    return { ok: false, status: 401, error: "微信支付回调时间戳已过期" };
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody ?? ""), "utf8");
  const message = `${timestamp}\n${nonce}\n${body.toString("utf8")}\n`;
  try {
    const key = platformPublicKey(cfg);
    if (!key) return { ok: false, status: 503, error: "微信支付平台公钥无效" };
    const valid = crypto.createVerify("RSA-SHA256").update(message, "utf8").verify(key, signature, "base64");
    return valid ? { ok: true } : { ok: false, status: 401, error: "微信支付签名校验失败" };
  } catch (err) {
    return { ok: false, status: 401, error: err instanceof Error ? err.message : "微信支付签名校验异常" };
  }
}

/**
 * 解密 resource：AES-256-GCM，密钥为 APIv3 密钥（32 字节），密文末尾 16 字节为 auth tag。
 * @param {{ ciphertext: string, nonce: string, associated_data?: string }} resource
 * @returns {Record<string, any>}
 */
export function decryptWechatResource(resource) {
  const cfg = wechatConfig();
  const key = Buffer.from(cfg.apiV3Key, "utf8");
  if (key.length !== 32) throw new Error("WECHAT_API_V3_KEY 必须为 32 字节");
  if (!resource?.ciphertext || !resource?.nonce) throw new Error("微信支付回调缺少密文");

  const buf = Buffer.from(resource.ciphertext, "base64");
  if (buf.length <= 16) throw new Error("微信支付回调密文长度异常");
  const authTag = buf.subarray(buf.length - 16);
  const data = buf.subarray(0, buf.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(resource.nonce, "utf8"));
  decipher.setAuthTag(authTag);
  decipher.setAAD(Buffer.from(resource.associated_data || "", "utf8"));
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return JSON.parse(plaintext);
}
