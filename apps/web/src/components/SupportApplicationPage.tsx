import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

export const SupportApplicationPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/support/applications', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), optInEmail: optIn }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '提交失败，请稍后再试');
      setDone(data.message || '申请已提交，正在等待人工审核。');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-yunlan-paper text-yunlan-ink">
      <header className="border-b border-yunlan-hairline bg-yunlan-paper/90">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 min-h-11">
            <BrandLogo className="w-7 h-7" />
            <span className="font-semibold text-sm text-[#3d3832]">云览 Yunlan</span>
          </a>
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-yunlan-muted hover:text-[#9a7b4f] min-h-11"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            返回首页
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-2xl border border-yunlan-hairline bg-yunlan-surface p-5 sm:p-7 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1661ab]/10 text-[#1661ab] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">提交支持申请</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                本站为自愿支持，不属于交易，也不存在转账后自动开通。提交后进入人工审核队列，
                全部由站长人工终审。
              </p>
            </div>
          </div>

          {done ? (
            <div className="mt-6 rounded-xl border border-emerald-600/20 bg-emerald-600/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                申请已提交
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-600">{done}</p>
              <ul className="mt-3 space-y-1.5 text-xs leading-relaxed text-slate-600 list-disc pl-4">
                <li>如勾选了邮件通知，请留意收件箱与垃圾邮件目录。</li>
                <li>邮件内只包含认领口令与一次性中转链接，不包含赞赏码。</li>
                <li>中转链接 24 小时内有效，且仅可访问一次。</li>
                <li>是否自愿支持与审核结果、权限发放没有任何绑定。</li>
              </ul>
              <div className="mt-4 flex flex-wrap gap-2">
                <a
                  href="/relay/status"
                  className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg bg-yunlan-cta text-white text-xs font-semibold"
                >
                  查看申请状态
                </a>
                <a
                  href="/"
                  className="inline-flex items-center justify-center min-h-11 px-4 rounded-lg border border-yunlan-hairline text-xs font-semibold text-slate-600"
                >
                  返回首页
                </a>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label htmlFor="support-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  邮箱
                </label>
                <input
                  id="support-email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="用于接收申请状态通知"
                  className="w-full min-h-11 px-3 rounded-lg border border-yunlan-hairline bg-white text-sm outline-none focus:border-[#1661ab]"
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  邮箱仅作为本次申请的唯一标识，不用于其他用途。
                </p>
              </div>

              <label className="flex items-start gap-2.5 rounded-lg border border-yunlan-hairline bg-yunlan-paper/60 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={optIn}
                  onChange={(e) => setOptIn(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-[#1661ab]"
                />
                <span className="text-xs leading-relaxed text-slate-600">
                  我同意接收申请状态通知邮件（包含认领口令、审核说明与一次性中转链接）。
                  不勾选则只入库、不发送任何邮件。
                </span>
              </label>

              <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] leading-relaxed text-amber-800">
                说明：自愿支持完全出于自愿，不强制。本站没有到账回调，不会自动识别转账，
                也不会因支持行为自动开通任何权限；审核结果以人工结论为准。
              </div>

              {error && (
                <p className="text-xs text-red-500" role="alert">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-11 rounded-lg bg-yunlan-cta text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                {busy ? '提交中…' : '提交申请'}
              </button>

              <p className="text-[11px] text-slate-500 leading-relaxed">
                提交即表示你已阅读上述说明。已有申请可在同一浏览器打开{' '}
                <a href="/relay/status" className="text-[#1661ab] underline">
                  申请状态页
                </a>
                。
              </p>
            </form>
          )}
        </div>
      </main>
    </div>
  );
};
