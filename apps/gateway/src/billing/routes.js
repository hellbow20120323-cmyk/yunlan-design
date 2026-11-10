import { Router } from "express";
import { getSessionFromRequest } from "../auth/cookies.js";
import { PLAN_LIST } from "./plans.js";
import {
  createOrder,
  findOrder,
  markOrderPaid,
  subscriptionSummary,
} from "./subscription-store.js";

const MOCK_ENABLED = ["1", "true", "yes"].includes(
  String(process.env.BILLING_MOCK || "").toLowerCase()
);

function payInstructions(order) {
  const contact = (process.env.BILLING_CONTACT || "").trim();
  const hint =
    (process.env.BILLING_PAY_HINT || "").trim() ||
    "请使用微信或支付宝完成转账，并在备注中填写订单号，我们将在 10 分钟内开通。";
  return {
    amountCny: order.amountCny,
    orderId: order.id,
    planLabel: order.planLabel,
    hint,
    contact: contact || null,
    methods: ["微信", "支付宝"],
  };
}

export function createBillingRouter() {
  const router = Router();

  router.get("/plans", (_req, res) => {
    res.json({
      ok: true,
      plans: PLAN_LIST.map((p) => ({
        id: p.id,
        label: p.label,
        priceCny: p.priceCny,
        durationDays: p.durationDays,
        badge: p.badge,
      })),
      currency: "CNY",
    });
  });

  router.get("/subscription", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "请先登录后再开通会员" });
    }
    res.json({ ok: true, subscription: subscriptionSummary(session.uid) });
  });

  router.post("/orders", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "请先登录后再购买会员" });
    }
    const planId = String(req.body?.planId || "");
    try {
      const order = createOrder({
        userId: session.uid,
        email: session.email,
        planId,
      });
      res.json({
        ok: true,
        order: {
          id: order.id,
          planId: order.planId,
          planLabel: order.planLabel,
          amountCny: order.amountCny,
          status: order.status,
          expiresAt: order.expiresAt,
        },
        payment: payInstructions(order),
        mockPayEnabled: MOCK_ENABLED,
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  router.get("/orders/:orderId", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ ok: false, error: "未登录" });
    const order = findOrder(req.params.orderId);
    if (!order || order.userId !== session.uid) {
      return res.status(404).json({ ok: false, error: "订单不存在" });
    }
    res.json({
      ok: true,
      order,
      payment: order.status === "pending" ? payInstructions(order) : null,
      subscription: subscriptionSummary(session.uid),
    });
  });

  /** 演示/内测：模拟支付成功（生产请关闭 BILLING_MOCK） */
  router.post("/orders/:orderId/mock-pay", (req, res) => {
    if (!MOCK_ENABLED) {
      return res.status(403).json({ ok: false, error: "未开启模拟支付" });
    }
    const session = getSessionFromRequest(req);
    if (!session) return res.status(401).json({ ok: false, error: "未登录" });
    try {
      const order = markOrderPaid(req.params.orderId, session.uid);
      res.json({
        ok: true,
        order,
        subscription: subscriptionSummary(session.uid),
        message: "会员已开通（模拟支付）",
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}
