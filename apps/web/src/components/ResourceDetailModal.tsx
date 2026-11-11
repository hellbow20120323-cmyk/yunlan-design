/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { safeHref } from '../utils/safeUrl';
import { FileItem, ResourceItem, SharePreview } from '../types';
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
  AlertCircle, 
  Bookmark, 
  RefreshCw,
} from 'lucide-react';
import { SearchService } from '../services/searchService';
import { applyShareMeta, fetchShareMetadata } from '../services/gatewayAdapter';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

function supportsSharePreview(item: ResourceItem): boolean {
  return item.diskProvider === 'quark' || item.diskProvider === 'uc' || item.diskProvider === 'aliyun';
}

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
  const [copied, setCopied] = useState(false);
  const [testingHealth, setTestingHealth] = useState(false);
  const [healthStatus, setHealthStatus] = useState<string | null>(null);
  const [reported, setReported] = useState(false);
  const [overlay, setOverlay] = useState<{
    fileTree?: FileItem[];
    sharePreview?: SharePreview;
    totalFiles?: number;
    sizeFormatted?: string;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useLockBodyScroll(Boolean(item));

  useEffect(() => {
    setCopied(false);
    setTestingHealth(false);
    setHealthStatus(null);
    setReported(false);
    setOverlay(null);
    setPreviewLoading(false);
  }, [item?.id]);

  useEffect(() => {
    if (!item || !supportsSharePreview(item)) return;
    if (item.fileTree?.length || item.sharePreview) return;
    let cancelled = false;
    setPreviewLoading(true);
    void fetchShareMetadata([item])
      .then((metadata) => {
        if (cancelled) return;
        const meta = metadata[item.shareUrl];
        if (!meta) {
          setOverlay({
            sharePreview: { status: 'error', error: '未读到公开分享目录' },
          });
          return;
        }
        const next = applyShareMeta(item, meta);
        setOverlay({
          fileTree: next.fileTree,
          sharePreview: next.sharePreview,
          totalFiles: next.totalFiles,
          sizeFormatted: next.sizeFormatted,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setOverlay({
          sharePreview: { status: 'error', error: '目录预览暂时不可用' },
        });
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [item]);

  if (!item) return null;

  const fileTree = overlay?.fileTree ?? item.fileTree;
  const sharePreview = overlay?.sharePreview ?? item.sharePreview;
  const totalFiles = overlay?.totalFiles ?? item.totalFiles;
  const sizeFormatted = overlay?.sizeFormatted ?? item.sizeFormatted;

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
    if (['mkv', 'mp4', 'avi', 'mov', 'ts', 'rmvb'].includes(ext)) return <Film className="w-4 h-4 text-blue-500" />;
    if (['zip', 'rar', '7z', 'tar'].includes(ext)) return <Archive className="w-4 h-4 text-amber-500" />;
    return <FileText className="w-4 h-4 text-emerald-500" />;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="yl-modal-panel relative w-full md:max-w-2xl bg-yunlan-surface dark:bg-slate-900 border-t md:border border-slate-200 dark:border-slate-800 rounded-t-2xl md:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="md:hidden mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-slate-300" aria-hidden />
        {/* Header bar */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-4">
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
              className="p-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors min-h-11 min-w-11 flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6">
          {/* Title & Metadata */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {item.title}
            </h2>
            <div className="mt-2.5 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
              <span className="font-mono tabular-nums font-semibold text-slate-700 dark:text-slate-300">
                {sizeFormatted}
              </span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">更新于 {item.updatedAt}</span>
              <span aria-hidden="true">·</span>
              <span>共 {totalFiles} 个文件</span>
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
                  className={`flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied 
                      ? 'bg-emerald-600 text-white' 
                      : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:border-slate-400'
                  }`}
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? '已复制全部' : '一键复制'}</span>
                </button>

                <a
                  href={safeHref(item.shareUrl)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 min-h-11 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-yunlan-cta hover:opacity-90 transition-colors"
                >
                  <span>直达网盘转存</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>

          {/* File Tree Breakdown */}
          <div>
            <div className="flex items-center justify-between mb-2.5 gap-3">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FolderTree className="w-4 h-4 text-yunlan-stone" />
                <span>公开分享目录</span>
              </span>
              <span className="text-xs text-slate-400 text-right">
                {sharePreview?.truncated
                  ? '仅列出部分文件，完整目录请到网盘查看'
                  : '仅预览，下载请前往网盘官网'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden text-xs">
              {previewLoading && !sharePreview && !(fileTree && fileTree.length) ? (
                <div className="p-4 text-center text-slate-400">正在读取公开分享目录…</div>
              ) : sharePreview?.status === 'error' ? (
                <div className="p-4 text-center text-slate-500 space-y-1">
                  <p>{sharePreview.error || '暂时无法读取目录'}</p>
                  <p className="text-slate-400">可仍跳转官网查看或转存</p>
                </div>
              ) : fileTree && fileTree.length > 0 ? (
                <>
                  {fileTree.map((f, i) => (
                    <div key={`${f.name}-${i}`} className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
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
                  ))}
                  {sharePreview?.truncated ? (
                    <div className="px-3 py-2.5 bg-slate-50 dark:bg-slate-900/40 text-slate-500">
                      仅列出部分文件。完整目录请点下方「直达网盘」。
                    </div>
                  ) : null}
                </>
              ) : supportsSharePreview(item) ? (
                <div className="p-4 text-center text-slate-400">
                  公开分享里没有列出文件，请到网盘页面确认
                </div>
              ) : (
                <div className="p-4 text-center text-slate-400">
                  目前仅夸克、UC、阿里云盘支持目录预览，请到网盘页面查看完整目录
                </div>
              )}
            </div>
          </div>

          {/* Report Invalid Link Action */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs pb-[env(safe-area-inset-bottom)]">
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
        <div className="px-4 sm:px-6 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs text-slate-500 yl-safe-bottom">
          <span className="truncate hidden sm:inline">资源编号: {item.id}</span>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleCopy}
              className="flex-1 sm:flex-none min-h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              {copied ? '已复制' : '复制链接'}
            </button>
            <a
              href={safeHref(item.shareUrl)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 sm:flex-none min-h-11 px-4 inline-flex items-center justify-center rounded-lg text-white bg-yunlan-cta font-medium"
            >
              直达网盘
            </a>
            <button
              onClick={onClose}
              className="hidden sm:inline-flex min-h-11 px-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors items-center"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
