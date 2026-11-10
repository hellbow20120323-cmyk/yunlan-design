/**
 * Infer and format file sizes for search hits.
 */

/**
 * @param {number} bytes
 * @returns {string}
 */
export function formatSizeBytes(bytes) {
  const n = Math.max(0, Number(bytes) || 0);
  if (n <= 0) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const digits = v >= 100 ? 0 : v >= 10 ? 1 : 2;
  return `${v.toFixed(digits)} ${units[i]}`;
}

/**
 * @param {string} url
 * @returns {number}
 */
export function parseSizeBytesFromMagnet(url) {
  const raw = String(url || "").trim();
  if (!/^magnet:/i.test(raw)) return 0;
  try {
    const u = new URL(raw);
    const xl = u.searchParams.get("xl") || u.searchParams.get("xs");
    if (xl && /^\d+$/.test(xl)) return Number(xl);
  } catch {
    const m = raw.match(/(?:[?&]|;)xl=(\d+)/i);
    if (m) return Number(m[1]);
  }
  return 0;
}

/**
 * @param {string} text
 * @returns {number}
 */
export function parseSizeBytesFromText(text) {
  const s = String(text || "");
  if (!s) return 0;
  const re = /(\d+(?:\.\d+)?)\s*(TB|TiB|GB|GiB|G|MB|MiB|M|KB|KiB|K)(?![a-zA-Z])/gi;
  let best = 0;
  let m;
  while ((m = re.exec(s))) {
    const val = parseFloat(m[1]);
    if (!Number.isFinite(val) || val <= 0) continue;
    const unit = m[2].toUpperCase();
    let bytes = 0;
    if (unit === "TB" || unit === "TIB") bytes = val * 1024 ** 4;
    else if (unit === "GB" || unit === "GIB" || unit === "G") bytes = val * 1024 ** 3;
    else if (unit === "MB" || unit === "MIB" || unit === "M") bytes = val * 1024 ** 2;
    else if (unit === "KB" || unit === "KIB" || unit === "K") bytes = val * 1024;
    if (bytes > best) best = bytes;
  }
  return Math.round(best);
}

/**
 * @param {{ url?: string, title?: string, note?: string, link?: object }} opts
 * @returns {number}
 */
export function inferSizeBytes(opts = {}) {
  const url = String(opts.url || "");
  const title = String(opts.title || "");
  const note = String(opts.note || "");
  const link = opts.link || null;
  const fromLink = Math.max(0, Number(link?.sizeBytes ?? link?.size ?? 0) || 0);
  if (fromLink > 0) return fromLink;
  const fromMagnet = parseSizeBytesFromMagnet(url);
  if (fromMagnet > 0) return fromMagnet;
  return parseSizeBytesFromText(`${title} ${note}`);
}
