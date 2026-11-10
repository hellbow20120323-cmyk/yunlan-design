/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export const STORAGE_KEYS = {
  clientId: 'yunlan.clientId',
  searchHistory: 'yunlan.searchHistory',
  favorites: 'yunlan.favorites',
  backendConfig: 'yunlan.backendConfig',
  theme: 'yunlan.theme',
} as const;

/** 旧前缀（海搜 / PanFind 时期）→ 新键；首次加载时搬迁一次，保留用户历史与收藏 */
const LEGACY_KEYS: Record<string, string> = {
  'panfind.clientId': STORAGE_KEYS.clientId,
  haisou_search_history: STORAGE_KEYS.searchHistory,
  haisou_user_favorites: STORAGE_KEYS.favorites,
  haisou_backend_config: STORAGE_KEYS.backendConfig,
  haisou_theme: STORAGE_KEYS.theme,
};

export function migrateLegacyStorage(): void {
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY_KEYS)) {
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      if (localStorage.getItem(newKey) === null) localStorage.setItem(newKey, value);
      localStorage.removeItem(oldKey);
    }
  } catch {
    // 隐私模式等禁用 localStorage 时直接跳过
  }
}

export function clientIdHeader(): Record<string, string> {
  try {
    const id = localStorage.getItem(STORAGE_KEYS.clientId);
    return id ? { 'X-Yunlan-Client': id } : {};
  } catch {
    return {};
  }
}
