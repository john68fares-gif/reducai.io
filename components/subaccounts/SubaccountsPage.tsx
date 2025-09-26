'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Bot } from 'lucide-react';

/* Brand from your rail */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

/* ---------- ID generation: 24-char hex (Mongo-like) ---------- */
function genId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

/* ---------- Build 15 hard vertical bands, middle darkest ---------- */
/**
 * n = number of bands (must be odd so there's a center)
 * base = { r,g,b,a } starting color; we lighten α slightly per distance from center
 * step = 0.02 (≈2%) alpha decrease per step away from center
 */
function makeStripes(n = 15, base = { r: 12, g: 18, b: 16, a: 0.80 }, step = 0.02) {
  if (n % 2 === 0) n += 1;
  const bw = 100 / n; // band width in %
  const mid = Math.floor(n / 2);
  const layers: string[] = [];
  for (let i = 0; i < n; i++) {
    const dist = Math.abs(i - mid);
    const a = Math.max(0, base.a - dist * step); // lighter as we move away
    const color = `rgba(${base.r},${base.g},${base.b},${a.toFixed(3)})`;
    const left = (i * bw).toFixed(4);
    layers.push(
      `linear-gradient(0deg, ${color}, ${color})` + // solid band layer
      ` no-repeat ${left}% 0 / ${bw}% 100%`
    );
  }
  // join as backgrounds (CSS supports multiple images w/ positions/sizes)
  const img = layers.map(l => l.split(' no-repeat ')[0]).join(', ');
  const pos = layers.map(l => l.split(' no-repeat ')[1].split(' / ')[0]).join(', ');
  const size = layers.map(l => l.split(' / ')[1]).join(', ');
  return { backgroundImage: img, backgroundPosition: pos, backgroundSize: size };
}

/* ---------- Types ---------- */
type Subaccount = { id: string; name: string; agents: number; active: boolean };

export default function Subaccounts() {
  const [subs, setSubs] = useState<Subaccount[]>([
    { id: genId(), name: 'Dental Chatbot', agents: 1, active: true },
  ]);

  const total = subs.length;

  return (
    <div className="px-6 pb-12">
      {/* Top row: Search (left) + Counter (right) */}
      <div className="flex items-end justify-between gap-6 pt-6">
        <div className="relative">
          <input
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

        <div className="text-right select-none" style={{ color: 'var(--text)' }}>
          <div className="text-[11px] opacity-70">You have</div>
          <div className="text-[30px] leading-none font-semibold">{total}</div>
          <div className="text-[11px] opacity-70 mt-1">subaccounts</div>
        </div>
      </div>

      {/* Grid — 3 per row */}
      <div
        className="grid gap-5 mt-6"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
        {/* CREATE */}
        <button
          type="button"
          onClick={() => {
            const name = prompt('Subaccount name?')?.trim();
            if (!name) return;
            setSubs(prev => [{ id: genId(), name, agents: 0, active: true }, ...prev]);
          }}
          className="text-left"
        >
          <SquareCardShell variant="create">
            <CardHeader title="Create Subaccount" subtitle="Add new workspace" />
            <CenterTile kind="plus" />
            <div className="text-[12px] opacity-75" style={{ color: 'var(--text)' }}>
              Click to create
            </div>
          </SquareCardShell>
        </button>

        {/* SUBS */}
        {subs.map(s => (
          <Link key={s.id} href={`/subaccounts/${s.id}`}>
            <SquareCardShell>
              <CardHeader title={s.name} subtitle={`ID: ${s.id}`} />
              <CenterTile kind="bot" />
              <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--text)' }}>
                <span className="opacity-80">{s.agents} AI Agents</span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: s.active ? 'rgba(34,197,94,.95)' : 'rgba(148,163,184,.9)' }}
                  />
                  <span className="opacity-90">{s.active ? 'Active' : 'Paused'}</span>
                </span>
              </div>
            </SquareCardShell>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* ---------- Pieces ---------- */

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div>
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

/* Center icon tile (bigger) */
function CenterTile({ kind }: { kind: 'plus' | 'bot' }) {
  return (
    <div className="flex-1 grid place-items-center">
      <div
        className="grid place-items-center"
        style={{
          width: 112,
          height: 112,
          borderRadius: 12,
          background: 'rgba(255,255,255,.04)',
          border: `1px solid ${GREEN_LINE}`,
          boxShadow: 'inset 0 0 12px rgba(0,0,0,.24), 0 8px 24px rgba(0,0,0,.24)',
        }}
      >
        {kind === 'plus' ? (
          <Plus className="w-10 h-10" style={{ color: CTA, filter: 'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
        ) : (
          <Bot className="w-10 h-10" style={{ color: CTA, filter: 'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
        )}
      </div>
    </div>
  );
}

/* Square card with hard stripes + square hover glow */
function SquareCardShell({
  children,
  variant = 'normal',
}: {
  children: React.ReactNode;
  variant?: 'normal' | 'create';
}) {
  const radius = variant === 'create' ? 14 : 10;
  const stripes = makeStripes(15, { r: 12, g: 18, b: 16, a: 0.82 }, 0.02);

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        aspectRatio: '1 / 1',           // always SQUARE
        borderRadius: radius,
        border: variant === 'create' ? `2px dashed ${GREEN_LINE}` : `1px solid ${GREEN_LINE}`,
        // hard bands:
        backgroundImage: stripes.backgroundImage,
        backgroundPosition: stripes.backgroundPosition,
        backgroundSize: stripes.backgroundSize,
        // depth:
        boxShadow: 'inset 0 0 14px rgba(0,0,0,.35), 0 10px 28px rgba(0,0,0,.26), 0 0 0 1px rgba(0,0,0,.18)',
        transition: 'transform .16s ease, box-shadow .16s ease, border-color .16s ease',
      }}
    >
      {/* squared hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: 'radial-gradient(40% 40% at 50% 50%, rgba(89,217,179,.10) 0%, rgba(89,217,179,0) 100%)',
          transition: 'opacity .16s ease',
        }}
      />
      <div className="absolute inset-0 p-4 flex flex-col">{children}</div>
    </div>
  );
}
