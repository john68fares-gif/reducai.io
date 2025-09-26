'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Plus, Bot } from 'lucide-react';

/** Accent + lines (same family as your rail) */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

type Subaccount = {
  id: string;
  name: string;
  agents: number;
  status: 'active' | 'paused';
};

export default function SubaccountsPage() {
  // mock data — replace with your fetch/useQuery
  const subs = useMemo<Subaccount[]>(
    () => [{ id: '687b714b2c8bbab698dd0a1', name: 'Dental Chatbot', agents: 1, status: 'active' }],
    []
  );

  return (
    <div className="min-h-screen">
      {/* Header row (kept minimal — matches your screenshots) */}
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="text-[22px] font-semibold" style={{ color: 'var(--text)' }}>
          Launch & Deploy
        </div>
        <Link
          href="#"
          className="h-10 px-4 rounded-[10px] font-semibold inline-flex items-center gap-2"
          style={{
            background: CTA,
            color: '#0b0f0e',
            boxShadow: '0 10px 24px rgba(89,217,179,.22)',
            border: `1px solid ${GREEN_LINE}`
          }}
        >
          <Plus className="w-4 h-4" /> New Subaccount
        </Link>
      </div>

      {/* Tabs + search (shell only so spacing matches) */}
      <div className="px-6 mt-4">
        <div className="flex items-center gap-6">
          <button className="pb-2 text-sm font-semibold" style={{ color: CTA, borderBottom: `2px solid ${CTA}` }}>
            Subaccounts
          </button>
          <button className="pb-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            Legacy View
          </button>
        </div>
        <div className="mt-4">
          <div
            className="h-11 rounded-[10px] px-4 flex items-center"
            style={{
              background: 'var(--panel)',
              border: `1px solid ${GREEN_LINE}`,
              color: 'var(--text)'
            }}
          >
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Search subaccounts…
            </span>
          </div>
        </div>
      </div>

      {/* Cards — 3 per row on large+; naturally become a bit wider when sidebar collapses */}
      <div className="px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {/* Create Card */}
          <CreateCard />

          {/* Existing subaccounts */}
          {subs.map((s) => (
            <SubCard key={s.id} sub={s} />
          ))}
        </div>
      </div>

      <style jsx>{`
        /* Light theme mapping */
        :global(:root:not([data-theme="dark"])) {
          --panel: #ffffff;
          --text: #0f172a;
          --text-muted: #64748b;
        }
        /* Dark theme mapping */
        :global([data-theme="dark"]) {
          --panel: rgba(10, 14, 16, 0.78);
          --text: rgba(255, 255, 255, 0.92);
          --text-muted: rgba(255, 255, 255, 0.55);
        }
      `}</style>
    </div>
  );
}

/** Reusable card shell with banded “step” background + subtle neon halo */
function CardShell({
  children,
  dashed = false,
}: {
  children: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <div
      className="rounded-[10px] p-5 relative"
      style={{
        /* Layered look:
           1) faint radial tint
           2) banded horizontal steps (subtle stripes)
           3) base dark panel
        */
        background: `
          radial-gradient(80% 120% at 50% -20%, rgba(89,217,179,.10) 0%, rgba(89,217,179,0) 60%),
          repeating-linear-gradient(
            90deg,
            rgba(255,255,255,.038) 0px,
            rgba(255,255,255,.038) 2px,
            rgba(0,0,0,.00) 2px,
            rgba(0,0,0,.00) 4px
          ),
          color-mix(in oklab, var(--panel) 92%, black 8%)
        `,
        border: dashed ? `2px dashed ${GREEN_LINE}` : `1px solid ${GREEN_LINE}`,
        boxShadow:
          'inset 0 1px 0 rgba(255,255,255,.03), 0 12px 30px rgba(0,0,0,.35), 0 0 0 1px rgba(0,0,0,.20)',
        minHeight: 168, // stays “squared”; when the sidebar collapses, width grows so it reads more rectangular
      }}
    >
      {/* soft outer glow on hover */}
      <div
        className="pointer-events-none absolute inset-0 rounded-[10px] opacity-0 transition-opacity duration-200"
        style={{
          boxShadow: '0 0 0 1px rgba(89,217,179,.28), 0 22px 50px rgba(89,217,179,.08)',
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

function CreateCard() {
  return (
    <CardShell dashed>
      <div className="grid grid-cols-[72px_1fr] gap-4">
        <div
          className="w-[72px] h-[72px] grid place-items-center rounded-[10px]"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.15))',
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: 'inset 0 0 16px rgba(0,0,0,.25)',
          }}
        >
          <Plus className="w-7 h-7" style={{ color: CTA, filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))' }} />
        </div>

        <div className="min-w-0">
          <div className="text-[18px] font-semibold" style={{ color: 'var(--text)' }}>
            Create Subaccount
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Add new workspace
          </div>
          <div className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            Click to create
          </div>
        </div>
      </div>
    </CardShell>
  );
}

function SubCard({ sub }: { sub: { id: string; name: string; agents: number; status: 'active' | 'paused' } }) {
  return (
    <CardShell>
      <div className="grid grid-cols-[72px_1fr] gap-4">
        <div
          className="w-[72px] h-[72px] grid place-items-center rounded-[10px]"
          style={{
            background: 'linear-gradient(180deg, rgba(0,0,0,.35), rgba(0,0,0,.15))',
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: 'inset 0 0 16px rgba(0,0,0,.25)',
          }}
        >
          <Bot className="w-7 h-7" style={{ color: CTA, filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))' }} />
        </div>

        <div className="min-w-0">
          <div className="text-[18px] font-semibold truncate" style={{ color: 'var(--text)' }}>
            {sub.name}
          </div>

          <div className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            ID: <span className="tabular-nums">{sub.id.slice(0, 12)}…</span>
          </div>

          <div className="mt-6 flex items-center gap-3 text-sm" style={{ color: 'var(--text-muted)' }}>
            <span className="whitespace-nowrap">{sub.agents} AI Agents</span>
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block rounded-full"
                style={{
                  width: 6,
                  height: 6,
                  background: sub.status === 'active' ? CTA : 'rgba(255,255,255,.4)',
                  boxShadow: sub.status === 'active' ? '0 0 10px rgba(89,217,179,.5)' : 'none',
                }}
              />
              <span style={{ color: sub.status === 'active' ? CTA : 'var(--text-muted)' }}>
                {sub.status === 'active' ? 'Active' : 'Paused'}
              </span>
            </span>
          </div>
        </div>
      </div>
    </CardShell>
  );
}
