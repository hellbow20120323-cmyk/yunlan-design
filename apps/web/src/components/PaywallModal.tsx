import React, { useEffect, useState } from 'react';
import { X, Crown, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { AuthUser, BillingPlan, BillingProviders } from '../types/auth';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface PaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: AuthUser | null;
  onOpenAuth: () => void;
  onPaid: () => void;
  reason?: string;
}

type Provider = 'alipay' | 'wechat' | 'manual';

interface OrderPayment {
  amountCny: number;
  orderId: string;
  planLabel: string;
  hint: string;
  contact: string | null;
  contactEmail: string | null;
  methods: string[];
  provider?: Provider;
  payUrl?: string | null;
  qrCode?: string | null;
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
  const [providers, setProviders] = useState<BillingProviders>({ alipay: false, wechat: false });
  const [channel, setChannel] = useState<Provider>('manual');
  const [loading, setLoading] = useState(false);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [payment, setPayment] = useState<OrderPayment | null>(null);
  const [mockPayEnabled, setMockPayEnabled] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [mockBusy, setMockBusy] = useState(false);
  const [refreshBusy, setRefreshBusy] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setPayment(null);
    setOrderId(null);
    setError('');
    fetch('/api/billing/plans', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setPlans(d.plans || []);
        const p: BillingProviders = {
          alipay: Boolean(d?.providers?.alipay),
          wechat: Boolean(d?.providers?.wechat),
        };
        setProviders(p);
        setChannel(p.alipay ? 'alipay' : p.wechat ? 'wechat' : 'manual');
      })
      .catch(() => setPlans([]));
  }, [isOpen]);

  useLockBodyScroll(isOpen);
  if (!isOpen) return null;

  const mailtoHref =
    payment?.contactEmail && orderId
      ? `mailto:${payment.contactEmail}?subject=${encodeURIComponent(`云览会员开通申请 ${orderId}`)}&body=${encodeURIComponent(
          [
            '你好，我已为云览 VIP 完成付款，申请开通：',
            '',
            `订单号：${orderId}`,
            `套餐：${payment.planLabel}`,
            `金额：¥${payment.amountCny}`,
            `登录邮箱：${user?.email || '（未登录）'}`,
            '',
            '（请附上支付截图或交易单号）',
          ].join('\n')
        )}`
      : null;

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
        body: JSON.stringify({ planId, provider: channel }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '下单失败');
      setOrderId(data.order.id);
      setPayment({
        ...data.payment,
        provider: data.provider || channel,
        payUrl: data.payUrl || null,
        qrCode: data.qrCode || null,
      });
      setMockPayEnabled(Boolean(data.mockPayEnabled));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyPlan(null);
    }
  };

  const refreshOrder = async () => {
    if (!orderId) return;
    setRefreshBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/billing/orders/${orderId}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '查询订单失败');
      if (data.order?.status === 'paid' || data.subscription?.active) {
        onPaid();
        onClose();
        return;
      }
      setError('尚未收到支付结果，请稍等片刻再刷新');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshBusy(false);
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
            <>
              <div className="flex gap-2">
                {providers.alipay && (
                  <button
                    type="button"
                    onClick={() => setChannel('alipay')}
                    className={`flex-1 min-h-10 rounded-lg border text-xs font-semibold transition-colors ${
                      channel === 'alipay'
                        ? 'border-[#1677ff] bg-[#1677ff]/10 text-[#1677ff]'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    支付宝
                  </button>
                )}
                {providers.wechat && (
                  <button
                    type="button"
                    onClick={() => setChannel('wechat')}
                    className={`flex-1 min-h-10 rounded-lg border text-xs font-semibold transition-colors ${
                      channel === 'wechat'
                        ? 'border-emerald-600 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    微信支付
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setChannel('manual')}
                  className={`flex-1 min-h-10 rounded-lg border text-xs font-semibold transition-colors ${
                    channel === 'manual'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  邮件申请
                </button>
              </div>
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
            </>
          ) : (
            <div className="space-y-3 rounded-xl border border-slate-200 dark:border-slate-800 p-4 bg-slate-50 dark:bg-slate-950/50">
              <p className="font-semibold text-slate-900 dark:text-white">
                应付 ¥{payment.amountCny} · {payment.planLabel}
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                订单号：<code className="font-mono">{payment.orderId}</code>
              </p>
              {payment.provider === 'alipay' && payment.payUrl ? (
                <>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    已生成支付宝收银台，点击下方按钮完成付款。
                  </p>
                  <a
                    href={payment.payUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#1677ff] text-white font-semibold text-xs"
                  >
                    前往支付宝付款
                  </a>
                </>
              ) : payment.provider === 'wechat' && payment.qrCode ? (
                <>
                  <div className="flex justify-center rounded-lg bg-white p-3">
                    <QRCodeSVG value={payment.qrCode} size={192} />
                  </div>
                  <p className="text-xs text-center text-slate-600 dark:text-slate-400">
                    请使用微信「扫一扫」完成支付
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">{payment.hint}</p>
                  {payment.contact && (
                    <p className="text-xs text-cyan-700 dark:text-cyan-300">联系开通：{payment.contact}</p>
                  )}
                  {mailtoHref ? (
                    <>
                      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                        付款后点击下方按钮发送开通申请（自动带上订单号），附上付款截图或交易单号即可。
                      </p>
                      <p className="text-xs text-slate-500">
                        申请邮箱：<code className="font-mono">{payment.contactEmail}</code>
                      </p>
                      <a
                        href={mailtoHref}
                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-yunlan-cta text-white font-semibold text-xs"
                      >
                        发送开通申请邮件
                      </a>
                    </>
                  ) : (
                    <p className="text-xs text-slate-500">
                      支持：{payment.methods.join(' / ')}。支付完成后请保留订单号，我们会为你开通会员。
                    </p>
                  )}
                </>
              )}
              <button
                type="button"
                disabled={refreshBusy}
                onClick={refreshOrder}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-cyan-600 text-cyan-700 dark:text-cyan-300 font-semibold text-xs disabled:opacity-60"
              >
                <RefreshCw className={`w-4 h-4 ${refreshBusy ? 'animate-spin' : ''}`} />
                {refreshBusy ? '查询中…' : '我已完成支付，刷新状态'}
              </button>
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
