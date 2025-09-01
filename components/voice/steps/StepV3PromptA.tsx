'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Copy, ArrowLeft, ArrowRight, X, User, MessageSquare, ClipboardList,
  CheckCheck, Timer, Lightbulb
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

type Step1Lite = { language: string; accentIso2?: string; responseDelayMs?: number; allowBargeIn?: boolean; };
type Step3 = {
  personaName: string;
  style: 'professional' | 'conversational' | 'empathetic' | 'upbeat';
  politeness: 'low' | 'med' | 'high';
  greetingLine: string;
  introExplain?: string;
  intents: string[];
  otherTasks?: string;
  collect: string[];
  confirmation: { confirmNames: boolean; repeatDateTime: boolean; spellBackUnusual: boolean; template?: string; };
  barge: { allow: boolean; phrases?: string };
  latency: { delayMs: number; fillers?: string };
  escalate?: { enable: boolean; humanHours?: string; handoverNumber?: string; criteria?: string };
  deflect?: { script?: string; noSensitive?: boolean };
  knowledge: { title: string; text: string }[];
  dtmf?: { [digit: string]: string };
  language: string; accentIso2: string; ttsVoice?: string; compiled?: string;
};

const LS_STEP1 = 'voicebuilder:step1';
const LS_STEP3 = 'voicebuilder:step3';
const LS_BACKUP = 'voice:settings:backup';

function readLS<T>(k: string): T | null { try { const raw = typeof window !== 'undefined' ? localStorage.getItem(k) : null; return raw ? JSON.parse(raw) as T : null; } catch { return null; } }
function writeLS<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function useDebouncedSaver<T>(value: T, delay = 400, onSave: (v: T) => void) {
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const t = useRef<number | null>(null);
  useEffect(() => { setSaving(true); setSaved(false); if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => { onSave(value); setSaving(false); setSaved(true); window.setTimeout(() => setSaved(false), 1200); }, delay);
    return () => t.current && window.clearTimeout(t.current);
  }, [value, delay, onSave]);
  return { saving, saved };
}

/* ------------------------------- UI atoms -------------------------------- */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full relative ${checked ? 'bg-emerald-400/80' : 'bg-white/10'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-black transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm text-white/90">{label}</span>
    </label>
  );
}
function ChipList({ options, value, onChange, reorderable }: { options: string[]; value: string[]; onChange: (next: string[]) => void; reorderable?: boolean; }) {
  const [dragIndex, setDragIndex] = useState<number | null>(null); const over = useRef<number | null>(null);
  function toggle(opt: string) { onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]); }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {options.map(opt => {
          const active = value.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => toggle(opt)}
              className={`px-3 py-1 rounded-full border text-xs md:text-sm ${active ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-black/30 border-white/15 text-white/70'}`}>
              {opt}
            </button>
          );
        })}
      </div>
      {reorderable && value.length > 1 && (
        <div className="grid gap-2">
          {value.map((v, i) => (
            <div key={v} draggable onDragStart={() => setDragIndex(i)} onDragEnter={() => (over.current = i)} onDragEnd={() => {
              const from = dragIndex, to = over.current; setDragIndex(null); over.current = null;
              if (from == null || to == null || from === to) return;
              const next = [...value]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); onChange(next);
            }} className="px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm">
              <span className="opacity-70 mr-2">≡</span>{i + 1}. {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ModalFrame({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col text-white font-movatif" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0"><h4 className="text-white text-lg font-semibold truncate">{title}</h4><div className="text-white/80 text-xs">Edit section</div></div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5 text-white" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', background: '#101314' }}>
          <div className="flex justify-end"><button onClick={onClose} className="px-6 py-2 rounded-[24px] border border-white/15 hover:bg-white/10">Close</button></div>
        </div>
      </div>
    </div>
  );
}
function Box({ title, subtitle, icon, children, editable, renderEdit, error, saveBadge }:{
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode;
  editable?: boolean; renderEdit?: () => React.ReactNode; error?: string; saveBadge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative rounded-3xl p-6"
         style={{ background:'rgba(13,15,17,0.92)', border:'1px solid rgba(106,247,209,0.18)', boxShadow:'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
           style={{ background:'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter:'blur(38px)' }} />
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-white/90 flex items-center gap-2">{icon}{title}</h3>
          {subtitle && <p className="text-[12px] text-white/55 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {editable && <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-2xl border inline-flex items-center gap-1.5"
                               style={{ background:'rgba(16,19,20,0.88)', border:'1px solid rgba(255,255,255,0.16)', boxShadow:'0 0 12px rgba(0,0,0,0.25)' }}>
            <MessageSquare className="w-3.5 h-3.5 text-white/80" /><span className="text-white/90">Edit</span></button>}
          {saveBadge}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {editable && renderEdit && <ModalFrame open={open} onClose={() => setOpen(false)} title={title}>{renderEdit()}</ModalFrame>}
    </div>
  );
}
function Inspiration({ text, onImport, label='Import inspiration text' }:{ text:string; onImport:()=>void; label?:string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 p-3 bg-white/5">
      <div className="flex items-center gap-2 text-white/80 text-xs mb-2"><Lightbulb className="w-3.5 h-3.5" /> Inspiration (doesn’t count until imported)</div>
      <div className="text-sm text-white/70 whitespace-pre-wrap">{text}</div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={onImport} className="px-3 py-1.5 rounded-[18px] text-sm border border-white/15 hover:bg-white/10">{label}</button>
      </div>
    </div>
  );
}

/* -------------------------------- Compiler ------------------------------- */
const STYLE_LABEL = { professional:'Professional and concise', conversational:'Natural and conversational', empathetic:'Warm and empathetic', upbeat:'Upbeat and positive' } as const;
function politenessText(p: Step3['politeness']) { if (p==='low') return 'Use direct language; no excessive formalities.'; if (p==='high') return 'Be very polite and considerate; add courteous phrases.'; return 'Maintain balanced politeness; friendly but efficient.'; }
function bullets(lines: string[]) { return lines.filter(Boolean).map(l => `- ${l}`).join('\n'); }
function compileVoicePrompt(step1: Partial<Step1Lite>, s3: Step3): string {
  const name = s3.personaName?.trim() || 'Agent'; const greet = s3.greetingLine?.trim(); const intro = (s3.introExplain || '').trim();
  const voicePersona = bullets([`${STYLE_LABEL[s3.style]}.`, politenessText(s3.politeness), s3.barge.allow ? 'Allow barge-in: pause, acknowledge, adapt.' : 'Do NOT allow barge-in; finish sentence first.']);
  const flow = s3.collect?.length ? s3.collect.map((c, i) => `${i + 1}. Ask for ${c}.`).join('\n') : '';
  const intents = s3.intents?.length ? `Primary intents: ${s3.intents.join(', ')}${s3.otherTasks ? `; Other: ${s3.otherTasks}` : ''}.` : '';
  const confirm = bullets([
    s3.confirmation.confirmNames ? 'Confirm correct spelling/pronunciation of names.' : '',
    s3.confirmation.repeatDateTime ? 'Repeat date/time details back to caller to confirm.' : '',
    s3.confirmation.spellBackUnusual ? 'Spell back unusual terms (emails, IDs) to verify.' : '',
    s3.confirmation.template ? `Use confirmation template: "${s3.confirmation.template.trim()}"` : '',
  ]);
  const latency = bullets([
    `Target response latency: ~${s3.latency.delayMs ?? step1.responseDelayMs ?? 600}ms.`,
    s3.latency.fillers ? `If thinking, use short fillers: ${s3.latency.fillers.trim()}` : '',
  ]);
  const langVoice = bullets([
    `Language: ${s3.language || step1.language || 'en'}.`,
    s3.accentIso2 ? `Accent hint: ${s3.accentIso2}.` : '',
    s3.ttsVoice ? `Preferred TTS voice label: ${s3.ttsVoice}.` : '',
    'Vendor-agnostic: do not reference specific TTS/ASR vendors.',
  ]);
  return [
    `# Voice Agent System Prompt — ${name}`, '',
    '## Identity & Purpose', intro ? `${greet} ${intro}`.trim() : greet, intents, '',
    '## Voice & Persona', voicePersona, '',
    flow ? '## Conversation Flow\n' + flow : '', '',
    confirm ? '## Confirmation Rules\n' + confirm : '', '',
    latency ? '## Latency & Fillers\n' + latency : '', '',
    '## Language & Voice', langVoice,
  ].filter(Boolean).join('\n');
}

/* ------------------------------ Constants -------------------------------- */
const INTENT_OPTIONS = ['Scheduling','Reschedule','Cancel','FAQs','Lead Capture','Handover to Human'];
const COLLECT_OPTIONS = ['Name','Phone','Email','Date/Time','Service Type','Account/Order #','Notes'];
const INSPIRATION = {
  greeting: `Hi, you're speaking with Riley. I'm here to help with scheduling, questions, and quick updates.`,
  intro: `I can book and reschedule appointments, answer common questions, and connect you with a teammate when needed.`,
  confirm: `Great — just to confirm: {name} on {date} at {time}. Is that correct?`,
  fillers: `One moment while I check that.\nLet me pull that up.\nThanks — almost done.`,
};

// ✅ Prefilled defaults so users don’t start blank
const DEFAULT_S3: Step3 = {
  personaName: 'Riley',
  style: 'professional',
  politeness: 'med',
  greetingLine: 'Hi, this is Riley from Wellness Partners, how can I help today?',
  introExplain: 'I can book, reschedule, or answer questions for you.',
  intents: ['Scheduling', 'Reschedule', 'Cancel', 'FAQs'],
  otherTasks: '',
  collect: ['Name', 'Phone', 'Date/Time', 'Service Type'],
  confirmation: {
    confirmNames: true,
    repeatDateTime: true,
    spellBackUnusual: true,
    template: 'Great — just to confirm: {name} on {date} at {time}, correct?',
  },
  barge: { allow: true, phrases: 'Go ahead… Got it… One sec.' },
  latency: { delayMs: 600, fillers: 'One moment while I check that.' },
  escalate: { enable: false, humanHours: '', handoverNumber: '', criteria: '' },
  deflect: { script: 'Sorry, I can’t help with that. Let me connect you with someone else.', noSensitive: true },
  knowledge: [],
  dtmf: {},
  language: 'en',
  accentIso2: 'us',
  ttsVoice: '',
  compiled: '',
};

/* ============================== Component A ============================== */
export default function StepV3PromptA({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  const step1 = (readLS<Step1Lite>(LS_STEP1)) || { language: 'en', accentIso2: '', responseDelayMs: 600, allowBargeIn: true };
  const restored = readLS<Step3>(LS_STEP3);
  const [s3, setS3] = useState<Step3>(() => {
    const base = restored || DEFAULT_S3;
    return {
      ...DEFAULT_S3, // ensure prefilled baseline
      ...base,
      language: base.language || step1.language || 'en',
      accentIso2: base.accentIso2 || step1.accentIso2 || 'us',
      latency: { delayMs: base.latency?.delayMs ?? step1.responseDelayMs ?? 600, fillers: base.latency?.fillers || DEFAULT_S3.latency.fillers },
      barge: { allow: base.barge?.allow ?? !!step1.allowBargeIn, phrases: base.barge?.phrases || DEFAULT_S3.barge.phrases },
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
    return e;
  }, [s3]);
  const valid = Object.keys(errors).length === 0;

  function set<K extends keyof Step3>(k: K, v: Step3[K]) { setS3(cur => ({ ...cur, [k]: v })); }
  function goNext() {
    const final = { ...s3, compiled }; writeLS(LS_STEP3, final);
    const backup = readLS<any>(LS_BACKUP) || {}; writeLS(LS_BACKUP, { ...backup, step3: final });
    onNext?.();
  }
  const saveBadge = <span className="text-xs px-2 py-1 rounded-2xl border border-white/15 text-white/70">{saving ? 'Saving…' : saved ? 'Saved' : 'Auto-save'}</span>;
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white font-movatif">
      <div className="w-full max-w-[1440px] mx-auto px-6 md:px-8 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Personality & Knowledge</h2>
            <div className="text-white/70 mt-1 text-sm">Step 3 — Part A (behavior & flow)</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <Eye className="w-4 h-4" /> Preview compiled prompt
            </button>
            {saveBadge}
            <div className="text-sm text-white/60 hidden md:block">Step 3 of 4</div>
          </div>
        </div>

        {/* ✅ No outer frame — just a wide 3-up grid like Build Step 3 */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Persona & Tone */}
          <Box title="Persona & Tone" subtitle="Voice-first personality." icon={<User className="w-4 h-4 text-[#6af7d1]" />} editable
               renderEdit={() => (
                 <div style={CARD_STYLE} className="p-5 space-y-3">
                   <div className="grid grid-cols-2 gap-3">
                     <label className="col-span-2 text-xs text-white/70">Persona name</label>
                     <input value={s3.personaName} onChange={e => set('personaName', e.target.value)}
                            className="col-span-2 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                     <label className="text-xs text-white/70">Style</label>
                     <select value={s3.style} onChange={e => set('style', e.target.value as Step3['style'])}
                             className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15">
                       <option value="professional">Professional</option>
                       <option value="conversational">Conversational</option>
                       <option value="empathetic">Empathetic</option>
                       <option value="upbeat">Upbeat</option>
                     </select>
                     <label className="text-xs text-white/70">Politeness</label>
                     <select value={s3.politeness} onChange={e => set('politeness', e.target.value as Step3['politeness'])}
                             className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15">
                       <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
                     </select>
                   </div>
                 </div>
               )}
               saveBadge={saveBadge}>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs text-white/70">Persona name</label>
              <input value={s3.personaName} onChange={e => set('personaName', e.target.value)}
                     className="col-span-2 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
              <label className="text-xs text-white/70">Style</label>
              <select value={s3.style} onChange={e => set('style', e.target.value as Step3['style'])}
                      className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm">
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="empathetic">Empathetic</option>
                <option value="upbeat">Upbeat</option>
              </select>
              <label className="text-xs text-white/70">Politeness</label>
              <select value={s3.politeness} onChange={e => set('politeness', e.target.value as Step3['politeness'])}
                      className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm">
                <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
              </select>
            </div>
          </Box>

          {/* Greeting */}
          <Box title="Opening / Greeting" subtitle="One-liner (≤120 chars)." icon={<MessageSquare className="w-4 h-4 text-[#6af7d1]" />}
               error={errors.greeting || errors.greetingLen} editable
               renderEdit={() => (
                 <div style={CARD_STYLE} className="p-5 space-y-4">
                   <input value={s3.greetingLine} onChange={e => set('greetingLine', e.target.value)}
                          placeholder="Hi, you're speaking with Riley." className="w-full px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                   <input value={s3.introExplain || ''} onChange={e => set('introExplain', e.target.value)}
                          placeholder="I can help with bookings, questions, and updates." className="w-full px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                   <Inspiration text={`${INSPIRATION.greeting}\n\n${INSPIRATION.intro}`} onImport={() => { set('greetingLine', INSPIRATION.greeting); set('introExplain', INSPIRATION.intro); }} />
                 </div>
               )}
               saveBadge={saveBadge}>
            <input value={s3.greetingLine} onChange={e => set('greetingLine', e.target.value)} placeholder="Hi, you're speaking with Riley."
                   className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
            <input value={s3.introExplain || ''} onChange={e => set('introExplain', e.target.value)} placeholder="(Optional) short role line"
                   className="mt-2 w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
            <div className="text-xs text-white/50 text-right mt-1">{s3.greetingLine.length}/120</div>
          </Box>

          {/* Intents */}
          <Box title="Core Tasks / Intents" subtitle="Choose what this agent can do." icon={<ClipboardList className="w-4 h-4 text-[#6af7d1]" />}
               error={errors.intents} editable
               renderEdit={() => (
                 <div style={CARD_STYLE} className="p-5 space-y-3">
                   <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={v => set('intents', v)} />
                   <input value={s3.otherTasks || ''} onChange={e => set('otherTasks', e.target.value)} placeholder="Other tasks (optional)"
                          className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                 </div>
               )}
               saveBadge={saveBadge}>
            <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={v => set('intents', v)} />
            <input value={s3.otherTasks || ''} onChange={e => set('otherTasks', e.target.value)} placeholder="Other tasks (optional)"
                   className="mt-3 w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
          </Box>

          {/* Collect */}
          <Box title="Information to Collect" subtitle="Drag to set ask order." icon={<ClipboardList className="w-4 h-4 text-[#6af7d1]" />}
               error={errors.collect} editable
               renderEdit={() => (<div style={CARD_STYLE} className="p-5"><ChipList options={COLLECT_OPTIONS} value={s3.collect} onChange={v => set('collect', v)} reorderable /></div>)}
               saveBadge={saveBadge}>
            <ChipList options={COLLECT_OPTIONS} value={s3.collect} onChange={v => set('collect', v)} reorderable />
          </Box>

          {/* Confirmation */}
          <Box title="Confirmation Rules" subtitle="How to confirm details." icon={<CheckCheck className="w-4 h-4 text-[#6af7d1]" />} editable
               renderEdit={() => (
                 <div style={CARD_STYLE} className="p-5 space-y-3">
                   <Toggle checked={s3.confirmation.confirmNames} onChange={v => set('confirmation', { ...s3.confirmation, confirmNames: v })} label="Confirm names" />
                   <Toggle checked={s3.confirmation.repeatDateTime} onChange={v => set('confirmation', { ...s3.confirmation, repeatDateTime: v })} label="Repeat date/time" />
                   <Toggle checked={s3.confirmation.spellBackUnusual} onChange={v => set('confirmation', { ...s3.confirmation, spellBackUnusual: v })} label="Spell back unusual terms" />
                   <textarea value={s3.confirmation.template || ''} onChange={e => set('confirmation', { ...s3.confirmation, template: e.target.value })}
                             placeholder="(Optional) confirmation template" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[120px]" />
                   <Inspiration text={INSPIRATION.confirm} onImport={() => set('confirmation', { ...s3.confirmation, template: INSPIRATION.confirm })} />
                 </div>
               )}
               saveBadge={saveBadge}>
            <div className="space-y-2">
              <Toggle checked={s3.confirmation.confirmNames} onChange={v => set('confirmation', { ...s3.confirmation, confirmNames: v })} label="Confirm names" />
              <Toggle checked={s3.confirmation.repeatDateTime} onChange={v => set('confirmation', { ...s3.confirmation, repeatDateTime: v })} label="Repeat date/time" />
              <Toggle checked={s3.confirmation.spellBackUnusual} onChange={v => set('confirmation', { ...s3.confirmation, spellBackUnusual: v })} label="Spell back unusual terms" />
              <textarea value={s3.confirmation.template || ''} onChange={e => set('confirmation', { ...s3.confirmation, template: e.target.value })}
                        placeholder="(Optional) template" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]" />
            </div>
          </Box>

          {/* Latency */}
          <Box title="Latency Cover / Thinking Filler" subtitle="Short fillers while thinking." icon={<Timer className="w-4 h-4 text-[#6af7d1]" />} editable
               renderEdit={() => (
                 <div style={CARD_STYLE} className="p-5 space-y-3">
                   <label className="text-xs text-white/70">Response delay (ms)</label>
                   <input type="number" min={0} value={s3.latency.delayMs} onChange={e => set('latency', { ...s3.latency, delayMs: Number(e.target.value || 0) })}
                          className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                   <textarea value={s3.latency.fillers || ''} onChange={e => set('latency', { ...s3.latency, fillers: e.target.value })}
                             placeholder="e.g., One moment while I check that." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[120px]" />
                   <Inspiration text={INSPIRATION.fillers} onImport={() => set('latency', { ...s3.latency, fillers: INSPIRATION.fillers })} />
                 </div>
               )}
               saveBadge={saveBadge}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
              <div>
                <label className="text-xs text-white/70">Response delay (ms)</label>
                <input type="number" min={0} value={s3.latency.delayMs} onChange={e => set('latency', { ...s3.latency, delayMs: Number(e.target.value || 0) })}
                       className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-white/70">Delay fillers</label>
                <textarea value={s3.latency.fillers || ''} onChange={e => set('latency', { ...s3.latency, fillers: e.target.value })}
                          placeholder="e.g., One moment while I check that." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]" />
              </div>
            </div>
          </Box>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10"><ArrowLeft className="w-4 h-4" /> Previous</button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigator.clipboard.writeText(compiled).catch(() => {})}
                    className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <Copy className="w-4 h-4" /> Copy compiled prompt
            </button>
            <button onClick={goNext} disabled={!valid}
                    className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold disabled:cursor-not-allowed"
                    style={{ background: valid ? BTN_GREEN : BTN_DISABLED, color:'#fff', boxShadow: valid ? '0 1px 0 rgba(0,0,0,0.18)' : 'none' }}
                    onMouseEnter={(e)=>{ if(!valid) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER; }}
                    onMouseLeave={(e)=>{ if(!valid) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN; }}>
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <ModalFrame open={previewOpen} onClose={() => setPreviewOpen(false)} title="Compiled System Prompt">
        <div style={CARD_STYLE} className="p-5"><pre className="whitespace-pre-wrap text-sm leading-6">{compiled}</pre></div>
      </ModalFrame>
    </div>
  );
}
