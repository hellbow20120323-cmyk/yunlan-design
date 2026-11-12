/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Clock, History, Trash2, X } from 'lucide-react';
import type { SearchHistoryItem } from '../types';

interface RecentSearchSectionProps {
  history: SearchHistoryItem[];
  className?: string;
  onPickKeyword: (keyword: string) => void;
  onClearHistory: () => void;
  onRemoveHistoryItem: (id: string) => void;
}

/** 搜索框下方：最近搜索记录（图一） */
export const RecentSearchSection: React.FC<RecentSearchSectionProps> = ({
  history,
  className = '',
  onPickKeyword,
  onClearHistory,
  onRemoveHistoryItem,
}) => {
  if (history.length === 0) return null;

  return (
    <section className={`w-full ${className}`.trim()}>
      <div className="flex items-center gap-2 mb-2">
        <Clock className="w-4 h-4 text-[#b8956b]" />
        <h2 className="text-sm font-semibold text-[#4a4540]">最新搜索</h2>
      </div>
      <div className="p-3 rounded-2xl border border-yunlan-hairline bg-yunlan-surface/98 shadow-yunlan-feather">
        <div className="flex items-center justify-between text-xs text-yunlan-muted mb-2">
          <span className="flex items-center gap-1.5 font-medium">
            <History className="w-3.5 h-3.5" />
            最近搜索
          </span>
          <button
            type="button"
            onClick={onClearHistory}
            className="flex items-center gap-1 hover:text-red-500"
          >
            <Trash2 className="w-3 h-3" />
            清空
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {history.slice(0, 12).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-1 px-2.5 min-h-9 py-1 text-xs rounded-lg bg-[#f3f0ea] text-[#5c564e]"
            >
              <button type="button" onClick={() => onPickKeyword(item.query)} className="hover:text-yunlan-stone">
                {item.query}
              </button>
              <button
                type="button"
                onClick={() => onRemoveHistoryItem(item.id)}
                className="text-slate-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
