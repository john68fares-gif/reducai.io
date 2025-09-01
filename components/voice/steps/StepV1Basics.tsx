// components/voice/steps/StepV1Basics.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, Building2, Languages as LangIcon, ChevronDown, Search, ArrowRight,
} from 'lucide-react';
import CountryDialSelect from '@/components/phone-numbers/CountryDialSelect';

/* -------------------- shared styles (matches Builder vibe) -------------------- */
const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  // subtle separation from bg (soft glow)
  boxShadow: '0 18px 60px rgba(0,0,0,0.50), inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

type Props = { onNext?: () => void };

/* =================================================================================
   Step V1 — Voice Basics
   Fields: name, industry, language (dropdown), dialect/accent (country ISO-2)
   Persists to localStorage: voicebuilder:step1
================================================================================= */
export default function StepV1Basics({ onNext }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState<
    'English' | 'Spanish' | 'French' | 'Arabic' | 'German' | 'Portuguese' | 'Chinese' | 'Japanese'
  >('English');
  const [accentIso2, setAccentIso2] = useState<string>('US');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
      if (saved && typeof saved === 'object') {
        if (typeof saved.name === 'string') setName(saved.name);
        if (typeof saved.industry === 'string') setIndustry(saved.industry);
        if (typeof saved.language === 'string') setLanguage(saved.language);
        if (typeof saved.accentIso2 === 'string') setAccentIso2(saved.accentIso2.toUpperCase());
      }
    } catch {}
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter a name.';
    if (!industry.trim()) e.industry = 'Please enter your industry.';
    if (!language) e.language = 'Please choose a language.';
    if (!accentIso2) e.accent = 'Pick a country.';
    return e;
  }, [name, industry, language, accentIso2]);

  const canNext = Object.keys(errors).length === 0;

  function persistAndNext() {
    try {
      localStorage.setItem(
        'voicebuilder:step1',
        JSON.stringify({
          name: name.trim(),
          industry: industry.trim(),
          language,
          accentIso2: (accentIso2 || '').toUpperCase(), // save as 2-letter ISO
        }),
      );
    } catch {}
    onNext?.();
  }

  return (
    <section className="relative">
      {/* Header */}
      <div className="mb-6">
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

      {/* Form Card */}
      <div className="relative p-6 sm:p-8" style={CARD_STYLE}>
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Agent name */}
          <FieldShell label="Agent Name *" error={errors.name}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#6af7d1]" />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter agent name…"
                className="w-full bg-transparent outline-none text-[15px] text-white/95"
              />
            </div>
          </FieldShell>

          {/* Industry */}
          <FieldShell label="Industry *" error={errors.industry}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#6af7d1]" />
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Enter your industry…"
                className="w-full bg-transparent outline-none text-[15px] text-white/95"
              />
            </div>
          </FieldShell>

          {/* Language (styled portal dropdown) */}
          <FieldShell label="Language *" error={errors.language}>
            <LanguageSelect value={language} onChange={setLanguage} />
          </FieldShell>

          {/* Dialect / Accent (country ISO2) — identical height/rounding, NO inner label */}
          <FieldShell
            label={
              <>
                Dialect / Accent <span className="text-white/50 text-xs">(choose country)</span>
              </>
            }
            error={errors.accent}
          >
            {/* No label prop passed => no “Country” text inside the component */}
            <CountryDialSelect
              value={accentIso2}
              onChange={(iso2 /* , dial */) => setAccentIso2(iso2.toUpperCase())}
              id="voice-accent"
            />
          </FieldShell>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-end">
          <button
            disabled={!canNext}
            onClick={persistAndNext}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
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
      </div>
    </section>
  );
}

/* ------------------------------- Field wrapper ------------------------------ */
function FieldShell({
  label,
  error,
  children,
}: {
  label: React.ReactNode;
  error?: string;
  children: React.ReactNode;
}) {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : '#13312b';
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="rounded-2xl bg-[#101314] border px-3 py-2.5"
        style={{
          borderColor: borderBase,
          boxShadow: '0 8px 34px rgba(0,0,0,0.25)', // subtle shadow on the input shell
        }}
      >
        {children}
      </div>
      <div className="mt-1 text-xs">
        {error ? <span className="text-[rgba(255,138,138,0.95)]">{error}</span> : null}
      </div>
    </div>
  );
}

/* ---------------------------- Styled LanguageSelect ---------------------------- */
function LanguageSelect({
  value,
  onChange,
}: {
  value: 'English' | 'Spanish' | 'French' | 'Arabic' | 'German' | 'Portuguese' | 'Chinese' | 'Japanese';
  onChange: (v: any) => void;
}) {
  const options = [
    'English',
    'Spanish',
    'French',
    'Arabic',
    'German',
    'Portuguese',
    'Chinese',
    'Japanese',
  ] as const;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);

  const filtered = options.filter((o) => o.toLowerCase().includes(query.trim().toLowerCase()));

  useLayoutEffect(() => {
    if (!open) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (!r) return;
    const viewH = window.innerHeight;
    const openUp = r.bottom + 320 > viewH;
    setRect({ top: openUp ? r.top : r.bottom, left: r.left, width: r.width, openUp });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node) || portalRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    return () => window.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <>
      {/* trigger — same size/roundness as accent trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[14px] text-sm"
        style={{
          background: 'rgba(0,0,0,0.30)',
          border: '1px solid rgba(255,255,255,0.20)',
          boxShadow: '0 8px 34px rgba(0,0,0,0.25)',
        }}
      >
        <span className="flex items-center gap-2">
          <LangIcon className="w-4 h-4 text-white/75" />
          <span>{value}</span>
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {/* dropdown portal */}
      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              className="fixed z-[9999] p-3"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: '#101314',
                border: '1px solid rgba(255,255,255,0.30)',
                borderRadius: 20,
                boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.5)',
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.15)' }}
              >
                <Search className="w-4 h-4 text-white/70" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm text-white placeholder:text-white/60"
                />
              </div>

              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {filtered.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      onChange(opt);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left transition"
                    style={{ background: 'transparent', border: '1px solid transparent' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.10)';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                    }}
                  >
                    <LangIcon className="w-4 h-4 text-white/80" />
                    <span className="flex-1">{opt}</span>
                  </button>
                ))}
                {filtered.length === 0 && <div className="px-3 py-6 text-sm text-white/70">No matches.</div>}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
