/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { HOT_KEYWORDS } from '../constants/providers';
import { Film, BookOpen, Cpu, ArrowUpRight } from 'lucide-react';
import { ResourceCategory } from '../types';
import { PageShell, yunlanCardClass } from './PageShell';

interface HotSearchAndRankingsProps {
  onSelectKeyword: (keyword: string, category?: ResourceCategory) => void;
}

export const HotSearchAndRankings: React.FC<HotSearchAndRankingsProps> = ({
  onSelectKeyword,
}) => {
  const videoRanks = [
    { title: '流浪地球2 4K 60帧加长原盘', heat: 94820, provider: '夸克网盘' },
    { title: '星际穿越 IMAX珍藏双语字幕', heat: 88100, provider: '天翼云盘' },
    { title: '奥本海默 4K杜比视界高码率', heat: 83200, provider: '阿里云盘' },
    { title: '三体 电视剧全30集超高清', heat: 79400, provider: '百度网盘' },
    { title: '沙丘2 蓝光原盘1080P/4K', heat: 75200, provider: '迅雷云盘' },
  ];

  const docRanks = [
    { title: '2026考研数学历年真题分类精讲', heat: 99120, provider: '阿里云盘' },
    { title: '剑桥雅思真题1-19全套听力阅读', heat: 91400, provider: '夸克网盘' },
    { title: 'Python大模型微调全套笔记', heat: 86500, provider: '百度网盘' },
    { title: '中国古代四大名著脂砚斋批语本', heat: 72100, provider: 'UC网盘' },
    { title: '初级注册会计师考霸高分打卡表', heat: 68900, provider: '123云盘' },
  ];

  const softRanks = [
    { title: 'Adobe 2026 全家桶独立免装', heat: 98100, provider: '123云盘' },
    { title: 'JetBrains 2026 商业版插件集', heat: 89400, provider: '阿里云盘' },
    { title: 'Windows 11 25H2 纯净精简镜像', heat: 87600, provider: '123云盘' },
    { title: 'Blender 4.5 电影级建模资产包', heat: 76900, provider: '百度网盘' },
    { title: '安卓常用实用小工具绿色免Root', heat: 71200, provider: '蓝奏云' },
  ];

  return (
    <PageShell
      title="全网资源风云榜单"
      subtitle="基于近 24 小时检索与转存频次统计，发现当季热门学习与娱乐资源"
    >
      <div className={`${yunlanCardClass()} p-5 sm:p-6 mb-8`}>
        <div className="mb-4">
          <h3 className="text-sm font-semibold tracking-wide text-[#4a4540]">
            今日全网热搜词 Top 10
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {HOT_KEYWORDS.map((item, idx) => (
            <button
              key={item.keyword}
              onClick={() => onSelectKeyword(item.keyword, item.category)}
              className="flex items-center justify-between min-h-11 p-2.5 rounded-xl border border-yunlan-hairline hover:border-[#d8cbb8] bg-[#faf8f5] hover:bg-[#f3f0ea] transition-all text-left group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-bold tabular-nums w-4 shrink-0 ${
                  idx < 3 ? 'text-amber-500' : 'text-slate-400'
                }`}>
                  {idx + 1}
                </span>
                <span className="text-xs text-[#4a4540] group-hover:text-[#9a7b4f] font-medium truncate">
                  {item.keyword}
                </span>
              </div>
              <ArrowUpRight className="w-3 h-3 text-yunlan-muted group-hover:text-[#9a7b4f] shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>

      {/* Three Column Categories Ranking */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Column 1: Video */}
        <div className={`${yunlanCardClass()} p-5`}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Film className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              影视影视 · 热门飙升
            </h3>
          </div>

          <div className="space-y-3">
            {videoRanks.map((r, i) => (
              <div
                key={i}
                onClick={() => onSelectKeyword(r.title, 'video')}
                className="flex items-start justify-between gap-2 text-xs group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-lg transition-colors min-h-12"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`font-bold tabular-nums ${i < 3 ? 'text-blue-500' : 'text-slate-400'}`}>
                    0{i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-yunlan-stone line-clamp-2">
                      {r.title}
                    </p>
                    <span className="text-xs text-slate-400">
                      来源: {r.provider}
                    </span>
                  </div>
                </div>
                <span className="font-mono tabular-nums text-slate-400 text-xs shrink-0">
                  {(r.heat / 1000).toFixed(1)}k
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 2: Document */}
        <div className={`${yunlanCardClass()} p-5`}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <BookOpen className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              学习教辅 · 考研考证
            </h3>
          </div>

          <div className="space-y-3">
            {docRanks.map((r, i) => (
              <div
                key={i}
                onClick={() => onSelectKeyword(r.title, 'doc')}
                className="flex items-start justify-between gap-2 text-xs group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-lg transition-colors min-h-12"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`font-bold tabular-nums ${i < 3 ? 'text-emerald-500' : 'text-slate-400'}`}>
                    0{i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-yunlan-stone line-clamp-2">
                      {r.title}
                    </p>
                    <span className="text-xs text-slate-400">
                      来源: {r.provider}
                    </span>
                  </div>
                </div>
                <span className="font-mono tabular-nums text-slate-400 text-xs shrink-0">
                  {(r.heat / 1000).toFixed(1)}k
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Column 3: Software */}
        <div className={`${yunlanCardClass()} p-5`}>
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <Cpu className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              生产力软件 · 系统工具
            </h3>
          </div>

          <div className="space-y-3">
            {softRanks.map((r, i) => (
              <div
                key={i}
                onClick={() => onSelectKeyword(r.title, 'software')}
                className="flex items-start justify-between gap-2 text-xs group cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 p-2 rounded-lg transition-colors min-h-12"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <span className={`font-bold tabular-nums ${i < 3 ? 'text-amber-500' : 'text-slate-400'}`}>
                    0{i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800 dark:text-slate-200 group-hover:text-yunlan-stone line-clamp-2">
                      {r.title}
                    </p>
                    <span className="text-xs text-slate-400">
                      来源: {r.provider}
                    </span>
                  </div>
                </div>
                <span className="font-mono tabular-nums text-slate-400 text-xs shrink-0">
                  {(r.heat / 1000).toFixed(1)}k
                </span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </PageShell>
  );
};
