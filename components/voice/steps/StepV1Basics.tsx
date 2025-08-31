// components/voice/steps/StepV1Basics.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Quote, Languages, MessageSquareText, Gauge, SlidersHorizontal, Mic, Music2 } from 'lucide-react';
import { CARD_STYLE, GreenButton } from '../atoms';

type Props = { onNext?: () => void };

// local helpers
const jget = <T,>(k: string, f: T): T => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : f; } catch { return f; } };

export default function StepV1Basics({ onNext }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState('en-US');
  const [greeting, setGreeting] = useState('Thank you for calling. How can I help today?');
  const [speakingStyle, setSpeakingStyle] = useState<'conversational' | 'professional' | 'newscaster' | ''>('professional');
  const [speakingRatePct, setRate] = useState<number>(100);
  const [pitchSemitones, setPitch] = useState<number>(0);
  const [responseDelayMs, setDelay] = useState<number>(400);
  const [bargeIn, setBargeIn] = useState<boolean>(true);
  const [ttsVoice, setTtsVoice] = useState('Polly.Joanna');

  useEffect(() => {
    const s = jget<any>('voicebuilder:step1', null);
    if (s) {
      setName(s.name || ''); setIndustry(s.industry || ''); setLanguage(s.language || 'en-US');
      setGreeting(s.greeting || greeting); setSpeakingStyle(s.speakingStyle ?? 'professional');
      setRate(typeof s.speakingRatePct === 'number' ? s.speakingRatePct : 100);
      setPitch(typeof s.pitchSemitones === 'number' ? s.pitchSemitones : 0);
      setDelay(typeof s.responseDelayMs === 'number' ? s.responseDelayMs : 400);
      setBargeIn(!!s.bargeIn);
      setTtsVoice(s.ttsVoice || 'Polly.Joanna');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a name.';
    if (!industry.trim()) e.industry = 'Enter industry.';
    if (!language.trim()) e.language = 'Enter a language (e.g., en-US).';
    return e;
  }, [name, industry, language]);

  const canNext = Object.keys(errors).length === 0;

  function persistAndNext() {
    const payload = {
      name, industry, language,
      greeting, speakingStyle, speakingRatePct, pitchSemitones, responseDelayMs, bargeIn,
      ttsVoice,
    };
    try { localStorage.setItem('voicebuilder:step1', JSON.stringify(payload)); } catch {}
    onNext?.();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold">Voice AI Basics</h1>
        <div className="text-xs px-3 py-1 rounded-2xl border" style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}>
          Step 1 of 4
        </div>
      </div>

      <div className="p-7 md:p-8" style={CARD_STYLE}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field label="Agent Name *" value={name} onChange={setName} icon={<Sparkles className="w-4 h-4 text-[#6af7d1]" />} error={errors.name} />
          <Field label="Industry *" value={industry} onChange={setIndustry} icon={<MessageSquareText className="w-4 h-4 text-[#6af7d1]" />} error={errors.industry} />
          <Field label="Language (ASR/TTS) *" value={language} onChange={setLanguage} placeholder="en-US" icon={<Languages className="w-4 h-4 text-[#6af7d1]" />} error={errors.language} />
          <Field label='TTS Voice' value={ttsVoice} onChange={setTtsVoice} placeholder='Polly.Joanna (or "alice")' icon={<Mic className="w-4 h-4 text-[#6af7d1]" />} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Field label="Greeting (first sentence)" value={greeting} onChange={setGreeting} icon={<Quote className="w-4 h-4 text-[#6af7d1]" />} />
          <Select
            label="Speaking style"
            value={speakingStyle}
            onChange={(v) => setSpeakingStyle(v as any)}
            options={[
              { value: 'conversational', label: 'Conversational' },
              { value: 'professional', label: 'Professional' },
              { value: 'newscaster', label: 'Newscaster' },
              { value: '', label: 'None' },
            ]}
            icon={<SlidersHorizontal className="w-4 h-4 text-[#6af7d1]" />}
          />
          <NumberField label="Response delay (ms)" value={responseDelayMs} onChange={setDelay} min={0} max={5000} step={50} icon={<Gauge className="w-4 h-4 text-[#6af7d1]" />} />
          <NumberField label="Speaking rate (%)" value={speakingRatePct} onChange={setRate} min={60} max={140} step={1} icon={<Music2 className="w-4 h-4 text-[#6af7d1]" />} />
          <NumberField label="Pitch (semitones)" value={pitchSemitones} onChange={setPitch} min={-6} max={6} step={1} />
          <Checkbox label="Allow barge-in (interrupt while speaking)" checked={bargeIn} onChange={setBargeIn} />
        </div>

        <div className="mt-8 flex justify-end">
          <GreenButton disabled={!canNext} onClick={persistAndNext}>Next →</GreenButton>
        </div>
      </div>
    </section>
  );
}

function Field({ label, value, onChange, placeholder, icon, error }:{
  label: string; value: string; onChange: (v:string)=>void; placeholder?:string; icon?:React.ReactNode; error?:string;
}) {
  const border = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none" style={{ borderColor: border }}>
        {icon}
        <input value={value} onChange={(e)=>onChange(e.target.value)} placeholder={placeholder} className="w-full bg-transparent outline-none text-[15px] text-white/95" />
      </div>
      <div className="mt-1 text-xs">{error ? <span className="text-[rgba(255,138,138,0.95)]">{error}</span> : null}</div>
    </div>
  );
}
function Select({ label, value, onChange, options, icon }:{
  label:string; value:string; onChange:(v:string)=>void; options:{value:string;label:string}[]; icon?:React.ReactNode;
}) {
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none" style={{ borderColor:'#13312b' }}>
        {icon}
        <select value={value} onChange={(e)=>onChange(e.target.value)} className="w-full bg-transparent outline-none text-[15px] text-white/95">
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
function NumberField({ label, value, onChange, min, max, step, icon }:{
  label:string; value:number; onChange:(n:number)=>void; min?:number; max?:number; step?:number; icon?:React.ReactNode;
}) {
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none" style={{ borderColor:'#13312b' }}>
        {icon}
        <input type="number" value={value} onChange={(e)=>onChange(Number(e.target.value))} min={min} max={max} step={step} className="w-full bg-transparent outline-none text-[15px] text-white/95" />
      </div>
    </div>
  );
}
function Checkbox({ label, checked, onChange }:{ label:string; checked:boolean; onChange:(b:boolean)=>void }) {
  return (
    <label className="flex items-center gap-2 text-sm mt-2">
      <input type="checkbox" checked={checked} onChange={(e)=>onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
