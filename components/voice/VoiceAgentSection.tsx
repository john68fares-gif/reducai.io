// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Phone, Rocket, Search, Check, Lock, X
} from 'lucide-react';

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

/* ───────────────── Tokens ───────────────── */
const ACTIVE_KEY = 'va:activeId';
const CTA        = '#59d9b3';
const CTA_HOVER  = '#54cfa9';

const Tokens = () => (
  <style jsx global>{`
    .va-scope{
      --s-2: 8px; --s-3: 12px; --s-4: 16px; --s-6: 24px; --s-8: 32px;
      --radius-outer: 10px;
      --radius-inner: 12px;
      --control-h: 44px;
      --collapsed-h: 72px;
      --fz-title: 18px; --fz-sub: 15px; --fz-body: 14px; --fz-label: 12.5px;
      --lh-body: 1.45; --ease: cubic-bezier(.22,.61,.36,1);

      --panel: #101314;
      --panel-alt: #0e1212;
      --border-weak: rgba(255,255,255,.06);
      --ring: rgba(89,217,179,.10);

      --input-bg: #0e1112;
      --input-border: rgba(255,255,255,.12);
      --input-shadow: 0 10px 28px rgba(0,0,0,.22), 0 0 0 1px rgba(89,217,179,.06);

      --menu-bg: #0f1314;
      --menu-border: rgba(255,255,255,.12);
      --menu-shadow: 0 26px 60px rgba(0,0,0,.46), 0 0 0 1px rgba(89,217,179,.10);

      --text: #eaf8f3; --text-muted: rgba(234,248,243,.66);
      --bg: #0b0e0f;

      /* bigger, softer green glow */
      --shadow-green: 0 28px 80px rgba(89,217,179,.18), 0 8px 24px rgba(0,0,0,.35);
    }
    :root:not([data-theme="dark"]) .va-scope{
      --panel: #ffffff; --panel-alt: #ffffff; --border-weak: rgba(0,0,0,.08);
      --ring: rgba(89,217,179,.08);
      --input-bg: #ffffff; --input-border: rgba(0,0,0,.10);
      --input-shadow: 0 12px 28px rgba(0,0,0,.14), 0 0 0 1px rgba(0,0,0,.03);
      --menu-bg: #ffffff; --menu-border: rgba(0,0,0,.10);
      --menu-shadow: 0 26px 60px rgba(0,0,0,.18), 0 0 0 1px rgba(0,0,0,.04);
      --text: #0e1213; --text-muted: rgba(14,18,19,.62);
      --bg: #f6f7f8;
      --shadow-green: 0 28px 80px rgba(89,217,179,.10), 0 8px 24px rgba(0,0,0,.18);
    }

    .va-main{ overflow: visible; position: relative; contain: none; }
    .va-portal{ background: var(--menu-bg); border: 1px solid var(--menu-border); box-shadow: var(--menu-shadow); border-radius: 10px; }
    .va-collapsing{ overflow: hidden; will-change: height; }
  `}</style>
);

/* ───────────────── Types / storage ───────────────── */
type AgentData = {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: string;
  firstMsg: string;
  systemPrompt: string;

  ttsProvider: 'openai' | 'elevenlabs';
  voiceName: string;

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
        transform:`translateX(${checked?22:0}px)`, transition:'transform .18s var(--ease)',
        boxShadow: checked ? '0 0 8px rgba(89,217,179,.45)' : undefined
      }}
    />
  </button>
);

/* Solid portal dropdown (fixed, high z-index, stable click-outside) */
function StyledSelect({
  value, onChange, options, placeholder
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
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
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || portalRef.current?.contains(t)) return;
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
        className="w-full flex items-center justify-between gap-3 px-3 rounded-[var(--radius-inner)] transition"
        style={{
          height:'var(--control-h)',
          background:'var(--input-bg)', border:'1px solid var(--input-border)',
          boxShadow:'var(--input-shadow)', color:'var(--text)', fontSize:'var(--fz-body)'
        }}
      >
        <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
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
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                pointerEvents:'auto'
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[8px]"
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
                    onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background='rgba(89,217,179,0.06)'; el.style.border='1px solid rgba(89,217,179,0.22)'; }}
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

/* ───────────────── Small overlay for Generate → writes main prompt ───────────────── */
function PromptOverlay({
  initial, onClose, onUse,
}:{
  initial: string; onClose: ()=>void; onUse: (v:string)=>void;
}) {
  const [val, setVal] = useState(initial);
  const boxRef = useRef<HTMLDivElement|null>(null);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!boxRef.current?.contains(t)) onClose();
    };
    window.addEventListener('keydown', onEsc);
    window.addEventListener('mousedown', onDown);
    return () => { window.removeEventListener('keydown', onEsc); window.removeEventListener('mousedown', onDown); };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[99998] grid place-items-center px-4" style={{ background:'rgba(0,0,0,.55)' }}>
      <div ref={boxRef} className="w-full max-w-[680px] rounded-[12px] p-4 md:p-5"
           style={{ background:'var(--menu-bg)', border:'1px solid var(--menu-border)', boxShadow:'var(--menu-shadow)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-base font-semibold" style={{ color:'var(--text)' }}>Generate Base Prompt</div>
          <button onClick={onClose} className="p-1 rounded hover:opacity-80" aria-label="Close">
            <X className="w-5 h-5" style={{ color:'var(--text-muted)' }} />
          </button>
        </div>
        <div className="text-xs mb-3" style={{ color:'var(--text-muted)' }}>
          Edit the template below or paste your own. Clicking “Use as Prompt” will replace the System Prompt.
        </div>
        <textarea
          value={val}
          onChange={(e)=>setVal(e.target.value)}
          className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
          style={{ minHeight: 260, background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)', lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
        />
        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="h-9 px-3 rounded-[8px]"
            style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={()=>onUse(val)}
            className="h-9 px-3 rounded-[8px] font-semibold"
            style={{ background:CTA, color:'#0a0f0d', boxShadow:'0 10px 24px rgba(89,217,179,.28)' }}
            onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
            onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
          >
            Use as Prompt
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* ───────────────── Section (lighter header) ───────────────── */
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
    <div className="mb-[var(--s-6)]">
      <div
        className="rounded-[var(--radius-outer)] overflow-hidden"
        style={{
          background:'linear-gradient(180deg, var(--panel-alt), var(--panel))',
          border:'1px solid var(--border-weak)',
          boxShadow:'var(--shadow-green)'
        }}
      >
        {/* Lighter header bar for separation */}
        <button
          onClick={()=>setOpen(v=>!v)}
          className="w-full text-left px-4 sm:px-5 relative"
          style={{
            color:'var(--text)', minHeight:'var(--collapsed-h)',
            display:'grid', gridTemplateColumns:'1fr auto', alignItems:'center', gap:'12px',
            background:'linear-gradient(180deg, rgba(255,255,255,.035), rgba(255,255,255,0))'
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

        <div style={{ height:1, background:'var(--border-weak)', opacity:.6 }} />

        <div
          ref={wrapRef}
          className="va-collapsing"
          style={{ height: open ? h : 0, transition: 'height 200ms var(--ease)' }}
          onTransitionEnd={() => { if (open) measure(); }}
        >
          <div ref={innerRef} className="p-[var(--s-6)]">
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
  const [showPromptOverlay, setShowPromptOverlay] = useState(false);

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
        <div className="border-r sticky top-0 h-screen" style={{ borderColor:'rgba(255,255,255,.14)' }}>
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
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[8px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button
              onClick={doCallTest}
              disabled={calling}
              className="inline-flex items-center gap-2 rounded-[8px] font-semibold select-none disabled:opacity-60"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#0a0f0d', boxShadow:'0 14px 30px rgba(89,217,179,.28)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <Phone className="w-4 h-4" /> {calling ? 'Calling…' : 'Talk to Assistant'}
            </button>
          </div>

          {toast ? (
            <div className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
                 style={{ background:'rgba(89,217,179,.10)', color:'var(--text)', boxShadow:'0 0 0 1px rgba(89,217,179,.16) inset' }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* KPIs */}
          <div className="grid gap-[var(--s-4)] md:grid-cols-2 mb-[var(--s-6)]">
            <div className="relative p-[var(--s-4)] rounded-[10px]"
                 style={{ background:'var(--panel)', border:'1px solid var(--border-weak)', boxShadow:'var(--shadow-green)' }}>
              <div className="text-xs mb-[6px]" style={{ color:'var(--text-muted)' }}>Cost</div>
              <div className="font-semibold" style={{ fontSize:'var(--fz-sub)', color:'var(--text)' }}>~$0.1/min</div>
            </div>
            <div className="relative p-[var(--s-4)] rounded-[10px]"
                 style={{ background:'var(--panel)', border:'1px solid var(--border-weak)', boxShadow:'var(--shadow-green)' }}>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Provider</label>
                <StyledSelect value={data.provider} onChange={(v)=>set('provider')(v as AgentData['provider'])} options={providerOpts}/>
              </div>

              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Model</label>
                <StyledSelect value={data.model} onChange={set('model')} options={modelOpts}/>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>First Message Mode</label>
                <StyledSelect value={data.firstMode} onChange={set('firstMode')} options={firstMessageModes}/>
              </div>
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>First Message</label>
                <input
                  className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3"
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
                  className="inline-flex items-center gap-2 rounded-[8px] text-sm transition hover:-translate-y-[1px]"
                  style={{ height:36, padding:'0 12px', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)' }}
                  onClick={()=>setShowPromptOverlay(true)}
                >
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
              <textarea
                className="w-full bg-transparent outline-none rounded-[var(--radius-inner)] px-3 py-[10px]"
                style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)', color:'var(--text)', minHeight:130, lineHeight:'var(--lh-body)', fontSize:'var(--fz-body)' }}
                value={data.systemPrompt}
                onChange={(e)=>set('systemPrompt')(e.target.value)}
              />
            </div>
          </Section>

          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose the TTS provider and voice."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Voice Provider</label>
                <StyledSelect value={data.ttsProvider} onChange={(v)=>set('ttsProvider')(v as AgentData['ttsProvider'])} options={ttsProviders}/>
              </div>
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Voice</label>
                <StyledSelect value={data.voiceName} onChange={set('voiceName')} options={openAiVoices} placeholder="— Choose —"/>
              </div>
            </div>
            <div className="mt-[var(--s-2)] text-xs" style={{ color:'var(--text-muted)' }}>
              Keep utterances short/specific for the most natural cadence. (ElevenLabs mapping can be added later.)
            </div>
          </Section>

          <Section
            title="Transcriber"
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Speech-to-text configuration for calls."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)]">
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Provider</label>
                <StyledSelect value={data.asrProvider} onChange={(v)=>set('asrProvider')(v as AgentData['asrProvider'])} options={asrProviders}/>
              </div>
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Language</label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[var(--s-4)] mt-[var(--s-4)]">
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Dialect</label>
                <StyledSelect value={data.asrDialect} onChange={(v)=>set('asrDialect')(v as AgentData['asrDialect'])} options={dialectOpts}/>
              </div>
              <div>
                <label className="block mb-[var(--s-2)] font-medium" style={{ fontSize:'var(--fz-label)', color:'var(--text)' }}>Model</label>
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

      {showPromptOverlay && (
        <PromptOverlay
          initial={DEFAULT_AGENT.systemPrompt}
          onClose={()=>setShowPromptOverlay(false)}
          onUse={(v)=>{ set('systemPrompt')(v); setShowPromptOverlay(false); }}
        />
      )}
    </section>
  );
}
