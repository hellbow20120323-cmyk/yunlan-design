import React from 'react';
import { ArrowRight, Wrench } from 'lucide-react';
import { ToolGrid, ToolSlug } from './tools/ToolsPage';
import { VELO_HOME, VELO_ONLY_TOOLS } from '../constants/veloTools';

interface HomePortalProps {
  onOpenTool: (slug: ToolSlug) => void;
}

const HERO_IMAGE = '/velo/assets/images/velo_brew_workshop_hero_1794474296150.jpg';
const CYCLING_IMAGE = '/velo/assets/images/road_bike_mountain_summit_1794474297936.jpg';
const BREW_IMAGE = '/velo/assets/images/craft_beer_glass_hops_1794474296178.jpg';

/** 首页门户：按 Velo & Brew 工坊首页的版式重建，业务入口仍指向现有 React 工具 */
export const HomePortal: React.FC<HomePortalProps> = ({ onOpenTool }) => {
  return (
    <div className="py-4 sm:py-6 space-y-8">
      {/* Hero */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
        <div className="lg:col-span-7 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF0E4] border border-[#E8DEC8] text-[#8C4115] text-[11px] sm:text-xs font-bold tracking-wide">
            <span>🚴 VELO &amp; BREW 🍺</span>
            <span className="text-[#DC9B6B]">·</span>
            <span>骑行物理与精酿工坊</span>
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-yunlan-ink tracking-tight leading-tight">
            自行车与家酿
          </h1>
          <p className="text-xs sm:text-sm text-yunlan-muted leading-relaxed max-w-xl">
            公路赛道物理力学推演、手工车架涂装定制、全谷物精酿啤酒配方计算与实用开发工具箱。
            全部基于现代浏览器本地纯前端引擎极速计算，零数据上传、永久免费。
          </p>

          <div className="flex flex-wrap gap-2 text-[11px] sm:text-xs font-medium text-yunlan-ink pt-1">
            <span className="px-3 py-1.5 rounded-xl bg-yunlan-surface border border-yunlan-hairline flex items-center gap-1.5">
              🚴 <strong>10 项骑行工程算法</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-yunlan-surface border border-yunlan-hairline flex items-center gap-1.5">
              🍺 <strong>11 项全谷精酿模型</strong>
            </span>
            <span className="px-3 py-1.5 rounded-xl bg-yunlan-surface border border-yunlan-hairline flex items-center gap-1.5">
              💻 <strong>7 项极客通用工具</strong>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <a
              href={VELO_HOME}
              className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-xl bg-[#C86D28] hover:bg-[#AF571B] text-white text-sm font-bold shadow-yunlan-feather transition-colors"
            >
              进入完整工坊（28 款）
              <ArrowRight className="w-4 h-4" />
            </a>
            <a
              href="#home-tools"
              className="inline-flex items-center gap-2 min-h-11 px-5 py-2.5 rounded-xl border border-[#E8DEC8] bg-yunlan-surface text-[#8C4115] text-sm font-bold hover:border-[#DC9B6B] hover:bg-[#FAF0E4] transition-colors"
            >
              浏览在线工具
            </a>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="relative rounded-3xl overflow-hidden border border-[#E8DEC8] shadow-ink-wash bg-yunlan-surface">
            <img
              src={HERO_IMAGE}
              alt="手工车架工坊与精酿啤酒实验室"
              loading="lazy"
              className="w-full h-56 sm:h-72 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/25 to-transparent flex flex-col justify-end p-5 text-white">
              <div className="flex items-center gap-2 text-[11px] font-bold text-[#E5A93C] uppercase tracking-wider font-mono">
                <span>手工车架工坊</span>
                <span>·</span>
                <span>精酿物理实验室</span>
              </div>
              <p className="text-xs text-stone-200 mt-1 leading-normal">
                从齿轮链条的机械阻抗，到麦芽糖化与酒花苦度的分子物理学
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        <a
          href="/tools/cycling"
          className="bg-yunlan-surface rounded-2xl border border-[#E8DEC8] overflow-hidden flex flex-col hover:border-[#C86D28]/60 hover:shadow-ink-wash transition-all group"
        >
          <div className="relative h-32 sm:h-36 overflow-hidden">
            <img
              src={CYCLING_IMAGE}
              alt="公路自行车爬坡推演"
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 to-transparent flex items-end p-4">
              <span className="text-[11px] font-bold text-[#E5A93C] uppercase tracking-wider font-mono">
                PRO CYCLING LAB
              </span>
            </div>
          </div>
          <div className="p-5">
            <h3 className="text-base font-bold text-yunlan-ink group-hover:text-[#C86D28] transition-colors">
              🚴 骑行计算工坊
            </h3>
            <p className="text-xs text-yunlan-muted mt-2 leading-relaxed">
              齿比与行进距离、踏频配速、轮组外胎真实周长、最佳胎压、爬坡等级与功率模型。
            </p>
            <span className="mt-4 pt-3 border-t border-yunlan-hairline flex items-center gap-1 text-xs font-bold text-[#C86D28]">
              进入骑行工坊 <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </a>

        <a
          href="/tools/brewing"
          className="bg-yunlan-surface rounded-2xl border border-[#E8DEC8] overflow-hidden flex flex-col hover:border-[#C86D28]/60 hover:shadow-ink-wash transition-all group"
        >
          <div className="relative h-32 sm:h-36 overflow-hidden">
            <img
              src={BREW_IMAGE}
              alt="精酿啤酒与酒花麦芽"
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/80 to-transparent flex items-end p-4">
              <span className="text-[11px] font-bold text-[#E5A93C] uppercase tracking-wider font-mono">
                CRAFT BREWERY LAB
              </span>
            </div>
          </div>
          <div className="p-5">
            <h3 className="text-base font-bold text-yunlan-ink group-hover:text-[#C86D28] transition-colors">
              🍺 啤酒配方与家酿
            </h3>
            <p className="text-xs text-yunlan-muted mt-2 leading-relaxed">
              ABV 酒精度、Tinseth 苦度、SRM 色度、酵母投放、补糖、桶装打酒压力与热量估算。
            </p>
            <span className="mt-4 pt-3 border-t border-yunlan-hairline flex items-center gap-1 text-xs font-bold text-[#C86D28]">
              进入家酿工坊 <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </a>

        <a
          href="/tools/dev"
          className="bg-yunlan-surface rounded-2xl border border-[#E8DEC8] overflow-hidden flex flex-col hover:border-[#C86D28]/60 hover:shadow-ink-wash transition-all group"
        >
          <div className="h-32 sm:h-36 bg-gradient-to-br from-stone-900 to-stone-800 p-4 flex flex-col justify-between font-mono text-xs text-amber-400/90 border-b border-stone-700">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] text-stone-400 ml-2">DEV_WORKBENCH</span>
            </div>
            <div className="text-[11px] text-stone-300 leading-relaxed">
              $ md5(payload) &amp;&amp; diff(v1, v2)
              <br />
              <span className="text-emerald-400 font-bold">✓ JSON Valid · UTF-8 · Local Only</span>
            </div>
          </div>
          <div className="p-5">
            <h3 className="text-base font-bold text-yunlan-ink group-hover:text-[#C86D28] transition-colors">
              💻 文本处理与极客辅助
            </h3>
            <p className="text-xs text-yunlan-muted mt-2 leading-relaxed">
              JSON 格式化校验、Base64 / URL 编解码、哈希、Unix 时间戳、文本统计、密码与图片转换。
            </p>
            <span className="mt-4 pt-3 border-t border-yunlan-hairline flex items-center gap-1 text-xs font-bold text-[#C86D28]">
              查看开发工具 <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </div>
        </a>
      </div>

      {/* Tool grid */}
      <section id="home-tools" className="space-y-4 pt-2 scroll-mt-20">
        <div className="flex items-center justify-between pb-2 border-b border-yunlan-hairline">
          <h2 className="text-sm font-bold uppercase tracking-wider text-yunlan-muted flex items-center gap-2">
            <Wrench className="w-4 h-4 text-[#C86D28]" />
            全部可用工具清单
            <span className="text-[11px] font-normal text-yunlan-muted bg-yunlan-mist px-2 py-0.5 rounded-full">
              28 款工具
            </span>
          </h2>
          <span className="hidden sm:inline text-xs text-yunlan-muted">点击任意工具即刻开启</span>
        </div>
        <ToolGrid onOpen={onOpenTool} />
      </section>

      {/* Velo-only tools */}
      <section className="rounded-2xl border border-[#E8DEC8] bg-[#FAF0E4] p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#8C4115]">完整工坊 · 进阶工具</h2>
          <a href={VELO_HOME} className="text-xs font-bold text-[#C86D28] hover:underline">
            进入完整工坊 →
          </a>
        </div>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {VELO_ONLY_TOOLS.map((tool) => (
            <a
              key={tool.href}
              href={tool.href}
              className="flex items-center gap-2 rounded-xl bg-yunlan-surface border border-[#E8DEC8] px-3 py-2.5 text-xs font-medium text-yunlan-ink hover:border-[#C86D28]/50 hover:text-[#C86D28] transition-colors"
            >
              <span className="text-sm">{tool.icon}</span>
              <span className="truncate">{tool.name}</span>
            </a>
          ))}
        </div>
      </section>

      <div className="rounded-2xl border border-[#E8DEC8] bg-yunlan-surface/80 p-4 sm:p-5 flex items-start gap-3.5 text-xs text-yunlan-muted">
        <span className="text-[#C86D28] text-base mt-0.5 shrink-0">🔧</span>
        <p className="leading-relaxed">
          所有工具均为纯前端实现，输入内容仅在当前浏览器标签页内处理，刷新后即清空。
          若页面长时间无响应，请减少单次处理的文本或图片体积。
        </p>
      </div>
    </div>
  );
};

export default HomePortal;
