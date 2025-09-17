'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock, X, KeyRound
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ───────────────── Dynamic rail ───────────────── */
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

/* ───────────────── Local tokens ───────────────── */
const CTA       = '#59d9b3';
const CTA_HOVER = '#54cfa9';

/* Filled phone icon (white) */
function FilledPhoneIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden {...props}>
      <path
        d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 011 1v3.5a1 1 0 01-1 1C11.3 22 2 12.7 2 2.99a1 1 0 011-1H6.5a1 1 0 011 1c0 1.23.2 2.44.57 3.56a1 1 0 01-.24 1.03l-2.2 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px;
      --radius-outer: 10px;
      --control-h: 44px; --header-h: 88px;
      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      --page-bg: var(--bg);
      --text: var(--text, #fff);
      --text-muted: var(--text-muted, rgba(255,255,255,.72));

      --input-bg: color-mix(in oklab, var(--page-bg) 94%, black 6%);
      --input-border: rgba(255,255,255,.10);
      --input-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 8px 18px rgba(0,0,0,.35);
      --border-weak: rgba(255,255,255,.10);

      --card-shadow: 0 18px 40px rgba(0,0,0,.28);
    }

    .va-main{ overflow: visible; position: relative; contain: none; }

    .va-card{
      position: relative;
      border-radius: var(--radius-outer);
      border: 1px solid var(--border-weak);
      background: var(--page-bg);
      box-shadow: var(--card-shadow);
      overflow: hidden;
      isolation: isolate;
    }

    /* Header = same dark as page with a tiny gradient (not “lighter”) */
    .va-card .va-head{
      min-height: var(--header-h);
      display: grid; grid-template-columns: 1fr auto; align-items: center;
      padding: 0 16px;
      background:
        linear-gradient(
          90deg,
          color-mix(in oklab, var(--page-bg) 100%, transparent) 0%,
          color-mix(in oklab, var(--page-bg) 98%, white 2%) 25%,
          var(--page-bg) 50%,
          color-mix(in oklab, var(--page-bg) 98%, black 2%) 75%,
          var(--page-bg) 100%
        );
      border-bottom: 1px solid rgba(255,255,255,.08);
      color: var(--text);
    }

    /* Dropdowns / overlays */
    .va-portal{
      background: color-mix(in oklab, var(--page-bg) 80%, black 20%);
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: 0 36px 90px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.35);
      border-radius: 10px;
    }

    /* Not transparent modal sheet */
    .va-overlay{ background: rgba(0,0,0,.72); }
    .va-sheet{
      background: color-mix(in oklab, var(--page-bg) 88%, black 12%); /* solid */
      border: 1px solid rgba(255,255,255,.12);
      box-shadow: 0 28px 80px rgba(0,0,0,.60);
      border-radius: 12px;
    }

    /* Fixed assistant sidebar */
    .va-left-fixed{
      position: fixed; inset: 0 auto 0 0; width: 260px;
      border-right: 1px solid rgba(255,255,255,.06);
      background: var(--page-bg);
      overflow: hidden;
    }
    .va-left-fixed .rail-scroll{
      position: absolute; inset: 0; overflow: auto;
    }

    /* Right-side call drawer with chat */
    .va-call-drawer{
      position: fixed; inset: 0 0 0 auto; width: min(520px, 92vw);
      display: grid; grid-template-rows: auto 1fr auto;
      background: color-mix(in oklab, var(--page-bg) 86%, black 14%);
      border-left: 1px solid rgba(255,255,255,.10);
      box-shadow: -28px 0 80px rgba(0,0,0,.55);
      transform: translateX(100%);
      transition: transform 280ms var(--ease);
      z-index: 99998;
    }
    .va-call-drawer.open{ transform: translateX(0); }
    .va-call-overlay{
      position: fixed; inset: 0; background: rgba(0,0,0,.54);
      opacity: 0; pointer-events: none; transition: opacity 200ms var(--ease); z-index: 99997;
    }
    .va-call-overlay.open{ opacity: 1; pointer-events: auto; }

    /* Chat bubbles */
    .chat-msg{ max-width: 85%; padding: 10px 12px; border-radius: 12px; }
    .chat-user{
      background: color-mix(in oklab, var(--page-bg) 86%, white 14%);
      border: 1px solid rgba(255,255,255,.10);
      align-self: flex-end;
    }
    .chat-ai{
      background: color-mix(in oklab, var(--page-bg) 80%, black 20%);
      border: 1px solid rgba(255,255,255,.10);
      align-self: flex-start;
    }

    .type-caret{
      display:inline-block; width: 6px; height: 1em;
      background: currentColor; margin-left: 3px; animation: blink 1s step-end infinite;
      vertical-align: bottom;
    }
    @keyframes blink { 50% { opacity: 0; } }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string; // NEW: assistant display name
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;
  apiKeyId?: string;

  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrLang: 'en' | 'nl' | 'es' | 'de';
  asrDialect: 'en-US' | 'en-UK' | 'en-AU' | 'standard';
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
  confidence: number;
};

const DEFAULT_AGENT: AgentData = {
  name: 'Assistant', // default
  provider: 'openai',
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
`[Identity]
You are a blank template AI assistant with minimal default settings, designed to be easily customizable.

[Style]
- Neutral, concise, helpful.

[Guidelines]
- Avoid unnecessary jargon.
- Keep responses focused.

[Fallback]
- Ask for clarification when needed.`,
  ttsProvider: 'openai',
  voiceName: 'Alloy (American)',
  apiKeyId: '',
  asrProvider: 'deepgram',
  asrLang: 'en',
  asrDialect: 'en-US',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
  confidence: 0.4,
};

const ACTIVE_KEY = 'va:activeId';
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

const asrLanguages: Opt[] = [
  { value: 'en', label: 'English' },
  { value: 'nl', label: 'Dutch' },
  { value: 'es', label: 'Spanish' },
  { value: 'de', label: 'German' },
];

const dialectsFor = (lang: string): Opt[] => {
  if (lang === 'en') {
    return [
      { value: 'en-US', label: 'English — American' },
      { value: 'en-UK', label: 'English — British' },
      { value: 'en-AU', label: 'English — Australian' },
    ];
  }
  return [{ value: 'standard', label: 'Standard' }];
};

const asrModelsFor = (asr: string): Opt[] =>
  asr === 'deepgram'
    ? [
        { value: 'Nova 2', label: 'Nova 2' },
        { value: 'Nova',   label: 'Nova' },
      ]
    : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

/* ───────────────── UI atoms ───────────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28, width: 50, padding: '0 6px', borderRadius: 999, justifyContent: 'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--input-bg))' : 'var(--input-bg)',
      border: '1px solid var(--input-border)', boxShadow: 'var(--input-shadow)'
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

function StyledSelect({
  value, onChange, options, placeholder, leftIcon
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode;
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

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
    const openUp = r.bottom + 320 > window.innerHeight;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', off); window.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
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
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
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
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
                style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
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
                    style={{ color:'var(--text)', background:'transparent', border:'1px solid transparent', cursor:o.disabled?'not-allowed':'pointer' }}
                    onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background='rgba(0,255,194,0.08)'; el.style.border='1px solid rgba(0,255,194,0.28)'; }}
                    onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background='transparent'; el.style.border='1px solid transparent'; }}
                  >
                    {o.disabled ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
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

/* ───────────────── Overlay (generic) ───────────────── */
function ActionOverlay({
  title, children, onClose, primaryText = 'Confirm', onPrimary, primaryWhite = false
}:{
  title: string; children: React.ReactNode; onClose: ()=>void; primaryText?: string; onPrimary?: ()=>void; primaryWhite?: boolean;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[99996] grid place-items-center px-4 va-overlay">
      <div className="va-sheet w-full max-w-[680px] p-4 md:p-6">
        <div className="flex items-center justify-between mb-3">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" aria-label="Close">
            <X className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
          </button>
        </div>
        <div className="mb-4">{children}</div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-[10px]"
            style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={onPrimary}
            className="h-9 px-4 rounded-[10px] font-semibold"
            style={{ background:CTA, color: primaryWhite ? '#ffffff' : '#0a0f0d', boxShadow:'0 12px 26px rgba(89,217,179,.22)' }}
            onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
            onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
          >
            {primaryText}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ───────────────── Section ───────────────── */
function Section({
  title, icon, desc, children, defaultOpen = true
}:{
  title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const innerRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<number>(0);

  const measure = () => { if (innerRef.current) setH(innerRef.current.offsetHeight); };
  useLayoutEffect(() => { measure(); }, [children, open]);

  return (
    <div className="mb-[12px]">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>
        {title}
      </div>

      <div className="va-card">
        {/* header */}
        <button
          onClick={()=>setOpen(v=>!v)}
          className="va-head w-full text-left"
          style={{ color:'var(--text)' }}
        >
          <span className="min-w-0 flex items-center gap-3">
            <span className="inline-grid place-items-center w-7 h-7 rounded-full"
                  style={{ background:'rgba(89,217,179,.10)' }}>
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

        {/* body */}
        <div
          ref={wrapRef}
          style={{ height: open ? h : 0, transition: 'height 200ms var(--ease)', overflow:'hidden' }}
          onTransitionEnd={() => { if (open) measure(); }}
        >
          <div ref={innerRef} className="p-[var(--s-5)]">
            {children}
          </div>
        </div>
      </div>
    </div>
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
  const [toast, setToast] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  // chat drawer + generate overlay state
  const [showCall, setShowCall] = useState(false);
  const [messages, setMessages] = useState<Array<{role:'user'|'assistant'; text:string}>>([
    { role: 'assistant', text: 'Hi! Ready when you are.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genLoading, setGenLoading] = useState<'idle'|'loading'|'typing'>('idle');
  const [genPreview, setGenPreview] = useState('');

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

  // bootstrap keys
  useEffect(() => {
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();

        const v1 = await ss.getJSON<ApiKey[]>('apiKeys.v1', []);
        const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter((k) => k.id && k.name);

        setApiKeys(cleaned);

        const globalSelected = await ss.getJSON<string>('apiKeys.selectedId', '');
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        if (chosen && chosen !== data.apiKeyId) {
          setData(prev => ({ ...prev, apiKeyId: chosen }));
          await ss.setJSON('apiKeys.selectedId', chosen);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof AgentData>(k: K) {
    return (v: AgentData[K]) => setData(prev => ({ ...prev, [k]: v }));
  }

  const modelOpts = useMemo(()=>modelOptsFor(data.provider), [data.provider]);
  const dialectOpts = useMemo(()=>dialectsFor(data.asrLang), [data.asrLang]);
  const asrModelOpts = useMemo(()=>asrModelsFor(data.asrProvider), [data.asrProvider]);

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

  /* Build prompt by translating extra text into directive-y lines */
  function buildPrompt(base: string, extraRaw: string) {
    const extra = (extraRaw || '').trim();
    if (!extra) return base;

    const lines = extra
      .split(/\n+/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(s => {
        // normalize: add trailing period, turn “be friendly” -> “Be friendly.”
        const t = s[0] ? s[0].toUpperCase() + s.slice(1) : s;
        return /[.!?]$/.test(t) ? t : `${t}.`;
      });

    const block = `
[Extra Instructions]
${lines.map(l => `- ${l}`).join('\n')}

[Behavior]
- Always respect the Extra Instructions above.
- Keep replies concise and useful.
- Ask for missing info before acting.`;

    return `${base}\n${block}`;
  }

  // typing animation for genPreview
  function typeIntoPreview(text: string) {
    setGenPreview('');
    let i = 0;
    setGenLoading('typing');
    const id = setInterval(() => {
      i += Math.max(1, Math.floor(text.length / 60));
      setGenPreview(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(id);
        setGenLoading('idle');
      }
    }, 18);
  }

  function onGenerate() {
    setGenLoading('loading');
    const merged = buildPrompt(DEFAULT_AGENT.systemPrompt, composerText);
    // small pause then “types” it out
    setTimeout(() => {
      typeIntoPreview(merged);
    }, 600);
  }

  function applyGenerated() {
    const finalText = genPreview || buildPrompt(DEFAULT_AGENT.systemPrompt, composerText);
    setField('systemPrompt')(finalText);
    setShowGenerate(false);
    setComposerText('');
    setGenPreview('');
    setGenLoading('idle');
  }

  function sendChat() {
    const txt = chatInput.trim();
    if (!txt) return;
    setMessages(m => [...m, { role: 'user', text: txt }]);
    setChatInput('');
    // fake assistant reply for UI
    const reply = `${data.name}: I heard "${txt}". How can I help further?`;
    setTimeout(() => setMessages(m => [...m, { role: 'assistant', text: reply }]), 400);
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* FIXED ASSISTANT SIDEBAR */}
      <div className="va-left-fixed">
        <div className="rail-scroll">
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>
      </div>

      {/* RIGHT CONTENT (adds left padding so it doesn't sit under the fixed rail) */}
      <div style={{ marginLeft: 260 }}>
        <div className="va-main px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]"
             style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>

          {/* Actions */}
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button
              onClick={()=>setShowCall(true)}
              className="inline-flex items-center gap-2 rounded-[10px] select-none"
              style={{
                height:'var(--control-h)', padding:'0 18px',
                background:CTA, color:'#ffffff', fontWeight:700,
                boxShadow:'0 10px 22px rgba(89,217,179,.20)'
              }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <FilledPhoneIcon style={{ color:'#ffffff' }} />
              Talk to Assistant
            </button>
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                 style={{ background:'rgba(89,217,179,.10)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.16) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* KPIs */}
          <div className="grid gap-[12px] md:grid-cols-2 mb-[12px]">
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Cost</div>
                <div />
              </div>
              <div className="p-[var(--s-4)]">
                <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~$0.1/min</div>
              </div>
            </div>
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Latency</div>
                <div />
              </div>
              <div className="p-[var(--s-4)]">
                <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~1050 ms</div>
              </div>
            </div>
          </div>

          {/* Sections */}
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
                  className="w-full bg-transparent outline-none rounded-[10px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
                  placeholder="e.g., Nova"
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
                <StyledSelect value={data.model} onChange={setField('model')} options={modelOpts}/>
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message Mode</div>
                <StyledSelect value={data.firstMode} onChange={setField('firstMode')} options={firstMessageModes}/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message</div>
                <input
                  className="w-full bg-transparent outline-none rounded-[10px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
                  value={data.firstMsg}
                  onChange={(e)=>setField('firstMsg')(e.target.value)}
                />
              </div>
            </div>

            <div className="mt-[var(--s-4)]">
              <div className="flex items-center justify-between mb-[var(--s-2)]">
                <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                <button
                  className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                  style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  onClick={()=>{ setComposerText(''); setGenPreview(''); setGenLoading('idle'); setShowGenerate(true); }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                style={{ minHeight: 320, background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)', lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt}
                onChange={(e)=>setField('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose the TTS provider, voice, and OpenAI key."
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
                    try { const ss = await scopedStorage(); await ss.ensureOwnerGuard(); await ss.setJSON('apiKeys.selectedId', val); } catch {}
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
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice Provider</div>
                <StyledSelect
                  value={data.ttsProvider}
                  onChange={(v)=>setField('ttsProvider')(v as AgentData['ttsProvider'])}
                  options={ttsProviders}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={setField('voiceName')}
                  options={openAiVoices}
                  placeholder="— Choose —"
                />
              </div>
            </div>
          </Section>

          <Section
            title="Transcriber"
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Speech-to-text configuration for calls."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Provider</div>
                <StyledSelect value={data.asrProvider} onChange={(v)=>setField('asrProvider')(v as AgentData['asrProvider'])} options={asrProviders}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Language</div>
                <StyledSelect
                  value={data.asrLang}
                  onChange={(v)=>{
                    const lang = v as AgentData['asrLang'];
                    setField('asrLang')(lang);
                    if (lang !== 'en') setField('asrDialect')('standard');
                  }}
                  options={asrLanguages}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Dialect</div>
                <StyledSelect value={data.asrDialect} onChange={(v)=>setField('asrDialect')(v as AgentData['asrDialect'])} options={dialectOpts}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Model</div>
                <StyledSelect value={data.asrModel} onChange={setField('asrModel')} options={asrModelOpts}/>
              </div>
            </div>

            <div className="grid grid-cols-[1fr_auto] gap-[var(--s-3)] items-center mt-[var(--s-4)]">
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Confidence Threshold
                </span>
                <input
                  type="range" min={0} max={1} step={0.01}
                  value={data.confidence}
                  onChange={(e)=>setField('confidence')(parseFloat(e.target.value))}
                  style={{ width:'100%' }}
                />
              </div>
              <div
                className="px-2.5 py-1.5 rounded-md text-xs"
                style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', minWidth:46, textAlign:'center', color:'var(--text)' }}
              >
                {data.confidence.toFixed(1)}
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* ---- Right chat drawer ---- */}
      {createPortal(
        <>
          <div className={`va-call-overlay ${showCall ? 'open' : ''}`} onClick={()=>setShowCall(false)} />
          <aside className={`va-call-drawer ${showCall ? 'open' : ''}`} aria-hidden={!showCall}>
            {/* header (same dark with gentle gradient) */}
            <div
              className="flex items-center justify-between px-4 h-[64px]"
              style={{
                background:
                  'linear-gradient(90deg, color-mix(in oklab, var(--bg) 100%, transparent), color-mix(in oklab, var(--bg) 98%, white 2%) 40%, var(--bg))',
                borderBottom:'1px solid rgba(255,255,255,.1)'
              }}
            >
              <div className="font-semibold">Chat with {data.name || 'Assistant'}</div>
              <button
                onClick={()=>setShowCall(false)}
                className="px-2 py-1 rounded hover:opacity-80"
                aria-label="Close"
                style={{ color:'var(--text)', border:'1px solid rgba(255,255,255,.12)', background:'color-mix(in oklab, var(--bg) 90%, black 10%)' }}
              >
                Close
              </button>
            </div>

            {/* body (messages) */}
            <div className="p-4 overflow-y-auto flex flex-col gap-3">
              {messages.map((m, i) => (
                <div key={i} className="flex flex-col" style={{ alignItems: m.role==='user' ? 'flex-end' : 'flex-start' }}>
                  <div className="text-[11px]" style={{ color:'var(--text-muted)' }}>
                    {m.role==='user' ? 'You' : (data.name || 'Assistant')}
                  </div>
                  <div className={`chat-msg ${m.role==='user' ? 'chat-user' : 'chat-ai'}`} style={{ color:'var(--text)' }}>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>

            {/* footer (composer) */}
            <div className="p-3 border-t" style={{ borderColor:'rgba(255,255,255,.10)' }}>
              <form
                onSubmit={(e)=>{ e.preventDefault(); sendChat(); }}
                className="flex items-center gap-2"
              >
                <input
                  value={chatInput}
                  onChange={(e)=>setChatInput(e.target.value)}
                  placeholder={`Message ${data.name || 'Assistant'}…`}
                  className="flex-1 rounded-md px-3 py-2 outline-none"
                  style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                />
                <button
                  type="submit"
                  className="h-10 px-4 rounded-md font-semibold"
                  style={{ background:CTA, color:'#ffffff' }}
                >
                  Send
                </button>
              </form>
            </div>
          </aside>
        </>,
        document.body
      )}

      {/* ---- Generate Prompt overlay (solid, loading, typing) ---- */}
      {showGenerate && (
        <ActionOverlay
          title="Compose Prompt"
          onClose={()=>{ if (genLoading==='loading') return; setShowGenerate(false); }}
          primaryText={genLoading==='loading' ? 'Generating…' : genLoading==='typing' ? 'Use Prompt' : 'Generate'}
          onPrimary={()=>{
            if (genLoading==='idle') onGenerate();
            else if (genLoading==='typing' || genPreview) applyGenerated();
          }}
          primaryWhite
        >
          <div className="grid gap-3">
            <label className="text-xs" style={{ color:'var(--text-muted)' }}>
              Add extra instructions (persona, tone, rules, tools):
            </label>
            <textarea
              value={composerText}
              onChange={(e)=>setComposerText(e.target.value)}
              className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
              placeholder="e.g., Be a friendly, concise support agent. Confirm account ID before any action. Prefer bullet points."
              style={{ minHeight: 160, background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            />

            {/* Preview / loader / typing */}
            <div className="mt-2 rounded-[10px] p-3"
              style={{ background:'color-mix(in oklab, var(--bg) 90%, black 10%)', border:'1px solid rgba(255,255,255,.10)', color:'var(--text)' }}
            >
              {genLoading === 'idle' && !genPreview && (
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Click <b>Generate</b> to build a usable system prompt preview here.
                </div>
              )}

              {genLoading === 'loading' && (
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" />
                  Generating…
                </div>
              )}

              {(genLoading === 'typing' || genPreview) && (
                <pre
                  style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontSize:12, lineHeight:1.5 }}
                >
                  {genPreview}
                  {genLoading === 'typing' && <span className="type-caret" />}
                </pre>
              )}
            </div>
          </div>
        </ActionOverlay>
      )}
    </section>
  );
}
