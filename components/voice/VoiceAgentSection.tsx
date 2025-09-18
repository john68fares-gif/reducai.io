// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Phone, Rocket, Search, Check, Lock, X, KeyRound, Play, Pause
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ───────────────── Assistant rail (fixed) ───────────────── */
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

/* ───────────────── Theme tokens (SOLID dropdowns) ───────────────── */
const ACTIVE_KEY = 'va:activeId';
const CTA        = '#59d9b3';
const CTA_HOVER  = '#48c3a0';

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px;
      --radius-outer: 12px;
      --radius-inner: 10px;
      --control-h: 44px;
      --header-h: 82px;
      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      /* Dark theme hues */
      --bg: #0b0e0f;
      --panel: #101416;   /* page */
      --card: #0f1516;    /* card */
      --card-header: #121919;
      --text: #ecf7f2;
      --text-muted: rgba(236,247,242,.68);

      --border: rgba(255,255,255,.09);
      --ring: rgba(0,255,194,.12);

      /* controls */
      --input-bg: #111719;
      --input-border: rgba(255,255,255,.10);
      --input-shadow: 0 0 0 1px rgba(0,0,0,.38) inset;

      /* menu / dropdown — **SOLID** */
      --menu-bg: #101617; /* solid surface */
      --menu-border: rgba(255,255,255,.12);
      --menu-shadow: 0 36px 90px rgba(0,0,0,.55);

      /* card shadows + subtle green bottom glow */
      --card-shadow: 0 18px 38px rgba(0,0,0,.35);
      --card-glow-bottom: 0 6px 0 -3px rgba(89,217,179,.22);

      --band-core: #121919;
      --band-side: #172222;
    }

    .va-main{ overflow: visible; position: relative; contain: none; }

    .va-card{
      position: relative; overflow: hidden; isolation: isolate;
      border-radius: 10px;
      border: 1px solid var(--border);
      background: var(--card);
      box-shadow: var(--card-shadow), var(--card-glow-bottom);
    }
    .va-card .va-head{
      min-height: var(--header-h);
      display: grid; grid-template-columns: 1fr auto; align-items: center;
      padding: 0 16px;
      background: linear-gradient(180deg, var(--card-header), var(--card));
      border-bottom: 1px solid rgba(255,255,255,.06);
      color: var(--text);
    }

    .va-card__band{
      position:absolute; inset:0; z-index:0; pointer-events:none;
      background:
        linear-gradient(
          90deg,
          var(--band-side) 0%,
          color-mix(in oklab, var(--band-side) 94%, white 6%) 8%,
          color-mix(in oklab, var(--band-side) 92%, white 8%) 16%,
          color-mix(in oklab, var(--band-side) 90%, white 10%) 24%,
          var(--band-core) 50%,
          color-mix(in oklab, var(--band-side) 90%, white 10%) 76%,
          color-mix(in oklab, var(--band-side) 92%, white 8%) 84%,
          color-mix(in oklab, var(--band-side) 94%, white 6%) 92%,
          var(--band-side) 100%
        );
      opacity:.12;
    }
    .va-card > * { position: relative; z-index: 1; }

    /* Dropdown / menus — **SOLID panes** */
    .va-portal{
      background: var(--menu-bg);
      border: 1px solid var(--menu-border);
      box-shadow: var(--menu-shadow);
      border-radius: 10px;
    }

    /* Overlay blur (drawer / modals) */
    .va-overlay {
      position: fixed; inset: 0; z-index: 9998;
      background: transparent;
      backdrop-filter: blur(6px);
    }
    .va-sheet{
      background: var(--menu-bg);
      border: 1px solid var(--menu-border);
      box-shadow: 0 28px 80px rgba(0,0,0,.55);
      border-radius: 12px;
    }

    /* Inputs */
    .va-input{
      background: var(--input-bg);
      border: 1px solid var(--input-border);
      box-shadow: var(--input-shadow);
      color: var(--text);
    }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;
  apiKeyId?: string;

  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;
};

const DEFAULT_AGENT: AgentData = {
  name: 'New Assistant',
  provider: 'openai',
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
`[Identity]
You are a blank template AI assistant with minimal default settings, designed to be easily customizable.

[Style]
- Neutral, concise, configurable.
- Adjust tone and formality to instructions.

[Response Guidelines]
- Keep replies focused and clear.`,

  ttsProvider: 'openai',
  voiceName: 'Alloy (American)',
  apiKeyId: '',
  asrProvider: 'deepgram',
  asrModel: 'Nova 2',
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

/* ───────────────── Mock backend ───────────────── */
async function apiSave(agentId: string, payload: AgentData){
  const r = await fetch(`/api/voice/agent/${agentId}/save`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }).catch(()=>null);
  if (!r?.ok) throw new Error('Save failed');
  return r.json();
}
async function apiPublish(agentId: string){
  const r = await fetch(`/api/voice/agent/${agentId}/publish`, { method: 'POST' }).catch(()=>null);
  if (!r?.ok) throw new Error('Publish failed');
  return r.json();
}
async function apiCallTest(agentId: string){
  const r = await fetch(`/api/voice/agent/${agentId}/call-test`, { method: 'POST' }).catch(()=>null);
  if (!r?.ok) throw new Error('Test call failed');
  return r.json();
}

/* ───────────────── Options ───────────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI' },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon' },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon' },
];

const modelOptsFor = (provider: string): Opt[] =>
  provider === 'openai'
    ? [
        { value: 'GPT-4o',  label: 'GPT-4o' },
        { value: 'GPT-4.1', label: 'GPT-4.1' },
        { value: 'o4-mini', label: 'o4-mini' },
      ]
    : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

const firstMessageModes: Opt[] = [
  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
  { value: 'User speaks first',      label: 'User speaks first' },
  { value: 'Silent until tool required', label: 'Silent until tool required' },
];

const ttsProviders: Opt[] = [
  { value: 'openai',    label: 'OpenAI' },
  { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true, note: 'soon' },
];

const openAiVoices: Opt[] = [
  { value: 'Alloy (American)',     label: 'Alloy (American)' },
  { value: 'Verse (American)',     label: 'Verse (American)' },
  { value: 'Coral (British)',      label: 'Coral (British)' },
  { value: 'Amber (Australian)',   label: 'Amber (Australian)' },
];

const asrProviders: Opt[] = [
  { value: 'deepgram',   label: 'Deepgram' },
  { value: 'whisper',    label: 'Whisper — coming soon', disabled: true, note: 'soon' },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true, note: 'soon' },
];

const asrModelsFor = (asr: string): Opt[] =>
  asr === 'deepgram'
    ? [
        { value: 'Nova 2', label: 'Nova 2' },
        { value: 'Nova',   label: 'Nova' },
      ]
    : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

/* Demo voice previews */
const VOICE_SAMPLES: Record<string,string> = {
  'Alloy (American)': '/voices/alloy.mp3',
  'Verse (American)': '/voices/verse.mp3',
  'Coral (British)': '/voices/coral.mp3',
  'Amber (Australian)': '/voices/amber.mp3',
};

/* ───────────────── UI atoms ───────────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999, justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 20%, var(--input-bg))' : 'var(--input-bg)',
      border: '1px solid var(--input-border)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999,
        background: checked ? CTA : 'rgba(255,255,255,.18)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)'
      }}
    />
  </button>
);

/* Solid select with inline search + (optional) right addon */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, rightAddon
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; rightAddon?: React.ReactNode;
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

  useEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
    const openUp = r.bottom + 320 > window.innerHeight;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });

    const off = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    setTimeout(()=>searchRef.current?.focus(),0);
    return () => { window.removeEventListener('mousedown', off); window.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v=>!v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[10px] text-sm outline-none transition"
        style={{
          background:'var(--input-bg)',
          border:'1px solid var(--input-border)',
          boxShadow:'var(--input-shadow)',
          color:'var(--text)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <span className="flex items-center gap-2">
          {rightAddon}
          <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
        </span>
      </button>

      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              className="va-portal fixed z-[99999] p-3"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none'
              }}
            >
              {/* SOLID search row */}
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
                style={{
                  background:'var(--menu-bg)',           // solid
                  border:'1px solid var(--menu-border)',
                  color:'var(--text)'
                }}
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
                    className="w-full text-left text-sm px-3 py-2 rounded-[8px] transition flex items-center gap-2 disabled:opacity-60"
                    style={{
                      color:'var(--text)',
                      background:'transparent',
                      border:'1px solid transparent',
                      cursor:o.disabled?'not-allowed':'pointer'
                    }}
                    onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement;
                      el.style.background='rgba(16,22,23,1)';           // solid hover (menu-bg tone)
                      el.style.border='1px solid var(--menu-border)'; }}
                    onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement;
                      el.style.background='transparent';
                      el.style.border='1px solid transparent'; }}
                  >
                    {o.disabled ? <Lock className="w-3.5 h-3.5" /> :
                      <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                    <span className="flex-1 truncate">{o.label}</span>
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

/* ───────────────── Generate overlay (solid) ───────────────── */
function GenerateOverlay({
  onClose, seedPrompt, onAccept
}:{
  onClose: ()=>void;
  seedPrompt: string;
  onAccept: (finalText: string) => void;
}) {
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<'idle'|'loading'|'diff'>('idle');
  const [diffNodes, setDiffNodes] = useState<React.ReactNode>(null);
  const [nextText, setNextText] = useState(seedPrompt);

  function fauxRewrite(base: string, extra: string){
    const addon = extra.trim() ? `

[Task & Goals]
- ${extra.trim().replace(/\.$/, '')}.` : '';
    return base.replace(/\n+$/,'') + addon + '\n';
  }
  function buildDiff(oldStr: string, newStr: string){
    const oldWords = oldStr.split(/(\s+)/);
    const newWords = newStr.split(/(\s+)/);
    const out: React.ReactNode[] = [];
    const max = Math.max(oldWords.length, newWords.length);
    for (let i=0;i<max;i++){
      const a = oldWords[i] ?? '';
      const b = newWords[i] ?? '';
      if (a === b){
        out.push(<span key={i}>{b}</span>);
      } else {
        if (a && !b) out.push(<del key={`r${i}`} style={{ background:'rgba(255,99,71,.22)', color:'#ffb3a5', textDecorationColor:'#ffb3a5' }}>{a}</del>);
        if (b && a !== b) out.push(<mark key={`a${i}`} style={{ background:'rgba(89,217,179,.22)', color:'#aef0de' }}>{b}</mark>);
      }
    }
    return out;
  }

  const handleGenerate = async () => {
    setPhase('loading');
    await new Promise(r=>setTimeout(r, 900));
    const candidate = fauxRewrite(seedPrompt, note);
    setNextText(candidate);
    setDiffNodes(buildDiff(seedPrompt, candidate));
    setPhase('diff');
  };

  const body = (
    <div className="va-sheet w-full max-w-[720px] p-5 md:p-6">
      <div className="flex items-center justify-between mb-3">
        <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>Generate Prompt</div>
        <button onClick={onClose} className="p-1 rounded hover:opacity-80" aria-label="Close">
          <X className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
        </button>
      </div>

      <div className="grid gap-3">
        <input
          placeholder="Add follow-ups or refinements…"
          className="w-full rounded-[10px] px-3 py-2 va-input"
          value={note}
          onChange={(e)=>setNote(e.target.value)}
        />
        <div className="text-xs" style={{ color:'var(--text-muted)' }}>
          We’ll blend this into the current prompt and show you a diff before applying.
        </div>

        <div className="mt-3">
          <button
            onClick={handleGenerate}
            disabled={phase==='loading'}
            className="h-9 px-4 rounded-[10px] font-semibold"
            style={{ background:CTA, color:'#fff', boxShadow:'0 12px 26px rgba(89,217,179,.22)' }}
            onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
            onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
          >
            {phase==='loading' ? 'Generating…' : 'Generate'}
          </button>
        </div>

        <AnimatePresence>
          {phase==='diff' && (
            <motion.div
              initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-[10px] p-3"
              style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            >
              <div className="text-sm font-medium mb-2">Changes</div>
              <div className="text-[13px]" style={{ lineHeight: '1.55' }}>{diffNodes}</div>

              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={()=>onAccept(nextText)}
                  className="h-9 px-4 rounded-[10px] font-semibold"
                  style={{ background:CTA, color:'#fff' }}
                >
                  Accept Changes
                </button>
                <button
                  onClick={onClose}
                  className="h-9 px-3 rounded-[10px]"
                  style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                >
                  Discard Changes
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return createPortal(
    <>
      <div className="va-overlay" />
      <motion.div
        initial={{ scale: .98, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="fixed inset-0 z-[9999] grid place-items-center px-4"
      >
        {body}
      </motion.div>
    </>,
    document.body
  );
}

/* ───────────────── Right drawer (chat) ───────────────── */
function RightDrawer({
  open, onClose, agentName
}:{ open:boolean; onClose:()=>void; agentName:string }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <div className="va-overlay" onClick={onClose} />
          <motion.aside
            initial={{ x: 420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="fixed top-0 right-0 h-full w-[420px] z-[10000] va-sheet"
            style={{ display:'grid', gridTemplateRows:'auto 1fr auto' }}
          >
            <div className="px-4 h-[64px] grid items-center" style={{ borderBottom:'1px solid var(--menu-border)' }}>
              <div className="flex items-center justify-between">
                <div className="font-semibold" style={{ color:'var(--text)' }}>{agentName} — Live Chat</div>
                <button onClick={onClose} className="p-1 rounded hover:opacity-80" aria-label="Close">
                  <X className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
                </button>
              </div>
            </div>

            <div className="px-4 py-3 overflow-y-auto">
              <div className="space-y-3 text-[13.5px]">
                <div className="flex gap-2">
                  <div className="px-3 py-2 rounded-[10px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}>
                    Hey! Say something and I’ll respond.
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3" style={{ borderTop:'1px solid var(--menu-border)' }}>
              <div className="flex gap-2">
                <input className="flex-1 rounded-[10px] px-3 py-2 va-input" placeholder="Type a message…" />
                <button className="px-4 rounded-[10px] font-semibold" style={{ background:CTA, color:'#fff' }}>Send</button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>,
    document.body
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
  const [showGenerate, setShowGenerate] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const typeIntoPrompt = (finalText: string) => {
    const step = 2;
    let i = 0;
    const id = setInterval(() => {
      setData(prev => ({ ...prev, systemPrompt: finalText.slice(0, i) }));
      i += step;
      if (i >= finalText.length){ setData(prev => ({ ...prev, systemPrompt: finalText })); clearInterval(id); }
    }, 8);
  };

  const audioRef = useRef<HTMLAudioElement|null>(null);
  const [playing, setPlaying] = useState(false);
  const togglePreview = () => {
    const src = VOICE_SAMPLES[data.voiceName];
    if (!src) return;
    if (!audioRef.current){ audioRef.current = new Audio(src); }
    else { audioRef.current.src = src; }
    if (!playing){ setPlaying(true); audioRef.current.play().catch(()=>setPlaying(false)); }
    else { audioRef.current.pause(); audioRef.current.currentTime = 0; setPlaying(false); }
    audioRef.current.onended = () => setPlaying(false);
  };

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

  useEffect(() => {
    (async () => {
      try {
        const store = await scopedStorage();
        await store.ensureOwnerGuard();

        const v1 = await store.getJSON<ApiKey[]>('apiKeys.v1', []);
        const legacy = await store.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter((k) => k.id && k.name);

        setApiKeys(cleaned);

        const globalSelected = await store.getJSON<string>('apiKeys.selectedId', '');
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        if (chosen && chosen !== data.apiKeyId) {
          setData(prev => ({ ...prev, apiKeyId: chosen }));
          await store.setJSON('apiKeys.selectedId', chosen);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

  const modelOpts = useMemo(()=>modelOptsFor(data.provider), [data.provider]);

  async function doSave(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setSaving(true); setToast('');
    try { await apiSave(activeId, data); setToast('Saved'); }
    catch { setToast('Save failed'); }
    finally { setSaving(false); setTimeout(()=>setToast(''), 1400); }
  }
  async function doPublish(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setPublishing(true); setToast('');
    try { await apiPublish(activeId); setToast('Published'); }
    catch { setToast('Publish failed'); }
    finally { setPublishing(false); setTimeout(()=>setToast(''), 1400); }
  }
  async function doCallTest(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setCalling(true); setToast('');
    try { await apiCallTest(activeId); setToast('Calling…'); setDrawerOpen(true); }
    catch { setToast('Test call failed'); }
    finally { setCalling(false); setTimeout(()=>setToast(''), 1800); }
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Fixed rail */}
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(255,255,255,.06)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* Content */}
        <div className="va-main px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]"
             style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>

          {/* Actions */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button
              onClick={doCallTest}
              disabled={calling}
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold select-none disabled:opacity-60"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#fff', boxShadow:'0 10px 22px rgba(89,217,179,.22)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" style={{ color:'#fff', strokeWidth: 2.2 }} /> {calling ? 'Calling…' : 'Talk to Assistant'}
            </button>
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                 style={{ background:'rgba(89,217,179,.14)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.22) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* KPIs */}
          <div className="grid gap-[12px] md:grid-cols-2 mb-[12px]">
            <div className="va-card p-[var(--s-4)]">
              <div className="va-card__band" />
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~$0.1/min</div>
            </div>
            <div className="va-card p-[var(--s-4)]">
              <div className="va-card__band" />
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~1050 ms</div>
            </div>
          </div>

          {/* Sections */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the assistant’s name, reasoning model, and first message."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Name</div>
                <input
                  className="w-full rounded-[10px] px-3 va-input"
                  style={{ height:'var(--control-h)' }}
                  value={data.name}
                  onChange={(e)=>set('name')(e.target.value)}
                />
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Provider</div>
                <StyledSelect value={data.provider} onChange={(v)=>set('provider')(v as AgentData['provider'])} options={providerOpts}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Model</div>
                <StyledSelect value={data.model} onChange={set('model')} options={modelOpts}/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message Mode</div>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstMessageModes}/>
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message</div>
                <input
                  className="w-full rounded-[10px] px-3 va-input"
                  style={{ height:'var(--control-h)' }}
                  value={data.firstMsg}
                  onChange={(e)=>set('firstMsg')(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-[var(--s-4)]">
              <div className="flex items-center justify-between mb-[var(--s-2)]">
                <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                <button
                  className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                  style={{ height:36, padding:'0 12px', background:CTA, color:'#fff' }}
                  onClick={()=>setShowGenerate(true)}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full rounded-[10px] px-3 py-[10px] va-input"
                style={{ minHeight:220, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt}
                onChange={(e)=>set('systemPrompt')(e.target.value)}
              />
              <div className="text-xs mt-1" style={{ color:'var(--text-muted)' }}>
                Generated changes will highlight in green/red here first, then “Accept Changes” types them in.
              </div>
            </div>
          </Section>

          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose the TTS provider, preview a voice, and set your key."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 opacity-80" /> OpenAI API Key
                </div>
                <StyledSelect
                  value={data.apiKeyId || ''}
                  onChange={async (val)=>{
                    set('apiKeyId')(val);
                    try { const store = await scopedStorage(); await store.ensureOwnerGuard(); await store.setJSON('apiKeys.selectedId', val); } catch {}
                  }}
                  options={[
                    { value: '', label: 'Select an API key…' },
                    ...apiKeys.map(k=>({ value: k.id, label: `${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}` }))
                  ]}
                  leftIcon={<KeyRound className="w-4 h-4" style={{ color: CTA }} />}
                />
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice Provider</div>
                <StyledSelect
                  value={data.ttsProvider}
                  onChange={(v)=>set('ttsProvider')(v as AgentData['ttsProvider'])}
                  options={ttsProviders}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={set('voiceName')}
                  options={openAiVoices}
                  placeholder="— Choose —"
                  rightAddon={
                    VOICE_SAMPLES[data.voiceName] ? (
                      <button
                        onClick={(e)=>{ e.stopPropagation(); togglePreview(); }}
                        className="p-1.5 rounded hover:opacity-90"
                        aria-label="Preview voice"
                        style={{ background:'color-mix(in oklab, var(--text) 4%, transparent)' }}
                      >
                        {playing ? <Pause className="w-3.5 h-3.5"/> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    ) : null
                  }
                />
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">ASR Provider</div>
                <StyledSelect value={data.asrProvider} onChange={(v)=>set('asrProvider')(v as AgentData['asrProvider'])} options={asrProviders}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">ASR Model</div>
                <StyledSelect value={data.asrModel} onChange={set('asrModel')} options={asrModelsFor(data.asrProvider)}/>
              </div>
            </div>
          </Section>

          <Section
            title="Transcriber"
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Minimal, like your screenshot."
            defaultOpen={true}
          >
            <div className="text-sm" style={{ color:'var(--text-muted)' }}>
              Provider and model are set above. We’ve removed the language/dialect slider clutter.
            </div>
          </Section>
        </div>
      </div>

      {/* Right drawer */}
      <RightDrawer open={drawerOpen} onClose={()=>setDrawerOpen(false)} agentName={data.name} />

      {/* Generate */}
      {showGenerate && (
        <GenerateOverlay
          seedPrompt={data.systemPrompt}
          onClose={()=>setShowGenerate(false)}
          onAccept={(finalText)=>{
            setShowGenerate(false);
            typeIntoPrompt(finalText);
          }}
        />
      )}
    </section>
  );
}

/* ───────────────── Collapsible section ───────────────── */
function Section({
  title, icon, desc, children, defaultOpen = true
}:{
  title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-[12px]">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>
        {title}
      </div>

      <div className="va-card">
        <div className="va-card__band" />
        <button onClick={()=>setOpen(v=>!v)} className="va-head w-full text-left">
          <span className="min-w-0 flex items-center gap-3">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                  style={{ background:'rgba(89,217,179,.12)' }}>
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold truncate" style={{ fontSize:'var(--fz-title)' }}>{title}</span>
              {desc ? <span className="block text-xs truncate" style={{ color:'var(--text-muted)' }}>{desc}</span> : null}
            </span>
          </span>
          <span className="justify-self-end">
            {open ? <ChevronUp className="w-4 h-4" style={{ color:'var(--text-muted)' }}/> :
                    <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }}/>}
          </span>
        </button>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div
              key="body"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: .22, ease: 'easeInOut' }}
              style={{ overflow:'hidden' }}
            >
              <div className="p-[var(--s-5)]">
                {children}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
