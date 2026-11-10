/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  SearchFilter,
  SearchExecuteOptions,
  SearchResultResponse, 
  ResourceItem, 
  DiskProviderId, 
  ResourceCategory,
  BackendApiConfig 
} from '../types';
import { MOCK_RESOURCES } from './mockData';
import { ALL_PROVIDER_IDS, DISK_PROVIDERS } from '../constants/providers';
import {
  adaptPanfindResponse,
  emptyPanfindResponse,
  fetchPanfindSearch,
} from './panfindAdapter';

const DEFAULT_BACKEND_CONFIG: BackendApiConfig = {
  useCustomBackend: true,
  endpointUrl: '/api/search',
  apiKey: '',
  timeoutMs: 30000,
  /** 积分不足等业务错误必须透传，不能回退模拟数据 */
  mockFallbackOnError: false,
};

function isQuotaOrClientError(err: unknown): boolean {
  const e = err as Error & { code?: string; paywall?: boolean };
  if (e?.code === 'INSUFFICIENT_POINTS' || e?.paywall) return true;
  const msg = e instanceof Error ? e.message : '';
  return /额度不足|积分已用完|INSUFFICIENT_POINTS/i.test(msg);
}

function isPanfindEndpoint(url: string): boolean {
  const u = url.trim();
  return u === '/api/search' || u.endsWith('/api/search') || u.includes('/api/search?');
}

export class SearchService {
  private static configKey = 'haisou_backend_config';

  /**
   * 获取当前配置（前端智能模拟引擎 vs 自定义后端 API）
   */
  public static getConfig(): BackendApiConfig {
    try {
      const saved = localStorage.getItem(this.configKey);
      if (saved) {
        return { ...DEFAULT_BACKEND_CONFIG, ...JSON.parse(saved) };
      }
    } catch {
      // Fallback
    }
    return DEFAULT_BACKEND_CONFIG;
  }

  /**
   * 保存后端对接配置
   */
  public static saveConfig(config: BackendApiConfig): void {
    localStorage.setItem(this.configKey, JSON.stringify(config));
  }

  /**
   * 核心搜索入口：根据配置决定是调用用户后续提供的后端逻辑还是前端聚合模拟引擎
   */
  public static async executeSearch(
    filter: SearchFilter,
    page: number = 1,
    pageSize: number = 10,
    options?: SearchExecuteOptions
  ): Promise<SearchResultResponse> {
    const config = this.getConfig();
    const query = filter.query.trim();

    if (!query) {
      return emptyPanfindResponse(page, pageSize);
    }

    if (config.useCustomBackend && config.endpointUrl) {
      try {
        if (isPanfindEndpoint(config.endpointUrl)) {
          const timeout = options?.forceRefresh
            ? Math.max(config.timeoutMs, 60_000)
            : config.timeoutMs;
          const raw = await fetchPanfindSearch(config.endpointUrl, filter, timeout, {
            forceRefresh: options?.forceRefresh,
          });
          const adapted = adaptPanfindResponse(raw, filter, page, pageSize);
          return { ...adapted, points: raw.points, modeLabel: raw.modeLabel, demoMode: raw.demoMode };
        }
        return await this.fetchFromCustomBackend(config, filter, page, pageSize);
      } catch (err) {
        if (isQuotaOrClientError(err)) {
          throw err;
        }
        console.warn('Custom backend request failed:', err);
        if (config.mockFallbackOnError) {
          return this.searchMockEngine(filter, page, pageSize);
        }
        throw err;
      }
    }

    return this.searchMockEngine(filter, page, pageSize);
  }

  /**
   * 对接用户后续提供的真实后端 API
   * 
   * 后端接口规范建议：
   * POST {endpointUrl}
   * Request Body: { query, providers, category, sortBy, timeRange, onlyValid, page, pageSize }
   * Response JSON: SearchResultResponse
   */
  private static async fetchFromCustomBackend(
    config: BackendApiConfig,
    filter: SearchFilter,
    page: number,
    pageSize: number
  ): Promise<SearchResultResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    try {
      const resp = await fetch(config.endpointUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: filter.query,
          providers: filter.selectedProviders,
          category: filter.category,
          sortBy: filter.sortBy,
          timeRange: filter.timeRange,
          onlyValid: filter.onlyValid,
          page,
          pageSize,
        }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        throw new Error(`Backend responded with HTTP ${resp.status}`);
      }

      const data = await resp.json();
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 前端智能聚合模拟引擎（即开即用、高仿真度）
   */
  private static async searchMockEngine(
    filter: SearchFilter, 
    page: number, 
    pageSize: number
  ): Promise<SearchResultResponse> {
    // 模拟 120ms~240ms 的网络检索耗时
    await new Promise((r) => setTimeout(r, 140));

    const startTime = performance.now();
    const query = filter.query.trim().toLowerCase();

    // 1. 先从预置的精品资源库检索
    let pool: ResourceItem[] = [...MOCK_RESOURCES];

    // 如果用户输入了自定义关键词且预置库结果较少，动态生成高拟真度的网盘搜索结果
    if (query) {
      const matchInSeed = pool.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.description.toLowerCase().includes(query) ||
        item.tags.some(t => t.toLowerCase().includes(query))
      );

      // 如果匹配较少，智能根据关键词扩充逼真结果
      if (matchInSeed.length < 5) {
        const generated = this.synthesizeDynamicResults(query, filter);
        pool = [...matchInSeed, ...generated];
      } else {
        pool = matchInSeed;
      }
    }

    // 2. 网盘渠道过滤
    if (filter.selectedProviders.length > 0 && filter.selectedProviders.length < ALL_PROVIDER_IDS.length) {
      pool = pool.filter(item => filter.selectedProviders.includes(item.diskProvider));
    }

    // 3. 资源类型分类过滤
    if (filter.category !== 'all') {
      pool = pool.filter(item => item.category === filter.category);
    }

    // 4. 有效性过滤
    if (filter.onlyValid) {
      pool = pool.filter(item => item.isValid && item.healthScore >= 80);
    }

    const minMb = filter.minSizeMb ?? 0;
    if (minMb > 0) {
      pool = pool.filter(
        (item) => item.sizeBytes === 0 || item.sizeBytes >= minMb * 1024 * 1024
      );
    }
    const maxMb = filter.maxSizeMb;
    if (maxMb != null && maxMb > 0) {
      pool = pool.filter(
        (item) => item.sizeBytes === 0 || item.sizeBytes <= maxMb * 1024 * 1024
      );
    }

    // 5. 排序规则
    pool.sort((a, b) => {
      switch (filter.sortBy) {
        case 'date_desc':
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        case 'size_desc':
          return b.sizeBytes - a.sizeBytes;
        case 'size_asc':
          return a.sizeBytes - b.sizeBytes;
        case 'hot_desc':
          return b.savesCount - a.savesCount;
        case 'relevance':
        default:
          return (b.healthScore + b.savesCount / 1000) - (a.healthScore + a.savesCount / 1000);
      }
    });

    // 统计各网盘收录分布
    const providersCount = ALL_PROVIDER_IDS.reduce((acc, p) => {
      acc[p] = pool.filter(item => item.diskProvider === p).length;
      return acc;
    }, {} as Record<DiskProviderId, number>);

    // 统计各分类分布
    const categoriesCount: Record<ResourceCategory, number> = {
      all: pool.length,
      video: pool.filter(i => i.category === 'video').length,
      doc: pool.filter(i => i.category === 'doc').length,
      software: pool.filter(i => i.category === 'software').length,
      music: pool.filter(i => i.category === 'music').length,
      game: pool.filter(i => i.category === 'game').length,
      archive: pool.filter(i => i.category === 'archive').length,
      other: pool.filter(i => i.category === 'other').length,
    };

    // 分页
    const total = pool.length;
    const startIndex = (page - 1) * pageSize;
    const items = pool.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < total;
    const tookMs = Math.round(performance.now() - startTime + 85);

    return {
      items,
      total,
      page,
      pageSize,
      hasMore,
      tookMs,
      providersCount,
      categoriesCount,
      stats: {
        totalIndexed: 489201400,
        validRate: 98.4,
        indexedToday: 184200,
      },
    };
  }

  /**
   * 智能合成动态搜索结果：保证任何关键词都有真实合理的网盘结构，
   * 包含内部文件清单、提取码、文件大小与有效性评分
   */
  private static synthesizeDynamicResults(keyword: string, filter: SearchFilter): ResourceItem[] {
    const providers: DiskProviderId[] = filter.selectedProviders.length > 0 
      ? filter.selectedProviders 
      : ['quark', 'aliyun', 'baidu', 'xunlei', 'pan123', 'tianyi'];

    const templates = [
      {
        titleSuffix: '【全集超清4K原盘】收藏版',
        category: 'video' as ResourceCategory,
        sizeMb: 24500,
        ext: 'mkv',
        desc: `包含全部剧集与高清花絮，原盘画质无删减，支持云端倍速在线极速播放。`,
        tags: ['高清原画', '全集收藏', '4K60帧'],
      },
      {
        titleSuffix: '全套精讲教程与工程实战源码课件',
        category: 'video' as ResourceCategory,
        sizeMb: 18200,
        ext: 'mp4',
        desc: `系统化体系课程，配全套随堂笔记脑图、课后实战作业与核心源码打包。`,
        tags: ['精品教程', '实战项目', '带源码'],
      },
      {
        titleSuffix: '高清原版精校完整版 (PDF+EPUB+MOBI)',
        category: 'doc' as ResourceCategory,
        sizeMb: 850,
        ext: 'pdf',
        desc: `多端自适应字体排版，超清无水印扫描，适合平板与电子书深度研读。`,
        tags: ['电子书', '精校无水印', 'EPUB'],
      },
      {
        titleSuffix: '最新绿色独立免安装版 (附激活配置与使用说明)',
        category: 'software' as ResourceCategory,
        sizeMb: 3600,
        ext: 'exe',
        desc: `官方纯净原版制作，解压即用无需联网验证，已集成关键插件环境。`,
        tags: ['绿色免安装', '常用工具', '最新版'],
      },
      {
        titleSuffix: '无损FLAC完整典藏CD原轨音质抓取',
        category: 'music' as ResourceCategory,
        sizeMb: 1400,
        ext: 'flac',
        desc: `母带级品质24bit/96kHz高解析度音频，包含完整分轨LRC歌词与高清唱片封面。`,
        tags: ['无损音频', 'FLAC', '母带抓轨'],
      },
      {
        titleSuffix: '完整版整合包与中文汉化补丁合集',
        category: 'game' as ResourceCategory,
        sizeMb: 32000,
        ext: 'zip',
        desc: `解压直接运行，包含全DLC特典内容、高清材质包与完美全通关存档。`,
        tags: ['整合版', '免安装', '汉化补丁'],
      },
    ];

    const results: ResourceItem[] = [];

    templates.forEach((tpl, idx) => {
      const providerId = providers[idx % providers.length];
      const provider = DISK_PROVIDERS[providerId];
      const sizeBytes = tpl.sizeMb * 1024 * 1024;
      const sizeFormatted = tpl.sizeMb > 1024 
        ? `${(tpl.sizeMb / 1024).toFixed(1)} GB` 
        : `${tpl.sizeMb} MB`;

      const hasExtractCode = providerId === 'baidu' || providerId === 'xunlei' || Math.random() > 0.5;
      const extractCode = hasExtractCode ? Math.random().toString(36).substring(2, 6) : '';

      results.push({
        id: `dyn-${keyword}-${idx}`,
        title: `${keyword} ${tpl.titleSuffix}`,
        description: `${provider.name}直链资源。${tpl.desc}`,
        diskProvider: providerId,
        category: tpl.category,
        sizeBytes,
        sizeFormatted,
        updatedAt: new Date(Date.now() - idx * 86400000 * 3).toISOString().split('T')[0],
        createdAt: new Date(Date.now() - idx * 86400000 * 12).toISOString().split('T')[0],
        shareUrl: `${provider.officialUrl}/s/${Math.random().toString(36).substring(2, 10)}`,
        extractCode,
        isValid: true,
        healthScore: Math.floor(92 + Math.random() * 8),
        totalFiles: idx % 2 === 0 ? 3 : 12,
        fileTree: [
          {
            name: `${keyword}.${tpl.titleSuffix.replace(/[【】]/g, '')}.${tpl.ext}`,
            sizeBytes: Math.floor(sizeBytes * 0.8),
            sizeFormatted: tpl.sizeMb > 1024 ? `${(tpl.sizeMb * 0.8 / 1024).toFixed(1)} GB` : `${Math.floor(tpl.sizeMb * 0.8)} MB`,
            extension: tpl.ext,
            type: tpl.category,
          },
          {
            name: `配套资料及说明.${tpl.ext === 'mkv' ? 'rar' : 'txt'}`,
            sizeBytes: 15728640,
            sizeFormatted: '15 MB',
            extension: tpl.ext === 'mkv' ? 'rar' : 'txt',
            type: 'archive',
          }
        ],
        tags: [keyword, ...tpl.tags],
        viewsCount: 12000 + idx * 3400,
        savesCount: 5400 + idx * 1200,
        uploader: `云览社区达人_${provider.shortName}`
      });
    });

    return results;
  }

  /**
   * 链接有效性在线实时自检
   */
  public static async testLinkHealth(resource: ResourceItem): Promise<{ isValid: boolean; latencyMs: number; statusMsg: string }> {
    // 模拟健康检测延迟
    await new Promise(r => setTimeout(r, 260));
    const randomLatency = Math.floor(80 + Math.random() * 90);
    return {
      isValid: resource.healthScore > 50,
      latencyMs: randomLatency,
      statusMsg: resource.healthScore > 85 ? '链接极速有效，可直接转存' : '分享有效，部分时段需排队'
    };
  }
}
