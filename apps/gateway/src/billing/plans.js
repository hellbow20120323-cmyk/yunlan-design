/** @typedef {'month' | 'quarter' | 'half' | 'year'} PlanId */

export const PLANS = {
  month: {
    id: "month",
    label: "月付",
    priceCny: 3,
    durationDays: 30,
    badge: "",
  },
  quarter: {
    id: "quarter",
    label: "季付",
    priceCny: 5,
    durationDays: 90,
    badge: "省 4 元",
  },
  half: {
    id: "half",
    label: "半年付",
    priceCny: 15,
    durationDays: 183,
    badge: "畅搜半年",
  },
  year: {
    id: "year",
    label: "年付",
    priceCny: 28,
    durationDays: 365,
    badge: "最划算",
  },
};

export const PLAN_LIST = ["month", "quarter", "half", "year"].map((id) => PLANS[id]);

export function getPlan(planId) {
  return PLANS[planId] || null;
}
