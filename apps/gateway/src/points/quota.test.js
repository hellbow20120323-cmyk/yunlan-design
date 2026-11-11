/**
 * 搜索积分扣减 / 返还。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.YUNLAN_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "yunlan-quota-"));
process.env.POINTS_ANON_DAILY = "30";
process.env.POINTS_ANON_IP_DAILY = "100";
process.env.POINTS_SEARCH_COST = "10";
process.env.POINTS_SIGNUP_GIFT = "0";

const { consumeSearchPointWithReceipt, getQuotaStatus, refundSearchPoint } = await import("./quota.js");

test("匿名搜索扣 10 分，返还后额度恢复", () => {
  const clientId = "client-refund";
  const ip = "203.0.113.10";
  const before = getQuotaStatus({ clientId }).remaining;

  const { points, receipt } = consumeSearchPointWithReceipt({ clientId, ip });
  assert.equal(points.remaining, before - 10);
  assert.equal(receipt.daily, 10);
  assert.ok(receipt.key);
  assert.ok(receipt.ipKey);

  refundSearchPoint(receipt);
  assert.equal(getQuotaStatus({ clientId }).remaining, before);
});

test("额度不足时不扣减；返还不会超过原始额度", () => {
  const clientId = "client-exhaust";
  const ip = "203.0.113.11";
  const before = getQuotaStatus({ clientId }).remaining;
  const receipts = [];
  for (let i = 0; i < 3; i += 1) {
    receipts.push(consumeSearchPointWithReceipt({ clientId, ip }).receipt);
  }
  assert.equal(getQuotaStatus({ clientId }).remaining, before - 30);
  assert.throws(
    () => consumeSearchPointWithReceipt({ clientId, ip }),
    (err) => err?.code === "INSUFFICIENT_POINTS"
  );

  refundSearchPoint(receipts[0]);
  assert.equal(getQuotaStatus({ clientId }).remaining, before - 20);
});

test("VIP 凭据为空操作，不写额度桶", () => {
  const clientId = "client-vip";
  const before = getQuotaStatus({ clientId }).remaining;
  refundSearchPoint({ vip: true });
  assert.equal(getQuotaStatus({ clientId }).remaining, before);
});
