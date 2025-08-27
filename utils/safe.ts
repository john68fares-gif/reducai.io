// utils/safe.ts
/** Safe string helper:
 *  - returns the string as-is if it's already a string
 *  - if null/undefined, returns the optional fallback (or undefined)
 *  - otherwise stringifies (numbers, booleans, etc.)
 */
export function s(value: any, fallback?: string): string | undefined {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  try {
    return String(value);
  } catch {
    return fallback;
  }
}
