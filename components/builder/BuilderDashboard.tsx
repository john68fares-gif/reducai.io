'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Plus,
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
  Search
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
    <div className="h-full w-full" style={{ background:'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))' }} />
  ),
});

/* =====================================================
   TYPES
   ===================================================== */
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

/* =====================================================
   STORAGE HELPERS
   ===================================================== */
const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const SAVE_KEY = 'chatbots';
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

/* =====================================================
   STEP 3 SPLITTER (unchanged logic)
   ===================================================== */
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
  'DESCRIPTION': <FileText className="w-4 h-4" style={{ color:'var(--brand)' }} />,
  'AI DESCRIPTION': <FileText className="w-4 h-4" style={{ color:'var(--brand)' }} />,
  'RULES AND GUIDELINES': <Settings className="w-4 h-4" style={{ color:'var(--brand)' }} />,
  'AI RULES': <ListChecks className="w-4 h-4" style={{ color:'var(--brand)' }} />,
  'QUESTION FLOW': <MessageSquareText className="w-4 h-4" style={{ color:'var(--brand)' }} />,
  'COMPANY FAQ': <Landmark className="w-4 h-4" style={{ color:'var(--brand)' }} />,
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
      text: step3Raw.slice(h.end, nextStart),
    });
  }
  return out;
}

/* =====================================================
   ACCENT PICKER
   ===================================================== */
const palette = ['#6af7d1', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[Math.abs([...id].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

/* =====================================================
   MAIN
   ===================================================== */
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

  /* housekeeping (unchanged) */
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

  /* Wizard steps container */
  if (step) {
    return (
      <div className="min-h-screen w-full font-movatif" style={{ background:'var(--bg)', color:'var(--text)' }}>
        <main className="w-full min-h-screen">
          {step === '1' && <Step1AIType onNext={() => setStep('2')} />}
          {step === '2' && <Step2ModelSettings onBack={() => setStep('1')} onNext={() => setStep('3')} />}
          {step === '3' && <Step3PromptEditor onBack={() => setStep('2')} onNext={() => setStep('4')} />}
          {step === '4' && <Step4Overview onBack={() => setStep('3')} onFinish={() => setStep(null)} />}
        </main>
      </div>
    );
  }

  /* Dashboard */
  return (
    <div className="min-h-screen w-full font-movatif" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <main className="flex-1 w-full px-4 sm:px-6 pt-8 pb-24">

        {/* SECTION BAR (slim top bar like your reference) */}
        <div className="section-bar">
          <span className="section-pill">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background:'var(--brand)' }} />
            Builder Dashboard
          </span>
        </div>

        {/* BODY (no giant white box; cards flow on the page) */}
        <div className="section-body">
          {/* search */}
          <div className="mb-6">
            <div className="builder-input flex items-center gap-2 px-4 py-3">
              <Search className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search projects and builds…"
                className="w-full bg-transparent outline-none text-[15px]"
                style={{ color:'var(--text)' }}
              />
            </div>
          </div>

          {/* grid */}
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
            <div className="mt-10 text-sm" style={{ color:'var(--text-muted)' }}>
              No builds found. Click <span style={{ color:'var(--brand)' }}>Create a Build</span> to get started.
            </div>
          )}
        </div>
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
    </div>
  );
}

/* =====================================================
   PROMPT OVERLAY
   ===================================================== */
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
    const a = document.createElement('a'); a.href = url;
    a.download = `${(bot.name || 'prompt').replace(/[^\w\-]+/g, '_')}.txt`;
    a.click(); URL.revokeObjectURL(url);
  };

  const FRAME: React.CSSProperties = {
    background:'rgba(13,15,17,0.95)',
    border:'2px dashed rgba(106,247,209,0.3)',
    boxShadow:'0 0 40px rgba(0,0,0,0.7)',
    borderRadius:30
  };
  const HEADER_BORDER = { borderBottom:'1px solid rgba(255,255,255,0.4)' };
  const CARD: React.CSSProperties = {
    background:'#101314',
    border:'1px solid rgba(255,255,255,0.3)',
    borderRadius:20
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.5)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[88vh] flex flex-col" style={FRAME}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h2 className="text-white text-xl font-semibold truncate">Prompt</h2>
            <div className="text-white/90 text-xs md:text-sm truncate">
              {[bot.name, bot.industry, bot.language].filter(Boolean).join(' · ') || '—'}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={copyAll} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
                    style={{ background:'#0d0f11', borderColor:'rgba(255,255,255,0.3)', color:'white' }}>
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
            <button onClick={downloadTxt} className="inline-flex items-center gap-2 rounded-[14px] px-3 py-2 text-xs border"
                    style={{ background:'#0d0f11', borderColor:'rgba(255,255,255,0.3)', color:'white' }}>
              <DownloadIcon className="w-3.5 h-3.5" /> Download
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {!bot.prompt ? (
            <div className="p-5 text-white/80" style={CARD}>(No Step 3 prompt yet)</div>
          ) : sections ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sections.map((sec, i) => (
                <div key={i} style={CARD} className="overflow-hidden">
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
            <div style={CARD} className="p-5">
              <pre className="whitespace-pre-wrap text-sm leading-6 text-white">{bot.prompt}</pre>
            </div>
          )}
        </div>

        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop:'1px solid rgba(255,255,255,0.3)', background:'#101314' }}>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-5 py-2 rounded-[14px] font-semibold"
                    style={{ background:'rgba(0,120,90,1)', color:'white' }}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =====================================================
   CARDS
   ===================================================== */
function CreateCard({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      className="builder-card dashed relative h-[380px] rounded-[16px] p-7 flex flex-col items-center justify-center active:scale-[0.995]"
    >
      <div className="absolute -top-[28%] -left-[28%] w-[70%] h-[70%] builder-spot" />
      <div
        className="pointer-events-none absolute top-0 bottom-0 w-[55%] rounded-[16px]"
        style={{
          left: hover ? '120%' : '-120%',
          background:'linear-gradient(110deg, transparent 0%, rgba(255,255,255,.08) 40%, rgba(255,255,255,.16) 50%, rgba(255,255,255,.08) 60%, transparent 100%)',
          transition:'left 420ms var(--ease)'
        }}
      />
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
           style={{ background:'rgba(0,0,0,.06)', border:'2px dashed var(--brand-weak)' }}>
        <Plus className="w-10 h-10" style={{ color:'var(--brand)' }} />
      </div>
      <div className="text-[20px]" style={{ color:'var(--text)' }}>Create a Build</div>
      <div className="text-[13px] mt-2" style={{ color:'var(--text-muted)' }}>
        Start building your AI assistant
      </div>
    </button>
  );
}

function BuildCard({
  bot, accent, onOpen, onDelete, onCustomize,
}: {
  bot: Bot; accent: string; onOpen: () => void; onDelete: () => void; onCustomize: () => void;
}) {
  const [hover, setHover] = useState(false);
  const ap = bot.appearance || {};
  return (
    <div className="builder-card relative h-[380px] rounded-[16px] p-0 flex flex-col justify-between"
         onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      <div className="absolute -top-[28%] -left-[28%] w-[70%] h-[70%] builder-spot" />

      <div className="h-48 border-b" style={{ borderColor:'var(--border)' }}>
        <button
          onClick={onCustomize}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs"
          style={{ background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)' }}
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
          idle={ap.hasOwnProperty('idle') ? Boolean(ap.idle) : hover}
        />
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[10px] flex items-center justify-center"
               style={{ background:'rgba(0,0,0,.06)', border:'1px solid var(--border)' }}>
            <Plus className="w-5 h-5 rotate-45" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate" style={{ color:'var(--text)' }}>{bot.name}</div>
            <div className="text-[12px] truncate" style={{ color:'var(--text-muted)' }}>
              {(bot.industry || '—') + (bot.language ? ` · ${bot.language}` : '')}
            </div>
          </div>
          <button onClick={onDelete} className="ml-auto p-1.5 rounded-md" title="Delete build"
                  style={{ color:'var(--text-muted)' }}>
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="text-[12px]" style={{ color:'var(--text-muted)' }}>
            Updated {fmtDate(bot.updatedAt || bot.createdAt)}
          </div>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm"
            style={{ background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)' }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
