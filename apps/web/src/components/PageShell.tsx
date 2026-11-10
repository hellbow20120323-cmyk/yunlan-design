/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

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
    <div className={`w-full ${maxClass} mx-auto py-8 sm:py-10 ${className}`}>
      <header className="mb-8 sm:mb-10">
        <p className="text-[10px] font-sans font-normal tracking-[0.28em] text-yunlan-muted mb-3">
          YUNLAN
        </p>
        <h1 className="font-yunlan-serif text-xl sm:text-2xl font-medium tracking-[0.12em] text-yunlan-ink">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-3 text-sm font-light text-yunlan-muted leading-relaxed max-w-2xl">
            {subtitle}
          </p>
        ) : null}
      </header>
      {children}
    </div>
  );
};

/** 内容区卡片 — 与侧栏/搜索框一致的纸质感 */
export function yunlanCardClass(extra = '') {
  return `rounded-[2px] border border-yunlan-hairline bg-yunlan-surface shadow-yunlan-card ${extra}`.trim();
}
