// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search,
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

/* ───────────────── Tokens / constants ───────────────── */
const ACTIVE_KEY   = 'va:activeId';
const CTA          = '#59d9b3';
const CTA_HOVER    = '#54cfa9';

/** Page rhythm + tokens (ChatGPT-like greys + hairline borders removed) */
const Rhythm = () => (
  <style jsx global>{`
    .va-rhythm{
      /* spacing (4px base) */
      --s-2: 8px;
      --s-3: 12px;
      --s-4: 16px;
      --s-6: 24px;
      --s-8: 32px;

      /* radii */
      --radius-card: 16px;  /* outer boxes = less rounded */
      --radius-band: 14px;  /* inner controls retain comfort radius */
      --control-h: 44px;

      /* type */
      --fz-title: 20px;
      --fz-sub: 15px;
      --fz-body: 14px;
      --fz-label: 12.5px;
      --lh-body: 1.45;

      /* brand */
      --cta: ${CTA};
      --cta-shadow: 0 16px 40px rgba(89,217,179,.25);

      /* surface — ChatGPT-like grey */
      --page-bg: #f3f5f7;
      --card-bg: #ffffff;
      --near-zero-border: rgba(0,0,0,0); /* “almost 0px” → transparent but keeps layout */
      --control-bg: #ffffff;

      /* shadow (outside only, green-tinted) */
      --card-shadow: 0 24px 60px rgba(89,217,179,.18), 0 8px 22px rgba(0,0,0,.06);
      --menu-shadow: 0 28px 70px rgba(89,217,179,.20), 0 10px 26px rgba(0,0,0,.08);

      /* menu */
      --menu-bg: #ffffff;

      /* text */
      --t: #0b0c10;
      --tm: rgba(11,12,16,.65);
    }
    [data-theme="dark"] .va-rhythm{
      --page-bg:
        radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
        linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
      --card-bg: #101314;
      --control-bg: #101314;
      --menu-bg: #101314;
      --near-zero-border: rgba(255,255,255,0); /* keep transparent */
      --card-shadow: 0 36px 90px rgba(89,217,179,.22), 0 14px 34px rgba(0,0,0,.45);
      --menu-shadow: 0 36px 90px rgba(89,217,179,.24), 0 14px 34px rgba(0,0,0,.45);
      --t: #ffffff;
      --tm: rgba(255,255,255,.72);
    }

    /* subtle focus ring (green glow, but no visible border line) */
    .va-focus:focus{
      outline: none !important;
      box-shadow: 0 0 0 3px color-mix(in oklab, var(--cta) 28%, transparent);
    }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type AgentData = {
  provider: string;
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;
  asrProvider: string;
  asrLang: string;
  asrModel: string;
  denoise: boolean;
  numerals: boolean;
  confidence: number;
};

const DEFAULT_AGENT: AgentData = {
  provider: 'OpenAI',
  model: 'GPT 4o Cluster',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
    'This is a blank template with minimal defaults, you can change the model, temperature, and messages.',
  asrProvider: 'Deepgram',
  asrLang: 'En',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
  confidence: 0.4,
};

const keyFor = (id: string) => `va:agent:${id}`;
const loadAgentData = (id: string): AgentData => {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
};

/* ───────────────── Small building blocks ───────────────── */
/** Label above a control (no wrapper box here → avoids double boxes) */
const FieldLabel = ({ children }:{ children: React.ReactNode }) => (
  <label className="block mb-[var(--s-2)] font-medium"
         style={{ fontSize:'var(--fz-label)', color:'var(--t)' }}>
    {children}
  </label>
);

/** Single control box (used for inputs) — no extra inner wrapper */
const ControlBox = ({ children }:{ children: React.ReactNode }) => (
  <div
    className="rounded-[var(--radius-band)]"
    style={{
      background:'var(--control-bg)',
      border:'0.5px solid var(--near-zero-border)',   // almost 0px (invisible) — keeps geometry tight
      boxShadow:'var(--card-shadow)',                  // outside greenish shadow
      padding: '10px 12px',
    }}
  >
    {children}
  </div>
);

/** Toggle with green glow — matches new shadows */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center va-focus"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999,
      justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, var(--cta) 16%, var(--control-bg))' : 'var(--control-bg)',
      border: '0.5px solid var(--near-zero-border)',
      boxShadow: 'var(--card-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999,
        background: checked ? 'var(--cta)' : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)',
        boxShadow: '0 6px 16px rgba(89,217,179,.45)'
      }}
    />
  </button>
);

/* ChatGPT-style floating dropdown (independent menu, solid bg, green glow) */
function StyledSelect({
  value, onChange, options, placeholder
}:{
  value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[];
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
      {/* Single, solid trigger (no extra wrapper to avoid double box) */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="w-full flex items-center justify-between gap-3 px-3 rounded-[var(--radius-band)] va-focus transition"
        style={{
          height:'var(--control-h)',
          background:'var(--control-bg)',
          border:'0.5px solid var(--near-zero-border)',
          boxShadow:'var(--card-shadow)',
          color:'var(--t)',
          fontSize:'var(--fz-body)'
        }}
      >
        <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--tm)' }} />
      </button>

      {/* Independent floating menu */}
      <AnimatePresence>
        {open && rect && typeof document !== 'undefined'
          ? createPortal(
              <motion.div
                key="menu"
                ref={portalRef}
                initial={{ opacity: 0, y: rect.openUp ? -4 : 4, filter: 'blur(6px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: rect.openUp ? -4 : 4, filter: 'blur(6px)' }}
                transition={{ duration: 0.16, ease: 'easeOut' }}
                className="fixed z-[9999] p-3"
                style={{
                  top: rect.openUp ? rect.top - 8 : rect.top + 8,
                  left: rect.left,
                  width: rect.width,
                  transform: rect.openUp ? 'translateY(-100%)' : 'none',
                  background: 'var(--menu-bg)',
                  border: '0.5px solid var(--near-zero-border)',
                  borderRadius: '16px',
                  boxShadow: 'var(--menu-shadow)',
                }}
              >
                {/* search inside menu */}
                <div
                  className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                  style={{ background:'var(--control-bg)', border:'0.5px solid var(--near-zero-border)', boxShadow:'var(--card-shadow)', color:'var(--t)' }}
                >
                  <Search className="w-4 h-4" style={{ color:'var(--tm)' }} />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e)=>setQuery(e.target.value)}
                    placeholder="Type to filter…"
                    className="w-full bg-transparent outline-none text-sm"
                    style={{ color:'var(--t)' }}
                  />
                </div>

                {/* options */}
                <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                  {filtered.map(o => (
                    <button
                      key={o.value}
                      onClick={()=>{ onChange(o.value); setOpen(false); }}
                      className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition"
                      style={{ color:'var(--t)', background:'transparent', border:'0.5px solid transparent' }}
                      onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(89,217,179,0.12)'; }}
                      onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; }}
                    >
                      {o.label}
                    </button>
                  ))}
                  {filtered.length===0 && (
                    <div className="px-3 py-6 text-sm" style={{ color:'var(--tm)' }}>No matches.</div>
                  )}
                </div>
              </motion.div>,
              document.body
            )
          : null}
      </AnimatePresence>
    </>
  );
}

/* ───────────────── Page ───────────────── */
export default function VoiceAgentSection() {
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

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

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  /* options */
  const providers = useMemo(()=>['OpenAI','Anthropic','Google'].map(x=>({value:x,label:x})),[]);
  const models    = useMemo(()=>['GPT 4o Cluster','GPT-4o','GPT-4.1'].map(x=>({value:x,label:x})),[]);
  const firstModes= useMemo(()=>['Assistant speaks first','User speaks first','Silent until tool required'].map(x=>({value:x,label:x})),[]);
  const asrProv   = useMemo(()=>['Deepgram','Whisper','AssemblyAI'].map(x=>({value:x,label:x})),[]);
  const asrLangs  = useMemo(()=>['En','Multi','Es'].map(x=>({value:x,label:x})),[]);
  const asrModels = useMemo(()=>['Nova 2','Nova','Whisper Large-V3'].map(x=>({value:x,label:x})),[]);

  return (
    <section className="va-rhythm" style={{ background:'var(--page-bg)', color:'var(--t)' }}>
      <Rhythm />

      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Rail with thin divider */}
        <div className="border-r" style={{ borderColor:'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* Content column */}
        <div className="px-3 md:px-5 lg:px-6 py-6 mx-auto w-full max-w-[1160px]"
             style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>

          {/* Actions row */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              className="inline-flex items-center gap-2 rounded-[16px] px-4 text-sm transition hover:-translate-y-[1px] va-focus"
              style={{
                height:'var(--control-h)',
                background:'var(--control-bg)', border:'0.5px solid var(--near-zero-border)',
                boxShadow:'var(--card-shadow)', color:'var(--t)'
              }}
            >
              <Rocket className="w-4 h-4" /> Publish
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-[16px] font-semibold select-none va-focus"
              style={{ height:'var(--control-h)', padding:'0 18px', background:'var(--cta)', color:'#fff', boxShadow:'var(--cta-shadow)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" /> Talk to Assistant
            </button>
          </div>

          {/* KPIs */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[14px]"
                 style={{ background:'var(--card-bg)', border:'0.5px solid var(--near-zero-border)', boxShadow:'var(--card-shadow)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--tm)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--t)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[14px]"
                 style={{ background:'var(--card-bg)', border:'0.5px solid var(--near-zero-border)', boxShadow:'var(--card-shadow)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--tm)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--t)' }}>~1050 ms</div>
            </div>
          </div>

          {/* MODEL */}
          <Section title="Model" icon={<Gauge className="w-4 h-4" style={{ color:'var(--cta)' }} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <div>
                <FieldLabel>Provider</FieldLabel>
                <StyledSelect value={data.provider} onChange={set('provider')} options={providers} />
              </div>
              <div>
                <FieldLabel>Model</FieldLabel>
                <StyledSelect value={data.model} onChange={set('model')} options={models} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <div>
                <FieldLabel>First Message Mode</FieldLabel>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstModes} />
              </div>
              <div>
                <FieldLabel>First Message</FieldLabel>
                {/* single control, same height as selects */}
                <div
                  className="rounded-[var(--radius-band)] va-focus"
                  style={{ background:'var(--control-bg)', border:'0.5px solid var(--near-zero-border)', boxShadow:'var(--card-shadow)' }}
                >
                  <input
                    className="w-full bg-transparent outline-none"
                    style={{ color:'var(--t)', height:'var(--control-h)', padding:'0 12px', fontSize:'var(--fz-body)' }}
                    value={data.firstMsg} onChange={(e)=>set('firstMsg')(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-[var(--s-4)]">
              <div className="flex items-center justify-between mb-[var(--s-2)]">
                <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                <button
                  className="inline-flex items-center gap-2 rounded-[14px] text-sm transition hover:-translate-y-[1px] va-focus"
                  style={{ height:'var(--control-h)', padding:'0 14px',
                           background:'var(--control-bg)', border:'0.5px solid var(--near-zero-border)', boxShadow:'var(--card-shadow)', color:'var(--t)' }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <ControlBox>
                <textarea
                  className="w-full bg-transparent outline-none"
                  style={{ color:'var(--t)', minHeight:130, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                  value={data.systemPrompt} onChange={(e)=>set('systemPrompt')(e.target.value)}
                />
              </ControlBox>
            </div>
          </Section>

          {/* TRANSCRIBER */}
          <Section title="Transcriber" icon={<Timer className="w-4 h-4" style={{ color:'var(--cta)' }} />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <div>
                <FieldLabel>Provider</FieldLabel>
                <StyledSelect value={data.asrProvider} onChange={set('asrProvider')} options={asrProv} />
              </div>
              <div>
                <FieldLabel>Language</FieldLabel>
                <StyledSelect value={data.asrLang} onChange={set('asrLang')} options={asrLangs} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <div>
                <FieldLabel>Model</FieldLabel>
                <StyledSelect value={data.asrModel} onChange={set('asrModel')} options={asrModels} />
              </div>

              <div>
                <FieldLabel>Confidence Threshold</FieldLabel>
                <div className="flex items-center gap-[var(--s-3)]">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={data.confidence}
                    onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                    style={{ width:'100%' }}
                  />
                  <div
                    className="px-2.5 py-1.5 rounded-md text-xs"
                    style={{ background:'var(--control-bg)', border:'0.5px solid var(--near-zero-border)', boxShadow:'var(--card-shadow)', minWidth:46, textAlign:'center', color:'var(--t)' }}
                  >
                    {data.confidence.toFixed(1)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-6)] mt-[var(--s-4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)', color:'var(--t)' }}>Background Denoising Enabled</div>
                  <div className="text-xs" style={{ color:'var(--tm)' }}>Filter background noise while the user is talking.</div>
                </div>
                <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)', color:'var(--t)' }}>Use Numerals</div>
                  <div className="text-xs" style={{ color:'var(--tm)' }}>Convert numbers from words to digits in transcription.</div>
                </div>
                <Toggle checked={data.numerals} onChange={v=>set('numerals')(v)} />
              </div>
            </div>
          </Section>
        </div>
      </div>
    </section>
  );
}

/* ───────────────── Section (title outside card + motion) ───────────────── */
function Section({ title, icon, children }:{
  title:string; icon:React.ReactNode; children:React.ReactNode;
}) {
  const [open,setOpen]=useState(true);
  return (
    <div className="mb-[var(--s-6)]">
      {/* Title row outside the card, icon in green, no chip */}
      <button
        onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between mb-[var(--s-3)]"
        style={{ color:'var(--t)' }}
      >
        <span className="inline-flex items-center gap-[var(--s-3)]">
          <span className="inline-flex items-center justify-center w-7 h-7">
            {icon}
          </span>
          <span className="font-semibold" style={{ fontSize:'var(--fz-title)', lineHeight:1.2 }}>{title}</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--tm)' }}/> :
                <ChevronDown className="w-4 h-4" style={{ color:'var(--tm)' }}/>}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -6, filter: 'blur(6px)' }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="rounded-[var(--radius-card)]"
            style={{
              background:'var(--card-bg)',
              border:'0.5px solid var(--near-zero-border)',
              boxShadow:'var(--card-shadow)',
              padding: 'var(--s-6)',
            }}
          >
            {/* subtle green glow spot */}
            <div
              aria-hidden
              className="pointer-events-none absolute -mt-10 -ml-10 w-[60%] h-[60%] rounded-full"
              style={{ background:'radial-gradient(circle, color-mix(in oklab, var(--cta) 24%, transparent) 0%, transparent 70%)', filter:'blur(40px)' }}
            />
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
