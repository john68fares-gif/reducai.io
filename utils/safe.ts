// utils/safe.ts
// tiny safe-string helper used by BuilderDashboard
export function s<T extends string | undefined | null>(val: T, fallback = ''): string {
  return typeof val === 'string' ? val : fallback;
}
