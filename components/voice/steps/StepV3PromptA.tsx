'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Copy, ArrowLeft, X, User, MessageSquare, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ============================ THEME ============================ */
const UI = {
  bg: '#0b0c10',
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  glow: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
  green: '#59d9b3',
  greenHover: '#54cfa9',
  greenDisabled: '#2e6f63',
};

const CARD: React.CSSProperties = {
  background: UI.cardBg,
  border: UI.border,
  borderRadius: 20,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)',
};

const MODAL: React.CSSProperties = {
  background: 'rgba(13,15,17,0.96)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};

/* ============================ TYPES / LS ============================ */
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

function readLS<T>(k: string): T | null { try { const r = typeof window !== 'undefined' ? localStorage.getItem(k) : null; return r ? JSON.parse(r) as T : null; } catch { return null; } }
function writeLS<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
function useDebouncedSaver<T>(value: T, delay = 350, onSave: (v: T) => void) {
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const t = useRef<number | null>(null);
  useEffect(() => { setSaving(true); setSaved(false); if (t.current) clearTimeout(t.current);
    t.current = window.setTimeout(() => { onSave(value); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 800); }, delay);
    return () => t.current && clearTimeout(t.current);
  }, [value, delay, onSave]);
  return { saving, saved };
}

/* ============================ ATOMS ============================ */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full relative transition ${checked ? 'bg-emerald-400/80' : 'bg-white/10'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}

function Chips({ options, value, onChange }:{ options: string[]; value: string[]; onChange: (next: string[]) => void; }) {
  const toggle = (opt: string) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(o => {
        const active = value.includes(o);
        return (
          <button key={o} type="button" onClick={() => toggle(o)}
            className={`px-3 py-1.5 rounded-full border text-xs md:text-sm transition ${
              active ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200' : 'bg-white/5 border-white/10 text-white/75 hover:bg-white/10'
            }`}>{o}</button>
        );
      })}
    </div>
  );
}

function Modal({ open, onClose, title, children }:{ open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          style={{ backdropFilter: 'blur(4px)', background: 'rgba(0,0,0,0.60)' }}>
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col text-white font-movatif"
            style={MODAL}
          >
            <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
              <h4 className="text-lg font-semibold truncate">{title}</h4>
              <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">{children}</div>
            <div className="px-6 py-4 rounded-b-[30px]" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', background: '#101314' }}>
              <div className="flex justify-end"><button onClick={onClose} className="px-6 py-2 rounded-[24px] border border-white/15 hover:bg-white/10">Close</button></div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Box({ title, icon, children, editable, renderEdit, error, saveBadge }:{
  title: string; icon?: React.ReactNode; children: React.ReactNode;
  editable?: boolean; renderEdit?: () => React.ReactNode; error?: string; saveBadge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <motion.div
        layout initial={{ opacity: 0, y: 10, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.22 }} whileHover={{ y: -2 }}
        className="relative p-6 flex flex-col h-full min-h-[310px]" style={CARD}
      >
        <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background: UI.glow, filter: 'blur(38px)' }} />
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-[13px] font-semibold flex items-center gap-2">{icon}{title}</h3>
          <div className="flex items-center gap-2">
            {editable && (
              <button onClick={() => setOpen(true)}
                className="text-xs px-3 py-1.5 rounded-2xl border border-white/20 hover:bg-white/10 inline-flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Edit
              </button>
            )}
            {saveBadge}
          </div>
        </div>
        <div className="space-y-3 flex-1">{children}</div>
        {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      </motion.div>

      {editable && renderEdit && (
        <Modal open={open} onClose={() => setOpen(false)} title={title}>
          {renderEdit()}
        </Modal>
      )}
    </>
  );
}

/* ============================ COMPILER (compact) ============================ */
const STYLE = { professional:'Professional + concise', conversational:'Natural + casual', empathetic:'Warm + patient', upbeat:'Positive + quick' } as const;
const politeness = (p: Step3['politeness']) => p==='low' ? 'Direct.' : p==='high' ? 'Very polite.' : 'Balanced.';
const bullets = (a: string[]) => a.filter(Boolean).map(s => `- ${s}`).join('\n');

function compile(step1: Partial<Step1Lite>, s3: Step3): string {
  const name = s3.personaName?.trim() || 'Agent';
  const greet = s3.greetingLine?.trim();
  const intro = (s3.introExplain || '').trim();
  const voice = bullets([`${STYLE[s3.style]}`, politeness(s3.politeness), s3.barge.allow ? 'Allow barge-in.' : 'No barge-in.']);
  const flow = s3.collect?.length ? s3.collect.map((c, i) => `${i + 1}. Ask for ${c}.`).join('\n') : '';
  const intents = s3.intents?.length ? `Intents: ${s3.intents.join(', ')}${s3.otherTasks ? `; Other: ${s3.otherTasks}` : ''}.` : '';
  const latency = `Target latency ~${s3.latency.delayMs ?? step1.responseDelayMs ?? 600}ms.`; 
  const lang = bullets([`Language: ${s3.language || step1.language || 'en'}.`, s3.accentIso2 ? `Accent: ${s3.accentIso2}.` : '', s3.ttsVoice ? `TTS: ${s3.ttsVoice}.` : '']);
  return [
    `# Voice Agent — ${name}`, '',
    greet ? `${greet}${intro ? ` ${intro}` : ''}` : intro, intents, '',
    '## Voice', voice, '',
    flow ? '## Flow\n' + flow : '', '',
    '## Latency', `- ${latency}`, '',
    '## Language', lang,
  ].filter(Boolean).join('\n');
}

/* ============================ DEFAULTS (prefilled) ============================ */
const INTENTS = ['Scheduling','Reschedule','Cancel','FAQs','Lead Capture','Handover to Human'];
const COLLECT = ['Name','Phone','Email','Date/Time','Service Type','Account/Order #','Notes'];

const DEFAULT_S3: Step3 = {
  personaName: 'Riley',
  style: 'professional',
  politeness: 'med',
  greetingLine: 'Hi, this is Riley — how can I help today?',
  introExplain: 'I can book or reschedule appointments and answer quick questions.',
  intents: ['Scheduling','Reschedule','FAQs'],
  otherTasks: '',
  collect: ['Name','Phone','Date/Time','Service Type'],
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

/* ============================ COMPONENT ============================ */
export default function StepV3PromptA({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  const step1 = readLS<Step1Lite>(LS_STEP1) || { language: 'en', accentIso2: 'us', responseDelayMs: 600, allowBargeIn: true };
  const restored = readLS<Step3>(LS_STEP3);
  const [s3, setS3] = useState<Step3>(() => ({ ...DEFAULT_S3, ...(restored || {}) }));

  const compiled = useMemo(() => compile(step1, s3), [step1, s3]);
  const full = useMemo(() => ({ ...s3, compiled }), [s3, compiled]);
  const { saving, saved } = useDebouncedSaver(full, 350, (v) => writeLS(LS_STEP3, v));

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!s3.greetingLine.trim()) e.greeting = 'Required';
    if (s3.greetingLine.length > 120) e.greetingLen = '≤ 120 chars';
    if (!s3.intents.length) e.intents = 'Pick ≥ 1';
    if (!s3.collect.length) e.collect = 'Pick ≥ 1';
    return e;
  }, [s3]);
  const valid = Object.keys(errors).length === 0;

  const set = <K extends keyof Step3>(k: K, v: Step3[K]) => setS3((cur) => ({ ...cur, [k]: v }));
  const saveBadge = <span className="text-xs px-2 py-1 rounded-2xl border border-white/15 text-white/70">{saving ? 'Saving…' : saved ? 'Saved' : 'Auto-save'}</span>;
  const [openPreview, setOpenPreview] = useState(false);

  const goNext = () => {
    const final = { ...s3, compiled };
    writeLS(LS_STEP3, final);
    writeLS(LS_BACKUP, { ...(readLS<any>(LS_BACKUP) || {}), step3: final });
    onNext?.();
  };

  return (
    <div className="min-h-screen w-full text-white font-movatif" style={{ background: UI.bg }}>
      <div className="w-full max-w-[1800px] mx-auto px-6 2xl:px-12 pt-10 pb-24">
        {/* Head */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="flex items-center justify-between mb-8">
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Personality & Knowledge</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setOpenPreview(true)} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <Eye className="w-4 h-4" /> Preview
            </button>
            {saveBadge}
          </div>
        </motion.div>

        {/* Wider grid: 3 columns, big gaps, equal-height cards */}
        <div className="grid grid-cols-12 gap-8">
          {/* Persona */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Box title="Persona" icon={<User className="w-4 h-4 text-[#6af7d1]" />} editable
              renderEdit={() => (
                <div style={CARD} className="p-5 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <label className="col-span-2 text-xs text-white/70">Name</label>
                    <input value={s3.personaName} onChange={(e) => set('personaName', e.target.value)}
                      className="col-span-2 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />

                    <label className="text-xs text-white/70">Style</label>
                    <select value={s3.style} onChange={(e) => set('style', e.target.value as Step3['style'])}
                      className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15">
                      <option value="professional">Professional</option>
                      <option value="conversational">Conversational</option>
                      <option value="empathetic">Empathetic</option>
                      <option value="upbeat">Upbeat</option>
                    </select>

                    <label className="text-xs text-white/70">Politeness</label>
                    <select value={s3.politeness} onChange={(e) => set('politeness', e.target.value as Step3['politeness'])}
                      className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15">
                      <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
                    </select>
                  </div>
                </div>
              )}
              saveBadge={saveBadge}
            >
              <div className="grid grid-cols-2 gap-3">
                <label className="col-span-2 text-xs text-white/70">Name</label>
                <input value={s3.personaName} onChange={(e) => set('personaName', e.target.value)}
                  className="col-span-2 px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
                <label className="text-xs text-white/70">Style</label>
                <select value={s3.style} onChange={(e) => set('style', e.target.value as Step3['style'])}
                  className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm">
                  <option value="professional">Professional</option>
                  <option value="conversational">Conversational</option>
                  <option value="empathetic">Empathetic</option>
                  <option value="upbeat">Upbeat</option>
                </select>
                <label className="text-xs text-white/70">Politeness</label>
                <select value={s3.politeness} onChange={(e) => set('politeness', e.target.value as Step3['politeness'])}
                  className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm">
                  <option value="low">Low</option><option value="med">Medium</option><option value="high">High</option>
                </select>
              </div>
            </Box>
          </div>

          {/* Greeting */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Box title="Greeting" icon={<MessageSquare className="w-4 h-4 text-[#6af7d1]" />} editable
              renderEdit={() => (
                <div style={CARD} className="p-5 space-y-3">
                  <input value={s3.greetingLine} onChange={(e) => set('greetingLine', e.target.value)}
                    placeholder="Hi, this is Riley — how can I help today?" className="w-full px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                  <input value={s3.introExplain || ''} onChange={(e) => set('introExplain', e.target.value)}
                    placeholder="I can book or reschedule and answer quick questions." className="w-full px-3 py-3 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                </div>
              )}
              saveBadge={saveBadge}
              error={errors.greeting || errors.greetingLen}
            >
              <input value={s3.greetingLine} onChange={(e) => set('greetingLine', e.target.value)}
                className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
              <input value={s3.introExplain || ''} onChange={(e) => set('introExplain', e.target.value)}
                className="mt-2 w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
              <div className="text-xs text-white/50 text-right mt-1">{s3.greetingLine.length}/120</div>
            </Box>
          </div>

          {/* Intents */}
          <div className="col-span-12 md:col-span-6 xl:col-span-4">
            <Box title="Intents" icon={<ClipboardList className="w-4 h-4 text-[#6af7d1]" />} editable
              renderEdit={() => (
                <div style={CARD} className="p-5 space-y-3">
                  <Chips options={INTENTS} value={s3.intents} onChange={(v) => set('intents', v)} />
                  <input value={s3.otherTasks || ''} onChange={(e) => set('otherTasks', e.target.value)} placeholder="Other (optional)"
                    className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15" />
                </div>
              )}
              saveBadge={saveBadge}
              error={errors.intents}
            >
              <Chips options={INTENTS} value={s3.intents} onChange={(v) => set('intents', v)} />
              <input value={s3.otherTasks || ''} onChange={(e) => set('otherTasks', e.target.value)} placeholder="Other (optional)"
                className="mt-3 w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm" />
            </Box>
          </div>

          {/* Collect — full width so everything breathes */}
          <div className="col-span-12">
            <Box title="Collect" icon={<ClipboardList className="w-4 h-4 text-[#6af7d1]" />} editable
              renderEdit={() => (<div style={CARD} className="p-5"><Chips options={COLLECT} value={s3.collect} onChange={(v) => set('collect', v)} /></div>)}
              saveBadge={saveBadge}
              error={errors.collect}
            >
              <Chips options={COLLECT} value={s3.collect} onChange={(v) => set('collect', v)} />
            </Box>
          </div>
        </div>

        {/* Footer */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }} className="mt-10 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => navigator.clipboard.writeText(compiled).catch(() => {})}
              className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
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
        <div style={CARD} className="p-5"><pre className="whitespace-pre-wrap text-sm leading-6">{compiled}</pre></div>
      </Modal>
    </div>
  );
}
