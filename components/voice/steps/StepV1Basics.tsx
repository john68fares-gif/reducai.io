'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Sparkles, Building2, Languages, ArrowRight } from 'lucide-react';

/* ——— Visuals match your Builder Step1 ——— */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/** Language + Dialect options (expand as needed) */
type Dialect = { label: string; value: string };
type Lang = { name: string; code: string; dialects: Dialect[] };

const LANGUAGES: Lang[] = [
  {
    name: 'English',
    code: 'en',
    dialects: [
      { label: 'English (US)', value: 'en-US' },
      { label: 'English (UK)', value: 'en-GB' },
      { label: 'English (Australia)', value: 'en-AU' },
      { label: 'English (India)', value: 'en-IN' },
    ],
  },
  {
    name: 'Spanish',
    code: 'es',
    dialects: [
      { label: 'Spanish (US)', value: 'es-US' },
      { label: 'Spanish (Spain)', value: 'es-ES' },
      { label: 'Spanish (Mexico)', value: 'es-MX' },
    ],
  },
  {
    name: 'French',
    code: 'fr',
    dialects: [
      { label: 'French (France)', value: 'fr-FR' },
      { label: 'French (Canada)', value: 'fr-CA' },
    ],
  },
  {
    name: 'Arabic',
    code: 'ar',
    dialects: [
      { label: 'Arabic (Egypt)', value: 'ar-EG' },
      { label: 'Arabic (Saudi Arabia)', value: 'ar-SA' },
    ],
  },
  {
    name: 'German',
    code: 'de',
    dialects: [{ label: 'German (Germany)', value: 'de-DE' }],
  },
  {
    name: 'Portuguese',
    code: 'pt',
    dialects: [
      { label: 'Portuguese (Brazil)', value: 'pt-BR' },
      { label: 'Portuguese (Portugal)', value: 'pt-PT' },
    ],
  },
  {
    name: 'Chinese',
    code: 'zh',
    dialects: [
      { label: 'Chinese (Mainland)', value: 'zh-CN' },
      { label: 'Chinese (Taiwan)', value: 'zh-TW' },
    ],
  },
  {
    name: 'Japanese',
    code: 'ja',
    dialects: [{ label: 'Japanese (Japan)', value: 'ja-JP' }],
  },
];

/** tiny safe getter */
const s = (v: any, d = '') => (typeof v === 'string' ? v : d);

export default function StepV1Basics({ onNext }: { onNext?: () => void }) {
  // fields
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');

  // language & dialect
  const [langCode, setLangCode] = useState<string>('en'); // e.g., 'en'
  const [dialect, setDialect] = useState<string>('en-US'); // e.g., 'en-US'

  // hydrate from previous save (voicebuilder:step1)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
      if (saved && typeof saved === 'object') {
        setName(s(saved.name));
        setIndustry(s(saved.industry));
        // prefer saved dialect (locale) and infer language code from it
        if (typeof saved.language === 'string' && saved.language.trim()) {
          setDialect(saved.language.trim());
          const match = LANGUAGES.find((L) => saved.language.startsWith(L.code + '-')) || LANGUAGES[0];
          setLangCode(match.code);
        } else {
          // or saved languageCode + dialect
          if (typeof saved.languageCode === 'string') setLangCode(saved.languageCode);
          if (typeof saved.dialect === 'string') setDialect(saved.dialect);
        }
      }
    } catch {}
  }, []);

  const language = useMemo(
    () => LANGUAGES.find((l) => l.code === langCode) || LANGUAGES[0],
    [langCode]
  );

  // keep dialect valid when language changes
  useEffect(() => {
    if (!language.dialects.find((d) => d.value === dialect)) {
      setDialect(language.dialects[0]?.value || '');
    }
  }, [language, dialect]);

  // validation
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter a name.';
    if (!industry.trim()) e.industry = 'Please enter your industry.';
    if (!dialect) e.dialect = 'Pick a dialect/accent.';
    return e;
  }, [name, industry, dialect]);

  const canContinue = Object.keys(errors).length === 0;

  const persistAndNext = useCallback(() => {
    try {
      // Save both the display language and the specific locale
      localStorage.setItem(
        'voicebuilder:step1',
        JSON.stringify({
          name,
          industry,
          languageName: language.name, // e.g., "English"
          languageCode: langCode,      // e.g., "en"
          language: dialect,           // canonical locale used later: "en-US"
          dialect,                     // duplicate key for clarity
        })
      );
    } catch {}
    onNext?.();
  }, [name, industry, language.name, langCode, dialect, onNext]);

  // Enter key to continue
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && canContinue) {
      e.preventDefault();
      persistAndNext();
    }
  };

  return (
    <section className="w-full" onKeyDown={onKeyDown}>
      {/* Header (matches Builder tone) */}
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

      {/* Form card — bigger area, same style as Builder */}
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
            hint="Shown in your Voice builds & analytics."
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

          {/* Language select */}
          <SelectField
            label="Language *"
            value={langCode}
            onChange={setLangCode}
            options={LANGUAGES.map((l) => ({ label: l.name, value: l.code }))}
            icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
            hint="Base language used for ASR/TTS."
          />

          {/* Dialect/Accent select — same height & style */}
          <SelectField
            label="Dialect / Accent *"
            value={dialect}
            onChange={setDialect}
            options={language.dialects}
            icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.dialect}
            hint="Specific locale (e.g., en-US)."
          />
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

/* ---------- Text Field (matches Builder) ---------- */
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

/* ---------- Select Field (same height/box as Field) ---------- */
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
