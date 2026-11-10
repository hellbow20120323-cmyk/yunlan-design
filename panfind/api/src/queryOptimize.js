/**
 * Search query normalization: format typos, upstream fallbacks.
 */

function normToken(s) {
  return String(s || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase();
}

/** Common audio/format typos → canonical Latin token */
const FORMAT_TYPO_FIX = {
  falc: "flac",
  flc: "flac",
  fla: "flac",
  fal: "flac",
  flacs: "flac",
  wavs: "wav",
  apes: "ape",
  mp3s: "mp3",
  dsf: "dsd",
  dff: "dsd",
};

const FORMAT_CANONICAL = new Set([
  "flac",
  "ape",
  "wav",
  "dsd",
  "mp3",
  "mkv",
  "mp4",
  "4k",
  "1080p",
  "2160p",
  "无损",
  "hi-res",
  "hires",
  "母带",
]);

/**
 * @param {string} token normalized lowercase
 * @returns {string[]}
 */
export function formatTokenVariants(token) {
  const t = normToken(token);
  if (!t) return [];
  const out = new Set([t]);
  const fix = FORMAT_TYPO_FIX[t];
  if (fix) out.add(fix);
  return [...out];
}

/**
 * Fix known typos in user query (preserve CJK / spacing).
 * @param {string} kw
 * @returns {string}
 */
export function correctFormatTyposInQuery(kw) {
  const raw = String(kw || "").trim();
  if (!raw) return raw;
  return raw.replace(/[a-zA-Z][a-zA-Z0-9+-]*/g, (word) => {
    const low = word.toLowerCase();
    const fixed = FORMAT_TYPO_FIX[low];
    if (!fixed) return word;
    if (word === word.toUpperCase()) return fixed.toUpperCase();
    if (word[0] === word[0].toUpperCase()) {
      return fixed.charAt(0).toUpperCase() + fixed.slice(1);
    }
    return fixed;
  });
}

/**
 * @param {string} kw
 * @returns {{ original: string, normalized: string, upstreamTerms: string[], corrected: boolean }}
 */
export function prepareSearchKeywords(kw) {
  const original = String(kw || "").trim();
  const normalized = correctFormatTyposInQuery(original);
  const corrected = normalized !== original;

  /** @type {string[]} */
  const upstreamTerms = [];
  const push = (s) => {
    const t = String(s || "").trim();
    if (t && !upstreamTerms.includes(t)) upstreamTerms.push(t);
  };

  push(normalized);
  if (corrected) push(original);

  const parts = normalized.split(/\s+/).filter(Boolean);
  const core = parts.filter((p) => {
    const n = normToken(p);
    if (FORMAT_CANONICAL.has(n)) return false;
    if (FORMAT_TYPO_FIX[n]) return false;
    return true;
  });
  if (core.length > 0 && core.length < parts.length) {
    push(core.join(" "));
  }
  if (core.length === 1 && parts.length > 1) {
    push(core[0]);
  }

  return { original, normalized, upstreamTerms, corrected };
}
