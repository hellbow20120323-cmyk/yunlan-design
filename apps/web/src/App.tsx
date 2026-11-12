/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useSearchEngine } from './hooks/useSearchEngine';
import { Header } from './components/Header';
import { MobileBottomNav } from './components/MobileBottomNav';
import { HeroSearch } from './components/HeroSearch';
import { HotTrendGrid } from './components/HotTrendGrid';
import { HomeKeywordSidebar } from './components/HomeKeywordSidebar';
import { FilterBar } from './components/FilterBar';
import { SearchRefinePanel } from './components/SearchRefinePanel';
import { SearchResultsTable } from './components/SearchResultsTable';
import { DiskNavigationGrid } from './components/DiskNavigationGrid';
import { HotSearchAndRankings } from './components/HotSearchAndRankings';
import { UsageGuide } from './components/UsageGuide';
import { BatchActionBar } from './components/BatchActionBar';
import { Footer } from './components/Footer';
import { Toast } from './components/Toast';
import { ResourceItem, DiskProviderId, ResourceCategory } from './types';
import { SearchX, ArrowDown } from 'lucide-react';
import { useAuth } from './hooks/useAuth';
import { useVisualViewportKeyboard } from './hooks/useVisualViewportKeyboard';
import { usePageSeo } from './hooks/usePageSeo';
import { STORAGE_KEYS } from './utils/storage';
import { useTrendingHot } from './hooks/useTrendingHot';
import { useSiteConfig } from './hooks/useSiteConfig';
import { ToolsPage, ToolGrid, ToolSlug, toolPath } from './components/tools/ToolsPage';
import { shuffleCopy } from './utils/shuffle';

// 弹窗与抽屉按需加载：首屏不需要，首次打开时才下载对应代码
const ResourceDetailModal = lazy(() =>
  import('./components/ResourceDetailModal').then((m) => ({ default: m.ResourceDetailModal }))
);
const FavoritesDrawer = lazy(() =>
  import('./components/FavoritesDrawer').then((m) => ({ default: m.FavoritesDrawer }))
);
const AuthModal = lazy(() => import('./components/AuthModal').then((m) => ({ default: m.AuthModal })));
const PaywallModal = lazy(() =>
  import('./components/PaywallModal').then((m) => ({ default: m.PaywallModal }))
);

type TabId = 'search' | 'providers' | 'rankings' | 'guide' | 'tools';

interface AppProps {
  initialTab?: TabId;
  initialTool?: string;
}

export default function App({ initialTab = 'search', initialTool }: AppProps = {}) {
  const auth = useAuth();
  const { searchEnabled } = useSiteConfig();
  const trendingHot = useTrendingHot(searchEnabled);

  const hotSpotlightPosters = useMemo(() => {
    const movies = trendingHot.data?.movies ?? [];
    const tv = trendingHot.data?.tv ?? [];
    const picked = [...movies.slice(0, 5), ...tv.slice(0, 5)];
    const seen = new Set<string>();
    return picked.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [trendingHot.data]);

  const suggestKeywords = useMemo(() => {
    const movies = trendingHot.data?.movies ?? [];
    const tv = trendingHot.data?.tv ?? [];
    return [...movies, ...tv]
      .flatMap((item) => [item.keyword, item.title])
      .filter((text): text is string => Boolean(text));
  }, [trendingHot.data]);

  /** 底部海报墙：随机打乱后两边取相同条数，避免剧集明显少于电影 */
  const { bottomMoviesShuffled, bottomTvShuffled } = useMemo(() => {
    const movies = shuffleCopy(trendingHot.data?.movies ?? []);
    const tv = shuffleCopy(trendingHot.data?.tv ?? []);
    const n = Math.min(movies.length, tv.length);
    if (!n) return { bottomMoviesShuffled: movies, bottomTvShuffled: tv };
    return { bottomMoviesShuffled: movies.slice(0, n), bottomTvShuffled: tv.slice(0, n) };
  }, [trendingHot.data?.fetchedAt, trendingHot.data?.movies, trendingHot.data?.tv]);

  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isPaywallOpen, setIsPaywallOpen] = useState(false);
  const [paywallReason, setPaywallReason] = useState('');
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem(STORAGE_KEYS.theme, 'light');
  }, []);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [toolTarget, setToolTarget] = useState<string | undefined>(initialTool);

  // 搜索入口关闭时，不允许停留在网盘/榜单页
  useEffect(() => {
    if (!searchEnabled && (activeTab === 'providers' || activeTab === 'rankings')) {
      setActiveTab('search');
    }
  }, [searchEnabled, activeTab]);

  // Search Engine state hook
  const {
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
    loadMore,
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
  } = useSearchEngine(auth.applyPoints, (msg) => {
    setPaywallReason(msg);
    setIsPaywallOpen(true);
  });

  usePageSeo(
    hasSearched ? filter.query : '',
    response && hasSearched ? response.total : null,
    searchEnabled
  );

  // 搜索入口关闭后不再停留或筛选影视/音乐/游戏类目
  useEffect(() => {
    if (
      !searchEnabled &&
      ['video', 'music', 'game'].includes(filter.category)
    ) {
      setCategory('all');
    }
  }, [searchEnabled, filter.category, setCategory]);

  // Modals & Drawers state
  const [detailItem, setDetailItem] = useState<ResourceItem | null>(null);
  const resolvedDetail = detailItem
    ? response?.items.find((entry) => entry.id === detailItem.id) ?? detailItem
    : null;
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const keyboardOpen = useVisualViewportKeyboard();
  const [minSizeUnit, setMinSizeUnit] = useState<'MB' | 'GB'>('MB');
  const [maxSizeUnit, setMaxSizeUnit] = useState<'MB' | 'GB'>('GB');

  const maxSizeGb =
    filter.maxSizeMb != null && filter.maxSizeMb > 0 ? filter.maxSizeMb / 1024 : null;

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Focus search on '/' or 'Ctrl+K' / 'Cmd+K'
      if ((e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') ||
          ((e.ctrlKey || e.metaKey) && e.key === 'k')) {
        e.preventDefault();
        setActiveTab('search');
        searchInputRef.current?.focus();
      }

      // Close modals on Esc
      if (e.key === 'Escape') {
        setDetailItem(null);
        setIsFavoritesOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleShowToast = (msg: string) => {
    setToastMessage(msg);
  };

  // Selected items array for batch action bar
  const selectedItems = response 
    ? response.items.filter(item => selectedItemIds.has(item.id)) 
    : [];

  const handleSearchProviderFromGrid = (providerId: DiskProviderId) => {
    toggleProvider(providerId);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectKeywordFromRankings = (keyword: string, category?: ResourceCategory) => {
    setQuery(keyword);
    if (category) setCategory(category);
    handleSearchSubmit(keyword);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** 影片海报：只把片名填进搜索框，等用户点「搜索」再检索 */
  const fillSearchFromPoster = useCallback(
    (keyword: string) => {
      setQuery(keyword);
      setActiveTab('search');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      window.setTimeout(() => {
        searchInputRef.current?.focus({ preventScroll: true });
      }, 200);
    },
    [setQuery]
  );

  const handleGoHome = () => {
    setActiveTab('search');
    setToolTarget(undefined);
    clearSearch();
    setDetailItem(null);
    clearSelection();
    setIsFavoritesOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    searchInputRef.current?.blur();
  };

  const handleNavigateTab = (tab: TabId) => {
    if (tab === 'search') {
      handleGoHome();
      return;
    }
    if (tab === 'tools') {
      setToolTarget(undefined);
    }
    setActiveTab(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenTool = (slug: ToolSlug) => {
    setToolTarget(slug);
    setActiveTab('tools');
    window.history.pushState(null, '', toolPath(slug));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-dvh flex flex-col bg-yunlan-ivory text-yunlan-ink transition-colors duration-200 pb-[calc(3.75rem+env(safe-area-inset-bottom))] md:pb-0">
      
      {/* Toast Feedback */}
      <Toast message={toastMessage} onClose={() => setToastMessage(null)} />

      {/* Top Bar Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={handleNavigateTab}
        onGoHome={handleGoHome}
        onOpenFavorites={() => setIsFavoritesOpen(true)}
        favoritesCount={favorites.length}
        user={auth.user}
        points={auth.points}
        authLoading={auth.loading}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={() => auth.logout()}
        onOpenPaywall={
          searchEnabled
            ? () => {
                setPaywallReason('今日积分已用完，选择套餐开通 VIP 后可继续搜索');
                setIsPaywallOpen(true);
              }
            : undefined
        }
        searchEnabled={searchEnabled}
        onOpenTool={handleOpenTool}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8">
        
        {/* TAB 1: Search View */}
        {activeTab === 'search' && (
          <div className="py-2">
            <div
              className={
                !hasSearched
                  ? 'flex flex-col lg:flex-row lg:items-start gap-6 lg:gap-10 xl:gap-12'
                  : ''
              }
            >
              <div className="flex-1 min-w-0">
            {/* Hero Search Box */}
            <HeroSearch
              query={filter.query}
              onQueryChange={setQuery}
              onSearch={handleSearchSubmit}
              compact={hasSearched}
              loading={loading}
              suggestKeywords={suggestKeywords}
              history={history}
              onSelectHistory={(q) => {
                setQuery(q);
                handleSearchSubmit(q);
              }}
              onClearHistory={clearHistory}
              onRemoveHistoryItem={removeHistoryItem}
              inputRef={searchInputRef}
              searchEnabled={searchEnabled}
            />

            {!hasSearched && !searchEnabled && (
              <div className="mt-2 mb-6">
                <ToolGrid onOpen={handleOpenTool} />
                <p className="mt-3 text-center text-[11px] text-yunlan-muted">
                  全部工具在浏览器本地运行，输入内容不会上传服务器。
                </p>
              </div>
            )}

            {!hasSearched && searchEnabled && (
              <HomeKeywordSidebar
                className="mt-3 lg:hidden"
                onPickKeyword={(keyword, category) => {
                  setQuery(keyword);
                  setCategory(category);
                  handleSearchSubmit(keyword);
                }}
              />
            )}

            {!hasSearched && searchEnabled && (
            <HotTrendGrid
              className="mt-6 sm:mt-8"
              singleRow
              items={hotSpotlightPosters}
              loading={trendingHot.loading}
              maxItems={10}
              title="热门精选"
              onPickKeyword={fillSearchFromPoster}
            />
            )}

            {hasSearched && (
            <div className="mt-4 space-y-3">
              <SearchRefinePanel
                selectedProviders={filter.selectedProviders}
                onToggleProvider={toggleProvider}
                providersCount={response?.providersCount}
                minSizeMb={filter.minSizeMb ?? 0}
                maxSizeGb={maxSizeGb}
                minUnit={minSizeUnit}
                maxUnit={maxSizeUnit}
                onMinSizeChange={(mb, unit) => {
                  setMinSizeUnit(unit);
                  setSizeRange(mb, filter.maxSizeMb);
                }}
                onMaxSizeChange={(gbOrNull, unit) => {
                  setMaxSizeUnit(unit);
                  if (gbOrNull === null) {
                    setSizeRange(filter.minSizeMb ?? 0, undefined);
                    return;
                  }
                  const maxMb = Math.round(gbOrNull * 1024);
                  setSizeRange(filter.minSizeMb ?? 0, maxMb);
                }}
              />
              <FilterBar
                currentCategory={filter.category}
                onSelectCategory={setCategory}
                categoriesCount={response?.categoriesCount}
                currentSort={filter.sortBy}
                onSelectSort={setSortBy}
                currentTimeRange={filter.timeRange}
                onSelectTimeRange={setTimeRange}
                onlyValid={filter.onlyValid}
                onToggleOnlyValid={setOnlyValid}
                viewMode="list"
                onChangeViewMode={() => {}}
                hideViewSwitcher
                totalResults={response?.total || 0}
                tookMs={response?.tookMs || 0}
                modeLabel={response?.modeLabel}
                demoMode={response?.demoMode}
                searchEnabled={searchEnabled}
              />
            </div>
            )}

            {/* Results Section — 未提交检索时不占位，避免输入时首页跳动 */}
            {hasSearched ? (
            <div className="space-y-3 mt-3">
              
              {/* Error state */}
              {error && (
                <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400 text-xs">
                  <p className="font-semibold mb-1">搜索服务遇到问题：</p>
                  <p>{error}</p>
                </div>
              )}

              {/* Loading skeletons */}
              {loading && !response && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((n) => (
                    <div 
                      key={n} 
                      className="p-5 rounded-xl border border-yunlan-hairline bg-yunlan-surface space-y-3"
                    >
                      <div className="h-4 yl-skeleton rounded w-1/4" />
                      <div className="h-5 yl-skeleton rounded w-3/4" />
                      <div className="h-4 yl-skeleton rounded w-1/2" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty Results state */}
              {!loading && response && response.items.length === 0 && (
                <div className="py-16 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8">
                  <SearchX className="w-12 h-12 stroke-[1.5] mx-auto text-slate-400 mb-3" />
                  <h3 className="text-base font-bold text-slate-800 dark:text-slate-200">
                    未检索到符合条件的网盘资源
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-md mx-auto">
                    建议缩减筛选条件，取消特定格式或时间限制，或尝试搜索其他通用词汇（如简写名称）。
                  </p>
                  <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleForceRefreshSearch}
                      disabled={loading}
                      className="min-h-11 px-4 py-2 text-xs font-medium rounded-sm text-yunlan-stone border border-yunlan-hairline bg-yunlan-surface hover:shadow-yunlan-feather transition-all disabled:opacity-50"
                    >
                      强制刷新本次搜索
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        selectAllProviders();
                        setCategory('all');
                        setOnlyValid(false);
                      }}
                      className="min-h-11 px-4 py-2 text-xs font-semibold rounded-sm bg-yunlan-cta text-white transition-colors"
                    >
                      重置所有筛选条件
                    </button>
                  </div>
                </div>
              )}

              {response && response.items.length > 0 && (
                <SearchResultsTable
                  items={response.items}
                  query={filter.query}
                  total={response.total}
                  tookMs={response.tookMs}
                  modeLabel={response.modeLabel}
                  demoMode={response.demoMode}
                  sortBy={filter.sortBy}
                  onSelectSort={setSortBy}
                  onClose={() => {
                    clearSearch();
                    searchInputRef.current?.focus();
                  }}
                  onOpenDetail={(i) => setDetailItem(i)}
                  onToggleFavorite={toggleFavorite}
                  isFavorited={isFavorite}
                  onShowToast={handleShowToast}
                  onForceRefresh={handleForceRefreshSearch}
                  forceRefreshLoading={loading}
                  searchEnabled={searchEnabled}
                />
              )}

              {/* Load More Button */}
              {response && response.hasMore && (
                <div className="pt-6 pb-2 text-center">
                  <button
                    onClick={loadMore}
                    disabled={loading}
                    className="inline-flex items-center gap-2 min-h-11 px-6 py-2.5 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-yunlan-cinnabar/50 hover:bg-slate-50 dark:hover:bg-slate-850 shadow-xs transition-all disabled:opacity-50"
                  >
                    {loading ? (
                      <div className="w-3.5 h-3.5 border-2 border-yunlan-cinnabar border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-yunlan-cinnabar" />
                    )}
                    <span>加载更多搜索结果</span>
                  </button>
                </div>
              )}

            </div>
            ) : null}

            {!hasSearched && searchEnabled && (trendingHot.loading ||
              (trendingHot.data?.movies?.length ?? 0) > 0 ||
              (trendingHot.data?.tv?.length ?? 0) > 0) && (
              <section className="mt-10 sm:mt-12 pt-8 pb-6 border-t border-yunlan-hairline w-full max-w-[1100px] mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-5">
                  <HotTrendGrid
                    embedded
                    dense
                    fixedKind="movie"
                    items={[]}
                    movies={bottomMoviesShuffled}
                    tv={[]}
                    loading={trendingHot.loading}
                    maxItems={80}
                    title="热门电影"
                    onPickKeyword={fillSearchFromPoster}
                  />
                  <HotTrendGrid
                    embedded
                    className="md:pl-6"
                    dense
                    fixedKind="tv"
                    items={[]}
                    movies={[]}
                    tv={bottomTvShuffled}
                    loading={trendingHot.loading}
                    maxItems={80}
                    title="热门剧集"
                    onPickKeyword={fillSearchFromPoster}
                  />
                </div>
              </section>
            )}

              </div>

              {!hasSearched && searchEnabled && (
                <HomeKeywordSidebar
                  className="hidden lg:block lg:pt-4 shrink-0"
                  onPickKeyword={(keyword, category) => {
                    setQuery(keyword);
                    setCategory(category);
                    handleSearchSubmit(keyword);
                  }}
                />
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Providers Matrix */}
        {searchEnabled && activeTab === 'providers' && (
          <DiskNavigationGrid onSearchProvider={handleSearchProviderFromGrid} />
        )}

        {/* TAB 3: Hot Rankings */}
        {searchEnabled && activeTab === 'rankings' && (
          <HotSearchAndRankings onSelectKeyword={handleSelectKeywordFromRankings} />
        )}

        {/* TAB 4: Usage Guide */}
        {activeTab === 'guide' && (
          <UsageGuide searchEnabled={searchEnabled} />
        )}

        {/* TAB 5: Online Tools */}
        {activeTab === 'tools' && (
          <ToolsPage target={toolTarget} />
        )}

      </main>

      {/* Floating Batch Action Bar */}
      <BatchActionBar
        selectedCount={selectedItemIds.size}
        selectedItems={selectedItems}
        onClearSelection={clearSelection}
        onBatchFavorite={(items) => {
          items.forEach(toggleFavorite);
          clearSelection();
        }}
        onShowToast={handleShowToast}
      />

      <Suspense fallback={null}>
      {/* Resource Detail Modal */}
      {resolvedDetail && (
      <ResourceDetailModal
        item={resolvedDetail}
        onClose={() => setDetailItem(null)}
        onToggleFavorite={toggleFavorite}
        isFavorited={isFavorite(resolvedDetail.id)}
        onShowToast={handleShowToast}
      />
      )}

      {isAuthOpen && (
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLogin={async (e, p) => {
          await auth.login(e, p);
          handleShowToast('登录成功');
        }}
        onRegister={async (e, p) => {
          await auth.register(e, p);
          handleShowToast('注册成功');
        }}
      />
      )}

      {isPaywallOpen && (
      <PaywallModal
        isOpen={isPaywallOpen}
        onClose={() => setIsPaywallOpen(false)}
        user={auth.user}
        reason={paywallReason}
        onOpenAuth={() => {
          setIsPaywallOpen(false);
          setIsAuthOpen(true);
        }}
        onPaid={() => {
          auth.refresh();
          handleShowToast('VIP 已开通，可以畅搜啦');
        }}
      />
      )}

      {isFavoritesOpen && (
      <FavoritesDrawer
        isOpen={isFavoritesOpen}
        onClose={() => setIsFavoritesOpen(false)}
        favorites={favorites}
        onRemoveFavorite={toggleFavorite}
        onOpenDetail={(i) => setDetailItem(i)}
        onShowToast={handleShowToast}
      />
      )}
      </Suspense>

      <Footer onNavigateToTab={handleNavigateTab} searchEnabled={searchEnabled} />

      <MobileBottomNav
        activeTab={activeTab}
        onNavigate={handleNavigateTab}
        hidden={keyboardOpen}
        searchEnabled={searchEnabled}
      />

    </div>
  );
}
