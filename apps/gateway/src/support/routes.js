/**
 * 自愿支持申请：API 与页面路由。
 *
 * 风控硬性规则（写死）：
 * 1. 不存在到账自动放行；所有结论必须人工提交
 * 2. 赞赏码只在申请浮层内、且用户选择「自愿支持」后才加载，不进入邮件与公网静态资源
 * 3. 临时凭证 24 小时过期，可重复访问（不做单次消耗）
 * 4. 口令仅辅助匹配，不是审核必要条件
 * 5. 未勾选邮件许可绝不调用邮件接口；邮件只放口令与找回链接，不放赞赏码
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import express, { Router } from "express";
import { parseCookieHeader } from "../auth/cookies.js";
import { clientIp, rateLimit, requireAdmin } from "../security.js";
import { dataPath } from "../paths.js";
import { findUserByEmail } from "../auth/user-store.js";
import { extendSubscription } from "../billing/subscription-store.js";
import { getPlan } from "../billing/plans.js";
import {
  isValidEmail,
  maskEmail,
  normalizeEmail,
  signAppSession,
  verifyAppSession,
  verifyUnsubscribeToken,
} from "./codes.js";
import {
  canSendNotice,
  isMailConfigured,
  sendApplicationNotice,
  sendReviewNotice,
} from "./mailer.js";
import {
  addUpload,
  createOrReapplyApplication,
  createTempLink,
  findApplication,
  findApplicationByEmail,
  findUpload,
  getChoice,
  importDonations,
  invalidateLinksForApp,
  listApplications,
  listCandidates,
  listReviews,
  listUploads,
  markCandidateReviewed,
  markCandidatesForAppReviewed,
  parseDonationCsv,
  recordReview,
  resolveTempLink,
  setApplicationMailStatus,
  setChoice,
  setOptIn,
  supportStats,
} from "./store.js";
import {
  ADMIN_JS,
  RELAY_JS,
  renderAdminPage,
  renderExpiredPage,
  renderMessagePage,
} from "./pages.js";

const APP_COOKIE = "yl_app";
const APP_SESSION_MS = 30 * 86400000;
const UPLOAD_DIR = dataPath("support-uploads");
const QR_DIR = dataPath("support");
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

const rawImage = express.raw({ type: IMAGE_TYPES, limit: MAX_UPLOAD_BYTES });
const formBody = express.urlencoded({ extended: false, limit: "32kb" });

/* ------------------------------------------------------------------ */
/* Cookie / 图片                                                       */
/* ------------------------------------------------------------------ */

function isSecureRequest(req) {
  const forced = String(process.env.COOKIE_SECURE ?? "").toLowerCase();
  if (["1", "true", "yes"].includes(forced)) return true;
  if (["0", "false", "no"].includes(forced)) return false;
  if (req.secure) return true;
  const xfp = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim().toLowerCase();
  if (xfp === "https") return true;
  return /"scheme"\s*:\s*"https"/i.test(String(req.headers["cf-visitor"] || ""));
}

function getAppFromRequest(req) {
  const cookies = parseCookieHeader(req.headers.cookie);
  const appId = verifyAppSession(cookies[APP_COOKIE]);
  return appId ? findApplication(appId) : null;
}

function detectImageType(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return "";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return "";
}

function extensionFor(mime) {
  return mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
}

function ensurePrivateDir(dir) {
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function qrFilePath() {
  for (const ext of ["png", "jpg", "webp"]) {
    const file = path.join(QR_DIR, `qr.${ext}`);
    if (fs.existsSync(file)) return { file, mime: `image/${ext === "jpg" ? "jpeg" : ext}` };
  }
  return null;
}

function saveQr(buffer, mime) {
  ensurePrivateDir(QR_DIR);
  for (const ext of ["png", "jpg", "webp"]) {
    const file = path.join(QR_DIR, `qr.${ext}`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  const file = path.join(QR_DIR, `qr.${extensionFor(mime)}`);
  fs.writeFileSync(file, buffer, { mode: 0o600 });
  return file;
}

function noStore(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
}

/* ------------------------------------------------------------------ */
/* API                                                                 */
/* ------------------------------------------------------------------ */

export function createSupportRouter() {
  const router = Router();

  const submitIpLimiter = rateLimit({
    windowMs: 60 * 60_000,
    max: 5,
    message: "提交过于频繁，请稍后再试",
  });
  const submitEmailLimiter = rateLimit({
    windowMs: 24 * 60 * 60_000,
    max: 3,
    message: "该邮箱提交过于频繁，请明天再试",
    key: (req) => normalizeEmail(req.body?.email).slice(0, 254) || clientIp(req),
  });
  const uploadLimiter = rateLimit({ windowMs: 60 * 60_000, max: 30, message: "上传过于频繁" });
  const retrieveLimiter = rateLimit({
    windowMs: 10 * 60_000,
    max: 10,
    message: "查找过于频繁，请稍后再试",
    key: (req) => normalizeEmail(req.body?.email).slice(0, 254) || clientIp(req),
  });

  function credentialPayload(app, token, link) {
    return {
      code: app.code,
      token,
      expiresAt: link.expireAt,
      email: maskEmail(app.email),
      status: app.status,
      choice: getChoice(app.id),
      qrAvailable: Boolean(qrFilePath()),
    };
  }

  /** 提交/找回接口都返回同一份凭证结构，前端浮层复用 */
  function issueCredential(app) {
    const { token, link } = createTempLink(app.id);
    return credentialPayload(app, token, link);
  }

  function appFromTokenOrCookie(req) {
    const token = String(req.query.token || req.headers["x-support-token"] || "").trim();
    if (token) {
      const result = resolveTempLink(token);
      return result.status === "ok" ? result.app : null;
    }
    return getAppFromRequest(req);
  }

  /**
   * 提交申请。口令与临时凭证直接由响应返回给当前页面，邮件只作为兜底。
   */
  router.post("/applications", submitIpLimiter, submitEmailLimiter, async (req, res) => {
    const email = normalizeEmail(req.body?.email);
    const optIn = req.body?.optInEmail === true || req.body?.optInEmail === "true";
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "邮箱格式不正确" });
    }

    let created;
    try {
      created = createOrReapplyApplication({ email, optInEmail: optIn });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "提交失败" });
    }
    const app = created.application;

    // 同一邮箱先未勾选、后补勾选时，允许补发一次；已退订的申请不会因此被重新订阅
    let shouldSend = created.created;
    if (
      !created.created &&
      optIn &&
      !app.optInEmail &&
      !app.unsubscribedAt &&
      app.status === "pending_review"
    ) {
      setOptIn(app.id, true);
      app.optInEmail = true;
      app.optInAt = new Date().toISOString();
      shouldSend = true;
    }

    const { token, link } = createTempLink(app.id);

    // 异步兜底邮件：不阻塞页面渲染，失败只记录状态
    if (shouldSend) {
      if (!app.optInEmail) {
        setApplicationMailStatus(app.id, "skipped_opt_out");
      } else if (!isMailConfigured()) {
        setApplicationMailStatus(app.id, "not_configured");
        console.warn("[support] 未配置 ZeptoMail，申请已入库但未发送邮件");
      } else {
        setApplicationMailStatus(app.id, "pending");
        sendApplicationNotice(app, token)
          .then((info) => setApplicationMailStatus(app.id, info.sent ? "sent" : info.reason || "skipped"))
          .catch((err) => {
            const message = err instanceof Error ? err.message : String(err);
            console.warn("[support] 申请通知邮件发送失败:", message);
            setApplicationMailStatus(app.id, "failed", message);
          });
      }
    }

    res.json({
      ok: true,
      status: app.status,
      credential: credentialPayload(app, token, link),
      message: "申请已提交并进入人工审核队列。",
    });
  });

  router.get("/status", (req, res) => {
    const app = appFromTokenOrCookie(req);
    if (!app) return res.status(401).json({ ok: false, error: "无法识别申请，请使用邮箱找回" });
    const uploads = listUploads(app.id).map((u) => ({
      id: u.id,
      tradeNo: u.tradeNo,
      createdAt: u.createdAt,
    }));
    res.json({
      ok: true,
      application: {
        id: app.id,
        email: maskEmail(app.email),
        code: app.code,
        status: app.status,
        createdAt: app.createdAt,
        optInEmail: app.optInEmail,
        choice: getChoice(app.id),
      },
      uploads,
    });
  });

  /** 校验临时凭证：24h 内可重复调用，用于页面刷新或从邮件链接恢复浮层 */
  router.get("/credential", (req, res) => {
    const token = String(req.query.token || "").trim();
    const result = resolveTempLink(token);
    if (result.status !== "ok") {
      return res.status(410).json({
        ok: false,
        error: result.status === "expired" ? "凭证已过期，请用邮箱重新找回" : "凭证无效",
      });
    }
    res.json({ ok: true, credential: credentialPayload(result.app, token, result.link) });
  });

  /** 通过邮箱找回：命中即签发新的 24h 凭证，不依赖邮件 */
  router.post("/retrieve", retrieveLimiter, (req, res) => {
    const email = normalizeEmail(req.body?.email);
    if (!isValidEmail(email)) {
      return res.status(400).json({ ok: false, error: "邮箱格式不正确" });
    }
    const app = findApplicationByEmail(email);
    if (!app) {
      return res.status(404).json({ ok: false, error: "未找到该邮箱的申请，请先提交申请" });
    }
    res.json({ ok: true, credential: issueCredential(app) });
  });

  /** 页面内浮层选择：support（自愿支持）/ skip（等待人工审核） */
  router.post("/choice", (req, res) => {
    const token = String(req.body?.token || req.query.token || "").trim();
    const result = resolveTempLink(token);
    if (result.status !== "ok") {
      return res.status(410).json({ ok: false, error: "凭证已失效，请重新找回" });
    }
    const value = String(req.body?.choice || "");
    try {
      setChoice(result.app.id, value);
    } catch {
      return res.status(400).json({ ok: false, error: "无效选项" });
    }
    res.json({ ok: true, choice: value });
  });

  /** 赞赏码：仅在凭证有效且已选择「自愿支持」后返回，禁止缓存与索引 */
  router.get("/qr", (req, res) => {
    noStore(res);
    const result = resolveTempLink(String(req.query.token || "").trim());
    if (result.status !== "ok" || getChoice(result.app.id) !== "support") {
      return res.status(404).send("not found");
    }
    const qr = qrFilePath();
    if (!qr) return res.status(404).send("not found");
    res.setHeader("Content-Type", qr.mime);
    res.send(fs.readFileSync(qr.file));
  });

  /**
   * 上传兜底凭证：支持图片原样上传或仅 JSON 交易单号。
   * 仅允许待审核申请补充凭证。
   */
  router.post("/uploads", uploadLimiter, rawImage, (req, res) => {
    const app = appFromTokenOrCookie(req);
    if (!app) return res.status(401).json({ ok: false, error: "无法识别申请" });
    if (app.status !== "pending_review") {
      return res.status(400).json({ ok: false, error: "申请已结束，无需再补充凭证" });
    }

    const tradeNo = String(
      req.query.tradeNo ||
        req.headers["x-trade-no"] ||
        (req.body && !Buffer.isBuffer(req.body) ? req.body.tradeNo : "") ||
        ""
    )
      .trim()
      .slice(0, 64);
    const body = Buffer.isBuffer(req.body) ? req.body : null;
    if (!body && !tradeNo) {
      return res.status(400).json({ ok: false, error: "请填写交易单号或上传截图" });
    }

    let imgPath = "";
    let mime = "";
    let size = 0;
    if (body) {
      if (body.length > MAX_UPLOAD_BYTES) {
        return res.status(413).json({ ok: false, error: "图片不能超过 2MB" });
      }
      mime = detectImageType(body);
      if (!mime) return res.status(400).json({ ok: false, error: "仅支持 PNG / JPEG / WebP 图片" });
      ensurePrivateDir(UPLOAD_DIR);
      imgPath = `${crypto.randomUUID()}.${extensionFor(mime)}`;
      fs.writeFileSync(path.join(UPLOAD_DIR, imgPath), body, { mode: 0o600 });
      size = body.length;
    }

    try {
      const upload = addUpload({ appId: app.id, imgPath, mime, size, tradeNo });
      res.json({
        ok: true,
        upload: { id: upload.id, tradeNo: upload.tradeNo, createdAt: upload.createdAt },
      });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "提交失败" });
    }
  });

  /* ---------------------------- 管理端 ---------------------------- */

  // 路径含 "stats" 会被 Cloudflare 直接拦截（403），故命名为 overview
  router.get("/admin/overview", requireAdmin, (_req, res) => {
    res.json({ ok: true, stats: supportStats() });
  });

  router.get("/admin/applications", requireAdmin, (req, res) => {
    const status = String(req.query.status || "").trim();
    const applications = listApplications({
      status,
      limit: Number(req.query.limit) || 100,
      q: req.query.q,
    });
    res.json({ ok: true, applications });
  });

  router.get("/admin/applications/:id", requireAdmin, (req, res) => {
    const app = findApplication(req.params.id);
    if (!app) return res.status(404).json({ ok: false, error: "申请不存在" });
    const candidates = listCandidates({ reviewed: false, limit: 500 }).filter(
      (c) => c.matchAppId === app.id
    );
    res.json({
      ok: true,
      application: { ...app, choice: getChoice(app.id) },
      reviews: listReviews(app.id),
      uploads: listUploads(app.id),
      candidates,
    });
  });

  /**
   * 人工终审：唯一能改变申请状态的入口。
   * 可选 grantPlanId 仅对同邮箱已注册用户开通权限；不传则只改申请状态。
   */
  router.post("/admin/applications/:id/review", requireAdmin, (req, res) => {
    const action = String(req.body?.action || "");
    const note = String(req.body?.note || "").slice(0, 500);
    const grantPlanId = req.body?.grantPlanId ? String(req.body.grantPlanId) : "";
    if (grantPlanId && !getPlan(grantPlanId)) {
      return res.status(400).json({ ok: false, error: "无效的权限套餐" });
    }
    let result;
    try {
      result = recordReview({ appId: req.params.id, action, note, grantedPlanId: grantPlanId || null });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "审核失败" });
    }

    let granted = null;
    if (!result.already && result.application.status === "approved" && grantPlanId) {
      const user = findUserByEmail(result.application.email);
      if (user) {
        extendSubscription(user.id, grantPlanId);
        granted = { userId: user.id, email: user.email, planId: grantPlanId };
      } else {
        granted = { userId: null, email: result.application.email, planId: grantPlanId, note: "同邮箱未注册，未实际开通权限" };
      }
    }
    if (!result.already) markCandidatesForAppReviewed(result.application.id);

    const finish = (mail) => {
      res.json({
        ok: true,
        application: result.application,
        review: result.review,
        already: Boolean(result.already),
        granted,
        mail,
        message: result.already
          ? "该申请此前已通过审核"
          : result.application.status === "approved"
            ? "已人工审核通过"
            : "已驳回申请",
      });
    };

    if (result.already || !result.review) {
      return finish({ sent: false, reason: "already_reviewed" });
    }
    if (!canSendNotice(result.application)) {
      return finish({ sent: false, reason: "opt_out" });
    }
    if (!isMailConfigured()) {
      return finish({ sent: false, reason: "mail_not_configured" });
    }
    sendReviewNotice(result.application, result.review)
      .then((mail) => {
        if (mail.sent) setApplicationMailStatus(result.application.id, "review_sent");
        finish(mail);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.warn("[support] 审核结果邮件发送失败:", message);
        setApplicationMailStatus(result.application.id, "review_failed", message);
        finish({ sent: false, reason: "send_failed", error: message });
      });
  });

  /** 重发当前状态通知；pending 发申请邮件，已终审发结果邮件 */
  router.post("/admin/applications/:id/resend", requireAdmin, async (req, res) => {
    const app = findApplication(req.params.id);
    if (!app) return res.status(404).json({ ok: false, error: "申请不存在" });
    if (!canSendNotice(app)) {
      return res.json({ ok: true, mail: { sent: false, reason: "opt_out" } });
    }
    if (!isMailConfigured()) {
      return res.json({ ok: true, mail: { sent: false, reason: "mail_not_configured" } });
    }
    try {
      let mail;
      if (app.status === "pending_review") {
        invalidateLinksForApp(app.id);
        const { token } = createTempLink(app.id);
        mail = await sendApplicationNotice(app, token);
      } else {
        const review = listReviews(app.id)[0];
        mail = review
          ? await sendReviewNotice(app, review)
          : { sent: false, reason: "no_review" };
      }
      setApplicationMailStatus(app.id, mail.sent ? "resent" : mail.reason || "skipped");
      res.json({ ok: true, mail });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setApplicationMailStatus(app.id, "resend_failed", message);
      res.status(502).json({ ok: false, error: message, mail: { sent: false, reason: "send_failed" } });
    }
  });

  /** 人工导入账单：CSV 或 records 数组，只生成候选 */
  router.post("/admin/donations/import", requireAdmin, (req, res) => {
    const csv = String(req.body?.csv || "");
    const records = Array.isArray(req.body?.records)
      ? req.body.records
      : csv.trim()
        ? parseDonationCsv(csv)
        : [];
    if (!records.length) {
      return res.status(400).json({ ok: false, error: "没有可导入的账单记录" });
    }
    if (records.length > 5000) {
      return res.status(400).json({ ok: false, error: "单次最多导入 5000 条" });
    }
    const result = importDonations(records, { source: req.body?.source || "manual" });
    res.json({ ok: true, ...result });
  });

  router.get("/admin/candidates", requireAdmin, (req, res) => {
    const reviewed = ["1", "true", "yes"].includes(String(req.query.reviewed || "").toLowerCase());
    res.json({
      ok: true,
      candidates: listCandidates({ reviewed, limit: Number(req.query.limit) || 100 }),
    });
  });

  router.post("/admin/candidates/:id/reviewed", requireAdmin, (req, res) => {
    try {
      const candidate = markCandidateReviewed(req.params.id, req.body?.reviewed !== false);
      res.json({ ok: true, candidate });
    } catch (err) {
      res.status(400).json({ ok: false, error: err instanceof Error ? err.message : "操作失败" });
    }
  });

  router.get("/admin/uploads/:id/image", requireAdmin, (req, res) => {
    const upload = findUpload(req.params.id);
    if (!upload?.imgPath) return res.status(404).send("not found");
    const file = path.join(UPLOAD_DIR, path.basename(upload.imgPath));
    try {
      const buf = fs.readFileSync(file);
      res.setHeader("Content-Type", upload.mime || "application/octet-stream");
      res.setHeader("Cache-Control", "no-store");
      res.send(buf);
    } catch {
      res.status(404).send("not found");
    }
  });

  router.post("/admin/qr", requireAdmin, rawImage, (req, res) => {
    const body = Buffer.isBuffer(req.body) ? req.body : null;
    if (!body) return res.status(400).json({ ok: false, error: "请上传图片" });
    const mime = detectImageType(body);
    if (!mime) return res.status(400).json({ ok: false, error: "仅支持 PNG / JPEG / WebP 图片" });
    try {
      saveQr(body, mime);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err instanceof Error ? err.message : "保存失败" });
    }
  });

  return router;
}

/* ------------------------------------------------------------------ */
/* 页面                                                                */
/* ------------------------------------------------------------------ */

/** @param {import('express').Express} app */
export function registerSupportPages(app) {
  app.get("/support/admin.js", (_req, res) => {
    res.type("application/javascript").setHeader("Cache-Control", "no-store");
    res.send(ADMIN_JS);
  });

  app.get("/relay/app.js", (_req, res) => {
    res.type("application/javascript").setHeader("Cache-Control", "no-store");
    res.send(RELAY_JS);
  });

  app.get("/support/admin", (_req, res) => {
    noStore(res);
    res.type("html").send(renderAdminPage());
  });

  // 旧版中转页入口一律回到申请页，由页面内浮层展示口令与选项
  app.get("/relay/status", (req, res) => {
    noStore(res);
    res.redirect(302, "/support");
  });

  // 旧版赞赏码路由：仅保留给已打开过旧页面的浏览器 Cookie
  app.get("/relay/qr", (req, res) => {
    noStore(res);
    const appRecord = getAppFromRequest(req);
    const qr = qrFilePath();
    if (!appRecord || getChoice(appRecord.id) !== "support" || !qr) {
      return res.status(404).send("not found");
    }
    res.setHeader("Content-Type", qr.mime);
    res.send(fs.readFileSync(qr.file));
  });

  // 旧邮件中的 /relay/<token> 链接兼容：凭证未过期则跳到申请页并带 token
  app.get("/relay/:token", (req, res) => {
    noStore(res);
    const token = String(req.params.token || "");
    const result = resolveTempLink(token);
    if (result.status !== "ok") {
      return res.status(410).type("html").send(renderExpiredPage());
    }
    res.redirect(302, `/support?token=${encodeURIComponent(token)}`);
  });

  const unsubscribe = (req, res) => {
    noStore(res);
    const appId = verifyUnsubscribeToken(req.params.token);
    if (!appId) {
      return res.status(400).type("html").send(renderMessagePage("退订链接无效", "该退订链接无效或已损坏。"));
    }
    setOptIn(appId, false);
    res.type("html").send(renderMessagePage("已退订", "你已退订申请状态通知邮件，不再接收此类邮件。"));
  };
  app.get("/unsubscribe/:token", unsubscribe);
  app.post("/unsubscribe/:token", formBody, unsubscribe);
}
