import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

// 必须在 import 业务模块前设置：数据目录、密钥
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "yunlan-sec-"));
process.env.YUNLAN_DATA_DIR = tmp;
process.env.AUTH_SECRET = "x".repeat(40);
process.env.POINTS_ANON_DAILY = "50";
process.env.POINTS_SEARCH_COST = "10";

const { isSafeShareUrl, safeHttpUrl, rateLimit, isAdmin } = await import("./security.js");
const { parseCookieHeader, getOrCreateClientId } = await import("./auth/cookies.js");
const { hashPassword, verifyPassword, signSessionToken, verifySessionToken } = await import("./auth/crypto.js");
const { consumeSearchPoint, getQuotaStatus } = await import("./points/quota.js");
const { JsonStore } = await import("./json-store.js");
const { mergeAndDedupe } = await import("./sources/aggregate.js");

test("isSafeShareUrl 只放行 http(s) 与 magnet", () => {
  assert.equal(isSafeShareUrl("https://pan.quark.cn/s/abc"), true);
  assert.equal(isSafeShareUrl("http://pan.baidu.com/s/1abc"), true);
  assert.equal(isSafeShareUrl("magnet:?xt=urn:btih:abc"), true);
  assert.equal(isSafeShareUrl("javascript:alert(1)"), false);
  assert.equal(isSafeShareUrl("JaVaScRiPt:alert(1)"), false);
  assert.equal(isSafeShareUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeShareUrl("//evil.com/x"), false);
  assert.equal(isSafeShareUrl(""), false);
  assert.equal(isSafeShareUrl("https://a.com/" + "x".repeat(3000)), false);
  assert.equal(safeHttpUrl("magnet:?xt=urn:btih:abc"), "");
  assert.equal(safeHttpUrl("https://weibo.com/1/2"), "https://weibo.com/1/2");
});

test("mergeAndDedupe 丢弃不安全链接", () => {
  const hits = [
    { id: "1", url: "javascript:alert(1)", cloudType: "baidu", score: 9, source: "x" },
    { id: "2", url: "https://pan.baidu.com/s/1ok", cloudType: "baidu", score: 1, source: "x" },
  ];
  const out = mergeAndDedupe([hits]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "2");
});

test("Cookie 解析：畸形编码不抛错、不被原型污染、同名取第一个", () => {
  assert.doesNotThrow(() => parseCookieHeader("a=%E0%A4%A; b=ok"));
  assert.equal(parseCookieHeader("a=%E0%A4%A").a, "");
  const c = parseCookieHeader("__proto__=x; yl_cid=first; yl_cid=second");
  assert.equal(Object.getPrototypeOf(c), Object.prototype);
  assert.equal(c.yl_cid, "first");
  assert.equal(({}).x, undefined);
});

test("客户端 ID 必须符合格式，非法值会被替换", () => {
  const res = { append() {} };
  const bad = getOrCreateClientId({ headers: { "x-yunlan-client": "../../etc/passwd" } }, res);
  assert.match(bad, /^[0-9a-f-]{36}$/);
  const good = getOrCreateClientId({ headers: { "x-yunlan-client": "abcd1234-ef56" } }, res);
  assert.equal(good, "abcd1234-ef56");
});

test("密码哈希可验证，错误密码拒绝", async () => {
  const h = await hashPassword("correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", h), true);
  assert.equal(await verifyPassword("wrong", h), false);
  assert.equal(await verifyPassword("x", "garbage"), false);
});

test("会话令牌：篡改与过期都会被拒绝", () => {
  const t = signSessionToken({ uid: "u1", email: "a@b.co" });
  assert.deepEqual(verifySessionToken(t), { uid: "u1", email: "a@b.co" });
  const [body, sig] = t.split(".");
  const forged = Buffer.from(JSON.stringify({ uid: "admin", email: "a@b.co", exp: Date.now() + 1e9 })).toString("base64url");
  assert.equal(verifySessionToken(`${forged}.${sig}`), null);
  assert.equal(verifySessionToken(`${body}.AAAA`), null);
  assert.equal(verifySessionToken(signSessionToken({ uid: "u", email: "e" }, -1000)), null);
  assert.equal(verifySessionToken("x".repeat(5000)), null);
});

test("限流：超过阈值返回 429，窗口内计数独立", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 2, key: (r) => r.k });
  const mk = () => {
    const out = { code: 200, headers: {} };
    const res = {
      setHeader: (k, v) => (out.headers[k] = v),
      status(c) {
        out.code = c;
        return this;
      },
      json() {
        return this;
      },
    };
    return { out, res };
  };
  const run = (k) => {
    const { out, res } = mk();
    let passed = false;
    limiter({ k }, res, () => (passed = true));
    return { passed, code: out.code };
  };
  assert.equal(run("a").passed, true);
  assert.equal(run("a").passed, true);
  const third = run("a");
  assert.equal(third.passed, false);
  assert.equal(third.code, 429);
  assert.equal(run("b").passed, true);
});

test("管理员鉴权：生产环境未配置令牌时拒绝，配置后需匹配", () => {
  const prev = process.env.ADMIN_TOKEN;
  delete process.env.ADMIN_TOKEN;
  // 非生产 + 回环地址放行
  assert.equal(isAdmin({ headers: {}, ip: "127.0.0.1" }), true);
  assert.equal(isAdmin({ headers: {}, ip: "8.8.8.8" }), false);
  process.env.ADMIN_TOKEN = "s3cret-token";
  assert.equal(isAdmin({ headers: { authorization: "Bearer s3cret-token" }, ip: "8.8.8.8" }), true);
  assert.equal(isAdmin({ headers: { "x-admin-token": "s3cret-token" }, ip: "8.8.8.8" }), true);
  assert.equal(isAdmin({ headers: { authorization: "Bearer nope" }, ip: "127.0.0.1" }), false);
  if (prev === undefined) delete process.env.ADMIN_TOKEN;
  else process.env.ADMIN_TOKEN = prev;
});

test("匿名额度：清 Cookie 换客户端 ID 仍受 IP 上限约束", () => {
  const ip = "203.0.113.9";
  let ok = 0;
  let blocked = false;
  // 单个客户端 ID 日额度 50 点 = 5 次；IP 上限默认 4 倍 = 200 点 = 20 次
  for (let i = 0; i < 40; i++) {
    try {
      consumeSearchPoint({ clientId: `client-${String(i).padStart(4, "0")}-aaaa`, ip });
      ok += 1;
    } catch (e) {
      assert.equal(e.code, "INSUFFICIENT_POINTS");
      blocked = true;
      break;
    }
  }
  assert.equal(blocked, true);
  assert.equal(ok, 20);
});

test("额度只读查询不产生写盘", () => {
  const file = path.join(tmp, "quota-usage.json");
  const before = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  for (let i = 0; i < 20; i++) getQuotaStatus({ clientId: "readonly-client-1" });
  const after = fs.existsSync(file) ? fs.statSync(file).mtimeMs : 0;
  assert.equal(after, before);
});

test("JsonStore：原子写入、0600 权限、可重新加载", () => {
  const file = path.join(tmp, "store-test.json");
  const s = new JsonStore(file, () => ({ n: 0 }));
  s.read().n = 7;
  s.write();
  assert.equal(JSON.parse(fs.readFileSync(file, "utf8")).n, 7);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.readdirSync(tmp).some((f) => f.endsWith(".tmp")), false);
  const s2 = new JsonStore(file, () => ({ n: 0 }));
  assert.equal(s2.read().n, 7);
});
