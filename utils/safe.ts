// utils/safe.ts

// String helpers
export function s(v: any, fallback = ''): string {
  if (v == null) return fallback;
  return typeof v === 'string' ? v : String(v);
}

// We export 'st' as a function *and* attach storage helpers on it.
// So you can call st('  hi  ') -> 'hi'  AND  st.get('key', fallback)
export function st(v: any, fallback = ''): string {
  return s(v, fallback).trim();
}

// --- attach localStorage helpers onto the function object ---
const isBrowser = typeof window !== 'undefined';

(st as any).get = function <T = unknown>(key: string, fallback: T): T {
  if (!isBrowser) return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

(st as any).set = function (key: string, value: unknown) {
  if (!isBrowser) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
};

(st as any).remove = function (key: string) {
  if (!isBrowser) return;
  try {
    localStorage.removeItem(key);
  } catch {}
};
