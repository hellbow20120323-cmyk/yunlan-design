/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Compass, Database, Flame, Crown, Bookmark } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { UserQuotaPanel } from './UserQuotaPanel';
import { AuthUser, PointsStatus } from '../types/auth';

interface HeaderProps {
  activeTab: 'search' | 'providers' | 'rankings' | 'guide';
  setActiveTab: (tab: 'search' | 'providers' | 'rankings' | 'guide') => void;
  onGoHome?: () => void;
  user?: AuthUser | null;
  points?: PointsStatus | null;
  authLoading?: boolean;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenPaywall?: () => void;
  onOpenFavorites?: () => void;
  favoritesCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onGoHome,
  user = null,
  points = null,
  authLoading = false,
  onOpenAuth,
  onLogout,
  onOpenPaywall,
  onOpenFavorites,
  favoritesCount = 0,
}) => {
  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-yunlan-paper/90 border-b border-yunlan-hairline transition-colors yl-safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3 md:gap-8">
        <button
          type="button"
          onClick={() => (onGoHome ? onGoHome() : setActiveTab('search'))}
          className="flex items-center gap-2 md:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-yunlan-cinnabar/30 rounded-sm p-1 min-h-11"
          title="返回首页"
        >
          <BrandLogo className="w-8 h-8 md:w-9 md:h-9 group-hover:shadow-ink-wash transition-shadow" />
          <div className="flex flex-col">
            <span className="font-yunlan-serif text-[15px] md:text-base font-medium tracking-[0.15em] text-yunlan-ink whitespace-nowrap shrink-0 flex items-center gap-2">
              云览 <span className="hidden sm:inline font-sans text-[10px] font-normal tracking-[0.22em] text-yunlan-muted">YUNLAN</span>
            </span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-8 text-[13px] font-light">
          <button
            onClick={() => setActiveTab('search')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'search'
                ? 'text-yunlan-stone font-medium'
                : 'text-yunlan-muted hover:text-yunlan-ink'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>发现资源</span>
          </button>

          <button
            onClick={() => setActiveTab('providers')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'providers'
                ? 'text-yunlan-stone font-medium'
                : 'text-yunlan-muted hover:text-yunlan-ink'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>网盘引擎</span>
          </button>

          <button
            onClick={() => setActiveTab('rankings')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'rankings'
                ? 'text-yunlan-stone font-medium'
                : 'text-yunlan-muted hover:text-yunlan-ink'
            }`}
          >
            <Flame className="w-4 h-4" />
            <span>热门榜单</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'guide'
                ? 'text-yunlan-stone font-medium'
                : 'text-yunlan-muted hover:text-yunlan-ink'
            }`}
          >
            <span>使用指南</span>
          </button>
        </nav>

        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          {onOpenFavorites && (
            <button
              type="button"
              onClick={onOpenFavorites}
              className="relative p-2.5 text-yunlan-muted hover:text-yunlan-ink hover:bg-yunlan-mist/80 rounded-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-yunlan-cinnabar/30 min-h-11 min-w-11 flex items-center justify-center"
              title="我的收藏"
            >
              <Bookmark className="w-4 h-4" />
              {favoritesCount > 0 && (
                <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 text-[10px] font-bold text-white bg-yunlan-cta rounded-sm flex items-center justify-center">
                  {favoritesCount > 9 ? '9+' : favoritesCount}
                </span>
              )}
            </button>
          )}

          {onOpenPaywall && !points?.subscription?.active && !points?.unlimitedSearch && (
            <>
              <button
                type="button"
                onClick={onOpenPaywall}
                className="sm:hidden p-2.5 text-yunlan-cinnabar hover:bg-yunlan-mist/80 rounded-sm min-h-11 min-w-11 flex items-center justify-center"
                title="开通 VIP · 月付 3 元起"
              >
                <Crown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onOpenPaywall}
                className="hidden sm:flex items-center gap-1.5 px-3 min-h-9 text-xs font-semibold text-white bg-yunlan-cinnabar hover:bg-[#a83d45] rounded-[4px] transition-colors whitespace-nowrap active:translate-y-px"
                title="月付 3 元起 · 有效期内搜索不扣积分"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>开通 VIP</span>
                <span className="text-[10px] font-semibold opacity-90">¥3起</span>
              </button>
            </>
          )}

          {onOpenAuth && onLogout && (
            <UserQuotaPanel
              user={user}
              points={points}
              loading={authLoading}
              onOpenAuth={onOpenAuth}
              onLogout={onLogout}
              onOpenPaywall={onOpenPaywall}
            />
          )}
        </div>
      </div>
    </header>
  );
};
