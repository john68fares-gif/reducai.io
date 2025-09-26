'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus, Bot, ChevronRight } from 'lucide-react';

/** Use the same rail colors */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

type Subaccount = {
  id: string;
  name: string;
  agents: number;
  active: boolean;
};

const demoData: Subaccount[] = [
  // replace with your data
  { id: '68d6d34...e1445c', name: 'Dental Chatbot', agents: 1, active: true },
];

export default function SubaccountsPage() {
  // replace with your actual list
  const subaccounts = demoData;

  const total = subaccounts.length;

  return (
    <div className="px-6 pb-10">
      {/* Top row (NO page title, NO Legacy) */}
      <div className="flex items-center justify-between gap-4 pt-6 pb-3">
        {/* “Subaccounts” tab-style label */}
        <div className="flex items-center gap-6">
          <div
            className="relative h-9 inline-flex items-center px-3 text-sm font-semibold"
            style={{
              color: 'var(--text)',
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: 8,
              background:
                'linear-gradient(90deg,var(--panel) 0%,color-mix(in oklab,var(--panel) 97%, white 3%) 50%,var(--panel) 100%)'
            }}
          >
            Subaccounts
          </div>

          {/* Search (NOT full width) */}
          <div className="relative">
            <input
              placeholder="Search subaccounts..."
              className="h-[38px] w-[420px] pl-3 pr-10 text-sm outline-none"
              style={{
                background: 'var(--panel)',
                color: 'var(--text)',
                border: `1px solid ${GREEN_LINE}`,
                borderRadius: 10,
              }}
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-60 text-[12px]" style={{color:'var(--text)'}}>⌘K</div>
          </div>
        </div>

        {/* Right side: total + CTA */}
        <div className="flex items-center gap-4">
          <div className="text-xs opacity-70" style={{color:'var(--text)'}}>
            <span className="opacity-70 mr-1">Total</span>
            <b>{total}</b> <span className="opacity-70">Subaccounts</span>
          </div>
          <button
            className="h-[38px] px-4 text-sm font-semibold"
            style={{
              background: CTA,
              color: '#fff',                 // WHITE text
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: 999,
              boxShadow: '0 8px 28px rgba(89,217,179,.22)'
            }}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> New Subaccount
            </span>
          </button>
        </div>
      </div>

      {/* Grid — ALWAYS 3 per row on desktop */}
      <div
        className="grid gap-6 mt-6"
        style={{
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))'
        }}
      >
        {/* Create card */}
        <CreateCard />

        {/* Existing subaccounts */}
        {subaccounts.map(s => (
          <SubaccountCard key={s.id} data={s} />
        ))}
      </div>
    </div>
  );
}

/* ---------- Visual primitives ---------- */

/** Shared square card shell (banded stripes + subtle halo). Always 1:1. */
function SquareCardShell({
  dashed = false,
  children,
}: {
  dashed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="group relative overflow-hidden"
      style={{
        aspectRatio: '1 / 1',                // **ALWAYS SQUARE**
        border: dashed ? `2px dashed ${GREEN_LINE}` : `1px solid ${GREEN_LINE}`,
        borderRadius: 12,                    // can drop to 8 if you want sharper corners
        background:
          // vertical banded “step” lines with a dark core
          `linear-gradient(180deg, rgba(0,0,0,.05), rgba(0,0,0,0) 35%),
           repeating-linear-gradient(
             to right,
             rgba(12,18,16,.68) 0px,
             rgba(12,18,16,.68) 3px,
             rgba(12,18,16,.62) 3px,
             rgba(12,18,16,.62) 6px
           )`,
        boxShadow:
          'inset 0 0 14px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.18)',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
      }}
    >
      {/* hover/active green glow (square, not rounded) */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background:
            `radial-gradient(40% 40% at 50% 50%, rgba(89,217,179,.10) 0%, rgba(89,217,179,0) 100%)`,
          transition: 'opacity .18s ease',
        }}
      />
      <div className="absolute inset-0 p-4 flex flex-col">
        {children}
      </div>
    </div>
  );
}

/** Create Subaccount card (dashed) */
function CreateCard() {
  return (
    <button className="text-left">
      <SquareCardShell dashed>
        {/* Title row */}
        <div className="text-[15px] font-semibold" style={{color:'var(--text)'}}>
          Create Subaccount
        </div>
        <div className="text-[11px] mt-1 opacity-60" style={{color:'var(--text)'}}>Add new workspace</div>

        {/* Centered square icon tile */}
        <div className="flex-1 grid place-items-center">
          <div
            className="grid place-items-center"
            style={{
              width: 96, height: 96,
              borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.24)'
            }}
          >
            <Plus className="w-8 h-8" style={{ color: CTA, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
          </div>
        </div>

        <div className="text-[12px] opacity-70" style={{color:'var(--text)'}}>Click to create</div>
      </SquareCardShell>
    </button>
  );
}

/** Existing Subaccount card (solid border) */
function SubaccountCard({ data }: { data: Subaccount }) {
  const statusColor = data.active ? 'rgba(34,197,94,.95)' : 'rgba(148,163,184,.9)';

  return (
    <Link href={`/subaccounts/${data.id}`}>
      <SquareCardShell>
        {/* Top-left meta */}
        <div className="text-[15px] font-semibold" style={{color:'var(--text)'}}>
          {data.name}
        </div>
        <div className="text-[11px] mt-1 opacity-55" style={{color:'var(--text)'}}>ID: {shortId(data.id)}</div>

        {/* Centered square icon tile */}
        <div className="flex-1 grid place-items-center">
          <div
            className="grid place-items-center"
            style={{
              width: 96, height: 96,
              borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.24)'
            }}
          >
            <Bot className="w-8 h-8" style={{ color: CTA, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
          </div>
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between text-[12px]" style={{color:'var(--text)'}}>
          <span className="opacity-70">{data.agents} AI Agents</span>
          <span className="inline-flex items-center gap-1">
            <span
              className="w-2 h-2 rounded-full"
              style={{ background: statusColor }}
            />
            <span className="opacity-90">{data.active ? 'Active' : 'Paused'}</span>
          </span>
        </div>
      </SquareCardShell>
    </Link>
  );
}

/* helpers */
function shortId(id: string) {
  if (!id) return '';
  if (id.length <= 8) return id;
  return id.slice(0, 6) + '…' + id.slice(-4);
}
