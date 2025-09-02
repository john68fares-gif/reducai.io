// components/builder/BuilderDashboard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import OnboardingOverlay from '../ui/OnboardingOverlay';
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
  name: string;
  industry?: string;
  language?: string;
  model?: string;
  description?: string;
  prompt?: string; // Step 3 raw
  createdAt?: string;
  updatedAt?: string;
  appearance?: Appearance;
};

const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

// newest → oldest by updatedAt (fallback createdAt)
const sortByNewest = (arr: Bot[]) =>
  arr
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt || b.createdAt || '0') -
        Date.parse(a.updatedAt || a.createdAt || '0')
    );

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
        prompt: s(b?.prompt), // keep EXACT Step 3
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
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(bots));
  } catch {}
}

/* --------------------- Step 3 section splitter (no edits) --------------------- */

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
  text: string; // exact slice from Step 3
};

const DISPLAY_TITLES: Record<PromptSectionKey, string> = {
  'DESCRIPTION': 'DESCRIPTION',
  'AI DESCRIPTION': 'AI Description',
  'RULES AND GUIDELINES': 'RULES AND GUIDELINES',
  'AI RULES': 'AI Rules',
  'QUESTION FLOW': 'QUESTION FLOW',
  'COMPANY FAQ': 'COMPANY FAQ',
};

const ICONS: Record<PromptSectionKey, JSX.Element> = {
  'DESCRIPTION': <FileText className="w-4 h-4 text-[#6af7d1]" />,
  'AI DESCRIPTION': <FileText className="w-4 h-4 text-[#6af7d1]" />,
  'RULES AND GUIDELINES': <Settings className="w-4 h-4 text-[#6af7d1]" />,
  'AI RULES': <ListChecks className="w-4 h-4 text-[#6af7d1]" />,
  'QUESTION FLOW': <MessageSquareText className="w-4 h-4 text-[#6af7d1]" />,
  'COMPANY FAQ': <Landmark className="w-4 h-4 text-[#6af7d1]" />,
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
      text: step3Raw.slice(h.end, nextStart), // exact slice (no sanitizing)
    });
  }
  return out;
}

/* ----------------------------------- UI ----------------------------------- */

export default function BuilderDashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // --- Welcome overlay (SIGN-UP ONLY) ---
  const { data: session, status } = useSession();

  // NextAuth default sessions often lack user.id; fall back to email/sub
  const userId = useMemo(() => {
    const u = (session?.user as any) || {};
    return u.id || u.email || u.sub || '';
  }, [session]);

  // expose email for overlay -> /api/track/signup
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__USER_EMAIL__ = (session?.user?.email as string) || '';
    }
  }, [session]);

  const modeParam = searchParams.get('mode');
  const mode = (modeParam === 'signin' ? 'signin' : 'signup') as 'signup' | 'signin';
  const onboard = searchParams.get('onboard') === '1';
  const forceOverlay = searchParams.get('forceOverlay') === '1';

  const [welcomeOpen, setWelcomeOpen] = useState(false);

  // Open ONLY on sign-up (or when forced), after auth
  useEffect(() => {
    if (status !== 'authenticated') return;
    if (forceOverlay || (onboard && mode === 'signup')) setWelcomeOpen(true);
  }, [status, forceOverlay, onboard, mode]);

  const closeWelcome = () => {
    setWelcomeOpen(false);
    try { if (userId) localStorage.setItem(`user:${userId}:profile:completed`, '1'); } catch {}
    const usp = new URLSearchParams(Array.from(searchParams.entries()));
    usp.delete('onboard'); usp.delete('mode'); usp.delete('forceOverlay');
    router.replace(`${pathname}?${usp.toString()}`, { scroll: false });
  };
  // --- end welcome overlay ---

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

  if (step) {
    return (
      <div className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
        <main className="w-full min-h-screen">
          {step === '1' && <Step1AIType onNext={() => setStep('2')} />}
          {step === '2' && <Step2ModelSettings onBack={() => setStep('1')} onNext={() => setStep('3')} />}
          {step === '3' && <Step3PromptEditor onBack={() => setStep('2')} onNext={() => setStep('4')} />}
          {step === '4' && <Step4Overview onBack={() => setStep('3')} onFinish={() => setStep(null)} />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
      <main className="flex-1 w-full px-4 sm:px-6 pt-10 pb-24">
        <div className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Builds</h1>
          <button
            onClick={() => router.push('/builder?step=1')}
            className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
          >
            Create a Build
          </button>
        </div>

        <div className="mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and builds…"
            className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-5 py-4 text-[15px] outline-none focus:border-[#00ffc2]"
          />
        </div>

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
                setBots(sorted);
                saveBots(sorted);
              }}
              onCustomize={() => setCustomizingId(bot.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-white/60">
            No builds found. Click <span className="text-[#00ffc2]">Create a Build</span> to get started.
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
              b.id === customizingId
                ? { ...b, appearance: { ...(b.appearance ?? {}), ...ap }, updatedAt: nowISO() }
                : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            saveBots(sorted);
            setCustomizingId(null);
          }}
          onReset={() => {
            if (!customizingId) return;
            const next = bots.map((b) =>
              b.id === customizingId ? { ...b, appearance: undefined, updatedAt: nowISO() } : b
            );
            const sorted = sortByNewest(next);
            setBots(sorted);
            saveBots(sorted);
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

      {viewedBot && <PromptOverlay bot={viewedBot} onClose={() => setViewId(null)} />}

      {/* Welcome overlay over the dashboard (sign-up only) */}
      <OnboardingOverlay open={welcomeOpen} mode={mode} userId={userId} onDone={closeWelcome} />
    </div>
  );
}

/* --------------------------- Prompt Overlay --------------------------- */

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
    try {
      await navigator.clipboard.writeText(rawOut);
    } catch {}
  };

  const downloadTxt = () => {
    const blob = new Blob([rawOut], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safe = (bot.name || 'prompt').replace(/[^\w\-]+/g, '_');
    a.download = `${safe}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const FRAME_STYLE: React.CSSProperties = {
    background: 'rgba(13,15,17,0.95)',
    border: '2px dashed rgba(106,247,209,0.3)',
    boxShadow: '0 0 40px rgba(0,0,0,0.7)',
    borderRadius: 30,
  };
  const HEADER_BORDER = { borderBottom: '1px solid rgba(255,255,255,0.4)' };
  const CARD_STYLE: React.CSSProperties = {
    background: '#101314',
    border: '1px solid rgba(255,255,255,0.3)',
    borderRadius: 20,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-white text-xl font-semibold truncate">Prompt</h2>
            <div className="text-white/90 text-xs md:text-sm truncate">
              {[bot.name, bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={copyAll}
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
              style={{ background: '#0d0f11', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
              title="Copy"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy
            </button>
            <button
              onClick={downloadTxt}
              className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
              style={{ background: '#0d0f11', borderColor: 'rgba(255,255,255,0.3)', color: 'white' }}
              title="Download"
            >
              <Download as={DownloadIcon} className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label="Close"
              title="Close"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!bot.prompt ? (
            <div className="p-5 text-white/80" style={CARD_STYLE}>
              (No Step 3 prompt yet)
            </div>
          ) : sections ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((sec, i) => (
                <div key={i} style={CARD_STYLE} className="overflow-hidden">
                  <div className="px-5 pt-4 pb-3">
                    <div className="flex items-center gap-2 text-white font-semibold text-sm">
                      {ICONS[sec.key]} {sec.title}
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <pre className="whitespace-pre-wrap text-sm leading-6 text-white">{sec.text}</pre>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={CARD_STYLE} className="p-5">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-white">{bot.prompt}</pre>
            </div>
          )}
        </div>

        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', background: '#101314' }}>
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-[14px] font-semibold"
              style={{ background: 'rgba(0,120,90,1)', color: 'white' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
