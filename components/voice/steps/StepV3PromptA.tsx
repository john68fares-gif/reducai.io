// components/voice/steps/StepV3PromptA.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Copy, ArrowLeft, X, User, MessageSquare, ClipboardList,
  Lightbulb, BookOpen, Settings2, CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ======================= THEME ======================= */
const UI = {
  bg: '#0b0c10',
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.12)',
  glow: 'radial-gradient(circle, rgba(106,247,209,0.08) 0%, transparent 70%)',
  green: '#59d9b3',
  greenHover: '#54cfa9',
  greenDisabled: '#2e6f63',
};
const CARD: React.CSSProperties = {
  background: UI.cardBg,
  border: UI.border,
  borderRadius: 20,
  boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 0 12px rgba(106,247,209,0.04)',
};
const MODAL: React.CSSProperties = {
  background: 'rgba(13,15,17,0.96)',
  border: '1px solid rgba(106,247,209,0.18)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};

/* ======================= STORAGE KEYS ======================= */
const LS_STEP1 = 'voicebuilder:step1';
const LS_STEP3 = 'voicebuilder:step3';
const LS_BACKUP = 'voice:settings:backup';

type Step1Lite = {
  language: string;
  accentIso2?: string;
  responseDelayMs?: number;
  allowBargeIn?: boolean;
};

function readLS<T>(k: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(k);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}
function writeLS<T>(k: string, v: T) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}
function useDebouncedSaver<T>(value: T, delay = 350, onSave: (v: T) => void) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = useRef<number | null>(null);
  useEffect(() => {
    setSaving(true);
    setSaved(false);
    if (t.current) clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      onSave(value);
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 800);
    }, delay);
    return () => { if (t.current) clearTimeout(t.current); };
  }, [value, delay, onSave]);
  return { saving, saved };
}

/* ======================= TYPES ======================= */
type Step3 = {
  // 1) Identity & Purpose
  orgName: string;
  personaName: string;
  purpose: string; // single paragraph

  // 2) Voice & Persona
  style: 'professional'|'conversational'|'empathetic'|'upbeat';
  politeness: 'low'|'med'|'high';
  personalityBullets: string[]; // bullets
  speechBullets: string[];      // bullets

  // 3) Conversation Flow
  introScript: string; // opening line
  flowTypeQ: { service: boolean; provider: boolean; newOrReturning: boolean; urgency: boolean; };
  // 4) Scheduling Process
  collectNewPatient: string[];    // list of fields for new patient
  collectReturning: string[];     // list of fields for returning
  offerTimesStyle: string;        // how to offer times
  fallbackIfNoTime: string;       // fallback phrasing

  // 5) Confirmation & Wrap-up
  confirmTemplate: string;
  setExpectations: string;
  offerReminder: boolean;
  closingLine: string;

  // Knowledge & Policies (combined box)
  kb_appointmentTypes: string;
  kb_providers: string;
  kb_preparation: string;
  policies: string;

  // latency / language
  latencyMs: number;
  language: string;
  accentIso2: string;
  fillers: string;

  compiled?: string;
};

/* ======================= DEFAULTS ======================= */
const DEFAULT: Step3 = {
  // 1
  orgName: 'Wellness Partners',
  personaName: 'Riley',
  purpose:
    'Efficiently schedule, confirm, reschedule, or cancel appointments while providing clear information about services and ensuring a smooth booking experience.',

  // 2
  style: 'professional',
  politeness: 'med',
  personalityBullets: [
    'Sound friendly, organized, and efficient',
    'Be patient with elderly or confused callers',
    'Warm but professional tone throughout',
    'Convey confidence in managing the scheduling system',
  ],
  speechBullets: [
    'Use clear, concise language with natural contractions',
    'Measured pace when confirming dates and times',
    'Use phrases like “Let me check that for you” or “Just a moment while I look at the schedule”',
    'Pronounce medical terms and provider names clearly',
  ],

  // 3
  introScript:
    'Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?',
  flowTypeQ: { service: true, provider: true, newOrReturning: true, urgency: true },

  // 4
  collectNewPatient: ['Full name', 'Date of birth', 'Phone number'],
  collectReturning: ['Full name', 'Date of birth'],
  offerTimesStyle:
    'For [appointment type] with [provider], I have availability on [date] at [time], or [date] at [time]. Would either of those work?',
  fallbackIfNoTime:
    'I don’t see availability that matches your preference. Would you be open to a different provider or a different day of the week?',

  // 5
  confirmTemplate:
    'To confirm, you’re scheduled for a [appointment type] with [provider] on [day], [date] at [time].',
  setExpectations:
    'The appointment will last approximately [duration]. Please remember to [specific instructions].',
  offerReminder: true,
  closingLine:
    'Thank you for scheduling with Wellness Partners. Is there anything else I can help you with today?',

  // Knowledge & Policies
  kb_appointmentTypes:
`- Primary Care: Annual physicals, illness visits, follow-ups (30–60 minutes)
- Specialist Consultations: Initial visits and follow-ups (45–60 minutes)
- Diagnostic Services: Lab work, imaging, testing (15–90 minutes, varies)
- Wellness Services: Nutrition, PT, mental health (45–60 minutes)
- Urgent Care: Same-day appointments for non-emergency issues (30 minutes)`,
  kb_providers:
`- 15 providers across various specialties
- Primary care hours: Mon–Fri 8am–5pm, Sat 9am–12pm
- Specialist hours vary by department
- Some providers only work certain days
- New patient appointments are generally longer`,
  kb_preparation:
`- Primary Care: No special prep for most; fasting for annual physicals with labs
- Specialist: Varies by specialty; provide visit-specific instructions
- Diagnostic: Prep varies by test (fasting, medication adjustments, etc.)
- All: Insurance card, photo ID, current medications, copayment`,
  policies:
`- New patients: arrive 20 minutes early for forms
- Returning patients: arrive 15 minutes early
- 24-hour cancellation notice to avoid $50 fee
- 15-minute grace period for late arrivals before reschedule
- Insurance verification performed prior to appointment when possible`,

  // latency / language
  latencyMs: 600,
  language: 'en',
  accentIso2: 'us',
  fillers: 'One moment while I check that.\nLet me pull that up.',
  compiled: '',
};

const PERSONALITY_CHOICES = [
  'Sound friendly, organized, and efficient',
  'Be patient with elderly or confused callers',
  'Warm but professional tone throughout',
  'Convey confidence in managing the scheduling system',
];
const SPEECH_CHOICES = [
  'Use clear, concise language with natural contractions',
  'Measured pace when confirming dates and times',
  'Use “Let me check that for you” or similar conversational fillers',
  'Pronounce medical terms and provider names clearly',
];
const NEW_PATIENT_FIELDS = ['Full name', 'Date of birth', 'Phone number', 'Email', 'Reason for visit'];
const RETURNING_FIELDS = ['Full name', 'Date of birth', 'Phone number'];

/* ======================= HELPERS ======================= */
const STYLE_LABEL: Record<Step3['style'], string> = {
  professional: 'Professional + concise',
  conversational: 'Natural + casual',
  empathetic: 'Warm + patient',
  upbeat: 'Positive + quick',
};
const POLITE_LABEL = (p: Step3['politeness']) =>
  p === 'low' ? 'More direct' : p === 'high' ? 'Very polite' : 'Balanced';

function bullets(lines: string[]) {
  return lines.filter(Boolean).map(s => `- ${s}`).join('\n');
}

function compile(step1: Partial<Step1Lite>, s: Step3): string {
  const lang = `Language: ${s.language || step1.language || 'en'}. Accent: ${s.accentIso2 || step1.accentIso2 || 'us'}.`;
  const latency = `Target latency ~${s.latencyMs ?? step1.responseDelayMs ?? 600}ms.`;
  const fillers = s.fillers?.trim() ? s.fillers.trim().split('\n').map(f => `- ${f.trim()}`).join('\n') : '';

  const typeQs: string[] = [];
  if (s.flowTypeQ.service) typeQs.push('Service identification: "What type of appointment are you looking to schedule today?"');
  if (s.flowTypeQ.provider) typeQs.push('Provider preference: "Do you have a specific provider in mind, or would you prefer first available?"');
  if (s.flowTypeQ.newOrReturning) typeQs.push('New or returning patient: "Have you visited our clinic before, or will this be your first appointment?"');
  if (s.flowTypeQ.urgency) typeQs.push('Urgency assessment: "Is this urgent or a routine visit?"');

  const newPt = s.collectNewPatient?.length
    ? s.collectNewPatient.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : '';
  const returningPt = s.collectReturning?.length
    ? s.collectReturning.map((f, i) => `${i + 1}. ${f}`).join('\n')
    : '';

  return [
`# Appointment Scheduling Agent Prompt

## Identity & Purpose

You are ${s.personaName}, an appointment scheduling voice assistant for ${s.orgName}. Your primary purpose is to ${s.purpose}

## Voice & Persona

### Personality
${bullets(s.personalityBullets)}

### Speech Characteristics
${bullets(s.speechBullets)}

- ${STYLE_LABEL[s.style]}
- ${POLITE_LABEL(s.politeness)}
- ${latency}
- ${lang}
${fillers ? `- Fillers (when you need a brief pause):\n${fillers}` : ''}

## Conversation Flow

### Introduction
Start with: "${s.introScript}"

If they immediately mention an appointment need: "I'd be happy to help you with scheduling. Let me get some information from you so we can find the right appointment."

### Appointment Type Determination
${bullets(typeQs)}

## Scheduling Process

1. Collect patient information:
   - For new patients:${newPt ? `\n${newPt.split('\n').map(l => `     ${l}`).join('\n')}` : ' (Full name, date of birth, phone)'}
   - For returning patients:${returningPt ? `\n${returningPt.split('\n').map(l => `     ${l}`).join('\n')}` : ' (Full name and date of birth)'}

2. Offer available times:
   - "${s.offerTimesStyle}"

3. If no suitable time:
   - "${s.fallbackIfNoTime}"

4. Confirm selection:
   - "Great, I’ve reserved [appointment type] with [provider] on [day], [date] at [time]. Does that work for you?"

5. Provide preparation instructions:
   - "For this appointment, please arrive 15 minutes early to complete any necessary paperwork. Also, please bring [required items]."

## Confirmation and Wrap-up

1. Summarize details:
   - "${s.confirmTemplate}"

2. Set expectations:
   - "${s.setExpectations}"

3. Optional reminders:${s.offerReminder ? ' Offer reminder: "Would you like a reminder call or text before your appointment?"' : ' (No automated reminder offer.)'}

4. Close politely:
   - "${s.closingLine}"

## Knowledge Base

### Appointment Types
${s.kb_appointmentTypes}

### Provider Information
${s.kb_providers}

### Preparation Requirements
${s.kb_preparation}

### Policies
${s.policies}

## Response Guidelines

- Keep responses concise and focused on scheduling information
- Explicit confirmation for dates, times, and names
- Ask only one question at a time
- Use phonetic spelling for verification when needed
- Provide clear time estimates for appointments and arrival times

## Call Management

- If you need time to check schedules: "I’m checking availability now—it’ll take just a moment."
- If systems are slow: "I’m seeing a brief delay—thanks for your patience."
- If caller has multiple needs: "Let’s handle these one at a time so everything is booked correctly."`,
  ].join('\n');
}

/* ======================= ATOMS ======================= */
function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full relative transition ${checked ? 'bg-emerald-400/80' : 'bg-white/10'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}

function ChipMulti({
  options, value, onChange,
}: { options: string[]; value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (opt: string) =>
    onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = value.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition ${
              active
                ? 'bg-emerald-500/15 border-emerald-400/80 text-emerald-200'
                : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
            }`}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

function Modal({
  open, onClose, title, children,
}: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.60)' }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-[1080px] max-h-[88vh] flex flex-col text-white font-movatif"
            style={MODAL}
          >
            <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
              <h4 className="text-lg font-semibold truncate">{title}</h4>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
            <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: '#101314' }}>
              <div className="flex justify-end">
                <button onClick={onClose} className="px-6 py-2 rounded-[24px] border border-white/15 hover:bg-white/10">Close</button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* Box scaffold */
function Box({
  title, icon, children, editable, renderEdit, error, saveBadge, size='md',
}: {
  title: string; icon?: React.ReactNode; children: React.ReactNode;
  editable?: boolean; renderEdit?: () => React.ReactNode; error?: string;
  saveBadge?: React.ReactNode; size?: 'sm'|'md'|'lg';
}) {
  const [open, setOpen] = useState(false);
  const minH = size === 'lg' ? 'min-h-[360px]' : size === 'sm' ? 'min-h-[220px]' : 'min-h-[300px]';
  return (
    <>
      <motion.div
        layout initial={{ opacity: 0, y: 10, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22 }} whileHover={{ y: -2 }}
        className={`relative p-6 flex flex-col h-full ${minH}`}
        style={CARD}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background: UI.glow, filter: 'blur(36px)' }}
        />
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-[13px] font-semibold flex items-center gap-2">{icon}{title}</h3>
          <div className="flex items-center gap-2">
            {editable && (
              <button
                onClick={() => setOpen(true)}
                className="text-xs px-3 py-1.5 rounded-2xl border border-white/15 hover:bg-white/10 inline-flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" /> Edit
              </button>
            )}
            {saveBadge}
          </div>
        </div>
        <div className="space-y-3 flex-1">{children}</div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </motion.div>
      {editable && renderEdit &&
        <Modal open={open} onClose={() => setOpen(false)} title={title}>{renderEdit()}</Modal>}
    </>
  );
}

/* ======================= COMPONENT ======================= */
export default function StepV3PromptA({
  onBack, onNext,
}: { onBack?: () => void; onNext?: () => void }) {
  const step1 = readLS<Step1Lite>(LS_STEP1) || { language: 'en', accentIso2: 'us', responseDelayMs: 600, allowBargeIn: true };
  const restored = readLS<Step3>(LS_STEP3);

  const hydrate = (raw?: Step3 | null): Step3 => {
    const r = raw || {} as any;
    const pick = <T,>(v: any, d: T): T => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) ? d : v;
    return {
      orgName: pick(r.orgName, DEFAULT.orgName),
      personaName: pick(r.personaName, DEFAULT.personaName),
      purpose: pick(r.purpose, DEFAULT.purpose),
      style: pick(r.style, DEFAULT.style),
      politeness: pick(r.politeness, DEFAULT.politeness),
      personalityBullets: Array.isArray(r.personalityBullets) && r.personalityBullets.length ? r.personalityBullets : DEFAULT.personalityBullets,
      speechBullets: Array.isArray(r.speechBullets) && r.speechBullets.length ? r.speechBullets : DEFAULT.speechBullets,
      introScript: pick(r.introScript, DEFAULT.introScript),
      flowTypeQ: { ...DEFAULT.flowTypeQ, ...(r.flowTypeQ || {}) },
      collectNewPatient: Array.isArray(r.collectNewPatient) && r.collectNewPatient.length ? r.collectNewPatient : DEFAULT.collectNewPatient,
      collectReturning: Array.isArray(r.collectReturning) && r.collectReturning.length ? r.collectReturning : DEFAULT.collectReturning,
      offerTimesStyle: pick(r.offerTimesStyle, DEFAULT.offerTimesStyle),
      fallbackIfNoTime: pick(r.fallbackIfNoTime, DEFAULT.fallbackIfNoTime),
      confirmTemplate: pick(r.confirmTemplate, DEFAULT.confirmTemplate),
      setExpectations: pick(r.setExpectations, DEFAULT.setExpectations),
      offerReminder: r.offerReminder ?? DEFAULT.offerReminder,
      closingLine: pick(r.closingLine, DEFAULT.closingLine),
      kb_appointmentTypes: pick(r.kb_appointmentTypes, DEFAULT.kb_appointmentTypes),
      kb_providers: pick(r.kb_providers, DEFAULT.kb_providers),
      kb_preparation: pick(r.kb_preparation, DEFAULT.kb_preparation),
      policies: pick(r.policies, DEFAULT.policies),
      latencyMs: r.latencyMs ?? step1.responseDelayMs ?? DEFAULT.latencyMs,
      language: pick(r.language, step1.language || DEFAULT.language),
      accentIso2: pick(r.accentIso2, step1.accentIso2 || DEFAULT.accentIso2),
      fillers: pick(r.fillers, DEFAULT.fillers),
      compiled: '',
    };
  };

  const [s3, setS3] = useState<Step3>(() => hydrate(restored));
  const compiled = useMemo(() => compile(step1, s3), [step1, s3]);
  const full = useMemo(() => ({ ...s3, compiled }), [s3, compiled]);
  const { saving, saved } = useDebouncedSaver(full, 350, (v) => writeLS(LS_STEP3, v));
  const saveBadge = (
    <span className="text-xs px-2 py-1 rounded-2xl border border-white/12 text-white/70">
      {saving ? 'Saving…' : saved ? 'Saved' : 'Auto-save'}
    </span>
  );

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!s3.personaName.trim()) e.persona = 'Name is required';
    if (!s3.orgName.trim()) e.org = 'Organization is required';
    if (!s3.introScript.trim()) e.intro = 'Intro is required';
    if (!s3.confirmTemplate.trim()) e.confirm = 'Confirmation is required';
    return e;
  }, [s3]);
  const valid = Object.keys(errors).length === 0;

  const set = <K extends keyof Step3>(k: K, v: Step3[K]) => setS3(cur => ({ ...cur, [k]: v }));

  const [openPreview, setOpenPreview] = useState(false);
  const goNext = () => {
    const final = { ...s3, compiled };
    writeLS(LS_STEP3, final);
    writeLS(LS_BACKUP, { ...(readLS<any>(LS_BACKUP) || {}), step3: final });
    onNext?.();
  };

  return (
    <div className="min-h-screen w-full text-white font-movatif" style={{ background: UI.bg }}>
      <div className="w-full max-w-[1960px] mx-auto px-6 2xl:px-14 pt-10 pb-24">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex items-center justify-between mb-8"
        >
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Appointment Agent — Prompt</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setOpenPreview(true)}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/12 px-4 py-2 hover:bg-white/10"
            >
              <Eye className="w-4 h-4" /> Preview
            </button>
            {saveBadge}
          </div>
        </motion.div>

        {/* ===== 5 boxes, not overwhelming ===== */}
        <div className="grid grid-cols-12 gap-6">
          {/* 1) Identity & Purpose */}
          <div className="col-span-12 xl:col-span-6">
            <Box title="Identity & Purpose" icon={<User className="w-4 h-4 text-[#6af7d1]" />} size="lg" editable renderEdit={() => (
              <div style={CARD} className="p-5 space-y-3">
                <label className="text-xs text-white/70">Assistant Name</label>
                <input value={s3.personaName} onChange={e=>set('personaName', e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                <label className="text-xs text-white/70">Organization</label>
                <input value={s3.orgName} onChange={e=>set('orgName', e.target.value)}
                  className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                <label className="text-xs text-white/70">Purpose</label>
                <textarea value={s3.purpose} onChange={e=>set('purpose', e.target.value)}
                  rows={3} className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
              </div>
            )} saveBadge={saveBadge} error={errors.persona || errors.org}>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-white/70">Assistant</div>
                  <div className="mt-1 text-sm">{s3.personaName}</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Organization</div>
                  <div className="mt-1 text-sm">{s3.orgName}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-white/70">Purpose</div>
                <div className="mt-1 text-sm text-white/80">{s3.purpose}</div>
              </div>
            </Box>
          </div>

          {/* 2) Voice & Persona */}
          <div className="col-span-12 xl:col-span-6">
            <Box title="Voice & Persona" icon={<MessageSquare className="w-4 h-4 text-[#6af7d1]" />} size="lg" editable renderEdit={() => (
              <div style={CARD} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-white/70">Style</label>
                    <select
                      value={s3.style}
                      onChange={e=>set('style', e.target.value as Step3['style'])}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                    >
                      <option value="professional">Professional</option>
                      <option value="conversational">Conversational</option>
                      <option value="empathetic">Empathetic</option>
                      <option value="upbeat">Upbeat</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/70">Politeness</label>
                    <select
                      value={s3.politeness}
                      onChange={e=>set('politeness', e.target.value as Step3['politeness'])}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                    >
                      <option value="low">Low</option>
                      <option value="med">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-white/70 mb-1">Personality</div>
                  <ChipMulti options={PERSONALITY_CHOICES} value={s3.personalityBullets} onChange={v=>set('personalityBullets', v)} />
                </div>
                <div>
                  <div className="text-xs text-white/70 mb-1">Speech Characteristics</div>
                  <ChipMulti options={SPEECH_CHOICES} value={s3.speechBullets} onChange={v=>set('speechBullets', v)} />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-white/70">Latency (ms)</label>
                    <input
                      type="number" value={String(s3.latencyMs)} onChange={e=>set('latencyMs', Math.max(0, Number(e.target.value)||0))}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70">Language</label>
                    <input value={s3.language} onChange={e=>set('language', e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                  </div>
                  <div>
                    <label className="text-xs text-white/70">Accent (ISO-2)</label>
                    <input value={s3.accentIso2} onChange={e=>set('accentIso2', e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/70">Fillers (one per line)</label>
                  <textarea
                    rows={3}
                    value={s3.fillers}
                    onChange={e=>set('fillers', e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                  />
                </div>
              </div>
            )} saveBadge={saveBadge}>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-white/70">Style</div>
                  <div className="mt-1 text-sm">{STYLE_LABEL[s3.style]}</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Politeness</div>
                  <div className="mt-1 text-sm">{POLITE_LABEL(s3.politeness)}</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Latency</div>
                  <div className="mt-1 text-sm">{s3.latencyMs} ms</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-white/70">Language</div>
                  <div className="mt-1 text-sm">{s3.language}</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Accent</div>
                  <div className="mt-1 text-sm">{s3.accentIso2.toUpperCase()}</div>
                </div>
              </div>
              <div>
                <div className="text-xs text-white/70">Personality</div>
                <ul className="mt-1 text-sm list-disc list-inside text-white/80">
                  {s3.personalityBullets.map(b => <li key={b}>{b}</li>)}
                </ul>
              </div>
            </Box>
          </div>

          {/* 3) Conversation Flow */}
          <div className="col-span-12">
            <Box title="Conversation Flow" icon={<ClipboardList className="w-4 h-4 text-[#6af7d1]" />} size="lg" editable renderEdit={() => (
              <div style={CARD} className="p-5 space-y-4">
                <div>
                  <label className="text-xs text-white/70">Introduction (opening line)</label>
                  <input
                    value={s3.introScript}
                    onChange={e=>set('introScript', e.target.value)}
                    className="w-full mt-1 px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/12"
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Toggle checked={s3.flowTypeQ.service} onChange={v=>set('flowTypeQ', { ...s3.flowTypeQ, service: v })} label="Ask: Service Type" />
                  <Toggle checked={s3.flowTypeQ.provider} onChange={v=>set('flowTypeQ', { ...s3.flowTypeQ, provider: v })} label="Ask: Provider Preference" />
                  <Toggle checked={s3.flowTypeQ.newOrReturning} onChange={v=>set('flowTypeQ', { ...s3.flowTypeQ, newOrReturning: v })} label="Ask: New / Returning" />
                  <Toggle checked={s3.flowTypeQ.urgency} onChange={v=>set('flowTypeQ', { ...s3.flowTypeQ, urgency: v })} label="Ask: Urgency" />
                </div>
              </div>
            )} saveBadge={saveBadge} error={errors.intro}>
              <div>
                <div className="text-xs text-white/70">Intro</div>
                <div className="mt-1 text-sm text-white/80">“{s3.introScript}”</div>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {s3.flowTypeQ.service && <span className="px-2 py-1 rounded-2xl border border-white/10 bg-white/5">Service</span>}
                {s3.flowTypeQ.provider && <span className="px-2 py-1 rounded-2xl border border-white/10 bg-white/5">Provider</span>}
                {s3.flowTypeQ.newOrReturning && <span className="px-2 py-1 rounded-2xl border border-white/10 bg-white/5">New/Returning</span>}
                {s3.flowTypeQ.urgency && <span className="px-2 py-1 rounded-2xl border border-white/10 bg-white/5">Urgency</span>}
              </div>
            </Box>
          </div>

          {/* 4) Knowledge & Policies (combined box, split inside) */}
          <div className="col-span-12">
            <Box title="Knowledge & Policies" icon={<BookOpen className="w-4 h-4 text-[#6af7d1]" />} size="lg" editable renderEdit={() => (
              <div style={CARD} className="p-5 grid grid-cols-1 xl:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-white/70">Appointment Types</label>
                  <textarea value={s3.kb_appointmentTypes} onChange={e=>set('kb_appointmentTypes', e.target.value)}
                    rows={8} className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                </div>
                <div>
                  <label className="text-xs text-white/70">Provider Information</label>
                  <textarea value={s3.kb_providers} onChange={e=>set('kb_providers', e.target.value)}
                    rows={8} className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                </div>
                <div>
                  <label className="text-xs text-white/70">Preparation Requirements</label>
                  <textarea value={s3.kb_preparation} onChange={e=>set('kb_preparation', e.target.value)}
                    rows={8} className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                </div>
                <div>
                  <label className="text-xs text-white/70">Policies</label>
                  <textarea value={s3.policies} onChange={e=>set('policies', e.target.value)}
                    rows={8} className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12" />
                </div>
              </div>
            )} saveBadge={saveBadge}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-white/70">Appointment Types</div>
                  <pre className="mt-1 whitespace-pre-wrap text-white/80">{s3.kb_appointmentTypes}</pre>
                </div>
                <div>
                  <div className="text-xs text-white/70">Provider Info</div>
                  <pre className="mt-1 whitespace-pre-wrap text-white/80">{s3.kb_providers}</pre>
                </div>
                <div>
                  <div className="text-xs text-white/70">Preparation</div>
                  <pre className="mt-1 whitespace-pre-wrap text-white/80">{s3.kb_preparation}</pre>
                </div>
                <div>
                  <div className="text-xs text-white/70">Policies</div>
                  <pre className="mt-1 whitespace-pre-wrap text-white/80">{s3.policies}</pre>
                </div>
              </div>
            </Box>
          </div>

          {/* 5) Confirmation & Wrap-up (also includes Scheduling specifics to keep box count = 5) */}
          <div className="col-span-12">
            <Box title="Scheduling & Confirmation" icon={<CheckCheck className="w-4 h-4 text-[#6af7d1]" />} size="lg" editable renderEdit={() => (
              <div style={CARD} className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/70">New Patient — Collect</label>
                    <ChipMulti options={NEW_PATIENT_FIELDS} value={s3.collectNewPatient} onChange={v=>set('collectNewPatient', v)} />
                  </div>
                  <div>
                    <label className="text-xs text-white/70">Returning Patient — Collect</label>
                    <ChipMulti options={RETURNING_FIELDS} value={s3.collectReturning} onChange={v=>set('collectReturning', v)} />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/70">Offer Times Script</label>
                  <input
                    value={s3.offerTimesStyle}
                    onChange={e=>set('offerTimesStyle', e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/70">If No Suitable Time</label>
                  <input
                    value={s3.fallbackIfNoTime}
                    onChange={e=>set('fallbackIfNoTime', e.target.value)}
                    className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/70">Confirmation Line</label>
                    <textarea
                      rows={3}
                      value={s3.confirmTemplate}
                      onChange={e=>set('confirmTemplate', e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/70">Set Expectations</label>
                    <textarea
                      rows={3}
                      value={s3.setExpectations}
                      onChange={e=>set('setExpectations', e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <Toggle checked={s3.offerReminder} onChange={v=>set('offerReminder', v)} label="Offer SMS/Call reminder" />
                  <div className="w-full max-w-[520px]">
                    <label className="text-xs text-white/70">Closing Line</label>
                    <input
                      value={s3.closingLine}
                      onChange={e=>set('closingLine', e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/12"
                    />
                  </div>
                </div>
              </div>
            )} saveBadge={saveBadge} error={errors.confirm}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-white/70">New Patient — Collect</div>
                  <div className="mt-1">{s3.collectNewPatient.join(', ')}</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Returning Patient — Collect</div>
                  <div className="mt-1">{s3.collectReturning.join(', ')}</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Offer Times Script</div>
                  <div className="mt-1 text-white/80">“{s3.offerTimesStyle}”</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">If No Suitable Time</div>
                  <div className="mt-1 text-white/80">“{s3.fallbackIfNoTime}”</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-white/70">Confirmation</div>
                  <div className="mt-1 text-white/80">“{s3.confirmTemplate}”</div>
                </div>
                <div>
                  <div className="text-xs text-white/70">Expectations</div>
                  <div className="mt-1 text-white/80">“{s3.setExpectations}”</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70">Offer Reminder</span>
                  <span>{s3.offerReminder ? 'Yes' : 'No'}</span>
                </div>
                <div>
                  <div className="text-xs text-white/70">Closing</div>
                  <div className="mt-1 text-white/80">“{s3.closingLine}”</div>
                </div>
              </div>
            </Box>
          </div>
        </div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }} className="mt-10 flex items-center justify-between"
        >
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[24px] border border-white/12 px-4 py-2 hover:bg-white/10"
          >
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(compiled).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/12 px-4 py-2 hover:bg-white/10"
            >
              <Copy className="w-4 h-4" /> Copy
            </button>
            <button
              onClick={goNext}
              disabled={!valid}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold disabled:cursor-not-allowed"
              style={{ background: valid ? UI.green : UI.greenDisabled, color:'#fff', boxShadow: valid ? '0 1px 0 rgba(0,0,0,0.18)' : 'none' }}
              onMouseEnter={(e)=>{ if(!valid) return; (e.currentTarget as HTMLButtonElement).style.background=UI.greenHover; }}
              onMouseLeave={(e)=>{ if(!valid) return; (e.currentTarget as HTMLButtonElement).style.background=UI.green; }}
            >
              Next →
            </button>
          </div>
        </motion.div>
      </div>

      {/* Preview Modal */}
      <Modal open={openPreview} onClose={() => setOpenPreview(false)} title="Compiled System Prompt">
        <div style={CARD} className="p-5">
          <pre className="whitespace-pre-wrap text-sm leading-6">{compiled}</pre>
        </div>
      </Modal>
    </div>
  );
}
