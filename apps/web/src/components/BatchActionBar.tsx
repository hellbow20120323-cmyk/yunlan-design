/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ResourceItem } from '../types';
import { Copy, Check, Download, Bookmark, X } from 'lucide-react';

interface BatchActionBarProps {
  selectedCount: number;
  selectedItems: ResourceItem[];
  onClearSelection: () => void;
  onBatchFavorite: (items: ResourceItem[]) => void;
  onShowToast: (msg: string) => void;
}

export const BatchActionBar: React.FC<BatchActionBarProps> = ({
  selectedCount,
  selectedItems,
  onClearSelection,
  onBatchFavorite,
  onShowToast,
}) => {
  const [copied, setCopied] = useState(false);

  if (selectedCount === 0) return null;

  const handleBatchCopy = () => {
    const text = selectedItems.map((item, idx) => {
      const codePart = item.extractCode ? ` (提取码: ${item.extractCode})` : ' (免密码)';
      return `${idx + 1}. ${item.title}\n链接: ${item.shareUrl}${codePart}`;
    }).join('\n\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    onShowToast(`已批量复制 ${selectedCount} 个资源分享链接！`);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    const md = `# 云览资源分享清单 (${new Date().toLocaleDateString()})\n\n` +
      selectedItems.map((item) => {
        const codePart = item.extractCode ? ` | 提取码: \`${item.extractCode}\`` : ' | 免密码';
        return `- [${item.title}](${item.shareUrl}) - **${item.sizeFormatted}**${codePart}`;
      }).join('\n');

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yunlan_resources_${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    onShowToast(`已导出 ${selectedCount} 项资源为 Markdown 文件！`);
  };

  return (
    <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] md:bottom-6 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-3 sm:px-4 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center justify-between gap-3 p-3 bg-slate-900/95 dark:bg-slate-950/95 text-white backdrop-blur-md rounded-2xl border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-2 pl-2 text-xs">
          <span className="font-semibold text-cyan-400 tabular-nums">已选 {selectedCount} 项</span>
          <span className="text-slate-400">| 批量操作</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Batch copy */}
          <button
            onClick={handleBatchCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 hover:bg-cyan-500 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? '已复制' : '复制链接'}</span>
          </button>

          {/* Export markdown */}
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
            title="导出为 Markdown 文档"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">导出MD</span>
          </button>

          {/* Batch favorite */}
          <button
            onClick={() => {
              onBatchFavorite(selectedItems);
              onShowToast(`已批量收藏 ${selectedCount} 项资源！`);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">收藏</span>
          </button>

          {/* Dismiss */}
          <button
            onClick={onClearSelection}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="取消选择"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
