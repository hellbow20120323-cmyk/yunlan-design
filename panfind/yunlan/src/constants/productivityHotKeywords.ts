/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ProductivityKeywordTag = '文件' | '效率' | '影音' | '开发' | '系统' | '网盘';

export interface ProductivityHotKeyword {
  keyword: string;
  tag: ProductivityKeywordTag;
}

/** 效率工具 / 系统软件热门搜索（24 条） */
export const PRODUCTIVITY_HOT_KEYWORDS: ProductivityHotKeyword[] = [
  { keyword: 'PDF 编辑转换工具', tag: '文件' },
  { keyword: '电脑文件快速搜索软件', tag: '文件' },
  { keyword: '剪贴板增强工具', tag: '效率' },
  { keyword: '屏幕截图录屏工具', tag: '影音' },
  { keyword: 'C 盘清理瘦身工具', tag: '系统' },
  { keyword: '批量重命名软件', tag: '文件' },
  { keyword: '磁盘健康检测工具', tag: '系统' },
  { keyword: '窗口分屏管理工具', tag: '效率' },
  { keyword: '系统硬件监控工具', tag: '系统' },
  { keyword: '解压压缩工具', tag: '文件' },
  { keyword: 'Markdown 笔记软件', tag: '效率' },
  { keyword: '快捷键自定义工具', tag: '效率' },
  { keyword: '视频格式转换器', tag: '影音' },
  { keyword: '远程桌面工具', tag: '系统' },
  { keyword: '代码编辑器', tag: '开发' },
  { keyword: '启动器效率工具', tag: '效率' },
  { keyword: '软件强制卸载工具', tag: '系统' },
  { keyword: '磁盘空间分析工具', tag: '文件' },
  { keyword: '网络抓包调试工具', tag: '开发' },
  { keyword: '多平台同步网盘', tag: '网盘' },
  { keyword: '批量图片处理工具', tag: '影音' },
  { keyword: '终端增强工具', tag: '开发' },
  { keyword: '任务清单待办软件', tag: '效率' },
  { keyword: '系统优化微调工具', tag: '系统' },
];

export const PRODUCTIVITY_TAG_STYLES: Record<
  ProductivityKeywordTag,
  { pill: string; dot: string; label: string }
> = {
  文件: {
    pill: 'bg-slate-50 text-slate-800 border-slate-200/90 hover:border-slate-400 hover:bg-slate-100/90',
    dot: 'bg-slate-500',
    label: '文件与磁盘',
  },
  效率: {
    pill: 'bg-cyan-50 text-cyan-900 border-cyan-200/80 hover:border-cyan-400 hover:bg-cyan-100/90',
    dot: 'bg-cyan-500',
    label: '效率增强',
  },
  影音: {
    pill: 'bg-fuchsia-50 text-fuchsia-900 border-fuchsia-200/80 hover:border-fuchsia-400 hover:bg-fuchsia-100/90',
    dot: 'bg-fuchsia-500',
    label: '截图 / 影音',
  },
  开发: {
    pill: 'bg-indigo-50 text-indigo-900 border-indigo-200/80 hover:border-indigo-400 hover:bg-indigo-100/90',
    dot: 'bg-indigo-500',
    label: '开发调试',
  },
  系统: {
    pill: 'bg-orange-50 text-orange-900 border-orange-200/80 hover:border-orange-400 hover:bg-orange-100/90',
    dot: 'bg-orange-500',
    label: '系统维护',
  },
  网盘: {
    pill: 'bg-blue-50 text-blue-900 border-blue-200/80 hover:border-blue-400 hover:bg-blue-100/90',
    dot: 'bg-blue-500',
    label: '网盘同步',
  },
};
