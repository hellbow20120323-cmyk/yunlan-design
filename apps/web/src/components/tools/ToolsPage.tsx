import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Beer,
  Binary,
  Braces,
  CircleDot,
  Clock,
  Cog,
  Droplets,
  Fingerprint,
  Flame,
  FlaskConical,
  Gauge,
  GlassWater,
  HeartPulse,
  Image as ImageIcon,
  KeyRound,
  Link2,
  Mountain,
  Palette,
  Ruler,
  TestTube,
  Type,
  Wind,
  Wrench,
  Zap,
} from 'lucide-react';
import { PageShell, yunlanCardClass } from '../PageShell';
import { TextTool } from './TextTool';
import { CodecTool } from './CodecTool';
import { JsonTool } from './JsonTool';
import { ImageTool } from './ImageTool';
import { TimestampTool } from './TimestampTool';
import { HashTool } from './HashTool';
import { PasswordTool } from './PasswordTool';
import {
  CadenceTool,
  ChainLengthTool,
  ClimbTool,
  GearRatioTool,
  PowerTool,
  TirePressureTool,
  WheelCircTool,
} from './BikeTools';
import { BeerTools } from './BeerTools';

export const TOOL_DEFS = [
  {
    slug: 'text',
    name: '文本统计与格式化',
    desc: '字数、行数实时统计，去空行、去重、排序一键整理。',
    icon: Type,
  },
  {
    slug: 'timestamp',
    name: 'Unix 时间戳转换',
    desc: '时间戳与日期时间互转，自动识别秒级与毫秒级。',
    icon: Clock,
  },
  {
    slug: 'base64',
    name: 'Base64 / URL 编解码',
    desc: '支持中文 UTF-8，编码解码即时出结果。',
    icon: Binary,
  },
  {
    slug: 'json',
    name: 'JSON 格式化与校验',
    desc: '美化、压缩 JSON，实时提示语法错误。',
    icon: Braces,
  },
  {
    slug: 'hash',
    name: '文本哈希计算',
    desc: 'SHA-1 / SHA-256 / SHA-384 / SHA-512 摘要。',
    icon: Fingerprint,
  },
  {
    slug: 'password',
    name: '随机密码生成',
    desc: '自定义长度与字符类型，本地加密随机生成。',
    icon: KeyRound,
  },
  {
    slug: 'image',
    name: '图片转 Base64',
    desc: '本地图片转 Data URL，图片不上传服务器。',
    icon: ImageIcon,
  },
  {
    slug: 'gear',
    name: '齿比与行进距离',
    desc: '齿比、Gear Inches 与每圈前进距离。',
    icon: Cog,
  },
  {
    slug: 'cadence',
    name: '踏频与配速换算',
    desc: '按踏频、齿比与轮周长估算车速。',
    icon: Gauge,
  },
  {
    slug: 'chain',
    name: '链条节数计算器',
    desc: '按牙盘、飞轮与后下叉估算链条节数。',
    icon: Link2,
  },
  {
    slug: 'wheel',
    name: '轮组与外胎周长',
    desc: '按 BSD 与胎宽计算真实周长与圈数。',
    icon: CircleDot,
  },
  {
    slug: 'pressure',
    name: '轮胎最佳胎压',
    desc: '按总重量与胎宽估算前后轮推荐胎压。',
    icon: Wind,
  },
  {
    slug: 'climb',
    name: '爬坡坡度与等级',
    desc: '计算平均坡度、倾角与爬坡等级。',
    icon: Mountain,
  },
  {
    slug: 'power',
    name: '骑行功率估算',
    desc: '按体重、速度与坡度估算 Watts 与 W/kg。',
    icon: Zap,
  },
  {
    slug: 'abv',
    name: 'ABV 酒精度计算',
    desc: '按 OG / FG 计算酒精度，支持 SG 与 Brix。',
    icon: Beer,
  },
  {
    slug: 'ibu',
    name: 'IBU 苦度计算',
    desc: 'Tinseth 公式，多组啤酒花动态累加。',
    icon: FlaskConical,
  },
  {
    slug: 'srm',
    name: 'SRM / EBC 颜色',
    desc: 'Morey 公式估算色度并预览成品颜色。',
    icon: Palette,
  },
  {
    slug: 'yeast',
    name: '酵母投放量',
    desc: '按体积、OG 与酵母日期估算细胞数与扩培。',
    icon: TestTube,
  },
  {
    slug: 'priming',
    name: '装瓶补糖计算',
    desc: '按温度与目标 CO2 计算葡萄糖、蔗糖与 DME。',
    icon: Droplets,
  },
  {
    slug: 'keg',
    name: '生啤强制碳酸化',
    desc: '按温度与 CO2 体积查表得到建议 PSI。',
    icon: GlassWater,
  },
  {
    slug: 'line',
    name: '管路长度平衡',
    desc: '按压力、高度差与管径推荐酒管长度。',
    icon: Ruler,
  },
  {
    slug: 'calories',
    name: '啤酒热量计算',
    desc: '拆分酒精与碳水热量，支持毫升与品脱。',
    icon: Flame,
  },
  {
    slug: 'bac',
    name: 'BAC 血液酒精估算',
    desc: 'Widmark 公式估算 BAC 峰值，附免责声明。',
    icon: HeartPulse,
  },
] as const;

export type ToolSlug = (typeof TOOL_DEFS)[number]['slug'];

export const TOOL_CATEGORIES = [
  {
    id: 'text',
    path: 'dev',
    label: '文本与开发工具',
    desc: '文本处理、编码转换、哈希与时间戳等开发辅助',
  },
  {
    id: 'bike',
    path: 'cycling',
    label: '骑行计算工具',
    desc: '齿比、踏频、轮组、胎压与功率估算',
  },
  {
    id: 'beer',
    path: 'brewing',
    label: '啤酒与家酿计算工具',
    desc: '酿造、包装供酒与饮用热量估算',
  },
] as const;

export type ToolCategoryId = (typeof TOOL_CATEGORIES)[number]['id'];

const TOOL_CATEGORY_OF: Record<ToolSlug, ToolCategoryId> = {
  text: 'text',
  timestamp: 'text',
  base64: 'text',
  json: 'text',
  hash: 'text',
  password: 'text',
  image: 'text',
  gear: 'bike',
  cadence: 'bike',
  chain: 'bike',
  wheel: 'bike',
  pressure: 'bike',
  climb: 'bike',
  power: 'bike',
  abv: 'beer',
  ibu: 'beer',
  srm: 'beer',
  yeast: 'beer',
  priming: 'beer',
  keg: 'beer',
  line: 'beer',
  calories: 'beer',
  bac: 'beer',
};

export const TOOLS_BY_CATEGORY = TOOL_CATEGORIES.map((category) => ({
  ...category,
  tools: TOOL_DEFS.filter((tool) => TOOL_CATEGORY_OF[tool.slug] === category.id),
}));

export function categoryPath(id: ToolCategoryId): string {
  return TOOL_CATEGORIES.find((category) => category.id === id)?.path ?? '';
}

export function categoryFromTarget(target?: string | null): ToolCategoryId | null {
  if (!target) return null;
  const byPath = TOOL_CATEGORIES.find((category) => category.path === target);
  if (byPath) return byPath.id;
  return TOOL_CATEGORY_OF[target as ToolSlug] ?? null;
}

export function toolPath(slug: ToolSlug): string {
  return `/tools/${categoryPath(TOOL_CATEGORY_OF[slug])}#${slug}`;
}

const cardButtonClass =
  'text-left rounded-[2px] border border-yunlan-hairline bg-yunlan-surface shadow-yunlan-card p-4 sm:p-5 hover:border-[#d8cbb8] hover:shadow-ink-wash transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yunlan-cinnabar/30';

interface ToolGridProps {
  onOpen: (slug: ToolSlug) => void;
  /** 只渲染指定分类；不传则按分类分组展示全部 */
  category?: ToolCategoryId;
}

export const ToolGrid: React.FC<ToolGridProps> = ({ onOpen, category }) => {
  const groups = category
    ? TOOLS_BY_CATEGORY.filter((group) => group.id === category)
    : TOOLS_BY_CATEGORY;

  if (category) {
    const tools = groups[0]?.tools ?? [];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.slug}
              type="button"
              onClick={() => onOpen(tool.slug)}
              className={cardButtonClass}
            >
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-sm bg-[#f3efe6] text-[#9a7b4f]">
                <Icon className="w-4 h-4" strokeWidth={1.6} />
              </span>
              <span className="mt-3 block text-sm font-medium text-yunlan-ink">{tool.name}</span>
              <span className="mt-1 block text-xs font-light leading-relaxed text-yunlan-muted">
                {tool.desc}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-7 sm:space-y-8">
      {groups.map((group) => (
        <section key={group.id}>
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="font-yunlan-serif text-sm sm:text-base font-medium text-yunlan-ink">
              {group.label}
            </h2>
            <span className="text-[11px] font-light text-yunlan-muted">
              {group.tools.length} 个工具
            </span>
          </div>
          <p className="mt-1 text-[11px] font-light text-yunlan-muted">{group.desc}</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {group.tools.map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.slug}
                  type="button"
                  onClick={() => onOpen(tool.slug)}
                  className={cardButtonClass}
                >
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-sm bg-[#f3efe6] text-[#9a7b4f]">
                    <Icon className="w-4 h-4" strokeWidth={1.6} />
                  </span>
                  <span className="mt-3 block text-sm font-medium text-yunlan-ink">{tool.name}</span>
                  <span className="mt-1 block text-xs font-light leading-relaxed text-yunlan-muted">
                    {tool.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
};

const CATEGORY_ICONS = { text: Type, bike: Cog, beer: Beer } as const;

const CategoryNav: React.FC<{
  active: ToolCategoryId | null;
  onChange: (id: ToolCategoryId | null) => void;
}> = ({ active, onChange }) => (
  <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
    <button
      type="button"
      onClick={() => onChange(null)}
      className={`shrink-0 min-h-9 px-3 py-1.5 text-xs rounded-sm border transition-colors ${
        active === null
          ? 'bg-yunlan-cta text-white border-yunlan-cta'
          : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline hover:border-yunlan-stone/40'
      }`}
    >
      全部分类
    </button>
    {TOOL_CATEGORIES.map((category) => (
      <button
        key={category.id}
        type="button"
        onClick={() => onChange(category.id)}
        className={`shrink-0 min-h-9 px-3 py-1.5 text-xs rounded-sm border transition-colors ${
          active === category.id
            ? 'bg-yunlan-cta text-white border-yunlan-cta'
            : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline hover:border-yunlan-stone/40'
        }`}
      >
        {category.label}
      </button>
    ))}
  </div>
);

interface ToolsPageProps {
  /** 从首页工具卡片或导航菜单进入时定位到对应工具 */
  target?: string;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ target }) => {
  const [active, setActive] = useState<ToolCategoryId | null>(() => categoryFromTarget(target));
  const [pendingTool, setPendingTool] = useState<string | undefined>(() =>
    target && TOOL_CATEGORY_OF[target as ToolSlug] ? target : undefined
  );

  useEffect(() => {
    if (!target) return;
    const category = categoryFromTarget(target);
    if (!category) return;
    setActive(category);
    if (TOOL_CATEGORY_OF[target as ToolSlug]) {
      setPendingTool(target);
      window.history.replaceState(null, '', `/tools/${categoryPath(category)}#${target}`);
    }
  }, [target]);

  useEffect(() => {
    if (!pendingTool) return;
    const timer = window.setTimeout(() => {
      document.getElementById(pendingTool)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setPendingTool(undefined);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [pendingTool, active]);

  const goCategory = (id: ToolCategoryId | null) => {
    setActive(id);
    setPendingTool(undefined);
    window.history.pushState(null, '', id ? `/tools/${categoryPath(id)}` : '/tools');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollTo = (slug: ToolSlug) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `/tools/${categoryPath(TOOL_CATEGORY_OF[slug])}#${slug}`);
  };

  const current = active ? TOOLS_BY_CATEGORY.find((item) => item.id === active) : null;

  return (
    <PageShell
      title="免费在线工具"
      subtitle="文档资料检索、文本处理、格式转换、骑行与家酿计算工具，全部在浏览器本地运行，文件不上传、无需注册。"
    >
      <CategoryNav active={active} onChange={goCategory} />

      {!active && (
        <>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            {TOOLS_BY_CATEGORY.map((category) => {
              const Icon = CATEGORY_ICONS[category.id];
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => goCategory(category.id)}
                  className={`${cardButtonClass} flex flex-col`}
                >
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-sm bg-[#f3efe6] text-[#9a7b4f]">
                    <Icon className="w-4 h-4" strokeWidth={1.6} />
                  </span>
                  <span className="mt-3 block font-yunlan-serif text-base font-medium text-yunlan-ink">
                    {category.label}
                  </span>
                  <span className="mt-1.5 block text-xs font-light leading-relaxed text-yunlan-muted">
                    {category.desc}
                  </span>
                  <span className="mt-auto pt-4 inline-flex items-center gap-1 text-[11px] text-yunlan-stone">
                    {category.tools.length} 个工具
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-4 text-[11px] font-light text-yunlan-muted">
            选择一个分类查看对应工具；也可以使用顶部「在线工具」菜单直接进入某个工具。
          </p>
        </>
      )}

      {current && (
        <>
          <div className="mt-6">
            <h2 className="font-yunlan-serif text-lg sm:text-xl font-medium text-yunlan-ink">
              {current.label}
            </h2>
            <p className="mt-1 text-[11px] font-light text-yunlan-muted">
              {current.desc} · 共 {current.tools.length} 个工具
            </p>
          </div>

          <div className="mt-4">
            <ToolGrid category={current.id} onOpen={scrollTo} />
          </div>

          <div className="mt-6 sm:mt-8 space-y-5 sm:space-y-6">
            {current.id === 'text' && (
              <>
                <TextTool />
                <TimestampTool />
                <CodecTool />
                <JsonTool />
                <HashTool />
                <PasswordTool />
                <ImageTool />
              </>
            )}
            {current.id === 'bike' && (
              <>
                <GearRatioTool />
                <CadenceTool />
                <ChainLengthTool />
                <WheelCircTool />
                <TirePressureTool />
                <ClimbTool />
                <PowerTool />
              </>
            )}
            {current.id === 'beer' && <BeerTools />}
          </div>

          <div className="mt-8">
            <p className="text-[11px] font-light text-yunlan-muted">其他分类</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOOLS_BY_CATEGORY.filter((category) => category.id !== current.id).map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => goCategory(category.id)}
                  className="inline-flex items-center gap-1 min-h-8 px-2.5 py-1 text-xs rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors"
                >
                  {category.label}（{category.tools.length}）
                  <ArrowRight className="w-3 h-3" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => goCategory(null)}
                className="inline-flex items-center gap-1 min-h-8 px-2.5 py-1 text-xs rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors"
              >
                查看全部分类
              </button>
            </div>
          </div>
        </>
      )}

      <div className={`${yunlanCardClass()} mt-6 p-5 flex items-start gap-3`}>
        <Wrench className="w-4 h-4 mt-0.5 text-[#9a7b4f] shrink-0" />
        <p className="text-xs font-light leading-relaxed text-yunlan-muted">
          所有工具均为纯前端实现，输入内容仅在当前浏览器标签页内处理，刷新后即清空。若页面长时间无响应，请减少单次处理的文本或图片体积。
        </p>
      </div>
    </PageShell>
  );
};
