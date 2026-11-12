import { useEffect, useState } from 'react';
import type { TrendingHotResponse } from '../types/trending';

export function useTrendingHot(enabled = true) {
  const [data, setData] = useState<TrendingHotResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const resp = await fetch('/api/hot/trending', { credentials: 'include' });
        const body = (await resp.json()) as TrendingHotResponse & { error?: string };
        if (!resp.ok || !body.ok) throw new Error(body.error || `HTTP ${resp.status}`);
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { data, loading };
}
