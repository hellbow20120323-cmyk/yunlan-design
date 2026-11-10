/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Flame } from 'lucide-react';
import type { TrendingHotListItem } from '../types/trending';

interface TrendingHotListProps {
  items: TrendingHotListItem[];
  loading?: boolean;
  className?: string;
  maxItems?: number;
  onPickKeyword: (keyword: string) => void;
}

export const TrendingHotList: React.FC<TrendingHotListProps> = ({
  items,
  loading,
  className = '',
  maxItems,
  onPickKeyword,
}) => {
  const visible = maxItems ? items.slice(0, maxItems) : items;
  if (!loading && visible.length === 0) return null;

  return (
    <section className={`w-full max-w-7xl mx-auto ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <Flame className="w-4 h-4 text-orange-500" />
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">热门影视</h2>
      </div>

      <div className="space-y-2">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="flex gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 animate-pulse"
              >
                <div className="w-[76px] sm:w-[92px] shrink-0 aspect-[2/3] bg-slate-200 dark:bg-slate-800 rounded-lg" />
                <div className="flex-1 space-y-2 py-1">
                  <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded w-1/3" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-full" />
                  <div className="h-3 bg-slate-200 dark:bg-slate-800 rounded w-2/3" />
                </div>
              </div>
            ))
          : visible.map((work) => (
              <article
                key={work.id}
                className="flex items-start gap-3 overflow-hidden rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onPickKeyword(work.keyword)}
                  className="shrink-0 w-[76px] sm:w-[92px] rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  <div className="relative w-full aspect-[2/3]">
                    <img
                      src={work.imageUrl}
                      alt={work.title}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                </button>

                <div className="flex-1 min-w-0 py-2 pr-2 sm:pr-3">
                  <button
                    type="button"
                    onClick={() => onPickKeyword(work.keyword)}
                    className="text-left w-full group"
                  >
                    <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 line-clamp-1">
                      {work.title}
                    </h3>
                  </button>

                  <ul className="mt-1.5 space-y-1.5">
                    {work.releases.map((rel, idx) => (
                      <li key={idx} className="text-xs">
                        <div className="flex flex-wrap items-center gap-1 mb-0.5">
                          {rel.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-[10px] font-medium text-slate-600 dark:text-slate-300"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                        <div className="flex gap-2 items-start justify-between text-slate-600 dark:text-slate-400">
                          <button
                            type="button"
                            onClick={() => onPickKeyword(work.keyword)}
                            className="text-left flex-1 min-w-0 line-clamp-2 hover:text-cyan-600 dark:hover:text-cyan-400"
                          >
                            {rel.releaseTitle}
                          </button>
                          {rel.uploader ? (
                            <span className="shrink-0 text-[10px] text-slate-400 dark:text-slate-500 max-w-[72px] truncate">
                              {rel.uploader}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
      </div>
    </section>
  );
};
