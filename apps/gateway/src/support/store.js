/**
 * 支持申请数据层。
 *
 * 表之间刻意隔离：
 * - applications：申请与口令
 * - temp-links：一次性中转链接（只存 SHA-256，不存明文）
 * - reviews：人工审核记录
 * - uploads：用户主动上传的兜底凭证
 * - donations：人工导入的账单流水
 * - candidates：系统加权推荐候选，仅推荐，绝不自动放行
 */
import crypto from "node:crypto";
import { dataPath } from "../paths.js";
import { JsonStore } from "../json-store.js";
import { generateCode, generateLinkToken, hashToken, isValidEmail, normalizeEmail } from "./codes.js";

const MAX_APPLICATIONS = 5000;
const MAX_LINKS = 20000;
const MAX_REVIEWS = 10000;
const MAX_UPLOADS = 5000;
const MAX_DONATIONS = 10000;
const MAX_CANDIDATES = 30000;

const applicationsStore = new JsonStore(dataPath("support-applications.json"), () => ({ applications: [] }), {
  normalize: (d) => ({ ...d, applications: Array.isArray(d?.applications) ? d.applications : [] }),
});
const linksStore = new JsonStore(dataPath("support-temp-links.json"), () => ({ links: [] }), {
  normalize: (d) => ({ ...d, links: Array.isArray(d?.links) ? d.links : [] }),
});
const reviewsStore = new JsonStore(dataPath("support-reviews.json"), () => ({ reviews: [] }), {
  normalize: (d) => ({ ...d, reviews: Array.isArray(d?.reviews) ? d.reviews : [] }),
});
const uploadsStore = new JsonStore(dataPath("support-uploads.json"), () => ({ uploads: [] }), {
  normalize: (d) => ({ ...d, uploads: Array.isArray(d?.uploads) ? d.uploads : [] }),
});
const donationsStore = new JsonStore(dataPath("support-donations.json"), () => ({ donations: [] }), {
  normalize: (d) => ({ ...d, donations: Array.isArray(d?.donations) ? d.donations : [] }),
});
const candidatesStore = new JsonStore(dataPath("support-candidates.json"), () => ({ candidates: [] }), {
  normalize: (d) => ({ ...d, candidates: Array.isArray(d?.candidates) ? d.candidates : [] }),
});

export function supportLinkTtlMs() {
  const n = Number(process.env.SUPPORT_LINK_TTL_MS || 24 * 3600 * 1000);
  // 硬性上限 24 小时：只允许为本地调试缩短，不允许放宽
  return Math.min(Number.isFinite(n) && n > 0 ? n : 24 * 3600 * 1000, 24 * 3600 * 1000);
}

export function supportMatchWindowMs() {
  const n = Number(process.env.SUPPORT_MATCH_WINDOW_SEC || 60);
  // 硬性上限 60 秒，避免配置放大匹配窗口
  return Math.min(Number.isFinite(n) && n > 0 ? n : 60, 60) * 1000;
}

export function findApplication(appId) {
  return applicationsStore.read().applications.find((a) => a.id === appId) || null;
}

export function findApplicationByEmail(email) {
  const norm = normalizeEmail(email);
  return applicationsStore.read().applications.find((a) => a.email === norm) || null;
}

function activeCodes(excludeId) {
  return new Set(
    applicationsStore
      .read()
      .applications.filter(
        (a) => a.id !== excludeId && (a.status === "pending_review" || a.status === "approved")
      )
      .map((a) => a.code)
  );
}

/**
 * 提交申请（幂等）：同一邮箱已有待审核 / 已通过申请时直接返回原记录；
 * 已驳回的申请允许重新提交，复用同一条记录并换新口令。
 */
export function createOrReapplyApplication({ email, optInEmail, now = Date.now() }) {
  const norm = normalizeEmail(email);
  if (!isValidEmail(norm)) throw new Error("邮箱格式不正确");

  const data = applicationsStore.read();
  const existing = data.applications.find((a) => a.email === norm);
  const createdAt = new Date(now).toISOString();

  if (existing && (existing.status === "pending_review" || existing.status === "approved")) {
    return { application: existing, created: false, reapply: false };
  }

  if (existing) {
    existing.code = generateCode(activeCodes(existing.id));
    existing.createdAt = createdAt;
    existing.optInEmail = Boolean(optInEmail);
    existing.optInAt = optInEmail ? createdAt : null;
    existing.unsubscribedAt = null;
    existing.status = "pending_review";
    existing.reviewedAt = null;
    existing.reviewNote = "";
    existing.grantedPlanId = null;
    existing.mailStatus = "pending";
    existing.mailError = "";
    existing.updatedAt = createdAt;
    applicationsStore.write();
    return { application: existing, created: true, reapply: true };
  }

  const app = {
    id: crypto.randomUUID(),
    email: norm,
    code: generateCode(activeCodes()),
    createdAt,
    optInEmail: Boolean(optInEmail),
    optInAt: optInEmail ? createdAt : null,
    unsubscribedAt: null,
    status: "pending_review",
    reviewedAt: null,
    reviewNote: "",
    grantedPlanId: null,
    mailStatus: "pending",
    mailError: "",
    updatedAt: createdAt,
  };
  data.applications.unshift(app);
  data.applications = data.applications.slice(0, MAX_APPLICATIONS);
  applicationsStore.write();
  return { application: app, created: true, reapply: false };
}

export function setApplicationMailStatus(appId, status, error = "") {
  const app = findApplication(appId);
  if (!app) return null;
  app.mailStatus = String(status || "").slice(0, 32);
  app.mailError = String(error || "").slice(0, 240);
  app.updatedAt = new Date().toISOString();
  applicationsStore.write();
  return app;
}

export function setOptIn(appId, optIn, now = Date.now()) {
  const app = findApplication(appId);
  if (!app) return null;
  const at = new Date(now).toISOString();
  app.optInEmail = Boolean(optIn);
  app.optInAt = optIn ? at : app.optInAt;
  app.unsubscribedAt = optIn ? null : at;
  app.updatedAt = at;
  applicationsStore.write();
  return app;
}

/** 创建临时凭证：24 小时内可重复访问，明文只返回一次，落库仅保存哈希 */
export function createTempLink(appId, { ttlMs = supportLinkTtlMs(), now = Date.now() } = {}) {
  const token = generateLinkToken();
  const link = {
    id: crypto.randomUUID(),
    linkHash: hashToken(token),
    appId,
    createdAt: new Date(now).toISOString(),
    expireAt: new Date(now + ttlMs).toISOString(),
    revoked: false,
    choice: null,
    choiceAt: null,
  };
  const data = linksStore.read();
  data.links.unshift(link);
  data.links = data.links.slice(0, MAX_LINKS);
  linksStore.write();
  return { token, link };
}

/** 重新发信前作废旧凭证，避免多份凭证长期有效 */
export function invalidateLinksForApp(appId) {
  let changed = false;
  for (const link of linksStore.read().links) {
    if (link.appId === appId && !link.revoked) {
      link.revoked = true;
      changed = true;
    }
  }
  if (changed) linksStore.write();
}

export function findLinkByToken(token) {
  const hash = hashToken(token);
  return linksStore.read().links.find((l) => l.linkHash === hash) || null;
}

/**
 * 校验临时凭证：不做消耗，24 小时内可重复访问。
 * 兼容历史数据：早期记录的 isUsed/usedAt 字段一律忽略。
 * @returns {{ status: 'ok'|'expired'|'invalid', link?: object, app?: object }}
 */
export function resolveTempLink(token, now = Date.now()) {
  const link = findLinkByToken(token);
  if (!link) return { status: "invalid" };
  const app = findApplication(link.appId);
  if (!app) return { status: "invalid" };
  if (link.revoked) return { status: "expired", link, app };
  if (new Date(link.expireAt).getTime() <= now) return { status: "expired", link, app };
  return { status: "ok", link, app };
}

export function setChoice(appId, choice, now = Date.now()) {
  const value = choice === "support" ? "support" : choice === "skip" ? "skip" : "";
  if (!value) throw new Error("无效选项");
  const data = linksStore.read();
  const candidates = data.links.filter((l) => l.appId === appId && !l.revoked);
  const target = candidates.find((l) => !l.choice) || candidates.find((l) => l.choice);
  if (!target) return null;
  if (!target.choice) {
    target.choice = value;
    target.choiceAt = new Date(now).toISOString();
    linksStore.write();
  }
  return target;
}

export function getChoice(appId) {
  const links = linksStore.read().links;
  const hit = links.find((l) => l.appId === appId && l.choice);
  return hit?.choice || null;
}

export function listApplications({ status = "", limit = 100, q = "" } = {}) {
  const query = String(q || "").trim().toLowerCase();
  const cap = Math.min(500, Math.max(1, Number(limit) || 100));
  return applicationsStore
    .read()
    .applications.filter((a) => (!status || a.status === status) && (!query || a.email.includes(query)))
    .slice(0, cap)
    .map((a) => ({ ...a, choice: getChoice(a.id), uploadCount: listUploads(a.id).length }));
}

export function recordReview({ appId, action, note = "", grantedPlanId = null, admin = "admin", now = Date.now() }) {
  const app = findApplication(appId);
  if (!app) throw new Error("申请不存在");
  const act = action === "approve" ? "approve" : action === "reject" ? "reject" : "";
  if (!act) throw new Error("无效审核动作");
  if (app.status === "approved" && act === "approve") {
    return { application: app, review: null, already: true };
  }
  const review = {
    id: crypto.randomUUID(),
    appId,
    action: act,
    note: String(note || "").slice(0, 500),
    grantedPlanId: act === "approve" && grantedPlanId ? String(grantedPlanId) : null,
    admin: String(admin || "admin").slice(0, 64),
    createdAt: new Date(now).toISOString(),
  };
  const rdata = reviewsStore.read();
  rdata.reviews.unshift(review);
  rdata.reviews = rdata.reviews.slice(0, MAX_REVIEWS);
  reviewsStore.write();

  app.status = act === "approve" ? "approved" : "rejected";
  app.reviewedAt = review.createdAt;
  app.reviewNote = review.note;
  app.grantedPlanId = review.grantedPlanId;
  app.updatedAt = review.createdAt;
  applicationsStore.write();
  return { application: app, review, already: false };
}

export function listReviews(appId) {
  return reviewsStore
    .read()
    .reviews.filter((r) => r.appId === appId)
    .slice(0, 20);
}

export function addUpload({ appId, imgPath, mime, size, tradeNo = "", now = Date.now() }) {
  const uploads = uploadsStore.read().uploads;
  if (uploads.filter((u) => u.appId === appId).length >= 5) {
    throw new Error("上传次数已达上限");
  }
  const record = {
    id: crypto.randomUUID(),
    appId,
    imgPath: String(imgPath || ""),
    mime: String(mime || ""),
    size: Number(size) || 0,
    tradeNo: String(tradeNo || "").slice(0, 64),
    createdAt: new Date(now).toISOString(),
  };
  uploads.unshift(record);
  uploadsStore.write();
  return record;
}

export function listUploads(appId) {
  return uploadsStore.read().uploads.filter((u) => u.appId === appId);
}

export function findUpload(uploadId) {
  return uploadsStore.read().uploads.find((u) => u.id === uploadId) || null;
}

/** 时间解析：支持 ISO、毫秒/秒时间戳、`YYYY-MM-DD HH:mm:ss`（按东八区） */
export function parsePayTime(value) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value < 1e12 ? value * 1000 : value;
    return new Date(ms).toISOString();
  }
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^\d{10,13}$/.test(raw)) {
    const ms = raw.length <= 10 ? Number(raw) * 1000 : Number(raw);
    return new Date(ms).toISOString();
  }
  const normalized = raw.replace(/\//g, "-").replace(" ", "T");
  const withZone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}+08:00`;
  const d = new Date(withZone);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function normalizeAmount(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** 加权匹配：备注含口令最高权重，支付时间落在申请时间 ±窗口内为次要权重 */
export function scoreCandidate(app, donation, windowMs = supportMatchWindowMs()) {
  const reasons = [];
  let score = 0;
  const note = String(donation.note || "");
  const codes = note.match(/(?:^|\D)(\d{4})(?=\D|$)/g) || [];
  const hasCode = codes.some((m) => m.replace(/\D/g, "") === app.code);
  if (hasCode) {
    score += 100;
    reasons.push("备注包含申请口令");
  }
  const payAt = new Date(donation.payTime).getTime();
  const created = new Date(app.createdAt).getTime();
  const diff = Number.isFinite(payAt) && Number.isFinite(created) ? Math.abs(payAt - created) : Infinity;
  if (diff <= windowMs) {
    score += 40;
    reasons.push(`到账时间与申请时间相差 ${Math.round(diff / 1000)} 秒`);
  }
  return { score, reasons, diffMs: diff };
}

function donationKey(record) {
  if (record.tradeNo) return `trade:${record.tradeNo}`;
  return `raw:${record.payTime}|${record.amount}|${record.note}`;
}

/**
 * 人工导入账单：只生成候选，不修改申请状态。
 * @returns {{ imported: number, skipped: number, candidates: number }}
 */
export function importDonations(records, { source = "manual", now = Date.now() } = {}) {
  const ddata = donationsStore.read();
  const cdata = candidatesStore.read();
  const existingKeys = new Set(ddata.donations.map(donationKey));
  const apps = applicationsStore.read().applications.filter((a) => a.status === "pending_review");
  const windowMs = supportMatchWindowMs();
  let imported = 0;
  let skipped = 0;
  let candidates = 0;

  for (const raw of Array.isArray(records) ? records : []) {
    const payTime = parsePayTime(raw?.payTime ?? raw?.time ?? raw?.pay_time);
    const amount = normalizeAmount(raw?.amount ?? raw?.money);
    const note = String(raw?.note ?? raw?.remark ?? "").slice(0, 200);
    const tradeNo = String(raw?.tradeNo ?? raw?.trade_no ?? "").slice(0, 64);
    if (!payTime || amount == null) {
      skipped += 1;
      continue;
    }
    const record = {
      id: crypto.randomUUID(),
      payTime,
      note,
      amount,
      tradeNo,
      source: String(source || "manual").slice(0, 32),
      importedAt: new Date(now).toISOString(),
    };
    const key = donationKey(record);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(key);
    ddata.donations.unshift(record);
    imported += 1;

    for (const app of apps) {
      const match = scoreCandidate(app, record, windowMs);
      if (match.score <= 0) continue;
      const exists = cdata.candidates.some((c) => c.donationId === record.id && c.matchAppId === app.id);
      if (exists) continue;
      cdata.candidates.unshift({
        id: crypto.randomUUID(),
        donationId: record.id,
        payTime: record.payTime,
        note: record.note,
        amount: record.amount,
        matchAppId: app.id,
        matchScore: match.score,
        matchReasons: match.reasons,
        reviewed: false,
        createdAt: record.importedAt,
      });
      candidates += 1;
    }
  }

  ddata.donations = ddata.donations.slice(0, MAX_DONATIONS);
  cdata.candidates = cdata.candidates.slice(0, MAX_CANDIDATES);
  donationsStore.write();
  candidatesStore.write();
  return { imported, skipped, candidates };
}

export function listDonations({ limit = 100 } = {}) {
  return donationsStore.read().donations.slice(0, Math.min(500, Math.max(1, Number(limit) || 100)));
}

export function listCandidates({ reviewed = false, limit = 100 } = {}) {
  const cap = Math.min(500, Math.max(1, Number(limit) || 100));
  const apps = new Map(applicationsStore.read().applications.map((a) => [a.id, a]));
  return candidatesStore
    .read()
    .candidates.filter((c) => Boolean(c.reviewed) === Boolean(reviewed))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, cap)
    .map((c) => {
      const app = apps.get(c.matchAppId);
      return {
        ...c,
        app: app
          ? {
              id: app.id,
              email: app.email,
              code: app.code,
              status: app.status,
              createdAt: app.createdAt,
            }
          : null,
      };
    });
}

export function markCandidateReviewed(candidateId, reviewed = true) {
  const candidate = candidatesStore.read().candidates.find((c) => c.id === candidateId);
  if (!candidate) throw new Error("候选不存在");
  candidate.reviewed = Boolean(reviewed);
  candidate.reviewedAt = new Date().toISOString();
  candidatesStore.write();
  return candidate;
}

/** 申请完成人工终审后，把指向它的候选一并归档，避免重复出现在待处理列表 */
export function markCandidatesForAppReviewed(appId, reviewed = true) {
  let changed = 0;
  const now = new Date().toISOString();
  for (const c of candidatesStore.read().candidates) {
    if (c.matchAppId === appId && !c.reviewed) {
      c.reviewed = Boolean(reviewed);
      c.reviewedAt = now;
      changed += 1;
    }
  }
  if (changed) candidatesStore.write();
  return changed;
}

/** 简单 CSV 解析：pay_time, note, amount[, trade_no]；首行可带表头 */
export function parseDonationCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let quoted = false;
  const input = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows
    .map((cols) => cols.map((c) => c.trim()))
    .filter((cols) => cols.some(Boolean))
    .filter((cols) => !/时间|time|备注|金额|amount|note/i.test(cols[0] || ""))
    .map((cols) => ({ payTime: cols[0], note: cols[1], amount: cols[2], tradeNo: cols[3] }));
}

export function supportStats() {
  const apps = applicationsStore.read().applications;
  const candidates = candidatesStore.read().candidates;
  return {
    applications: apps.length,
    pending: apps.filter((a) => a.status === "pending_review").length,
    approved: apps.filter((a) => a.status === "approved").length,
    rejected: apps.filter((a) => a.status === "rejected").length,
    links: linksStore.read().links.length,
    candidates: candidates.filter((c) => !c.reviewed).length,
    donations: donationsStore.read().donations.length,
  };
}
