// components/builder/BuilderDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Bot as BotIcon, ArrowRight, Trash2, SlidersHorizontal, X, Copy,
  Download as DownloadIcon, FileText, Settings, MessageSquareText, Landmark,
  ListChecks, Search
} from 'lucide-react';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';

const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => <div className="h-full w-full" style={{ background: 'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))' }} />
});

/* ---------------- theme helpers ---------------- */
const BRAND = 'var(--brand)';
const PANEL_STYLE: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 18,
};
const CARD_STYLE: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 16,
};

/* ---------------- types + storage (unchanged) ---------------- */
type Appearance = {
  accent?: string; shellColor?: string; bodyColor?: string; trimColor?: string; faceColor?: string;
  variant?: string; eyes?: string; head?: string; torso?: string; arms?: string; legs?: string;
  antenna?: boolean; withBody?: boolean; idle?: boolean;
};
type Bot = {
  id: string; name: string; industry?: string; language?: string; model?: string; description?: string;
  prompt?: string; createdAt?: string; updatedAt?: string; appearance?: Appearance;
};
const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');
const sortByNewest = (arr: Bot[]) =>
  arr.slice().sort((a, b) =>
    Date.parse(b.updatedAt || b.createdAt || '0') - Date.parse(a.updatedAt || a.createdAt || '0'));
function loadBots(): Bot[] {
  if (typeof window === 'undefined') return [];
  for (const k of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const out: Bot[] = arr.map((b: any) => ({
        id: b?.id ?? (typeof crypto !== 'undefined' ? crypto.randomUUID() : String(Date.now())),
        name: s(b?.name, 'Untitled Bot'),
        industry: s(b?.industry),
        language: s(b?.language),
        model: s(b?.model, 'gpt-4o-mini'),
        description: s(b?.description),
        prompt: s(b?.prompt),
        createdAt: b?.createdAt ?? nowISO(),
        updatedAt: b?.updatedAt ?? b?.createdAt ?? nowISO(),
        appearance: b?.appearance ?? undefined,
      }));
      return sortByNewest(out);
    } catch {}
  }
  return [];
}
function saveBots(bots: Bot[]) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(bots)); } catch {}
}

/* ---------------- Step 3 splitter (unchanged) ---------------- */
type PromptSectionKey =
  | 'DESCRIPTION' | 'AI DESCRIPTION' | 'RULES AND GUIDELINES'
  | 'AI RULES' | 'QUESTION FLOW' | 'COMPANY FAQ';
type SplitSection = { key: PromptSectionKey; title: string; text: string; };

const DISPLAY_TITLES: Record<PromptSectionKey, string> = {
  'DESCRIPTION': 'DESCRIPTION',
  'AI DESCRIPTION': 'AI Description',
  'RULES AND GUIDELINES': 'RULES AND GUIDELINES',
  'AI RULES': 'AI Rules',
  'QUESTION FLOW': 'QUESTION FLOW',
  'COMPANY FAQ': 'COMPANY FAQ',
};
const ICONS: Record<PromptSectionKey, JSX.Element> = {
  'DESCRIPTION': <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'AI DESCRIPTION': <FileText className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'RULES AND GUIDELINES': <Settings className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'AI RULES': <ListChecks className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'QUESTION FLOW': <MessageSquareText className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
  'COMPANY FAQ': <Landmark className="w-4 h-4" style={{ color: 'var(--brand)' }} />,
};
const HEADING_REGEX =
  /^(?:\s*(?:[#>*-]|\d+\.)\s*)?(?:\*\*)?\s*(DESCRIPTION|AI\s*DESCRIPTION|RULES\s*(?:AND|&)\s*GUIDELINES|AI\s*RULES|QUESTION\s*FLOW|COMPANY\s*FAQ)\s*(?:\*\*)?\s*:?\s*$/gmi;
function splitStep3IntoSections(step3Raw?: string): SplitSection[] | null {
  if (!step3Raw) return null;
  const matches: Array<{ start: number; end: number; label: PromptSectionKey }> = [];
  let m: RegExpExecArray | null;
  HEADING_REGEX.lastIndex = 0;
  while ((m = HEADING_REGEX.exec(step3Raw)) !== null) {
    const rawLabel = (m[1] || '')
      .toUpperCase().replace(/\s*&\s*/g, ' AND ').replace(/\s+/g, ' ') as PromptSectionKey;
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

/* ----------------------------------- UI ----------------------------------- */
const palette = ['#6af7d1', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[Math.abs([...id].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

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

  useEffect(() => {
    try {
      if (localStorage.getItem('builder:cleanup') === '1') {
        ['builder:step1', 'builder:step2', 'builder:step3'].forEach((k) => localStorage.removeItem(k));
        localStorage.removeItem('builder:cleanup');
      }
    } catch {}
  }, []);
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
  useEffect(() => {
    setBots(loadBots());
    const onStorage = (e: StorageEvent) => {
      if (STORAGE_KEYS.includes(e.key || '')) setBots(loadBots());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
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

  /* ---- step screens (unchanged) ---- */
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

  /* ---- dashboard shell (panel like API Keys / Phone Numbers) ---- */
  return (
    <div className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <main className="px-4 sm:px-6 lg:px-10 pt-8 pb-24">
        <section className="mx-auto w-full max-w-[1200px]" style={PANEL_STYLE}>
          {/* page tag strip (left → right) */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 shadow"
                 style={{ background: 'color-mix(in oklab, var(--brand) 20%, transparent)', boxShadow: 'var(--shadow-card)' }}>
              <span className="w-2 h-2 rounded-full" style={{ background: BRAND }} />
              <span className="text-sm font-semibold">Builder Dashboard</span>
            </div>

            {/* (as requested) — no separate "Create a Build" button here */}
          </div>

          {/* content body */}
          <div className="p-6">
            {/* search like API Keys input */}
            <div className="mb-6">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'color-mix(in oklab, var(--text) 45%, transparent)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search projects and builds…"
                  className="w-full rounded-[12px] pl-9 pr-4 py-3 outline-none transition"
                  style={{
                    ...CARD_STYLE,
                    boxShadow: 'var(--shadow-card)',
                  }}
                />
              </div>
            </div>

            {/* cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
              <CreateCard onClick={() => router.push('/builder?step=1')} />

              {filtered.map((bot) => (
                <BuildCard
                  key={bot.id}
                  bot={bot}
                  accent={bot.appearance?.accent || accentFor(bot.id)}
                  onOpen={() => setViewId(bot.id)}
                  onDelete={() => {
                    const next = bots.filter((b) => b.id !== bot.id);
                    const sorted = sortByNewest(next);
                    setBots(sorted); saveBots(sorted);
                  }}
                  onCustomize={() => setCustomizingId(bot.id)}
                />
              ))}
            </div>

            {filtered.length === 0 && (
              <div className="mt-12 text-center"
                   style={{ color: 'color-mix(in oklab, var(--text) 65%, transparent)' }}>
                No builds found. Click <span style={{ color: BRAND }}>Create a Build</span> to get started.
              </div>
            )}
          </div>
        </section>
      </main>

      {/* modals/overlay (unchanged) */}
      {selectedBot && (
        <CustomizeModal
          bot={selectedBot}
          onClose={() => setCustomizingId(null)}
          onApply={(ap) => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId ? { ...b, appearance: { ...(b.appearance ?? {}), ...ap }, updatedAt: nowISO() } : b);
            const sorted = sortByNewest(next);
            setBots(sorted); saveBots(sorted); setCustomizingId(null);
          }}
          onReset={() => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId ? { ...b, appearance: undefined, updatedAt: nowISO() } : b);
            const sorted = sortByNewest(next);
            setBots(sorted); saveBots(sorted); setCustomizingId(null);
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

/* --------------------------- Prompt Overlay (unchanged visuals, uses vars) --------------------------- */

function buildRawStep1PlusStep3(bot: Bot): string {
  const head = [bot.name, bot.industry, bot.language].filter(Boolean).join('\n');
  const step3 = bot.prompt ?? '';
  if (head && step3) return `${head}\n\n${step3}`;
  return head || step3 || '';
}

function PromptOverlay({ bot, onClose }: { bot: Bot; onClose: () => void; }) {
  const rawOut = buildRawStep1PlusStep3(bot);
  const sections = splitStep3IntoSections(bot.prompt);

  const copyAll = async () => { try { await navigator.clipboard.writeText(rawOut); } catch {} };
  const downloadTxt = () => {
    const blob = new Blob([rawOut], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `${(bot.name || 'prompt').replace(/[^\w\-]+/g, '_')}.txt`; a.click(); URL.revokeObjectURL(url);
  };

  const FRAME_STYLE: React.CSSProperties = {
    background: 'color-mix(in oklab, var(--card) 90%, transparent)',
    border: '2px dashed color-mix(in oklab, var(--brand) 35%, var(--border))',
    boxShadow: '0 0 40px rgba(0,0,0,0.35)',
    borderRadius: 30,
    color: 'var(--text)',
  };
  const HEADER_BORDER = { borderBottom: '1px solid var(--border)' };
  const SMALL_CARD: React.CSSProperties = { ...CARD_STYLE, borderRadius: 20 };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
         style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-xl font-semibold truncate" style={{ color: 'var(--text)' }}>Prompt</h2>
            <div className="text-sm truncate" style={{ color: 'var(--text-muted)' }}>
              {[bot.name, bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAll} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
                    style={{ ...CARD_STYLE }}> <Copy className="w-3.5 h-3.5" /> Copy </button>
            <button onClick={downloadTxt} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
                    style={{ ...CARD_STYLE }}> <DownloadIcon className="w-3.5 h-3.5" /> Download </button>
            <button onClick={onClose} className="p-2 rounded-full hover:opacity-80" aria-label="Close" title="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!bot.prompt ? (
            <div className="p-5" style={SMALL_CARD}>(No Step 3 prompt yet)</div>
          ) : sections ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((sec, i) => (
                <div key={i} style={SMALL_CARD} className="overflow-hidden">
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2 font-semibold text-sm" style={{ color: 'var(--text)' }}>
                      {ICONS[sec.key]} {sec.title}
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <pre className="whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--text)' }}>{sec.text}</pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={SMALL_CARD} className="p-5">
              <pre className="whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--text)' }}>{bot.prompt}</pre>
            </div>
          )}
        </div>

        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid var(--border)', background: 'var(--card)' }}>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-5 py-2 rounded-[14px] font-semibold"
                    style={{ background: BRAND, color: '#000' }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- Cards --------------------------------- */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      whileHover={{ y: -2 }} whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className="relative h-[360px] rounded-[16px] p-7 flex flex-col items-center justify-center"
      style={{
        ...CARD_STYLE,
        borderStyle: 'dashed',
        borderWidth: 2,
        borderColor: 'color-mix(in oklab, var(--brand) 35%, var(--border))',
      }}
    >
      {/* soft left glow like your sections */}
      <div className="pointer-events-none absolute -top-[24%] -left-[24%] w-[70%] h-[70%] rounded-full"
           style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 16%, transparent) 0%, transparent 70%)', filter: 'blur(30px)' }} />
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'rgba(0,0,0,0.06)',
          border: '2px dashed color-mix(in oklab, var(--brand) 45%, var(--border))'
        }}
      >
        <Plus className="w-10 h-10" style={{ color: 'var(--brand)' }} />
      </div>
      {/* You asked for white here specifically */}
      <div className="text-[20px] font-semibold text-white">Create a Build</div>
      <div className="text-[13px] mt-2" style={{ color: 'color-mix(in oklab, white 70%, transparent)' }}>
        Start building your AI assistant
      </div>
    </motion.button>
  );
}

function BuildCard({
  bot, accent, onOpen, onDelete, onCustomize,
}: {
  bot: Bot; accent: string; onOpen: () => void; onDelete: () => void; onCustomize: () => void;
}) {
  const ap = bot.appearance || {};
  return (
    <motion.div whileHover={{ y: -2 }} className="relative h-[360px] rounded-[16px] overflow-hidden"
                style={CARD_STYLE}>
      {/* top preview */}
      <div className="h-44 border-b" style={{ borderColor: 'var(--border)' }}>
        <button
          onClick={onCustomize}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs"
          style={{ ...CARD_STYLE }}
          title="Customize"
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
          idle={true}
        />
      </div>

      {/* info */}
      <div className="p-6 flex-1 flex flex-col justify-between" style={{ color: 'var(--text)' }}>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[10px] grid place-items-center"
               style={{ background: 'color-mix(in oklab, var(--brand) 12%, transparent)', border: '1px solid var(--border)' }}>
            <BotIcon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{bot.name}</div>
            <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
              {(bot.industry || '—') + (bot.language ? ` · ${bot.language}` : '')}
            </div>
          </div>
          <button onClick={onDelete} className="ml-auto p-1.5 rounded-md hover:opacity-80 transition" title="Delete build">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Updated {fmtDate(bot.updatedAt || bot.createdAt)}
          </div>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm transition hover:-translate-y-0.5"
            style={{ ...CARD_STYLE }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
