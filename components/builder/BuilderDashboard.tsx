// components/builder/BuilderDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus, Bot as BotIcon, ArrowRight, Trash2, SlidersHorizontal, X, Copy,
  Download as DownloadIcon, FileText, Settings, MessageSquareText, Landmark,
  ListChecks, AlertTriangle, MoreVertical
} from 'lucide-react';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';
import { scopedStorage } from '@/utils/scoped-storage';
import { supabase } from '@/lib/supabase-client'; // ← NEW

/* 3D preview (unchanged) */
const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{ background: 'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))' }}
    />
  ),
});

/* ───────────────────────────────── Visual tokens to match Voice Agent ───────────────────────────────── */

const RAD_CARD = 22;
const RAD_PANEL = 26;

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: RAD_CARD,
};

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: '0 18px 48px rgba(0,0,0,.20), var(--shadow-soft)',
  borderRadius: RAD_PANEL,
};

const BTN_PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 14,
};

/* ───────────────────────────────── Types ───────────────────────────────── */

type Appearance = {
  accent?: string;
  shellColor?: string;
  bodyColor?: string;
  trimColor?: string;
  faceColor?: string;
  variant?: string;
  eyes?: string;
  head?: string;
  torso?: string;
  arms?: string;
  legs?: string;
  antenna?: boolean;
  withBody?: boolean;
  idle?: boolean;
};

type Bot = {
  id: string;
  assistantId?: string;
  name: string;
  type?: string;
  industry?: string;
  language?: string;
  model?: string;
  description?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  appearance?: Appearance;
};

const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');
const palette = ['#00ffc2', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[Math.abs([...id].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

/* ───────────────────────────────── Normalizers / Storage ───────────────────────────────── */

function normalize(b: any): Bot {
  const id = String(
    b?.assistantId ||
      b?.id ||
      (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString())
  );
  return {
    id,
    assistantId: String(b?.assistantId || b?.id || id),
    name: s(b?.name, 'Untitled Assistant'),
    type: s(b?.type) || 'ai automation',
    industry: s(b?.industry),
    language: s(b?.language),
    model: s(b?.model, 'gpt-4o-mini'),
    description: s(b?.description),
    prompt: s(b?.prompt),
    createdAt: b?.createdAt || nowISO(),
    updatedAt: b?.updatedAt || b?.createdAt || nowISO(),
    appearance: b?.appearance ?? undefined,
  };
}
const sortByNewest = (arr: Bot[]) =>
  arr
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt || b.createdAt || '0') -
        Date.parse(a.updatedAt || a.createdAt || '0')
    );

function mergeByAssistantId(a: Bot[], b: Bot[]): Bot[] {
  const map = new Map<string, Bot>();
  const put = (x: Bot) => {
    const key = x.assistantId || x.id;
    const exist = map.get(key);
    if (!exist) map.set(key, x);
    else {
      const newer =
        Date.parse(x.updatedAt || x.createdAt || '0') >
        Date.parse(exist.updatedAt || exist.createdAt || '0');
      map.set(key, newer ? x : exist);
    }
  };
  a.forEach(put);
  b.forEach(put);
  return sortByNewest([...map.values()]);
}

function readLocal(): Bot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chatbots');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return sortByNewest(arr.map(normalize));
    }
  } catch {}
  for (const k of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      return sortByNewest(arr.map(normalize));
    } catch {}
  }
  return [];
}
function writeLocal(bots: Bot[]) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(sortByNewest(bots)));
  } catch {}
}

async function readCloud(): Promise<Bot[]> {
  try {
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
    if (!Array.isArray(cloud)) return [];
    return sortByNewest(cloud.map(normalize));
  } catch {
    return [];
  }
}

/* ───────────────────────────────── Authenticated API helpers ───────────────────────────────── */

async function fetchWithAuth(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers as HeadersInit);
  headers.set('Accept', 'application/json');
  if (session?.access_token) headers.set('Authorization', `Bearer ${session.access_token}`);
  return fetch(input, { ...init, headers });
}

/** Account fetch from your API so builds are cross-device */
async function readAccount(): Promise<Bot[]> {
  try {
    const resp = await fetchWithAuth('/api/chatbots/list', {
      method: 'GET',
      cache: 'no-store',
    });
    const data = await resp.json();
    if (!resp.ok || data?.ok === false) throw new Error(data?.error || 'list failed');
    const rows = Array.isArray(data?.items) ? data.items : [];
    const mapped = rows.map((r: any) =>
      normalize({
        id: r.id || r.assistant_id,
        assistantId: r.assistant_id || r.id,
        name: r.name,
        ...(r.payload || {}),
        createdAt: r.payload?.createdAt ?? r.created_at,
        updatedAt: r.payload?.updatedAt ?? r.updated_at,
      })
    );
    return sortByNewest(mapped);
  } catch {
    return [];
  }
}

async function saveBuildEverywhere(build: Bot) {
  // cloud
  try {
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
    const arr = Array.isArray(cloud) ? cloud : [];
    const key = build.assistantId || build.id;
    const i = arr.findIndex((b) => (b.assistantId || b.id) === key);
    if (i >= 0) arr[i] = build;
    else arr.unshift(build);
    await ss.setJSON('chatbots.v1', arr);
  } catch {}
  // local
  try {
    const local = readLocal();
    const key = build.assistantId || build.id;
    const i = local.findIndex((b) => (b.assistantId || b.id) === key);
    if (i >= 0) local[i] = build;
    else local.unshift(build);
    writeLocal(local);
  } catch {}
  // DB handled server-side by /api/chatbots/save
  try {
    window.dispatchEvent(new Event('builds:updated'));
  } catch {}
}

/* ───────────────────────────────── Prompt overlay helpers ───────────────────────────────── */

type PromptSectionKey =
  | 'DESCRIPTION'
  | 'AI DESCRIPTION'
  | 'RULES AND GUIDELINES'
  | 'AI RULES'
  | 'QUESTION FLOW'
  | 'COMPANY FAQ';
type SplitSection = { key: PromptSectionKey; title: string; text: string };
const DISPLAY_TITLES: Record<PromptSectionKey, string> = {
  DESCRIPTION: 'DESCRIPTION',
  'AI DESCRIPTION': 'AI Description',
  'RULES AND GUIDELINES': 'RULES AND GUIDELINES',
  'AI RULES': 'AI Rules',
  'QUESTION FLOW': 'QUESTION FLOW',
  'COMPANY FAQ': 'COMPANY FAQ',
};
const ICONS: Record<PromptSectionKey, JSX.Element> = {
  DESCRIPTION: <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'AI DESCRIPTION': <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'RULES AND GUIDELINES': <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'AI RULES': <ListChecks className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'QUESTION FLOW': <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'COMPANY FAQ': <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
};
const HEADING_REGEX =
  /^(?:\s*(?:[#>*-]|\d+\.)\s*)?(?:\*\*)?\s*(DESCRIPTION|AI\s*DESCRIPTION|RULES\s*(?:AND|&)\s*GUIDELINES|AI\s*RULES|QUESTION\s*FLOW|COMPANY\s*FAQ)\s*(?:\*\*)?\s*:?\s*$/gim;

function splitStep3IntoSections(step3Raw?: string): SplitSection[] | null {
  if (!step3Raw) return null;
  const matches: Array<{ start: number; end: number; label: PromptSectionKey }> = [];
  let m: RegExpExecArray | null;
  HEADING_REGEX.lastIndex = 0;
  while ((m = HEADING_REGEX.exec(step3Raw)) !== null) {
    const rawLabel = (m[1] || '')
      .toUpperCase()
      .replace(/\s*&\s*/g, ' AND ')
      .replace(/\s+/g, ' ') as PromptSectionKey;
    const label =
      rawLabel === 'AI  DESCRIPTION' ? ('AI DESCRIPTION' as PromptSectionKey) : rawLabel;
    matches.push({ start: m.index, end: HEADING_REGEX.lastIndex, label });
  }
  if (matches.length === 0) return null;
  const out: SplitSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const h = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : step3Raw.length;
    out.push({
      key: h.label,
      title: DISPLAY_TITLES[h.label] || h.label,
      text: step3Raw.slice(h.end, nextStart),
    });
  }
  return out;
}

function buildRawStep1PlusStep3(bot: Bot): string {
  const head = [bot.name, bot.industry, bot.language].filter(Boolean).join('\n');
  const step3 = bot.prompt ?? '';
  if (head && step3) return `${head}\n\n${step3}`;
  return head || step3 || '';
}

/* ───────────────────────────────── Main ───────────────────────────────── */

export default function BuilderDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawStep = searchParams.get('step');
  const step = rawStep && ['1', '2', '3', '4'].includes(rawStep) ? rawStep : null;

  const [query, setQuery] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [customizingId, setCustomizingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  // delete confirmation
  const [confirming, setConfirming] = useState<Bot | null>(null);

  /* cleanup wizard remnants after successful finish */
  useEffect(() => {
    try {
      if (localStorage.getItem('builder:cleanup') === '1') {
        ['builder:step1', 'builder:step2', 'builder:step3'].forEach((k) =>
          localStorage.removeItem(k)
        );
        localStorage.removeItem('builder:cleanup');
      }
    } catch {}
  }, []);

  /* enforce sane strings */
  useEffect(() => {
    try {
      const normalizeKV = (k: string) => {
        const raw = localStorage.getItem(k);
        if (!raw) return;
        const v = JSON.parse(raw);
        if (v && typeof v === 'object') {
          (['name', 'industry', 'language'] as const).forEach((key) => {
            if (v[key] !== undefined) v[key] = typeof v[key] === 'string' ? v[key] : '';
          });
          localStorage.setItem(k, JSON.stringify(v));
        }
      };
      ['builder:step1', 'builder:step2', 'builder:step3'].forEach(normalizeKV);
    } catch {}
  }, []);

  /* initial load + live refresh (LOCAL + CLOUD + ACCOUNT/DB) */
  useEffect(() => {
    let alive = true;
    (async () => {
      const local = readLocal();
      const cloud = await readCloud();
      const account = await readAccount(); // account/DB with auth
      const merged = mergeByAssistantId(mergeByAssistantId(local, cloud), account);

      if (alive) {
        setBots(merged);
        writeLocal(merged);
      }
    })();

    const refresh = async () => {
      const merged = mergeByAssistantId(
        mergeByAssistantId(readLocal(), await readCloud()),
        await readAccount()
      );
      setBots(merged);
      writeLocal(merged);
    };

    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (['chatbots', 'agents', 'builds'].includes(e.key)) refresh();
    };
    const onSignal = () => refresh();
    const onFocusOrVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      window.addEventListener('builds:updated', onSignal as any);
      window.addEventListener('focus', onFocusOrVisible);
      document.addEventListener('visibilitychange', onFocusOrVisible);
    }
    return () => {
      alive = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('builds:updated', onSignal as any);
        window.removeEventListener('focus', onFocusOrVisible);
        document.removeEventListener('visibilitychange', onFocusOrVisible);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter((b) => b.name.toLowerCase().includes(q));
  }, [bots, query]);

  const selectedBot = useMemo(
    () => bots.find((b) => b.id === customizingId),
    [bots, customizingId]
  );
  const viewedBot = useMemo(() => bots.find((b) => b.id === viewId), [bots, viewId]);

  const setStep = (next: string | null) => {
    const usp = new URLSearchParams(Array.from(searchParams.entries()));
    if (next) usp.set('step', next);
    else usp.delete('step');
    router.replace(`${pathname}?${usp.toString()}`, { scroll: false });
  };

  /* delete flow */
  const performDelete = async (bot: Bot) => {
    const next = bots.filter(
      (b) => (b.assistantId || b.id) !== (bot.assistantId || bot.id)
    );
    const sorted = sortByNewest(next);
    setBots(sorted);
    writeLocal(sorted);

    (async () => {
      // remove from cloud scoped storage
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
        if (Array.isArray(cloud)) {
          const pruned = cloud.filter(
            (b) => (b.assistantId || b.id) !== (bot.assistantId || bot.id)
          );
          await ss.setJSON('chatbots.v1', pruned);
        }
      } catch {}
      // remove in your DB (best-effort) — WITH AUTH
      try {
        await fetchWithAuth('/api/chatbots/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assistantId: bot.assistantId || bot.id }),
        });
      } catch {}
      try {
        window.dispatchEvent(new Event('builds:updated'));
      } catch {}
    })();
  };

  /* ───────── Wizard ───────── */
  if (step) {
    return (
      <div
        className="min-h-screen w-full font-movatif"
        style={{ background: 'var(--bg)', color: 'var(--text)' }}
      >
        <main className="w-full min-h-screen">
          {step === '1' && <Step1AIType onNext={() => setStep('2')} />}
          {step === '2' && (
            <Step2ModelSettings onBack={() => setStep('1')} onNext={() => setStep('3')} />
          )}
          {step === '3' && (
            <Step3PromptEditor onBack={() => setStep('2')} onNext={() => setStep('4')} />
          )}
          {step === '4' && (
            <Step4Overview onBack={() => setStep('3')} onFinish={() => setStep(null)} />
          )}
        </main>
      </div>
    );
  }

  /* ───────── Dashboard (card layout to match Voice Agent) ───────── */
  return (
    <div
      className="min-h-screen w-full font-movatif"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <main className="flex-1 w-full px-4 sm:px-6 pt-6 pb-24">
        {/* Header panel */}
        <section className="relative p-5 md:p-6 mb-6" style={PANEL}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background:
                'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />
          <div className="flex items-center justify-between">
            <div className="text-xl font-semibold">Build Agents</div>
          </div>

          {/* Search */}
          <div
            className="mt-4 flex items-center gap-2 rounded-[14px] px-4 py-3 text-[15px] max-w-xl"
            style={CARD}
          >
            <span className="opacity-70">🔎</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search projects and builds…"
              className="w-full bg-transparent outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>
        </section>

        {/* Card grid */}
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          <CreateCard onClick={() => router.push('/builder?step=1')} />
          {filtered.map((bot) => (
            <BuildCard
              key={bot.id}
              bot={bot}
              accent={accentFor(bot.id)}
              onOpen={() => setViewId(bot.id)}
              onDelete={() => setConfirming(bot)}
              onCustomize={() => setCustomizingId(bot.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 space-y-8">
            <div className="text-center" style={{ color: 'var(--text-muted)' }}>
              No builds found yet on your account. Click “Create a Build”.
            </div>
            <BuildsInspector />
          </div>
        )}
      </main>

      {/* Customize modal */}
      {selectedBot && (
        <CustomizeModal
          bot={selectedBot}
          onClose={() => setCustomizingId(null)}
          onApply={(ap) => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId
                ? { ...b, appearance: { ...(b.appearance ?? {}), ...ap }, updatedAt: nowISO() }
                : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            writeLocal(sorted);
            (async () => {
              try {
                const ss = await scopedStorage();
                await ss.ensureOwnerGuard();
                const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
                if (Array.isArray(cloud)) {
                  const idx = cloud.findIndex(
                    (x) =>
                      (x.assistantId || x.id) ===
                      (selectedBot.assistantId || selectedBot.id)
                  );
                  if (idx >= 0) {
                    cloud[idx] = { ...cloud[idx], appearance: ap, updatedAt: nowISO() };
                    await ss.setJSON('chatbots.v1', cloud);
                  }
                }
              } catch {}
              try {
                window.dispatchEvent(new Event('builds:updated'));
              } catch {}
            })();
            setCustomizingId(null);
          }}
          onReset={() => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId ? { ...b, appearance: undefined, updatedAt: nowISO() } : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            writeLocal(sorted);
            (async () => {
              try {
                const ss = await scopedStorage();
                await ss.ensureOwnerGuard();
                const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
                if (Array.isArray(cloud)) {
                  const idx = cloud.findIndex(
                    (x) =>
                      (x.assistantId || x.id) ===
                      (selectedBot.assistantId || selectedBot.id)
                  );
                  if (idx >= 0) {
                    cloud[idx] = {
                      ...cloud[idx],
                      appearance: undefined,
                      updatedAt: nowISO(),
                    };
                    await ss.setJSON('chatbots.v1', cloud);
                  }
                }
              } catch {}
              try {
                window.dispatchEvent(new Event('builds:updated'));
              } catch {}
            })();
            setCustomizingId(null);
          }}
          onSaveDraft={(name, ap) => {
            if (!customizingId) return;
            const key = `drafts:${customizingId}`;
            const arr: Array<{ name: string; appearance: Appearance; ts: string }> = JSON.parse(
              localStorage.getItem(key) || '[]'
            );
            arr.unshift({
              name: name || `Draft ${new Date().toLocaleString()}`,
              appearance: ap,
              ts: nowISO(),
            });
            localStorage.setItem(key, JSON.stringify(arr.slice(0, 20)));
          }}
        />
      )}

      {/* Prompt overlay */}
      {viewedBot && <PromptOverlay bot={viewedBot} onClose={() => setViewId(null)} />}

      {/* Confirm delete modal */}
      {confirming && (
        <ConfirmDelete
          bot={confirming}
          onCancel={() => setConfirming(null)}
          onConfirm={async () => {
            const victim = confirming;
            setConfirming(null);
            if (victim) await performDelete(victim);
          }}
        />
      )}
    </div>
  );
}

/* ───────────────────────────────── Cards (match Voice Agent section) ───────────────────────────────── */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full overflow-hidden text-left transition-transform active:scale-[0.996]"
      style={{
        ...CARD,
        borderStyle: 'dashed',
        background:
          'linear-gradient(180deg, color-mix(in oklab, var(--brand) 8%, transparent), transparent)',
      }}
    >
      <div className="p-6">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-[14px] grid place-items-center"
            style={{
              border: '2px dashed var(--brand-weak)',
              color: 'var(--brand)',
              background: 'transparent',
            }}
          >
            <Plus className="w-6 h-6" />
          </div>
          <div className="text-lg font-semibold">Create a Build</div>
        </div>
        <div className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          Start building your custom AI assistant with our intuitive wizard.
        </div>

        <div className="mt-5">
          <span
            className="inline-flex items-center gap-2 rounded-[12px] px-3 py-2 text-sm transition"
            style={BTN_PANEL}
          >
            Continue <ArrowRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function BuildCard({
  bot,
  accent,
  onOpen,
  onDelete,
  onCustomize,
}: {
  bot: Bot;
  accent: string;
  onOpen: () => void;
  onDelete: () => void;
  onCustomize: () => void;
}) {
  const ap = bot.appearance || {};
  return (
    <div className="w-full overflow-hidden" style={CARD}>
      {/* top banner / icon row */}
      <div className="flex items-start justify-between p-5 pb-0">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-11 h-11 rounded-[12px] grid place-items-center"
            style={{ border: '2px solid var(--brand-weak)' }}
          >
            <BotIcon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>
              {bot.name}
            </div>
            <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
              ID: {(bot.assistantId || bot.id).slice(0, 24)}
            </div>
          </div>
        </div>

        <button
          onClick={onCustomize}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs transition"
          style={BTN_PANEL}
          title="Customize look"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Style
        </button>
      </div>

      {/* preview */}
      <div
        className="relative mt-4 h-[160px] md:h-[180px]"
        style={{ borderTop: '1px dashed var(--brand-weak)', borderBottom: '1px dashed var(--brand-weak)' }}
      >
        {/* @ts-ignore */}
        <Bot3D
          className="h-full"
          accent={ap.accent || accent}
          shellColor={ap.shellColor}
          bodyColor={ap.bodyColor}
          trimColor={ap.trimColor}
          faceColor={ap.faceColor}
          variant={ap.variant || 'silver'}
          eyes={ap.eyes || 'ovals'}
          head={ap.head || 'rounded'}
          torso={ap.torso || 'box'}
          arms={ap.arms ?? 'capsule'}
          legs={ap.legs ?? 'capsule'}
          antenna={ap.hasOwnProperty('antenna') ? Boolean((ap as any).antenna) : true}
          withBody={ap.hasOwnProperty('withBody') ? Boolean(ap.withBody) : true}
          idle
        />
        <div className="absolute right-3 top-3">
          <button
            className="p-2 rounded-[10px]"
            style={BTN_PANEL}
            title="More"
            onClick={onOpen}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* meta + actions */}
      <div className="p-5">
        <div className="grid gap-2 md:grid-cols-3">
          <RowStat label="Model" value={bot.model || '—'} />
          <RowStat label="Updated" value={fmtDate(bot.updatedAt || bot.createdAt)} />
          <RowStat
            label="Details"
            value={[bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
          />
        </div>

        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-sm transition"
            style={BTN_PANEL}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[12px] text-sm transition"
            style={{
              background: 'rgba(255,120,120,.12)',
              border: '1px solid rgba(255,120,120,.35)',
              color: 'rgba(255,170,170,.95)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div
        className="text-[11px] uppercase tracking-wide mb-0.5"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </div>
      <div style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

/* ───────────────────────────────── Prompt Overlay ───────────────────────────────── */

function PromptOverlay({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const rawOut = buildRawStep1PlusStep3(bot);
  const sections = splitStep3IntoSections(bot.prompt);

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(rawOut);
    } catch {}
  };
  const downloadTxt = () => {
    const blob = new Blob([rawOut], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(bot.name || 'prompt').replace(/[^\w\-]+/g, '_')}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FRAME_STYLE: React.CSSProperties = {
    background: 'var(--panel)',
    border: '2px dashed var(--brand-weak)',
    boxShadow: 'var(--shadow-soft)',
    borderRadius: 30,
  };
  const HEADER_BORDER = { borderBottom: '1px solid var(--border)' };
  const CARD_STYLE: React.CSSProperties = {
    background: 'var(--card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    boxShadow: 'var(--shadow-card)',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
    >
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold truncate" style={{ color: 'var(--text)' }}>
              Prompt
            </h2>
            <div className="text-xs md:text-sm truncate" style={{ color: 'var(--text-muted)' }}>
              {[bot.name, bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button
              onClick={downloadTxt}
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            >
              <DownloadIcon className="w-3.5 h-3.5" /> Download
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full"
              title="Close"
              aria-label="Close"
              style={{ color: 'var(--text)' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!bot.prompt ? (
            <div className="p-5" style={CARD_STYLE}>
              (No Step 3 prompt yet)
            </div>
          ) : sections ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((sec, i) => (
                <div key={i} style={CARD_STYLE} className="overflow-hidden">
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {ICONS[sec.key]} {sec.title}
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <pre className="whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--text)' }}>
                      {sec.text}
                    </pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={CARD_STYLE} className="p-5">
              <pre className="whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--text)' }}>
                {bot.prompt}
              </pre>
            </div>
          )}
        </div>

        <div
          className="px-6 py-4 rounded-b-[30px]"
          style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}
        >
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-[14px] font-semibold"
              style={{ background: 'var(--brand)', color: '#fff', boxShadow: '0 0 18px rgba(0,255,194,.20)' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────── Confirm Delete ───────────────────────────────── */

function ConfirmDelete({
  bot,
  onCancel,
  onConfirm,
}: {
  bot: Bot;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] bg-black/70 grid place-items-center px-4">
      <div className="w-full max-w-md rounded-[22px] p-6" style={PANEL}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            <AlertTriangle className="w-5 h-5" style={{ color: 'salmon' }} />
          </div>
          <div className="min-w-0">
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Delete this build?
            </div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              You’re about to remove{' '}
              <span style={{ color: 'var(--text)' }}>{bot.name}</span> from your dashboard.
              This will delete it from your local workspace and your cloud workspace storage.
              (Your OpenAI Assistant remains in your OpenAI account.)
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} className="px-5 py-2 rounded-[14px]" style={CARD}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-5 py-2 rounded-[14px] font-semibold"
            style={{
              background: 'rgba(255,120,120,.18)',
              border: '1px solid rgba(255,120,120,.45)',
              color: 'rgba(255,170,170,.95)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────── Inspector (debug storage) ───────────────────────────────── */

function BuildsInspector() {
  const [local, setLocal] = useState<any[]>([]);
  const [cloud, setCloud] = useState<any[]>([]);
  const [account, setAccount] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      try {
        const raw = localStorage.getItem('chatbots') || '[]';
        setLocal(JSON.parse(raw));
      } catch {
        setLocal([]);
      }
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const arr = await ss.getJSON<any[]>('chatbots.v1', []);
        setCloud(Array.isArray(arr) ? arr : []);
      } catch {
        setCloud([]);
      }
      try {
        const r = await fetchWithAuth('/api/chatbots/list', { method: 'GET', cache: 'no-store' });
        const j = await r.json();
        setAccount(Array.isArray(j?.items) ? j.items : []);
      } catch {
        setAccount([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="rounded-[16px] p-4" style={PANEL}>
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Builds Inspector</div>
        <button
          onClick={load}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm"
          style={CARD}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <div className="grid lg:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="font-medium mb-1">
            localStorage: <code>chatbots</code>
          </div>
          <pre className="max-h-[300px] overflow-auto rounded-[10px] p-2" style={CARD}>
            {JSON.stringify(local, null, 2)}
          </pre>
        </div>
        <div>
          <div className="font-medium mb-1">
            scopedStorage: <code>chatbots.v1</code>
          </div>
          <pre className="max-h-[300px] overflow-auto rounded-[10px] p-2" style={CARD}>
            {JSON.stringify(cloud, null, 2)}
          </pre>
        </div>
        <div>
          <div className="font-medium mb-1">
            account API: <code>/api/chatbots/list</code>
          </div>
          <pre className="max-h-[300px] overflow-auto rounded-[10px] p-2" style={CARD}>
            {JSON.stringify(account, null, 2)}
          </pre>
        </div>
      </div>
      <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)' }}>
        Anything saved via Step 4 → <code>/api/chatbots/save</code> will appear here and sync
        to other devices signed into the same account.
      </div>
    </div>
  );
}
