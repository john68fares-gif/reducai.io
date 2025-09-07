'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw
} from 'lucide-react';

/* =============================================================================
   THEME & SIZING
============================================================================= */
const SCOPE = 'va-scope';
const BRAND = '#10b981';           // brand green
const BRAND_HOVER = '#0fb07a';
const HEADER_H = 64;               // fallback; we read css var below
const ASSTBAR_W = 320;             // assistant sidebar width

/* =============================================================================
   ICONS
============================================================================= */
const OpenAIIcon = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" aria-hidden>
    <path fill="currentColor" d="M214.7 111.7c1.9-7.6 1.5-15.7-1.2-23.3-7.6-21.3-28.6-35.2-51.4-33.6-12.1-19.9-36.5-29-59-21.2-22.1 7.6-36.7 28.6-35.4 51.5-19.9 12.1-29 36.5-21.2 59 7.6 22.1 28.6 36.7 51.5 35.4 12.1 19.9 36.5 29 59 21.2 22.1-7.6 36.7-28.6 35.4-51.5 8.7-5.5 15.5-13.9 18.9-24.1ZM156 193.2c-9.2 3.2-19.2 2.7-28-1.4l17.4-30.1c4.8-0.7 9.2-3.8 11.6-8.4c1.2-2.4 1.8-5 1.8-7.6v-40l27 15.6v28.6c0 17.1-10.7 32.8-29.8 43.3Zm-76.9-8.7c-9.2-5.2-16-13.2-19.6-23c-3.6-10-3-20.4 1.2-29.7l27 15.6v16.1c0 4.9 2.6 9.4 6.7 11.9l31 17.9c-15.1 2.8-31-0.1-46.3-8.8ZM62.8 92.5c5.2-9.2 13.2-16 23-19.6c10-3.6 20.4-3 29.7 1.2l-15.6 27h-16.1c-4.9 0-9.4 2.6-11.9 6.7l-17.9 31c-2.8-15.1 0.1-31 8.8-46.3Zm118.4 5.1l-31-17.9c-3.6-2.1-7.8-2.5-11.7-1.4c-3.8 1.1-7 3.6-9.1 7.1l-17.5 30.3l-27-15.6l16.6-28.7c9.7-16.7 31.1-22.4 48-12.7c0.6 0.3 1.1 0.7 1.7 1l30 17.3c-0.7 7.4-0.8 13.4 0 20.6Z"/>
  </svg>
);

/* =============================================================================
   TYPES & LOCAL STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type Assistant = {
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  config: {
    model: {
      provider: Provider;
      model: ModelId;
      firstMessageMode: 'assistant_first' | 'user_first';
      firstMessage: string;
      systemPrompt: string;
    };
    voice: { provider: VoiceProvider; voiceId: string; voiceLabel: string };
    transcriber: { provider: 'deepgram'; model: 'nova-2' | 'nova-3'; language: 'en' | 'multi'; denoise: boolean; confidenceThreshold: number; numerals: boolean };
    tools: { enableEndCall: boolean; dialKeypad: boolean };
  };
};
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;

const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   PROMPT TEMPLATES
============================================================================= */
const BASE_PROMPT = `[Identity]
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.

[Style]
- Maintain a professional and approachable demeanor.
- Use clear and concise language, avoiding overly technical jargon.

[Response Guidelines]
- Keep responses short and focused on the user's immediate query.
- Verify user-provided information before proceeding with further steps.

[Task & Goals]
1. Greet the user warmly and inquire about how you can assist them today.
2. Listen carefully to the user's request or question.
3. Provide relevant and accurate information based on the user's needs.
<wait for user response>
4. If a query requires further action, guide the user through step-by-step instructions.

[Error Handling / Fallback]
- If a user's request is unclear or you encounter difficulty understanding, ask for clarification politely.
- If a task cannot be completed, inform the user empathetically and suggest alternative solutions or resources.`.trim();

const BLANK_PROMPT = `This is a blank template
[Identity]
You are an intelligent and responsive assistant designed to help users with minimal defaults.

[Style]
- Maintain a professional and approachable demeanor.
- Use clear and concise language.

[Response Guidelines]
- Keep responses short and focused on the user's immediate query.`.trim();

const withRefinements = (prompt: string, add: string) => {
  const cleaned = add.trim();
  if (!cleaned) return prompt;
  const block = `

[Refinements]
- ${cleaned.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
  return prompt + block;
};

/* =============================================================================
   SMALL UTILS
============================================================================= */
// very small word diff for highlights (no deps)
type DiffPart = { text: string; add?: boolean; del?: boolean };
function diffWords(oldText: string, newText: string): DiffPart[] {
  const a = oldText.split(/\s+/);
  const b = newText.split(/\s+/);
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const parts: DiffPart[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { parts.push({ text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { parts.push({ text: a[i], del: true }); i++; }
    else { parts.push({ text: b[j], add: true }); j++; }
  }
  while (i < m) parts.push({ text: a[i++], del: true });
  while (j < n) parts.push({ text: b[j++], add: true });
  // stitch back with spaces
  const merged: DiffPart[] = [];
  for (const p of parts) merged.push({ ...p, text: (merged.length ? ' ' : '') + p.text });
  return merged;
}

/* =============================================================================
   REUSABLE SELECT (portal)
============================================================================= */
type Item = { value: string; label: string; icon?: React.ReactNode };

function usePortalPos(open: boolean, ref: React.RefObject<HTMLElement>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const up = r.bottom + 320 > window.innerHeight;
    setRect({ top: up ? r.top : r.bottom, left: r.left, width: r.width, up });
  }, [open]);
  return rect;
}

function Select({ value, items, onChange, placeholder, leftIcon }: {
  value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement | null>(null);
  const portal = useRef<HTMLDivElement | null>(null);
  const rect = usePortalPos(open, btn);

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => {
      if (btn.current?.contains(e.target as Node) || portal.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [open]);

  const filtered = items.filter(i => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = items.find(i => i.value === value) || null;

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px]"
        style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>

      <AnimatePresence>
        {open && rect && (
          <motion.div
            ref={portal}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3 rounded-2xl"
            style={{
              top: rect.up ? rect.top - 8 : rect.top + 8,
              left: rect.left, width: rect.width, transform: rect.up ? 'translateY(-100%)' : 'none',
              background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)'
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-xl"
              style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 icon" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[12px] text-left"
                  style={{ color:'var(--text)' }}
                  onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(16,185,129,.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(16,185,129,.35)'; }}
                  onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}
                >
                  {it.icon}{it.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =============================================================================
   MAIN
============================================================================= */
export default function VoiceAgentSection() {
  /* ----- Assistants bootstrap ----- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (!list.length) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        folder: 'Health',
        updatedAt: Date.now(),
        config: {
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
          voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      setAssistants(list); setActiveId(list[0].id);
    }
  }, []);

  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId]);
  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list); setAssistants(list);
  };
  const addAssistant = () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt:Date.now(),
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BLANK_PROMPT },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  };
  const removeAssistant = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    if (activeId === id && list.length) setActiveId(list[0].id);
  };

  /* ----- Prompt edit / generate ----- */
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  const startGenerate = () => {
    if (!active) return;
    const next = withRefinements(active.config.model.systemPrompt, refineText);
    // typing simulation into preview
    setPreview('');
    setTyping(true);
    setRefineOpen(false);
    let i = 0;
    const step = () => {
      setPreview(next.slice(0, i));
      i += Math.max(1, Math.round(next.length / 120));
      if (i <= next.length) requestAnimationFrame(step);
      else setTyping(false);
    };
    requestAnimationFrame(step);
  };

  const acceptChanges = () => {
    if (!active || preview == null) return;
    updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: preview } } }));
    setPreview(null);
    setRefineText('');
  };
  const discardChanges = () => { setPreview(null); };

  // voice options
  const openaiVoices: Item[] = [{ value:'alloy', label:'Alloy (OpenAI)' }, { value:'ember', label:'Ember (OpenAI)' }];
  const elevenVoices: Item[] = [{ value:'rachel', label:'Rachel (ElevenLabs)' }, { value:'adam', label:'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }];

  if (!active) return null;
  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  /* ----- Layout vars ----- */
  const headerH = typeof window !== 'undefined'
    ? parseInt(getComputedStyle(document.documentElement).getPropertyValue('--header-h').trim() || `${HEADER_H}`, 10)
    : HEADER_H;

  return (
    <div className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Assistant rail — fixed; starts under header; flush with left sidebar */}
      <aside
        className="hidden lg:flex fixed z-30 flex-col"
        style={{
          top: `var(--header-h, ${headerH}px)`,
          left: 'var(--sidebar-w, 260px)',
          width: `var(--asstbar-w, ${ASSTBAR_W}px)`,
          height: `calc(100vh - var(--header-h, ${headerH}px))`,
          borderRight:'1px solid var(--va-border)',
          background:'var(--va-sidebar)',
          boxShadow:'var(--va-shadow-side)',
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" /> Assistants
          </div>
          <button
            onClick={addAssistant}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs primary"
            title="Create Assistant"
          >
            <Plus className="w-3.5 h-3.5" /> Create
          </button>
        </div>

        <div className="p-3 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
               style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
            <Search className="w-4 h-4 icon" />
            <input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search assistants" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
          </div>

          <div className="mt-3 text-xs font-semibold flex items-center gap-2" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5 icon" /> Folders
          </div>
          <div className="mt-2">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
              <FolderOpen className="w-4 h-4 icon" /> All
            </button>
          </div>

          <div className="mt-4 space-y-2">
            {visible.map(a => (
              <button
                key={a.id}
                onClick={()=> setActiveId(a.id)}
                className="w-full text-left rounded-xl p-3 flex items-center justify-between card"
                style={{
                  background: a.id===activeId ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                  border: `1px solid ${a.id===activeId ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`
                }}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate flex items-center gap-2">
                    <Bot className="w-4 h-4 icon" /><span className="truncate">{a.name}</span>
                  </div>
                  <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                </div>
                {a.id===activeId ? <Check className="w-4 h-4 icon" /> : null}
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Editor canvas — pushed right by assistant rail */}
      <main
        className="w-full"
        style={{
          paddingLeft: `calc(var(--sidebar-w,260px) + var(--asstbar-w, ${ASSTBAR_W}px))`,
          paddingTop: `calc(var(--header-h, ${headerH}px) + 16px)`,
          paddingRight: '28px',
          paddingBottom: '40px'
        }}
      >
        {/* Top bar */}
        <div className="px-6 py-4 flex items-center justify-between rounded-xl"
             style={{ border:'1px solid var(--va-border)', background:'var(--va-topbar)', boxShadow:'var(--va-shadow-sm)' }}>
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 icon" />
            <input
              value={active.name}
              onChange={(e)=> updateActive(a => ({ ...a, name: e.target.value }))}
              className="text-[15px] font-semibold bg-transparent outline-none rounded-lg px-2 py-1"
              style={{ border:'1px solid var(--va-border)', background:'var(--va-chip)', color:'var(--text)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt).catch(()=>{})}
                    className="btn ghost"><Copy className="w-4 h-4" /> Copy Prompt</button>
            <button onClick={()=> removeAssistant(active.id)} className="btn ghost"><Trash2 className="w-4 h-4" /> Delete</button>
          </div>
        </div>

        {/* Sections */}
        <div className="max-w-[1500px] mx-auto px-2 py-6 grid grid-cols-12 gap-10">
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.model.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as Provider } } }))}
                  items={[{ value:'openai', label:'OpenAI', icon:<OpenAIIcon /> }]}
                  leftIcon={<OpenAIIcon />}
                />
              </Field>
              <Field label="Model">
                <Select
                  value={active.config.model.model}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, model: v as ModelId } } }))}
                  items={[
                    { value:'gpt-4o', label:'GPT-4o' },
                    { value:'gpt-4o-mini', label:'GPT-4o mini' },
                    { value:'gpt-4.1', label:'GPT-4.1' },
                    { value:'gpt-3.5-turbo', label:'GPT-3.5 Turbo' },
                  ]}
                />
              </Field>
              <Field label="First Message Mode">
                <Select
                  value={active.config.model.firstMessageMode}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessageMode: v as any } } }))}
                  items={[{ value:'assistant_first', label:'Assistant speaks first' }, { value:'user_first', label:'User speaks first' }]}
                />
              </Field>
              <Field label="First Message">
                <input
                  value={active.config.model.firstMessage}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } }))}
                  className="w-full rounded-xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
              </Field>
            </div>

            {/* System Prompt */}
            <div className="mt-6 relative">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn ghost"><RefreshCw className="w-4 h-4" /> Reset</button>

                  {/* Refinement trigger */}
                  {!preview && (
                    <button onClick={()=> setRefineOpen((v)=>!v)} className="btn primary">
                      Generate / Edit
                    </button>
                  )}
                </div>
              </div>

              {/* Prompt textarea or preview with diff */}
              {preview == null ? (
                <textarea
                  rows={18}
                  value={active.config.model.systemPrompt}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                  className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none mono"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)' }}
                />
              ) : (
                <div className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 mono"
                     style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)' }}>
                  {/* diff view */}
                  <DiffView oldText={active.config.model.systemPrompt} newText={preview} typing={typing} />
                </div>
              )}

              {/* Floating refine entry (like your screenshot) */}
              <AnimatePresence>
                {refineOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .98 }}
                    className="absolute right-2 -bottom-14 z-10 rounded-xl shadow-xl"
                    style={{ background:'var(--va-topbar)', border:'1px solid var(--va-border)' }}
                  >
                    <div className="p-3 flex items-center gap-2">
                      <input
                        value={refineText}
                        onChange={(e)=> setRefineText(e.target.value)}
                        placeholder="Add follow-ups or refinements…"
                        className="w-[420px] rounded-lg px-3 py-2 text-sm outline-none"
                        style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', color:'var(--text)' }}
                      />
                      <button className="btn ghost" onClick={()=> setRefineOpen(false)}>Discard Changes</button>
                      <button className="btn primary" onClick={startGenerate}>Accept Changes</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Accept / Discard preview */}
              <AnimatePresence>
                {preview !== null && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="mt-3 flex items-center gap-2"
                  >
                    <button className="btn ghost" onClick={discardChanges}>Discard Changes</button>
                    <button className="btn primary" onClick={acceptChanges} disabled={typing}>Apply Changes</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </Section>

          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={(v)=>{
                    const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
                    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
                  }}
                  items={[
                    { value:'openai', label:'OpenAI', icon:<OpenAIIcon/> },
                    { value:'elevenlabs', label:'ElevenLabs' },
                  ]}
                  leftIcon={<OpenAIIcon />}
                />
              </Field>
              <Field label="Voice">
                <Select
                  value={active.config.voice.voiceId}
                  onChange={(v)=>{
                    const list = active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices;
                    const found = list.find(x=>x.value===v);
                    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId:v, voiceLabel: found?.label || v } } }));
                  }}
                  items={active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices}
                />
              </Field>
            </div>

            <div className="mt-3">
              <button
                onClick={()=> { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your ElevenLabs importer.'); }}
                className="btn ghost"
              ><UploadCloud className="w-4 h-4" /> Import from ElevenLabs</button>
            </div>
          </Section>

          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.transcriber.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, provider: v as any } } }))}
                  items={[{ value:'deepgram', label:'Deepgram' }]}
                />
              </Field>
              <Field label="Model">
                <Select
                  value={active.config.transcriber.model}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, model: v as any } } }))}
                  items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]}
                />
              </Field>
              <Field label="Language">
                <Select
                  value={active.config.transcriber.language}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, language: v as any } } }))}
                  items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]}
                />
              </Field>
              <Field label="Confidence Threshold">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={active.config.transcriber.confidenceThreshold}
                    onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } } }))}
                    className="va-range w-full"
                  />
                  <span className="text-xs" style={{ color:'var(--text-muted)' }}>{active.config.transcriber.confidenceThreshold.toFixed(2)}</span>
                </div>
              </Field>
              <Field label="Denoise">
                <Select
                  value={String(active.config.transcriber.denoise)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, denoise: v==='true' } } }))}
                  items={[{ value:'false', label:'Off' }, { value:'true', label:'On' }]}
                />
              </Field>
              <Field label="Use Numerals">
                <Select
                  value={String(active.config.transcriber.numerals)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, numerals: v==='true' } } }))}
                  items={[{ value:'false', label:'No' }, { value:'true', label:'Yes' }]}
                />
              </Field>
            </div>
          </Section>

          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Enable End Call Function">
                <Select
                  value={String(active.config.tools.enableEndCall)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, tools:{ ...a.config.tools, enableEndCall: v==='true' } } }))}
                  items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]}
                />
              </Field>
              <Field label="Dial Keypad">
                <Select
                  value={String(active.config.tools.dialKeypad)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, tools:{ ...a.config.tools, dialKeypad: v==='true' } } }))}
                  items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]}
                />
              </Field>
            </div>
          </Section>
        </div>
      </main>

      {/* Styles (scoped) */}
      <style jsx global>{`
        .${SCOPE}{
          --accent:${BRAND};
          --asstbar-w:${ASSTBAR_W}px;
          --bg:#0b0c10;
          --text:#eef2f5;
          --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
          --va-card:#0f1315;
          --va-topbar:#0e1214;
          --va-sidebar:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
          --va-chip:rgba(255,255,255,.03);
          --va-border:rgba(255,255,255,.10);
          --va-input-bg:rgba(255,255,255,.03);
          --va-input-border:rgba(255,255,255,.14);
          --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06);
          --va-menu-bg:#101314;
          --va-menu-border:rgba(255,255,255,.16);
          --va-shadow:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.4);
          --va-shadow-lg:0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
          --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
          --va-shadow-side:8px 0 28px rgba(0,0,0,.42);
        }
        :root:not([data-theme="dark"]) .${SCOPE}{
          --bg:#f7f9fb;
          --text:#101316;
          --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
          --va-card:#ffffff;
          --va-topbar:#ffffff;
          --va-sidebar:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
          --va-chip:#ffffff;
          --va-border:rgba(0,0,0,.10);
          --va-input-bg:#ffffff;
          --va-input-border:rgba(0,0,0,.12);
          --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.85);
          --va-menu-bg:#ffffff;
          --va-menu-border:rgba(0,0,0,.10);
          --va-shadow:0 28px 70px rgba(0,0,0,.12), 0 12px 28px rgba(0,0,0,.08);
          --va-shadow-lg:0 42px 110px rgba(0,0,0,.16), 0 22px 54px rgba(0,0,0,.10);
          --va-shadow-sm:0 12px 26px rgba(0,0,0,.10);
          --va-shadow-side:8px 0 26px rgba(0,0,0,.08);
        }
        .${SCOPE} .icon{ color: var(--accent); }

        /* Buttons */
        .${SCOPE} .btn{
          display:inline-flex; align-items:center; gap:.5rem;
          padding:.55rem .9rem; border-radius:.6rem; font-size:.9rem;
          border:1px solid var(--va-border); box-shadow:var(--va-shadow-sm);
          background:var(--va-card); color:var(--text);
        }
        .${SCOPE} .btn.ghost:hover{ background:rgba(255,255,255,.05); }
        .${SCOPE} .btn.primary{
          background:${BRAND}; color:#fff; border-color:transparent;
          box-shadow:0 8px 24px rgba(16,185,129,.28);
        }
        .${SCOPE} .btn.primary:hover{ background:${BRAND_HOVER}; }
        .${SCOPE} .primary{ background:${BRAND}; color:#fff; border:1px solid transparent; box-shadow:0 8px 20px rgba(16,185,129,.28); }
        .${SCOPE} .primary:hover{ background:${BRAND_HOVER}; }

        .${SCOPE} .card{ box-shadow:var(--va-shadow-sm); }

        /* Thin green slider */
        .${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
        .${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
        .${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }

        /* Diff highlights */
        .${SCOPE} .diff-add{ background: rgba(16,185,129,.22); border-radius:.25rem; padding:0 .15rem; }
        .${SCOPE} .diff-del{ background: rgba(239,68,68,.22); border-radius:.25rem; padding:0 .15rem; text-decoration: line-through; }

        /* Monospace textarea look */
        .${SCOPE} .mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
      `}</style>
    </div>
  );
}

/* =============================================================================
   Atoms
============================================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}
function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="col-span-12 rounded-xl relative"
      style={{
        background:'var(--va-card)',
        border:'1px solid var(--va-border)',
        boxShadow:'var(--va-shadow)',
      }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
           style={{ background:'radial-gradient(circle, color-mix(in oklab, var(--accent) 16%, transparent) 0%, transparent 70%)', filter:'blur(38px)' }} />
      <button type="button" onClick={()=> setOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:.18 }} className="px-5 pb-5">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
   Diff view component (adds/removes highlighting)
============================================================================= */
function DiffView({ oldText, newText, typing }: { oldText: string; newText: string; typing: boolean }) {
  const parts = diffWords(oldText, newText);
  return (
    <div aria-live="polite">
      {parts.map((p, i) => (
        <span key={i} className={p.add ? 'diff-add' : p.del ? 'diff-del' : undefined}>{p.text}</span>
      ))}
      {typing && <span className="opacity-60">▌</span>}
    </div>
  );
}
