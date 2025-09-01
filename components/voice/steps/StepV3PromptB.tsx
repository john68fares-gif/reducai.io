'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Eye, Copy, ArrowLeft, ArrowRight, X,
  Timer, PhoneForwarded, ShieldAlert, Upload, BookOpenText, Keyboard, Languages, Edit3
} from 'lucide-react';

/* ---------- Shared styles (same + wider) ---------- */
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

/* ------------------------------ Types/Storage ---------------------------- */
type Step1Lite = { language: string; accentIso2?: string; responseDelayMs?: number; allowBargeIn?: boolean; };
type Step3 = {
  personaName: string; style:'professional'|'conversational'|'empathetic'|'upbeat'; politeness:'low'|'med'|'high';
  greetingLine: string; introExplain?: string;
  intents: string[]; otherTasks?: string; collect: string[];
  confirmation: { confirmNames:boolean; repeatDateTime:boolean; spellBackUnusual:boolean; template?:string; };
  barge: { allow:boolean; phrases?:string };
  latency: { delayMs:number; fillers?:string };
  escalate?: { enable:boolean; humanHours?:string; handoverNumber?:string; criteria?:string };
  deflect?: { script?:string; noSensitive?:boolean };
  knowledge: { title:string; text:string }[];
  dtmf?: { [digit:string]: string };
  language: string; accentIso2: string; ttsVoice?: string; compiled?: string;
};
const LS_STEP1='voicebuilder:step1'; const LS_STEP3='voicebuilder:step3'; const LS_BACKUP='voice:settings:backup';

/* ------------------------------- Utils ----------------------------------- */
function readLS<T>(k:string):T|null{ try{const r=localStorage.getItem(k); return r? JSON.parse(r) as T:null;}catch{return null;} }
function writeLS<T>(k:string,v:T){ try{localStorage.setItem(k,JSON.stringify(v));}catch{} }
function useDebouncedSaver<T>(value:T,delay=400,onSave:(v:T)=>void){
  const [saving,setSaving]=useState(false); const [saved,setSaved]=useState(false); const t=useRef<number|null>(null);
  useEffect(()=>{ setSaving(true); setSaved(false); if(t.current) clearTimeout(t.current);
    t.current=window.setTimeout(()=>{ onSave(value); setSaving(false); setSaved(true); window.setTimeout(()=>setSaved(false),1000);},delay);
    return ()=> t.current && clearTimeout(t.current);
  },[value,delay,onSave]); return {saving,saved};
}
function isE164(v:string){ return /^\+[1-9]\d{6,14}$/.test(v); }

/* -------------------------------- Atoms --------------------------------- */
function ModalFrame({open,onClose,title,children}:{open:boolean;onClose:()=>void;title:string;children:React.ReactNode;}){
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{background:'rgba(0,0,0,0.5)'}}>
      <div className="relative w-full max-w-[980px] max-h-[88vh] flex flex-col text-white font-movatif" style={FRAME_STYLE}>
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={HEADER_BORDER}>
          <div className="min-w-0"><h4 className="text-lg font-semibold truncate">{title}</h4><div className="text-white/80 text-xs">Edit section</div></div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10"><X className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
        <div className="px-6 py-4 rounded-b-[30px]" style={{borderTop:'1px solid rgba(255,255,255,0.3)',background:'#101314'}}>
          <div className="flex justify-end"><button onClick={onClose} className="px-6 py-2 rounded-[24px] border border-white/15 hover:bg-white/10">Close</button></div>
        </div>
      </div>
    </div>
  );
}
function Box({title,subtitle,icon,children,editable,renderEdit,error,actions}:{title:string;subtitle?:string;icon?:React.ReactNode;children:React.ReactNode;editable?:boolean;renderEdit?:()=>React.ReactNode;error?:string;actions?:React.ReactNode;}){
  const [open,setOpen]=useState(false);
  return (
    <div className="relative rounded-3xl p-6"
      style={{background:'rgba(13,15,17,0.92)',border:'1px solid rgba(106,247,209,0.18)',boxShadow:'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)'}}>
      <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
           style={{background:'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',filter:'blur(38px)'}}/>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-[13px] font-semibold text-white/90 flex items-center gap-2">{icon}{title}</h3>
          {subtitle && <p className="text-[12px] text-white/55 mt-0.5">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          {actions}
          {editable && (
            <button onClick={()=>setOpen(true)} className="text-xs px-3 py-1.5 rounded-2xl border inline-flex items-center gap-1.5"
              style={{background:'rgba(16,19,20,0.88)',border:'1px solid rgba(255,255,255,0.16)',boxShadow:'0 0 12px rgba(0,0,0,0.25)'}}>
              <Edit3 className="w-3.5 h-3.5 text-white/80"/><span className="text-white/90">Edit</span>
            </button>
          )}
        </div>
      </div>
      <div className="space-y-3">{children}</div>
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
      {editable && renderEdit && <ModalFrame open={open} onClose={()=>setOpen(false)} title={title}>{renderEdit()}</ModalFrame>}
    </div>
  );
}
function PhoneInput({value,onChange,placeholder='+15551234567',error}:{value?:string;onChange:(v:string)=>void;placeholder?:string;error?:string;}){
  return (
    <div>
      <input value={value||''} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
             className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border text-sm"
             style={{borderColor: error? 'rgba(255,99,99,0.7)':'rgba(255,255,255,0.15)'}}/>
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

/* ------------------------------- Compiler ------------------------------- */
const STYLE_LABEL = { professional:'Professional and concise', conversational:'Natural and conversational', empathetic:'Warm and empathetic', upbeat:'Upbeat and positive' } as const;
function politenessText(p:Step3['politeness']){ if(p==='low') return 'Use direct language; no excessive formalities.'; if(p==='high') return 'Be very polite and considerate; add courteous phrases.'; return 'Maintain balanced politeness; friendly but efficient.'; }
function bullets(lines:string[]){ return lines.filter(Boolean).map(l=>`- ${l}`).join('\n'); }
function compileVoicePrompt(step1:Partial<Step1Lite>, s3:Step3){
  const name=s3.personaName?.trim()||'Agent'; const greet=s3.greetingLine?.trim(); const intro=(s3.introExplain||'').trim();
  const voicePersona = bullets([
    `${STYLE_LABEL[s3.style]}.`, politenessText(s3.politeness),
    s3.barge.allow?'Allow barge-in: if caller speaks while I am talking, pause, acknowledge, and adapt.':'Do NOT allow barge-in; complete the current sentence before listening again.'
  ]);
  const flow = s3.collect?.length? s3.collect.map((c,i)=>`${i+1}. Ask for ${c}.`).join('\n') : '';
  const intents = s3.intents?.length? `Primary intents: ${s3.intents.join(', ')}${s3.otherTasks?`; Other: ${s3.otherTasks}`:''}.` : '';
  const confirm = bullets([
    s3.confirmation.confirmNames?'Confirm correct spelling/pronunciation of names.':'',
    s3.confirmation.repeatDateTime?'Repeat date/time details back to caller to confirm.':'',
    s3.confirmation.spellBackUnusual?'Spell back unusual terms (e.g., emails, IDs) to verify.':'',
    s3.confirmation.template?`Use confirmation template: "${s3.confirmation.template.trim()}"`:''
  ]);
  const interrupt = bullets([ s3.barge.phrases?`When interrupted, briefly acknowledge: ${s3.barge.phrases.trim()}`:'' ]);
  const latency = bullets([
    `Target response latency: ~${s3.latency.delayMs ?? step1.responseDelayMs ?? 600}ms.`,
    s3.latency.fillers? `If thinking, use short fillers: ${s3.latency.fillers.trim()}` : '',
  ]);
  const escalate = s3.escalate?.enable? `Escalation / Transfer
- Hours: ${s3.escalate.humanHours || 'Not specified'}
- Handover number: ${s3.escalate.handoverNumber || 'Not provided'}
- Criteria:
${(s3.escalate.criteria||'').split('\n').map(l=>l.trim()).filter(Boolean).map(l=>'  • '+l).join('\n')}` : '';
  const safety = bullets([
    s3.deflect?.script? `Out-of-scope deflection script: ${s3.deflect.script.trim()}` : '',
    s3.deflect?.noSensitive? 'Do not provide medical, legal, or other sensitive professional advice; redirect to a human.' : '',
  ]);
  const knowledge = s3.knowledge?.length? s3.knowledge.map(k=>`• ${k.title.trim()}: ${k.text.trim()}`).join('\n') : '';
  const langVoice = bullets([
    `Language: ${s3.language || step1.language || 'en'}.`,
    s3.accentIso2?`Accent hint: ${s3.accentIso2}.`:'',
    s3.ttsVoice?`Preferred TTS voice label: ${s3.ttsVoice}.`:'',
    'Vendor-agnostic: do not reference specific TTS/ASR vendors.',
  ]);
  const dtmfLines = s3.dtmf && Object.keys(s3.dtmf).length? Object.entries(s3.dtmf).map(([d,a])=>`  ${d} → ${a}`).join('\n'): '';
  const dtmf = dtmfLines? `DTMF / Keypad Shortcuts\n${dtmfLines}`:'';

  return [
    `# Voice Agent System Prompt — ${name}`,
    '', '## Identity & Purpose', intro ? `${greet} ${intro}`.trim() : greet, intents,
    '', '## Voice & Persona', voicePersona,
    '', flow ? '## Conversation Flow\n'+flow : '',
    '', confirm ? '## Confirmation Rules\n'+confirm : '',
    '', interrupt ? '## Interruptions & Barge-in\n'+interrupt : '',
    '', latency ? '## Latency & Fillers\n'+latency : '',
    '', escalate ? '## '+escalate : '',
    '', safety ? '## Out-of-Scope & Safety\n'+safety : '',
    '', knowledge ? '## Knowledge Base\n'+knowledge : '',
    '', dtmf ? '## '+dtmf : '',
    '', '## Language & Voice', langVoice
  ].filter(Boolean).join('\n');
}

/* ------------------------------ Component B ----------------------------- */
export default function StepV3PromptB({ onBack, onNext }:{ onBack?:()=>void; onNext?:()=>void;}) {
  const step1 = readLS<Step1Lite>(LS_STEP1) || { language:'en', accentIso2:'', responseDelayMs:600, allowBargeIn:true };
  const restored = readLS<Step3>(LS_STEP3);

  const [s3,setS3] = useState<Step3>(()=> restored!); // this screen assumes A already created base; if null, fallback:
  useEffect(()=>{ if(!restored){ // safety fallback
    const blank: Step3 = {
      personaName:'Riley', style:'professional', politeness:'med', greetingLine:'', introExplain:'',
      intents:[], otherTasks:'', collect:[],
      confirmation:{confirmNames:true, repeatDateTime:true, spellBackUnusual:true, template:''},
      barge:{allow:true, phrases:''}, latency:{delayMs: step1.responseDelayMs ?? 600, fillers:''},
      escalate:{enable:false, humanHours:'', handoverNumber:'', criteria:''},
      deflect:{script:'', noSensitive:true}, knowledge:[], dtmf:{},
      language: step1.language || 'en', accentIso2: step1.accentIso2 || '', ttsVoice:'', compiled:''
    }; setS3(blank); writeLS(LS_STEP3,blank);
  }},[]);

  const compiled = useMemo(()=> s3? compileVoicePrompt(step1,s3):'', [step1,s3]);
  const full = useMemo(()=> s3? ({...s3, compiled}): s3, [s3,compiled]);
  const {saving,saved} = useDebouncedSaver(full,400,(v)=> v && writeLS(LS_STEP3,v));

  const errors = useMemo(()=>{
    const e:Record<string,string> = {};
    if(s3?.escalate?.enable && s3.escalate.handoverNumber && !isE164(s3.escalate.handoverNumber)) e.handover='Handover number must be in E.164 (+) format';
    return e;
  },[s3]);
  const validB = !errors.handover;

  function set<K extends keyof Step3>(k:K, v:Step3[K]){ setS3(cur=>({...cur,[k]:v})); }
  function goNext(){ if(!s3) return; const final={...s3,compiled}; writeLS(LS_STEP3,final); const backup=readLS<any>(LS_BACKUP)||{}; writeLS(LS_BACKUP,{...backup, step3:final}); onNext?.(); }

  /* Import modal */
  const [importOpen,setImportOpen]=useState(false);
  const [pasted,setPasted]=useState(''); const fileInputRef=useRef<HTMLInputElement>(null);
  async function importFilesToKnowledge(files: FileList | null) {
    if(!files || !files.length || !s3) return;
    const texts:string[]=[]; for(const f of Array.from(files)){ const buf=await f.text().catch(()=> ''); if(buf) texts.push(`File: ${f.name}\n${buf}`); }
    if(!texts.length) return;
    const next=[...s3.knowledge]; texts.forEach((t,i)=> next.push({title:`Imported File ${i+1}`, text:t.slice(0,2000)}));
    set('knowledge', next);
  }
  function importPasted(){
    if(!s3) return;
    const blocks=pasted.split(/\n{2,}/).map(b=>b.trim()).filter(Boolean);
    if(!blocks.length) return;
    const next=[...s3.knowledge]; blocks.forEach((t,i)=> next.push({title:`Pasted ${i+1}`, text:t.slice(0,2000)}));
    set('knowledge', next); setPasted(''); setImportOpen(false);
  }

  const [previewOpen,setPreviewOpen]=useState(false);
  const saveBadge = <span className="text-xs px-2 py-1 rounded-2xl border border-white/15 text-white/70">{saving?'Saving…': saved?'Saved':'Auto-save'}</span>;

  if(!s3) return null;

  return (
    <div className="min-h-screen w-full bg-[#0b0c10] text-white font-movatif">
      <div className="w-full max-w-[1400px] mx-auto px-6 md:px-8 pt-10 pb-24">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">Personality & Knowledge — B</h2>
            <div className="text-white/70 mt-1 text-sm">Latency, escalation, safety, knowledge, DTMF, language helpers</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={()=>setPreviewOpen(true)} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg:white/10">
              <Eye className="w-4 h-4"/> Preview compiled prompt
            </button>
            <span className="hidden md:block text-sm text-white/60">Step 3B of 4</span>
          </div>
        </div>

        <div className="rounded-[30px] p-6 md:p-8 relative" style={FRAME_STYLE}>
          <div aria-hidden className="pointer-events-none absolute -top-[16%] -left-[18%] w-[58%] h-[58%] rounded-full"
               style={{background:'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',filter:'blur(38px)'}}/>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Latency */}
            <Box title="Latency Cover / Thinking Filler" subtitle="Short fillers while thinking." icon={<Timer className="w-4 h-4 text-[#6af7d1]"/>} editable renderEdit={()=>{
              return (
                <div style={CARD_STYLE} className="p-5 space-y-3">
                  <label className="text-xs text-white/70">Response delay (ms)</label>
                  <input type="number" min={0} value={s3.latency.delayMs} onChange={e=>set('latency',{...s3.latency, delayMs:Number(e.target.value||0)})}
                         className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15"/>
                  <textarea value={s3.latency.fillers||''} onChange={e=>set('latency',{...s3.latency, fillers:e.target.value})}
                            placeholder="e.g., One moment while I check that." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[120px]"/>
                </div>
              );
            }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-center">
                <div>
                  <label className="text-xs text-white/70">Response delay (ms)</label>
                  <input type="number" min={0} value={s3.latency.delayMs} onChange={e=>set('latency',{...s3.latency, delayMs:Number(e.target.value||0)})}
                         className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm"/>
                </div>
                <div className="md:col-span-2">
                  <label className="text-xs text-white/70">Delay fillers</label>
                  <textarea value={s3.latency.fillers||''} onChange={e=>set('latency',{...s3.latency, fillers:e.target.value})}
                            placeholder="e.g., One moment while I check that." className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]"/>
                </div>
              </div>
            </Box>

            {/* Escalation */}
            <Box title="Escalation / Transfer" subtitle="Configure human transfer." icon={<PhoneForwarded className="w-4 h-4 text-[#6af7d1]"/>} error={errors.handover} editable renderEdit={()=>{
              return (
                <div style={CARD_STYLE} className="p-5 space-y-3">
                  <div className="flex items-center"><input type="checkbox" checked={!!s3.escalate?.enable} onChange={e=>set('escalate',{...s3.escalate!, enable:e.target.checked})} className="mr-2"/><span>Enable escalation</span></div>
                  {s3.escalate?.enable && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input value={s3.escalate?.humanHours||''} onChange={e=>set('escalate',{...s3.escalate!, humanHours:e.target.value})} placeholder="Human hours" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15"/>
                      <PhoneInput value={s3.escalate?.handoverNumber||''} onChange={v=>set('escalate',{...s3.escalate!, handoverNumber:v})} placeholder="+15551234567" error={errors.handover}/>
                      <textarea value={s3.escalate?.criteria||''} onChange={e=>set('escalate',{...s3.escalate!, criteria:e.target.value})}
                                placeholder="Handover criteria (one per line)" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[38px]"/>
                    </div>
                  )}
                </div>
              );
            }}>
              <div className="space-y-2">
                <div className="flex items-center"><input type="checkbox" checked={!!s3.escalate?.enable} onChange={e=>set('escalate',{...s3.escalate!, enable:e.target.checked})} className="mr-2"/><span>Enable escalation</span></div>
                {s3.escalate?.enable && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={s3.escalate?.humanHours||''} onChange={e=>set('escalate',{...s3.escalate!, humanHours:e.target.value})} placeholder="Human hours" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm"/>
                    <PhoneInput value={s3.escalate?.handoverNumber||''} onChange={v=>set('escalate',{...s3.escalate!, handoverNumber:v})} placeholder="+15551234567" error={errors.handover}/>
                    <textarea value={s3.escalate?.criteria||''} onChange={e=>set('escalate',{...s3.escalate!, criteria:e.target.value})}
                              placeholder="Handover criteria (one per line)" className="px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[38px]"/>
                  </div>
                )}
              </div>
            </Box>

            {/* Safety */}
            <Box title="Out-of-Scope & Safety" subtitle="Deflection & compliance." icon={<ShieldAlert className="w-4 h-4 text-[#6af7d1]"/>} editable renderEdit={()=>{
              return (
                <div style={CARD_STYLE} className="p-5 space-y-3">
                  <textarea value={s3.deflect?.script||''} onChange={e=>set('deflect',{...s3.deflect!, script:e.target.value})}
                            placeholder="How to decline or redirect" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 min-h-[140px]"/>
                  <div className="flex items-center"><input type="checkbox" checked={!!s3.deflect?.noSensitive} onChange={e=>set('deflect',{...s3.deflect!, noSensitive:e.target.checked})} className="mr-2"/><span>No medical/legal advice</span></div>
                </div>
              );
            }}>
              <textarea value={s3.deflect?.script||''} onChange={e=>set('deflect',{...s3.deflect!, script:e.target.value})}
                        placeholder="How to decline or redirect" className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] border border-white/15 text-sm min-h-[70px]"/>
              <div className="mt-2 flex items-center"><input type="checkbox" checked={!!s3.deflect?.noSensitive} onChange={e=>set('deflect',{...s3.deflect!, noSensitive:e.target.checked})} className="mr-2"/><span>No medical/legal advice</span></div>
            </Box>

            {/* Company Knowledge (Import) */}
            <Box title="Company Knowledge" subtitle="Import website / files or paste text." icon={<Upload className="w-4 h-4 text-[#6af7d1]"/>}
                 actions={<button onClick={()=>setImportOpen(true)} className="text-xs px-3 py-1.5 rounded-2xl border border-white/15 hover:bg-white/10 inline-flex items-center gap-1.5">
                   <Upload className="w-3.5 h-3.5"/> Import</button>}>
              <div className="text-sm text-white/70">Use <b>Import</b> to add company facts (hours, services, policies). They become Knowledge Snippets the compiler uses.</div>
              {s3.knowledge.length>0 && (
                <div className="mt-3 grid gap-2">
                  {s3.knowledge.map((k,i)=>(
                    <div key={i} className="rounded-2xl bg-[#0b0e0f] border border-white/15 p-3">
                      <div className="text-white/90 text-sm font-medium">{k.title || `Snippet ${i+1}`}</div>
                      <div className="text-white/60 text-xs mt-1 whitespace-pre-wrap">{k.text.slice(0,220)}</div>
                    </div>
                  ))}
                </div>
              )}
            </Box>

            {/* Knowledge Snippets (manual) */}
            <Box title="Knowledge Snippets (manual)" subtitle="Add/adjust specific rows." icon={<BookOpenText className="w-4 h-4 text-[#6af7d1]"/>} editable renderEdit={()=>{
              return <KnowledgeEditor knowledge={s3.knowledge} onChange={(rows)=>set('knowledge',rows)} />;
            }}>
              <KnowledgeEditor knowledge={s3.knowledge} onChange={(rows)=>set('knowledge',rows)} compact/>
            </Box>

            {/* DTMF */}
            <Box title="DTMF / Keypad Shortcuts" subtitle="Map digits to actions." icon={<Keyboard className="w-4 h-4 text-[#6af7d1]"/>}>
              <div className="grid grid-cols-5 gap-2">
                {[...'0123456789'].map(d=>(
                  <div key={d}>
                    <label className="text-xs text-white/60">{d}</label>
                    <input value={s3.dtmf?.[d]||''} onChange={e=>set('dtmf',{...(s3.dtmf||{}), [d]: e.target.value})}
                      placeholder="Action" className="w-full px-2 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-xs"/>
                  </div>
                ))}
              </div>
            </Box>

            {/* Language Helpers */}
            <Box title="Language Helpers" subtitle="Mirrors Step 1; voice is optional." icon={<Languages className="w-4 h-4 text-[#6af7d1]"/>}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div><label className="text-xs text-white/70">Language</label>
                  <input value={s3.language} readOnly className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm opacity-70"/></div>
                <div><label className="text-xs text-white/70">Accent (ISO2)</label>
                  <input value={s3.accentIso2||''} readOnly className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm opacity-70"/></div>
                <div><label className="text-xs text-white/70">TTS voice (optional)</label>
                  <input value={s3.ttsVoice||''} onChange={e=>set('ttsVoice', e.target.value)} placeholder="Vendor-agnostic voice label"
                         className="w-full px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm"/></div>
              </div>
            </Box>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4"/> Back
          </button>
          <div className="flex items-center gap-2">
            <button onClick={()=>navigator.clipboard.writeText(compiled).catch(()=>{})}
                    className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <Copy className="w-4 h-4"/> Copy compiled prompt
            </button>
            <button onClick={goNext} disabled={!validB}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold disabled:cursor-not-allowed"
              style={{background: validB? BTN_GREEN: BTN_DISABLED, color:'#fff'}}
              onMouseEnter={(e)=>{ if(!validB) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER; }}
              onMouseLeave={(e)=>{ if(!validB) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN; }}>
              Next →
            </button>
          </div>
        </div>
      </div>

      {/* Preview */}
      <ModalFrame open={previewOpen} onClose={()=>setPreviewOpen(false)} title="Compiled System Prompt">
        <pre className="whitespace-pre-wrap text-sm leading-6">{compiled}</pre>
      </ModalFrame>

      {/* Import Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div className="w-full max-w-3xl rounded-3xl p-6 font-movatif"
               style={{background:'linear-gradient(180deg, rgba(22,24,27,0.98) 0%, rgba(14,16,18,0.98) 100%)',
                       border:'1px solid rgba(0,255,194,0.25)', boxShadow:'0 0 24px rgba(0,255,194,0.10), inset 0 0 18px rgba(0,0,0,0.40)'}}>
            <div className="flex items-start justify-between">
              <div>
                <h4 className="text-lg font-semibold">Import Company Knowledge</h4>
                <p className="text-sm text-white/70 mt-1">Paste website content, or upload .txt/.md/.json files. (Client-only.)</p>
              </div>
              <button className="p-1 rounded-2xl border border-white/15" onClick={()=>setImportOpen(false)}><X className="w-4 h-4"/></button>
            </div>

            <label className="text-sm text-white/80 mt-5 block">Paste website or document text</label>
            <textarea value={pasted} onChange={e=>setPasted(e.target.value)}
                      className="w-full h-48 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 px-3 py-3 outline-none text-sm mt-2"
                      placeholder="Paste content here…"/>

            <div className="mt-4 flex items-center gap-3">
              <input type="file" ref={fileInputRef} multiple accept=".txt,.md,.json" className="hidden"
                     onChange={e=>importFilesToKnowledge(e.target.files)}/>
              <button onClick={()=>fileInputRef.current?.click()}
                      className="px-4 py-2 rounded-2xl border border-white/15 hover:bg-white/10 inline-flex items-center gap-2">
                <Upload className="w-4 h-4"/> Upload files
              </button>
              <div className="flex-1"/>
              <button onClick={()=>{ if(!pasted.trim()) return; importPasted(); }}
                      className="px-6 py-2 rounded-[24px] font-semibold"
                      style={{background: pasted.trim()? BTN_GREEN: BTN_DISABLED, color:'#fff'}}
                      onMouseEnter={(e)=>{ if(!pasted.trim()) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN_HOVER; }}
                      onMouseLeave={(e)=>{ if(!pasted.trim()) return; (e.currentTarget as HTMLButtonElement).style.background=BTN_GREEN; }}>
                Add to Knowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------- Knowledge Editor block ------------------------ */
function KnowledgeEditor({knowledge,onChange,compact}:{knowledge:{title:string;text:string}[];onChange:(r:{title:string;text:string}[])=>void;compact?:boolean;}){
  function addRow(){ onChange([...knowledge,{title:'',text:''}]); }
  function setRow(i:number,k:'title'|'text',v:string){ const next=knowledge.map((r,idx)=> idx===i? {...r,[k]:v}: r); onChange(next); }
  function remove(i:number){ onChange(knowledge.filter((_,idx)=> idx!==i)); }
  return (
    <div className="space-y-3">
      {knowledge.map((r,i)=>(
        <div key={i} className={`grid ${compact?'grid-cols-1':'grid-cols-1 md:grid-cols-5'} gap-2`}>
          <input value={r.title} onChange={e=>setRow(i,'title',e.target.value)} placeholder="Title"
                 className={`${compact?'':'md:col-span-2'} px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm`}/>
          <textarea value={r.text} onChange={e=>setRow(i,'text',e.target.value)} placeholder="Short text"
                    className={`${compact?'':'md:col-span-3'} px-3 py-2 rounded-2xl bg-[#0b0e0f] text-white border border-white/15 text-sm min-h-[48px]`}/>
          <div className={`${compact?'':'md:col-span-5'} flex justify-end`}>
            <button type="button" onClick={()=>remove(i)} className="text-xs text-red-300/90 hover:text-red-200">Remove</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={addRow} className="px-3 py-2 rounded-2xl text-emerald-200 text-sm" style={{...CARD_STYLE,border:'1px dashed rgba(0,255,194,0.35)'}}>Add knowledge</button>
    </div>
  );
}
