/**
 * 云览微博源配置（对接 /api/config/weibo）
 */

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface BloggerRow {
  uid: string;
  nick: string;
}

interface WeiboConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string) => void;
  onSaved?: () => void;
}

export const WeiboConfigModal: React.FC<WeiboConfigModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
  onSaved,
}) => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [cfg, setCfg] = useState({
    enabled: false,
    allowDemo: false,
    fetchComments: true,
    maxPages: 2,
    weiboComConfigured: false,
    mWeiboConfigured: false,
    cookieWeiboComInput: '',
    cookieMWeiboInput: '',
    clearCookieWeiboCom: false,
    clearCookieMWeibo: false,
    bloggers: [{ uid: '', nick: '' }] as BloggerRow[],
  });

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setMsg('');
    fetch('/api/config/weibo')
      .then((r) => r.json())
      .then((json) => {
        if (!json.ok) throw new Error(json.error || '加载失败');
        const c = json.config || {};
        setCfg((prev) => ({
          ...prev,
          enabled: Boolean(c.enabled),
          allowDemo: Boolean(c.allowDemo),
          fetchComments: c.fetchComments !== false,
          maxPages: c.maxPages || 2,
          weiboComConfigured: Boolean(c.weiboComConfigured),
          mWeiboConfigured: Boolean(c.mWeiboConfigured),
          cookieWeiboComInput: '',
          cookieMWeiboInput: '',
          bloggers:
            Array.isArray(c.bloggers) && c.bloggers.length
              ? c.bloggers.map((b: BloggerRow) => ({ uid: b.uid || '', nick: b.nick || '' }))
              : [{ uid: '', nick: '' }],
        }));
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMsg('');
    try {
      const bloggers = cfg.bloggers
        .map((b) => ({ uid: String(b.uid).trim(), nick: String(b.nick).trim() }))
        .filter((b) => /\d{5,}/.test(b.uid));
      const body: Record<string, unknown> = {
        enabled: cfg.enabled,
        bloggers,
        fetchComments: cfg.fetchComments,
        maxPages: cfg.maxPages,
        allowDemo: cfg.allowDemo,
        clearCookieWeiboCom: cfg.clearCookieWeiboCom,
        clearCookieMWeibo: cfg.clearCookieMWeibo,
      };
      if (cfg.cookieWeiboComInput.trim()) body.cookieWeiboCom = cfg.cookieWeiboComInput.trim();
      if (cfg.cookieMWeiboInput.trim()) body.cookieMWeibo = cfg.cookieMWeiboInput.trim();

      const res = await fetch('/api/config/weibo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || '保存失败');
      onShowToast('微博配置已保存');
      onSaved?.();
      onClose();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">微博源（云览网关）</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>
        {loading ? (
          <p className="p-5 text-xs text-slate-500">加载中…</p>
        ) : (
          <form onSubmit={save} className="p-5 space-y-3 text-xs">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cfg.enabled}
                onChange={(e) => setCfg((p) => ({ ...p, enabled: e.target.checked }))}
              />
              启用微博源
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={cfg.allowDemo}
                onChange={(e) => setCfg((p) => ({ ...p, allowDemo: e.target.checked }))}
              />
              无 Cookie 时使用演示夹具
            </label>
            <label className="block">
              weibo.com Cookie
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 font-mono text-[11px]"
                rows={2}
                value={cfg.cookieWeiboComInput}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, cookieWeiboComInput: e.target.value, clearCookieWeiboCom: false }))
                }
                placeholder={cfg.weiboComConfigured ? '已配置（留空保持）' : '登录 weibo.com 后复制 Cookie'}
              />
            </label>
            <label className="block">
              m.weibo.cn Cookie
              <textarea
                className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 font-mono text-[11px]"
                rows={2}
                value={cfg.cookieMWeiboInput}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, cookieMWeiboInput: e.target.value, clearCookieMWeibo: false }))
                }
                placeholder={cfg.mWeiboConfigured ? '已配置（留空保持）' : '登录 m.weibo.cn 后复制 Cookie'}
              />
            </label>
            {msg && <p className="text-red-500">{msg}</p>}
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-cyan-600 text-white font-semibold disabled:opacity-50"
              >
                {saving ? '保存中…' : '保存'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
                取消
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
