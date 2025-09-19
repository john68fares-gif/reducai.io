'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search,
  Check, Lock, X, KeyRound, Play, Square
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* Assistant rail (unchanged) */
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

/* ─────────── tokens + light/dark themes ─────────── */
const Tokens = () => (
  <style jsx global>{`
    /* Default = dark */
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
    }
    /* Light mode – match AssistantRail look */
    :root:not([data-theme="dark"]) .va-scope{
      --bg:#f8fafc; --panel:#ffffff; --text:#0f172a; --text-muted:#64748b;

      --page-bg:var(--bg);
      --panel-bg:#ffffff;
      --input-bg:#ffffff;
      --input-border:rgba(15,23,42,.10);
      --input-shadow:0 0 0 1px rgba(15,23,42,.06) inset;

      --border-weak:rgba(15,23,42,.10);
      --card-shadow:0 22px 44px rgba(2,6,23,.08),
                    0 0 0 1px rgba(15,23,42,.06) inset,
                    0 0 0 1px ${GREEN_LINE};
    }

    .va-card{
      border-radius:var(--radius-outer);
      border:1px solid var(--border-weak);
      background:var(--panel-bg);
      box-shadow:var(--card-shadow);
      /* IMPORTANT: allow dropdowns to escape the card */
      overflow:visible; isolation:isolate;
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
    :root:not([data-theme="dark"]) .va-head{
      border-bottom:1px solid rgba(15,23,42,.08);
    }

    .va-left-fixed{
      position:fixed; top:0; bottom:0;
      left:var(--app-sidebar-w);
      width:var(--rail-w);
      z-index:12;
      background:var(--panel-bg);
      border-right:1px solid rgba(255,255,255,.06);
      box-shadow:14px 0 28px rgba(0,0,0,.08);
      display:flex; flex-direction:column;
    }
    :root:not([data-theme="dark"]) .va-left-fixed{
      border-right:1px solid rgba(15,23,42,.08);
    }

    .va-page{
      margin-left: calc(var(--app-sidebar-w) + var(--rail-w));
      transition: margin-left 180ms var(--ease);
    }

    /* Overlays: same as AssistantRail (blur veil, thin green border on sheet) */
    .va-overlay{
      position:fixed; inset:0; z-index:100000; /* match rail */
      background:rgba(6,8,10,.62); backdrop-filter:blur(6px);
      opacity:0; pointer-events:none; transition:opacity 180ms var(--ease);
    }
    .va-overlay.open{ opacity:1; pointer-events:auto; }

    .va-modal-wrap{ position:fixed; inset:0; z-index:100001; }
    .va-modal-center{ position:absolute; inset:0; display:grid; place-items:center; padding:20px; }
    .va-sheet{
      background:var(--panel-bg);
      border:1px solid ${GREEN_LINE};
      box-shadow:0 28px 80px rgba(0,0,0,.70);
      border-radius:10px;
    }

    .chat-msg{ max-width:85%; padding:10px 12px; border-radius:12px; }
    .chat-user{ background:var(--panel-bg); border:1px solid rgba(255,255,255,.12); align-self:flex-end; }
    .chat-ai{ background:color-mix(in oklab, var(--panel-bg) 92%, black 8%); border:1px solid rgba(255,255,255,.12); align-self:flex-start; }

    /* Typing highlights */
    .va-add{ background:rgba(89,217,179,.22); border-radius:4px; padding:0 2px; }
    .va-del{ background:rgba(239,68,68,.22); border-radius:4px; padding:0 2px; text-decoration:line-through; }
  `}</style>
);

/* types */
type ApiKey = { id: string; name: string; key: string };
type VoiceMeta = { id: string; name: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceId?: string;
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
You are a blank template AI assistant with minimal default settings.

[Style]
- Neutral, concise, helpful.

[Guidelines]
- Avoid unnecessary jargon.
- Keep responses focused.

[Fallback]
- Ask for clarification when needed.`,
  ttsProvider: 'openai',
  voiceId: 'alloy',
  voiceName: 'Alloy (American)',
  apiKeyId: '',
  asrProvider: 'deepgram',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
};

/* storage helpers */
const keyFor = (id: string) => `va:agent:${id}`;
const loadAgentData = (id: string): AgentData => {
  try { const raw = localStorage.getItem(keyFor(id)); if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
};

/* backend mocks */
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

/* fetch voices */
async function fetchVoices(): Promise<VoiceMeta[]> {
  const r = await fetch('/api/openai/voices').catch(()=>null);
  if (!r?.ok) return [];
  const list = await r.json().catch(()=>[]);
  return (Array.isArray(list) ? list : []).filter(v => v && v.id && v.name);
}

/* Toggle */
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

/* ─────────── StyledSelect with PORTALED MENU (fixed) ─────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

function StyledSelect({
  value, onChange, options, placeholder, leftIcon,
  onPreview, isPreviewing
}:{
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
  leftIcon?: React.ReactNode;

  onPreview?: (v:string)=>void;     // optional inline preview handler
  isPreviewing?: string|null;       // id that is currently previewing
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuRect, setMenuRect] = useState<{top:number;left:number;width:number} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  // compute viewport position for PORTALED fixed menu
  const positionMenu = () => {
    const btn = wrapRef.current?.querySelector('button[data-trigger="true"]') as HTMLButtonElement | null;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    setMenuRect({ top: r.bottom + 8, left: r.left, width: r.width });
  };

  useEffect(() => {
    if (!open) return;
    positionMenu();
    const onScroll = () => positionMenu();
    const onResize = () => positionMenu();
    const onClickAway = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('mousedown', onClickAway);
    window.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousedown', onClickAway);
      window.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        data-trigger="true"
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
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && menuRect && typeof document !== 'undefined' && createPortal(
        <div
          className="p-3"
          style={{
            position:'fixed',
            top: menuRect.top,
            left: menuRect.left,
            width: menuRect.width,
            zIndex: 100002, /* above overlays & cards */
            background:'var(--panel-bg)',
            border:'1px solid var(--input-border)',
            borderRadius:10,
            boxShadow:'0 36px 90px rgba(0,0,0,.55)'
          }}
        >
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
                {/* top green glow on hover / selected */}
                <span
                  className="pointer-events-none"
                  style={{
                    position:'absolute', left:8, right:8, top:-6, height:16, borderRadius:12,
                    background:'radial-gradient(60% 80% at 50% 100%, rgba(89,217,179,.45) 0%, rgba(89,217,179,0) 100%)',
                    opacity:0, filter:'blur(6px)', transition:'opacity .18s ease'
                  }}
                />
                <button
                  disabled={o.disabled}
                  onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                  className="w-full text-left text-sm px-3 py-2 rounded-[8px] transition flex items-center gap-2 disabled:opacity-60"
                  style={{
                    color:'var(--text)',
                    background:'var(--panel-bg)',
                    border:'1px solid var(--panel-bg)',
                    cursor:o.disabled?'not-allowed':'pointer'
                  }}
                  onMouseEnter={(e)=>{ if (o.disabled) return;
                    const el=e.currentTarget as HTMLButtonElement;
                    el.previousElementSibling && ((el.previousElementSibling as HTMLElement).style.opacity='0.75');
                    el.style.background = 'color-mix(in oklab, var(--panel-bg) 88%, white 12%)';
                    el.style.border = `1px solid ${GREEN_LINE}`;
                  }}
                  onMouseLeave={(e)=>{
                    const el=e.currentTarget as HTMLButtonElement;
                    el.previousElementSibling && ((el.previousElementSibling as HTMLElement).style.opacity='0');
                    el.style.background = 'var(--panel-bg)';
                    el.style.border = '1px solid var(--panel-bg)';
                  }}
                >
                  {o.disabled ? <Lock className="w-3.5 h-3.5" /> :
                    <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                  <span className="flex-1 truncate">{o.label}</span>

                  {/* Inline play/stop inside item */}
                  {onPreview && !o.disabled ? (
                    (isPreviewing === o.value) ? (
                      <button
                        type="button"
                        onClick={(e)=>{ e.stopPropagation(); onPreview(o.value); }}
                        className="w-7 h-7 rounded-full grid place-items-center"
                        aria-label="Stop preview"
                        style={{ background: 'var(--panel-bg)', color:'var(--text)', border:'1px solid var(--input-border)' }}
                      >
                        <Square className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={(e)=>{ e.stopPropagation(); onPreview(o.value); }}
                        className="w-7 h-7 rounded-full grid place-items-center"
                        aria-label="Play preview"
                        style={{ background: CTA, color:'#0a0f0d' }}
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
        </div>,
        document.body
      )}
    </div>
  );
}

/* Section */
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

/* Page */
export default function VoiceAgentSection() {
  /* measure sidebar */
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

  /* generate overlay */
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'typing'>('idle');
  const [pendingPrompt, setPendingPrompt] = useState<string>('');
  const [typedHtml, setTypedHtml] = useState<string>(''); // inside prompt box
  const [voicesApi, setVoicesApi] = useState<VoiceMeta[]>([]);
  const voiceOptions = useMemo<Opt[]>(
    () => voicesApi.map(v => ({ value: v.id, label: v.name })),
    [voicesApi]
  );

  /* preview audio */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [previewingVoice, setPreviewingVoice] = useState<string|null>(null);
  const [previewAbort, setPreviewAbort] = useState<AbortController | null>(null);
  const PREVIEW_TEXT = "This is a short voice preview for testing. One, two, three.";

  useEffect(() => { (async () => setVoicesApi(await fetchVoices()))(); }, []);

  /* api keys bootstrap */
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

  function setField<K extends keyof AgentData>(k: K) { return (v: AgentData[K]) => setData(prev => ({ ...prev, [k]: v })); }
  const modelOpts = useMemo(()=>[
    { value: 'GPT-4o',  label: 'GPT-4o' },
    { value: 'GPT-4.1', label: 'GPT-4.1' },
    { value: 'o4-mini', label: 'o4-mini' },
  ],[]);

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

  /* simple word diff -> span with classes */
  function diffWordsToHtml(oldStr: string, newStr: string){
    const o = oldStr.split(/\s+/), n = newStr.split(/\s+/);
    const table:number[][] = Array(o.length+1).fill(0).map(()=>Array(n.length+1).fill(0));
    for (let i=1;i<=o.length;i++) for (let j=1;j<=n.length;j++)
      table[i][j] = o[i-1] === n[j-1] ? table[i-1][j-1]+1 : Math.max(table[i-1][j], table[i][j-1]);
    let i=o.length, j=n.length;
    const out:string[]=[];
    while(i>0 && j>0){
      if (o[i-1] === n[j-1]) { out.unshift(o[i-1]); i--; j--; }
      else if (table[i-1][j] >= table[i][j-1]) { out.unshift(`<span class="va-del">${o[i-1]}</span>`); i--; }
      else { out.unshift(`<span class="va-add">${n[j-1]}</span>`); j--; }
    }
    while(i>0){ out.unshift(`<span class="va-del">${o[i-1]}</span>`); i--; }
    while(j>0){ out.unshift(`<span class="va-add">${n[j-1]}</span>`); j--; }
    return out.join(' ');
  }

  /* typing effect inside prompt textarea area */
  function startGenerate() {
    const base = data.systemPrompt;
    const next = buildPrompt(base, composerText);
    const html = diffWordsToHtml(base, next);

    setPendingPrompt(next);
    setGenPhase('typing');
    setTypedHtml('');

    const total = html.length;
    let idx = 0;
    const tick = () => {
      idx = Math.min(total, idx + 2);
      setTypedHtml(html.slice(0, idx));
      if (idx < total) requestAnimationFrame(tick);
      else setGenPhase('idle');
    };
    requestAnimationFrame(tick);
  }
  const acceptDiff = () => { setData(p => ({ ...p, systemPrompt: pendingPrompt })); setPendingPrompt(''); setTypedHtml(''); setComposerText(''); };
  const declineDiff = () => { setPendingPrompt(''); setTypedHtml(''); };

  /* voice preview */
  async function playVoicePreview(voiceId: string) {
    try {
      if (previewAbort) { previewAbort.abort(); setPreviewAbort(null); }
      if (!audioRef.current) audioRef.current = new Audio();

      setPreviewingVoice(voiceId);

      const ac = new AbortController();
      setPreviewAbort(ac);

      const r = await fetch(`/api/openai/tts/preview?voice=${encodeURIComponent(voiceId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: PREVIEW_TEXT }),
        signal: ac.signal
      });

      if (!r.ok) throw new Error('tts preview failed');

      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      audioRef.current.src = url;
      await audioRef.current.play();
    } catch {
      try { window.speechSynthesis.cancel(); } catch {}
      const u = new SpeechSynthesisUtterance(PREVIEW_TEXT);
      window.speechSynthesis.speak(u);
    }
  }
  function stopVoicePreview() {
    if (previewAbort) { previewAbort.abort(); setPreviewAbort(null); }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.currentTime = 0; }
    try { window.speechSynthesis.cancel(); } catch {}
    setPreviewingVoice(null);
  }

  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      <div className="grid w-full" style={{ gridTemplateColumns: '260px 1fr' }}>
        <div className="sticky top-0 h-screen" style={{ borderRight:'1px solid rgba(255,255,255,.06)' }}>
          <RailBoundary><AssistantRail /></RailBoundary>
        </div>

        {/* Content */}
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
                <StyledSelect
                  value={data.provider}
                  onChange={(v)=>setField('provider')(v as AgentData['provider'])}
                  options={[
                    { value: 'openai',     label: 'OpenAI' },
                    { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true },
                    { value: 'google',     label: 'Google — coming soon', disabled: true },
                  ]}
                />
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
                    {pendingPrompt && (
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
                      style={{ height:36, padding:'0 12px', background:CTA, color:'#fff', border:`1px solid ${GREEN_LINE}` }}
                      onClick={()=>{ setComposerText(''); setShowGenerate(true); setGenPhase('idle'); }}
                    >
                      <Wand2 className="w-4 h-4" /> <span style={{ color:'#fff' }}>Generate</span>
                    </button>
                  </div>
                </div>

                {/* Prompt area: shows typing diff INSIDE box when generating */}
                <div style={{ position:'relative' }}>
                  {typedHtml ? (
                    <div
                      className="w-full rounded-[12px] px-3 py-[12px] text-sm"
                      style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                      dangerouslySetInnerHTML={{ __html: typedHtml }}
                    />
                  ) : (
                    <textarea
                      className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                      style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                      value={pendingPrompt || data.systemPrompt}
                      onChange={(e)=>{
                        if (pendingPrompt) setPendingPrompt(e.target.value);
                        else setField('systemPrompt')(e.target.value);
                      }}
                    />
                  )}
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
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceId || ''}
                  onChange={(val)=>{
                    const meta = voicesApi.find(v => v.id === val);
                    setData(p => ({ ...p, voiceId: val, voiceName: meta?.name || val }));
                  }}
                  options={voiceOptions}
                  placeholder="— Choose —"
                  onPreview={(val)=>{
                    if (previewingVoice === val) { stopVoicePreview(); }
                    else { setPreviewingVoice(val); playVoicePreview(val).finally(()=>setPreviewingVoice(val)); }
                  }}
                  isPreviewing={previewingVoice}
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
                <StyledSelect value={data.asrProvider} onChange={(v)=>setField('asrProvider')(v as AgentData['asrProvider'])} options={[
                  { value: 'deepgram',   label: 'Deepgram' },
                  { value: 'whisper',    label: 'Whisper — coming soon', disabled: true },
                  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true },
                ]}/>
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Model</div>
                <StyledSelect value={data.asrModel} onChange={setField('asrModel')} options={[
                  { value: 'Nova 2', label: 'Nova 2' },
                  { value: 'Nova',   label: 'Nova' },
                ]}/>
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

      {/* Generate Overlay (same style as rail; typing happens inside prompt box already) */}
      {showGenerate && createPortal(
        <>
          <div className="va-overlay open" onClick={()=>{ if (genPhase==='idle') setShowGenerate(false); }} />
          <div className="va-modal-wrap" role="dialog" aria-modal>
            <div className="va-modal-center">
              <div className="va-sheet w-full max-w-[780px] p-4 md:p-6">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-lg font-semibold">Compose Prompt</div>
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
                    style={{ minHeight: 140, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  />

                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={()=>setShowGenerate(false)}
                      disabled={genPhase==='typing'}
                      className="h-9 px-3 rounded-[10px]"
                      style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
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
                    After you click Generate, the prompt box in the main section will replay with highlights.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </section>
  );
}
