// components/builder/Step1AIType.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import StepProgress from './StepProgress';
import { Sparkles, MessageSquarePlus, Target, Languages, Building2, ArrowRight, Loader2 } from 'lucide-react';
import { s } from '@/utils/safe';

const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false });

/**
 * Matches the “green button” vibe you use on API Keys / Phone Numbers:
 * - Always white text (both light & dark)
 * - Brand-tinted surface with subtle glow and border
 * - Hover/active states and disabled style
 *
 * Relies on your global CSS variables: --brand, --brand-weak, --panel, --border, --text, --text-muted, --card, --shadow-card, --shadow-soft, --bg
 */
const BTN_STYLE: React.CSSProperties = {
  background:
    'linear-gradient(180deg, color-mix(in oklab, var(--brand) 28%, var(--panel)) 0%, color-mix(in oklab, var(--brand) 18%, var(--panel)) 100%)',
  color: '#fff',
  border: '1px solid color-mix(in oklab, var(--brand) 55%, var(--border))',
  boxShadow:
    '0 6px 22px color-mix(in oklab, var(--brand) 20%, transparent), inset 0 0 0 1px color-mix(in oklab, #fff 6%, transparent)',
};

const BTN_HOVER: React.CSSProperties = {
  background:
    'linear-gradient(180deg, color-mix(in oklab, var(--brand) 36%, var(--panel)) 0%, color-mix(in oklab, var(--brand) 26%, var(--panel)) 100%)',
  boxShadow:
    '0 10px 28px color-mix(in oklab, var(--brand) 28%, transparent), inset 0 0 0 1px color-mix(in oklab, #fff 7%, transparent)',
};

const BTN_DISABLED: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--brand) 10%, var(--panel))',
  color: 'rgba(255,255,255,.85)',
  border: '1px solid color-mix(in oklab, var(--brand) 22%, var(--border))',
  boxShadow: 'none',
  filter: 'saturate(85%) opacity(.85)',
};

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 20,
};

export default function Step1AIType({ onNext }: { onNext?: () => void }) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [language, setLanguage] = useState('');
  const [booting, setBooting] = useState(true);
  const [nextLoading, setNextLoading] = useState(false);

  // Load saved
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('builder:step1') || 'null');
      if (saved && typeof saved === 'object') {
        setName(s(saved.name));
        setIndustry(s(saved.industry));
        setLanguage(s(saved.language));
      }
    } catch {}
    const t = setTimeout(() => setBooting(false), 280);
    return () => clearTimeout(t);
  }, []);

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!s(name).trim()) e.name = 'Please enter a name.';
    if (!s(industry).trim()) e.industry = 'Please enter your industry.';
    if (!s(language).trim()) e.language = 'Please enter a language.';
    return e;
  }, [name, industry, language]);

  const canContinue = Object.keys(errors).length === 0;

  const persist = useCallback(() => {
    try {
      localStorage.setItem('builder:step1', JSON.stringify({ type: 'sales', name, industry, language }));
    } catch {}
  }, [name, industry, language]);

  const persistAndNext = useCallback(async () => {
    if (!canContinue || nextLoading) return;
    setNextLoading(true);
    persist();
    // tiny staged delay for “loading phase” feedback
    await new Promise((r) => setTimeout(r, 420));
    onNext?.();
    setNextLoading(false);
  }, [canContinue, nextLoading, persist, onNext]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && canContinue && !nextLoading) {
        e.preventDefault();
        persistAndNext();
      }
    },
    [canContinue, nextLoading, persistAndNext]
  );

  return (
    <main className="min-h-screen w-full font-movatif" style={{ background: 'var(--bg)', color: 'var(--text)' }} onKeyDown={handleKeyDown}>
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-24">
        {/* StepProgress only (removed the extra “Step 1 …” header per your ask) */}
        <StepProgress current={1} />

        {/* HERO / INFO CARD */}
        <section className="relative overflow-hidden p-6 md:p-7 mb-8" style={CARD}>
          {/* soft brand grid + glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[.10]"
            style={{
              background:
                'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
              backgroundSize: '32px 32px',
              maskImage: 'radial-gradient(circle at 30% 20%, black, transparent 70%)',
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center relative">
            <div>
              <div className="text-xl font-semibold mb-2">Sales AI</div>
              <p className="opacity-80 mb-5" style={{ color: 'var(--text-muted)' }}>
                A high-intent lead catcher with friendly, concise language.
              </p>

              <div className="flex flex-wrap gap-2">
                {[
                  ['Lead qualification', <Target key="t" className="w-3.5 h-3.5" />],
                  ['Product recommendations', <MessageSquarePlus key="m" className="w-3.5 h-3.5" />],
                  ['Follow-ups', <Sparkles key="s" className="w-3.5 h-3.5" />],
                ].map(([t, icon]) => (
                  <span
                    key={String(t)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-2xl border"
                    style={{
                      borderColor: 'var(--border)',
                      background: 'var(--panel)',
                      boxShadow: 'var(--shadow-soft)',
                      color: 'var(--text)',
                    }}
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
                  background: 'radial-gradient(circle at 50% 20%, rgba(0,0,0,0.18), rgba(0,0,0,0.06))',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-soft)',
                }}
              >
                {/* @ts-ignore */}
                <Bot3D accent="var(--brand)" variant="silver" idle withBody antenna />
              </div>
            </div>
          </div>
        </section>

        {/* FORM CARD */}
        <section className="relative p-6 sm:p-7" style={CARD}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background: 'radial-gradient(circle, color-mix(in oklab, var(--brand) 14%, transparent) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Field
              label="AI Name *"
              value={name}
              onChange={(v) => {
                setName(v);
                if (!booting) localStorage.setItem('builder:step1', JSON.stringify({ name: v, industry, language, type: 'sales' }));
              }}
              placeholder="Enter AI name…"
              icon={<Sparkles className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              error={errors.name}
              hint="Shown on your build rows & analytics."
              booting={booting}
            />
            <Field
              label="Industry *"
              value={industry}
              onChange={(v) => {
                setIndustry(v);
                if (!booting) localStorage.setItem('builder:step1', JSON.stringify({ name, industry: v, language, type: 'sales' }));
              }}
              placeholder="Enter your industry…"
              icon={<Building2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              error={errors.industry}
              hint="Used throughout Step 3 & 4."
              booting={booting}
            />
            <Field
              className="md:col-span-2"
              label="Language * (AI will speak this)"
              value={language}
              onChange={(v) => {
                setLanguage(v);
                if (!booting) localStorage.setItem('builder:step1', JSON.stringify({ name, industry, language: v, type: 'sales' }));
              }}
              placeholder="Enter language (e.g., English)"
              icon={<Languages className="w-4 h-4" style={{ color: 'var(--brand)' }} />}
              error={errors.language}
              hint="This becomes the AI’s reply language."
              booting={booting}
            />
          </div>

          {/* NEXT button (API-keys/Numbers green style) */}
          <div className="mt-8 flex justify-end">
            <button
              disabled={!canContinue || nextLoading}
              onClick={persistAndNext}
              className="inline-flex items-center gap-2 px-7 py-2.5 rounded-[12px] font-semibold select-none transition-all duration-150 disabled:cursor-not-allowed"
              style={{
                ...(canContinue && !nextLoading ? BTN_STYLE : BTN_DISABLED),
                transform: nextLoading ? 'translateY(0)' : 'translateY(0)',
              }}
              onMouseEnter={(e) => {
                if (!canContinue || nextLoading) return;
                Object.assign((e.currentTarget as HTMLButtonElement).style, BTN_HOVER);
              }}
              onMouseLeave={(e) => {
                if (!canContinue || nextLoading) return;
                Object.assign((e.currentTarget as HTMLButtonElement).style, BTN_STYLE);
              }}
            >
              {nextLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Next'}
              {!nextLoading && <ArrowRight className="w-4 h-4" />}
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
  booting,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon?: React.ReactNode;
  hint?: string;
  error?: string;
  className?: string;
  booting?: boolean;
}) {
  const borderBase = error ? 'rgba(255,120,120,0.55)' : 'var(--border)';

  return (
    <div className={className}>
      <label className="block mb-2 text-[13px] font-medium" style={{ color: 'var(--text)' }}>
        {label}
      </label>

      {/* Loading shimmer while booting */}
      {booting ? (
        <div
          className="h-[46px] rounded-2xl animate-pulse"
          style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)' }}
        />
      ) : (
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-3.5 border outline-none"
          style={{ borderColor: borderBase, background: 'var(--panel)', boxShadow: 'var(--shadow-soft)' }}
        >
          {icon}
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent outline-none text-[15px]"
            style={{ color: 'var(--text)' }}
            onFocus={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = 'var(--brand)')}
            onBlur={(e) => ((e.currentTarget.parentElement as HTMLDivElement).style.borderColor = borderBase)}
          />
        </div>
      )}

      <div className="mt-1 text-xs" style={{ color: error ? 'rgba(255,138,138,0.95)' : 'var(--text-muted)' }}>
        {error ? error : hint || null}
      </div>
    </div>
  );
}
