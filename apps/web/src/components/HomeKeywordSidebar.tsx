/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { BookOpen, Gamepad2, Music2, Wrench } from 'lucide-react';
import {
  STUDY_EXAM_HOT_KEYWORDS,
  STUDY_TAG_STYLES,
  type StudyKeywordTag,
} from '../constants/studyHotKeywords';
import {
  PRODUCTIVITY_HOT_KEYWORDS,
  PRODUCTIVITY_TAG_STYLES,
  type ProductivityKeywordTag,
} from '../constants/productivityHotKeywords';
import {
  MUSIC_HOT_KEYWORDS,
  MUSIC_TAG_STYLES,
  type MusicKeywordTag,
} from '../constants/musicHotKeywords';
import {
  GAME_HOT_KEYWORDS,
  GAME_TAG_STYLES,
  type GameKeywordTag,
} from '../constants/gameHotKeywords';
import type { ResourceCategory } from '../types';

const STUDY_TAG_ORDER: StudyKeywordTag[] = ['考研', '考证', 'K12', '语言', '公考'];
const PRODUCTIVITY_TAG_ORDER: ProductivityKeywordTag[] = [
  '文件',
  '效率',
  '影音',
  '开发',
  '系统',
  '网盘',
];
const MUSIC_TAG_ORDER: MusicKeywordTag[] = ['格式', '设备', '歌单', '整理'];
const GAME_TAG_ORDER: GameKeywordTag[] = ['模拟', '资源', '补丁', '工具'];

const MAX_SAMPLES = 2;

interface HomeKeywordSidebarProps {
  className?: string;
  onPickKeyword: (keyword: string, category: ResourceCategory) => void;
}

function groupSamples<T extends { keyword: string; tag: string }>(
  items: T[],
  tagOrder: string[],
  maxPerTag: number
) {
  const map = new Map<string, string[]>();
  for (const tag of tagOrder) map.set(tag, []);
  for (const item of items) {
    const list = map.get(item.tag);
    if (list && list.length < maxPerTag) list.push(item.keyword);
  }
  return tagOrder
    .map((tag) => ({ tag, samples: map.get(tag) ?? [] }))
    .filter((g) => g.samples.length > 0);
}

type CatalogSection = {
  icon: React.ReactNode;
  title: string;
  category: ResourceCategory;
  groups: { label: string; samples: string[] }[];
};

export const HomeKeywordSidebar: React.FC<HomeKeywordSidebarProps> = ({
  className = '',
  onPickKeyword,
}) => {
  const studyGroups = useMemo(
    () => groupSamples(STUDY_EXAM_HOT_KEYWORDS, STUDY_TAG_ORDER, MAX_SAMPLES),
    []
  );
  const toolGroups = useMemo(
    () => groupSamples(PRODUCTIVITY_HOT_KEYWORDS, PRODUCTIVITY_TAG_ORDER, MAX_SAMPLES),
    []
  );
  const musicGroups = useMemo(
    () => groupSamples(MUSIC_HOT_KEYWORDS, MUSIC_TAG_ORDER, MAX_SAMPLES),
    []
  );
  const gameGroups = useMemo(
    () => groupSamples(GAME_HOT_KEYWORDS, GAME_TAG_ORDER, MAX_SAMPLES),
    []
  );

  const [openTitle, setOpenTitle] = useState<string | null>(null);

  const sections: CatalogSection[] = [
    {
      icon: <BookOpen className="w-3.5 h-3.5" strokeWidth={1.75} />,
      title: '学习教辅',
      category: 'doc',
      groups: studyGroups.map((g) => ({
        label: STUDY_TAG_STYLES[g.tag as StudyKeywordTag].label,
        samples: g.samples,
      })),
    },
    {
      icon: <Wrench className="w-3.5 h-3.5" strokeWidth={1.75} />,
      title: '效率工具',
      category: 'software',
      groups: toolGroups.map((g) => ({
        label: PRODUCTIVITY_TAG_STYLES[g.tag as ProductivityKeywordTag].label,
        samples: g.samples,
      })),
    },
    {
      icon: <Music2 className="w-3.5 h-3.5" strokeWidth={1.75} />,
      title: '无损音乐',
      category: 'music',
      groups: musicGroups.map((g) => ({
        label: MUSIC_TAG_STYLES[g.tag as MusicKeywordTag].label,
        samples: g.samples,
      })),
    },
    {
      icon: <Gamepad2 className="w-3.5 h-3.5" strokeWidth={1.75} />,
      title: '游戏软件',
      category: 'game',
      groups: gameGroups.map((g) => ({
        label: GAME_TAG_STYLES[g.tag as GameKeywordTag].label,
        samples: g.samples,
      })),
    },
  ];

  return (
    <aside
      className={`w-full lg:w-[280px] shrink-0 ${className}`}
      aria-label="热门分类快捷搜索"
    >
      <div className="lg:sticky lg:top-24 rounded-2xl border border-yunlan-hairline bg-yunlan-surface/95 backdrop-blur-sm shadow-yunlan-card overflow-hidden">
        <header className="px-4 pt-3 pb-2.5 sm:pt-4 sm:pb-3 border-b border-yunlan-hairline">
          <p className="text-[11px] font-sans tracking-[0.28em] text-yunlan-muted">INDEX</p>
          <h2 className="mt-1 font-yunlan-serif text-base font-medium tracking-[0.08em] text-yunlan-ink">
            资源索引
          </h2>
          <p className="mt-1 text-xs font-light leading-relaxed text-yunlan-muted hidden sm:block">
            精选分类与示例检索词
          </p>
        </header>

        {/* 手机：四分类手风琴 + 关键词芯片 */}
        <div className="lg:hidden px-2 py-2">
          <div className="grid grid-cols-2 gap-1.5">
            {sections.map((section) => {
              const active = openTitle === section.title;
              return (
                <button
                  key={section.title}
                  type="button"
                  onClick={() => setOpenTitle(active ? null : section.title)}
                  className={`flex items-center justify-center gap-1.5 min-h-11 rounded-sm text-[12px] tracking-wide border transition-colors ${
                    active
                      ? 'border-yunlan-cinnabar/40 bg-yunlan-mist text-yunlan-ink'
                      : 'border-yunlan-hairline text-yunlan-muted'
                  }`}
                >
                  <span className="text-yunlan-cinnabar/80">{section.icon}</span>
                  {section.title}
                </button>
              );
            })}
          </div>
          {sections.map((section) =>
            openTitle === section.title ? (
              <div key={section.title} className="mt-2 flex flex-wrap gap-1.5 px-0.5 pb-1">
                {section.groups.flatMap((g) => g.samples).map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => onPickKeyword(kw, section.category)}
                    className="min-h-9 px-2.5 text-[12px] font-light text-yunlan-ink bg-yunlan-mist/80 border border-yunlan-hairline rounded-sm"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            ) : null
          )}
        </div>

        <div className="hidden lg:block px-3 py-2 space-y-0 max-h-[min(70vh,640px)] overflow-y-auto">
          {sections.map((section, sIdx) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 px-1 py-2.5">
                <span className="text-yunlan-cinnabar/80">{section.icon}</span>
                <span className="text-xs font-sans font-medium tracking-wide text-yunlan-ink">
                  {section.title}
                </span>
              </div>
              <ul className="space-y-2.5 pb-3">
                {section.groups.map((g) => (
                  <li key={g.label} className="pl-1">
                    <p className="text-xs font-sans font-medium tracking-wide text-slate-600 mb-1">
                      {g.label}
                    </p>
                    <div className="flex flex-col gap-0.5 border-l border-yunlan-hairline pl-2.5 ml-0.5">
                      {g.samples.map((kw) => (
                        <button
                          key={kw}
                          type="button"
                          onClick={() => onPickKeyword(kw, section.category)}
                          className="text-left text-[13px] leading-6 text-yunlan-ink/80 hover:text-yunlan-stone truncate transition-colors focus:outline-none focus-visible:text-yunlan-stone"
                          title={kw}
                        >
                          {kw}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
              {sIdx < sections.length - 1 ? (
                <div className="mx-2 mb-1 border-t border-dashed border-yunlan-hairline" />
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
