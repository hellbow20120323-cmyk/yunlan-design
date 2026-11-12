/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, X, RefreshCw } from 'lucide-react';
import { SearchExecuteOptions, SearchHistoryItem } from '../types';
import { RecentSearchSection } from './RecentSearchSection';
import { SearchSuggestList } from './SearchSuggestList';
import { useSearchSuggest } from '../hooks/useSearchSuggest';

const SUGGEST_LIST_ID = 'yunlan-search-suggest';

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
  compact?: boolean;
  suggestKeywords?: string[];
  /** 搜索入口开关关闭时，首页改为工具站定位 */
  searchEnabled?: boolean;
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
  compact = false,
  suggestKeywords = [],
  searchEnabled = true,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [composing, setComposing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyQueries = useMemo(() => history.map((item) => item.query), [history]);
  const suggestions = useSearchSuggest(
    query,
    suggestKeywords,
    historyQueries,
    isFocused && !composing && searchEnabled
  );

  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  useEffect(() => {
    setActiveIndex(-1);
  }, [query]);

  const pickSuggestion = (text: string, searchNow: boolean) => {
    onQueryChange(text);
    setIsFocused(false);
    setActiveIndex(-1);
    if (searchNow) onSearch(text);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFocused && activeIndex >= 0 && suggestions[activeIndex]) {
      pickSuggestion(suggestions[activeIndex].text, false);
      return;
    }
    setIsFocused(false);
    onSearch();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isFocused || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? suggestions.length - 1 : prev - 1));
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsFocused(false);
      setActiveIndex(-1);
    } else if (e.key === 'Tab' && suggestions[0] && activeIndex < 0) {
      e.preventDefault();
      onQueryChange(suggestions[0].text);
    }
  };

  return (
    <div className={`w-full max-w-3xl mx-auto ${compact ? 'pt-3 pb-2 md:pt-10 md:pb-5' : 'pt-8 pb-3 sm:pt-12 sm:pb-5'}`}>
      <div className={`${compact ? 'hidden md:block' : ''} text-center mb-6 sm:mb-9`}>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF0E4] border border-[#E8DEC8] text-[#8C4115] text-[11px] font-bold tracking-wide mb-4 sm:mb-5">
          <span>🚴 VELO &amp; BREW 🍺</span>
          <span className="text-[#DC9B6B]">·</span>
          <span>骑行物理与精酿工坊</span>
        </div>
        <h1
          className="text-[1.7rem] sm:text-[2.2rem] lg:text-[2.5rem] font-black tracking-tight text-yunlan-ink"
          style={{ textWrap: 'balance' }}
        >
          自行车与家酿
        </h1>
        <p className="mt-3 sm:mt-5 text-[13px] sm:text-sm font-sans text-yunlan-muted max-w-xl mx-auto leading-[1.85] tracking-wide px-2">
          {searchEnabled
            ? '骑行工程、精酿配方与实用工具，以及公开资料检索；全部浏览器本地运行，数据不上传'
            : '骑行工程、精酿配方与实用工具，全部在浏览器本地运行，数据不上传'}
        </p>
      </div>

      <div ref={containerRef} className="relative z-20 w-full mb-0">
        <form
          onSubmit={handleSubmit}
          className={`relative flex flex-col sm:flex-row sm:items-center gap-2 rounded-2xl border p-1.5 transition-all duration-200 ${
            isFocused
              ? 'border-[#C86D28] ring-2 ring-[#C86D28]/20 shadow-ink-wash'
              : 'border-[#E8DEC8] hover:border-[#DC9B6B] shadow-yunlan-card'
          } bg-yunlan-surface`}
        >
          <div className="flex flex-1 items-center gap-2.5 min-w-0 px-2.5">
            <Search
              className={`w-[18px] h-[18px] shrink-0 transition-colors ${
                isFocused ? 'text-[#C86D28]' : 'text-yunlan-muted'
              }`}
              strokeWidth={1.8}
            />
            <input
              ref={inputRef}
              type="text"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isFocused && suggestions.length > 0}
              aria-controls={SUGGEST_LIST_ID}
              aria-activedescendant={
                activeIndex >= 0 ? `${SUGGEST_LIST_ID}-opt-${activeIndex}` : undefined
              }
              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onClick={() => setIsFocused(true)}
              onKeyDown={handleKeyDown}
              onCompositionStart={() => setComposing(true)}
              onCompositionEnd={(e) => {
                setComposing(false);
                onQueryChange(e.currentTarget.value);
              }}
              placeholder={searchEnabled ? '搜索剧集、资料、软件、音乐…' : '检索公开文档与资料…'}
              className="w-full text-sm sm:text-[15px] font-sans text-yunlan-ink placeholder:text-[#A8A29E] bg-transparent focus:outline-none min-h-10"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  onQueryChange('');
                  inputRef?.current?.focus();
                }}
                className="p-2 text-yunlan-muted hover:text-yunlan-ink transition-colors min-h-11 min-w-11 flex items-center justify-center"
                aria-label="清空搜索词"
              >
                <X className="w-4 h-4" strokeWidth={1.5} />
              </button>
            )}
          </div>

          <div className="flex w-full sm:w-auto gap-2 shrink-0">
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="flex-1 sm:flex-none min-h-10 px-6 sm:px-7 py-2 text-sm font-bold tracking-wide bg-[#C86D28] hover:bg-[#AF571B] text-white rounded-xl shadow-yunlan-feather hover:shadow-ink-wash active:scale-[0.99] transition-all disabled:opacity-50"
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
            {searchEnabled && (
              <button
                type="button"
                disabled={loading || !query.trim()}
                onClick={() => {
                  setIsFocused(false);
                  onSearch(undefined, { forceRefresh: true });
                }}
                className="inline-flex items-center justify-center gap-1.5 min-h-10 min-w-11 px-3 sm:px-4 py-2 text-xs font-sans font-medium tracking-wide text-[#8C4115] border border-yunlan-hairline bg-yunlan-surface rounded-xl hover:border-[#DC9B6B] hover:bg-[#FAF0E4] transition-all disabled:opacity-50"
                title="跳过上游缓存，重新聚合各数据源（耗时更长，仍扣搜索积分）"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} strokeWidth={1.75} />
                <span className="sm:inline">刷新</span>
              </button>
            )}
          </div>
        </form>

        {isFocused && query.trim() && suggestions.length > 0 ? (
          <SearchSuggestList
            items={suggestions}
            query={query}
            activeIndex={activeIndex}
            listId={SUGGEST_LIST_ID}
            onHover={setActiveIndex}
            onPick={(text) => pickSuggestion(text, false)}
          />
        ) : null}

        {isFocused && !query.trim() && history.length > 0 ? (
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
