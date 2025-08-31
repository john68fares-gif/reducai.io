'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Sparkles, Building2, Languages, ArrowRight } from 'lucide-react';
import CountryDialSelect from '@/components/phone-numbers/CountryDialSelect';

/* --- Same card + button styling as Builder Step1 --- */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/** Supported languages (simple, clean list) */
type Lang = { name: string; code: string };
const LANGUAGES: Lang[] = [
  { name: 'English', code: 'en' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'Arabic', code: 'ar' },
  { name: 'German', code: 'de' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Japanese', code: 'ja' },
];

/* tiny safe getter */
const s = (v: any, d = '') => (typeof v === 'string' ? v : d);

export default function StepV1Basics({ onNext }: { onNext?: () => void }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');

  // language (base) + accent country (2-letter ISO)
  const [langCode, setLangCode] = useState<string>('en');
  const [accentIso2, setAccentIso2] = useState<string>('US'); // stored/displayed upper, persisted lower

  // hydrate from previous saves
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
      if (saved && typeof saved === 'object') {
        setName(s(saved.name));
        setIndustry(s(saved.industry));

        // Try to restore language & country from earlier structures
        if (typeof saved.languageCode === 'string') setLangCode(saved.languageCode);
        else if (typeof saved.language === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(saved.language))
          setLangCode(saved.language.split('-')[0]);

        if (typeof saved.countryIso2 === 'string') setAccentIso2(saved.countryIso2.toUpperCase());
        else if (typeof saved.language === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(saved.language))
          setAccentIso2(saved.language.split('-')[1]);
        else if (typeof saved.dialect === 'string' && /^[a-z]{2}-[A-Z]{2}$/.test(saved.dialect))
          setAccentIso2(saved.dialect.split('-')[1]);
      }
    } catch {}
  }, []);

  const language = useMemo(
    () => LANGUAGES.find((l) => l.code === langCode) || LANGUAGES[0],
    [langCode]
  );

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter a name.';
    if (!industry.trim()) e.industry = 'Please enter your industry.';
    if (!langCode) e.language = 'Pick a language.';
    if (!accentIso2) e.accent = 'Pick a country.';
    return e;
  }, [name, industry, langCode, accentIso2]);

  const canContinue = Object.keys(errors).length === 0;

  const persistAndNext = useCallback(() => {
    const iso2Upper = accentIso2.toUpperCase();
    const iso2Lower = accentIso2.toLowerCase();
    const locale = `${langCode}-${iso2Upper}`; // e.g., en-US

    try {
      localStorage.setItem(
        'voicebuilder:step1',
        JSON.stringify({
          name,
          industry,
          languageName: language.name, // e.g., "English"
          languageCode: langCode,      // e.g., "en"
          language: locale,            // keep a canonical full locale for consumers
          dialect: locale,             // alias for compatibility
          countryIso2: iso2Upper,      // e.g., "US"
          accent2: iso2Lower,          // e.g., "us"  <-- what you asked to store
        })
      );
    } catch {}
    onNext?.();
  }, [name, industry, language.name, langCode, accentIso2, onNext]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canContinue) {
      e.preventDefault();
      persistAndNext();
    }
  };

  return (
    <section className="w-full" onKeyDown={onKeyDown}>
      {/* Header (Builder vibe) */}
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

      {/* Form Card (wider like Builder; language + accent span 2 cols) */}
      <section className="relative p-7 md:p-8" style={CARD_STYLE}>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Field
            label="Agent Name *"
            value={name}
            onChange={setName}
            placeholder="Enter agent name…"
            icon={<Sparkles className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.name}
            hint="Shown in Voice builds & analytics."
          />
          <Field
            label="Industry *"
            value={industry}
            onChange={setIndustry}
            placeholder="Enter your industry…"
            icon={<Building2 className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.industry}
            hint="Used in your prompt shaping."
          />

          {/* Language (full-width) */}
          <SelectField
            className="md:col-span-2"
            label="Language *"
            value={langCode}
            onChange={setLangCode}
            options={LANGUAGES.map((l) => ({ label: l.name, value: l.code }))}
            icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.language}
            hint="Base language for ASR/TTS."
          />

          {/* Dialect / Accent via CountryDialSelect (full-width, same dropdown style) */}
          <div className="md:col-span-2">
            <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">
              Dialect / Accent * <span className="text-white/50">(choose country)</span>
            </label>

            {/* Your styled country dropdown */}
            <CountryDialSelect
              value={accentIso2}
              onChange={(iso2 /* , dial */) => setAccentIso2(iso2.toUpperCase())}
              label=""
              id="accent-country"
            />

            {/* Little code pill showing the 2-letter we will save */}
            <div className="mt-2 text-xs text-white/70">
              Saving as: <span className="px-2 py-0.5 rounded-[10px] bg-white/10 border border-white/20">{accentIso2.toLowerCase()}</span>{' '}
              · Locale: <span className="px-2 py-0.5 rounded-[10px] bg-white/10 border border-white/20">{`${langCode}-${accentIso2}`}</span>
            </div>
            {errors.accent && <div className="mt-1 text-xs text-[rgba(255,138,138,0.95)]">{errors.accent}</div>}
          </div>
        </div>

        {/* Next button */}
        <div className="mt-8 flex justify-end">
          <button
            disabled={!canContinue}
            onClick={persistAndNext}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
            style={{
              background: canContinue ? BTN_GREEN : BTN_DISABLED,
              color: '#ffffff',
              boxShadow: canContinue ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
              filter: canContinue ? 'none' : 'saturate(85%) opacity(0.9)',
            }}
            onMouseEnter={(e) => {
              if (!canContinue) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
            }}
            onMouseLeave={(e) => {
              if (!canContinue) return;
              (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
            }}
          >
            Next <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </section>
    </section>
  );
}

/* ---------- Text Field (Builder-style) ---------- */
function Field({
  label,
  value,
  onChange,
  placeholder,
  icon,
  hint,
  error,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div className={className}>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none"
        style={{ borderColor: borderBase }}
      >
        {icon}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
          onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = '#00ffc2')}
          onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = borderBase)}
        />
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{error}</span> : hint ? <span className="text-white/45">{hint}</span> : null}
      </div>
    </div>
  );
}

/* ---------- Select Field (same size as Field) ---------- */
function SelectField({
  label,
  value,
  onChange,
  options,
  icon,
  hint,
  error,
  className = '',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
}) {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div className={className}>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="flex items-center gap-2 rounded-2xl bg-[#101314] px-4 py-3.5 border outline-none"
        style={{ borderColor: borderBase }}
      >
        {icon}
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none text-[15px] text-white/95 appearance-none"
          onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = '#00ffc2')}
          onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = borderBase)}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#101314] text-white">
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{error}</span> : hint ? <span className="text-white/45">{hint}</span> : null}
      </div>
    </div>
  );
}
