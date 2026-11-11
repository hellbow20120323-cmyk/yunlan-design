export interface SubscriptionStatus {
  active: boolean;
  activeUntil: string | null;
  planId: string | null;
  planLabel: string | null;
}

export interface PointsStatus {
  loggedIn: boolean;
  dailyLimit: number;
  used: number;
  dailyRemaining: number;
  signupGiftTotal: number;
  signupGiftRemaining: number;
  remaining: number;
  resetAt: string;
  costPerSearch: number;
  vipLabel: string;
  timezone: string;
  subscription?: SubscriptionStatus;
  unlimitedSearch?: boolean;
}

export interface BillingPlan {
  id: string;
  label: string;
  priceCny: number;
  durationDays: number;
  badge: string;
}

export interface BillingProviders {
  alipay: boolean;
  wechat: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthMeResponse {
  ok: boolean;
  user: AuthUser | null;
  points: PointsStatus;
  clientId?: string;
}
