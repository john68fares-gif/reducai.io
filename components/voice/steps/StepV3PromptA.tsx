'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ClipboardList, FileText, Settings2, Wand2, Edit3, Eye, Copy, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ────────────────────────────────────────────────────────────────────────────
   Scoped theme (light / dark)
──────────────────────────────────────────────────────────────────────────── */
const SCOPE = 'p3-scope';
const BRAND = {
  green: '#59d9b3',
  greenHover: '#54cfa9',
  greenDisabled: '#2e6f63',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--p3-card)',
  border: '1px solid var(--p3-border)',
  borderRadius: 20,
  boxShadow: 'var(--p3-shadow)',
};

const btnPrimary = (enabled: boolean) => ({
  background: enabled ? BRAND.green : BRAND.greenDisabled,
  color: '#fff',
  boxShadow: enabled ? '0 10px 24px rgba(16,185,129,.25)' : 'none',
});

/* ────────────────────────────────────────────────────────────────────────────
   Types + storage helpers
──────────────────────────────────────────────────────────────────────────── */
type Step1 = { language?: string; accentIso2?: string; name?: string; industry?: string };
const LS_STEP1 = 'voicebuilder:step1';
const LS_STEP3_PROMPT = 'voicebuilder:step3:prompt';
const LS_STEP3_FORM = 'voicebuilder:step3:form';

const read = <T,>(k: string, d: T): T => {
  try { const s = localStorage.getItem(k); return s ? JSON.parse(s) as T : d; } catch { return d; }
};
const write = (k: string, v: any) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ────────────────────────────────────────────────────────────────────────────
   Prompt composer
──────────────────────────────────────────────────────────────────────────── */
type Form = {
  role: string;                    // who the agent is
  org: string;                     // org / brand
  purpose: string;                 // main job
  scope: string;                   // what it can / cannot do
  tone: string;                    // style/tone
  constraints: string;             // rules
  dataNeeded: string;              // info to collect
  examples: string;                // example phrases
  extra: string;                   // freeform addendum (edit box)
};

const DEFAULT_FORM: Form = {
  role: 'Riley (voice assistant)',
  org: 'Wellness Partners, a multi-specialty health clinic',
  purpose: 'Efficiently schedule, confirm, reschedule, or cancel appointments while informing patients.',
  scope: 'Handle routine scheduling questions; escalate clinical questions or emergencies to a human.',
  tone: 'Friendly, organized, efficient; warm yet professional; clear and patient.',
  constraints:
    'Ask one question at a time; confirm names/dates/times explicitly; avoid medical advice; use concise answers; phonetic spell names when needed.',
  dataNeeded: 'Full name, date of birth, callback number, appointment type, provider preference, urgency.',
  examples:
    '“Let me check availability.” · “I can offer Wednesday 2:30 PM or Friday 10:15 AM—what works?” · “To confirm: Wednesday, February 15th at 2:30 PM with Dr. Chen.”',
  extra: '',
};

function toBulletBlock(label: string, items: string[]) {
  const lines = items.filter(Boolean).map(s => `- ${s}`).join('\n');
  return lines ? `### ${label}\n${lines}\n` : '';
}

function composePrompt(form: Form, step1: Step1) {
  const lang = (step1.language || 'English');
  const accent = step1.accentIso2 ? ` (accent: ${step1.accentIso2})` : '';
  const intro = `Thank you for calling ${form.org}. This is ${form.role.split('(')[0].trim()}, your scheduling assistant. How may I help you today?`;

  return [
`# Appointment Scheduling Agent Prompt

## Identity & Purpose
You are ${form.role}, a voice assistant for ${form.org}.
Primary goal: ${form.purpose}

## Voice & Persona
${toBulletBlock('Personality', form.tone.split(/[.;]\s*/))}
${toBulletBlock('Speech Characteristics', [
  'Use clear, concise language with natural contractions.',
  'Speak at a measured pace when confirming dates and times.',
  'Use light fillers only when needed: “Let me check that for you.”',
  'Pronounce provider names correctly.',
])}

## Conversation Flow

### Introduction
Start with: "${intro}"

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
${form.scope}

## Response Guidelines
${form.constraints}

## Data to Collect
${form.dataNeeded}

## Example Phrases
${form.examples}

## Language & Operational Settings
- Language: ${lang}${accent}.
- Ask one question at a time.
- If you need time, say: “I’m checking availability. One moment please.”

## Scenario Handling
- New patients: arrive 20 minutes early for forms; bring ID + insurance.  
- Urgent requests: check same-day slots; true emergencies → route to nurse or nearest ER.  
- Rescheduling: read back current appointment; offer alternatives; cancel old and confirm new.  
- Insurance/payment: provide general coverage info; specifics → refer to insurer; copays at service time.

${form.extra ? `## Additional Instructions\n${form.extra}` : ''}`
  ].join('\n');
}

/* ────────────────────────────────────────────────────────────────────────────
   Component
──────────────────────────────────────────────────────────────────────────── */
export default function StepV3PromptMaker({
  onBack, onNext,
}: { onBack?: () => void; onNext?: () => void }) {
  const step1 = read<Step1>(LS_STEP1, { language: 'English', accentIso2: 'US' });

  const [form, setForm] = useState<Form>(() => read<Form>(LS_STEP3_FORM, DEFAULT_FORM));
  const [prompt, setPrompt] = useState<string>(() => read<string>(LS_STEP3_PROMPT, ''));
  const [isTyping, setIsTyping] = useState(false);
  const [visible, setVisible] = useState(''); // typing animation text
  const typerRef = useRef<number | null>(null);

  // persist
  useEffect(() => { write(LS_STEP3_FORM, form); }, [form]);
  useEffect(() => { write(LS_STEP3_PROMPT, prompt); }, [prompt]);

  // typewriter animation
  const typeTo = (full: string) => {
    if (typerRef.current) cancelAnimationFrame(typerRef.current);
    setIsTyping(true);
    setVisible('');

    const speedBase = 1 + Math.max(0, Math.min(4, Math.floor(full.length / 1200))); // crude speed normalize
    let i = 0;

    const step = () => {
      i += Math.max(1, speedBase);
      setVisible(full.slice(0, i));
      if (i < full.length) {
        typerRef.current = requestAnimationFrame(step);
      } else {
        setIsTyping(false);
      }
    };
    typerRef.current = requestAnimationFrame(step);
  };

  const generate = () => {
    const full = composePrompt(form, step1);
    setPrompt(full);
    typeTo(full);
  };

  const applyQuickEdit = (delta: string) => {
    if (!delta.trim()) return;
    const patched = prompt
      ? `${prompt.trim()}\n\n## Edit Notes\n${delta.trim()}`
      : composePrompt({ ...form, extra: delta }, step1);
    setPrompt(patched);
    typeTo(patched);
  };

  const copy = () => navigator.clipboard.writeText(prompt).catch(() => {});

  const canNext = prompt.trim().length > 0;

  return (
    <div className={`${SCOPE} min-h-screen w-full font-movatif`} style={{ background: 'var(--p3-bg)', color: 'var(--p3-text)' }}>
      <div className="w-full max-w-7xl mx-auto px-5 md:px-8 pt-8 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl md:text-3xl font-semibold" style={{ color: 'var(--p3-text)' }}>
            Prompt Maker
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-[20px] border px-3 py-2 text-sm hover:bg-black/5"
              style={{ borderColor: 'var(--p3-border)', color: 'var(--p3-text-soft)' }}
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
          </div>
        </div>

        {/* Grid: left controls / right preview */}
        <div className="grid grid-cols-12 gap-6">
          {/* LEFT: 4 compact cards + quick edit (<= 5 blocks total) */}
          <div className="col-span-12 lg:col-span-5 space-y-5">
            {/* Identity */}
            <div style={cardStyle} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileText className="w-4 h-4" style={{ color: 'var(--p3-brand)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--p3-text)' }}>Identity</h3>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Input
                  label="Agent / Role"
                  value={form.role}
                  onChange={(v) => setForm({ ...form, role: v })}
                />
                <Input
                  label="Organization"
                  value={form.org}
                  onChange={(v) => setForm({ ...form, org: v })}
                />
                <Textarea
                  label="Purpose"
                  value={form.purpose}
                  onChange={(v) => setForm({ ...form, purpose: v })}
                  rows={2}
                />
              </div>
            </div>

            {/* Style & Scope */}
            <div style={cardStyle} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Settings2 className="w-4 h-4" style={{ color: 'var(--p3-brand)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--p3-text)' }}>Style & Scope</h3>
              </div>
              <Textarea
                label="Tone / Style (short bullets or sentences)"
                value={form.tone}
                onChange={(v) => setForm({ ...form, tone: v })}
                rows={3}
              />
              <Textarea
                label="Scope / Limits"
                value={form.scope}
                onChange={(v) => setForm({ ...form, scope: v })}
                rows={3}
              />
            </div>

            {/* Constraints & Data */}
            <div style={cardStyle} className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <ClipboardList className="w-4 h-4" style={{ color: 'var(--p3-brand)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--p3-text)' }}>Rules & Data</h3>
              </div>
              <Textarea
                label="Response Rules / Constraints"
                value={form.constraints}
                onChange={(v) => setForm({ ...form, constraints: v })}
                rows={3}
              />
              <Textarea
                label="Data to Collect"
                value={form.dataNeeded}
                onChange={(v) => setForm({ ...form, dataNeeded: v })}
                rows={2}
              />
              <Textarea
                label="Example Phrases"
                value={form.examples}
                onChange={(v) => setForm({ ...form, examples: v })}
                rows={2}
              />
            </div>

            {/* Quick Edit (like the dialog in your screenshot) */}
            <div style={cardStyle} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Edit3 className="w-4 h-4" style={{ color: 'var(--p3-brand)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--p3-text)' }}>Quick Edit</h3>
                </div>
                <button
                  onClick={() => applyQuickEdit(form.extra)}
                  className="inline-flex items-center gap-2 rounded-[18px] px-3 py-1.5 text-sm"
                  style={{ border: '1px solid var(--p3-border)', color: 'var(--p3-text-soft)' }}
                >
                  Submit Edit
                </button>
              </div>
              <input
                value={form.extra}
                onChange={(e) => setForm({ ...form, extra: e.target.value })}
                placeholder="Describe how you'd like to edit the prompt…"
                className="w-full rounded-[14px] px-3 py-2 text-sm"
                style={{ background: 'var(--p3-input-bg)', border: '1px solid var(--p3-input-border)', color: 'var(--p3-text)' }}
              />
            </div>

            {/* Generate */}
            <div className="flex items-center justify-end">
              <button
                onClick={generate}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-[20px] font-semibold"
                style={btnPrimary(true)}
                onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BRAND.greenHover)}
                onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BRAND.green)}
              >
                <Wand2 className="w-4 h-4" /> Generate
              </button>
            </div>
          </div>

          {/* RIGHT: Prompt preview with typing animation */}
          <div className="col-span-12 lg:col-span-7">
            <div style={cardStyle} className="p-5 md:p-6 h-full">
              <div className="flex items-center gap-2 mb-3">
                <Eye className="w-4 h-4" style={{ color: 'var(--p3-brand)' }} />
                <h3 className="text-sm font-semibold" style={{ color: 'var(--p3-text)' }}>System Prompt</h3>
              </div>

              {/* typed text layer */}
              <div className="relative">
                <textarea
                  value={isTyping ? visible : prompt}
                  onChange={(e) => { setPrompt(e.target.value); if (isTyping) setIsTyping(false); }}
                  className="w-full min-h-[520px] md:min-h-[640px] rounded-[16px] p-4 text-sm leading-6 font-mono"
                  style={{ background: 'var(--p3-input-bg)', border: '1px solid var(--p3-input-border)', color: 'var(--p3-text)' }}
                />
                <AnimatePresence>
                  {isTyping && (
                    <motion.div
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className="absolute bottom-3 right-3 text-xs px-2 py-1 rounded-[12px]"
                      style={{ background: 'var(--p3-chip-bg)', border: '1px solid var(--p3-border)', color: 'var(--p3-text-soft)' }}
                    >
                      Typing…
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[18px] px-4 py-2 text-sm"
            style={{ background: 'var(--p3-card)', border: '1px solid var(--p3-border)', color: 'var(--p3-text)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>

          <button
            disabled={!canNext}
            onClick={() => onNext?.()}
            className="inline-flex items-center gap-2 px-8 h-[42px] rounded-[18px] font-semibold select-none disabled:cursor-not-allowed"
            style={btnPrimary(canNext)}
            onMouseEnter={(e)=>{ if(!canNext) return; (e.currentTarget as HTMLButtonButtonElement).style.background = BRAND.greenHover; }}
            onMouseLeave={(e)=>{ if(!canNext) return; (e.currentTarget as HTMLButtonElement).style.background = BRAND.green; }}
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Theme tokens */}
      <style jsx global>{`
        .${SCOPE}{
          --p3-bg: #ffffff;
          --p3-text: #101213;
          --p3-text-soft: color-mix(in oklab, var(--p3-text) 65%, transparent);
          --p3-card: #ffffff;
          --p3-border: rgba(0,0,0,.10);
          --p3-shadow: 0 28px 70px rgba(0,0,0,.10), 0 10px 26px rgba(0,0,0,.06);
          --p3-brand: ${BRAND.green};
          --p3-input-bg: #ffffff;
          --p3-input-border: rgba(0,0,0,.12);
          --p3-chip-bg: rgba(0,0,0,.04);
        }
        [data-theme="dark"] .${SCOPE}{
          --p3-bg: #0b0c10;
          --p3-text: #ffffff;
          --p3-text-soft: rgba(255,255,255,.74);
          --p3-card: rgba(13,15,17,.92);
          --p3-border: rgba(255,255,255,.12);
          --p3-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45);
          --p3-brand: ${BRAND.green};
          --p3-input-bg: #0b0e0f;
          --p3-input-border: rgba(255,255,255,.14);
          --p3-chip-bg: rgba(255,255,255,.06);
        }
      `}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
   Small form atoms
──────────────────────────────────────────────────────────────────────────── */
function Input({ label, value, onChange }: { label: string; value: string; onChange: (v: string)=>void }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs" style={{ color: 'var(--p3-text-soft)' }}>{label}</div>
      <input
        value={value}
        onChange={(e)=>onChange(e.target.value)}
        className="w-full rounded-[14px] px-3 py-2 text-sm"
        style={{ background: 'var(--p3-input-bg)', border: '1px solid var(--p3-input-border)', color: 'var(--p3-text)' }}
      />
    </label>
  );
}
function Textarea({
  label, value, onChange, rows = 3,
}: { label: string; value: string; onChange: (v: string)=>void; rows?: number }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs" style={{ color: 'var(--p3-text-soft)' }}>{label}</div>
      <textarea
        value={value}
        rows={rows}
        onChange={(e)=>onChange(e.target.value)}
        className="w-full rounded-[14px] px-3 py-2 text-sm leading-6"
        style={{ background: 'var(--p3-input-bg)', border: '1px solid var(--p3-input-border)', color: 'var(--p3-text)' }}
      />
    </label>
  );
}
