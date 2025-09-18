// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, Pause
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

/* ─────────── constants ─────────── */
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';
const Z_OVERLAY = 100000;
const Z_MODAL   = 100001;
const Z_MENU    = 100010; // dropdown above everything

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

/* ─────────── theme tokens ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;

      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:8px;
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

    .va-menu-panel{
      background:var(--panel-bg);
      border:1px solid ${GREEN_LINE};
      border-radius:10px;
      box-shadow:0 36px 90px rgba(0,0,0,.55);
    }
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
  systemPrompt: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;       // actual voice id/name used by TTS
  apiKeyId?: string;

  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
};

const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
`[Identity]
You are a blank template AI assistant with minimal default settings.

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
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
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

/* ─────────── mock backend ─────────── */
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

/* ─────────── options helpers ─────────── */
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

const ttsProviders: Opt[] = [
  { value: 'openai',    label: 'OpenAI' },
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

/* ─────────── Select with portal menu + rail-style glow + inline player ─────────── */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuTop,
  onPreview /* returns a promise that plays/handles audio for the given value */,
  isPreviewing /* which value is currently previewing */
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
  onPreview?: (v: string) => Promise<void>;
  isPreviewing?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuRect, setMenuRect] = useState<{top:number; left:number; width:number; maxH:number; placement:'below'|'above'} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  // position menu into viewport (fixed) and portal to body
  const computeRect = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - r.bottom - 12;
    const spaceAbove = r.top - 12;
    const placeBelow = spaceBelow >= Math.min(320, Math.max(220, spaceAbove));
    const maxH = Math.max(160, Math.min(320, placeBelow ? spaceBelow : spaceAbove));
    setMenuRect({
      top: Math.round(placeBelow ? r.bottom + 8 : r.top - 8),
      left: Math.round(r.left),
      width: Math.round(r.width),
      maxH,
      placement: placeBelow ? 'below' : 'above'
    });
  };

  useEffect(() => {
    if (!open) return;
    computeRect();
    const onScroll = () => computeRect();
    const onResize = () => computeRect();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    return () => { window.removeEventListener('mousedown', off); window.removeEventListener('keydown', onEsc); };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen(v=>!v);
          setTimeout(() => { computeRect(); searchRef.current?.focus(); }, 0);
        }}
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
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0)', transition:'transform .18s var(--ease)' }} />
      </button>

      {open && menuRect && createPortal(
        <div
          className="va-menu-panel"
          style={{
            position:'fixed',
            zIndex: Z_MENU,
            top: menuRect.placement === 'below' ? menuRect.top : undefined,
            bottom: menuRect.placement === 'above' ? (window.innerHeight - menuRect.top) : undefined,
            left: menuRect.left,
            width: menuRect.width,
            maxHeight: menuRect.maxH,
            overflow:'hidden'
          }}
        >
          {menuTop ? <div className="p-3 border-b" style={{ borderColor: GREEN_LINE }}>{menuTop}</div> : null}

          <div className="p-3">
            <div
              className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
              style={{ background:'var(--panel-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
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

            <div className="overflow-y-auto pr-1" style={{ maxHeight: menuRect.maxH - 70, scrollbarWidth:'thin' }}>
              {filtered.map(o => (
                <div key={o.value} className="relative">
                  <button
                    disabled={o.disabled}
                    onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                    className="va-option w-full text-left text-sm px-3 py-2 rounded-[10px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                    style={{
                      position:'relative',
                      color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                      background:'transparent',
                      border:'none',
                      cursor:o.disabled?'not-allowed':'pointer'
                    }}
                  >
                    {o.disabled ? (
                      <Lock className="w-3.5 h-3.5" />
                    ) : (
                      <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />
                    )}
                    <span className="truncate">{o.label}</span>

                    {/* Inline player button (doesn't close the menu) */}
                    {onPreview ? (
                      <button
                        type="button"
                        onClick={async (e)=>{ e.stopPropagation(); await onPreview(o.value); }}
                        className="w-7 h-7 rounded-full grid place-items-center"
                        style={{ border:'1px solid var(--input-border)', background:'var(--panel-bg)' }}
                        aria-label={isPreviewing === o.value ? 'Stop preview' : 'Play preview'}
                        title={isPreviewing === o.value ? 'Stop' : 'Play'}
                      >
                        {isPreviewing === o.value ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    ) : <span />}
                  </button>
                </div>
              ))}
              {filtered.length===0 && (
                <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>
              )}
            </div>
          </div>

          {/* rail-style green overlay on hover/active */}
          <style jsx>{`
            .va-option::after{
              content:'';
              position:absolute; inset:0;
              border-radius:10px;
              background:${GREEN_LINE};
              opacity:0;
              mix-blend-mode:screen;
              pointer-events:none;
              transition:opacity .18s var(--ease), transform .18s var(--ease);
            }
            .va-option:hover::after{ opacity:.18; transform: translateY(-1px); }
            .va-option:active::after{ opacity:.30; }
          `}</style>
        </div>,
        document.body
      )}
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

/* ─────────── Page ─────────── */
export default function VoiceAgentSection() {
  /* measure app sidebar so rail aligns */
  useEffect(() => {
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
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  const [showCall, setShowCall] = useState(false);
  const [messages, setMessages] = useState<Array<{role:'user'|'assistant'; text:string}>>([
    { role: 'assistant', text: 'Hi! Ready when you are.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'loading'>('idle');
  const basePromptRef = useRef<string>('');
  const [pendingPrompt, setPendingPrompt] = useState<string>('');

  /* ---- OpenAI voices + preview ---- */
  type VoiceOpt = { value: string; label: string; note?: string };
  const [voiceOpts, setVoiceOpts] = useState<VoiceOpt[]>([
    // fallback until API route is ready
    { value: 'Alloy (American)', label: 'Alloy (American)' },
    { value: 'Verse (American)', label: 'Verse (American)' },
    { value: 'Coral (British)',  label: 'Coral (British)' },
    { value: 'Amber (Australian)', label: 'Amber (Australian)' },
  ]);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // fetch from your API route; ignore errors and keep fallback list
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/openai/voices');
        if (!r.ok) return;
        const arr = await r.json(); // [{id,name,preview?}]
        if (Array.isArray(arr) && arr.length) {
          setVoiceOpts(arr.map((v:any) => ({ value: String(v.id || v.name), label: String(v.name || v.id) })));
        }
      } catch {}
    })();
  }, []);

  async function previewVoice(v: string) {
    try {
      if (previewing === v) {
        // stop
        setPreviewing(null);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        return;
      }
      setPreviewing(v);
      // stop any existing
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      // fetch preview stream (implement this route)
      const url = `/api/voice/preview?voice=${encodeURIComponent(v)}`;
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setPreviewing(null);
      await a.play();
    } catch {
      setPreviewing(null);
    }
  }

  /* web speech preview for the little top preview buttons (unchanged) */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);
  function speakPreview(line?: string){
    const u = new SpeechSynthesisUtterance(line || `Hi, I'm ${data.name || 'your assistant'}. This is a preview.`);
    const byName = voices.find(v => v.name.toLowerCase().includes((data.voiceName || '').split(' ')[0]?.toLowerCase() || ''));
    const en = voices.find(v => v.lang?.startsWith('en'));
    if (byName) u.voice = byName; else if (en) u.voice = en;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  const stopPreview = () => window.speechSynthesis.cancel();

  /* listen for active rail id */
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

  function setField<K extends keyof AgentData>(k: K) {
    return (v: AgentData[K]) => setData(prev => ({ ...prev, [k]: v }));
  }

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

  function buildPrompt(base: string, extraRaw: string) {
    const extra = (extraRaw || '').trim();
    if (!extra) return base;
    const lines = extra.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => /[.!?]$/.test(s) ? s : `${s}.`);
    const block = `

[Extra Instructions]
${lines.map(l => `- ${l}`).join('\n')}

[Behavior]
- Always respect the Extra Instructions above.
- Keep replies concise and useful.
- Ask for missing info before acting.`;
    return `${base}${block}`;
  }

  function startGenerate() {
    basePromptRef.current = data.systemPrompt;
    setGenPhase('loading');
    setTimeout(() => {
      const merged = buildPrompt(basePromptRef.current, composerText);
      setPendingPrompt(merged);
      setShowGenerate(false);
      setGenPhase('idle');
      setToast('Preview generated – click Apply to save');
    }, 500);
  }
  const acceptDiff = () => { setData(p => ({ ...p, systemPrompt: pendingPrompt })); setPendingPrompt(''); };
  const declineDiff = () => { setPendingPrompt(''); };

  function sendChat() {
    const txt = chatInput.trim();
    if (!txt) return;
    setMessages(m => [...m, { role: 'user', text: txt }]);
    setChatInput('');
    const reply = `${data.name || 'Assistant'}: "${txt}" received. How can I help further?`;
    setTimeout(() => setMessages(m => [...m, { role: 'assistant', text: reply }]), 350);
  }

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
              onClick={()=>{ setShowCall(true); }}
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
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                 style={{ background:'rgba(89,217,179,.10)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.16) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

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
                <StyledSelect value={data.model} onChange={setField('model')} options={modelOpts}/>
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
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-[var(--s-2)]">
                  <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                      style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                      onClick={()=>{ setComposerText(''); setShowGenerate(true); setGenPhase('idle'); }}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                <div style={{ position:'relative' }}>
                  <textarea
                    className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                    style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                    value={pendingPrompt || data.systemPrompt}
                    onChange={(e)=>{
                      if (pendingPrompt) setPendingPrompt(e.target.value);
                      else setField('systemPrompt')(e.target.value);
                    }}
                  />
                </div>
              </div>
            </div>
          </Section>

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
                  options={voiceOpts}
                  placeholder="— Choose —"
                  onPreview={previewVoice}
                  isPreviewing={previewing}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 mt-[var(--s-4)]">
              <div className="flex items-center justify-between px-3 py-2 rounded-[10px]"
                   style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>Quick web-speech preview</div>
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
            </div>
          </Section>

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
              <div className="flex items-center justify-between p-3 rounded-[10px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                <span className="text-sm">Background Denoising Enabled</span>
                <Toggle checked={data.denoise} onChange={setField('denoise')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-[10px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                <span className="text-sm">Use Numerals</span>
                <Toggle checked={data.numerals} onChange={setField('numerals')} />
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Generate overlay — blur UNDER the box */}
      {showGenerate && (
        <>
          <div
            className="fixed inset-0"
            style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
            onClick={()=>{ if (genPhase==='idle') setShowGenerate(false); }}
          />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: Z_MODAL }}>
            <div
              className="w-full max-w-[720px] rounded-[12px] overflow-hidden"
              style={{
                background:'var(--panel)',
                color:'var(--text)',
                border:`1px solid ${GREEN_LINE}`,
                boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)'
              }}
            >
              <div
                className="flex items-center px-6 py-5"
                style={{
                  background:`linear-gradient(90deg, var(--panel) 0%, color-mix(in oklab, var(--panel) 97%, white 3%) 50%, var(--panel) 100%)`,
                  borderBottom:`1px solid ${GREEN_LINE}`
                }}
              >
                <div className="w-10 h-10 rounded-xl grid place-items-center mr-3" style={{ background:'var(--brand-weak)' }}>
                  <Wand2 className="w-5 h-5" style={{ color: CTA }} />
                </div>
                <div className="text-lg font-semibold">Compose Prompt</div>
              </div>

              <div className="px-6 py-5">
                <label className="text-xs block mb-2" style={{ color:'var(--text-muted)' }}>
                  Add extra instructions (persona, tone, rules, tools):
                </label>
                <textarea
                  value={composerText}
                  onChange={(e)=>setComposerText(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
                  placeholder="e.g., Friendly, crisp answers. Confirm account ID before actions."
                  style={{ minHeight: 180, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                />
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button
                  onClick={()=>{ if (genPhase==='idle') setShowGenerate(false); }}
                  disabled={genPhase==='loading'}
                  className="w-full h-[44px] rounded-[10px]"
                  style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.9)', color:'var(--text)', fontWeight:600 }}
                >
                  Cancel
                </button>
                <button
                  onClick={()=>{
                    basePromptRef.current = data.systemPrompt;
                    setGenPhase('loading');
                    setTimeout(() => {
                      const merged = buildPrompt(basePromptRef.current, composerText);
                      setPendingPrompt(merged);
                      setShowGenerate(false);
                      setGenPhase('idle');
                      setComposerText('');
                    }, 500);
                  }}
                  disabled={genPhase==='loading'}
                  className="w-full h-[44px] rounded-[10px] font-semibold"
                  style={{ background:CTA, color:'#0a0f0d' }}
                >
                  {genPhase==='loading' ? 'Generating…' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
