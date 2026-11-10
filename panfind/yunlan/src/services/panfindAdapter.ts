/**
 * PanFind 网关响应 → 云览 ResourceItem 模型
 */

import { ALL_PROVIDER_IDS, PANFIND_SEARCH_PROVIDER_IDS } from '../constants/providers';
import {
  DiskProviderId,
  ResourceCategory,
  ResourceItem,
  SearchFilter,
  SearchResultResponse,
  SortOption,
  TimeRangeOption,
} from '../types';

/** PanFind API 支持的网盘类型 */
export const PANFIND_DISK_IDS: DiskProviderId[] = [...PANFIND_SEARCH_PROVIDER_IDS];

export interface PanFindSearchHit {
  id: string;
  title: string;
  url: string;
  password?: string;
  cloudType: string;
  score: number;
  source: string;
  datetime?: string;
  note?: string;
  origin?: string;
  weiboNick?: string;
  weiboUid?: string;
  weiboPostUrl?: string;
  demo?: boolean;
  sizeBytes?: number;
  fileCount?: number;
  metaPartial?: boolean;
}

export interface PanFindSearchResponse {
  query: string;
  demoMode?: boolean;
  modeLabel?: string;
  queryHint?: string;
  total: number;
  results: PanFindSearchHit[];
  tookMs: number;
  sourceStats?: Record<string, { count?: number; error?: string; warning?: string }>;
  points?: import('../types/auth').PointsStatus;
}

function detectProviderFromUrl(url: string): DiskProviderId | null {
  const u = url.toLowerCase();
  if (/pan\.baidu\.com|yun\.baidu\.com/.test(u)) return 'baidu';
  if (/pan\.quark\.cn/.test(u)) return 'quark';
  if (/pan\.xunlei\.com/.test(u)) return 'xunlei';
  if (/(?:drive|pan)\.uc\.cn/.test(u)) return 'uc';
  if (/alipan\.com|aliyundrive\.com/.test(u)) return 'aliyun';
  if (/123pan\.com|123684\.com|123pan\.cn/.test(u)) return 'pan123';
  if (/cloud\.189\.cn/.test(u)) return 'tianyi';
  if (/115\.com|115cdn\.com|anxia\.com/.test(u)) return 'pan115';
  if (/yun\.139\.com|caiyun\.139\.com/.test(u)) return 'mobile';
  if (/lanzou|lanoss/.test(u)) return 'lanzou';
  if (u.startsWith('magnet:')) return 'magnet';
  return null;
}

function mapCloudType(raw: string, url = ''): DiskProviderId {
  const id = raw as DiskProviderId;
  if (PANFIND_DISK_IDS.includes(id)) return id;
  const fromUrl = detectProviderFromUrl(url);
  if (fromUrl) return fromUrl;
  if (id === 'magnet') return 'magnet';
  return 'baidu';
}

function inferCategory(title: string): ResourceCategory {
  const t = title.toLowerCase();
  if (/\.(mkv|mp4|avi|rmvb|ts)|4k|1080p|剧集|电影|动漫/.test(t)) return 'video';
  if (/\.(pdf|epub|mobi|doc|教程|课件)/.test(t)) return 'doc';
  if (/\.(exe|dmg|apk|软件|绿色|破解版|安装包)/.test(t)) return 'software';
  if (/\.(flac|mp3|wav|音乐|专辑)/.test(t)) return 'music';
  if (/游戏|dlc|steam|整合包/.test(t)) return 'game';
  if (/\.(zip|rar|7z|合集|打包)/.test(t)) return 'archive';
  return 'other';
}

function hitToResource(hit: PanFindSearchHit): ResourceItem {
  const diskProvider = mapCloudType(hit.cloudType, hit.url);
  const category = inferCategory(hit.title);
  const updatedAt = hit.datetime
    ? hit.datetime.slice(0, 10)
    : new Date().toISOString().slice(0, 10);
  const isWeibo = hit.origin === 'weibo' || String(hit.source || '').startsWith('weibo:');
  const descParts = [hit.url];
  if (hit.note) descParts.push(hit.note);
  if (isWeibo && hit.weiboNick) descParts.push(`微博 · ${hit.weiboNick}`);
  if (hit.source) descParts.push(`来源 ${hit.source}`);
  const sizeBytes = Math.max(0, Number(hit.sizeBytes) || 0);
  const fileCount = Math.max(0, Number(hit.fileCount) || 0);

  return {
    id: hit.id,
    title: hit.title,
    description: descParts.join(' · '),
    diskProvider,
    category,
    sizeBytes,
    sizeFormatted: formatBytes(sizeBytes),
    updatedAt,
    createdAt: updatedAt,
    shareUrl: hit.url,
    extractCode: hit.password || '',
    isValid: true,
    healthScore: Math.min(100, Math.max(40, Math.round(hit.score * 20))),
    totalFiles: fileCount,
    metaPartial: hit.metaPartial,
    tags: isWeibo ? ['微博源', hit.source].filter(Boolean) : [hit.source].filter(Boolean),
    viewsCount: 0,
    savesCount: Math.round(hit.score * 100),
    uploader: isWeibo ? hit.weiboNick || '微博' : hit.source,
    source: hit.source || undefined,
    note: hit.note && hit.note !== hit.title ? hit.note : undefined,
  };
}

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const digits = value >= 100 || index === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

function cloudTypesParam(selected: DiskProviderId[]): string {
  const picked = selected.filter((p) => PANFIND_DISK_IDS.includes(p));
  if (picked.length === 0) return PANFIND_DISK_IDS.join(',');
  if (picked.length === PANFIND_DISK_IDS.length) return '';
  return picked.join(',');
}

function passesTimeRange(updatedAt: string, range: TimeRangeOption): boolean {
  if (range === 'all') return true;
  const t = new Date(updatedAt).getTime();
  if (Number.isNaN(t)) return true;
  const now = Date.now();
  const day = 86400000;
  switch (range) {
    case 'day':
      return now - t <= day;
    case 'week':
      return now - t <= 7 * day;
    case 'month':
      return now - t <= 30 * day;
    case 'year':
      return now - t <= 365 * day;
    default:
      return true;
  }
}

function sortItems(items: ResourceItem[], sortBy: SortOption): ResourceItem[] {
  const list = [...items];
  switch (sortBy) {
    case 'date_desc':
      return list.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    case 'hot_desc':
      return list.sort((a, b) => b.savesCount - a.savesCount);
    case 'size_desc':
    case 'size_asc':
      return list;
    case 'relevance':
    default:
      return list.sort((a, b) => b.healthScore + b.savesCount - (a.healthScore + a.savesCount));
  }
}

function applyClientFilters(items: ResourceItem[], filter: SearchFilter): ResourceItem[] {
  let pool = items;

  if (
    filter.selectedProviders.length > 0 &&
    filter.selectedProviders.length < PANFIND_SEARCH_PROVIDER_IDS.length
  ) {
    pool = pool.filter((i) => filter.selectedProviders.includes(i.diskProvider));
  }

  if (filter.category !== 'all') {
    pool = pool.filter((i) => i.category === filter.category);
  }

  if (filter.onlyValid) {
    pool = pool.filter((i) => i.isValid && i.healthScore >= 80);
  }

  pool = pool.filter((i) => passesTimeRange(i.updatedAt, filter.timeRange));

  const minMb = filter.minSizeMb ?? 0;
  if (minMb > 0) {
    pool = pool.filter((i) => i.sizeBytes === 0 || i.sizeBytes >= minMb * 1024 * 1024);
  }
  const maxMb = filter.maxSizeMb;
  if (maxMb != null && maxMb > 0) {
    pool = pool.filter((i) => i.sizeBytes === 0 || i.sizeBytes <= maxMb * 1024 * 1024);
  }

  return sortItems(pool, filter.sortBy);
}

function countByProvider(items: ResourceItem[]): Record<DiskProviderId, number> {
  const acc = {} as Record<DiskProviderId, number>;
  for (const p of PANFIND_SEARCH_PROVIDER_IDS) {
    acc[p] = items.filter((i) => i.diskProvider === p).length;
  }
  return acc;
}

function countByCategory(items: ResourceItem[]): Record<ResourceCategory, number> {
  const cats: ResourceCategory[] = [
    'all',
    'video',
    'doc',
    'software',
    'music',
    'game',
    'archive',
    'other',
  ];
  return cats.reduce(
    (acc, c) => {
      acc[c] =
        c === 'all' ? items.length : items.filter((i) => i.category === c).length;
      return acc;
    },
    {} as Record<ResourceCategory, number>
  );
}

export function emptyPanfindResponse(page: number, pageSize: number): SearchResultResponse {
  return {
    items: [],
    total: 0,
    page,
    pageSize,
    hasMore: false,
    tookMs: 0,
    providersCount: countByProvider([]),
    categoriesCount: countByCategory([]),
    stats: { totalIndexed: 0, validRate: 0, indexedToday: 0 },
    demoMode: true,
    modeLabel: '等待搜索',
  };
}

export function adaptPanfindResponse(
  raw: PanFindSearchResponse,
  filter: SearchFilter,
  page: number,
  pageSize: number
): SearchResultResponse {
  const mapped = raw.results.map(hitToResource);
  const filtered = applyClientFilters(mapped, filter);
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const items = filtered.slice(start, start + pageSize);

  return {
    items,
    total,
    page,
    pageSize,
    hasMore: start + pageSize < total,
    tookMs: raw.tookMs,
    providersCount: countByProvider(filtered),
    categoriesCount: countByCategory(filtered),
    stats: {
      totalIndexed: total,
      validRate: total ? 98 : 0,
      indexedToday: total,
    },
    demoMode: raw.demoMode,
    modeLabel: raw.modeLabel,
    sourceStats: raw.sourceStats,
  };
}

function clientHeaders(): Record<string, string> {
  try {
    const id = localStorage.getItem('panfind.clientId');
    return id ? { 'X-Panfind-Client': id } : {};
  } catch {
    return {};
  }
}

export async function fetchPanfindSearch(
  baseUrl: string,
  filter: SearchFilter,
  timeoutMs: number,
  options?: { forceRefresh?: boolean }
): Promise<PanFindSearchResponse> {
  const q = filter.query.trim();
  if (!q) {
    throw new Error('MISSING_QUERY');
  }

  const params = new URLSearchParams({ kw: q });
  const ct = cloudTypesParam(filter.selectedProviders);
  if (ct) params.set('cloud_types', ct);
  if (options?.forceRefresh) params.set('refresh', '1');

  const url = `${baseUrl.replace(/\/$/, '')}?${params}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      credentials: 'include',
      headers: clientHeaders(),
    });
    const data = (await resp.json()) as PanFindSearchResponse & {
      error?: string;
      code?: string;
      points?: import('../types/auth').PointsStatus;
    };
    if (resp.status === 402) {
      const err = new Error(data.error || '今日额度不足') as Error & {
        code?: string;
        points?: import('../types/auth').PointsStatus;
      };
      err.code = data.code || 'INSUFFICIENT_POINTS';
      err.points = data.points;
      (err as Error & { paywall?: boolean }).paywall = Boolean(
        (data as { paywall?: boolean }).paywall
      );
      throw err;
    }
    if (!resp.ok) {
      throw new Error(data.error || `HTTP ${resp.status}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

export interface ResolvedShareMeta {
  fileCount: number;
  sizeBytes: number;
  partial: boolean;
  provider: string;
  error?: string;
}

export async function fetchShareMetadata(
  items: Array<{ shareUrl: string; extractCode?: string }>
): Promise<Record<string, ResolvedShareMeta>> {
  const candidates = items
    .filter(
      (item) =>
        /pan\.quark\.cn\/s\/|(?:drive|pan)\.uc\.cn\/s\//i.test(item.shareUrl)
    )
    .slice(0, 12);
  if (!candidates.length) return {};

  const resp = await fetch('/api/share-meta/batch', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items: candidates.map((item) => ({
        url: item.shareUrl,
        password: item.extractCode || '',
      })),
    }),
  });
  if (!resp.ok) return {};
  const body = (await resp.json()) as {
    metadata?: Record<string, ResolvedShareMeta>;
  };
  return body.metadata || {};
}
