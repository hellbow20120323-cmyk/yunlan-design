import { useEffect, useState } from 'react';
import type { TrendingHotResponse } from '../types/trending';

export function useTrendingHot() {
  const [data, setData] = useState<TrendingHotResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
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
  }, []);

  return { data, loading };
}
