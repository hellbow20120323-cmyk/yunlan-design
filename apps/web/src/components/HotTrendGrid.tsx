/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import type { TrendingHotItem } from '../types/trending';
import { TrendPosterCard } from './TrendPosterCard';

type TabId = 'all' | 'movie' | 'tv';

interface HotTrendGridProps {
  items: TrendingHotItem[];
  movies?: TrendingHotItem[];
  tv?: TrendingHotItem[];
  loading?: boolean;
  maxItems?: number;
  title?: string;
  className?: string;
  dense?: boolean;
  /** 搜索框下预览：固定 10 张、单行展示 */
  singleRow?: boolean;
  /** 仅展示电影或剧集海报，隐藏分类切换 */
  fixedKind?: 'movie' | 'tv';
  /** 单行预览：只显示海报、不显示片名 */
  posterOnly?: boolean;
  /** 双栏布局中的单列，无外层 max-width */
  embedded?: boolean;
  onPickKeyword: (keyword: string) => void;
}

export const HotTrendGrid: React.FC<HotTrendGridProps> = ({
  items,
  movies = [],
  tv = [],
  loading,
  maxItems = 16,
  title = '热门影视',
  className = '',
  dense = false,
  singleRow = false,
  fixedKind,
  posterOnly = false,
  embedded = false,
  onPickKeyword,
}) => {
  const [tab, setTab] = useState<TabId>(fixedKind ?? 'all');

  const displayItems = useMemo(() => {
    let list: TrendingHotItem[];
    if (singleRow) return items.slice(0, maxItems);
    const active = fixedKind ?? tab;
    if (active === 'movie') list = movies.length ? movies : items.filter((i) => i.kind === 'movie');
    else if (active === 'tv') list = tv.length ? tv : items.filter((i) => i.kind === 'tv');
    else list = items;
    return list.slice(0, maxItems);
  }, [tab, fixedKind, items, movies, tv, maxItems, singleRow]);

  const hasContent =
    items.length > 0 ||
    (fixedKind === 'movie' && movies.length > 0) ||
    (fixedKind === 'tv' && tv.length > 0) ||
    movies.length > 0 ||
    tv.length > 0;

  if (!embedded && !loading && !hasContent) return null;
  if (!loading && singleRow && items.length === 0) return null;
  if (embedded && !loading && fixedKind === 'movie' && !movies.length) return null;
  if (embedded && !loading && fixedKind === 'tv' && !tv.length) return null;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'all', label: '全部' },
    { id: 'movie', label: '电影' },
    { id: 'tv', label: '剧集' },
  ];

  const tabLabels = dense
    ? ([
        { id: 'movie' as TabId, label: '电影' },
        { id: 'tv' as TabId, label: '剧集' },
      ] as const)
    : tabs;

  const Root = embedded ? 'div' : 'section';
  const cards = loading
    ? Array.from({ length: singleRow ? 10 : dense ? (embedded ? 12 : 20) : 12 }).map((_, i) => (
        <div
          key={i}
          className={`aspect-[27/40] yl-skeleton shrink-0 rounded-[2px] ${
            singleRow ? 'yl-poster-tile--spotlight' : dense ? 'yl-poster-tile--dense' : ''
          }`}
        />
      ))
    : displayItems.map((item) => (
        <div key={`${tab}-${item.id}`} className={singleRow ? 'snap-start' : undefined}>
          <TrendPosterCard
            item={item}
            onPick={onPickKeyword}
            showKindTag={!dense && !singleRow && tab === 'all'}
            compact={dense || singleRow}
            compactSize={singleRow ? 'spotlight' : 'dense'}
            posterOnly={posterOnly}
          />
        </div>
      ));

  return (
    <Root
      className={
        embedded
          ? `min-w-0 w-full ${className}`
          : `w-full mx-auto ${singleRow ? 'max-w-7xl' : dense ? 'max-w-[1100px]' : 'max-w-6xl'} ${className}`
      }
    >
      <div
        className={
          dense && embedded
            ? 'text-center mb-2'
            : dense
            ? 'text-center mb-3'
            : singleRow
              ? 'mb-4 sm:mb-5'
              : 'flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-5'
        }
      >
        {dense ? (
          <h2
            className={`font-semibold tracking-wide text-[#4a4540] ${
              embedded ? 'text-sm sm:text-base' : 'text-lg sm:text-xl'
            }`}
          >
            {title}
          </h2>
        ) : (
          <h2
            className={`font-yunlan-serif font-medium tracking-[0.16em] text-yunlan-ink ${
              singleRow ? 'text-sm text-slate-600' : 'text-base'
            }`}
          >
            {title}
          </h2>
        )}
        {!singleRow && !fixedKind && (
        <div className={`text-sm ${dense ? 'mt-1' : ''}`}>
          {(dense ? tabLabels : tabs).map((t, idx) => (
            <span key={t.id}>
              {idx > 0 && <span className="text-slate-400 mx-1.5">·</span>}
              <button
                type="button"
                onClick={() => setTab(t.id)}
                className={
                  tab === t.id
                    ? 'text-yunlan-stone font-medium'
                    : 'text-yunlan-muted hover:text-yunlan-ink'
                }
              >
                {t.label}
              </button>
            </span>
          ))}
          {dense && (
            <>
              <span className="text-slate-400 mx-1.5">·</span>
              <button
                type="button"
                onClick={() => setTab('all')}
                className={
                  tab === 'all'
                    ? 'text-yunlan-stone font-medium'
                    : 'text-yunlan-muted hover:text-yunlan-ink'
                }
              >
                全部
              </button>
            </>
          )}
        </div>
        )}
      </div>

      {singleRow ? (
        <div className="overflow-x-auto no-scrollbar">
          <div className="flex w-max flex-nowrap items-start justify-start gap-5 sm:gap-6 px-2 pt-1 pb-2 snap-x snap-mandatory scroll-smooth">
            {cards}
          </div>
        </div>
      ) : (
        <div
          className={
            dense
              ? 'flex flex-wrap justify-center gap-3 sm:gap-3.5'
              : 'grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4'
          }
        >
          {cards}
        </div>
      )}
    </Root>
  );
};
