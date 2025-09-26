'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { Plus, Bot } from 'lucide-react';

/** Brand from your AssistantRail */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

type Subaccount = { id: string; name: string; agents: number; active: boolean };

// TODO: replace with real data
const list: Subaccount[] = [
  { id: '68d6d34b…e1445c', name: 'Dental Chatbot', agents: 1, active: true },
];

export default function Subaccounts() {
  const total = list.length;

  return (
    <div className="px-6 pb-12">
      {/* Top row: Search (left) + Counter (right) */}
      <div className="flex items-end justify-between gap-6 pt-6">
        {/* Search – not full width */}
        <div className="relative">
          <input
            placeholder="Search subaccounts…"
            className="h-[40px] w-[440px] px-3 text-sm outline-none"
            style={{
              background: 'var(--panel)',
              color: 'var(--text)',
              border: `1px solid ${GREEN_LINE}`,
              borderRadius: 10,
            }}
          />
        </div>

        {/* Counter (stacked) */}
        <div className="text-right select-none" style={{ color: 'var(--text)' }}>
          <div className="text-xs opacity-70">You have</div>
          <div className="text-[28px] leading-none font-semibold">{total}</div>
          <div className="text-xs opacity-70 mt-1">subaccounts</div>
        </div>
      </div>

      {/* Grid — always 3 per row on desktop */}
      <div
        className="grid gap-6 mt-6"
        style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
      >
        {/* CREATE card (slightly more rounded) */}
        <CreateCard />

        {/* Existing subaccounts */}
        {list.map((s) => (
          <SubaccountCard key={s.id} data={s} />
        ))}
      </div>
    </div>
  );
}

/* --------------------- Cards --------------------- */

function CreateCard() {
  return (
    <button type="button" className="text-left">
      <SquareCardShell variant="create">
        {/* header */}
        <div className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          Create Subaccount
        </div>
        <div className="text-[11px] mt-1 opacity-60" style={{ color: 'var(--text)' }}>
          Add new workspace
        </div>

        {/* centered tile */}
        <div className="flex-1 grid place-items-center">
          <div
            className="grid place-items-center"
            style={{
              width: 96,
              height: 96,
              borderRadius: 12,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.24)',
            }}
          >
            <Plus className="w-8 h-8" style={{ color: CTA, filter: 'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
          </div>
        </div>

        <div className="text-[12px] opacity-70" style={{ color: 'var(--text)' }}>
          Click to create
        </div>
      </SquareCardShell>
    </button>
  );
}

function SubaccountCard({ data }: { data: Subaccount }) {
  const statusColor = data.active ? 'rgba(34,197,94,.95)' : 'rgba(148,163,184,.9)';

  return (
    <Link href={`/subaccounts/${data.id}`}>
      <SquareCardShell>
        <div className="text-[15px] font-semibold" style={{ color: 'var(--text)' }}>
          {data.name}
        </div>
        <div className="text-[11px] mt-1 opacity-55" style={{ color: 'var(--text)' }}>
          ID: {shortId(data.id)}
        </div>

        <div className="flex-1 grid place-items-center">
          <div
            className="grid place-items-center"
            style={{
              width: 96,
              height: 96,
              borderRadius: 10,
              background: 'rgba(255,255,255,.04)',
              border: `1px solid ${GREEN_LINE}`,
              boxShadow: 'inset 0 0 10px rgba(0,0,0,.22), 0 8px 24px rgba(0,0,0,.24)',
            }}
          >
            <Bot className="w-8 h-8" style={{ color: CTA, filter: 'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
          </div>
        </div>

        <div className="flex items-center justify-between text-[12px]" style={{ color: 'var(--text)' }}>
          <span className="opacity-70">{data.agents} AI Agents</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
            <span className="opacity-90">{data.active ? 'Active' : 'Paused'}</span>
          </span>
        </div>
      </SquareCardShell>
    </Link>
  );
}

/* ------------------ Visual shell ------------------ */

function SquareCardShell({
  children,
  variant = 'normal',
}: {
  children: React.ReactNode;
  variant?: 'normal' | 'create';
}) {
  // create card is a bit more rounded
  const radius = variant === 'create' ? 14 : 10;

  return (
    <div
      className="group relative overflow-hidden"
      style={{
        aspectRatio: '1 / 1', // ALWAYS SQUARE
        borderRadius: radius,
        // border: dashed micro-lines for create, solid for others
        border: variant === 'create' ? `2px dashed ${GREEN_LINE}` : `1px solid ${GREEN_LINE}`,

        /**
         * Background:
         * 1) a center guide line (very subtle) at 50%
         * 2) vertical repeating bands that lighten ~2% step towards edges
         * 3) slight top-to-bottom vignette for depth
         */
        background: [
          // center line at 50%
          'linear-gradient(to right, rgba(89,217,179,.12) 50%, rgba(89,217,179,0) 50%)',
          // vertical step bands (3px)
          'repeating-linear-gradient(to right, rgba(12,18,16,.74) 0px, rgba(12,18,16,.74) 3px, rgba(12,18,16,.68) 3px, rgba(12,18,16,.68) 6px)',
          // soft vertical vignette
          'linear-gradient(180deg, rgba(0,0,0,.10), rgba(0,0,0,0) 35%)',
        ].join(','),
        boxShadow:
          'inset 0 0 14px rgba(0,0,0,.35), 0 10px 30px rgba(0,0,0,.28), 0 0 0 1px rgba(0,0,0,.18)',
        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
      }}
    >
      {/* squared hover glow */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: 'radial-gradient(40% 40% at 50% 50%, rgba(89,217,179,.10) 0%, rgba(89,217,179,0) 100%)',
          transition: 'opacity .18s ease',
        }}
      />
      <div className="absolute inset-0 p-4 flex flex-col">{children}</div>
    </div>
  );
}

/* ------------------ helpers ------------------ */

function shortId(id: string) {
  if (!id) return '';
  return id.length <= 8 ? id : id.slice(0, 6) + '…' + id.slice(-4);
}
