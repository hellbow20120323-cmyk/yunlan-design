import crypto from "node:crypto";
import { dataPath } from "../paths.js";
import { JsonStore } from "../json-store.js";
import { isSubscriptionActive, subscriptionSummary } from "../billing/subscription-store.js";

const TZ = process.env.POINTS_TZ || "Asia/Shanghai";
const ANON_DAILY = Number(process.env.POINTS_ANON_DAILY || 50);
const USER_DAILY = Number(process.env.POINTS_USER_DAILY || 100);
const COST_PER_SEARCH = Number(process.env.POINTS_SEARCH_COST || 10);
const SIGNUP_GIFT = Number(process.env.POINTS_SIGNUP_GIFT || 0);
/**
 * 匿名访客按 IP 的日额度上限。
 * 客户端 ID 来自 Cookie / 请求头，清 Cookie 或随机换头即可刷新额度，所以匿名用户额外按 IP 兜底。
 * 默认放宽为单人额度的 4 倍，兼顾校园网 / 公司出口等共享 IP 场景。
 */
const ANON_IP_DAILY = Number(process.env.POINTS_ANON_IP_DAILY || ANON_DAILY * 4);

const store = new JsonStore(
  dataPath("quota-usage.json"),
  () => ({ buckets: {}, signupGifts: {}, bonusBalance: {} }),
  {
    // 积分写入合并为 0.5s 延迟落盘；进程退出时同步刷盘
    flushMs: 500,
    normalize(data) {
      return {
        ...data,
        buckets: data?.buckets || {},
        signupGifts: data?.signupGifts || {},
        bonusBalance: data?.bonusBalance || {},
      };
    },
  }
);

let prunedDay = "";

/** 额度桶按日重置，过期桶没有保留价值，否则文件随访客数无限增长 */
function readUsage() {
  const data = store.read();
  const day = todayKey();
  if (prunedDay !== day) {
    prunedDay = day;
    let removed = 0;
    for (const [k, rec] of Object.entries(data.buckets)) {
      if (rec?.date !== day) {
        delete data.buckets[k];
        removed += 1;
      }
    }
    if (removed) store.write();
  }
  return data;
}

function getAdminBonus(data, userId) {
  if (!userId) return 0;
  return Math.max(0, Number(data.bonusBalance?.[userId] || 0));
}

/** @returns {string} YYYY-MM-DD in configured TZ */
export function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** @returns {string} ISO-ish reset moment description for clients */
export function nextResetLabel() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  const today = `${y}-${m}-${d}`;
  const tomorrow = new Date(`${today}T12:00:00+08:00`);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tParts = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).formatToParts(tomorrow);
  const ty = tParts.find((p) => p.type === "year")?.value;
  const tm = tParts.find((p) => p.type === "month")?.value;
  const td = tParts.find((p) => p.type === "day")?.value;
  return `${ty}-${tm}-${td}T00:00:00+08:00`;
}

export function bucketKey(kind, id) {
  return `${kind}:${id}`;
}

/** 只读查看当日桶：不存在时返回临时对象，不写入存储 */
function peekBucket(data, key) {
  const day = todayKey();
  const rec = data.buckets[key];
  return rec && rec.date === day ? rec : { date: day, used: 0 };
}

/** 取得可写的当日桶（必要时创建并挂入存储） */
function touchBucket(data, key) {
  const rec = peekBucket(data, key);
  data.buckets[key] = rec;
  return rec;
}

function ipBucketKey(ip) {
  const h = crypto.createHash("sha256").update(String(ip || "unknown")).digest("hex").slice(0, 16);
  return bucketKey("ip", h);
}

export function getDailyLimit(loggedIn) {
  return loggedIn ? USER_DAILY : ANON_DAILY;
}

export function getQuotaStatus({ userId, clientId }) {
  const data = readUsage();
  const loggedIn = Boolean(userId);
  const subscription = subscriptionSummary(userId);
  const vipActive = loggedIn && isSubscriptionActive(userId);
  const key = loggedIn ? bucketKey("user", userId) : bucketKey("anon", clientId || "unknown");
  const rec = peekBucket(data, key);

  let bonusRemaining = 0;
  if (loggedIn && userId && SIGNUP_GIFT > 0 && !vipActive) {
    const gifted = Number(data.signupGifts?.[userId] || 0);
    bonusRemaining = Math.max(0, SIGNUP_GIFT - gifted);
  }
  const adminBonusRemaining = loggedIn && userId && !vipActive ? getAdminBonus(data, userId) : 0;

  const dailyLimit = getDailyLimit(loggedIn);
  const dailyRemaining = vipActive ? dailyLimit : Math.max(0, dailyLimit - rec.used);
  const remaining = vipActive
    ? dailyLimit
    : dailyRemaining + bonusRemaining + adminBonusRemaining;

  let vipLabel = loggedIn ? "注册用户" : "免费体验";
  if (vipActive) vipLabel = "VIP 会员";

  return {
    loggedIn,
    dailyLimit,
    used: vipActive ? 0 : rec.used,
    dailyRemaining,
    signupGiftTotal: SIGNUP_GIFT,
    signupGiftRemaining: bonusRemaining,
    adminBonusRemaining,
    remaining,
    resetAt: nextResetLabel(),
    costPerSearch: vipActive ? 0 : COST_PER_SEARCH,
    vipLabel,
    timezone: TZ,
    subscription,
    unlimitedSearch: vipActive,
  };
}

function insufficient(loggedIn) {
  const err = new Error(
    loggedIn
      ? "今日积分已用完，开通 VIP 后可不限次数搜索（月付 3 元起）"
      : "今日体验积分已用完，请登录并开通 VIP 后继续搜索"
  );
  err.code = "INSUFFICIENT_POINTS";
  return err;
}

/**
 * 扣减一次搜索积分，并返回可用于返还的凭据。
 * receipt 记录积分来自哪个桶，refundSearchPoint 按原路返还。
 * @param {{ userId?: string, clientId?: string, ip?: string }} who
 * @returns {{ points: object, receipt: object }}
 */
export function consumeSearchPointWithReceipt({ userId, clientId, ip }) {
  const done = (receipt) => ({
    points: getQuotaStatus({ userId, clientId }),
    receipt,
  });

  if (userId && isSubscriptionActive(userId)) {
    return done({ vip: true });
  }

  const data = readUsage();
  const loggedIn = Boolean(userId);
  const key = loggedIn ? bucketKey("user", userId) : bucketKey("anon", clientId || "unknown");
  const dailyLimit = getDailyLimit(loggedIn);
  const cost = COST_PER_SEARCH;

  if (loggedIn && userId && SIGNUP_GIFT > 0) {
    const gifted = Number(data.signupGifts?.[userId] || 0);
    if (gifted < SIGNUP_GIFT) {
      data.signupGifts[userId] = gifted + cost;
      store.write();
      return done({ userId, gift: cost });
    }
  }

  if (loggedIn && userId) {
    const adminBonus = getAdminBonus(data, userId);
    if (adminBonus >= cost) {
      data.bonusBalance[userId] = adminBonus - cost;
      store.write();
      return done({ userId, bonus: cost });
    }
    if (adminBonus > 0) {
      const fromDaily = cost - adminBonus;
      const rec = peekBucket(data, key);
      // 先校验再扣减，避免额度不足时仍把赠送积分清零
      if (rec.used + fromDaily > dailyLimit) throw insufficient(true);
      data.bonusBalance[userId] = 0;
      touchBucket(data, key).used += fromDaily;
      store.write();
      return done({ userId, bonus: adminBonus, daily: fromDaily, key });
    }
  }

  const rec = peekBucket(data, key);
  if (rec.used + cost > dailyLimit) throw insufficient(loggedIn);

  // 匿名访客：同时受 IP 日额度约束，防止清 Cookie / 换请求头刷额度
  let ipRec = null;
  if (!loggedIn && ip) {
    ipRec = peekBucket(data, ipBucketKey(ip));
    if (ipRec.used + cost > ANON_IP_DAILY) throw insufficient(false);
  }

  touchBucket(data, key).used += cost;
  if (ipRec) touchBucket(data, ipBucketKey(ip)).used += cost;
  store.write();
  return done({ daily: cost, key, ipKey: ipRec ? ipBucketKey(ip) : undefined });
}

/**
 * Consume points for one search. Throws Error with code INSUFFICIENT_POINTS
 * @param {{ userId?: string, clientId?: string, ip?: string }} who
 */
export function consumeSearchPoint(who) {
  return consumeSearchPointWithReceipt(who).points;
}

/**
 * 按扣减凭据原路返还一次搜索积分。调用方必须保证同一凭据只返还一次。
 * 跨日（搜索期间过了零点）的日额度桶已被清理，无法返还，忽略即可。
 * @param {{ vip?: true, userId?: string, gift?: number, bonus?: number, daily?: number, key?: string, ipKey?: string }} receipt
 */
export function refundSearchPoint(receipt) {
  if (!receipt || receipt.vip) return;
  const data = readUsage();
  const day = todayKey();
  let changed = false;

  if (receipt.userId) {
    if (receipt.gift > 0) {
      const gifted = Number(data.signupGifts?.[receipt.userId] || 0);
      data.signupGifts[receipt.userId] = Math.max(0, gifted - receipt.gift);
      changed = true;
    }
    if (receipt.bonus > 0) {
      data.bonusBalance[receipt.userId] = getAdminBonus(data, receipt.userId) + receipt.bonus;
      changed = true;
    }
  }

  const refundBucket = (key, amount) => {
    const rec = data.buckets[key];
    if (!rec || rec.date !== day) return;
    rec.used = Math.max(0, rec.used - amount);
    changed = true;
  };
  if (receipt.daily > 0) {
    if (receipt.key) refundBucket(receipt.key, receipt.daily);
    if (receipt.ipKey) refundBucket(receipt.ipKey, receipt.daily);
  }

  if (changed) store.write();
}

export function grantSignupGift(userId) {
  if (SIGNUP_GIFT <= 0) return;
  const data = readUsage();
  if (data.signupGifts[userId] === undefined) {
    data.signupGifts[userId] = 0;
    store.write();
  }
}

/** 管理员赠送积分（不过期，优先于当日免费额度消耗） */
export function grantBonusPoints(userId, amount) {
  const delta = Math.max(0, Math.floor(Number(amount) || 0));
  if (!userId || delta <= 0) return 0;
  const data = readUsage();
  const next = getAdminBonus(data, userId) + delta;
  data.bonusBalance[userId] = next;
  store.write();
  return next;
}
