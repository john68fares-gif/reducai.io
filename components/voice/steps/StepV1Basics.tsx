// components/voice/steps/StepV1Basics.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Languages, MessageSquareText } from 'lucide-react';
import { CARD_STYLE, GreenButton } from '../atoms';

type Props = { onNext?: () => void };

/** Language → Dialect/Accent options.
 *  Keep dialect values in BCP-47 form since ASR/TTS often expect that.
 */
const LANGUAGE_OPTIONS: Array<{
  id: string;            // base code
  label: string;         // human label
  dialects: { value: string; label: string }[];
}> = [
  {
    id: 'en',
    label: 'English',
    dialects: [
      { value: 'en-US', label: 'English (US)' },
      { value: 'en-GB', label: 'English (UK)' },
      { value: 'en-AU', label: 'English (Australia)' },
      { value: 'en-CA', label: 'English (Canada)' },
      { value: 'en-IN', label: 'English (India)' },
      { value: 'en-NZ', label: 'English (New Zealand)' },
      { value: 'en-IE', label: 'English (Ireland)' },
      { value: 'en-ZA', label: 'English (South Africa)' },
    ],
  },
  {
    id: 'es',
    label: 'Spanish',
    dialects: [
      { value: 'es-ES', label: 'Spanish (Spain)' },
      { value: 'es-MX', label: 'Spanish (Mexico)' },
      { value: 'es-US', label: 'Spanish (US)' },
      { value: 'es-AR', label: 'Spanish (Argentina)' },
      { value: 'es-CO', label: 'Spanish (Colombia)' },
      { value: 'es-CL', label: 'Spanish (Chile)' },
      { value: 'es-PE', label: 'Spanish (Peru)' },
    ],
  },
  {
    id: 'fr',
    label: 'French',
    dialects: [
      { value: 'fr-FR', label: 'French (France)' },
      { value: 'fr-CA', label: 'French (Canada)' },
      { value: 'fr-CH', label: 'French (Switzerland)' },
    ],
  },
  {
    id: 'pt',
    label: 'Portuguese',
    dialects: [
      { value: 'pt-PT', label: 'Portuguese (Portugal)' },
      { value: 'pt-BR', label: 'Portuguese (Brazil)' },
    ],
  },
  { id: 'de', label: 'German', dialects: [{ value: 'de-DE', label: 'German (Germany)' }] },
  { id: 'it', label: 'Italian', dialects: [{ value: 'it-IT', label: 'Italian (Italy)' }] },
  { id: 'nl', label: 'Dutch', dialects: [{ value: 'nl-NL', label: 'Dutch (Netherlands)' }] },
  { id: 'sv', label: 'Swedish', dialects: [{ value: 'sv-SE', label: 'Swedish (Sweden)' }] },
  {
    id: 'ar',
    label: 'Arabic',
    dialects: [
      { value: 'ar-SA', label: 'Arabic (Saudi Arabia)' },
      { value: 'ar-AE', label: 'Arabic (UAE)' },
      { value: 'ar-EG', label: 'Arabic (Egypt)' },
      { value: 'ar-MA', label: 'Arabic (Morocco)' },
    ],
  },
  { id: 'hi', label: 'Hindi', dialects: [{ value: 'hi-IN', label: 'Hindi (India)' }] },
  { id: 'ja', label: 'Japanese', dialects: [{ value: 'ja-JP', label: 'Japanese (Japan)' }] },
  { id: 'ko', label: 'Korean', dialects: [{ value: 'ko-KR', label: 'Korean (Korea)' }] },
  {
    id: 'zh',
    label: 'Chinese',
    dialects: [
      { value: 'zh-CN', label: 'Chinese (Mandarin, Mainland)' },
      { value: 'zh-TW', label: 'Chinese (Mandarin, Taiwan)' },
      { value: 'yue-HK', label: 'Cantonese (Hong Kong)' },
    ],
  },
];

/* localStorage helper */
const jget = <T,>(k: string, f: T): T => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : f; } catch { return f; } };

export default function StepV1Basics({ onNext }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [languageBase, setLanguageBase] = useState<string>('en');  // base language id (e.g., 'en')
  const [dialect, setDialect] = useState<string>('en-US');         // specific accent (e.g., 'en-US')

  // Load any previous draft
  useEffect(() => {
    const s = jget<any>('voicebuilder:step1', null);
    if (s) {
      setName(s.name || '');
      setIndustry(s.industry || '');
      if (s.languageBase) setLanguageBase(s.languageBase);
      // Support older saves where only `language` existed; treat it as dialect.
      if (s.dialect) setDialect(s.dialect);
      else if (s.language) setDialect(s.language);
    }
  }, []);

  // Dialect options for current base language
  const dialectOptions = useMemo(() => {
    const bucket = LANGUAGE_OPTIONS.find(l => l.id === languageBase);
    return bucket ? bucket.dialects : [];
  }, [languageBase]);

  // If language changes and current dialect no longer valid, reset to first
  useEffect(() => {
    if (!dialectOptions.length) return;
    const exists = dialectOptions.some(d => d.value === dialect);
    if (!exists) setDialect(dialectOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageBase]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Enter a name.';
    if (!industry.trim()) e.industry = 'Enter industry.';
    if (!languageBase) e.languageBase = 'Choose a language.';
    if (!dialect) e.dialect = 'Choose a dialect/accent.';
    return e;
  }, [name, industry, languageBase, dialect]);

  const canNext = Object.keys(errors).length === 0;

  function persistAndNext() {
    const payload = {
      name: name.trim(),
      industry: industry.trim(),
      languageBase, // e.g., 'en'
      dialect,      // e.g., 'en-US'
      // Back-compat for downstream code that expects `language`:
      language: dialect,
    };
    try { localStorage.setItem('voicebuilder:step1', JSON.stringify(payload)); } catch {}
    onNext?.();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold">Voice AI Basics</h1>
        <div className="text-xs px-3 py-1 rounded-2xl border"
             style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}>
          Step 1 of 4
        </div>
      </div>

      <div className="p-7 md:p-8" style={CARD_STYLE}>
        {/* Row 1: Name / Industry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field
            label="Agent Name *"
            value={name}
            onChange={setName}
            icon={<Sparkles className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.name}
            placeholder="e.g., Riley"
          />
          <Field
            label="Industry *"
            value={industry}
            onChange={setIndustry}
            icon={<MessageSquareText className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.industry}
            placeholder="e.g., Healthcare"
          />
        </div>

        {/* Row 2: Language + Dialect side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <Select
            label="Language *"
            value={languageBase}
            onChange={(v) => setLanguageBase(v)}
            options={LANGUAGE_OPTIONS.map(l => ({ value: l.id, label: l.label }))}
            icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.languageBase}
          />
          <Select
            label="Dialect / Accent *"
            value={dialect}
            onChange={(v) => setDialect(v)}
            options={dialectOptions}
            icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.dialect}
          />
        </div>

        <div className="mt-8 flex justify-end">
          <GreenButton disabled={!canNext} onClick={persistAndNext}>Next →</GreenButton>
        </div>
      </div>
    </section>
  );
}

/* -------------------- small UI atoms (local to step) -------------------- */

function Field({
  label, value, onChange, placeholder, icon, error,
}:{
  label: string; value: string; onChange: (v:string)=>void; placeholder?:string; icon?:React.ReactNode; error?:string;
}) {
  const border = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none"
           style={{ borderColor: border }}>
        {icon}
        <input
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
        />
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{error}</span> : null}
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options, icon, error,
}:{
  label:string;
  value:string;
  onChange:(v:string)=>void;
  options:{value:string;label:string}[];
  icon?:React.ReactNode;
  error?:string;
}) {
  const border = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none"
           style={{ borderColor: border }}>
        {icon}
        <select
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{error}</span> : null}
      </div>
    </div>
  );
}
