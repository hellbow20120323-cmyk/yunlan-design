/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BookOpen, Compass, Database, Flame } from 'lucide-react';

type TabId = 'search' | 'providers' | 'rankings' | 'guide';

interface MobileBottomNavProps {
  activeTab: TabId;
  onNavigate: (tab: TabId) => void;
  hidden?: boolean;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'search', label: '发现', icon: <Compass className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  { id: 'providers', label: '网盘', icon: <Database className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  { id: 'rankings', label: '榜单', icon: <Flame className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
  { id: 'guide', label: '指南', icon: <BookOpen className="w-[18px] h-[18px]" strokeWidth={1.75} /> },
];

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onNavigate,
  hidden,
}) => {
  if (hidden) return null;

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-yunlan-hairline bg-yunlan-paper/95 backdrop-blur-md"
      aria-label="主导航"
    >
      <div className="grid grid-cols-4 h-14 yl-safe-bottom">
        {TABS.map((tab) => {
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
