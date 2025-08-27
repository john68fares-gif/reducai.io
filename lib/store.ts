// utils/safe.ts

/** Always return a string. Never calls .trim() on unknown input. */
export const s = (v: any, fb = ''): string => {
  if (typeof v === 'string') return v;   // already a string
  if (v == null) return fb;              // null/undefined -> fallback
  try {
    return String(v);                    // numbers/booleans/objects -> string
  } catch {
    return fb;
  }
};

/** Trimmed version of s(). Still null-safe. */
export const st = (v: any, fb = ''): string => s(v, fb).trim();

/** Optional helper: coerce to boolean with fallback. */
export const sb = (v: any, fb = false): boolean =>
  typeof v === 'boolean' ? v : (v == null ? fb : Boolean(v));
