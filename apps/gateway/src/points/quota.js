import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "../paths.js";
import { isSubscriptionActive, subscriptionSummary } from "../billing/subscription-store.js";

const QUOTA_PATH = path.join(DATA_DIR, "quota-usage.json");

const TZ = process.env.POINTS_TZ || "Asia/Shanghai";
const ANON_DAILY = Number(process.env.POINTS_ANON_DAILY || 50);
const USER_DAILY = Number(process.env.POINTS_USER_DAILY || 100);
const COST_PER_SEARCH = Number(process.env.POINTS_SEARCH_COST || 10);
const SIGNUP_GIFT = Number(process.env.POINTS_SIGNUP_GIFT || 0);

function ensureDataDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsage() {
  ensureDataDir();
  if (!fs.existsSync(QUOTA_PATH)) return { buckets: {}, signupGifts: {}, bonusBalance: {} };
  try {
    const data = JSON.parse(fs.readFileSync(QUOTA_PATH, "utf8"));
    if (!data.bonusBalance) data.bonusBalance = {};
    return data;
  } catch {
    return { buckets: {}, signupGifts: {}, bonusBalance: {} };
  }
}

function getAdminBonus(store, userId) {
  if (!userId) return 0;
  return Math.max(0, Number(store.bonusBalance?.[userId] || 0));
}

function writeUsage(data) {
  ensureDataDir();
  fs.writeFileSync(QUOTA_PATH, JSON.stringify(data, null, 2), "utf8");
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

function getBucketRecord(store, key) {
  const day = todayKey();
  let rec = store.buckets[key];
  if (!rec || rec.date !== day) {
    rec = { date: day, used: 0 };
    store.buckets[key] = rec;
  }
  return rec;
}

export function getDailyLimit(loggedIn) {
  return loggedIn ? USER_DAILY : ANON_DAILY;
}

export function getQuotaStatus({ userId, clientId }) {
  const store = readUsage();
  const loggedIn = Boolean(userId);
  const subscription = subscriptionSummary(userId);
  const vipActive = loggedIn && isSubscriptionActive(userId);
  const key = loggedIn ? bucketKey("user", userId) : bucketKey("anon", clientId || "unknown");
  const rec = getBucketRecord(store, key);
  writeUsage(store);

  let bonusRemaining = 0;
  if (loggedIn && userId && SIGNUP_GIFT > 0 && !vipActive) {
    const gifted = Number(store.signupGifts?.[userId] || 0);
    bonusRemaining = Math.max(0, SIGNUP_GIFT - gifted);
  }
  const adminBonusRemaining = loggedIn && userId && !vipActive ? getAdminBonus(store, userId) : 0;

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

/**
 * Consume points for one search. Throws Error with code INSUFFICIENT_POINTS
 */
export function consumeSearchPoint({ userId, clientId }) {
  if (userId && isSubscriptionActive(userId)) {
    return getQuotaStatus({ userId, clientId });
  }

  const store = readUsage();
  const loggedIn = Boolean(userId);
  const key = loggedIn ? bucketKey("user", userId) : bucketKey("anon", clientId || "unknown");
  const rec = getBucketRecord(store, key);
  const dailyLimit = getDailyLimit(loggedIn);
  const cost = COST_PER_SEARCH;

  if (loggedIn && userId && SIGNUP_GIFT > 0) {
    const gifted = Number(store.signupGifts?.[userId] || 0);
    if (gifted < SIGNUP_GIFT) {
      store.signupGifts[userId] = gifted + cost;
      writeUsage(store);
      return getQuotaStatus({ userId, clientId });
    }
  }

  if (loggedIn && userId) {
    if (!store.bonusBalance) store.bonusBalance = {};
    const adminBonus = getAdminBonus(store, userId);
    if (adminBonus >= cost) {
      store.bonusBalance[userId] = adminBonus - cost;
      writeUsage(store);
      return getQuotaStatus({ userId, clientId });
    }
    if (adminBonus > 0) {
      const fromDaily = cost - adminBonus;
      store.bonusBalance[userId] = 0;
      if (rec.used + fromDaily > dailyLimit) {
        const err = new Error(
          "今日积分已用完，开通 VIP 后可不限次数搜索（月付 3 元起）"
        );
        err.code = "INSUFFICIENT_POINTS";
        throw err;
      }
      rec.used += fromDaily;
      store.buckets[key] = rec;
      writeUsage(store);
      return getQuotaStatus({ userId, clientId });
    }
  }

  if (rec.used + cost > dailyLimit) {
    const err = new Error(
      loggedIn
        ? "今日积分已用完，开通 VIP 后可不限次数搜索（月付 3 元起）"
        : "今日体验积分已用完，请登录并开通 VIP 后继续搜索"
    );
    err.code = "INSUFFICIENT_POINTS";
    throw err;
  }

  rec.used += cost;
  store.buckets[key] = rec;
  writeUsage(store);
  return getQuotaStatus({ userId, clientId });
}

export function grantSignupGift(userId) {
  if (SIGNUP_GIFT <= 0) return;
  const store = readUsage();
  if (!store.signupGifts) store.signupGifts = {};
  if (store.signupGifts[userId] === undefined) {
    store.signupGifts[userId] = 0;
    writeUsage(store);
  }
}

/** 管理员赠送积分（不过期，优先于当日免费额度消耗） */
export function grantBonusPoints(userId, amount) {
  const delta = Math.max(0, Math.floor(Number(amount) || 0));
  if (!userId || delta <= 0) return 0;
  const store = readUsage();
  if (!store.bonusBalance) store.bonusBalance = {};
  const next = getAdminBonus(store, userId) + delta;
  store.bonusBalance[userId] = next;
  writeUsage(store);
  return next;
}
