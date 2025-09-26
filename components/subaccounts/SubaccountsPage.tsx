'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot } from 'lucide-react';

/* Brand/colors (from your rail) */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const TEXT = 'rgba(236,242,247,.92)';
const MUTED = 'rgba(176,196,210,.60)';
const PANEL = '#0c1114';
const CANVAS = '#070b0d';

/* IDs (replace with backend IDs later) */
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return (t + r).slice(0, 8) + '-' + (t + r).slice(8, 13) + '-' + (t + r).slice(13, 18);
}

/* Build a 15-band step background:
   band 8 (center, 1-based) is darkest; each step away is +0.02 white mix. */
function bandedBackground(steps = 15) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2); // 8 for 15
  const bandWidth = 100 / steps;

  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);       // 0..7
    const lighten = Math.min(0.02 * dist, 0.14); // cap a bit on far edges
    const col = `color-mix(in oklab, ${PANEL} ${100 - lighten * 100}%, white ${lighten * 100}%)`;
    const start = (i - 1) * bandWidth;
    const end = i * bandWidth;
    parts.push(`${col} ${start}%, ${col} ${end}%`);
  }
  // Turn the steps into a hard-stop linear gradient
  return `linear-gradient(90deg, ${parts.join(', ')} )`;
}

/* Overlay-style icon tile (squared) */
function IconTile({ children, size = 108, radius = 12 }: { children: React.ReactNode; size?: number; radius?: number }) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background:
          `linear-gradient(180deg, rgba(89,217,179,.10), rgba(89,217,179,.02)),
           radial-gradient(60% 90% at 50% 10%, rgba(255,255,255,.06), rgba(255,255,255,0))`,
        border: `1px solid ${GREEN_LINE}`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.03), 0 8px 24px rgba(89,217,179,.10)',
        color: CTA,
        filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))',
      }}
    >
      {children}
    </div>
  );
}

type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'Dental Chatbot', agents: 1, active: true },
  ]);
  const count = useMemo(() => subs.length, [subs]);

  function createSub() {
    const name = prompt('Subaccount name?')?.trim();
    if (!name) return;
    setSubs([{ id: genId(), name, agents: 0, active: true }, ...subs]);
  }

  const CardRadius = 10;  // square-ish (keep)
  const CardHeight = 240; // a bit taller
  const CreateInnerRadius = 14; // create tile slightly more rounded per your ask

  return (
    <div className="px-6 pb-16 pt-6" style={{ background: CANVAS, color: TEXT, minHeight: '100dvh' }}>
      {/* Header row: title left; count + CTA right */}
      <div className="flex items-end gap-4">
        <div className="pb-3">
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.02em' }}>Subaccounts</div>
          {/* underline line exactly under header */}
          <div style={{ height: 1, background: GREEN_LINE, marginTop: 10, width: 220 }} />
        </div>

        <div className="ml-auto flex items-end gap-10 pb-2">
          {/* right count block */}
          <div className="text-right">
            <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
            <div style={{ fontSize: 12, color: MUTED }}>Subaccounts</div>
          </div>

          {/* top-right green button (white text) */}
          <button
            onClick={createSub}
            className="px-4 h-[40px] font-semibold"
            style={{
              background: CTA,
              color: '#fff',
              borderRadius: 10,
              border: `1px solid ${CTA}`,
              boxShadow: '0 12px 26px rgba(89,217,179,.18)',
            }}
          >
            New Subaccount
          </button>
        </div>
      </div>

      {/* Grid: 4 per row */}
      <div className="grid gap-6 mt-8" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {/* Create card (dashed) */}
        <button
          onClick={createSub}
          className="relative text-left group overflow-hidden"
          style={{
            height: CardHeight,
            borderRadius: CardRadius,
            background: PANEL,
            border: `1px dashed ${GREEN_LINE}`,
          }}
        >
          {/* 15-band background */}
          <div aria-hidden className="absolute inset-0" style={{ borderRadius: CardRadius, background: bandedBackground(15) }} />

          <div className="absolute inset-0 p-6 flex flex-col">
            <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>Add new workspace</div>

            <div className="flex-1 grid place-items-center">
              <IconTile radius={CreateInnerRadius}>
                <Plus size={58} strokeWidth={2.5} />
              </IconTile>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 6 }}>Click to create</div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition"
            style={{ borderRadius: CardRadius, boxShadow: `0 0 0 1px ${GREEN_LINE}, 0 12px 40px rgba(89,217,179,.18)` }}
          />
        </button>

        {/* Existing subs (solid border) */}
        {subs.map((s) => (
          <div
            key={s.id}
            className="relative overflow-hidden"
            style={{
              height: CardHeight,
              borderRadius: CardRadius,
              background: PANEL,
              border: `1px solid ${GREEN_LINE}`,
            }}
          >
            <div aria-hidden className="absolute inset-0" style={{ borderRadius: CardRadius, background: bandedBackground(15) }} />

            <div className="absolute inset-0 p-6 flex flex-col" style={{ color: TEXT }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>ID: {s.id}</div>

              <div className="flex-1 grid place-items-center">
                <IconTile>
                  <Bot size={54} strokeWidth={2.5} />
                </IconTile>
              </div>

              <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: MUTED }}>
                <span>{s.agents} AI Agents</span>
                <span>•</span>
                <span style={{ color: s.active ? CTA : MUTED }}>{s.active ? 'Active' : 'Paused'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        :global(body) { background: ${CANVAS}; }
      `}</style>
    </div>
  );
}
