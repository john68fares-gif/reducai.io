// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search,
} from 'lucide-react';

/* ───────────────────────────────── Dynamic rail ───────────────────────────────── */
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

/* ───────────────────────────────── Tokens / constants ───────────────────────────────── */
const ACTIVE_KEY   = 'va:activeId';
const CTA          = '#59d9b3';   // Talk button + accents
const CTA_HOVER    = '#54cfa9';

const RhythmAndTokens = () => (
  <style jsx global>{`
    /* spacing, radii, type */
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px;
      --radius-outer: 16px;       /* less rounded outer cards */
      --radius-inner: 12px;       /* inputs/selects */
      --control-h: 44px;

      --fz-title: 18px;
      --fz-sub: 15px;
      --fz-body: 14px;
      --fz-label: 12.5px;
      --lh-body: 1.45;

      /* BASE surfaces similar to sidebar/ChatGPT look */
      --va-surface: #0f1214;
      --va-surface-2: #101314;
      --va-input: #101314;
      --va-text: #eaf8f3;
      --va-muted: rgba(234,248,243,.66);

      /* Borders are nearly invisible; edges defined by shadows */
      --va-border: rgba(255,255,255,.03);

      /* Outside drop shadows with green tint */
      --va-shadow-outer: 0 28px 70px rgba(0,0,0,.55), 0 0 0 1px rgba(0,255,194,.06);
      --va-shadow-card: 0 16px 40px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.05);

      /* Menu */
      --va-menu-bg: #101314;
      --va-menu-border: rgba(255,255,255,.06);

      /* Motion */
      --ease: cubic-bezier(.22,.61,.36,1);
    }

    :root:not([data-theme="dark"]) .va-scope{
      /* light fallback if someone flips theme */
      --va-surface: #ffffff;
      --va-surface-2: #ffffff;
      --va-input: #ffffff;
      --va-text: #0e1213;
      --va-muted: rgba(14,18,19,.62);
      --va-border: rgba(0,0,0,.04);
      --va-shadow-outer: 0 28px 70px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.03);
      --va-shadow-card: 0 16px 40px rgba(0,0,0,.10), 0 0 0 1px rgba(0,0,0,.03);
      --va-menu-bg: #ffffff;
      --va-menu-border: rgba(0,0,0,.08);
    }

    /* tiny motion-blur pop for opening elements */
    @keyframes va-pop {
      from { opacity:.0; transform: translateY(6px) scale(.985); filter: blur(2px); }
      to   { opacity:1;  transform: translateY(0)   scale(1);     filter: blur(0); }
    }
    .va-pop { animation: va-pop 180ms var(--ease) both; }
  `}</style>
);

/* ───────────────────────────────── Types / storage ───────────────────────────────── */
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

/* ───────────────────────────────── Small building blocks ───────────────────────────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999,
      justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--va-input))' : 'var(--va-input)',
      border: '1px solid var(--va-border)',
      boxShadow: 'var(--va-shadow-card)'
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

/** Field label + optional wrapper.
 *  - For selects/inline inputs, pass boxed={false} to avoid double boxes. */
const FieldShell = ({
  label, children, error, boxed = true
}:{
  label: React.ReactNode; children: React.ReactNode; error?: string; boxed?: boolean;
}) => {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : 'var(--va-border)';
  return (
    <div>
      <label className="block mb-[var(--s-2)] font-medium"
             style={{ fontSize:'var(--fz-label)', color:'var(--va-text)' }}>{label}</label>

      {boxed ? (
        <div
          className="px-3 py-[10px] rounded-[var(--radius-inner)]"
          style={{ background:'var(--va-input)', border:`1px solid ${borderBase}`, boxShadow:'var(--va-shadow-card)' }}
        >
          {children}
        </div>
      ) : children}

      {error && <div className="mt-[6px] text-xs" style={{ color:'rgba(255,138,138,0.95)' }}>{error}</div>}
    </div>
  );
};

/* ChatGPT-style dropdown (solid surfaces, independent floating menu) */
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
      {/* Trigger (single box; solid; same height as inputs) */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="w-full flex items-center justify-between gap-3 px-3 rounded-[var(--radius-inner)] transition"
        style={{
          height:'var(--control-h)',
          background:'var(--va-input)', border:'1px solid var(--va-border)',
          boxShadow:'var(--va-shadow-card)', color:'var(--va-text)', fontSize:'var(--fz-body)'
        }}
      >
        <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color:'var(--va-muted)' }} />
      </button>

      {/* Independent floating menu */}
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
                background: 'var(--va-menu-bg)',
                border: '1px solid var(--va-menu-border)',
                borderRadius: 16,
                boxShadow: 'var(--va-shadow-outer)',
              }}
            >
              {/* search */}
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
                style={{ background:'var(--va-input)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-card)' }}
              >
                <Search className="w-4 h-4" style={{ color:'var(--va-muted)' }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e)=>setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color:'var(--va-text)' }}
                />
              </div>

              {/* options */}
              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {filtered.map(o => (
                  <button
                    key={o.value}
                    onClick={()=>{ onChange(o.value); setOpen(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition"
                    style={{ color:'var(--va-text)', background:'transparent', border:'1px solid transparent' }}
                    onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(89,217,179,0.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(89,217,179,0.35)'; }}
                    onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}
                  >
                    {o.label}
                  </button>
                ))}
                {filtered.length===0 && (
                  <div className="px-3 py-6 text-sm" style={{ color:'var(--va-muted)' }}>No matches.</div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}

/* ───────────────────────────────── Page ───────────────────────────────── */
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
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--va-text)' }}>
      <RhythmAndTokens />

      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Rail divider (thin) */}
        <div className="border-r" style={{ borderColor:'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* Content column */}
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]"
             style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>

          {/* Actions row */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              className="inline-flex items-center gap-2 rounded-[14px] px-4 text-sm transition hover:-translate-y-[1px]"
              style={{
                height:'var(--control-h)',
                background:'var(--va-input)', border:'1px solid var(--va-border)',
                boxShadow:'var(--va-shadow-card)', color:'var(--va-text)'
              }}
            >
              <Rocket className="w-4 h-4" /> Publish
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-[14px] font-semibold select-none"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#fff', boxShadow:'0 10px 24px rgba(89,217,179,.28)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" /> Talk to Assistant
            </button>
          </div>

          {/* KPIs */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[14px] va-pop"
                 style={{ background:'var(--va-surface)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-outer)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--va-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--va-text)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[14px] va-pop"
                 style={{ background:'var(--va-surface)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-outer)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--va-muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--va-text)' }}>~1050 ms</div>
            </div>
          </div>

          {/* Section: Model (title + icon outside, box below) */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect value={data.provider} onChange={set('provider')} options={providers} />
              </FieldShell>
              <FieldShell label="Model" boxed={false}>
                <StyledSelect value={data.model} onChange={set('model')} options={models} />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="First Message Mode" boxed={false}>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstModes} />
              </FieldShell>
              <FieldShell label="First Message" boxed={false}>
                {/* single box; same height as selects */}
                <input
                  className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3"
                  style={{
                    height:'var(--control-h)',
                    background:'var(--va-input)', border:'1px solid var(--va-border)',
                    boxShadow:'var(--va-shadow-card)', color:'var(--va-text)', fontSize:'var(--fz-body)'
                  }}
                  value={data.firstMsg} onChange={(e)=>set('firstMsg')(e.target.value)}
                />
              </FieldShell>
            </div>

            <div className="mt-[var(--s-4)]">
              <div className="flex items-center justify-between mb-[var(--s-2)]">
                <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                <button
                  className="inline-flex items-center gap-2 rounded-[12px] text-sm transition hover:-translate-y-[1px]"
                  style={{ height:36, padding:'0 12px',
                           background:'var(--va-input)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-card)', color:'var(--va-text)' }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              {/* single box (textarea), not double-wrapped */}
              <textarea
                className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3 py-[10px]"
                style={{ background:'var(--va-input)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-card)',
                         color:'var(--va-text)', minHeight:130, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt} onChange={(e)=>set('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          {/* Section: Transcriber */}
          <Section
            title="Transcriber"
            icon={<Timer className="w-4 h-4" style={{ color: CTA }} />}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <FieldShell label="Provider" boxed={false}>
                <StyledSelect value={data.asrProvider} onChange={set('asrProvider')} options={asrProv} />
              </FieldShell>
              <FieldShell label="Language" boxed={false}>
                <StyledSelect value={data.asrLang} onChange={set('asrLang')} options={asrLangs} />
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <FieldShell label="Model" boxed={false}>
                <StyledSelect value={data.asrModel} onChange={set('asrModel')} options={asrModels} />
              </FieldShell>

              <FieldShell label="Confidence Threshold" boxed>
                <div className="flex items-center gap-[var(--s-3)]">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={data.confidence}
                    onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                    style={{ width:'100%' }}
                  />
                  <div
                    className="px-2.5 py-1.5 rounded-md text-xs"
                    style={{ background:'var(--va-input)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-card)', minWidth:46, textAlign:'center', color:'var(--va-text)' }}
                  >
                    {data.confidence.toFixed(1)}
                  </div>
                </div>
              </FieldShell>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-6)] mt-[var(--s-4)]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)', color:'var(--va-text)' }}>Background Denoising Enabled</div>
                  <div className="text-xs" style={{ color:'var(--va-muted)' }}>Filter background noise while the user is talking.</div>
                </div>
                <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold" style={{ fontSize:'var(--fz-body)', color:'var(--va-text)' }}>Use Numerals</div>
                  <div className="text-xs" style={{ color:'var(--va-muted)' }}>Convert numbers from words to digits in transcription.</div>
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

/* ───────────────────────────────── Section shell (title & icon OUTSIDE) ───────────────────────────────── */
function Section({ title, icon, children }:{ title:string; icon:React.ReactNode; children:React.ReactNode }) {
  const [open,setOpen]=useState(true);
  return (
    <div className="mb-[var(--s-6)]">
      {/* Header line (outside) */}
      <button
        onClick={()=>setOpen(v=>!v)}
        className="w-full flex items-center justify-between mb-[var(--s-3)]"
        style={{ color:'var(--va-text)' }}
      >
        <span className="inline-flex items-center gap-[var(--s-3)]">
          {/* icon only — no box */}
          <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                style={{ background:'rgba(89,217,179,.12)', boxShadow:'0 0 0 1px rgba(89,217,179,.14) inset, 0 10px 24px rgba(89,217,179,.10)' }}>
            {icon}
          </span>
          <span className="font-semibold" style={{ fontSize:'var(--fz-title)' }}>{title}</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--va-muted)' }}/> :
                <ChevronDown className="w-4 h-4" style={{ color:'var(--va-muted)' }}/>}
      </button>

      {/* Card (solid, less rounded, outside shadow) */}
      {open && (
        <div className="rounded-[var(--radius-outer)] p-[var(--s-6)] va-pop"
             style={{ background:'var(--va-surface)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-outer)' }}>
          {children}
        </div>
      )}
    </div>
  );
}
