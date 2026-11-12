import React, { useEffect } from 'react';
import {
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

const cardButtonClass =
  'text-left rounded-[2px] border border-yunlan-hairline bg-yunlan-surface shadow-yunlan-card p-4 sm:p-5 hover:border-[#d8cbb8] hover:shadow-ink-wash transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-yunlan-cinnabar/30';

interface ToolGridProps {
  onOpen: (slug: ToolSlug) => void;
}

export const ToolGrid: React.FC<ToolGridProps> = ({ onOpen }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
    {TOOL_DEFS.map((tool) => {
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

interface ToolsPageProps {
  /** 从首页工具卡片进入时滚动到对应工具 */
  target?: string;
}

export const ToolsPage: React.FC<ToolsPageProps> = ({ target }) => {
  useEffect(() => {
    const slug = target || window.location.hash.replace(/^#/, '');
    if (!slug) return;
    const el = document.getElementById(slug);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [target]);

  const scrollTo = (slug: ToolSlug) => {
    document.getElementById(slug)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `/tools#${slug}`);
  };

  return (
    <PageShell
      title="免费在线工具"
      subtitle="文档资料检索、文本处理、格式转换、骑行与家酿计算工具，全部在浏览器本地运行，文件不上传、无需注册。"
    >
      <ToolGrid onOpen={scrollTo} />

      <div className="mt-6 sm:mt-8 space-y-5 sm:space-y-6">
        <p className="text-[11px] font-sans tracking-[0.22em] text-yunlan-muted">文本与开发工具</p>
        <TextTool />
        <TimestampTool />
        <CodecTool />
        <JsonTool />
        <HashTool />
        <PasswordTool />
        <ImageTool />

        <p className="pt-2 text-[11px] font-sans tracking-[0.22em] text-yunlan-muted">骑行计算工具</p>
        <GearRatioTool />
        <CadenceTool />
        <ChainLengthTool />
        <WheelCircTool />
        <TirePressureTool />
        <ClimbTool />
        <PowerTool />

        <p className="pt-2 text-[11px] font-sans tracking-[0.22em] text-yunlan-muted">啤酒与家酿计算工具</p>
        <BeerTools />
      </div>

      <div className={`${yunlanCardClass()} mt-6 p-5 flex items-start gap-3`}>
        <Wrench className="w-4 h-4 mt-0.5 text-[#9a7b4f] shrink-0" />
        <p className="text-xs font-light leading-relaxed text-yunlan-muted">
          所有工具均为纯前端实现，输入内容仅在当前浏览器标签页内处理，刷新后即清空。若页面长时间无响应，请减少单次处理的文本或图片体积。
        </p>
      </div>
    </PageShell>
  );
};
