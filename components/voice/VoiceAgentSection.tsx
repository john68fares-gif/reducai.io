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

class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ===== Compact tokens ===== */
const GREEN = '#10b981';
const GREEN_HOVER = '#0ea473';
const ACTIVE_KEY  = 'va:activeId';

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
  systemPrompt: 'This is a blank template with minimal defaults, you can change the model, temperature, and messages.',
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

function LocalTokens() {
  return (
    <style>{`
      .va { --panel: rgba(13,15,17,0.92); --card: rgba(18,20,23,0.88);
            --border: rgba(106,247,209,0.18); --text: #E9FBF5; --muted: #9bb7ae; --fg:#E9FBF5; }
      .va { color: var(--fg); font-size:13px; }
      .va-panel{ background:var(--panel); border:1px solid var(--border); border-radius:24px;
                 box-shadow: inset 0 0 20px rgba(0,0,0,.28), 0 0 14px rgba(106,247,209,.05), 0 0 18px rgba(0,255,194,.05); }
      .va-card{ background:var(--card); border:1px solid var(--border); border-radius:14px;
                box-shadow: 0 14px 28px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06), 0 0 0 1px rgba(0,255,194,.05); }

      .input,.select,.textarea{
        width:100%; background:var(--card); border:1px solid var(--border); color:var(--fg);
        border-radius:12px; padding:0 .7rem; outline:none; font-size:13px;
      }
      .input,.select{ height:34px; }
      .textarea{ min-height:130px; padding:.6rem .7rem; line-height:1.45; font-size:13px; }

      .btn{
        height:34px; padding:0 .75rem; border-radius:12px; display:inline-flex; align-items:center; gap:.45rem;
        background:var(--card); color:var(--fg); border:1px solid var(--border); font-weight:600; font-size:13px;
        transition:transform .06s ease;
      }
      .btn:hover{ transform:translateY(-1px); }
      .btn-primary{
        height:34px; padding:0 .85rem; border-radius:14px; display:inline-flex; align-items:center; gap:.5rem;
        background:${GREEN}; border:1px solid ${GREEN}; color:#0b1210; font-weight:700; font-size:13px;
        box-shadow:0 8px 20px rgba(16,185,129,.20);
      }
      .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 10px 24px rgba(16,185,129,.28); }

      .kpi{ padding:12px; }
      .kpi-title{ font-size:11.5px; color:var(--muted); margin-bottom:4px; }
      .kpi-value{ font-size:17px; font-weight:800; }

      .label-xs{ font-size:11.5px; color:var(--muted); }
      .pill{
        height:30px; padding:0 .7rem; border-radius:9px;
        border:1px solid var(--border); background:var(--card); font-weight:650; font-size:12.5px;
        display:inline-flex; align-items:center; gap:.4rem;
      }
      .acc-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; }
      .acc-title{ display:flex; align-items:center; gap:8px; font-weight:700; font-size:13px; }
      .sep{ border-top:1px solid var(--border); }
      .row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      @media (max-width:980px){ .row{ grid-template-columns:1fr; } }

      .ico{ width:14px; height:14px; display:inline-block; }
    `}</style>
  );
}

/* Compact toggle */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="btn"
    style={{
      height:28, width:50, padding:'0 6px', borderRadius:999,
      justifyContent:'flex-start',
      background: checked ? 'rgba(16,185,129,.18)' : 'var(--card)',
      borderColor: checked ? GREEN : 'var(--border)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999, background: checked ? GREEN : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s ease',
        boxShadow: checked ? '0 0 8px rgba(16,185,129,.45)' : undefined
      }}
    />
  </button>
);

export default function VoiceAgentSection() {
  /* Active assistant id from rail */
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });

  /* Per-assistant data */
  const [data, setData] = useState<AgentData>(() => activeId ? loadAgentData(activeId) : DEFAULT_AGENT);

  /* Listen for rail selection changes */
  useEffect(() => {
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setActiveId(id);
    };
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  /* When active changes, load that assistant's config */
  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  /* Any edit saves to that assistant only */
  useEffect(() => {
    if (!activeId) return;
    saveAgentData(activeId, data);
  }, [activeId, data]);

  /* Shorthand setters */
  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  return (
    <div className="va w-full" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <LocalTokens />

      {/* layout: NARROWER rail + thinner white divider */}
      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns:'196px 1fr' }}>
        {/* LEFT rail */}
        <div className="border-r" style={{ borderColor:'rgba(255,255,255,.14)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* RIGHT content */}
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]">

          {/* header: only Publish + Talk to Assistant */}
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            <button className="btn">
              <Rocket className="ico" /> Publish
            </button>
            <button className="btn-primary">
              <Phone className="ico" /> Talk to Assistant
            </button>
          </div>

          {/* KPIs */}
          <div className="grid gap-3 md:grid-cols-2 mb-5">
            <div className="va-card kpi">
              <div className="kpi-title">Cost</div>
              <div className="kpi-value">~$0.1/min</div>
            </div>
            <div className="va-card kpi">
              <div className="kpi-title">Latency</div>
              <div className="kpi-value">~1050 ms</div>
            </div>
          </div>

          <div className="va-panel overflow-hidden">
            {/* Model */}
            <Accordion
              title="Model"
              icon={<Gauge className="ico" />}
              content={
                <div className="px-4 pb-4">
                  <div className="row">
                    <div>
                      <label className="label-xs">Provider</label>
                      <select className="select" value={data.provider} onChange={e=>set('provider')(e.target.value)}>
                        <option>OpenAI</option><option>Anthropic</option><option>Google</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">Model</label>
                      <select className="select" value={data.model} onChange={e=>set('model')(e.target.value)}>
                        <option>GPT 4o Cluster</option><option>GPT-4o</option><option>GPT-4.1</option>
                      </select>
                    </div>
                  </div>

                  <div className="row mt-2.5">
                    <div>
                      <label className="label-xs">First Message Mode</label>
                      <select className="select" value={data.firstMode} onChange={e=>set('firstMode')(e.target.value)}>
                        <option>Assistant speaks first</option><option>User speaks first</option><option>Silent until tool required</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">First Message</label>
                      <input className="input" value={data.firstMsg} onChange={e=>set('firstMsg')(e.target.value)} />
                    </div>
                  </div>

                  <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="label-xs">System Prompt</label>
                      <div className="flex items-center gap-2">
                        <button className="btn"><Wand2 className="ico"/> Generate</button>
                      </div>
                    </div>
                    <textarea className="textarea" value={data.systemPrompt} onChange={e=>set('systemPrompt')(e.target.value)} />
                  </div>
                </div>
              }
            />

            <div className="sep" />

            {/* Transcriber */}
            <Accordion
              title="Transcriber"
              icon={<Timer className="ico" />}
              content={
                <div className="px-4 pb-5">
                  <div className="row">
                    <div>
                      <label className="label-xs">Provider</label>
                      <select className="select" value={data.asrProvider} onChange={e=>set('asrProvider')(e.target.value)}>
                        <option>Deepgram</option><option>Whisper</option><option>AssemblyAI</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">Language</label>
                      <select className="select" value={data.asrLang} onChange={e=>set('asrLang')(e.target.value)}>
                        <option>En</option><option>Multi</option><option>Es</option>
                      </select>
                    </div>
                  </div>

                  <div className="row mt-2.5">
                    <div>
                      <label className="label-xs">Model</label>
                      <select className="select" value={data.asrModel} onChange={e=>set('asrModel')(e.target.value)}>
                        <option>Nova 2</option><option>Nova</option><option>Whisper Large-V3</option>
                      </select>
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="label-xs">Confidence Threshold</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={data.confidence}
                            onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                            style={{ width:'100%' }}
                          />
                          <div className="va-card px-2.5 py-1.5 rounded-md text-xs" style={{minWidth:46, textAlign:'center'}}>
                            {data.confidence.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[13px]">Background Denoising Enabled</div>
                        <div className="label-xs">Filter background noise while the user is talking.</div>
                      </div>
                      <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[13px]">Use Numerals</div>
                        <div className="label-xs">Convert numbers from words to digits in transcription.</div>
                      </div>
                      <Toggle checked={data.numerals} onChange={v=>set('numerals')(v)} />
                    </div>
                  </div>
                </div>
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small accordion helper (keeps file tidy) */
function Accordion({ title, icon, content }:{ title:string; icon:React.ReactNode; content:React.ReactNode }) {
  const [open,setOpen]=useState(true);
  return (
    <>
      <div className="acc-head" onClick={()=>setOpen(v=>!v)}>
        <div className="acc-title">
          <span className="pill" style={{height:26}}>{icon}</span>
          {title}
        </div>
        {open ? <ChevronUp className="ico" style={{ color:'var(--muted)' }}/> : <ChevronDown className="ico" style={{ color:'var(--muted)' }}/>}
      </div>
      {open && content}
    </>
  );
}
