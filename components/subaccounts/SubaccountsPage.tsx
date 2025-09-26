'use client';

import { useMemo, useState } from 'react';
import { Plus, Bot, Search } from 'lucide-react';
import { motion } from 'framer-motion';

/** Brand (from AssistantRail) */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.22)';
const TEXT       = 'rgba(232,244,241,.92)';
const MUTED      = 'rgba(180,206,198,.56)';
const R          = 6;            // squared corners
const ICON_SIZE  = 72;           // centered icon block size
const CARD_H     = 220;          // taller cards

type Subaccount = { id: string; name: string; agents: number; status: 'active'|'inactive' };

const stripeOverlay = `
  repeating-linear-gradient(
    90deg,
    rgba(89,217,179,.22) 0 1px,
    rgba(89,217,179,0)   1px 10px
  )
`;

const baseBg = `
  radial-gradient(120% 160% at 50% 40%, rgba(0,0,0,.55) 0%, rgba(0,0,0,.40) 60%, rgba(0,0,0,.28) 100%),
  linear-gradient(180deg, rgba(16,20,22,.70), rgba(10,12,14,.70))
`;

export default function SubaccountsPage() {
  const [items, setItems] = useState<Subaccount[]>([
    { id: '__create__', name: '', agents: 0, status: 'inactive' },
    { id: '1', name: 'Dental Chatbot', agents: 1, status: 'active' },
  ]);
  const [q, setQ] = useState('');

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const arr = items.filter(i => i.id !== '__create__');
    return s ? arr.filter(x => (x.name.toLowerCase()).includes(s)) : arr;
  }, [items, q]);

  const total = list.length;

  return (
    <div className="w-full h-full" style={{ color: TEXT }}>
      {/* Page header */}
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-[18px] font-semibold" style={{ color: TEXT }}>Subaccounts</h1>

          <button
            onClick={() => onCreate(setItems)}
            className="inline-flex items-center gap-2 px-4 h-[38px] font-semibold"
            style={{
              background: CTA, color: '#ffffff',
              border: `1px solid ${CTA}`, borderRadius: 999,
              boxShadow: '0 8px 30px rgba(89,217,179,.35)'
            }}
          >
            <Plus className="w-4 h-4" style={{ color: '#ffffff' }} />
            New Subaccount
          </button>
        </div>

        {/* Search row (inset, not full width) + total count on same line */}
        <div className="mt-4 flex items-center gap-6">
          <div className="relative" style={{ minWidth: 340, maxWidth: 460, width: '32vw' }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subaccounts…"
              className="w-full h-[40px] pr-3 pl-9 text-sm outline-none"
              style={{
                color: TEXT,
                background: 'rgba(8,10,12,.55)',
                border: `1px solid ${GREEN_LINE}`,
                borderRadius: 999
              }}
            />
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: MUTED }} />
          </div>

          <div className="ml-auto text-sm" style={{ color: MUTED }}>
            Total Subaccounts: <span style={{ color: TEXT }}>{total}</span>
          </div>
        </div>
      </div>

      {/* Grid (3-up on desktop) */}
      <div className="px-6 pb-10 pt-4">
        <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(0,1fr))' }}>
          {/* Create card */}
          <CreateCard onClick={() => onCreate(setItems)} />

          {/* Items */}
          {list.map((it) => (
            <SubCard key={it.id} item={it} />
          ))}
        </div>
      </div>

      {/* responsive breakpoints */}
      <style jsx>{`
        @media (max-width: 1300px) {
          div[style*="grid-template-columns"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 860px) {
          div[style*="grid-template-columns"] { grid-template-columns: repeat(1, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}

/* ---------------- Cards ---------------- */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative overflow-hidden w-full text-center"
      style={{
        height: CARD_H,
        borderRadius: R,
        background: baseBg,
        border: `1px dashed ${GREEN_LINE}`,
        boxShadow: '0 8px 26px rgba(0,0,0,.38)',
        padding: 16
      }}
    >
      {/* squared stripe overlay */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ borderRadius: R, background: stripeOverlay, opacity: .08, mixBlendMode: 'overlay' }} />

      {/* centered icon block */}
      <div className="mx-auto grid place-items-center"
           style={{
             width: ICON_SIZE, height: ICON_SIZE,
             borderRadius: R, border: `1px solid ${GREEN_LINE}`,
             background: 'rgba(89,217,179,.10)'
           }}>
        <Plus className="w-6 h-6" style={{ color: CTA }} />
      </div>

      {/* label */}
      <div className="mt-3 text-[15px] font-semibold" style={{ color: TEXT }}>Create Subaccount</div>
      <div className="text-[12px]" style={{ color: MUTED }}>Add new workspace</div>

      {/* hover wash */}
      <div aria-hidden className="absolute inset-0" style={{ borderRadius: R, background: CTA, opacity: 0, mixBlendMode: 'screen', transition: 'opacity .18s ease' }} />
      <style jsx>{`
        button.group:hover > div[aria-hidden]:last-child { opacity: .14; }
      `}</style>
    </button>
  );
}

function SubCard({ item }: { item: Subaccount }) {
  return (
    <a
      href={`/subaccounts/${item.id}`}
      className="group relative overflow-hidden block text-center"
      style={{
        height: CARD_H,
        borderRadius: R,
        background: baseBg,
        border: `1px solid ${GREEN_LINE}`,
        boxShadow: '0 10px 28px rgba(0,0,0,.40), inset 0 0 0 1px rgba(255,255,255,.02)',
        padding: 16
      }}
    >
      {/* squared stripe overlay */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ borderRadius: R, background: stripeOverlay, opacity: .08, mixBlendMode: 'overlay' }} />

      {/* centered icon block */}
      <div className="mx-auto grid place-items-center"
           style={{
             width: ICON_SIZE, height: ICON_SIZE,
             borderRadius: R, border: `1px solid ${GREEN_LINE}`,
             background: 'rgba(89,217,179,.10)'
           }}>
        <Bot className="w-6 h-6" style={{ color: CTA }} />
      </div>

      {/* name + meta */}
      <div className="mt-3 text-[15px] font-semibold truncate" style={{ color: TEXT }}>
        {item.name}
      </div>
      <div className="text-[12px] flex items-center justify-center gap-2" style={{ color: MUTED }}>
        {item.agents} AI Agents
        <span className="inline-flex items-center gap-1">
          <span className="w-[6px] h-[6px] rounded-[3px]" style={{ background: item.status === 'active' ? CTA : '#94a3b8' }} />
          <span style={{ color: item.status === 'active' ? CTA : MUTED }}>
            {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
          </span>
        </span>
      </div>

      {/* hover wash */}
      <motion.div
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.12 }}
        transition={{ duration: .18 }}
        style={{ borderRadius: R, background: CTA, mixBlendMode: 'screen' }}
      />
    </a>
  );
}

/* ---------------- Helpers ---------------- */

function onCreate(setItems: React.Dispatch<React.SetStateAction<Subaccount[]>>) {
  const id = crypto.randomUUID();
  setItems((prev) => {
    const created: Subaccount = { id, name: `Workspace ${prev.length}`, agents: 0, status: 'inactive' };
    // keep the __create__ tile first
    const createTile = prev.find(p => p.id === '__create__')!;
    const rest = prev.filter(p => p.id !== '__create__');
    return [createTile, created, ...rest];
  });
}
