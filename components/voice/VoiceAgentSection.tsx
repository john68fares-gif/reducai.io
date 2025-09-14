// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { Bot, Code2, Play, MessagesSquare, Phone, Wand2, ChevronDown, ChevronUp, Gauge, Timer } from 'lucide-react';

/* ---- Dynamically load AssistantRail to avoid client-side crashes ---- */
const AssistantRail = dynamic(
  () => import('@/components/voice/AssistantRail').then(m => m.default ?? m),
  {
    ssr: false,
    loading: () => (
      <div className="px-3 py-4 text-sm opacity-70" style={{ color: 'var(--text)' }}>
        Loading assistants…
      </div>
    ),
  }
);

/* ===== Tokens (match api-keys.tsx sizes & feel) ===== */
const GREEN = '#10b981';
const GREEN_HOVER = '#0ea473';

function LocalTokens() {
  return (
    <style>{`
      .va { --panel: rgba(13,15,17,0.92); --card: rgba(18,20,23,0.88);
            --border: rgba(106,247,209,0.18); --text: #E9FBF5; --muted: #9bb7ae; }
      .va { color: var(--text); }
      .va-panel{ background:var(--panel); border:1px solid var(--border); border-radius:30px;
                 box-shadow: inset 0 0 22px rgba(0,0,0,.28), 0 0 18px rgba(106,247,209,.05), 0 0 22px rgba(0,255,194,.05); }
      .va-card{ background:var(--card); border:1px solid var(--border); border-radius:20px;
                box-shadow: 0 16px 36px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07), 0 0 0 1px rgba(0,255,194,.05); }
      .input,.select,.textarea{ width:100%; background:var(--card); border:1px solid var(--border); color:var(--text);
                                border-radius:14px; padding:0 .9rem; outline:none; font-size:14px; }
      .input,.select{ height:46px; }
      .textarea{ min-height:160px; padding:.8rem .9rem; resize:vertical; line-height:1.5; }
      .btn{ height:46px; padding:0 1rem; border-radius:14px; display:inline-flex; align-items:center; gap:.55rem;
            background:var(--card); color:var(--text); border:1px solid var(--border); font-weight:600; font-size:14px; transition:transform .06s ease; }
      .btn:hover{ transform:translateY(-1px); }
      .btn-primary{ height:46px; padding:0 1.1rem; border-radius:18px; display:inline-flex; align-items:center; gap:.6rem;
                    background:${GREEN}; border:1px solid ${GREEN}; color:#fff; font-weight:700; box-shadow:0 10px 24px rgba(16,185,129,.22); }
      .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 12px 28px rgba(16,185,129,.32); }
      .kpi{ padding:16px; } .kpi-title{ font-size:12.5px; color:var(--muted); margin-bottom:6px; } .kpi-value{ font-size:19px; font-weight:800; }
      .label-xs{ font-size:12.5px; color:var(--muted); }
      .pill{ height:34px; padding:0 .9rem; border-radius:10px; border:1px solid var(--border); background:var(--card); font-weight:650; }
      .acc-head{ display:flex; align-items:center; justify-content:space-between; padding:16px 18px; cursor:pointer; }
      .acc-title{ display:flex; align-items:center; gap:10px; font-weight:700; font-size:14px; }
      .sep{ border-top:1px solid var(--border); }
      .row{ display:grid; grid-template-columns:1fr 1fr; gap:12px; }
      @media (max-width:980px){ .row{ grid-template-columns:1fr; } }
    `}</style>
  );
}

const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="btn"
    style={{ height:34, padding:'0 6px', borderRadius:999, background: checked ? 'rgba(16,185,129,.18)' : 'var(--card)', borderColor: checked ? GREEN : 'var(--border)', width:56, justifyContent:'flex-start' }}
    aria-pressed={checked}
  >
    <span style={{ width:22, height:22, borderRadius:999, background: checked ? GREEN : 'rgba(255,255,255,.12)', transform:`translateX(${checked?22:0}px)`, transition:'transform .18s ease', boxShadow: checked ? '0 0 10px rgba(16,185,129,.45)' : undefined }} />
  </button>
);

export default function VoiceAgentSection() {
  const [openModel, setOpenModel] = useState(true);
  const [openTranscriber, setOpenTranscriber] = useState(true);

  const [provider, setProvider] = useState('OpenAI');
  const [model, setModel] = useState('GPT 4o Cluster');
  const [firstMode, setFirstMode] = useState('Assistant speaks first');
  const [firstMsg, setFirstMsg] = useState('Hello.');
  const [systemPrompt, setSystemPrompt] = useState('This is a blank template with minimal defaults, you can change the model, temperature, and messages.');

  const [asrProvider, setAsrProvider] = useState('Deepgram');
  the [asrLang, setAsrLang] = useState('En');
  const [asrModel, setAsrModel] = useState('Nova 2');
  const [denoise, setDenoise] = useState(false);
  const [numerals, setNumerals] = useState(false);
  const [confidence, setConfidence] = useState(0.4);

  return (
    <div className="va w-full" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <LocalTokens />
      <div className="grid w-full" style={{ gridTemplateColumns:'312px 1fr' }}>
        {/* Left: Assistant Rail (now safe to mount) */}
        <div className="border-r" style={{ borderColor:'var(--border)' }}>
          <AssistantRail />
        </div>

        {/* Right: Main */}
        <div className="px-4 md:px-6 lg:px-8 py-6 mx-auto w-full max-w-[1180px]">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="pill"><Bot size={16}/> Voice Studio</span>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn"><Code2 size={16}/> Code</button>
              <button className="btn"><Play size={16}/> Test</button>
              <button className="btn"><MessagesSquare size={16}/> Chat</button>
              <button className="btn-primary"><Phone size={16}/> Talk to Assistant</button>
              <span className="pill">Published</span>
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-8">
            <div className="flex flex-wrap items-center gap-8">
              <span className="pill">Model</span>
              <span className="pill">Voice</span>
              <span className="pill">Transcriber</span>
              <span className="pill">Tools</span>
              <span className="pill">Analysis</span>
              <span className="pill">Advanced</span>
              <span className="pill">Widget</span>
            </div>
            <div className="flex items-center gap-2"><span className="label-xs">Web</span></div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="va-card kpi"><div className="kpi-title">Cost</div><div className="kpi-value">~$0.1/min</div></div>
            <div className="va-card kpi"><div className="kpi-title">Latency</div><div className="kpi-value">~1050 ms</div></div>
          </div>

          <div className="va-panel overflow-hidden">
            <div className="acc-head" onClick={()=>setOpenModel(v=>!v)}>
              <div className="acc-title"><span className="pill" style={{height:30}}><Gauge size={14}/></span>Model</div>
              {openModel ? <ChevronUp size={18} style={{ color:'var(--muted)' }}/> : <ChevronDown size={18} style={{ color:'var(--muted)' }}/>}
            </div>
            {openModel && (
              <div className="px-5 pb-5">
                <div className="row">
                  <div>
                    <label className="label-xs">Provider</label>
                    <select className="select" value={provider} onChange={e=>setProvider(e.target.value)}>
                      <option>OpenAI</option><option>Anthropic</option><option>Google</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Model</label>
                    <select className="select" value={model} onChange={e=>setModel(e.target.value)}>
                      <option>GPT 4o Cluster</option><option>GPT-4o</option><option>GPT-4.1</option>
                    </select>
                  </div>
                </div>

                <div className="row mt-3">
                  <div>
                    <label className="label-xs">First Message Mode</label>
                    <select className="select" value={firstMode} onChange={e=>setFirstMode(e.target.value)}>
                      <option>Assistant speaks first</option><option>User speaks first</option><option>Silent until tool required</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">First Message</label>
                    <input className="input" value={firstMsg} onChange={e=>setFirstMsg(e.target.value)} />
                  </div>
                </div>

                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <label className="label-xs">System Prompt</label>
                    <div className="flex items-center gap-3"><button className="btn"><Wand2 size={16}/> Generate</button></div>
                  </div>
                  <textarea className="textarea" value={systemPrompt} onChange={e=>setSystemPrompt(e.target.value)} />
                </div>
              </div>
            )}

            <div className="sep" />

            <div className="acc-head" onClick={()=>setOpenTranscriber(v=>!v)}>
              <div className="acc-title"><span className="pill" style={{height:30}}><Timer size={14}/></span>Transcriber</div>
              {openTranscriber ? <ChevronUp size={18} style={{ color:'var(--muted)' }}/> : <ChevronDown size={18} style={{ color:'var(--muted)' }}/>}
            </div>
            {openTranscriber && (
              <div className="px-5 pb-6">
                <div className="row">
                  <div>
                    <label className="label-xs">Provider</label>
                    <select className="select" value={asrProvider} onChange={e=>setAsrProvider(e.target.value)}>
                      <option>Deepgram</option><option>Whisper</option><option>AssemblyAI</option>
                    </select>
                  </div>
                  <div>
                    <label className="label-xs">Language</label>
                    <select className="select" value={asrLang} onChange={e=>setAsrLang(e.target.value)}>
                      <option>En</option><option>Multi</option><option>Es</option>
                    </select>
                  </div>
                </div>

                <div className="row mt-3">
                  <div>
                    <label className="label-xs">Model</label>
                    <select className="select" value={asrModel} onChange={e=>setAsrModel(e.target.value)}>
                      <option>Nova 2</option><option>Nova</option><option>Whisper Large-V3</option>
                    </select>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <label className="label-xs">Confidence Threshold</label>
                      <div className="flex items-center gap-3">
                        <input type="range" min={0} max={1} step={0.01} value={confidence} onChange={(e)=>setConfidence(parseFloat(e.target.value))} style={{ width:'100%' }} />
                        <div className="va-card px-3 py-2 rounded-md text-sm" style={{minWidth:54, textAlign:'center'}}>{confidence.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-4">
                  <div className="flex items-center justify-between">
                    <div><div className="font-semibold text-sm">Background Denoising Enabled</div><div className="label-xs">Filter background noise while the user is talking.</div></div>
                    <Toggle checked={denoise} onChange={setDenoise} />
                  </div>
                  <div className="flex items-center justify-between">
                    <div><div className="font-semibold text-sm">Use Numerals</div><div className="label-xs">Convert numbers from words to digits in transcription.</div></div>
                    <Toggle checked={numerals} onChange={setNumerals} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
