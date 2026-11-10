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

export const TrendPosterCard: React.FC<{
  item: TrendingHotItem;
  onPick: (keyword: string) => void;
  showKindTag?: boolean;
  compact?: boolean;
  posterOnly?: boolean;
}> = ({ item, onPick, showKindTag, compact, posterOnly }) => {
  const sub = englishSubtitle(item.title, item.keyword);
  const tag = kindLabel(item.kind);

  return (
    <button
      type="button"
      onClick={() => onPick(item.keyword)}
      className="group flex w-full flex-col text-left px-1 focus:outline-none focus-visible:ring-1 focus-visible:ring-yunlan-stone/40 rounded-sm"
    >
      <div
        className={`relative overflow-hidden bg-yunlan-mist aspect-[27/40] rounded-[2px] shadow-yunlan-card transition-shadow duration-500 ease-out group-hover:shadow-ink-wash ${
          compact ? '' : ''
        }`}
      >
        <img
          src={item.imageUrl}
          alt={item.keyword}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 h-full w-full object-cover object-top"
        />
        {showKindTag && tag && (
          <span className="absolute top-1 left-1 px-1 py-px text-[8px] font-sans tracking-wide bg-yunlan-paper/90 text-yunlan-muted">
            {tag}
          </span>
        )}
      </div>
      {!posterOnly && !compact && (
        <>
          <p className="mt-3 text-[11px] font-sans font-normal tracking-wide text-yunlan-ink line-clamp-2 group-hover:text-yunlan-stone transition-colors">
            {item.keyword}
          </p>
          {sub ? (
            <p className="text-[10px] font-sans font-light text-yunlan-muted line-clamp-1 mt-0.5">{sub}</p>
          ) : null}
        </>
      )}
      {!posterOnly && compact && (
        <p className="mt-2.5 w-full text-[10px] leading-snug font-sans font-light text-yunlan-muted line-clamp-2 text-center group-hover:text-yunlan-ink transition-colors">
          {item.keyword}
        </p>
      )}
    </button>
  );
};
