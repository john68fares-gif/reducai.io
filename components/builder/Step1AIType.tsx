
// components/builder/Step1AIType.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import StepProgress from './StepProgress';
import { Sparkles, MessageSquarePlus, Target, Languages, Building2, ArrowRight } from 'lucide-react';
import { s } from '@/utils/safe';

const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false });

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

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
    <main className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]" onKeyDown={handleKeyDown}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
        <StepProgress current={1} />

        {/* Header */}
        <div className="mb-8">
          <div
            className="inline-flex items-center gap-2 text-xs tracking-wide px-3 py-1.5 rounded-[20px] border"
            style={{ borderColor: 'rgba(106,247,209,0.32)', background: 'rgba(16,19,20,0.70)' }}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#6af7d1]" />
            Step 1 · AI Type & Basics
          </div>
          <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">Sales AI Setup</h2>
          <p className="text-white/70 mt-1">Tell us the basics; we’ll style the rest like your Step 3.</p>
        </div>

        {/* Hero Card */}
        <section className="relative overflow-hidden p-7 md:p-8 mb-8" style={CARD_STYLE}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[.15]"
            style={{
              background:
                'linear-gradient(transparent 31px, rgba(255,255,255,.06) 32px), linear-gradient(90deg, transparent 31px, rgba(255,255,255,.06) 32px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 70%)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-14 w-80 h-80 rotate-12 rounded-3xl"
            style={{ background: 'linear-gradient(135deg, rgba(106,247,209,0.12), transparent 60%)', filter: 'blur(22px)' }}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center relative">
            <div>
              <div className="text-xl font-semibold mb-2">Sales AI</div>
              <p className="text-white/70 mb-5">A high-intent lead catcher with friendly, concise language.</p>

              <div className="flex flex-wrap gap-2">
                {[
                  ['Lead qualification', <Target key="t" className="w-3.5 h-3.5" />],
                  ['Product recommendations', <MessageSquarePlus key="m" className="w-3.5 h-3.5" />],
                  ['Follow-ups', <Sparkles key="s" className="w-3.5 h-3.5" />],
                ].map(([t, icon]) => (
                  <span
                    key={String(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border"
                    style={{ borderColor: 'rgba(106,247,209,0.38)', background: 'rgba(16,19,20,0.65)' }}
                  >
                    {icon}
                    {t as string}
                  </span>
                ))}
              </div>
            </div>

            <div className="justify-self-end">
              <div
                className="w-44 h-44 rounded-3xl flex items-center justify-center"
                style={{
                  background: 'radial-gradient(circle at 50% 20%, rgba(0,0,0,0.45), rgba(0,0,0,0.12))',
                  border: '1px solid rgba(255,255,255,0.06)',
                  boxShadow: 'inset 0 0 24px rgba(0,0,0,0.45)',
                }}
              >
                {/* @ts-ignore */}
                <Bot3D accent="#6af7d1" variant="silver" idle withBody antenna />
              </div>
            </div>
          </div>
        </section>

        {/* Form Card */}
        <section className="relative p-6 sm:p-8" style={CARD_STYLE}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              label="AI Name *"
              value={name}
              onChange={setName}
              placeholder="Enter AI name…"
              icon={<Sparkles className="w-4 h-4 text-[#6af7d1]" />}
              error={errors.name}
              hint="Shown on your build cards & analytics."
            />
            <Field
              label="Industry *"
              value={industry}
              onChange={setIndustry}
              placeholder="Enter your industry…"
              icon={<Building2 className="w-4 h-4 text-[#6af7d1]" />}
              error={errors.industry}
              hint="Used throughout Step 3 & 4."
            />
            <Field
              className="md:col-span-2"
              label="Language * (AI will speak this)"
              value={language}
              onChange={setLanguage}
              placeholder="Enter language (e.g., English)"
              icon={<Languages className="w-4 h-4 text-[#6af7d1]" />}
              error={errors.language}
              hint="This becomes the AI’s reply language."
            />
          </div>

          {/* Next button — shorter height */}
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


