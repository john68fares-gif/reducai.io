// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search, Check, Lock, Mic2,
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
const BRAND      = '#59d9b3';           // CTA green
const BRAND_H    = '#54cfa9';

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      isolation:isolate;                      /* stop weird blending/transparency */
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px;
      --radius-outer: 14px;                   /* less rounded outer cards */
      --radius-inner: 12px;                   /* controls */
      --control-h: 44px;
      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);
      --brand: ${BRAND};

      /* Page + panels (ChatGPT-like dark) */
      --page-bg: #0b0e0f;
      --panel-bg: #101314;

      /* “almost 0px” borders */
      --panel-border: rgba(255,255,255,.04);
      --ctrl-border: rgba(255,255,255,.10);

      /* SOLID controls + menu */
      --ctrl-bg: #0e1112;
      --menu-bg: #101314;
      --menu-border: rgba(255,255,255,.12);

      /* Text */
      --text: #eaf8f3; --muted: rgba(234,248,243,.66);

      /* Shadows with green tint (outside) */
      --card-shadow: 0 26px 60px rgba(0,0,0,.55), 0 0 0 1px rgba(89,217,179,.10), 0 10px 22px rgba(89,217,179,.18);
      --menu-shadow: 0 28px 70px rgba(0,0,0,.55), 0 10px 26px rgba(0,0,0,.40), 0 0 0 1px rgba(89,217,179,.14);
      --ctrl-shadow: 0 16px 40px rgba(0,0,0,.45), 0 0 0 1px rgba(89,217,179,.06);
      --cta-shadow: 0 14px 34px rgba(89,217,179,.28);

      --ring: rgba(89,217,179,.10);
    }

    :root:not([data-theme="dark"]) .va-scope{
      --page-bg:#f6f8f9; --panel-bg:#fff; --panel-border:rgba(0,0,0,.06);
      --ctrl-bg:#fff; --ctrl-border:rgba(0,0,0,.10); --menu-bg:#fff; --menu-border:rgba(0,0,0,.10);
      --text:#0e1213; --muted:rgba(14,18,19,.62);
      --card-shadow: 0 28px 70px rgba(0,0,0,.14), 0 0 0 1px rgba(89,217,179,.08), 0 10px 22px rgba(89,217,179,.12);
      --menu-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
      --ctrl-shadow: 0 16px 40px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.03);
      --cta-shadow: 0 12px 28px rgba(89,217,179,.26);
    }

    /* extra: force SOLID dropdown menus even if global CSS tries to be fancy */
    .va-portal{ background:var(--menu-bg) !important; }

    @keyframes va-pop { from { opacity:0; transform: translateY(6px) scale(.985)} to { opacity:1; transform:none } }
    .va-pop { animation: va-pop 160ms var(--ease) both; }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type Provider = 'openai' | 'anthropic' | 'google';
type AsrProv  = 'deepgram' | 'whisper' | 'assemblyai';
type Lang     = 'en' | 'nl' | 'es' | 'de';
type Dialect  = 'en-US' | 'en-UK' | 'en-AU' | 'standard';

type AgentData = {
  /* Model */
  provider: Provider;
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  /* Voice */
  voiceProvider: 'openai' | 'elevenlabs';
  voiceId: string;
  voiceKey: string;

  /* Transcriber */
  asrProvider: AsrProv;
  asrLang: Lang;
  asrDialect: Dialect;
  asrModel: string;

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

  voiceProvider: 'openai',
  voiceId: 'alloy-en-us',
  voiceKey: 'voice:en-US:alloy',

  asrProvider: 'deepgram',
  asrLang: 'en',
  asrDialect: 'en-US',
  asrModel: 'Nova 2',

  denoise: false,
  numerals: false,
  confidence: 0.4,
};

const keyFor = (id:string) => `va:agent:${id}`;
const loadAgentData = (id: string): AgentData => {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => { try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {} };

/* ───────────────── Options ───────────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

const providerOpts: Opt[] = [
  { value:'openai',    label:'OpenAI' },
  { value:'anthropic', label:'Anthropic — coming soon', disabled:true, note:'soon' },
  { value:'google',    label:'Google — coming soon',    disabled:true, note:'soon' },
];

const modelOptsFor = (p: Provider): Opt[] =>
  p === 'openai'
    ? [{value:'GPT 4o Cluster',label:'GPT 4o Cluster'},{value:'GPT-4o',label:'GPT-4o'},{value:'GPT-4.1',label:'GPT-4.1'}]
    : [{ value:'coming', label:'Models coming soon', disabled:true }];

const firstMsgModes: Opt[] = [
  { value:'Assistant speaks first', label:'Assistant speaks first' },
  { value:'User speaks first',      label:'User speaks first' },
  { value:'Silent until tool required', label:'Silent until tool required' },
];

const voiceProviders: Opt[] = [
  { value:'openai',    label:'OpenAI' },
  { value:'elevenlabs',label:'ElevenLabs — coming soon', disabled:true, note:'soon' },
];

const openaiVoices: Opt[] = [
  { value:'alloy-en-us', label:'Alloy (American)' },
  { value:'verse-en-uk', label:'Verse (British)'  },
  { value:'coral-en-au', label:'Coral (Australian)' },
];

const asrProviders: Opt[] = [
  { value:'deepgram',   label:'Deepgram' },
  { value:'whisper',    label:'Whisper — coming soon',    disabled:true, note:'soon' },
  { value:'assemblyai', label:'AssemblyAI — coming soon', disabled:true, note:'soon' },
];

const asrModelsFor = (p: AsrProv): Opt[] =>
  p === 'deepgram' ? [{value:'Nova 2',label:'Nova 2'},{value:'Nova',label:'Nova'}]
                   : [{ value:'coming', label:'Models coming soon', disabled:true }];

const languages: Opt[] = [
  { value:'en', label:'English' },
  { value:'nl', label:'Dutch' },
  { value:'es', label:'Spanish' },
  { value:'de', label:'German' },
];
const dialectsFor = (lang: Lang): Opt[] =>
  lang === 'en'
    ? [{value:'en-US',label:'English — American'},{value:'en-UK',label:'English — British'},{value:'en-AU',label:'English — Australian'}]
    : [{ value:'standard', label:'Standard' }];

const voiceKeyFor = (lang: Lang, dial: Dialect, voiceId: string) =>
  `voice:${dial === 'standard' ? lang : dial}:${voiceId}`;

/* ───────────────── Building blocks ───────────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999, justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, var(--brand) 18%, var(--ctrl-bg))' : 'var(--ctrl-bg)',
      border: '1px solid var(--ctrl-border)', boxShadow: 'var(--ctrl-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999,
        background: checked ? 'var(--brand)' : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)',
        boxShadow: checked ? '0 0 10px rgba(89,217,179,.55)' : undefined
      }}
    />
  </button>
);

const FieldShell = ({ label, children, error, boxed = true }:{
  label: React.ReactNode; children: React.ReactNode; error?: string; boxed?: boolean;
}) => {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : 'var(--ctrl-border)';
  return (
    <div>
      <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>
        {label}
      </label>

      {boxed ? (
        <div
          className="px-3 py-[10px] rounded-[var(--radius-inner)]"
          style={{ background:'var(--ctrl-bg)', border:`1px solid ${borderBase}`, boxShadow:'var(--ctrl-shadow)' }}
        >
          {children}
        </div>
      ) : children}

      {error && <div className="mt-[6px] text-xs" style={{ color:'rgba(255,138,138,0.95)' }}>{error}</div>}
    </div>
  );
};

/* SOLID dropdown (portal) */
function StyledSelect({
  value, onChange, options, placeholder
}:{
  value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string;
}) {
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const portalRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top:number; left:number; width:number; openUp:boolean }|null>(null);
  const [query, setQuery] = useState('');

  const current  = options.find(o => o.value === value) || null;
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
          background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)',
          boxShadow:'var(--ctrl-shadow)', color:'var(--text)', fontSize:'var(--fz-body)'
        }}
      >
        <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--muted)' }} />
      </button>

      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              className="va-portal fixed z-[99999] p-3 va-pop"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                border: '1px solid var(--menu-border)',
                borderRadius: 14,
                boxShadow: 'var(--menu-shadow)'
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
                style={{ background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)' }}
              >
                <Search className="w-4 h-4" style={{ color:'var(--muted)' }} />
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
                    {o.note ? <span className="text-[11px]" style={{ color:'var(--muted)' }}>{o.note}</span> : null}
                  </button>
                ))}
                {filtered.length===0 && <div className="px-3 py-6 text-sm" style={{ color:'var(--muted)' }}>No matches.</div>}
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
  const [activeId, setActiveId] = useState<string>(() => { try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }});
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  useEffect(() => { if (activeId) saveAgentData(activeId, data); }, [activeId, data]);

  /* derive voiceKey when lang/dialect/voiceId changes */
  useEffect(() => {
    setData(prev => ({ ...prev, voiceKey: voiceKeyFor(prev.asrLang, prev.asrDialect, prev.voiceId) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.asrLang, data.asrDialect, data.voiceId]);

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  const modelOpts    = useMemo(()=>modelOptsFor(data.provider), [data.provider]);
  const dialectOpts  = useMemo(()=>dialectsFor(data.asrLang), [data.asrLang]);
  const asrModelOpts = useMemo(()=>asrModelsFor(data.asrProvider), [data.asrProvider]);

  const doSave    = async () => { setSaving(true);    setTimeout(()=>setSaving(false), 500); };
  const doPublish = async () => { setPublishing(true);setTimeout(()=>setPublishing(false), 600); };
  const doCall    = async () => { setCalling(true);   setTimeout(()=>setCalling(false), 900); };

  return (
    <section className="va-scope" style={{ background:'var(--page-bg)', color:'var(--text)' }}>
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
              style={{ height:'var(--control-h)', background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button
              onClick={doCall}
              disabled={calling}
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold select-none disabled:opacity-60"
              style={{ height:'var(--control-h)', padding:'0 18px', background:BRAND, color:'#fff', boxShadow:'var(--cta-shadow)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BRAND_H)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BRAND)}
            >
              <Phone className="w-4 h-4" /> {calling ? 'Calling…' : 'Talk to Assistant'}
            </button>
          </div>

          {/* KPIs */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[12px]"
                 style={{ background:'var(--panel-bg)', border:'1px solid var(--panel-border)', boxShadow:'var(--card-shadow)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[12px]"
                 style={{ background:'var(--panel-bg)', border:'1px solid var(--panel-border)', boxShadow:'var(--card-shadow)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~1050 ms</div>
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
                <StyledSelect value={data.provider} onChange={(v)=>set('provider')(v as Provider)} options={providerOpts}/>
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <StyledSelect value={data.model} onChange={set('model')} options={modelOpts}/>
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="First Message Mode" boxed={false}>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstMsgModes}/>
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
                  onClick={()=>set('systemPrompt')(`${data.systemPrompt}\n\n# Improved.`)}
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

          <Section
            title="Voice"
            subtitle="Choose the TTS provider and voice."
            icon={<Mic2 className="w-4 h-4" style={{ color: BRAND }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Voice Provider" boxed={false}>
                <StyledSelect value={data.voiceProvider} onChange={(v)=>set('voiceProvider')(v as 'openai'|'elevenlabs')} options={voiceProviders}/>
              </FieldShell>
              <FieldShell label="Voice" boxed={false}>
                <StyledSelect value={data.voiceId} onChange={(v)=>set('voiceId')(v)} options={openaiVoices}/>
              </FieldShell>
            </div>
            <div className="mt-[var(--s-4)] text-xs" style={{ color:'var(--muted)' }}>
              Current voice key: <span style={{ color:'var(--text)' }}>{data.voiceKey}</span>
            </div>
          </Section>

          <Section
            title="Transcriber"
            subtitle="Speech-to-text configuration for calls."
            icon={<Timer className="w-4 h-4" style={{ color: BRAND }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect value={data.asrProvider} onChange={(v)=>set('asrProvider')(v as AsrProv)} options={asrProviders}/>
              </FieldShell>
              <FieldShell label="Language" boxed={false}>
                <StyledSelect
                  value={data.asrLang}
                  onChange={(v)=>{ const lang = v as Lang; set('asrLang')(lang); if (lang !== 'en') set('asrDialect')('standard'); }}
                  options={languages}
                />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="Dialect" boxed={false}>
                <StyledSelect value={data.asrDialect} onChange={(v)=>set('asrDialect')(v as Dialect)} options={dialectOpts}/>
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <StyledSelect value={data.asrModel} onChange={set('asrModel')} options={asrModelOpts}/>
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-6)] mt-[var(--s-4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)'}}>Background Denoising Enabled</div>
                  <div className="text-xs" style={{ color:'var(--muted)' }}>Filter background noise while the user is talking.</div>
                </div>
                <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)'}}>Use Numerals</div>
                  <div className="text-xs" style={{ color:'var(--muted)' }}>Convert numbers from words to digits in transcription.</div>
                </div>
                <Toggle checked={data.numerals} onChange={v=>set('numerals')(v)} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="Confidence Threshold">
                <div className="flex items-center gap-[var(--s-3)]">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={data.confidence}
                    onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                    style={{ width:'100%' }}
                  />
                  <div className="px-2.5 py-1.5 rounded-md text-xs"
                       style={{ background:'var(--ctrl-bg)', border:'1px solid var(--ctrl-border)', boxShadow:'var(--ctrl-shadow)', minWidth:46, textAlign:'center' }}>
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

/* ───────────────── Section with header ABOVE card + smooth collapse ───────────────── */
function Section({
  title, subtitle, icon, children
}:{ title:string; subtitle?:string; icon:React.ReactNode; children:React.ReactNode }) {
  const [open,setOpen]=useState(true);
  const bodyRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<'auto'|number>('auto');

  useLayoutEffect(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    if (open) {
      const px = el.scrollHeight;
      setH(px);
      const t = setTimeout(()=>setH('auto'), 240);
      return () => clearTimeout(t);
    } else {
      const px = el.scrollHeight;
      setH(px);
      requestAnimationFrame(()=>setH(12)); // collapse to a thin band, not 0 (still visible)
    }
  }, [open, children]);

  return (
    <div className="mb-[var(--s-6)]">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-[var(--s-3)]">
        <div>
          <span className="inline-flex items-center gap-[var(--s-3)]">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                  style={{ background:'rgba(89,217,179,.12)', boxShadow:'0 0 0 1px rgba(89,217,179,.18) inset, var(--cta-shadow)' }}>
              {icon}
            </span>
            <span className="font-semibold" style={{ fontSize:'var(--fz-title)' }}>{title}</span>
          </span>
          {subtitle ? <div className="mt-1 text-xs" style={{ color:'var(--muted)' }}>{subtitle}</div> : null}
        </div>

        <button onClick={()=>setOpen(v=>!v)} className="px-2 py-1 rounded-md" aria-expanded={open}
                style={{ background:'transparent', color:'var(--muted)' }}>
          {open ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}
        </button>
      </div>

      {/* Card */}
      <div className="rounded-[var(--radius-outer)]"
           style={{ background:'var(--panel-bg)', border:'1px solid var(--panel-border)', boxShadow:'var(--card-shadow)', overflow:'hidden' }}>
        <div
          ref={bodyRef}
          style={{
            height: h==='auto' ? 'auto' : `${h}px`,
            transition: 'height 220ms var(--ease)'
          }}
        >
          <div className="relative p-[var(--s-6)]">
            {/* contained glow (won’t cover sidebar) */}
            <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[60%] h-[60%] rounded-full"
                 style={{ background:'radial-gradient(circle, var(--ring) 0%, transparent 70%)', filter:'blur(38px)' }} />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
