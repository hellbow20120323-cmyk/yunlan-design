import { useEffect, useMemo, useState } from 'react';
import { HOME_HOT_KEYWORD_BUNDLES } from '../constants/homeHotKeywords';
import { HOT_KEYWORDS } from '../constants/providers';

export interface SearchSuggestItem {
  text: string;
  source: 'local' | 'remote' | 'history';
}

/** 与 gateway WELL_KNOWN_TITLES 对齐，输入时立刻能扩出「星球大战」等，不必等接口 */
const WELL_KNOWN_TITLES = [
  '星球大战',
  '星球大战：帝国反击战',
  '星球大战：绝地归来',
  '星际穿越',
  '流浪地球',
  '流浪地球2',
  '三体',
  '哈利波特',
  '指环王',
  '霍比特人',
  '复仇者联盟',
  '蜘蛛侠',
  '蜘蛛侠：英雄归来',
  '蜘蛛侠：纵横宇宙',
  '蝙蝠侠',
  '盗梦空间',
  '阿凡达',
  '泰坦尼克号',
  '肖申克的救赎',
  '让子弹飞',
  '哪吒之魔童闹海',
  '哪吒之魔童降世',
  '奥本海默',
  '沙丘',
  '沙丘2',
  '权力的游戏',
  '绝命毒师',
  '狂飙',
  '庆余年',
  '琅琊榜',
  '甄嬛传',
  '黑神话悟空',
  '周杰伦',
  'FLAC无损音乐',
];

const HOME_KEYWORDS = [
  ...WELL_KNOWN_TITLES,
  ...HOME_HOT_KEYWORD_BUNDLES.flatMap((bundle) => bundle.keywords.map((item) => item.keyword)),
  ...HOT_KEYWORDS.map((item) => item.keyword),
];

function normalize(text: string): string {
  return text.normalize('NFKC').trim().toLowerCase();
}

function rankLocal(query: string, corpus: string[]): string[] {
  const q = normalize(query);
  if (!q) return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  const seen = new Set<string>();
  for (const raw of corpus) {
    const text = raw.replace(/\s+/g, ' ').trim();
    const n = normalize(text);
    if (!n || n === q || seen.has(n)) continue;
    if (n.startsWith(q)) {
      prefix.push(text);
      seen.add(n);
    } else if (n.includes(q)) {
      contains.push(text);
      seen.add(n);
    }
  }
  return [...prefix, ...contains].slice(0, 8);
}

export function useSearchSuggest(
  query: string,
  extraLocal: string[],
  historyQueries: string[],
  enabled: boolean
): SearchSuggestItem[] {
  const [remote, setRemote] = useState<SearchSuggestItem[]>([]);
  const local = useMemo(() => {
    const q = query.trim();
    if (!enabled || q.length < 1) return [];
    const fromHistory = rankLocal(q, historyQueries).map((text) => ({
      text,
      source: 'history' as const,
    }));
    const fromLocal = rankLocal(q, [...extraLocal, ...HOME_KEYWORDS]).map((text) => ({
      text,
      source: 'local' as const,
    }));
    return [...fromHistory, ...fromLocal];
  }, [query, extraLocal, historyQueries, enabled]);

  useEffect(() => {
    const q = query.trim();
    if (!enabled || q.length < 1 || q.length > 40) {
      setRemote([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/search/suggest?q=${encodeURIComponent(q)}`, {
        credentials: 'include',
        signal: controller.signal,
      })
        .then(async (res) => {
          if (!res.ok) return { items: [] as SearchSuggestItem[] };
          return (await res.json()) as { items?: SearchSuggestItem[] };
        })
        .then((body) => {
          const items = Array.isArray(body.items) ? body.items : [];
          setRemote(
            items
              .map((item) => {
                const source: SearchSuggestItem['source'] =
                  item.source === 'local' ? 'local' : 'remote';
                return { text: String(item.text || '').trim(), source };
              })
              .filter((item) => item.text)
          );
        })
        .catch(() => {
          if (!controller.signal.aborted) setRemote([]);
        });
    }, 180);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, enabled]);

  return useMemo(() => {
    const seen = new Set<string>();
    const out: SearchSuggestItem[] = [];
    for (const item of [...local, ...remote]) {
      const key = normalize(item.text);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(item);
      if (out.length >= 8) break;
    }
    return out;
  }, [local, remote]);
}
