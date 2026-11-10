/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ALL_PROVIDER_IDS, DISK_PROVIDERS } from '../constants/providers';
import { ExternalLink, Zap, Check, Search } from 'lucide-react';
import { DiskProviderId } from '../types';
import { PageShell, yunlanCardClass } from './PageShell';

interface DiskNavigationGridProps {
  onSearchProvider: (id: DiskProviderId) => void;
}

export const DiskNavigationGrid: React.FC<DiskNavigationGridProps> = ({
  onSearchProvider,
}) => {
  return (
    <PageShell
      title="网盘引擎导航"
      subtitle="全面兼容国内十大主流云盘，一站式对比特性、限速策略及格式支持"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {ALL_PROVIDER_IDS.map((id) => {
          const p = DISK_PROVIDERS[id];

          return (
            <div
              key={id}
              className={`${yunlanCardClass()} p-5 flex flex-col justify-between hover:border-[#d8cbb8]/80 transition-all group`}
            >
              <div>
                {/* Header */}
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2.5">
                    <span 
                      className="w-3.5 h-3.5 rounded-full" 
                      style={{ backgroundColor: p.color }} 
                    />
                    <h3 className="text-base font-semibold text-[#3d3832] group-hover:text-[#9a7b4f] transition-colors">
                      {p.name}
                    </h3>
                  </div>

                  {/* Speed Badge */}
                  <div className="flex items-center gap-1 text-xs font-medium text-[#8a9a6e]">
                    <Zap className="w-3 h-3" />
                    <span>转存{p.speedRating}</span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-yunlan-muted line-clamp-2 mb-4 leading-relaxed font-light">
                  {p.description}
                </p>

                {/* Features list */}
                <div className="space-y-1.5 mb-4">
                  {p.features.map((feat, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#5c564e]">
                      <Check className="w-3 h-3 text-[#b8956b] shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>

                {/* Formats */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-5 flex-wrap">
                  <span className="text-slate-400">常用格式:</span>
                  {p.supportedFormats.map((fmt, i) => (
                    <span key={i} className="font-mono text-slate-600 dark:text-slate-400">
                      {fmt}{i < p.supportedFormats.length - 1 ? ' ·' : ''}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-yunlan-hairline flex items-center justify-between gap-2">
                <button
                  onClick={() => onSearchProvider(id)}
                  className="flex items-center gap-1.5 min-h-11 px-3 py-1.5 text-xs font-medium text-[#9a7b4f] hover:bg-[#f3f0ea] rounded-lg transition-colors"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>检索该网盘</span>
                </button>

                <a
                  href={p.officialUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 min-h-11 px-3 py-1.5 text-xs text-yunlan-muted hover:text-[#4a4540] transition-colors"
                >
                  <span>官网直达</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </PageShell>
  );
};
