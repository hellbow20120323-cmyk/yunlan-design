/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DiskProviderId = 
  | 'quark'     // 夸克网盘
  | 'aliyun'    // 阿里云盘
  | 'baidu'     // 百度网盘
  | 'xunlei'    // 迅雷云盘
  | 'pan123'    // 123云盘
  | 'tianyi'    // 天翼云盘
  | 'pan115'    // 115网盘
  | 'uc'        // UC网盘
  | 'mobile'    // 移动云盘
  | 'lanzou'    // 蓝奏云
  | 'magnet';   // 磁力链接

export interface DiskProviderInfo {
  id: DiskProviderId;
  name: string;
  shortName: string;
  color: string;
  badgeBg: string;
  badgeText: string;
  borderColor: string;
  officialUrl: string;
  description: string;
  features: string[];
  supportedFormats: string[];
  speedRating: '极速' | '高速' | '标准';
}

export type ResourceCategory = 
  | 'all'       // 全部
  | 'video'     // 影视视频
  | 'doc'       // 学习文档
  | 'software'  // 软件应用
  | 'music'     // 音乐音频
  | 'game'      // 游戏娱乐
  | 'archive'   // 压缩合集
  | 'other';    // 其他资源

export type SortOption = 
  | 'relevance'   // 综合排序
  | 'date_desc'   // 最新发布
  | 'size_desc'   // 文件由大到小
  | 'size_asc'    // 文件由小到大
  | 'hot_desc';   // 热度优先

export type TimeRangeOption = 
  | 'all'         // 全部时间
  | 'day'         // 24小时内
  | 'week'        // 7天内
  | 'month'       // 1个月内
  | 'year';       // 1年内

export interface FileItem {
  name: string;
  sizeBytes: number;
  sizeFormatted: string;
  extension: string;
  type: ResourceCategory;
}

export interface ResourceItem {
  id: string;
  title: string;
  description: string;
  diskProvider: DiskProviderId;
  category: ResourceCategory;
  sizeBytes: number;
  sizeFormatted: string;
  updatedAt: string;          // ISO date or formatted date (e.g., 2026-03-24)
  createdAt: string;
  shareUrl: string;
  extractCode: string;        // 提取码 (empty if no code)
  isValid: boolean;           // 链接是否有效
  healthScore: number;        // 0 - 100 (有效性及转存成功率)
  totalFiles: number;
  metaPartial?: boolean;      // 文件数或体积为采样/未完全递归
  fileTree?: FileItem[];      // 内部文件清单预览
  tags: string[];
  viewsCount: number;
  savesCount: number;
  uploader?: string;
  /** 聚合来源标识，如 pansou 插件 / tg:频道 */
  source?: string;
  /** 上游备注或资源说明 */
  note?: string;
}

export interface SearchFilter {
  query: string;
  selectedProviders: DiskProviderId[];
  category: ResourceCategory;
  sortBy: SortOption;
  timeRange: TimeRangeOption;
  onlyValid: boolean;
  minSizeMb?: number;
  maxSizeMb?: number;
}

/** 单次检索选项（不写入 URL / filter 持久态） */
export interface SearchExecuteOptions {
  /** 跳过 PanSou 等上游磁盘/内存缓存，重新聚合 */
  forceRefresh?: boolean;
}

export interface SearchResultResponse {
  items: ResourceItem[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  tookMs: number;
  providersCount: Record<DiskProviderId, number>;
  categoriesCount: Record<ResourceCategory, number>;
  stats: {
    totalIndexed: number;
    validRate: number;
    indexedToday: number;
  };
  /** PanFind 网关 */
  demoMode?: boolean;
  modeLabel?: string;
  sourceStats?: Record<string, unknown>;
  points?: import('./auth').PointsStatus;
}

export interface SearchHistoryItem {
  id: string;
  query: string;
  timestamp: number;
  resultsCount?: number;
  category?: ResourceCategory;
}

export interface HotSearchKeyword {
  keyword: string;
  heat: number;
  tag?: '热门' | '新上' | '精选';
  category: ResourceCategory;
}

export interface BackendApiConfig {
  useCustomBackend: boolean;
  endpointUrl: string;
  apiKey: string;
  timeoutMs: number;
  mockFallbackOnError: boolean;
}
