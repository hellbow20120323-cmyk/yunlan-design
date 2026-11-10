export type TrendingKind = 'featured' | 'movie' | 'tv' | 'latest';

export interface TrendingHotItem {
  id: string;
  title: string;
  keyword: string;
  imageUrl: string;
  kind?: TrendingKind;
}

export interface TrendingHotRelease {
  releaseTitle: string;
  tags: string[];
  uploader?: string;
}

export interface TrendingHotListItem {
  id: string;
  title: string;
  keyword: string;
  imageUrl: string;
  releases: TrendingHotRelease[];
}

export interface TrendingHotResponse {
  ok: boolean;
  dayKey: string;
  fetchedAt: string;
  timezone: string;
  hotList?: TrendingHotListItem[];
  items: TrendingHotItem[];
  latest: TrendingHotItem[];
  movies: TrendingHotItem[];
  tv: TrendingHotItem[];
  /** 剧集来源标记，如 douban+subhd */
  tvSource?: string;
  stale?: boolean;
  refreshError?: string;
}
