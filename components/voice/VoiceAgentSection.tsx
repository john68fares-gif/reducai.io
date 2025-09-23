// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, X
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

// ✅ real ephemeral route
const EPHEMERAL_TOKEN_ENDPOINT = '/api/voice/ephemeral';

/* ─────────── theme + layout tokens ─────────── */
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';
const Z_OVERLAY = 100000;
const Z_MODAL   = 100001;
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

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

/* small phone icon */
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

/* OpenAI logo (tiny) */
function OpenAIStamp({size=14}:{size?:number}) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <path
        d="M37.532 16.37a8.9 8.9 0 00-.77-7.3 8.96 8.96 0 00-11.87-3.42A8.99 8.99 0 007.53 9.63a8.9 8.9 0 00.77 7.3 8.96 8.96 0 0011.87 3.42 8.99 8.99 0 0017.36-3.99z"
        fill="currentColor" opacity=".18"
      />
      <path d="M20.5 6.5l-8 4.6v9.3l8 4.6 8-4.6v-9.3l-8-4.6z" fill="currentColor" />
    </svg>
  );
}

/* ─────────── tiny helpers ─────────── */
const isFn = (f: any): f is Function => typeof f === 'function';
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const coerceStr = (v: any): string => (isStr(v) ? v : '');
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');

/* ─────────── theme tokens (less rounded, tighter controls) ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;

      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:8px;
      --radius-inner:8px;
      --control-h:40px;
      --header-h:80px;

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
      --card-shadow:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${GREEN_LINE};
      --green-weak: rgba(89,217,179,.12);
      --red-weak: rgba(239,68,68,.14);
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
      padding:0 16px; border-bottom:1px solid rgba(255,255,255,.08); color:var(--text);
      background:linear-gradient(90deg,var(--panel-bg) 0%,color-mix(in oklab, var(--panel-bg) 97%, white 3%) 50%,var(--panel-bg) 100%);
      border-top-left-radius:var(--radius-outer);
      border-top-right-radius:var(--radius-outer);
    }
  `}</style>
);

/* ─────────── types / storage ─────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;

  // CHANGED — greetings
  firstMode: string;
  firstMsg: string;                 // legacy single
  firstMsgs?: string[];             // NEW up to 20
  greetPick?: 'sequence'|'random';  // NEW

  // prompts (frontend + backend)
  systemPrompt: string;
  systemPromptBackend?: string;
  language?: string;

  // NEW — uploaded/entered context that the AI should use
  contextText?: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;
  apiKeyId?: string;

  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
};

const BLANK_TEMPLATE_NOTE =
  'This is a blank template with minimal defaults. You can change the model and messages, or click Generate to tailor the prompt to your business.';

const PROMPT_SKELETON =
`[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

/* ─────────── prompt engine (dual-layer) ─────────── */
import {
  DEFAULT_PROMPT as _DEFAULT_PROMPT,
  looksLikeFullPrompt as _looksLikeFullPrompt,
  normalizeFullPrompt as _normalizeFullPrompt,
  applyInstructions as _applyInstructions,
  compilePrompt
} from '@/lib/prompt-engine';

const looksLikeFullPromptRT = (raw: string) =>
  isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : false;

const normalizeFullPromptRT = (raw: string) =>
  isFn(_normalizeFullPrompt) ? coerceStr(_normalizeFullPrompt(raw)) : raw;

const DEFAULT_PROMPT_RT = nonEmpty(_DEFAULT_PROMPT) ? _DEFAULT_PROMPT! : PROMPT_SKELETON;

/* ─────────── defaults ─────────── */
const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'gpt-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: '',                 // CHANGED — blank by default
  firstMsgs: [''],              // NEW — blank list starter
  greetPick: 'sequence',        // NEW
  systemPrompt:
    (normalizeFullPromptRT(`
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
`).trim() + '\n\n' + `# ${BLANK_TEMPLATE_NOTE}\n`),
  systemPromptBackend: '',
  contextText: '',              // NEW
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

// NEW — migrate old saved data safely
function migrateAgent(d: AgentData): AgentData {
  const msgs = Array.isArray(d.firstMsgs) ? d.firstMsgs : [d.firstMsg ?? ''];
  return {
    ...d,
    firstMsg: d.firstMsg ?? '',
    firstMsgs: msgs.slice(0, 20),
    greetPick: d.greetPick || 'sequence',
    contextText: typeof d.contextText === 'string' ? d.contextText : '',
  };
}

const loadAgentData = (id: string): AgentData => {
  try {
    const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null;
    if (raw) return migrateAgent({ ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) });
  } catch {}
  return migrateAgent({ ...DEFAULT_AGENT });
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

/* ─────────── mock backend (save/publish) ─────────── */
async function apiSave(agentId: string, payload: AgentData){
  const r = await fetch(`/api/voice/agent/${agentId}/save`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  }).catch(()=>null as any);
  if (!r?.ok) throw new Error('Save failed');
  return r.json();
}
async function apiPublish(agentId: string){
  const r = await fetch(`/api/voice/agent/${agentId}/publish`, { method: 'POST' }).catch(()=>null as any);
  if (!r?.ok) throw new Error('Publish failed');
  return r.json();
}

/* ─────────── option helpers ─────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string; iconLeft?: React.ReactNode };

const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI',    iconLeft: <OpenAIStamp size={14} /> },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon' },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon' },
];

/** Fetch OpenAI models (labels) once an API key is chosen. */
function useOpenAIModels(selectedKey: string|undefined){
  const [opts, setOpts] = useState<Opt[]>([
    { value: 'gpt-5', label: 'GPT-5' },
    { value: 'gpt-5-mini', label: 'GPT-5 Mini' },
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4.1-mini', label: 'GPT-4.1 Mini' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { value: 'o4', label: 'o4' },
    { value: 'o4-mini', label: 'o4 Mini' },
    { value: 'gpt-4o-realtime-preview', label: 'GPT-4o Realtime Preview' },
    { value: 'gpt-4o-realtime-preview-mini', label: 'GPT-4o Realtime Preview Mini' },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!selectedKey) return;
      setLoading(true);
      try {
        const r = await fetch('/api/openai/models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: selectedKey }),
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        const models = Array.isArray(j?.models) ? j.models : [];
        if (!aborted && models.length) {
          setOpts(models.map((m:any) => ({ value: String(m.value), label: String(m.label) })));
        }
      } catch {
        // keep defaults on failure
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => { aborted = true; };
  }, [selectedKey]);

  return { opts, loading };
}

const ttsProviders: Opt[] = [
  { value: 'openai',    label: 'OpenAI', iconLeft: <OpenAIStamp size={14} /> },
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

/* ─────────── UI atoms ─────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height:26, width:46, padding:'0 6px', borderRadius:999, justifyContent:'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--input-bg))' : 'var(--input-bg)',
      border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:16, height:16, borderRadius:999,
        background: checked ? CTA : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?20:0}px)`, transition:'transform .18s var(--ease)'
      }}
    />
  </button>
);

/* ─────────── Styled select with portal (leaner look, icons in menu) ─────────── */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuTop
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
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
    setMenuPos({ left: r.left, top: r.bottom + 8, width: r.width });
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
    const onResize = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ left: r.left, top: r.bottom + 8, width: r.width });
    };
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
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] text-sm outline-none transition"
        style={{
          height:'var(--control-h)',
          background:'var(--vs-input-bg, #101314)',
          border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))',
          color:'var(--text)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && IS_CLIENT ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100020] p-2 va-portal"
          style={{
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'var(--vs-menu-bg, #101314)',
            border:'1px solid var(--vs-menu-border, rgba(255,255,255,.16))',
            borderRadius:10,
            boxShadow:'0 24px 64px rgba(0,0,0,.60), 0 8px 20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[8px]"
            style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', color:'var(--text)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color:'var(--text)' }}
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
            {filtered.map(o => (
              <button
                key={o.value}
                disabled={!!o.disabled}
                onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                className="w-full text-left text-sm px-2.5 py-2 rounded-[8px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                style={{
                  color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                  background:'transparent',
                  border:'1px solid transparent',
                  cursor:o.disabled?'not-allowed':'pointer',
                }}
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(0,255,194,0.08)'; el.style.border = '1px solid rgba(0,255,194,0.25)'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
              >
                {o.disabled ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5">
                    {o.iconLeft || <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                  </span>
                )}
                <span className="truncate">{o.label}</span>
                <span />
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

/* ─────────── Diff helpers (unchanged) ─────────── */
function computeDiff(base:string, next:string){
  const a = (base || '').split('\n');
  const b = (next || '').split('\n');
  const setA = new Set(a);
  const setB = new Set(b);
  const rows: Array<{t:'same'|'add'|'rem', text:string}> = [];
  const max = Math.max(a.length, b.length);
  for (let i=0;i<max;i++){
    const la = a[i]; const lb = b[i];
    if (la === lb && la !== undefined){ rows.push({ t:'same', text: la! }); continue; }
    if (lb !== undefined && !setA.has(lb)) rows.push({ t:'add', text: lb });
    if (la !== undefined && !setB.has(la)) rows.push({ t:'rem', text: la });
  }
  for (let j=a.length;j>b.length;j++){
    const la=a[j]; if (la!==undefined && !setB.has(la)) rows.push({ t:'rem', text: la });
  }
  for (let j=a.length;j<b.length;j++){
    const lb=b[j]; if (lb!==undefined && !setA.has(lb)) rows.push({ t:'add', text: lb });
  }
  return rows;
}

function DiffInline({ base, next }:{ base:string; next:string }){
  const rows = computeDiff(base, next);
  return (
    <pre
      className="rounded-[8px] px-3 py-3 text-sm"
      style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)', whiteSpace:'pre-wrap', lineHeight:'1.55' }}
    >
      {rows.map((r, i) => {
        if (r.t === 'same') return <span key={i}>{(r.text || ' ') + '\n'}</span>;
        if (r.t === 'add') return (
          <span
            key={i}
            style={{ background:'rgba(89,217,179,.12)', borderLeft:'3px solid '+CTA, display:'block', padding:'2px 6px', borderRadius:6, margin:'2px 0' }}
          >{(r.text || ' ') + '\n'}</span>
        );
        return (
          <span
            key={i}
            style={{ background:'rgba(239,68,68,.14)', borderLeft:'3px solid #ef4444', display:'block', padding:'2px 6px', borderRadius:6, margin:'2px 0', textDecoration:'line-through', opacity:.9 }}
          >{(r.text || ' ') + '\n'}</span>
        );
      })}
    </pre>
  );
}

/* ─────────── helpers for file context (NEW) ─────────── */
async function readFileAsText(f: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Read failed'));
    r.onload = () => res(String(r.result || ''));
    r.readAsText(f);
  });
}

/* ─────────── Page ─────────── */
type ChatMsg = { id: string; role: 'user'|'assistant'|'system'; text: string };

export default function VoiceAgentSection() {
  /* align rail to app sidebar */
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

  const [showCall, setShowCall] = useState(false);

  // Generate overlay
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'editing'|'loading'|'review'>('idle');

  // typing inside prompt box
  const basePromptRef = useRef<string>('');
  const [proposedPrompt, setProposedPrompt] = useState('');
  const [changesSummary, setChangesSummary] = useState('');

  // NEW — typing animation state for overlay preview
  const [typingPreview, setTypingPreview] = useState('');     // what we “type” on screen
  const typingTimerRef = useRef<number | null>(null);

  // models list (live from API when key selected)
  const selectedKey = apiKeys.find(k => k.id === data.apiKeyId)?.key;
  const { opts: openaiModels, loading: loadingModels } = useOpenAIModels(selectedKey);

  // TTS preview using browser speech synthesis (quick check)
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

  /* listen for active rail id */
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

  // load keys (best effort)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const store = await scopedStorage().catch(() => null);
        if (!mounted) return;
        if (!store) { setApiKeys([]); return; }

        store.ensureOwnerGuard?.().catch(() => {});

        const v1 = await store.getJSON<ApiKey[]>('apiKeys.v1', []).catch(() => []);
        const legacy = await store.getJSON<ApiKey[]>('apiKeys', []).catch(() => []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];

        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter((k) => k.id && k.name);

        if (!mounted) return;
        setApiKeys(cleaned);

        // select a key if none set
        const globalSelected = await store.getJSON<string>('apiKeys.selectedId', '').catch(() => '');
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        if (chosen && chosen !== data.apiKeyId) {
          setData(prev => ({ ...prev, apiKeyId: chosen }));
          await store.setJSON('apiKeys.selectedId', chosen).catch(() => {});
        }
      } catch {
        if (!mounted) return;
        setApiKeys([]);
      }
    })();
    return () => { mounted = false; };
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

  /* file context importer (NEW) */
  const importFilesAsContext = async (files: File[]) => {
    if (!files?.length) return;
    const allow = new Set([
      'text/plain','text/markdown','text/csv','application/json'
    ]);
    const okExt = (n:string)=>/\.(txt|md|csv|json)$/i.test(n);
    let merged = '';
    for (const f of files) {
      if (!allow.has(f.type) && !okExt(f.name)) continue;
      try {
        const txt = await readFileAsText(f);
        merged += `\n\n# File: ${f.name}\n${String(txt || '').trim()}\n`;
      } catch {}
    }
    if (merged.trim()) {
      setField('contextText')(
        ((data.contextText || '') + '\n' + merged).trim()
      );
    }
  };

  /* ─────────── CALL MODEL (fallback to RT if needed) ─────────── */
  const callModel = useMemo(() => {
    const m = (data.model || '').toLowerCase();
    if (m.includes('realtime')) return data.model;
    return 'gpt-4o-realtime-preview';
  }, [data.model]);

  // what label to show user in UI (their selection)
  const selectedModelLabel = useMemo(() => {
    const found = openaiModels.find(o => o.value === data.model);
    return found?.label || data.model || '—';
  }, [openaiModels, data.model]);

  // inline review?
  const inInlineReview = genPhase === 'review' && !showGenerate;

  /* ─────────── UI ─────────── */
  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* rail + content */}
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(255,255,255,.06)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]" style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>
          {/* Top actions */}
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <div className="mr-auto text-xs opacity-70 pl-1">
              Model selected: <span className="opacity-100">{selectedModelLabel}</span>
            </div>

            <button
              onClick={()=>{
                const key = apiKeys.find(k => k.id === data.apiKeyId)?.key || '';
                if (!key) {
                  setToastKind('error'); setToast('Select an OpenAI API key first.');
                  setTimeout(()=>setToast(''), 2200);
                  return;
                }
                setShowCall(true);
              }}
              className="inline-flex items-center gap-2 rounded-[8px] select-none"
              style={{ height:'var(--control-h)', padding:'0 16px', background:CTA, color:'#ffffff', fontWeight:700, boxShadow:'0 10px 22px rgba(89,217,179,.20)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <PhoneFilled style={{ color:'#ffffff' }} />
              <span style={{ color:'#ffffff' }}>Talk to Assistant</span>
            </button>
          </div>

          {toast ? (
            <div
              className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
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

          {/* Metrics */}
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Cost</div><div />
              </div>
              <div className="p-4">
                <div className="font-semibold" style={{ fontSize:'15px' }}>~$0.1/min</div>
              </div>
            </div>
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Latency</div><div />
              </div>
              <div className="p-4">
                <div className="font-semibold" style={{ fontSize:'15px' }}>~1050 ms</div>
              </div>
            </div>
          </div>

          {/* Model config */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the model, assistant name, and first message(s)."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Assistant Name</div>
                <input
                  value={data.name}
                  onChange={(e)=>setField('name')(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[8px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
                  placeholder="e.g., Riley"
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">Provider</div>
                <StyledSelect value={data.provider} onChange={(v)=>setField('provider')(v as AgentData['provider'])} options={providerOpts}
                  placeholder="Choose a provider" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <div className="mb-2 text-[12.5px]">Model</div>
                <StyledSelect
                  value={data.model}
                  onChange={setField('model')}
                  options={openaiModels}
                  placeholder={loadingModels ? 'Loading models…' : 'Choose a model'}
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">First Message Mode</div>
                <StyledSelect value={data.firstMode} onChange={setField('firstMode')} options={[
                  { value: 'Assistant speaks first', label: 'Assistant speaks first' },
                  { value: 'User speaks first', label: 'User speaks first' },
                  { value: 'Silent until tool required', label: 'Silent until tool required' },
                ]}/>
              </div>
            </div>

            {/* NEW — Multi greetings editor */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium" style={{ fontSize:'12.5px' }}>First Messages (one per line, max 20)</div>
                  <StyledSelect
                    value={data.greetPick || 'sequence'}
                    onChange={(v)=>setField('greetPick')(v as AgentData['greetPick'])}
                    options={[
                      { value: 'sequence', label: 'Play in order' },
                      { value: 'random',   label: 'Randomize'   },
                    ]}
                  />
                </div>
                <textarea
                  value={(Array.isArray(data.firstMsgs) ? data.firstMsgs : [data.firstMsg || '']).join('\n')}
                  onChange={(e)=>{
                    const arr = e.target.value.split('\n').map(s=>s.trim()).slice(0,20);
                    setField('firstMsgs')(arr);
                    setField('firstMsg')(arr[0] || ''); // keep legacy in sync
                  }}
                  className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[10px]"
                  style={{ minHeight: 120, background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
                  placeholder="(leave empty for silence)…"
                />
              </div>
            </div>

            {/* Prompt + Generate */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium" style={{ fontSize:'12.5px' }}>System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-[8px] text-sm"
                      style={{ height:34, padding:'0 12px', background:CTA, color:'#fff', border:'1px solid rgba(255,255,255,.08)' }}
                      onClick={()=>{
                        setComposerText('');
                        setProposedPrompt('');
                        setTypingPreview('');
                        setChangesSummary('');
                        setGenPhase('editing');
                        setShowGenerate(true);
                      }}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                <div style={{ position:'relative' }}>
                  {!inInlineReview ? (
                    <textarea
                      className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[10px]"
                      style={{ minHeight: 320, background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
                      value={data.systemPrompt}
                      onChange={(e)=> setField('systemPrompt')(e.target.value)}
                    />
                  ) : (
                    <div
                      className="rounded-[8px]"
                      style={{
                        background:'var(--panel)',
                        border:'1px solid rgba(255,255,255,.10)',
                        color:'var(--text)',
                        padding:'12px',
                        maxHeight:'unset'
                      }}
                    >
                      <DiffInline base={basePromptRef.current} next={proposedPrompt}/>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="h-9 px-3 rounded-[8px] font-semibold"
                          style={{ background:CTA, color:'#0a0f0d' }}
                          onClick={()=>{
                            setField('systemPrompt')(proposedPrompt);
                            const compiled = compilePrompt({ basePrompt: proposedPrompt, userText: '' });
                            setField('systemPromptBackend')(compiled.backendString);
                            setGenPhase('idle');
                          }}
                        >
                          Apply
                        </button>
                        <button
                          className="h-9 px-3 rounded-[8px]"
                          style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)' }}
                          onClick={()=> setGenPhase('idle')}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* NEW — Context upload + preview */}
                <div className="mt-3">
                  <div className="mb-2 text-[12.5px] font-medium">Context (optional)</div>
                  <div
                    onDragOver={(e)=>{ e.preventDefault(); }}
                    onDrop={async (e)=>{ e.preventDefault(); const files = Array.from(e.dataTransfer.files || []); await importFilesAsContext(files); }}
                    className="rounded-[8px] px-3 py-3 text-sm"
                    style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        id="ctx-file"
                        type="file"
                        multiple
                        accept=".txt,.md,.csv,.json,text/plain,text/markdown,text/csv,application/json"
                        className="hidden"
                        onChange={async (e)=>{ const files = Array.from(e.target.files || []); await importFilesAsContext(files); e.currentTarget.value=''; }}
                      />
                      <label
                        htmlFor="ctx-file"
                        className="inline-flex items-center gap-2 rounded-[8px] px-3 py-1.5 cursor-pointer"
                        style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.14)' }}
                      >
                        Upload files
                      </label>
                      <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                        Drop or choose .txt / .md / .csv / .json (merged into a [Context] section)
                      </span>
                      <div className="ml-auto flex gap-2">
                        <button
                          type="button"
                          className="text-xs rounded-[8px] px-2 py-1"
                          style={{ border:'1px solid rgba(255,255,255,.14)', background:'var(--panel)' }}
                          onClick={()=> setField('contextText')('')}
                        >
                          Clear context
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs mb-1" style={{ color:'var(--text-muted)' }}>
                        Context preview (trimmed):
                      </div>
                      <textarea
                        value={(data.contextText || '').slice(0, 4000)}
                        onChange={(e)=> setField('contextText')(e.target.value)}
                        className="w-full bg-transparent outline-none rounded-[8px] px-3 py-2"
                        style={{ minHeight: 120, background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)', resize:'vertical' }}
                        placeholder="(empty)"
                      />
                      <div className="mt-1 text-[11px]" style={{ color:'var(--text-muted)' }}>
                        {Math.min((data.contextText || '').length, 4000)} / {(data.contextText || '').length} chars shown
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Context */}
              </div>
            </div>
          </Section>

          {/* Voice */}
          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose TTS and preview the voice."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 opacity-80" /> OpenAI API Key
                </div>
                <StyledSelect
                  value={data.apiKeyId || ''}
                  onChange={async (val)=>{
                    setField('apiKeyId')(val);
                    try { const store = await scopedStorage(); await store.ensureOwnerGuard?.(); await store.setJSON('apiKeys.selectedId', val); } catch {}
                  }}
                  options={[
                    { value: '', label: 'Select an API key…', iconLeft: <OpenAIStamp size={14} /> },
                    ...apiKeys.map(k=>({ value: k.id, label: `${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}`, iconLeft: <OpenAIStamp size={14} /> }))
                  ]}
                  leftIcon={<OpenAIStamp size={14} />}
                />
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Keys are stored per-account via scoped storage. Manage them in the API Keys page.
                </div>
              </div>

              <div>
                <div className="mb-2 text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={(v)=>setField('voiceName')(v)}
                  options={[
                    { value: 'Alloy (American)', label: 'Alloy' },
                    { value: 'Verse (American)', label: 'Verse' },
                    { value: 'Coral (British)', label: 'Coral' },
                    { value: 'Amber (Australian)', label: 'Amber' },
                  ]}
                  placeholder="— Choose —"
                  menuTop={
                    <div className="flex items-center justify-between px-3 py-2 rounded-[8px]"
                         style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)' }}
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
                          style={{ background: 'var(--panel)', color:'var(--text)', borderColor:'rgba(255,255,255,.10)' }}
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

          {/* Transcriber */}
          <Section
            title="Transcriber"
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Transcription settings"
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Provider</div>
                <StyledSelect value={data.asrProvider} onChange={(v)=>setField('asrProvider')(v as AgentData['asrProvider'])} options={asrProviders}/>
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">Model</div>
                <StyledSelect value={data.asrModel} onChange={setField('asrModel')} options={asrModelsFor(data.asrProvider)}/>
              </div>
            </div>
            <div className="mt-4 grid sm:grid-cols-2 gap-3">
              <div className="flex items-center justify-between p-3 rounded-[8px]" style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)' }}>
                <span className="text-sm">Background Denoising</span>
                <Toggle checked={data.denoise} onChange={setField('denoise')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-[8px]" style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)' }}>
                <span className="text-sm">Use Numerals</span>
                <Toggle checked={data.numerals} onChange={setField('numerals')} />
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* ─────────── Generate overlay (with typing animation) ─────────── */}
      {showGenerate && IS_CLIENT ? createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
            onClick={()=>{ if (genPhase!=='loading') { setShowGenerate(false); setGenPhase('idle'); } }}
          />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: Z_MODAL }}>
            <div
              className="w-full max-w-[640px] rounded-[8px] overflow-hidden"
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: `1px solid ${GREEN_LINE}`,
                maxHeight: '86vh',
                boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)'
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{
                  background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
                  borderBottom:`1px solid ${GREEN_LINE}`
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background:'rgba(89,217,179,.12)' }}>
                    <span style={{ color: CTA }}>
                      <Wand2 className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="text-lg font-semibold">
                    {genPhase==='loading' ? 'Generating…' : 'Generate Prompt'}
                  </div>
                </div>
                <button
                  onClick={()=> genPhase!=='loading' && setShowGenerate(false)}
                  className="w-8 h-8 rounded-[6px] grid place-items-center"
                  style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}` }}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="px-6 py-5 space-y-3">
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Tip: type “assistant for a dental clinic; tone friendly; handle booking and FAQs”.
                </div>

                {/* Editor */}
                {genPhase!=='loading' && (
                  <div
                    className="rounded-[8px]"
                    style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)' }}
                  >
                    <textarea
                      value={composerText}
                      onChange={(e)=>setComposerText(e.target.value)}
                      className="w-full bg-transparent outline-none rounded-[8px] px-3 py-2"
                      placeholder="Describe your business and how the assistant should behave…"
                      style={{ minHeight: 160, maxHeight: '40vh', color:'var(--text)', resize:'vertical' }}
                    />
                  </div>
                )}

                {/* Typing animation preview */}
                {genPhase==='loading' && (
                  <div
                    className="rounded-[8px] px-3 py-3 text-sm"
                    style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', minHeight: 160, whiteSpace:'pre-wrap' }}
                  >
                    {typingPreview || '…'}
                    <span className="animate-pulse">▌</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-6 flex gap-3">
                {genPhase!=='loading' ? (
                  <>
                    <button
                      onClick={()=> { setShowGenerate(false); setGenPhase('idle'); }}
                      className="w-full h-[40px] rounded-[8px]"
                      style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)', fontWeight:600 }}
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

                          const compiled = compilePrompt({ basePrompt: base, userText: raw });

                          // visual typing animation of the FULL frontend prompt (not just [Identity])
                          setGenPhase('loading');
                          setProposedPrompt(compiled.frontendText);
                          setChangesSummary(compiled.summary || 'Updated.');

                          let i = 0;
                          const text = compiled.frontendText;
                          setTypingPreview('');
                          if (typingTimerRef.current) cancelAnimationFrame(typingTimerRef.current as any);
                          const step = () => {
                            i += Math.max(1, Math.round(text.length / 120)); // ~120 steps
                            setTypingPreview(text.slice(0, i));
                            if (i < text.length) {
                              typingTimerRef.current = requestAnimationFrame(step);
                            } else {
                              // when done typing, move to review and apply inlined diff view
                              setGenPhase('review');
                              // also set both fields so it's ready if user applies
                              setField('systemPrompt')(compiled.frontendText);
                              setField('systemPromptBackend')(compiled.backendString);
                            }
                          };
                          typingTimerRef.current = requestAnimationFrame(step);
                        } catch {
                          setToastKind('error');
                          setToast('Generate failed — try simpler wording.');
                          setTimeout(()=>setToast(''), 2200);
                        }
                      }}
                      disabled={!composerText.trim()}
                      className="w-full h-[40px] rounded-[8px] font-semibold inline-flex items-center justify-center gap-2"
                      style={{ background:CTA, color:'#0a0f0d', opacity: (!composerText.trim() ? .6 : 1) }}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </>
                ) : (
                  <button
                    onClick={()=>{
                      if (typingTimerRef.current) cancelAnimationFrame(typingTimerRef.current as any);
                      setGenPhase('review');
                    }}
                    className="w-full h-[40px] rounded-[8px]"
                    style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)', fontWeight:600 }}
                  >
                    Skip typing
                  </button>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}

      {/* ─────────── Voice/Call panel (WebRTC) ─────────── */}
      {IS_CLIENT ? createPortal(
        <>
          <div
            className={`fixed inset-0 ${showCall ? '' : 'pointer-events-none'}`}
            style={{
              zIndex: 9996,
              background: showCall ? 'rgba(8,10,12,.78)' : 'transparent',
              opacity: showCall ? 1 : 0,
              transition: 'opacity .2s cubic-bezier(.22,.61,.36,1)'
            }}
            onClick={()=> setShowCall(false)}
          />
          {showCall && (
            <WebCallButton
              model={callModel}
              systemPrompt={
                (() => {
                  const base = data.systemPromptBackend || data.systemPrompt || '';
                  const ctx  = (data.contextText || '').trim();
                  return ctx ? `${base}\n\n[Context]\n${ctx}`.trim() : base;
                })()
              }
              voiceName={data.voiceName}
              assistantName={data.name || 'Assistant'}
              apiKey={selectedKey || ''}

              ephemeralEndpoint={EPHEMERAL_TOKEN_ENDPOINT}
              onError={(err:any) => {
                const msg = err?.message || err?.error?.message || (typeof err === 'string' ? err : '') || 'Call failed';
                setToastKind('error'); setToast(msg);
              }}
              onClose={()=> setShowCall(false)}
              prosody={{
                fillerWords: true,
                microPausesMs: 200,
                phoneFilter: true,
                turnEndPauseMs: 120,
              }}

              // NEW — greetings: blank default; up to 20; random/sequence
              firstMode={data.firstMode as any}
              firstMsg={
                (data.greetPick==='random'
                  ? [...(data.firstMsgs||[''])].filter(Boolean).sort(()=>Math.random()-0.5)
                  : (data.firstMsgs||['']).filter(Boolean)
                ).join('\n')
              }
            />
          )}
        </>,
        document.body
      ) : null}
    </section>
  );
}

/* ─────────── Section (expand anim) ─────────── */
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
    <div className="mb-3">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>{title}</div>

      <div className="va-card">
        <button onClick={()=>setOpen(v=>!v)} className="va-head w-full text-left" style={{ color:'var(--text)' }}>
          <span className="min-w-0 flex items-center gap-3">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full" style={{ background:'rgba(89,217,179,.12)' }}>
              {icon}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold truncate" style={{ fontSize:'18px' }}>{title}</span>
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
          <div ref={innerRef} className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
