// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Phone, Rocket, Search, Check, Lock, X, KeyRound
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

/* ───────────────── Tokens (global) ───────────────── */
const ACTIVE_KEY = 'va:activeId';
const CTA        = '#59d9b3';
const CTA_HOVER  = '#54cfa9';
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-1: 6px; --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-5: 20px; --s-6: 24px;
      --radius-outer: 8px;           /* less rounded outer */
      --radius-inner: 12px;
      --control-h: 44px;
      --header-h: 86px;
      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      --panel: #0f1314;
      --panel-alt: #0d1112;

      --input-bg: #101314;
      --input-border: rgba(255,255,255,.04);  /* almost none */
      --input-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 6px 14px rgba(0,0,0,.30);

      --menu-bg: #101314;
      --menu-border: rgba(255,255,255,.12);
      --menu-shadow: 0 40px 110px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.35);

      --text: #eaf8f3; --text-muted: rgba(234,248,243,.62);
      --bg: #0b0e0f;

      --card-shadow: 0 10px 18px rgba(0,0,0,.22);
      --card-border: rgba(255,255,255,.04);

      /* ====== BAND PALETTE (GREEN) ====== */
      --band-green: 0,255,194; /* rgb for alpha control */

      /* Wide vertical bands (under content). Keep subtle! */
      --va-bands: repeating-linear-gradient(
        90deg,
        rgba(var(--band-green), .055) 0px,   /* light green stripe */
        rgba(var(--band-green), .055) 22px,  /* stripe width */
        rgba(0,0,0,0) 22px,
        rgba(0,0,0,0) 44px                   /* gap -> wide bands */
      );

      /* Darkest at center → lighter to sides (horizontal falloff) */
      --va-center-dark: linear-gradient(
        90deg,
        rgba(0,0,0,.10) 0%,
        rgba(0,0,0,.28) 50%,
        rgba(0,0,0,.10) 100%
      );
    }

    :root:not([data-theme="dark"]) .va-scope{
      --panel: #ffffff; --panel-alt: #ffffff;
      --input-bg: #ffffff; --input-border: rgba(0,0,0,.06);
      --input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 8px 16px rgba(0,0,0,.10);
      --menu-bg: #ffffff; --menu-border: rgba(0,0,0,.10);
      --menu-shadow: 0 40px 110px rgba(0,0,0,.20), 0 0 0 1px rgba(0,0,0,.05);
      --text: #0f1213; --text-muted: rgba(15,18,19,.62);
      --bg: #f6f7f8;
      --card-shadow: 0 10px 16px rgba(0,0,0,.10);
      --card-border: rgba(0,0,0,.06);

      --va-bands: repeating-linear-gradient(
        90deg,
        rgba(var(--band-green), .035) 0px,
        rgba(var(--band-green), .035) 22px,
        rgba(0,0,0,0) 22px,
        rgba(0,0,0,0) 44px
      );
      --va-center-dark: linear-gradient(
        90deg,
        rgba(0,0,0,.03) 0%,
        rgba(0,0,0,.10) 50%,
        rgba(0,0,0,.03) 100%
      );
    }

    .va-main{ overflow: visible; position: relative; contain: none; }

    /* Card surface layering: bands + center falloff under content */
    .va-card{
      position: relative;
      border: 1px solid var(--card-border);
      border-radius: var(--radius-outer);
      background:
        var(--va-center-dark),
        var(--va-bands),
        linear-gradient(180deg, var(--panel-alt), var(--panel));
      box-shadow: var(--card-shadow);
      overflow: hidden;
    }
    /* put all child content above the bands */
    .va-card > * { position: relative; z-index: 1; }

    /* Header lighten to separate from body a bit */
    .va-card .va-head{
      background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,0));
    }

    /* Dropdown portal */
    .va-portal{
      background: var(--menu-bg);
      border: 1px solid var(--menu-border);
      box-shadow: var(--menu-shadow);
      border-radius: 12px;
    }

    /* Overlay */
    .va-overlay{ background: rgba(0,0,0,.55); backdrop-filter: blur(2px); }
    .va-sheet{
      background: linear-gradient(180deg, var(--menu-bg), var(--menu-bg));
      border: 1px solid var(--menu-border);
      box-shadow: 0 28px 80px rgba(0,0,0,.55), 0 0 0 1px rgba(0,0,0,.35) inset;
      border-radius: 12px;
    }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
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
  provider: 'openai',
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
`[Identity]
You are a blank template AI assistant with minimal default settings, designed to be easily customizable for various use cases.

[Style]
- Maintain a neutral and adaptable tone suitable for a wide range of contexts.
- Use clear and concise language to ensure effective communication.

[Response Guidelines]
- Avoid using any specific jargon or domain-specific language.
- Keep responses straightforward and focused on the task at hand.

[Task & Goals]
1. Serve as a versatile agent that can be tailored to fit different roles based on user instructions.
2. Allow users to modify model parameters, such as temperature, messages, and other settings as needed.
3. Ensure all adjustments are reflected in real-time to adapt to the current context.

[Error Handling / Fallback]
- Prompt users for clarification if inputs are vague or unclear.
- Gracefully handle any errors by providing a polite default response or seeking further instruction.`,
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

/* Styled select (solid surface + visible portal) */
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
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[12px] text-sm outline-none transition"
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

/* ───────────────── Reusable overlay ───────────────── */
function ActionOverlay({
  title, children, onClose, primaryText = 'Confirm', onPrimary
}:{
  title: string; children: React.ReactNode; onClose: ()=>void; primaryText?: string; onPrimary?: ()=>void;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[99998] grid place-items-center px-4 va-overlay">
      <div className="va-sheet w-full max-w-[620px] p-4 md:p-6">
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
            style={{ background:CTA, color:'#0a0f0d', boxShadow:'0 12px 26px rgba(89,217,179,.22)' }}
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
    <div className="mb-[14px]">
      <div className="mb-[6px] text-sm font-medium" style={{ color:'var(--text-muted)' }}>
        {title}
      </div>

      <div className="va-card">
        {/* header */}
        <button
          onClick={()=>setOpen(v=>!v)}
          className="va-head w-full text-left px-4 sm:px-5"
          style={{
            color:'var(--text)', minHeight:'var(--header-h)',
            display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:'12px'
          }}
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
  const [calling, setCalling] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [showGenerate, setShowGenerate] = useState(false);

  // API Keys (scoped, same as your other step)
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

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

        const v1 = await ss.getJSON<ApiKey[]>(LS_KEYS, []);
        const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter((k) => k.id && k.name);

        setApiKeys(cleaned);

        const globalSelected = await ss.getJSON<string>(LS_SELECTED, '');
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        if (chosen && chosen !== data.apiKeyId) {
          setData(prev => ({ ...prev, apiKeyId: chosen }));
          await ss.setJSON(LS_SELECTED, chosen);
        }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof AgentData>(k: K) => (v: AgentData[K]) =>
    setData(prev => ({ ...prev, [k]: v }));

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
  async function doCallTest(){
    if (!activeId) { setToast('Select or create an agent'); return; }
    setCalling(true); setToast('');
    try { await apiCallTest(activeId); setToast('Calling…'); }
    catch { setToast('Test call failed'); }
    finally { setCalling(false); setTimeout(()=>setToast(''), 1800); }
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Rail */}
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
              onClick={doCallTest}
              disabled={calling}
              className="inline-flex items-center gap-2 rounded-[10px] font-semibold select-none disabled:opacity-60"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#0a0f0d', boxShadow:'0 10px 22px rgba(89,217,179,.20)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" /> {calling ? 'Calling…' : 'Talk to Assistant'}
            </button>
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                 style={{ background:'rgba(89,217,179,.10)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.16) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* KPIs */}
          <div className="grid gap-[12px] md:grid-cols-2 mb-[14px]">
            <div className="va-card p-[var(--s-4)]">
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~$0.1/min</div>
            </div>
            <div className="va-card p-[var(--s-4)]">
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Latency</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~1050 ms</div>
            </div>
          </div>

          {/* Sections */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the assistant’s reasoning model and first message."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Provider</div>
                <StyledSelect value={data.provider} onChange={(v)=>set('provider')(v as AgentData['provider'])} options={providerOpts}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Model</div>
                <StyledSelect value={data.model} onChange={set('model')} options={modelOpts}/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>First Message Mode</div>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstMessageModes}/>
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>First Message</div>
                <input
                  className="w-full bg-transparent outline-none rounded-[12px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)', fontSize:'var(--fz-body)' }}
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
                  style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  onClick={()=>setShowGenerate(true)}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[10px]"
                style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)', minHeight:130, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt}
                onChange={(e)=>set('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose the TTS provider, voice, and OpenAI key."
            defaultOpen={true}
          >
            {/* OpenAI key import (scoped storage) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px] flex items-center gap-2" style={{ color:'var(--text)' }}>
                  <KeyRound className="w-4 h-4 opacity-80" /> OpenAI API Key
                </div>
                <StyledSelect
                  value={data.apiKeyId || ''}
                  onChange={async (val)=>{
                    set('apiKeyId')(val);
                    try { const ss = await scopedStorage(); await ss.ensureOwnerGuard(); await ss.setJSON(LS_SELECTED, val); } catch {}
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
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Voice Provider</div>
                <StyledSelect
                  value={data.ttsProvider}
                  onChange={(v)=>set('ttsProvider')(v as AgentData['ttsProvider'])}
                  options={ttsProviders}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={set('voiceName')}
                  options={openAiVoices}
                  placeholder="— Choose —"
                />
              </div>
            </div>

            <div className="mt-[var(--s-2)] text-xs" style={{ color:'var(--text-muted)' }}>
              Keep utterances short/specific for natural cadence.
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
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Provider</div>
                <StyledSelect value={data.asrProvider} onChange={(v)=>set('asrProvider')(v as AgentData['asrProvider'])} options={asrProviders}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Language</div>
                <StyledSelect
                  value={data.asrLang}
                  onChange={(v)=>{
                    const lang = v as AgentData['asrLang'];
                    set('asrLang')(lang);
                    if (lang !== 'en') set('asrDialect')('standard');
                  }}
                  options={asrLanguages}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Dialect</div>
                <StyledSelect value={data.asrDialect} onChange={(v)=>set('asrDialect')(v as AgentData['asrDialect'])} options={dialectOpts}/>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]" style={{ color:'var(--text)' }}>Model</div>
                <StyledSelect value={data.asrModel} onChange={set('asrModel')} options={asrModelOpts}/>
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
                  onChange={(e)=>set('confidence')(parseFloat(e.target.value))}
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

      {showGenerate && (
        <ActionOverlay
          title="Generate Base Prompt"
          onClose={()=>setShowGenerate(false)}
          primaryText="Use as Prompt"
          onPrimary={()=>setShowGenerate(false)}
        >
          <textarea
            defaultValue={DEFAULT_AGENT.systemPrompt}
            onBlur={(e)=>set('systemPrompt')(e.currentTarget.value)}
            className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
            style={{ minHeight: 260, background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
          />
          <div className="mt-2 text-xs" style={{ color:'var(--text-muted)' }}>
            Paste or edit your base template. Saving uses this as the system prompt.
          </div>
        </ActionOverlay>
      )}
    </section>
  );
}
