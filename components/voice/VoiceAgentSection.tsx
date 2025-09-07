'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles, Type,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal, Settings,
  RefreshCw, ArrowUpRight, PanelLeft, Bot, UploadCloud
} from 'lucide-react';

/* ============================================================================
   THEME — crisp, minimal, fewer greys; light/dark auto
============================================================================ */
const SCOPE = 'va-vapi-like';

const GREEN = '#59d9b3';
const GREEN_HOVER = '#54cfa9';

const Card: React.CSSProperties = {
  background: 'var(--va-card)',
  border: '1px solid var(--va-border)',
  borderRadius: 18,
  boxShadow: 'var(--va-shadow)',
};

/* ============================================================================
   TYPES & STORAGE
============================================================================ */
type Provider = 'openai';
type ModelId =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4.1'
  | 'gpt-3.5-turbo';

type VoiceProvider = 'openai' | 'elevenlabs';

type Assistant = {
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  config: VoiceAgentConfig;
};

type VoiceAgentConfig = {
  model: {
    provider: Provider;
    model: ModelId;
    firstMessageMode: 'assistant_first' | 'user_first';
    firstMessage: string;
    systemPrompt: string;
  };
  voice: {
    provider: VoiceProvider;
    voiceId: string;        // the id we’ll send to your TTS
    voiceLabel: string;     // human-readable
  };
  transcriber: {
    provider: 'deepgram';
    model: 'nova-2' | 'nova-3';
    language: 'en' | 'multi';
    denoise: boolean;
    confidenceThreshold: number; // 0..1
    numerals: boolean;
  };
  tools: {
    enableEndCall: boolean;
    dialKeypad: boolean;
  };
  advanced: {
    summaryPrompt: string;
    successEvalPrompt: string;
  };
};

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;

function readLS<T>(k: string): T | null {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; }
}
function writeLS<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* ============================================================================
   PROMPT BASE + APPOINTMENT ADDITIONS
============================================================================ */
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

const APPT = `# Appointment Scheduling Agent Prompt

## Identity & Purpose
You are Riley (voice assistant), a voice assistant for Wellness Partners, a multi-specialty health clinic.
Primary goal: Efficiently schedule, confirm, reschedule, or cancel appointments while informing patients.

## Voice & Persona
### Personality
- Friendly, organized, efficient
- warm yet professional
- clear and patient

### Speech Characteristics
- Use clear, concise language with natural contractions.
- Speak at a measured pace when confirming dates and times.
- Use light fillers only when needed: “Let me check that for you.”
- Pronounce provider names correctly.

## Conversation Flow
### Introduction
Start with: "Thank you for calling Wellness Partners, a multi-specialty health clinic. This is Riley, your scheduling assistant. How may I help you today?"

### Appointment Type Determination
1. Ask the appointment type.
2. Ask for provider preference or first available.
3. Ask if the caller is new or returning.
4. Briefly assess urgency (emergency → escalate immediately).

### Scheduling Process
1. Collect caller info (name, DOB, callback number).
2. Offer 2–3 time options that match their preference.
3. Confirm final selection exactly (day, date, time, provider).
4. Provide any preparation instructions (arrive early, bring ID/insurance).

### Confirmation & Wrap-up
- Summarize the booking exactly.
- Offer optional reminders (text/call).
- Close politely and check if anything else is needed.

## Capabilities & Scope
Handle routine scheduling questions; escalate clinical questions or emergencies to a human.

## Response Guidelines
Ask one question at a time; confirm names/dates/times explicitly; avoid medical advice; use concise answers; phonetic spell names when needed.

## Data to Collect
Full name, date of birth, callback number, appointment type, provider preference, urgency.

## Example Phrases
“Let me check availability.” · “I can offer Wednesday 2:30 PM or Friday 10:15 AM—what works?” · “To confirm: Wednesday, February 15th at 2:30 PM with Dr. Chen.”

## Language & Operational Settings
- Language: English.
- Ask one question at a time.
- If you need time, say: “I’m checking availability. One moment please.”

## Scenario Handling
- New patients: arrive 20 minutes early for forms; bring ID + insurance.
- Urgent requests: check same-day slots; true emergencies → route to nurse or nearest ER.
- Rescheduling: read back current appointment; offer alternatives; cancel old and confirm new.
- Insurance/payment: provide general coverage info; specifics → refer to insurer; copays at service time.`.trim();

function buildPrompt(refinement: string) {
  const wantsAppt = /\b(appoint|schedule|clinic|patient|provider|resched|urgent|dob|insurance)\b/i.test(refinement);
  const refinements = refinement.trim()
    ? `\n\n[Refinements]\n- ${refinement.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`
    : '';
  return BASE_PROMPT + (wantsAppt ? `\n\n${APPT}` : '') + refinements;
}

/* ============================================================================
   Logos (tiny inline SVGs so you don’t need assets)
============================================================================ */
const OpenAILogo = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" aria-hidden><circle cx="128" cy="128" r="120" fill="currentColor" opacity=".1"/><path fill="currentColor" d="M206 110c2-8 1-16-2-24-9-23-33-38-58-35-13-21-39-30-62-22-23 9-38 33-35 58-21 13-30 39-22 62 9 23 33 38 58 35 13 21 39 30 62 22 23-9 38-33 35-58 9-6 16-15 19-26Zm-52 76c-7 3-15 4-23 2l12-21c6-2 10-8 10-14v-35l19 11v31c0 11-7 21-18 26Zm-66-7c-7-3-13-8-17-15c-5-9-6-19-3-28l20 11v17c0 6 4 12 10 14l20 12c-9 2-19 1-28-2Zm-24-93c3-7 8-13 15-17c9-5 19-6 28-3l-11 20h-17c-6 0-12 4-14 10l-12 20c-2-9-1-19 2-28Zm121 12l-20-12l-15-8l-30-17l11-19c9 2 18 1 27-2 7 3 13 8 17 15 5 9 6 19 3 28Z"/></svg>
);

const ElevenLabsLogo = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" aria-hidden><rect width="256" height="256" rx="56" fill="currentColor" opacity=".1"/><path fill="currentColor" d="M88 64h80v24H112v24h48v24h-48v56H88z"/></svg>
);

/* ============================================================================
   Custom Select (portal) — theme aware
============================================================================ */
function usePortalPosition(open: boolean, btnRef: React.RefObject<HTMLElement>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const viewH = window.innerHeight;
    const openUp = r.bottom + 320 > viewH;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);
  return rect;
}

type Item = { value: string; label: string; icon?: React.ReactNode };

function StyledSelect({
  value, items, onChange, placeholder, leftIcon
}: {
  value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const rect = usePortalPosition(open, btnRef);
  const selected = items.find(i => i.value === value) || null;
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.trim().toLowerCase()));

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm"
        style={{
          background: 'var(--va-input-bg)', color: 'var(--text)',
          border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)'
        }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {selected
          ? <span className="flex items-center gap-2 truncate">{selected.icon}{selected.label}</span>
          : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 opacity-70" />
      </button>

      <AnimatePresence>
        {open && rect && (
          <motion.div
            ref={portalRef}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3"
            style={{
              top: rect.openUp ? rect.top - 8 : rect.top + 8,
              left: rect.left, width: rect.width,
              transform: rect.openUp ? 'translateY(-100%)' : 'none',
              background: 'var(--va-menu-bg)', border: '1px solid var(--va-menu-border)',
              borderRadius: 16, boxShadow: 'var(--va-shadow)'
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg"
              style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 opacity-70" />
              <input
                value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter…"
                className="w-full bg-transparent outline-none text-sm" style={{ color: 'var(--text)' }}
              />
            </div>

            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left"
                  style={{ color: 'var(--text)' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.10)';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.35)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                    (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                  }}
                >
                  {it.icon}{it.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-5 text-sm" style={{ color: 'var(--text-muted)' }}>No matches.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* ============================================================================
   Typing effect (prompt)
============================================================================ */
function useTypewriter(initial: string, speed = 6) {
  const [text, setText] = useState(initial);
  const [typing, setTyping] = useState(false);
  const run = (next: string) => {
    setTyping(true);
    setText('');
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      setText(next.slice(0, i));
      if (i >= next.length) { clearInterval(id); setTyping(false); }
    }, speed);
  };
  return { text, typing, run, setText };
}

/* ============================================================================
   Page
============================================================================ */
export default function VoiceAgentSection() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [query, setQuery] = useState('');

  // boot
  useEffect(() => {
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (list.length === 0) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        folder: 'Health',
        updatedAt: Date.now(),
        config: {
          model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT },
          voice: { provider: 'openai', voiceId: 'alloy', voiceLabel: 'Alloy (OpenAI)' },
          transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
          tools: { enableEndCall: true, dialKeypad: true },
          advanced: {
            summaryPrompt: 'You are an expert note-taker. Summarize the call in 2–3 sentences.',
            successEvalPrompt: 'Evaluate whether the call achieved its stated objectives.'
          }
        }
      };
      writeLS(LS_LIST, [seed]);
      writeLS(ak(seed.id), seed);
      setAssistants([seed]);
      setActiveId(seed.id);
    } else {
      setAssistants(list);
      setActiveId(list[0].id);
    }
  }, []);

  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(active.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(a => a.id === next.id ? { ...a, name: next.name, folder: next.folder, updatedAt: Date.now() } : a);
    writeLS(LS_LIST, list);
    setAssistants(list);
  };

  const addAssistant = () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name: 'New Assistant', updatedAt: Date.now(),
      config: active?.config || {
        model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT },
        voice: { provider: 'openai', voiceId: 'alloy', voiceLabel: 'Alloy (OpenAI)' },
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
        tools: { enableEndCall: true, dialKeypad: true },
        advanced: { summaryPrompt: 'Summarize the call in 2–3 sentences.', successEvalPrompt: 'Evaluate success.' }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a];
    writeLS(LS_LIST, list);
    setAssistants(list);
    setActiveId(id);
  };

  const removeAssistant = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list);
    setAssistants(list);
    if (activeId === id && list.length) setActiveId(list[0].id);
  };

  // Prompt typing
  const { text: typedPrompt, typing, run: runType, setText: setTypedText } = useTypewriter(active?.config.model.systemPrompt || BASE_PROMPT, 5);

  useEffect(() => { if (active) setTypedText(active.config.model.systemPrompt); }, [active?.id]); // sync when changing assistant

  // Modal for edits
  const [editOpen, setEditOpen] = useState(false);
  const [editText, setEditText] = useState('');

  const submitEdit = () => {
    if (!active) return;
    const next = buildPrompt(editText);
    runType(next);
    updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: next } } }));
    setEditOpen(false);
    setEditText('');
  };

  // Filtered assistants (search + folders)
  const folders = Array.from(new Set(assistants.map(a => a.folder).filter(Boolean))) as string[];
  const [openFolders, setOpenFolders] = useState<string[]>([]);
  const visible = assistants
    .filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  // Voice lists (sample; swap with your importer when ready)
  const openaiVoices: Item[] = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenLabsVoices: Item[] = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam', label: 'Adam (ElevenLabs)' },
    { value: 'bella', label: 'Bella (ElevenLabs)' },
  ];

  if (!active) return null;

  return (
    <div className={`${SCOPE} w-full`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex w-full">
        {/* ================== FIXED ASSISTANT SIDEBAR ================== */}
        <aside
          className="hidden lg:flex shrink-0 w-[280px] px-3 py-4 flex-col gap-3"
          style={{
            position: 'sticky', top: 0, height: '100vh',
            borderRight: '1px solid var(--va-border)', background: 'var(--va-sidebar)'
          }}
        >
          <div className="px-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <PanelLeft className="w-4 h-4" /> Assistants
            </div>
            <button
              onClick={addAssistant}
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs"
              style={{ background: GREEN, color: '#fff' }}
              onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background = GREEN_HOVER}
              onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background = GREEN}
            >
              <Plus className="w-3.5 h-3.5" /> Create
            </button>
          </div>

          {/* Search */}
          <div className="px-2">
            <div className="flex items-center gap-2 rounded-lg px-2 py-1.5"
              style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 opacity-70" />
              <input
                value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assistants"
                className="w-full bg-transparent outline-none text-sm" style={{ color: 'var(--text)' }}
              />
            </div>
          </div>

          {/* Folders */}
          <div className="px-2">
            <div className="flex items-center gap-2 text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              <Folder className="w-3.5 h-3.5" /> Folders
            </div>
            <div className="space-y-1">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5"
                onClick={() => setOpenFolders(s => s.includes('__all') ? s.filter(x => x!=='__all') : [...s,'__all'])}
              >
                {openFolders.includes('__all') ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                All
              </button>
              {folders.map(f => (
                <button
                  key={f}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5"
                  onClick={() => setOpenFolders(s => s.includes(f) ? s.filter(x => x!==f) : [...s,f])}
                >
                  {openFolders.includes(f) ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* Assistants list (bigger tiles) */}
          <div className="px-2 pt-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="space-y-2">
              {visible.map(a => (
                <button
                  key={a.id}
                  onClick={() => setActiveId(a.id)}
                  className="w-full text-left rounded-xl p-3 flex items-center justify-between"
                  style={{
                    background: a.id === activeId ? 'color-mix(in oklab, var(--brand) 12%, transparent)' : 'var(--va-card)',
                    border: `1px solid ${a.id === activeId ? 'color-mix(in oklab, var(--brand) 28%, var(--va-border))' : 'var(--va-border)'}`,
                    boxShadow: 'var(--va-shadow-sm)'
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <Bot className="w-4 h-4 opacity-80" /><span className="truncate">{a.name}</span>
                    </div>
                    <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                  </div>
                  {a.id === activeId ? <Check className="w-4 h-4" /> : null}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ================== EDITOR (WIDER) ================== */}
        <main className="flex-1 px-5 py-6">
          {/* Header bar */}
          <div className="max-w-[1280px] mx-auto mb-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 opacity-90" />
              <input
                value={active.name}
                onChange={(e)=> updateActive(a => ({ ...a, name: e.target.value }))}
                className="text-base font-semibold bg-transparent outline-none rounded-md px-2 py-1"
                style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt).catch(()=>{})}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}
              >
                <Copy className="w-4 h-4" /> Copy Prompt
              </button>
              <button
                onClick={() => removeAssistant(active.id)}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>

          <div className="max-w-[1280px] mx-auto grid grid-cols-12 gap-6">
            {/* ===== Model ===== */}
            <Section title="Model" icon={<FileText className="w-4 h-4 text-[var(--brand)]" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Provider">
                  <StyledSelect
                    value={active.config.model.provider}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, provider: v as Provider } } }))}
                    items={[
                      { value: 'openai', label: 'OpenAI', icon: <OpenAILogo /> },
                    ]}
                    leftIcon={<OpenAILogo />}
                  />
                </Field>
                <Field label="Model">
                  <StyledSelect
                    value={active.config.model.model}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, model: v as ModelId } } }))}
                    items={[
                      { value: 'gpt-4o', label: 'GPT-4o' },
                      { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
                      { value: 'gpt-4.1', label: 'GPT-4.1' },
                      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                    ]}
                  />
                </Field>

                <Field label="First Message Mode">
                  <StyledSelect
                    value={active.config.model.firstMessageMode}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessageMode: v as any } } }))}
                    items={[
                      { value: 'assistant_first', label: 'Assistant speaks first' },
                      { value: 'user_first', label: 'User speaks first' },
                    ]}
                  />
                </Field>
                <Field label="First Message">
                  <input
                    value={active.config.model.firstMessage}
                    onChange={(e)=> updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessage: e.target.value } } }))}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
                  />
                </Field>
              </div>

              {/* Prompt header actions */}
              <div className="mt-5 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Type className="w-4 h-4" /> System Prompt
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { runType(BASE_PROMPT); updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: BASE_PROMPT } } })); }}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ border:'1px solid var(--va-border)', background:'var(--va-card)' }}
                  ><RefreshCw className="w-4 h-4" /> Reset</button>

                  <button
                    onClick={() => setEditOpen(true)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ background: GREEN, color:'#fff' }}
                    onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background = GREEN_HOVER}
                    onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background = GREEN}
                  ><Sparkles className="w-4 h-4" /> Generate / Edit</button>

                  <button
                    onClick={() => {
                      // fire a custom event you can catch anywhere to run the prompt live
                      window.dispatchEvent(new CustomEvent('voiceagent:test', { detail: { assistantId: active.id, config: active.config } }));
                      alert('Hook “voiceagent:test” to your runner to start the agent with this prompt.');
                    }}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ border:'1px solid var(--va-border)', background:'var(--va-card)' }}
                  ><ArrowUpRight className="w-4 h-4" /> Test Prompt</button>
                </div>
              </div>

              {/* Prompt body with typewriter */}
              <div className="rounded-xl overflow-hidden" style={Card}>
                <div className="px-3 py-2 text-xs" style={{ borderBottom:'1px solid var(--va-border)', background:'var(--va-subtle)' }}>
                  {typing ? 'Typing…' : 'Ready'}
                </div>
                <div className="p-3">
                  <textarea
                    rows={18}
                    value={typedPrompt}
                    onChange={(e)=> {
                      setTypedText(e.target.value);
                      updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: e.target.value } } }));
                    }}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                    style={{
                      background:'var(--va-input-bg)', color:'var(--text)',
                      border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)',
                      fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                    }}
                  />
                </div>
              </div>
            </Section>

            {/* ===== Voice ===== */}
            <Section title="Voice" icon={<Mic2 className="w-4 h-4 text-[var(--brand)]" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Provider">
                  <StyledSelect
                    value={active.config.voice.provider}
                    onChange={(v)=> {
                      // default list on provider switch
                      const list = v === 'elevenlabs' ? elevenLabsVoices : openaiVoices;
                      updateActive(a => ({
                        ...a,
                        config: { ...a.config, voice: { provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } }
                      }));
                    }}
                    items={[
                      { value: 'openai', label: 'OpenAI', icon: <OpenAILogo /> },
                      { value: 'elevenlabs', label: 'ElevenLabs', icon: <ElevenLabsLogo /> },
                    ]}
                    leftIcon={active.config.voice.provider === 'openai' ? <OpenAILogo /> : <ElevenLabsLogo />}
                  />
                </Field>

                <Field label="Voice">
                  <StyledSelect
                    value={active.config.voice.voiceId}
                    onChange={(v)=> {
                      const list = active.config.voice.provider === 'elevenlabs' ? elevenLabsVoices : openaiVoices;
                      const found = list.find(x => x.value === v)!;
                      updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, voiceId: v, voiceLabel: found?.label || v } } }));
                    }}
                    items={(active.config.voice.provider === 'elevenlabs' ? elevenLabsVoices : openaiVoices)}
                  />
                </Field>
              </div>

              <div className="mt-3">
                <button
                  onClick={() => {
                    // Hook this to your import flow
                    window.dispatchEvent(new CustomEvent('voiceagent:import-11labs'));
                    alert('Hook “voiceagent:import-11labs” to your ElevenLabs importer.');
                  }}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                  style={{ border:'1px solid var(--va-border)', background:'var(--va-card)' }}
                >
                  <UploadCloud className="w-4 h-4" /> Import from ElevenLabs
                </button>
              </div>
            </Section>

            {/* ===== Transcriber ===== */}
            <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 text-[var(--brand)]" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Provider">
                  <StyledSelect
                    value={active.config.transcriber.provider}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, provider: v as any } } }))}
                    items={[{ value:'deepgram', label:'Deepgram' }]}
                  />
                </Field>
                <Field label="Model">
                  <StyledSelect
                    value={active.config.transcriber.model}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, model: v as any } } }))}
                    items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]}
                  />
                </Field>

                <Field label="Language">
                  <StyledSelect
                    value={active.config.transcriber.language}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, language: v as any } } }))}
                    items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]}
                  />
                </Field>

                <Field label="Confidence Threshold">
                  <div className="flex items-center gap-3">
                    <input
                      type="range" min={0} max={1} step={0.01}
                      value={active.config.transcriber.confidenceThreshold}
                      onChange={(e)=> updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } } }))}
                      className="va-range w-full"
                    />
                    <span className="text-xs" style={{ color:'var(--text-muted)' }}>
                      {active.config.transcriber.confidenceThreshold.toFixed(2)}
                    </span>
                  </div>
                </Field>

                <Field label="Denoise">
                  <StyledSelect
                    value={String(active.config.transcriber.denoise)}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, denoise: v==='true' } } }))}
                    items={[{ value:'false', label:'Off' }, { value:'true', label:'On' }]}
                  />
                </Field>
                <Field label="Use Numerals">
                  <StyledSelect
                    value={String(active.config.transcriber.numerals)}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, numerals: v==='true' } } }))}
                    items={[{ value:'false', label:'No' }, { value:'true', label:'Yes' }]}
                  />
                </Field>
              </div>
            </Section>

            {/* ===== Tools ===== */}
            <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 text-[var(--brand)]" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Enable End Call Function">
                  <StyledSelect
                    value={String(active.config.tools.enableEndCall)}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, enableEndCall: v==='true' } } }))}
                    items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]}
                  />
                </Field>
                <Field label="Dial Keypad">
                  <StyledSelect
                    value={String(active.config.tools.dialKeypad)}
                    onChange={(v)=> updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, dialKeypad: v==='true' } } }))}
                    items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]}
                  />
                </Field>
              </div>
            </Section>

            {/* ===== Advanced ===== */}
            <Section title="Advanced" icon={<Settings className="w-4 h-4 text-[var(--brand)]" />}>
              <Field label="Summary Prompt">
                <textarea
                  rows={4}
                  value={active.config.advanced.summaryPrompt}
                  onChange={(e)=> updateActive(a => ({ ...a, config: { ...a.config, advanced: { ...a.config.advanced, summaryPrompt: e.target.value } } }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
                />
              </Field>
              <div className="h-3" />
              <Field label="Success Evaluation Prompt">
                <textarea
                  rows={4}
                  value={active.config.advanced.successEvalPrompt}
                  onChange={(e)=> updateActive(a => ({ ...a, config: { ...a.config, advanced: { ...a.config.advanced, successEvalPrompt: e.target.value } } }))}
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
                />
              </Field>
            </Section>
          </div>
        </main>
      </div>

      {/* Edit / Generate modal */}
      <AnimatePresence>
        {editOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div
              initial={{ y: 10, opacity: 0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-xl" style={Card}
            >
              <div className="px-4 py-3" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Edit3 className="w-4 h-4" /> Edit Prompt</div>
              </div>
              <div className="p-4">
                <input
                  value={editText}
                  onChange={(e)=> setEditText(e.target.value)}
                  placeholder="Describe how you'd like to edit the prompt"
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button
                    onClick={()=> setEditOpen(false)}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ border:'1px solid var(--va-border)', background:'var(--va-card)' }}
                  >Cancel</button>
                  <button
                    onClick={submitEdit}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background:GREEN, color:'#fff' }}
                    onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background = GREEN_HOVER}
                    onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background = GREEN}
                  >Submit Edit <ArrowUpRight className="inline w-4 h-4 ml-1" /></button>
                </div>
                <div className="mt-2 text-xs" style={{ color:'var(--text-muted)' }}>
                  Tip: Mention “schedule / clinic / provider / urgent” to auto-add the appointment scheduling playbook.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scoped theme + range styling */}
      <style jsx global>{`
        .${SCOPE}{
          --brand: ${GREEN};
          --bg: #0b0c10;
          --text: #eef2f5;
          --text-muted: color-mix(in oklab, var(--text) 68%, transparent);

          --va-card: #0f1315;
          --va-subtle: #0d1113;
          --va-border: rgba(255,255,255,.10);
          --va-shadow: 0 24px 60px rgba(0,0,0,.50), 0 10px 28px rgba(0,0,0,.35);
          --va-shadow-sm: 0 8px 20px rgba(0,0,0,.35);

          --va-input-bg: rgba(255,255,255,.03);
          --va-input-border: rgba(255,255,255,.14);
          --va-input-shadow: inset 0 1px 0 rgba(255,255,255,.05);

          --va-menu-bg: #101314;
          --va-menu-border: rgba(255,255,255,.16);

          --va-sidebar: linear-gradient(180deg, #0d1113 0%, #0b0e10 100%);
        }
        :root:not([data-theme="dark"]) .${SCOPE}{
          --bg: #f7f9fb;
          --text: #101316;
          --text-muted: color-mix(in oklab, var(--text) 55%, transparent);

          --va-card: #ffffff;
          --va-subtle: #f3f6f8;
          --va-border: rgba(0,0,0,.10);
          --va-shadow: 0 28px 70px rgba(0,0,0,.10), 0 10px 26px rgba(0,0,0,.08);
          --va-shadow-sm: 0 10px 24px rgba(0,0,0,.08);

          --va-input-bg: #ffffff;
          --va-input-border: rgba(0,0,0,.12);
          --va-input-shadow: inset 0 1px 0 rgba(255,255,255,.8);

          --va-menu-bg: #ffffff;
          --va-menu-border: rgba(0,0,0,.10);

          --va-sidebar: linear-gradient(180deg, #ffffff 0%, #f7f9fb 100%);
        }

        /* Green, thin sliders */
        .${SCOPE} .va-range{
          -webkit-appearance: none;
          height: 4px;
          background: color-mix(in oklab, var(--brand) 26%, #0000);
          border-radius: 999px;
          outline: none;
        }
        .${SCOPE} .va-range::-webkit-slider-thumb{
          -webkit-appearance: none;
          width: 14px; height: 14px; border-radius: 50%;
          background: var(--brand); border: 2px solid #fff;
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 25%, transparent);
        }
        .${SCOPE} .va-range::-moz-range-thumb{
          width: 14px; height: 14px; border: 0; border-radius: 50%;
          background: var(--brand);
          box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand) 25%, transparent);
        }
      `}</style>
    </div>
  );
}

/* --- Small atoms --------------------------------------------------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium" style={{ color:'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}

function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12" style={Card}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color:'var(--text)' }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 opacity-70" /> : <ChevronRight className="w-4 h-4 opacity-70" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}
            transition={{ duration:.18 }} className="px-4 pb-4">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
