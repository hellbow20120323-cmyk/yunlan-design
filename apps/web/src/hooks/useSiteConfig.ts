import { useEffect, useState } from 'react';

export interface SiteConfig {
  searchEnabled: boolean;
}

/**
 * 读取网关运行时开关（环境变量 SEARCH_ENABLED）。
 * 请求失败时按「搜索关闭」处理：宁可少一个入口，也不让不合规内容在审核期暴露。
 */
export function useSiteConfig(): SiteConfig {
  const [searchEnabled, setSearchEnabled] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/site-config', { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { searchEnabled?: boolean } | null) => {
        if (body && typeof body.searchEnabled === 'boolean') setSearchEnabled(body.searchEnabled);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return { searchEnabled };
}
