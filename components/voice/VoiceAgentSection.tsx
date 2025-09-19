// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';

/* ─────────── Tokens to match AssistantRail (dark + light) ─────────── */
const Tokens = () => (
  <style jsx global>{`
    /* Dark (default) */
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
      --input-bg:var(--panel);
      --input-border:rgba(255,255,255,.10);
      --input-shadow:0 0 0 1px rgba(255,255,255,.06) inset;
      --border-weak:rgba(255,255,255,.10);
    }
    /* Light (match rail) */
    :root:not([data-theme="dark"]) .va-scope{
      --bg:#f8fafc; --panel:#ffffff; --text:#0f172a; --text-muted:#64748b;
      --page-bg:var(--bg);
      --input-bg:#ffffff;
      --input-border:rgba(15,23,42,.10);
      --input-shadow:0 0 0 1px rgba(15,23,42,.06) inset;
      --border-weak:rgba(15,23,42,.10);
    }

    .va-card{
      border-radius:var(--radius-outer);
      border:1px solid var(--border-weak);
      background:var(--panel);
      box-shadow:0 22px 44px rgba(0,0,0,.28), 0 0 0 1px ${GREEN_LINE};
      overflow:visible; /* dropdowns can escape */
      isolation:isolate;
    }
    .va-head{
      min-height:var(--header-h);
      display:grid; grid-template-columns:1fr auto; align-items:center;
      padding:0 16px;
      background:linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%);
      border-bottom:1px solid ${GREEN_LINE};
      color:var(--text);
    }

    /* match rail overlay style */
    .va-veil{ position:fixed; inset:0; z-index:100000; background:rgba(6,8,10,.62); backdrop-filter:blur(6px); opacity:0; pointer-events:none; transition:opacity .18s ease; }
    .va-veil.open{ opacity:1; pointer-events:auto; }
    .va-sheet{ background:var(--panel); color:var(--text); border:1px solid ${GREEN_LINE}; border-radius:10px; max-height:86vh; overflow:hidden; box-shadow:0 28px 80px rgba(0,0,0,.70); }

    .va-left-fixed{ position:fixed; top:0; bottom:0; left:var(--app-sidebar-w); width:var(--rail-w); z-index:12;
      background:var(--panel); border-right:1px solid ${GREEN_LINE}; box-shadow:14px 0 28px rgba(0,0,0,.08); display:flex; flex-direction:column; }
    .va-page{ margin-left: calc(var(--app-sidebar-w) + var(--rail-w)); transition: margin-left 180ms var(--ease); }

    /* Diff highlights */
    .va-add{ background:rgba(89,217,179,.22); border-radius:4px; padding:0 2px; }
    .va-del{ background:rgba(239,68,68,.22); border-radius:4px; padding:0 2px; text-decoration:line-through; }

    /* typing container */
    .prompt-view{
      white-space:pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size:13px; line-height:1.5; background:var(--panel); color:var(--text);
      border:1px solid ${GREEN_LINE}; border-radius:12px; padding:12px; min-height:360px;
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
  voiceName: string;          // chosen voice label
  voiceCode?: string;         // speechSynthesis voice name/code
  apiKeyId?: string;

  asrProvider: 'deepgram' | 'whisper' | 'assemblyai';
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
};

const BASE_PROMPT = `[Identity]  
You are a flexible and adaptable AI assistant capable of handling various tasks efficiently based on user input. Your core function is to interact with users in a coherent, context-aware manner.

[Style]  
- Maintain a neutral and professional tone.
- Be concise, clear, and adaptive to different conversation contexts.

[Response Guidelines]  
- Ensure responses are relevant to the context.
- Limit responses to a few sentences where possible to maintain clarity.
- Use simple language to facilitate understanding.

[Task & Goals]  
1. Begin by acknowledging the user's presence and readiness to engage.
2. Understand the user's requirements or tasks they want to accomplish.
3. Provide appropriate and informative responses or perform actions as requested.
4. Continuously adapt based on the flow of conversation and user inputs.

[Error Handling / Fallback]  
- If input is unclear, ask direct clarifying questions to ensure proper understanding.
- Offer alternative options or assistance if unable to fulfill the request due to system limitations.
- Handle unexpected errors gracefully, apologizing and proposing a different approach if necessary.`;

const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt: BASE_PROMPT,
  ttsProvider: 'openai',
  voiceName: 'Alloy (American)',
  voiceCode: '',
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

/* Model/provider opts */
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

/* TTS / ASR opts */
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

/* Fallback voice list (if speechSynthesis not ready) */
const fallbackVoices: Opt[] = [
  { value: 'Alloy (American)|en-US', label: 'Alloy (American)' },
  { value: 'Verse (American)|en-US', label: 'Verse (American)' },
  { value: 'Coral (British)|en-GB',  label: 'Coral (British)' },
  { value: 'Amber (Australian)|en-AU', label: 'Amber (Australian)' },
];

/* ─────────── helpers ─────────── */

/** Merge base + extras into a single prompt (extras appended as bullet rules). */
function buildPrompt(base: string, extraRaw: string) {
  const extra = (extraRaw || '').trim();
  if (!extra) return base;
  const lines = extra.split(/\n+/).map(s => s.trim()).filter(Boolean).map(s => /[.!?]$/.test(s) ? s : `${s}.`);
  const block = `

[Additional Instructions]
${lines.map(l => `- ${l}`).join('\n')}

[Behavior]
- Always respect the Additional Instructions above.
- Keep replies concise and useful.
- Ask for missing info before acting.`;
  return `${base}${block}`;
}

/** Very simple line-level diff: returns arrays of kept, added, removed lines. */
function diffLines(oldText: string, newText: string) {
  const o = oldText.split('\n');
  const n = newText.split('\n');
  const oSet = new Set(o);
  const nSet = new Set(n);
  const kept: string[] = [];
  const added: string[] = [];
  const removed: string[] = [];
  // Keep lines that exist in both (order preserved by new)
  n.forEach(l => { if (oSet.has(l)) kept.push(l); else added.push(l); });
  // Removed lines are those in old not in new
  o.forEach(l => { if (!nSet.has(l)) removed.push(l); });
  return { kept, added, removed, newOrdered: n };
}

/* ─────────── dropdown with portal + hover glow like rail ─────────── */
type SelectProps = {
  value: string;
  onChange: (v:string)=>void;
  options: Opt[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
  /** Optional per-option preview (e.g., voices) */
  onPreview?: (value: string) => void;
  isPreviewing?: string | null;
};
function StyledSelect({ value, onChange, options, placeholder, leftIcon, onPreview, isPreviewing }: SelectProps) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef  = useRef<HTMLButtonElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuRect, setMenuRect] = useState<DOMRect|null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  useEffect(() => {
    const recalc = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuRect(new DOMRect(r.left, r.bottom + 8, r.width, 0));
    };
    recalc();
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const off = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return; // click inside trigger/portal mount? still close via portal hit test below
      setOpen(false);
    };
    const scrollRecalc = () => recalc();
    window.addEventListener('keydown', onEsc);
    window.addEventListener('mousedown', off);
    window.addEventListener('scroll', scrollRecalc, true);
    window.addEventListener('resize', recalc);
    return () => {
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('mousedown', off);
      window.removeEventListener('scroll', scrollRecalc, true);
      window.removeEventListener('resize', recalc);
    };
  }, [open]);

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

      {open && menuRect && typeof document !== 'undefined' && createPortal(
        <div
          style={{
            position:'fixed',
            top: menuRect.top,
            left: menuRect.left,
            width: btnRef.current?.getBoundingClientRect().width || 'auto',
            zIndex: 100002,
          }}
        >
          <div
            className="rounded-[10px] p-3"
            style={{
              background:'var(--panel)',
              color:'var(--text)',
              border:`1px solid ${GREEN_LINE}`,
              boxShadow:'0 36px 90px rgba(0,0,0,.55)'
            }}
            onMouseDown={(e)=>e.stopPropagation()}
          >
            {/* search */}
            <div
              className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[10px]"
              style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
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

            {/* options */}
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(o => (
                <div key={o.value} className="relative">
                  {/* top green glow strip (like rail rows) */}
                  <span
                    aria-hidden
                    style={{
                      position:'absolute', left:8, right:8, top:-6, height:16, borderRadius:12,
                      background:'radial-gradient(60% 80% at 50% 100%, rgba(89,217,179,.45) 0%, rgba(89,217,179,0) 100%)',
                      opacity:0, filter:'blur(6px)', transition:'opacity .18s ease', pointerEvents:'none'
                    }}
                  />
                  <button
                    disabled={o.disabled}
                    onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                    className="w-full text-left text-sm px-3 py-2 rounded-[8px] transition flex items-center gap-2 disabled:opacity-60"
                    style={{
                      color:'var(--text)',
                      background:'var(--panel)',
                      border:'1px solid var(--panel)'
                    }}
                    onMouseEnter={(e)=>{ if (o.disabled) return;
                      const el=e.currentTarget as HTMLButtonElement;
                      (el.previousElementSibling as HTMLElement).style.opacity='0.75';
                      el.style.background = 'color-mix(in oklab, var(--panel) 88%, white 12%)';
                      el.style.border = `1px solid ${GREEN_LINE}`;
                    }}
                    onMouseLeave={(e)=>{
                      const el=e.currentTarget as HTMLButtonElement;
                      (el.previousElementSibling as HTMLElement).style.opacity='0';
                      el.style.background = 'var(--panel)';
                      el.style.border = '1px solid var(--panel)';
                    }}
                  >
                    {o.disabled ? <Lock className="w-3.5 h-3.5" /> :
                      <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                    <span className="flex-1 truncate">{o.label}</span>

                    {/* inline preview button inside the dropdown */}
                    {onPreview && !o.disabled ? (
                      (isPreviewing === o.value) ? (
                        <button
                          type="button"
                          onClick={(e)=>{ e.stopPropagation(); onPreview(o.value); }}
                          className="w-7 h-7 rounded-full grid place-items-center"
                          aria-label="Stop preview"
                          style={{ background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}` }}
                        >
                          <Square className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e)=>{ e.stopPropagation(); onPreview(o.value); }}
                          className="w-7 h-7 rounded-full grid place-items-center"
                          aria-label="Play preview"
                          style={{ background:CTA, color:'#0a0f0d' }}
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )
                    ) : null}
                  </button>
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

/* ─────────── Section (expand/collapse) ─────────── */
function Section({
  title, icon, desc, children, defaultOpen = true
}:{
  title: string; icon: React.ReactNode; desc?: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const innerRef = useRef<HTMLDivElement|null>(null);
  const [h, setH] = useState<number>(0);
  const measure = () => { if (innerRef.current) setH(innerRef.current.offsetHeight); };
  useEffect(() => { measure(); }, [children, open]);

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

/* ─────────── Modal shell (rail style) ─────────── */
function ModalShell({ children }:{ children:React.ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div className="va-veil open" />
      <div className="fixed inset-0 z-[100001] flex items-center justify-center px-4">
        <div className="va-sheet w-full max-w-[780px]">{children}</div>
      </div>
    </>,
    document.body
  );
}

/* ─────────── Page ─────────── */
export default function VoiceAgentSection() {
  /* Sidebar measurement for rail alignment */
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

  /* Voices (use real browser voices; fallback until they load) */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<Opt[]>(fallbackVoices);
  const [previewing, setPreviewing] = useState<string|null>(null);

  useEffect(() => {
    const load = () => {
      const v = window.speechSynthesis.getVoices();
      setVoices(v);
      if (v && v.length) {
        const opts: Opt[] = v
          .filter(voice => voice.lang?.startsWith('en')) // simple filter; adjust if needed
          .map(voice => ({
            value: `${voice.name}|${voice.lang}`,
            label: voice.name
          }));
        // de-dup labels (some browsers duplicate)
        const seen = new Set<string>();
        const dedup = opts.filter(o => (seen.has(o.label) ? false : (seen.add(o.label), true)));
        setVoiceOptions(dedup.length ? dedup : fallbackVoices);
      }
    };
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);

  /* rail selection sync */
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

  /* scoped storage (api keys) */
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

  /* Generate overlay — type + diff replay in main prompt box */
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'typing'>('idle');
  const [pendingPrompt, setPendingPrompt] = useState<string>(''); // holds merged text (not yet accepted)
  const [diffRender, setDiffRender] = useState<string[]>([]);     // progressive render lines
  const [diffDone, setDiffDone] = useState(false);                // finished typing

  function startGenerate() {
    const merged = buildPrompt(data.systemPrompt, composerText);
    setPendingPrompt(merged);
    // compute diff
    const { newOrdered, kept, added, removed } = diffLines(data.systemPrompt, merged);
    // build decorated lines (green added, red removed, kept plain)
    const removedSet = new Set(removed);
    const keptSet = new Set(kept);
    const addedSet = new Set(added);
    const decoratedNew: string[] = newOrdered.map(l => {
      if (addedSet.has(l)) return `<span class="va-add">${escapeHtml(l)}</span>`;
      if (keptSet.has(l))  return escapeHtml(l);
      return escapeHtml(l);
    });
    // Append removed lines at the end in red with strike (so you see they’re removed)
    const removedDecorated = removed.map(l => `<span class="va-del">${escapeHtml(l)}</span>`);

    // start typing animation in main box
    setDiffRender([]);
    setDiffDone(false);
    setShowGenerate(false);
    setGenPhase('typing');

    const full = [...decoratedNew, ...removedDecorated];
    let i = 0;
    const step = () => {
      setDiffRender(prev => [...prev, full[i]]);
      i += 1;
      if (i < full.length) {
        window.setTimeout(step, 12); // speed
      } else {
        setGenPhase('idle');
        setDiffDone(true);
      }
    };
    window.setTimeout(step, 100);
  }

  const acceptDiff = () => {
    if (pendingPrompt) setData(p => ({ ...p, systemPrompt: pendingPrompt }));
    setPendingPrompt('');
    setDiffRender([]);
    setDiffDone(false);
  };
  const declineDiff = () => {
    setPendingPrompt('');
    setDiffRender([]);
    setDiffDone(false);
  };

  /* prompt editor/renderer helpers */
  const showingDiff = !!pendingPrompt || diffRender.length>0;

  /* Voice preview inside dropdown */
  function handleVoiceChange(v: string) {
    // v format: `${name}|${lang}`
    const [label, code] = v.split('|');
    setData(prev => ({ ...prev, voiceName: label || v, voiceCode: label || v }));
  }
  function previewVoice(value: string) {
    // toggle behavior
    if (previewing === value) { window.speechSynthesis.cancel(); setPreviewing(null); return; }
    setPreviewing(value);
    const [label] = value.split('|');
    const target = voices.find(vc => vc.name === label) || voices.find(vc => vc.lang?.startsWith('en'));
    const u = new SpeechSynthesisUtterance(`This is ${label}.`);
    if (target) u.voice = target;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    u.onend = () => setPreviewing(prev => prev === value ? null : prev);
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* rail (260px) + content */}
      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        {/* Rail */}
        <div className="sticky top-0 h-screen" style={{ borderRight:`1px solid ${GREEN_LINE}` }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* Content column */}
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]" style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>
          <div className="mb-[var(--s-4)] flex flex-wrap items-center justify-end gap-[var(--s-3)]">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            {/* Removed the "Talk to Assistant" button per your request */}
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                 style={{ background:'rgba(89,217,179,.10)', color:'var(--text)', boxShadow:`0 0 0 1px ${GREEN_LINE} inset` }}>
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
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
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
                    {showingDiff && (
                      <>
                        <button
                          onClick={acceptDiff}
                          disabled={!diffDone && !!pendingPrompt}
                          className="h-9 px-3 rounded-[10px] font-semibold"
                          style={{ background:CTA, color:'#0a0f0d', border:`1px solid ${GREEN_LINE}` }}
                        >
                          Accept changes
                        </button>
                        <button
                          onClick={declineDiff}
                          className="h-9 px-3 rounded-[10px]"
                          style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                        >
                          Decline
                        </button>
                      </>
                    )}
                    <button
                      className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                      style={{ height:36, padding:'0 12px', background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'#fff' }}
                      onClick={()=>{ setComposerText(''); setShowGenerate(true); }}
                    >
                      <Wand2 className="w-4 h-4" style={{ color:'#fff' }} /> Generate
                    </button>
                  </div>
                </div>

                {/* Prompt editor or diff view with typing */}
                {!showingDiff ? (
                  <textarea
                    className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                    style={{ minHeight: 360, background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                    value={data.systemPrompt}
                    onChange={(e)=>setField('systemPrompt')(e.target.value)}
                  />
                ) : (
                  <div className="prompt-view">
                    {diffRender.length ? (
                      <div dangerouslySetInnerHTML={{ __html: diffRender.join('\n') }} />
                    ) : (
                      <div dangerouslySetInnerHTML={{ __html: escapeHtml(data.systemPrompt).replace(/\n/g,'<br/>') }} />
                    )}
                  </div>
                )}
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
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice Provider</div>
                <StyledSelect value={data.ttsProvider} onChange={(v)=>setField('ttsProvider')(v as AgentData['ttsProvider'])} options={ttsProviders}/>
              </div>
            </div>

            <div className="grid grid-cols-1 mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={`${data.voiceName}|${data.voiceCode || 'en-US'}`}
                  onChange={handleVoiceChange}
                  options={voiceOptions}
                  placeholder="— Choose —"
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
              <ToggleRow label="Background Denoising Enabled" checked={data.denoise} onChange={setField('denoise')} />
              <ToggleRow label="Use Numerals" checked={data.numerals} onChange={setField('numerals')} />
            </div>
          </Section>
        </div>
      </div>

      {/* Generate overlay (rail style) */}
      {showGenerate && (
        <ModalShell>
          <div className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-lg font-semibold" style={{ color:'var(--text)' }}>Compose Prompt</div>
              <button onClick={()=>{ if (genPhase==='idle') setShowGenerate(false); }} className="p-1 rounded hover:opacity-80" aria-label="Close">
                <X className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
              </button>
            </div>
            <div className="grid gap-3">
              <label className="text-xs" style={{ color:'var(--text-muted)' }}>
                Add extra instructions (persona, tone, rules, tools):
              </label>
              <textarea
                value={composerText}
                onChange={(e)=>setComposerText(e.target.value)}
                className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
                placeholder="e.g., Friendly, crisp answers. Confirm account ID before actions."
                style={{ minHeight: 140, background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={()=>setShowGenerate(false)}
                  disabled={genPhase==='typing'}
                  className="h-9 px-3 rounded-[10px]"
                  style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={startGenerate}
                  disabled={genPhase==='typing'}
                  className="h-9 px-4 rounded-[10px] font-semibold"
                  style={{ background:CTA, color:'#fff', border:`1px solid ${GREEN_LINE}` }}
                >
                  Generate
                </button>
              </div>
              <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                After Generate, the main prompt box will replay with green (added) and red (removed) highlights until you Accept or Decline.
              </div>
            </div>
          </div>
        </ModalShell>
      )}
    </section>
  );
}

/* small atoms */
const ToggleRow = ({label, checked, onChange}:{label:string; checked:boolean; onChange:(v:boolean)=>void}) => (
  <div className="flex items-center justify-between p-3 rounded-[10px]" style={{ background:'var(--input-bg)', border:`1px solid ${GREEN_LINE}` }}>
    <span className="text-sm">{label}</span>
    <Toggle checked={checked} onChange={onChange} />
  </div>
);

const Toggle = ({checked,onChange}:{checked:boolean; onChange:(v:boolean)=>void}) => (
  <button
    onClick={()=>onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height:28, width:50, padding:'0 6px', borderRadius:999, justifyContent:'flex-start',
      background: checked ? 'color-mix(in oklab, #59d9b3 18%, var(--input-bg))' : 'var(--input-bg)',
      border:`1px solid ${GREEN_LINE}`
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

/* utils */
function escapeHtml(s:string){
  return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
}
