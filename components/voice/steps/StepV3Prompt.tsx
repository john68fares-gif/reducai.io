'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye,
  Copy,
  ArrowLeft,
  ArrowRight,
  X,
  User,
  MessageSquare,
  ClipboardList,
  CheckCheck,
  Zap,
  Timer,
  PhoneForwarded,
  ShieldAlert,
  BookOpenText,
  Keyboard,
  Languages,
  Upload,
  Edit3,
  Lightbulb
} from 'lucide-react';

/* ------------------------------- SHARED UI ------------------------------- */
const FRAME_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};
const HEADER_BORDER = { borderBottom: '1px solid rgba(255,255,255,0.4)' };
const CARD_STYLE: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* ------------------------------- TYPES/LS ------------------------------- */
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
const LS_STEP1 = 'voicebuilder:step1';
const LS_STEP3 = 'voicebuilder:step3';
const LS_BACKUP = 'voice:settings:backup';

/* -------------------------------- HELPERS ------------------------------- */
function readLS<T>(k: string): T | null {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(k) : null;
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
function isE164(v: string) {
  return /^\+[1-9]\d{6,14}$/.test(v);
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
    return () => t.current && window.clearTimeout(t.current);
  }, [value, delay, onSave]);
  return { saving, saved };
}

/* ------------------------------- INLINE ATOMS --------------------------- */
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label?: string; hint?: string }) {
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
              className="px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm"
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
        className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border text-sm"
        style={{ borderColor: error ? 'rgba(255,99,99,0.7)' : 'rgba(255,255,255,0.15)' }}
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/* ----------------------------- Inspiration UI ---------------------------- */
function Inspiration({
  text,
  onImport,
  label = 'Import inspiration text',
}: {
  text: string;
  onImport: () => void;
  label?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-3 bg-white/5">
      <div className="flex items-center gap-2 text-white/80 text-xs mb-2">
        <Lightbulb className="w-3.5 h-3.5" /> Inspiration (doesn’t count until you import)
      </div>
      <div className="text-sm text-white/70 whitespace-pre-wrap">{text}</div>
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={onImport}
          className="px-3 py-1.5 rounded-[18px] text-sm border border-white/15 hover:bg-white/10"
        >
          {label}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------- MODALS -------------------------------- */
function ModalFrame({
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
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col text-white font-movatif" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0">
            <h4 className="text-white text-lg font-semibold truncate">{title}</h4>
            <div className="text-white/80 text-xs truncate">Edit section details</div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', background: '#101314' }}>
          <div className="flex justify-end">
            <button onClick={onClose} className="px-6 py-2 rounded-[24px] border border-white/15 hover:bg-white/10 transition">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------- COMPILER ------------------------------- */
const STYLE_LABEL = {
  professional: 'Professional and concise',
  conversational: 'Natural and conversational',
  empathetic: 'Warm and empathetic',
  upbeat: 'Upbeat and positive',
} as const;
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

/* ------------------------------ CONSTANTS ------------------------------- */
const INTENT_OPTIONS = ['Scheduling', 'Reschedule', 'Cancel', 'FAQs', 'Lead Capture', 'Handover to Human'];
const COLLECT_OPTIONS = ['Name', 'Phone', 'Email', 'Date/Time', 'Service Type', 'Account/Order #', 'Notes'];
const INSPIRATION = {
  greeting: `Hi, you're speaking with Riley. I'm here to help with scheduling, questions, and quick updates.`,
  intro: `I can book and reschedule appointments, answer common questions, and connect you with a teammate when needed.`,
  confirm: `Great — just to confirm: {name} on {date} at {time}. Is that correct?`,
  barge: `No problem — go ahead. Got it. One sec, I'll adjust that.`,
  fillers: `One moment while I check that.•Let me pull that up.`,
  deflect: `I’m not able to provide advice on that topic. I can connect you with a specialist or share official resources.`,
};
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

/* =============================== COMPONENT ============================== */
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

  const compiled = useMemo(() => compileVoicePrompt(step1, s3), [step1, s3]);
  const full = useMemo(() => ({ ...s3, compiled }), [s3, compiled]);
  const { saving, saved } = useDebouncedSaver(full, 400, (v) => writeLS(LS_STEP3, v));

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
    <span className="text-xs px-2 py-1 rounded-2xl border border-white/15 text-white/70">
      {saving ? 'Saving…' : saved ? 'Saved' : 'Auto-save'}
    </span>
  );
  const [previewOpen, setPreviewOpen] = useState(false);

  /* Import modal state (Company Knowledge) */
  const [importOpen, setImportOpen] = useState(false);
  const [urls, setUrls] = useState<string[]>(['']);
  const [pasted, setPasted] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function importFilesToKnowledge(files: FileList | null) {
    if (!files || !files.length) return;
    const texts: string[] = [];
    for (const f of Array.from(files)) {
      const buf = await f.text().catch(() => '');
      if (buf) texts.push(`File: ${f.name}\n${buf}`);
    }
    if (!texts.length) return;
    const next = [...s3.knowledge];
    texts.forEach((t, i) => next.push({ title: `Imported File ${i + 1}`, text: t.slice(0, 2000) }));
    set('knowledge', next);
  }

  function importPasted() {
    const blocks = pasted.split(/\n{2,}/).map(b => b.trim()).filter(Boolean);
    if (!blocks.length) return;
    const next = [...s3.knowledge];
    blocks.forEach((t, i) => next.push({ title: `Pasted ${i + 1}`, text: t.slice(0, 2000) }));
    set('knowledge', next);
    setPasted('');
    setImportOpen(false);
  }

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white font-movatif">
      <div className="w-full max-w-[1280px] mx-auto px-6 md:px-8 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Personality & Knowledge</h2>
            <div className="text-white/70 mt-1 text-sm">Compose voice-first behavior from niche boxes — autosaved & compiled</div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPreviewOpen(true)}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
            >
              <Eye className="w-4 h-4" /> Preview compiled prompt
            </button>
            {saveBadge}
            <div className="text-sm text-white/60 hidden md:block">Step 3 of 4</div>
          </div>
        </div>

        {/* Big frame: now 3 columns at xl */}
        <div className="rounded-[30px] p-6 md:p-8 relative" style={FRAME_STYLE}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[16%] -left-[18%] w-[58%] h-[58%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Persona & Tone */}
            <Box icon={<User className="w-4 h-4 text-[#6af7d1]" />} title="Persona & Tone" subtitle="Voice-first personality." saveBadge={saveBadge} editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <label className="col-span-2 text-xs text-white/70">Persona name</label>
                  <input value={s3.personaName} onChange={e => set('personaName', e.target.value)} className="col-span-2 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                  <label className="text-xs text-white/70">Style</label>
                  <select value={s3.style} onChange={e => set('style', e.target.value as Step3['style'])} className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15">
                    <option value="professional">Professional</option>
                    <option value="conversational">Conversational</option>
                    <option value="empathetic">Empathetic</option>
                    <option value="upbeat">Upbeat</option>
                  </select>
                  <label className="text-xs text-white/70">Politeness</label>
                  <select value={s3.politeness} onChange={e => set('politeness', e.target.value as Step3['politeness'])} className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15">
                    <option value="low">Low</option>
                    <option value="med">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
            )}>
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-white/70">Persona name</label>
                <input value={s3.personaName} onChange={e => set('personaName', e.target.value)} className="col-span-2 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
                <label className="text-xs text-white/70">Style</label>
                <select value={s3.style} onChange={e => set('style', e.target.value as Step3['style'])} className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm">
                  <option value="professional">Professional</option>
                  <option value="conversational">Conversational</option>
                  <option value="empathetic">Empathetic</option>
                  <option value="upbeat">Upbeat</option>
                </select>
                <label className="text-xs text-white/70">Politeness</label>
                <select value={s3.politeness} onChange={e => set('politeness', e.target.value as Step3['politeness'])} className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm">
                  <option value="low">Low</option>
                  <option value="med">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </Box>

            {/* Greeting */}
            <Box icon={<MessageSquare className="w-4 h-4 text-[#6af7d1]" />} title="Opening / Greeting" subtitle="One-liner (≤120 chars)." error={errors.greeting || errors.greetingLen} editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-4">
                <input value={s3.greetingLine} onChange={e => set('greetingLine', e.target.value)} placeholder="Hi, you're speaking with Riley." className="w-full px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                <input value={s3.introExplain || ''} onChange={e => set('introExplain', e.target.value)} placeholder="I can help with bookings, questions, and quick updates." className="w-full px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                <Inspiration text={`${INSPIRATION.greeting}\n\n${INSPIRATION.intro}`} onImport={() => {
                  set('greetingLine', INSPIRATION.greeting);
                  set('introExplain', INSPIRATION.intro);
                }} />
              </div>
            )}>
              <input value={s3.greetingLine} onChange={e => set('greetingLine', e.target.value)} placeholder="Hi, you're speaking with Riley." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
              <input value={s3.introExplain || ''} onChange={e => set('introExplain', e.target.value)} placeholder="(Optional) short role line" className="mt-2 w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
              <div className="text-xs text-white/50 text-right mt-1">{s3.greetingLine.length}/120</div>
            </Box>

            {/* Intents */}
            <Box icon={<ClipboardList className="w-4 h-4 text-[#6af7d1]" />} title="Core Tasks / Intents" subtitle="Choose what this agent can do." error={errors.intents} editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={v => set('intents', v)} />
                <input value={s3.otherTasks || ''} onChange={e => set('otherTasks', e.target.value)} placeholder="Other tasks (optional)" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
              </div>
            )}>
              <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={v => set('intents', v)} />
              <input value={s3.otherTasks || ''} onChange={e => set('otherTasks', e.target.value)} placeholder="Other tasks (optional)" className="mt-3 w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
            </Box>

            {/* Collect */}
            <Box icon={<BookOpenText className="w-4 h-4 text-[#6af7d1]" />} title="Information to Collect" subtitle="Drag to set ask order." error={errors.collect} editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5">
                <ChipList options={COLLECT_OPTIONS} value={s3.collect} onChange={v => set('collect', v)} reorderable />
              </div>
            )}>
              <ChipList options={COLLECT_OPTIONS} value={s3.collect} onChange={v => set('collect', v)} reorderable />
            </Box>

            {/* Confirmation */}
            <Box icon={<CheckCheck className="w-4 h-4 text-[#6af7d1]" />} title="Confirmation Rules" subtitle="How to confirm details." editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <Toggle checked={s3.confirmation.confirmNames} onChange={v => set('confirmation', { ...s3.confirmation, confirmNames: v })} label="Confirm names" />
                <Toggle checked={s3.confirmation.repeatDateTime} onChange={v => set('confirmation', { ...s3.confirmation, repeatDateTime: v })} label="Repeat date/time" />
                <Toggle checked={s3.confirmation.spellBackUnusual} onChange={v => set('confirmation', { ...s3.confirmation, spellBackUnusual: v })} label="Spell back unusual terms" />
                <textarea value={s3.confirmation.template || ''} onChange={e => set('confirmation', { ...s3.confirmation, template: e.target.value })} placeholder="(Optional) confirmation template" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[120px]" />
                <Inspiration text={INSPIRATION.confirm} onImport={() => set('confirmation', { ...s3.confirmation, template: INSPIRATION.confirm })} />
              </div>
            )}>
              <div className="space-y-2">
                <Toggle checked={s3.confirmation.confirmNames} onChange={v => set('confirmation', { ...s3.confirmation, confirmNames: v })} label="Confirm names" />
                <Toggle checked={s3.confirmation.repeatDateTime} onChange={v => set('confirmation', { ...s3.confirmation, repeatDateTime: v })} label="Repeat date/time" />
                <Toggle checked={s3.confirmation.spellBackUnusual} onChange={v => set('confirmation', { ...s3.confirmation, spellBackUnusual: v })} label="Spell back unusual terms" />
                <textarea value={s3.confirmation.template || ''} onChange={e => set('confirmation', { ...s3.confirmation, template: e.target.value })} placeholder="(Optional) template" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]" />
              </div>
            </Box>

            {/* Barge-in */}
            <Box icon={<Zap className="w-4 h-4 text-[#6af7d1]" />} title="Interruptions & Barge-in" subtitle="What to say when interrupted." editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <Toggle checked={s3.barge.allow} onChange={v => set('barge', { ...s3.barge, allow: v })} label="Allow barge-in" />
                <textarea value={s3.barge.phrases || ''} onChange={e => set('barge', { ...s3.barge, phrases: e.target.value })} placeholder="Short phrases" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[120px]" />
                <Inspiration text={INSPIRATION.barge} onImport={() => set('barge', { ...s3.barge, phrases: INSPIRATION.barge })} />
              </div>
            )}>
              <Toggle checked={s3.barge.allow} onChange={v => set('barge', { ...s3.barge, allow: v })} label="Allow barge-in" />
              <textarea value={s3.barge.phrases || ''} onChange={e => set('barge', { ...s3.barge, phrases: e.target.value })} placeholder="What to say when interrupted" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]" />
            </Box>

            {/* Latency */}
            <Box icon={<Timer className="w-4 h-4 text-[#6af7d1]" />} title="Latency Cover / Thinking Filler" subtitle="Short fillers while thinking." editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <label className="text-xs text-white/70">Response delay (ms)</label>
                <input type="number" min={0} value={s3.latency.delayMs} onChange={e => set('latency', { ...s3.latency, delayMs: Number(e.target.value || 0) })} className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                <textarea value={s3.latency.fillers || ''} onChange={e => set('latency', { ...s3.latency, fillers: e.target.value })} placeholder="e.g., One moment while I check that." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[120px]" />
                <Inspiration text={INSPIRATION.fillers.replace(/•/g, '\n• ')} onImport={() => set('latency', { ...s3.latency, fillers: INSPIRATION.fillers })} />
              </div>
            )}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="text-xs text-white/70">Response delay (ms)</label>
                  <input type="number" min={0} value={s3.latency.delayMs} onChange={e => set('latency', { ...s3.latency, delayMs: Number(e.target.value || 0) })} className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/70">Delay fillers</label>
                  <textarea value={s3.latency.fillers || ''} onChange={e => set('latency', { ...s3.latency, fillers: e.target.value })} placeholder="e.g., One moment while I check that." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]" />
                </div>
              </div>
            </Box>

            {/* Escalation */}
            <Box icon={<PhoneForwarded className="w-4 h-4 text-[#6af7d1]" />} title="Escalation / Transfer" subtitle="Configure human transfer." error={errors.handover} editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <Toggle checked={!!s3.escalate?.enable} onChange={v => set('escalate', { ...s3.escalate!, enable: v })} label="Enable escalation" />
                {s3.escalate?.enable && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={s3.escalate?.humanHours || ''} onChange={e => set('escalate', { ...s3.escalate!, humanHours: e.target.value })} placeholder="Human hours" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                    <PhoneInput value={s3.escalate?.handoverNumber || ''} onChange={v => set('escalate', { ...s3.escalate!, handoverNumber: v })} placeholder="+15551234567" error={errors.handover} />
                    <textarea value={s3.escalate?.criteria || ''} onChange={e => set('escalate', { ...s3.escalate!, criteria: e.target.value })} placeholder="Handover criteria (one per line)" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[38px]" />
                  </div>
                )}
              </div>
            )}>
              <Toggle checked={!!s3.escalate?.enable} onChange={v => set('escalate', { ...s3.escalate!, enable: v })} label="Enable escalation" />
              {s3.escalate?.enable && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                  <input value={s3.escalate?.humanHours || ''} onChange={e => set('escalate', { ...s3.escalate!, humanHours: e.target.value })} placeholder="Human hours" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
                  <PhoneInput value={s3.escalate?.handoverNumber || ''} onChange={v => set('escalate', { ...s3.escalate!, handoverNumber: v })} placeholder="+15551234567" error={errors.handover} />
                  <textarea value={s3.escalate?.criteria || ''} onChange={e => set('escalate', { ...s3.escalate!, criteria: e.target.value })} placeholder="Handover criteria (one per line)" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[38px]" />
                </div>
              )}
            </Box>

            {/* Safety */}
            <Box icon={<ShieldAlert className="w-4 h-4 text-[#6af7d1]" />} title="Out-of-Scope & Safety" subtitle="Deflection & compliance." editable renderEdit={() => (
              <div style={CARD_STYLE} className="p-5 space-y-3">
                <textarea value={s3.deflect?.script || ''} onChange={e => set('deflect', { ...s3.deflect!, script: e.target.value })} placeholder="How to decline or redirect" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[140px]" />
                <Inspiration text={INSPIRATION.deflect} onImport={() => set('deflect', { ...s3.deflect!, script: INSPIRATION.deflect })} />
                <Toggle checked={!!s3.deflect?.noSensitive} onChange={v => set('deflect', { ...s3.deflect!, noSensitive: v })} label="No medical/legal advice" />
              </div>
            )}>
              <textarea value={s3.deflect?.script || ''} onChange={e => set('deflect', { ...s3.deflect!, script: e.target.value })} placeholder="How to decline or redirect" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]" />
              <div className="mt-2">
                <Toggle checked={!!s3.deflect?.noSensitive} onChange={v => set('deflect', { ...s3.deflect!, noSensitive: v })} label="No medical/legal advice" />
              </div>
            </Box>

            {/* Company Knowledge (IMPORT) */}
            <Box icon={<Upload className="w-4 h-4 text-[#6af7d1]" />} title="Company Knowledge" subtitle="Import website / files or paste text." actions={
              <button onClick={() => setImportOpen(true)} className="text-xs px-3 py-1.5 rounded-2xl border border-white/15 hover:bg-white/10 inline-flex items-center gap-1.5">
                <Upload className="w-3.5 h-3.5" /> Import
              </button>
            }>
              <div className="text-sm text-white/70">
                Use <b>Import</b> to add company facts (hours, services, policies). They become Knowledge Snippets the compiler uses.
              </div>
              {s3.knowledge.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {s3.knowledge.map((k, i) => (
                    <div key={i} className="rounded-2xl bg-[#0b0e0f] border border-white/15 p-3">
                      <div className="text-white/90 text-sm font-medium">{k.title || `Snippet ${i + 1}`}</div>
                      <div className="text-white/60 text-xs mt-1 whitespace-pre-wrap">{k.text.slice(0, 220)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Box>

            {/* Knowledge Snippets (manual) */}
            <Box icon={<BookOpenText className="w-4 h-4 text-[#6af7d1]" />} title="Knowledge Snippets (manual)" subtitle="Add/adjust specific rows." error={errors.knowledge} editable renderEdit={() => (
              <KnowledgeEditor knowledge={s3.knowledge} onChange={(rows) => set('knowledge', rows)} />
            )}>
              <KnowledgeEditor knowledge={s3.knowledge} onChange={(rows) => set('knowledge', rows)} compact />
            </Box>

            {/* DTMF */}
            <Box icon={<Keyboard className="w-4 h-4 text-[#6af7d1]" />} title="DTMF / Keypad Shortcuts" subtitle="Map digits to actions.">
              <div className="grid grid-cols-5 gap-2">
                {[...'0123456789'].map((d) => (
                  <div key={d}>
                    <label className="text-xs text-white/60">{d}</label>
                    <input
                      value={s3.dtmf?.[d] || ''}
                      onChange={(e) => set('dtmf', { ...(s3.dtmf || {}), [d]: e.target.value })}
                      placeholder="Action"
                      className="w-full px-2 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-xs"
                    />
                  </div>
                ))}
              </div>
            </Box>

            {/* Language helpers */}
            <Box icon={<Languages className="w-4 h-4 text-[#6af7d1]" />} title="Language Helpers" subtitle="Mirrors Step 1; voice is optional.">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-white/70">Language</label>
                  <input value={s3.language} readOnly className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm opacity-70" />
                </div>
                <div>
                  <label className="text-xs text-white/70">Accent (ISO2)</label>
                  <input value={s3.accentIso2 || ''} readOnly className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm opacity-70" />
                </div>
                <div>
                  <label className="text-xs text-white/70">TTS voice (optional)</label>
                  <input value={s3.ttsVoice || ''} onChange={(e) => set('ttsVoice', e.target.value)} placeholder="Vendor-agnostic voice label" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm" />
                </div>
              </div>
            </Box>
          </div>
        </div>

        {/* Footer buttons */}
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(compiled).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
            >
              <Copy className="w-4 h-4" />
              Copy compiled prompt
            </button>
            <button
              onClick={goNext}
              disabled={!valid}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                background: valid ? BTN_GREEN : BTN_DISABLED,
                color: '#ffffff',
                boxShadow: valid ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
              }}
              onMouseEnter={(e) => {
                if (!valid) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
              }}
              onMouseLeave={(e) => {
                if (!valid) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
              }}
            >
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <ModalFrame open={previewOpen} onClose={() => setPreviewOpen(false)} title="Compiled System Prompt">
        <pre className="whitespace-pre-wrap text-sm leading-6">{compiled}</pre>
      </ModalFrame>

      {/* Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="w-full max-w-3xl rounded-3xl p-6 font-movatif"
               style={{
                 background: 'linear-gradient(180deg, rgba(22,24,27,0.98) 0%, rgba(14,16,18,0.98) 100%)',
                 border: '1px solid rgba(0,255,194,0.25)',
                 boxShadow: '0 0 24px rgba(0,255,194,0.10), inset 0 0 18px rgba(0,0,0,0.40)'
               }}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold">Import Company Knowledge</h4>
                <p className="text-sm text-white/70 mt-1">Paste website content, or upload .txt/.md/.json files. (Client-only.)</p>
              </div>
              <button className="p-1 rounded-2xl border border-white/15" onClick={() => setImportOpen(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <label className="text-sm text-white/80 mt-5 block">Website URLs (optional, for your reference)</label>
            {urls.map((u, i) => (
              <input key={i} value={u} onChange={e => {
                const arr = [...urls]; arr[i] = e.target.value; setUrls(arr);
              }} placeholder="https://example.com" className="w-full rounded-2xl bg-[#0b0e0f] text-white border border-white/15 px-3 py-3 outline-none text-sm mt-2" />
            ))}
            {urls.length < 5 && (
              <button onClick={() => setUrls(p => [...p, ''])} className="mt-2 text-sm px-3 py-1.5 rounded-2xl border border-dashed border-white/20 hover:bg-white/10">
                + Add another URL
              </button>
            )}

            <label className="text-sm text-white/80 mt-5 block">Paste website or document text</label>
            <textarea value={pasted} onChange={e => setPasted(e.target.value)} className="w-full h-48 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 px-3 py-3 outline-none text-sm mt-2" placeholder="Paste content here…" />

            <div className="mt-4 flex items-center gap-3">
              <input type="file" ref={fileInputRef} multiple accept=".txt,.md,.json" className="hidden" onChange={e => importFilesToKnowledge(e.target.files)} />
              <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 rounded-2xl border border-white/15 hover:bg-white/10 inline-flex items-center gap-2">
                <Upload className="w-4 h-4" /> Upload files
              </button>
              <div className="flex-1" />
              <button onClick={importPasted} disabled={!pasted.trim()} className="px-6 py-2 rounded-[24px] font-semibold disabled:cursor-not-allowed"
                      style={{ background: pasted.trim() ? BTN_GREEN : BTN_DISABLED, color: '#fff' }}
                      onMouseEnter={(e) => { if (!pasted.trim()) return; (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
                      onMouseLeave={(e) => { if (!pasted.trim()) return; (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}>
                Add to Knowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ BOX WRAPPER ------------------------------ */
function Box({
  title,
  subtitle,
  icon,
  actions,
  children,
  saveBadge,
  error,
  editable,
  renderEdit,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  saveBadge?: React.ReactNode;
  error?: string;
  editable?: boolean;
  renderEdit?: () => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="relative rounded-3xl p-6"
      style={{
        background: 'rgba(13,15,17,0.92)',
        border: '1px solid rgba(106,247,209,0.18)',
        boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)',
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
      />
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-white/90 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {subtitle && <p className="text-[12px] text-white/55 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {editable && (
            <button
              onClick={() => setOpen(true)}
              className="text-xs px-3 py-1.5 rounded-2xl border inline-flex items-center gap-1.5"
              style={{ background: 'rgba(16,19,20,0.88)', border: '1px solid rgba(255,255,255,0.16)', boxShadow: '0 0 12px rgba(0,0,0,0.25)' }}
            >
              <Edit3 className="w-3.5 h-3.5 text-white/80" />
              <span className="text-white/90">Edit</span>
            </button>
          )}
          {saveBadge}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {editable && renderEdit && (
        <ModalFrame open={open} onClose={() => setOpen(false)} title={title}>
          {renderEdit()}
        </ModalFrame>
      )}
    </div>
  );
}

/* ------------------------- Knowledge Editor block ------------------------ */
function KnowledgeEditor({
  knowledge,
  onChange,
  compact,
}: {
  knowledge: { title: string; text: string }[];
  onChange: (rows: { title: string; text: string }[]) => void;
  compact?: boolean;
}) {
  function addRow() {
    onChange([...knowledge, { title: '', text: '' }]);
  }
  function setRow(i: number, k: 'title' | 'text', v: string) {
    const next = knowledge.map((r, idx) => (idx === i ? { ...r, [k]: v } : r));
    onChange(next);
  }
  function remove(i: number) {
    const next = knowledge.filter((_, idx) => idx !== i);
    onChange(next);
  }
  return (
    <div className="space-y-3">
      {knowledge.map((r, i) => (
        <div key={i} className={`grid ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-5'} gap-2`}>
          <input value={r.title} onChange={e => setRow(i, 'title', e.target.value)} placeholder="Title" className={`${compact ? '' : 'md:col-span-2'} px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm`} />
          <textarea value={r.text} onChange={e => setRow(i, 'text', e.target.value)} placeholder="Short text" className={`${compact ? '' : 'md:col-span-3'} px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm min-h-[48px]`} />
          <div className={`${compact ? '' : 'md:col-span-5'} flex justify-end`}>
            <button type="button" onClick={() => remove(i)} className="text-xs text-red-300/90 hover:text-red-200">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow} className="px-3 py-2 rounded-2xl text-emerald-200 text-sm" style={{ ...CARD_STYLE, border: '1px dashed rgba(0,255,194,0.35)' }}>
        Add knowledge
      </button>
    </div>
  );
}
