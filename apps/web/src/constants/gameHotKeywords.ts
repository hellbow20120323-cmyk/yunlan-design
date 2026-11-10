/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameKeywordTag = '模拟' | '资源' | '补丁' | '工具';

export interface GameHotKeyword {
  keyword: string;
  tag: GameKeywordTag;
}

/** 游戏 / 模拟器 / MOD 热门搜索（24 条） */
export const GAME_HOT_KEYWORDS: GameHotKeyword[] = [
  { keyword: 'Switch模拟器', tag: '模拟' },
  { keyword: '单机免安装游戏', tag: '资源' },
  { keyword: '游戏MOD资源', tag: '资源' },
  { keyword: '游戏修改器', tag: '工具' },
  { keyword: '游戏存档', tag: '资源' },
  { keyword: '街机ROM合集', tag: '模拟' },
  { keyword: '主机模拟器', tag: '模拟' },
  { keyword: '游戏汉化补丁', tag: '补丁' },
  { keyword: '联机平台工具', tag: '工具' },
  { keyword: '游戏帧率优化软件', tag: '工具' },
  { keyword: '游戏手柄驱动', tag: '工具' },
  { keyword: '老游戏兼容补丁', tag: '补丁' },
  { keyword: '独立游戏资源', tag: '资源' },
  { keyword: '像素游戏合集', tag: '资源' },
  { keyword: '游戏画质增强工具', tag: '工具' },
  { keyword: '怀旧经典游戏', tag: '资源' },
  { keyword: '手游模拟器', tag: '模拟' },
  { keyword: '游戏录屏直播工具', tag: '工具' },
  { keyword: '游戏配置检测软件', tag: '工具' },
  { keyword: '局域网联机工具', tag: '工具' },
  { keyword: 'DOS老游戏', tag: '模拟' },
  { keyword: '游戏汉化组资源', tag: '补丁' },
  { keyword: '游戏模组管理器', tag: '工具' },
  { keyword: '复古掌机模拟器', tag: '模拟' },
];

export const GAME_TAG_STYLES: Record<GameKeywordTag, { dot: string; label: string }> = {
  模拟: { dot: 'bg-blue-500', label: '模拟 / ROM' },
  资源: { dot: 'bg-red-500', label: '游戏资源' },
  补丁: { dot: 'bg-lime-600', label: '汉化补丁' },
  工具: { dot: 'bg-slate-600', label: '辅助工具' },
};
