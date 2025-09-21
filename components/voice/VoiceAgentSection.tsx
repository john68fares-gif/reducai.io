// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, Pause, X
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

// prompt-engine (kept — works if provided; shims below backstop it)
import {
  applyInstructions as _applyInstructions,
  DEFAULT_PROMPT as _DEFAULT_PROMPT,
  looksLikeFullPrompt as _looksLikeFullPrompt,
  normalizeFullPrompt as _normalizeFullPrompt,
} from '@/lib/prompt-engine';

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

/* ─────────── constants ─────────── */
const CTA = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const ACTIVE_KEY = 'va:activeId';
const Z_OVERLAY = 100000;
const Z_MODAL   = 100001;
const Z_MENU    = 100020;
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

/* icons (simple brand dots to avoid asset imports) */
const BrandDot = ({ color }: { color: string }) => (
  <span
    style={{ backgroundColor: color }}
    className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
    aria-hidden
  />
);
const ProviderIcon = (p:'openai'|'anthropic'|'google') => (
  <span className="inline-flex items-center gap-2">
    <BrandDot color={p==='openai' ? '#10a37f' : p==='anthropic' ? '#5b5bff' : '#4285f4'} />
  </span>
);
const ModelIcon = (label:string) => {
  const l = label.toLowerCase();
  const color =
    l.includes('5') ? '#7c3aed' :
    l.includes('4') ? '#10a37f' :
    l.includes('3') ? '#f59e0b' : '#94a3b8';
  return <BrandDot color={color} />;
};

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

/* ─────────── little safety helpers ─────────── */
const isFn = (f: any): f is Function => typeof f === 'function';
const isStr = (v: any): v is string => typeof v === 'string';
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const coerceStr = (v: any): string => (isStr(v) ? v : '');
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : '');

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

      --green-weak: rgba(89,217,179,.12);
      --green-strong: rgba(89,217,179,.22);

      --vs-input-bg:#101314;
      --vs-input-border:rgba(255,255,255,.14);
      --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);

      --vs-menu-bg:#101314;
      --vs-menu-border:rgba(255,255,255,.16);
    }

    .va-portal{
      --vs-menu-bg:#101314;
      --vs-menu-border:rgba(255,255,255,.16);
      --vs-input-bg:#101314;
      --vs-input-border:rgba(255,255,255,.14);
      --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
      --text:#e6f1ef;
      --text-muted:#9fb4ad;
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

    /* panel drawer */
    .va-drawer {
      position: fixed; inset: 0 0 0 auto; width: min(520px, 90vw);
      transform: translateX(100%);
      transition: transform .26s var(--ease);
      z-index: 100005;
      display: grid; grid-template-rows: auto 1fr auto;
      background: var(--panel-bg);
      border-left: 1px solid ${GREEN_LINE};
      box-shadow: 0 0 0 1px rgba(255,255,255,.05) inset, 0 24px 70px rgba(0,0,0,.6);
    }
    .va-drawer.open { transform: translateX(0); }
  `}</style>
);

/* ─────────── types / storage ─────────── */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  firstMode: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
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

const BLANK_TEMPLATE_NOTE =
  'This is a blank template with minimal defaults. You can change the model and messages, or click Generate to tailor the prompt to your business.';

const PROMPT_SKELETON =
`[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

/* ─────────── prompt-engine shims ─────────── */
const looksLikeFullPromptSafe = (raw: string) => {
  const t = (raw || '').toLowerCase();
  return ['[identity]', '[style]', '[response guidelines]', '[task & goals]', '[error handling', '[notes]'].some(h => t.includes(h));
};

const normalizeFullPromptSafe = (raw: string) => {
  const sections = { identity:'', style:'', guidelines:'', tasks:'', errors:'', notes:'' };
  const add = (k: keyof typeof sections, v: string) => { sections[k] = safeTrim(v); };
  const pull = (label: string) => {
    const rx = new RegExp(`\$begin:math:display$${label.replace(/[.*+?^${}()|[\\$end:math:display$\\\\]/g,'\\$&')}\\]\\s*([\\s\\S]*?)(?=\\n\\s*\\[|$)`, 'i');
    const m = raw.match(rx); return m ? m[1] : '';
  };
  add('identity', pull('Identity'));
  add('style', pull('Style'));
  add('guidelines', pull('Response Guidelines'));
  add('tasks', pull('Task & Goals'));
  add('errors', pull('Error Handling / Fallback'));
  add('notes', pull('Notes'));

  const out =
`[Identity]
${sections.identity || '- You are a helpful, professional AI assistant for this business.'}

[Style]
${sections.style || '- Clear, concise, friendly.'}

[Response Guidelines]
${sections.guidelines || '- Ask one clarifying question when essential info is missing.'}

[Task & Goals]
${sections.tasks || '- Guide users to their next best action (booking, purchase, or escalation).'}

[Error Handling / Fallback]
${sections.errors || '- If unsure, ask a specific clarifying question first.'}

${sections.notes ? `[Notes]\n${sections.notes}\n` : ''}`;
  return out.trim();
};

const applyInstructionsSafe = (base: string, raw: string) => {
  const text = (raw || '').trim();
  const industryMatch = text.match(/assistant\s+for\s+(a|an|the)?\s*([^.;:,]+?)(\s+(clinic|store|company|business))?(\.|;|,|$)/i);
  const industry = industryMatch ? industryMatch[2].trim() : '';

  const toneMatch = text.match(/tone\s*[:=]\s*([a-z,\s-]+)/i) || text.match(/\b(friendly|formal|casual|professional|empathetic|playful)\b/i);
  const tone = toneMatch ? (toneMatch as any)[1]?.trim?.() || (toneMatch as any)[0] : '';

  const tasksMatch = text.match(/tasks?\s*[:=]\s*([a-z0-9_,\-\s]+)/i);
  const tasksRaw = tasksMatch ? (tasksMatch as any)[1] : '';
  const tasks = tasksRaw
    ? tasksRaw.split(/[,\s]+/).filter(Boolean)
    : (text.includes('booking') || text.includes('schedule')) ? ['lead_qualification','booking','faq'] : [];

  const channels = /voice|call|phone/i.test(text) && /chat|website|web/i.test(text) ? 'voice & chat'
                  : /voice|call|phone/i.test(text) ? 'voice'
                  : /chat|website|web/i.test(text) ? 'chat' : '';

  const identity =
`- You are a versatile AI assistant${industry ? ` for a ${industry}` : ''}. Represent the brand professionally.`;

  const style =
`- ${tone ? `${tone[0].toUpperCase()}${tone.slice(1)}` : 'Clear, concise, friendly'}. Use 2–4 short sentences per turn.`;

  const guidelines =
`- Ask a clarifying question when essential info is missing.
- Don’t fabricate; say when you need to check.`;

  const goals =
`- Qualify needs, answer FAQs, guide to scheduling/purchase/escalation.${channels ? ` (${channels})` : ''}${tasks.length ? ` Focus: ${tasks.join(', ')}.` : ''}`;

  const errors =
`- If uncertain, ask a specific clarifying question.
- If a tool fails, apologize briefly and offer alternatives.`;

  const merged =
`[Identity]
${identity}

[Style]
${style}

[Response Guidelines]
${guidelines}

[Task & Goals]
${goals}

[Error Handling / Fallback]
${errors}`;

  return { merged, summary: 'Updated.' };
};

const looksLikeFullPromptRT = (raw: string) =>
  isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : looksLikeFullPromptSafe(raw);
const normalizeFullPromptRT = (raw: string) =>
  isFn(_normalizeFullPrompt) ? coerceStr(_normalizeFullPrompt(raw)) : normalizeFullPromptSafe(raw);
const applyInstructionsRT = (base: string, raw: string) =>
  isFn(_applyInstructions) ? (_applyInstructions as any)(base, raw) : applyInstructionsSafe(base, raw);
const DEFAULT_PROMPT_RT = nonEmpty(_DEFAULT_PROMPT) ? _DEFAULT_PROMPT! : PROMPT_SKELETON;

/* ─────────── defaults ─────────── */
const DEFAULT_AGENT: AgentData = {
  name: 'Assistant',
  provider: 'openai',
  model: 'GPT-4o',
  firstMode: 'Assistant speaks first',
  firstMsg: 'Hello.',
  systemPrompt: normalizeFullPromptRT(`
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
`).trim() + '\n\n' + `# ${BLANK_TEMPLATE_NOTE}\n`,
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

const loadAgentData = (id: string): AgentData => {
  try { const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null; if (raw) return { ...DEFAULT_AGENT, ...(JSON.parse(raw)||{}) }; }
  catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try { if (IS_CLIENT) localStorage.setItem(keyFor(id), JSON.stringify(data)); } catch {}
};
const pushVersion = (id:string, snapshot:any) => {
  try {
    if (!IS_CLIENT) return;
    const raw = localStorage.getItem(versKeyFor(id));
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift({ id: `v_${Date.now()}`, ts: Date.now(), ...snapshot });
    localStorage.setItem(versKeyFor(id), JSON.stringify(arr.slice(0, 50)));
  } catch {}
};

/* ─────────── mock backend (save/publish) ─────────── */
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

/* ─────────── option helpers ─────────── */
type Opt = { value: string; label: string; disabled?: boolean; note?: string; iconLeft?: React.ReactNode };

const providerOpts: Opt[] = [
  { value: 'openai',     label: 'OpenAI',     iconLeft: ProviderIcon('openai') },
  { value: 'anthropic',  label: 'Anthropic — coming soon', disabled: true, note: 'soon', iconLeft: ProviderIcon('anthropic') },
  { value: 'google',     label: 'Google — coming soon',    disabled: true, note: 'soon', iconLeft: ProviderIcon('google') },
];

/* include 5/4/3 keystrings + logos; these are UI choices and do not force backend availability */
const modelOptsFor = (provider: string): Opt[] => {
  if (provider === 'openai') {
    return [
      { value: 'gpt-5-preview', label: 'GPT-5 Preview', iconLeft: ModelIcon('5') },
      { value: 'GPT-4.1',       label: 'GPT-4.1',      iconLeft: ModelIcon('4') },
      { value: 'GPT-4o',        label: 'GPT-4o',       iconLeft: ModelIcon('4') },
      { value: 'gpt-4',         label: 'GPT-4',        iconLeft: ModelIcon('4') },
      { value: 'o4-mini',       label: 'o4-mini',      iconLeft: ModelIcon('4') },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo',iconLeft: ModelIcon('3') },
    ];
  }
  return [{ value: 'coming', label: 'Models coming soon', disabled: true }];
};

const ttsProviders: Opt[] = [
  { value: 'openai',    label: 'OpenAI', iconLeft: ProviderIcon('openai') },
  { value: 'elevenlabs', label: 'ElevenLabs — coming soon', disabled: true, note: 'soon' },
];

const asrProviders: Opt[] = [
  { value: 'deepgram',   label: 'Deepgram',  iconLeft: <BrandDot color="#1fb6ff" /> },
  { value: 'whisper',    label: 'Whisper — coming soon', disabled: true, note: 'soon', iconLeft: ProviderIcon('openai') },
  { value: 'assemblyai', label: 'AssemblyAI — coming soon', disabled: true, note: 'soon', iconLeft: <BrandDot color="#9333ea" /> },
];

const asrModelsFor = (asr: string): Opt[] =>
  asr === 'deepgram'
    ? [
        { value: 'Nova 2', label: 'Nova 2', iconLeft: <BrandDot color="#1fb6ff" /> },
        { value: 'Nova',   label: 'Nova',   iconLeft: <BrandDot color="#1fb6ff" /> },
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

/* ─────────── Styled select with portal (less rounded + viewport clamp + icons + bottom space) ─────────── */
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
  const menuRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{left:number; top:number; width:number; maxH:number} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  function calcMenu(){
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const padding = 8;
    const width = Math.min(r.width, Math.max(220, r.width));
    const left = Math.min(Math.max(padding, r.left), vw - width - padding);
    const spaceBelow = vh - r.bottom - padding;
    const spaceAbove = r.top - padding;
    const desired = 340;
    let maxH = Math.max(220, Math.min(desired, spaceBelow - 12));
    let top = r.bottom + 8;
    if (spaceBelow < 220 && spaceAbove > spaceBelow) {
      maxH = Math.max(220, Math.min(desired, spaceAbove - 12));
      top = Math.max(padding, r.top - (maxH + 16));
    }
    setMenuPos({ left, top, width, maxH });
  }

  useLayoutEffect(() => { if (open) calcMenu(); }, [open]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => { if (open) calcMenu(); };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onResize);
    window.addEventListener('scroll', onResize, true);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('scroll', onResize, true);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[8px] text-sm outline-none transition"
        style={{
          background:'var(--vs-input-bg, #101314)',
          border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))',
          boxShadow:'var(--vs-input-shadow, none)',
          color:'var(--text)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          {current?.iconLeft}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && IS_CLIENT ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100020] p-3 va-portal"
          style={{
            position:'fixed',
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'var(--vs-menu-bg, #101314)',
            border:'1px solid var(--vs-menu-border, rgba(255,255,255,.16))',
            borderRadius:12,
            boxShadow:'0 28px 70px rgba(0,0,0,.60), 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)',
            maxHeight: menuPos?.maxH ?? 320,
            overflow:'hidden auto',
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[8px]"
            style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', boxShadow:'var(--vs-input-shadow, none)', color:'var(--text)' }}
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

          <div className="pr-1" style={{ scrollbarWidth:'thin' }}>
            {filtered.map(o => (
              <button
                key={o.value}
                disabled={!!o.disabled}
                onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                className="w-full text-left text-sm px-3 py-2 rounded-[8px] transition grid grid-cols-[18px_18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                style={{
                  color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                  background:'transparent',
                  border:'1px solid transparent',
                  cursor:o.disabled?'not-allowed':'pointer',
                }}
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(0,255,194,0.10)'; el.style.border = '1px solid rgba(0,255,194,0.35)'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
              >
                {o.disabled ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />}
                <span className="inline-grid place-items-center">{o.iconLeft ?? <span />}</span>
                <span className="truncate">{o.label}</span>
                {onPreview ? (
                  <button
                    type="button"
                    onClick={async (e)=>{ e.stopPropagation(); await onPreview(o.value); }}
                    className="w-7 h-7 rounded-full grid place-items-center"
                    style={{ border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', background:'var(--vs-input-bg, #101314)' }}
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

          {/* bottom space so menu isn't glued to the edge */}
          <div style={{ height: 8 }} />
        </div>,
        document.body
      ) : null}
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
function computeDiff(base:string, next:string){
  const a = (base || '').split('\n');
  const b = (next || '').split('\n');
  const setA = new Set(a);
  const setB = new Set(b);
  const rows: Array<{t:'same'|'add'|'rem', text:string}> = [];
  const max = Math.max(a.length, b.length);
  for (let i=0;i<max;i++){
    const la = a[i]; const lb = b[i];
    if (la === lb && la !== undefined){ rows.push({ t:'same', text: la! }); continue; }
    if (lb !== undefined && !setA.has(lb)) rows.push({ t:'add', text: lb });
    if (la !== undefined && !setB.has(la)) rows.push({ t:'rem', text: la });
  }
  for (let j=a.length;j>b.length;j++){
    const la=a[j]; if (la!==undefined && !setB.has(la)) rows.push({ t:'rem', text: la });
  }
  for (let j=a.length;j<b.length;j++){
    const lb=b[j]; if (lb!==undefined && !setA.has(lb)) rows.push({ t:'add', text: lb });
  }
  return rows;
}
function DiffInline({ base, next }:{ base:string; next:string }){
  const rows = computeDiff(base, next);
  return (
    <pre
      className="rounded-[8px] px-3 py-3 text-sm"
      style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)', whiteSpace:'pre-wrap', lineHeight:'1.55' }}
    >
      {rows.map((r, i) => {
        if (r.t === 'same') return <span key={i}>{(r.text || ' ') + '\n'}</span>;
        if (r.t === 'add') return (
          <span
            key={i}
            style={{ background:'rgba(89,217,179,.12)', borderLeft:'3px solid '+CTA, display:'block', padding:'2px 6px', borderRadius:6, margin:'2px 0' }}
          >{(r.text || ' ') + '\n'}</span>
        );
        return (
          <span
            key={i}
            style={{ background:'rgba(239,68,68,.14)', borderLeft:'3px solid #ef4444', display:'block', padding:'2px 6px', borderRadius:6, margin:'2px 0', textDecoration:'line-through', opacity:.9 }}
          >{(r.text || ' ') + '\n'}</span>
        );
      })}
    </pre>
  );
}

/* ─────────── Realtime model chooser (provider-agnostic mapping) ─────────── */
function getRealtimeModelFor(provider: AgentData['provider'], uiModel: string): string {
  const m = (uiModel || '').toLowerCase();
  if (provider === 'openai') {
    if (m.includes('5') || m.includes('4') || m.includes('o4')) return 'gpt-4o-realtime-preview';
    if (m.includes('3')) return 'gpt-4o-realtime-preview'; // fallback RT
    return 'gpt-4o-realtime-preview';
  }
  // placeholders until you wire other RTP backends
  if (provider === 'anthropic') return 'gpt-4o-realtime-preview';
  if (provider === 'google')    return 'gpt-4o-realtime-preview';
  return 'gpt-4o-realtime-preview';
}

/* ─────────── Page ─────────── */
type ChatMsg = { id: string; role: 'user'|'assistant'|'system'; text: string };

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

  /* call panel */
  const [showCall, setShowCall] = useState(false);
  const [transcript, setTranscript] = useState<Array<{role:'assistant'|'user', text:string}>>([]);

  // Generate overlay (no presets)
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'editing'|'loading'|'review'>('idle');

  // prompt edit state
  const basePromptRef = useRef<string>('');
  const [proposedPrompt, setProposedPrompt] = useState('');
  const [changesSummary, setChangesSummary] = useState('');

  // voice preview (browser)
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
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
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

  /* load API keys */
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

        const storeSelected = await store.getJSON<string>('apiKeys.selectedId', '');
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (storeSelected && cleaned.some((k) => k.id === storeSelected)) ? storeSelected :
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
          try { if (IS_CLIENT) localStorage.setItem(keyFor(activeId), JSON.stringify(next)); } catch {}
          try { if (IS_CLIENT) window.dispatchEvent(new CustomEvent('assistant:update', { detail: { id: activeId, name: String(v) } })); } catch {}
        }
        return next;
      });
    };
  }

  const modelOpts = useMemo(()=>modelOptsFor(data.provider), [data.provider]);

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

  /* ─────────── REALTIME CALL PANEL ─────────── */
  const callModel = getRealtimeModelFor(data.provider, data.model);

  const openCall = () => {
    const key = apiKeys.find(k => k.id === data.apiKeyId)?.key || '';
    if (!key) {
      setToastKind('error'); setToast('Select an OpenAI API key first.'); setTimeout(()=>setToast(''), 2200);
      return;
    }
    // reset transcript
    setTranscript([]);
    // seed "assistant speaks first"
    if (data.firstMode === 'Assistant speaks first' && nonEmpty(data.firstMsg)) {
      setTranscript([{ role: 'assistant', text: data.firstMsg }]);
    }
    setShowCall(true);
  };

  // Hook up to events optionally dispatched by your WebCallButton (if you emit them)
  useEffect(() => {
    if (!IS_CLIENT) return;
    const onPartial = (e: any) => {
      const { role, text } = e.detail || {};
      if (!role || !text) return;
      setTranscript(prev => {
        const copy = [...prev];
        // show partial as replace of last same-role partial, else append
        const last = copy[copy.length-1];
        if (last && last.role === role && !last.text.endsWith('✓')) {
          copy[copy.length-1] = { role, text };
          return copy;
        }
        return [...copy, { role, text }];
      });
    };
    const onFinal = (e: any) => {
      const { role, text } = e.detail || {};
      if (!role || !text) return;
      setTranscript(prev => [...prev, { role, text }]);
    };
    window.addEventListener('webcall:partial' as any, onPartial as any);
    window.addEventListener('webcall:final' as any, onFinal as any);
    return () => {
      window.removeEventListener('webcall:partial' as any, onPartial as any);
      window.removeEventListener('webcall:final' as any, onFinal as any);
    };
  }, []);

  /* ─────────── UI ─────────── */
  const inInlineReview = genPhase === 'review' && !showGenerate;

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
              onClick={openCall}
              className="inline-flex items-center gap-2 rounded-[8px] select-none"
              style={{ height:'var(--control-h)', padding:'0 18px', background:CTA, color:'#ffffff', fontWeight:700, boxShadow:'0 10px 22px rgba(89,217,179,.20)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <PhoneFilled style={{ color:'#ffffff' }} />
              <span style={{ color:'#ffffff' }}>Talk to Assistant</span>
            </button>
          </div>

          {toast ? (
            <div
              className="mb-[var(--s-4)] inline-flex items-center gap-2 px-3 py-1.5 rounded-[8px]"
              style={{
                background: toastKind === 'error' ? 'rgba(239,68,68,.12)' : 'rgba(89,217,179,.10)',
                color: 'var(--text)',
                boxShadow: toastKind === 'error'
                  ? '0 0 0 1px rgba(239,68,68,.25) inset'
                  : '0 0 0 1px rgba(89,217,179,.16) inset'
              }}
            >
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
                  className="w-full bg-transparent outline-none rounded-[8px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  placeholder="e.g., Riley"
                />
              </div>
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Provider</div>
                <StyledSelect
                  value={data.provider}
                  onChange={(v)=>setField('provider')(v as AgentData['provider'])}
                  options={providerOpts}
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
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">First Message</div>
                <input
                  value={data.firstMsg}
                  onChange={(e)=>setField('firstMsg')(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[8px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                  placeholder="What the assistant says first…"
                />
              </div>
              <div className="md:col-span-1" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px] mt-[var(--s-4)]">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-[var(--s-2)]">
                  <div className="font-medium" style={{ fontSize:'var(--fz-label)' }}>System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button
                      className="inline-flex items-center gap-2 rounded-[8px] text-sm"
                      style={{ height:36, padding:'0 12px', background:CTA, color:'#fff', border:'1px solid rgba(255,255,255,.08)' }}
                      onClick={()=>{ setComposerText(''); setProposedPrompt(''); setChangesSummary(''); setGenPhase('editing'); setShowGenerate(true); }}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                <div style={{ position:'relative' }}>
                  {!inInlineReview ? (
                    <textarea
                      className="w-full bg-transparent outline-none rounded-[8px] px-3 py-[12px]"
                      style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}
                      value={data.systemPrompt}
                      onChange={(e)=> setField('systemPrompt')(e.target.value)}
                    />
                  ) : (
                    <div
                      className="rounded-[8px]"
                      style={{
                        background:'var(--input-bg)',
                        border:'1px solid var(--input-border)',
                        color:'var(--text)',
                        padding:'12px'
                      }}
                    >
                      <DiffInline base={basePromptRef.current} next={proposedPrompt}/>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Section>

          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h
