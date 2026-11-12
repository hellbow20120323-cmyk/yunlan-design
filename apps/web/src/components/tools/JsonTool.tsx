import React, { useMemo, useState } from 'react';
import { AlignLeft, Copy, Minimize2 } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

const textareaClass =
  'w-full min-h-[170px] p-3 text-[13px] font-mono leading-relaxed text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50 resize-y';

const actionClass =
  'inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

export const JsonTool: React.FC = () => {
  const [input, setInput] = useState('');
  const [pretty, setPretty] = useState(true);
  const [hint, setHint] = useState('');

  const { output, error } = useMemo(() => {
    if (!input.trim()) return { output: '', error: '' };
    try {
      const parsed = JSON.parse(input);
      return {
        output: pretty ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed),
        error: '',
      };
    } catch (err) {
      return {
        output: '',
        error: err instanceof Error ? err.message : 'JSON 格式不正确',
      };
    }
  }, [input, pretty]);

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setHint('结果已复制');
    } catch {
      setHint('当前浏览器不允许自动复制，请手动选择文本');
    }
  };

  return (
    <section id="json" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        JSON 格式化与校验
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        一键美化或压缩 JSON，并实时提示语法错误，适合接口调试与配置整理。
      </p>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] tracking-wide text-yunlan-muted">原始 JSON</label>
          <textarea
            className={`${textareaClass} mt-1.5`}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHint('');
            }}
            placeholder='{"name":"自行车与家酿","tools":["text","json"]}'
            spellCheck={false}
            aria-label="JSON 输入"
          />
        </div>
        <div>
          <label className="text-[11px] tracking-wide text-yunlan-muted">转换结果</label>
          <textarea
            className={`${textareaClass} mt-1.5`}
            value={output}
            readOnly
            placeholder="格式化结果会显示在这里"
            spellCheck={false}
            aria-label="JSON 结果"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setPretty(true);
            setHint('');
          }}
          className={`${actionClass} ${pretty ? 'border-yunlan-stone/50 bg-[#FAF0E4]' : ''}`}
        >
          <AlignLeft className="w-3.5 h-3.5" /> 美化
        </button>
        <button
          type="button"
          onClick={() => {
            setPretty(false);
            setHint('');
          }}
          className={`${actionClass} ${!pretty ? 'border-yunlan-stone/50 bg-[#FAF0E4]' : ''}`}
        >
          <Minimize2 className="w-3.5 h-3.5" /> 压缩
        </button>
        <button type="button" onClick={copy} className={actionClass}>
          <Copy className="w-3.5 h-3.5" /> 复制结果
        </button>
        <button
          type="button"
          onClick={() => {
            setInput('');
            setHint('');
          }}
          className={actionClass}
        >
          清空
        </button>
        {error ? (
          <span className="text-[11px] text-red-600">格式错误：{error}</span>
        ) : output ? (
          <span className="text-[11px] text-emerald-600">JSON 语法有效</span>
        ) : null}
        {hint ? <span className="text-[11px] text-yunlan-muted">{hint}</span> : null}
      </div>
    </section>
  );
};
