'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Copy, ArrowLeft, X, User, MessageSquare, ClipboardList, Lightbulb
} from 'lucide-react';

/* ------------------------------- CLEAN THEME ------------------------------ */
/* Subtle, trustworthy styling: no neon, no dashed borders, no glow */
const CARD: React.CSSProperties = {
  background: '#0f1115',
  border: '1px solid rgba(255,255,255,0.10)',
  borderRadius: 16,
  boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
};

const BTN_PRI = '#3fb07f';
const BTN_PRI_HOVER = '#36a073';
const BTN_DISABLED = '#2d3b37';

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
    t.current = window.setTimeout(() => { onSave(value); setSaving(false); setSaved(true); window.setTimeout(() => setSaved(false), 1000); }, delay);
    return () => t.current && window.clearTimeout(t.current);
  }, [value, delay, onSave]);
  return { saving, saved };
}

/* ------------------------------- UI atoms -------------------------------- */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)} className={`w-11 h-6 rounded-full relative transition ${checked ? 'bg-emerald-500/70' : 'bg-white/10'}`}>
        <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-black transition-transform ${checked ? 'translate-x-5' : ''}`} />
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
              className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition ${
                active ? 'bg-emerald-500/10 border-emerald-400 text-emerald-200' : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
              }`}>
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
            }} className="px-3 py-2 rounded-xl bg-[#0f1115] text-white border border-white/10 text-sm">
              <span className="opacity-60 mr-2">≡</span>{i + 1}. {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Modal({ open, onClose, title, children }:{ open:boolean; onClose:()=>void; title:string; children:React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center px-4" style={{ background:'rgba(0,0,0,0.55)' }}>
      <div className="w-full max-w-[920px] max-h-[86vh] flex flex-col text-white font-movatif" style={CARD}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="min-w-0">
            <h4 className="text-white text-base font-semibold truncate">{title}</h4>
            <p className="text-xs text-white/60">Edit section</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        <div className="px-5 py-4 border-t border-white/10 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 rounded-[10px] border border-white/10 hover:bg-white/10">Close</button>
        </div>
      </div>
    </div>
  );
}

function CardBox({ title, subtitle, icon, children, editable, renderEdit, error, saveBadge }:{
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode;
  editable?: boolean; renderEdit?: () => React.ReactNode; error?: string; saveBadge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative p-5" style={CARD}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-white/90 flex items-center gap-2">{icon}{title}</h3>
          {subtitle && <p className="text-[12px] text-white/55 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {editable && (
            <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-[10px] border border-white/10 hover:bg-white/10 inline-flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-white/80" />
              <span className="text-white/90">Edit</span>
            </button>
          )}
          {saveBadge}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {editable && renderEdit && <Modal open={open} onClose={() => setOpen(false)} title={title}>{renderEdit()}</Modal>}
    </div>
  );
}

function Inspiration({ text, onImport, label='Import inspiration text' }:{ text:string; onImport:()=>void; label?:string }) {
  return (
    <div className="rounded-[10px] border border-dashed border-white/12 p-3 bg-white/5">
      <div className="flex items-center gap-2 text-white/80 text-xs mb-2">
        <Lightbulb className="w-3.5 h-3.5" /> Inspiration (doesn’t count until imported)
      </div>
      <div className="text-sm text-white/75 whitespace-pre-wrap">{text}</div>
      <div className="mt-2 flex justify-end">
        <button type="button" onClick={onImport} className="px-3 py-1.5 rounded-[10px] text-sm border border-white/10 hover:bg-white/10">{label}</button>
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

/* ------------------------------ Defaults --------------------------------- */
const INTENT_OPTIONS = ['Scheduling','Reschedule','Cancel','FAQs','Lead Capture','Handover to Human'];
const COLLECT_OPTIONS = ['Name','Phone','Email','Date/Time','Service Type','Account/Order #','Notes'];
const INSPIRATION = {
  greeting: `Hi, you're speaking with Riley. I'm here to help with scheduling, questions, and quick updates.`,
  intro: `I can book and reschedule appointments, answer common questions, and connect you with a teammate when needed.`,
};

// Prefilled baseline (clean & realistic)
const DEFAULT_S3: Step3 = {
  personaName: 'Riley',
  style: 'professional',
  politeness: 'med',
  greetingLine: 'Hi, this is Riley from Wellness Partners — how can I help today?',
  introExplain: 'I can book, reschedule, or answer questions for you.',
  intents: ['Scheduling', 'Reschedule', 'Cancel', 'FAQs'],
  otherTasks: '',
  collect: ['Name', 'Phone', 'Date/Time', 'Service Type'],
  confirmation: { confirmNames: true, repeatDateTime: true, spellBackUnusual: true, template: '' },
  barge: { allow: true, phrases: '' },
  latency: { delayMs: 600, fillers: '' },
  escalate: { enable: false, humanHours: '', handoverNumber: '', criteria: '' },
  deflect: { script: '', noSensitive: true },
  knowledge: [],
  dtmf: {},
  language: 'en',
  accentIso2: 'us',
  ttsVoice: '',
  compiled: '',
};

/* ============================== Step 3 — A =============================== */
/* A keeps only 4 boxes now: Persona, Greeting, Intents, Collect
   (Confirmation & Latency moved to Step 3B so the editor feels lighter) */
export default function StepV3PromptA({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  const step1 = (readLS<Step1Lite>(LS_STEP1)) || { language: 'en', accentIso2: 'us', responseDelayMs: 600, allowBargeIn: true };
  const restored = readLS<Step3>(LS_STEP3);
  const [s3, setS3] = useState<Step3>(() => {
    const base = restored || DEFAULT_S3;
    return {
      ...DEFAULT_S3,
      ...base,
      language: base.language || step1.language || 'en',
      accentIso2: base.accentIso2 || step1.accentIso2 || 'us',
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
  const saveBadge = <span className="text-xs px-2 py-1 rounded-[8px] border border-white/10 text-white/70">{saving ? 'Saving…' : saved ? 'Saved' : 'Auto-save'}</span>;
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white font-movatif">
      <div className="w-full max-w-[1440px] mx-auto px-6 md:px-8 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Personality & Knowledge</h2>
            <div className="text-white/70 mt-1 text-sm">Step 3 — Part A (core behavior)</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 px-4 py-2 hover:bg-white/10">
              <Eye className="w-4 h-4" /> Preview compiled prompt
            </button>
            {saveBadge}
          </div>
        </div>

        {/* Clean, wide 3-up grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Persona & Tone */}
          <CardBox title="Persona & Tone" subtitle="Voice personality" icon={<User className="w-4 h-4 text-white/80" />} editable
                   renderEdit={() => (
                     <div style={CARD} className="p-5 space-y-3">
                       <div className="grid grid-cols-2 gap-3">
                         <label className="col-span-2 text-xs text-white/70">Persona name</label>
                         <input value={s3.personaName} onChange={e => set('personaName', e.target.value)}
                                className="col-span-2 px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10" />
                         <label className="text-xs text-white/70">Style</label>
                         <select value={s3.style} onChange={e => set('style', e.target.value as Step3['style'])}
                                 className="px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10">
                           <option value="professional">Professional</option>
                           <option value="conversational">Conversational</option>
                           <option value="empathetic">Empathetic</option>
                           <option value="upbeat">Upbeat</option>
                         </select>
                         <label className="text-xs text-white/70">Politeness</label>
                         <select value={s3.politeness} onChange={e => set('politeness', e.target.value as Step3['politeness'])}
                                 className="px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10">
                           <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
                         </select>
                       </div>
                     </div>
                   )}
                   saveBadge={saveBadge}>
            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs text-white/70">Persona name</label>
              <input value={s3.personaName} onChange={e => set('personaName', e.target.value)}
                     className="col-span-2 px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 text-sm" />
              <label className="text-xs text-white/70">Style</label>
              <select value={s3.style} onChange={e => set('style', e.target.value as Step3['style'])}
                      className="px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 text-sm">
                <option value="professional">Professional</option>
                <option value="conversational">Conversational</option>
                <option value="empathetic">Empathetic</option>
                <option value="upbeat">Upbeat</option>
              </select>
              <label className="text-xs text-white/70">Politeness</label>
              <select value={s3.politeness} onChange={e => set('politeness', e.target.value as Step3['politeness'])}
                      className="px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 text-sm">
                <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
              </select>
            </div>
          </CardBox>

          {/* Greeting */}
          <CardBox title="Opening / Greeting" subtitle="One-liner (≤120 chars)" icon={<MessageSquare className="w-4 h-4 text-white/80" />}
                   error={errors.greeting || errors.greetingLen} editable
                   renderEdit={() => (
                     <div style={CARD} className="p-5 space-y-4">
                       <input value={s3.greetingLine} onChange={e => set('greetingLine', e.target.value)}
                              placeholder="Hi, you're speaking with Riley." className="w-full px-3 py-3 rounded-[10px] bg-[#0b0e0f] border border-white/10" />
                       <input value={s3.introExplain || ''} onChange={e => set('introExplain', e.target.value)}
                              placeholder="I can help with bookings, questions, and updates." className="w-full px-3 py-3 rounded-[10px] bg-[#0b0e0f] border border-white/10" />
                       <Inspiration text={`${INSPIRATION.greeting}\n\n${INSPIRATION.intro}`} onImport={() => { set('greetingLine', INSPIRATION.greeting); set('introExplain', INSPIRATION.intro); }} />
                     </div>
                   )}
                   saveBadge={saveBadge}>
            <input value={s3.greetingLine} onChange={e => set('greetingLine', e.target.value)} placeholder="Hi, you're speaking with Riley."
                   className="w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 text-sm" />
            <input value={s3.introExplain || ''} onChange={e => set('introExplain', e.target.value)} placeholder="(Optional) short role line"
                   className="mt-2 w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 text-sm" />
            <div className="text-xs text-white/50 text-right mt-1">{s3.greetingLine.length}/120</div>
          </CardBox>

          {/* Intents */}
          <CardBox title="Core Tasks / Intents" subtitle="What the agent can do" icon={<ClipboardList className="w-4 h-4 text-white/80" />}
                   error={errors.intents} editable
                   renderEdit={() => (
                     <div style={CARD} className="p-5 space-y-3">
                       <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={v => set('intents', v)} />
                       <input value={s3.otherTasks || ''} onChange={e => set('otherTasks', e.target.value)} placeholder="Other tasks (optional)"
                              className="w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10" />
                     </div>
                   )}
                   saveBadge={saveBadge}>
            <ChipList options={INTENT_OPTIONS} value={s3.intents} onChange={v => set('intents', v)} />
            <input value={s3.otherTasks || ''} onChange={e => set('otherTasks', e.target.value)} placeholder="Other tasks (optional)"
                   className="mt-3 w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 text-sm" />
          </CardBox>

          {/* Collect */}
          <CardBox title="Information to Collect" subtitle="Drag to set ask order" icon={<ClipboardList className="w-4 h-4 text-white/80" />}
                   error={errors.collect} editable
                   renderEdit={() => (<div style={CARD} className="p-5"><ChipList options={COLLECT_OPTIONS} value={s3.collect} onChange={v => set('collect', v)} reorderable /></div>)}
                   saveBadge={saveBadge}>
            <ChipList options={COLLECT_OPTIONS} value={s3.collect} onChange={v => set('collect', v)} reorderable />
          </CardBox>
        </div>

        {/* Footer */}
        <div className="mt-8 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 px-4 py-2 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigator.clipboard.writeText(compiled).catch(() => {})}
                    className="inline-flex items-center gap-2 rounded-[10px] border border-white/10 px-4 py-2 hover:bg-white/10">
              <Copy className="w-4 h-4" /> Copy compiled prompt
            </button>
            <button onClick={goNext} disabled={!valid}
                    className="inline-flex items-center gap-2 px-7 py-2.5 rounded-[10px] font-semibold disabled:cursor-not-allowed"
                    style={{ background: valid ? BTN_PRI : BTN_DISABLED, color:'#fff', boxShadow: valid ? '0 1px 0 rgba(0,0,0,0.18)' : 'none' }}
                    onMouseEnter={(e)=>{ if(!valid) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_PRI_HOVER; }}
                    onMouseLeave={(e)=>{ if(!valid) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_PRI; }}>
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      <Modal open={previewOpen} onClose={() => setPreviewOpen(false)} title="Compiled System Prompt">
        <div style={CARD} className="p-5"><pre className="whitespace-pre-wrap text-sm leading-6">{compiled}</pre></div>
      </Modal>
    </div>
  );
}
