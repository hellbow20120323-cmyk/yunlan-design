import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Copy } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

type Mode = 'base64-encode' | 'base64-decode' | 'url-encode' | 'url-decode';

const MODES: { id: Mode; label: string }[] = [
  { id: 'base64-encode', label: 'Base64 编码' },
  { id: 'base64-decode', label: 'Base64 解码' },
  { id: 'url-encode', label: 'URL 编码' },
  { id: 'url-decode', label: 'URL 解码' },
];

const textareaClass =
  'w-full min-h-[140px] p-3 text-[13px] font-mono leading-relaxed text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50 resize-y';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function base64ToText(value: string): string {
  const binary = atob(value.replace(/\s+/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

function convert(input: string, mode: Mode): string {
  if (!input) return '';
  switch (mode) {
    case 'base64-encode':
      return bytesToBase64(new TextEncoder().encode(input));
    case 'base64-decode':
      return base64ToText(input);
    case 'url-encode':
      return encodeURIComponent(input);
    case 'url-decode':
      return decodeURIComponent(input);
    default:
      return '';
  }
}

export const CodecTool: React.FC = () => {
  const [mode, setMode] = useState<Mode>('base64-encode');
  const [input, setInput] = useState('');
  const [hint, setHint] = useState('');

  const { output, error } = useMemo(() => {
    try {
      return { output: convert(input, mode), error: '' };
    } catch {
      return { output: '', error: '输入内容无法按当前方式转换，请检查格式是否正确。' };
    }
  }, [input, mode]);

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
    <section id="base64" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        Base64 / URL 编解码
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        支持中文 UTF-8 的 Base64 与 URL 编码解码，输入即出结果，内容不会离开你的浏览器。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {MODES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setMode(item.id);
              setHint('');
            }}
            className={`min-h-9 px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              mode === item.id
                ? 'bg-yunlan-cta text-white border-yunlan-cta'
                : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline hover:border-yunlan-stone/40'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] tracking-wide text-yunlan-muted">输入</label>
          <textarea
            className={`${textareaClass} mt-1.5`}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setHint('');
            }}
            placeholder="输入需要转换的内容…"
            spellCheck={false}
            aria-label="编解码输入"
          />
        </div>
        <div>
          <label className="text-[11px] tracking-wide text-yunlan-muted">结果</label>
          <textarea
            className={`${textareaClass} mt-1.5`}
            value={output}
            readOnly
            placeholder="转换结果会显示在这里"
            spellCheck={false}
            aria-label="编解码结果"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors"
        >
          <Copy className="w-3.5 h-3.5" /> 复制结果
        </button>
        <button
          type="button"
          onClick={() => {
            setInput(output);
            setMode(mode.endsWith('encode') ? (mode.startsWith('base64') ? 'base64-decode' : 'url-decode') : mode.startsWith('base64') ? 'base64-encode' : 'url-encode');
            setHint('已把结果放回输入框');
          }}
          className="inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" /> 结果互转
        </button>
        {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
        {hint ? <span className="text-[11px] text-yunlan-muted">{hint}</span> : null}
      </div>
    </section>
  );
};
