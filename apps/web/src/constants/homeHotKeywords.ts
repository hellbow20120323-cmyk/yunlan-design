/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 首页侧栏四类热词的统一索引（便于统计 / 导出，编辑仍请改各分文件）
 */

import { STUDY_EXAM_HOT_KEYWORDS } from './studyHotKeywords';
import { PRODUCTIVITY_HOT_KEYWORDS } from './productivityHotKeywords';
import { MUSIC_HOT_KEYWORDS } from './musicHotKeywords';
import { GAME_HOT_KEYWORDS } from './gameHotKeywords';
import type { ResourceCategory } from '../types';

export type HomeHotKeywordBundleId = 'study' | 'productivity' | 'music' | 'game';

export interface HomeHotKeywordBundle {
  id: HomeHotKeywordBundleId;
  title: string;
  category: ResourceCategory;
  keywords: { keyword: string; tag: string }[];
}

/** 四类关键词总表（只读聚合，非唯一数据源） */
export const HOME_HOT_KEYWORD_BUNDLES: HomeHotKeywordBundle[] = [
  {
    id: 'study',
    title: '学习教辅',
    category: 'doc',
    keywords: STUDY_EXAM_HOT_KEYWORDS,
  },
  {
    id: 'productivity',
    title: '效率工具',
    category: 'software',
    keywords: PRODUCTIVITY_HOT_KEYWORDS,
  },
  {
    id: 'music',
    title: '无损音乐',
    category: 'music',
    keywords: MUSIC_HOT_KEYWORDS,
  },
  {
    id: 'game',
    title: '游戏软件',
    category: 'game',
    keywords: GAME_HOT_KEYWORDS,
  },
];

export const HOME_HOT_KEYWORD_TOTAL = HOME_HOT_KEYWORD_BUNDLES.reduce(
  (n, b) => n + b.keywords.length,
  0,
);
