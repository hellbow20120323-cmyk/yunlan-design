import { Router } from "express";
import { PASSWORD_MAX_LENGTH, burnPasswordTime, hashPassword, verifyPassword } from "./crypto.js";
import {
  clearSessionCookie,
  getOrCreateClientId,
  getSessionFromRequest,
  setSessionCookie,
} from "./cookies.js";
import { createUser, findUserByEmail } from "./user-store.js";
import { getQuotaStatus, grantSignupGift } from "../points/quota.js";
import { clientIp, rateLimit } from "../security.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function createAuthRouter() {
  const router = Router();

  // 登录：同一 IP+邮箱 15 分钟内最多 10 次；注册：同一 IP 每小时 5 次
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    message: "登录尝试过于频繁，请 15 分钟后再试",
    key: (req) => `${clientIp(req)}|${String(req.body?.email || "").trim().toLowerCase().slice(0, 254)}`,
  });
  const loginIpLimiter = rateLimit({
    windowMs: 15 * 60_000,
    max: 60,
    message: "登录尝试过于频繁，请稍后再试",
  });
  const registerLimiter = rateLimit({
    windowMs: 60 * 60_000,
    max: 5,
    message: "注册过于频繁，请 1 小时后再试",
  });

  router.get("/me", (req, res) => {
    const clientId = getOrCreateClientId(req, res);
    const session = getSessionFromRequest(req);
    const points = getQuotaStatus({
      userId: session?.uid,
      clientId,
    });
    res.json({
      ok: true,
      user: session ? { id: session.uid, email: session.email } : null,
      points,
      clientId,
    });
  });

  router.post("/register", registerLimiter, async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");
      if (email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ ok: false, error: "邮箱格式不正确" });
      }
      if (password.length < 8) {
        return res.status(400).json({ ok: false, error: "密码至少 8 位" });
      }
      if (password.length > PASSWORD_MAX_LENGTH) {
        return res.status(400).json({ ok: false, error: `密码不能超过 ${PASSWORD_MAX_LENGTH} 位` });
      }
      if (findUserByEmail(email)) {
        return res.status(400).json({ ok: false, error: "该邮箱已注册" });
      }
      const user = createUser(email, await hashPassword(password));
      grantSignupGift(user.id);
      setSessionCookie(res, user, req);
      const clientId = getOrCreateClientId(req, res);
      res.json({
        ok: true,
        user: { id: user.id, email: user.email },
        points: getQuotaStatus({ userId: user.id, clientId }),
        message: "注册成功",
      });
    } catch (err) {
      res.status(400).json({
        ok: false,
        error: err instanceof Error ? err.message : "注册失败",
      });
    }
  });

  router.post("/login", loginIpLimiter, loginLimiter, async (req, res) => {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    if (!email || !password || password.length > PASSWORD_MAX_LENGTH) {
      return res.status(401).json({ ok: false, error: "邮箱或密码错误" });
    }
    const found = findUserByEmail(email);
    const ok = found ? await verifyPassword(password, found.passwordHash) : await burnPasswordTime(password);
    if (!found || !ok) {
      return res.status(401).json({ ok: false, error: "邮箱或密码错误" });
    }
    loginLimiter.reset(`${clientIp(req)}|${email.toLowerCase().slice(0, 254)}`);
    setSessionCookie(res, found, req);
    const clientId = getOrCreateClientId(req, res);
    res.json({
      ok: true,
      user: { id: found.id, email: found.email },
      points: getQuotaStatus({ userId: found.id, clientId }),
    });
  });

  router.post("/logout", (req, res) => {
    clearSessionCookie(res, req);
    const clientId = getOrCreateClientId(req, res);
    res.json({
      ok: true,
      points: getQuotaStatus({ userId: null, clientId }),
    });
  });

  return router;
}
