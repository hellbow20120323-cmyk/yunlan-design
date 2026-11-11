/**
 * 支付宝电脑网站支付（alipay.trade.page.pay）。
 * 仅依赖 Node 内置 crypto：RSA2 = SHA256withRSA。
 */
import crypto from "node:crypto";
import { normalizePem, readKeyMaterial } from "./keys.js";

const DEFAULT_GATEWAY = "https://openapi.alipay.com/gateway.do";

function env(name) {
  return String(process.env[name] || "").trim();
}

function safePem(pathEnv, inlineEnv, label) {
  try {
    return normalizePem(readKeyMaterial(env(pathEnv), env(inlineEnv)), label);
  } catch (err) {
    console.warn(`[billing][alipay] 读取密钥失败 ${pathEnv}/${inlineEnv}:`, err instanceof Error ? err.message : err);
    return "";
  }
}

export function alipayConfig() {
  return {
    appId: env("ALIPAY_APP_ID"),
    gateway: env("ALIPAY_GATEWAY") || DEFAULT_GATEWAY,
    notifyUrl: env("ALIPAY_NOTIFY_URL"),
    returnUrl: env("ALIPAY_RETURN_URL"),
    privateKeyPem: safePem("ALIPAY_PRIVATE_KEY_PATH", "ALIPAY_PRIVATE_KEY", "PRIVATE KEY"),
    publicKeyPem: safePem("ALIPAY_PUBLIC_KEY_PATH", "ALIPAY_PUBLIC_KEY", "PUBLIC KEY"),
  };
}

export function isAlipayEnabled() {
  const cfg = alipayConfig();
  return Boolean(cfg.appId && cfg.privateKeyPem && cfg.notifyUrl);
}

/** 支付宝要求北京时间 yyyy-MM-dd HH:mm:ss */
export function beijingTimestamp(date = new Date()) {
  const d = new Date(date.getTime() + 8 * 3600_000);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
  );
}

/** 待签名串：过滤空值与 sign，按 key 字典序用 & 拼接（不 URL 编码） */
function signContent(params) {
  return Object.keys(params)
    .filter((k) => k !== "sign" && params[k] !== undefined && params[k] !== null && String(params[k]) !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
}

function rsa2Sign(content, privateKeyPem) {
  return crypto.createSign("RSA-SHA256").update(content, "utf8").sign(privateKeyPem, "base64");
}

function rsa2Verify(content, signature, publicKeyPem) {
  return crypto.createVerify("RSA-SHA256").update(content, "utf8").verify(publicKeyPem, signature, "base64");
}

/**
 * 生成收银台跳转链接。
 * @param {{ id: string, amountCny: number, planLabel: string }} order
 * @returns {string}
 */
export function buildAlipayPagePayUrl(order) {
  const cfg = alipayConfig();
  if (!cfg.appId || !cfg.privateKeyPem) throw new Error("支付宝支付未配置（缺少 ALIPAY_APP_ID 或商户私钥）");
  if (!cfg.notifyUrl) throw new Error("支付宝支付未配置（缺少 ALIPAY_NOTIFY_URL）");

  const params = {
    app_id: cfg.appId,
    method: "alipay.trade.page.pay",
    format: "JSON",
    charset: "utf-8",
    sign_type: "RSA2",
    timestamp: beijingTimestamp(),
    version: "1.0",
    notify_url: cfg.notifyUrl,
    biz_content: JSON.stringify({
      out_trade_no: order.id,
      product_code: "FAST_INSTANT_TRADE_PAY",
      total_amount: Number(order.amountCny).toFixed(2),
      subject: `云览 VIP ${order.planLabel}`,
    }),
  };
  if (cfg.returnUrl) params.return_url = cfg.returnUrl;

  params.sign = rsa2Sign(signContent(params), cfg.privateKeyPem);
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) query.set(k, v);
  return `${cfg.gateway}?${query.toString()}`;
}

/**
 * 异步通知验签：排除 sign / sign_type 后按 key 排序重算。
 * @param {Record<string, unknown>} params 表单参数
 * @returns {{ ok: true } | { ok: false, error: string }}
 */
export function verifyAlipayNotify(params) {
  const cfg = alipayConfig();
  if (!cfg.publicKeyPem) return { ok: false, error: "未配置支付宝公钥" };
  if (!params || typeof params !== "object") return { ok: false, error: "回调参数为空" };

  const signature = String(params.sign || "").trim();
  if (!signature) return { ok: false, error: "缺少签名" };
  if (String(params.sign_type || "").toUpperCase() !== "RSA2") {
    return { ok: false, error: "签名类型必须为 RSA2" };
  }
  if (cfg.appId && String(params.app_id || "") !== cfg.appId) {
    return { ok: false, error: "app_id 不匹配" };
  }

  const content = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && params[k] !== undefined && params[k] !== null && String(params[k]) !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");

  try {
    return rsa2Verify(content, signature, cfg.publicKeyPem)
      ? { ok: true }
      : { ok: false, error: "支付宝签名校验失败" };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "支付宝签名校验异常" };
  }
}
