/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ResourceItem } from '../types';
import { DISK_PROVIDERS } from '../constants/providers';
import { 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  FolderTree, 
  FileText, 
  Film, 
  Archive, 
  ShieldCheck, 
  AlertCircle, 
  Bookmark, 
  RefreshCw,
  Share2
} from 'lucide-react';
import { SearchService } from '../services/searchService';

interface ResourceDetailModalProps {
  item: ResourceItem | null;
  onClose: () => void;
  onToggleFavorite: (item: ResourceItem) => void;
  isFavorited: boolean;
  onShowToast: (msg: string) => void;
}

export const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  item,
  onClose,
  onToggleFavorite,
  isFavorited,
  onShowToast,
}) => {
  if (!item) return null;

  const [copied, setCopied] = useState(false);
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [reported, setReported] = useState(false);

  const provider = DISK_PROVIDERS[item.diskProvider];

  const handleCopy = () => {
    const copyText = item.extractCode 
      ? `资源名称: ${item.title}\n分享链接: ${item.shareUrl}\n提取码: ${item.extractCode}` 
      : `资源名称: ${item.title}\n分享链接: ${item.shareUrl}`;

    navigator.clipboard.writeText(copyText);
    setCopied(true);
    onShowToast('资源链接与提取码已成功复制！');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleTestHealth = async () => {
    setTestingHealth(true);
    const result = await SearchService.testLinkHealth(item);
    setTestingHealth(false);
    setHealthStatus(result.statusMsg);
    onShowToast(`实时校验完成: ${result.statusMsg}`);
  };

  const handleReportInvalid = () => {
    setReported(true);
    onShowToast('感谢您的反馈！已标记该链接并通知巡检爬虫复核。');
  };

  const getFileIcon = (ext: string) => {
    if (['mkv', 'mp4', 'avi', 'mov'].includes(ext)) return <Film className="w-4 h-4 text-blue-500" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive className="w-4 h-4 text-amber-500" />;
    return <FileText className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span 
              className="w-2.5 h-2.5 rounded-full" 
              style={{ backgroundColor: provider?.color || '#3b82f6' }} 
            />
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {provider?.name || item.diskProvider}
            </span>
            <span aria-hidden="true">·</span>
            <span>资源详情清单</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onToggleFavorite(item)}
              className={`p-1.5 rounded-lg border transition-colors ${
                isFavorited 
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
                  : 'border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600'
              }`}
              title="收藏资源"
            >
              <Bookmark className={`w-4 h-4 ${isFavorited ? 'fill-amber-500' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Title & Metadata */}
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {item.title}
            </h2>
            <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                {item.sizeFormatted}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">更新于 {item.updatedAt}</span>
              <span aria-hidden="true">·</span>
              <span>共 {item.totalFiles} 个文件</span>
              {item.uploader && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>分享者: {item.uploader}</span>
                </>
              )}
            </div>
          </div>

          {/* Description */}
          {item.description && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800/80 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {item.description}
            </div>
          )}

          {/* Quick Access Box: URL + Extract Code */}
          <div className="p-4 rounded-xl bg-slate-100/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-1">
                <span className="text-slate-500 dark:text-slate-400">分享链接地址：</span>
                <p className="font-mono text-cyan-600 dark:text-cyan-400 break-all select-all">
                  {item.shareUrl}
                </p>
              </div>

              {item.extractCode ? (
                <div className="sm:text-right shrink-0">
                  <span className="text-slate-500 dark:text-slate-400 block mb-0.5">提取码：</span>
                  <span className="font-mono text-base font-bold text-slate-900 dark:text-white px-2 py-0.5 bg-white dark:bg-slate-900 rounded border border-slate-200 dark:border-slate-700 select-all">
                    {item.extractCode}
                  </span>
                </div>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium shrink-0">
                  免提取密码
                </span>
              )}
            </div>

            <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestHealth}
                  disabled={testingHealth}
                  className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingHealth ? 'animate-spin' : ''}`} />
                  <span>{testingHealth ? '检测中...' : '在线测活'}</span>
                </button>
                {healthStatus && (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">
                    {healthStatus}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已复制全部' : '一键复制'}</span>
                </button>

                <a
                  href={item.shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-colors"
                >
                  <span>直达网盘转存</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* File Tree Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-cyan-500" />
                <span>包含文件清单明细</span>
              </span>
              <span className="text-[11px] text-slate-400">
                文件转存前可在此核对完整性
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs">
              {item.fileTree && item.fileTree.length > 0 ? (
                item.fileTree.map((f, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                      {getFileIcon(f.extension)}
                      <span className="font-mono text-slate-800 dark:text-slate-200 truncate" title={f.name}>
                        {f.name}
                      </span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-500 shrink-0">
                      {f.sizeFormatted}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-400">
                  该网盘未公开内部子目录，请在网盘页面查看完整目录
                </div>
              )}
            </div>
          </div>

          {/* Report Invalid Link Action */}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-400">遇到链接失效、密码错误或内容违规？</span>
            <button
              onClick={handleReportInvalid}
              disabled={reported}
              className={`flex items-center gap-1 transition-colors ${
                reported 
                  ? 'text-emerald-500' 
                  : 'text-slate-500 hover:text-red-500'
              }`}
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{reported ? '已提交失效报告' : '报错失效链接'}</span>
            </button>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>资源编号: {item.id}</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
