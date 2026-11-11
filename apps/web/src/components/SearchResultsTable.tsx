/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef, useEffect } from 'react';
import { safeHref } from '../utils/safeUrl';
import {
  Search,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowUpDown,
  MoreVertical,
  Copy,
  ExternalLink,
  Bookmark,
  Info,
  RefreshCw,
} from 'lucide-react';
import { ResourceItem, SortOption } from '../types';
import { DISK_PROVIDERS } from '../constants/providers';

type TableSortKey = 'title' | 'valid' | 'files' | 'size' | 'date';

const CATEGORY_LABEL: Record<string, string> = {
  video: '影视',
  doc: '资料',
  software: '软件',
  music: '音乐',
  game: '游戏',
  archive: '合集',
  other: '其他',
};

interface SearchResultsTableProps {
  items: ResourceItem[];
  query: string;
  total: number;
  tookMs: number;
  modeLabel?: string;
  demoMode?: boolean;
  sortBy: SortOption;
  onSelectSort: (sort: SortOption) => void;
  onClose: () => void;
  onOpenDetail: (item: ResourceItem) => void;
  onToggleFavorite: (item: ResourceItem) => void;
  isFavorited: (id: string) => boolean;
  onShowToast: (msg: string) => void;
  onForceRefresh?: () => void;
  forceRefreshLoading?: boolean;
}

function ProviderBadge({ item }: { item: ResourceItem }) {
  const p = DISK_PROVIDERS[item.diskProvider];
  return (
    <div className="flex items-center gap-2 min-w-[72px]">
      <span
        className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-sm"
        style={{ backgroundColor: p?.color || '#64748b' }}
        title={p?.name}
      >
        {p?.shortName?.slice(0, 2) || '?'}
      </span>
      <span className="hidden lg:inline text-xs text-slate-600 font-medium truncate max-w-[56px]">
        {p?.shortName || item.diskProvider}
      </span>
    </div>
  );
}

function formatSource(item: ResourceItem): string {
  const raw = item.source || item.uploader || item.tags?.[0] || '';
  if (!raw) return '—';
  if (raw.startsWith('tg:')) return `TG ${raw.slice(3)}`;
  if (raw.startsWith('weibo:')) return '微博';
  return raw.length > 28 ? `${raw.slice(0, 26)}…` : raw;
}

function truncateUrl(url: string, max = 42): string {
  if (!url) return '';
  if (url.length <= max) return url;
  if (url.startsWith('magnet:')) return `magnet:…${url.slice(-20)}`;
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname.length > 20 ? `${u.pathname.slice(0, 18)}…` : u.pathname}`;
  } catch {
    return `${url.slice(0, max)}…`;
  }
}

function sortItems(items: ResourceItem[], key: TableSortKey, asc: boolean): ResourceItem[] {
  const dir = asc ? 1 : -1;
  return [...items].sort((a, b) => {
    switch (key) {
      case 'title':
        return dir * a.title.localeCompare(b.title, 'zh-CN');
      case 'valid':
        return dir * ((a.isValid ? 1 : 0) - (b.isValid ? 1 : 0)) || dir * (a.healthScore - b.healthScore);
      case 'files':
        return dir * (a.totalFiles - b.totalFiles);
      case 'size':
        return dir * (a.sizeBytes - b.sizeBytes);
      case 'date':
        return dir * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
      default:
        return 0;
    }
  });
}

export const SearchResultsTable: React.FC<SearchResultsTableProps> = ({
  items,
  query,
  total,
  tookMs,
  modeLabel,
  demoMode,
  sortBy,
  onSelectSort,
  onClose,
  onOpenDetail,
  onToggleFavorite,
  isFavorited,
  onShowToast,
  onForceRefresh,
  forceRefreshLoading,
}) => {
  const [tableSort, setTableSort] = useState<{ key: TableSortKey; asc: boolean }>({
    key: 'title',
    asc: true,
  });
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: Event) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener('pointerdown', onDoc);
    return () => document.removeEventListener('pointerdown', onDoc);
  }, []);

  const sorted = useMemo(
    () => sortItems(items, tableSort.key, tableSort.asc),
    [items, tableSort]
  );

  const toggleColSort = (key: TableSortKey) => {
    setTableSort((prev) =>
      prev.key === key ? { key, asc: !prev.asc } : { key, asc: key === 'title' }
    );
    if (key === 'size') onSelectSort(tableSort.asc && tableSort.key === 'size' ? 'size_asc' : 'size_desc');
  };

  const SortHead = ({ label, col }: { label: string; col: TableSortKey }) => (
    <button
      type="button"
      onClick={() => toggleColSort(col)}
      className="inline-flex items-center gap-1 text-left text-xs font-semibold text-slate-600 hover:text-yunlan-stone transition-colors"
    >
      {label}
      <ArrowUpDown className="w-3 h-3 opacity-60" />
    </button>
  );

  const copyItem = (item: ResourceItem) => {
    const copyText = item.extractCode
      ? `资源名称: ${item.title}\n分享链接: ${item.shareUrl}\n提取码: ${item.extractCode}`
      : `资源名称: ${item.title}\n分享链接: ${item.shareUrl}`;
    navigator.clipboard.writeText(copyText);
    onShowToast(`已复制「${item.title}」`);
    setMenuId(null);
  };

  const openLabel = (item: ResourceItem) =>
    item.diskProvider === 'magnet' ? '复制/打开磁力' : '打开链接';

  const resultHeader = (
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-3 border-b border-yunlan-hairline bg-yunlan-mist/60">
        <div className="flex items-center gap-2 min-w-0">
          <Search className="w-4 h-4 text-[#b8956b] shrink-0" />
          <h1 className="text-sm font-bold text-slate-900 truncate">
            {query.trim() ? `${query.trim()} 网盘资源` : '搜索结果'}
          </h1>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0 text-xs text-slate-500">
          <span className="tabular-nums">
            <strong className="text-slate-800">{total}</strong> 条
            <span className="hidden sm:inline"> · {tookMs}ms</span>
          </span>
          {modeLabel && (
            <span className={`hidden md:inline ${demoMode ? 'text-amber-600' : 'text-yunlan-stone'}`}>{modeLabel}</span>
          )}
          {onForceRefresh && (
            <button
              type="button"
              onClick={onForceRefresh}
              disabled={forceRefreshLoading}
              className="inline-flex items-center justify-center gap-1 min-h-9 min-w-9 px-2 py-1 rounded-sm text-yunlan-stone border border-yunlan-hairline hover:bg-yunlan-mist/80 transition-colors disabled:opacity-50"
              title="跳过上游缓存，重新检索"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${forceRefreshLoading ? 'animate-spin' : ''}`}
                strokeWidth={1.75}
              />
              <span className="hidden md:inline">强制刷新</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors min-h-9 min-w-9 flex items-center justify-center"
            title="关闭结果"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
  );

  return (
    <div className="rounded-[2px] border border-yunlan-hairline bg-yunlan-surface overflow-hidden shadow-yunlan-card">
      {resultHeader}

      <div className="md:hidden divide-y divide-yunlan-hairline">
        {sorted.map((item) => (
          <MobileResultCard
            key={item.id}
            item={item}
            menuOpen={menuId === item.id}
            onToggleMenu={() => setMenuId(menuId === item.id ? null : item.id)}
            menuRef={menuRef}
            onOpenDetail={onOpenDetail}
            onToggleFavorite={onToggleFavorite}
            isFavorited={isFavorited(item.id)}
            onCopy={() => copyItem(item)}
            onCopyCode={() => {
              if (!item.extractCode) return;
              navigator.clipboard.writeText(item.extractCode);
              onShowToast(`已复制提取码 ${item.extractCode}`);
            }}
            openLabel={openLabel(item)}
          />
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-yunlan-hairline text-yunlan-muted bg-yunlan-paper/90 text-xs font-medium">
              <th className="px-3 py-2.5 text-left">
                <SortHead label="分享名称" col="title" />
              </th>
              <th className="px-3 py-2.5 text-center w-24">
                <SortHead label="有效性" col="valid" />
              </th>
              <th className="px-3 py-2.5 text-right w-24">
                <SortHead label="文件数量" col="files" />
              </th>
              <th className="px-3 py-2.5 text-right w-28">
                <SortHead label="分享大小" col="size" />
              </th>
              <th className="w-10 px-2 py-2.5" aria-label="操作" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((item) => {
              const valid = item.isValid && item.healthScore >= 60;
              const cat = CATEGORY_LABEL[item.category] || item.category;
              const sourceFull = item.source || item.uploader || '';
              return (
                <React.Fragment key={item.id}>
                  <tr className="border-t border-yunlan-hairline hover:bg-yunlan-mist/40 transition-colors group">
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <ProviderBadge item={item} />
                        <button
                          type="button"
                          onClick={() => onOpenDetail(item)}
                          className="text-left min-w-0 flex-1"
                        >
                          <span className="font-medium text-yunlan-ink hover:text-yunlan-stone line-clamp-2 leading-snug transition-colors">
                            {item.title}
                          </span>
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle text-center">
                      {valid ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-700">
                          <CheckCircle2 className="w-4 h-4" aria-hidden />
                          有效
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                          <AlertCircle className="w-4 h-4" aria-hidden />
                          未验证
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle text-right tabular-nums text-slate-700">
                      {item.totalFiles > 0
                        ? `${item.metaPartial ? '≥' : ''}${item.totalFiles}`
                        : '—'}
                      {item.sharePreview?.status === 'ok' && item.fileTree && item.fileTree.length > 0 ? (
                        <span className="ml-1 text-[10px] text-yunlan-muted">可预览</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 align-middle text-right tabular-nums text-yunlan-ink font-medium">
                      {item.sizeFormatted && item.sizeFormatted !== '—'
                        ? `${item.metaPartial ? '约 ' : ''}${item.sizeFormatted}`
                        : '—'}
                    </td>
                    <td className="px-2 py-3 align-middle relative">
                    <button
                      type="button"
                      onClick={() => setMenuId(menuId === item.id ? null : item.id)}
                      className="p-1.5 rounded-sm text-slate-400 hover:text-yunlan-stone hover:bg-yunlan-mist opacity-70 group-hover:opacity-100"
                      aria-label="更多操作"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuId === item.id && (
                      <div
                        ref={menuRef}
                        className="absolute right-2 top-full z-20 mt-1 w-40 rounded-xl border border-slate-200 bg-white shadow-lg py-1 text-xs"
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                          onClick={() => copyItem(item)}
                        >
                          <Copy className="w-3.5 h-3.5" /> 复制链接
                        </button>
                        <a
                          href={safeHref(item.shareUrl)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                          onClick={() => setMenuId(null)}
                        >
                          <ExternalLink className="w-3.5 h-3.5" /> {openLabel(item)}
                        </a>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                          onClick={() => {
                            onToggleFavorite(item);
                            setMenuId(null);
                          }}
                        >
                          <Bookmark
                            className={`w-3.5 h-3.5 ${isFavorited(item.id) ? 'fill-amber-400 text-amber-500' : ''}`}
                          />
                          {isFavorited(item.id) ? '取消收藏' : '收藏'}
                        </button>
                        <button
                          type="button"
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                          onClick={() => {
                            onOpenDetail(item);
                            setMenuId(null);
                          }}
                        >
                          <Info className="w-3.5 h-3.5" /> 详情
                        </button>
                      </div>
                    )}
                    </td>
                  </tr>
                  <tr className="border-b border-yunlan-hairline bg-yunlan-mist/35">
                    <td colSpan={5} className="px-3 py-2">
                      <ResultMetaStrip
                        item={item}
                        cat={cat}
                        sourceFull={sourceFull}
                        onCopyCode={() => {
                          if (!item.extractCode) return;
                          navigator.clipboard.writeText(item.extractCode);
                          onShowToast(`已复制提取码 ${item.extractCode}`);
                        }}
                        onCopyLink={() => copyItem(item)}
                      />
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortBy === 'relevance' && (
        <p className="hidden md:block px-4 py-2 text-xs text-slate-500 border-t border-yunlan-hairline">
          点击表头可排序；每条下方灰色条为扩展信息（来源、链接、提取码等）。综合排序仍按 API 匹配度，表内排序仅当前页。
        </p>
      )}
    </div>
  );
};

function MobileResultCard({
  item,
  menuOpen,
  onToggleMenu,
  menuRef,
  onOpenDetail,
  onToggleFavorite,
  isFavorited,
  onCopy,
  onCopyCode,
  openLabel,
}: {
  item: ResourceItem;
  menuOpen: boolean;
  onToggleMenu: () => void;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onOpenDetail: (item: ResourceItem) => void;
  onToggleFavorite: (item: ResourceItem) => void;
  isFavorited: boolean;
  onCopy: () => void;
  onCopyCode: () => void;
  openLabel: string;
}) {
  const p = DISK_PROVIDERS[item.diskProvider];
  const valid = item.isValid && item.healthScore >= 60;
  const cat = CATEGORY_LABEL[item.category] || item.category;

  return (
    <article className="px-3 py-3.5 bg-yunlan-surface">
      <div className="flex items-start gap-3">
        <span
          className="w-9 h-9 rounded-[2px] flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ backgroundColor: p?.color || '#64748b' }}
        >
          {p?.shortName?.slice(0, 2) || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            className="text-left w-full"
          >
            <h3 className="text-[15px] font-medium text-yunlan-ink leading-snug line-clamp-2">
              {item.title}
            </h3>
          </button>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-yunlan-muted">
            <span>{p?.shortName || item.diskProvider}</span>
            <span aria-hidden>·</span>
            <span className={valid ? 'text-emerald-700' : 'text-yunlan-muted'}>
              {valid ? '有效' : '未验证'}
            </span>
            <span aria-hidden>·</span>
            <span className="tabular-nums text-yunlan-ink">
              {item.sizeFormatted && item.sizeFormatted !== '—'
                ? `${item.metaPartial ? '约 ' : ''}${item.sizeFormatted}`
                : '—'}
            </span>
            {item.totalFiles > 0 && (
              <>
                <span aria-hidden>·</span>
                <span className="tabular-nums">
                  {item.metaPartial ? '≥' : ''}
                  {item.totalFiles} 文件
                  {item.sharePreview?.status === 'ok' && item.fileTree && item.fileTree.length > 0
                    ? ' · 可预览'
                    : ''}
                </span>
              </>
            )}
            <span aria-hidden>·</span>
            <span>{cat}</span>
          </p>
        </div>
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={onToggleMenu}
            className="p-2 text-yunlan-muted min-h-11 min-w-11 flex items-center justify-center"
            aria-label="更多操作"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full z-20 mt-1 w-40 rounded-[2px] border border-yunlan-hairline bg-yunlan-paper shadow-ink-wash py-1 text-[13px]"
            >
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-yunlan-ink"
                onClick={onCopy}
              >
                <Copy className="w-3.5 h-3.5" /> 复制链接
              </button>
              <a
                href={safeHref(item.shareUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-yunlan-ink"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {openLabel}
              </a>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-yunlan-ink"
                onClick={() => onToggleFavorite(item)}
              >
                <Bookmark className={`w-3.5 h-3.5 ${isFavorited ? 'fill-amber-400 text-amber-500' : ''}`} />
                {isFavorited ? '取消收藏' : '收藏'}
              </button>
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2.5 text-yunlan-ink"
                onClick={() => onOpenDetail(item)}
              >
                <Info className="w-3.5 h-3.5" /> 详情
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        {item.extractCode ? (
          <button
            type="button"
            onClick={onCopyCode}
            className="min-h-10 px-3 rounded-sm text-[13px] font-mono text-amber-900 bg-amber-50 border border-amber-200"
          >
            提取码 {item.extractCode}
          </button>
        ) : (
          <span className="text-[13px] text-emerald-700 px-1">免提取码</span>
        )}
        <button
          type="button"
          onClick={onCopy}
          className="min-h-10 px-3 rounded-sm text-[13px] text-yunlan-stone border border-yunlan-hairline bg-yunlan-paper"
        >
          复制
        </button>
        <a
          href={safeHref(item.shareUrl)}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto min-h-10 px-3.5 inline-flex items-center rounded-sm text-[13px] font-medium text-white bg-yunlan-cta"
        >
          打开
        </a>
      </div>
    </article>
  );
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-slate-600">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="text-slate-700">{children}</span>
    </span>
  );
}

function ResultMetaStrip({
  item,
  cat,
  sourceFull,
  onCopyCode,
  onCopyLink,
}: {
  item: ResourceItem;
  cat: string;
  sourceFull: string;
  onCopyCode: () => void;
  onCopyLink: () => void;
}) {
  const extraTags = item.tags?.filter((t) => t && t !== item.source).slice(0, 3) ?? [];
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-5 sm:gap-y-1">
      <MetaItem label="类型">{cat}</MetaItem>
      <MetaItem label="来源">{formatSource(item)}</MetaItem>
      {sourceFull && sourceFull !== formatSource(item) ? (
        <span className="hidden md:inline text-xs text-slate-400 truncate max-w-[200px]" title={sourceFull}>
          {sourceFull}
        </span>
      ) : null}
      <MetaItem label="更新">{item.updatedAt || '—'}</MetaItem>
      <MetaItem label="匹配度">{item.healthScore}</MetaItem>
      {item.note && item.note !== item.title ? (
        <span className="text-xs text-slate-500 line-clamp-1 flex-1 min-w-[120px]" title={item.note}>
          备注：{item.note}
        </span>
      ) : null}
      <span
        className="text-xs font-mono text-slate-500 truncate max-w-full sm:max-w-[240px]"
        title={item.shareUrl}
      >
        链接：{truncateUrl(item.shareUrl, 56)}
      </span>
      {item.extractCode ? (
        <button
          type="button"
          onClick={onCopyCode}
          className="inline-flex items-center gap-1 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 hover:bg-amber-100"
        >
          提取码 {item.extractCode}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onCopyLink}
        className="text-xs text-cyan-700 hover:underline"
      >
        复制分享
      </button>
      {extraTags.map((t) => (
        <span key={t} className="px-1.5 py-0.5 rounded bg-[#f3f0ea] text-[#7a6545] text-xs">
          {t}
        </span>
      ))}
    </div>
  );
}
