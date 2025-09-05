// utils/scoped-storage.ts
import { supabase } from '@/lib/supabase-client';

export type Scoped = {
  getJSON<T>(key: string, fallback: T): Promise<T>;
  setJSON<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  keyFor(key: string): Promise<string>;
  ensureOwnerGuard(): Promise<void>;
};

/**
 * Namespaces localStorage keys per-user and ensures the previous user’s data
 * is not shown after account switches.
 */
export async function scopedStorage(): Promise<Scoped> {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id || 'anon';
  const prefix = `user:${uid}:`;

  async function keyFor(key: string) { return `${prefix}${key}`; }

  async function getJSON<T>(key: string, fallback: T): Promise<T> {
    try {
      const raw = localStorage.getItem(await keyFor(key));
      return raw ? JSON.parse(raw) as T : fallback;
    } catch { return fallback; }
  }

  async function setJSON<T>(key: string, value: T): Promise<void> {
    try { localStorage.setItem(await keyFor(key), JSON.stringify(value)); } catch {}
  }

  async function remove(key: string) {
    try { localStorage.removeItem(await keyFor(key)); } catch {}
  }

  // Guard: if account changes, wipe non-namespaced leftovers and set new owner
  async function ensureOwnerGuard() {
    try {
      const ownerKey = 'workspace:owner';
      const prev = localStorage.getItem(ownerKey);
      if (prev && prev !== uid) {
        // clear all non-namespaced legacy keys you used before
        ['chatbots','agents','builds','builder:step1','builder:step2','builder:step3','builder:draft','builder:cleanup','builder:step2Numbers']
          .forEach(k => localStorage.removeItem(k));
      }
      localStorage.setItem(ownerKey, uid);
    } catch {}
  }

  return { getJSON, setJSON, remove, keyFor, ensureOwnerGuard };
}

/** One-time migration from old global keys → namespaced keys */
export async function migrateLegacyKeysToUser() {
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id || 'anon';
  const prefix = `user:${uid}:`;
  const LEGACY = ['chatbots','agents','builds','builder:step1','builder:step2','builder:step3','builder:draft','builder:step2Numbers'];

  try {
    for (const k of LEGACY) {
      const raw = localStorage.getItem(k);
      if (raw && !localStorage.getItem(`${prefix}${k}`)) {
        localStorage.setItem(`${prefix}${k}`, raw);
      }
    }
    // optional: clear legacy after migrating
    // LEGACY.forEach(k => localStorage.removeItem(k));
  } catch {}
}
