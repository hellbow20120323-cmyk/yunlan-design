import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, Loader2, Mail, Search, Upload, X } from 'lucide-react';
import { BrandLogo } from './BrandLogo';

type Credential = {
  code: string;
  token: string;
  expiresAt: string;
  email: string;
  status: string;
  choice: string | null;
  qrAvailable: boolean;
};

const statusText = (status: string) =>
  status === 'approved' ? '已通过' : status === 'rejected' ? '未通过' : '待审核';

const SupportApplicationPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [credential, setCredential] = useState<Credential | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [choice, setChoice] = useState<'support' | 'skip' | null>(null);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [choiceError, setChoiceError] = useState('');

  const [retrieveOpen, setRetrieveOpen] = useState(false);
  const [retrieveEmail, setRetrieveEmail] = useState('');
  const [retrieveBusy, setRetrieveBusy] = useState(false);
  const [retrieveError, setRetrieveError] = useState('');

  const [tradeNo, setTradeNo] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  const applyCredential = useCallback((next: Credential) => {
    setCredential(next);
    setChoice(next.choice === 'support' || next.choice === 'skip' ? next.choice : null);
    setModalOpen(true);
    setChoiceError('');
    setUploadMsg('');
  }, []);

  // 邮件中的找回链接：/support?token=xxx
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token');
    if (!token) return;
    fetch(`/api/support/credential?token=${encodeURIComponent(token)}`, { credentials: 'include' })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || '凭证已失效');
        applyCredential(data.credential as Credential);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
        setRetrieveOpen(true);
      });
  }, [applyCredential]);

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
      applyCredential(data.credential as Credential);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const choose = async (value: 'support' | 'skip') => {
    if (!credential) return;
    setChoiceBusy(true);
    setChoiceError('');
    try {
      const res = await fetch('/api/support/choice', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credential.token, choice: value }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '操作失败');
      setChoice(value);
    } catch (err) {
      setChoiceError(err instanceof Error ? err.message : String(err));
    } finally {
      setChoiceBusy(false);
    }
  };

  const retrieve = async (e: React.FormEvent) => {
    e.preventDefault();
    setRetrieveBusy(true);
    setRetrieveError('');
    try {
      const res = await fetch('/api/support/retrieve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: retrieveEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '未找到申请');
      setRetrieveOpen(false);
      applyCredential(data.credential as Credential);
    } catch (err) {
      setRetrieveError(err instanceof Error ? err.message : String(err));
    } finally {
      setRetrieveBusy(false);
    }
  };

  const upload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credential) return;
    if (!file && !tradeNo.trim()) {
      setUploadMsg('请填写交易单号或选择账单截图');
      return;
    }
    setUploadBusy(true);
    setUploadMsg('');
    try {
      const url = `/api/support/uploads?token=${encodeURIComponent(credential.token)}`;
      const res = file
        ? await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': file.type },
            body: file,
          })
        : await fetch(url, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tradeNo: tradeNo.trim() }),
          });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || '提交失败');
      setUploadMsg('凭证已提交，仅供人工对账参考');
      setFile(null);
      setTradeNo('');
    } catch (err) {
      setUploadMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-yunlan-paper text-yunlan-ink">
      <header className="border-b border-yunlan-hairline bg-yunlan-paper/90">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 min-h-11">
            <BrandLogo className="w-7 h-7" />
            <span className="font-bold text-sm text-[#1C1917]">自行车与家酿</span>
          </a>
          <div className="flex items-center gap-3">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-yunlan-muted hover:text-[#C86D28] min-h-11"
              title="返回首页并搜索资料"
            >
              <Search className="w-3.5 h-3.5" />
              搜索
            </a>
            <button
              type="button"
              onClick={() => setRetrieveOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs text-[#C86D28] min-h-11"
            >
              <Search className="w-3.5 h-3.5" />
              找回您的申请
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs text-yunlan-muted hover:text-[#C86D28] min-h-11"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              返回首页
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="rounded-2xl border border-yunlan-hairline bg-yunlan-surface p-5 sm:p-7 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#C86D28]/10 text-[#C86D28] flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">提交支持申请</h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-500 leading-relaxed">
                本站为自愿支持，不属于交易，也没有到账回调与自动开通。提交后立即获得认领口令，
                全部申请由站长人工终审。
              </p>
            </div>
          </div>

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
                placeholder="用于找回申请，不用于其他用途"
                className="w-full min-h-11 px-3 rounded-lg border border-yunlan-hairline bg-white text-sm outline-none focus:border-[#C86D28]"
              />
              <p className="mt-1.5 text-[11px] text-slate-500">
                邮箱仅作为本次申请的唯一标识；提交成功后口令会直接显示在本页，无需等待邮件。
              </p>
            </div>

            <label className="flex items-start gap-2.5 rounded-lg border border-yunlan-hairline bg-yunlan-paper/60 p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={optIn}
                onChange={(e) => setOptIn(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-[#C86D28]"
              />
              <span className="text-xs leading-relaxed text-slate-600">
                我同意接收一封兜底通知邮件（只含认领口令与找回链接，不含赞赏码）。
                不勾选则只入库、不发送任何邮件。
              </span>
            </label>

            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-[11px] leading-relaxed text-amber-800">
              免责说明：自愿捐助，不代表审核优先、不保证通过。本站不会自动识别到账，
              也不会因捐助自动开通任何权限；审核结果以人工结论为准。
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
              已有申请？点击右上角「找回您的申请」，输入邮箱即可重新打开口令与选项。
            </p>
          </form>
        </div>
      </main>

      {/* 申请浮层：口令 + 两个选项，赞赏码仅在浮层内加载 */}
      {modalOpen && credential && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="support-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="support-modal-title" className="text-base font-bold text-slate-900">
                  申请已提交
                </h2>
                <p className="mt-1 text-[11px] text-slate-500">
                  {credential.email} · 当前状态：{statusText(credential.status)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="关闭"
                className="p-2 -m-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-yunlan-hairline bg-yunlan-paper/60 p-4 text-center">
              <p className="text-[11px] text-slate-500">认领口令</p>
              <p className="mt-1 text-3xl font-bold tracking-[0.35em] text-[#1C1917]">{credential.code}</p>
              <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                口令仅用于账单备注辅助核对，不是审核通过的必要条件。请自行留存。
              </p>
            </div>

            {!choice && (
              <div className="mt-4 space-y-2.5">
                <button
                  type="button"
                  disabled={choiceBusy}
                  onClick={() => choose('support')}
                  className="w-full min-h-11 rounded-lg bg-yunlan-cta text-white text-sm font-semibold disabled:opacity-60"
                >
                  自愿支持站点维护
                </button>
                <button
                  type="button"
                  disabled={choiceBusy}
                  onClick={() => choose('skip')}
                  className="w-full min-h-11 rounded-lg border border-yunlan-hairline text-sm font-semibold text-slate-600 disabled:opacity-60"
                >
                  不支持，直接等待人工审核
                </button>
                <p className="text-[11px] leading-relaxed text-slate-500">
                  两个选项都不影响审核结论。自愿捐助，不代表审核优先、不保证通过。
                </p>
              </div>
            )}

            {choice === 'skip' && (
              <div className="mt-4 rounded-xl border border-yunlan-hairline bg-yunlan-paper/60 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  已进入人工审核队列
                </p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  无需任何转账操作。审核结果由站长人工给出，不保证通过，也不会因是否捐助而变化。
                </p>
              </div>
            )}

            {choice === 'support' && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-800">自愿支持</h3>
                {credential.qrAvailable ? (
                  <img
                    src={`/api/support/qr?token=${encodeURIComponent(credential.token)}`}
                    alt="赞赏码"
                    className="mt-3 w-52 max-w-full mx-auto rounded-lg border border-yunlan-hairline"
                  />
                ) : (
                  <p className="mt-2 text-[11px] text-slate-500">赞赏码暂未配置，请联系站长。</p>
                )}
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  如自愿支持，请在转账备注中填写口令 <strong>{credential.code}</strong>，便于人工对账；
                  备注仅用于核对，不代表审核优先。
                </p>

                <form onSubmit={upload} className="mt-3 space-y-2">
                  <label className="block text-[11px] text-slate-500">
                    交易单号（选填）
                    <input
                      type="text"
                      maxLength={64}
                      value={tradeNo}
                      onChange={(e) => setTradeNo(e.target.value)}
                      placeholder="例如微信转账单号"
                      className="mt-1 w-full min-h-10 px-3 rounded-lg border border-yunlan-hairline bg-white text-sm outline-none focus:border-[#C86D28]"
                    />
                  </label>
                  <label className="block text-[11px] text-slate-500">
                    账单截图（选填，PNG / JPEG / WebP，≤2MB）
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                      className="mt-1 block w-full text-xs text-slate-600"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={uploadBusy}
                    className="w-full min-h-10 rounded-lg border border-yunlan-hairline text-xs font-semibold text-slate-700 inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    {uploadBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    {uploadBusy ? '提交中…' : '提交对账凭证（可选）'}
                  </button>
                  {uploadMsg && <p className="text-[11px] text-slate-500">{uploadMsg}</p>}
                </form>
              </div>
            )}

            <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
              凭证 24 小时内可重复打开。换设备或刷新页面时，点右上角「找回您的申请」输入邮箱即可。
            </p>
          </div>
        </div>
      )}

      {/* 找回弹窗：输入邮箱校验凭证 */}
      {retrieveOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="retrieve-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) setRetrieveOpen(false);
          }}
        >
          <form onSubmit={retrieve} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between">
              <h2 id="retrieve-title" className="text-base font-bold text-slate-900">
                找回您的申请
              </h2>
              <button
                type="button"
                onClick={() => setRetrieveOpen(false)}
                aria-label="关闭"
                className="p-2 -m-2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              输入申请时使用的邮箱，校验通过即可重新打开口令与选项。
            </p>
            <input
              type="email"
              required
              maxLength={254}
              autoComplete="email"
              value={retrieveEmail}
              onChange={(e) => setRetrieveEmail(e.target.value)}
              placeholder="申请邮箱"
              className="mt-3 w-full min-h-11 px-3 rounded-lg border border-yunlan-hairline bg-white text-sm outline-none focus:border-[#C86D28]"
            />
            {retrieveError && <p className="mt-2 text-xs text-red-500">{retrieveError}</p>}
            <button
              type="submit"
              disabled={retrieveBusy}
              className="mt-3 w-full min-h-11 rounded-lg bg-yunlan-cta text-white text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {retrieveBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              {retrieveBusy ? '查找中…' : '打开我的申请'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default SupportApplicationPage;
export { SupportApplicationPage };
