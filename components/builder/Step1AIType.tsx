// components/builder/Step1AIType.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import StepProgress from './StepProgress';
import { Sparkles, MessageSquarePlus, Target, Languages, Building2, ArrowRight } from 'lucide-react';
import { s } from '@/utils/safe';

const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false });

const BTN_DISABLED = 'rgba(0,0,0,0.25)';

export default function Step1AIType({ onNext }: { onNext?: () => void }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState('');

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('builder:step1') || 'null');
      if (saved && typeof saved === 'object') {
        setName(s(saved.name));
        setIndustry(s(saved.industry));
        setLanguage(s(saved.language));
      }
    } catch {}
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!s(name).trim()) e.name = 'Please enter a name.';
    if (!s(industry).trim()) e.industry = 'Please enter your industry.';
    if (!s(language).trim()) e.language = 'Please enter a language.';
    return e;
  }, [name, industry, language]);

  const canContinue = Object.keys(errors).length === 0;

  const persistAndNext = useCallback(() => {
    try {
      localStorage.setItem('builder:step1', JSON.stringify({ type: 'sales', name, industry, language }));
    } catch {}
    onNext?.();
  }, [name, industry, language, onNext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canContinue) {
        e.preventDefault();
        persistAndNext();
      }
    },
    [canContinue, persistAndNext]
  );

  return (
    <main className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }} onKeyDown={handleKeyDown}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        <StepProgress current={1} />

        {/* Section bar (matches Dashboard / API Keys style) */}
        <div className="section-bar mt-4 mb-6">
          <span className="section-pill">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--brand)' }} />
            Step 1 · AI Type & Basics
          </span>
        </div>

        {/* Hero Card */}
        <section
          className="relative overflow-hidden p-7 md:p-8 mb-8 builder-card"
          style={{ borderRadius: 20 }}
        >
          {/* soft brand spot */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] builder-spot"
          />
          {/* faint grid sheen */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              opacity: 0.12,
              background:
                'linear-gradient(transparent 31px, rgba(0,0,0,.06) 32px), linear-gradient(90deg, transparent 31px, rgba(0,0,0,.06) 32px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 70%)',
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center relative">
            <div>
              <div className="text-xl font-semibold mb-2" style={{ color: 'var(--text)' }}>Sales AI</div>
              <p className="mb-5" style={{ color: 'var(--text-muted)' }}>A high-intent lead catcher with friendly, concise language.</p>

              <div className="flex flex-wrap gap-2">
                {[
                  ['Lead qualification', <Target key="t" className="w-3.5 h-3.5" />],
                  ['Product recommendations', <MessageSquarePlus key="m" className="w-3.5 h-3.5" />],
                  ['Follow-ups', <Sparkles key="s" className="w-3.5 h-3.5" />],
                ].map(([t, icon]) => (
                  <span
                    key={String(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl"
                    style={{
                      border: '1px solid var(--border)',
                      background: 'var(--card)',
                      color: 'var(--text)',
                      boxShadow: 'var(--shadow-card)',
                    }}
                  >
                    <span style={{ color: 'var(--brand)' }}>{icon as any}</span>
                    {t as string}
                  </span>
                ))}
              </div>
            </div>

            <div className="justify-self-end">
              <div
                className="w-44 h-44 rounded-3xl flex items-center justify-center"
                style={{
                  background: 'var(--card)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-card)',
                }}
              >
                {/* @ts-ignore */}
                <Bot3D accent="#6af7d1" variant="silver" idle withBody antenna />
              </div>
            </div>
          </div>
        </section>

        {/* Form Card */}
        <section className="relative p-6 sm:p-8 builder-card" style={{ borderRadius: 20 }}>
          <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] builder-spot" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              label="AI Name *"
              value={name}
              onChange={setName}
              placeholder="Enter AI name…"
              icon={<Sparkles className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              error={errors.name}
              hint="Shown on your build cards & analytics."
            />
            <Field
              label="Industry *"
              value={industry}
              onChange={setIndustry}
              placeholder="Enter your industry…"
              icon={<Building2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              error={errors.industry}
              hint="Used throughout Step 3 & 4."
            />
            <Field
              className="md:col-span-2"
              label="Language * (AI will speak this)"
              value={language}
              onChange={setLanguage}
              placeholder="Enter language (e.g., English)"
              icon={<Languages className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              error={errors.language}
              hint="This becomes the AI’s reply language."
            />
          </div>

          {/* Next button */}
          <div className="mt-8 flex justify-end">
            <button
              disabled={!canContinue}
              onClick={persistAndNext}
              className="inline-flex items-center gap-2 px-8 py-2.5 rounded-[24px] font-semibold select-none transition-all disabled:cursor-not-allowed"
              style={{
                background: canContinue ? 'var(--brand)' : BTN_DISABLED,
                color: canContinue ? '#000' : 'rgba(255,255,255,0.85)',
                boxShadow: canContinue ? '0 8px 22px rgba(0,255,194,.25)' : 'none',
                transform: 'translateZ(0)',
              }}
              onMouseEnter={(e) => {
                if (!canContinue) return;
                (e.currentTarget as HTMLButtonElement).style.filter = 'brightness(1.06)';
              }}
              onMouseLeave={(e) => {
                if (!canContinue) return;
                (e.currentTarget as HTMLButtonElement).style.filter = 'none';
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

/* ---------- Field ---------- */
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
  const borderErr = 'rgba(255,120,120,0.55)';
  const baseBorder = 'var(--border)';

  return (
    <div className={className}>
      <label className="block mb-2 text-[13px] font-medium tracking-wide" style={{ color: 'var(--text)' }}>
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-3.5 transition-[box-shadow,border-color] duration-150"
        style={{
          background: 'var(--card)',
          color: 'var(--text)',
          border: `1px solid ${error ? borderErr : baseBorder}`,
          boxShadow: 'var(--shadow-card)',
        }}
      >
        {icon}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent outline-none text-[15px]"
          style={{ color: 'var(--text)' }}
          onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--brand-weak)')}
          onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = error ? borderErr : getComputedStyle(document.documentElement).getPropertyValue('--border'))}
        />
      </div>
      <div className="mt-1 text-xs">
        {error ? (
          <span style={{ color: 'rgba(255,138,138,0.95)' }}>{error}</span>
        ) : hint ? (
          <span style={{ color: 'var(--text-muted)' }}>{hint}</span>
        ) : null}
      </div>
    </div>
  );
}
