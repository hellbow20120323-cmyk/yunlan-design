import { useCallback, useEffect, useState } from 'react';
import { AuthMeResponse, AuthUser, PointsStatus } from '../types/auth';

import { STORAGE_KEYS, clientIdHeader } from '../utils/storage';

const CLIENT_KEY = STORAGE_KEYS.clientId;

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
      ...clientIdHeader(),
    },
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  }
  return data;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [points, setPoints] = useState<PointsStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await apiJson<AuthMeResponse>('/api/auth/me');
      if (data.clientId) localStorage.setItem(CLIENT_KEY, data.clientId);
      setUser(data.user);
      setPoints(data.points);
    } catch {
      setUser(null);
      setPoints(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiJson<AuthMeResponse>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      setPoints(data.points);
      return data;
    },
    []
  );

  const register = useCallback(
    async (email: string, password: string) => {
      const data = await apiJson<AuthMeResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setUser(data.user);
      setPoints(data.points);
      return data;
    },
    []
  );

  const logout = useCallback(async () => {
    const data = await apiJson<AuthMeResponse>('/api/auth/logout', { method: 'POST' });
    setUser(null);
    setPoints(data.points);
  }, []);

  const applyPoints = useCallback((next: PointsStatus) => {
    setPoints(next);
  }, []);

  return { user, points, loading, refresh, login, register, logout, applyPoints };
}
