'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Bot } from 'lucide-react';

/* === BRAND (from your AssistantRail) === */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

/* === ID: real 24-hex like Mongo ObjectId === */
function genId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/* === Hard vertical bands (no gradient blur) ===========================
   n=15 bands, middle index darkest; each step away lightens ~2% (alpha).
   We build multiple non-repeating gradient layers with explicit positions.
====================================================================== */
function makeBands(n = 15, base = { r: 10, g: 16, b: 14, a: 0.84 }, step = 0.02) {
  if (n % 2 === 0) n += 1;
  const w = 100 / n;                 // width per band (%)
  const mid = Math.floor(n / 2);

  const imgs: string[] = [];
  const poss: string[] = [];
  const sizes: string[] = [];

  for (let i = 0; i < n; i++) {
    const dist = Math.abs(i - mid);
    const a = Math.max(0, base.a - dist * step);
    const color = `rgba(${base.r},${base.g},${base.b},${a.toFixed(3)})`;
    imgs.push(`linear-gradient(0deg, ${color}, ${color})`);
    poss.push(`${(i * w).toFixed(4)}% 0`);
    sizes.push(`${w.toFixed(4)}% 100%`);
  }

  return {
    backgroundImage: imgs.join(','),
    backgroundPosition: poss.join(','),
    backgroundSize: sizes.join(','),
    backgroundRepeat: 'no-repeat',
  } as React.CSSProperties;
}

/* === Types === */
type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'Dental Chatbot', agents: 1, active: true },
  ]);

  const total = subs.length;

  /* bands memoized (same for all cards) */
  const bands = useMemo(() => makeBands(15), []);

  return (
    <div className="px-6 pb-16">
      {/* Top row: Search (left) + Counter (right) + CTA (far right) */}
      <div className="mt-6 flex items-end gap-4">
        <div className="relative grow-0">
          <input
            aria-label="Search subaccounts"
            placeholder="Search subaccounts…"
            className="h-[40px] w-[420px] px-3 text-sm outline-none"
            style={{
              background: 'var(--panel)',
              color: 'var(--text)',
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: 10,
            }}
          />
        </div>

        <div className="ml-auto mr-4 text-right select-none" style={{ color: 'var(--text)' }}>
          <div className="text-[11px] opacity-70">You have</div>
          <div className="text-[30px] leading-none font-semibold">{total}</div>
          <div className="text-[11px] opacity-70 mt-1">subaccounts</div>
        </div>

        <button
          type="button"
          onClick={() => {
            const name = prompt('Subaccount name?')?.trim();
            if (!name) return;
            setSubs(s => [{ id: genId(), name, agents: 0, active: true }, ...s]);
          }}
          className="shrink-0 px-4 font-semibold"
          style={{
            height: 40,
            background: CTA,
            color: '#fff',                    // WHITE text inside the green button
            borderRadius: 10,
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: '0 8px 28px rgba(89,217,179,.18)',
          }}
        >
          New Subaccount
        </button>
      </div>

      {/* Grid — up to 4 SQUARES per row */}
      <div
        className="mt-6 grid gap-5"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        }}
      >
        {/* CREATE card (slightly rounder + dashed micro-border) */}
        <button
          type="button"
          onClick={() => {
            const name = prompt('Subaccount name?')?.trim();
            if (!name) return;
            setSubs(s => [{ id: genId(), name, agents: 0, active: true }, ...s]);
          }}
          className="text-left"
        >
          <SquareCard bands={bands} variant="create">
            <Header title="Create Subaccount" subtitle="Add new workspace" />
            <CenterTile icon="plus" />
            <div className="text-[12px] opacity-75" style={{ color: 'var(--text)' }}>
              Click to create
            </div>
          </SquareCard>
        </button>

        {/* Existing subaccounts (always square) */}
        {subs.map(s => (
          <Link key={s.id} href={`/subaccounts/${s.id}`} className="block">
            <SquareCard bands={bands}>
              <Header title={s.name} subtitle={`ID: ${s.id}`} />
              <CenterTile icon="bot" />
              <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--text)' }}>
                <span className="opacity-85">{s.agents} AI Agents</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: s.active ? 'rgba(34,197,94,.95)' : 'rgba(148,163,184,.9)' }}
                  />
                  <span className="opacity-90">{s.active ? 'Active' : 'Paused'}</span>
                </span>
              </div>
            </SquareCard>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ===== Pieces ====================================================== */

function Header({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-1">
      <div className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
        {title}
      </div>
      {subtitle && (
        <div className="text-[11px] mt-1 opacity-55" style={{ color: 'var(--text)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

/* Center icon tile — bigger and perfectly centered */
function CenterTile({ icon }: { icon: 'plus' | 'bot' }) {
  return (
    <div className="flex-1 grid place-items-center">
      <div
        className="grid place-items-center"
        style={{
          width: 116,
          height: 116,
          borderRadius: 12,
          background: 'rgba(255,255,255,.035)',
          border: `1px solid ${GREEN_LINE}`,
          boxShadow: 'inset 0 0 12px rgba(0,0,0,.28), 0 10px 26px rgba(0,0,0,.26)',
        }}
      >
        {icon === 'plus' ? (
          <Plus className="w-11 h-11" style={{ color: CTA, filter: 'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
        ) : (
          <Bot className="w-11 h-11" style={{ color: CTA, filter: 'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
        )}
      </div>
    </div>
  );
}

/* Square card shell with hard-lined background */
function SquareCard({
  children,
  bands,
  variant = 'normal',
}: {
  children: React.ReactNode;
  bands: React.CSSProperties;
  variant?: 'normal' | 'create';
}) {
  const radius = variant === 'create' ? 14 : 10;

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        aspectRatio: '1 / 1',                          // ALWAYS SQUARE
        borderRadius: radius,
        border: variant === 'create' ? `2px dashed ${GREEN_LINE}` : `1px solid ${GREEN_LINE}`,
        ...bands,                                       // <-- 15 HARD VERTICAL LINES
        boxShadow:
          'inset 0 0 14px rgba(0,0,0,.35), 0 10px 28px rgba(0,0,0,.25), 0 0 0 1px rgba(0,0,0,.18)',
        transition: 'transform .16s ease, box-shadow .16s ease, border-color .16s ease',
      }}
    >
      {/* squared glow on hover */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: 'radial-gradient(36% 36% at 50% 50%, rgba(89,217,179,.10) 0%, rgba(89,217,179,0) 100%)',
          transition: 'opacity .16s ease',
        }}
      />
      <div className="absolute inset-0 p-4 flex flex-col">{children}</div>
    </div>
  );
}
