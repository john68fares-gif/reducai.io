// components/voice/steps/StepV1Basics.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Sparkles, Languages, Building2, ArrowRight } from 'lucide-react';

/* --- Match Builder/Step1AIType visuals --- */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* --- Languages → Dialects list (BCP-47 codes) --- */
const LANGUAGE_OPTIONS: Array<{ id: string; label: string; dialects: { value: string; label: string }[] }> = [
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

type Props = { onNext?: () => void };

export default function StepV1Basics({ onNext }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [languageBase, setLanguageBase] = useState('en');
  const [dialect, setDialect] = useState('en-US');

  /* load draft */
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
      if (s && typeof s === 'object') {
        if (s.name) setName(String(s.name));
        if (s.industry) setIndustry(String(s.industry));
        if (s.languageBase) setLanguageBase(String(s.languageBase));
        if (s.dialect) setDialect(String(s.dialect));
        else if (s.language) setDialect(String(s.language)); // back-compat
      }
    } catch {}
  }, []);

  const dialectOptions = useMemo(() => {
    const bucket = LANGUAGE_OPTIONS.find(l => l.id === languageBase);
    return bucket ? bucket.dialects : [];
  }, [languageBase]);

  useEffect(() => {
    if (!dialectOptions.length) return;
    const ok = dialectOptions.some(d => d.value === dialect);
    if (!ok) setDialect(dialectOptions[0].value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageBase]);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter a name.';
    if (!industry.trim()) e.industry = 'Please enter your industry.';
    if (!languageBase) e.languageBase = 'Choose a language.';
    if (!dialect) e.dialect = 'Choose a dialect.';
    return e;
  }, [name, industry, languageBase, dialect]);

  const canNext = Object.keys(errors).length === 0;

  const persistAndNext = useCallback(() => {
    const payload = {
      name: name.trim(),
      industry: industry.trim(),
      languageBase,
      dialect,
      language: dialect, // keep for downstream compatibility
    };
    try { localStorage.setItem('voicebuilder:step1', JSON.stringify(payload)); } catch {}
    onNext?.();
  }, [name, industry, languageBase, dialect, onNext]);

  const onEnter = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canNext) { e.preventDefault(); persistAndNext(); }
  }, [canNext, persistAndNext]);

  const borderFor = (hasErr: boolean) => (hasErr ? 'rgba(255,120,120,0.55)' : '#13312b');

  return (
    <main className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]" onKeyDown={onEnter}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
        {/* Header pill + title to match builder */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
            style={{ borderColor: 'rgba(106,247,209,0.32)', background: 'rgba(16,19,20,0.70)' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#6af7d1]" />
            Step 1 · Voice Basics
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">Voice Agent Setup</h2>
          <p className="text-white/70 mt-1">Name it, set the industry, and choose how it speaks.</p>
        </div>

        {/* Form Card — bigger inputs like builder */}
        <section className="relative p-6 sm:p-8" style={CARD_STYLE}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            <Field
              label="Agent Name *"
              value={name}
              onChange={setName}
              placeholder="Enter agent name…"
              icon={<Sparkles className="w-4 h-4 text-[#6af7d1]" />}
              error={!!errors.name}
              errorText={errors.name}
            />
            <Field
              label="Industry *"
              value={industry}
              onChange={setIndustry}
              placeholder="Enter your industry…"
              icon={<Building2 className="w-4 h-4 text-[#6af7d1]" />}
              error={!!errors.industry}
              errorText={errors.industry}
            />

            {/* Language + Dialect side-by-side */}
            <Select
              label="Language *"
              value={languageBase}
              onChange={setLanguageBase}
              options={LANGUAGE_OPTIONS.map(l => ({ value: l.id, label: l.label }))}
              icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
              error={!!errors.languageBase}
              errorText={errors.languageBase}
            />
            <Select
              label="Dialect / Accent *"
              value={dialect}
              onChange={setDialect}
              options={dialectOptions}
              icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
              error={!!errors.dialect}
              errorText={errors.dialect}
            />
          </div>

          {/* Big Next button like builder */}
          <div className="mt-9 flex justify-end">
            <button
              disabled={!canNext}
              onClick={persistAndNext}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-[24px] text-[15px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
              style={{
                background: canNext ? BTN_GREEN : BTN_DISABLED,
                color: '#ffffff',
                boxShadow: canNext ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
                filter: canNext ? 'none' : 'saturate(85%) opacity(0.9)',
              }}
              onMouseEnter={(e) => {
                if (!canNext) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
              }}
              onMouseLeave={(e) => {
                if (!canNext) return;
                (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
              }}
            >
              Next <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

/* ----------------------- Inputs matching builder ----------------------- */

function Field({
  label, value, onChange, placeholder, icon, error, errorText,
}:{
  label: string; value: string; onChange: (v:string)=>void;
  placeholder?: string; icon?: React.ReactNode; error?: boolean; errorText?: string;
}) {
  const border = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="flex items-center gap-2 rounded-2xl bg-[#101314] px-5 py-4 border outline-none"
        style={{ borderColor: border }}
      >
        {icon}
        <input
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
          onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = '#00ffc2')}
          onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = border)}
        />
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{errorText}</span> : null}
      </div>
    </div>
  );
}

function Select({
  label, value, onChange, options, icon, error, errorText,
}:{
  label: string;
  value: string;
  onChange: (v:string)=>void;
  options: { value: string; label: string }[];
  icon?: React.ReactNode;
  error?: boolean;
  errorText?: string;
}) {
  const border = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="flex items-center gap-2 rounded-2xl bg-[#101314] px-5 py-4 border outline-none"
        style={{ borderColor: border }}
      >
        {icon}
        <select
          value={value}
          onChange={(e)=>onChange(e.target.value)}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
          onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = '#00ffc2')}
          onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = border)}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{errorText}</span> : null}
      </div>
    </div>
  );
}
