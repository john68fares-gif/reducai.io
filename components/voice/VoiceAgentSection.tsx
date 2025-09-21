// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import { createPortal } from 'react-dom';
import {
  Wand2, ChevronDown, ChevronUp, Gauge, Mic, Volume2, Rocket, Search, Check, Lock,
  KeyRound, Play, Square, Pause, X, Link2, Save, TestTube2, Database, UserRound, Loader2,
  ChevronRight, ChevronLeft
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';
import WebCallButton from '@/components/voice/WebCallButton';

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

/* ─────────── helpers ─────────── */
const isFn = (f: any): f is Function => typeof f === 'function';
const nonEmpty = (v: any): v is string => typeof v === 'string' && v.trim().length > 0;
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
      --app-sidebar-w: 240px; --rail-w: 260px;
      --page-bg:var(--bg); --panel-bg:var(--panel); --input-bg:var(--panel);
      --input-border:rgba(255,255,255,.10); --input-shadow:0 0 0 1px rgba(255,255,255,.06) inset;
      --border-weak:rgba(255,255,255,.10);
      --card-shadow:0 22px 44px rgba(0,0,0,.28),
                    0 0 0 1px rgba(255,255,255,.06) inset,
                    0 0 0 1px ${GREEN_LINE};
      --green-weak: rgba(89,217,179,.12); --green-strong: rgba(89,217,179,.22);
      --red-weak: rgba(239,68,68,.14); --red-strong: rgba(239,68,68,.26);
      --vs-input-bg:#101314; --vs-input-border:rgba(255,255,255,.14);
      --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
      --vs-menu-bg:#101314; --vs-menu-border:rgba(255,255,255,.16);
    }
    .va-portal{ --vs-menu-bg:#101314; --vs-menu-border:rgba(255,255,255,.16);
      --vs-input-bg:#101314; --vs-input-border:rgba(255,255,255,.14);
      --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
      --text:#e6f1ef; --text-muted:#9fb4ad; }
    .va-card{ border-radius:var(--radius-outer); border:1px solid var(--border-weak);
      background:var(--panel-bg); box-shadow:var(--card-shadow); overflow:hidden; isolation:isolate; }
    .va-head{ min-height:var(--header-h); display:grid; grid-template-columns:1fr auto; align-items:center; padding:0 16px;
      background:linear-gradient(90deg,var(--panel-bg) 0%,color-mix(in oklab,var(--panel-bg) 97%, white 3%) 50%,var(--panel-bg) 100%);
      border-bottom:1px solid rgba(255,255,255,.08); color:var(--text); }
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

  // integrations
  gsAuthed?: boolean;
  gsEmail?: string;
  gsSheets?: Array<{ id: string; name: string }>;
  gsSelected?: string[];              // up to 50 spreadsheet IDs
  gsTabs?: Record<string,string>;     // per-spreadsheet chosen tab name
};

/* ─────────── prompt-engine shims (fixed) ─────────── */
const PROMPT_SKELETON =
`[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

const looksLikeFullPromptSafe = (raw: string) => {
  const t = (raw || '').toLowerCase();
  return ['[identity]', '[style]', '[response guidelines]', '[task & goals]', '[error handling', '[notes]'].some(h => t.includes(h));
};
const _esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const normalizeFullPromptSafe = (raw: string) => {
  const pull = (label: string) => {
    const rx = new RegExp(String.raw`$begin:math:display$${_esc(label)}$end:math:display$\s*([\s\S]*?)(?=\n\s*\[|$)`, 'i');
    const m = raw.match(rx);
    return m ? m[1].trim() : '';
  };
  const identity   = pull('Identity');
  const style      = pull('Style');
  const guidelines = pull('Response Guidelines');
  const tasks      = pull('Task & Goals');
  const errors     = pull('Error Handling / Fallback');
  const notes      = pull('Notes');

  return (
`[Identity]
${identity || '- You are a helpful, professional AI assistant for this business.'}

[Style]
${style || '- Clear, concise, friendly.'}

[Response Guidelines]
${guidelines || '- Ask one clarifying question when essential info is missing.'}

[Task & Goals]
${tasks || '- Guide users to their next best action (booking, purchase, or escalation).'}

[Error Handling / Fallback]
${errors || '- If unsure, ask a specific clarifying question first.'}` + (notes ? `

[Notes]
${notes}` : '')
  ).trim();
};
const applyInstructionsSafe = (base: string, raw: string) => {
  const text = (raw || '').trim();
  const industryMatch = text.match(/assistant\s+for\s+(?:a|an|the)?\s*([^.;:,]+?)(?:\s+(?:clinic|store|company|business))?(?:[.;:,]|$)/i);
  const industry = industryMatch ? industryMatch[1].trim() : '';
  const toneMatch = text.match(/tone\s*[:=]\s*([a-z,\s-]+)/i) || text.match(/\b(friendly|formal|casual|professional|empathetic|playful)\b/i);
  const tone = toneMatch ? (toneMatch as any)[1]?.trim?.() || (toneMatch as any)[0] : '';
  const tasksMatch = text.match(/tasks?\s*[:=]\s*([a-z0-9_,\-\s]+)/i);
  const tasksRaw = tasksMatch ? (tasksMatch as any)[1] : '';
  const tasks = tasksRaw ? tasksRaw.split(/[,\s]+/).filter(Boolean)
                         : (text.includes('booking') || text.includes('schedule')) ? ['lead_qualification','booking','faq'] : [];
  const channels = /voice|call|phone/i.test(text) && /chat|website|web/i.test(text) ? 'voice & chat'
                  : /voice|call|phone/i.test(text) ? 'voice'
                  : /chat|website|web/i.test(text) ? 'chat' : '';
  const merged =
`[Identity]
- You are a versatile AI assistant${industry ? ` for a ${industry}` : ''}. Represent the brand professionally and help users achieve their goals.

[Style]
- ${tone ? `${tone[0].toUpperCase()}${tone.slice(1)}` : 'Clear, concise, friendly'}. Prefer 2–4 short sentences per turn.
- Confirm understanding with a brief paraphrase when the request is complex.

[Response Guidelines]
- Ask a clarifying question when essential info is missing.
- Do not fabricate; say when you don’t know or need to check.
- Summarize next steps when the user has a multi-step task.

[Task & Goals]
- Qualify the user’s need, answer relevant FAQs, and guide to scheduling, purchase, or escalation.${channels ? ` (${channels})` : ''}
- Offer to collect structured info (name, contact, preferred time) when booking or follow-up is needed.${tasks.length ? ` Focus on: ${tasks.join(', ')}.` : ''}

[Error Handling / Fallback]
- If uncertain, ask a specific clarifying question.
- If a tool/endpoint fails, apologize briefly and offer an alternative or human handoff.`;
  return { merged, summary: `Applied ${industry ? `industry=${industry}; ` : ''}${tone ? `tone=${tone}; ` : ''}${tasks.length ? `tasks=${tasks.join(',')}; ` : ''}`.trim() || 'Updated.' };
};
const looksLikeFullPromptRT = (raw: string) =>
  isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : looksLikeFullPromptSafe(raw);
const normalizeFullPromptRT = (raw: string) =>
  isFn(_normalizeFullPrompt) ? String(_normalizeFullPrompt(raw) || '') : normalizeFullPromptSafe(raw);
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
`).trim() + '\n\n' + `# This is a blank template with minimal defaults.…\n`,
  ttsProvider: 'openai',
  voiceName: 'Alloy (American)',
  apiKeyId: '',
  asrProvider: 'deepgram',
  asrModel: 'Nova 2',
  denoise: false,
  numerals: false,
  language: 'English',
  gsAuthed: false,
  gsEmail: '',
  gsSheets: [],
  gsSelected: [],
  gsTabs: {}
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

/* ─────────── simple atoms ─────────── */
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

/* ─────────── Styled select (single) ─────────── */
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
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[14px] text-sm outline-none transition"
        style={{
          background:'var(--vs-input-bg, #101314)',
          border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))',
          boxShadow:'var(--vs-input-shadow, none)',
          color:'var(--text)'
        }}
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
          className="fixed z-[100020] p-3 va-portal"
          style={{
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'var(--vs-menu-bg, #101314)',
            border:'1px solid var(--vs-menu-border, rgba(255,255,255,.16))',
            borderRadius:20,
            boxShadow:'0 28px 70px rgba(0,0,0,.60), 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
            style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', color:'var(--text)' }}
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
                disabled={!!o.disabled}
                onClick={()=>{ if (o.disabled) return; onChange(o.value); }}
                className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
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
                <span className="truncate">{o.label}</span>
                {onPreview ? (
                  <button
                    type="button"
                    onClick={async (e)=>{ e.stopPropagation(); await onPreview(o.value); }}
                    className="w-7 h-7 rounded-full grid place-items-center"
                    style={{ border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', background:'var(--vs-input-bg, #101314)' }}
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
      ) : null}
    </div>
  );
}

/* ─────────── Expandable Section ─────────── */
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
      className="rounded-[12px] px-3 py-3 text-sm"
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

  const [showCall, setShowCall] = useState(false);

  // Prompt generate overlay & review
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState('');
  const [genPhase, setGenPhase] = useState<'idle'|'editing'|'review'>('idle');
  const basePromptRef = useRef<string>('');
  const [proposedPrompt, setProposedPrompt] = useState('');
  const [changesSummary, setChangesSummary] = useState('');

  // Sheets overlay state
  const [showSheets, setShowSheets] = useState(false);
  const [sheetStep, setSheetStep] = useState<1|2|3>(1);
  const [gsLoading, setGsLoading] = useState(false);
  const [gsErr, setGsErr] = useState('');

  // voice preview + TTS
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

  useEffect(() => {
    (async () => {
      try {
        const storage = await scopedStorage();
        await storage.ensureOwnerGuard();

        const v1 = await storage.getJSON<ApiKey[]>('apiKeys.v1', []);
        const legacy = await storage.getJSON<ApiKey[]>('apiKeys', []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ''), name: String(k?.name || ''), key: String(k?.key || '') }))
          .filter((k) => k.id && k.name);

        setApiKeys(cleaned);

        const globalSelected = await storage.getJSON<string>('apiKeys.selectedId', '');
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || '');

        if (chosen && chosen !== data.apiKeyId) {
          setData(prev => ({ ...prev, apiKeyId: chosen }));
          await storage.setJSON('apiKeys.selectedId', chosen);
        }

        // restore gs state
        const gsAuthed = await storage.getJSON<boolean>('va:gs:authed', false);
        const gsEmail  = await storage.getJSON<string>('va:gs:email', '');
        const gsSheets = await storage.getJSON<Array<{id:string; name:string}>>('va:gs:sheets', []);
        const gsSelected = await storage.getJSON<string[]>('va:gs:selected', []);
        const gsTabs = await storage.getJSON<Record<string,string>>('va:gs:tabs', {});
        setData(prev => ({ ...prev, gsAuthed, gsEmail, gsSheets, gsSelected, gsTabs }));
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

  /* ─────────── REALTIME CALL LAUNCH ─────────── */
  const openCall = () => {
    const key = apiKeys.find(k => k.id === data.apiKeyId)?.key || '';
    if (!key) {
      setToastKind('error');
      setToast('Select an OpenAI API key first.');
      setTimeout(()=>setToast(''), 2200);
      return;
    }
    setShowCall(true);
  };

  /* Prompt generator actions */
  const inInlineReview = genPhase === 'review' && !showGenerate;
  function openGenerator(){
    setComposerText(''); setProposedPrompt(''); setChangesSummary('');
    setGenPhase('editing'); setShowGenerate(true);
  }
  function generateFromComposer() {
    const raw = safeTrim(composerText);
    if (!raw) return;
    try {
      const base = nonEmpty(data.systemPrompt) ? data.systemPrompt : DEFAULT_PROMPT_RT;
      (basePromptRef as any).current = base;
      let merged = '';
      let summary = '';
      if (looksLikeFullPromptRT(raw)) {
        const norm = normalizeFullPromptRT(raw);
        merged = nonEmpty(norm) ? norm : base;
        summary = 'Replaced prompt (manual paste).';
      } else {
        const out = applyInstructionsRT(base, raw) || {};
        merged = nonEmpty(out.merged) ? out.merged : base;
        summary = nonEmpty(out.summary) ? out.summary : 'Updated.';
      }
      merged = merged.replace(/^\s*#\s*This is a blank template[\s\S]*?$/im, '').trim() + '\n';
      setShowGenerate(false);
      setProposedPrompt(merged);
      setChangesSummary(summary);
      setGenPhase('review');
    } catch {
      setToastKind('error');
      setToast('Generate failed — try simpler wording.');
      setTimeout(()=>setToast(''), 2200);
    }
  }
  function acceptGenerated(){
    const base = String(basePromptRef.current || '');
    pushVersion(activeId || 'default', { type:'prompt', before: base, after: proposedPrompt, summary: changesSummary });
    setData(prev => ({ ...prev, systemPrompt: proposedPrompt }));
    setProposedPrompt(''); setChangesSummary(''); setGenPhase('idle');
    setToastKind('info'); setToast('Prompt updated'); setTimeout(()=>setToast(''), 1400);
  }
  function discardGenerated(){ setProposedPrompt(''); setChangesSummary(''); setGenPhase('idle'); }

  /* ─────────── Google Sheets overlay logic ─────────── */
  async function rememberGsState(next: Partial<AgentData>) {
    try {
      const storage = await scopedStorage(); await storage.ensureOwnerGuard();
      if (next.gsAuthed !== undefined) await storage.setJSON('va:gs:authed', next.gsAuthed);
      if (next.gsEmail !== undefined) await storage.setJSON('va:gs:email', next.gsEmail);
      if (next.gsSheets !== undefined) await storage.setJSON('va:gs:sheets', next.gsSheets);
      if (next.gsSelected !== undefined) await storage.setJSON('va:gs:selected', next.gsSelected);
      if (next.gsTabs !== undefined) await storage.setJSON('va:gs:tabs', next.gsTabs);
    } catch {}
  }

  function startGoogleAuth(){
    setGsErr('');
    const w = 520, h = 640;
    const y = window.top!.outerHeight / 2 + window.top!.screenY - ( h / 2);
    const x = window.top!.outerWidth  / 2 + window.top!.screenX - ( w / 2);
    const pop = window.open(`/api/connectors/sheets?action=auth_begin`, 'gsheets', `width=${w},height=${h},left=${x},top=${y}`);
    if (!pop) { setGsErr('Popup blocked — allow popups for this site.'); return; }

    const onMsg = (ev: MessageEvent) => {
      if (!ev?.data || typeof ev.data !== 'object') return;
      if (ev.data.type === 'gsheets:authed') {
        window.removeEventListener('message', onMsg);
        setData(prev => ({ ...prev, gsAuthed: true, gsEmail: ev.data.email || '' }));
        rememberGsState({ gsAuthed: true, gsEmail: ev.data.email || '' });
        loadSpreadsheets();
        setSheetStep(2);
      }
    };
    window.addEventListener('message', onMsg);
  }

  async function loadSpreadsheets(){
    setGsLoading(true); setGsErr('');
    try{
      const r = await fetch('/api/connectors/sheets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'list_spreadsheets' })});
      const j = await r.json();
      if (!r.ok || !Array.isArray(j?.items)) throw new Error(j?.error || 'Failed to list spreadsheets');
      setData(prev => ({ ...prev, gsSheets: j.items }));
      rememberGsState({ gsSheets: j.items });
    } catch(e:any){
      setGsErr(e?.message || 'Failed to list spreadsheets');
    } finally { setGsLoading(false); }
  }

  async function loadTabsFor(spreadsheetId: string){
    try{
      const r = await fetch('/api/connectors/sheets', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'list_tabs', spreadsheetId })});
      const j = await r.json();
      if (!r.ok || !Array.isArray(j?.tabs)) throw new Error(j?.error || 'Failed to list tabs');
      // set first tab if none chosen
      setData(prev => {
        const nextTabs = { ...(prev.gsTabs||{}) };
        if (!nextTabs[spreadsheetId] && j.tabs[0]) nextTabs[spreadsheetId] = j.tabs[0];
        return { ...prev, gsTabs: nextTabs };
      });
    } catch {/* ignore */}
  }

  function toggleSpreadsheet(id: string){
    setData(prev => {
      const sel = new Set(prev.gsSelected || []);
      if (sel.has(id)) sel.delete(id); else if (sel.size < 50) sel.add(id);
      const next = { ...prev, gsSelected: Array.from(sel) };
      rememberGsState({ gsSelected: next.gsSelected });
      if (sel.has(id)) loadTabsFor(id);
      return next;
    });
  }

  async function setTab(spreadsheetId: string, tab: string){
    setData(prev => {
      const next = { ...prev, gsTabs: { ...(prev.gsTabs||{}), [spreadsheetId]: tab } };
      rememberGsState({ gsTabs: next.gsTabs });
      return next;
    });
  }

  async function testAvailability(){
    setGsLoading(true); setGsErr('');
    try{
      const r = await fetch('/api/connectors/sheets', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ action:'test', selected: data.gsSelected, tabs: data.gsTabs })});
      const j = await r.json();
      if (!r.ok || !j?.ok) throw new Error(j?.message || 'Test failed');
      setToastKind('info'); setToast('Sheets connected'); setTimeout(()=>setToast(''), 1500);
    } catch(e:any){
      setGsErr(e?.message || 'Could not verify connection');
    } finally { setGsLoading(false); }
  }

  async function saveSheetsAndClose(){
    await rememberGsState({ gsSelected: data.gsSelected, gsTabs: data.gsTabs });
    setShowSheets(false);
  }

  /* ─────────── UI ─────────── */
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
            <button onClick={doSave} disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)' }}>
              {saving ? 'Saving…' : 'Save'}
            </button>

            <button onClick={doPublish} disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)', boxShadow:'var(--input-shadow)' }}>
              <Rocket className="w-4 h-4" /> {publishing ? 'Publishing…' : 'Publish'}
            </button>

            <button onClick={openCall}
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
              style={{
                background: toastKind === 'error' ? 'rgba(239,68,68,.12)' : 'rgba(89,217,179,.10)',
                boxShadow: toastKind === 'error' ? '0 0 0 1px rgba(239,68,68,.25) inset' : '0 0 0 1px rgba(89,217,179,.16) inset'
              }}>
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* quick stats */}
          <div className="grid gap-[12px] md:grid-cols-2 mb-[12px]">
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}><div className="text-xs" style={{ color:'var(--text-muted)' }}>Cost</div><div /></div>
              <div className="p-[var(--s-4)]"><div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~$0.1/min</div></div>
            </div>
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}><div className="text-xs" style={{ color:'var(--text-muted)' }}>Latency</div><div /></div>
              <div className="p-[var(--s-4)]"><div className="font-semibold" style={{ fontSize:'var(--fz-sub)' }}>~1050 ms</div></div>
            </div>
          </div>

          {/* Model */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the model, assistant name, and first message."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              <div>
                <div className="mb-[var(--s-2)] text-[12.5px]">Assistant Name</div>
                <input
                  value={data.name}
                  onChange={(e)=>setField('name')(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[10px] px-3"
                  style={{ height:'var(--control-h)', background:'var(--input-bg)', border:'1px solid var(--input-border)' }}
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
                <StyledSelect value={data.model} onChange={setField('model')} options={modelOptsFor(data.provider)}/>
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
                      style={{ height:36, padding:'0 12px', background:CTA, color:'#fff', border:'1px solid rgba(255,255,255,.08)' }}
                      onClick={openGenerator}
                    >
                      <Wand2 className="w-4 h-4" /> Generate
                    </button>
                  </div>
                </div>

                <div style={{ position:'relative' }}>
                  {!inInlineReview ? (
                    <textarea
                      className="w-full bg-transparent outline-none rounded-[12px] px-3 py-[12px]"
                      style={{ minHeight: 360, background:'var(--input-bg)', border:'1px solid var(--input-border)' }}
                      value={data.systemPrompt}
                      onChange={(e)=> setField('systemPrompt')(e.target.value)}
                    />
                  ) : (
                    <div className="rounded-[12px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)', padding:'12px' }}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm" style={{ color:'var(--text-muted)' }}>{changesSummary || 'Review changes'}</div>
                        <div className="flex items-center gap-2">
                          <button onClick={discardGenerated} className="h-9 px-3 rounded-[10px]"
                                  style={{ background:'transparent', border:'1px solid var(--input-border)' }}>Discard</button>
                          <button onClick={acceptGenerated} className="h-9 px-3 rounded-[10px] inline-flex items-center gap-2"
                                  style={{ background:CTA, color:'#0a0f0d', fontWeight:600 }}>
                            <Check className="w-4 h-4" /> Accept
                          </button>
                        </div>
                      </div>
                      <DiffInline base={basePromptRef.current} next={proposedPrompt}/>
                    </div>
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
                    try { const storage = await scopedStorage(); await storage.ensureOwnerGuard(); await storage.setJSON('apiKeys.selectedId', val); } catch {}
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
                  options={[
                    { value: 'Alloy (American)', label: 'Alloy (American)' },
                    { value: 'Verse (American)', label: 'Verse (American)' },
                    { value: 'Coral (British)', label: 'Coral (British)' },
                    { value: 'Amber (Australian)', label: 'Amber (Australian)' },
                  ]}
                  placeholder="— Choose —"
                  menuTop={
                    <div className="flex items-center justify-between px-3 py-2 rounded-[10px]"
                         style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))' }}
                    >
                      <div className="text-xs" style={{ color:'var(--text-muted)' }}>Preview</div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={()=>speakPreview(`This is ${data.voiceName || 'the selected'} voice preview.`)}
                                className="w-8 h-8 rounded-full grid place-items-center" style={{ background: CTA, color:'#0a0f0d' }}>
                          <Play className="w-4 h-4" />
                        </button>
                        <button type="button" onClick={stopPreview}
                                className="w-8 h-8 rounded-full grid place-items-center border"
                                style={{ background: 'var(--panel-bg)', borderColor:'var(--input-border)' }}>
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
            icon={<Mic className="w-4 h-4" style={{ color: CTA }} />}
            desc="Transcription settings"
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
                <span className="text-sm">Background Denoising</span>
                <Toggle checked={data.denoise} onChange={setField('denoise')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-[10px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                <span className="text-sm">Use Numerals</span>
                <Toggle checked={data.numerals} onChange={setField('numerals')} />
              </div>
            </div>
          </Section>

          {/* Integrations — Google Sheets */}
          <Section
            title="Integrations"
            icon={<Database className="w-4 h-4" style={{ color: CTA }} />}
            desc="Connect data sources the agent can read/write."
          >
            <div className="p-3 rounded-[12px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Google Sheets — Appointments</div>
                  <div className="text-xs truncate" style={{ color:'var(--text-muted)' }}>
                    {data.gsAuthed ? (data.gsEmail ? `Connected as ${data.gsEmail}` : 'Connected') : 'Not connected'}
                    {data.gsSelected?.length ? ` • ${data.gsSelected.length} selected` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=>{ setShowSheets(true); setSheetStep(data.gsAuthed ? 2 : 1); }}
                    className="h-[36px] px-3 rounded-[10px] inline-flex items-center gap-2"
                    style={{ background:CTA, color:'#0a0f0d', fontWeight:600 }}
                  >
                    <Link2 className="w-4 h-4" /> {data.gsAuthed ? 'Manage' : 'Connect'}
                  </button>
                </div>
              </div>

              <div className="mt-3 text-xs" style={{ color:'var(--text-muted)' }}>
                Expected columns (any order): <code>Name</code>, <code>Phone</code>, <code>Email</code>,
                <code> Date</code>, <code>Time</code>, <code>Notes</code>, <code>Status</code>.
                The assistant will check availability across the selected sheets/tabs and append confirmed bookings.
              </div>
            </div>
          </Section>
        </div>
      </div>

      {/* Generate overlay */}
      {showGenerate && IS_CLIENT ? createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }} onClick={()=> setShowGenerate(false)} />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: Z_MODAL }}>
            <div className="w-full max-w-[640px] rounded-[12px] overflow-hidden" style={{
              background: 'var(--panel)', color: 'var(--text)', border: `1px solid ${GREEN_LINE}`, maxHeight: '86vh',
              boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)'
            }} onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4" style={{
                background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
                borderBottom:`1px solid ${GREEN_LINE}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--green-weak)' }}>
                    <span style={{ color: CTA }}><Wand2 className="w-5 h-5" /></span>
                  </div>
                  <div className="text-lg font-semibold">Generate Prompt</div>
                </div>
                <button onClick={()=> setShowGenerate(false)} className="w-8 h-8 rounded-[8px] grid place-items-center"
                        style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}` }} aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-5 space-y-3">
                <div className="text-xs" style={{ color:'var(--text-muted)' }}>
                  Tip: “assistant for a dental clinic; tone friendly; tasks=booking,faq; channels=voice &amp; chat”.
                </div>
                <div className="rounded-[10px]" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                  <textarea value={composerText} onChange={(e)=>setComposerText(e.target.value)}
                    className="w-full bg-transparent outline-none rounded-[10px] px-3 py-2"
                    placeholder="Describe your business and how the assistant should behave…"
                    style={{ minHeight: 160, maxHeight: '40vh', color:'var(--text)', resize:'vertical' }} />
                </div>
              </div>

              <div className="px-6 pb-6 flex gap-3">
                <button onClick={()=> setShowGenerate(false)} className="w-full h-[44px] rounded-[10px]"
                        style={{ background:'var(--panel)', border:'1px solid var(--input-border)' }}>
                  Cancel
                </button>
                <button onClick={generateFromComposer} disabled={!composerText.trim()}
                        className="w-full h-[44px] rounded-[10px] font-semibold inline-flex items-center justify-center gap-2"
                        style={{ background:CTA, color:'#0a0f0d', opacity: (!composerText.trim() ? .6 : 1) }}>
                  <Wand2 className="w-4 h-4" /> Generate
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}

      {/* Google Sheets overlay (STEP 1/2/3) */}
      {showSheets && IS_CLIENT ? createPortal(
        <>
          <div className="fixed inset-0" style={{ zIndex: Z_OVERLAY, background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }} onClick={()=> setShowSheets(false)} />
          <div className="fixed inset-0 grid place-items-center px-4" style={{ zIndex: Z_MODAL }}>
            <div className="w-full max-w-[760px] rounded-[12px] overflow-hidden" style={{
              background:'var(--panel)', color:'var(--text)', border:`1px solid ${GREEN_LINE}`, maxHeight:'86vh',
              boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)'
            }} onClick={(e)=>e.stopPropagation()}>
              <div className="flex items-center justify-between px-6 py-4" style={{
                background:`linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)`,
                borderBottom:`1px solid ${GREEN_LINE}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'var(--green-weak)' }}>
                    <span style={{ color: CTA }}><Database className="w-5 h-5" /></span>
                  </div>
                  <div className="text-lg font-semibold">Google Sheets</div>
                </div>
                <button onClick={()=> setShowSheets(false)} className="w-8 h-8 rounded-[8px] grid place-items-center"
                        style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}` }} aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* stepper */}
              <div className="px-6 pt-4 pb-2 flex items-center gap-3 text-xs" style={{ color:'var(--text-muted)' }}>
                <span className={`px-2 py-1 rounded ${sheetStep===1?'bg-[rgba(89,217,179,.12)]':''}`}>1. Sign in</span>
                <ChevronRight className="w-3 h-3" />
                <span className={`px-2 py-1 rounded ${sheetStep===2?'bg-[rgba(89,217,179,.12)]':''}`}>2. Choose spreadsheets</span>
                <ChevronRight className="w-3 h-3" />
                <span className={`px-2 py-1 rounded ${sheetStep===3?'bg-[rgba(89,217,179,.12)]':''}`}>3. Pick tabs & test</span>
              </div>

              <div className="px-6 py-4" style={{ maxHeight:'60vh', overflow:'auto' }}>
                {/* STEP 1 */}
                {sheetStep===1 && (
                  <div className="space-y-4">
                    <div className="text-sm" style={{ color:'var(--text-muted)' }}>
                      Connect your Google account so we can list your spreadsheets and allow the assistant to read/write appointments.
                    </div>
                    <button onClick={startGoogleAuth}
                            className="h-[44px] px-4 rounded-[10px] inline-flex items-center gap-2"
                            style={{ background:'#1a73e8', color:'#fff', fontWeight:600 }}>
                      <UserRound className="w-4 h-4" /> Sign in with Google
                    </button>
                    {data.gsAuthed && (
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
                           style={{ background:'rgba(89,217,179,.10)', boxShadow:'0 0 0 1px rgba(89,217,179,.16) inset' }}>
                        <Check className="w-4 h-4" /> Connected as {data.gsEmail || 'your account'}
                      </div>
                    )}
                    {gsErr && <div className="text-sm" style={{ color:'#ef4444' }}>{gsErr}</div>}
                  </div>
                )}

                {/* STEP 2 */}
                {sheetStep===2 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm" style={{ color:'var(--text-muted)' }}>
                        Select up to <b>50</b> spreadsheets. Search to filter. We’ll check all for availability.
                      </div>
                      <button onClick={loadSpreadsheets}
                              className="h-[36px] px-3 rounded-[10px] inline-flex items-center gap-2"
                              style={{ background:'transparent', border:'1px solid var(--input-border)' }}>
                        {gsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Loader2 className="w-4 h-4" />} Refresh
                      </button>
                    </div>

                    <div className="rounded-[12px] p-3" style={{ background:'var(--input-bg)', border:'1px solid var(--input-border)' }}>
                      <input
                        placeholder="Search spreadsheets…"
                        onChange={(e)=>{
                          const q = e.target.value.toLowerCase();
                          const list = document.querySelectorAll<HTMLDivElement>('[data-sheet-name]');
                          list.forEach(el => {
                            const name = (el.dataset.sheetName || '').toLowerCase();
                            el.style.display = name.includes(q) ? '' : 'none';
                          });
                        }}
                        className="w-full bg-transparent outline-none rounded-[10px] px-3 mb-3"
                        style={{ height:40, border:'1px solid var(--input-border)' }}
                      />
                      <div className="grid md:grid-cols-2 gap-2">
                        {(data.gsSheets||[]).map(s => {
                          const checked = (data.gsSelected||[]).includes(s.id);
                          return (
                            <div key={s.id} data-sheet-name={s.name}
                                 className="flex items-center justify-between px-3 py-2 rounded-[10px]"
                                 style={{ border:'1px solid var(--input-border)', background: checked ? 'rgba(89,217,179,.10)' : 'transparent' }}>
                              <div className="truncate">{s.name}</div>
                              <div className="flex items-center gap-2">
                                <input type="checkbox" checked={checked} onChange={()=>toggleSpreadsheet(s.id)} />
                                <a href={`https://docs.google.com/spreadsheets/d/${s.id}`} target="_blank" rel="noreferrer"
                                   className="text-xs underline">Open</a>
                              </div>
                            </div>
                          );
                        })}
                        {!data.gsSheets?.length && (
                          <div className="text-sm" style={{ color:'var(--text-muted)' }}>
                            {gsLoading ? 'Loading…' : 'No spreadsheets found or not loaded yet.'}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 text-xs" style={{ color:'var(--text-muted)' }}>
                        Selected: {data.gsSelected?.length || 0} / 50
                      </div>
                    </div>
                    {gsErr && <div className="text-sm" style={{ color:'#ef4444' }}>{gsErr}</div>}
                  </div>
                )}

                {/* STEP 3 */}
                {sheetStep===3 && (
                  <div className="space-y-4">
                    <div className="text-sm" style={{ color:'var(--text-muted)' }}>
                      For each selected spreadsheet, choose the worksheet (tab) where appointments live.
                    </div>
                    <div className="space-y-2">
                      {(data.gsSelected||[]).map(id => {
                        const sheet = (data.gsSheets||[]).find(s=>s.id===id);
                        return (
                          <div key={id} className="p-3 rounded-[10px]" style={{ border:'1px solid var(--input-border)' }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="font-medium text-sm truncate">{sheet?.name || id}</div>
                              <a href={`https://docs.google.com/spreadsheets/d/${id}`} target="_blank" rel="noreferrer"
                                 className="text-xs underline">Open</a>
                            </div>
                            <button
                              onClick={()=>loadTabsFor(id)}
                              className="h-[32px] px-3 rounded-[8px] inline-flex items-center gap-2"
                              style={{ background:'transparent', border:'1px solid var(--input-border)' }}
                            >
                              Load tabs
                            </button>
                            <input
                              placeholder="Type tab name (e.g., Appointments)…"
                              value={data.gsTabs?.[id] || ''}
                              onChange={(e)=>setTab(id, e.target.value)}
                              className="w-full bg-transparent outline-none rounded-[8px] px-3 mt-2"
                              style={{ height:40, border:'1px solid var(--input-border)' }}
                            />
                            <div className="mt-1 text-xs" style={{ color:'var(--text-muted)' }}>
                              Tip: after “Load tabs”, start typing to autocomplete.
                            </div>
                          </div>
                        );
                      })}
                      {!data.gsSelected?.length && (
                        <div className="text-sm" style={{ color:'var(--text-muted)' }}>
                          No spreadsheets selected in step 2.
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button onClick={testAvailability}
                              className="h-[36px] px-3 rounded-[10px] inline-flex items-center gap-2"
                              style={{ background:'transparent', border:'1px solid var(--input-border)' }}>
                        {gsLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                        Test connection
                      </button>
                      {gsErr && <div className="text-sm" style={{ color:'#ef4444' }}>{gsErr}</div>}
                    </div>
                  </div>
                )}
              </div>

              {/* footer */}
              <div className="px-6 pb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {sheetStep>1 && (
                    <button onClick={()=>setSheetStep((s)=> (s-1) as any)}
                            className="h-[36px] px-3 rounded-[10px] inline-flex items-center gap-2"
                            style={{ background:'transparent', border:'1px solid var(--input-border)' }}>
                      <ChevronLeft className="w-4 h-4" /> Back
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {sheetStep<3 && (
                    <button onClick={()=>setSheetStep((s)=> (s+1) as any)}
                            disabled={sheetStep===1 && !data.gsAuthed}
                            className="h-[36px] px-3 rounded-[10px] inline-flex items-center gap-2"
                            style={{ background:CTA, color:'#0a0f0d', fontWeight:600, opacity:(sheetStep===1 && !data.gsAuthed)?0.6:1 }}>
                      Next <ChevronRight className="w-4 h-4" />
                    </button>
                  )}
                  {sheetStep===3 && (
                    <button onClick={saveSheetsAndClose}
                            className="h-[36px] px-3 rounded-[10px] inline-flex items-center gap-2"
                            style={{ background:CTA, color:'#0a0f0d', fontWeight:600 }}>
                      <Save className="w-4 h-4" /> Save & Close
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>,
        document.body
      ) : null}

      {/* Voice/Call panel */}
      {IS_CLIENT ? createPortal(
        <>
          <div className={`fixed inset-0 ${showCall ? '' : 'pointer-events-none'}`}
               style={{ zIndex: 9996, background: showCall ? 'rgba(8,10,12,.78)' : 'transparent', opacity: showCall ? 1 : 0, transition: 'opacity .2s var(--ease)' }}
               onClick={()=> setShowCall(false)} />
          {showCall && (
            <WebCallButton
              model={'gpt-4o-realtime-preview'}
              systemPrompt={data.systemPrompt}
              voiceName={data.voiceName}
              assistantName={data.name || 'Assistant'}
              apiKey={apiKeys.find(k => k.id === data.apiKeyId)?.key || ''}
              onClose={()=> setShowCall(false)}
              // You can pass gs config to your call layer if supported:
              // gs={{ selected: data.gsSelected, tabs: data.gsTabs }}
            />
          )}
        </>,
        document.body
      ) : null}
    </section>
  );
}
