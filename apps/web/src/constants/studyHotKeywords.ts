/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type StudyKeywordTag = '考研' | '考证' | 'K12' | '语言' | '公考';

export interface StudyHotKeyword {
  keyword: string;
  tag: StudyKeywordTag;
}

/** 考研考证 + 教辅热门搜索（30 条） */
export const STUDY_EXAM_HOT_KEYWORDS: StudyHotKeyword[] = [
  { keyword: '考研英语真题', tag: '考研' },
  { keyword: '考研政治背诵笔记', tag: '考研' },
  { keyword: '考研数学复习全书', tag: '考研' },
  { keyword: '管理类联考真题', tag: '考研' },
  { keyword: '法考客观题资料', tag: '考证' },
  { keyword: '注册会计师CPA教材', tag: '考证' },
  { keyword: '初级会计职称讲义', tag: '考证' },
  { keyword: '教师资格证笔试资料', tag: '考证' },
  { keyword: '四六级真题试卷', tag: '语言' },
  { keyword: '雅思托福备考资料', tag: '语言' },
  { keyword: '考研专业课笔记', tag: '考研' },
  { keyword: '396经济类联考', tag: '考研' },
  { keyword: '考研国家线', tag: '考研' },
  { keyword: '考研择校指南', tag: '考研' },
  { keyword: '一建二建备考讲义', tag: '考证' },
  { keyword: '软考中级资料', tag: '考证' },
  { keyword: '五年中考三年模拟', tag: 'K12' },
  { keyword: '高中必刷题合订本', tag: 'K12' },
  { keyword: '万唯中考真题', tag: 'K12' },
  { keyword: '初中小四门知识点', tag: 'K12' },
  { keyword: '高考一轮复习资料', tag: 'K12' },
  { keyword: '申论答题模板', tag: '公考' },
  { keyword: '行测刷题题库', tag: '公考' },
  { keyword: '考研英语作文模板', tag: '考研' },
  { keyword: '教资科二简答题', tag: '考证' },
  { keyword: '考研押题卷', tag: '考研' },
  { keyword: '初升高衔接教辅', tag: 'K12' },
  { keyword: '英语四级词汇', tag: '语言' },
  { keyword: '临床医学考研资料', tag: '考研' },
  { keyword: '翻译硕士专业课', tag: '考研' },
];

export const STUDY_TAG_STYLES: Record<
  StudyKeywordTag,
  { pill: string; dot: string; label: string }
> = {
  考研: {
    pill: 'bg-violet-50 text-violet-800 border-violet-200/80 hover:border-violet-400 hover:bg-violet-100/90',
    dot: 'bg-violet-500',
    label: '考研升学',
  },
  考证: {
    pill: 'bg-amber-50 text-amber-900 border-amber-200/80 hover:border-amber-400 hover:bg-amber-100/90',
    dot: 'bg-amber-500',
    label: '职业资格',
  },
  K12: {
    pill: 'bg-sky-50 text-sky-900 border-sky-200/80 hover:border-sky-400 hover:bg-sky-100/90',
    dot: 'bg-sky-500',
    label: 'K12 教辅',
  },
  语言: {
    pill: 'bg-teal-50 text-teal-900 border-teal-200/80 hover:border-teal-400 hover:bg-teal-100/90',
    dot: 'bg-teal-500',
    label: '语言考试',
  },
  公考: {
    pill: 'bg-rose-50 text-rose-900 border-rose-200/80 hover:border-rose-400 hover:bg-rose-100/90',
    dot: 'bg-rose-500',
    label: '公考编制',
  },
};
