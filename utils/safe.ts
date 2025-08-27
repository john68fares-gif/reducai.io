// utils/safe.ts
export const isBrowser = typeof window !== 'undefined';

export const st = {
  get<T = unknown>(key: string, fallback: T): T {
    if (!isBrowser) return fallback;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    if (!isBrowser) return;
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove(key: string) {
    if (!isBrowser) return;
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};
