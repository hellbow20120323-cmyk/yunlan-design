import React, { useState } from 'react';
import { X, LogIn, UserPlus } from 'lucide-react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (email: string, password: string) => Promise<void>;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onLogin,
  onRegister,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useLockBodyScroll(isOpen);
  if (!isOpen) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await onLogin(email.trim(), password);
      else await onRegister(email.trim(), password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-4 bg-black/50 backdrop-blur-xs yl-backdrop"
      onClick={onClose}
    >
      <div
        className="yl-modal-panel w-full md:max-w-md rounded-t-2xl md:rounded-2xl border-t md:border border-slate-200 dark:border-slate-800 bg-yunlan-surface dark:bg-slate-900 shadow-2xl yl-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden mx-auto mt-2 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            {mode === 'login' ? '登录' : '注册'}
          </h2>
          <button type="button" onClick={onClose} className="p-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 min-h-11 min-w-11 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={submit} className="p-5 space-y-3 text-sm">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            未登录每日 50 点体验额度；登录后每日 100 点。每次搜索消耗 10 点，北京时间 0 点重置。
          </p>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">邮箱</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">密码</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full min-h-11 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2"
            />
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 min-h-11 py-2.5 rounded-lg bg-yunlan-cta text-white font-semibold disabled:opacity-50"
          >
            {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            {busy ? '处理中…' : mode === 'login' ? '登录' : '注册'}
          </button>
          <button
            type="button"
            className="w-full min-h-11 text-xs text-yunlan-stone"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError('');
            }}
          >
            {mode === 'login' ? '没有账号？注册' : '已有账号？登录'}
          </button>
        </form>
      </div>
    </div>
  );
};
