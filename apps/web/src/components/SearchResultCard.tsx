/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ResourceItem } from '../types';
import { DISK_PROVIDERS } from '../constants/providers';
import { 
  Copy, 
  Check, 
  ExternalLink, 
  FolderTree, 
  Bookmark, 
  ShieldCheck, 
  Eye, 
  HardDriveDownload 
} from 'lucide-react';

interface SearchResultCardProps {
  item: ResourceItem;
  onOpenDetail: (item: ResourceItem) => void;
  onToggleFavorite: (item: ResourceItem) => void;
  isFavorited: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
  onShowToast: (msg: string) => void;
}

export const SearchResultCard: React.FC<SearchResultCardProps> = ({
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
    onShowToast(`已复制「${item.title}」链接与提取码！`);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div 
      className={`group relative rounded-xl border p-5 transition-all duration-150 ${
        isSelected
          ? 'bg-cyan-500/5 dark:bg-cyan-950/20 border-cyan-500/60 ring-1 ring-cyan-500/30'
          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        
        {/* Left Section: Checkbox + Content */}
        <div className="flex items-start gap-3.5 flex-1 min-w-0">
          {/* Checkbox for batch selection */}
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggleSelect(item.id)}
            className="mt-1 w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500 cursor-pointer"
            aria-label={`选择资源 ${item.title}`}
          />

          <div className="flex-1 min-w-0">
            {/* Unboxed Header Meta: Provider dot + unboxed text (strictly zero pill) */}
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5 flex-wrap">
              <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                <span 
                  className="w-2 h-2 rounded-full inline-block" 
                  style={{ backgroundColor: provider?.color || '#3b82f6' }} 
                />
                <span>{provider?.name || item.diskProvider}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-mono text-slate-700 dark:text-slate-300 font-semibold">{item.sizeFormatted}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">更新于 {item.updatedAt}</span>
              {item.uploader && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>分享者: {item.uploader}</span>
                </>
              )}
            </div>

            {/* Title (Click opens modal) */}
            <h3 
              onClick={() => onOpenDetail(item)}
              className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 cursor-pointer transition-colors leading-snug tracking-tight"
            >
              {item.title}
            </h3>

            {/* Description */}
            <p className="mt-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {item.description}
            </p>

            {/* Tags & File count preview */}
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300 font-medium">
                <FolderTree className="w-3.5 h-3.5 text-cyan-500" />
                <span>包含 {item.totalFiles} 个文件</span>
              </span>
              
              {item.tags.length > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <div className="flex items-center gap-1.5">
                    {item.tags.slice(0, 4).map((tag, idx) => (
                      <span key={idx} className="hover:text-cyan-500 transition-colors">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {/* Health Score */}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>转存成功率 {item.healthScore}%</span>
              </span>

              {/* Views & Saves */}
              <span aria-hidden="true">·</span>
              <span className="flex items-center gap-1 tabular-nums">
                <Eye className="w-3.5 h-3.5" />
                <span>{item.viewsCount.toLocaleString()}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Action Controls */}
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2 shrink-0">
          
          {/* Extract code display if any */}
          {item.extractCode ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-md border border-slate-200 dark:border-slate-700">
              <span className="text-[10px] text-slate-400 font-sans">提取码</span>
              <strong className="tracking-wider">{item.extractCode}</strong>
            </div>
          ) : (
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium py-1">
              免提取码
            </span>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white'
            }`}
            title="复制资源链接与提取码"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="whitespace-nowrap">{copied ? '已复制' : '复制链接'}</span>
          </button>

          {/* Direct jump to netdisk */}
          <a
            href={item.shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-cyan-600 dark:hover:bg-cyan-600 transition-colors whitespace-nowrap"
            title="在新标签页中打开网盘"
          >
            <HardDriveDownload className="w-3.5 h-3.5" />
            <span>直达转存</span>
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>

          {/* Favorite button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item);
            }}
            className={`p-2 rounded-lg border transition-colors ${
              isFavorited
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-500'
                : 'bg-transparent border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:border-slate-300'
            }`}
            title={isFavorited ? '取消收藏' : '收藏此资源'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-500' : ''}`} />
          </button>

        </div>

      </div>
    </div>
  );
};
