import React, { useMemo, useState } from 'react';
import { Copy, Eraser, ListFilter, SortAsc } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

const textareaClass =
  'w-full min-h-[170px] p-3 text-[13px] font-mono leading-relaxed text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50 resize-y';

const actionClass =
  'inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

export const TextTool: React.FC = () => {
  const [text, setText] = useState('');
  const [hint, setHint] = useState('');

  const stats = useMemo(() => {
    const chars = Array.from(text);
    const lines = text ? text.split(/\r?\n/) : [];
    const nonEmptyLines = lines.filter((line) => line.trim());
    const uniqueLines = new Set(nonEmptyLines.map((line) => line.trim()));
    const chinese = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const words = (text.match(/[A-Za-z0-9_'-]+/g) || []).length;
    return {
      chars: chars.length,
      charsNoSpace: chars.filter((c) => !/\s/.test(c)).length,
      lines: lines.length,
      nonEmptyLines: nonEmptyLines.length,
      uniqueLines: uniqueLines.size,
      chinese,
      words,
    };
  }, [text]);

  const apply = (fn: (value: string) => string, message: string) => {
    setText((prev) => fn(prev));
    setHint(message);
  };

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setHint('已复制到剪贴板');
    } catch {
      setHint('当前浏览器不允许自动复制，请手动选择文本');
    }
  };

  return (
    <section id="text" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        文本统计与格式化
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        粘贴文本即可实时统计字数、行数，并做去除空行、去重、排序等整理，全部在浏览器本地完成。
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
        {[
          ['字符数', stats.chars],
          ['不含空格', stats.charsNoSpace],
          ['行数', stats.lines],
          ['去重后行数', stats.uniqueLines],
          ['中文字符', stats.chinese],
          ['英文单词', stats.words],
          ['非空行', stats.nonEmptyLines],
          ['段落数', text.trim() ? text.trim().split(/\n\s*\n/).length : 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="px-2 py-2.5 bg-[#f7f4ee] rounded-sm border border-yunlan-hairline">
            <div className="font-yunlan-serif text-lg text-yunlan-ink">{value}</div>
            <div className="mt-0.5 text-[11px] text-yunlan-muted">{label}</div>
          </div>
        ))}
      </div>

      <textarea
        className={`${textareaClass} mt-4`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHint('');
        }}
        placeholder="在此粘贴或输入文本…"
        spellCheck={false}
        aria-label="文本输入"
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={actionClass} onClick={() => apply((v) => v.replace(/\r\n/g, '\n'), '已统一换行符')}>
          <Eraser className="w-3.5 h-3.5" /> 统一换行
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={() => apply((v) => v.split('\n').filter((line) => line.trim()).join('\n'), '已去除空行')}
        >
          <ListFilter className="w-3.5 h-3.5" /> 去空行
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={() =>
            apply((v) => {
              const seen = new Set<string>();
              return v
                .split('\n')
                .filter((line) => {
                  const key = line.trim();
                  if (!key || seen.has(key)) return false;
                  seen.add(key);
                  return true;
                })
                .join('\n');
            }, '已按行去重')
          }
        >
          去重行
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={() => apply((v) => v.split('\n').sort((a, b) => a.localeCompare(b, 'zh-CN')).join('\n'), '已按行排序')}
        >
          <SortAsc className="w-3.5 h-3.5" /> 排序
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={() => apply((v) => v.split('\n').map((line) => line.trim()).join('\n'), '已去除行首尾空格')}
        >
          去首尾空格
        </button>
        <button type="button" className={actionClass} onClick={copy}>
          <Copy className="w-3.5 h-3.5" /> 复制
        </button>
        <button
          type="button"
          className={actionClass}
          onClick={() => {
            setText('');
            setHint('已清空');
          }}
        >
          清空
        </button>
        {hint ? <span className="text-[11px] text-yunlan-muted">{hint}</span> : null}
      </div>
    </section>
  );
};
