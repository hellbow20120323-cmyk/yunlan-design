import express, { Router } from "express";
import { getSessionFromRequest } from "../auth/cookies.js";
import { requireAdmin, rateLimit } from "../security.js";
import { PLAN_LIST } from "./plans.js";
import { verifyNotifySignature } from "./notify.js";
import { buildAlipayPagePayUrl, isAlipayEnabled, verifyAlipayNotify } from "./providers/alipay.js";
import {
  createWechatNativeOrder,
  decryptWechatResource,
  isWechatEnabled,
  verifyWechatNotify,
  wechatConfig,
} from "./providers/wechat.js";
import {
  createOrder,
  findOrder,
  listOrders,
  markOrderPaid,
  markOrderPaidByChannel,
  markOrderPaidManually,
  subscriptionSummary,
} from "./subscription-store.js";

/** 模拟支付会白送会员：仅在显式开启时可用，生产环境启动时会打印醒目警告（见 index.js） */
export const MOCK_ENABLED = ["1", "true", "yes"].includes(
  String(process.env.BILLING_MOCK || "").toLowerCase()
);

/** 支付渠道回调密钥；未配置时回调接口一律 503 */
export const BILLING_NOTIFY_SECRET = (process.env.BILLING_NOTIFY_SECRET || "").trim();
const NOTIFY_TOLERANCE_MS = Number(process.env.BILLING_NOTIFY_TOLERANCE_MS || 5 * 60_000);

function payInstructions(order) {
  const contact = (process.env.BILLING_CONTACT || "").trim();
  const contactEmail = (process.env.BILLING_CONTACT_EMAIL || "").trim();
  const hint =
    (process.env.BILLING_PAY_HINT || "").trim() ||
    "请使用微信或支付宝完成转账，并在备注中填写订单号，我们将在 10 分钟内开通。";
  return {
    amountCny: order.amountCny,
    orderId: order.id,
    planLabel: order.planLabel,
    hint,
    contact: contact || null,
    contactEmail: contactEmail || null,
    methods: ["微信", "支付宝"],
  };
}

/** 已配置的下单渠道；前端据此展示支付方式 */
export function availableProviders() {
  return { alipay: isAlipayEnabled(), wechat: isWechatEnabled() };
}

const PAYMENT_PROVIDERS = ["alipay", "wechat", "manual"];

function resolveProvider(requested) {
  const p = String(requested || "").toLowerCase();
  if (PAYMENT_PROVIDERS.includes(p)) return p;
  const avail = availableProviders();
  if (avail.alipay) return "alipay";
  if (avail.wechat) return "wechat";
  return "manual";
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
      providers: availableProviders(),
    });
  });

  router.get("/subscription", (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "请先登录后再开通会员" });
    }
    res.json({ ok: true, subscription: subscriptionSummary(session.uid) });
  });

  const orderLimiter = rateLimit({
    windowMs: 60 * 60_000,
    max: 20,
    message: "下单过于频繁，请稍后再试",
  });

  router.post("/orders", orderLimiter, async (req, res) => {
    const session = getSessionFromRequest(req);
    if (!session) {
      return res.status(401).json({ ok: false, error: "请先登录后再购买会员" });
    }
    const planId = String(req.body?.planId || "");
    const provider = resolveProvider(req.body?.provider);
    const avail = availableProviders();
    if (provider !== "manual" && !avail[provider]) {
      return res.status(400).json({
        ok: false,
        error: provider === "alipay" ? "支付宝支付未配置" : "微信支付未配置",
      });
    }
    try {
      const order = createOrder({
        userId: session.uid,
        email: session.email,
        planId,
        provider,
      });
      // 渠道下单：支付宝返回收银台跳转链接，微信返回 Native 二维码内容
      let payUrl = null;
      let qrCode = null;
      if (provider === "alipay") {
        payUrl = buildAlipayPagePayUrl(order);
      } else if (provider === "wechat") {
        ({ codeUrl: qrCode } = await createWechatNativeOrder(order));
      }
      res.json({
        ok: true,
        order: {
          id: order.id,
          planId: order.planId,
          planLabel: order.planLabel,
          amountCny: order.amountCny,
          status: order.status,
          expiresAt: order.expiresAt,
          provider: order.provider,
        },
        provider,
        payUrl,
        qrCode,
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

  /**
   * 管理端：订单列表。GET /api/billing/admin/orders?status=pending|paid|all&limit=50
   * 需要 ADMIN_TOKEN（Authorization: Bearer <token>）。
   */
  router.get("/admin/orders", requireAdmin, (req, res) => {
    const raw = String(req.query.status ?? "pending").trim();
    const status = raw === "all" ? "" : raw;
    const orders = listOrders({ status, limit: Number(req.query.limit) || 50 });
    res.json({ ok: true, orders });
  });

  /**
   * 管理端：人工核款后开通会员。
   * body 可选 { note }，写入订单 channelTxnId 便于对账；重复调用幂等。
   */
  router.post("/admin/orders/:orderId/grant", requireAdmin, (req, res) => {
    try {
      const { order, alreadyPaid } = markOrderPaidManually(req.params.orderId, {
        note: req.body?.note,
      });
      console.info(`[billing] 管理员手动开通 ${order.id} ¥${order.amountCny}`);
      res.json({
        ok: true,
        order,
        alreadyPaid,
        message: alreadyPaid ? "订单此前已开通" : "已手动开通会员",
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
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

  const notifyLimiter = rateLimit({ windowMs: 60_000, max: 120, message: "回调过于频繁" });

  /**
   * 支付宝异步通知：application/x-www-form-urlencoded + RSA2 验签。
   * 成功必须返回纯文本 success，否则支付宝会持续重试。
   */
  const alipayForm = express.urlencoded({ extended: false, limit: "64kb" });
  router.post("/notify/alipay", notifyLimiter, alipayForm, (req, res) => {
    const params = req.body || {};
    const check = verifyAlipayNotify(params);
    if (!check.ok) {
      console.warn(`[billing][alipay] 回调验签失败: ${check.error}`);
      return res.status(400).type("text/plain").send("failure");
    }

    const tradeStatus = String(params.trade_status || "");
    if (tradeStatus !== "TRADE_SUCCESS" && tradeStatus !== "TRADE_FINISHED") {
      // 非成功状态（关单/等待付款）直接确认，避免支付宝重复通知
      return res.type("text/plain").send("success");
    }

    const orderId = String(params.out_trade_no || "").trim();
    try {
      const { order, alreadyPaid } = markOrderPaidByChannel({
        orderId,
        amountCny: Number(params.total_amount),
        channelTxnId: params.trade_no,
        provider: "alipay",
      });
      console.info(
        `[billing][alipay] 回调开通 ${order.id} ¥${order.amountCny}${alreadyPaid ? "（重复通知，已幂等忽略）" : ""}`
      );
      res.type("text/plain").send("success");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[billing][alipay] 回调处理失败 ${orderId}: ${message}`);
      res.status(400).type("text/plain").send("failure");
    }
  });

  /**
   * 微信支付 APIv3 通知：JSON + 平台证书验签 + AES-256-GCM 解密 resource。
   * 成功返回 { code: "SUCCESS" }，失败返回非 2xx 触发微信重试。
   */
  router.post("/notify/wechat", notifyLimiter, (req, res) => {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      return res.status(400).json({ code: "FAIL", message: "缺少请求体（需 application/json）" });
    }

    const check = verifyWechatNotify({
      headers: req.headers,
      rawBody,
      toleranceMs: NOTIFY_TOLERANCE_MS,
    });
    if (!check.ok) {
      console.warn(`[billing][wechat] 回调验签失败: ${check.error}`);
      return res.status(check.status || 401).json({ code: "FAIL", message: check.error });
    }

    if (req.body?.event_type && req.body.event_type !== "TRANSACTION.SUCCESS") {
      return res.json({ code: "SUCCESS", message: "成功" });
    }

    let payload;
    try {
      payload = decryptWechatResource(req.body?.resource);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[billing][wechat] 回调解密失败: ${message}`);
      return res.status(400).json({ code: "FAIL", message: "回调解密失败" });
    }

    if (payload.trade_state !== "SUCCESS") {
      return res.json({ code: "SUCCESS", message: "成功" });
    }

    const cfg = wechatConfig();
    if ((cfg.appId && payload.appid !== cfg.appId) || (cfg.mchId && payload.mchid !== cfg.mchId)) {
      console.warn("[billing][wechat] 回调商户号或应用 ID 不匹配");
      return res.status(400).json({ code: "FAIL", message: "商户信息不匹配" });
    }

    const totalCents = Number(payload.amount?.total);
    if (!Number.isFinite(totalCents)) {
      return res.status(400).json({ code: "FAIL", message: "回调金额无效" });
    }

    const orderId = String(payload.out_trade_no || "").trim();
    try {
      const { order, alreadyPaid } = markOrderPaidByChannel({
        orderId,
        amountCny: totalCents / 100,
        channelTxnId: payload.transaction_id,
        provider: "wechat",
      });
      console.info(
        `[billing][wechat] 回调开通 ${order.id} ¥${order.amountCny}${alreadyPaid ? "（重复通知，已幂等忽略）" : ""}`
      );
      res.json({ code: "SUCCESS", message: "成功" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[billing][wechat] 回调处理失败 ${orderId}: ${message}`);
      res.status(400).json({ code: "FAIL", message });
    }
  });

  /**
   * 通用支付回调（渠道无关）。渠道配置：
   * - POST /api/billing/notify，Content-Type: application/json
   * - Header：X-Yunlan-Timestamp / X-Yunlan-Nonce / X-Yunlan-Signature
   * - Signature = hex(HMAC-SHA256(BILLING_NOTIFY_SECRET, `${timestamp}.${nonce}.${rawBody}`))
   * - Body：{ orderId, amountCny, status: "paid", channelTxnId? }
   * 校验金额 + 订单状态，按订单幂等开通，重复通知不会重复延长会员。
   */
  router.post("/notify", notifyLimiter, (req, res) => {
    const rawBody = req.rawBody;
    if (!rawBody?.length) {
      return res.status(400).json({ ok: false, error: "缺少请求体（需 application/json）" });
    }

    const check = verifyNotifySignature({
      secret: BILLING_NOTIFY_SECRET,
      timestamp: req.headers["x-yunlan-timestamp"],
      nonce: req.headers["x-yunlan-nonce"],
      signature: req.headers["x-yunlan-signature"],
      rawBody,
      toleranceMs: NOTIFY_TOLERANCE_MS,
    });
    if (!check.ok) {
      return res.status(check.status).json({ ok: false, error: check.error });
    }

    let payload;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return res.status(400).json({ ok: false, error: "回调内容不是合法 JSON" });
    }

    const orderId = String(payload?.orderId || "").trim();
    if (!orderId || orderId.length > 64) {
      return res.status(400).json({ ok: false, error: "orderId 无效" });
    }
    const status = String(payload?.status || "paid").toLowerCase();
    if (status !== "paid") {
      // 失败/关闭通知无需落库，直接确认避免渠道反复重试
      return res.json({ ok: true, ignored: true });
    }

    try {
      const { order, alreadyPaid } = markOrderPaidByChannel({
        orderId,
        amountCny: payload?.amountCny,
        channelTxnId: payload?.channelTxnId,
      });
      console.info(
        `[billing] 回调开通 ${order.id} ¥${order.amountCny}${alreadyPaid ? "（重复通知，已幂等忽略）" : ""}`
      );
      res.json({ ok: true, orderId: order.id, alreadyPaid });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[billing] 回调处理失败 ${orderId}: ${message}`);
      res.status(400).json({ ok: false, error: message });
    }
  });

  return router;
}
