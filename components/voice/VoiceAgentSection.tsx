// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import AssistantRail from '@/components/voice/AssistantRail';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock, X, KeyRound,
  Play, Square
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

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

/* ─────────── SOLID theme (no transparency anywhere) ─────────── */
const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --bg:#0b0c10; --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;

      --s-2:8px; --s-3:12px; --s-4:16px; --s-5:20px; --s-6:24px;
      --radius-outer:8px;
      --control-h:44px; --header-h:88px;
      --fz-title:18px; --fz-sub:15px; --fz-body:14px; --fz-label:12.5px;
      --lh-body:1.45; --ease:cubic-bezier(.22,.61,.36,1);

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

    /* fixed assistant rail */
    .va-left-fixed{
      position:fixed; inset:0 auto 0 0; width:260px; z-index:12;
      background:var(--panel-bg);
      border-right:1px solid rgba(255,255,255,.06);
      box-shadow:14px 0 28px rgba(0,0,0,.08);
      display:flex; flex-direction:column;
    }
    .va-left-fixed .rail-scroll{ overflow:auto; flex:1; }

    /* dropdown menu base (can be overridden by inline below if needed) */
    .va-menu{
      background:var(--panel-bg);
      border:1px solid rgba(255,255,255,.12);
      box-shadow:0 36px 90px rgba(0,0,0,.55);
      border-radius:10px;
    }

    /* overlays — SOLID scrim + blur + pulse animation on click */
    @keyframes overlayPulse { 0%{transform:scale(1);opacity:.98} 60%{transform:scale(1.02);opacity:1} 100%{transform:scale(1);opacity:.98} }
    .va-blur-overlay{
      position:fixed; inset:0; z-index:9996;
      background:rgba(8,10,12,.88);
      backdrop-filter:blur(3px);
      opacity:0; pointer-events:none; transition:opacity 200ms var(--ease);
    }
    .va-blur-overlay.open{ opacity:1; pointer-events:auto; }
    .va-blur-overlay.pulse{ animation:overlayPulse 320ms var(--ease); }

    .va-call-drawer{
      position:fixed; inset:0 0 0 auto; width:min(540px,92vw); z-index:9997;
      display:grid; grid-template-rows:auto 1fr auto;
      background:var(--panel-bg);
      border-left:1px solid rgba(255,255,255,.10);
      box-shadow:-28px 0 80px rgba(0,0,0,.55);
      transform:translateX(100%); transition:transform 280ms var(--ease);
    }
    .va-call-drawer.open{ transform:translateX(0); }

    /* modal */
    .va-modal-wrap{ position:fixed; inset:0; z-index:9994; }
    .va-modal-blur{ position:absolute; inset:0; background:rgba(8,10,12,.88); backdrop-filter:blur(4px); }
    .va-modal-center{ position:absolute; inset:0; display:grid; place-items:center; padding:20px; }
    .va-sheet{ background:var(--panel-bg); border:1px solid rgba(255,255,255,.12); box-shadow:0 28px 80px rgba(0,0,0,.70); border-radius:12px; }

    /* chat */
    .chat-msg{ max-width:85%; padding:10px 12px; border-radius:12px; }
    .chat-user{ background:var(--panel-bg); border:1px solid rgba(255,255,255,.12); align-self:flex-end; }
    .chat-ai{ background:color-mix(in oklab, var(--panel-bg) 92%, black 8%); border:1px solid rgba(255,255,255,.12); align-self:flex-start; }

    .diff-add{ color:#00ffc2; }
    .diff-del{ color:#ff5050; text-decoration:line-through; }

    /* ── HARDEN ALL POPPERS/MENUS TO SOLID (Radix, shadcn, Headless UI) ── */
    .va-scope [role="menu"],
    .va-scope [role="listbox"],
    .va-scope .DropdownMenuContent,
    .va-scope .SelectContent,
    .va-scope .PopoverContent,
    .va-scope .ContextMenuContent,
    .va-scope [data-radix-popper-content-wrapper] > div {
      background: var(--panel-bg) !important;
      color: var(--text) !important;
      border: 1px solid var(--input-border) !important;
      box-shadow: 0 36px 90px rgba(0,0,0,.55) !important;
      backdrop-filter: none !important;
      border-radius: 10px !important;
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

/* Select with SOLID menu + optional menu header */
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuTop
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
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
  }, [options, query, value]);

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect(); if (!r) return;
    const openUp = r.bottom + 360 > window.innerHeight;
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
              className="va-menu fixed z-[9999] p-3"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                /* force SOLID – inline so nothing can override */
                background: 'var(--panel-bg)',
                border: '1px solid var(--input-border)',
                boxShadow: '0 36px 90px rgba(0,0,0,.55)',
                borderRadius: 10 as any,
                backdropFilter: 'none'
              }}
            >
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
  const [activeId, setActiveId] = useState<string>(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || ''; } catch { return ''; }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string>('');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  /* Chat drawer */
  const [showCall, setShowCall] = useState(false);
  const [overlayPulse, setOverlayPulse] = useState(false);
  const [messages, setMessages] = useState<Array<{role:'user'|'assistant'; text:string}>>([
    { role: 'assistant', text: 'Hi! Ready when you are.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  /* Generate overlay + diff */
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'loading'>('idle');
  const basePromptRef = useRef<string>('');
  const [pendingPrompt, setPendingPrompt] = useState<string>('');
  const [showDiff, setShowDiff] = useState(false);

  /* Voices (Web Speech) */
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);

  /* Rail events */
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

  /* prompt composer + diff */
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
  const escapeHTML = (s:string) => s.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'} as any)[c]);
  function diffHTML(oldText: string, newText: string) {
    if (newText.startsWith(oldText)) { const add = newText.slice(oldText.length); return `${escapeHTML(oldText)}<span class="diff-add">${escapeHTML(add)}</span>`; }
    if (oldText.startsWith(newText)) { const del = oldText.slice(newText.length); return `${escapeHTML(newText)}<span class="diff-del">${escapeHTML(del)}</span>`; }
    return `<span class="diff-del">${escapeHTML(oldText)}</span>\n<span class="diff-add">${escapeHTML(newText)}</span>`;
  }
  function startGenerate() {
    basePromptRef.current = data.systemPrompt;
    setGenPhase('loading');
    setTimeout(() => {
      const merged = buildPrompt(basePromptRef.current, composerText);
      setPendingPrompt(merged);
      setShowDiff(true); setShowGenerate(false); setGenPhase('idle');
    }, 650);
  }
  const acceptDiff = () => { setData(p => ({ ...p, systemPrompt: pendingPrompt })); setPendingPrompt(''); setShowDiff(false); };
  const declineDiff = () => { setPendingPrompt(''); setShowDiff(false); };

  /* mock chat */
  function sendChat() {
    const txt = chatInput.trim();
    if (!txt) return;
    setMessages(m => [...m, { role: 'user', text: txt }]);
    setChatInput('');
    const reply = `${data.name || 'Assistant'}: "${txt}" received. How can I help further?`;
    setTimeout(() => setMessages(m => [...m, { role: 'assistant', text: reply }]), 350);
  }

  /* TTS preview */
  function speakPreview(line?: string){
    const u = new SpeechSynthesisUtterance(line || `Hi, I'm ${data.name || 'your assistant'}. This is a preview.`);
    const byName = voices.find(v => v.name.toLowerCase().includes((data.voiceName || '').split(' ')[0]?.toLowerCase() || ''));
    const en = voices.find(v => v.lang?.startsWith('en'));
    if (byName) u.voice = byName; else if (en) u.voice = en;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  const stopPreview = () => window.speechSynthesis.cancel();

  /* overlay pulse trigger */
  const pulseOverlay = () => { setOverlayPulse(true); setTimeout(()=>setOverlayPulse(false), 320); };

  /* ─────────── render ─────────── */
  return (
    <section className="va-scope" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Tokens />

      {/* FIXED ASSISTANT SIDEBAR */}
      <aside className="va-left-fixed">
        <div className="rail-scroll">
          <AssistantRail />
        </div>
      </aside>

      {/* RIGHT CONTENT */}
      <div style={{ marginLeft: 260 }}>
        <div className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]" style={{ fontSize:'var(--fz-body)', lineHeight:'var(--lh-body)' }}>

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

          {/* KPIs */}
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
                  <button
                    className="inline-flex items-center gap-2 rounded-[10px] text-sm"
                    style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                    onClick={()=>{ setComposerText(''); setShowGenerate(true); setGenPhase('idle'); }}
                  >
                    <Wand2 className="w-4 h-4" /> Generate
                  </button>
                </div>

                <div style={{ position:'relative' }}>
                  <textarea
                    className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                    style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                    value={data.systemPrompt}
                    onChange={(e)=>setField('systemPrompt')(e.target.value)}
                  />
                  {showDiff && (
                    <div
                      className="absolute inset-0 rounded-[12px] px-3 py-[12px] overflow-auto"
                      style={{ background:'var(--panel-bg)', border:'1px solid rgba(255,255,255,.12)', color:'var(--text)' }}
                    >
                      <div dangerouslySetInnerHTML={{ __html: diffHTML(basePromptRef.current, pendingPrompt) }} />
                      <div className="mt-3 flex gap-2">
                        <button onClick={acceptDiff} className="h-9 px-3 rounded-[10px] font-semibold" style={{ background:CTA, color:'#fff' }}>
                          Accept changes
                        </button>
                        <button onClick={declineDiff} className="h-9 px-3 rounded-[10px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}>
                          Decline
                        </button>
                      </div>
                    </div>
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
                <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                  Keys are stored per-account via scoped storage. Manage them in the API Keys page.
                </div>
              </div>

              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice Provider</div>
                <StyledSelect value={data.ttsProvider} onChange={(v)=>setField('ttsProvider')(v as AgentData['ttsProvider'])} options={ttsProviders}/>
              </div>
            </div>

            {/* Voice select WITH PLAYER inside dropdown */}
            <div className="grid grid-cols-1 mt-[var(--s-4)]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Voice</div>
                <StyledSelect
                  value={data.voiceName}
                  onChange={setField('voiceName')}
                  options={openAiVoices}
                  placeholder="— Choose —"
                  menuTop={
                    <div className="flex items-center justify-between px-3 py-2 rounded-[10px]"
                         style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
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

      {/* Drawer + SOLID overlay with click animation */}
      {createPortal(
        <>
          <div
            className={`va-blur-overlay ${showCall ? 'open' : ''} ${overlayPulse ? 'pulse' : ''}`}
            onClick={()=>{ setShowCall(false); pulseOverlay(); }}
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
              <form onSubmit={(e)=>{ e.preventDefault(); sendChat(); }} className="flex items-center gap-2">
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

      {/* Generate overlay (SOLID) with same pulse-on-click */}
      {showGenerate && createPortal(
        <div className="va-modal-wrap" role="dialog" aria-modal>
          <div className="va-modal-blur" onClick={()=>{ if (genPhase==='idle') { setShowGenerate(false); pulseOverlay(); } }} />
          <div className="va-modal-center">
            <div className="va-sheet w-full max-w-[760px] p-4 md:p-6">
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
                  style={{ minHeight: 180, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                />
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={()=>setShowGenerate(false)}
                    disabled={genPhase==='loading'}
                    className="h-9 px-3 rounded-[10px]"
                    style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={startGenerate}
                    disabled={genPhase==='loading'}
                    className="h-9 px-4 rounded-[10px] font-semibold"
                    style={{ background:CTA, color:'#fff' }}
                  >
                    {genPhase==='loading' ? 'Generating…' : 'Generate'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
