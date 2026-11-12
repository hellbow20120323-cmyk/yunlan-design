/**
 * 邮件分发：国内版 ZeptoMail（SMTP）优先，预留海外收件人切换到国际版的入口。
 *
 * 关键约束：
 * - 仅当 application.optInEmail === true 且未退订时允许调用发信
 * - 邮件只包含口令、审核说明、24h 一次性中转链接，绝不包含赞赏码
 * - 所有邮件都带 List-Unsubscribe 与退订链接
 *
 * 网关保持零第三方依赖，因此这里用 node:net / node:tls 实现最小 SMTP 客户端。
 */
import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import os from "node:os";
import { PUBLIC_ORIGIN } from "../seo.js";
import { signUnsubscribeToken } from "./codes.js";

const SMTP_TIMEOUT_MS = Number(process.env.SUPPORT_SMTP_TIMEOUT_MS || 20_000);
const OVERSEAS_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "gmx.com",
  "yandex.com",
]);

function env(name, fallback = "") {
  const v = (process.env[name] ?? "").trim();
  return v || fallback;
}

export function mailConfig() {
  const port = Number(env("ZEPTOMAIL_SMTP_PORT", "587"));
  return {
    host: env("ZEPTOMAIL_SMTP_HOST", "smtp.zeptomail.com.cn"),
    port: Number.isFinite(port) ? port : 587,
    secure: env("ZEPTOMAIL_SMTP_SECURE", "") === ""
      ? port === 465
      : ["1", "true", "yes"].includes(env("ZEPTOMAIL_SMTP_SECURE", "").toLowerCase()),
    user: env("ZEPTOMAIL_SMTP_USER", "emailapikey"),
    pass: env("ZEPTOMAIL_SMTP_PASS", ""),
    from: env("MAIL_FROM", "noreply@hellbow.xyz"),
    fromName: env("MAIL_FROM_NAME", "云览 Yunlan"),
  };
}

export function intlMailConfig() {
  const port = Number(env("ZEPTOMAIL_INTL_SMTP_PORT", "587"));
  return {
    host: env("ZEPTOMAIL_INTL_SMTP_HOST", ""),
    port: Number.isFinite(port) ? port : 587,
    secure: env("ZEPTOMAIL_INTL_SMTP_SECURE", "") === ""
      ? port === 465
      : ["1", "true", "yes"].includes(env("ZEPTOMAIL_INTL_SMTP_SECURE", "").toLowerCase()),
    user: env("ZEPTOMAIL_INTL_SMTP_USER", "emailapikey"),
    pass: env("ZEPTOMAIL_INTL_SMTP_PASS", ""),
    from: env("MAIL_FROM", "noreply@hellbow.xyz"),
    fromName: env("MAIL_FROM_NAME", "云览 Yunlan"),
  };
}

/** 双路由预留：海外邮箱优先走国际版，未配置则回退国内版 */
export function pickMailRoute(to) {
  const domain = String(to || "").toLowerCase().split("@")[1] || "";
  const intl = intlMailConfig();
  if (OVERSEAS_DOMAINS.has(domain) && intl.host && intl.pass) {
    return { id: "intl", config: intl };
  }
  return { id: "cn", config: mailConfig() };
}

export function isMailConfigured() {
  const cn = mailConfig();
  const intl = intlMailConfig();
  return Boolean((cn.host && cn.user && cn.pass) || (intl.host && intl.user && intl.pass));
}

function isRouteConfigured(config) {
  return Boolean(config.host && config.user && config.pass);
}

export function canSendNotice(app) {
  return Boolean(app && app.optInEmail === true && !app.unsubscribedAt);
}

export function unsubscribeUrl(appId) {
  return `${PUBLIC_ORIGIN}/unsubscribe/${signUnsubscribeToken(appId)}`;
}

/* ------------------------------------------------------------------ */
/* 模板                                                                */
/* ------------------------------------------------------------------ */

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlShell({ title, intro, body, unsub }) {
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f7f7f6;color:#2a2826;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e1db;border-radius:12px;padding:24px;">
    <h1 style="margin:0 0 12px;font-size:18px;">${escapeHtml(title)}</h1>
    <p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#4b4844;">${escapeHtml(intro)}</p>
    ${body}
    <hr style="border:none;border-top:1px solid #e4e1db;margin:24px 0 12px;">
    <p style="margin:0;font-size:12px;line-height:1.6;color:#7a766f;">
      这是一封申请状态通知邮件。你可以随时<a href="${escapeHtml(unsub)}" style="color:#1661ab;">退订</a>，退订后不再接收此类邮件。
    </p>
  </div>
</body></html>`;
}

export function renderApplicationEmail(app, retrieveUrl) {
  const subject = "云览 · 支持申请已收到";
  const text = [
    "你好：",
    "",
    "你提交的云览站点支持申请已收到，正在等待人工审核。",
    "",
    `认领口令：${app.code}`,
    "口令仅用于账单备注辅助核对，不是审核通过的必要条件。",
    "",
    "找回链接（24 小时内可重复打开，用于重新查看口令与选项）：",
    retrieveUrl,
    "",
    "你可以选择自愿支持站点维护，也可以直接等待人工审核。自愿捐助不代表审核优先，也不保证通过，与权限发放没有任何绑定。",
    "",
    "—— 云览",
    `退订：${unsubscribeUrl(app.id)}`,
  ].join("\n");
  const body = `
    <div style="margin:0 0 16px;padding:16px;border:1px solid #e4e1db;border-radius:10px;background:#fafaf9;">
      <p style="margin:0 0 6px;font-size:12px;color:#7a766f;">认领口令</p>
      <p style="margin:0;font-size:28px;letter-spacing:6px;font-weight:700;font-family:ui-monospace,Menlo,monospace;">${escapeHtml(app.code)}</p>
      <p style="margin:8px 0 0;font-size:12px;line-height:1.6;color:#7a766f;">口令仅用于账单备注辅助核对，不是审核通过的必要条件。</p>
    </div>
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#4b4844;">找回链接（24 小时内可重复打开）：</p>
    <p style="margin:0 0 16px;"><a href="${escapeHtml(retrieveUrl)}" style="display:inline-block;padding:10px 16px;border-radius:8px;background:#1661ab;color:#fff;text-decoration:none;font-size:14px;">打开申请页</a></p>
    <p style="margin:0;font-size:12px;line-height:1.7;color:#7a766f;">你可以选择自愿支持站点维护，也可以直接等待人工审核。自愿捐助不代表审核优先，也不保证通过，与权限发放没有任何绑定。</p>
  `;
  return { subject, text, html: htmlShell({ title: subject, intro: "申请已进入人工审核队列。", body, unsub: unsubscribeUrl(app.id) }) };
}

export function renderReviewEmail(app, review) {
  const approved = review?.action === "approve";
  const subject = approved ? "云览 · 申请审核结果：已通过" : "云览 · 申请审核结果：未通过";
  const note = String(review?.note || "").trim();
  const intro = approved
    ? "你的申请已通过人工审核。"
    : "很抱歉，本次申请未通过人工审核。";
  const text = [
    "你好：",
    "",
    intro,
    ...(note ? ["", `审核备注：${note}`] : []),
    "",
    `申请邮箱：${app.email}`,
    "",
    "如需停止接收状态通知，可随时退订。",
    "",
    "—— 云览",
    `退订：${unsubscribeUrl(app.id)}`,
  ].join("\n");
  const body = `
    <p style="margin:0 0 12px;font-size:14px;line-height:1.7;color:#4b4844;">${escapeHtml(intro)}</p>
    ${note ? `<p style="margin:0;padding:12px;border-radius:8px;background:#fafaf9;font-size:13px;line-height:1.7;color:#4b4844;">审核备注：${escapeHtml(note)}</p>` : ""}
    <p style="margin:16px 0 0;font-size:12px;color:#7a766f;">申请邮箱：${escapeHtml(app.email)}</p>
  `;
  return { subject, text, html: htmlShell({ title: subject, intro, body, unsub: unsubscribeUrl(app.id) }) };
}

/* ------------------------------------------------------------------ */
/* MIME                                                                */
/* ------------------------------------------------------------------ */

function cleanHeader(value) {
  return String(value ?? "").replace(/[\r\n]+/g, " ").trim();
}

function encodeWord(value) {
  const s = cleanHeader(value);
  if (/^[\x20-\x7E]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`;
}

function base64Lines(text) {
  return Buffer.from(String(text ?? ""), "utf8")
    .toString("base64")
    .replace(/(.{76})/g, "$1\r\n");
}

/** @returns {{ message: string, headers: string }} */
export function buildMimeMessage({
  from,
  fromName,
  to,
  subject,
  text,
  html,
  unsubscribe,
  mailtoUnsubscribe,
  now = new Date(),
}) {
  const boundary = `yl_${crypto.randomBytes(12).toString("hex")}`;
  const fromAddr = cleanHeader(from);
  const toAddr = cleanHeader(to);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fromAddr) || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toAddr)) {
    throw new Error("邮件地址无效");
  }
  const domain = fromAddr.split("@")[1] || "hellbow.xyz";
  const headers = [
    `From: ${encodeWord(fromName)} <${fromAddr}>`,
    `To: <${toAddr}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${now.toUTCString()}`,
    `Message-ID: <${crypto.randomBytes(16).toString("hex")}@${domain}>`,
    "MIME-Version: 1.0",
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
  ];
  if (unsubscribe) {
    headers.push(`List-Unsubscribe: <${cleanHeader(unsubscribe)}>${mailtoUnsubscribe ? `, <${cleanHeader(mailtoUnsubscribe)}>` : ""}`);
    headers.push("List-Unsubscribe-Post: List-Unsubscribe=One-Click");
  }
  headers.push("X-Auto-Response-Suppress: All");
  const message = [
    headers.join("\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    base64Lines(html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
  return { message, headers: headers.join("\r\n") };
}

/* ------------------------------------------------------------------ */
/* 最小 SMTP 客户端                                                     */
/* ------------------------------------------------------------------ */

function createReader(socket) {
  let buffer = "";
  let lines = null;
  let code = 0;
  /** @type {Array<{code:number,text:string}>} */
  const ready = [];
  let waiter = null;

  function settle(res) {
    if (!waiter) {
      ready.push(res);
      return;
    }
    const { resolve, timer } = waiter;
    waiter = null;
    clearTimeout(timer);
    resolve(res);
  }

  function drain() {
    while (true) {
      const idx = buffer.indexOf("\r\n");
      if (idx === -1) return;
      const line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      if (!lines) {
        const m = /^(\d{3})([ -])(.*)$/.exec(line);
        if (!m) continue;
        code = Number(m[1]);
        lines = [line];
        if (m[2] === " ") {
          const text = lines.join("\n");
          lines = null;
          settle({ code, text });
        }
      } else {
        lines.push(line);
        if (/^\d{3} /.test(line)) {
          const text = lines.join("\n");
          lines = null;
          settle({ code, text });
        }
      }
    }
  }

  const onData = (chunk) => {
    buffer += chunk;
    drain();
  };
  const onError = (err) => {
    if (!waiter) return;
    const { reject, timer } = waiter;
    waiter = null;
    clearTimeout(timer);
    reject(err);
  };
  const onClose = () => onError(new Error("SMTP 连接已关闭"));
  socket.setEncoding("utf8");
  socket.on("data", onData);
  socket.on("error", onError);
  socket.on("close", onClose);

  return {
    read(timeoutMs = SMTP_TIMEOUT_MS) {
      if (ready.length) return Promise.resolve(ready.shift());
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (!waiter) return;
          waiter = null;
          reject(new Error("等待 SMTP 响应超时"));
        }, timeoutMs);
        waiter = { resolve, reject, timer };
        drain();
      });
    },
    dispose() {
      socket.removeListener("data", onData);
      socket.removeListener("error", onError);
      socket.removeListener("close", onClose);
    },
  };
}

function openSocket({ host, port, secure }) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host, minVersion: "TLSv1.2" })
      : net.connect({ host, port });
    const timer = setTimeout(() => {
      socket.destroy(new Error("SMTP 连接超时"));
    }, SMTP_TIMEOUT_MS);
    timer.unref?.();
    const done = () => {
      clearTimeout(timer);
      socket.setTimeout(SMTP_TIMEOUT_MS, () => socket.destroy(new Error("SMTP 读写超时")));
      resolve(socket);
    };
    socket.once("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    if (secure) socket.once("secureConnect", done);
    else socket.once("connect", done);
  });
}

async function command(socket, reader, line, expect) {
  socket.write(`${line}\r\n`);
  const res = await reader.read();
  if (expect !== undefined && res.code !== expect) {
    throw new Error(`SMTP 命令失败（${line.split(" ")[0]}）：${res.code} ${res.text}`);
  }
  return res;
}

function capabilitiesOf(text) {
  return text
    .split("\n")
    .map((l) => l.replace(/^\d{3}[- ]/, "").trim())
    .filter(Boolean);
}

function dotStuff(message) {
  return message
    .split("\r\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

export async function deliverMail({ to, subject, text, html, unsubscribe, mailtoUnsubscribe, config = mailConfig() }) {
  if (!config.host || !config.user || !config.pass) {
    throw new Error("邮件服务未配置（缺少 ZEPTOMAIL_SMTP_PASS）");
  }
  const { message } = buildMimeMessage({
    from: config.from,
    fromName: config.fromName,
    to,
    subject,
    text,
    html,
    unsubscribe,
    mailtoUnsubscribe,
  });

  let socket = await openSocket(config);
  let reader = createReader(socket);
  try {
    let res = await reader.read();
    if (res.code !== 220) throw new Error(`SMTP 欢迎响应异常：${res.code} ${res.text}`);

    const hostname = os.hostname() || "yunlan.local";
    res = await command(socket, reader, `EHLO ${hostname}`, 250);
    let caps = capabilitiesOf(res.text);

    if (!config.secure) {
      if (!caps.some((c) => /^STARTTLS$/i.test(c))) {
        throw new Error("SMTP 服务器未提供 STARTTLS，已按强制 TLS 策略拒绝发送");
      }
      await command(socket, reader, "STARTTLS", 220);
      socket.setTimeout(0);
      reader.dispose();
      const secured = tls.connect({ socket, servername: config.host, minVersion: "TLSv1.2" });
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("STARTTLS 握手超时")), SMTP_TIMEOUT_MS);
        secured.once("secureConnect", () => {
          clearTimeout(timer);
          resolve();
        });
        secured.once("error", (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      socket = secured;
      socket.setTimeout(SMTP_TIMEOUT_MS, () => socket.destroy(new Error("SMTP 读写超时")));
      reader = createReader(socket);
      res = await command(socket, reader, `EHLO ${hostname}`, 250);
      caps = capabilitiesOf(res.text);
    }

    const authLine = caps.find((c) => /^AUTH\b/i.test(c)) || "";
    if (/PLAIN/i.test(authLine)) {
      const token = Buffer.from(`\0${config.user}\0${config.pass}`, "utf8").toString("base64");
      await command(socket, reader, `AUTH PLAIN ${token}`, 235);
    } else if (/LOGIN/i.test(authLine)) {
      socket.write("AUTH LOGIN\r\n");
      let r = await reader.read();
      if (r.code !== 334) throw new Error(`SMTP AUTH LOGIN 失败：${r.code}`);
      socket.write(`${Buffer.from(config.user, "utf8").toString("base64")}\r\n`);
      r = await reader.read();
      if (r.code !== 334) throw new Error(`SMTP AUTH LOGIN 用户名失败：${r.code}`);
      socket.write(`${Buffer.from(config.pass, "utf8").toString("base64")}\r\n`);
      r = await reader.read();
      if (r.code !== 235) throw new Error(`SMTP AUTH LOGIN 密码失败：${r.code}`);
    } else {
      throw new Error("SMTP 服务器未提供可用的认证方式");
    }

    await command(socket, reader, `MAIL FROM:<${config.from}>`, 250);
    res = await command(socket, reader, `RCPT TO:<${to}>`);
    if (res.code !== 250 && res.code !== 251) {
      throw new Error(`SMTP 收件人被拒绝：${res.code} ${res.text}`);
    }
    await command(socket, reader, "DATA", 354);
    socket.write(`${dotStuff(message)}\r\n.\r\n`);
    res = await reader.read();
    if (res.code !== 250) throw new Error(`SMTP 投递失败：${res.code} ${res.text}`);
    try {
      await command(socket, reader, "QUIT", 221);
    } catch {
      /* 已投递成功，QUIT 失败不影响结果 */
    }
  } finally {
    reader.dispose();
    socket.destroy();
  }
}

/* ------------------------------------------------------------------ */
/* 业务发信                                                            */
/* ------------------------------------------------------------------ */

/**
 * @returns {{ sent: boolean, reason?: string, provider?: string }}
 */
export async function sendApplicationNotice(app, token) {
  if (!canSendNotice(app)) return { sent: false, reason: "opt_out" };
  const route = pickMailRoute(app.email);
  if (!isRouteConfigured(route.config)) return { sent: false, reason: "mail_not_configured" };
  const retrieveUrl = `${PUBLIC_ORIGIN}/support?token=${token}`;
  const mail = renderApplicationEmail(app, retrieveUrl);
  await deliverMail({
    to: app.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    unsubscribe: unsubscribeUrl(app.id),
    mailtoUnsubscribe: env("MAIL_UNSUBSCRIBE_MAILTO", ""),
    config: route.config,
  });
  return { sent: true, provider: route.id };
}

/** @returns {{ sent: boolean, reason?: string, provider?: string }} */
export async function sendReviewNotice(app, review) {
  if (!canSendNotice(app)) return { sent: false, reason: "opt_out" };
  const route = pickMailRoute(app.email);
  if (!isRouteConfigured(route.config)) return { sent: false, reason: "mail_not_configured" };
  const mail = renderReviewEmail(app, review);
  await deliverMail({
    to: app.email,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
    unsubscribe: unsubscribeUrl(app.id),
    mailtoUnsubscribe: env("MAIL_UNSUBSCRIBE_MAILTO", ""),
    config: route.config,
  });
  return { sent: true, provider: route.id };
}
