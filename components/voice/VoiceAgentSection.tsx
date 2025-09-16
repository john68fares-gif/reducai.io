// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket } from 'lucide-react';

/* Safe dynamic rail */
const AssistantRail = dynamic(
  () =>
    import('@/components/voice/AssistantRail')
      .then(m => m.default ?? m)
      .catch(() => () => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

/* Tiny boundary */
class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* Global-token helpers (mirror AccountPage) */
const UI = {
  brand: 'var(--brand)',
  brandWeak: 'var(--brand-weak)',

  bg: 'var(--bg)',
  text: 'var(--text)',
  textMuted: 'var(--text-muted)',

  cardBg: 'var(--panel)',          // big shells
  cardBorder: '1px solid var(--border)',
  cardShadow: 'var(--shadow-soft)',

  subBg: 'var(--card)',            // inner cards/bands
  subBorder: '1px solid var(--border)',
  subShadow: 'var(--shadow-card)',

  ring: 'var(--ring)',
};

const ACTIVE_KEY = 'va:activeId';

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

function keyFor(id: string){ return `va:agent:${id}`; }
function loadAgentData(id: string): AgentData {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
}
function saveAgentData(id: string, data: AgentData){
  try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
}

/* Toggle (theme-aware) */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999,
      justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, var(--brand) 18%, var(--card))' : 'var(--card)',
      border: '1px solid',
      borderColor: checked ? 'color-mix(in oklab, var(--brand) 60%, var(--border))' : 'var(--border)',
      boxShadow: UI.subShadow
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

export default function VoiceAgentSection() {
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  /* listen for rail selection */
  useEffect(() => {
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  /* load per-assistant data */
  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  /* persist edits */
  useEffect(() => { if (activeId) saveAgentData(activeId, data); }, [activeId, data]);

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  /* UI controls share the same style as AccountPage */
  const ctrlCls = "w-full rounded-[10px] px-3 py-2 border outline-none";
  const ctrlStyle: React.CSSProperties = {
    background: UI.subBg,
    border: '1px solid var(--border)',
    color: 'var(--text)',
    boxShadow: UI.subShadow,
  };
  const selectCls = "appearance-none w-full rounded-[10px] px-3 py-2 border outline-none bg-no-repeat";
  const selectStyle: React.CSSProperties = {
    ...ctrlStyle,
    backgroundImage:
      'linear-gradient(45deg, transparent 50%, var(--text) 50%), linear-gradient(135deg, var(--text) 50%, transparent 50%)',
    backgroundPosition: 'calc(100% - 18px) 50%, calc(100% - 12px) 50%',
    backgroundSize: '6px 6px, 6px 6px',
  };

  return (
    <div className="w-full" style={{ background: UI.bg, color: UI.text }}>
      {/* Layout: rail + content */}
      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* LEFT rail with thin divider */}
        <div className="border-r" style={{ borderColor: 'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* RIGHT content */}
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]">
          {/* Actions */}
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border transition hover:-translate-y-[1px]"
              style={{ borderColor: 'var(--border)', background: UI.subBg, color: UI.text, boxShadow: UI.subShadow }}
            >
              <Rocket className="w-4 h-4" /> Publish
            </button>
            <button
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[10px] border font-semibold transition hover:-translate-y-[1px]"
              style={{
                borderColor: 'color-mix(in oklab, var(--brand) 35%, var(--border))',
                background: 'color-mix(in oklab, var(--brand) 20%, var(--card))',
                color: UI.text,
                boxShadow: '0 16px 36px rgba(0,0,0,.45)'
              }}
            >
              <Phone className="w-4 h-4" /> Talk to Assistant
            </button>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 md:grid-cols-2 mb-5">
            <section className="rounded-[18px] p-4" style={{ background: UI.cardBg, border: UI.cardBorder, boxShadow: UI.cardShadow }}>
              <div className="text-xs mb-1.5" style={{ color: UI.textMuted }}>Cost</div>
              <div className="text-lg font-semibold">~$0.1/min</div>
            </section>
            <section className="rounded-[18px] p-4" style={{ background: UI.cardBg, border: UI.cardBorder, boxShadow: UI.cardShadow }}>
              <div className="text-xs mb-1.5" style={{ color: UI.textMuted }}>Latency</div>
              <div className="text-lg font-semibold">~1050 ms</div>
            </section>
          </div>

          {/* Main panel */}
          <section
            className="rounded-[18px] overflow-hidden"
            style={{ background: UI.cardBg, border: UI.cardBorder, boxShadow: UI.cardShadow }}
          >
            {/* Model */}
            <Accordion
              title="Model"
              icon={<Gauge className="w-4 h-4" />}
              content={
                <div className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>Provider</label>
                      <select className={selectCls} style={selectStyle}
                              value={data.provider} onChange={e=>set('provider')(e.target.value)}>
                        <option>OpenAI</option><option>Anthropic</option><option>Google</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>Model</label>
                      <select className={selectCls} style={selectStyle}
                              value={data.model} onChange={e=>set('model')(e.target.value)}>
                        <option>GPT 4o Cluster</option><option>GPT-4o</option><option>GPT-4.1</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>First Message Mode</label>
                      <select className={selectCls} style={selectStyle}
                              value={data.firstMode} onChange={e=>set('firstMode')(e.target.value)}>
                        <option>Assistant speaks first</option>
                        <option>User speaks first</option>
                        <option>Silent until tool required</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>First Message</label>
                      <input className={ctrlCls} style={ctrlStyle}
                             value={data.firstMsg} onChange={e=>set('firstMsg')(e.target.value)} />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs" style={{ color: UI.textMuted }}>System Prompt</label>
                      <button
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] border transition hover:-translate-y-[1px]"
                        style={{ borderColor: 'var(--border)', background: UI.subBg, color: UI.text, boxShadow: UI.subShadow }}
                      >
                        <Wand2 className="w-4 h-4" /> Generate
                      </button>
                    </div>
                    <textarea
                      className="w-full rounded-[10px] px-3 py-2 border outline-none"
                      style={{ ...ctrlStyle, minHeight: 130, lineHeight: 1.45 }}
                      value={data.systemPrompt}
                      onChange={e=>set('systemPrompt')(e.target.value)}
                    />
                  </div>
                </div>
              }
            />

            <div style={{ borderTop: '1px solid var(--border)' }} />

            {/* Transcriber */}
            <Accordion
              title="Transcriber"
              icon={<Timer className="w-4 h-4" />}
              content={
                <div className="px-4 pb-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>Provider</label>
                      <select className={selectCls} style={selectStyle}
                              value={data.asrProvider} onChange={e=>set('asrProvider')(e.target.value)}>
                        <option>Deepgram</option><option>Whisper</option><option>AssemblyAI</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>Language</label>
                      <select className={selectCls} style={selectStyle}
                              value={data.asrLang} onChange={e=>set('asrLang')(e.target.value)}>
                        <option>En</option><option>Multi</option><option>Es</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>Model</label>
                      <select className={selectCls} style={selectStyle}
                              value={data.asrModel} onChange={e=>set('asrModel')(e.target.value)}>
                        <option>Nova 2</option><option>Nova</option><option>Whisper Large-V3</option>
                      </select>
                    </div>

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="text-xs mb-1 block" style={{ color: UI.textMuted }}>Confidence Threshold</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={data.confidence}
                            onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                            style={{ width:'100%' }}
                          />
                          <div
                            className="px-2.5 py-1.5 rounded-md text-xs"
                            style={{ background: UI.subBg, border: UI.subBorder, boxShadow: UI.subShadow, minWidth: 46, textAlign: 'center' }}
                          >
                            {data.confidence.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[13px]" style={{ color: UI.text }}>Background Denoising Enabled</div>
                        <div className="text-xs" style={{ color: UI.textMuted }}>Filter background noise while the user is talking.</div>
                      </div>
                      <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[13px]" style={{ color: UI.text }}>Use Numerals</div>
                        <div className="text-xs" style={{ color: UI.textMuted }}>Convert numbers from words to digits in transcription.</div>
                      </div>
                      <Toggle checked={data.numerals} onChange={v=>set('numerals')(v)} />
                    </div>
                  </div>
                </div>
              }
            />
          </section>
        </div>
      </div>

      {/* Local style for accordion header + pills (uses global tokens/shadows) */}
      <style jsx>{`
        .acc-head {
          display:flex; align-items:center; justify-content:space-between;
          padding: 14px 16px; cursor:pointer;
          background: var(--panel);
        }
        .acc-title { display:flex; align-items:center; gap:8px; font-weight:700; font-size:13px; color: var(--text); }
        .pill {
          display:inline-flex; align-items:center; gap:.4rem; height: 26px;
          padding: 0 .7rem; border-radius: 9px; font-size:12.5px; font-weight:650;
          background: var(--card); border: 1px solid var(--border); box-shadow: var(--shadow-card); color: var(--text);
        }
      `}</style>
    </div>
  );
}

/* Minimal accordion */
function Accordion({ title, icon, content }:{ title:string; icon:React.ReactNode; content:React.ReactNode }) {
  const [open,setOpen]=useState(true);
  return (
    <>
      <div className="acc-head" onClick={()=>setOpen(v=>!v)}>
        <div className="acc-title">
          <span className="pill">{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--text-muted)' }}/> :
                <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }}/>}
      </div>
      {open && content}
    </>
  );
}
