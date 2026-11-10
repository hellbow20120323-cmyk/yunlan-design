import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";
import { getPlan } from "./plans.js";

const SUBS_PATH = path.join(DATA_DIR, "subscriptions.json");
const ORDERS_PATH = path.join(DATA_DIR, "billing-orders.json");

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readSubs() {
  ensureDataDir();
  if (!fs.existsSync(SUBS_PATH)) return { byUser: {} };
  try {
    return JSON.parse(fs.readFileSync(SUBS_PATH, "utf8"));
  } catch {
    return { byUser: {} };
  }
}

function writeSubs(data) {
  ensureDataDir();
  fs.writeFileSync(SUBS_PATH, JSON.stringify(data, null, 2), "utf8");
}

function readOrders() {
  ensureDataDir();
  if (!fs.existsSync(ORDERS_PATH)) return { orders: [] };
  try {
    return JSON.parse(fs.readFileSync(ORDERS_PATH, "utf8"));
  } catch {
    return { orders: [] };
  }
}

function writeOrders(data) {
  ensureDataDir();
  fs.writeFileSync(ORDERS_PATH, JSON.stringify(data, null, 2), "utf8");
}

export function getSubscription(userId) {
  if (!userId) return null;
  const store = readSubs();
  const rec = store.byUser[userId];
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
  const store = readSubs();
  const prev = store.byUser[userId];
  const base = prev?.activeUntil && new Date(prev.activeUntil).getTime() > Date.now()
    ? new Date(prev.activeUntil)
    : new Date();
  base.setDate(base.getDate() + plan.durationDays);
  store.byUser[userId] = {
    planId,
    activeUntil: base.toISOString(),
    updatedAt: new Date().toISOString(),
  };
  writeSubs(store);
  return store.byUser[userId];
}

export function createOrder({ userId, email, planId }) {
  const plan = getPlan(planId);
  if (!plan) throw new Error("无效套餐");
  const store = readOrders();
  const order = {
    id: `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    userId,
    email,
    planId,
    amountCny: plan.priceCny,
    planLabel: plan.label,
    status: "pending",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
  store.orders = (store.orders || []).filter(
    (o) => !(o.userId === userId && o.status === "pending" && o.planId === planId)
  );
  store.orders.unshift(order);
  store.orders = store.orders.slice(0, 500);
  writeOrders(store);
  return order;
}

export function findOrder(orderId) {
  const store = readOrders();
  return store.orders.find((o) => o.id === orderId) || null;
}

export function markOrderPaid(orderId, userId) {
  const store = readOrders();
  const order = store.orders.find((o) => o.id === orderId);
  if (!order) throw new Error("订单不存在");
  if (order.userId !== userId) throw new Error("无权操作此订单");
  if (order.status === "paid") return order;
  if (order.status !== "pending") throw new Error("订单状态不可支付");
  if (new Date(order.expiresAt).getTime() < Date.now()) {
    order.status = "expired";
    writeOrders(store);
    throw new Error("订单已过期，请重新下单");
  }
  order.status = "paid";
  order.paidAt = new Date().toISOString();
  writeOrders(store);
  extendSubscription(userId, order.planId);
  return order;
}
