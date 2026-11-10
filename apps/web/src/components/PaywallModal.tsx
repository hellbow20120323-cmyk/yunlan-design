import React, { useEffect, useState } from 'react';
import { X, Crown, CheckCircle2, Loader2 } from 'lucide-react';
import { AuthUser, BillingPlan } from '../types/auth';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onPaid: () => void;
  reason?: string;
}

interface OrderPayment {
  amountCny: number;
  orderId: string;
  planLabel: string;
  hint: string;
  contact: string | null;
  methods: string[];
}

export const PaywallModal: React.FC<PaywallModalProps> = ({
  isOpen,
  onClose,
  user,
  onOpenAuth,
  onPaid,
  reason,
}) => {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [mockPayEnabled, setMockPayEnabled] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mockBusy, setMockBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPayment(null);
    setOrderId(null);
    setError('');
    fetch('/api/billing/plans', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPlans(d.plans || []);
      })
      .catch(() => setPlans([]));
  }, [isOpen]);

  useLockBodyScroll(isOpen);
  if (!isOpen) return null;

  const startCheckout = async (planId: string) => {
    if (!user) {
      onOpenAuth();
      return;
    }
    setBusyPlan(planId);
    setError('');
    try {
      const res = await fetch('/api/billing/orders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '下单失败');
      setOrderId(data.order.id);
      setPayment(data.payment);
      setMockPayEnabled(Boolean(data.mockPayEnabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPlan(null);
    }
  };

  const mockPay = async () => {
    if (!orderId) return;
    setMockBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/billing/orders/${orderId}/mock-pay`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '开通失败');
      onPaid();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setMockBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-sm yl-backdrop"
      onClick={onClose}
    >
      <div
        className="yl-modal-panel w-full md:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-2xl md:rounded-2xl border-t md:border border-slate-200 dark:border-slate-800 bg-yunlan-surface dark:bg-slate-900 shadow-2xl yl-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">开通 VIP 继续搜索</h2>
          </div>
          <button type="button" onClick={onClose} className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 min-h-11 min-w-11 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-sm">
          {reason && (
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              {reason}
            </p>
          )}

          {!user && (
            <p className="text-xs text-slate-500">
              请先登录后再购买。未登录用户每日体验积分有限，VIP 开通后<strong className="text-slate-800 dark:text-white"> 有效期内搜索不扣积分</strong>。
            </p>
          )}

          {!payment ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {plans.map((plan) => (
                <button
                  key={plan.id}
                  type="button"
                  disabled={busyPlan === plan.id}
                  onClick={() => startCheckout(plan.id)}
                  className="relative text-left p-4 min-h-[5.5rem] rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-yunlan-cinnabar/50 transition-colors"
                >
                  {plan.badge && (
                    <span className="absolute -top-2 right-2 text-[11px] px-2 py-0.5 rounded-full bg-cyan-600 text-white font-bold">
                      {plan.badge}
                    </span>
                  )}
                  <p className="font-bold text-slate-900 dark:text-white">{plan.label}</p>
                  <p className="text-2xl font-extrabold text-yunlan-cinnabar mt-1">
                    ¥{plan.priceCny}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">{plan.durationDays} 天 VIP</p>
                  {busyPlan === plan.id && (
                    <Loader2 className="w-4 h-4 animate-spin absolute bottom-3 right-3 text-cyan-500" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/50">
              <p className="font-semibold text-slate-900 dark:text-white">
                应付 ¥{payment.amountCny} · {payment.planLabel}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                订单号：<code className="font-mono">{payment.orderId}</code>
              </p>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{payment.hint}</p>
              {payment.contact && (
                <p className="text-xs text-cyan-700 dark:text-cyan-300">联系开通：{payment.contact}</p>
              )}
              <p className="text-xs text-slate-500">
                支持：{payment.methods.join(' / ')}。支付完成后请保留订单号，我们会为你开通会员。
              </p>
              {mockPayEnabled && (
                <button
                  type="button"
                  disabled={mockBusy}
                  onClick={mockPay}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {mockBusy ? '开通中…' : '我已完成支付（演示开通）'}
                </button>
              )}
              <button
                type="button"
                className="text-xs text-slate-500 underline"
                onClick={() => {
                  setPayment(null);
                  setOrderId(null);
                }}
              >
                重新选择套餐
              </button>
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {!user && (
            <button
              type="button"
              onClick={onOpenAuth}
              className="w-full min-h-11 py-2.5 rounded-lg bg-yunlan-cta text-white font-semibold"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
