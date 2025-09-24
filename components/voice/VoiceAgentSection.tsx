// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, X, Plus, Trash2, Phone, CheckCircle2
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

// ✅ ephemeral route
const EPHEMERAL_TOKEN_ENDPOINT = '/api/voice/ephemeral';

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

/* ─────────── tiny helpers ─────────── */
const isFn = (f: any): f is Function => typeof f === 'function';
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const coerceStr = (v: any): string => (isStr(v) ? v : '');
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');
const sleep = (ms:number) => new Promise(r=>setTimeout(r,ms));

/* ─────────── shared tokens to MATCH Account page ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --card:#0f1214; --text:#e6f1ef; --text-muted:#9fb4ad;
      --brand:#59d9b3; --brand-weak:rgba(89,217,179,.22);
      --border:rgba(255,255,255,.10); --border-weak:rgba(255,255,255,.10);
      --shadow-soft:0 18px 48px rgba(0,0,0,.20);
      --shadow-card:0 20px 40px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
      --radius-outer:8px; --radius-inner:8px;
      --ease:cubic-bezier(.22,.61,.36,1);
      --control-h:40px;
    }
    .va-card{
      border-radius:var(--radius-outer);
      border:1px solid var(--border-weak);
      background:var(--panel);
      box-shadow:var(--shadow-card);
      overflow:hidden;
      isolation:isolate;
    }
    .va-head{
      min-height:56px;
      display:grid;
      grid-template-columns:1fr auto;
      align-items:center;
      padding:0 16px;
      border-bottom:1px solid rgba(255,255,255,.08);
      color:var(--text);
      background:linear-gradient(
        90deg,
        var(--panel) 0%,
        color-mix(in oklab, var(--panel) 97%, white 3%) 50%,
        var(--panel) 100%
      );
    }
    .skeleton {
      background: linear-gradient(90deg, var(--card) 25%, var(--panel) 37%, var(--card) 63%);
      background-size: 200% 100%;
      animation: shimmer 1.2s linear infinite;
      display: inline-block;
    }
    @keyframes shimmer { from { background-position: -200% 0; } to { background-position: 200% 0; } }

    input.va-input, textarea.va-input {
      height: var(--control-h);
      border-radius: 8px;
      background: var(--panel);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 0 12px;
      outline: none;
    }
    textarea.va-input { min-height: 160px; padding: 10px 12px; height:auto; }
  `}</style>
);

/* ─────────── types / storage ─────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;

  firstMode: string;
  firstMsg: string;
  firstMsgs?: string[];
  greetPick?: 'sequence'|'random';

  systemPrompt: string;
  systemPromptBackend?: string;
  language?: string;

  contextText?: string;
  ctxFiles?: { name:string; text:string }[];

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

/* ─────────── prompt engine (dual-layer) ─────────── */
import {
  DEFAULT_PROMPT as _DEFAULT_PROMPT,
  looksLikeFullPrompt as _looksLikeFullPrompt,
  normalizeFullPrompt as _normalizeFullPrompt,
  compilePrompt
} from '@/lib/prompt-engine';

const looksLikeFullPromptRT = (raw: string) => isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : false;
const normalizeFullPromptRT = (raw: string) => isFn(_normalizeFullPrompt) ? coerceStr(_normalizeFullPrompt(raw)) : raw;
const DEFAULT_PROMPT_RT = nonEmpty(_DEFAULT_PROMPT) ? _DEFAULT_PROMPT! : PROMPT_SKELETON;

/* ─────────── defaults ─────────── */
const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'gpt-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: '',
  firstMsgs: [],
  greetPick: 'sequence',
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
`).trim() + '\n\n' + `# This is a blank template.`),
  systemPromptBackend: '',
  contextText: '',
  ctxFiles: [],
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

function migrateAgent(d: AgentData): AgentData {
  const msgs = Array.isArray(d.firstMsgs) ? d.firstMsgs : (d.firstMsg ? [d.firstMsg] : []);
  return {
    ...d,
    firstMsgs: msgs.slice(0, 20),
    firstMsg: msgs[0] || '',
    greetPick: d.greetPick || 'sequence',
    contextText: typeof d.contextText === 'string' ? d.contextText : '',
    ctxFiles: Array.isArray(d.ctxFiles) ? d.ctxFiles : [],
  };
}

const loadAgentData = (id: string): AgentData => {
  try {
    const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null;
    if (raw) return migrateAgent({ ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) });
  } catch {}
  return migrateAgent({ ...DEFAULT_AGENT });
};
const saveAgentData = (id: string, data: AgentData) => { try { if (IS_CLIENT) localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {} };

/* ─────────── mock backend (save/publish) ─────────── */
async function apiSave(agentId: string, payload: AgentData){
  const r = await fetch(`/api/voice/agent/${agentId}/save`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).catch(()=>null as any);
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
  { value: 'openai',     label: 'OpenAI' },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon' },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon' },
];

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
        const r = await fetch('/api/openai/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: selectedKey }) });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        const models = Array.isArray(j?.models) ? j.models : [];
        if (!aborted && models.length) setOpts(models.map((m:any) => ({ value: String(m.value), label: String(m.label) })));
      } catch {} finally { if (!aborted) setLoading(false); }
    })();
    return () => { aborted = true; };
  }, [selectedKey]);

  return { opts, loading };
}

const ttsProviders: Opt[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true, note: 'soon' },
];

const asrProviders: Opt[] = [
  { value: 'deepgram',   label: 'Deepgram' },
  { value: 'whisper',    label: 'Whisper — coming soon', disabled: true, note: 'soon' },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true, note: 'soon' },
];

const asrModelsFor = (asr: string): Opt[] =>
  asr === 'deepgram'
    ? [{ value: 'Nova 2', label: 'Nova 2' }, { value: 'Nova', label: 'Nova' }]
    : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

/* ─────────── UI atoms (styled to match Account) ─────────── */
const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height:26, width:46, padding:'0 6px', borderRadius:999, justifyContent:'flex-start',
      background: checked ? 'color-mix(in oklab, var(--brand) 18%, var(--panel))' : 'var(--panel)',
      border:'1px solid var(--border)', boxShadow:'var(--shadow-card)'
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width:16, height:16, borderRadius:999,
        background: checked ? 'var(--brand)' : 'rgba(255,255,255,.12)',
        transform:`translateX(${checked?20:0}px)`, transition:'transform .18s var(--ease)'
      }}
    />
  </button>
);

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
        style={{ height:'var(--control-h)', background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)' }}
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
          className="fixed p-2"
          style={{
            zIndex: 100020,
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'var(--panel)', border:'1px solid var(--border)',
            borderRadius:10, boxShadow:'var(--shadow-card)'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[8px]"
            style={{ background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)' }}
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
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background = 'color-mix(in oklab, var(--brand) 8%, transparent)'; el.style.border = '1px solid color-mix(in oklab, var(--brand) 35%, var(--border))'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
              >
                {o.disabled ? <Lock className="w-3.5 h-3.5" /> :
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5">
                    <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />
                  </span>}
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

/* ─────────── File helpers (.docx via CDN JSZip; .doc best-effort; accept .docs) ─────────── */
async function readFileAsText(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  const looksZip = async () => {
    const buf = new Uint8Array(await f.slice(0,4).arrayBuffer());
    return buf[0]===0x50 && buf[1]===0x4b;
  };

  if (name.endsWith('.docx') || name.endsWith('.docs') || await looksZip()) {
    try {
      // @ts-ignore
      const JSZipModule = await import('https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js');
      const JSZip = (JSZipModule?.default || (window as any).JSZip);
      if (!JSZip) throw new Error('JSZip not loaded');

      const buf = await f.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      const docXml = await zip.file('word/document.xml')?.async('string');
      if (!docXml) return '';

      const text = docXml
        .replace(/<w:p[^>]*>/g,'\n').replace(/<w:tab\/>/g,'\t').replace(/<w:br\/>/g,'\n')
        .replace(/<(.|\n)*?>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
      return text.trim();
    } catch { return ''; }
  }

  if (name.endsWith('.doc')) {
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      let out = '', run:number[]=[];
      const flush = () => { if (run.length >= 3) out += String.fromCharCode(...run) + '\n'; run = []; };
      for (const b of buf) { if (b >= 32 && b <= 126) run.push(b); else flush(); }
      flush();
      return out.trim();
    } catch { return ''; }
  }

  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(new Error('Read failed'));
    r.onload = () => res(String(r.result || ''));
    r.readAsText(f);
  });
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

  // Generate / type-into-prompt flow
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');

  // models list
  const selectedKey = apiKeys.find(k => k.id === data.apiKeyId)?.key;
  const { opts: openaiModels, loading: loadingModels } = useOpenAIModels(selectedKey);

  // TTS preview
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
    window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
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

  // keep backend prompt synced
  useEffect(() => {
    if (!data.systemPrompt) return;
    try {
      const compiled = compilePrompt({ basePrompt: data.systemPrompt, userText: '' });
      if (compiled?.backendString && compiled.backendString !== data.systemPromptBackend) {
        setData(p => ({ ...p, systemPromptBackend: compiled.backendString }));
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.systemPrompt]);

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

  const callModel = useMemo(() => {
    const m = (data.model || '').toLowerCase();
    if (m.includes('realtime')) return data.model;
    return 'gpt-4o-realtime-preview';
  }, [data.model]);

  const selectedModelLabel = useMemo(() => {
    const found = openaiModels.find(o => o.value === data.model);
    return found?.label || data.model || '—';
  }, [openaiModels, data.model]);

  /* ─────────── UI ─────────── */
  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* rail + content */}
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(255,255,255,.06)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]" style={{ fontSize:14, lineHeight:1.45 }}>
          {/* Top actions */}
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)' }}
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
              style={{
                height:'var(--control-h)', padding:'0 16px',
                background:'var(--brand)', color:'#0a0f0d', fontWeight:700,
                boxShadow:'0 10px 22px rgba(89,217,179,.20)'
              }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = 'color-mix(in oklab, var(--brand) 90%, white)')}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = 'var(--brand)')}
            >
              <Phone className="w-4 h-4" />
              <span>Talk to Assistant</span>
            </button>
          </div>

          {toast ? (
            <div
              className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
              style={{
                background: toastKind === 'error' ? 'rgba(239,68,68,.12)' : 'rgba(89,217,179,.10)',
                color: 'var(--text)',
                boxShadow:'var(--shadow-card)', border:'1px solid var(--border)'
              }}
            >
              <CheckCircle2 className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* Metrics */}
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            <div className="va-card">
              <div className="va-head"><div className="text-xs" style={{ color:'var(--text-muted)' }}>Cost</div><div /></div>
              <div className="p-4"><div className="font-semibold" style={{ fontSize:'15px' }}>~$0.1/min</div></div>
            </div>
            <div className="va-card">
              <div className="va-head"><div className="text-xs" style={{ color:'var(--text-muted)' }}>Latency</div><div /></div>
              <div className="p-4"><div className="font-semibold" style={{ fontSize:'15px' }}>~1050 ms</div></div>
            </div>
          </div>

          {/* Model config */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color:'var(--brand)' }} />}
            desc="Configure the model, assistant name, and first message(s)."
            defaultOpen
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Assistant Name</div>
                <input
                  value={data.name}
                  onChange={(e)=>setField('name')(e.target.value)}
                  className="va-input w-full"
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

            {/* First messages */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="font-medium text-[12.5px]">First Messages</div>
                <div className="flex items-center gap-2">
                  <StyledSelect
                    value={data.greetPick || 'sequence'}
                    onChange={(v)=>setField('greetPick')(v as AgentData['greetPick'])}
                    options={[{ value: 'sequence', label: 'Play in order' },{ value: 'random', label: 'Randomize' }]}
                  />
                  <button
                    type="button"
                    onClick={()=>{
                      const next = [...(data.firstMsgs||[])]; if (next.length>=20) return; next.push('');
                      setField('firstMsgs')(next); setField('firstMsg')(next[0]||'');
                    }}
                    className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                    style={{ border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)' }}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>
              </div>

              {(data.firstMsgs||[]).map((msg, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input
                    value={msg}
                    onChange={(e)=>{
                      const next = [...(data.firstMsgs || [])];
                      next[idx] = e.target.value;
                      setField('firstMsgs')(next);
                      setField('firstMsg')(next[0] || '');
                    }}
                    className="va-input w-full"
                    placeholder={`Message ${idx+1}`}
                  />
                  <button
                    onClick={()=>{
                      const next = [...(data.firstMsgs||[])]; next.splice(idx,1);
                      setField('firstMsgs')(next); setField('firstMsg')(next[0]||'');
                    }}
                    className="w-10 h-10 grid place-items-center rounded-[8px]"
                    style={{ border:'1px solid var(--border)', background:'var(--panel)' }}
                    aria-label="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {!(data.firstMsgs && data.firstMsgs.length) && (
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  No greetings yet. Click <b>Add</b> to create the first one. If you keep this empty, the assistant will not auto-greet.
                </div>
              )}
            </div>

            {/* Prompt + Generate */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="font-medium" style={{ fontSize:'12.5px' }}>System Prompt</div>
                <button
                  className="inline-flex items-center gap-2 rounded-[8px] text-sm"
                  style={{ height:34, padding:'0 12px', background:'var(--brand)', color:'#0a0f0d', border:'1px solid var(--border)' }}
                  onClick={()=>{ setComposerText(''); setShowGenerate(true); }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>

              <textarea
                className="va-input w-full"
                style={{ minHeight: 320 }}
                value={data.systemPrompt}
                onChange={(e)=> setField('systemPrompt')(e.target.value)}
              />

              {/* Context files */}
              <ContextFiles data={data} setField={setField} />
            </div>
          </Section>

          {/* Voice */}
          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color:'var(--brand)' }} />}
            desc="Choose TTS and preview the voice."
            defaultOpen
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ApiKeySelect
                apiKeys={apiKeys}
                selectedId={data.apiKeyId || ''}
                onChange={async (val)=>{
                  setField('apiKeyId')(val);
                  try { const store = await scopedStorage(); await store.ensureOwnerGuard?.(); await store.setJSON('apiKeys.selectedId', val); } catch {}
                }}
              />
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
                         style={{ background:'var(--panel)', border:'1px solid var(--border)' }}
                    >
                      <div className="text-xs" style={{ color:'var(--text-muted)' }}>Preview</div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={()=>speakPreview(`This is ${data.voiceName || 'the selected'} voice preview.`)}
                          className="w-8 h-8 rounded-full grid place-items-center"
                          aria-label="Play voice"
                          style={{ background:'var(--brand)', color:'#0a0f0d' }}
                        >
                          <Play className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={stopPreview}
                          className="w-8 h-8 rounded-full grid place-items-center border"
                          aria-label="Stop preview"
                          style={{ background: 'var(--panel)', color:'var(--text)', borderColor:'var(--border)' }}
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
            icon={<Mic className="w-4 h-4" style={{ color:'var(--brand)' }} />}
            desc="Transcription settings"
            defaultOpen
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
              <ToggleRow label="Background Denoising" checked={data.denoise} onChange={setField('denoise')} />
              <ToggleRow label="Use Numerals" checked={data.numerals} onChange={setField('numerals')} />
            </div>
          </Section>
        </div>
      </div>

      {/* Generate overlay */}
      {showGenerate && IS_CLIENT ? createPortal(
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
            onClick={()=> setShowGenerate(false)}
          />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: Z_MODAL }}>
            <div className="w-full max-w-[640px] rounded-[8px] overflow-hidden va-card" style={{ maxHeight:'86vh' }}>
              <div className="va-head" style={{ minHeight:56 }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg grid place-items-center" style={{ background:'rgba(89,217,179,.12)' }}>
                    <Wand2 className="w-5 h-5" style={{ color:'var(--brand)' }} />
                  </div>
                  <div className="text-lg font-semibold">Describe how to update the prompt</div>
                </div>
                <button
                  onClick={()=> setShowGenerate(false)}
                  className="w-8 h-8 rounded-[6px] grid place-items-center"
                  style={{ background:'var(--panel)', border:'1px solid var(--border)' }}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-3">
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Tip: “assistant for a dental clinic; tone friendly; handle booking and FAQs”.
                </div>
                <div className="rounded-[8px] p-2" style={{ background:'var(--panel)', border:'1px solid var(--border)' }}>
                  <textarea
                    value={composerText}
                    onChange={(e)=>setComposerText(e.target.value)}
                    className="va-input w-full"
                    placeholder="Describe changes…"
                    style={{ minHeight: 160, maxHeight: '40vh', resize:'vertical' }}
                  />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={()=> setShowGenerate(false)}
                  className="w-full h-[40px] rounded-[8px]"
                  style={{ background:'var(--panel)', border:'1px solid var(--border)', color:'var(--text)', fontWeight:600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={async ()=>{
                    const raw = safeTrim(composerText);
                    if (!raw) return;
                    try {
                      const base = nonEmpty(data.systemPrompt) ? data.systemPrompt : DEFAULT_PROMPT_RT;
                      const compiled = compilePrompt({ basePrompt: base, userText: raw });
                      setShowGenerate(false);
                      await sleep(150);
                      setField('systemPrompt')(compiled.frontendText);
                      setField('systemPromptBackend')(compiled.backendString);
                    } catch {
                      setToastKind('error'); setToast('Generate failed — try simpler wording.');
                      setTimeout(()=>setToast(''), 2200);
                    }
                  }}
                  disabled={!composerText.trim()}
                  className="w-full h-[40px] rounded-[8px] font-semibold inline-flex items-center justify-center gap-2"
                  style={{ background:'var(--brand)', color:'#0a0f0d', opacity: (!composerText.trim() ? .6 : 1) }}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}

      {/* Voice/Call panel (WebRTC) */}
      {IS_CLIENT ? createPortal(
        <>
          <div
            className={`fixed inset-0 ${showCall ? '' : 'pointer-events-none'}`}
            style={{
              zIndex: 9996,
              background: showCall ? 'rgba(8,10,12,.78)' : 'transparent',
              opacity: showCall ? 1 : 0,
              transition: 'opacity .2s var(--ease)'
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
              prosody={{ fillerWords: true, microPausesMs: 200, phoneFilter: true, turnEndPauseMs: 120 }}

              firstMode={data.firstMode as any}
              firstMsg={
                (data.greetPick==='random'
                  ? [...(data.firstMsgs||[])].filter(Boolean).sort(()=>Math.random()-0.5)
                  : (data.firstMsgs||[]).filter(Boolean)
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

/* ─────────── Section (exact same expand/collapse atoms as Account) ─────────── */
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

/* ─────────── small pieces ─────────── */
function ToggleRow({label, checked, onChange}:{label:string; checked:boolean; onChange:(v:boolean)=>void}) {
  return (
    <div className="flex items-center justify-between p-3 rounded-[8px]"
         style={{ background:'var(--panel)', border:'1px solid var(--border)' }}>
      <span className="text-sm">{label}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function ApiKeySelect({
  apiKeys, selectedId, onChange
}:{ apiKeys:ApiKey[]; selectedId:string; onChange:(id:string)=>void }) {
  return (
    <div>
      <div className="mb-2 text-[12.5px]">OpenAI API Key</div>
      <StyledSelect
        value={selectedId}
        onChange={onChange}
        options={[
          { value: '', label: 'Select an API key…' },
          ...apiKeys.map(k=>({ value: k.id, label: `${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}` }))
        ]}
      />
      <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
        Keys are stored per-account via scoped storage. Manage them in the API Keys page.
      </div>
    </div>
  );
}

function ContextFiles({ data, setField }:{
  data:AgentData;
  setField:<K extends keyof AgentData>(k:K)=> (v:AgentData[K])=>void;
}) {
  const fileInputRef = useRef<HTMLInputElement|null>(null);
  const rebuildContextText = (files:{name:string;text:string}[]) => {
    const merged = files.map(f => `# File: ${f.name}\n${(f.text||'').trim()}`).join('\n\n');
    setField('ctxFiles')(files);
    setField('contextText')(merged.trim());
  };
  const onPickFiles = async (files: File[]) => {
    if (!files?.length) return;
    const out: {name:string;text:string}[] = [...(data.ctxFiles||[])];
    for (const f of files) {
      const txt = await readFileAsText(f);
      if (!txt) continue;
      out.push({ name: f.name, text: txt });
    }
    rebuildContextText(out);
  };

  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-medium text-[12.5px]">Context Files</div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.csv,.json,.docx,.doc,.docs,text/plain,text/markdown,text/csv,application/json,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword,application/zip"
            className="hidden"
            onChange={async (e)=>{ const files = Array.from(e.target.files || []); await onPickFiles(files); if (fileInputRef.current) fileInputRef.current.value=''; }}
          />
          <button
            type="button"
            onClick={()=>fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
            style={{ border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)' }}
          >
            Add file
          </button>
          {!!(data.ctxFiles && data.ctxFiles.length) && (
            <>
              <button
                type="button"
                onClick={()=>{
                  const ctx  = (data.contextText || '').trim();
                  const base = (data.systemPromptBackend || data.systemPrompt || DEFAULT_PROMPT_RT).trim();
                  const next = ctx ? `${base}\n\n[Context]\n${ctx}`.trim() : base;
                  setField('systemPrompt')(next);
                }}
                className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                style={{ background:'var(--brand)', color:'#0a0f0d', border:'1px solid var(--border)' }}
              >
                Import to Prompt
              </button>
              <button
                type="button"
                onClick={()=>{ rebuildContextText([]); }}
                className="inline-flex items-center gap-2 text-sm rounded-[8px] px-3 py-1.5"
                style={{ border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)' }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {/* List of files */}
      {!(data.ctxFiles && data.ctxFiles.length) ? (
        <div className="text-xs" style={{ color:'var(--text-muted)' }}>
          No files yet. Click <b>Add file</b> to upload (.txt, .md, .csv, .json, <b>.docx</b> or best-effort <b>.doc</b> / <b>.docs</b>).
        </div>
      ) : (
        <div className="rounded-[8px] p-3" style={{ background:'var(--panel)', border:'1px solid var(--border)' }}>
          {(data.ctxFiles||[]).map((f, idx) => (
            <div key={idx} className="mb-3 last:mb-0">
              <div className="flex items-center justify-between mb-1">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <button
                  onClick={()=>{
                    const next = [...(data.ctxFiles||[])]; next.splice(idx,1);
                    rebuildContextText(next);
                  }}
                  className="text-xs rounded-[6px] px-2 py-1"
                  style={{ border:'1px solid var(--border)', background:'var(--panel)', color:'var(--text)' }}
                >
                  Remove
                </button>
              </div>
              <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                {(f.text || '').slice(0, 240) || '(empty)'}{(f.text||'').length>240?'…':''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
