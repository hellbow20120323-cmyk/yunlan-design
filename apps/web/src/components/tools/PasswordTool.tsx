import React, { useCallback, useEffect, useState } from 'react';
import { Copy, RefreshCw } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

const actionClass =
  'inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

const CHARSETS = {
  lower: 'abcdefghijkmnpqrstuvwxyz',
  upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
  digits: '23456789',
  symbols: '!@#$%^&*-_=+?',
};

type CharsetKey = keyof typeof CHARSETS;

function pickRandom(chars: string): string {
  const buffer = new Uint32Array(1);
  window.crypto.getRandomValues(buffer);
  return chars[buffer[0] % chars.length];
}

export const PasswordTool: React.FC = () => {
  const [length, setLength] = useState(16);
  const [enabled, setEnabled] = useState<Record<CharsetKey, boolean>>({
    lower: true,
    upper: true,
    digits: true,
    symbols: true,
  });
  const [password, setPassword] = useState('');
  const [hint, setHint] = useState('');

  const generate = useCallback(() => {
    const pool = (Object.keys(CHARSETS) as CharsetKey[])
      .filter((key) => enabled[key])
      .map((key) => CHARSETS[key])
      .join('');
    if (!pool) {
      setPassword('');
      setHint('请至少选择一种字符类型');
      return;
    }
    let next = '';
    for (let i = 0; i < length; i += 1) next += pickRandom(pool);
    setPassword(next);
    setHint('');
  }, [enabled, length]);

  useEffect(() => {
    generate();
  }, [generate]);

  const copy = async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setHint('密码已复制');
    } catch {
      setHint('当前浏览器不允许自动复制，请手动选择文本');
    }
  };

  return (
    <section id="password" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        随机密码生成
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        使用浏览器加密随机数生成强密码，可自定义长度与字符类型，结果不会上传到任何服务器。
      </p>

      <div className="mt-4">
        <label className="text-[11px] tracking-wide text-yunlan-muted">
          长度：<span className="font-mono text-yunlan-ink">{length}</span>
        </label>
        <input
          type="range"
          min={8}
          max={64}
          value={length}
          onChange={(e) => setLength(Number(e.target.value))}
          className="mt-2 w-full accent-yunlan-cinnabar"
          aria-label="密码长度"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(CHARSETS) as CharsetKey[]).map((key) => {
          const labels: Record<CharsetKey, string> = {
            lower: '小写字母',
            upper: '大写字母',
            digits: '数字',
            symbols: '符号',
          };
          return (
            <label
              key={key}
              className={`inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs rounded-sm border cursor-pointer transition-colors ${
                enabled[key]
                  ? 'bg-[#FAF0E4] border-yunlan-stone/40 text-yunlan-ink'
                  : 'bg-yunlan-surface border-yunlan-hairline text-yunlan-muted'
              }`}
            >
              <input
                type="checkbox"
                checked={enabled[key]}
                onChange={(e) => setEnabled((prev) => ({ ...prev, [key]: e.target.checked }))}
                className="accent-yunlan-cinnabar"
              />
              {labels[key]}
            </label>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-[#fbfaf7] border border-yunlan-hairline rounded-sm min-h-[52px] flex items-center">
        <span className="font-mono text-sm text-yunlan-ink break-all">{password || '—'}</span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={actionClass} onClick={generate}>
          <RefreshCw className="w-3.5 h-3.5" /> 重新生成
        </button>
        <button type="button" className={actionClass} onClick={copy}>
          <Copy className="w-3.5 h-3.5" /> 复制
        </button>
        {hint ? <span className="text-[11px] text-yunlan-muted">{hint}</span> : null}
      </div>
    </section>
  );
};
