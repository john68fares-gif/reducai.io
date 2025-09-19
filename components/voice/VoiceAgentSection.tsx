// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Check, KeyRound,
  Play, Square, Loader2
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

      --app-sidebar-w: 240px;
      --rail-w: 260px;

      --page-bg:var(--bg);
      --panel-bg:var(--panel);
      --input-bg:var(--panel);
      --input-border:rgba(255,255,255,.10);
      --input-shadow:0 0 0 1px rgba(255,255,255,.06) inset;

      --border-weak:rgba(255,255,255,.10);
      /* no inset -> no weird bottom hairline */
      --card-shadow:0 22px 44px rgba(0,0,0,.28),
                    0 0 0 1px rgba(89,217,179,.20);
    }
    :root:not([data-theme="dark"]) .va-scope{
      --bg:#f6f7f9; --panel:#ffffff; --text:#0f172a; --text-muted:#64748b;
      --input-border:rgba(15,23,42,.12);
      --border-weak:rgba(15,23,42,.12);
      --card-shadow:0 12px 28px rgba(10,12,14,.10),
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
      border-bottom:1px solid rgba(89,217,179,.20);
      color:var(--text);
    }

    /* Drawer + modal overlays (match AssistantRail) */
    .va-blur-layer{
      position:fixed; inset:0; z-index:9996;
      background:rgba(6,8,10,.62);
      backdrop-filter:blur(6px);
      opacity:0; pointer-events:none; transition:opacity 200ms var(--ease);
    }
    .va-blur-layer.open{ opacity:1; pointer-events:auto; }

    /* Diff colors */
    .diff-added{ background:rgba(89,217,179,.20); color:var(--text); border-radius:4px; padding:0 1px; }
    .diff-removed{ background:rgba(239,68,68,.20); color:var(--text); text-decoration:line-through; border-radius:4px; padding:0 1px; }

    /* Typing animation */
    @keyframes caret { 0%,100%{opacity:0} 50%{opacity:1} }
    .typing-caret::after{
      content:'▍'; margin-left:2px; animation:caret 900ms steps(1,end) infinite;
    }

    /* Flat dropdown items: no borders/lines/dividers; only glow on hover */
    :root { --cta:#59d9b3; --hover-overlay:.20; }
    .va-dd-item{ border:none !important; }
    .va-dd-item::after{
      content:'';
      position:absolute; inset:0;
      border-radius:10px;
      background:var(--cta);
      opacity:0; pointer-events:none;
      transition: opacity .18s ease, transform .18s ease;
      mix-blend-mode:screen;
    }
    .va-dd-item:hover::after{ opacity:var(--hover-overlay); }
    .va-dd-item:hover{ transform: translateY(-1px); }
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
  voiceName: string; // store voice.name
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
  voiceName: '',
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
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true },
  { value: 'google',     label: 'Google — coming soon',    disabled: true },
];

const modelOptsFor = (provider: string): Opt[] =>
  provider === 'openai'
    ? [
        { value: 'GPT-4o',  label: 'GPT-4o' },
        { value: 'GPT-4.1', label: 'GPT-4.1' },
        { value: 'o4-mini', label: 'o4-mini' },
      ]
    : [{ value: 'coming', label: 'Models coming soon', disabled: true }];

const asrProviders: Opt[] = [
  { value: 'deepgram',   label: 'Deepgram' },
  { value: 'whisper',    label: 'Whisper — coming soon', disabled: true },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true },
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

/* ─────────── Dropdown (flat items; optional footer inside menu) ─────────── */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuFooter
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuFooter?: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef  = useRef<HTMLButtonElement|null>(null);

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{top:number; left:number; width:number}>({top:0,left:0,width:0});

  const current = options.find(o => o.value === value) || null;

  const measure = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({
      top: Math.round(r.bottom + window.scrollY + 8),
      left: Math.round(r.left + window.scrollX),
      width: Math.round(r.width),
    });
  };

  useEffect(() => {
    if (!open) return;
    measure();
    const onScroll = () => measure();
    const onResize = () => measure();
    const offClick = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('mousedown', offClick);
    window.addEventListener('keydown', onEsc);

    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousedown', offClick);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
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

      {open && typeof document !== 'undefined' && createPortal(
        <>
          <div
            className="fixed inset-0 z-[2147482999]"
            onMouseDown={()=>setOpen(false)}
            style={{ background:'transparent' }}
          />

          <div
            className="va-menu"
            style={{
              position:'absolute',
              top: pos.top,
              left: pos.left,
              width: pos.width,
              zIndex: 2147483000,
              overflow:'hidden',
              background:'var(--panel)',
              border:'1px solid rgba(89,217,179,.20)',
              borderRadius:10,
              boxShadow:'0 36px 90px rgba(0,0,0,.55)',
              isolation:'isolate',
              contain:'paint'
            }}
          >
            <div className="max-h-72 overflow-y-auto p-2" style={{ scrollbarWidth:'thin', background:'var(--panel)' }}>
              {options.map(o => (
                <button
                  key={o.value}
                  disabled={o.disabled}
                  onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                  className="va-dd-item w-full text-left text-sm px-3 py-2 rounded-[10px] transition flex items-center gap-2 disabled:opacity-60 relative"
                  style={{
                    background:'var(--panel)',
                    color:'var(--text)',
                    border:'none',
                    cursor:o.disabled?'not-allowed':'pointer',
                    position:'relative',
                    isolation:'isolate'
                  }}
                >
                  <span className="flex-1 truncate">{o.label}</span>
                  {o.note ? <span className="text-[11px]" style={{ color:'var(--text-muted)' }}>{o.note}</span> : null}
                </button>
              ))}
            </div>

            {menuFooter ? (
              <div className="px-3 py-2" style={{ borderTop:'1px solid rgba(89,217,179,.20)', background:'var(--panel)' }}>
                {menuFooter}
              </div>
            ) : null}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

/* ─────────── Modal bits to match AssistantRail exactly ─────────── */
function RailModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <motion.div
        className="fixed inset-0 z-[100000]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
      />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: .18, ease: 'easeOut' }}
          className="w-full max-w-[760px] rounded-[10px] overflow-hidden"
          style={{
            background: 'var(--panel)',
            color: 'var(--text)',
            border: '1px solid rgba(89,217,179,.20)',
            maxHeight: '86vh',
            boxShadow:'0 28px 80px rgba(0,0,0,.70)'
          }}
        >
          {children}
        </motion.div>
      </div>
    </>,
    document.body
  );
}
function RailModalHeader({ icon, title, subtitle }:{
  icon:React.ReactNode; title:string; subtitle?:string;
}) {
  return (
    <div
      className="flex items-center justify-between px-6 py-4"
      style={{
        background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
        borderBottom:`1px solid rgba(89,217,179,.20)`
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--brand-weak)' }}>
          <span style={{ color: CTA, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }}>
            {icon}
          </span>
        </div>
        <div className="min-w-0">
          <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-xs" style={{ color:'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <span className="w-5 h-5" />
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

/* ─────────── helpers: rewrite + diff + typing ─────────── */
function normalizeAIText(s: string){
  const lines = s.split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => /[.!?]$/.test(x) ? x : `${x}.`);
  return lines.join('\n');
}
function buildAIStylePrompt(base: string, extra: string){
  const extras = normalizeAIText(extra || '');
  const block = extras
    ? `

[Extra Instructions]
${extras}

[Behavior]
- Apply Extra Instructions when relevant.
- Keep responses concise and useful.
- Ask for missing info before acting.`
    : '';

  return `${base.trim()}${block}`.trim();
}
// very small diff (token-ish)
function diffHTML(oldText: string, newText: string){
  const a = oldText.split(/(\s+|\b)/);
  const b = newText.split(/(\s+|\b)/);
  const dp: number[][] = Array(a.length+1).fill(0).map(()=>Array(b.length+1).fill(0));
  for (let i=1;i<=a.length;i++) for (let j=1;j<=b.length;j++){
    dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
  }
  let i=a.length, j=b.length, outA:string[]=[], outB:string[]=[];
  while(i>0 && j>0){
    if(a[i-1]===b[j-1]){ outA.unshift(a[i-1]); outB.unshift(b[j-1]); i--; j--; }
    else if(dp[i-1][j]>=dp[i][j-1]){ outA.unshift(`<span class="diff-removed">${escapeHTML(a[i-1])}</span>`); i--; }
    else { outB.unshift(`<span class="diff-added">${escapeHTML(b[j-1])}</span>`); j--; }
  }
  while(i>0){ outA.unshift(`<span class="diff-removed">${escapeHTML(a[i-1])}</span>`); i--; }
  while(j>0){ outB.unshift(`<span class="diff-added">${escapeHTML(b[j-1])}</span>`); j--; }
  // Merge preferring new
  const merged:string[]=[];
  let ia=0, ib=0;
  while(ia<outA.length || ib<outB.length){
    const ta = outA[ia] ?? '';
    const tb = outB[ib] ?? '';
    if (ta && tb && stripTags(ta)===stripTags(tb)){ merged.push(stripTags(tb)); ia++; ib++; }
    else if (tb){ merged.push(tb); ib++; }
    else { merged.push(ta); ia++; }
  }
  return merged.join('');
}
function escapeHTML(s:string){ return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m] as string)); }
function stripTags(s:string){ return s.replace(/<\/?[^>]+(>|$)/g, ''); }

/* ─────────── Page ─────────── */
export default function VoiceAgentSection() {
  /* Snap to global sidebar width so the rail aligns */
  useEffect(() => {
    const candidates = [
      '[data-app-sidebar]','aside[aria-label="Sidebar"]','aside[class*="sidebar"]','#sidebar'
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

  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [overlayPhase, setOverlayPhase] = useState<'idle'|'loading'>('idle');

  // diff/typing bar above prompt
  const [diffBarHTML, setDiffBarHTML] = useState<string>('');
  const [typingBarHTML, setTypingBarHTML] = useState<string>(''); // progressively typed (with caret)
  const [typingActive, setTypingActive] = useState(false);
  const [pendingPrompt, setPendingPrompt] = useState<string>('');   // accepted preview (outside modal)

  // voices from Web Speech API
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);

  // propagate assistant name -> AssistantRail list
  useEffect(() => {
    if (!activeId) return;
    try {
      const raw = localStorage.getItem('agents');
      const list = raw ? JSON.parse(raw) : [];
      const idx = Array.isArray(list) ? list.findIndex((a:any)=>a?.id===activeId) : -1;
      if (idx >= 0 && list[idx]?.name !== data.name) {
        list[idx] = { ...list[idx], name: data.name };
        localStorage.setItem('agents', JSON.stringify(list));
        window.dispatchEvent(new CustomEvent('assistant:rename', { detail: { id: activeId, name: data.name }}));
      }
    } catch {}
  }, [data.name, activeId]);

  // listen for active selection from rail
  useEffect(() => {
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener('assistant:active', handler as EventListener);
    return () => window.removeEventListener('assistant:active', handler as EventListener);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try { localStorage.setItem(ACTIVE_KEY, activeId); } catch {}
    setPendingPrompt('');
    setDiffBarHTML('');
    setTypingBarHTML('');
  }, [activeId]);

  useEffect(() => { if (activeId) saveAgentData(activeId, pendingPrompt ? { ...data, systemPrompt: pendingPrompt } : data); }, [activeId, data, pendingPrompt]);

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
    try { await apiSave(activeId, pendingPrompt ? { ...data, systemPrompt: pendingPrompt } : data); setToast('Saved'); }
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

  /* ── Generate: overlay -> 1s -> close -> type & diff above prompt ── */
  function startGenerate() {
    setOverlayPhase('loading');
    setTimeout(() => {
      const newPrompt = buildAIStylePrompt(data.systemPrompt, composerText);
      const html = diffHTML(data.systemPrompt, newPrompt);
      // close overlay
      setShowGenerate(false);
      setOverlayPhase('idle');

      // start typing animation of the ENTIRE new prompt into the diff bar
      setTypingActive(true);
      const tokens = newPrompt.split('');
      let i = 0;
      const step = () => {
        i++;
        setTypingBarHTML(escapeHTML(tokens.slice(0, i).join('')) + `<span class="typing-caret"></span>`);
        if (i < tokens.length) {
          window.requestAnimationFrame(step);
        } else {
          // finished typing—show highlighted diff
          setTypingActive(false);
          setTypingBarHTML('');
          setDiffBarHTML(html);
        }
      };
      step();
    }, 1000);
  }
  const acceptDiff = () => { setData(p => ({ ...p, systemPrompt: stripTags(diffBarHTML || typingBarHTML) })); setPendingPrompt(''); setDiffBarHTML(''); setTypingBarHTML(''); };
  const declineDiff = () => { setPendingPrompt(''); setDiffBarHTML(''); setTypingBarHTML(''); };

  /* voice preview helpers (inside dropdown footer) */
  function speakPreview(line?: string){
    const u = new SpeechSynthesisUtterance(line || `This is a preview for ${data.voiceName || 'the selected voice'}.`);
    const byName = voices.find(v => v.name === data.voiceName) || voices.find(v => v.lang?.startsWith('en'));
    if (byName) u.voice = byName;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  const stopPreview = () => window.speechSynthesis.cancel();

  /* voice options from real voices */
  const voiceOpts: Opt[] = useMemo(()=>{
    const v = voices.map(v => ({ value: v.name, label: `${v.name}${v.lang ? ` — ${v.lang}`:''}` }));
    return v.length ? v : [{ value:'', label:'(No system voices found)', disabled:true }];
  }, [voices]);

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* rail (260px) + centered content */}
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Rail */}
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(89,217,179,.20)' }}>
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

            {/* Apply/Discard + Diff/Typing bar placed ABOVE the textarea */}
            {(typingActive || diffBarHTML) && (
              <div className="mt-[var(--s-4)]">
                <div className="flex items-center gap-2 mb-2">
                  <button
                    onClick={acceptDiff}
                    className="h-9 px-3 rounded-[10px] font-semibold"
                    disabled={typingActive}
                    style={{ background:CTA, color:'#0a0f0d' }}
                  >
                    Accept Changes
                  </button>
                  <button
                    onClick={declineDiff}
                    className="h-9 px-3 rounded-[10px]"
                    disabled={typingActive}
                    style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  >
                    Decline
                  </button>
                </div>
                <div
                  className="rounded-[10px] p-3 text-sm leading-6"
                  style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  dangerouslySetInnerHTML={{ __html: typingActive ? typingBarHTML : diffBarHTML }}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-[var(--s-2)]">
                  <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                      style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                      onClick={()=>{ setComposerText(''); setShowGenerate(true); setOverlayPhase('idle'); }}
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
                  onChange={(val)=> setField('voiceName')(val)}
                  options={voiceOpts}
                  placeholder="— Choose —"
                  menuFooter={(
                    <div className="flex items-center justify-between">
                      <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                        Preview {data.voiceName ? `"${data.voiceName}"` : ''}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={()=>speakPreview()}
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
                  )}
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

      {/* Generate overlay — matches AssistantRail; only collects extras */}
      {showGenerate && (
        <RailModalShell>
          <RailModalHeader title="Compose Prompt" icon={<Wand2 className="w-5 h-5" />} />
          <div className="px-6 py-5 grid gap-3">
            <label className="text-xs" style={{ color:'var(--text-muted)' }}>
              Add instructions in plain language (we’ll translate to AI-friendly format):
            </label>
            <textarea
              value={composerText}
              onChange={(e)=>setComposerText(e.target.value)}
              className="w-full rounded-[10px] px-3 py-2 outline-none"
              style={{ minHeight: 140, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
              placeholder="e.g., Friendly tone, crisp answers. Confirm account ID before actions."
              autoFocus
            />
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={()=>{ setShowGenerate(false); }}
              disabled={overlayPhase==='loading'}
              className="w-full h-[44px] rounded-[10px]"
              style={{ background:'var(--panel)', border:'1px solid rgba(255,255,255,.9)', color:'var(--text)' }}
            >
              Cancel
            </button>
            <button
              onClick={startGenerate}
              disabled={overlayPhase==='loading'}
              className="w-full h-[44px] rounded-[10px] font-semibold inline-flex items-center justify-center gap-2"
              style={{ background:CTA, color:'#fff' }}
            >
              {overlayPhase==='loading' ? (<><Loader2 className="w-4 h-4 animate-spin" /> Generating</>) : 'Generate'}
            </button>
          </div>
        </RailModalShell>
      )}

      {/* Call drawer */}
      {createPortal(
        <>
          <div
            className={`va-blur-layer ${showCall ? 'open' : ''}`}
            onClick={()=> setShowCall(false)}
          />
          <aside className={`va-call-drawer ${showCall ? 'open' : ''}`} aria-hidden={!showCall}>
            <div className="flex items-center justify-between px-4 h-[64px]"
                 style={{ background:'var(--panel-bg)', borderBottom:'1px solid rgba(89,217,179,.20)' }}>
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

            <div className="p-3" style={{ borderTop:'1px solid rgba(89,217,179,.20)' }}>
              <form onSubmit={(e)=>{ e.preventDefault(); const txt = chatInput.trim(); if (!txt) return; setMessages(m => [...m, { role:'user', text: txt }]); setChatInput(''); setTimeout(()=> setMessages(m => [...m, { role:'assistant', text:`${data.name || 'Assistant'}: “${txt}” received. How can I help further?` }]), 350); }} className="flex items-center gap-2">
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
