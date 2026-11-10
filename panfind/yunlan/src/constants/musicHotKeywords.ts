/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MusicKeywordTag = '格式' | '设备' | '歌单' | '整理';

export interface MusicHotKeyword {
  keyword: string;
  tag: MusicKeywordTag;
}

/** 无损 / Hi-Fi 音乐热门搜索（22 条） */
export const MUSIC_HOT_KEYWORDS: MusicHotKeyword[] = [
  { keyword: 'FLAC无损音乐', tag: '格式' },
  { keyword: 'Hi-Res高解析音乐', tag: '格式' },
  { keyword: 'DSD无损音源', tag: '格式' },
  { keyword: 'WAV母带音乐', tag: '格式' },
  { keyword: 'APE无损音频', tag: '格式' },
  { keyword: '车载无损音乐包', tag: '设备' },
  { keyword: 'HIFI发烧音乐', tag: '设备' },
  { keyword: '5.1声道无损音乐', tag: '设备' },
  { keyword: '古典无损音乐', tag: '歌单' },
  { keyword: '华语老歌无损', tag: '歌单' },
  { keyword: '无损音乐转换工具', tag: '整理' },
  { keyword: 'SACD抓轨音源', tag: '整理' },
  { keyword: '黑胶转录无损', tag: '整理' },
  { keyword: '无损音乐播放器', tag: '设备' },
  { keyword: '24bit高解析音频', tag: '格式' },
  { keyword: '动漫OST无损', tag: '歌单' },
  { keyword: '影视原声无损', tag: '歌单' },
  { keyword: 'DFF DSF无损音乐', tag: '格式' },
  { keyword: '无损音乐标签整理', tag: '整理' },
  { keyword: '柏林之声无损歌单', tag: '设备' },
  { keyword: '无损音乐分轨', tag: '整理' },
  { keyword: '整轨无损CUE', tag: '整理' },
];

export const MUSIC_TAG_STYLES: Record<
  MusicKeywordTag,
  { dot: string; label: string }
> = {
  格式: { dot: 'bg-emerald-500', label: '无损格式' },
  设备: { dot: 'bg-pink-500', label: '听感 / 设备' },
  歌单: { dot: 'bg-amber-500', label: '曲风歌单' },
  整理: { dot: 'bg-violet-500', label: '采集整理' },
};
