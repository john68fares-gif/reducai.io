// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search, Check, Lock, Volume2,
} from 'lucide-react';

/* ───────────────── Dynamic rail (kept) ───────────────── */
const AssistantRail = dynamic(
  () =>
    import('@/components/voice/AssistantRail')
      .then((m) => m.default ?? m)
      .catch(() => () => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

class RailBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(p: any) { super(p); this.state = { hasError: false }; }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ───────────────── Tokens (ChatGPT-like rhythm + green shadows) ───────────────── */
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const ACTIVE_KEY = 'va:activeId';

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px;
      --radius-outer: 14px;   /* less rounded outer cards */
      --radius-inner: 12px;   /* inside controls */
      --control-h: 44px;

      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      /* base surface */
      --panel: #0f1213;
      --panel-2: #0b0e0f;
      --text: #eaf8f3;
      --text-muted: rgba(234,248,243,.66);

      /* “almost 0px” borders + green shadows */
      --border-weak: rgba(255,255,255,.06);
      --shadow-green: 0 26px 70px rgba(89,217,179,.18), 0 0 0 1px rgba(89,217,179,.10);
      --shadow-green-soft: 0 18px 42px rgba(89,217,179,.14), 0 0 0 1px rgba(89,217,179,.08);
      --ring: rgba(89,217,179,.10);

      /* solid controls */
      --ctrl-bg: #0e1112;
      --ctrl-border: rgba(255,255,255,.12);
      --ctrl-shadow: 0 16px 40px rgba(0,0,0,.45), 0 0 0 1px rgba(89,217,179,.05);

      /* portal (menus) */
      --menu-bg: #0e1112;
      --menu-border: rgba(255,255,255,.14);
      --menu-shadow: 0 28px 70px rgba(89,217,179,.18), 0 12px 28px rgba(0,0,0,.45), 0 0 0 1px rgba(89,217,179,.12);
    }
    :root:not([data-theme="dark"]) .va-scope{
      --panel:#ffffff; --panel-2:#ffffff; --text:#0f1213; --text-muted:rgba(15,18,19,.64);
      --border-weak: rgba(0,0,0,.06);
      --shadow-green: 0 26px 70px rgba(89,217,179,.20), 0 0 0 1px rgba(89,217,179,.10);
      --shadow-green-soft: 0 18px 42px rgba(89,217,179,.16), 0 0 0 1px rgba(89,217,179,.08);
      --ring: rgba(89,217,179,.10);
      --ctrl-bg:#fff; --ctrl-border:rgba(0,0,0,.10);
      --ctrl-shadow: 0 14px 30px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.03);
      --menu-bg:#fff; --menu-border:rgba(0,0,0,.10); --menu-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
    }

    /* page & columns */
    .va-page{
      background: radial-gradient(120% 200% at 20% -40%, rgba(89,217,179,.10) 0%, transparent 40%) , var(--panel-2);
      min-height: 100dvh;
      overflow: visible; /* prevent rail cropping */
      isolation: isolate; /* avoid ancestor clipping on animations */
    }

    /* subtle glow lines used when collapsed */
    .va-glow-line{
      height: 8px; border-radius: 999px;
      background: radial-gradient(120% 180% at 10% 50%, rgba(89,217,179,.35) 0%, rgba(89,217,179,.12) 40%, transparent 70%);
      box-shadow: inset 0 0 0 1px rgba(89,217,179,.18);
    }

    /* animations */
    @keyframes va-pop { from{ opacity:.0; transform: translateY(6px) scale(.985); filter: blur(2px);} to{opacity:1; transform:none; filter:none;} }
    .va-pop{ animation: va-pop 160ms var(--ease) both; }

    /* collapse height animation without layout jank */
    .va-collapsing{ will-change: height, opacity, filter; overflow: clip; }
  `}</style>
);

/* ───────────────── Types & storage ───────────────── */
type Provider = 'openai' | 'anthropic' | 'google';
type AsrProv  = 'deepgram' | 'whisper' | 'assemblyai';
type Lang    = 'en' | 'nl' | 'es' | 'de';
type Dialect = 'en-US' | 'en-UK' | 'en-AU' | 'standard';

type AgentData = {
  provider: Provider;
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;
  // voice
  ttsProvider: 'openai' | 'elevenlabs';
  voiceId: string; // when openai, use voice name; when elevenlabs, the id
  // asr
  asrProvider: AsrProv;
  asrLang: Lang;
  asrDialect: Dialect;
  asrModel: string;
  // flags
  denoise: boolean;
  numerals: boolean;
  confidence: number;
};

const DEFAULT_AGENT: AgentData = {
  provider: 'openai',
  model: 'GPT 4o Cluster',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
    'This is a blank template with minimal defaults, you can change the model, temperature, and messages.',
  ttsProvider: 'openai',
  voiceId: 'alloy',  // Alloy (American) by default
  asrProvider: 'deepgram',
  asrLang: 'en',
  asrDialect: 'en-US',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
  confidence: 0.4,
};

const keyFor = (id: string) => `va:agent:${id}`;
const load = (id: string): AgentData => {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const save = (id: string, data: AgentData) => { try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {} };

/* ───────────────── Fake backend hooks (leave endpoints as-is) ───────────────── */
async function apiSave(id: string, payload: AgentData){ return fetch(`/api/voice/agent/${id}/save`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }
async function apiPublish(id: string){ return fetch(`/api/voice/agent/${id}/publish`, { method:'POST' }); }
async function apiCallTest(id: string){ return fetch(`/api/voice/agent/${id}/call-test`, { method:'POST' }); }

/* ───────────────── Options (with coming soon) ───────────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

const providerOpts: Opt[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic — coming soon', disabled: true, note: 'soon' },
  { value: 'google', label: 'Google — coming soon', disabled: true, note: 'soon' },
];

const modelOptsFor = (p: Provider): Opt[] => p === 'openai'
  ? [
      { value: 'GPT 4o Cluster', label: 'GPT 4o Cluster' },
      { value: 'GPT-4o', label: 'GPT-4o' },
      { value: 'GPT-4.1', label: 'GPT-4.1' },
    ]
  : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

const firstMessageModes: Opt[] = [
  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
  { value: 'User speaks first', label: 'User speaks first' },
  { value: 'Silent until tool required', label: 'Silent until tool required' },
];

const ttsProviders: Opt[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true, note: 'soon' },
];

// OpenAI built-ins (names double as IDs when you hit TTS later)
const openaiVoices: Opt[] = [
  { value: 'alloy', label: 'Alloy (American)' },
  { value: 'verse', label: 'Verse (American)' },
  { value: 'aria',  label: 'Aria (British)' },
  { value: 'aura',  label: 'Aura (Australian)' },
];

const asrProviders: Opt[] = [
  { value: 'deepgram', label: 'Deepgram' },
  { value: 'whisper', label: 'Whisper — coming soon', disabled: true, note: 'soon' },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true, note: 'soon' },
];

const asrLangs: Opt[] = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
];

const dialectsFor = (lang: Lang): Opt[] => lang === 'en'
  ? [
      { value: 'en-US', label: 'English — American' },
      { value: 'en-UK', label: 'English — British' },
      { value: 'en-AU', label: 'English — Australian' },
    ]
  : [{ value: 'standard', label: 'Standard' }];

const asrModelsFor = (prov: AsrProv): Opt[] => prov === 'deepgram'
  ? [{ value: 'Nova 2', label: 'Nova 2' }, { value: 'Nova', label: 'Nova' }]
  : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

/* ───────────────── Small building blocks ───────────────── */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999, justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--ctrl-bg))' : 'var(--ctrl-bg)',
      border: '1px solid var(--ctrl-border)', boxShadow: 'var(--ctrl-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width: 18, height: 18, borderRadius: 999,
        background: checked ? CTA : 'rgba(255,255,255,.12)',
        transform: `translateX(${checked ? 22 : 0}px)`,
        transition: 'transform .18s var(--ease)',
        boxShadow: checked ? '0 0 10px rgba(89,217,179,.55)' : undefined
      }}
    />
  </button>
);

const FieldShell = ({ label, children, boxed = true }:{
  label: React.ReactNode; children: React.ReactNode; boxed?: boolean;
}) => (
  <div>
    <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize: 'var(--fz-label)', color: 'var(--text)' }}>
      {label}
    </label>
    {boxed ? (
      <div
        className="px-3 py-[10px] rounded-[var(--radius-inner)]"
        style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', boxShadow: 'var(--ctrl-shadow)' }}
      >
        {children}
      </div>
    ) : children}
  </div>
);

/* Solid select (menus are independent boxes; not transparent) */
function Select({ value, onChange, options, placeholder }:{
  value: string; onChange:(v:string)=>void; options: Opt[]; placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const boxRef = useRef<HTMLDivElement|null>(null);
  const inRef  = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{top:number;left:number;width:number;openUp:boolean}|null>(null);
  const [q, setQ] = useState('');

  const cur = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter(o => o.label.toLowerCase().includes(s)) : options;
  }, [options, q]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
    const openUp = r.bottom + 320 > window.innerHeight;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || boxRef.current?.contains(e.target as Node)) return;
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
        onClick={() => { setOpen(v => !v); setTimeout(()=>inRef.current?.focus(), 0); }}
        className="w-full flex items-center justify-between gap-3 px-3 rounded-[var(--radius-inner)] transition"
        style={{
          height: 'var(--control-h)', background: 'var(--ctrl-bg)',
          border: '1px solid var(--ctrl-border)', boxShadow: 'var(--ctrl-shadow)',
          color: 'var(--text)', fontSize: 'var(--fz-body)'
        }}
      >
        <span className="truncate">{cur ? cur.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={boxRef}
              className="fixed z-[9999] p-3 va-pop"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left, width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: 'var(--menu-bg)',
                border: '1px solid var(--menu-border)',
                borderRadius: 14,
                boxShadow: 'var(--menu-shadow)',
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
                style={{ background: 'var(--ctrl-bg)', border: '1px solid var(--ctrl-border)', boxShadow: 'var(--ctrl-shadow)', color: 'var(--text)' }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={inRef}
                  value={q}
                  onChange={(e)=>setQ(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
                />
              </div>

              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {filtered.map(o => (
                  <button
                    key={o.value}
                    disabled={o.disabled}
                    onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition flex items-center gap-2 disabled:opacity-60"
                    style={{ color: 'var(--text)', background:'transparent', border:'1px solid transparent', cursor:o.disabled?'not-allowed':'pointer' }}
                    onMouseEnter={(e)=>{ if(o.disabled) return; (e.currentTarget as HTMLButtonElement).style.background='rgba(89,217,179,.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(89,217,179,.35)'; }}
                    onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}
                  >
                    {o.disabled ? <Lock className="w-3.5 h-3.5" /> :
                      <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                    <span className="flex-1">{o.label}</span>
                    {o.note ? <span className="text-[11px]" style={{ color:'var(--text-muted)' }}>{o.note}</span> : null}
                  </button>
                ))}
                {filtered.length===0 && (
                  <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>
                )}
              </div>
            </div>, document.body)
        : null}
    </>
  );
}

/* ───────────────── Collapsible Section (header outside, no disappearance) ───────────────── */
function Section({
  title, icon, desc, children, defaultOpen = false
}:{
  title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<number>(0);

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    const measure = () => setH(el.scrollHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [children]);

  return (
    <div className="mb-[var(--s-6)]">
      {/* Header OUTSIDE the box */}
      <div className="w-full flex items-start justify-between mb-[var(--s-3)]">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-[var(--s-3)]" style={{ color: 'var(--text)' }}>
            <span className="inline-grid place-items-center w-7 h-7 rounded-full"
              style={{ background:'rgba(89,217,179,.12)', boxShadow:'0 0 0 1px rgba(89,217,179,.14) inset, 0 10px 24px rgba(89,217,179,.10)' }}>
              {icon}
            </span>
            <span className="font-semibold truncate" style={{ fontSize:'var(--fz-title)' }}>{title}</span>
          </div>
          {desc ? <div className="mt-1 text-xs" style={{ color:'var(--text-muted)' }}>{desc}</div> : null}
        </div>

        <button onClick={()=>setOpen(v=>!v)} className="px-2 py-1 rounded-md" style={{ color:'var(--text-muted)' }}>
          {open ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>
      </div>

      {/* Card */}
      <div className="rounded-[var(--radius-outer)]" style={{
        background:'var(--panel)', border:'1px solid var(--border-weak)',
        boxShadow: open ? 'var(--shadow-green)' : 'var(--shadow-green-soft)', overflow:'hidden'
      }}>
        {/* animated container — header remains above; content collapses only */}
        <div className="va-collapsing" style={{
          height: open ? h : 0,
          transition: 'height 240ms var(--ease), filter 240ms var(--ease), opacity 240ms var(--ease)',
          opacity: open ? 1 : .98, filter: open ? 'none' : 'blur(1px)'
        }}>
          <div ref={wrapRef} className="relative p-[var(--s-6)]">
            {/* subtle background glow */}
            <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[55%] h-[55%] rounded-full"
              style={{ background: 'radial-gradient(circle, var(--ring) 0%, transparent 70%)', filter:'blur(36px)' }} />
            {children}
          </div>
        </div>
      </div>

      {/* glow line visible when collapsed */}
      {!open && <div className="va-glow-line mt-[var(--s-3)]" />}
    </div>
  );
}

/* ───────────────── Page ───────────────── */
export default function VoiceAgentSection() {
  const [activeId, setActiveId] = useState<string>(() => { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; } });
  const [data, setData] = useState<AgentData>(() => (activeId ? load(activeId) : DEFAULT_AGENT));
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [toast, setToast] = useState<string>('');

  /* Keep rail stable; never clip when sections animate */
  useEffect(() => {
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setData(load(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  useEffect(() => { if (activeId) save(activeId, data); }, [activeId, data]);

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) => setData((p) => ({ ...p, [k]: v }));

  const modelOpts   = useMemo(()=>modelOptsFor(data.provider), [data.provider]);
  const dialectOpts = useMemo(()=>dialectsFor(data.asrLang), [data.asrLang]);
  const asrModelOpts= useMemo(()=>asrModelsFor(data.asrProvider), [data.asrProvider]);

  async function doSave(){ if(!activeId){setToast('Select or create an agent'); return;}
    setSaving(true); setToast('');
    try { await apiSave(activeId, data); setToast('Saved'); } catch { setToast('Save failed'); }
    finally { setSaving(false); setTimeout(()=>setToast(''), 1800); } }
  async function doPublish(){ if(!activeId){setToast('Select or create an agent'); return;}
    setPublishing(true); setToast('');
    try { await apiPublish(activeId); setToast('Published'); } catch { setToast('Publish failed'); }
    finally { setPublishing(false); setTimeout(()=>setToast(''), 1800); } }
  async function doCall(){ if(!activeId){setToast('Select or create an agent'); return;}
    setCalling(true); setToast('');
    try { await apiCallTest(activeId); setToast('Calling…'); } catch { setToast('Test call failed'); }
    finally { setCalling(false); setTimeout(()=>setToast(''), 2200); } }

  return (
    <section className="va-scope va-page">
      <Tokens />

      <div className="grid w-full" style={{ gridTemplateColumns:'260px 1fr' }}>
        <div className="border-r" style={{ borderColor: 'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]" style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)', color:'var(--text)' }}>
          {/* actions */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button onClick={doSave} disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button onClick={doPublish} disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)' }}>
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button onClick={doCall} disabled={calling}
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold select-none disabled:opacity-60"
              style={{ height:'var(--control-h)', padding:'0 18px', background: CTA, color:'#fff', boxShadow:'0 10px 24px rgba(89,217,179,.28)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" /> {calling ? 'Calling…' : 'Talk to Assistant'}
            </button>
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]" style={{ background:'rgba(89,217,179,.12)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.20) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* KPIs */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[12px] va-pop" style={{ background:'var(--panel)', border:'1px solid var(--border-weak)', boxShadow:'var(--shadow-green-soft)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[12px] va-pop" style={{ background:'var(--panel)', border:'1px solid var(--border-weak)', boxShadow:'var(--shadow-green-soft)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~1050 ms</div>
            </div>
          </div>

          {/* MODEL */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the assistant’s reasoning model and first message."
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <Select value={data.provider} onChange={(v)=>set('provider')(v as Provider)} options={providerOpts} />
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <Select value={data.model} onChange={set('model')} options={modelOpts} />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="First Message Mode" boxed={false}>
                <Select value={data.firstMode} onChange={set('firstMode')} options={firstMessageModes} />
              </FieldShell>
              <FieldShell label="First Message" boxed={false}>
                <input
                  className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3"
                  style={{ height:'var(--control-h)', background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)', fontSize:'var(--fz-body)' }}
                  value={data.firstMsg}
                  onChange={(e)=>set('firstMsg')(e.target.value)}
                />
              </FieldShell>
            </div>

            <div className="mt-[var(--s-4)]">
              <div className="flex items-center justify-between mb-[var(--s-2)]">
                <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                <button
                  className="inline-flex items-center gap-2 rounded-[10px] text-sm transition hover:-translate-y-[1px]"
                  style={{ height:36, padding:'0 12px', background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)' }}
                  onClick={()=>set('systemPrompt')(`${data.systemPrompt}\n\n# Improved by generator`) }
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3 py-[10px]"
                style={{ background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)', minHeight:130, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt}
                onChange={(e)=>set('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          {/* VOICE */}
          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose the TTS provider and voice."
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Voice Provider" boxed={false}>
                <Select value={data.ttsProvider} onChange={(v)=>set('ttsProvider')(v as AgentData['ttsProvider'])} options={ttsProviders} />
              </FieldShell>

              <FieldShell label="Voice" boxed={false}>
                {/* Only OpenAI voices for now (solid) */}
                <Select value={data.voiceId} onChange={set('voiceId')} options={openaiVoices} />
              </FieldShell>
            </div>

            <div className="mt-[var(--s-3)] text-xs" style={{ color:'var(--text-muted)' }}>
              Naturalness hint: voices render server-side; keep utterances short/specific for the most “human” cadence.
              (You can swap to ElevenLabs later and map a voiceId.)
            </div>
          </Section>

          {/* TRANSCRIBER */}
          <Section
            title="Transcriber"
            icon={<Timer className="w-4 h-4" style={{ color: CTA }} />}
            desc="Speech-to-text configuration for calls."
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <Select value={data.asrProvider} onChange={(v)=>set('asrProvider')(v as AsrProv)} options={asrProviders} />
              </FieldShell>
              <FieldShell label="Language" boxed={false}>
                <Select
                  value={data.asrLang}
                  onChange={(v)=>{
                    const lang = v as Lang;
                    set('asrLang')(lang);
                    if (lang !== 'en') set('asrDialect')('standard');
                  }}
                  options={asrLangs}
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="Dialect" boxed={false}>
                <Select value={data.asrDialect} onChange={(v)=>set('asrDialect')(v as Dialect)} options={dialectOpts} />
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <Select value={data.asrModel} onChange={set('asrModel')} options={asrModelOpts} />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-6)] mt-[var(--s-4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)' }}>Background Denoising Enabled</div>
                  <div className="text-xs" style={{ color:'var(--text-muted)' }}>Filter background noise while the user is talking.</div>
                </div>
                <Toggle checked={data.denoise} onChange={(v)=>set('denoise')(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)' }}>Use Numerals</div>
                  <div className="text-xs" style={{ color:'var(--text-muted)' }}>Convert numbers from words to digits in transcription.</div>
                </div>
                <Toggle checked={data.numerals} onChange={(v)=>set('numerals')(v)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="Confidence Threshold">
                <div className="flex items-center gap-[var(--s-3)]">
                  <input type="range" min={0} max={1} step={0.01}
                    value={data.confidence}
                    onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                    style={{ width:'100%' }} />
                  <div className="px-2.5 py-1.5 rounded-md text-xs" style={{ background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', minWidth:46, textAlign:'center' }}>
                    {data.confidence.toFixed(1)}
                  </div>
                </div>
              </FieldShell>
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}
