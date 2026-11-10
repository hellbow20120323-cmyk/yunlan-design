import crypto from "node:crypto";
import { dataPath } from "../paths.js";
import { JsonStore } from "../json-store.js";
import { getPlan } from "./plans.js";

const subsStore = new JsonStore(dataPath("subscriptions.json"), () => ({ byUser: {} }), {
  normalize: (d) => ({ ...d, byUser: d?.byUser || {} }),
});
const ordersStore = new JsonStore(dataPath("billing-orders.json"), () => ({ orders: [] }), {
  normalize: (d) => ({ ...d, orders: Array.isArray(d?.orders) ? d.orders : [] }),
});

const MAX_PENDING_PER_USER = 5;

export function getSubscription(userId) {
  if (!userId) return null;
  const rec = subsStore.read().byUser[userId];
  if (!rec?.activeUntil) return null;
  if (new Date(rec.activeUntil).getTime() <= Date.now()) return null;
  return rec;
}

export function isSubscriptionActive(userId) {
  return Boolean(getSubscription(userId));
}

export function subscriptionSummary(userId) {
  const sub = getSubscription(userId);
  if (!sub) {
    return { active: false, activeUntil: null, planId: null, planLabel: null };
  }
  const plan = getPlan(sub.planId);
  return {
    active: true,
    activeUntil: sub.activeUntil,
    planId: sub.planId,
    planLabel: plan?.label || sub.planId,
  };
}

export function extendSubscription(userId, planId) {
  const plan = getPlan(planId);
  if (!plan) throw new Error("无效套餐");
  const data = subsStore.read();
  const prev = data.byUser[userId];
  const base = prev?.activeUntil && new Date(prev.activeUntil).getTime() > Date.now()
    ? new Date(prev.activeUntil)
    : new Date();
  base.setDate(base.getDate() + plan.durationDays);
  data.byUser[userId] = {
    planId,
    activeUntil: base.toISOString(),
    updatedAt: new Date().toISOString(),
  };
  subsStore.write();
  return data.byUser[userId];
}

export function createOrder({ userId, email, planId }) {
  const plan = getPlan(planId);
  if (!plan) throw new Error("无效套餐");
  const data = ordersStore.read();
  const now = Date.now();
  // 订单号用密码学随机数，Math.random 可被预测
  const order = {
    id: `ord_${now.toString(36)}_${crypto.randomBytes(6).toString("hex")}`,
    userId,
    email,
    planId,
    amountCny: plan.priceCny,
    planLabel: plan.label,
    status: "pending",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 30 * 60 * 1000).toISOString(),
  };
  // 同套餐的旧待支付单作废；过期单顺手清理；单用户待支付单设上限，防止刷单撑爆文件
  data.orders = data.orders.filter(
    (o) =>
      !(o.userId === userId && o.status === "pending" && o.planId === planId) &&
      !(o.status === "pending" && new Date(o.expiresAt).getTime() < now)
  );
  const pending = data.orders.filter((o) => o.userId === userId && o.status === "pending").length;
  if (pending >= MAX_PENDING_PER_USER) throw new Error("待支付订单过多，请先完成或等待过期");
  data.orders.unshift(order);
  data.orders = data.orders.slice(0, 500);
  ordersStore.write();
  return order;
}

export function findOrder(orderId) {
  return ordersStore.read().orders.find((o) => o.id === orderId) || null;
}

export function markOrderPaid(orderId, userId) {
  const data = ordersStore.read();
  const order = data.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("订单不存在");
  if (order.userId !== userId) throw new Error("无权操作此订单");
  if (order.status === "paid") return order;
  if (order.status !== "pending") throw new Error("订单状态不可支付");
  if (new Date(order.expiresAt).getTime() < Date.now()) {
    order.status = "expired";
    ordersStore.write();
    throw new Error("订单已过期，请重新下单");
  }
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  ordersStore.write();
  extendSubscription(userId, order.planId);
  return order;
}
