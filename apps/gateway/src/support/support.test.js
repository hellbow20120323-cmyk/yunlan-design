import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "yunlan-support-"));
process.env.YUNLAN_DATA_DIR = dataDir;
process.env.AUTH_SECRET = "support-test-secret-0123456789abcdef";
process.env.ZEPTOMAIL_SMTP_PASS = "";

const codes = await import("./codes.js");
const store = await import("./store.js");
const mailer = await import("./mailer.js");

test.after(() => {
  fs.rmSync(dataDir, { recursive: true, force: true });
});

test("弱口令被排除，生成口令为四位纯数字", () => {
  for (const weak of ["0000", "1111", "0123", "3210", "7890", "0987"]) {
    assert.equal(codes.isWeakCode(weak), true, weak);
  }
  for (const strong of ["1235", "2048", "9081", "4321x"]) {
    assert.equal(codes.isWeakCode(strong), strong === "4321x");
  }
  const code = codes.generateCode(["0000", "1234", "2048"]);
  assert.match(code, /^\d{4}$/);
  assert.equal(codes.isWeakCode(code), false);
  assert.notEqual(code, "2048");
});

test("同一邮箱只保留一条申请；驳回后可重新提交并换新口令", () => {
  const first = store.createOrReapplyApplication({ email: "Apply@Example.com", optInEmail: false, now: 1_000_000 });
  assert.equal(first.created, true);
  assert.equal(first.application.email, "apply@example.com");
  assert.equal(first.application.status, "pending_review");

  const again = store.createOrReapplyApplication({ email: "apply@example.com", optInEmail: true, now: 2_000_000 });
  assert.equal(again.created, false);
  assert.equal(again.application.id, first.application.id);

  const other = store.createOrReapplyApplication({ email: "other@example.com", optInEmail: true, now: 2_000_000 });
  assert.notEqual(other.application.code, first.application.code);

  store.recordReview({ appId: first.application.id, action: "reject", note: "资料不足", now: 3_000_000 });
  const reapplied = store.createOrReapplyApplication({ email: "apply@example.com", optInEmail: true, now: 4_000_000 });
  assert.equal(reapplied.reapply, true);
  assert.equal(reapplied.application.status, "pending_review");
  assert.equal(reapplied.application.optInEmail, true);
});

test("申请状态 Cookie 与退订令牌都可校验且拒绝篡改", () => {
  const appId = "123e4567-e89b-12d3-a456-426614174000";
  const session = codes.signAppSession(appId, 60_000);
  assert.equal(codes.verifyAppSession(session), appId);
  assert.equal(codes.verifyAppSession(`${session}x`), null);

  const unsub = codes.signUnsubscribeToken(appId);
  assert.equal(codes.verifyUnsubscribeToken(unsub), appId);
  const tampered = `${unsub.slice(0, -1)}${unsub.endsWith("A") ? "B" : "A"}`;
  assert.equal(codes.verifyUnsubscribeToken(tampered), null);
});

test("临时凭证：24h 内可重复访问，过期拒绝", () => {
  const { application } = store.createOrReapplyApplication({
    email: "link@example.com",
    optInEmail: true,
    now: 10_000,
  });
  const { token } = store.createTempLink(application.id, { ttlMs: 1000, now: 10_000 });

  const first = store.resolveTempLink(token, 10_500);
  assert.equal(first.status, "ok");

  const second = store.resolveTempLink(token, 10_900);
  assert.equal(second.status, "ok");

  const expiredLink = store.createTempLink(application.id, { ttlMs: 1000, now: 20_000 });
  const expired = store.resolveTempLink(expiredLink.token, 22_000);
  assert.equal(expired.status, "expired");
});

test("加权匹配：备注口令权重最高，时间窗口次之", () => {
  const { application } = store.createOrReapplyApplication({
    email: "match@example.com",
    optInEmail: false,
    now: 100_000,
  });
  const base = { payTime: new Date(100_030).toISOString(), note: "", amount: 5 };
  const codeOnly = store.scoreCandidate(application, { ...base, payTime: "2020-01-01T00:00:00Z", note: `云览 ${application.code}` });
  assert.equal(codeOnly.score, 100);

  const timeOnly = store.scoreCandidate(application, base);
  assert.equal(timeOnly.score, 40);

  const both = store.scoreCandidate(application, { ...base, note: `云览 ${application.code}` });
  assert.equal(both.score, 140);

  const unrelated = store.scoreCandidate(application, {
    ...base,
    payTime: new Date(100_000 + 10 * 60_000).toISOString(),
    note: "无关备注",
  });
  assert.equal(unrelated.score, 0);
});

test("导入账单只生成候选，不自动放行", () => {
  const { application } = store.createOrReapplyApplication({
    email: "donation@example.com",
    optInEmail: false,
    now: 500_000,
  });
  const result = store.importDonations(
    [
      {
        payTime: new Date(500_010).toISOString(),
        note: `云览 ${application.code}`,
        amount: 5,
        tradeNo: "4200000001",
      },
      { payTime: "", note: "坏数据", amount: 1 },
    ],
    { now: 600_000 }
  );
  assert.equal(result.imported, 1);
  assert.equal(result.skipped, 1);
  assert.ok(result.candidates >= 1);
  assert.equal(store.findApplication(application.id).status, "pending_review");

  const candidates = store.listCandidates({ reviewed: false, limit: 100 });
  assert.ok(candidates.some((c) => c.matchAppId === application.id && c.matchScore >= 140));

  // 终审后候选归档，不再出现在待处理列表
  store.recordReview({ appId: application.id, action: "approve", note: "人工通过", now: 700_000 });
  store.markCandidatesForAppReviewed(application.id);
  assert.equal(
    store.listCandidates({ reviewed: false, limit: 100 }).some((c) => c.matchAppId === application.id),
    false
  );
});

test("CSV 解析支持表头与逗号备注", () => {
  const rows = store.parseDonationCsv(
    ['支付时间,备注,金额,交易单号', '2026-11-11 10:00:00,"云览 2048, 自愿支持",5,4200000002'].join("\n")
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].note, "云览 2048, 自愿支持");
  assert.equal(rows[0].amount, "5");
  assert.equal(rows[0].tradeNo, "4200000002");
});

test("opt-in 未勾选时不发信；模板包含口令、中转链接与退订，不含赞赏码", async () => {
  const { application } = store.createOrReapplyApplication({
    email: "mail@example.com",
    optInEmail: true,
    now: 700_000,
  });
  const optOut = { ...application, optInEmail: false };
  assert.equal(mailer.canSendNotice(optOut), false);
  const noOpt = await mailer.sendApplicationNotice(optOut, "token");
  assert.deepEqual(noOpt, { sent: false, reason: "opt_out" });

  const notConfigured = await mailer.sendApplicationNotice(application, "token");
  assert.deepEqual(notConfigured, { sent: false, reason: "mail_not_configured" });

  const mail = mailer.renderApplicationEmail(application, "https://panso.hellbow.xyz/support?token=token-1");
  assert.match(mail.text, new RegExp(application.code));
  assert.match(mail.text, /https:\/\/panso\.hellbow\.xyz\/support\?token=token-1/);
  assert.match(mail.text, /退订/);
  assert.doesNotMatch(mail.text, /赞赏码/);
  assert.doesNotMatch(mail.text, /购买|付费|解锁|换取权限/);
  assert.match(mail.html, /List-Unsubscribe|退订/);
});

test("MIME 邮件包含 List-Unsubscribe 且拒绝头注入", () => {
  const { message } = mailer.buildMimeMessage({
    from: "noreply@hellbow.xyz",
    fromName: "云览 Yunlan",
    to: "user@example.com",
    subject: "云览 · 申请状态",
    text: "纯文本",
    html: "<p>HTML</p>",
    unsubscribe: "https://panso.hellbow.xyz/unsubscribe/abc",
  });
  assert.match(message, /List-Unsubscribe: <https:\/\/panso\.hellbow\.xyz\/unsubscribe\/abc>/);
  assert.match(message, /List-Unsubscribe-Post: List-Unsubscribe=One-Click/);
  assert.match(message, /Content-Type: multipart\/alternative/);

  const injected = mailer.buildMimeMessage({
    from: "noreply@hellbow.xyz",
    fromName: "云览\r\nBcc: evil@example.com",
    to: "user@example.com",
    subject: "标题\r\nBcc: evil@example.com",
    text: "x",
    html: "<p>x</p>",
  });
  assert.doesNotMatch(injected.message, /Bcc: evil/);
});
