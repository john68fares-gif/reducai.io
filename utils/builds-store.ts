// utils/builds-store.ts
import { scopedStorage } from '@/utils/scoped-storage';

export type Build = {
  id: string;
  assistantId?: string;
  name: string;
  type?: string;
  industry?: string;
  language?: string;
  model?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
};

const LS_BUILDS = 'chatbots';        // legacy/local
const CLOUD_BUILDS = 'chatbots.v1';  // cloud/scoped

function readLocal(): Build[] {
  try {
    const v = localStorage.getItem(LS_BUILDS);
    return v ? (JSON.parse(v) as Build[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(builds: Build[]) {
  try {
    localStorage.setItem(LS_BUILDS, JSON.stringify(builds));
  } catch {}
}

function keyOf(b: Build) {
  return (b.assistantId || b.id || '').toLowerCase();
}

function dedupeMerge(a: Build[], b: Build[]) {
  const map = new Map<string, Build>();
  [...a, ...b].forEach((x) => {
    const k = keyOf(x);
    if (!k) return;
    const prev = map.get(k);
    if (!prev) {
      map.set(k, x);
    } else {
      // prefer the one with updatedAt (or most recent)
      const p = prev.updatedAt ? Date.parse(prev.updatedAt) : 0;
      const n = x.updatedAt ? Date.parse(x.updatedAt) : 0;
      map.set(k, n >= p ? x : prev);
    }
  });
  // newest first
  return Array.from(map.values()).sort((a, b2) => {
    const t1 = b2.updatedAt ? Date.parse(b2.updatedAt) : 0;
    const t0 = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    return t1 - t0;
  });
}

/** Load from both sources, merge, and (optionally) mirror back to local */
export async function loadBuilds(opts?: { mirrorToLocal?: boolean }): Promise<Build[]> {
  let cloud: Build[] = [];
  try {
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    cloud = (await ss.getJSON<Build[]>(CLOUD_BUILDS, [])) || [];
  } catch {
    // no-op (offline / no auth)
  }

  const local = readLocal();
  const merged = dedupeMerge(cloud, local);

  if (opts?.mirrorToLocal) writeLocal(merged);
  return merged;
}

/** Save a single build to both places (idempotent). */
export async function saveBuild(build: Build) {
  // local
  const local = readLocal();
  const mergedLocal = dedupeMerge([build], local);
  writeLocal(mergedLocal);

  // cloud
  try {
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    const cloud = (await ss.getJSON<Build[]>(CLOUD_BUILDS, [])) || [];
    const mergedCloud = dedupeMerge([build], cloud);
    await ss.setJSON(CLOUD_BUILDS, mergedCloud);
  } catch {
    // no-op
  }
}

/** Simple hook you can use inside the dashboard list */
export function subscribeBuilds(setter: (items: Build[]) => void) {
  let cancelled = false;

  async function refresh(mirror = false) {
    const items = await loadBuilds({ mirrorToLocal: mirror });
    if (!cancelled) setter(items);
  }

  // initial
  refresh(true);

  // cross-tab and visibility refresh
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key === 'chatbots' || e.key === 'builder:cleanup') refresh(false);
  };
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh(false);
  };

  window.addEventListener('storage', onStorage);
  document.addEventListener('visibilitychange', onVisible);

  return () => {
    cancelled = true;
    window.removeEventListener('storage', onStorage);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
