// Namespaced localStorage helpers (per user)
export const userKey = (userId: string, slot: string) => `user:${userId}:${slot}`;

export function readJSON<T>(userId: string, slot: string, fallback: T): T {
  try { const v = localStorage.getItem(userKey(userId, slot)); return v ? JSON.parse(v) as T : fallback; }
  catch { return fallback; }
}

export function writeJSON(userId: string, slot: string, value: any) {
  try { localStorage.setItem(userKey(userId, slot), JSON.stringify(value)); } catch {}
}

export function readText(userId: string, slot: string, fallback = '') {
  try { return localStorage.getItem(userKey(userId, slot)) ?? fallback; } catch { return fallback; }
}

export function writeText(userId: string, slot: string, value: string) {
  try { localStorage.setItem(userKey(userId, slot), value); } catch {}
}

export function clearAllForUser(userId: string) {
  try {
    const prefix = `user:${userId}:`;
    Object.keys(localStorage).forEach(k => { if (k.startsWith(prefix)) localStorage.removeItem(k); });
  } catch {}
}
