'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Copy, ArrowLeft, ArrowRight, X, Zap, PhoneForwarded, ShieldAlert,
  Upload, BookOpenText, Keyboard, Languages, Lightbulb
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
function isE164(v: string) { return /^\+[1-9]\d{6,14}$/.test(v); }
function useDebouncedSaver<T>(value: T, delay = 400, onSave: (v: T) => void) {
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false); const t = useRef<number | null>(null);
  useEffect(() => { setSaving(true); setSaved(false); if (t.current) window.clearTimeout(t.current);
    t.current = window.setTimeout(() => { onSave(value); setSaving(false); setSaved(true); window.setTimeout(() => setSaved(false), 1200); }, delay);
    return () => t.current && window.clearTimeout(t.current);
  }, [value, delay, onSave]);
  return { saving, saved };
}

/* -------------------------------- UI atoms ------------------------------- */
function ModalFrame({ open, onClose, title, children }:{ open:boolean; onClose:()=>void; title:string; children:React.ReactNode; }) {
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
function Box({ title, subtitle, icon, children, editable, renderEdit, error, actions, saveBadge }:{
  title: string; subtitle?: string; icon?: React.ReactNode; children: React.ReactNode;
  editable?: boolean; renderEdit?: () => React.ReactNode; error?: string; actions?: React.ReactNode; saveBadge?: React.ReactNode;
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
          {actions}
          {editable && (
            <button onClick={() => setOpen(true)} className="text-xs px-3 py-1.5 rounded-2xl border inline-flex items-center gap-1.5"
                    style={{ background:'rgba(16,19,20,0.88)', border:'1px solid rgba(255,255,255,0.16)', boxShadow:'0 0 12px rgba(0,0,0,0.25)' }}>
              <Upload className="w-3.5 h-3.5 text-white/80" /><span className="text-white/90">Edit</span>
            </button>
          )}
          {saveBadge}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {editable && renderEdit && <ModalFrame open={open} onClose={() => setOpen(false)} title={title}>{renderEdit()}</ModalFrame>}
    </div>
  );
}

/* -------------------------------- Compiler ------------------------------- */
function bullets(lines: string[]) { return lines.filter(Boolean).map(l => `- ${l}`).join('\n'); }
function compile(step1: Partial<Step1Lite>, s3: Step3): string {
  const name = s3.personaName?.trim() || 'Agent'; const greet = s3.greetingLine?.trim(); const intro = (s3.introExplain || '').trim();
  const voicePersona = bullets([`${({professional:'Professional and concise',conversational:'Natural and conversational',empathetic:'Warm and empathetic',upbeat:'Upbeat and positive'} as const)[s3.style]}.`,
    (s3.politeness==='low'?'Use direct language; no excessive formalities.':s3.politeness==='high'?'Be very polite and considerate; add courteous phrases.':'Maintain balanced politeness; friendly but efficient.'),
    s3.barge.allow ? 'Allow barge-in: pause, acknowledge, adapt.' : 'Do NOT allow barge-in; finish sentence first.']);
  const flow = s3.collect?.length ? s3.collect.map((c,i)=>`${i+1}. Ask for ${c}.`).join('\n') : '';
  const intents = s3.intents?.length ? `Primary intents: ${s3.intents.join(', ')}${s3.otherTasks?`; Other: ${s3.otherTasks}`:''}.` : '';
  const confirm = bullets([
    s3.confirmation.confirmNames ? 'Confirm correct spelling/pronunciation of names.' : '',
    s3.confirmation.repeatDateTime ? 'Repeat date/time details back to caller to confirm.' : '',
    s3.confirmation.spellBackUnusual ? 'Spell back unusual terms (emails, IDs) to verify.' : '',
    s3.confirmation.template ? `Use confirmation template: "${s3.confirmation.template.trim()}"` : '',
  ]);
  const interrupt = bullets([s3.barge.phrases ? `When interrupted, briefly acknowledge: ${s3.barge.phrases.trim()}` : '']);
  const latency = bullets([
    `Target response latency: ~${s3.latency.delayMs ?? step1.responseDelayMs ?? 600}ms.`,
    s3.latency.fillers ? `If thinking, use short fillers: ${s3.latency.fillers.trim()}` : '',
  ]);
  const escalate = s3.escalate?.enable ? `Escalation / Transfer
- Hours: ${s3.escalate.humanHours || 'Not specified'}
- Handover number: ${s3.escalate.handoverNumber || 'Not provided'}
- Criteria:
${(s3.escalate.criteria || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => `  • ${l}`).join('\n')}` : '';
  const safety = bullets([
    s3.deflect?.script ? `Out-of-scope deflection script: ${s3.deflect.script.trim()}` : '',
    s3.deflect?.noSensitive ? 'Do not provide medical, legal, or other sensitive professional advice; redirect to a human.' : '',
  ]);
  const knowledge = s3.knowledge?.length ? s3.knowledge.map(k => `• ${k.title.trim()}: ${k.text.trim()}`).join('\n') : '';
  const dtmfLines = s3.dtmf && Object.keys(s3.dtmf).length ? Object.entries(s3.dtmf).map(([d,a]) => `  ${d} → ${a}`).join('\n') : '';
  const dtmf = dtmfLines ? `DTMF / Keypad Shortcuts\n${dtmfLines}` : '';
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
    interrupt ? '## Interruptions & Barge-in\n' + interrupt : '', '',
    latency ? '## Latency & Fillers\n' + latency : '', '',
    escalate ? '## ' + escalate : '', '',
    safety ? '## Out-of-Scope & Safety\n' + safety : '', '',
    knowledge ? '## Knowledge Base\n' + knowledge : '', '',
    dtmf ? '## ' + dtmf : '', '',
    '## Language & Voice', langVoice,
  ].filter(Boolean).join('\n');
}

/* ------------------------------ Data & inspo ----------------------------- */
const DEFAULT_S3: Step3 = {
  personaName: 'Riley', style:'professional', politeness:'med',
  greetingLine:'', introExplain:'', intents:[], otherTasks:'', collect:[],
  confirmation:{confirmNames:true, repeatDateTime:true, spellBackUnusual:true, template:''},
  barge:{allow:true, phrases:''}, latency:{delayMs:600, fillers:''},
  escalate:{enable:false, humanHours:'', handoverNumber:'', criteria:''},
  deflect:{script:'', noSensitive:true}, knowledge:[], dtmf:{},
  language:'en', accentIso2:'', ttsVoice:'', compiled:''
};
const INSPIRATION = {
  barge: `No problem — go ahead.\nGot it. One sec, I'll adjust that.\nSure — what would you like to change?`,
  deflect: `I’m not able to provide advice on that topic. I can connect you with a specialist or share official resources.`,
};

export default function StepV3PromptB({ onBack, onNext }: { onBack?: () => void; onNext?: () => void }) {
  const step1 = (readLS<Step1Lite>(LS_STEP1)) || { language: 'en', accentIso2: '', responseDelayMs: 600, allowBargeIn: true };
  const restored = readLS<Step3>(LS_STEP3) || DEFAULT_S3;
  const [s3, setS3] = useState<Step3>(restored);

  const compiled = useMemo(() => compile(step1, s3), [step1, s3]);
  const full = useMemo(() => ({ ...s3, compiled }), [s3, compiled]);
  const { saving, saved } = useDebouncedSaver(full, 400, (v) => writeLS(LS_STEP3, v));
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (s3.escalate?.enable && s3.escalate?.handoverNumber && !isE164(s3.escalate.handoverNumber)) e.handover = 'Handover number must be in E.164 (+) format';
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

  /* Import modal state */
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
    setPasted(''); setImportOpen(false);
  }

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white font-movatif">
      <div className="w-full max-w-[1440px] mx-auto px-6 md:px-8 pt-10 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Persona
