/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import type { SearchSuggestItem } from '../hooks/useSearchSuggest';

function HighlightQuery({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const idx = text.toLocaleLowerCase().indexOf(q.toLocaleLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="text-yunlan-cinnabar">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

interface SearchSuggestListProps {
  items: SearchSuggestItem[];
  query: string;
  activeIndex: number;
  listId: string;
  onHover: (index: number) => void;
  onPick: (text: string) => void;
}

export const SearchSuggestList: React.FC<SearchSuggestListProps> = ({
  items,
  query,
  activeIndex,
  listId,
  onHover,
  onPick,
}) => {
  if (items.length === 0) return null;

  return (
    <ul
      id={listId}
      role="listbox"
      className="absolute left-0 right-0 z-50 mt-2 max-h-[min(20rem,50vh)] overflow-y-auto rounded-[2px] border border-yunlan-hairline bg-yunlan-surface shadow-yunlan-feather"
    >
      {items.map((item, index) => (
        <li key={`${item.source}-${item.text}`} role="presentation">
          <button
            type="button"
            id={`${listId}-opt-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            className={`flex w-full min-h-11 items-center px-3 text-left text-[13px] font-sans ${
              index === activeIndex ? 'bg-[#f3f0ea] text-yunlan-ink' : 'text-slate-600'
            }`}
            onMouseEnter={() => onHover(index)}
            onMouseDown={(event) => {
              event.preventDefault();
              onPick(item.text);
            }}
          >
            <HighlightQuery text={item.text} query={query} />
          </button>
        </li>
      ))}
    </ul>
  );
};
