// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState, useLayoutEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket, Search,
} from 'lucide-react';

/* ---------------- rail (safe dynamic) ---------------- */
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

/* ---------------- constants (match Steps) ---------------- */
const ACTIVE_KEY = 'va:activeId';
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* ---------------- data types ---------------- */
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

/* ---------------- tiny toggle (kept) ---------------- */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999,
      justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, var(--brand) 18%, var(--vs-input-bg))' : 'var(--vs-input-bg)',
      border: '1px solid var(--vs-input-border)',
      boxShadow: 'var(--vs-input-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999,
        background: checked ? 'var(--brand)' : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)',
        boxShadow: checked ? '0 0 10px color-mix(in oklab, var(--brand) 55%, transparent)' : undefined
      }}
    />
  </button>
);

/* ---------------- reusable field shell (Step style) ---------------- */
const FieldShell = ({
  label, children, error
}: { label: React.ReactNode; children: React.ReactNode; error?: string }) => {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : 'var(--vs-input-border)';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{label}</label>
      <div
        className="rounded-2xl px-3 py-2.5"
        style={{ background:'var(--vs-input-bg)', border:`1px solid ${borderBase}`, boxShadow:'var(--vs-input-shadow)' }}
      >
        {children}
      </div>
      {error && <div className="mt-1 text-xs" style={{ color: 'rgba(255,138,138,0.95)' }}>{error}</div>}
    </div>
  );
};

/* ---------------- portal dropdown (same as Step components) ---------------- */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const [query, setQuery] = useState('');

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
    const viewH = window.innerHeight;
    const openUp = r.bottom + 320 > viewH;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[14px] text-sm transition"
        style={{
          background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)',
          boxShadow:'var(--vs-input-shadow)', color:'var(--text)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              className="va-portal fixed z-[9999] p-3"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: 'var(--vs-menu-bg)',
                border: '1px solid var(--vs-menu-border)',
                borderRadius: 20,
                boxShadow: '0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02)',
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)' }}
              >
                <Search className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
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
                    onClick={()=>{ onChange(o.value); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition"
                    style={{ background:'transparent', border:'1px solid transparent', color:'var(--text)' }}
                    onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(0,255,194,0.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(0,255,194,0.35)'; }}
                    onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}
                  >
                    <span className="flex-1 truncate">{o.label}</span>
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

/* ---------------- page ---------------- */
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

  /* option lists */
  const providers = useMemo(()=>['OpenAI','Anthropic','Google'].map(x=>({value:x,label:x})),[]);
  const models    = useMemo(()=>['GPT 4o Cluster','GPT-4o','GPT-4.1'].map(x=>({value:x,label:x})),[]);
  const firstModes= useMemo(()=>['Assistant speaks first','User speaks first','Silent until tool required'].map(x=>({value:x,label:x})),[]);
  const asrProv   = useMemo(()=>['Deepgram','Whisper','AssemblyAI'].map(x=>({value:x,label:x})),[]);
  const asrLangs  = useMemo(()=>['En','Multi','Es'].map(x=>({value:x,label:x})),[]);
  const asrModels = useMemo(()=>['Nova 2','Nova','Whisper Large-V3'].map(x=>({value:x,label:x})),[]);

  return (
    <section className="voice-agent-scope">
      {/* layout: rail + content with thin divider exactly like steps */}
      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns: '260px 1fr', background:'var(--bg)', color:'var(--text)' }}>
        <div className="border-r" style={{ borderColor:'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]">
          {/* actions */}
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm transition hover:-translate-y-[1px]"
              style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> Publish
            </button>
            <button
              className="inline-flex items-center gap-2 px-5 h-[40px] rounded-[18px] font-semibold select-none"
              style={{ background: BTN_GREEN, color:'#fff', boxShadow:'0 10px 24px rgba(16,185,129,.25)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
            >
              <Phone className="w-4 h-4" /> Talk to Assistant
            </button>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 md:grid-cols-2 mb-5">
            <div className="relative p-4 rounded-[20px]" style={{ background:'var(--vs-card)', border:'1px solid var(--vs-border)', boxShadow:'var(--vs-shadow)' }}>
              <div className="text-xs mb-1.5" style={{ color:'var(--text-muted)' }}>Cost</div>
              <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-4 rounded-[20px]" style={{ background:'var(--vs-card)', border:'1px solid var(--vs-border)', boxShadow:'var(--vs-shadow)' }}>
              <div className="text-xs mb-1.5" style={{ color:'var(--text-muted)' }}>Latency</div>
              <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>~1050 ms</div>
            </div>
          </div>

          {/* Main card with glow */}
          <div className="relative p-6 sm:p-8 space-y-6 rounded-[28px]"
               style={{ background:'var(--vs-card)', border:'1px solid var(--vs-border)', boxShadow:'var(--vs-shadow)' }}>
            <div
              aria-hidden
              className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
              style={{ background:'radial-gradient(circle, var(--vs-ring) 0%, transparent 70%)', filter:'blur(38px)' }}
            />

            {/* Section: Model */}
            <Accordion title="Model" icon={<Gauge className="w-4 h-4" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldShell label="Provider">
                  <StyledSelect value={data.provider} onChange={set('provider')} options={providers} />
                </FieldShell>
                <FieldShell label="Model">
                  <StyledSelect value={data.model} onChange={set('model')} options={models} />
                </FieldShell>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <FieldShell label="First Message Mode">
                  <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstModes} />
                </FieldShell>
                <FieldShell label="First Message">
                  <input
                    className="w-full bg-transparent outline-none text-[15px]"
                    style={{ color:'var(--text)' }}
                    value={data.firstMsg} onChange={(e)=>set('firstMsg')(e.target.value)}
                  />
                </FieldShell>
              </div>

              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] font-medium" style={{ color:'var(--text)' }}>System Prompt</label>
                  <button
                    className="inline-flex items-center gap-2 rounded-[18px] px-3 py-2 text-sm transition hover:-translate-y-[1px]"
                    style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', color:'var(--text)' }}
                  >
                    <Wand2 className="w-4 h-4" /> Generate
                  </button>
                </div>
                <div
                  className="rounded-2xl px-3 py-2.5"
                  style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)' }}
                >
                  <textarea
                    className="w-full bg-transparent outline-none text-[15px]"
                    style={{ color:'var(--text)', minHeight:130, lineHeight:1.45 }}
                    value={data.systemPrompt} onChange={(e)=>set('systemPrompt')(e.target.value)}
                  />
                </div>
              </div>
            </Accordion>

            {/* Section: Transcriber */}
            <Accordion title="Transcriber" icon={<Timer className="w-4 h-4" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldShell label="Provider">
                  <StyledSelect value={data.asrProvider} onChange={set('asrProvider')} options={asrProv} />
                </FieldShell>
                <FieldShell label="Language">
                  <StyledSelect value={data.asrLang} onChange={set('asrLang')} options={asrLangs} />
                </FieldShell>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <FieldShell label="Model">
                  <StyledSelect value={data.asrModel} onChange={set('asrModel')} options={asrModels} />
                </FieldShell>

                <FieldShell label="Confidence Threshold">
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={data.confidence}
                      onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                      style={{ width:'100%' }}
                    />
                    <div
                      className="px-2.5 py-1.5 rounded-md text-xs"
                      style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)', minWidth:46, textAlign:'center', color:'var(--text)' }}
                    >
                      {data.confidence.toFixed(1)}
                    </div>
                  </div>
                </FieldShell>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[13px]" style={{ color:'var(--text)' }}>Background Denoising Enabled</div>
                    <div className="text-xs" style={{ color:'var(--text-muted)' }}>Filter background noise while the user is talking.</div>
                  </div>
                  <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-[13px]" style={{ color:'var(--text)' }}>Use Numerals</div>
                    <div className="text-xs" style={{ color:'var(--text-muted)' }}>Convert numbers from words to digits in transcription.</div>
                  </div>
                  <Toggle checked={data.numerals} onChange={v=>set('numerals')(v)} />
                </div>
              </div>
            </Accordion>

            {/* Scoped tokens (IDENTICAL style family to StepV1/StepV2) */}
            <style jsx global>{`
              /* LIGHT */
              .voice-agent-scope{
                --vs-card: #ffffff;
                --vs-border: rgba(0,0,0,.10);
                --vs-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
                --vs-ring: rgba(0,255,194,.10);

                --vs-input-bg: #ffffff;
                --vs-input-border: rgba(0,0,0,.12);
                --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);
              }
              /* DARK */
              [data-theme="dark"] .voice-agent-scope{
                --vs-card:
                  radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
                  linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
                --vs-border: rgba(255,255,255,.08);
                --vs-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10);
                --vs-ring: rgba(0,255,194,.12);

                --vs-input-bg: #101314;
                --vs-input-border: rgba(255,255,255,.14);
                --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
              }

              /* Portal surfaces (dropdown menus) */
              .va-portal{
                --vs-menu-bg: #ffffff;
                --vs-menu-border: rgba(0,0,0,.10);
              }
              [data-theme="dark"] .va-portal{
                --vs-menu-bg: #101314;
                --vs-menu-border: rgba(255,255,255,.16);
              }
            `}</style>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- accordion (kept; header styled to match) ---------------- */
function Accordion({ title, icon, children }:{ title:string; icon:React.ReactNode; children:React.ReactNode }) {
  const [open,setOpen]=useState(true);
  return (
    <div>
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer rounded-[14px]"
        style={{ background:'transparent', color:'var(--text)' }}
        onClick={()=>setOpen(v=>!v)}
      >
        <div className="inline-flex items-center gap-2">
          <span
            className="inline-flex items-center gap-2 h-[28px] px-3 rounded-[10px] text-[12.5px] font-semibold"
            style={{ background:'var(--vs-input-bg)', border:'1px solid var(--vs-input-border)', boxShadow:'var(--vs-input-shadow)' }}
          >
            {icon}
          </span>
          <span className="font-semibold">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--text-muted)' }}/> :
                <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }}/>}
      </div>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
