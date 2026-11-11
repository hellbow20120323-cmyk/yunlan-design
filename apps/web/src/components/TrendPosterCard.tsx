/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { TrendingHotItem, TrendingKind } from '../types/trending';

function kindLabel(kind?: TrendingKind): string | null {
  if (kind === 'movie') return '电影';
  if (kind === 'tv') return '剧集';
  if (kind === 'latest') return '新上';
  return null;
}

function englishSubtitle(title: string, keyword: string): string {
  const t = title.trim();
  const k = keyword.trim();
  if (!t || t === k) return '';
  const idx = t.indexOf(k);
  if (idx === 0) {
    const rest = t.slice(k.length).trim();
    return rest.replace(/^[：:\s-]+/, '');
  }
  const latin = t.match(/\s+([A-Za-z].*)$/);
  return latin ? latin[1].trim() : '';
}

function activatePoster(event: React.KeyboardEvent, onPick: (keyword: string) => void, keyword: string) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    onPick(keyword);
  }
}

export const TrendPosterCard: React.FC<{
  item: TrendingHotItem;
  onPick: (keyword: string) => void;
  showKindTag?: boolean;
  compact?: boolean;
  posterOnly?: boolean;
  /** 热门精选单行用较宽卡片，避免片名被 WebKit 收成两三字一行 */
  compactSize?: 'spotlight' | 'dense';
}> = ({ item, onPick, showKindTag, compact, posterOnly, compactSize = 'dense' }) => {
  const sub = englishSubtitle(item.title, item.keyword);
  const tag = kindLabel(item.kind);

  const poster = (
    <div className="relative overflow-hidden bg-yunlan-mist aspect-[27/40] w-full rounded-[2px] shadow-yunlan-card transition-shadow duration-500 ease-out group-hover:shadow-ink-wash">
      <img
        src={item.imageUrl}
        alt={item.keyword}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 h-full w-full object-cover object-top"
      />
      {showKindTag && tag && (
        <span className="absolute top-1 left-1 px-1 py-px text-[10px] font-sans tracking-wide bg-yunlan-paper/90 text-yunlan-muted">
          {tag}
        </span>
      )}
    </div>
  );

  if (compact) {
    const tileClass =
      compactSize === 'spotlight' ? 'yl-poster-tile yl-poster-tile--spotlight' : 'yl-poster-tile yl-poster-tile--dense';
    return (
      <div
        role="button"
        tabIndex={0}
        title={item.keyword}
        className={`group ${tileClass} focus:outline-none focus-visible:ring-1 focus-visible:ring-yunlan-stone/40 rounded-sm`}
        onClick={() => onPick(item.keyword)}
        onKeyDown={(event) => activatePoster(event, onPick, item.keyword)}
      >
        {poster}
        {!posterOnly && <span className="yl-poster-caption">{item.keyword}</span>}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onPick(item.keyword)}
      title={item.keyword}
      className="group flex w-full flex-col text-left px-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-yunlan-stone/40 rounded-sm"
    >
      {poster}
      {!posterOnly && (
        <>
          <p className="mt-2.5 text-[13px] leading-snug font-sans font-medium text-yunlan-ink line-clamp-2 group-hover:text-yunlan-stone transition-colors">
            {item.keyword}
          </p>
          {sub ? (
            <p className="text-xs font-sans text-yunlan-muted line-clamp-1 mt-1">{sub}</p>
          ) : null}
        </>
      )}
    </button>
  );
};
