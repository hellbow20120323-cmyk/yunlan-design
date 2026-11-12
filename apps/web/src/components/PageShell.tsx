/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Search } from 'lucide-react';

/** 各内容页顶部的资料检索入口，提交后回到首页结果页 */
const QuickSearch: React.FC = () => {
  const [query, setQuery] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = query.trim();
    if (!value) return;
    window.location.href = `/?q=${encodeURIComponent(value)}`;
  };

  return (
    <form onSubmit={handleSubmit} role="search" className="mt-4 sm:mt-5 max-w-xl">
      <div className="flex items-center gap-2 rounded-[2px] border border-yunlan-hairline bg-yunlan-surface px-2.5 py-1.5 shadow-yunlan-card focus-within:border-[#d8cbb8] transition-colors">
        <Search className="w-4 h-4 text-[#9a7b4f] shrink-0" strokeWidth={1.8} />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="检索公开文档与资料…"
          aria-label="资料检索"
          className="flex-1 min-w-0 min-h-8 bg-transparent text-[13px] text-yunlan-ink placeholder:text-yunlan-muted focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 min-h-8 px-3 text-xs font-medium text-white bg-yunlan-cta rounded-sm hover:bg-[#a83d45] transition-colors"
        >
          搜索
        </button>
      </div>
    </form>
  );
};

interface PageShellProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: '4xl' | '6xl';
}

/** 各主导航页统一的象牙白页框与标题层级 */
export const PageShell: React.FC<PageShellProps> = ({
  title,
  subtitle,
  children,
  className = '',
  maxWidth = '6xl',
}) => {
  const maxClass = maxWidth === '4xl' ? 'max-w-4xl' : 'max-w-6xl';
  return (
    <div className={`w-full ${maxClass} mx-auto py-5 sm:py-10 ${className}`}>
      <header className="mb-5 sm:mb-10">
        <p className="text-[11px] font-sans font-normal tracking-[0.28em] text-yunlan-muted mb-2 sm:mb-3">
          YUNLAN
        </p>
        <h1 className="font-yunlan-serif text-lg sm:text-2xl font-medium tracking-[0.08em] sm:tracking-[0.12em] text-yunlan-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2 sm:mt-3 text-[13px] sm:text-sm font-light text-yunlan-muted leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        ) : null}
        <QuickSearch />
      </header>
      {children}
    </div>
  );
};

/** 内容区卡片 — 与侧栏/搜索框一致的纸质感 */
export function yunlanCardClass(extra = '') {
  return `rounded-[2px] border border-yunlan-hairline bg-yunlan-surface shadow-yunlan-card ${extra}`.trim();
}
