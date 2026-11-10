/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  SearchFilter, 
  SearchResultResponse, 
  ResourceItem, 
  DiskProviderId, 
  ResourceCategory,
  SortOption,
  TimeRangeOption,
  SearchHistoryItem,
  SearchExecuteOptions,
} from '../types';
import { SEARCH_PROVIDER_IDS } from '../constants/providers';
import { SearchService } from '../services/searchService';
import { fetchShareMetadata } from '../services/gatewayAdapter';
import { STORAGE_KEYS } from '../utils/storage';
import { PointsStatus } from '../types/auth';

const HISTORY_STORAGE_KEY = STORAGE_KEYS.searchHistory;
const FAVORITES_STORAGE_KEY = STORAGE_KEYS.favorites;

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

export function useSearchEngine(
  onPointsUpdate?: (points: PointsStatus) => void,
  onPaywall?: (message: string) => void
) {
  // 1. Initial State from URL params if present
  const getInitialFilterFromURL = (): SearchFilter => {
    const params = new URLSearchParams(window.location.search);
    const query = params.get('q') || params.get('kw') || '';
    const category = (params.get('cat') as ResourceCategory) || 'all';
    const sortBy = (params.get('sort') as SortOption) || 'relevance';
    const timeRange = (params.get('time') as TimeRangeOption) || 'all';
    const onlyValid = params.get('valid') === '1';
    
    const provParam = params.get('providers');
    let selectedProviders: DiskProviderId[] = [...SEARCH_PROVIDER_IDS];
    if (provParam) {
      const parsed = provParam.split(',') as DiskProviderId[];
      if (parsed.length > 0) {
        selectedProviders = parsed;
      }
    }

    return {
      query,
      selectedProviders,
      category,
      sortBy,
      timeRange,
      onlyValid,
    };
  };

  const [filter, setFilter] = useState<SearchFilter>(getInitialFilterFromURL);
  const [response, setResponse] = useState<SearchResultResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState<number>(1);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  
  // Batch selection
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());

  // Search History
  const [history, setHistory] = useState<SearchHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Favorites
  const [favorites, setFavorites] = useState<ResourceItem[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const abortRef = useRef<boolean>(false);

  // Sync to URL
  const syncToURL = useCallback((currentFilter: SearchFilter) => {
    const params = new URLSearchParams();
    if (currentFilter.query) params.set('q', currentFilter.query);
    if (currentFilter.category !== 'all') params.set('cat', currentFilter.category);
    if (currentFilter.sortBy !== 'relevance') params.set('sort', currentFilter.sortBy);
    if (currentFilter.timeRange !== 'all') params.set('time', currentFilter.timeRange);
    if (currentFilter.onlyValid) params.set('valid', '1');
    if (
      currentFilter.selectedProviders.length > 0 &&
      currentFilter.selectedProviders.length < SEARCH_PROVIDER_IDS.length
    ) {
      params.set('providers', currentFilter.selectedProviders.join(','));
    }

    const newUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }, []);

  // Perform search
  const triggerSearch = useCallback(
    async (
      customFilter?: SearchFilter,
      targetPage = 1,
      append = false,
      executeOptions?: SearchExecuteOptions
    ) => {
    const currentFilter = customFilter || filter;
    setLoading(true);
    setError(null);
    syncToURL(currentFilter);

    try {
      const res = await SearchService.executeSearch(currentFilter, targetPage, 10, executeOptions);
      if (res.points && onPointsUpdate) onPointsUpdate(res.points);

      if (append && response) {
        setResponse({
          ...res,
          items: [...response.items, ...res.items],
        });
      } else {
        setResponse(res);
      }
      setPage(targetPage);

      // 先展示搜索结果，再异步递归统计夸克/UC 分享中的文件数与总体积。
      // 元数据请求不重复搜索，也不额外扣点。
      if (!append && res.items.length > 0) {
        void fetchShareMetadata(res.items)
          .then((metadata) => {
            if (!Object.keys(metadata).length) return;
            setResponse((current) => {
              if (!current || current.page !== targetPage) return current;
              return {
                ...current,
                items: current.items.map((item) => {
                  const meta = metadata[item.shareUrl];
                  if (!meta || meta.error) return item;
                  const sizeBytes = meta.sizeBytes || item.sizeBytes;
                  return {
                    ...item,
                    totalFiles: meta.fileCount || item.totalFiles,
                    sizeBytes,
                    sizeFormatted: formatBytes(sizeBytes),
                    metaPartial: meta.partial,
                  };
                }),
              };
            });
          })
          .catch(() => {
            // 搜索结果仍可正常使用；元数据解析失败时保留上游已有信息。
          });
      }

      // Record to history if query exists
      if (currentFilter.query.trim()) {
        setHistory(prev => {
          const filtered = prev.filter(h => h.query.toLowerCase() !== currentFilter.query.toLowerCase());
          const updated = [
            {
              id: Date.now().toString(),
              query: currentFilter.query.trim(),
              timestamp: Date.now(),
              resultsCount: res.total,
              category: currentFilter.category,
            },
            ...filtered
          ].slice(0, 15);
          localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err: unknown) {
      const e = err as Error & { code?: string; points?: PointsStatus; paywall?: boolean };
      if (e?.points && onPointsUpdate) onPointsUpdate(e.points);
      const msg = e instanceof Error ? e.message : '搜索执行失败，请检查网络或后端接口';
      setError(msg);
      if (e?.code === 'INSUFFICIENT_POINTS') {
        setResponse(null);
        if (onPaywall) onPaywall(msg);
      }
    } finally {
      setLoading(false);
    }
  },
    [filter, response, syncToURL, onPointsUpdate, onPaywall]
  );

  // 深链带关键词时自动检索；空关键词不请求网关
  useEffect(() => {
    if (filter.query.trim()) {
      triggerSearch(filter, 1, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filter setters
  const setQuery = useCallback((newQuery: string) => {
    setFilter(prev => {
      const next = { ...prev, query: newQuery };
      return next;
    });
  }, []);

  const handleSearchSubmit = useCallback(
    (q?: string, executeOptions?: SearchExecuteOptions) => {
      const targetQ = q !== undefined ? q : filter.query;
      if (!targetQ.trim()) return;
      const nextFilter = { ...filter, query: targetQ };
      setFilter(nextFilter);
      setSelectedItemIds(new Set());
      triggerSearch(nextFilter, 1, false, executeOptions);
    },
    [filter, triggerSearch]
  );

  const handleForceRefreshSearch = useCallback(() => {
    if (!filter.query.trim()) return;
    setSelectedItemIds(new Set());
    triggerSearch(filter, 1, false, { forceRefresh: true });
  }, [filter, triggerSearch]);

  const toggleProvider = useCallback((providerId: DiskProviderId) => {
    setFilter(prev => {
      const exists = prev.selectedProviders.includes(providerId);
      let updated: DiskProviderId[];
      if (exists) {
        // If it's the last one, don't allow 0, or toggle back to all
        updated = prev.selectedProviders.filter(p => p !== providerId);
        if (updated.length === 0) {
          updated = [providerId]; // keep at least one
        }
      } else {
        updated = [...prev.selectedProviders, providerId];
      }
      const next = { ...prev, selectedProviders: updated };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const selectAllProviders = useCallback(() => {
    setFilter(prev => {
      const next = { ...prev, selectedProviders: [...SEARCH_PROVIDER_IDS] };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const invertProviders = useCallback(() => {
    setFilter(prev => {
      const inverted = SEARCH_PROVIDER_IDS.filter((p) => !prev.selectedProviders.includes(p));
      const next = {
        ...prev,
        selectedProviders: inverted.length > 0 ? inverted : [...SEARCH_PROVIDER_IDS],
      };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const setCategory = useCallback((category: ResourceCategory) => {
    setFilter(prev => {
      const next = { ...prev, category };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const setSortBy = useCallback((sortBy: SortOption) => {
    setFilter(prev => {
      const next = { ...prev, sortBy };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const setTimeRange = useCallback((timeRange: TimeRangeOption) => {
    setFilter(prev => {
      const next = { ...prev, timeRange };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const setOnlyValid = useCallback((onlyValid: boolean) => {
    setFilter(prev => {
      const next = { ...prev, onlyValid };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const setSizeRange = useCallback((minSizeMb: number, maxSizeMb?: number) => {
    setFilter(prev => {
      const next = {
        ...prev,
        minSizeMb: Math.max(0, minSizeMb),
        maxSizeMb: maxSizeMb != null && maxSizeMb > 0 ? maxSizeMb : undefined,
      };
      triggerSearch(next, 1, false);
      return next;
    });
  }, [triggerSearch]);

  const clearSearch = useCallback(() => {
    setResponse(null);
    setError(null);
    setSelectedItemIds(new Set());
    setFilter((prev) => {
      const next = { ...prev, query: '' };
      const params = new URLSearchParams();
      window.history.replaceState({}, '', window.location.pathname);
      return next;
    });
  }, []);

  const loadMore = useCallback(() => {
    if (loading || !response?.hasMore) return;
    const nextPage = page + 1;
    triggerSearch(filter, nextPage, true);
  }, [loading, response, page, triggerSearch, filter]);

  // History controls
  const clearHistory = useCallback(() => {
    setHistory([]);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory(prev => {
      const updated = prev.filter(h => h.id !== id);
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  // Favorites controls
  const toggleFavorite = useCallback((item: ResourceItem) => {
    setFavorites(prev => {
      const exists = prev.some(f => f.id === item.id);
      let updated: ResourceItem[];
      if (exists) {
        updated = prev.filter(f => f.id !== item.id);
      } else {
        updated = [item, ...prev];
      }
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const isFavorite = useCallback((itemId: string) => {
    return favorites.some(f => f.id === itemId);
  }, [favorites]);

  // Selection for batch actions
  const toggleSelectItem = useCallback((id: string) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    if (!response) return;
    setSelectedItemIds(new Set(response.items.map(i => i.id)));
  }, [response]);

  const clearSelection = useCallback(() => {
    setSelectedItemIds(new Set());
  }, []);

  return {
    filter,
    setQuery,
    handleSearchSubmit,
    handleForceRefreshSearch,
    toggleProvider,
    selectAllProviders,
    invertProviders,
    setCategory,
    setSortBy,
    setTimeRange,
    setOnlyValid,
    setSizeRange,
    clearSearch,
    response,
    loading,
    error,
    page,
    loadMore,
    viewMode,
    setViewMode,
    history,
    clearHistory,
    removeHistoryItem,
    favorites,
    toggleFavorite,
    isFavorite,
    selectedItemIds,
    toggleSelectItem,
    selectAllVisible,
    clearSelection,
    refreshSearch: handleForceRefreshSearch,
  };
}
