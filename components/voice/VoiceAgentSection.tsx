// components/voice/VoiceAgentSection.tsx
'use client';

import React, {
  useEffect, useMemo, useRef, useState, useLayoutEffect,
} from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search, Check, Lock, X,
} from 'lucide-react';

/* ───────────────── Dynamic rail (unchanged) ───────────────── */
const AssistantRail = dynamic(
  () =>
    import('@/components/voice/AssistantRail')
      .then((m) => m.default ?? m)
      .catch(() => () => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> },
);

class RailBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(p: any) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ───────────────── Tokens ───────────────── */
const ACTIVE_KEY = 'va:activeId';
const BRAND = '#59d9b3';
const BRAND_HOVER = '#54cfa9';

/* Global rhythm + tones (ChatGPT-like) */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px;
      --radius-outer: 12px;        /* less rounded outer boxes */
      --radius-inner: 12px;
      --control-h: 44px;

      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      /* Surfaces */
      --vs-card: #0f1213;
      --vs-border: rgba(255,255,255,.06);
      /* Strong GREEN outer glow (matches CTA) */
      --card-shadow-outer:
        0 22px 60px rgba(0,0,0,.50),
        0 0 0 1px rgba(89,217,179,.15),
        0 18px 40px rgba(89,217,179,.20);

      /* Header bar (slightly lighter) */
      --box-head: linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03));

      /* Inputs: SOLID, no transparency */
      --vs-input-bg: #0c0f10;
      --vs-input-border: rgba(255,255,255,.12);
      --vs-input-shadow:
        0 10px 26px rgba(0,0,0,.35),
        0 0 0 1px rgba(255,255,255,.04);

      --menu-bg: #0d1011;
      --menu-border: rgba(255,255,255,.12);
      --menu-shadow:
        0 28px 70px rgba(0,0,0,.55),
        0 10px 26px rgba(0,0,0,.40),
        0 0 0 1px rgba(89,217,179,.10);

      --text: #eaf8f3;
      --text-muted: rgba(234,248,243,.66);
    }

    :root:not([data-theme="dark"]) .va-scope{
      --vs-card: #ffffff;
      --vs-border: rgba(0,0,0,.08);
      --card-shadow-outer:
        0 18px 40px rgba(0,0,0,.15),
        0 0 0 1px rgba(0,0,0,.05),
        0 12px 22px rgba(89,217,179,.16);
      --box-head: linear-gradient(180deg, rgba(0,0,0,.04), rgba(0,0,0,.02));
      --vs-input-bg: #ffffff;
      --vs-input-border: rgba(0,0,0,.12);
      --vs-input-shadow:
        0 10px 26px rgba(0,0,0,.10),
        0 0 0 1px rgba(0,0,0,.04);
      --menu-bg: #ffffff;
      --menu-border: rgba(0,0,0,.10);
      --menu-shadow:
        0 28px 70px rgba(0,0,0,.12),
        0 10px 26px rgba(0,0,0,.08),
        0 0 0 1px rgba(0,0,0,.05);
      --text: #0f1213;
      --text-muted: rgba(15,18,19,.62);
    }

    @keyframes va-collapse { from { height: var(--from); } to { height: var(--to); } }
    @keyframes va-pop { from { opacity:.0; transform: translateY(6px) scale(.985); filter: blur(2px); } to { opacity:1; transform:none; filter:none; } }
    .va-pop { animation: va-pop 160ms var(--ease) both; }
  `}</style>
);

/* ───────────────── Data types ───────────────── */
type Provider = 'openai' | 'anthropic' | 'google';
type AsrProvider = 'deepgram' | 'whisper' | 'assemblyai';
type Lang = 'en' | 'nl' | 'es' | 'de';
type Dialect = 'en-US' | 'en-UK' | 'en-AU' | 'standard';

type AgentData = {
  provider: Provider;
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  /* Voice (for now: OpenAI voices; name only) */
  ttsProvider: 'openai';
  voice: string;

  /* Transcriber */
  asrProvider: AsrProvider;
  asrLang: Lang;
  asrDialect: Dialect;
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
  confidence: number;
};

const DEFAULT_TEMPLATE = `[Identity]
You are a blank template AI assistant with minimal default settings, designed to be easily customizable for various use cases.

[Style]
- Maintain a neutral and adaptable tone suitable for a wide range of contexts.
- Use clear and concise language to ensure effective communication.

[Response Guidelines]
- Avoid using any specific jargon or domain-specific language.
- Keep responses straightforward and focused on the task at hand.

[Task & Goals]
1. Serve as a versatile agent that can be tailored to fit different roles based on user instructions.
2. Allow users to modify model parameters, such as temperature, messages, and other settings as needed.
3. Ensure all adjustments are reflected in real-time to adapt to the current context.

[Error Handling / Fallback]
- Prompt users for clarification if inputs are vague or unclear.
- Gracefully handle any errors by providing a polite default response or seeking further instruction.
`;

const DEFAULT_AGENT: AgentData = {
  provider: 'openai',
  model: 'GPT 4o Cluster',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt: DEFAULT_TEMPLATE,

  ttsProvider: 'openai',
  voice: 'Alloy (American)',

  asrProvider: 'deepgram',
  asrLang: 'en',
  asrDialect: 'en-US',
  asrModel: 'Nova 2',

  denoise: false,
  numerals: false,
  confidence: 0.4,
};

const keyFor = (id: string) => `va:agent:${id}`;
const loadAgent = (id: string): AgentData => {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw) || {}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgent = (id: string, data: AgentData) => { try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {} };

/* ───────────────── Options ───────────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

const providerOpts: Opt[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic — coming soon', disabled: true },
  { value: 'google', label: 'Google — coming soon', disabled: true },
];
const modelOptsFor = (p: Provider): Opt[] => p === 'openai'
  ? [
    { value: 'GPT 4o Cluster', label: 'GPT 4o Cluster' },
    { value: 'GPT-4o', label: 'GPT-4o' },
    { value: 'GPT-4.1', label: 'GPT-4.1' },
  ]
  : [{ value: 'soon', label: 'Models coming soon', disabled: true }];

const firstMessageModes: Opt[] = [
  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
  { value: 'User speaks first', label: 'User speaks first' },
  { value: 'Silent until tool required', label: 'Silent until tool required' },
];

/* OpenAI voices (simple list; you can fetch dynamically later) */
const ttsProviderOpts: Opt[] = [{ value: 'openai', label: 'OpenAI' }];
const openaiVoiceOpts: Opt[] = [
  { value: 'Alloy (American)', label: 'Alloy (American)' },
  { value: 'Verse (American)', label: 'Verse (American)' },
  { value: 'Amber (American)', label: 'Amber (American)' },
  { value: 'Nova (Neutral)', label: 'Nova (Neutral)' },
];

const asrProviders: Opt[] = [
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'whisper', label: 'Whisper — coming soon', disabled: true },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true },
];
const asrLanguages: Opt[] = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
];
const dialectsFor = (lang: Lang): Opt[] => (lang === 'en'
  ? [
    { value: 'en-US', label: 'English — American' },
    { value: 'en-UK', label: 'English — British' },
    { value: 'en-AU', label: 'English — Australian' },
  ]
  : [{ value: 'standard', label: 'Standard' }]
);
const asrModelsFor = (prov: AsrProvider): Opt[] => prov === 'deepgram'
  ? [{ value: 'Nova 2', label: 'Nova 2' }, { value: 'Nova', label: 'Nova' }]
  : [{ value: 'soon', label: 'Models coming soon', disabled: true }];

/* ───────────────── Small components ───────────────── */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999,
      justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--vs-input-bg))' : 'var(--vs-input-bg)',
      border: '1px solid var(--vs-input-border)',
      boxShadow: 'var(--vs-input-shadow)',
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width: 18, height: 18, borderRadius: 999,
        background: checked ? BRAND : 'rgba(255,255,255,.12)',
        transform: `translateX(${checked ? 22 : 0}px)`,
        transition: 'transform .18s var(--ease)',
        boxShadow: checked ? '0 0 10px rgba(89,217,179,.55)' : undefined,
      }}
    />
  </button>
);

const FieldShell = ({
  label, children, boxed = true, help,
}: { label: React.ReactNode; children: React.ReactNode; boxed?: boolean; help?: React.ReactNode }) => (
  <div>
    <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize: 'var(--fz-label)', color: 'var(--text)' }}>
      {label}
    </label>
    {boxed ? (
      <div
        className="px-3 py-[10px] rounded-[var(--radius-inner)]"
        style={{
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          boxShadow: 'var(--vs-input-shadow)',
        }}
      >
        {children}
      </div>
    ) : children}
    {help ? <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{help}</div> : null}
  </div>
);

/* Solid dropdown with portal */
function StyledSelect({
  value, onChange, options, placeholder,
}: { value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string }) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [query, setQuery] = useState('');

  const current = options.find((o) => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
    const openUp = r.bottom + 320 > window.innerHeight;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', off);
    return () => window.removeEventListener('mousedown', off);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen((v) => !v); setTimeout(() => searchRef.current?.focus(), 0); }}
        className="w-full flex items-center justify-between gap-3 px-3 rounded-[var(--radius-inner)] transition"
        style={{
          height: 'var(--control-h)',
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          boxShadow: 'var(--vs-input-shadow)',
          color: 'var(--text)',
          fontSize: 'var(--fz-body)',
        }}
      >
        <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && typeof document !== 'undefined'
        ? createPortal(
          <div
            ref={portalRef}
            className="fixed z-[9999] p-3 va-pop"
            style={{
              top: rect.openUp ? rect.top - 8 : rect.top + 8,
              left: rect.left,
              width: rect.width,
              transform: rect.openUp ? 'translateY(-100%)' : 'none',
              background: 'var(--menu-bg)',
              border: '1px solid var(--menu-border)',
              borderRadius: 12,
              boxShadow: 'var(--menu-shadow)',
            }}
          >
            <div
              className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
              style={{
                background: 'var(--vs-input-bg)',
                border: '1px solid var(--vs-input-border)',
                boxShadow: 'var(--vs-input-shadow)',
                color: 'var(--text)',
              }}
            >
              <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type to filter…"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color: 'var(--text)' }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map((o) => (
                <button
                  key={o.value}
                  disabled={o.disabled}
                  onClick={() => { if (!o.disabled) { onChange(o.value); setOpen(false); } }}
                  className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition flex items-center gap-2 disabled:opacity-60"
                  style={{
                    color: 'var(--text)',
                    background: 'transparent',
                    border: '1px solid transparent',
                    cursor: o.disabled ? 'not-allowed' : 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (o.disabled) return;
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(89,217,179,0.10)';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(89,217,179,0.35)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                  }}
                >
                  {o.disabled ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" style={{ opacity: o.value === value ? 1 : 0 }} />}
                  <span className="flex-1">{o.label}</span>
                  {o.note ? <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{o.note}</span> : null}
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>No matches.</div>
              )}
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}

/* Small modal overlay for Generate */
function MiniModal({
  open, onClose, onAccept, placeholder = 'Add follow-ups or refinements…',
}: { open: boolean; onClose: () => void; onAccept: (text: string) => void; placeholder?: string }) {
  const [val, setVal] = useState('');
  useEffect(() => { if (!open) setVal(''); }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,.45)' }}
      onMouseDown={onClose}
    >
      <div
        className="va-pop"
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(560px, 92vw)',
          background: 'var(--vs-card)',
          border: '1px solid var(--vs-border)',
          boxShadow: 'var(--card-shadow-outer)',
          borderRadius: 12,
        }}
      >
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ background: 'var(--box-head)', borderBottom: '1px solid var(--vs-border)', borderTopLeftRadius: 12, borderTopRightRadius: 12 }}
        >
          <div className="font-medium" style={{ color: 'var(--text)' }}>Generate prompt</div>
          <button onClick={onClose} className="p-1 rounded-md" style={{ color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <div
            className="rounded-[10px] px-3 py-2"
            style={{ background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)' }}
          >
            <input
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder={placeholder}
              className="w-full bg-transparent outline-none"
              style={{ color: 'var(--text)' }}
            />
          </div>

          <div className="mt-3 flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-3 h-9 rounded-[10px]"
              style={{ background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', color: 'var(--text)' }}
            >
              Cancel
            </button>
            <button
              onClick={() => { onAccept(val.trim()); onClose(); }}
              className="px-3 h-9 rounded-[10px] font-semibold"
              style={{ background: BRAND, color: '#fff', boxShadow: '0 10px 24px rgba(89,217,179,.28)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BRAND_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BRAND)}
            >
              Accept Changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ───────────────── Page ───────────────── */
export default function VoiceAgentSection() {
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgent(activeId) : DEFAULT_AGENT));

  /* modal */
  const [genOpen, setGenOpen] = useState(false);

  /* observe rail changes */
  useEffect(() => {
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  /* load + persist */
  useEffect(() => { if (activeId) setData(loadAgent(activeId)); }, [activeId]);
  useEffect(() => { if (activeId) saveAgent(activeId, data); }, [activeId, data]);

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData((prev) => ({ ...prev, [k]: v }));

  const modelOpts = useMemo(() => modelOptsFor(data.provider), [data.provider]);
  const dialectOpts = useMemo(() => dialectsFor(data.asrLang), [data.asrLang]);
  const asrModelOpts = useMemo(() => asrModelsFor(data.asrProvider), [data.asrProvider]);

  return (
    <section className="va-scope" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <Tokens />

      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="border-r" style={{ borderColor: 'rgba(255,255,255,.12)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]"
          style={{ fontSize: 'var(--fz-body)', lineHeight: 'var(--lh-body)' }}
        >
          {/* top row */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm"
              style={{ height: 'var(--control-h)', background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)', color: 'var(--text)' }}
            >
              Save
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm"
              style={{ height: 'var(--control-h)', background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)', color: 'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> Publish
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold select-none"
              style={{ height: 'var(--control-h)', padding: '0 18px', background: BRAND, color: '#fff', boxShadow: '0 10px 24px rgba(89,217,179,.28)' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BRAND_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BRAND)}
            >
              <Phone className="w-4 h-4" /> Talk to Assistant
            </button>
          </div>

          {/* KPI cards */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[10px]"
              style={{ background: 'var(--vs-card)', border: '1px solid var(--vs-border)', boxShadow: 'var(--card-shadow-outer)' }}
            >
              <div className="text-xs mb-[6px]" style={{ color: 'var(--text-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize: 'var(--fz-sub)', color: 'var(--text)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[10px]"
              style={{ background: 'var(--vs-card)', border: '1px solid var(--vs-border)', boxShadow: 'var(--card-shadow-outer)' }}
            >
              <div className="text-xs mb-[6px]" style={{ color: 'var(--text-muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize: 'var(--fz-sub)', color: 'var(--text)' }}>~1050 ms</div>
            </div>
          </div>

          {/* Sections */}
          <Section
            title="Model"
            subtitle="Configure the assistant’s reasoning model and first message."
            icon={<Gauge className="w-4 h-4" style={{ color: BRAND }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect
                  value={data.provider}
                  onChange={(v) => set('provider')(v as Provider)}
                  options={providerOpts}
                />
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <StyledSelect value={data.model} onChange={set('model')} options={modelOpts} />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="First Message Mode" boxed={false}>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstMessageModes} />
              </FieldShell>
              <FieldShell label="First Message" boxed={false}>
                <input
                  className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3"
                  style={{
                    height: 'var(--control-h)',
                    background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)',
                    color: 'var(--text)',
                  }}
                  value={data.firstMsg}
                  onChange={(e) => set('firstMsg')(e.target.value)}
                />
              </FieldShell>
            </div>

            <div className="mt-[var(--s-4)]">
              <div className="flex items-center justify-between mb-[var(--s-2)]">
                <div className="font-medium" style={{ fontSize: 'var(--fz-label)' }}>System Prompt</div>
                <button
                  onClick={() => setGenOpen(true)}
                  className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                  style={{ height: 36, padding: '0 12px', background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)', color: 'var(--text)' }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3 py-[10px]"
                style={{
                  background: 'var(--vs-input-bg)', border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)',
                  color: 'var(--text)', minHeight: 220, lineHeight: 'var(--lh-body)',
                }}
                value={data.systemPrompt}
                onChange={(e) => set('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          <Section
            title="Voice"
            subtitle="Choose the TTS provider and voice."
            icon={<Wand2 className="w-4 h-4" style={{ color: BRAND }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Voice Provider" boxed={false}>
                <StyledSelect
                  value={data.ttsProvider}
                  onChange={(v) => set('ttsProvider')(v as 'openai')}
                  options={ttsProviderOpts}
                />
              </FieldShell>
              <FieldShell label="Voice" boxed={false}>
                <StyledSelect
                  value={data.voice}
                  onChange={set('voice')}
                  options={openaiVoiceOpts}
                />
              </FieldShell>
            </div>
            <div className="mt-[var(--s-3)] text-xs" style={{ color: 'var(--text-muted)' }}>
              Naturalness hint: voices render server-side; keep utterances short/specific for the most “human” cadence. (You can later map ElevenLabs IDs.)
            </div>
          </Section>

          <Section
            title="Transcriber"
            subtitle="Speech-to-text configuration for calls."
            icon={<Timer className="w-4 h-4" style={{ color: BRAND }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect
                  value={data.asrProvider}
                  onChange={(v) => set('asrProvider')(v as AsrProvider)}
                  options={asrProviders}
                />
              </FieldShell>
              <FieldShell label="Language" boxed={false}>
                <StyledSelect
                  value={data.asrLang}
                  onChange={(v) => {
                    const lang = v as Lang;
                    set('asrLang')(lang);
                    if (lang !== 'en') set('asrDialect')('standard');
                  }}
                  options={asrLanguages}
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="Dialect" boxed={false}>
                <StyledSelect
                  value={data.asrDialect}
                  onChange={(v) => set('asrDialect')(v as Dialect)}
                  options={dialectOpts}
                />
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <StyledSelect
                  value={data.asrModel}
                  onChange={set('asrModel')}
                  options={asrModelOpts}
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-6)] mt-[var(--s-4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ color: 'var(--text)' }}>Background Denoising Enabled</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Filter background noise while the user is talking.</div>
                </div>
                <Toggle checked={data.denoise} onChange={(v) => set('denoise')(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ color: 'var(--text)' }}>Use Numerals</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Convert numbers from words to digits in transcription.</div>
                </div>
                <Toggle checked={data.numerals} onChange={(v) => set('numerals')(v)} />
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-[var(--s-4)] items-center mt-[var(--s-4)]">
              <div className="flex items-center gap-3">
                <div className="text-sm" style={{ color: 'var(--text)' }}>Confidence Threshold</div>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={data.confidence}
                  onChange={(e) => set('confidence')(parseFloat(e.target.value))}
                  style={{ width: 220 }}
                />
              </div>
              <div
                className="px-2.5 py-1.5 rounded-md text-xs"
                style={{
                  background: 'var(--vs-input-bg)',
                  border: '1px solid var(--vs-input-border)',
                  boxShadow: 'var(--vs-input-shadow)',
                  color: 'var(--text)', minWidth: 46, textAlign: 'center',
                }}
              >
                {data.confidence.toFixed(1)}
              </div>
            </div>
          </Section>

          <MiniModal
            open={genOpen}
            onClose={() => setGenOpen(false)}
            onAccept={(addition) => {
              if (!addition) return;
              set('systemPrompt')(
                `${data.systemPrompt.trim()}\n\n[Refinements]\n${addition}`,
              );
            }}
          />
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Section with integrated header bar ───────────────── */
function Section({
  title, subtitle, icon, children,
}: { title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [h, setH] = useState<'auto' | number>('auto');

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    if (open) {
      const ph = el.scrollHeight;
      setH(ph);
      const t = setTimeout(() => setH('auto'), 200);
      return () => clearTimeout(t);
    } else {
      const ph = el.scrollHeight;
      setH(ph);
      requestAnimationFrame(() => setH(0));
    }
  }, [open, children]);

  return (
    <div className="mb-[var(--s-6)] va-pop" style={{ boxShadow: 'var(--card-shadow-outer)', borderRadius: 'var(--radius-outer)' }}>
      {/* Header BAR (touching the box; same rounded corners) */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{
          background: 'var(--box-head)',
          color: 'var(--text)',
          border: '1px solid var(--vs-border)',
          borderBottom: 'none',
          borderTopLeftRadius: 'var(--radius-outer)',
          borderTopRightRadius: 'var(--radius-outer)',
        }}
      >
        <span className="inline-flex items-center gap-[var(--s-3)]">
          <span className="inline-grid place-items-center w-7 h-7 rounded-full"
            style={{
              background: 'rgba(89,217,179,.14)',
              boxShadow: '0 0 0 1px rgba(89,217,179,.18) inset',
            }}
          >
            {icon}
          </span>
          <span className="font-semibold" style={{ fontSize: 'var(--fz-title)' }}>{title}</span>
        </span>

        <div className="flex items-center gap-3">
          {subtitle ? <span className="hidden md:block text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</span> : null}
          <button onClick={() => setOpen((v) => !v)} className="p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }}>
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Body box (shares the same container, so header “touches” it) */}
      <div
        style={{
          background: 'var(--vs-card)',
          borderLeft: '1px solid var(--vs-border)',
          borderRight: '1px solid var(--vs-border)',
          borderBottom: '1px solid var(--vs-border)',
          borderBottomLeftRadius: 'var(--radius-outer)',
          borderBottomRightRadius: 'var(--radius-outer)',
          overflow: 'hidden',
          minHeight: open ? undefined : 72, /* collapsed height ~70px equivalent */
        }}
      >
        <div
          ref={wrapRef}
          style={{
            height: h === 'auto' ? 'auto' : `${h}px`,
            transition: 'height 220ms var(--ease)',
          }}
        >
          <div className="relative p-[var(--s-6)]">
            {/* subtle green bloom behind content */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-[28%] -left-[28%] w-[55%] h-[55%] rounded-full"
              style={{ background: 'radial-gradient(circle, rgba(89,217,179,.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

    
