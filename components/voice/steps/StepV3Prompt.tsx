// components/voice/steps/StepV3Prompt.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Copy,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/* ---------- shared style (matches your Builder) ---------- */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px solid rgba(0,255,194,0.16)',
  borderRadius: 20,
  boxShadow: '0 0 40px -12px rgba(0,255,194,0.25)',
};
const BTN_OK =
  'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 hover:bg-emerald-500/25';
const BTN_MUTE =
  'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/10 text-white border border-white/15 hover:bg-white/15';
const BTN_DISABLED =
  'inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white/5 text-white/40 border border-white/10 cursor-not-allowed';

/* ---------- types ---------- */
type Step1Lite = {
  language: string;
  accentIso2?: string;
  responseDelayMs?: number;
  allowBargeIn?: boolean;
};

type Step3 = {
  personaName: string;
  style: 'professional' | 'conversational' | 'empathetic' | 'upbeat';
  politeness: 'low' | 'med' | 'high';
  greetingLine: string;
  introExplain?: string;
  intents: string[];
  otherTasks?: string;
  collect: string[];
  confirmation: {
    confirmNames: boolean;
    repeatDateTime: boolean;
    spellBackUnusual: boolean;
    template?: string;
  };
  barge: { allow: boolean; phrases?: string };
  latency: { delayMs: number; fillers?: string };
  escalate?: { enable: boolean; humanHours?: string; handoverNumber?: string; criteria?: string };
  deflect?: { script?: string; noSensitive?: boolean };
  knowledge: { title: string; text: string }[];
  dtmf?: { [digit: string]: string };
  language: string;
  accentIso2: string;
  ttsVoice?: string;
  compiled?: string;
};

/* ---------- storage keys ---------- */
const LS_STEP1 = 'voicebuilder:step1';
const LS_STEP3 = 'voicebuilder:step3';
const LS_BACKUP = 'voice:settings:backup';

/* ---------- helpers ---------- */
function readLS<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}
function writeLS<T>(k: string, v: T) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}
function useDebouncedSaver<T>(value: T, delay = 400, onSave: (v: T) => void) {
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const t = useRef<number | null>(null);

  useEffect(() => {
    setSaving(true);
    setSaved(false);
    if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => {
      onSave(value);
      setSaving(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    }, delay);
    return () => {
      if (t.current) window.clearTimeout(t.current);
    };
  }, [value, delay, onSave]);

  return { saving, saved };
}
function isE164(v: string) {
  return /^\+[1-9]\d{6,14}$/.test(v);
}

/* ---------- tiny UI atoms (in-file) ---------- */
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: string; }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full transition-colors relative ${checked ? 'bg-emerald-400/80' : 'bg-white/10'}`}
        aria-pressed={checked}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-black transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm text-white/90">
        {label}
        {hint && <span className="block text-xs text-white/50">{hint}</span>}
      </span>
    </label>
  );
}
function ChipList({
  options,
  value,
  onChange,
  reorderable,
}: {
  options: string[];
  value: string[];
  onChange: (next: string[]) => void;
  reorderable?: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const over = useRef<number | null>(null);
  function toggle(opt: string) {
    onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const active = value.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`px-3 py-1 rounded-full border text-xs md:text-sm ${active ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-black/30 border-white/15 text-white/70'}`}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {reorderable && value.length > 1 && (
        <div className="grid gap-2">
          {value.map((v, i) => (
            <div
              key={v}
              draggable
              onDragStart={() => setDragIndex(i)}
              onDragEnter={() => (over.current = i)}
              onDragEnd={() => {
                const from = dragIndex;
                const to = over.current;
                setDragIndex(null);
                over.current = null;
                if (from == null || to == null || from === to) return;
                const next = [...value];
                const [moved] = next.splice(from, 1);
                next.splice(to, 0, moved);
                onChange(next);
              }}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white/80 text-sm"
            >
              <span className="opacity-70 mr-2">≡</span>
              {i + 1}. {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ListEditor({
  rows,
  onChange,
  addLabel = 'Add row',
}: {
  rows: { id: string; title: string; text: string }[];
  onChange: (rows: { id: string; title: string; text: string }[]) => void;
  addLabel?: string;
}) {
  function add() {
    onChange([...rows, { id: crypto.randomUUID(), title: '', text: '' }]);
  }
  function remove(id: string) {
    onChange(rows.filter((r) => r.id !== id));
  }
  function edit(id: string, key: 'title' | 'text', val: string) {
    onChange(rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)));
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="grid grid-cols-1 md:grid-cols-5 gap-2">
          <input
            value={r.title}
            onChange={(e) => edit(r.id, 'title', e.target.value)}
            placeholder="Title"
            className="md:col-span-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
          />
          <textarea
            value={r.text}
            onChange={(e) => edit(r.id, 'text', e.target.value)}
            placeholder="Short text"
            className="md:col-span-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm min-h-[38px]"
          />
          <div className="md:col-span-5 flex justify-end">
            <button type="button" onClick={() => remove(r.id)} className="text-xs text-red-300/90 hover:text-red-200">
              Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add} className="px-3 py-1.5 rounded-md bg-emerald-500/20 text-emerald-200 text-sm border border-emerald-400/40">
        {addLabel}
      </button>
    </div>
  );
}
function PhoneInput({
  value,
  onChange,
  placeholder = '+15551234567',
  error,
}: {
  value?: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <input
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 rounded-lg bg-white/5 border text-sm ${error ? 'border-red-400/70' : 'border-white/10'}`}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div style={CARD_STYLE} className="w-full max-w-3xl p-5 border border-emerald-500/10 relative">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-emerald-300 font-semibold">{title}</h3>
          <button className="text-white/60 hover:text-white" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="max-h-[65vh] overflow-auto">{children}</div>
      </div>
    </div>
  );
}

/* ---------- compiler (pure function) ---------- */
const STYLE_LABEL: Record<Step3['style'], string> = {
  professional: 'Professional and concise',
  conversational: 'Natural and conversational',
  empathetic: 'Warm and empathetic',
  upbeat: 'Upbeat and positive',
};
function politenessText(p: Step3['politeness']) {
  if (p === 'low') return 'Use direct language; no excessive formalities.';
  if (p === 'high') return 'Be very polite and considerate; add courteous phrases.';
  return 'Maintain balanced politeness; friendly but efficient.';
}
function bullets(lines: string[]) {
  return lines.filter(Boolean).map((l) => `- ${l}`).join('\n');
}
function compileVoicePrompt(step1: Partial<Step1Lite>, s3: Step3): string {
  const name = s3.personaName?.trim() || 'Agent';
  const greet = s3.greetingLine?.trim();
  const intro = (s3.introExplain || '').trim();

  const voicePersona = bullets([
    `${STYLE_LABEL[s3.style]}.`,
    politenessText(s3.politeness),
    s3.barge.allow
      ? 'Allow barge-in: if caller speaks while I am talking, pause, acknowledge, and adapt.'
      : 'Do NOT allow barge-in; complete the current sentence before listening again.',
  ]);

  const flow = s3.collect?.length ? s3.collect.map((c, i) => `${i + 1}. Ask for ${c}.`).join('\n') : '';
  const intents =
    s3.intents?.length
      ? `Primary intents: ${s3.intents.join(', ')}${s3.otherTasks ? `; Other: ${s3.otherTasks}` : ''}.`
      : '';

  const confirm = bullets([
    s3.confirmation.confirmNames ? 'Confirm correct spelling/pronunciation of names.' : '',
    s3.confirmation.repeatDateTime ? 'Repeat date/time details back to caller to confirm.' : '',
    s3.confirmation.spellBackUnusual ? 'Spell back unusual terms (e.g., emails, IDs) to verify.' : '',
    s3.confirmation.template ? `Use confirmation template: "${s3.confirmation.template.trim()}"` : '',
  ]);

  const interrupt = bullets([s3.barge.phrases ? `When interrupted, briefly acknowledge: ${s3.barge.phrases.trim()}` : '']);
  const latency = bullets([
    `Target response latency: ~${s3.latency.delayMs ?? step1.responseDelayMs ?? 600}ms.`,
    s3.latency.fillers ? `If thinking, use short fillers: ${s3.latency.fillers.trim()}` : '',
  ]);

  const escalate = s3.escalate?.enable
    ? `Escalation / Transfer
- Hours: ${s3.escalate.humanHours || 'Not specified'}
- Handover number: ${s3.escalate.handoverNumber || 'Not provided'}
- Criteria:
${(s3.escalate.criteria || '')
  .split('\n')
  .map((l) => l.trim())
  .filter(Boolean)
  .map((l) => `  • ${l}`)
  .join('\n')}`
    : '';

  const safety = bullets([
    s3.deflect?.script ? `Out-of-scope deflection script: ${s3.deflect.script.trim()}` : '',
    s3.deflect?.noSensitive ? 'Do not provide medical, legal, or other sensitive professional advice; redirect to a human.' : '',
  ]);

  const knowledge = s3.knowledge?.length ? s3.knowledge.map((k) => `• ${k.title.trim()}: ${k.text.trim()}`).join('\n') : '';

  const langVoice = bullets([
    `Language: ${s3.language || step1.language || 'en'}.`,
    s3.accentIso2 ? `Accent hint: ${s3.accentIso2}.` : '',
    s3.ttsVoice ? `Preferred TTS voice label: ${s3.ttsVoice}.` : '',
    'Vendor-agnostic: do not reference specific TTS/ASR vendors.',
  ]);

  const dtmfLines =
    s3.dtmf && Object.keys(s3.dtmf).length ? Object.entries(s3.dtmf).map(([d, a]) => `  ${d} → ${a}`).join('\n') : '';
  const dtmf = dtmfLines ? `DTMF / Keypad Shortcuts\n${dtmfLines}` : '';

  return [
    `# Voice Agent System Prompt — ${name}`,
    '',
    '## Identity & Purpose',
    intro ? `${greet} ${intro}`.trim() : greet,
    intents,
    '',
    '## Voice & Persona',
    voicePersona,
    '',
    flow ? '## Conversation Flow\n' + flow : '',
    '',
    confirm ? '## Confirmation Rules\n' + confirm : '',
    '',
    interrupt ? '## Interruptions & Barge-in\n' + interrupt : '',
    '',
    latency ? '## Latency & Fillers\n' + latency : '',
    '',
    escalate ? '## ' + escalate : '',
    '',
    safety ? '## Out-of-Scope & Safety\n' + safety : '',
    '',
    knowledge ? '## Knowledge Base\n' + knowledge : '',
    '',
    dtmf ? '## ' + dtmf : '',
    '',
    '## Language & Voice',
    langVoice,
  ]
    .filter(Boolean)
    .join('\n');
}

/* ---------- constants ---------- */
const INTENT_OPTIONS = ['Scheduling', 'Reschedule', 'Cancel', 'FAQs', 'Lead Capture', 'Handover to Human'];
const COLLECT_OPTIONS = ['Name', 'Phone', 'Email', 'Date/Time', 'Service Type', 'Account/Order #', 'Notes'];

const DEFAULT_S3: Step3 = {
  personaName: 'Riley',
  style: 'professional',
  politeness: 'med',
  greetingLine: '',
  introExplain: '',
  intents: [],
  otherTasks: '',
  collect: [],
  confirmation: { confirmNames: true, repeatDateTime: true, spellBackUnusual: true, template: '' },
  barge: { allow: true, phrases: '' },
  latency: { delayMs: 600, fillers: '' },
  escalate: { enable: false, humanHours: '', handoverNumber: '', criteria: '' },
  deflect: { script: '', noSensitive: true },
  knowledge: [],
  dtmf: {},
  language: 'en',
  accentIso2: '',
  ttsVoice: '',
  compiled: '',
};

/* =========================================================
   STEP 3 — Personality & Knowledge
   (two-column niche boxes, autosave, validation, preview)
========================================================= */
export default function StepV3Prompt({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  const step1 = (readLS<Step1Lite>(LS_STEP1)) || { language: 'en', accentIso2: '', responseDelayMs: 600, allowBargeIn: true };
  const restored = readLS<Step3>(LS_STEP3);

  const [s3, setS3] = useState<Step3>(() => {
    const base = restored || DEFAULT_S3;
    return {
      ...base,
      language: base.language || step1.language || 'en',
      accentIso2: base.accentIso2 || step1.accentIso2 || '',
      latency: { delayMs: base.latency?.delayMs ?? step1.responseDelayMs ?? 600, fillers: base.latency?.fillers || '' },
      barge: { allow: base.barge?.allow ?? !!step1.allowBargeIn, phrases: base.barge?.phrases || '' },
    };
  });

  // compile + autosave
  const compiled = useMemo(() => compileVoicePrompt(step1, s3), [step1, s3]);
  const full = useMemo(() => ({ ...s3, compiled }), [s3, compiled]);
  const { saving, saved } = useDebouncedSaver(full, 400, (v) => writeLS(LS_STEP3, v));

  // validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!s3.greetingLine.trim()) e.greeting = 'Greeting is required';
    if (s3.greetingLine.length > 120) e.greetingLen = 'Max 120 characters';
    if (!s3.intents.length) e.intents = 'Choose at least one intent';
    if (!s3.collect.length) e.collect = 'Choose at least one item to collect';
    const knowledgeOK = s3.knowledge.length > 0 || s3.intents.some((i) => i !== 'FAQs');
    if (!knowledgeOK) e.knowledge = 'Add knowledge or include a non-FAQ intent';
    if (s3.escalate?.enable && s3.escalate?.handoverNumber && !isE164(s3.escalate.handoverNumber)) {
      e.handover = 'Handover number must be in E.164 (+) format';
    }
    return e;
  }, [s3]);
  const valid = Object.keys(errors).length === 0;

  function set<K extends keyof Step3>(k: K, v: Step3[K]) {
    setS3((cur) => ({ ...cur, [k]: v }));
  }
  function goNext() {
    const final = { ...s3, compiled };
    writeLS(LS_STEP3, final);
    const backup = readLS<any>(LS_BACKUP) || {};
    writeLS(LS_BACKUP, { ...backup, step3: final });
    onNext?.();
  }

  const saveBadge = (
    <span className="text-xs px-2 py-1 rounded-md border border-white/15 text-white/70">
      {saving ? 'Saving…' : saved ? 'Saved' : 'Auto-save'}
    </span>
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="w-full mx-auto max-w-6xl">
      {/* header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-white">Personality & Knowledge</h2>
          <p className="text-white/60 text-sm">Step 3 / 4</p>
        </div>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setPreviewOpen(true)} className={BTN_MUTE}>
            <Eye className="w-4 h-4" /> Preview compiled prompt
          </button>
          {saveBadge}
        </div>
      </div>

      {/* big glowing card */}
      <div style={CARD_STYLE} className="p-4 md:p-6 border border-emerald-500/10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* Persona & Tone */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Persona & Tone</h3>
                <p className="text-emerald-200/60 text-xs md:text-sm mt-1">Voice-first personality settings.</p>
              </div>
              {saveBadge}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs text-white/70">Persona name</label>
              <input
                value={s3.personaName}
                onChange={(e) => set('personaName', e.target.value)}
                className="col-span-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                placeholder="Riley"
              />

              <label className="text-xs text-white/70">Style</label>
              <select
                value={s3.style}
                onChange={(e) => set('style', e.target.value as Step3['style'])}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="empathetic">Empathetic</option>
                <option value="upbeat">Upbeat</option>
              </select>

              <label className="text-xs text-white/70">Politeness</label>
              <select
                value={s3.politeness}
                onChange={(e) => set('politeness', e.target.value as Step3['politeness'])}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
              >
                <option value="low">Low</option>
                <option value="med">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </section>

          {/* Opening / Greeting */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Opening / Greeting</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">One-liner greeting (max 120 chars).</p>
            <input
              value={s3.greetingLine}
              onChange={(e) => set('greetingLine', e.target.value)}
              placeholder={`Hi, you're speaking with ${s3.personaName}.`}
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
            />
            <input
              value={s3.introExplain || ''}
              onChange={(e) => set('introExplain', e.target.value)}
              placeholder="(Optional) Short line about role, e.g., “I can help with bookings.”"
              className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
            />
            <div className="text-xs text-white/50 text-right mt-1">{s3.greetingLine.length}/120</div>
            {(errors.greeting || errors.greetingLen) && (
              <p className="mt-2 text-xs text-red-400">{errors.greeting || errors.greetingLen}</p>
            )}
          </section>

          {/* Core Tasks / Intents */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Core Tasks / Intents</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">Choose what this agent can do.</p>
            <div className="mt-3">
              <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={(v) => set('intents', v)} />
            </div>
            <input
              value={s3.otherTasks || ''}
              onChange={(e) => set('otherTasks', e.target.value)}
              placeholder="Other tasks (optional)"
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
            />
            {errors.intents && <p className="mt-2 text-xs text-red-400">{errors.intents}</p>}
          </section>

          {/* Information to Collect */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Information to Collect</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">Order determines ask order.</p>
            <div className="mt-3">
              <ChipList
                options={COLLECT_OPTIONS}
                value={s3.collect}
                onChange={(v) => set('collect', v)}
                reorderable
              />
            </div>
            {errors.collect && <p className="mt-2 text-xs text-red-400">{errors.collect}</p>}
          </section>

          {/* Confirmation Rules */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Confirmation Rules</h3>
            <div className="mt-3 space-y-2">
              <Toggle
                checked={s3.confirmation.confirmNames}
                onChange={(v) => set('confirmation', { ...s3.confirmation, confirmNames: v })}
                label="Confirm names"
              />
              <Toggle
                checked={s3.confirmation.repeatDateTime}
                onChange={(v) => set('confirmation', { ...s3.confirmation, repeatDateTime: v })}
                label="Repeat date/time"
              />
              <Toggle
                checked={s3.confirmation.spellBackUnusual}
                onChange={(v) => set('confirmation', { ...s3.confirmation, spellBackUnusual: v })}
                label="Spell back unusual terms"
              />
              <textarea
                value={s3.confirmation.template || ''}
                onChange={(e) => set('confirmation', { ...s3.confirmation, template: e.target.value })}
                placeholder="(Optional) Short confirmation template"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm min-h-[70px]"
              />
            </div>
          </section>

          {/* Interruptions & Barge-in */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Interruptions & Barge-in</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">How to handle interruptions.</p>
            <div className="mt-3 space-y-2">
              <Toggle
                checked={s3.barge.allow}
                onChange={(v) => set('barge', { ...s3.barge, allow: v })}
                label="Allow barge-in"
              />
              <textarea
                value={s3.barge.phrases || ''}
                onChange={(e) => set('barge', { ...s3.barge, phrases: e.target.value })}
                placeholder="What to say when interrupted (short phrases)"
                className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm min-h-[70px]"
              />
            </div>
          </section>

          {/* Latency Cover / Thinking Filler */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Latency Cover / Thinking Filler</h3>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div>
                <label className="text-xs text-white/70">Response delay (ms)</label>
                <input
                  type="number"
                  min={0}
                  value={s3.latency.delayMs}
                  onChange={(e) => set('latency', { ...s3.latency, delayMs: Number(e.target.value || 0) })}
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/70">Delay fillers</label>
                <textarea
                  value={s3.latency.fillers || ''}
                  onChange={(e) => set('latency', { ...s3.latency, fillers: e.target.value })}
                  placeholder="e.g., One moment while I check that."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm min-h-[70px]"
                />
              </div>
            </div>
          </section>

          {/* Escalation / Transfer */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Escalation / Transfer</h3>
            <div className="mt-3 space-y-2">
              <Toggle
                checked={!!s3.escalate?.enable}
                onChange={(v) => set('escalate', { ...s3.escalate!, enable: v })}
                label="Enable escalation"
              />
              {s3.escalate?.enable && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    value={s3.escalate?.humanHours || ''}
                    onChange={(e) => set('escalate', { ...s3.escalate!, humanHours: e.target.value })}
                    placeholder="Human hours"
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                  />
                  <PhoneInput
                    value={s3.escalate?.handoverNumber || ''}
                    onChange={(v) => set('escalate', { ...s3.escalate!, handoverNumber: v })}
                    placeholder="+15551234567"
                    error={errors.handover}
                  />
                  <textarea
                    value={s3.escalate?.criteria || ''}
                    onChange={(e) => set('escalate', { ...s3.escalate!, criteria: e.target.value })}
                    placeholder="Handover criteria (one per line)"
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm min-h-[38px]"
                  />
                </div>
              )}
            </div>
          </section>

          {/* Out-of-Scope & Safety */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Out-of-Scope & Safety</h3>
            <textarea
              value={s3.deflect?.script || ''}
              onChange={(e) => set('deflect', { ...s3.deflect!, script: e.target.value })}
              placeholder="How to decline or redirect"
              className="mt-3 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm min-h-[70px]"
            />
            <div className="mt-2">
              <Toggle
                checked={!!s3.deflect?.noSensitive}
                onChange={(v) => set('deflect', { ...s3.deflect!, noSensitive: v })}
                label="No medical/legal advice"
              />
            </div>
          </section>

          {/* Knowledge Snippets */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Knowledge Snippets</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">Business facts: hours, location, policies.</p>
            <div className="mt-3">
              <ListEditor
                rows={s3.knowledge.map((k, i) => ({ id: String(i), title: k.title, text: k.text }))}
                onChange={(rows) => set('knowledge', rows.map((r) => ({ title: r.title, text: r.text })))}
                addLabel="Add knowledge"
              />
            </div>
            {errors.knowledge && <p className="mt-2 text-xs text-red-400">{errors.knowledge}</p>}
          </section>

          {/* DTMF / Keypad */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">DTMF / Keypad Shortcuts (optional)</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">Map digits to actions.</p>
            <div className="grid grid-cols-5 gap-2 mt-3">
              {[...'0123456789'].map((d) => (
                <div key={d} className="col-span-1">
                  <label className="text-xs text-white/60">{d}</label>
                  <input
                    value={s3.dtmf?.[d] || ''}
                    onChange={(e) => set('dtmf', { ...(s3.dtmf || {}), [d]: e.target.value })}
                    placeholder="Action"
                    className="w-full px-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Language Helpers (read-only) */}
          <section style={CARD_STYLE} className="p-4 border border-emerald-500/10">
            <h3 className="text-emerald-300 text-sm md:text-base font-semibold">Language Helpers</h3>
            <p className="text-emerald-200/60 text-xs md:text-sm mt-1">Mirrors Step 1; voice is optional.</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
              <div>
                <label className="text-xs text-white/70">Language</label>
                <input value={s3.language} readOnly className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm opacity-70" />
              </div>
              <div>
                <label className="text-xs text-white/70">Accent (ISO2)</label>
                <input value={s3.accentIso2 || ''} readOnly className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm opacity-70" />
              </div>
              <div>
                <label className="text-xs text-white/70">TTS voice (optional)</label>
                <input
                  value={s3.ttsVoice || ''}
                  onChange={(e) => set('ttsVoice', e.target.value)}
                  placeholder="Vendor-agnostic voice label"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm"
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* bottom bar */}
      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={onBack} className={BTN_MUTE}>
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(compiled).catch(() => {})}
            className={BTN_MUTE}
          >
            <Copy className="w-4 h-4" /> Copy compiled prompt
          </button>
          <button type="button" disabled={!valid} onClick={goNext} className={valid ? BTN_OK : BTN_DISABLED}>
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* preview modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Compiled System Prompt">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-white/90 bg-black/30 p-4 rounded-lg border border-white/10">
{compiled}
        </pre>
      </Modal>
    </div>
  );
}
