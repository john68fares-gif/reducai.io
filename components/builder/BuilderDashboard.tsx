// components/builder/BuilderDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus,
  Bot as BotIcon,
  ArrowRight,
  Trash2,
  SlidersHorizontal,
  X,
  Copy,
  Download as DownloadIcon,
  FileText,
  Settings,
  MessageSquareText,
  Landmark,
  ListChecks,
} from 'lucide-react';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';
import { scopedStorage } from '@/utils/scoped-storage';

const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{ background: 'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))' }}
    />
  ),
});

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
  industry?: string;
  language?: string;
  model?: string;
  description?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  appearance?: Appearance;
};

const SAVE_KEY = 'chatbots';
const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

const sortByNewest = (arr: Bot[]) =>
  arr
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt || b.createdAt || '0') -
        Date.parse(a.updatedAt || a.createdAt || '0')
    );

function normalize(b: any): Bot {
  return {
    id: String(b?.id ?? b?.assistantId ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : Date.now().toString())),
    assistantId: String(b?.assistantId ?? b?.id ?? ''),
    name: s(b?.name, 'Untitled Bot'),
    industry: s(b?.industry),
    language: s(b?.language),
    model: s(b?.model, 'gpt-4o-mini'),
    description: s(b?.description),
    prompt: s(b?.prompt),
    createdAt: b?.createdAt ?? nowISO(),
    updatedAt: b?.updatedAt ?? b?.createdAt ?? nowISO(),
    appearance: b?.appearance ?? undefined,
  };
}

function loadLocalBots(): Bot[] {
  if (typeof window === 'undefined') return [];
  for (const k of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const out: Bot[] = arr.map(normalize);
      if (out.length) return sortByNewest(out);
    } catch {}
  }
  return [];
}

function saveLocalBots(bots: Bot[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(bots)); } catch {}
}

function mergeByAssistantId(a: Bot[], b: Bot[]): Bot[] {
  const map = new Map<string, Bot>();
  const put = (x: Bot) => {
    const key = x.assistantId || x.id;
    const prev = map.get(key);
    if (!prev) map.set(key, x);
    else {
      const newer =
        Date.parse(x.updatedAt || x.createdAt || '0') >
        Date.parse(prev.updatedAt || prev.createdAt || '0')
          ? x
          : prev;
      map.set(key, newer);
    }
  };
  a.forEach(put);
  b.forEach(put);
  return sortByNewest(Array.from(map.values()));
}

/* ----------------------------------- UI ----------------------------------- */

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

  // clean leftover builder data when a build completes
  useEffect(() => {
    try {
      if (localStorage.getItem('builder:cleanup') === '1') {
        ['builder:step1', 'builder:step2', 'builder:step3'].forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('builder:cleanup');
      }
    } catch {}
  }, []);

  // normalize step data
  useEffect(() => {
    try {
      const normalizeStep = (k: string) => {
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
      ['builder:step1', 'builder:step2', 'builder:step3'].forEach(normalizeStep);
    } catch {}
  }, []);

  // Load local immediately for fast paint
  useEffect(() => {
    setBots(loadLocalBots());
  }, []);

  // Then merge with cloud (scoped storage) and keep in sync
  async function refreshFromCloud() {
    try {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      const cloudArr = await ss.getJSON<any[]>('chatbots.v1', []);
      const cloud = Array.isArray(cloudArr) ? cloudArr.map(normalize) : [];

      const local = loadLocalBots();
      const merged = mergeByAssistantId(local, cloud);

      setBots(merged);
      // keep localStorage in sync so offline still works
      saveLocalBots(merged);
    } catch {
      // ignore cloud errors, stay with local
    }
  }

  useEffect(() => {
    refreshFromCloud();
    // listen for localStorage & custom events to refresh
    const onStorage = (e: StorageEvent) => {
      if (STORAGE_KEYS.includes(e.key || '') || e.key === 'chatbots') {
        setBots(loadLocalBots());
        refreshFromCloud();
      }
    };
    const onBuildsUpdated = () => refreshFromCloud();

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      window.addEventListener('builds:updated', onBuildsUpdated as any);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('builds:updated', onBuildsUpdated as any);
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

  // ---------- Wizard ----------
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

  // ---------- Dashboard ----------
  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <main className="flex-1 w-full px-4 sm:px-6 pt-6 pb-24">
        {/* Search */}
        <div className="mb-6">
          <div
            className="flex items-center gap-2 w-full rounded-[14px] px-4 py-3 text-[15px]"
            style={{
              background: 'var(--card)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-card)',
            }}
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
        </div>

        {/* Rows */}
        <div className="space-y-6">
          <CreateRow onClick={() => router.push('/builder?step=1')} />

          {filtered.map((bot) => (
            <BuildRow
              key={bot.id}
              bot={bot}
              accent={accentFor(bot.id)}
              onOpen={() => setViewId(bot.id)}
              onDelete={async () => {
                // delete locally…
                const next = bots.filter((b) => (b.assistantId || b.id) !== (bot.assistantId || bot.id));
                const sorted = sortByNewest(next);
                setBots(sorted);
                saveLocalBots(sorted);
                // …and in cloud
                try {
                  const ss = await scopedStorage();
                  await ss.ensureOwnerGuard();
                  const cloudArr = await ss.getJSON<any[]>('chatbots.v1', []);
                  const cloud = Array.isArray(cloudArr) ? cloudArr : [];
                  const key = bot.assistantId || bot.id;
                  const filteredCloud = cloud.filter((c: any) => (c?.assistantId || c?.id) !== key);
                  await ss.setJSON('chatbots.v1', filteredCloud);
                  try { window.dispatchEvent(new Event('builds:updated')); } catch {}
                } catch {}
              }}
              onCustomize={() => setCustomizingId(bot.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center" style={{ color: 'var(--text-muted)' }}>
            No builds found. Click <span style={{ color: 'var(--brand)' }}>Create a Build</span> to get started.
          </div>
        )}
      </main>

      {selectedBot && (
        <CustomizeModal
          bot={selectedBot}
          onClose={() => setCustomizingId(null)}
          onApply={(ap) => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              (b.assistantId || b.id) === (selectedBot.assistantId || selectedBot.id)
                ? { ...b, appearance: { ...(b.appearance ?? {}), ...ap }, updatedAt: nowISO() }
                : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            saveLocalBots(sorted);
          }}
          onReset={() => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              (b.assistantId || b.id) === (selectedBot.assistantId || selectedBot.id)
                ? { ...b, appearance: undefined, updatedAt: nowISO() }
                : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            saveLocalBots(sorted);
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

      {viewedBot && <PromptOverlay bot={viewedBot} onClose={() => setViewId(null)} />}
    </div>
  );
}

/* --------------------------- Prompt Overlay --------------------------- */

type PromptSectionKey =
  | 'DESCRIPTION'
  | 'AI DESCRIPTION'
  | 'RULES AND GUIDELINES'
  | 'AI RULES'
  | 'QUESTION FLOW'
  | 'COMPANY FAQ';

type SplitSection = {
  key: PromptSectionKey;
  title: string;
  text: string;
};

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

function PromptOverlay({ bot, onClose }: { bot: Bot; onClose: () => void }) {
  const rawOut = buildRawStep1PlusStep3(bot);
  const sections = splitStep3IntoSections(bot.prompt);

  const copyAll = async () => {
    try { await navigator.clipboard.writeText(rawOut); } catch {}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold truncate" style={{ color: 'var(--text)' }}>Prompt</h2>
            <div className="text-xs md:text-sm truncate" style={{ color: 'var(--text-muted)' }}>
              {[bot.name, bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            <button
              onClick={downloadTxt}
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
              style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
              title="Download"
            >
              <DownloadIcon className="w-3.5 h-3.5" />
              Download
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

        {/* Body */}
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

        {/* Footer */}
        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
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

/* --------------------------------- ROWS --------------------------------- */

function CreateRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group w-full rounded-[16px] overflow-hidden text-left transition-transform active:scale-[0.996]"
      style={{
        background: 'var(--card)',
        border: '1px dashed var(--brand-weak)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-stretch">
        <div
          className="hidden sm:flex items-center justify-center w-[220px] min-h-[160px]"
          style={{
            background: 'linear-gradient(180deg, color-mix(in oklab, var(--brand) 14%, transparent), transparent)',
            borderRight: '1px dashed var(--brand-weak)',
          }}
        >
          <div
            className="w-16 h-16 rounded-full grid place-items-center"
            style={{
              border: '2px dashed var(--brand-weak)',
              color: 'var(--brand)',
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.08)',
            }}
          >
            <Plus className="w-9 h-9" />
          </div>
        </div>

        <div className="flex-1 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <span
              className="px-2 py-1 rounded-full text-xs"
              style={{
                background: 'color-mix(in oklab, var(--brand) 12%, var(--panel))',
                color: 'var(--text)',
                border: '1px solid var(--border)',
              }}
            >
              New
            </span>
            <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>
              Create a Build
            </div>
          </div>
          <div className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Start building your AI assistant.
          </div>

          <div className="mt-4">
            <span
              className="inline-flex items-center gap-2 rounded-[10px] px-3 py-2 text-sm transition"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              Continue <ArrowRight className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

const palette = ['#00ffc2', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[Math.abs([...id].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

function BuildRow({
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
    <div
      className="w-full rounded-[16px] overflow-hidden transition"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div className="flex items-stretch">
        {/* Preview (left) */}
        <div className="relative w-[320px] min-h-[180px] hidden md:block" style={{ borderRight: '1px solid var(--border)' }}>
          <button
            onClick={onCustomize}
            className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs transition"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              boxShadow: 'var(--shadow-soft)',
            }}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Customize
          </button>
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
        </div>

        {/* Info (right) */}
        <div className="flex-1 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-[10px] flex items-center justify-center"
              style={{ background: 'transparent', border: '2px solid var(--brand-weak)' }}
            >
              <BotIcon className="w-5 h-5" style={{ color: accent }} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate" style={{ color: 'var(--text)' }}>
                {bot.name}
              </div>
              <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
                {(bot.industry || '—') + (bot.language ? ` · ${bot.language}` : '')}
              </div>
            </div>
            <button
              onClick={onDelete}
              className="ml-auto p-1.5 rounded-md transition"
              title="Delete build"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 grid gap-2 md:grid-cols-3">
            <RowStat label="Model" value={bot.model || '—'} />
            <RowStat label="Updated" value={fmtDate(bot.updatedAt || bot.createdAt)} />
            <RowStat label="ID" value={(bot.assistantId || bot.id).slice(0, 8) + '…'} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onOpen}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm transition"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
                boxShadow: 'var(--shadow-soft)',
              }}
            >
              Open <ArrowRight className="w-4 h-4" />
            </button>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Tip: Use “Customize” to change the bot’s look.
            </span>
          </div>
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
