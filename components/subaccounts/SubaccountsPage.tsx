'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot, User2, X, Search as SearchIcon } from 'lucide-react';

/* -------- Brand / palette -------- */
const CTA        = '#59d9b3';                 // matches your assistant rail CTA
const GREEN_LINE = 'rgba(89,217,179,.24)';    // thin green border / dashes
const CANVAS     = '#070b0d';                  // page background
const PANEL      = '#0b0f11';                  // card background
const TEXT       = 'rgba(236,242,247,.92)';
const MUTED      = 'rgba(176,196,210,.58)';

/* -------- IDs helper (placeholder) -------- */
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return `${(t + r).slice(0, 8)}-${(t + r).slice(8, 13)}-${(t + r).slice(13, 18)}`;
}

/* -------- Visual utils -------- */
/** Subtle green-tinted 15 hard bands, darkest center, sides only ~4.5% lighter total. */
function bandedBackground(steps = 15, cap = 0.045) {
  const parts: string[] = [];
  const center = Math.ceil(steps / 2);
  const bw = 100 / steps;
  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);
    const lighten = Math.min((cap / (center - 1)) * dist, cap);
    const col = `color-mix(in oklab, ${PANEL} ${100 - lighten * 100}%, ${CTA} ${lighten * 100}%)`;
    parts.push(`${col} ${(i - 1) * bw}%, ${col} ${i * bw}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/** Header bands: left→right light→dark, broad + subtle */
function headerBands() {
  const steps = 9;
  const parts: string[] = [];
  for (let i = 0; i < steps; i++) {
    const amt = 0.065 - (0.065 / (steps - 1)) * i; // fades to dark to the right
    const col = `color-mix(in oklab, ${PANEL} ${100 - amt * 100}%, ${CTA} ${amt * 100}%)`;
    parts.push(`${col} ${(i * 100) / steps}%, ${col} ${((i + 1) * 100) / steps}%`);
  }
  return `linear-gradient(90deg, ${parts.join(',')})`;
}

/* Tile behind the icon — SOLID plate so band lines never show through the icon */
function IconPlate({
  children,
  size = 108,
  radius = 14,
}: {
  children: React.ReactNode;
  size?: number;
  radius?: number;
}) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `color-mix(in oklab, ${PANEL} 84%, ${CTA} 16%)`, // greenish, darker center
        border: `1px solid ${GREEN_LINE}`,
        color: CTA, // icon color
        // no shadow on the icon plate (keeps it clean)
      }}
    >
      {children}
    </div>
  );
}

/* -------- Types -------- */
type Sub = { id: string; name: string; agents: number; active: boolean };

/* ======= Component ======= */
export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([{ id: genId(), name: 'aha', agents: 0, active: true }]);
  const [query, setQuery] = useState('');
  const [newOpen, setNewOpen] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? subs.filter((s) => (s.name + ' ' + s.id).toLowerCase().includes(q)) : subs;
  }, [subs, query]);

  const count = subs.length;

  function doCreate() {
    if (!newName.trim()) return;
    setSubs([{ id: genId(), name: newName.trim(), agents: 0, active: true }, ...subs]);
    setNewName('');
    setNewOpen(false);
  }

  /* ---- Sizing that locks layout (no grow when sidebar collapses) ---- */
  const CARD_SIZE = 320; // fixed pixel card; keeps size identical when the layout width changes
  const GAP = 18;

  // roundness: create card more rounded; sub cards less rounded
  const CREATE_RADIUS = 20;
  const SUB_RADIUS = 16;

  // icons: slightly smaller and centered
  const ICON_SIZE = 48;
  const PLATE_SIZE = 104;

  return (
    <div className="min-h-screen px-6 pb-16 pt-6" style={{ background: CANVAS, color: TEXT }}>
      {/* Header row A: title + CTA right */}
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
            boxShadow: '0 16px 36px rgba(89,217,179,.24)',
          }}
        >
          New Subaccount
        </button>
      </div>

      {/* Header row B: search left + centered count */}
      <div className="mt-5 flex items-center">
        <div className="w-[360px] relative">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subaccounts…"
            className="w-full h-[36px] pl-9 pr-3 outline-none"
            style={{ background: PANEL, border: `1px solid ${GREEN_LINE}`, borderRadius: 10, color: TEXT }}
          />
          <SearchIcon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: MUTED }}
          />
        </div>

        <div className="mx-auto text-center" style={{ minWidth: 220 }}>
          <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
          <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
          <div style={{ fontSize: 12, color: MUTED }}>{count === 1 ? 'subaccount' : 'subaccounts'}</div>
        </div>
      </div>

      {/* Grid: fixed size squares, 4 columns max, tighter spacing; cards don’t grow */}
      <div
        className="mt-8"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(4, ${CARD_SIZE}px)`, // hard max 4
          gap: GAP,
          justifyContent: 'start',
        }}
      >
        {/* Create card (small dashes; more rounded) */}
        <button
          onClick={() => setNewOpen(true)}
          className="relative group overflow-hidden"
          style={{
            width: CARD_SIZE,
            height: CARD_SIZE,
            borderRadius: CREATE_RADIUS,
            background: PANEL,
            border: `1px dashed ${GREEN_LINE}`,
            // green-tinted soft drop shadow under the card
            boxShadow:
              '0 28px 70px rgba(0,0,0,.55), 0 22px 50px rgba(89,217,179,.08)',
          }}
        >
          {/* Lines UNDER content */}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ borderRadius: CREATE_RADIUS, background: bandedBackground(15), zIndex: 0 }}
          />

          <div className="absolute inset-0 p-6 flex flex-col" style={{ zIndex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
              Add new workspace
            </div>

            <div className="flex-1 grid place-items-center">
              <IconPlate size={PLATE_SIZE} radius={14}>
                <Plus size={ICON_SIZE} strokeWidth={2.6} color={CTA} />
              </IconPlate>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 6 }}>
              Click to create
            </div>
          </div>
        </button>

        {/* Subaccount cards (slightly less rounded) */}
        {filtered.map((s) => (
          <div
            key={s.id}
            className="relative overflow-hidden"
            style={{
              width: CARD_SIZE,
              height: CARD_SIZE,
              borderRadius: SUB_RADIUS,
              background: PANEL,
              border: `1px solid ${GREEN_LINE}`,
              boxShadow:
                '0 28px 70px rgba(0,0,0,.55), 0 22px 50px rgba(89,217,179,.08)',
            }}
          >
            {/* Lines UNDER content */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ borderRadius: SUB_RADIUS, background: bandedBackground(15), zIndex: 0 }}
            />
            <div className="absolute inset-0 p-6 flex flex-col" style={{ zIndex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
                ID: {s.id}
              </div>

              <div className="flex-1 grid place-items-center">
                <IconPlate size={PLATE_SIZE} radius={14}>
                  <Bot size={ICON_SIZE - 2} strokeWidth={2.6} color={CTA} />
                </IconPlate>
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

      {/* Create overlay — narrower, squared-ish, darker header with bands */}
      {newOpen && (
        <div
          className="fixed inset-0 z-[1000] grid place-items-center"
          style={{ background: 'rgba(6,8,10,.66)', backdropFilter: 'blur(6px)' }}
        >
          <div
            className="relative overflow-hidden"
            style={{
              width: 420, // narrower
              maxWidth: '92vw',
              borderRadius: 12,
              border: `2px solid ${GREEN_LINE}`,
              background: PANEL,
              boxShadow: '0 24px 80px rgba(0,0,0,.6)',
              color: TEXT,
            }}
          >
            <div
              className="px-5 py-4 flex items-center gap-3"
              style={{ background: headerBands(), borderBottom: `1px solid ${GREEN_LINE}` }}
            >
              <div
                className="grid place-items-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: `color-mix(in oklab, ${PANEL} 90%, ${CTA} 10%)`,
                  border: `1px solid ${GREEN_LINE}`,
                  color: CTA,
                }}
              >
                <User2 size={18} />
              </div>
              <div className="min-w-0">
                <div style={{ fontWeight: 700 }}>Create New Subaccount</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                  Organize your AI agents
                </div>
              </div>
              <button
                onClick={() => setNewOpen(false)}
                className="ml-auto grid place-items-center"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: 'transparent',
                  color: MUTED,
                  border: `1px solid ${GREEN_LINE}`,
                }}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-xs mb-1" style={{ color: MUTED }}>
                Subaccount Name
              </label>
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

      {/* Page-scoped tweaks */}
      <style jsx>{`
        :global(body) { background: ${CANVAS}; }
        /* tighter dashes for the create card — no extra line under it */
        button[style*="dashed"] {
          border-style: dashed;
          border-width: 1px;
          border-image: repeating-linear-gradient(
              to right,
              ${GREEN_LINE},
              ${GREEN_LINE} 6px,
              transparent 6px,
              transparent 10px
            )
            1;
        }
        /* Prevent accidental icon glow/bloom anywhere */
        svg { filter: none !important; }
      `}</style>
    </div>
  );
}'use client';

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
