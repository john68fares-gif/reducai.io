// components/voice/steps/StepV1Basics.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { Sparkles, Building2, Languages as LangIcon, ChevronDown, Search } from 'lucide-react';
import CountryDialSelect from '@/components/phone-numbers/CountryDialSelect';

type Props = { onNext?: () => void };

// ---------- shared styles ----------
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  borderRadius: 28,
  // subtle elevation like ChatGPT panels
  boxShadow:
    'inset 0 0 22px rgba(0,0,0,0.28), 0 20px 60px rgba(0,0,0,0.35), 0 1px 0 rgba(0,0,0,0.25)',
};
const INPUT_BORDER = '1px solid rgba(255,255,255,0.20)';
const INPUT_BG = 'rgba(0,0,0,0.30)';
const RADIUS = 16; // matches rounded-2xl (~16px)

export default function StepV1Basics({ onNext }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState<'English' | 'Spanish' | 'French' | 'Arabic' | 'German' | 'Portuguese' | 'Chinese' | 'Japanese'>('English');
  const [countryISO, setCountryISO] = useState<string>('US'); // 2-letter: US, IE, GB, etc.
  const [countryDial, setCountryDial] = useState<string>('1');

  // load saved
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
      if (s) {
        setName(s.name || '');
        setIndustry(s.industry || '');
        setLanguage((s.language || 'English'));
        setCountryISO(s.countryISO || 'US');
        setCountryDial(s.countryDial || '1');
      }
    } catch {}
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter a name.';
    if (!industry.trim()) e.industry = 'Please enter your industry.';
    return e;
  }, [name, industry]);

  function persistAndNext() {
    try {
      localStorage.setItem(
        'voicebuilder:step1',
        JSON.stringify({
          name,
          industry,
          language,     // e.g., "English"
          countryISO,   // e.g., "US" (accent/dialect by country)
          countryDial,  // e.g., "1"
        }),
      );
    } catch {}
    onNext?.();
  }

  const canNext = Object.keys(errors).length === 0;

  return (
    <section className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-6 pb-20">
      {/* header crumb */}
      <div className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
           style={{ borderColor: 'rgba(106,247,209,0.32)', background: 'rgba(16,19,20,0.70)' }}>
        <Sparkles className="w-3.5 h-3.5 text-[#6af7d1]" />
        Step 1 · Voice Basics
      </div>

      <h1 className="mt-3 text-3xl md:text-4xl font-semibold">Voice Agent Setup</h1>
      <p className="text-white/70 mt-1">Name it, set the industry, and choose how it speaks.</p>

      {/* form card */}
      <div className="relative mt-6 p-6 sm:p-8" style={FRAME}>
        {/* soft background glow */}
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
          />

          <Field
            label="Industry *"
            value={industry}
            onChange={setIndustry}
            placeholder="Enter your industry…"
            icon={<Building2 className="w-4 h-4 text-[#6af7d1]" />}
            error={errors.industry}
          />

          {/* Language (custom dropdown styled like CountryDialSelect) */}
          <Labeled label="Language *" className="">
            <LanguageSelect value={language} onChange={setLanguage} />
          </Labeled>

          {/* Dialect/Accent by country (2-letter ISO like US/GB/IE/etc.) */}
          <Labeled label="Dialect / Accent *(choose country)">
            <CountryDialSelect
              value={countryISO}
              onChange={(iso, dial) => { setCountryISO(iso); setCountryDial(dial); }}
              label="Country"
              id="accent-country"
            />
          </Labeled>
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={persistAndNext}
            disabled={!canNext}
            className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: '#59d9b3', color: '#0b0c10', boxShadow: '0 6px 28px rgba(0,255,194,0.2)' }}
          >
            Next
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Field (text) --------------------------------- */
function Field({
  label, value, onChange, placeholder, icon, error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  error?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      <div
        className="flex items-center gap-2 px-4 py-3.5"
        style={{
          borderRadius: RADIUS,
          background: INPUT_BG,
          border: focused ? '1px solid #00ffc2' : INPUT_BORDER,
          boxShadow: '0 8px 34px rgba(0,0,0,0.25)',
        }}
      >
        {icon}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[15px] text-white/95"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>
      {!!error && <div className="mt-1 text-xs text-[rgba(255,138,138,0.95)]">{error}</div>}
    </div>
  );
}

/* -------------------------------- Labeled wrapper -------------------------------- */
function Labeled({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className || ''}>
      <label className="block mb-2 text-[13px] font-medium text-white/85 tracking-wide">{label}</label>
      {children}
    </div>
  );
}

/* ----------------------------- LanguageSelect (styled) ----------------------------- */
/** Matches CountryDialSelect trigger: same height, radius, border, shadow. */
function LanguageSelect({
  value,
  onChange,
}: {
  value: 'English' | 'Spanish' | 'French' | 'Arabic' | 'German' | 'Portuguese' | 'Chinese' | 'Japanese';
  onChange: (v: any) => void;
}) {
  const options = ['English', 'Spanish', 'French', 'Arabic', 'German', 'Portuguese', 'Chinese', 'Japanese'] as const;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [rect, setRect] = useState<{ top: number; left: number; width: number; openUp: boolean } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

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
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left"
        style={{
          borderRadius: RADIUS,
          background: INPUT_BG,
          border: INPUT_BORDER,
          boxShadow: '0 8px 34px rgba(0,0,0,0.25)',
        }}
      >
        <span className="flex items-center gap-2">
          <LangIcon className="w-4 h-4 text-white/75" />
          <span>{value}</span>
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" />
      </button>

      {open && rect
        ? (typeof document !== 'undefined' && React.createPortal(
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

            <div ref={listRef} className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {filtered.map((opt) => (
                <button
                  key={opt}
                  onClick={() => { onChange(opt); setOpen(false); }}
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
        )) : null}
    </>
  );
}
