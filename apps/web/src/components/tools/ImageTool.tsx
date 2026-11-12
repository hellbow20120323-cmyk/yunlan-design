import React, { useRef, useState } from 'react';
import { Copy, Image as ImageIcon, Upload, X } from 'lucide-react';
import { yunlanCardClass } from '../PageShell';

const textareaClass =
  'w-full min-h-[150px] p-3 text-[12px] font-mono leading-relaxed text-yunlan-ink bg-[#fbfaf7] border border-yunlan-hairline rounded-sm focus:outline-none focus:border-yunlan-stone/50 resize-y';

const actionClass =
  'inline-flex items-center gap-1.5 min-h-9 px-3 py-1.5 text-xs font-medium rounded-sm border border-yunlan-hairline bg-yunlan-surface text-yunlan-stone hover:border-yunlan-stone/40 transition-colors';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export const ImageTool: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [dataUrl, setDataUrl] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [hint, setHint] = useState('');
  const [error, setError] = useState('');

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('请选择图片文件（PNG / JPG / GIF / WebP / SVG）。');
      return;
    }
    setError('');
    setHint('');
    setFileName(file.name);
    setFileSize(file.size);
    const reader = new FileReader();
    reader.onload = () => setDataUrl(String(reader.result || ''));
    reader.onerror = () => setError('读取图片失败，请重试。');
    reader.readAsDataURL(file);
  };

  const copy = async () => {
    if (!dataUrl) return;
    try {
      await navigator.clipboard.writeText(dataUrl);
      setHint('Base64 已复制');
    } catch {
      setHint('当前浏览器不允许自动复制，请手动选择文本');
    }
  };

  const reset = () => {
    setFileName('');
    setDataUrl('');
    setFileSize(0);
    setHint('');
    setError('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section id="image" className={`${yunlanCardClass()} p-5 sm:p-6 scroll-mt-24`}>
      <h2 className="font-yunlan-serif text-base sm:text-lg font-medium text-yunlan-ink">
        图片转 Base64
      </h2>
      <p className="mt-2 text-[13px] font-light text-yunlan-muted leading-relaxed">
        选择本地图片即可生成 Data URL，可复制用于 HTML 或 CSS。图片只在浏览器内读取，不会上传服务器。
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => inputRef.current?.click()} className={actionClass}>
          <Upload className="w-3.5 h-3.5" /> 选择图片
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {fileName ? (
          <span className="inline-flex items-center gap-2 text-xs text-yunlan-muted">
            <ImageIcon className="w-3.5 h-3.5" />
            {fileName} · {formatBytes(fileSize)}
            <button type="button" onClick={reset} className="text-yunlan-muted hover:text-red-600" aria-label="清除图片">
              <X className="w-3.5 h-3.5" />
            </button>
          </span>
        ) : (
          <span className="text-xs text-yunlan-muted">支持 PNG / JPG / GIF / WebP / SVG</span>
        )}
      </div>

      {error ? <p className="mt-2 text-[11px] text-red-600">{error}</p> : null}

      {dataUrl ? (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[minmax(0,220px)_1fr] gap-4">
          <div className="flex items-center justify-center p-3 bg-[#f7f4ee] border border-yunlan-hairline rounded-sm">
            <img src={dataUrl} alt="预览" className="max-h-40 max-w-full object-contain" />
          </div>
          <div>
            <textarea className={textareaClass} value={dataUrl} readOnly aria-label="图片 Base64 结果" />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button type="button" onClick={copy} className={actionClass}>
                <Copy className="w-3.5 h-3.5" /> 复制 Base64
              </button>
              <span className="text-[11px] text-yunlan-muted">约 {formatBytes(dataUrl.length)} 文本</span>
              {hint ? <span className="text-[11px] text-yunlan-muted">{hint}</span> : null}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
