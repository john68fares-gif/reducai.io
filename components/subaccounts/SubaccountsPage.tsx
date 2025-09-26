'use client';

import React from 'react';
import { Plus, Bot } from 'lucide-react';
import Link from 'next/link';

/* === Brand pulled from your rail === */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

/** Stepped / striped background used across cards */
const STEPPED_BG =
  // dark center → lighter edges
  `radial-gradient(140% 100% at 50% 30%, rgba(10,14,13,.72) 0%, rgba(10,14,13,.62) 38%, rgba(10,14,13,.50) 65%, rgba(10,14,13,.35) 100%),
   /* faint horizontal bands */
   repeating-linear-gradient(
     to right,
     rgba(255,255,255,.03) 0px,
     rgba(255,255,255,.03) 1px,
     rgba(255,255,255,0)   1px,
     rgba(255,255,255,0)   7px
   ),
   /* subtle vertical falloff */
   linear-gradient(180deg, rgba(255,255,255,.02) 0%, rgba(0,0,0,.20) 100%)`;

/** Inner tile bg (icon square) */
const TILE_BG =
  `radial-gradient(120% 120% at 50% 30%, rgba(13,18,17,.78) 0%, rgba(13,18,17,.60) 60%, rgba(13,18,17,.42) 100%),
   repeating-linear-gradient(
     to right,
     rgba(255,255,255,.03) 0px,
     rgba(255,255,255,.03) 1px,
     rgba(255,255,255,0)   1px,
     rgba(255,255,255,0)   6px
   )`;

/* ---------- Card shells ---------- */

type CardShellProps = {
  children: React.ReactNode;
  border?: 'dashed' | 'solid';
  href?: string;
};

function CardShell({ children, border = 'solid', href }: CardShellProps) {
  const common = (
    <div
      className="rounded-2xl p-5 relative group"
      style={{
        background: STEPPED_BG,
        border: `${border === 'dashed' ? '1px dashed' : '1px solid'} ${GREEN_LINE}`,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,.04), 0 6px 26px rgba(0,0,0,.30)',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
      }}
    >
      {/* soft neon aura on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100"
        style={{
          transition: 'opacity .18s ease',
          boxShadow: '0 0 0 1px rgba(89,217,179,.10), 0 12px 28px rgba(89,217,179,.10)',
        }}
      />
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block hover:scale-[1.01]">
        {common}
      </Link>
    );
  }
  return <div className="hover:scale-[1.01]">{common}</div>;
}

function IconTile({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="w-[112px] h-[112px] rounded-2xl grid place-items-center"
      style={{
        background: TILE_BG,
        border: `1px solid ${GREEN_LINE}`,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,.04), 0 10px 28px rgba(0,0,0,.35)',
      }}
    >
      {children}
    </div>
  );
}

/* ---------- Specific cards ---------- */

function CreateSubaccountCard({ onClick }: { onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full"
      style={{ color: 'var(--text, #d7e5e0)' }}
      aria-label="Create subaccount"
    >
      <CardShell border="dashed">
        <div className="flex items-start gap-6">
          <IconTile>
            <Plus className="w-10 h-10" style={{ color: CTA, filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))' }} />
          </IconTile>

          <div className="pt-2">
            <div className="text-[22px] font-semibold leading-tight">Create Subaccount</div>
            <div className="text-sm mt-1" style={{ color: 'rgba(214,236,229,.70)' }}>
              Add new workspace
            </div>
            <div className="text-xs mt-6" style={{ color: 'rgba(214,236,229,.55)' }}>
              Click to create
            </div>
          </div>
        </div>
      </CardShell>
    </button>
  );
}

type SubItem = {
  id: string;
  name: string;
  agents: number;
  status: 'Active' | 'Paused';
  href?: string;
};

function SubaccountCard({ item }: { item: SubItem }) {
  return (
    <CardShell href={item.href}>
      <div className="flex items-start gap-6">
        <IconTile>
          <Bot className="w-10 h-10" style={{ color: CTA, filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))' }} />
        </IconTile>

        <div className="pt-2 min-w-0">
          <div className="text-[22px] font-semibold leading-tight" style={{ color: 'var(--text, #e5f6f1)' }}>
            {item.name}
          </div>

          <div className="mt-1 text-sm flex items-center gap-2" style={{ color: 'rgba(214,236,229,.75)' }}>
            <span>{item.agents} AI Agents</span>
            <span>•</span>
            <span
              className="inline-flex items-center gap-1"
              style={{ color: CTA }}
            >
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: CTA }} />
              {item.status}
            </span>
          </div>

          <div className="mt-3 text-[11px]" style={{ color: 'rgba(214,236,229,.45)' }}>
            ID: {item.id}
          </div>
        </div>
      </div>
    </CardShell>
  );
}

/* ---------- Page (only the cards area; no other sections touched) ---------- */

export default function SubaccountsPage() {
  // plug your real data here; this mock is only to render the visuals
  const subs: SubItem[] = [
    {
      id: '68b7b14b2c8bbab698dd0a1',
      name: 'Dental Chatbot',
      agents: 1,
      status: 'Active',
      href: '/subaccounts/68b7b14b2c8bbab698dd0a1',
    },
  ];

  return (
    <div className="w-full">
      {/* Cards grid */}
      <div className="grid gap-6 sm:grid-cols-2 max-w-5xl">
        <CreateSubaccountCard onClick={() => {
          // hook to your modal open action
          const ev = new CustomEvent('subaccounts:create');
          try { window.dispatchEvent(ev); } catch {}
        }} />

        {subs.map(s => (
          <SubaccountCard key={s.id} item={s} />
        ))}
      </div>

      {/* Page-level vars (light/dark safe) */}
      <style jsx>{`
        :global(:root:not([data-theme="dark"])) .grid > * {
          --text: #0f172a;
        }
        :global([data-theme="dark"]) .grid > * {
          --text: #e7f5f0;
        }
      `}</style>
    </div>
  );
}
