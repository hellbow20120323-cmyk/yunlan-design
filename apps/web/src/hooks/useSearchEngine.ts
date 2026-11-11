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
import { applyShareMeta, fetchShareMetadata, isSharePreviewUrl } from '../services/gatewayAdapter';
import { STORAGE_KEYS } from '../utils/storage';
import { PointsStatus } from '../types/auth';

const HISTORY_STORAGE_KEY = STORAGE_KEYS.searchHistory;
const FAVORITES_STORAGE_KEY = STORAGE_KEYS.favorites;

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
  /** 只有提交过检索才切到结果页布局；输入/点海报填词不挪搜索框 */
  const [hasSearched, setHasSearched] = useState(() =>
    Boolean(getInitialFilterFromURL().query.trim())
  );
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

  // 始终指向最新 filter，供事件处理函数读取，避免在 setState 更新器里触发副作用
  const filterRef = useRef<SearchFilter>(filter);
  filterRef.current = filter;
  // 请求序号：用户连点筛选时，只采用最后一次请求的结果，丢弃过期响应
  const seqRef = useRef(0);

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
    const seq = ++seqRef.current;
    setLoading(true);
    setError(null);
    syncToURL(currentFilter);

    try {
      const res = await SearchService.executeSearch(currentFilter, targetPage, 10, executeOptions);
      if (seq !== seqRef.current) return; // 已有更新的请求，丢弃本次结果
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

      // 先展示搜索结果，再异步补全夸克/UC/阿里云盘公开分享的文件数、体积与目录预览。
      // 元数据请求不重复搜索，也不额外扣点；翻页新增的条目同样补全。
      if (res.items.length > 0) {
        const pendingUrls = new Set(res.items.map((item) => item.shareUrl));
        void fetchShareMetadata(res.items)
          .then((metadata) => {
            setResponse((current) => {
              if (!current) return current;
              return {
                ...current,
                items: current.items.map((item) => {
                  const meta = metadata[item.shareUrl];
                  if (meta) return applyShareMeta(item, meta);
                  return item;
                }),
              };
            });
          })
          .catch(() => {
            setResponse((current) => {
              if (!current) return current;
              return {
                ...current,
                items: current.items.map((item) => {
                  if (!pendingUrls.has(item.shareUrl)) return item;
                  if (item.sharePreview) return item;
                  if (!isSharePreviewUrl(item.shareUrl)) {
                    return item;
                  }
                  return {
                    ...item,
                    sharePreview: { status: 'error', error: '目录预览暂时不可用' },
                  };
                }),
              };
            });
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
      if (seq !== seqRef.current) return;
      const e = err as Error & { code?: string; points?: PointsStatus; paywall?: boolean };
      if (e?.points && onPointsUpdate) onPointsUpdate(e.points);
      const msg = e instanceof Error ? e.message : '搜索执行失败，请检查网络或后端接口';
      setError(msg);
      if (e?.code === 'INSUFFICIENT_POINTS') {
        setResponse(null);
        if (onPaywall) onPaywall(msg);
      }
    } finally {
      if (seq === seqRef.current) setLoading(false);
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
    setFilter((prev) => ({ ...prev, query: newQuery }));
    if (!newQuery.trim()) setHasSearched(false);
  }, []);

  const handleSearchSubmit = useCallback(
    (q?: string, executeOptions?: SearchExecuteOptions) => {
      const targetQ = q !== undefined ? q : filter.query;
      if (!targetQ.trim()) return;
      const nextFilter = { ...filter, query: targetQ };
      setFilter(nextFilter);
      setHasSearched(true);
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

  /**
   * 统一的筛选变更入口：基于最新 filter 计算下一个状态，并在 setState 之外触发检索。
   * （原先在 setFilter 更新器里调用 triggerSearch，更新器应是纯函数，
   *  严格模式 / 并发渲染下会重复触发请求。）
   * 仅改变分类、排序、时间等本地条件时，searchService 会命中网关结果缓存，不请求、不扣积分。
   */
  const applyFilterChange = useCallback(
    (compute: (prev: SearchFilter) => SearchFilter) => {
      const next = compute(filterRef.current);
      filterRef.current = next;
      setFilter(next);
      triggerSearch(next, 1, false);
    },
    [triggerSearch]
  );

  const toggleProvider = useCallback(
    (providerId: DiskProviderId) => {
      applyFilterChange((prev) => {
        const exists = prev.selectedProviders.includes(providerId);
        let updated: DiskProviderId[];
        if (exists) {
          updated = prev.selectedProviders.filter((p) => p !== providerId);
          // 至少保留一个网盘
          if (updated.length === 0) updated = [providerId];
        } else {
          updated = [...prev.selectedProviders, providerId];
        }
        return { ...prev, selectedProviders: updated };
      });
    },
    [applyFilterChange]
  );

  const selectAllProviders = useCallback(() => {
    applyFilterChange((prev) => ({ ...prev, selectedProviders: [...SEARCH_PROVIDER_IDS] }));
  }, [applyFilterChange]);

  const invertProviders = useCallback(() => {
    applyFilterChange((prev) => {
      const inverted = SEARCH_PROVIDER_IDS.filter((p) => !prev.selectedProviders.includes(p));
      return {
        ...prev,
        selectedProviders: inverted.length > 0 ? inverted : [...SEARCH_PROVIDER_IDS],
      };
    });
  }, [applyFilterChange]);

  const setCategory = useCallback(
    (category: ResourceCategory) => applyFilterChange((prev) => ({ ...prev, category })),
    [applyFilterChange]
  );

  const setSortBy = useCallback(
    (sortBy: SortOption) => applyFilterChange((prev) => ({ ...prev, sortBy })),
    [applyFilterChange]
  );

  const setTimeRange = useCallback(
    (timeRange: TimeRangeOption) => applyFilterChange((prev) => ({ ...prev, timeRange })),
    [applyFilterChange]
  );

  const setOnlyValid = useCallback(
    (onlyValid: boolean) => applyFilterChange((prev) => ({ ...prev, onlyValid })),
    [applyFilterChange]
  );

  const setSizeRange = useCallback(
    (minSizeMb: number, maxSizeMb?: number) =>
      applyFilterChange((prev) => ({
        ...prev,
        minSizeMb: Math.max(0, minSizeMb),
        maxSizeMb: maxSizeMb != null && maxSizeMb > 0 ? maxSizeMb : undefined,
      })),
    [applyFilterChange]
  );

  const clearSearch = useCallback(() => {
    setResponse(null);
    setError(null);
    setHasSearched(false);
    setSelectedItemIds(new Set());
    setFilter((prev) => {
      const next = { ...prev, query: '' };
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
    hasSearched,
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
