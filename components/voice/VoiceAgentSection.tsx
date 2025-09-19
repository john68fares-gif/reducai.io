// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, Pause, X, Loader2
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
const GREEN_GLOW = '0 10px 26px rgba(89,217,179,.28)'; // dropdown hover glow
const ACTIVE_KEY = 'va:activeId';
const Z_OVERLAY = 100000;
const Z_MODAL   = 100001;
const Z_MENU    = 100010;

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

      --green-weak: rgba(89,217,179,.14);
      --red-weak: rgba(239,68,68,.15);
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

    /* Dropdown menu (single surface, no sections) */
    .va-menu{
      position:fixed;
      z-index:${Z_MENU};
      background:var(--panel-bg);
      border:1px solid ${GREEN_LINE};
      box-shadow:0 36px 90px rgba(0,0,0,.55);
      border-radius:10px;
      overflow:hidden;
    }

    /* Caret for typing effect */
    @keyframes va-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
    .va-caret::after{
      content:'';
      display:inline-block; width:8px; height:18px; margin-left:2px;
      background:#fff; opacity:.9; border-radius:1px; animation:va-blink 1s step-end infinite;
      transform:translateY(3px);
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
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt:
`[Identity]
You are an adaptable AI Assistant designed to support various tasks and scenarios.

[Style]
- Maintain a neutral and adaptable tone, adjusting as necessary to fit different contexts.
- Avoid additional embellishments; keep interactions straightforward and clear.

[Response Guidelines]
- Ensure responses are concise and relevant to the task at hand.
- Maintain a balance between informative and concise, ensuring clarity for the user.

[Task & Goals]
1. Welcome the user and gauge the context or task they need assistance with.
2. Gather necessary details or instructions from the user to perform the task.
3. Execute any task-specific actions or queries as required.
4. Confirm successful completion of tasks with the user or provide an update on progress.
5. Follow through with any additional user inquiries or tasks to be addressed.

[Error Handling / Fallback]
- If the user's input is unclear, politely ask clarifying questions to better understand their request.
- If a task cannot be completed, inform the user of the issue and suggest alternative steps if possible.`,
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
    ? [{ value: 'Nova 2', label: 'Nova 2' }, { value: 'Nova', label: 'Nova' }]
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

/* ─────────── Non-sectioned Select with rail-glow ─────────── */
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
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{left:number;width:number;top:number} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  const positionMenu = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setRect({ left:r.left, width:r.width, top:r.bottom + 8 });
  };

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const off = (e: MouseEvent) => { if (wrapRef.current?.contains(e.target as Node)) return; setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => positionMenu();
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
        onClick={() => { setOpen(v=>!v); setTimeout(()=>{ searchRef.current?.focus(); positionMenu(); },0); }}
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

      {open && rect && createPortal(
        <div className="va-menu p-3" style={{ left:rect.left, top:rect.top, width:rect.width }}>
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
               style={{ background:'var(--panel)', border:'1px solid var(--input-border)', color:'var(--text)' }}>
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
                className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                style={{
                  color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                  background:'transparent',
                  border:'none',
                  boxShadow:'none',
                  cursor:o.disabled?'not-allowed':'pointer'
                }}
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.boxShadow = `${GREEN_GLOW}`; el.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.boxShadow = 'none'; el.style.transform = 'translateY(0)'; }}
              >
                {o.disabled ? <Lock className="w-3.5 h-3.5" /> :
                               <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                <span className="truncate">{o.label}</span>
                {onPreview ? (
                  <button
                    type="button"
                    onClick={async (ev)=>{ ev.stopPropagation(); await onPreview(o.value); }}
                    className="w-7 h-7 rounded-full grid place-items-center"
                    style={{ border:'1px solid var(--input-border)', background:'var(--panel)' }}
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

/* ─────────── Diff helpers ─────────── */
/** Simple line-diff. Green = add, Red strike = remove. */
function diffLines(oldTxt:string, newTxt:string){
  const a = oldTxt.split('\n');
  const b = newTxt.split('\n');
  const out: Array<{type:'same'|'add'|'remove', text:string}> = [];
  const setA = new Set(a); const setB = new Set(b);
  // walk by max length; also spray in unique rest
  const max = Math.max(a.length, b.length);
  for (let i=0;i<max;i++){
    const la=a[i], lb=b[i];
    if (la===lb && la!==undefined){ out.push({type:'same',text:la}); continue; }
    if (lb!==undefined && !setA.has(lb)) out.push({type:'add',text:lb});
    if (la!==undefined && !setB.has(la)) out.push({type:'remove',text:la});
  }
  for (let j=a.length;j<b.length;j++) if (!setA.has(b[j]!)) out.push({type:'add',text:b[j]!});
  return out;
}
function DiffBlock({ oldText, newText }:{ oldText:string; newText:string }){
  const rows = diffLines(oldText, newText);
  return (
    <div
      className="rounded-[12px] px-3 py-3"
      style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
    >
      {rows.map((r,i)=>{
        if(r.type==='same') return <div key={i} style={{whiteSpace:'pre-wrap'}}>{r.text||' '}</div>;
        if(r.type==='add') return (
          <div key={i} style={{whiteSpace:'pre-wrap', background:'var(--green-weak)', borderLeft:`3px solid ${CTA}`, borderRadius:6, padding:'2px 6px', margin:'2px 0'}}>
            {r.text||' '}
          </div>
        );
        return (
          <div key={i} style={{whiteSpace:'pre-wrap', background:'var(--red-weak)', borderLeft:'3px solid #ef4444', borderRadius:6, padding:'2px 6px', margin:'2px 0', textDecoration:'line-through'}}>
            {r.text||' '}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────── Page ─────────── */
export default function VoiceAgentSection() {
  /* Pin rail next to host sidebar */
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

  /* Generate overlay & prompt typing/diff */
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [genPhase, setGenPhase] = useState<'editing'|'loading'|'typing'|'review'|'idle'>('idle');

  const basePromptRef = useRef<string>('');
  const [proposedPrompt, setProposedPrompt] = useState('');
  const [typing, setTyping] = useState('');                 // typing buffer for the prompt box
  const [expandPrompt, setExpandPrompt] = useState(false);  // grows during review

  /* Voices (for menu demo preview if you want later) */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load(); (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);

  // rail -> section selection sync
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

  // keys
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
          try { localStorage.setItem(keyFor(activeId), JSON.stringify(next)); } catch {}
          try { window.dispatchEvent(new CustomEvent('assistant:update', { detail: { id: activeId, name: String(v) } })); } catch {}
        }
        return next;
      });
    };
  }

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

  /* ─────────── Prompt generate: transform & merge (no duplicate [Behavior]) ─────────── */
  const detectLanguage = () => data.language || 'English';

  // merges extra into existing prompt; avoids adding a second [Behavior] block
  const mergePrompt = (base:string, extraRaw:string, targetLang:string) => {
    const extras = (extraRaw||'').split('\n').map(s=>s.trim()).filter(Boolean);
    if (!extras.length) return { merged: base, summary: 'No changes.' };
    const bullet = extras.map(s=> /[.!?]$/.test(s)? s : s + '.');
    // Append an [Extra Instructions] only; DO NOT add [Behavior] again
    const merged = `${base}\n\n[Extra Instructions — ${targetLang}]\n${bullet.map(b=>`- ${b}`).join('\n')}`;
    const summary = `Added ${bullet.length} instruction${bullet.length===1?'':'s'}; kept original sections; avoided duplicate [Behavior].`;
    return { merged, summary };
  };

  // typing effect inside the prompt box
  const runTyping = (full:string) => {
    setTyping('');
    setGenPhase('typing');
    setExpandPrompt(true);
    let i = 0;
    const stride = Math.max(1, Math.floor(full.length / 120)); // ~120 frames
    const step = () => {
      i += stride;
      setTyping(full.slice(0, Math.min(i, full.length)));
      if (i < full.length) requestAnimationFrame(step);
      else setTimeout(()=> setGenPhase('review'), 150);
    };
    requestAnimationFrame(step);
  };

  const openGenerate = () => {
    setComposerText('');
    setAutoTranslate(true);
    setShowGenerate(true);
    setGenPhase('editing');
  };
  const startGenerate = () => {
    setGenPhase('loading');
    basePromptRef.current = data.systemPrompt;
    const lang = detectLanguage();
    setTimeout(()=>{ // simulate
      const { merged, summary } = mergePrompt(basePromptRef.current, composerText, autoTranslate ? lang : 'Original');
      setProposedPrompt(merged);
      setShowGenerate(false);
      runTyping(merged);
      setToast('Generating preview…');
    }, 380);
  };
  const acceptChanges = () => {
    setData(p => ({ ...p, systemPrompt: proposedPrompt }));
    setTyping('');
    setProposedPrompt('');
    setGenPhase('idle');
    setExpandPrompt(false);
    setToast('Prompt updated');
  };
  const discardChanges = () => {
    setTyping('');
    setProposedPrompt('');
    setGenPhase('idle');
    setExpandPrompt(false);
    setToast('Changes discarded');
  };

  /* ─────────── UI ─────────── */
  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

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
              onClick={()=>{}}
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

          {/* Quick stats */}
          <div className="grid gap-[12px] md:grid-cols-2 mb-[12px]">
            <div className="va-card"><div className="va-head" style={{ minHeight:56 }}><div className="text-xs" style={{color:'var(--text-muted)'}}>Cost</div><div/></div><div className="p-[var(--s-4)]"><div className="font-semibold" style={{fontSize:'var(--fz-sub)'}}>~$0.1/min</div></div></div>
            <div className="va-card"><div className="va-head" style={{ minHeight:56 }}><div className="text-xs" style={{color:'var(--text-muted)'}}>Latency</div><div/></div><div className="p-[var(--s-4)]"><div className="font-semibold" style={{fontSize:'var(--fz-sub)'}}>~1050 ms</div></div></div>
          </div>

          {/* Model section */}
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
                  placeholder="e.g., Elliot"
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

            {/* System Prompt block */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-[var(--s-2)]">
                  <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                  <div className="flex items-center gap-2">
                    {(genPhase==='typing' || genPhase==='review') && (
                      <>
                        <button
                          onClick={discardChanges}
                          className="h-9 px-3 rounded-[10px]"
                          style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                        >
                          Discard Changes
                        </button>
                        <button
                          onClick={acceptChanges}
                          className="h-9 px-3 rounded-[10px] font-semibold"
                          style={{ background:CTA, color:'#0a0f0d' }}
                        >
                          Accept Changes
                        </button>
                      </>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                      style={{ height:36, padding:'0 12px', background:CTA, color:'#fff', border:'1px solid transparent' }}
                      onClick={openGenerate}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                {/* Prompt area: textarea OR typing OR diff */}
                <div
                  className="rounded-[12px] px-3 py-[12px] transition-all"
                  style={{
                    background:'var(--input-bg)',
                    border:'1px solid var(--input-border)',
                    color:'var(--text)',
                    minHeight: expandPrompt ? 560 : 360
                  }}
                >
                  {genPhase==='typing' ? (
                    <pre className="whitespace-pre-wrap m-0 text-sm va-caret" style={{ color:'#fff' }}>{typing || ' '}</pre>
                  ) : genPhase==='review' ? (
                    <DiffBlock oldText={basePromptRef.current} newText={proposedPrompt} />
                  ) : (
                    <textarea
                      className="w-full bg-transparent outline-none text-sm"
                      style={{ minHeight: 360, color:'var(--text)' }}
                      value={data.systemPrompt}
                      onChange={(e)=> setField('systemPrompt')(e.target.value)}
                    />
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
                    ...apiKeys.map(k=>({ value: k.id, label: `${k.name} ••••${(k
