// components/subaccounts/SubaccountsPage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Bot } from 'lucide-react';
import Link from 'next/link';

/** --- Brand / tokens (aligned to your screenshots) --- */
const CTA = '#59d9b3';
const LINE = 'rgba(89,217,179,.20)';
const TEXT = 'rgba(232,240,238,.92)';
const MUTED = 'rgba(189,207,203,.55)';
const CARD_BORDER = 'rgba(89,217,179,.14)';

/** corners = more squared than before */
const R = 12;

/** localStorage key used by your Sidebar */
const LS_COLLAPSED = 'ui:sidebarCollapsed';

type Subaccount = {
  id: string;
  name: string;
  agents?: number;
  status?: 'active' | 'inactive';
};

export default function SubaccountsPage() {
  /** mock data — replace with real fetch */
  const items: Subaccount[] = useMemo(
    () => [
      { id: 'create', name: 'Create', status: 'inactive' },
      { id: '687b', name: 'Dental Chatbot', agents: 1, status: 'active' },
    ],
    []
  );

  /** watch sidebar collapsed so we can slightly change card proportions */
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(false);
  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(LS_COLLAPSED);
        setSbCollapsed(raw ? JSON.parse(raw) : false);
      } catch {}
    };
    read();
    const onStorage = (e: StorageEvent) => {
      if (e.key === LS_COLLAPSED) read();
    };
    window.addEventListener('storage', onStorage);
    const onFocus = () => read();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <div className="px-6 pb-10">
      {/* header */}
      <div className="flex items-center justify-between pt-6 pb-5">
        <h1 className="text-[22px] font-semibold" style={{ color: TEXT }}>
          Launch & Deploy
        </h1>

        <button
          className="h-10 px-4 rounded-[12px] font-semibold inline-flex items-center gap-2"
          style={{
            background: CTA,
            color: '#0b1110',
            border: `1px solid ${LINE}`,
            boxShadow:
              '0 10px 30px rgba(89,217,179,.18), 0 0 18px rgba(89,217,179,.24)',
          }}
        >
          <Plus className="w-4 h-4" />
          New Subaccount
        </button>
      </div>

      {/* grid */}
      <div
        className="grid gap-6"
        style={{
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          maxWidth: 920,
        }}
      >
        {/* Create card (dashed outer, banded fill) */}
        <CreateCard squish={sbCollapsed} />

        {/* existing subaccounts */}
        {items
          .filter((x) => x.id !== 'create')
          .map((s) => (
            <SubCard key={s.id} s={s} squish={sbCollapsed} />
          ))}
      </div>

      {/* page bg subtle vignette */}
      <style jsx>{`
        :global(body) {
          --panel: #0e1312;
        }
      `}</style>
    </div>
  );
}

/* ---------- Cards ---------- */

function CreateCard({ squish }: { squish: boolean }) {
  const h = squish ? 148 : 176; // when sidebar collapsed → a touch more rectangular

  return (
    <button
      type="button"
      className="relative text-left group"
      style={{
        borderRadius: R,
        height: h,
        padding: 18,
        color: TEXT,
        border: `2px dashed ${LINE}`,
        background: layeredBanded(),
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,.02), 0 12px 34px rgba(0,0,0,.42)',
      }}
    >
      <div className="flex items-start gap-16">
        <div
          className="grid place-items-center"
          style={{
            width: 72,
            height: 72,
            borderRadius: R,
            background: innerTile(),
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px rgba(0,0,0,.35)',
            border: `1px solid ${CARD_BORDER}`,
          }}
        >
          <Plus
            className="w-8 h-8"
            style={{
              color: CTA,
              filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))',
            }}
          />
        </div>

        <div className="min-w-0">
          <div className="text-[20px] font-semibold mb-1">Create Subaccount</div>
          <div className="text-[13px]" style={{ color: MUTED }}>
            Add new workspace
          </div>
          <div className="mt-6 text-sm" style={{ color: MUTED }}>
            Click to create
          </div>
        </div>
      </div>

      {/* soft green ring on hover */}
      <div
        className="absolute inset-0 rounded-[12px] pointer-events-none opacity-0 group-hover:opacity-100 transition"
        style={{
          boxShadow:
            '0 0 0 1px rgba(89,217,179,.26), 0 10px 26px rgba(89,217,179,.18)',
        }}
      />
    </button>
  );
}

function SubCard({ s, squish }: { s: Subaccount; squish: boolean }) {
  const h = squish ? 148 : 176;

  return (
    <Link
      href={`/subaccounts/${s.id}`}
      className="relative block group"
      style={{
        borderRadius: R,
        height: h,
        padding: 18,
        color: TEXT,
        background: layeredBanded(),
        border: `1px solid ${CARD_BORDER}`,
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,.03), 0 12px 34px rgba(0,0,0,.42)',
      }}
    >
      <div className="flex items-start gap-16">
        <div
          className="grid place-items-center"
          style={{
            width: 72,
            height: 72,
            borderRadius: R,
            background: innerTile(),
            border: `1px solid ${CARD_BORDER}`,
            boxShadow:
              'inset 0 1px 0 rgba(255,255,255,.06), 0 12px 28px rgba(0,0,0,.35)',
          }}
        >
          <Bot
            className="w-8 h-8"
            style={{
              color: CTA,
              filter: 'drop-shadow(0 0 10px rgba(89,217,179,.35))',
            }}
          />
        </div>

        <div className="min-w-0">
          <div className="text-[20px] font-semibold mb-1">{s.name}</div>
          <div className="text-[13px]" style={{ color: MUTED }}>
            {s.agents ?? 0} AI Agents •{' '}
            <span
              style={{
                color: s.status === 'active' ? CTA : MUTED,
                textShadow:
                  s.status === 'active'
                    ? '0 0 8px rgba(89,217,179,.35)'
                    : 'none',
              }}
            >
              {s.status === 'active' ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="mt-6 text-[12px]" style={{ color: MUTED }}>
            ID: {s.id}…
          </div>
        </div>
      </div>

      {/* soft hover glow */}
      <div
        className="absolute inset-0 rounded-[12px] pointer-events-none opacity-0 group-hover:opacity-100 transition"
        style={{
          boxShadow:
            '0 0 0 1px rgba(89,217,179,.26), 0 10px 26px rgba(89,217,179,.18)',
        }}
      />
    </Link>
  );
}

/* ---------- Visual recipes (banded/striped gradient like in your shots) ---------- */

/**
 * Creates the subtle “strip line” / stepped gradient:
 *  - dark core in the middle
 *  - slight +2–3% lightness steps horizontally left/right
 *  - super low-contrast dotted pattern overlay
 */
function layeredBanded() {
  const core = 'rgba(8,12,11,.86)';
  const edge = 'rgba(12,16,15,.78)';

  // horizontal band steps
  const bands = `
    repeating-linear-gradient(
      90deg,
      rgba(0,0,0,.06) 0px,
      rgba(0,0,0,.06) 2px,
      rgba(0,0,0,.02) 2px,
      rgba(0,0,0,.02) 4px
    )
  `;

  // dark center with slight lift towards edges
  const smooth = `
    radial-gradient(60% 120% at 50% 50%, ${core} 0%, ${edge} 100%)
  `;

  // dotted matrix (super faint) to match the texture in your “Create” card
  const dots = `
    radial-gradient(circle at 1px 1px, rgba(255,255,255,.04) 1px, transparent 1px)
  `;

  return `${bands}, ${smooth}, ${dots}`;
}

/** inner icon tile gradient (darker center, soft edges) */
function innerTile() {
  return `
    radial-gradient(60% 80% at 50% 50%, rgba(11,16,15,.85) 0%, rgba(13,18,17,.7) 100%),
    repeating-linear-gradient(
      90deg,
      rgba(255,255,255,.03) 0px,
      rgba(255,255,255,.03) 2px,
      transparent 2px,
      transparent 4px
    )
  `;
}
