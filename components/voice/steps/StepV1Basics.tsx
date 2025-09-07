// components/voice/steps/StepV1Basics.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles, Building2, Languages as LangIcon, ChevronDown, Search, ArrowRight,
} from 'lucide-react';

/* Brand button (keep your existing green) */
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

type Props = { onNext?: () => void };

/* =================================================================================
   Step V1 — Voice Basics
================================================================================= */
export default function StepV1Basics({ onNext }: Props) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');

  // Use the SAME dropdown for both fields so visuals match exactly
  const [language, setLanguage] = useState<
    'English' | 'Spanish' | 'French' | 'Arabic' | 'German' | 'Portuguese' | 'Chinese' | 'Japanese'
  >('English');
  const [accent, setAccent] = useState<
    'English' | 'Spanish' | 'French' | 'Arabic' | 'German' | 'Portuguese' | 'Chinese' | 'Japanese'
  >('English');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
      if (saved && typeof saved === 'object') {
        if (typeof saved.name === 'string') setName(saved.name);
        if (typeof saved.industry === 'string') setIndustry(saved.industry);
        if (typeof saved.language === 'string') setLanguage(saved.language);
        if (typeof saved.accent === 'string') setAccent(saved.accent);
        // Backward compat: migrate old accentIso2 -> accent (keeps UI working)
        if (typeof saved.accentIso2 === 'string' && !saved.accent) {
          setAccent(saved.accentIso2);
        }
      }
    } catch {}
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Please enter a name.';
    if (!industry.trim()) e.industry = 'Please enter your industry.';
    if (!language) e.language = 'Please choose a language.';
    if (!accent) e.accent = 'Please choose a dialect/accent.';
    return e;
  }, [name, industry, language, accent]);

  const canNext = Object.keys(errors).length === 0;

  function persistAndNext() {
    try {
      localStorage.setItem(
        'voicebuilder:step1',
        JSON.stringify({
          name: name.trim(),
          industry: industry.trim(),
          language,
          accent, // store the same styled value; no ISO transform anymore
        }),
      );
    } catch {}
    onNext?.();
  }

  return (
    <section className="relative voice-step-scope">
      {/* Header */}
      <div className="mb-6 animate-[fadeIn_180ms_var(--ease,_ease-out)_both]">
        <div
          className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
          style={{ borderColor: 'var(--vs-chip-border)', background: 'var(--vs-chip-bg)', color: 'var(--text)' }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--brand)' }} />
          Step 1 · Voice Basics
        </div>
        <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight" style={{ color: 'var(--text)' }}>
          Voice Agent Setup
        </h2>
        <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
          Name it, set the industry, and choose how it speaks.
        </p>
      </div>

      {/* Form Card (kept exactly as your visuals) */}
      <div
        className="relative p-6 sm:p-8 rounded-[28px] animate-[popIn_180ms_var(--ease,_ease-out)_both] glow-spot"
        style={{
          background: 'var(--vs-card)',
          border: '1px solid var(--vs-border)',
          boxShadow: 'var(--vs-shadow)',
        }}
      >
        {/* radial brand glow behind */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
          style={{
            background: 'radial-gradient(circle, var(--vs-ring) 0%, transparent 70%)',
            filter: 'blur(38px)',
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Agent name */}
          <FieldShell label="Agent Name" error={errors.name}>
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter agent name…"
                className="w-full bg-transparent outline-none text-[15px]"
                style={{ color: 'var(--text)' }}
              />
            </div>
          </FieldShell>

          {/* Industry */}
          <FieldShell label="Industry" error={errors.industry}>
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <input
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                placeholder="Enter your industry…"
                className="w-full bg-transparent outline-none text-[15px]"
                style={{ color: 'var(--text)' }}
              />
            </div>
          </FieldShell>

          {/* Language (styled portal dropdown) */}
          <FieldShell label="Language" error={errors.language}>
            <LanguageSelect value={language} onChange={setLanguage} />
          </FieldShell>

          {/* Dialect / Accent — EXACT same dropdown as Language */}
          <FieldShell
            label={
              <>
                Dialect / Accent <span className="text-xs" style={{ color: 'var(--text-muted)' }}>(choose)</span>
              </>
            }
            error={errors.accent}
          >
            <LanguageSelect value={accent} onChange={setAccent} />
          </FieldShell>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-end">
          <button
            disabled={!canNext}
            onClick={persistAndNext}
            className="inline-flex items-center gap-2 px-8 h-[44px] rounded-[24px] font-semibold select-none transition will-change-transform disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              background: canNext ? BTN_GREEN : BTN_DISABLED,
              color: '#ffffff',
              boxShadow: canNext
                ? '0 12px 26px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.06)'
                : 'none',
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

      {/* Scoped theme vars + animations for Step 1 + PORTAL TOKENS */}
      <style jsx global>{`
        @keyframes popIn { 0% { opacity: 0; transform: scale(.985); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }

        /* LIGHT (default) */
        .voice-step-scope{
          --vs-card: #ffffff;
          --vs-border: rgba(0,0,0,.10);
          --vs-shadow: 0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02);
          --vs-ring: rgba(0,255,194,.10);

          --vs-input-bg: #ffffff;
          --vs-input-border: rgba(0,0,0,.12);
          --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.8), 0 10px 22px rgba(0,0,0,.06);

          --vs-chip-bg: rgba(0,255,194,.10);
          --vs-chip-border: rgba(0,255,194,.30);
        }

        /* DARK */
        [data-theme="dark"] .voice-step-scope{
          --vs-card:
            radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
            linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
          --vs-border: rgba(255,255,255,.08);
          --vs-shadow: 0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10);
          --vs-ring: rgba(0,255,194,.12);

          --vs-input-bg: rgba(255,255,255,.02);
          --vs-input-border: rgba(255,255,255,.14);
          --vs-input-shadow: inset 0 1px 0 rgba(255,255,255,.04), 0 12px 30px rgba(0,0,0,.38);

          --vs-chip-bg: rgba(0,255,194,.10);
          --vs-chip-border: rgba(0,255,194,.28);
        }

        /* PORTAL MENU SURFACE (both dropdowns) */
        .voice-step1-scope__portal{
          --vs-menu-bg: #ffffff;
          --vs-menu-border: rgba(0,0,0,.10);
        }
        [data-theme="dark"] .voice-step1-scope__portal{
          --vs-menu-bg: #101314;
          --vs-menu-border: rgba(255,255,255,.16);
        }
      `}</style>
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
  const borderBase = error ? 'rgba(255,120,120,0.55)' : 'var(--vs-input-border)';
  return (
    <div className="animate-[fadeIn_160ms_var(--ease,_ease-out)_both]">
      <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <div
        className="rounded-2xl px-3 py-2.5"
        style={{
          background: 'var(--vs-input-bg)',
          border: `1px solid ${borderBase}`,
          boxShadow: 'var(--vs-input-shadow)',
        }}
      >
        {children}
      </div>
      <div className="mt-1 text-xs" style={{ color: error ? 'rgba(255,138,138,0.95)' : 'var(--text-muted)' }}>
        {error ? error : null}
      </div>
    </div>
  );
}

/* ---------------------------- Styled LanguageSelect (reused for both) ---------------------------- */
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
      {/* trigger */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[14px] text-sm transition will-change-transform"
        style={{
          background: 'var(--vs-input-bg)',
          border: '1px solid var(--vs-input-border)',
          boxShadow: 'var(--vs-input-shadow)',
          color: 'var(--text)',
        }}
      >
        <span className="flex items-center gap-2">
          <LangIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          <span>{value}</span>
        </span>
        <ChevronDown className="w-4 h-4 opacity-80" style={{ color: 'var(--text-muted)' }} />
      </button>

      {/* dropdown portal */}
      {open && rect && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={portalRef}
              className="voice-step1-scope__portal fixed z-[9999] p-3 animate-[popIn_140ms_ease-out]"
              style={{
                top: rect.openUp ? rect.top - 8 : rect.top + 8,
                left: rect.left,
                width: rect.width,
                transform: rect.openUp ? 'translateY(-100%)' : 'none',
                background: 'var(--vs-menu-bg)',
                border: '1px solid var(--vs-menu-border)',
                borderRadius: 20,
                boxShadow:
                  '0 28px 70px rgba(0,0,0,.12), 0 10px 26px rgba(0,0,0,.08), 0 0 0 1px rgba(0,0,0,.02)',
              }}
            >
              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{
                  background: 'var(--vs-input-bg)',
                  border: '1px solid var(--vs-input-border)',
                  boxShadow: 'var(--vs-input-shadow)',
                  color: 'var(--text)',
                }}
              >
                <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text)' }}
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
                    style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text)' }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,255,194,0.10)';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid rgba(0,255,194,0.35)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
                      (e.currentTarget as HTMLButtonElement).style.border = '1px solid transparent';
                    }}
                  >
                    <LangIcon className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    <span className="flex-1">{opt}</span>
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No matches.
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
