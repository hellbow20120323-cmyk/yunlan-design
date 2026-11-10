/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { DiskProviderId } from '../types';
import { DISK_PROVIDERS, SEARCH_PROVIDER_IDS } from '../constants/providers';

interface SearchRefinePanelProps {
  selectedProviders: DiskProviderId[];
  onToggleProvider: (id: DiskProviderId) => void;
  providersCount?: Record<DiskProviderId, number>;
  minSizeMb: number;
  maxSizeGb: number | null;
  minUnit: 'MB' | 'GB';
  maxUnit: 'MB' | 'GB';
  onMinSizeChange: (value: number, unit: 'MB' | 'GB') => void;
  onMaxSizeChange: (value: number | null, unit: 'MB' | 'GB') => void;
}

function ProviderMark({ id }: { id: DiskProviderId }) {
  const p = DISK_PROVIDERS[id];
  return (
    <span
      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold text-white shrink-0"
      style={{ backgroundColor: p.color }}
      aria-hidden
    >
      {p.shortName.slice(0, 1)}
    </span>
  );
}

export const SearchRefinePanel: React.FC<SearchRefinePanelProps> = ({
  selectedProviders,
  onToggleProvider,
  providersCount,
  minSizeMb,
  maxSizeGb,
  minUnit,
  maxUnit,
  onMinSizeChange,
  onMaxSizeChange,
}) => {
  const [open, setOpen] = useState(false);
  const minDisplay =
    minUnit === 'GB' ? (minSizeMb / 1024).toFixed(minSizeMb % 1024 === 0 ? 0 : 1) : String(minSizeMb);
  const maxDisplay =
    maxSizeGb === null
      ? '∞'
      : maxUnit === 'GB'
        ? String(maxSizeGb)
        : String(Math.round(maxSizeGb * 1024));
  const selectedCount = selectedProviders.length;
  const sizeHint =
    minSizeMb <= 0 && maxSizeGb === null
      ? '大小不限'
      : `${minDisplay}${minUnit} ~ ${maxDisplay}${maxDisplay === '∞' ? '' : maxUnit}`;

  return (
    <div className="rounded-2xl border border-yunlan-hairline bg-[#fffcf8] p-3 sm:p-5 space-y-4 shadow-yunlan-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden w-full flex items-center justify-between min-h-11 px-1 text-left"
      >
        <span className="text-[13px] font-medium text-[#4a4540]">
          来源与大小
          <span className="ml-2 font-normal text-yunlan-muted">
            {selectedCount} 个网盘 · {sizeHint}
          </span>
        </span>
        <ChevronDown className={`w-4 h-4 text-yunlan-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`${open ? 'block' : 'hidden'} md:block space-y-4`}>
      <div>
        <p className="text-xs font-semibold tracking-wide text-[#8a8278] mb-2.5">来源类型</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
          {SEARCH_PROVIDER_IDS.map((id) => {
            const provider = DISK_PROVIDERS[id];
            const selected = selectedProviders.includes(id);
            const count = providersCount?.[id];
            return (
              <button
                key={id}
                type="button"
                onClick={() => onToggleProvider(id)}
                className={`flex items-center gap-2 px-3 min-h-11 py-2 rounded-xl text-xs font-medium border transition-all ${
                  selected
                    ? 'border-[#d4c4a8] bg-[#f3f0ea] text-[#4a4540]'
                    : 'border-yunlan-hairline bg-[#faf8f5] text-yunlan-muted hover:border-[#d8cbb8] hover:text-[#5c564e]'
                }`}
              >
                <ProviderMark id={id} />
                <span className="truncate">{provider.shortName}</span>
                {count !== undefined && count > 0 && (
                  <span className="ml-auto text-[10px] tabular-nums text-[#9a7b4f]">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-semibold tracking-wide text-[#8a8278] mb-2.5">大小</p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-[#5c564e]">
          <div className="flex items-center rounded-xl border border-yunlan-hairline bg-[#faf8f5] overflow-hidden">
            <input
              type="number"
              min={0}
              step={minUnit === 'GB' ? 0.1 : 1}
              value={minDisplay === '0' ? 0 : minDisplay}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (!Number.isFinite(n) || n < 0) return;
                const mb = minUnit === 'GB' ? Math.round(n * 1024) : Math.round(n);
                onMinSizeChange(mb, minUnit);
              }}
              className="w-16 sm:w-20 bg-transparent px-2 py-2 text-right focus:outline-none tabular-nums"
            />
            <select
              value={minUnit}
              onChange={(e) => onMinSizeChange(minSizeMb, e.target.value as 'MB' | 'GB')}
              className="bg-[#f3f0ea] border-l border-yunlan-hairline px-1.5 py-2 text-yunlan-muted focus:outline-none cursor-pointer"
            >
              <option value="MB">MB</option>
              <option value="GB">GB</option>
            </select>
          </div>
          <span className="text-yunlan-muted">~</span>
          <div className="flex items-center rounded-xl border border-yunlan-hairline bg-[#faf8f5] overflow-hidden">
            <input
              type="text"
              inputMode="decimal"
              value={maxDisplay}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (v === '∞' || v === '') {
                  onMaxSizeChange(null, maxUnit);
                  return;
                }
                const n = Number(v);
                if (!Number.isFinite(n) || n < 0) return;
                onMaxSizeChange(maxUnit === 'GB' ? n : n / 1024, maxUnit);
              }}
              className="w-16 sm:w-20 bg-transparent px-2 py-2 text-right focus:outline-none tabular-nums"
              placeholder="∞"
            />
            <select
              value={maxUnit}
              onChange={(e) =>
                onMaxSizeChange(maxSizeGb, e.target.value as 'MB' | 'GB')
              }
              className="bg-[#f3f0ea] border-l border-yunlan-hairline px-1.5 py-2 text-yunlan-muted focus:outline-none cursor-pointer"
            >
              <option value="MB">MB</option>
              <option value="GB">GB</option>
            </select>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};
