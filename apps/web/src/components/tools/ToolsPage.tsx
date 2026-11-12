import React, { useEffect } from 'react';
import { Binary, Braces, Clock, Fingerprint, Image as ImageIcon, KeyRound, Type, Wrench } from 'lucide-react';
import { PageShell, yunlanCardClass } from '../PageShell';
import { TextTool } from './TextTool';
import { CodecTool } from './CodecTool';
import { JsonTool } from './JsonTool';
import { ImageTool } from './ImageTool';
import { TimestampTool } from './TimestampTool';
import { HashTool } from './HashTool';
import { PasswordTool } from './PasswordTool';

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
      subtitle="文档资料检索、文本处理与格式转换工具，全部在浏览器本地运行，文件不上传、无需注册。"
    >
      <ToolGrid onOpen={scrollTo} />

      <div className="mt-6 sm:mt-8 space-y-5 sm:space-y-6">
        <TextTool />
        <TimestampTool />
        <CodecTool />
        <JsonTool />
        <HashTool />
        <PasswordTool />
        <ImageTool />
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
