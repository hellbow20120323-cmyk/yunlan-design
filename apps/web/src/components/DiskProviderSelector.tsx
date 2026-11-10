/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { DiskProviderId } from '../types';
import { DISK_PROVIDERS, ALL_PROVIDER_IDS } from '../constants/providers';
import { Check, CheckSquare, RefreshCw } from 'lucide-react';

interface DiskProviderSelectorProps {
  selectedProviders: DiskProviderId[];
  onToggleProvider: (id: DiskProviderId) => void;
  onSelectAll: () => void;
  onInvert: () => void;
  providersCount?: Record<DiskProviderId, number>;
}

export const DiskProviderSelector: React.FC<DiskProviderSelectorProps> = ({
  selectedProviders,
  onToggleProvider,
  onSelectAll,
  onInvert,
  providersCount,
}) => {
  const isAllSelected = selectedProviders.length === ALL_PROVIDER_IDS.length;

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
          <span>聚合网盘源 ({selectedProviders.length}/{ALL_PROVIDER_IDS.length})</span>
          <span aria-hidden="true">·</span>
          <span>跨平台实时联合检索</span>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={onSelectAll}
            className={`flex items-center gap-1 transition-colors ${
              isAllSelected 
                ? 'text-cyan-600 dark:text-cyan-400 font-medium' 
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>全选</span>
          </button>

          <button
            onClick={onInvert}
            className="flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>反选</span>
          </button>
        </div>
      </div>

      {/* Provider Toggles Grid / Flex */}
      <div className="flex flex-wrap items-center gap-2">
        {ALL_PROVIDER_IDS.map((id) => {
          const provider = DISK_PROVIDERS[id];
          const isSelected = selectedProviders.includes(id);
          const count = providersCount ? providersCount[id] : undefined;

          return (
            <button
              key={id}
              onClick={() => onToggleProvider(id)}
              className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-150 border cursor-pointer select-none ${
                isSelected
                  ? 'bg-slate-900 dark:bg-slate-800/90 text-white border-slate-700 shadow-sm'
                  : 'bg-white/60 dark:bg-slate-900/40 text-slate-600 dark:text-slate-400 border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 opacity-60 hover:opacity-100'
              }`}
            >
              {/* Colored brand indicator dot */}
              <span 
                className="w-2 h-2 rounded-full shrink-0 transition-transform group-hover:scale-110"
                style={{ backgroundColor: provider.color }}
              />

              <span className="whitespace-nowrap">{provider.name}</span>

              {/* Checkmark when selected */}
              {isSelected && (
                <Check className="w-3 h-3 text-cyan-400 shrink-0" />
              )}

              {/* Count if available */}
              {count !== undefined && count > 0 && (
                <span className="text-[10px] tabular-nums px-1.5 py-0.2 rounded bg-slate-800 dark:bg-slate-950 text-slate-300">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
