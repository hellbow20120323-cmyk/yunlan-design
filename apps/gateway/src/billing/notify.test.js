/**
 * 支付回调 HMAC 验签。
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildNotifySignature, verifyNotifySignature } from "./notify.js";

const SECRET = "yunlan-test-notify-secret";
const NONCE = "nonce-123";
const BODY = Buffer.from(JSON.stringify({ orderId: "ord_1", amountCny: 3, status: "paid" }), "utf8");

function signed(now = Date.now()) {
  const timestamp = String(now);
  return {
    secret: SECRET,
    timestamp,
    nonce: NONCE,
    rawBody: BODY,
    signature: buildNotifySignature({ secret: SECRET, timestamp, nonce: NONCE, rawBody: BODY }),
    now,
  };
}

test("合法签名通过", () => {
  assert.deepEqual(verifyNotifySignature(signed()), { ok: true });
});

test("请求体被篡改后验签失败", () => {
  const input = signed();
  const result = verifyNotifySignature({
    ...input,
    rawBody: Buffer.from(JSON.stringify({ orderId: "ord_1", amountCny: 0.01, status: "paid" })),
  });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
});

test("时间戳超出容忍窗口被拒绝", () => {
  const now = Date.now();
  const input = signed(now - 10 * 60_000);
  const result = verifyNotifySignature({ ...input, now });
  assert.equal(result.ok, false);
  assert.match(result.error, /过期/);
});

test("未配置密钥返回 503", () => {
  const result = verifyNotifySignature({ ...signed(), secret: "" });
  assert.equal(result.ok, false);
  assert.equal(result.status, 503);
});

test("签名格式错误或 nonce 缺失被拒绝", () => {
  assert.equal(verifyNotifySignature({ ...signed(), signature: "not-hex" }).ok, false);
  assert.equal(verifyNotifySignature({ ...signed(), nonce: "" }).ok, false);
});
