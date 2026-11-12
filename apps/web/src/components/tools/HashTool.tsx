import React, { useEffect, useState } from 'react';
import { Copy, Fingerprint } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

type Algorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512';

const ALGORITHMS: Algorithm[] = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];

const textareaClass =
  'w-full min-h-[120px] p-3 text-[13px] font-mono leading-relaxed text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50 resize-y';

const actionClass =
  'inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export const HashTool: React.FC = () => {
  const [text, setText] = useState('');
  const [algorithm, setAlgorithm] = useState<Algorithm>('SHA-256');
  const [hash, setHash] = useState('');
  const [error, setError] = useState('');
  const [hint, setHint] = useState('');

  useEffect(() => {
    if (!text) {
      setHash('');
      setError('');
      return;
    }
    let alive = true;
    const run = async () => {
      try {
        if (!window.crypto?.subtle) throw new Error('unsupported');
        const data = new TextEncoder().encode(text);
        const digest = await window.crypto.subtle.digest(algorithm, data);
        if (alive) {
          setHash(toHex(digest));
          setError('');
        }
      } catch {
        if (alive) {
          setHash('');
          setError('当前浏览器环境不支持 Web Crypto，请通过 HTTPS 访问本站后重试。');
        }
      }
    };
    void run();
    return () => {
      alive = false;
    };
  }, [text, algorithm]);

  const copy = async () => {
    if (!hash) return;
    try {
      await navigator.clipboard.writeText(hash);
      setHint('哈希已复制');
    } catch {
      setHint('当前浏览器不允许自动复制，请手动选择文本');
    }
  };

  return (
    <section id="hash" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        文本哈希计算
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        支持 SHA-1 / SHA-256 / SHA-384 / SHA-512，实时计算文本摘要，内容不会上传服务器。
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {ALGORITHMS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setAlgorithm(item);
              setHint('');
            }}
            className={`min-h-9 px-3 py-1.5 text-xs rounded-sm border transition-colors ${
              algorithm === item
                ? 'bg-yunlan-cta text-white border-yunlan-cta'
                : 'bg-yunlan-surface text-yunlan-stone border-yunlan-hairline hover:border-yunlan-stone/40'
            }`}
          >
            {item}
          </button>
        ))}
      </div>

      <textarea
        className={`${textareaClass} mt-4`}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setHint('');
        }}
        placeholder="输入需要计算哈希的文本…"
        spellCheck={false}
        aria-label="哈希输入"
      />

      <div className="mt-3">
        <label className="text-[11px] tracking-wide text-yunlan-muted">
          {algorithm} 结果
        </label>
        <textarea
          className={`${textareaClass} mt-1.5`}
          value={hash}
          readOnly
          placeholder="哈希结果会显示在这里"
          aria-label="哈希结果"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button type="button" className={actionClass} onClick={copy}>
            <Copy className="w-3.5 h-3.5" /> 复制哈希
          </button>
          <span className="inline-flex items-center gap-1 text-[11px] text-yunlan-muted">
            <Fingerprint className="w-3.5 h-3.5" /> 十六进制小写
          </span>
          {error ? <span className="text-[11px] text-red-600">{error}</span> : null}
          {hint ? <span className="text-[11px] text-yunlan-muted">{hint}</span> : null}
        </div>
      </div>
    </section>
  );
};
