'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot, X } from 'lucide-react';
import { createPortal } from 'react-dom';

/* ===== Brand & Theme ===== */
const CTA         = '#59d9b3';                         // EXACT green (matches your rail/button)
const CTA_LINE    = 'rgba(89,217,179,.22)';            // lines & borders
const CTA_LINE_FAINT = 'rgba(89,217,179,.16)';
const CANVAS      = '#070b0d';                         // page bg
const PANEL       = '#0b1111';                         // card bg base
const TEXT        = 'rgba(236,242,247,.94)';
const MUTED       = 'rgba(176,196,210,.62)';

/* ===== Layout & Sizes ===== */
const CARD_SIZE           = 292; // square cards — tuned to your screenshots
const GAP                 = 18;  // tighter spacing between cards
const R_CREATE            = 16;  // create card radius (more rounded)
const R_CARD              = 12;  // subaccount card radius (slightly less)
const ICON_TILE_SIZE      = 120; // square inner icon tile
const ICON_TILE_RADIUS    = 14;
const ICON_SIZE           = 54;  // lucide icon size (smaller, centered, no shadows)

/* ===== Helpers ===== */
type Sub = { id: string; name: string; agents: number; active: boolean };

function genId() {
  // 8-5-5 format; deterministic enough for front-end demo
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  const s = (t + r).padEnd(18, 'x').slice(0, 18);
  return `${s.slice(0,8)}-${s.slice(8,13)}-${s.slice(13,18)}`;
}

/** Build a subtle green banded background (15 bands).
 *  Band 8 is darkest; edges lighten up to MAX_LIGHTEN (<= 8%).
 *  Put this on a ::before layer under the card content.
 */
function bandSteps(
  steps = 15,
  base = PANEL,
  tint = CTA,
  maxLighten = 0.08 // <= 8% lighter at the far edges
) {
  const center = Math.ceil(steps / 2); // 8
  const bandWidth = 100 / steps;
  const segments: string[] = [];

  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);  // 0..7
    const lighten = (maxLighten / (steps - center)) * dist; // 0 → maxLighten
    // Keep it greenish: mix base with a *hint* of CTA before lightening with white
    const baseTint = `color-mix(in oklab, ${base} 92%, ${tint} 8%)`;
    const col = `color-mix(in oklab, ${baseTint} ${100 - lighten * 100}%, white ${lighten * 100}%)`;
    const start = (i - 1) * bandWidth;
    const end = i * bandWidth;
    segments.push(`${col} ${start}%, ${col} ${end}%`);
  }
  return `linear-gradient(90deg, ${segments.join(', ')})`;
}

/* ===== Reusable: Icon Tile (solid, squared) ===== */
function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="icon-tile grid place-items-center"
      style={{
        width: ICON_TILE_SIZE,
        height: ICON_TILE_SIZE,
        borderRadius: ICON_TILE_RADIUS,
        background:
          // slightly darker than panel, with faint inner gradient
          `linear-gradient(180deg, rgba(0,0,0,.20), rgba(0,0,0,.08))`,
        border: `1px solid ${CTA_LINE}`,
      }}
    >
      {/* No shadows on icons; pure CTA */}
      <div style={{ color: CTA }}>{children}</div>
    </div>
  );
}

/* ===== Overlay (portal) ===== */
function CreateSubOverlay({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <>
      {/* veil */}
      <div
        className="fixed inset-0 z-[9998]"
        style={{ background: 'rgba(0,0,0,.60)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
      {/* dialog — narrower & darker, squared */}
      <div className="fixed inset-0 z-[9999] grid place-items-center px-3">
        <div
          className="w-full"
          style={{
            maxWidth: 520,                   // narrower than before
            borderRadius: 12,               // squared-ish
            background: PANEL,
            border: `1px solid ${CTA_LINE}`,
            boxShadow: '0 22px 60px rgba(0,0,0,.35)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* header with its own wide green bands (light → dark) */}
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${CTA_LINE_FAINT}`,
              position: 'relative',
              borderTopLeftRadius: 12,
              borderTopRightRadius: 12,
              overflow: 'hidden',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                // header bands are WIDER and light→dark left→right
                background: `linear-gradient(90deg,
                  color-mix(in oklab, ${PANEL} 85%, ${CTA} 15%) 0%,
                  ${PANEL} 100%
                )`,
                opacity: 0.35,
              }}
            />
            <div className="relative z-[1] flex items-center gap-3">
              <div
                className="grid place-items-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'rgba(89,217,179,.10)',
                  border: `1px solid ${CTA_LINE}`,
                  color: CTA,
                }}
              >
                <Plus size={18} />
              </div>
              <div className="min-w-0">
                <div style={{ color: TEXT, fontWeight: 700 }}>Create New Subaccount</div>
                <div style={{ color: MUTED, fontSize: 12 }}>Organize your AI agents</div>
              </div>
              <button
                onClick={onClose}
                className="ml-auto p-1"
                aria-label="Close"
                style={{
                  borderRadius: 8,
                  color: MUTED,
                  border: `1px solid transparent`,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* body */}
          <div style={{ padding: 18 }}>
            <label
              htmlFor="sub-name"
              style={{ display: 'block', fontSize: 12, color: MUTED, marginBottom: 6 }}
            >
              Subaccount Name
            </label>
            <input
              id="sub-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              placeholder="Enter subaccount name..."
              className="w-full outline-none"
              style={{
                height: 44,
                padding: '0 12px',
                borderRadius: 10, // slightly rounded
                background: CANVAS,
                border: `1px solid ${CTA_LINE_FAINT}`,
                color: TEXT,
              }}
            />

            <div className="mt-14 flex items-center gap-10 justify-end">
              <button
                onClick={onClose}
                style={{
                  height: 42,
                  padding: '0 18px',
                  borderRadius: 8, // less rounded
                  background: CANVAS,
                  border: `1px solid ${CTA_LINE_FAINT}`,
                  color: TEXT,
                  fontWeight: 600,
                }}
              >
                Cancel
              </button>
              <button
                disabled={!name.trim()}
                onClick={() => {
                  const n = name.trim();
                  if (!n) return;
                  onCreate(n);
                  setName('');
                }}
                style={{
                  height: 42,
                  padding: '0 18px',
                  borderRadius: 8, // less rounded
                  background: CTA,
                  color: '#fff',
                  border: `1px solid ${CTA}`,
                  fontWeight: 700,
                  opacity: name.trim() ? 1 : 0.6,
                }}
              >
                Create Subaccount
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

/* ===== Main Page ===== */
export default function SubaccountsPage() {
  const [overlay, setOverlay] = useState(false);
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'aha', agents: 0, active: true },
  ]);

  const count = useMemo(() => subs.length, [subs]);

  function createSub(name: string) {
    setSubs([{ id: genId(), name, agents: 0, active: true }, ...subs]);
    setOverlay(false);
  }

  return (
    <div
      className="page px-6 pb-20 pt-6"
      style={{ background: CANVAS, color: TEXT, minHeight: '100dvh' }}
    >
      {/* Top section: Subaccounts (left), New Subaccount (right) */}
      <div className="flex items-end gap-4">
        <div className="pb-2">
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '.02em' }}>Subaccounts</div>
        </div>

        <div className="ml-auto pb-1">
          <button
            onClick={() => setOverlay(true)}
            className="px-4 h-[40px] font-semibold"
            style={{
              background: CTA,
              color: '#fff',
              borderRadius: 10,
              border: `1px solid ${CTA}`,
              boxShadow: '0 10px 26px rgba(89,217,179,.18)',
            }}
          >
            New Subaccount
          </button>
        </div>
      </div>

      {/* Second row: search (left) and count (right) */}
      <div className="mt-4 flex items-center gap-6">
        {/* Search left (style present but no behavior constraints here) */}
        <div className="min-w-[320px] flex-1 max-w-[520px]">
          <div className="relative">
            <input
              placeholder="Search subaccounts..."
              className="w-full outline-none"
              style={{
                height: 40,
                padding: '0 12px',
                borderRadius: 10,
                background: PANEL,
                border: `1px solid ${CTA_LINE_FAINT}`,
                color: TEXT,
              }}
            />
          </div>
        </div>

        {/* Count right */}
        <div className="ml-auto text-right">
          <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{count === 1 ? 'Subaccount' : 'Subaccounts'}</div>
        </div>
      </div>

      {/* Grid — MAX 4 per row, fixed-size square cards, tight spacing */}
      <div
        className="cards mt-8"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(4, ${CARD_SIZE}px)`,
          gap: GAP,
          alignItems: 'start',
        }}
      >
        {/* Create card (dashed small lines; more rounded) */}
        <button
          onClick={() => setOverlay(true)}
          className="card relative group overflow-hidden"
          style={{
            width: CARD_SIZE,
            height: CARD_SIZE,
            borderRadius: R_CREATE,
            background: PANEL,
            border: `1px dashed ${CTA_LINE}`,
            boxShadow: '0 16px 40px rgba(89,217,179,.10)',
            position: 'relative',
          }}
        >
          {/* banded lines UNDER content */}
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: 0,
              borderRadius: R_CREATE,
              background: bandSteps(15, PANEL, CTA, 0.08),
              opacity: 0.22, // subtle
            }}
          />

          {/* content */}
          <div className="absolute inset-0 p-6 flex flex-col" style={{ zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Create Subaccount</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
              Add new workspace
            </div>

            {/* balanced spacing: equal above/below tile */}
            <div className="flex-1 grid place-items-center">
              <IconTile>
                <Plus size={ICON_SIZE} strokeWidth={2.4} />
              </IconTile>
            </div>

            <div
              style={{
                textAlign: 'center',
                fontSize: 12,
                color: MUTED,
                marginTop: 8,
              }}
            >
              Click to create
            </div>
          </div>
        </button>

        {/* Subaccount cards (solid border, less rounded than create) */}
        {subs.map((s) => (
          <div
            key={s.id}
            className="card relative overflow-hidden"
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE,
              borderRadius: R_CARD,
              background: PANEL,
              border: `1px solid ${CTA_LINE_FAINT}`,
              // greenish drop shadow BELOW card
              boxShadow:
                '0 16px 40px rgba(89,217,179,.10), 0 18px 60px rgba(0,0,0,.35)',
              position: 'relative',
            }}
          >
            {/* bands UNDER content */}
            <div
              aria-hidden
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 0,
                borderRadius: R_CARD,
                background: bandSteps(15, PANEL, CTA, 0.08),
                opacity: 0.20,
              }}
            />

            {/* content */}
            <div className="absolute inset-0 p-6 flex flex-col" style={{ zIndex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{s.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: 'color-mix(in oklab, ' + MUTED + ' 84%, white 16%)',
                  marginTop: 4,
                  letterSpacing: '.04em',
                }}
              >
                ID: {s.id}
              </div>

              <div className="flex-1 grid place-items-center">
                <IconTile>
                  <Bot size={ICON_SIZE} strokeWidth={2.4} />
                </IconTile>
              </div>

              <div
                className="flex items-center justify-center gap-2"
                style={{ fontSize: 12, color: MUTED }}
              >
                <span>{s.agents} AI Agents</span>
                <span>•</span>
                <span style={{ color: s.active ? CTA : MUTED }}>
                  {s.active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* small responsive fallback (never more than 4) */}
      <style jsx>{`
        :global(body) { background: ${CANVAS}; }
        @media (max-width: 1340px) {
          .cards { grid-template-columns: repeat(3, ${CARD_SIZE}px); }
        }
        @media (max-width: 1020px) {
          .cards { grid-template-columns: repeat(2, ${CARD_SIZE}px); }
        }
        @media (max-width: 700px) {
          .cards { grid-template-columns: 1fr; }
          .card { width: 100%; height: ${CARD_SIZE}px; }
        }
      `}</style>

      {/* Create overlay */}
      <CreateSubOverlay
        open={overlay}
        onClose={() => setOverlay(false)}
        onCreate={createSub}
      />
    </div>
  );
}
