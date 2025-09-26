'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot } from 'lucide-react';

/* ---- BRAND ---- */
const CTA = '#59d9b3';                           // your green
const GREEN_LINE = 'rgba(89,217,179,.20)';       // thin borders
const TEXT = 'rgba(236,242,247,.92)';
const MUTED = 'rgba(176,196,210,.60)';
const PANEL = '#0c1114';                         // card fill
const CANVAS = '#070b0d';

/* ---- SIMPLE ID UTIL (stable, human-ish) ---- */
function genId() {
  // 8-5-5-ish base36 id: e.g. 68d6d34-9badf-9092e
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return (t + r).slice(0, 8) + '-' + (t + r).slice(8, 13) + '-' + (t + r).slice(13, 18);
}

type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'aha', agents: 0, active: true },
  ]);
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return subs;
    return subs.filter(x => (x.name + ' ' + x.id).toLowerCase().includes(s));
  }, [subs, q]);

  function createSub() {
    const name = prompt('Subaccount name?')?.trim();
    if (!name) return;
    setSubs([{ id: genId(), name, agents: 0, active: true }, ...subs]);
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: CANVAS,
        color: TEXT,
      }}
      className="px-6 pb-16 pt-6"
    >
      {/* Top row: Search (left) + Count (right) + New button */}
      <div className="flex items-center gap-4 mb-6">
        {/* Search – not full width; just a bit to the side */}
        <div className="relative" style={{ width: 420 }}>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search subaccounts…"
            className="h-[40px] w-full outline-none"
            style={{
              background: 'transparent',
              color: TEXT,
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: 8,
              padding: '0 12px',
            }}
          />
        </div>

        <div className="ml-auto flex items-end gap-10">
          {/* Count block */}
          <div className="text-right">
            <div style={{ fontSize: 13, letterSpacing: '.04em', color: MUTED }}>You have</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{subs.length}</div>
            <div style={{ fontSize: 12, color: MUTED }}>Subaccounts</div>
          </div>

          {/* New Subaccount button (white text on your green) */}
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

      {/* Grid – up to 4 per row, squared, a bit taller */}
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        }}
      >
        {/* Create card */}
        <CreateCard onClick={createSub} />

        {filtered.map(sub => (
          <SubCard key={sub.id} sub={sub} />
        ))}
      </div>

      {/* page background feather */}
      <style jsx>{`
        :global(body){ background: ${CANVAS}; }
      `}</style>
    </div>
  );
}

/* ---------- Shared stripe background (15 lines, dark middle → lighter edges) ---------- */
/* We emulate 15 banded lines using repeating-linear-gradient for stripes
   + mirrored edge-fades so the center appears darker and each step to L/R looks ~2% lighter. */
function StripeBG({ rounded = 8 }: { rounded?: number }) {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: rounded,
        // Layer 1: subtle vertical stripes (approx 15 across)
        background:
          `repeating-linear-gradient(90deg,
            rgba(255,255,255,0.022) 0px,
            rgba(255,255,255,0.022) 2px,
            rgba(255,255,255,0.00) 2px,
            rgba(255,255,255,0.00) 16px
          ),
          /* Center dark band that eases to edges (mirrored) */
          linear-gradient(90deg, rgba(0,0,0,0.30), rgba(0,0,0,0.12) 16%, rgba(0,0,0,0.06) 36%, rgba(0,0,0,0.02) 50%),
          linear-gradient(270deg, rgba(0,0,0,0.30), rgba(0,0,0,0.12) 16%, rgba(0,0,0,0.06) 36%, rgba(0,0,0,0.02) 50%),
          ${PANEL}`,
        boxShadow: 'inset 0 0 0 1px rgba(89,217,179,.12), 0 8px 28px rgba(0,0,0,.35)',
      }}
    />
  );
}

/* ---------- Icon tile — match overlay style ---------- */
function IconTile({ children, size = 112, rounded = 12 }: { children: React.ReactNode; size?: number; rounded?: number }) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: rounded,
        background:
          `linear-gradient(180deg, rgba(89,217,179,.10), rgba(89,217,179,.02)),
           radial-gradient(60% 90% at 50% 10%, rgba(255,255,255,.06), rgba(255,255,255,0))`,
        border: `1px solid ${GREEN_LINE}`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.03), 0 8px 24px rgba(89,217,179,.10)',
      }}
    >
      <div style={{ color: CTA, filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))' }}>{children}</div>
    </div>
  );
}

/* ---------- Create Subaccount Card (square, dashed border, slightly rounder inner tile) ---------- */
function CreateCard({ onClick }: { onClick: () => void }) {
  const R = 10;                       // card radius (square-ish)
  const InnerR = 14;                  // icon tile slightly more rounded (per your ask)
  const H = 240;                      // a bit taller

  return (
    <button
      onClick={onClick}
      className="relative text-left group"
      style={{
        height: H,
        borderRadius: R,
        background: PANEL,
        border: `1px dashed ${GREEN_LINE}`,
        color: TEXT,
        overflow: 'hidden',
      }}
    >
      <StripeBG rounded={R} />

      <div className="absolute inset-0 p-6 flex flex-col">
        <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
          Add new workspace
        </div>

        {/* centered icon tile */}
        <div className="flex-1 grid place-items-center">
          <IconTile rounded={InnerR}>
            <Plus size={56} strokeWidth={2.5} />
          </IconTile>
        </div>

        <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 6 }}>Click to create</div>
      </div>

      {/* hover glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition"
        style={{
          borderRadius: R,
          boxShadow: `0 0 0 1px ${GREEN_LINE}, 0 12px 40px rgba(89,217,179,.18)`,
        }}
      />
    </button>
  );
}

/* ---------- Subaccount Card (square, icon centered, real ID shown) ---------- */
function SubCard({ sub }: { sub: Sub }) {
  const R = 10;         // square-ish
  const H = 240;

  return (
    <div
      className="relative"
      style={{
        height: H,
        borderRadius: R,
        background: PANEL,
        border: `1px solid ${GREEN_LINE}`,
        color: TEXT,
        overflow: 'hidden',
      }}
    >
      <StripeBG rounded={R} />

      <div className="absolute inset-0 p-6 flex flex-col">
        <div style={{ fontSize: 18, fontWeight: 700 }}>{sub.name}</div>
        <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
          ID: {sub.id}
        </div>

        {/* centered icon tile – same style as overlays */}
        <div className="flex-1 grid place-items-center">
          <IconTile>
            <Bot size={54} strokeWidth={2.5} />
          </IconTile>
        </div>

        <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: MUTED }}>
          <span>{sub.agents} AI Agents</span>
          <span>•</span>
          <span style={{ color: sub.active ? CTA : MUTED }}>{sub.active ? 'Active' : 'Paused'}</span>
        </div>
      </div>
    </div>
  );
}
