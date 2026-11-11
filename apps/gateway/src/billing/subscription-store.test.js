/**
 * 订单开通：渠道回调金额校验与幂等。
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

process.env.YUNLAN_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "yunlan-billing-"));

const {
  createOrder,
  findOrder,
  listOrders,
  markOrderPaid,
  markOrderPaidByChannel,
  markOrderPaidManually,
  subscriptionSummary,
} = await import("./subscription-store.js");

test("渠道回调：金额不符拒绝，金额正确开通且重复通知幂等", () => {
  const order = createOrder({ userId: "u-channel", email: "c@example.com", planId: "month" });

  assert.throws(
    () => markOrderPaidByChannel({ orderId: order.id, amountCny: 0.01 }),
    /支付金额与订单不一致/
  );
  assert.equal(findOrder(order.id).status, "pending");

  const first = markOrderPaidByChannel({
    orderId: order.id,
    amountCny: 3,
    channelTxnId: "txn-001",
  });
  assert.equal(first.alreadyPaid, false);
  assert.equal(first.order.status, "paid");
  assert.equal(first.order.paidBy, "channel");
  assert.equal(first.order.channelTxnId, "txn-001");
  assert.equal(subscriptionSummary("u-channel").active, true);
  const activeUntil = subscriptionSummary("u-channel").activeUntil;

  const second = markOrderPaidByChannel({ orderId: order.id, amountCny: 3 });
  assert.equal(second.alreadyPaid, true);
  assert.equal(subscriptionSummary("u-channel").activeUntil, activeUntil);
});

test("模拟支付仍校验订单归属", () => {
  const order = createOrder({ userId: "u-mock", email: "m@example.com", planId: "quarter" });
  assert.throws(() => markOrderPaid(order.id, "someone-else"), /无权操作/);
  const paid = markOrderPaid(order.id, "u-mock");
  assert.equal(paid.status, "paid");
  assert.equal(paid.paidBy, "mock");
  assert.equal(subscriptionSummary("u-mock").planId, "quarter");
});

test("人工汇款订单有效期延长到 7 天，管理端可补开过期订单", () => {
  const order = createOrder({ userId: "u-admin", email: "a@example.com", planId: "month" });
  const ttlDays = (new Date(order.expiresAt).getTime() - Date.now()) / 86_400_000;
  assert.ok(ttlDays > 6.9, `manual order ttl=${ttlDays}`);

  // 模拟付款延迟：直接把订单改为已过期
  const file = path.join(process.env.YUNLAN_DATA_DIR, "billing-orders.json");
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const rec = data.orders.find((o) => o.id === order.id);
  rec.status = "pending";
  rec.expiresAt = new Date(Date.now() - 3600_000).toISOString();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  const later = new Date(Date.now() + 2000);
  fs.utimesSync(file, later, later);

  const pending = listOrders({ status: "pending" });
  assert.ok(pending.some((o) => o.id === order.id));

  const first = markOrderPaidManually(order.id, { note: "微信转账 20261111" });
  assert.equal(first.order.status, "paid");
  assert.equal(first.order.paidBy, "manual-admin");
  assert.equal(first.order.channelTxnId, "微信转账 20261111");
  assert.equal(subscriptionSummary("u-admin").active, true);

  const second = markOrderPaidManually(order.id);
  assert.equal(second.alreadyPaid, true);
  assert.equal(findOrder(order.id).status, "paid");
});
