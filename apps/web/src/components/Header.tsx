/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Bike, Compass, Database, Flame, Crown, Bookmark, Wrench, ChevronDown } from 'lucide-react';
import { BrandLogo } from './BrandLogo';
import { UserQuotaPanel } from './UserQuotaPanel';
import { TOOLS_BY_CATEGORY } from './tools/ToolsPage';
import { VELO_HOME, VELO_ONLY_TOOLS } from '../constants/veloTools';
import { AuthUser, PointsStatus } from '../types/auth';

type TabId = 'search' | 'providers' | 'rankings' | 'guide' | 'tools';

interface HeaderProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onGoHome?: () => void;
  user?: AuthUser | null;
  points?: PointsStatus | null;
  authLoading?: boolean;
  onOpenAuth?: () => void;
  onLogout?: () => void;
  onOpenPaywall?: () => void;
  onOpenFavorites?: () => void;
  favoritesCount?: number;
  /** 搜索入口开关：关闭时只展示合规工具入口 */
  searchEnabled?: boolean;
  /** 直接打开某个在线工具 */
  onOpenTool?: (slug: string) => void;
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
  searchEnabled = true,
  onOpenTool,
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toolsOpen) return;
    const handlePointerDown = (e: Event) => {
      if (toolsRef.current && !toolsRef.current.contains(e.target as Node)) {
        setToolsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setToolsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toolsOpen]);

  const navButtonClass = (active: boolean) =>
    `flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 rounded-xl px-2.5 py-1.5 ${
      active
        ? 'text-[#C86D28] bg-[#FAF0E4] font-semibold'
        : 'text-yunlan-muted hover:text-[#C86D28] hover:bg-[#FAF0E4]'
    }`;

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-md bg-yunlan-paper/95 border-b border-yunlan-hairline transition-colors yl-safe-top">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between gap-3 md:gap-8">
        <button
          type="button"
          onClick={() => (onGoHome ? onGoHome() : setActiveTab('search'))}
          className="flex items-center gap-2 md:gap-2.5 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-yunlan-cinnabar/30 rounded-xl p-1 min-h-11"
          title="返回首页"
        >
          <BrandLogo className="w-8 h-8 md:w-9 md:h-9 group-hover:shadow-ink-wash transition-shadow" />
          <div className="flex flex-col">
            <span className="text-[15px] md:text-base font-black tracking-tight text-yunlan-ink whitespace-nowrap shrink-0 flex items-baseline gap-2 group-hover:text-[#C86D28] transition-colors">
              自行车与家酿
              <span className="hidden sm:inline font-mono text-[10px] font-bold tracking-[0.2em] text-[#8C4115]">
                VELO &amp; BREW
              </span>
            </span>
          </div>
        </button>

        <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-sm">
          {searchEnabled && (
            <button
              onClick={() => setActiveTab('search')}
              className={navButtonClass(activeTab === 'search')}
            >
              <Compass className="w-4 h-4" />
              <span>发现资源</span>
            </button>
          )}

          <div ref={toolsRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setToolsOpen((open) => !open)}
              className={navButtonClass(activeTab === 'tools')}
              aria-expanded={toolsOpen}
              aria-haspopup="menu"
            >
              <Wrench className="w-4 h-4" />
              <span>在线工具</span>
              <ChevronDown
                className={`w-3.5 h-3.5 transition-transform ${toolsOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {toolsOpen && (
              <div
                role="menu"
                className="absolute left-0 top-full mt-2 w-72 max-h-[70vh] overflow-y-auto rounded-2xl border border-yunlan-hairline bg-yunlan-surface shadow-ink-wash py-1 z-50"
              >
                {TOOLS_BY_CATEGORY.map((category) => (
                  <div key={category.id}>
                    <p className="px-3 pt-2.5 pb-1 text-[10px] tracking-[0.18em] text-yunlan-muted/80">
                      {category.label}
                    </p>
                    {category.tools.map((tool) => {
                      const Icon = tool.icon;
                      return (
                        <button
                          key={tool.slug}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setToolsOpen(false);
                            if (onOpenTool) onOpenTool(tool.slug);
                            else window.location.href = `/tools#${tool.slug}`;
                          }}
                          className="w-full flex items-start gap-2.5 px-3 py-2 text-left hover:bg-yunlan-mist/60 transition-colors"
                        >
                          <Icon className="w-4 h-4 mt-0.5 text-[#C86D28] shrink-0" strokeWidth={1.6} />
                          <span className="min-w-0">
                            <span className="block text-[13px] text-yunlan-ink">{tool.name}</span>
                            <span className="block mt-0.5 text-[11px] font-light text-yunlan-muted truncate">
                              {tool.desc}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ))}

                <div className="mt-1 pt-1 border-t border-yunlan-hairline">
                  <p className="px-3 pt-2.5 pb-1 text-[10px] tracking-[0.18em] text-yunlan-muted/80">
                    完整工坊 · 进阶工具
                  </p>
                  {VELO_ONLY_TOOLS.map((tool) => (
                    <a
                      key={tool.href}
                      href={tool.href}
                      className="flex items-start gap-2.5 px-3 py-2 text-left hover:bg-[#FAF0E4] transition-colors"
                    >
                      <span className="text-sm mt-0.5 shrink-0">{tool.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-[13px] text-yunlan-ink">{tool.name}</span>
                        <span className="block mt-0.5 text-[11px] font-light text-yunlan-muted truncate">
                          {tool.desc}
                        </span>
                      </span>
                    </a>
                  ))}
                  <a
                    href={VELO_HOME}
                    className="flex items-center justify-between px-3 py-2.5 mt-1 text-[12px] font-bold text-[#C86D28] hover:bg-[#FAF0E4] transition-colors"
                  >
                    <span>进入完整工坊（28 款）</span>
                    <span>→</span>
                  </a>
                </div>
              </div>
            )}
          </div>

          <a href={VELO_HOME} className={navButtonClass(false)}>
            <Bike className="w-4 h-4" />
            <span>完整工坊</span>
          </a>

          {searchEnabled && (
            <button
              onClick={() => setActiveTab('providers')}
              className={navButtonClass(activeTab === 'providers')}
            >
              <Database className="w-4 h-4" />
              <span>网盘引擎</span>
            </button>
          )}

          {searchEnabled && (
            <button
              onClick={() => setActiveTab('rankings')}
              className={navButtonClass(activeTab === 'rankings')}
            >
              <Flame className="w-4 h-4" />
              <span>热门榜单</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('guide')}
            className={navButtonClass(activeTab === 'guide')}
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
                <span className="absolute top-1 right-1 min-w-4 h-4 px-0.5 text-[11px] font-bold text-white bg-yunlan-cta rounded-sm flex items-center justify-center">
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
                className="hidden sm:flex items-center gap-1.5 px-3 min-h-9 text-xs font-semibold text-white bg-yunlan-cinnabar hover:bg-[#AF571B] rounded-xl transition-colors whitespace-nowrap active:translate-y-px"
                title="月付 3 元起 · 有效期内搜索不扣积分"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>开通 VIP</span>
                <span className="text-[11px] font-semibold opacity-90">¥3起</span>
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
