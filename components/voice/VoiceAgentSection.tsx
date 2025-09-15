// This file renders the Voice Agent page (client-side only) and keeps each assistant's settings independent via localStorage keys.
//////////////////////////////
// components/voice/VoiceAgentSection.tsx
//////////////////////////////

// Next.js directive: render this component on the client (hooks, localStorage, DOM APIs)
'use client';

// Imports React, state/effect hooks, and a couple of helpers
import React, { useEffect, useMemo, useState } from 'react';
// Dynamic import utility from Next.js (for client-only/lazy components)
import dynamic from 'next/dynamic';
// Icon set from lucide-react used throughout the UI
import { Wand2, ChevronDown, ChevronUp, Gauge, Timer, Phone, Rocket } from 'lucide-react';

/* Safe dynamic rail */
// Define a component that loads AssistantRail lazily on the client with a fallback if it errors or while loading
const AssistantRail = dynamic(
  // Lazy import the rail module and normalize default export
  () =>
    import('@/components/voice/AssistantRail')
      .then(m => m.default ?? m)
      // In case of import error, render a tiny fallback component
      .catch(() => () => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>),
  // Disable SSR; show a small loading placeholder while the chunk loads
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

// Tiny error boundary wrapper so a crashing rail doesn’t break the whole page
class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  // Initialize “hasError” to false
  constructor(p:any){ super(p); this.state={hasError:false}; }
  // If a child throws, flip the error flag
  static getDerivedStateFromError(){ return {hasError:true}; }
  // Render either the fallback UI or the children
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ===== Compact tokens ===== */
// Brand green used for primary buttons/accents
const GREEN = '#10b981';
// Hover version of the brand green
const GREEN_HOVER = '#0ea473';
// localStorage key that remembers which assistant is “active” in the editor
const ACTIVE_KEY  = 'va:activeId';

// Type describing the shape of one assistant’s configuration (editor form state)
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

// Defaults used when an assistant has no saved data yet
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

// Helper: build a unique localStorage key per-assistant id
function keyFor(id: string){ return `va:agent:${id}`; }

// Read a single assistant’s data from localStorage (merge with defaults for missing fields)
function loadAgentData(id: string): AgentData {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
}

// Persist one assistant’s data to localStorage (by id)
function saveAgentData(id: string, data: AgentData){
  try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
}

// Inline CSS tokens (scoped by .va root) so this section has its own dark look & shadows
function LocalTokens() {
  return (
    <style>{`
      /* Root tokens (colors & text sizing) */
      .va { --panel: rgba(13,15,17,0.92); --card: rgba(18,20,23,0.88);
            --border: rgba(106,247,209,0.18); --text: #E9FBF5; --muted: #9bb7ae; --fg:#E9FBF5; }
      .va { color: var(--fg); font-size:13px; }

      /* Large panel container (rounded, layered shadows) */
      .va-panel{ background:var(--panel); border:1px solid var(--border); border-radius:24px;
                 box-shadow: inset 0 0 20px rgba(0,0,0,.28), 0 0 14px rgba(106,247,209,.05), 0 0 18px rgba(0,255,194,.05); }

      /* Card surfaces (lighter than panel, subtle inner highlight) */
      .va-card{ background:var(--card); border:1px solid var(--border); border-radius:14px;
                box-shadow: 0 14px 28px rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.06), 0 0 0 1px rgba(0,255,194,.05); }

      /* Inputs/selects/textarea share the same surface and borders */
      .input,.select,.textarea{
        width:100%; background:var(--card); border:1px solid var(--border); color:var(--fg);
        border-radius:12px; padding:0 .7rem; outline:none; font-size:13px;
      }
      /* Compact control height for inputs and selects */
      .input,.select{ height:34px; }
      /* Comfortable textarea height + line-height for prompts */
      .textarea{ min-height:130px; padding:.6rem .7rem; line-height:1.45; font-size:13px; }

      /* Secondary button surface */
      .btn{
        height:34px; padding:0 .75rem; border-radius:12px; display:inline-flex; align-items:center; gap:.45rem;
        background:var(--card); color:var(--fg); border:1px solid var(--border); font-weight:600; font-size:13px;
        transition:transform .06s ease;
      }
      /* Micro lift on hover */
      .btn:hover{ transform:translateY(-1px); }

      /* Primary green button (brand) */
      .btn-primary{
        height:34px; padding:0 .85rem; border-radius:14px; display:inline-flex; align-items:center; gap:.5rem;
        background:${GREEN}; border:1px solid ${GREEN}; color:#0b1210; font-weight:700; font-size:13px;
        box-shadow:0 8px 20px rgba(16,185,129,.20);
      }
      /* Stronger hover */
      .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 10px 24px rgba(16,185,129,.28); }

      /* KPI box spacing and titles */
      .kpi{ padding:12px; }
      .kpi-title{ font-size:11.5px; color:var(--muted); margin-bottom:4px; }
      .kpi-value{ font-size:17px; font-weight:800; }

      /* Small labels (field captions) */
      .label-xs{ font-size:11.5px; color:var(--muted); }

      /* “Pill” tags used in accordion headers */
      .pill{
        height:30px; padding:0 .7rem; border-radius:9px;
        border:1px solid var(--border); background:var(--card); font-weight:650; font-size:12.5px;
        display:inline-flex; align-items:center; gap:.4rem;
      }

      /* Accordion header row (clickable) */
      .acc-head{ display:flex; align-items:center; justify-content:space-between; padding:14px 16px; cursor:pointer; }
      .acc-title{ display:flex; align-items:center; gap:8px; font-weight:700; font-size:13px; }

      /* Hairline separators within the panel */
      .sep{ border-top:1px solid var(--border); }

      /* Two-column layout for forms on wide screens */
      .row{ display:grid; grid-template-columns:1fr 1fr; gap:10px; }
      /* Collapse to one column on narrow screens */
      @media (max-width:980px){ .row{ grid-template-columns:1fr; } }

      /* Consistent icon sizing */
      .ico{ width:14px; height:14px; display:inline-block; }
    `}</style>
  );
}

/* Compact toggle */
// Reusable toggle switch (pure CSS/JS): controlled by “checked” prop; not tied to any lib
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  // Button wrapper that flips the state on click
  <button
    onClick={()=>onChange(!checked)}
    className="btn"
    // Track background/border change depending on “checked”
    style={{
      height:28, width:50, padding:'0 6px', borderRadius:999,
      justifyContent:'flex-start',
      background: checked ? 'rgba(16,185,129,.18)' : 'var(--card)',
      borderColor: checked ? GREEN : 'var(--border)'
    }}
    // Accessibility: reflect toggle state
    aria-pressed={checked}
  >
    {/* The sliding thumb; we just translate it left/right */}
    <span
      style={{
        width:18, height:18, borderRadius:999, background: checked ? GREEN : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s ease',
        boxShadow: checked ? '0 0 8px rgba(16,185,129,.45)' : undefined
      }}
    />
  </button>
);

// Main page component that binds the active assistant and per-assistant editor state
export default function VoiceAgentSection() {
  /* Active assistant id from rail */
  // Read last active id from localStorage (if present) on first render
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });

  /* Per-assistant data */
  // Editor state for the currently active assistant (loaded by id or default)
  const [data, setData] = useState<AgentData>(() => activeId ? loadAgentData(activeId) : DEFAULT_AGENT);

  /* Listen for rail selection changes */
  // Custom window event ("assistant:active") sent by AssistantRail when a different assistant is selected
  useEffect(() => {
    // Handler extracts id from CustomEvent.detail and updates activeId
    const handler = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      setActiveId(id);
    };
    // Subscribe on mount
    window.addEventListener('assistant:active', handler as EventListener);
    // Unsubscribe on unmount
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  /* When active changes, load that assistant's config */
  // Whenever activeId changes, load that assistant’s saved data and remember the id
  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);

  /* Any edit saves to that assistant only */
  // Persist edits immediately to *only* the current assistant’s key
  useEffect(() => {
    if (!activeId) return;
    saveAgentData(activeId, data);
  }, [activeId, data]);

  /* Shorthand setters */
  // Helper factory: returns a setter that updates a single field on the data object
  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  // Render the two-column layout: assistant rail (left) + editor (right)
  return (
    // Root of the section with token scope + base background/text colors
    <div className="va w-full" style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Inject the local CSS token <style> tag */}
      <LocalTokens />

      {/* layout: NARROWER rail + thinner white divider */}
      {/* CSS grid with two columns: fixed rail width + flexible content */}
      <div className="grid w-full pr-[1px]" style={{ gridTemplateColumns:'260px 1fr' }}>
        {/* LEFT rail */}
        {/* Right border is a thin, semi-white divider (works on dark bg) */}
        <div className="border-r" style={{ borderColor:'rgba(255,255,255,.14)' }}>
          {/* Error boundary prevents a broken rail from killing the page */}
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* RIGHT content */}
        {/* Right column padding + max width keep content readable on big screens */}
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]">

          {/* header: only Publish + Talk to Assistant */}
          {/* Action buttons row aligned to the right */}
          <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
            {/* Secondary button: Publish */}
            <button className="btn">
              <Rocket className="ico" /> Publish
            </button>
            {/* Primary green button: call/test assistant */}
            <button className="btn-primary">
              <Phone className="ico" /> Talk to Assistant
            </button>
          </div>

          {/* KPIs */}
          {/* Two small cards with quick metrics */}
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

          {/* Main settings panel (accordion sections) */}
          <div className="va-panel overflow-hidden">
            {/* Model */}
            {/* Collapsible section for LLM provider/model + first message settings */}
            <Accordion
              title="Model"
              icon={<Gauge className="ico" />}
              content={
                // Padding inside the accordion body
                <div className="px-4 pb-4">
                  {/* Two-column row: Provider + Model */}
                  <div className="row">
                    <div>
                      <label className="label-xs">Provider</label>
                      {/* Controlled select: updates “provider” field */}
                      <select className="select" value={data.provider} onChange={e=>set('provider')(e.target.value)}>
                        <option>OpenAI</option><option>Anthropic</option><option>Google</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">Model</label>
                      {/* Controlled select: updates “model” field */}
                      <select className="select" value={data.model} onChange={e=>set('model')(e.target.value)}>
                        <option>GPT 4o Cluster</option><option>GPT-4o</option><option>GPT-4.1</option>
                      </select>
                    </div>
                  </div>

                  {/* Two-column row: First message mode + message content */}
                  <div className="row mt-2.5">
                    <div>
                      <label className="label-xs">First Message Mode</label>
                      {/* Controlled select: “assistant/user first” behavior */}
                      <select className="select" value={data.firstMode} onChange={e=>set('firstMode')(e.target.value)}>
                        <option>Assistant speaks first</option><option>User speaks first</option><option>Silent until tool required</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">First Message</label>
                      {/* Controlled input: the first assistant utterance */}
                      <input className="input" value={data.firstMsg} onChange={e=>set('firstMsg')(e.target.value)} />
                    </div>
                  </div>

                  {/* System prompt field + optional generator action */}
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="label-xs">System Prompt</label>
                      <div className="flex items-center gap-2">
                        {/* (Stub) button that could auto-generate a prompt */}
                        <button className="btn"><Wand2 className="ico"/> Generate</button>
                      </div>
                    </div>
                    {/* Controlled textarea: the core instruction/prompt */}
                    <textarea className="textarea" value={data.systemPrompt} onChange={e=>set('systemPrompt')(e.target.value)} />
                  </div>
                </div>
              }
            />

            {/* Divider between sections */}
            <div className="sep" />

            {/* Transcriber */}
            {/* Collapsible section for ASR (speech-to-text) settings */}
            <Accordion
              title="Transcriber"
              icon={<Timer className="ico" />}
              content={
                // Padding inside the accordion body
                <div className="px-4 pb-5">
                  {/* Two-column row: ASR provider + language */}
                  <div className="row">
                    <div>
                      <label className="label-xs">Provider</label>
                      {/* Controlled select: ASR provider */}
                      <select className="select" value={data.asrProvider} onChange={e=>set('asrProvider')(e.target.value)}>
                        <option>Deepgram</option><option>Whisper</option><option>AssemblyAI</option>
                      </select>
                    </div>
                    <div>
                      <label className="label-xs">Language</label>
                      {/* Controlled select: transcription language */}
                      <select className="select" value={data.asrLang} onChange={e=>set('asrLang')(e.target.value)}>
                        <option>En</option><option>Multi</option><option>Es</option>
                      </select>
                    </div>
                  </div>

                  {/* Two-column row: ASR model + confidence threshold */}
                  <div className="row mt-2.5">
                    <div>
                      <label className="label-xs">Model</label>
                      {/* Controlled select: ASR model */}
                      <select className="select" value={data.asrModel} onChange={e=>set('asrModel')(e.target.value)}>
                        <option>Nova 2</option><option>Nova</option><option>Whisper Large-V3</option>
                      </select>
                    </div>
                    {/* Right side: slider + readout for confidence threshold */}
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="label-xs">Confidence Threshold</label>
                        <div className="flex items-center gap-2">
                          {/* Range input writes to data.confidence */}
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={data.confidence}
                            onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
                            style={{ width:'100%' }}
                          />
                          {/* Small value card showing the number */}
                          <div className="va-card px-2.5 py-1.5 rounded-md text-xs" style={{minWidth:46, textAlign:'center'}}>
                            {data.confidence.toFixed(1)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Two setting toggles: denoise + numerals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[13px]">Background Denoising Enabled</div>
                        <div className="label-xs">Filter background noise while the user is talking.</div>
                      </div>
                      {/* Toggle bound to data.denoise */}
                      <Toggle checked={data.denoise} onChange={v=>set('denoise')(v)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-[13px]">Use Numerals</div>
                        <div className="label-xs">Convert numbers from words to digits in transcription.</div>
                      </div>
                      {/* Toggle bound to data.numerals */}
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
// Minimal controlled accordion: toggles open/closed state for each section
function Accordion({ title, icon, content }:{ title:string; icon:React.ReactNode; content:React.ReactNode }) {
  // Track whether section is open
  const [open,setOpen]=useState(true);
  return (
    <>
      {/* Header row: clicking inverts “open” */}
      <div className="acc-head" onClick={()=>setOpen(v=>!v)}>
        {/* Left: title area with icon chip */}
        <div className="acc-title">
          <span className="pill" style={{height:26}}>{icon}</span>
          {title}
        </div>
        {/* Right: chevron reflects expanded/collapsed state */}
        {open ? <ChevronUp className="ico" style={{ color:'var(--muted)' }}/> : <ChevronDown className="ico" style={{ color:'var(--muted)' }}/>}
      </div>
      {/* Only render body when open */}
      {open && content}
    </>
  );
}
