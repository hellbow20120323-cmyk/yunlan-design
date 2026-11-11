/**
 * 微信支付 APIv3：回调验签与 resource 解密。
 */
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";

const platform = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const platformPrivatePem = platform.privateKey.export({ type: "pkcs8", format: "pem" });
const platformPublicPem = platform.publicKey.export({ type: "spki", format: "pem" });

const API_V3_KEY = "0123456789abcdef0123456789abcdef";

process.env.WECHAT_APP_ID = "wx_test_app";
process.env.WECHAT_MCH_ID = "1900000001";
process.env.WECHAT_API_V3_KEY = API_V3_KEY;
process.env.WECHAT_PLATFORM_PUBLIC_KEY = String(platformPublicPem);

const { decryptWechatResource, verifyWechatNotify } = await import("./wechat.js");

function buildNotify({ timestamp = Math.floor(Date.now() / 1000), nonce = "notify-nonce" } = {}) {
  const rawBody = Buffer.from(
    JSON.stringify({ id: "evt_1", event_type: "TRANSACTION.SUCCESS", resource: { ciphertext: "x" } }),
    "utf8"
  );
  const message = `${timestamp}\n${nonce}\n${rawBody.toString("utf8")}\n`;
  const signature = crypto.createSign("RSA-SHA256").update(message, "utf8").sign(platformPrivatePem, "base64");
  return {
    headers: {
      "wechatpay-timestamp": String(timestamp),
      "wechatpay-nonce": nonce,
      "wechatpay-signature": signature,
      "wechatpay-serial": "platform-serial",
    },
    rawBody,
  };
}

test("回调签名校验通过，篡改请求体后失败", () => {
  const input = buildNotify();
  assert.deepEqual(verifyWechatNotify(input), { ok: true });

  const tampered = Buffer.from(input.rawBody.toString("utf8").replace("evt_1", "evt_2"), "utf8");
  const result = verifyWechatNotify({ ...input, rawBody: tampered });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("回调时间戳超出容忍窗口被拒绝", () => {
  const old = Math.floor(Date.now() / 1000) - 10 * 60;
  const input = buildNotify({ timestamp: old });
  const result = verifyWechatNotify(input);
  assert.equal(result.ok, false);
  assert.match(result.error, /过期/);
});

test("AES-256-GCM 解密 resource", () => {
  const plaintext = JSON.stringify({
    out_trade_no: "ord_test_wechat",
    transaction_id: "4200000000000000000001",
    trade_state: "SUCCESS",
    amount: { total: 300, currency: "CNY" },
  });
  const nonce = "abcdefghijkl";
  const aad = "transaction";
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(API_V3_KEY, "utf8"), Buffer.from(nonce, "utf8"));
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]).toString("base64");

  const payload = decryptWechatResource({
    ciphertext,
    nonce,
    associated_data: aad,
  });
  assert.equal(payload.out_trade_no, "ord_test_wechat");
  assert.equal(payload.amount.total, 300);
});
