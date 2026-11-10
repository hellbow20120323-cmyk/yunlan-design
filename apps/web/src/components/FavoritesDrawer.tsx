/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { safeHref } from '../utils/safeUrl';
import { ResourceItem } from '../types';
import { DISK_PROVIDERS } from '../constants/providers';
import { X, Bookmark, Trash2, ExternalLink, Copy } from 'lucide-react';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface FavoritesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  favorites: ResourceItem[];
  onRemoveFavorite: (item: ResourceItem) => void;
  onOpenDetail: (item: ResourceItem) => void;
  onShowToast: (msg: string) => void;
}

export const FavoritesDrawer: React.FC<FavoritesDrawerProps> = ({
  isOpen,
  onClose,
  favorites,
  onRemoveFavorite,
  onOpenDetail,
  onShowToast,
}) => {
  useLockBodyScroll(isOpen);
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="w-full md:max-w-md bg-yunlan-surface dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200 yl-safe-top yl-safe-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-amber-500 fill-amber-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              我的本地收藏夹 ({favorites.length})
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-11 min-w-11 flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {favorites.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
              <Bookmark className="w-10 h-10 stroke-[1.5] mb-2 opacity-30" />
              <p className="text-xs">暂无收藏的网盘资源</p>
              <p className="text-[11px] text-slate-400 mt-1">在搜索结果中点击书签按钮即可快速收藏</p>
            </div>
          ) : (
            favorites.map((item) => {
              const provider = DISK_PROVIDERS[item.diskProvider];

              return (
                <div
                  key={item.id}
                  className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700 transition-all text-xs"
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300 text-[11px]">
                      <span 
                        className="w-2 h-2 rounded-full" 
                        style={{ backgroundColor: provider?.color || '#3b82f6' }} 
                      />
                      <span>{provider?.name}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{item.sizeFormatted}</span>
                    </span>

                    <button
                      onClick={() => onRemoveFavorite(item)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                      title="移出收藏"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <h4 
                    onClick={() => {
                      onOpenDetail(item);
                      onClose();
                    }}
                    className="font-semibold text-slate-900 dark:text-white hover:text-yunlan-stone cursor-pointer line-clamp-2 leading-snug"
                  >
                    {item.title}
                  </h4>

                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
                    <div className="font-mono text-[11px] text-slate-500">
                      {item.extractCode ? `提取码: ${item.extractCode}` : '免提取密码'}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const text = item.extractCode 
                            ? `链接: ${item.shareUrl} 提取码: ${item.extractCode}` 
                            : `链接: ${item.shareUrl}`;
                          navigator.clipboard.writeText(text);
                          onShowToast('链接已复制！');
                        }}
                        className="flex items-center gap-1 text-[11px] text-slate-600 dark:text-slate-300 hover:text-cyan-600"
                      >
                        <Copy className="w-3 h-3" />
                        <span>复制</span>
                      </button>

                      <a
                        href={safeHref(item.shareUrl)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-cyan-600 hover:underline"
                      >
                        <span>转存</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {favorites.length > 0 && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 flex items-center justify-between text-xs">
            <span className="text-slate-500">数据保存在本设备浏览器中</span>
            <button
              onClick={() => {
                const text = favorites.map(f => `${f.title}: ${f.shareUrl} ${f.extractCode ? `(码: ${f.extractCode})` : ''}`).join('\n');
                navigator.clipboard.writeText(text);
                onShowToast(`已复制全部 ${favorites.length} 条收藏链接！`);
              }}
              className="text-cyan-600 hover:underline font-medium"
            >
              导出全部链接
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
