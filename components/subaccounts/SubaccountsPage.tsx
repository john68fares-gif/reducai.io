'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot, User2, X } from 'lucide-react';

/* Brand (from your rail) */
const CTA = '#59d9b3';                           // green accent
const GREEN_LINE = 'rgba(89,217,179,.18)';       // card borders / seams
const CANVAS = '#070b0d';                        // page bg
const PANEL  = '#0b0f11';                        // card base
const TEXT   = 'rgba(236,242,247,.92)';
const MUTED  = 'rgba(176,196,210,.58)';

/* ID util (placeholder until backend) */
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return `${(t + r).slice(0, 8)}-${(t + r).slice(8, 13)}-${(t + r).slice(13, 18)}`;
}

/* --- VISUAL UTILITIES --- */

/** 15-band background, center darkest, edges at most +8% lighter (very subtle). */
function bandedBackground({ steps = 15, base = PANEL, cap = 0.08 }) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2);
  const bandWidth = 100 / steps;

  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);                 // 0..7
    const lighten = Math.min((cap / (center - 1)) * dist, cap); // linear up to cap
    const col = `color-mix(in oklab, ${base} ${100 - lighten * 100}%, white ${lighten * 100}%)`;
    const start = (i - 1) * bandWidth;
    const end = i * bandWidth;
    parts.push(`${col} ${start}%, ${col} ${end}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/** Header band lines: light ➜ dark horizontally, fatter bands than cards. */
function headerBands() {
  const steps = 10;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    // start lighter (but still dark) then head to panel
    const lighten = 0.06 - (0.06 / (steps - 1)) * i; // 6% -> 0%
    const col = `color-mix(in oklab, ${PANEL} ${100 - lighten * 100}%, white ${lighten * 100}%)`;
    const a = (i * 100) / steps;
    const b = ((i + 1) * 100) / steps;
    parts.push(`${col} ${a}%, ${col} ${b}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/** Solid icon tile (no shadows), equal space top/bottom by layout, squared. */
function IconTile({ children, size = 120, radius = 12 }: { children: React.ReactNode; size?: number; radius?: number }) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `color-mix(in oklab, ${PANEL} 92%, ${CTA} 8%)`, // very dark green-ish
        border: `1px solid ${GREEN_LINE}`,
        color: CTA,           // icon stroke color
      }}
    >
      {children}
    </div>
  );
}

type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'aha', agents: 0, active: true },
  ]);
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter(s => (s.name + ' ' + s.id).toLowerCase().includes(q));
  }, [subs, query]);

  const count = subs.length;

  function doCreate() {
    if (!newName.trim()) return;
    setSubs([{ id: genId(), name: newName.trim(), agents: 0, active: true }, ...subs]);
    setNewName('');
    setNewOpen(false);
  }

  // Sizing
  const CardSize = 320;         // square-ish (bigger)
  const CardRadius = 14;        // a bit more rounded (per your ask)
  const InnerIconRadius = 12;

  return (
    <div className="min-h-screen px-6 pb-16 pt-6" style={{ background: CANVAS, color: TEXT }}>
      {/* Row A: Subaccounts (left) + CTA (right) */}
      <div className="flex items-end gap-4">
        <div className="pb-3">
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.02em' }}>Subaccounts</div>
          <div style={{ height: 1, background: GREEN_LINE, marginTop: 10, width: 220 }} />
        </div>

        <button
          onClick={() => setNewOpen(true)}
          className="ml-auto h-[40px] px-4 font-semibold"
          style={{
            background: CTA,
            color: '#fff',
            borderRadius: 10,
            border: `1px solid ${CTA}`,
            boxShadow: '0 10px 24px rgba(89,217,179,.18)',
          }}
        >
          New Subaccount
        </button>
      </div>

      {/* Row B: Search (left) + centered count */}
      <div className="mt-5 flex items-center">
        <div className="w-[420px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subaccounts…"
            className="w-full h-[36px] px-3 outline-none"
            style={{
              background: PANEL,
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: 10,
              color: TEXT,
            }}
          />
        </div>

        <div className="mx-auto text-center" style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{count === 1 ? 'subaccount' : 'subaccounts'}</div>
        </div>
      </div>

      {/* Grid: up to 4 per row */}
      <div
        className="mt-8 grid gap-7"
        style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
      >
        {/* Create card (dashed) */}
        <button
          onClick={() => setNewOpen(true)}
          className="relative group overflow-hidden"
          style={{
            height: CardSize,
            borderRadius: CardRadius,
            background: PANEL,
            border: `1px dashed ${GREEN_LINE}`,
            boxShadow: '0 14px 40px rgba(0,0,0,.42)',   // drop shadow under card
          }}
        >
          {/* bands UNDER content (very subtle, wider) */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ borderRadius: CardRadius, background: bandedBackground({ steps: 15, base: PANEL, cap: 0.08 }), zIndex: 0 }}
          />

          {/* content OVER bands */}
          <div className="absolute inset-0 p-6 flex flex-col" style={{ zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>Add new workspace</div>

            {/* Equal top/bottom spacing for the icon: flex-1 grid centers it */}
            <div className="flex-1 grid place-items-center">
              <IconTile size={128} radius={InnerIconRadius}>
                <Plus size={62} strokeWidth={2.6} />
              </IconTile>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 6 }}>Click to create</div>
          </div>
        </button>

        {/* Existing subaccounts */}
        {filtered.map((s) => (
          <div
            key={s.id}
            className="relative overflow-hidden"
            style={{
              height: CardSize,
              borderRadius: CardRadius,
              background: PANEL,
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: '0 14px 40px rgba(0,0,0,.42)',   // drop shadow under card
            }}
          >
            {/* bands UNDER content */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ borderRadius: CardRadius, background: bandedBackground({ steps: 15, base: PANEL, cap: 0.08 }), zIndex: 0 }}
            />

            {/* content */}
            <div className="absolute inset-0 p-6 flex flex-col" style={{ color: TEXT, zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>ID: {s.id}</div>

              <div className="flex-1 grid place-items-center">
                <IconTile size={128} radius={InnerIconRadius}>
                  <Bot size={58} strokeWidth={2.6} />
                </IconTile>
              </div>

              {/* Hide meta if agents === 0 (your request) */}
              {s.agents > 0 && (
                <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: MUTED }}>
                  <span>{s.agents} AI Agents</span>
                  <span>•</span>
                  <span style={{ color: s.active ? CTA : MUTED }}>{s.active ? 'Active' : 'Paused'}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Create Subaccount Overlay (darker, narrower, squarer) ---------- */}
      {newOpen && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center"
          style={{ background: 'rgba(6,8,10,.66)', backdropFilter: 'blur(6px)' }}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="relative overflow-hidden"
            style={{
              width: 520,                 // narrower (a bit wider than a square)
              maxWidth: '92vw',
              borderRadius: 12,
              border: `2px solid ${GREEN_LINE}`,    // thicker border
              background: PANEL,
              boxShadow: '0 24px 80px rgba(0,0,0,.6)',
              color: TEXT,
            }}
          >
            {/* header band: light ➜ dark, thicker bands */}
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{
                background: headerBands(),
                borderBottom: `1px solid ${GREEN_LINE}`,
              }}
            >
              <div
                className="grid place-items-center"
                style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `color-mix(in oklab, ${PANEL} 90%, ${CTA} 10%)`,
                  border: `1px solid ${GREEN_LINE}`,
                  color: CTA,
                }}
              >
                <User2 size={18} />
              </div>
              <div className="min-w-0">
                <div style={{ fontWeight: 700 }}>Create New Subaccount</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Organize your AI agents</div>
              </div>
              <button
                onClick={() => setNewOpen(false)}
                className="ml-auto grid place-items-center"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'transparent', color: MUTED, border: `1px solid ${GREEN_LINE}`,
                }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-xs mb-1" style={{ color: MUTED }}>Subaccount Name</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter subaccount name…"
                className="w-full h-[42px] px-3 outline-none"
                style={{
                  background: PANEL,
                  border: `1px solid ${GREEN_LINE}`,
                  borderRadius: 10,
                  color: TEXT,
                }}
              />

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setNewOpen(false)}
                  className="w-full h-[42px] font-semibold"
                  style={{
                    background: PANEL,
                    color: TEXT,
                    borderRadius: 8,                  // less rounded
                    border: `1px solid ${GREEN_LINE}`,
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={doCreate}
                  disabled={!newName.trim()}
                  className="w-full h-[42px] font-semibold disabled:opacity-60"
                  style={{
                    background: CTA,                 // your green
                    color: '#fff',                   // white text
                    borderRadius: 8,                 // less rounded
                    border: `1px solid ${CTA}`,
                  }}
                >
                  Create Subaccount
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* page bg (safety) */}
      <style jsx>{`
        :global(body){ background:${CANVAS}; }
      `}</style>
    </div>
  );
}
