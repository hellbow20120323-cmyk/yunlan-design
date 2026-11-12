/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ResourceCategory, SortOption, TimeRangeOption } from '../types';
import { CATEGORIES } from '../constants/providers';
import { 
  ArrowDownUp, 
  CheckCircle2, 
  Clock, 
  LayoutGrid, 
  List, 
  Film, 
  BookOpen, 
  Cpu, 
  Music, 
  Gamepad2, 
  Archive, 
  Layers, 
  Folder 
} from 'lucide-react';

interface FilterBarProps {
  currentCategory: ResourceCategory;
  onSelectCategory: (cat: ResourceCategory) => void;
  categoriesCount?: Record<ResourceCategory, number>;
  currentSort: SortOption;
  onSelectSort: (sort: SortOption) => void;
  currentTimeRange: TimeRangeOption;
  onSelectTimeRange: (time: TimeRangeOption) => void;
  onlyValid: boolean;
  onToggleOnlyValid: (valid: boolean) => void;
  viewMode: 'cards' | 'list';
  onChangeViewMode: (mode: 'cards' | 'list') => void;
  totalResults: number;
  tookMs: number;
  modeLabel?: string;
  demoMode?: boolean;
  hideViewSwitcher?: boolean;
  /** 搜索入口关闭时隐藏影视类目，站点只保留资料/软件等合规分类 */
  searchEnabled?: boolean;
}

const getCategoryIcon = (iconName: string) => {
  switch (iconName) {
    case 'Film': return <Film className="w-3.5 h-3.5" />;
    case 'BookOpen': return <BookOpen className="w-3.5 h-3.5" />;
    case 'Cpu': return <Cpu className="w-3.5 h-3.5" />;
    case 'Music': return <Music className="w-3.5 h-3.5" />;
    case 'Gamepad2': return <Gamepad2 className="w-3.5 h-3.5" />;
    case 'Archive': return <Archive className="w-3.5 h-3.5" />;
    case 'Folder': return <Folder className="w-3.5 h-3.5" />;
    default: return <Layers className="w-3.5 h-3.5" />;
  }
};

export const FilterBar: React.FC<FilterBarProps> = ({
  currentCategory,
  onSelectCategory,
  categoriesCount,
  currentSort,
  onSelectSort,
  currentTimeRange,
  onSelectTimeRange,
  onlyValid,
  onToggleOnlyValid,
  viewMode,
  onChangeViewMode,
  totalResults,
  tookMs,
  modeLabel,
  demoMode,
  hideViewSwitcher,
  searchEnabled = true,
}) => {
  const categories = searchEnabled
    ? CATEGORIES
    : CATEGORIES.filter((cat) => cat.id !== 'video');

  return (
    <div className="w-full space-y-3 mb-4 sm:mb-6">
      {/* Category Tabs (Segmented control row) */}
      <div className="flex items-center gap-1.5 p-1 bg-[#f3f0ea]/80 border border-yunlan-hairline rounded-xl overflow-x-auto no-scrollbar snap-x snap-mandatory">
        {categories.map((cat) => {
          const isActive = currentCategory === cat.id;
          const count = categoriesCount ? categoriesCount[cat.id] : undefined;

          return (
            <button
              key={cat.id}
              onClick={() => onSelectCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 min-h-11 py-2 text-xs font-medium rounded-lg whitespace-nowrap shrink-0 snap-start transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#fffcf8] text-[#9a7b4f] font-semibold shadow-sm border border-[#e5dccf]/80'
                  : 'text-yunlan-muted hover:text-[#4a4540]'
              }`}
            >
              {getCategoryIcon(cat.icon)}
              <span>{cat.label}</span>
              {count !== undefined && count > 0 && (
                <span className={`text-[11px] tabular-nums px-1.5 py-0.2 rounded-full ${
                  isActive 
                    ? 'bg-[#f3f0ea] text-[#9a7b4f]' 
                    : 'bg-[#ebe6de] text-yunlan-muted'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Secondary Controls Bar: Metrics + Sort + Valid Toggle + View Switcher */}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2.5 sm:gap-3 text-xs">
        
        {/* Left: Result Count & Timing (Strictly unboxed text metadata) */}
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 flex-wrap">
          <span>共 <strong className="font-semibold tabular-nums text-slate-900 dark:text-white">{totalResults}</strong> 个</span>
          <span className="hidden sm:inline" aria-hidden="true">·</span>
          <span className="hidden sm:inline tabular-nums">耗时 {tookMs}ms</span>
          {modeLabel ? (
            <span
              className={`truncate max-w-[70vw] sm:max-w-none ${
                demoMode
                  ? 'text-amber-600 dark:text-amber-400 font-medium'
                  : 'text-emerald-600 dark:text-emerald-400 font-medium'
              }`}
            >
              {modeLabel}
            </span>
          ) : (
            <span className="hidden sm:inline text-emerald-600 dark:text-emerald-400 font-medium">智能排重过滤已开启</span>
          )}
        </div>

        {/* Right: Controls Strip */}
        <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto overflow-x-auto no-scrollbar pb-0.5">
          
          {/* Validity Toggle */}
          <button
            onClick={() => onToggleOnlyValid(!onlyValid)}
            className={`flex items-center gap-1.5 px-2.5 min-h-10 py-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
              onlyValid
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>仅有效链接</span>
          </button>

          {/* Time Range Filter */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 min-h-10 py-1 shrink-0">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={currentTimeRange}
              onChange={(e) => onSelectTimeRange(e.target.value as TimeRangeOption)}
              className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="all" className="dark:bg-slate-900">全部收录时间</option>
              <option value="day" className="dark:bg-slate-900">24小时内更新</option>
              <option value="week" className="dark:bg-slate-900">最近7天</option>
              <option value="month" className="dark:bg-slate-900">最近1个月</option>
              <option value="year" className="dark:bg-slate-900">1年内</option>
            </select>
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 min-h-10 py-1 shrink-0">
            <ArrowDownUp className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={currentSort}
              onChange={(e) => onSelectSort(e.target.value as SortOption)}
              className="bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer pr-1"
            >
              <option value="relevance" className="dark:bg-slate-900">综合匹配度</option>
              <option value="date_desc" className="dark:bg-slate-900">最新收录优先</option>
              <option value="size_desc" className="dark:bg-slate-900">文件从大到小</option>
              <option value="size_asc" className="dark:bg-slate-900">文件从小到大</option>
              <option value="hot_desc" className="dark:bg-slate-900">保存热度最高</option>
            </select>
          </div>

          {!hideViewSwitcher && (
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-200/80 dark:bg-slate-800 rounded-lg border border-slate-300/40 dark:border-slate-700/60">
              <button
                onClick={() => onChangeViewMode('cards')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'cards' 
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="卡片精美视图"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onChangeViewMode('list')}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' 
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
                title="紧凑列表视图"
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
