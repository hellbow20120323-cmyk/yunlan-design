/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import { SearchExecuteOptions, SearchHistoryItem } from '../types';
import { RecentSearchSection } from './RecentSearchSection';
interface HeroSearchProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSearch: (q?: string, options?: SearchExecuteOptions) => void;
  loading: boolean;
  history: SearchHistoryItem[];
  onSelectHistory: (q: string) => void;
  onClearHistory: () => void;
  onRemoveHistoryItem: (id: string) => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

export const HeroSearch: React.FC<HeroSearchProps> = ({
  query,
  onQueryChange,
  onSearch,
  loading,
  history,
  onSelectHistory,
  onClearHistory,
  onRemoveHistoryItem,
  inputRef,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsFocused(false);
    onSearch();
  };

  return (
    <div className="w-full max-w-3xl mx-auto pt-10 pb-3 sm:pt-12 sm:pb-5">
      <div className="text-center mb-10 sm:mb-12">
        <p className="text-[10px] sm:text-[11px] font-sans font-normal tracking-[0.35em] text-yunlan-muted mb-5">
          云览 · YUNLAN
        </p>
        <h1
          className="font-yunlan-serif text-[1.65rem] sm:text-[2.1rem] lg:text-[2.35rem] font-medium tracking-[0.22em] text-yunlan-ink"
          style={{ textWrap: 'balance' }}
        >
          万象云盘，一览尽搜
        </h1>
        <p className="mt-5 text-xs sm:text-[13px] font-sans font-light text-yunlan-muted max-w-md mx-auto leading-[1.85] tracking-wide">
          收录海量文件索引 · 十大云盘协同 · 智能排重与有效性标注
        </p>
      </div>

      <div ref={containerRef} className="relative w-full mb-0">
        <form
          onSubmit={handleSubmit}
          className={`relative flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-5 px-1 pb-1 transition-colors duration-300 ${
            isFocused ? 'border-b-2 border-yunlan-cinnabar' : 'border-b border-yunlan-ink-wash'
          }`}
        >
          <div className="flex flex-1 items-center gap-3 min-w-0 py-2 sm:py-3">
            <Search
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                isFocused ? 'text-yunlan-cinnabar' : 'text-yunlan-muted'
              }`}
              strokeWidth={1.5}
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              placeholder="搜索剧集、考研学习、行业软件、无损音乐、游戏 MOD…"
              className="w-full text-sm sm:text-[15px] font-sans font-light text-yunlan-ink placeholder:text-[#b0ada8] bg-transparent focus:outline-none"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  onQueryChange('');
                  inputRef?.current?.focus();
                }}
                className="p-1 text-yunlan-muted hover:text-yunlan-ink transition-colors"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          <div className="flex w-full sm:w-auto gap-2 shrink-0">
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex-1 sm:flex-none px-8 py-2.5 sm:py-2 text-sm font-sans font-medium tracking-[0.2em] bg-yunlan-cta rounded-sm shadow-yunlan-feather hover:shadow-ink-wash active:scale-[0.99] transition-all disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  检索中
                </span>
              ) : (
                '搜索'
              )}
            </button>
            <button
              type="button"
              disabled={loading || !query.trim()}
              onClick={() => {
                setIsFocused(false);
                onSearch(undefined, { forceRefresh: true });
              }}
              className="inline-flex items-center justify-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-2 text-xs font-sans font-medium tracking-wide text-yunlan-stone border border-yunlan-hairline bg-yunlan-surface rounded-sm hover:border-yunlan-stone/40 hover:shadow-yunlan-feather transition-all disabled:opacity-50"
              title="跳过上游缓存，重新聚合各数据源（耗时更长，仍扣搜索积分）"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
              <span className="hidden sm:inline">强制刷新</span>
            </button>
          </div>
        </form>

        {isFocused && history.length > 0 ? (
          <RecentSearchSection
            className="mt-4"
            history={history}
            onPickKeyword={(keyword) => {
              onSelectHistory(keyword);
              setIsFocused(false);
            }}
            onClearHistory={onClearHistory}
            onRemoveHistoryItem={onRemoveHistoryItem}
          />
        ) : null}
      </div>
    </div>
  );
};
