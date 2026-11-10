/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ResourceItem } from '../types';
import { DISK_PROVIDERS } from '../constants/providers';
import { Copy, Check, ExternalLink, Bookmark } from 'lucide-react';

interface SearchResultRowProps {
  item: ResourceItem;
  onOpenDetail: (item: ResourceItem) => void;
  onToggleFavorite: (item: ResourceItem) => void;
  isFavorited: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onShowToast: (msg: string) => void;
}

export const SearchResultRow: React.FC<SearchResultRowProps> = ({
  item,
  onOpenDetail,
  onToggleFavorite,
  isFavorited,
  isSelected,
  onToggleSelect,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);
  const provider = DISK_PROVIDERS[item.diskProvider];

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const copyText = item.extractCode 
      ? `资源名称: ${item.title}\n分享链接: ${item.shareUrl}\n提取码: ${item.extractCode}` 
      : `资源名称: ${item.title}\n分享链接: ${item.shareUrl}`;

    navigator.clipboard.writeText(copyText);
    setCopied(true);
    onShowToast(`已复制「${item.title}」链接！`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={`group flex items-center justify-between gap-4 px-4 py-3 rounded-lg border text-xs transition-colors ${
        isSelected 
          ? 'bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-500/60' 
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(item.id)}
        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer shrink-0"
        aria-label={`选择 ${item.title}`}
      />

      {/* Provider Tag */}
      <div className="flex items-center gap-1.5 w-24 shrink-0 font-medium text-slate-700 dark:text-slate-300">
        <span 
          className="w-2 h-2 rounded-full shrink-0" 
          style={{ backgroundColor: provider?.color || '#3b82f6' }} 
        />
        <span className="truncate">{provider?.shortName || item.diskProvider}网盘</span>
      </div>

      {/* Title */}
      <div 
        onClick={() => onOpenDetail(item)}
        className="flex-1 min-w-0 cursor-pointer font-medium text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 truncate"
        title={item.title}
      >
        <span>{item.title}</span>
      </div>

      {/* File Size */}
      <div className="w-20 shrink-0 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
        {item.sizeFormatted}
      </div>

      {/* Date */}
      <div className="w-24 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400 hidden sm:block">
        {item.updatedAt}
      </div>

      {/* Extract code */}
      <div className="w-20 shrink-0 text-center font-mono">
        {item.extractCode ? (
          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {item.extractCode}
          </span>
        ) : (
          <span className="text-slate-400">免码</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleCopy}
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          title="复制链接与提取码"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        <a
          href={item.shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-cyan-600 transition-colors"
          title="直达网盘"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </a>

        <button
          onClick={() => onToggleFavorite(item)}
          className={`p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
            isFavorited ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
          }`}
          title="收藏"
        >
          <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-500' : ''}`} />
        </button>
      </div>
    </div>
  );
};
