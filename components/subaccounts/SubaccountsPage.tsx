// components/subaccounts/SubaccountsPage.tsx
'use client';

import React, { useMemo, useState } from 'react';
import {
  Plus, Search, Users, Rocket, Bot, X, ChevronRight
} from 'lucide-react';

/* ─────────────────────────── Theme tokens ───────────────────────────
   You can override these via CSS variables at app level.
   ------------------------------------------------------------------ */
const BRAND = 'var(--brand, #00ffc2)';               // accent green
const CARD_BG = 'var(--card, #0b0c10)';              // dark
const SURFACE = 'var(--surface, #0d0f11)';           // panels/modals
const TEXT = 'var(--text, #e8f5f1)';                 // body text
const SUBTEXT = 'color-mix(in oklab, var(--text, #e8f5f1) 65%, transparent)';
const BORDER = 'color-mix(in oklab, var(--brand, #00ffc2) 24%, transparent)';
const BORDER_SOFT = 'color-mix(in oklab, var(--brand, #00ffc2) 16%, transparent)';

/* Subaccount shape */
type Subaccount = {
  id: string;
  name: string;
  agents: number;
  status: 'Active' | 'Paused';
};

export default function SubaccountsPage() {
  const [query, setQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [items, setItems] = useState<Subaccount[]>([
    { id: '68b7b14b2cbbbab698dd0a1', name: 'Dental Chatbot', agents: 1, status: 'Active' },
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(i => i.name.toLowerCase().includes(q) || i.id.includes(q));
  }, [items, query]);

  return (
    <section
      className="w-full h-full"
      style={{ color: TEXT }}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-semibold tracking-tight">Launch &amp; Deploy</h1>
          <div className="flex items-center gap-2">
            <Tab active>Subaccounts</Tab>
            <Tab>Legacy View</Tab>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-[10px] rounded-none"
          style={{
            background: BRAND,
            color: '#ffffff',            // white text as requested
            boxShadow: `0 0 0 1px ${BORDER}, 0 10px 30px -10px ${BORDER}`,
          }}
        >
          <Plus size={18} />
          New Subaccount
        </button>
      </div>

      {/* Search */}
      <div
        className="relative mb-6 w-full max-w-xl"
        style={{ filter: 'none' }}
      >
        <div
          className="absolute inset-0 -z-10 rounded-none"
          style={{ boxShadow: `0 0 0 1px ${BORDER_SOFT}` }}
        />
        <div
          className="flex items-center gap-2 px-4 py-3 rounded-none"
          style={{ background: SURFACE }}
        >
          <Search size={18} className="opacity-60" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search subaccounts..."
            className="bg-transparent outline-none w-full placeholder:opacity-60"
          />
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Create card (square) */}
        <SquareCard
          onClick={() => setShowModal(true)}
          dashed
          title="Create Subaccount"
          subtitle="Add new workspace"
        >
          <div className="aspect-square w-28 grid place-items-center"
               style={{
                 boxShadow: `inset 0 0 0 1px ${BORDER_SOFT}`,
                 background: layeredSteps(),
               }}>
            <Plus size={34} style={{ color: BRAND }} />
          </div>
          <p className="mt-3 text-sm" style={{ color: SUBTEXT }}>Click to create</p>
        </SquareCard>

        {filtered.map((s) => (
          <SquareCard key={s.id} onClick={() => { /* route to detail view */ }}>
            <div className="flex items-center justify-between w-full">
              <div className="text-[15px] font-medium">{s.name}</div>
              <ChevronRight className="opacity-60" size={18} />
            </div>

            <div className="mt-4 grid place-items-center">
              <div
                className="aspect-square w-28 grid place-items-center"
                style={{
                  boxShadow: `inset 0 0 0 1px ${BORDER_SOFT}`,
                  background: layeredSteps(),
                }}
              >
                <Bot size={34} style={{ color: BRAND }} />
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between w-full text-sm">
              <span className="opacity-70">ID: <span className="opacity-80">{s.id}</span></span>
            </div>

            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="opacity-80">{s.agents} AI Agents</span>
              <span className="inline-flex items-center gap-1 opacity-80">
                <span className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ background: s.status === 'Active' ? BRAND : BORDER_SOFT }} />
                {s.status}
              </span>
            </div>
          </SquareCard>
        ))}
      </div>

      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onCreate={(name) => {
            const id = cryptoRandomId();
            setItems(prev => [{ id, name, status: 'Active', agents: 0 }, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </section>
  );
}

/* ─────────────────────────── Pieces ─────────────────────────── */

function Tab({ active, children }: { active?: boolean; children: React.ReactNode }) {
  return (
    <button
      className="px-3 py-2 text-sm rounded-none"
      style={{
        color: active ? TEXT : SUBTEXT,
        boxShadow: active ? `inset 0 -2px 0 0 ${BRAND}` : 'none',
      }}
    >
      {children}
    </button>
  );
}

function SquareCard({
  children,
  onClick,
  dashed,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  dashed?: boolean;
  title?: string;
  subtitle?: string;
}) {
  return (
    <button
      onClick={onClick}
      className="group relative text-left p-5 flex flex-col items-start gap-2 rounded-none"
      style={{
        background: panelSurface(),
        boxShadow: `0 0 0 1px ${dashed ? BORDER_SOFT : BORDER}, 0 10px 30px -12px rgba(0,0,0,0.6)`,
      }}
    >
      {/* card inner stripe contour */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: subtleStripes(),
          opacity: 0.18,
        }}
      />

      {title && (
        <>
          <div className="text-[15px] font-semibold tracking-tight">{title}</div>
          {subtitle && <div className="text-sm" style={{ color: SUBTEXT }}>{subtitle}</div>}
        </>
      )}

      <div className="mt-2 w-full">{children}</div>

      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-200"
        style={{
          boxShadow: `0 0 0 1px ${BORDER}, 0 0 60px -30px ${BORDER}`,
          opacity: 0,
        }}
      />
      <style jsx>{`
        button.group:hover > div:last-child { opacity: .9; }
      `}</style>
    </button>
  );
}

function CreateModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState('');

  return (
    <div
      className="fixed inset-0 z-[200]"
      style={{ background: 'rgba(0,0,0,.55)' }}  // solid overlay (not transparent/see-thru UI)
      onClick={onClose}
    >
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(680px,92vw)] p-6 rounded-none"
        style={{
          background: SURFACE,
          boxShadow: `0 0 0 1px ${BORDER}, 0 40px 120px -30px rgba(0,0,0,.8)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Users size={20} style={{ color: BRAND }} />
            <h3 className="text-xl font-semibold">Create New Subaccount</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-none hover:opacity-80">
            <X size={18} />
          </button>
        </div>

        <p className="mt-1 text-sm" style={{ color: SUBTEXT }}>
          Organize your AI agents
        </p>

        <label className="block mt-6 mb-2 text-sm">Subaccount Name</label>
        <div className="relative">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter subaccount name…"
            className="w-full px-4 py-3 rounded-none bg-transparent outline-none"
            style={{
              boxShadow: `inset 0 0 0 1px ${BORDER_SOFT}`,
            }}
          />
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-none"
            style={{
              boxShadow: `inset 0 0 0 1px ${BORDER_SOFT}`,
              background: CARD_BG,
            }}
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={() => onCreate(name.trim())}
            className="px-4 py-2 inline-flex items-center gap-2 rounded-none disabled:opacity-50"
            style={{
              background: BRAND,
              color: '#ffffff', // white text on green CTA
              boxShadow: `0 0 0 1px ${BORDER}, 0 10px 40px -10px ${BORDER}`,
            }}
          >
            <Rocket size={16} />
            Create Subaccount
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────── Helpers / FX ─────────────────────────── */

function layeredSteps() {
  // Square inner plate with subtle banded steps (center darker).
  return `
    radial-gradient(100% 100% at 50% 50%,
      rgba(0,0,0,.55) 0%,
      rgba(0,0,0,.55) 35%,
      rgba(0,0,0,.52) 36%,
      rgba(0,0,0,.52) 55%,
      rgba(0,0,0,.48) 56%,
      rgba(0,0,0,.48) 72%,
      rgba(0,0,0,.45) 73%,
      rgba(0,0,0,.45) 100%
    )
  `;
}

function subtleStripes() {
  return `
    repeating-linear-gradient(
      135deg,
      rgba(0,0,0,0) 0px,
      rgba(0,0,0,0) 6px,
      ${'rgba(255,255,255,0.04)'} 6px,
      ${'rgba(255,255,255,0.04)'} 8px
    )
  `;
}

function panelSurface() {
  // Solid, non-transparent surface with a faint inner glow and banding
  return `
    linear-gradient(180deg, ${SURFACE} 0%, ${CARD_BG} 100%)
  `;
}

function cryptoRandomId() {
  if (typeof window !== 'undefined' && 'crypto' in window && 'randomUUID' in crypto) {
    return window.crypto.randomUUID().replace(/-/g, '').slice(0, 24);
  }
  // fallback
  return Math.random().toString(16).slice(2).padEnd(24, '0');
}
