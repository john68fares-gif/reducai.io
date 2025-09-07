// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Plus, Check, Edit3, Zap, SlidersHorizontal, Type, Mic2, BookOpen,
  Settings, Sparkles, Bot, FileText, Trash2, Copy, RefreshCw, PanelLeft, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ============================================================
   THEME TOKENS (auto switches with [data-theme="dark"])
============================================================ */
const SCOPE = 'voice-agent-scope';
const GREEN = '#59d9b3';
const GREEN_HOVER = '#54cfa9';

const Card: React.CSSProperties = {
  borderRadius: 16,
  background: 'var(--va-card)',
  border: '1px solid var(--va-border)',
  boxShadow: 'var(--va-shadow)'
};

/* ============================================================
   TYPES + STORAGE
============================================================ */
type Assistant = {
  id: string;
  name: string;
  updatedAt: number;
  config: VoiceAgentConfig;
};

type VoiceAgentConfig = {
  model: {
    provider: 'openai';
    model: string;
    firstMessageMode: 'assistant_first' | 'user_first';
    firstMessage: string;
    systemPrompt: string;
  };
  voice: {
    provider: 'vapi';
    voice: string;
    background: 'default' | 'none';
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

const LS_KEY = 'voice:assistants.v1';
const activeKey = (id: string) => `voice:assistant:${id}`;

function readLS<T>(k: string): T | null {
  try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; }
}
function writeLS<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* ============================================================
   PROMPT: BASE + OPTIONAL “APPT SCHEDULING” EXTENSIONS
============================================================ */
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

const APPT_SCHEDULING_BLOCK = `# Appointment Scheduling Agent Prompt

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

/** Merge logic:
 * - Start from BASE_PROMPT
 * - If refinement text includes scheduling-ish keywords, append the APPT block (once).
 * - Always append “Refinements” as bullet points with user text normalized.
 */
function buildPrompt(base: string, refinement: string): string {
  const wantsAppt =
    /\b(appoint|schedule|clinic|patient|provider|resched|urgent|dob|insurance)\b/i.test(refinement);
  const refined = refinement.trim();
  const bullets = refined
    ? `\n\n[Refinements]\n- ${refined.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`
    : '';
  return [base, wantsAppt ? `\n\n${APPT_SCHEDULING_BLOCK}` : '', bullets].join('');
}

/* ============================================================
   SMALL UI BITS
============================================================ */
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
function Field({
  label, children, hint
}: { label: string; children: React.ReactNode; hint?: string; }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text)' }}>{label}</label>
      {children}
      {hint ? <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>{hint}</div> : null}
    </div>
  );
}
function Select({
  value, onChange, children
}: { value: string; onChange: (v: string) => void; children: React.ReactNode; }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
      style={{
        background: 'var(--va-input-bg)',
        color: 'var(--text)',
        border: '1px solid var(--va-input-border)',
        boxShadow: 'var(--va-input-shadow)'
      }}
    >
      {children}
    </select>
  );
}
function Input({ value, onChange, placeholder }:{
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
      style={{
        background: 'var(--va-input-bg)',
        color: 'var(--text)',
        border: '1px solid var(--va-input-border)',
        boxShadow: 'var(--va-input-shadow)'
      }}
    />
  );
}
function TextArea({ value, onChange, rows = 10 }:{
  value: string; onChange: (v: string) => void; rows?: number;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl px-3 py-2 text-sm outline-none"
      style={{
        background: 'var(--va-input-bg)',
        color: 'var(--text)',
        border: '1px solid var(--va-input-border)',
        boxShadow: 'var(--va-input-shadow)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
      }}
    />
  );
}

function Section({
  icon, title, children, defaultOpen = true
}: { icon: React.ReactNode; title: string; children: React.ReactNode; defaultOpen?: boolean; }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={Card}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: 'var(--text)' }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 opacity-70" /> : <ChevronRight className="w-4 h-4 opacity-70" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .2 }}
            className="px-4 pb-4"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* Typing animation for prompt area */
function useTypewriter(fullText: string, speed = 10) {
  const [text, setText] = useState(fullText);
  const [typing, setTyping] = useState(false);

  const run = (next: string) => {
    setTyping(true);
    setText('');
    let i = 0;
    const id = setInterval(() => {
      i += 2; // two chars per tick (a little faster)
      setText(next.slice(0, i));
      if (i >= next.length) { clearInterval(id); setTyping(false); }
    }, speed);
  };

  useEffect(() => { setText(fullText); }, []); // initialize once
  return { text, typing, run };
}

/* ============================================================
   MAIN
============================================================ */
export default function VoiceAgentSection() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');

  // bootstrap
  useEffect(() => {
    const list = readLS<Assistant[]>(LS_KEY) || [];
    // seed one if empty
    if (list.length === 0) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        updatedAt: Date.now(),
        config: {
          model: {
            provider: 'openai',
            model: 'gpt-4o',
            firstMessageMode: 'assistant_first',
            firstMessage: 'Hello.',
            systemPrompt: BASE_PROMPT
          },
          voice: {
            provider: 'vapi',
            voice: 'Elliot',
            background: 'default'
          },
          transcriber: {
            provider: 'deepgram',
            model: 'nova-2',
            language: 'en',
            denoise: false,
            confidenceThreshold: 0.4,
            numerals: false
          },
          tools: {
            enableEndCall: true,
            dialKeypad: true
          },
          advanced: {
            summaryPrompt:
              'You are an expert note-taker. Summarize the call in 2–3 sentences, if applicable.',
            successEvalPrompt:
              'You are an expert call evaluator. Decide if objectives were met based on the system prompt + transcript.'
          }
        }
      };
      writeLS(LS_KEY, [seed]);
      writeLS(activeKey(seed.id), seed);
      setAssistants([seed]);
      setActiveId(seed.id);
    } else {
      setAssistants(list);
      setActiveId(list[0].id);
    }
  }, []);

  const active = useMemo(() => {
    if (!activeId) return null;
    return readLS<Assistant>(activeKey(activeId));
  }, [activeId]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(activeKey(active.id), next);
    const list = (readLS<Assistant[]>(LS_KEY) || []).map(a => a.id === next.id ? { ...a, name: next.name, updatedAt: Date.now() } : a);
    writeLS(LS_KEY, list);
    setAssistants(list);
  };

  const addAssistant = () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id,
      name: 'New Assistant',
      updatedAt: Date.now(),
      config: active?.config ?? {
        model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT },
        voice: { provider: 'vapi', voice: 'Elliot', background: 'default' },
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
        tools: { enableEndCall: true, dialKeypad: true },
        advanced: { summaryPrompt: 'You are an expert note-taker. Summarize in 2–3 sentences.', successEvalPrompt: 'Evaluate if the call succeeded.' }
      }
    };
    writeLS(activeKey(id), a);
    const list = [...assistants, a];
    writeLS(LS_KEY, list);
    setAssistants(list);
    setActiveId(id);
  };

  const removeAssistant = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_KEY, list);
    setAssistants(list);
    if (activeId === id && list.length) setActiveId(list[0].id);
  };

  // Prompt typing
  const { text: typedPrompt, typing, run: runType } = useTypewriter(active?.config.model.systemPrompt || BASE_PROMPT, 6);

  // “Edit Prompt” refinement box
  const [refineOpen, setRefineOpen] = useState(false);
  const [refineText, setRefineText] = useState('');

  const applyRefinement = () => {
    if (!active) return;
    const nextPrompt = buildPrompt(BASE_PROMPT, refineText);
    runType(nextPrompt);
    updateActive(a => ({
      ...a,
      config: { ...a.config, model: { ...a.config.model, systemPrompt: nextPrompt } }
    }));
    setRefineOpen(false);
    setRefineText('');
  };

  if (!active) return null;

  return (
    <div className={`${SCOPE} w-full`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="flex">
        {/* ===== Assistant Sidebar (secondary) ===== */}
        <aside className="hidden md:flex flex-col shrink-0 w-[220px] p-3 gap-2" style={{ borderRight: '1px solid var(--va-border)' }}>
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2"><PanelLeft className="w-4 h-4" /><span className="text-sm font-semibold">Assistants</span></div>
            <button onClick={addAssistant} className="p-2 rounded-full hover:bg-white/10" aria-label="Add"><Plus className="w-4 h-4" /></button>
          </div>
          <div className="space-y-1">
            {assistants.map(a => (
              <button key={a.id} onClick={() => setActiveId(a.id)}
                className="w-full text-left px-3 py-2 rounded-lg flex items-center justify-between"
                style={{
                  background: a.id === activeId ? 'color-mix(in oklab, var(--brand) 10%, transparent)' : 'transparent',
                  border: `1px solid ${a.id === activeId ? 'color-mix(in oklab, var(--brand) 28%, var(--va-border))' : 'var(--va-border)'}`
                }}>
                <span className="truncate">{a.name}</span>
                {a.id === activeId ? <Check className="w-4 h-4" /> : null}
              </button>
            ))}
          </div>
        </aside>

        {/* ===== Editor ===== */}
        <main className="flex-1 p-4 md:p-6 max-w-[1200px] mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5" />
              <Input value={active.name} onChange={(v) => updateActive(a => ({ ...a, name: v }))} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt).catch(() => {})}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm"
                style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}>
                <Copy className="w-4 h-4" /> Copy Prompt
              </button>
              <button
                onClick={() => removeAssistant(active.id)}
                className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm"
                style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}>
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>

          <div className="space-y-8">
            {/* ===== MODEL ===== */}
            <Section icon={<FileText className="w-4 h-4 text-[var(--brand)]" />} title="Model">
              <Row>
                <Field label="Provider">
                  <Select
                    value={active.config.model.provider}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, provider: v as any } } }))}
                  >
                    <option value="openai">OpenAI</option>
                  </Select>
                </Field>
                <Field label="Model">
                  <Select
                    value={active.config.model.model}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, model: v } } }))}>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4.1">gpt-4.1</option>
                    <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                  </Select>
                </Field>
              </Row>

              <Row>
                <Field label="First Message Mode" hint="Who speaks first">
                  <Select
                    value={active.config.model.firstMessageMode}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessageMode: v as any } } }))}>
                    <option value="assistant_first">Assistant speaks first</option>
                    <option value="user_first">User speaks first</option>
                  </Select>
                </Field>
                <Field label="First Message">
                  <Input
                    value={active.config.model.firstMessage}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessage: v } } }))}
                  />
                </Field>
              </Row>

              {/* Prompt header bar w/ Generate & Edit */}
              <div className="mt-4 mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text)' }}>
                  <Type className="w-4 h-4" /> System Prompt
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { runType(BASE_PROMPT); updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: BASE_PROMPT } } })); }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm"
                    style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}
                  >
                    <RefreshCw className="w-4 h-4" /> Reset
                  </button>
                  <button
                    onClick={() => setRefineOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-sm"
                    style={{ background: GREEN, color: '#fff' }}
                    onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = GREEN_HOVER}
                    onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = GREEN}
                  >
                    <Sparkles className="w-4 h-4" /> Generate / Edit
                  </button>
                </div>
              </div>

              {/* Typing prompt area */}
              <div className="rounded-xl overflow-hidden" style={Card}>
                <div className="p-3 text-xs" style={{ borderBottom: '1px solid var(--va-border)', background: 'var(--va-subtle)' }}>
                  {typing ? 'Typing…' : 'Ready'}
                </div>
                <div className="p-3">
                  <TextArea
                    rows={18}
                    value={typedPrompt}
                    onChange={(v) => {
                      // allow manual edits; stop typing animation
                      updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: v } } }));
                    }}
                  />
                </div>
              </div>

              {/* EDIT PROMPT modal mimic */}
              <AnimatePresence>
                {refineOpen && (
                  <motion.div
                    className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    style={{ background: 'rgba(0,0,0,0.45)' }}
                  >
                    <motion.div
                      initial={{ y: 10, opacity: 0, scale: .98 }}
                      animate={{ y: 0, opacity: 1, scale: 1 }}
                      exit={{ y: 6, opacity: 0, scale: .985 }}
                      transition={{ duration: .18 }}
                      className="w-full max-w-xl"
                      style={Card}
                    >
                      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--va-border)' }}>
                        <div className="text-sm font-semibold flex items-center gap-2"><Edit3 className="w-4 h-4" /> Edit Prompt</div>
                      </div>
                      <div className="p-4">
                        <Input
                          value={refineText}
                          onChange={setRefineText}
                          placeholder="Describe how you'd like to edit the prompt"
                        />
                        <div className="mt-3 flex items-center justify-end gap-2">
                          <button
                            onClick={() => setRefineOpen(false)}
                            className="px-3 py-2 rounded-xl text-sm"
                            style={{ border: '1px solid var(--va-border)', background: 'var(--va-card)' }}
                          >Cancel</button>
                          <button
                            onClick={applyRefinement}
                            className="px-3 py-2 rounded-xl text-sm"
                            style={{ background: GREEN, color: '#fff' }}
                            onMouseEnter={(e) => (e.currentTarget as HTMLButtonElement).style.background = GREEN_HOVER}
                            onMouseLeave={(e) => (e.currentTarget as HTMLButtonElement).style.background = GREEN}
                          >
                            Submit Edit <ArrowUpRight className="inline w-4 h-4 ml-1" />
                          </button>
                        </div>
                        <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          Tip: If you mention scheduling/clinic needs, the assistant will auto-extend with an appointment scheduling playbook.
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>

            {/* ===== VOICE ===== */}
            <Section icon={<Mic2 className="w-4 h-4 text-[var(--brand)]" />} title="Voice">
              <Row>
                <Field label="Provider">
                  <Select
                    value={active.config.voice.provider}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, provider: v as any } } }))}
                  >
                    <option value="vapi">Vapi</option>
                  </Select>
                </Field>
                <Field label="Voice">
                  <Select
                    value={active.config.voice.voice}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, voice: v } } }))}>
                    <option>Elliot</option>
                    <option>Alloy</option>
                    <option>Amber</option>
                  </Select>
                </Field>
              </Row>
              <Row>
                <Field label="Background Sound">
                  <Select
                    value={active.config.voice.background}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, background: v as any } } }))}>
                    <option value="default">Default</option>
                    <option value="none">None</option>
                  </Select>
                </Field>
              </Row>
            </Section>

            {/* ===== TRANSCRIBER ===== */}
            <Section icon={<BookOpen className="w-4 h-4 text-[var(--brand)]" />} title="Transcriber">
              <Row>
                <Field label="Provider">
                  <Select
                    value={active.config.transcriber.provider}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, provider: v as any } } }))}>
                    <option value="deepgram">Deepgram</option>
                  </Select>
                </Field>
                <Field label="Model">
                  <Select
                    value={active.config.transcriber.model}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, model: v as any } } }))}>
                    <option value="nova-2">Nova 2</option>
                    <option value="nova-3">Nova 3</option>
                  </Select>
                </Field>
              </Row>
              <Row>
                <Field label="Language">
                  <Select
                    value={active.config.transcriber.language}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, language: v as any } } }))}>
                    <option value="en">En</option>
                    <option value="multi">Multi</option>
                  </Select>
                </Field>
                <Field label="Confidence Threshold">
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={active.config.transcriber.confidenceThreshold}
                    onChange={(e) => updateActive(a => ({
                      ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } }
                    }))}
                    className="w-full"
                  />
                  <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    {active.config.transcriber.confidenceThreshold.toFixed(2)}
                  </div>
                </Field>
              </Row>
              <Row>
                <Field label="Denoise">
                  <Select
                    value={String(active.config.transcriber.denoise)}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, denoise: v === 'true' } } }))}>
                    <option value="false">Off</option>
                    <option value="true">On</option>
                  </Select>
                </Field>
                <Field label="Use Numerals">
                  <Select
                    value={String(active.config.transcriber.numerals)}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, numerals: v === 'true' } } }))}>
                    <option value="false">No</option>
                    <option value="true">Yes</option>
                  </Select>
                </Field>
              </Row>
            </Section>

            {/* ===== TOOLS ===== */}
            <Section icon={<SlidersHorizontal className="w-4 h-4 text-[var(--brand)]" />} title="Tools">
              <Row>
                <Field label="Enable End Call Function">
                  <Select
                    value={String(active.config.tools.enableEndCall)}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, enableEndCall: v === 'true' } } }))}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </Select>
                </Field>
                <Field label="Dial Keypad">
                  <Select
                    value={String(active.config.tools.dialKeypad)}
                    onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, dialKeypad: v === 'true' } } }))}>
                    <option value="true">Enabled</option>
                    <option value="false">Disabled</option>
                  </Select>
                </Field>
              </Row>
            </Section>

            {/* ===== ADVANCED ===== */}
            <Section icon={<Settings className="w-4 h-4 text-[var(--brand)]" />} title="Advanced">
              <Field label="Summary Prompt">
                <TextArea
                  rows={4}
                  value={active.config.advanced.summaryPrompt}
                  onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, advanced: { ...a.config.advanced, summaryPrompt: v } } }))}
                />
              </Field>
              <div className="mt-3" />
              <Field label="Success Evaluation Prompt">
                <TextArea
                  rows={4}
                  value={active.config.advanced.successEvalPrompt}
                  onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, advanced: { ...a.config.advanced, successEvalPrompt: v } } }))}
                />
              </Field>
            </Section>
          </div>
        </main>
      </div>

      {/* Scoped theme */}
      <style jsx global>{`
        .${SCOPE}{
          --brand: ${GREEN};
          --bg: var(--bg, #0b0c10);
          --text: var(--text, #e7ecef);
          --text-muted: color-mix(in oklab, var(--text) 70%, transparent);

          --va-card: #ffffff;
          --va-subtle: #f6f7f9;
          --va-border: rgba(0,0,0,.10);
          --va-shadow: 0 28px 70px rgba(0,0,0,.10), 0 10px 26px rgba(0,0,0,.08);
          --va-input-bg: #ffffff;
          --va-input-border: rgba(0,0,0,.12);
          --va-input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);
        }
        [data-theme="dark"] .${SCOPE}{
          --bg: #0b0c10;
          --text: #f1f5f9;

          --va-card: #0f1315;
          --va-subtle: #0d1113;
          --va-border: rgba(255,255,255,.10);
          --va-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45);
          --va-input-bg: rgba(255,255,255,.02);
          --va-input-border: rgba(255,255,255,.14);
          --va-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);
        }
      `}</style>
    </div>
  );
}
