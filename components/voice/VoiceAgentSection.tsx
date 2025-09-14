// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useState } from 'react';
import {
  Bot, Rocket, Code2, Play, MessagesSquare, Phone,
  Sparkles, ChevronDown, ChevronRight, Wand2,
  Gauge, Timer, Database, Globe,
  Check, ChevronLeft, ChevronUp, ChevronRight as ChevronRightIcon,
} from 'lucide-react';

/* ============================================================================
   Local theme tokens (keeps it consistent with your Improve page)
   - Only primary actions are green.
============================================================================ */
const GREEN = '#10b981';
const GREEN_HOVER = '#0ea371';

function LocalTokens() {
  return (
    <style>{`
      .va * { box-sizing: border-box; }
      .va { --panel: rgba(13,15,17,0.92); --card: rgba(18,20,23,0.88);
            --border: rgba(106,247,209,0.18); --text: #E9FBF5; --muted: #9bb7ae; }
      .va{ color:var(--text); }
      .va-panel{ background:var(--panel); border:1px solid var(--border); border-radius:16px;
                 box-shadow: inset 0 0 22px rgba(0,0,0,.28), 0 0 18px rgba(106,247,209,.05), 0 0 22px rgba(0,255,194,.05); }
      .va-card{ background:var(--card); border:1px solid var(--border); border-radius:14px; }
      .va-sep{ border-top:1px solid var(--border); }

      .btn{ height:36px; padding:0 .8rem; border-radius:10px; display:inline-flex; align-items:center; gap:.5rem;
            background:var(--card); color:var(--text); border:1px solid var(--border); font-weight:600; }
      .btn-ghost{ background:transparent; }
      .btn-primary{ height:36px; padding:0 .9rem; border-radius:10px; display:inline-flex; align-items:center; gap:.5rem;
                    background:${GREEN}; border:1px solid ${GREEN}; color:#0a0e0c;
                    box-shadow:0 10px 24px rgba(16,185,129,.22); font-weight:800;
                    transition:background .18s ease, transform .05s ease, box-shadow .18s ease; }
      .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 12px 28px rgba(16,185,129,.32); }
      .btn-primary:active{ transform:translateY(1px); }

      .chip{ height:22px; padding:0 .55rem; border-radius:8px; display:inline-flex; align-items:center; gap:.35rem;
             background:rgba(255,255,255,.03); border:1px solid var(--border); font-size:12px; color:var(--muted); }

      .input, .select, .textarea {
        width:100%; background:var(--card); border:1px solid var(--border); color:var(--text);
        border-radius:10px; padding:.65rem .75rem; outline:none;
      }
      .select, .input{ height:40px; }
      .textarea{ min-height:160px; resize:vertical; line-height:1.5; }

      .row{ display:grid; grid-template-columns: 1fr 1fr; gap:12px; }
      @media (max-width: 860px){ .row{ grid-template-columns:1fr; } }

      .acc-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; }
      .acc-title{ display:flex; align-items:center; gap:10px; font-weight:700; font-size:14px; }
      .muted{ color:var(--muted); }
      .kpi{ padding:14px; }
      .kpi-title{ font-size:12.5px; color:var(--muted); margin-bottom:6px; }
      .kpi-value{ font-size:19px; font-weight:800; }
      .tab{ height:34px; padding:0 .9rem; display:inline-flex; align-items:center; gap:.5rem;
            border-radius:10px; border:1px solid var(--border); background:var(--card); color:var(--text); font-weight:650; }
      .tab.active{ outline:2px solid rgba(106,247,209,.28); }
    `}</style>
  );
}

/* Helpers */
const Chip = ({ label, dot }: { label:string; dot?:string }) => (
  <span className="chip">
    {dot ? <span style={{ width:7, height:7, borderRadius:9999, background:dot }} /> : null}
    {label}
  </span>
);

const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="btn"
    style={{
      height:28, padding:'0 6px', borderRadius:999,
      background: checked ? 'rgba(16,185,129,.18)' : 'var(--card)',
      borderColor: checked ? GREEN : 'var(--border)',
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999, background: checked ? GREEN : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?16:0}px)`, transition:'transform .18s ease',
        boxShadow: checked ? '0 0 10px rgba(16,185,129,.45)' : undefined
      }}
    />
  </button>
);

/* ============================================================================
   PAGE
============================================================================ */
export default function VoiceAgentSection() {
  const [tab, setTab] = useState<'Model'|'Voice'|'Transcriber'|'Tools'|'Analysis'|'Advanced'|'Widget'>('Model');

  // Accordions
  const [openModel, setOpenModel] = useState(true);
  const [openTranscriber, setOpenTranscriber] = useState(true);

  // Model form state (pure UI)
  const [provider, setProvider] = useState('OpenAI');
  const [model, setModel] = useState('GPT 4o Cluster');
  const [firstMode, setFirstMode] = useState('Assistant speaks first');
  const [firstMsg, setFirstMsg] = useState('Hello.');
  const [systemPrompt, setSystemPrompt] = useState(
    'This is a blank template with minimal defaults, you can change the model, temperature, and messages.'
  );

  // Transcriber state
  const [asrProvider, setAsrProvider] = useState('Deepgram');
  const [asrLang, setAsrLang] = useState('En');
  const [asrModel, setAsrModel] = useState('Nova 2');
  const [denoise, setDenoise] = useState(false);
  const [numerals, setNumerals] = useState(false);
  const [confidence, setConfidence] = useState(0.4);

  return (
    <div className="va mx-auto w-full max-w-[1400px] px-4 py-6">
      <LocalTokens />

      {/* Header: title + actions */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="tab active"><Bot size={16}/> New Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn"><Code2 size={16}/> Code</button>
          <button className="btn"><Play size={16}/> Test</button>
          <button className="btn"><MessagesSquare size={16}/> Chat</button>
          <button className="btn-primary"><Phone size={16}/> Talk to Assistant</button>
          <span className="tab">Published</span>
        </div>
      </div>

      {/* Top nav tabs + badges (vapi, deepgram, gpt4o, vapi web) */}
      <div className="mb-5 flex flex-wrap items-center gap-8">
        <div className="flex flex-wrap items-center gap-8">
          {(['Model','Voice','Transcriber','Tools','Analysis','Advanced','Widget'] as const).map(t => (
            <button
              key={t}
              className={`tab ${tab===t?'active':''}`}
              onClick={()=>setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Chip label="vapi" dot="#22d3ee" />
            <Chip label="deepgram" dot="#ff8e00" />
            <Chip label="gpt 4o" dot="#7c4dff" />
            <Chip label="vapi" dot="#22d3ee" />
            <Chip label="web" dot="#d946ef" />
          </div>
          <div className="flex items-center gap-2">
            <span className="muted text-sm">Web</span>
          </div>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="va-card kpi">
          <div className="kpi-title">Cost</div>
          <div className="kpi-value">~$0.1/min</div>
        </div>
        <div className="va-card kpi">
          <div className="kpi-title">Latency</div>
          <div className="kpi-value">~1050 ms</div>
        </div>
      </div>

      {/* CONTENT: show only Model / Transcriber like screenshots */}
      {tab === 'Model' && (
        <div className="va-panel">
          {/* MODEL ACCORDION */}
          <div className="acc-head" onClick={()=>setOpenModel(v=>!v)}>
            <div className="acc-title">
              <span className="tab" style={{height:30}}><Gauge size={14}/></span>
              Model
            </div>
            {openModel ? <ChevronUp size={16} className="muted"/> : <ChevronDown size={16} className="muted" />}
          </div>
          {openModel && (
            <div className="px-4 pb-4">
              <div className="row">
                <div>
                  <label className="muted text-[12.5px]">Provider</label>
                  <select className="select" value={provider} onChange={e=>setProvider(e.target.value)}>
                    <option>OpenAI</option>
                    <option>Anthropic</option>
                    <option>Google</option>
                  </select>
                </div>
                <div>
                  <label className="muted text-[12.5px]">Model</label>
                  <select className="select" value={model} onChange={e=>setModel(e.target.value)}>
                    <option>GPT 4o Cluster</option>
                    <option>GPT-4o</option>
                    <option>GPT-4.1</option>
                  </select>
                </div>
              </div>

              <div className="row" style={{ marginTop:12 }}>
                <div>
                  <label className="muted text-[12.5px]">First Message Mode</label>
                  <select className="select" value={firstMode} onChange={e=>setFirstMode(e.target.value)}>
                    <option>Assistant speaks first</option>
                    <option>User speaks first</option>
                    <option>Silent until tool required</option>
                  </select>
                </div>
                <div>
                  <label className="muted text-[12.5px]">First Message</label>
                  <input className="input" value={firstMsg} onChange={e=>setFirstMsg(e.target.value)} />
                </div>
              </div>

              <div style={{ marginTop:12 }}>
                <div className="flex items-center justify-between">
                  <label className="muted text-[12.5px]">System Prompt</label>
                  <div className="flex items-center gap-8">
                    <button className="btn"><Wand2 size={16}/> Generate</button>
                    <button className="btn-ghost btn"><ChevronRightIcon size={16}/> Expand</button>
                  </div>
                </div>
                <textarea
                  className="textarea"
                  value={systemPrompt}
                  onChange={e=>setSystemPrompt(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="va-sep" />

          {/* TRANSCRIBER ACCORDION */}
          <div className="acc-head" onClick={()=>setOpenTranscriber(v=>!v)}>
            <div className="acc-title">
              <span className="tab" style={{height:30}}><Timer size={14}/></span>
              Transcriber
            </div>
            {openTranscriber ? <ChevronUp size={16} className="muted"/> : <ChevronDown size={16} className="muted" />}
          </div>
          {openTranscriber && (
            <div className="px-4 pb-4">
              <div className="row">
                <div>
                  <label className="muted text-[12.5px]">Provider</label>
                  <select className="select" value={asrProvider} onChange={e=>setAsrProvider(e.target.value)}>
                    <option>Deepgram</option>
                    <option>Whisper</option>
                    <option>AssemblyAI</option>
                  </select>
                </div>
                <div>
                  <label className="muted text-[12.5px]">Language</label>
                  <select className="select" value={asrLang} onChange={e=>setAsrLang(e.target.value)}>
                    <option>En</option>
                    <option>Multi</option>
                    <option>Es</option>
                  </select>
                </div>
              </div>

              <div className="row" style={{ marginTop:12 }}>
                <div>
                  <label className="muted text-[12.5px]">Model</label>
                  <select className="select" value={asrModel} onChange={e=>setAsrModel(e.target.value)}>
                    <option>Nova 2</option>
                    <option>Nova</option>
                    <option>Whisper Large-V3</option>
                  </select>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="flex-1">
                    <label className="muted text-[12.5px]">Confidence Threshold</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={0} max={1} step={0.01}
                        value={confidence}
                        onChange={(e)=>setConfidence(parseFloat(e.target.value))}
                        style={{ width:'100%' }}
                      />
                      <div className="va-card px-2 py-1 rounded-md text-sm" style={{minWidth:54, textAlign:'center'}}>
                        {confidence.toFixed(1)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop:12 }} className="grid grid-cols-2 gap-12">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">Background Denoising Enabled</div>
                    <div className="muted text-xs">Filter background noise while the user is talking.</div>
                  </div>
                  <Toggle checked={denoise} onChange={setDenoise} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-sm">Use Numerals</div>
                    <div className="muted text-xs">Convert numbers from words to digits in transcription.</div>
                  </div>
                  <Toggle checked={numerals} onChange={setNumerals} />
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Placeholder panels for other tabs (kept minimal like screenshots) */}
      {tab !== 'Model' && (
        <div className="va-panel p-6">
          <div className="muted">The <strong>{tab}</strong> tab UI will live here. (Layout matches Vapi; content intentionally minimal to mirror the screenshots.)</div>
        </div>
      )}
    </div>
  );
}
