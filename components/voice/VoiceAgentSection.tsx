'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, Pause, X, UploadCloud, FileText
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

/* ───────── models: source of truth ─────────
   Expected export from pages/api/openai/models.ts:

   export type UiModel = {
     id: string;          // keystring sent to API
     label: string;       // "GPT 5", "GPT 4.1", …
     family: 'gpt-5'|'gpt-4o'|'gpt-4.1'|'gpt-3.5'|'o3'|'o4-mini'|string;
     tags?: string[];     // ["Multimodal","Latest"]
     realtime?: boolean;  // true if it supports Realtime
     tts?: boolean;       // voice built-in
     icon?: 'openai' | string;
   }

   export const openaiModels: UiModel[] = [...]
*/

let openaiModelsImport: any = null;
try {
  // Import from your required file
  openaiModelsImport = require('@/pages/api/openai/models');
} catch { /* SSR/route alias safety */ }

type UiModel = {
  id: string;
  label: string;
  family?: string;
  tags?: string[];
  realtime?: boolean;
  tts?: boolean;
  icon?: 'openai' | string;
};

// fallback if import fails (keeps 5/4/3 keys & realtime siblings)
const FALLBACK_OPENAI_MODELS: UiModel[] = [
  { id: 'gpt-5',            label: 'GPT 5',          family: 'gpt-5',   tags: ['Multimodal','Latest'], icon:'openai' },
  { id: 'gpt-5-mini',       label: 'GPT 5 Mini',     family: 'gpt-5',   tags: ['Mini'],                icon:'openai' },
  { id: 'gpt-4.1',          label: 'GPT 4.1',        family: 'gpt-4.1', tags: ['Multimodal'],          icon:'openai' },
  { id: 'gpt-4o',           label: 'GPT 4o',         family: 'gpt-4o',  tags: ['Multimodal','Standard'], icon:'openai' },
  { id: 'gpt-4o-mini',      label: 'GPT 4o Mini',    family: 'gpt-4o',  tags: ['Mini'],                icon:'openai' },

  // realtime siblings you actually call with
  { id: 'gpt-4o-realtime',  label: 'GPT 4o Realtime', family: 'gpt-4o', tags: ['Realtime'], realtime:true, tts:true, icon:'openai' },
  { id: 'gpt-4o-mini-rt',   label: 'GPT 4o Mini RT',  family: 'gpt-4o', tags: ['Realtime','Mini','Preview'], realtime:true, tts:true, icon:'openai' },
];

const OPENAI_MODELS: UiModel[] =
  (openaiModelsImport?.openaiModels as UiModel[]) ||
  (openaiModelsImport?.default as UiModel[]) ||
  FALLBACK_OPENAI_MODELS;

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
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

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

/* OpenAI logo */
const OpenAiLogo = ({className, size=14}:{className?:string; size?:number}) => (
  <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
    <path fill="currentColor" d="M32 6c7.6 0 14.1 4.9 16.4 11.7c6.3 1 11.2 6.4 11.6 12.9c.4 7.7-5.3 14.3-12.8 15.3C45.6 53.5 39.3 58 32 58c-7.7 0-14.2-4.9-16.5-11.8C9.3 45.1 4.4 39.6 4 33.1C3.6 25.4 9.3 18.8 16.8 17.8C18.4 11.2 24.6 6 32 6z"/>
  </svg>
);

/* ─────────── little helpers ─────────── */
const isFn = (f: any): f is Function => typeof f === 'function';
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');

/* ─────────── theme tokens ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;

      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:10px;
      --control-h:44px; --header-h:88px;
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
      --green-strong: rgba(89,217,179,.22);

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
  `}</style>
);

/* ─────────── types / storage ─────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;                // id of model (from OPENAI_MODELS)
  firstMode: 'Assistant speaks first'|'User speaks first'|'Silent until tool required';
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

const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: OPENAI_MODELS[0]?.id || 'gpt-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt: `[Identity]
- You are a helpful, professional AI assistant for this business.

[Style]
- Clear, concise, friendly.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.

[Task & Goals]
- Guide users to their next best action (booking, purchase, or escalation).

[Error Handling / Fallback]
- If unsure, ask a specific clarifying question first.
`,
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

/* ─────────── storage helpers ─────────── */
const loadAgentData = (id: string): AgentData => {
  try { const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null; if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => { try { if (IS_CLIENT) localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {} };

/* ─────────── option helpers ─────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string; left?: React.ReactNode; meta?: React.ReactNode };

const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI', left: <OpenAiLogo className="opacity-90" /> },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon' },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon' },
];

const openAiModelOpts: Opt[] = OPENAI_MODELS.map(m => ({
  value: m.id,
  label: m.label,
  left: <OpenAiLogo className="opacity-90" />,
  meta: (
    <div className="flex gap-1 justify-end">
      {(m.tags || []).map(t => (
        <span key={t} className="text-[10px] px-1.5 py-0.5 rounded border border-[rgba(255,255,255,.12)] opacity-80">{t}</span>
      ))}
    </div>
  )
}));

const ttsProviders: Opt[] = [
  { value: 'openai',    label: 'OpenAI', left: <OpenAiLogo className="opacity-90" /> },
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

/* ─────────── Styled select (less rounded + viewport clamp) ─────────── */
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
    const vw = window.innerWidth;
    const left = Math.min(Math.max(8, r.left), vw - 8 - r.width);
    setMenuPos({ left, top: r.bottom + 8, width: r.width });
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
      const vw = window.innerWidth;
      const left = Math.min(Math.max(8, r.left), vw - 8 - r.width);
      setMenuPos({ left, top: r.bottom + 8, width: r.width });
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
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[8px] text-sm outline-none transition"
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
            maxHeight:'70vh', overflowY:'auto'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[8px]"
            style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', color:'var(--text)' }}
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

          <div className="max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
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
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(0,255,194,0.08)'; el.style.border = '1px solid rgba(0,255,194,0.28)'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonButtonElement; (el as any).style.background = 'transparent'; (el as any).style.border = '1px solid transparent'; }}
              >
                <span className="grid place-items-center opacity-90">{o.left ?? <span />}</span>
                <span className="truncate">{o.label}</span>
                <span>{o.meta}</span>
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
    <div className="mb-[12px]">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>{title}</div>

      <div className="va-card">
        <button onClick={()=>setOpen(v=>!v)} className="va-head w-full text-left" style={{ color:'var(--text)' }}>
          <span className="min-w-0 flex items-center gap-3">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full" style={{ background:'rgba(89,217,179,.10)' }}>
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

/* ─────────── Transcript view ─────────── */
type ChatMsg = { id: string; role: 'user'|'assistant'|'system'; text: string };
function Transcript({ items }:{ items: ChatMsg[] }) {
  return (
    <div className="space-y-2 text-sm">
      {items.filter(m=>m.role!=='system').map(m => (
        <div key={m.id} className="max-w-[92%]">
          <div className="text-[11px] mb-1 opacity-70">{m.role === 'assistant' ? 'Assistant' : 'You'}</div>
          <div className="rounded-[10px] px-3 py-2" style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.08)' }}>
            {m.text}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─────────── realtime model mapping ─────────── */
function pickRealtimeSibling(selectedId: string): UiModel {
  const sel = OPENAI_MODELS.find(m => m.id === selectedId);
  if (sel?.realtime) return sel;
  // simple family-based mapping
  const family = sel?.family || '';
  const byFamily = OPENAI_MODELS.find(m => m.family === family && m.realtime);
  return byFamily || OPENAI_MODELS.find(m => m.realtime) || { id:'gpt-4o-realtime', label:'GPT 4o Realtime', realtime:true };
}

/* ─────────── Page ─────────── */
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
  const [callMounted, setCallMounted] = useState(false); // ensures panel content renders only when opened

  // files (under System Prompt)
  const [files, setFiles] = useState<File[]>([]);

  // chat transcript (right panel)
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: 'sys', role: 'system', text: (DEFAULT_AGENT.systemPrompt || '').trim() },
  ]);

  // voice preview (browser)
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
    const u = new SpeechSynthesisUtterance(line || `Hi, I'm ${data.name || 'your assistant'}.`);
    const byName = voices.find(v => v.name.toLowerCase().includes((data.voiceName || '').split(' ')[0]?.toLowerCase() || ''));
    const en = voices.find(v => v.lang?.startsWith('en'));
    if (byName) u.voice = byName; else if (en) u.voice = en;
    u.rate = 0.98;
    u.pitch = 1.0;
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

  async function doSave(){
    if (!activeId) { setToastKind('error'); setToast('Select or create an agent'); return; }
    setSaving(true); setToast('');
    try {
      await fetch(`/api/voice/agent/${activeId}/save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
      });
      setToastKind('info'); setToast('Saved');
    }
    catch { setToastKind('error'); setToast('Save failed'); }
    finally { setSaving(false); setTimeout(()=>setToast(''), 1400); }
  }
  async function doPublish(){
    if (!activeId) { setToastKind('error'); setToast('Select or create an agent'); return; }
    setPublishing(true); setToast('');
    try {
      await fetch(`/api/voice/agent/${activeId}/publish`, { method: 'POST' });
      setToastKind('info'); setToast('Published');
    }
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
    // seed "assistant speaks first" in transcript immediately
    if (data.firstMode === 'Assistant speaks first' && nonEmpty(data.firstMsg)) {
      setMsgs(prev => [...prev, { id: `a_${Date.now()}`, role:'assistant', text: data.firstMsg }]);
    }
    setShowCall(true);
    setCallMounted(true);
  };

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

          {/* Metrics glance */}
          <div className="grid gap-[12px] md:grid-cols-2 mb-[12px]">
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Cost</div><div />
              </div>
              <div className="p-[var(--s-4)]">
                <div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~$0.1/min</div>
              </div>
            </div>
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Latency</div><div />
              </div>
              <div className="p-[var(--s-4)]">
                <div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~1050 ms</div>
              </div>
            </div>
          </div>

          {/* Model */}
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
                <StyledSelect value={data.provider} onChange={(v)=>setField('provider')(v as AgentData['provider'])} options={providerOpts}/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Model</div>
                <StyledSelect value={data.model} onChange={setField('model')} options={openAiModelOpts}/>
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
            </div>

            {/* System prompt + files */}
            <div className="grid grid-cols-1 gap-[12px] mt-[var(--s-4)]">
              <div className="md:col-span-2">
                <div className="font-medium mb-[var(--s-2)]" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                <textarea
                  className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[12px]"
                  style={{ minHeight: 240, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  value={data.systemPrompt}
                  onChange={(e)=> setField('systemPrompt')(e.target.value)}
                />
                <div className="mt-3">
                  <label
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-[8px] cursor-pointer"
                    style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  >
                    <UploadCloud className="w-4 h-4" />
                    <span className="text-sm">Attach files (knowledge)</span>
                    <input
                      type="file"
                      multiple
                      hidden
                      onChange={(e)=>{
                        const list = Array.from(e.target.files || []);
                        setFiles(prev => [...prev, ...list]);
                      }}
                    />
                  </label>
                  {files.length > 0 && (
                    <div className="mt-2 grid gap-2">
                      {files.map((f, i) => (
                        <div key={`${f.name}-${i}`} className="flex items-center gap-2 text-xs opacity-90">
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate">{f.name}</span>
                          <span className="opacity-60">({Math.ceil(f.size/1024)} KB)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
                  Keys are stored per-account via scoped storage. Manage them in the API Keys page.
                </div>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={(v)=>setField('voiceName')(v)}
                  options={[
                    { value: 'Alloy (American)', label: 'Alloy (American)' },
                    { value: 'Alloy (British)',  label: 'Alloy (British)'  },
                    { value: 'Alloy (Aussie)',   label: 'Alloy (Australian)' },
                    { value: 'Alloy (Indian)',   label: 'Alloy (Indian)' },
                    { value: 'Verse (American)', label: 'Verse (American)' },
                  ]}
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

          {/* Transcriber (put at END) */}
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
          </Section>
        </div>
      </div>

      {/* ─────────── Assistant Call PANEL (side drawer) ─────────── */}
      {IS_CLIENT ? createPortal(
        <>
          {/* overlay */}
          <div
            className={`fixed inset-0 transition ${showCall ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
            onClick={()=> setShowCall(false)}
          />
          {/* panel */}
          <div
            className="fixed top-0 right-0 h-screen w-full sm:w-[520px] max-w-[92vw] transition-transform"
            style={{
              zIndex: Z_MODAL,
              transform: showCall ? 'translateX(0)' : 'translateX(110%)',
              background:'var(--panel-bg)', borderLeft:'1px solid rgba(255,255,255,.10)',
              boxShadow:'-24px 0 60px rgba(0,0,0,.45)'
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(255,255,255,.10)]">
              <div className="flex items-center gap-2">
                <OpenAiLogo />
                <div className="text-sm font-semibold">Assistant Call</div>
              </div>
              <button onClick={()=> setShowCall(false)} className="w-8 h-8 rounded grid place-items-center" style={{ border:'1px solid rgba(255,255,255,.12)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-rows-[auto_1fr_auto] h-[calc(100vh-49px)]">
              {/* system prompt preview */}
              <div className="px-4 py-3 border-b border-[rgba(255,255,255,.06)]">
                <div className="text-xs opacity-70 mb-1">System</div>
                <div className="text-xs max-h-24 overflow-auto pr-1" style={{ whiteSpace:'pre-wrap' }}>
                  {safeTrim(data.systemPrompt)}
                </div>
              </div>

              {/* transcript */}
              <div className="px-4 py-3 overflow-auto">
                <div className="text-xs opacity-70 mb-2">Live transcript</div>
                <Transcript items={msgs} />
              </div>

              {/* status + controls */}
              <div className="px-4 py-3 border-t border-[rgba(255,255,255,.06)]">
                <div className="text-xs opacity-75 mb-2">
                  Status: {showCall ? 'Active' : 'Idle'} • Model: {OPENAI_MODELS.find(m=>m.id===data.model)?.label || data.model}
                </div>

                {/* mount WebRTC only when panel is open */}
                {callMounted && showCall && (
                  <WebCallButton
                    model={pickRealtimeSibling(data.model).id}
                    // keep your prompt & voice
                    systemPrompt={data.systemPrompt}
                    voiceName={data.voiceName}
                    assistantName={data.name || 'Assistant'}
                    apiKey={apiKeys.find(k => k.id === data.apiKeyId)?.key || ''}
                    firstMessage={data.firstMode === 'Assistant speaks first' ? data.firstMsg : ''}
                    onUserTranscript={(t:string)=> setMsgs(prev => [...prev, { id:`u_${Date.now()}`, role:'user', text:t }])}
                    onAssistantTranscript={(t:string)=> setMsgs(prev => [...prev, { id:`a_${Date.now()}`, role:'assistant', text:t }])}
                    onError={(err:any)=>{
                      setMsgs(prev => [...prev, { id:`e_${Date.now()}`, role:'assistant', text:`(Error) ${err?.message || 'Call error'}` }]);
                    }}
                    onClose={()=> { setShowCall(false); setTimeout(()=>setCallMounted(false), 220); }}
                  />
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}
    </section>
  );
}
