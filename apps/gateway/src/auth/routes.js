import { Router } from "express";
import { hashPassword, verifyPassword } from "./crypto.js";
import {
  clearSessionCookie,
  getOrCreateClientId,
  getSessionFromRequest,
  setSessionCookie,
} from "./cookies.js";
import { createUser, findUserByEmail } from "./user-store.js";
import { getQuotaStatus, grantSignupGift } from "../points/quota.js";

export function createAuthRouter() {
  const router = Router();

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

  router.post("/register", (req, res) => {
    try {
      const email = String(req.body?.email || "").trim();
      const password = String(req.body?.password || "");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: "邮箱格式不正确" });
      }
      if (password.length < 8) {
        return res.status(400).json({ ok: false, error: "密码至少 8 位" });
      }
      const user = createUser(email, hashPassword(password));
      grantSignupGift(user.id);
      setSessionCookie(res, user);
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
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post("/login", (req, res) => {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const found = findUserByEmail(email);
    if (!found || !verifyPassword(password, found.passwordHash)) {
      return res.status(401).json({ ok: false, error: "邮箱或密码错误" });
    }
    setSessionCookie(res, found);
    const clientId = getOrCreateClientId(req, res);
    res.json({
      ok: true,
      user: { id: found.id, email: found.email },
      points: getQuotaStatus({ userId: found.id, clientId }),
    });
  });

  router.post("/logout", (req, res) => {
    clearSessionCookie(res);
    const clientId = getOrCreateClientId(req, res);
    res.json({
      ok: true,
      points: getQuotaStatus({ userId: null, clientId }),
    });
  });

  return router;
}
