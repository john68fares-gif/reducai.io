'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot, User2, X } from 'lucide-react';

/* Brand */
const CTA = '#59d9b3';                           // button + icon green
const GREEN_LINE = 'rgba(89,217,179,.24)';       // greener + slightly brighter seams
const CANVAS = '#070b0d';
const PANEL  = '#0b0f11';
const TEXT   = 'rgba(236,242,247,.92)';
const MUTED  = 'rgba(176,196,210,.58)';

/* IDs (placeholder until backend) */
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return `${(t + r).slice(0, 8)}-${(t + r).slice(8, 13)}-${(t + r).slice(13, 18)}`;
}

/* ---------- VISUAL UTILITIES ---------- */

/**
 * 15 hard bands. Center darkest.
 * Sides lighten only up to +5% and the lightening uses CTA (green) instead of white,
 * so lines look *greenish* and just a bit lighter — not washed out.
 */
function bandedBackground({ steps = 15, cap = 0.05 }) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2);
  const bw = 100 / steps;

  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);
    const lighten = Math.min((cap / (center - 1)) * dist, cap);
    // mix PANEL with CTA to get a subtle green lift
    const col = `color-mix(in oklab, ${PANEL} ${100 - lighten * 100}%, ${CTA} ${lighten * 100}%)`;
    parts.push(`${col} ${(i - 1) * bw}%, ${col} ${i * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/** Header: broader bands light->dark (kept from previous, green-tinted too) */
function headerBands() {
  const steps = 10;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const amt = 0.06 - (0.06 / (steps - 1)) * i; // 6% -> 0%
    const col = `color-mix(in oklab, ${PANEL} ${100 - amt * 100}%, ${CTA} ${amt * 100}%)`;
    parts.push(`${col} ${(i * 100) / steps}%, ${col} ${((i + 1) * 100) / steps}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/** Solid icon plate (opaque; no drop/shadow; icons stay centered). */
function IconTile({ children, size = 132, radius = 8 }:{
  children: React.ReactNode; size?: number; radius?: number
}) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `color-mix(in oklab, ${PANEL} 86%, ${CTA} 14%)`,
        border: `1px solid ${GREEN_LINE}`,
        color: CTA
      }}
    >
      {children}
    </div>
  );
}

type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([{ id: genId(), name: 'aha', agents: 0, active: true }]);
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
    setNewName(''); setNewOpen(false);
  }

  /* Layout sizing */
  const CardSide = 332;    // SQUARE cards
  const CardRadius = 8;    // “squared” (minimal rounding)
  const IconRadius = 8;

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
            boxShadow: '0 14px 28px rgba(89,217,179,.22)'
          }}
        >
          New Subaccount
        </button>
      </div>

      {/* Row B: search (left) + centered count */}
      <div className="mt-5 flex items-center">
        <div className="w-[420px]">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subaccounts…"
            className="w-full h-[36px] px-3 outline-none"
            style={{ background: PANEL, border: `1px solid ${GREEN_LINE}`, borderRadius: 10, color: TEXT }}
          />
        </div>

        <div className="mx-auto text-center" style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{count === 1 ? 'subaccount' : 'subaccounts'}</div>
        </div>
      </div>

      {/* Grid: up to 4 per row */}
      <div className="mt-8 grid gap-8" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {/* Create card (dashed) */}
        <button
          onClick={() => setNewOpen(true)}
          className="relative group overflow-hidden"
          style={{
            height: CardSide, borderRadius: CardRadius, background: PANEL,
            border: `1px dashed ${GREEN_LINE}`,
            // green-tinted drop shadow UNDER the card, not on icons
            boxShadow: '0 18px 54px rgba(0,0,0,.55), 0 0 0 1px rgba(89,217,179,.20), 0 22px 58px rgba(89,217,179,.10)'
          }}
        >
          {/* bands UNDER content; subtle greenish lines */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ borderRadius: CardRadius, background: bandedBackground({ steps: 15, cap: 0.05 }), zIndex: 0 }}
          />

          <div className="absolute inset-0 p-6 flex flex-col" style={{ zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>Add new workspace</div>

            {/* equal spacing above / below icon */}
            <div className="flex-1 grid place-items-center">
              <IconTile size={132} radius={IconRadius}>
                <Plus size={66} strokeWidth={2.6} color={CTA} />
              </IconTile>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 6 }}>Click to create</div>
          </div>
        </button>

        {/* Subaccount cards (always show agent count, even 0) */}
        {filtered.map((s) => (
          <div
            key={s.id}
            className="relative overflow-hidden"
            style={{
              height: CardSide, borderRadius: CardRadius, background: PANEL,
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: '0 18px 54px rgba(0,0,0,.55), 0 0 0 1px rgba(89,217,179,.20), 0 22px 58px rgba(89,217,179,.10)'
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ borderRadius: CardRadius, background: bandedBackground({ steps: 15, cap: 0.05 }), zIndex: 0 }}
            />

            <div className="absolute inset-0 p-6 flex flex-col" style={{ color: TEXT, zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>ID: {s.id}</div>

              <div className="flex-1 grid place-items-center">
                <IconTile size={132} radius={IconRadius}>
                  <Bot size={60} strokeWidth={2.6} color={CTA} />
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

      {/* Overlay (unchanged logic; still dark + narrow) */}
      {newOpen && (
        <div className="fixed inset-0 z-[1000] grid place-items-center" style={{ background: 'rgba(6,8,10,.66)', backdropFilter: 'blur(6px)' }}>
          <div
            className="relative overflow-hidden"
            style={{
              width: 520, maxWidth: '92vw', borderRadius: 12, border: `2px solid ${GREEN_LINE}`,
              background: PANEL, boxShadow: '0 24px 80px rgba(0,0,0,.6)', color: TEXT
            }}
          >
            <div className="px-5 py-4 flex items-center gap-3" style={{ background: headerBands(), borderBottom: `1px solid ${GREEN_LINE}` }}>
              <div className="grid place-items-center" style={{
                width: 36, height: 36, borderRadius: 10,
                background: `color-mix(in oklab, ${PANEL} 90%, ${CTA} 10%)`,
                border: `1px solid ${GREEN_LINE}`, color: CTA
              }}>
                <User2 size={18} />
              </div>
              <div className="min-w-0">
                <div style={{ fontWeight: 700 }}>Create New Subaccount</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>Organize your AI agents</div>
              </div>
              <button
                onClick={() => setNewOpen(false)}
                className="ml-auto grid place-items-center"
                style={{ width: 30, height: 30, borderRadius: 8, background: 'transparent', color: MUTED, border: `1px solid ${GREEN_LINE}` }}
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
                style={{ background: PANEL, border: `1px solid ${GREEN_LINE}`, borderRadius: 10, color: TEXT }}
              />

              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setNewOpen(false)}
                  className="w-full h-[42px] font-semibold"
                  style={{ background: PANEL, color: TEXT, borderRadius: 8, border: `1px solid ${GREEN_LINE}` }}
                >
                  Cancel
                </button>
                <button
                  onClick={doCreate}
                  disabled={!newName.trim()}
                  className="w-full h-[42px] font-semibold disabled:opacity-60"
                  style={{ background: CTA, color: '#fff', borderRadius: 8, border: `1px solid ${CTA}` }}
                >
                  Create Subaccount
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        :global(body){ background:${CANVAS}; }
      `}</style>
    </div>
  );
}
