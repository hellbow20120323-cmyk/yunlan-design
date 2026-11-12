/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Compass, Database, Flame, Wrench, Search } from 'lucide-react';

type TabId = 'search' | 'providers' | 'rankings' | 'guide' | 'tools';

interface MobileBottomNavProps {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  hidden?: boolean;
  /** 搜索入口开关：关闭时只保留首页 / 工具 / 指南 */
  searchEnabled?: boolean;
}

const BASE_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'search', label: '发现', icon: <Compass className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  { id: 'tools', label: '工具', icon: <Wrench className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
];

const SEARCH_TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'providers', label: '网盘', icon: <Database className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  { id: 'rankings', label: '榜单', icon: <Flame className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
];

const GUIDE_TAB: { id: TabId; label: string; icon: React.ReactNode } = {
  id: 'guide',
  label: '指南',
  icon: <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.75} />,
};

/** 搜索入口关闭时仍保留一个明确的搜索入口 */
const SEARCH_ENTRY_TAB: { id: TabId; label: string; icon: React.ReactNode } = {
  id: 'search',
  label: '搜索',
  icon: <Search className="w-[18px] h-[18px]" strokeWidth={1.75} />,
};

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  hidden,
  searchEnabled = true,
}) => {
  if (hidden) return null;

  const tabs = searchEnabled
    ? [...BASE_TABS, ...SEARCH_TABS, GUIDE_TAB]
    : [SEARCH_ENTRY_TAB, BASE_TABS[1], GUIDE_TAB];

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-yunlan-hairline bg-yunlan-paper/95 backdrop-blur-md"
      aria-label="主导航"
    >
      <div className={`grid ${searchEnabled ? 'grid-cols-5' : 'grid-cols-3'} h-14 yl-safe-bottom`}>
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onNavigate(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 text-xs tracking-wide transition-colors ${
                active ? 'text-yunlan-cinnabar font-medium' : 'text-yunlan-muted'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
