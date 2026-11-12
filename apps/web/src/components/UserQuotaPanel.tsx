import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, User, Sparkles } from 'lucide-react';
import { AuthUser, PointsStatus } from '../types/auth';

interface UserQuotaPanelProps {
  user: AuthUser | null;
  points: PointsStatus | null;
  loading: boolean;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenPaywall?: () => void;
}

export const UserQuotaPanel: React.FC<UserQuotaPanelProps> = ({
  user,
  points,
  loading,
  onOpenAuth,
  onLogout,
  onOpenPaywall,
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const vip = points?.subscription?.active || points?.unlimitedSearch;
  const remaining = points?.remaining ?? 0;
  const limit = points?.dailyLimit ?? 100;
  const used = points?.used ?? 0;
  const cost = points?.costPerSearch ?? 10;
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const low = !vip && remaining < cost;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 min-h-11 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 hover:border-yunlan-cinnabar/40 transition-colors"
      >
        <User className="w-3.5 h-3.5 text-yunlan-cinnabar" />
        <span className="tabular-nums text-slate-700 dark:text-slate-200">
          {loading ? '…' : vip ? 'VIP' : `${remaining} 点`}
        </span>
        <ChevronDown className="w-3 h-3 opacity-60" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[min(18rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl p-4 z-50 text-xs">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                {user ? user.email : '未登录用户'}
              </p>
              <p className="text-slate-500 mt-0.5">今日免费体验额度</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              VIP {points?.vipLabel || '免费体验'}
            </span>
          </div>

          <div className="mb-2">
            <div className="flex justify-between text-slate-600 dark:text-slate-400 mb-1">
              <span>
                今日额度 <strong className="text-slate-900 dark:text-white">{remaining}</strong> / {limit}
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-yunlan-cinnabar/80 transition-all"
                style={{ width: `${100 - pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              已使用 {used} 点 · 每次搜索 {points?.costPerSearch ?? 10} 点 · 明日 00:00（{points?.timezone || 'Asia/Shanghai'}）重置
            </p>
          </div>

          {vip && points?.subscription?.activeUntil && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
              VIP 至 {new Date(points.subscription.activeUntil).toLocaleDateString('zh-CN')}
            </p>
          )}

          {!vip && onOpenPaywall && (
            <button
              type="button"
              onClick={() => {
                onOpenPaywall();
                setOpen(false);
              }}
              className={`w-full mb-2 min-h-11 py-2 rounded-lg font-semibold text-white ${
                low
                  ? 'bg-yunlan-cinnabar hover:bg-[#AF571B]'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {low ? '积分不足 · 立即开通 VIP' : '开通 VIP · 月付 3 元起'}
            </button>
          )}

          {user ? (
            <button
              type="button"
              onClick={() => {
                onLogout();
                setOpen(false);
              }}
              className="w-full flex items-center justify-center gap-2 min-h-11 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <LogOut className="w-3.5 h-3.5" />
              退出登录
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                onOpenAuth();
                setOpen(false);
              }}
              className="w-full min-h-11 py-2 rounded-lg bg-yunlan-cta hover:opacity-90 text-white font-semibold"
            >
              登录 / 注册
            </button>
          )}
        </div>
      )}
    </div>
  );
};
