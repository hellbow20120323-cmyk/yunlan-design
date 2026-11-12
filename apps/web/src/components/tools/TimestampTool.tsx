import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Copy } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

const actionClass =
  'inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

const inputClass =
  'w-full min-h-10 px-3 py-2 text-[13px] font-mono text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50';

const valueClass = 'block mt-1 font-mono text-[13px] text-yunlan-ink break-all';

/** 小于 1e12 视为秒级时间戳，否则按毫秒处理 */
function toMillis(raw: string): number | null {
  const n = Number(raw.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n);
}

function toDateParts(ms: number) {
  const date = new Date(ms);
  if (Number.isNaN(date.getTime())) return null;
  return {
    local: date.toLocaleString('zh-CN', { hour12: false }),
    iso: date.toISOString(),
  };
}

/** datetime-local 需要 YYYY-MM-DDTHH:mm:ss */
function toLocalInputValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}:${pad(d.getSeconds())}`;
}

export const TimestampTool: React.FC = () => {
  const [now, setNow] = useState(() => Date.now());
  const [tsInput, setTsInput] = useState('');
  const [dateInput, setDateInput] = useState(() => toLocalInputValue(Date.now()));
  const [hint, setHint] = useState('');

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const fromTs = useMemo(() => {
    const ms = toMillis(tsInput);
    return ms == null ? null : toDateParts(ms);
  }, [tsInput]);

  const fromDate = useMemo(() => {
    const ms = new Date(dateInput).getTime();
    if (!Number.isFinite(ms)) return null;
    return { seconds: Math.floor(ms / 1000), millis: ms };
  }, [dateInput]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setHint('已复制');
    } catch {
      setHint('当前浏览器不允许自动复制，请手动选择文本');
    }
  };

  return (
    <section id="timestamp" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        Unix 时间戳转换
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        时间戳与日期时间互转，自动识别秒级与毫秒级，全部在浏览器本地计算。
      </p>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="px-3 py-2.5 bg-[#f7f4ee] border border-yunlan-hairline rounded-sm">
          <span className="text-[11px] text-yunlan-muted">当前秒级时间戳</span>
          <span className={valueClass}>{Math.floor(now / 1000)}</span>
        </div>
        <div className="px-3 py-2.5 bg-[#f7f4ee] border border-yunlan-hairline rounded-sm">
          <span className="text-[11px] text-yunlan-muted">当前毫秒级时间戳</span>
          <span className={valueClass}>{now}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] tracking-wide text-yunlan-muted">时间戳 → 日期</label>
          <div className="mt-1.5 flex gap-2">
            <input
              className={inputClass}
              value={tsInput}
              onChange={(e) => {
                setTsInput(e.target.value);
                setHint('');
              }}
              placeholder="例如 1700000000 或 1700000000000"
              inputMode="numeric"
              aria-label="时间戳输入"
            />
            <button type="button" className={actionClass} onClick={() => setTsInput(String(Math.floor(now / 1000)))}>
              <Clock className="w-3.5 h-3.5" /> 当前
            </button>
          </div>
          {fromTs ? (
            <div className="mt-2 text-xs text-yunlan-muted space-y-1">
              <p>本地时间：<span className="font-mono text-yunlan-ink">{fromTs.local}</span></p>
              <p>UTC / ISO：<span className="font-mono text-yunlan-ink">{fromTs.iso}</span></p>
              <button type="button" className={`${actionClass} mt-1`} onClick={() => copy(fromTs.iso)}>
                <Copy className="w-3.5 h-3.5" /> 复制 ISO
              </button>
            </div>
          ) : tsInput.trim() ? (
            <p className="mt-2 text-[11px] text-red-600">请输入有效的正数时间戳。</p>
          ) : null}
        </div>

        <div>
          <label className="text-[11px] tracking-wide text-yunlan-muted">日期 → 时间戳</label>
          <input
            type="datetime-local"
            step={1}
            className={`${inputClass} mt-1.5`}
            value={dateInput}
            onChange={(e) => {
              setDateInput(e.target.value);
              setHint('');
            }}
            aria-label="日期时间输入"
          />
          {fromDate ? (
            <div className="mt-2 text-xs text-yunlan-muted space-y-1">
              <p>秒级：<span className="font-mono text-yunlan-ink">{fromDate.seconds}</span></p>
              <p>毫秒级：<span className="font-mono text-yunlan-ink">{fromDate.millis}</span></p>
              <div className="flex flex-wrap gap-2 mt-1">
                <button type="button" className={actionClass} onClick={() => copy(String(fromDate.seconds))}>
                  <Copy className="w-3.5 h-3.5" /> 复制秒级
                </button>
                <button type="button" className={actionClass} onClick={() => copy(String(fromDate.millis))}>
                  <Copy className="w-3.5 h-3.5" /> 复制毫秒级
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {hint ? <p className="mt-2 text-[11px] text-yunlan-muted">{hint}</p> : null}
    </section>
  );
};
