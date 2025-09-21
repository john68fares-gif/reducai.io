// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, Pause, X, Upload, MessageSquareText
} from 'lucide-react';

import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

// IMPORTANT: models now come from the server file you asked for
import { OPENAI_MODELS } from '@/pages/api/openai/models';

import {
  applyInstructions as _applyInstructions,
  DEFAULT_PROMPT as _DEFAULT_PROMPT,
  looksLikeFullPrompt as _looksLikeFullPrompt,
  normalizeFullPrompt as _normalizeFullPrompt,
} from '@/lib/prompt-engine';

/* ───────────────── Assistant rail (fixed) ───────────────── */
const AssistantRail = dynamic(
  () =>
    import('@/components/voice/AssistantRail')
      .then(m => m.default ?? m)
      .catch(() =>
        Promise.resolve(() => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>)
      ),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

class RailBoundary extends React.Component<{children:React.ReactNode},{hasError:boolean}> {
  constructor(p:any){ super(p); this.state={hasError:false}; }
  static getDerivedStateFromError(){ return {hasError:true}; }
  render(){ return this.state.hasError ? <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div> : this.props.children; }
}

/* ─────────── constants ─────────── */
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';
const Z_OVERLAY = 100000;
const Z_MODAL   = 100001;
const Z_MENU    = 100020;
const Z_PANEL   = 100030;
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

/* logos (fallback inline SVGs if you don't ship PNGs/SVGs in /public) */
const BrandIcon = ({ provider }:{provider:'openai'|'anthropic'|'google'}) => {
  if (provider === 'openai') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <path fill="currentColor" d="M12 2.2c-2.7 0-4.9 2.2-4.9 4.9v.3C5.2 8 4 9.8 4 11.8c0 2.7 2.2 4.9 4.9 4.9h.3c.6 1.9 2.4 3.2 4.5 3.2 2.7 0 4.9-2.2 4.9-4.9v-.3c1.9-.6 3.2-2.4 3.2-4.5 0-2.7-2.2-4.9-4.9-4.9h-.3C16 3.4 14.2 2.2 12 2.2z"/>
      </svg>
    );
  }
  if (provider === 'anthropic') {
    return <span className="inline-block w-4 h-4 rounded-sm bg-white text-black grid place-items-center text-[9px]">A</span>;
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path fill="#4285F4" d="M21.35 11.1H12v2.9h5.3c-.23 1.5-1.6 4.3-5.3 4.3-3.2 0-5.8-2.7-5.8-6s2.6-6 5.8-6c1.8 0 3 .8 3.7 1.5l2.5-2.4C17 3.5 14.8 2.5 12 2.5 6.9 2.5 2.7 6.7 2.7 11.9s4.2 9.4 9.3 9.4c5.3 0 8.8-3.7 8.8-8.9 0-.6-.07-1.2-.18-1.7z"/>
    </svg>
  );
};

/* phone icon */
function PhoneFilled(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props} aria-hidden>
      <path
        d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 011 1v3.5a1 1 0 01-1 1C11.3 22 2 12.7 2 2.99a1 1 0 011-1H6.5a1 1 0 011 1c0 1.23.2 2.44.57 3.56a1 1 0 01-.24 1.03l-2.2 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

/* helpers */
const isFn = (f: any): f is Function => typeof f === 'function';
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const coerceStr = (v: any): string => (isStr(v) ? v : '');
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');

/* ─────────── theme tokens ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;

      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:10px;
      --radius-ctrl:8px;           /* LESS ROUNDED */
      --control-h:44px; --header-h:64px;
      --fz-title:18px; --fz-sub:15px; --fz-body:14px; --fz-label:12.5px;
      --lh-body:1.45; --ease:cubic-bezier(.22,.61,.36,1);

      --app-sidebar-w: 240px;
      --rail-w: 260px;

      --page-bg:var(--bg);
      --panel-bg:var(--panel);
      --input-bg:var(--panel);
      --input-border:rgba(255,255,255,.10);
      --input-shadow:0 0 0 1px rgba(255,255,255,.06) inset;

      --border-weak:rgba(255,255,255,.10);
      --card-shadow:0 22px 44px rgba(0,0,0,.28),
                    0 0 0 1px rgba(255,255,255,.06) inset,
                    0 0 0 1px ${GREEN_LINE};

      --green-weak: rgba(89,217,179,.12);
      --red-weak: rgba(239,68,68,.14);

      --vs-input-bg:#101314;
      --vs-input-border:rgba(255,255,255,.14);
      --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);

      --vs-menu-bg:#101314;
      --vs-menu-border:rgba(255,255,255,.16);
    }

    .va-portal{
      --vs-menu-bg:#101314;
      --vs-menu-border:rgba(255,255,255,.16);
      --vs-input-bg:#101314;
      --vs-input-border:rgba(255,255,255,.14);
      --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
      --text:#e6f1ef;
      --text-muted:#9fb4ad;
    }

    .va-card{
      border-radius:var(--radius-outer);
      border:1px solid var(--border-weak);
      background:var(--panel-bg);
      box-shadow:var(--card-shadow);
      overflow:hidden; isolation:isolate;
    }

    .va-head{
      min-height:var(--header-h);
      display:grid; grid-template-columns:1fr auto; align-items:center;
      padding:0 16px;
      background:linear-gradient(90deg,
        var(--panel-bg) 0%,
        color-mix(in oklab, var(--panel-bg) 97%, white 3%) 50%,
        var(--panel-bg) 100%);
      border-bottom:1px solid rgba(255,255,255,.08);
      color:var(--text);
    }

    .va-select-trigger{ border-radius:var(--radius-ctrl); }

    @keyframes va-blink { 0%, 49% {opacity:1;} 50%, 100% {opacity:0;} }
    .va-caret::after{
      content:'';
      display:inline-block;
      width:8px; height:18px; margin-left:2px;
      background: currentColor; opacity:.9; border-radius:1px;
      animation: va-blink 1s step-end infinite;
      transform: translateY(3px);
    }
  `}</style>
);

/* ─────────── types / storage ─────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;               // from OPENAI_MODELS (with 5/4/3 keystrings)
  firstMode: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg: string;
  systemPrompt: string;
  language?: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;
  apiKeyId?: string;

  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
};

const PROMPT_SKELETON =
`[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

/* ─────────── prompt-engine shims ─────────── */
const looksLikeFullPromptSafe = (raw: string) => {
  const t = (raw || '').toLowerCase();
  return ['[identity]', '[style]', '[response guidelines]', '[task & goals]', '[error handling', '[notes]'].some(h => t.includes(h));
};
const normalizeFullPromptSafe = (raw: string) => {
  const sections = { identity:'', style:'', guidelines:'', tasks:'', errors:'', notes:'' };
  const add = (k: keyof typeof sections, v: string) => { (sections as any)[k] = safeTrim(v); };
  const pull = (label: string) => {
    const rx = new RegExp(`\$begin:math:display$${label.replace(/[.*+?^${}()|[\\$end:math:display$\\\\]/g,'\\$&')}\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)`, 'i');
    const m = raw.match(rx);
    return m ? m[1] : '';
  };
  add('identity', pull('Identity'));
  add('style', pull('Style'));
  add('guidelines', pull('Response Guidelines'));
  add('tasks', pull('Task & Goals'));
  add('errors', pull('Error Handling / Fallback'));
  add('notes', pull('Notes'));
  return (
`[Identity]
${sections.identity || '- You are a helpful, professional AI assistant for this business.'}

[Style]
${sections.style || '- Clear, concise, friendly.'}

[Response Guidelines]
${sections.guidelines || '- Ask one clarifying question when essential info is missing.'}

[Task & Goals]
${sections.tasks || '- Guide users to their next best action (booking, purchase, or escalation).'}

[Error Handling / Fallback]
${sections.errors || '- If unsure, ask a specific clarifying question first.'}

${sections.notes ? `[Notes]\n${sections.notes}\n` : ''}`.trim());
};
const applyInstructionsSafe = (base: string, raw: string) => {
  const text = (raw || '').trim();
  const toneMatch = text.match(/tone\s*[:=]\s*([a-z,\s-]+)/i) || text.match(/\b(friendly|formal|casual|professional|empathetic|playful)\b/i);
  const tone = toneMatch ? (toneMatch as any)[1]?.trim?.() || (toneMatch as any)[0] : '';
  const goals = `- Qualify needs, answer FAQs, guide to scheduling/purchase/escalation.\n- Offer to collect name/contact/time when needed.`;
  const merged =
`[Identity]
- You are a versatile AI assistant. Represent the brand professionally.

[Style]
- ${tone ? `${tone[0].toUpperCase()}${tone.slice(1)}` : 'Clear, concise, friendly'}. Prefer 2–4 short sentences per turn.

[Response Guidelines]
- Ask a clarifying question when essential info is missing.
- Do not fabricate; say when you don’t know or need to check.

[Task & Goals]
${goals}

[Error Handling / Fallback]
- If uncertain, ask a specific clarifying question.
- If a tool/endpoint fails, apologize briefly and offer an alternative or human handoff.`;
  return { merged, summary: 'Updated.' };
};

const looksLikeFullPromptRT = (raw: string) =>
  isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : looksLikeFullPromptSafe(raw);
const normalizeFullPromptRT = (raw: string) =>
  isFn(_normalizeFullPrompt) ? coerceStr(_normalizeFullPrompt(raw)) : normalizeFullPromptSafe(raw);
const applyInstructionsRT = (base: string, raw: string) =>
  isFn(_applyInstructions) ? (_applyInstructions as any)(base, raw) : applyInstructionsSafe(base, raw);
const DEFAULT_PROMPT_RT = nonEmpty(_DEFAULT_PROMPT) ? _DEFAULT_PROMPT! : PROMPT_SKELETON;

/* ─────────── defaults ─────────── */
const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'gpt-4o',                      // real keystring; you’ll map to labels from OPENAI_MODELS
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello. I can help with anything here.',
  systemPrompt: normalizeFullPromptRT(`
[Identity]
- You are a helpful, professional AI assistant for this business.

[Style]
- Clear, concise, friendly.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.

[Task & Goals]
- Guide users to their next best action (booking, purchase, or escalation).

[Error Handling / Fallback]
- If unsure, ask a specific clarifying question first.
`).trim(),
  ttsProvider: 'openai',
  voiceName: 'Alloy (American)',
  apiKeyId: '',
  asrProvider: 'deepgram',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
  language: 'English'
};

const keyFor = (id: string) => `va:agent:${id}`;
const versKeyFor = (id: string) => `va:versions:${id}`;

const loadAgentData = (id: string): AgentData => {
  try { const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null; if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { if (IS_CLIENT) localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
};
const pushVersion = (id:string, snapshot:any) => {
  try {
    if (!IS_CLIENT) return;
    const raw = localStorage.getItem(versKeyFor(id));
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift({ id: `v_${Date.now()}`, ts: Date.now(), ...snapshot });
    localStorage.setItem(versKeyFor(id), JSON.stringify(arr.slice(0, 50)));
  } catch {}
};

/* ─────────── backend stubs ─────────── */
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

/* ─────────── options built from OPENAI_MODELS ─────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string; badge?: string; left?: React.ReactNode };

const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI', left: <BrandIcon provider="openai" /> },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon', left: <BrandIcon provider="anthropic" /> },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon', left: <BrandIcon provider="google" /> },
];

const openaiModelOpts: Opt[] = (() => {
  // Expecting OPENAI_MODELS like: [{key:'gpt-5', label:'GPT 5', badges:['Multimodal','Latest']}, ...]
  const flat = (OPENAI_MODELS ?? [])
    .flatMap((g:any) => g.models ?? g) // allow grouped or flat
    .filter(Boolean);
  if (!flat.length) {
    // sensible fallbacks (with 5/4/3 “keystrings” you demanded)
    return [
      { value: 'gpt-5', label: 'GPT 5' },
      { value: 'gpt-5-mini', label: 'GPT 5 Mini', badge: 'Mini' },
      { value: 'gpt-4.1', label: 'GPT 4.1' },
      { value: 'gpt-4o', label: 'GPT 4o Cluster', badge: 'Multimodal' },
      { value: 'gpt-4o-realtime-preview', label: 'GPT Realtime Cluster', badge: 'Realtime' },
      { value: 'gpt-3.5-turbo', label: 'GPT 3.5' },
    ];
  }
  return flat.map((m:any) => ({
    value: String(m.key || m.value || m.id),
    label: String(m.label || m.name || m.key),
    badge: Array.isArray(m.badges) && m.badges[0] ? String(m.badges[0]) : undefined,
  }));
})();

const modelOptsFor = (provider: string): Opt[] =>
  provider === 'openai'
    ? openaiModelOpts
    : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

/* TTS & ASR */
const ttsProviders: Opt[] = [
  { value: 'openai',    label: 'OpenAI', left: <BrandIcon provider="openai" /> },
  { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true, note: 'soon' },
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

/* Voices with accents (same timbre, different accents) */
const voiceOpts: Opt[] = [
  { value: 'Alloy (American)', label: 'Alloy (American)' },
  { value: 'Alloy (British)', label: 'Alloy (British)' },
  { value: 'Alloy (Australian)', label: 'Alloy (Australian)' },
  { value: 'Verse (American)', label: 'Verse (American)' },
  { value: 'Verse (British)', label: 'Verse (British)' },
  { value: 'Coral (British)', label: 'Coral (British)' },
  { value: 'Amber (Australian)', label: 'Amber (Australian)' },
];

/* ─────────── UI atoms ─────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height:28, width:50, padding:'0 6px', borderRadius:999, justifyContent:'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--input-bg))' : 'var(--input-bg)',
      border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:18, height:18, borderRadius:999,
        background: checked ? CTA : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)'
      }}
    />
  </button>
);

/* Styled select with clamped portal */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuTop,
  onPreview, isPreviewing
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
  onPreview?: (v: string) => Promise<void>;
  isPreviewing?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const menuRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{left:number; top:number; width:number} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(Math.max(220, r.width), 420);
    const vw = window.innerWidth;
    const left = Math.min(Math.max(8, r.left), vw - width - 8);
    const belowTop = r.bottom + 8;
    const maxTop = window.innerHeight - 12; // clamp bottom
    const top = Math.min(belowTop, maxTop);
    setMenuPos({ left, top, width });
  }, [open]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => setOpen(false);
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="va-select-trigger w-full flex items-center justify-between gap-3 px-3 py-3 text-sm outline-none transition"
        style={{
          background:'var(--vs-input-bg, #101314)',
          border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))',
          boxShadow:'var(--vs-input-shadow, none)',
          color:'var(--text)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          {current?.left}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && IS_CLIENT ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100020] p-3 va-portal"
          style={{
            position:'fixed',
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'var(--vs-menu-bg, #101314)',
            border:'1px solid var(--vs-menu-border, rgba(255,255,255,.16))',
            borderRadius:12,
            boxShadow:'0 28px 70px rgba(0,0,0,.60), 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)',
            maxHeight:'60vh', overflow:'auto'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-3 px-2 py-2"
            style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', boxShadow:'var(--vs-input-shadow, none)', color:'var(--text)', borderRadius:10 }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Search…"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color:'var(--text)' }}
            />
          </div>

          <div className="pr-1" style={{ scrollbarWidth:'thin' }}>
            {filtered.map(o => (
              <button
                key={o.value}
                disabled={!!o.disabled}
                onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                className="w-full text-left text-sm px-3 py-2 rounded-[8px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                style={{
                  color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                  background:'transparent',
                  border:'1px solid transparent',
                  cursor:o.disabled?'not-allowed':'pointer',
                }}
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(0,255,194,0.10)'; el.style.border = '1px solid rgba(0,255,194,0.28)'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
              >
                {o.disabled ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                <span className="truncate flex items-center gap-2">{o.left}{o.label}{o.badge ? <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded border border-[rgba(255,255,255,.16)] opacity-80">{o.badge}</span> : null}</span>
                {onPreview ? (
                  <button
                    type="button"
                    onClick={async (e)=>{ e.stopPropagation(); await onPreview(o.value); }}
                    className="w-7 h-7 rounded-full grid place-items-center"
                    style={{ border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', background:'var(--vs-input-bg, #101314)' }}
                    aria-label={isPreviewing === o.value ? 'Stop preview' : 'Play preview'}
                    title={isPreviewing === o.value ? 'Stop' : 'Play'}
                  >
                    {isPreviewing === o.value ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  </button>
                ) : <span />}
              </button>
            ))}
            {filtered.length===0 && (
              <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

/* ─────────── Section wrapper ─────────── */
function Section({
  title, icon, desc, children, defaultOpen = true
}:{
  title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const innerRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<number>(0);
  const measure = () => { if (innerRef.current) setH(innerRef.current.offsetHeight); };
  useLayoutEffect(() => { measure(); }, [children, open]);

  return (
    <div className="mb-[12px]">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>{title}</div>

      <div className="va-card">
        <button onClick={()=>setOpen(v=>!v)} className="va-head w-full text-left" style={{ color:'var(--text)' }}>
          <span className="min-w-0 flex items-center gap-3">
            <span className="inline-grid place-items-center w-7 h-7 rounded-md" style={{ background:'rgba(89,217,179,.10)' }}>
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

        <div
          style={{
            height: open ? h : 0,
            opacity: open ? 1 : 0,
            transform: open ? 'translateY(0)' : 'translateY(-4px)',
            transition: 'height 260ms var(--ease), opacity 230ms var(--ease), transform 260ms var(--ease)',
            overflow:'hidden'
          }}
          onTransitionEnd={() => { if (open) measure(); }}
        >
          <div ref={innerRef} className="p-[var(--s-5)]">{children}</div>
        </div>
      </div>
    </div>
  );
}

/* ─────────── Page ─────────── */
type ChatMsg = { id: string; role: 'user'|'assistant'|'system'; text: string };

export default function VoiceAgentSection() {
  /* align rail */
  useEffect(() => {
    if (!IS_CLIENT) return;
    const candidates = ['[data-app-sidebar]','aside[aria-label="Sidebar"]','aside[class*="sidebar"]','#sidebar'];
    const el = document.querySelector<HTMLElement>(candidates.join(', '));
    const setW = (w:number) => document.documentElement.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    if (!el) { setW(240); return; }
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width;
      setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [activeId, setActiveId] = useState<string>(() => {
    try { return IS_CLIENT ? localStorage.getItem(ACTIVE_KEY) || '' : ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [toastKind, setToastKind] = useState<'info'|'error'>('info');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // panel + transcript
  const [showCall, setShowCall] = useState(false);
  const [transcript, setTranscript] = useState<ChatMsg[]>([]);

  // Generate overlay
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'editing'|'loading'|'review'>('idle');

  // prompt diff cache
  const basePromptRef = useRef<string>('');
  const [proposedPrompt, setProposedPrompt] = useState('');
  const [changesSummary, setChangesSummary] = useState('');

  // voice preview for quick checks
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!IS_CLIENT || !('speechSynthesis' in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);
  function speakPreview(line?: string){
    if (!IS_CLIENT || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(line || `Hi, I'm ${data.name || 'your assistant'}. This is a preview.`);
    const byName = voices.find(v => v.name.toLowerCase().includes((data.voiceName || '').split(' ')[0]?.toLowerCase() || ''));
    const en = voices.find(v => v.lang?.startsWith('en'));
    if (byName) u.voice = byName; else if (en) u.voice = en;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  const stopPreview = () => { if (IS_CLIENT && 'speechSynthesis' in window) window.speechSynthesis.cancel(); };

  // rail events
  useEffect(() => {
    if (!IS_CLIENT) return;
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);
  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { if (IS_CLIENT) localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
  }, [activeId]);
  useEffect(() => { if (activeId) saveAgentData(activeId, data); }, [activeId, data]);

  // load keys (and make chosen id global)
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

  function setField<K extends keyof AgentData>(k: K) {
    return (v: AgentData[K]) => {
      setData(prev => {
        const next = { ...prev, [k]: v };
        if (k === 'name' && activeId) {
          try { if (IS_CLIENT) localStorage.setItem(keyFor(activeId), JSON.stringify(next)); } catch {}
          try { if (IS_CLIENT) window.dispatchEvent(new CustomEvent('assistant:update', { detail: { id: activeId, name: String(v) } })); } catch {}
        }
        return next;
      });
    };
  }

  const modelOpts = useMemo(()=>modelOptsFor(data.provider), [data.provider]);

  async function doSave(){
    if (!activeId) { setToastKind('error'); setToast('Select or create an agent'); return; }
    setSaving(true); setToast('');
    try { await apiSave(activeId, data); setToastKind('info'); setToast('Saved'); }
    catch { setToastKind('error'); setToast('Save failed'); }
    finally { setSaving(false); setTimeout(()=>setToast(''), 1400); }
  }
  async function doPublish(){
    if (!activeId) { setToastKind('error'); setToast('Select or create an agent'); return; }
    setPublishing(true); setToast('');
    try { await apiPublish(activeId); setToastKind('info'); setToast('Published'); }
    catch { setToastKind('error'); setToast('Publish failed'); }
    finally { setPublishing(false); setTimeout(()=>setToast(''), 1400); }
  }

  /* ─────────── REALTIME CALL LAUNCH ─────────── */
  const openCall = () => {
    const key = apiKeys.find(k => k.id === data.apiKeyId)?.key || '';
    if (!key) {
      setToastKind('error');
      setToast('Select an OpenAI API key first.');
      setTimeout(()=>setToast(''), 2200);
      return;
    }
    setTranscript([]); // clear previous call transcript
    setShowCall(true);
  };

  /* ─────────── UI ─────────── */
  const inInlineReview = genPhase === 'review' && !showGenerate;

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* rail + content */}
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(255,255,255,.06)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 pb-24 mx-auto w-full max-w-[1160px]" style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button
              onClick={openCall}
              className="inline-flex items-center gap-2 rounded-[10px] select-none"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#ffffff', fontWeight:700, boxShadow:'0 10px 22px rgba(89,217,179,.20)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <PhoneFilled style={{ color:'#ffffff' }} />
              <span style={{ color:'#ffffff' }}>Talk to Assistant</span>
            </button>
          </div>

          {toast ? (
            <div
              className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
              style={{
                background: toastKind === 'error' ? 'rgba(239,68,68,.12)' : 'rgba(89,217,179,.10)',
                color: 'var(--text)',
                boxShadow: toastKind === 'error'
                  ? '0 0 0 1px rgba(239,68,68,.25) inset'
                  : '0 0 0 1px rgba(89,217,179,.16) inset'
              }}
            >
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* MODEL */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the model, assistant name, and first message."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Assistant Name</div>
                <input
                  value={data.name}
                  onChange={(e)=>setField('name')(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[8px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  placeholder="e.g., Riley"
                />
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Provider</div>
                <StyledSelect
                  value={data.provider}
                  onChange={(v)=>setField('provider')(v as AgentData['provider'])}
                  options={providerOpts}
                  placeholder="Provider"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Model</div>
                <StyledSelect
                  value={data.model}
                  onChange={setField('model')}
                  options={modelOpts}
                  placeholder="Choose a model"
                />
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message Mode</div>
                <StyledSelect value={data.firstMode} onChange={setField('firstMode')} options={[
                  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
                  { value: 'User speaks first', label: 'User speaks first' },
                  { value: 'Silent until tool required', label: 'Silent until tool required' },
                ]}/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message</div>
                <input
                  value={data.firstMsg}
                  onChange={(e)=>setField('firstMsg')(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[8px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  placeholder="Hello."
                />
              </div>
              <div className="flex items-end">
                <div className="text-xs opacity-70 mb-2">Tip: assistant will speak first if that mode is selected.</div>
              </div>
            </div>

            {/* System Prompt + Files */}
            <div className="grid grid-cols-1 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="flex items-center justify-between mb-[var(--s-2)]">
                  <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-[8px] text-sm"
                      style={{ height:36, padding:'0 12px', background:CTA, color:'#fff', border:'1px solid rgba(255,255,255,.08)' }}
                      onClick={()=>{ setComposerText(''); setProposedPrompt(''); setChangesSummary(''); setGenPhase('editing'); setShowGenerate(true); }}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                <div style={{ position:'relative' }}>
                  {!inInlineReview ? (
                    <textarea
                      className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[12px]"
                      style={{ minHeight: 280, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                      value={data.systemPrompt}
                      onChange={(e)=> setField('systemPrompt')(e.target.value)}
                    />
                  ) : (
                    <div
                      className="rounded-[8px]"
                      style={{
                        background:'var(--input-bg)',
                        border:'1px solid var(--input-border)',
                        color:'var(--text)',
                        padding:'12px',
                      }}
                    >
                      {/* simple inline diff summary */}
                      <div className="text-xs mb-2 opacity-80">{changesSummary}</div>
                      <pre className="text-sm whitespace-pre-wrap">{proposedPrompt}</pre>
                    </div>
                  )}
                </div>

                {/* File upload under prompt */}
                <label
                  className="mt-3 inline-flex items-center gap-2 rounded-[8px] px-3 py-2 cursor-pointer"
                  style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                >
                  <Upload className="w-4 h-4" />
                  <span className="text-sm">Attach files (knowledge, FAQs, etc.)</span>
                  <input type="file" multiple className="hidden" onChange={()=>{/* wire to your backend */}} />
                </label>
              </div>
            </div>
          </Section>

          {/* VOICE */}
          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose TTS and preview the voice."
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
                    setField('apiKeyId')(val);
                    try { const store = await scopedStorage(); await store.ensureOwnerGuard(); await store.setJSON('apiKeys.selectedId', val); } catch {}
                  }}
                  options={[
                    { value: '', label: 'Select an API key…' },
                    ...apiKeys.map(k=>({ value: k.id, label: `${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}` }))
                  ]}
                  leftIcon={<KeyRound className="w-4 h-4" style={{ color: CTA }} />}
                />
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Keys are stored per-account via scoped storage.
                </div>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={(v)=>setField('voiceName')(v)}
                  options={voiceOpts}
                  placeholder="— Choose —"
                  menuTop={
                    <div className="flex items-center justify-between px-3 py-2 rounded-[8px]"
                         style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))' }}
                    >
                      <div className="text-xs" style={{ color:'var(--text-muted)' }}>Preview</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={()=>speakPreview(`This is ${data.voiceName || 'the selected'} voice preview.`)}
                          className="w-8 h-8 rounded-full grid place-items-center"
                          aria-label="Play voice"
                          style={{ background: CTA, color:'#0a0f0d' }}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={stopPreview}
                          className="w-8 h-8 rounded-full grid place-items-center border"
                          aria-label="Stop preview"
                          style={{ background: 'var(--panel-bg)', color:'var(--text)', borderColor:'var(--input-border)' }}
                        >
                          <Square className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>
          </Section>

          {/* TRANSCRIBER */}
          <Section
            title="Transcriber"
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Transcription settings"
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Provider</div>
                <StyledSelect value={data.asrProvider} onChange={(v)=>setField('asrProvider')(v as AgentData['asrProvider'])} options={asrProviders}/>
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Model</div>
                <StyledSelect value={data.asrModel} onChange={setField('asrModel')} options={asrModelsFor(data.asrProvider)}/>
              </div>
            </div>
            <div className="mt-[var(--s-4)] grid sm:grid-cols-2 gap-[12px]">
              <div className="flex items-center justify-between p-3 rounded-[8px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                <span className="text-sm">Background Denoising</span>
                <Toggle checked={data.denoise} onChange={setField('denoise')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-[8px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                <span className="text-sm">Use Numerals</span>
                <Toggle checked={data.numerals} onChange={setField('numerals')} />
              </div>
            </div>

            {/* spacer at end of the page like you asked */}
            <div className="h-10" />
          </Section>
        </div>
      </div>

      {/* ─────────── Generate overlay (no presets) ─────────── */}
      {showGenerate && IS_CLIENT ? createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
            onClick={()=>{ if (genPhase!=='loading') { setShowGenerate(false); setGenPhase('idle'); } }}
          />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: Z_MODAL }}>
            <div
              className="w-full max-w-[640px] rounded-[10px] overflow-hidden"
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: `1px solid ${GREEN_LINE}`,
                maxHeight: '86vh',
                boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)'
              }}
            >
              <div className="flex items-center justify-between px-6 py-4 va-head" style={{ minHeight:56 }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background:'var(--green-weak)' }}>
                    <Wand2 className="w-4 h-4" style={{ color: CTA }} />
                  </div>
                  <div className="text-base font-semibold">Generate Prompt</div>
                </div>
                <button
                  onClick={()=> genPhase!=='loading' && setShowGenerate(false)}
                  className="w-8 h-8 rounded-[8px] grid place-items-center"
                  style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}` }}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-3">
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Type something like “assistant for support; tone friendly; handle booking & FAQs”.
                </div>
                <div
                  className="rounded-[8px]"
                  style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}
                >
                  <textarea
                    value={composerText}
                    onChange={(e)=>setComposerText(e.target.value)}
                    className="w-full bg-transparent outline-none rounded-[8px] px-3 py-2"
                    placeholder="Describe behavior…"
                    style={{ minHeight: 160, maxHeight: '40vh', color:'var(--text)', resize:'vertical' }}
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={()=> genPhase!=='loading' && setShowGenerate(false)}
                  className="w-full h-[44px] rounded-[8px]"
                  style={{ background:'var(--panel)', border:'1px solid var(--input-border)', color:'var(--text)', fontWeight:600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={()=>{
                    const raw = safeTrim(composerText);
                    if (!raw) return;
                    try {
                      const base = nonEmpty(data.systemPrompt) ? data.systemPrompt : DEFAULT_PROMPT_RT;
                      (basePromptRef as any).current = base;
                      let merged = '';
                      let summary = '';
                      if (looksLikeFullPromptRT(raw)) {
                        const norm = normalizeFullPromptRT(raw);
                        merged = nonEmpty(norm) ? norm : base;
                        summary = 'Replaced prompt.';
                      } else {
                        const out = applyInstructionsRT(base, raw) || {};
                        merged = nonEmpty(out.merged) ? out.merged : base;
                        summary = nonEmpty(out.summary) ? out.summary : 'Updated.';
                      }
                      setShowGenerate(false);
                      setProposedPrompt(merged);
                      setChangesSummary(summary);
                      setGenPhase('review');
                      setField('systemPrompt')(merged);
                    } catch {
                      setToastKind('error');
                      setToast('Generate failed — try simpler wording.');
                      setTimeout(()=>setToast(''), 2200);
                    }
                  }}
                  disabled={!composerText.trim()}
                  className="w-full h-[44px] rounded-[8px] font-semibold inline-flex items-center justify-center gap-2"
                  style={{ background:CTA, color:'#0a0f0d', opacity: (!composerText.trim() ? .6 : 1) }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}

      {/* ─────────── Slide-in Call Panel (ONLY when opened) ─────────── */}
      {IS_CLIENT && showCall ? createPortal(
        <>
          {/* dark scrim */}
          <div
            className="fixed inset-0"
            style={{ zIndex: Z_PANEL, background:'rgba(8,10,12,.78)' }}
            onClick={()=> setShowCall(false)}
          />
          {/* right panel */}
          <div
            className="fixed right-0 top-0 h-screen w-[min(520px,100%)]"
            style={{
              zIndex: Z_PANEL + 1,
              background:'var(--panel-bg)',
              borderLeft:'1px solid rgba(255,255,255,.10)',
              boxShadow:'-20px 0 40px rgba(0,0,0,.35)'
            }}
            role="dialog"
            aria-label="Assistant Call"
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-[rgba(255,255,255,.08)]">
              <div className="font-semibold">Assistant Call</div>
              <button
                onClick={()=> setShowCall(false)}
                className="w-8 h-8 rounded-md grid place-items-center"
                style={{ border:'1px solid rgba(255,255,255,.14)' }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Transcript */}
            <div className="p-4 grid gap-3" style={{ height:'calc(100vh - 56px)' }}>
              <div className="text-xs opacity-70 flex items-center gap-2">
                <MessageSquareText className="w-3.5 h-3.5" />
                Live transcript
              </div>
              <div className="flex-1 overflow-auto rounded-md p-3" style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)' }}>
                {transcript.length === 0 ? (
                  <div className="text-sm opacity-70">Say hello! We’ll show the transcript here.</div>
                ) : (
                  <ul className="space-y-2">
                    {transcript.map(m=>(
                      <li key={m.id} className="text-sm">
                        <span className="opacity-70 mr-2">{m.role === 'assistant' ? 'AI:' : 'You:'}</span>
                        <span>{m.text}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* WebCallButton embeds the actual realtime call */}
              <div className="rounded-md border border-[rgba(255,255,255,.12)] p-3">
                <WebCallButton
                  model={data.model}                               // not forced to 4o realtime anymore
                  systemPrompt={data.systemPrompt}
                  voiceName={data.voiceName}
                  assistantName={data.name || 'Assistant'}
                  apiKey={apiKeys.find(k => k.id === data.apiKeyId)?.key || ''}
                  firstMode={data.firstMode}
                  firstMsg={data.firstMsg}
                  onTranscript={(text:string, role:'user'|'assistant'='assistant')=>{
                    setTranscript(t => t.concat([{ id: `${Date.now()}_${Math.random()}`, role, text }]));
                  }}
                  onClose={()=> setShowCall(false)}
                />
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}
    </section>
  );
}
