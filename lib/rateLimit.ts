// lib/rateLimit.ts
const buckets = new Map<string, { tokens: number; ts: number }>();

export function rateLimit(ip: string, maxPerMin = 40) {
  const now = Date.now();
  const refill = maxPerMin / 60_000; // tokens per ms
  const b = buckets.get(ip) ?? { tokens: maxPerMin, ts: now };
  const elapsed = now - b.ts;
  b.tokens = Math.min(maxPerMin, b.tokens + elapsed * refill);
  b.ts = now;

  if (b.tokens < 1) {
    buckets.set(ip, b);
    return false;
  }
  b.tokens -= 1;
  buckets.set(ip, b);
  return true;
}
