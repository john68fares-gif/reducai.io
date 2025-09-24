// components/builder/BuilderDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus, Bot as BotIcon, ArrowRight, Trash2, SlidersHorizontal, X, Copy,
  Download as DownloadIcon, FileText, Settings, MessageSquareText, Landmark,
  ListChecks, AlertTriangle, RefreshCw
} from 'lucide-react';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';
import { scopedStorage } from '@/utils/scoped-storage';
// Optional — if you have it. If not, this file still works using scopedStorage/local only.
import { supabase } from '@/lib/supabase-client';

const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{ background: 'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))' }}
    />
  ),
});

/* ───────────────────────────────── Visuals (match VoiceAgentSection) ───────────────────────────────── */
const RADIUS_LG = 18;

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: RADIUS_LG,
};

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: RADIUS_LG,
};

const BTN_PRIMARY: React.CSSProperties = {
  background: 'var(--brand)',
  color: '#fff',
  borderRadius: 12,
  boxShadow: '0 0 18px rgba(0,255,194,.20)',
};

const BTN_PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 12,
};

function SectionHeader({
  icon, title, subtitle,
}: { icon: JSX.Element; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 font-semibold" style={{ color: 'var(--text)' }}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md"
              style={{ border: '1px solid var(--brand-weak)', color: 'var(--brand)' }}>
          {icon}
        </span>
        <span>{title}</span>
      </div>
      {subtitle && (
        <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>
      )}
      <div className="mt-3" style={{ borderBottom: '1px solid var(--border)' }} />
    </div>
  );
}

/* ───────────────────────────────── Types & helpers ───────────────────────────────── */
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

function normalize(b: any): Bot {
  const id = String(b?.assistantId || b?.id || (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString()));
  return {
    id,
    assistantId: String(b?.assistantId || b?.id || id),
    name: s(b?.name, 'Untitled Assistant'),
    type: s(b?.type, 'ai automation'),
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
  arr.slice().sort(
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
  return sortByNewest(Array.from(map.values()));
}

/* ——— Local/workspace reads ——— */
function readLocal(): Bot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVE_KEY);
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
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(sortByNewest(bots))); } catch {}
}

async function readScoped(): Promise<Bot[]> {
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

/* ——— Account read via API (optional but recommended) ———
   Create a server route /api/chatbots/list that returns { ok: true, items: Build[] }
   It should read builds from your DB for the authenticated user.
   If you don’t have it, this call will fail silently and we’ll rely on scopedStorage. */
async function readFromAccountAPI(): Promise<Bot[]> {
  try {
    const r = await fetch('/api/chatbots/list', { method: 'GET' });
    if (!r.ok) return [];
    const data = await r.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    return sortByNewest(items.map(normalize));
  } catch { return []; }
}

/* ——— Save to both storages (Step 4 already does this; Dashboard keeps parity) ——— */
async function saveBuildEverywhere(build: Bot) {
  const updated = { ...build, updatedAt: nowISO() };

  // scopedStorage cloud
  try {
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();
    const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
    const arr = Array.isArray(cloud) ? cloud : [];
    const key = updated.assistantId || updated.id;
    const i = arr.findIndex((b) => (b.assistantId || b.id) === key);
    if (i >= 0) arr[i] = updated; else arr.unshift(updated);
    await ss.setJSON('chatbots.v1', arr);
  } catch {}

  // local cache
  try {
    const local = readLocal();
    const key = updated.assistantId || updated.id;
    const i = local.findIndex((b) => (b.assistantId || b.id) === key);
    if (i >= 0) local[i] = updated; else local.unshift(updated);
    writeLocal(local);
  } catch {}

  // optional: server API (if you have /api/chatbots/save mirroring Step 4)
  try {
    await fetch('/api/chatbots/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        assistantId: updated.assistantId || updated.id,
        name: updated.name,
        model: updated.model,
        industry: updated.industry,
        language: updated.language,
        prompt: updated.prompt,
        appearance: updated.appearance ?? null,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      }),
    });
  } catch {}

  try { window.dispatchEvent(new Event('builds:updated')); } catch {}
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
  const [refreshing, setRefreshing] = useState(false);

  const [confirming, setConfirming] = useState<Bot | null>(null);

  // cleanup signal from Step 4
  useEffect(() => {
    try {
      if (localStorage.getItem('builder:cleanup') === '1') {
        ['builder:step1', 'builder:step2', 'builder:step3'].forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('builder:cleanup');
      }
    } catch {}
  }, []);

  // normalize step data if needed
  useEffect(() => {
    try {
      const normalize = (k: string) => {
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
      ['builder:step1', 'builder:step2', 'builder:step3'].forEach(normalize);
    } catch {}
  }, []);

  // Load builds (local + scoped + account API) and keep in sync
  async function loadAll() {
    const local = readLocal();
    const scoped = await readScoped();
    const account = await readFromAccountAPI(); // safe if not present
    const merged = mergeByAssistantId(mergeByAssistantId(local, scoped), account);
    setBots(merged);
    writeLocal(merged);
  }

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadAll();
      if (!alive) return;
    })();

    const onSignal = () => { loadAll(); };
    const onStorage = (e: StorageEvent) => {
      if (!e.key) return;
      if (['chatbots', 'agents', 'builds'].includes(e.key)) loadAll();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('builds:updated', onSignal as any);
      window.addEventListener('storage', onStorage);
    }
    return () => {
      alive = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('builds:updated', onSignal as any);
        window.removeEventListener('storage', onStorage);
      }
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter((b) => b.name.toLowerCase().includes(q));
  }, [bots, query]);

  const selectedBot = useMemo(() => bots.find((b) => b.id === customizingId), [bots, customizingId]);
  const viewedBot = useMemo(() => bots.find((b) => b.id === viewId), [bots, viewId]);

  const setStep = (next: string | null) => {
    const usp = new URLSearchParams(Array.from(searchParams.entries()));
    if (next) usp.set('step', next);
    else usp.delete('step');
    router.replace(`${pathname}?${usp.toString()}`, { scroll: false });
  };

  const onRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await loadAll(); } finally { setRefreshing(false); }
  };

  /* ——— Delete flow ——— */
  const performDelete = async (bot: Bot) => {
    const next = bots.filter((b) => (b.assistantId || b.id) !== (bot.assistantId || bot.id));
    const sorted = sortByNewest(next);
    setBots(sorted);
    writeLocal(sorted);

    // scopedStorage
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
        if (Array.isArray(cloud)) {
          const pruned = cloud.filter((b) => (b.assistantId || b.id) !== (bot.assistantId || bot.id));
          await ss.setJSON('chatbots.v1', pruned);
        }
      } catch {}

      // optional: delete via API so account DB mirrors
      try {
        await fetch('/api/chatbots/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assistantId: bot.assistantId || bot.id }),
        });
      } catch {}

      try { window.dispatchEvent(new Event('builds:updated')); } catch {}
    })();
  };

  /* ——— Wizard ——— */
  if (step) {
    return (
      <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <main className="w-full min-h-screen">
          {step === '1' && <Step1AIType onNext={() => setStep('2')} />}
          {step === '2' && <Step2ModelSettings onBack={() => setStep('1')} onNext={() => setStep('3')} />}
          {step === '3' && <Step3PromptEditor onBack={() => setStep('2')} onNext={() => setStep('4')} />}
          {step === '4' && <Step4Overview onBack={() => setStep('3')} onFinish={() => setStep(null)} />}
        </main>
      </div>
    );
  }

  /* ——— Dashboard (Voice Agent style) ——— */
  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <main className="flex-1 w-full px-4 sm:px-6 pt-6 pb-24">
        {/* Top panel */}
        <section className="relative p-5 md:p-6 mb-6" style={PANEL}>
          {/* subtle glow */}
          <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
               style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)', filter: 'blur(38px)' }} />
          <SectionHeader
            icon={<MessageSquareText className="w-4 h-4" />}
            title="Builder"
            subtitle="Create and manage your assistants"
          />
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-[12px] px-4 py-3 text-[15px] flex-1 min-w-[260px]" style={CARD}>
              <span className="opacity-70">🔎</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search builds…"
                className="w-full bg-transparent outline-none"
                style={{ color: 'var(--text)' }}
              />
            </div>

            <button
              onClick={() => router.push('/builder?step=1')}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold"
              style={BTN_PRIMARY}
            >
              <Plus className="w-4 h-4" /> New Build
            </button>

            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-4 py-3 text-sm"
              style={BTN_PANEL}
              title="Refresh your builds"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </section>

        {/* Grid of cards (no rectangles, voice-agent vibe) */}
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
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
          <div className="mt-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
            No builds yet. Click <span style={{ color: 'var(--text)' }}>New Build</span> to get started.
          </div>
        )}
      </main>

      {/* Customize modal */}
      {selectedBot && (
        <CustomizeModal
          bot={selectedBot}
          onClose={() => setCustomizingId(null)}
          onApply={async (ap) => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId
                ? { ...b, appearance: { ...(b.appearance ?? {}), ...ap }, updatedAt: nowISO() }
                : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            writeLocal(sorted);

            // mirror to storages & API
            const target = sorted.find(b => b.id === customizingId)!;
            await saveBuildEverywhere(target);
            setCustomizingId(null);
          }}
          onReset={async () => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId ? { ...b, appearance: undefined, updatedAt: nowISO() } : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            writeLocal(sorted);

            const target = sorted.find(b => b.id === customizingId)!;
            await saveBuildEverywhere(target);
            setCustomizingId(null);
          }}
          onSaveDraft={(name, ap) => {
            if (!customizingId) return;
            const key = `drafts:${customizingId}`;
            const arr: Array<{ name: string; appearance: Appearance; ts: string }> =
              JSON.parse(localStorage.getItem(key) || '[]');
            arr.unshift({ name: name || `Draft ${new Date().toLocaleString()}`, appearance: ap, ts: nowISO() });
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

/* ───────────────────────────────── Cards ───────────────────────────────── */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="group w-full text-left transition active:scale-[0.997]" style={CARD}>
      <div className="p-5">
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center justify-center w-7 h-7 rounded-md"
               style={{ border: '1px dashed var(--brand-weak)', color: 'var(--brand)' }}>
            <Plus className="w-4 h-4" />
          </div>
          <div className="font-semibold" style={{ color: 'var(--text)' }}>Create a Build</div>
        </div>
        <div className="mt-3" style={{ borderBottom: '1px solid var(--border)' }} />
        <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)' }}>
          Start building your AI assistant with guided steps.
        </div>
        <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm" style={BTN_PANEL}>
          Continue <ArrowRight className="w-4 h-4" />
        </div>
      </div>
    </button>
  );
}

function BuildCard({
  bot, accent, onOpen, onDelete, onCustomize,
}: { bot: Bot; accent: string; onOpen: () => void; onDelete: () => void; onCustomize: () => void; }) {
  const ap = bot.appearance || {};
  return (
    <div style={CARD} className="overflow-hidden">
      {/* Header strip */}
      <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center"
          style={{ border: '1px solid var(--brand-weak)' }}
        >
          <BotIcon className="w-4.5 h-4.5" style={{ color: accent }} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>{bot.name}</div>
          <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
            {(bot.industry || '—') + (bot.language ? ` · ${bot.language}` : '')}
          </div>
        </div>
        <button
          onClick={onDelete}
          className="ml-auto p-1.5 rounded-md transition hover:opacity-80"
          title="Delete build"
          style={{ color: 'var(--text-muted)' }}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Preview */}
      <div className="relative h-[180px] hidden md:block" style={{ borderBottom: '1px solid var(--border)' }}>
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
        <button
          onClick={onCustomize}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs transition"
          style={BTN_PANEL}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Customize
        </button>
      </div>

      {/* Stats + actions */}
      <div className="p-4">
        <div className="grid grid-cols-3 gap-3 text-sm">
          <RowStat label="Model" value={bot.model || '—'} />
          <RowStat label="Updated" value={fmtDate(bot.updatedAt || bot.createdAt)} />
          <RowStat label="ID" value={(bot.assistantId || bot.id).slice(0, 8) + '…'} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button onClick={onOpen} className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium" style={BTN_PANEL}>
            Open <ArrowRight className="w-4 h-4" />
          </button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Tip: “Customize” to change the bot’s look.</span>
        </div>
      </div>
    </div>
  );
}

function RowStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <div style={{ color: 'var(--text)' }}>{value}</div>
    </div>
  );
}

/* ───────────────────────────────── Prompt Overlay ───────────────────────────────── */

type PromptSectionKey = 'DESCRIPTION' | 'AI DESCRIPTION' | 'RULES AND GUIDELINES' | 'AI RULES' | 'QUESTION FLOW' | 'COMPANY FAQ';
type SplitSection = { key: PromptSectionKey; title: string; text: string; };
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
    const label = rawLabel === 'AI  DESCRIPTION' ? ('AI DESCRIPTION' as PromptSectionKey) : rawLabel;
    matches.push({ start: m.index, end: HEADING_REGEX.lastIndex, label });
  }
  if (matches.length === 0) return null;
  const out: SplitSection[] = [];
  for (let i = 0; i < matches.length; i++) {
    const h = matches[i];
    const nextStart = i + 1 < matches.length ? matches[i + 1].start : step3Raw.length;
    out.push({ key: h.label, title: DISPLAY_TITLES[h.label] || h.label, text: step3Raw.slice(h.end, nextStart) });
  }
  return out;
}

function buildRawStep1PlusStep3(bot: Bot): string {
  const head = [bot.name, bot.industry, bot.language].filter(Boolean).join('\n');
  const step3 = bot.prompt ?? '';
  if (head && step3) return `${head}\n\n${step3}`;
  return head || step3 || '';
}

function PromptOverlay({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const rawOut = buildRawStep1PlusStep3(bot);
  const sections = splitStep3IntoSections(bot.prompt);

  const copyAll = async () => { try { await navigator.clipboard.writeText(rawOut); } catch {} };
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold truncate" style={{ color: 'var(--text)' }}>Prompt</h2>
            <div className="text-xs md:text-sm truncate" style={{ color: 'var(--text-muted)' }}>
              {[bot.name, bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAll} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button onClick={downloadTxt} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
                    style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}>
              <DownloadIcon className="w-3.5 h-3.5" /> Download
            </button>
            <button onClick={onClose} className="p-2 rounded-full" title="Close" aria-label="Close" style={{ color: 'var(--text)' }}>
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!bot.prompt ? (
            <div className="p-5" style={CARD_STYLE}>(No Step 3 prompt yet)</div>
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

        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-5 py-2 rounded-[14px] font-semibold"
                    style={{ background: 'var(--brand)', color: '#fff', boxShadow: '0 0 18px rgba(0,255,194,.20)' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────── Confirm Delete ───────────────────────────────── */

function ConfirmDelete({ bot, onCancel, onConfirm }: { bot: Bot; onCancel: () => void; onConfirm: () => void }) {
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
              You’re about to remove <span style={{ color: 'var(--text)' }}>{bot.name}</span> from your dashboard.
              This deletes it from your workspace storage. (Your OpenAI Assistant, if any, is unaffected.)
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
            style={{ background: 'rgba(255,120,120,.18)', border: '1px solid rgba(255,120,120,.45)', color: 'rgba(255,170,170,.95)', boxShadow: 'var(--shadow-soft)' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
