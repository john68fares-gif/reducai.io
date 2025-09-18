// components/voice/VoiceAgentSection.tsx
'use client';

import React, {
  useEffect, useMemo, useRef, useState, useLayoutEffect
} from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock, X, KeyRound,
  Play, Square
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
const ACTIVE_KEY = 'va:activeId';
const GREEN_LINE = 'rgba(89,217,179,.20)'; // keep consistent with rail

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

/* ─────────── SOLID theme + layout vars ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;

      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:8px;
      --control-h:44px; --header-h:88px;
      --fz-title:18px; --fz-sub:15px; --fz-body:14px; --fz-label:12.5px;
      --lh-body:1.45; --ease:cubic-bezier(.22,.61,.36,1);

      /* Layout: measured at runtime */
      --app-sidebar-w: 240px; /* updated by ResizeObserver */
      --rail-w: 260px;

      --page-bg:var(--bg);
      --panel-bg:var(--panel);
      --input-bg:var(--panel);
      --input-border:rgba(255,255,255,.10);
      --input-shadow:0 0 0 1px rgba(255,255,255,.06) inset;

      --border-weak:rgba(255,255,255,.10);
      --card-shadow:0 22px 44px rgba(0,0,0,.28),
                    0 0 0 1px rgba(255,255,255,.06) inset,
                    0 0 0 1px rgba(89,217,179,.20);
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

    /* AssistantRail is pinned immediately to the right of your global sidebar */
    .va-left-fixed{
      position:fixed;
      top:0; bottom:0;
      left:var(--app-sidebar-w);
      width:var(--rail-w);
      z-index:12;
      background:var(--panel-bg);
      border-right:1px solid rgba(255,255,255,.06);
      box-shadow:14px 0 28px rgba(0,0,0,.08);
      display:flex; flex-direction:column;
    }
    .va-left-fixed .rail-scroll{ overflow:auto; flex:1; }

    /* Page content shifts by (app sidebar + rail) so it never drifts */
    .va-page{
      margin-left: calc(var(--app-sidebar-w) + var(--rail-w));
      transition: margin-left 180ms var(--ease);
    }

    /* Dropdown menu base (solid) */
    .va-menu{
      background:var(--panel-bg);
      border:1px solid rgba(255,255,255,.12);
      box-shadow:0 36px 90px rgba(0,0,0,.55);
      border-radius:10px;
    }

    /* Drawer + modal overlays (solid + blur LIKE AssistantRail) */
    .va-overlay{
      position:fixed; inset:0; z-index:9996;
      background:rgba(6,8,10,.62);
      backdrop-filter:blur(6px);
      opacity:0; pointer-events:none; transition:opacity 200ms var(--ease);
    }
    .va-overlay.open{ opacity:1; pointer-events:auto; }

    .va-call-drawer{
      position:fixed; inset:0 0 0 auto; width:min(540px,92vw); z-index:9997;
      display:grid; grid-template-rows:auto 1fr auto;
      background:var(--panel-bg);
      border-left:1px solid rgba(255,255,255,.10);
      box-shadow:-28px 0 80px rgba(0,0,0,.55);
      transform:translateX(100%); transition:transform 280ms var(--ease);
    }
    .va-call-drawer.open{ transform:translateX(0); }

    .va-modal-wrap{ position:fixed; inset:0; z-index:9998; }
    .va-modal-center{ position:absolute; inset:0; display:grid; place-items:center; padding:20px; }
    .va-sheet{
      background:var(--panel-bg);
      border:1px solid ${GREEN_LINE};           /* thinner feel but same token */
      box-shadow:0 28px 80px rgba(0,0,0,.70);
      border-radius:10px;
    }

    .chat-msg{ max-width:85%; padding:10px 12px; border-radius:12px; }
    .chat-user{ background:var(--panel-bg); border:1px solid rgba(255,255,255,.12); align-self:flex-end; }
    .chat-ai{ background:color-mix(in oklab, var(--panel-bg) 92%, black 8%); border:1px solid rgba(255,255,255,.12); align-self:flex-start; }
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
  voiceId?: string;        // use ID for actual selection
  voiceName: string;       // label for display
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

/* ─────────── options ─────────── */
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

/* ─────────── tiny diff helper (word-level with additions/removals) ─────────── */
function diffWords(oldStr: string, newStr: string){
  const a = oldStr.split(/\s+/), b = newStr.split(/\s+/);
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({length:m+1},()=>Array(n+1).fill(0));
  for(let i=1;i<=m;i++) for(let j=1;j<=n;j++) dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]+1:Math.max(dp[i-1][j],dp[i][j-1]);
  const ops: Array<{type:'eq'|'add'|'rem'; text:string}> = [];
  let i=m, j=n, bufAdd:string[]=[], bufRem:string[]=[];
  const flush=(kind:'add'|'rem')=>{
    const buf = kind==='add'?bufAdd:bufRem;
    if (buf.length) {
      const text = buf.reverse().join(' ');
      ops.unshift({ type: kind, text });
      if (kind==='add') bufAdd=[]; else bufRem=[];
    }
  };
  while(i>0 || j>0){
    if(i>0 && j>0 && a[i-1]===b[j-1]){ flush('add'); flush('rem'); ops.unshift({ type:'eq', text:a[i-1]}); i--; j--; }
    else if(j>0 && (i===0 || dp[i][j-1] >= dp[i-1][j])){ bufAdd.push(b[j-1]); j--; }
    else { bufRem.push(a[i-1]); i--; }
  }
  flush('add'); flush('rem');
  return ops;
}

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

/* Select: portaled, solid, glow-on-hover, inline preview per item */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon,
  menuTop,
  onPreview,
  isPreviewing
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
  onPreview?: (value: string) => void;
  isPreviewing?: string | null;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{top:number; left:number; width:number; placement:'above'|'below'}|null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  const placeMenu = () => {
    const el = btnRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxBelow = window.innerHeight - (r.bottom + 8);
    const estHeight = Math.min(320, 44 + (filtered.length * 36) + (menuTop ? 48 : 0));
    const placement: 'above'|'below' = maxBelow >= estHeight ? 'below' : 'above';
    const top = placement==='below' ? r.bottom + 8 : r.top - 8; // we will anchor via top or bottom using placement
    setRect({ top, left: r.left, width: r.width, placement });
  };

  useEffect(() => {
    if (!open) return;
    placeMenu();
    const off = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onRelayout = () => placeMenu();
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onRelayout, true);
    window.addEventListener('resize', onRelayout);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onRelayout, true);
      window.removeEventListener('resize', onRelayout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, filtered.length]);

  return (
    <div ref={wrapRef} className="relative">
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

      {open && rect && typeof document !== 'undefined' && createPortal(
        <div
          className="va-menu"
          style={{
            position:'fixed',
            zIndex: 2147480000,
            top: rect.placement==='below' ? rect.top : undefined,
            bottom: rect.placement==='above' ? (window.innerHeight - rect.top) : undefined,
            left: rect.left,
            width: rect.width,
            border:`1px solid ${GREEN_LINE}`,
            borderRadius:10,
            overflow:'hidden'
          }}
        >
          <div className="p-3" style={{ background:'var(--panel-bg)', color:'var(--text)' }}>
            {menuTop ? <div className="mb-2">{menuTop}</div> : null}

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

            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(o => (
                <div key={o.value} className="relative">
                  <button
                    disabled={o.disabled}
                    onClick={()=>{ if (o.disabled) return; onChange(o.value); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-[8px] transition flex items-center gap-2 disabled:opacity-60 relative"
                    style={{
                      color:'var(--text)',
                      background:'var(--panel-bg)',
                      border:'1px solid var(--panel-bg)',
                      cursor:o.disabled?'not-allowed':'pointer'
                    }}
                    onMouseEnter={(e)=>{ if (o.disabled) return;
                      const el=e.currentTarget as HTMLButtonElement;
                      el.style.background = 'var(--panel-bg)';
                      el.style.border = '1px solid var(--input-border)';
                    }}
                    onMouseLeave={(e)=>{
                      const el=e.currentTarget as HTMLButtonElement;
                      el.style.background = 'var(--panel-bg)';
                      el.style.border = '1px solid var(--panel-bg)';
                    }}
                  >
                    {/* green overlay glow on hover (top highlight) */}
                    <span
                      className="pointer-events-none"
                      style={{
                        position:'absolute', left:8, right:8, top:-6, height:16, borderRadius:12,
                        background:'radial-gradient(60% 80% at 50% 100%, rgba(89,217,179,.45) 0%, rgba(89,217,179,0) 100%)',
                        opacity:0, filter:'blur(6px)', transition:'opacity .18s ease'
                      }}
                    />
                    <span className="flex-1 truncate">{o.label}</span>

                    {/* Inline preview control */}
                    {onPreview && (
                      <button
                        type="button"
                        onClick={(ev)=>{ ev.stopPropagation(); onPreview(o.value); }}
                        className="w-7 h-7 rounded-full grid place-items-center"
                        style={{ background:'rgba(89,217,179,.18)', border:`1px solid ${GREEN_LINE}`, color:'#0a0f0d' }}
                        aria-label={isPreviewing===o.value ? 'Stop preview' : 'Play preview'}
                      >
                        {isPreviewing===o.value ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </button>
                  <style jsx>{`
                    div:hover > button > span:first-child { opacity:.75; }
                  `}</style>
                </div>
              ))}
              {filtered.length===0 && (
                <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>
              )}
            </div>
          </div>
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
  /* Measure the real app sidebar so our rail "touches" it and moves with collapse */
  useEffect(() => {
    const candidates = [
      '[data-app-sidebar]',
      'aside[aria-label="Sidebar"]',
      'aside[class*="sidebar"]',
      '#sidebar'
    ];
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

  /* Generate overlay */
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'typing'>('idle');
  const basePromptRef = useRef<string>('');
  const [diffHtml, setDiffHtml] = useState<string>(''); // highlighted diff HTML, typed progressively
  const [pendingMerged, setPendingMerged] = useState<string>(''); // raw merged value

  /* Voices (API + inline previews) */
  const [voicesApi, setVoicesApi] = useState<Array<{id:string; name:string}>>([]);
  const [previewing, setPreviewing] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  /* Load voices from your API (by ID) */
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/openai/voices');
        if (!r.ok) return;
        const arr = await r.json(); // [{id,name}]
        if (Array.isArray(arr) && arr.length) setVoicesApi(arr);
      } catch {}
    })();
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

  /* Generate → keep overlay, type diff with highlights, accept/decline */
  async function startGenerate() {
    basePromptRef.current = data.systemPrompt;
    const merged = buildPrompt(basePromptRef.current, composerText);
    setPendingMerged(merged);

    // Build highlighted diff HTML
    const ops = diffWords(basePromptRef.current, merged);
    const html = ops.map(op => {
      if (op.type==='eq') return op.text;
      if (op.type==='add') return `<span style="background:rgba(89,217,179,.25)">${op.text}</span>`;
      return `<span style="background:rgba(239,68,68,.25); text-decoration:line-through">${op.text}</span>`;
    }).join(' ');

    // Type it in
    setGenPhase('typing');
    setDiffHtml(''); // start empty
    let i=0;
    const interval = 8; // ms per char
    const timer = window.setInterval(()=>{
      i++;
      setDiffHtml(html.slice(0, i));
      if (i >= html.length) { window.clearInterval(timer); setGenPhase('idle'); }
    }, interval);
  }
  const acceptDiff = () => {
    if (pendingMerged) setData(p => ({ ...p, systemPrompt: pendingMerged }));
    setPendingMerged('');
    setDiffHtml('');
    setShowGenerate(false);
  };
  const declineDiff = () => {
    setPendingMerged('');
    setDiffHtml('');
    setShowGenerate(false);
  };

  /* Inline voice preview inside dropdown */
  async function previewVoice(voiceId: string) {
    try {
      if (previewing === voiceId) {
        setPreviewing(null);
        if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
        return;
      }
      setPreviewing(voiceId);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
      const url = `/api/voice/preview?voiceId=${encodeURIComponent(voiceId)}`;
      const a = new Audio(url);
      audioRef.current = a;
      a.onended = () => setPreviewing(null);
      await a.play();
    } catch {
      setPreviewing(null);
    }
  }

  const voiceOptions: Opt[] = useMemo(
    () => voicesApi.map(v => ({ value: v.id, label: v.name })),
    [voicesApi]
  );

  const currentVoiceLabel =
    voicesApi.find(v => v.id === data.voiceId)?.name || data.voiceName || '— Choose —';

  const stopPreview = () => {
    try {
      setPreviewing(null);
      if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    } catch {}
  };

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* rail (260px) + centered content */}
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Rail */}
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(255,255,255,.06)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* Content column */}
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
                    {pendingMerged && (
                      <>
                        <button
                          onClick={acceptDiff}
                          className="h-9 px-3 rounded-[10px] font-semibold"
                          style={{ background:CTA, color:'#0a0f0d' }}
                        >
                          Accept changes
                        </button>
                        <button
                          onClick={declineDiff}
                          className="h-9 px-3 rounded-[10px]"
                          style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                      style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'#fff' }}
                      onClick={()=>{ setComposerText(''); setShowGenerate(true); setGenPhase('idle'); setDiffHtml(''); setPendingMerged(''); }}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                <div style={{ position:'relative' }}>
                  <textarea
                    className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                    style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                    value={pendingMerged || data.systemPrompt}
                    onChange={(e)=>{
                      if (pendingMerged) setPendingMerged(e.target.value);
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
                  value={data.voiceId || ''}
                  onChange={(id)=>{
                    const v = voicesApi.find(x => x.id === id);
                    setData(p => ({ ...p, voiceId: id, voiceName: v?.name || p.voiceName }));
                    stopPreview();
                  }}
                  options={voiceOptions}
                  placeholder={currentVoiceLabel}
                  onPreview={previewVoice}
                  isPreviewing={previewing}
                />
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

      {/* Generate Overlay — matches AssistantRail style, stays until Accept/Decline */}
      {showGenerate && (
        <div className="va-modal-wrap" role="dialog" aria-modal>
          <div className={`va-overlay open`} onClick={()=>{ if (genPhase==='idle') declineDiff(); }} />
          <div className="va-modal-center">
            <div className="va-sheet w-full max-w-[860px] p-5 md:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="text-lg font-semibold" style={{ color:'#fff' }}>Compose Prompt</div>
                <button onClick={()=>{ if (genPhase==='idle') declineDiff(); }} className="p-1 rounded hover:opacity-80" aria-label="Close">
                  <X className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
                </button>
              </div>

              {/* Composer */}
              <div className="grid gap-3 mb-4">
                <label className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Add extra instructions (persona, tone, rules, tools):
                </label>
                <textarea
                  value={composerText}
                  onChange={(e)=>setComposerText(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
                  placeholder="e.g., Friendly, crisp answers. Confirm account ID before actions."
                  style={{ minHeight: 120, background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                  disabled={genPhase==='typing'}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={declineDiff}
                    disabled={genPhase==='typing'}
                    className="h-9 px-3 rounded-[10px]"
                    style={{ background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startGenerate}
                    disabled={genPhase==='typing'}
                    className="h-9 px-4 rounded-[10px] font-semibold"
                    style={{ background:CTA, color:'#fff' }}
                  >
                    Generate
                  </button>
                </div>
              </div>

              {/* Typing / Diff pane */}
              {(genPhase==='typing' || diffHtml || pendingMerged) && (
                <div>
                  <div className="mb-2 text-xs" style={{ color:'var(--text-muted)' }}>
                    Preview (additions = green, removals = red)
                  </div>
                  <div
                    className="rounded-[10px] p-3"
                    style={{ background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', minHeight:160 }}
                  >
                    <pre
                      style={{ whiteSpace:'pre-wrap', wordBreak:'break-word', fontFamily:'inherit', fontSize:13.5, lineHeight:1.5 }}
                      dangerouslySetInnerHTML={{ __html: diffHtml || '' }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-end gap-2">
                    <button
                      onClick={declineDiff}
                      disabled={genPhase==='typing'}
                      className="h-9 px-3 rounded-[10px]"
                      style={{ background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                    >
                      Decline
                    </button>
                    <button
                      onClick={acceptDiff}
                      disabled={genPhase==='typing' || !pendingMerged}
                      className="h-9 px-3 rounded-[10px] font-semibold"
                      style={{ background:CTA, color:'#0a0f0d' }}
                    >
                      Accept changes
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Call drawer */}
      {createPortal(
        <>
          <div
            className={`va-overlay ${showCall ? 'open' : ''}`}
            onClick={()=> setShowCall(false)}
          />
          <aside className={`va-call-drawer ${showCall ? 'open' : ''}`} aria-hidden={!showCall}>
            <div className="flex items-center justify-between px-4 h-[64px]"
                 style={{ background:'var(--panel-bg)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
              <div className="font-semibold">Chat with {data.name || 'Assistant'}</div>
              <button onClick={()=>setShowCall(false)} className="px-2 py-1 rounded border"
                      style={{ color:'var(--text)', borderColor:'var(--input-border)', background:'var(--panel-bg)' }}>
                Close
              </button>
            </div>

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

            <div className="p-3" style={{ borderTop:'1px solid rgba(255,255,255,.10)' }}>
              <form onSubmit={(e)=>{ e.preventDefault(); setMessages(m=>[...m,{role:'user',text:chatInput.trim()}]); setChatInput(''); }} className="flex items-center gap-2">
                <input
                  value={chatInput}
                  onChange={(e)=>setChatInput(e.target.value)}
                  placeholder={`Message ${data.name || 'Assistant'}…`}
                  className="flex-1 rounded-md px-3 py-2 outline-none"
                  style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                />
                <button type="submit" className="h-10 px-4 rounded-md font-semibold" style={{ background:CTA, color:'#fff' }}>
                  Send
                </button>
              </form>
            </div>
          </aside>
        </>,
        document.body
      )}
    </section>
  );
}
