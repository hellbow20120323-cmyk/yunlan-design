/**
 * 上游分享链接不可信：渲染到 <a href> 前必须过白名单，
 * 防止 `javascript:` / `data:` 之类的伪协议造成 XSS。
 */
export function safeHref(raw: string | undefined | null): string {
  const s = String(raw ?? '').trim();
  if (!s) return '#';
  if (/^magnet:\?/i.test(s)) return s;
  try {
    const u = new URL(s);
    if (u.protocol === 'https:' || u.protocol === 'http:') return s;
  } catch {
    /* 非法 URL */
  }
  return '#';
}
