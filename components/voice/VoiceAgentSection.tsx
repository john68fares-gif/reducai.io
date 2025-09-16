// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search, Check, Lock,
} from 'lucide-react';

/* ───────────────── Dynamic rail ───────────────── */
const AssistantRail = dynamic(
  () =>
    import('@/components/voice/AssistantRail')
      .then(m => m.default ?? m)
      .catch(() => () => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ───────────────── Tokens ───────────────── */
const ACTIVE_KEY = 'va:activeId';
const CTA        = '#59d9b3';
const CTA_HOVER  = '#54cfa9';

/* Global rhythm + theme + solid portal tokens */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px;
      --radius-outer: 14px;      /* less rounded outer boxes */
      --radius-inner: 12px;      /* inner controls */
      --control-h: 44px;
      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      /* ChatGPT-ish dark panel w/ solid controls */
      --vs-card: #101314;
      --vs-border: rgba(255,255,255,.04); /* “almost 0px” look */
      --vs-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(89,217,179,.08);
      --vs-ring: rgba(89,217,179,.10);

      --vs-input-bg: #0e1112;
      --vs-input-border: rgba(255,255,255,.10);
      --vs-input-shadow: 0 16px 40px rgba(0,0,0,.45), 0 0 0 1px rgba(89,217,179,.05);

      --text: #eaf8f3; --text-muted: rgba(234,248,243,.66);

      --card-shadow-outer: 0 28px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(89,217,179,.08);
    }

    :root:not([data-theme="dark"]) .va-scope{
      --vs-card: #ffffff;
      --vs-border: rgba(0,0,0,.06);
      --vs-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
      --vs-ring: rgba(89,217,179,.10);
      --vs-input-bg: #ffffff;
      --vs-input-border: rgba(0,0,0,.10);
      --vs-input-shadow: 0 16px 40px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.03);
      --text: #0e1213; --text-muted: rgba(14,18,19,.62);
      --card-shadow-outer: 0 28px 70px rgba(0,0,0,.14), 0 0 0 1px rgba(89,217,179,.08);
    }

    /* SOLID portal for menus (no transparency) */
    .va-portal{
      --menu-bg: #0f1314;
      --menu-border: rgba(255,255,255,.12);
      --menu-shadow: 0 28px 70px rgba(0,0,0,.55), 0 10px 26px rgba(0,0,0,.40), 0 0 0 1px rgba(89,217,179,.10);
    }
    :root:not([data-theme="dark"]) .va-portal{
      --menu-bg: #ffffff;
      --menu-border: rgba(0,0,0,.10);
      --menu-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
    }

    @keyframes va-pop { from { opacity:0; transform: translateY(6px) scale(.985); filter: blur(2px); } to { opacity:1; transform:none; filter:none; } }
    @keyframes va-collapse { from { height: var(--from); } to { height: var(--to); } }
    .va-pop { animation: va-pop 160ms var(--ease) both; }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type AgentData = {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  /* Transcriber */
  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrLang: 'en' | 'nl' | 'es' | 'de';              // English, Dutch, Spanish, German
  asrDialect: 'en-US' | 'en-UK' | 'en-AU' | 'standard'; // English dialects or standard
  asrModel: string;

  /* Derived voice key you’ll later map to ElevenLabs */
  voiceKey: string;

  /* Flags */
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

  asrProvider: 'deepgram',
  asrLang: 'en',
  asrDialect: 'en-US',
  asrModel: 'Nova 2',

  voiceKey: 'voice:en-US:default',

  denoise: false,
  numerals: false,
  confidence: 0.4,
};

const ACTIVE_STORAGE_KEY = (id:string) => `va:agent:${id}`;
const loadAgentData = (id: string): AgentData => {
  try { const raw = localStorage.getItem(ACTIVE_STORAGE_KEY(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { localStorage.setItem(ACTIVE_STORAGE_KEY(id), JSON.stringify(data)); } catch {}
};

/* ───────────────── Backend helpers (stub endpoints you can wire) ───────────────── */
async function apiSave(agentId: string, payload: AgentData){
  const r = await fetch(`/api/voice/agent/${agentId}/save`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error('Save failed');
  return r.json();
}
async function apiPublish(agentId: string){
  const r = await fetch(`/api/voice/agent/${agentId}/publish`, { method: 'POST' });
  if (!r.ok) throw new Error('Publish failed');
  return r.json();
}
async function apiCallTest(agentId: string){
  const r = await fetch(`/api/voice/agent/${agentId}/call-test`, { method: 'POST' });
  if (!r.ok) throw new Error('Test call failed');
  return r.json();
}

/* ───────────────── Option sets (with “coming soon”) ───────────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI' },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon' },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon' },
];

const modelOptsFor = (provider: string): Opt[] => {
  if (provider === 'openai') {
    return [
      { value: 'GPT 4o Cluster', label: 'GPT 4o Cluster' },
      { value: 'GPT-4o',         label: 'GPT-4o' },
      { value: 'GPT-4.1',        label: 'GPT-4.1' },
    ];
  }
  // Coming soon providers show muted list
  return [{ value: 'coming', label: 'Models coming soon', disabled: true }];
};

const firstMessageModes: Opt[] = [
  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
  { value: 'User speaks first',      label: 'User speaks first' },
  { value: 'Silent until tool required', label: 'Silent until tool required' },
];

const asrProviders: Opt[] = [
  { value: 'deepgram',   label: 'Deepgram' },
  { value: 'whisper',    label: 'Whisper — coming soon', disabled: true, note: 'soon' },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true, note: 'soon' },
];

const asrModelsFor = (asr: string): Opt[] => {
  if (asr === 'deepgram') {
    return [
      { value: 'Nova 2', label: 'Nova 2' },
      { value: 'Nova',   label: 'Nova' },
    ];
  }
  return [{ value: 'coming', label: 'Models coming soon', disabled: true }];
};

const asrLanguages: Opt[] = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
];

/* For English, dialects are US/UK/AU. Others: Standard. */
const dialectsFor = (lang: string): Opt[] => {
  if (lang === 'en') {
    return [
      { value: 'en-US', label: 'English — American' },
      { value: 'en-UK', label: 'English — British' },
      { value: 'en-AU', label: 'English — Australian' },
    ];
  }
  return [{ value: 'standard', label: 'Standard' }];
};

/* Voice mapping (placeholder keys for ElevenLabs later) */
const voiceKeyFor = (lang: AgentData['asrLang'], dialect: AgentData['asrDialect']) => {
  if (lang === 'en') {
    if (dialect === 'en-UK') return 'voice:en-UK:default';
    if (dialect === 'en-AU') return 'voice:en-AU:default';
    return 'voice:en-US:default';
  }
  if (lang === 'nl') return 'voice:nl:standard';
  if (lang === 'es') return 'voice:es:standard';
  if (lang === 'de') return 'voice:de:standard';
  return 'voice:en-US:default';
};

/* ───────────────── Building blocks ───────────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999, justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--vs-input-bg))' : 'var(--vs-input-bg)',
      border: '1px solid var(--vs-input-border)', boxShadow: 'var(--vs-input-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999,
        background: checked ? CTA : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)',
        boxShadow: checked ? '0 0 10px rgba(89,217,179,.55)' : undefined
      }}
    />
  </button>
);

const FieldShell = ({ label, children, error, boxed = true }:{
  label: React.ReactNode; children: React.ReactNode; error?: string; boxed?: boolean;
}) => {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : 'var(--vs-input-border)';
  return (
    <div>
      <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>
        {label}
      </label>

      {boxed ? (
        <div
          className="px-3 py-[10px] rounded-[var(--radius-inner)]"
          style={{ background:'var(--vs-input-bg)', border:`1px solid ${borderBase}`, boxShadow:'var(--vs-input-shadow)' }}
        >
          {children}
        </div>
      ) : children}

      {error && <div className="mt-[6px] text-xs" style={{ color:'rgba(255,138,138,0.95)' }}>{error}</div>}
    </div>
  );
};

/* Solid portal dropdown w/ disabled options (“coming soon”) */
function StyledSelect({
  value, onChange, options, placeholder
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const portalRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top:number; left:number; width:number; openUp:boolean }|null>(null);
  const [query, setQuery] = useState('');

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
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
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="w-full flex items-center justify-between gap-3 px-3 rounded-[var(--radius-inner)] transition"
        style={{
          height:'var(--control-h)',
          background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)',
          boxShadow:'var(--vs-input-shadow)', color:'var(--text)', fontSize:'var(--fz-body)'
        }}
      >
        <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
      </button>

      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              className="va-portal fixed z-[9999] p-3 va-pop"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: 'var(--menu-bg)',
                border: '1px solid var(--menu-border)',
                borderRadius: 14,
                boxShadow: 'var(--menu-shadow)',
                backdropFilter: 'blur(2px)'
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
                style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)' }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e)=>setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color:'var(--text)' }}
                />
              </div>

              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {filtered.map(o => (
                  <button
                    key={o.value}
                    disabled={o.disabled}
                    onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition flex items-center gap-2 disabled:opacity-60"
                    style={{ color:'var(--text)', background:'transparent', border:'1px solid transparent', cursor:o.disabled?'not-allowed':'pointer' }}
                    onMouseEnter={(e)=>{ if (o.disabled) return; (e.currentTarget as HTMLButtonElement).style.background='rgba(89,217,179,0.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(89,217,179,0.35)'; }}
                    onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}
                  >
                    {o.disabled ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                    <span className="flex-1">{o.label}</span>
                    {o.note ? <span className="text-[11px]" style={{ color:'var(--text-muted)' }}>{o.note}</span> : null}
                  </button>
                ))}
                {filtered.length===0 && (
                  <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* ───────────────── Page ───────────────── */
export default function VoiceAgentSection() {
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [calling, setCalling] = useState(false);
  const [toast, setToast] = useState<string>('');

  /* listen for rail selection */
  useEffect(() => {
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  /* load that agent */
  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  /* persist to localStorage */
  useEffect(() => { if (activeId) saveAgentData(activeId, data); }, [activeId, data]);

  /* recompute voice key when lang/dialect changes */
  useEffect(() => {
    setData(prev => ({ ...prev, voiceKey: voiceKeyFor(prev.asrLang, prev.asrDialect) }));
  }, [data.asrLang, data.asrDialect]); // eslint-disable-line

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  const modelOpts = useMemo(()=>modelOptsFor(data.provider), [data.provider]);
  const dialectOpts = useMemo(()=>dialectsFor(data.asrLang), [data.asrLang]);
  const asrModelOpts = useMemo(()=>asrModelsFor(data.asrProvider), [data.asrProvider]);

  async function doSave(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setSaving(true); setToast('');
    try {
      await apiSave(activeId, data);
      setToast('Saved');
    } catch { setToast('Save failed'); }
    finally { setSaving(false); setTimeout(()=>setToast(''), 2000); }
  }
  async function doPublish(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setPublishing(true); setToast('');
    try { await apiPublish(activeId); setToast('Published'); }
    catch { setToast('Publish failed'); }
    finally { setPublishing(false); setTimeout(()=>setToast(''), 2000); }
  }
  async function doCallTest(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setCalling(true); setToast('');
    try { await apiCallTest(activeId); setToast('Calling…'); }
    catch { setToast('Test call failed'); }
    finally { setCalling(false); setTimeout(()=>setToast(''), 2500); }
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="border-r" style={{ borderColor:'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]"
             style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>

          {/* Actions */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button
              onClick={doCallTest}
              disabled={calling}
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold select-none disabled:opacity-60"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#fff', boxShadow:'0 10px 24px rgba(89,217,179,.28)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" /> {calling ? 'Calling…' : 'Talk to Assistant'}
            </button>
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                 style={{ background:'rgba(89,217,179,.12)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.20) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* KPI cards */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[12px] va-pop"
                 style={{ background:'var(--vs-card)', border:'1px solid var(--vs-border)', boxShadow:'var(--card-shadow-outer)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[12px] va-pop"
                 style={{ background:'var(--vs-card)', border:'1px solid var(--vs-border)', boxShadow:'var(--card-shadow-outer)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~1050 ms</div>
            </div>
          </div>

          {/* Sections */}
          <Section title="Model" icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect
                  value={data.provider}
                  onChange={(v)=>set('provider')(v as AgentData['provider'])}
                  options={providerOpts}
                />
              </FieldShell>

              <FieldShell label="Model" boxed={false}>
                <StyledSelect
                  value={data.model}
                  onChange={set('model')}
                  options={modelOpts}
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="First Message Mode" boxed={false}>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstMessageModes} />
              </FieldShell>
              <FieldShell label="First Message" boxed={false}>
                <input
                  className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3"
                  style={{ height:'var(--control-h)', background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)', fontSize:'var(--fz-body)' }}
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
                  style={{ height:36, padding:'0 12px', background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)' }}
                  onClick={()=>set('systemPrompt')(`${data.systemPrompt}\n\n# Improved by generator`) }
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3 py-[10px]"
                style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)', minHeight:130, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt}
                onChange={(e)=>set('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          <Section title="Transcriber" icon={<Timer className="w-4 h-4" style={{ color: CTA }} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect
                  value={data.asrProvider}
                  onChange={(v)=>set('asrProvider')(v as AgentData['asrProvider'])}
                  options={asrProviders}
                />
              </FieldShell>

              <FieldShell label="Language" boxed={false}>
                <StyledSelect
                  value={data.asrLang}
                  onChange={(v)=>{
                    const lang = v as AgentData['asrLang'];
                    set('asrLang')(lang);
                    // reset dialect if switching away from English
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
                  onChange={(v)=>set('asrDialect')(v as AgentData['asrDialect'])}
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
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)', color:'var(--text)' }}>Background Denoising Enabled</div>
                  <div className="text-xs" style={{ color:'var(--text-muted)' }}>Filter background noise while the user is talking.</div>
                </div>
                <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)', color:'var(--text)' }}>Use Numerals</div>
                  <div className="text-xs" style={{ color:'var(--text-muted)' }}>Convert numbers from words to digits in transcription.</div>
                </div>
                <Toggle checked={data.numerals} onChange={v=>set('numerals')(v)} />
              </div>
            </div>

            {/* Read-only, shows the voice key we’ll plug into ElevenLabs later */}
            <div className="mt-[var(--s-4)] text-xs" style={{ color:'var(--text-muted)' }}>
              Voice (auto): <span style={{ color:'var(--text)' }}>{data.voiceKey}</span>
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Section card with animated collapse (never unmounts) ───────────────── */
function Section({ title, icon, children }:{ title:string; icon:React.ReactNode; children:React.ReactNode }) {
  const [open,setOpen]=useState(true);
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<'auto'|number>('auto');

  useLayoutEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    if (open) {
      const ph = el.scrollHeight;
      setH(ph);
      const t = setTimeout(()=>setH('auto'), 200);
      return () => clearTimeout(t);
    } else {
      const ph = el.scrollHeight;
      setH(ph);
      requestAnimationFrame(()=>setH(0));
    }
  }, [open, children]);

  return (
    <div className="mb-[var(--s-6)]">
      {/* Title OUTSIDE the box, icon tinted green */}
      <div className="w-full flex items-center justify-between mb-[var(--s-3)]">
        <span className="inline-flex items-center gap-[var(--s-3)]" style={{ color:'var(--text)' }}>
          <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                style={{ background:'rgba(89,217,179,.12)', boxShadow:'0 0 0 1px rgba(89,217,179,.14) inset, 0 10px 24px rgba(89,217,179,.10)' }}>
            {icon}
          </span>
          <span className="font-semibold" style={{ fontSize:'var(--fz-title)' }}>{title}</span>
        </span>

        <button onClick={()=>setOpen(v=>!v)} className="px-2 py-1 rounded-md"
                style={{ background:'transparent', color:'var(--text-muted)' }}>
          {open ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>
      </div>

      {/* Outer card with tiny border + outer shadow */}
      <div className="rounded-[var(--radius-outer)]"
           style={{ background:'var(--vs-card)', border:'1px solid var(--vs-border)', boxShadow:'var(--card-shadow-outer)', overflow:'hidden' }}>
        <div
          ref={wrapRef}
          style={{
            height: h==='auto' ? 'auto' : `${h}px`,
            transition: 'height 220ms var(--ease), filter 220ms var(--ease), opacity 220ms var(--ease)',
            filter: open ? 'none' : 'blur(1px)', opacity: open ? 1 : 0.96
          }}
        >
          <div className="relative p-[var(--s-6)]">
            {/* subtle green glow background */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-[28%] -left-[28%] w-[60%] h-[60%] rounded-full"
              style={{ background:'radial-gradient(circle, var(--vs-ring) 0%, transparent 70%)', filter:'blur(38px)' }}
            />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
