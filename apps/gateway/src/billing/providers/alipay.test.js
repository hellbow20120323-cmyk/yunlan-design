/**
 * 支付宝电脑网站支付：请求签名与异步通知验签。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

const merchant = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const platform = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const merchantPrivatePem = merchant.privateKey.export({ type: "pkcs8", format: "pem" });
const platformPrivatePem = platform.privateKey.export({ type: "pkcs8", format: "pem" });
const platformPublicPem = platform.publicKey.export({ type: "spki", format: "pem" });

process.env.ALIPAY_APP_ID = "2021000000000000";
process.env.ALIPAY_PRIVATE_KEY = String(merchantPrivatePem);
// 支付宝平台公钥（测试用同一密钥对模拟支付宝侧签名）
process.env.ALIPAY_PUBLIC_KEY = String(platformPublicPem);
process.env.ALIPAY_NOTIFY_URL = "https://example.com/api/billing/notify/alipay";

const { buildAlipayPagePayUrl, verifyAlipayNotify } = await import("./alipay.js");

const ORDER = {
  id: "ord_test_alipay_001",
  amountCny: 3,
  planLabel: "月付",
};

function signNotify(params) {
  const content = Object.keys(params)
    .filter((k) => k !== "sign" && k !== "sign_type" && String(params[k]) !== "")
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return crypto.createSign("RSA-SHA256").update(content, "utf8").sign(platformPrivatePem, "base64");
}

test("下单链接包含完整参数且 RSA2 签名可被支付宝公钥验证", () => {
  const url = new URL(buildAlipayPagePayUrl(ORDER));
  const params = Object.fromEntries(url.searchParams.entries());

  assert.equal(params.app_id, "2021000000000000");
  assert.equal(params.method, "alipay.trade.page.pay");
  assert.equal(params.sign_type, "RSA2");
  assert.equal(params.notify_url, "https://example.com/api/billing/notify/alipay");
  assert.match(params.timestamp, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

  const biz = JSON.parse(params.biz_content);
  assert.equal(biz.out_trade_no, ORDER.id);
  assert.equal(biz.total_amount, "3.00");
  assert.equal(biz.product_code, "FAST_INSTANT_TRADE_PAY");

  const sign = params.sign;
  assert.ok(sign);
  delete params.sign;
  const content = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const valid = crypto
    .createVerify("RSA-SHA256")
    .update(content, "utf8")
    .verify(merchantPublicKey(), sign, "base64");
  assert.equal(valid, true);
});

function merchantPublicKey() {
  return merchant.publicKey;
}

test("异步通知验签通过", () => {
  const params = {
    app_id: "2021000000000000",
    out_trade_no: ORDER.id,
    trade_no: "2026111122001400000000000001",
    trade_status: "TRADE_SUCCESS",
    total_amount: "3.00",
    sign_type: "RSA2",
  };
  params.sign = signNotify(params);
  assert.deepEqual(verifyAlipayNotify(params), { ok: true });
});

test("通知金额被篡改后验签失败", () => {
  const params = {
    app_id: "2021000000000000",
    out_trade_no: ORDER.id,
    trade_status: "TRADE_SUCCESS",
    total_amount: "3.00",
    sign_type: "RSA2",
  };
  params.sign = signNotify(params);
  params.total_amount = "0.01";
  const result = verifyAlipayNotify(params);
  assert.equal(result.ok, false);
});

test("app_id 不匹配或签名类型错误被拒绝", () => {
  const params = {
    app_id: "2021999999999999",
    out_trade_no: ORDER.id,
    trade_status: "TRADE_SUCCESS",
    total_amount: "3.00",
    sign_type: "RSA2",
  };
  params.sign = signNotify(params);
  assert.equal(verifyAlipayNotify(params).ok, false);

  const wrongType = { ...params, app_id: "2021000000000000", sign_type: "RSA" };
  assert.equal(verifyAlipayNotify(wrongType).ok, false);
});
