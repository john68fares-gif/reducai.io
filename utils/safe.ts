// utils/safe.ts
// Tiny helpers used by the Builder steps.
// Drop this at: /utils/safe.ts  (so imports like `@/utils/safe` work)

export function s(v?: unknown): string {
  return String(v ?? '').trim();
}

export function st(v?: unknown, fallback = ''): string {
  const out = s(v);
  return out.length ? out : fallback;
}

export function jget<T = unknown>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function jset(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}
