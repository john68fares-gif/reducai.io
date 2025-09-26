'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot } from 'lucide-react';

/* ===== Brand / tokens (aligned with your rail) ===== */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const TEXT       = 'rgba(236,242,247,.92)';
const MUTED      = 'rgba(176,196,210,.60)';
const PANEL      = '#0c1114';
const CANVAS     = '#070b0d';

/* ===== IDs (opaque, stable-looking) ===== */
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return (t + r).slice(0, 8) + '-' + (t + r).slice(8, 13) + '-' + (t + r).slice(13, 18);
}

/* ===== 15-band stripe background (ultra subtle, center = PANEL) =====
   - Middle band is exactly PANEL.
   - Each step from center adds +1% of CTA tint, capped very low (7%).
   - Hard stops (no blur) to create the "lines" you wanted.
*/
function bandedBackground(steps = 15) {
  const center = Math.ceil(steps / 2);
  const bandW = 100 / steps;
  const MAX = 0.07; // keep VERY subtle; lower to 0.05 if you want it ghosted more
  const parts: string[] = [];

  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);        // 0..7
    const mix  = Math.min(0.01 * dist, MAX);  // +1% CTA per band
    const col  = `color-mix(in oklab, ${PANEL} ${100 - mix*100}%, ${CTA} ${mix*100}%)`;
    const s = (i - 1) * bandW, e = i * bandW;
    parts.push(`${col} ${s}%, ${col} ${e}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/* ===== Icon tile (overlay-style, squared, glow) ===== */
function IconTile({
  children, size = 124, radius = 12
}: { children: React.ReactNode; size?: number; radius?: number }) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: size, height: size, borderRadius: radius,
        background: `
          linear-gradient(180deg, rgba(89,217,179,.08), rgba(89,217,179,.02)),
          radial-gradient(60% 90% at 50% 10%, rgba(255,255,255,.03), rgba(255,255,255,0))
        `,
        border: `2px solid ${GREEN_LINE}`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.02), 0 8px 24px rgba(89,217,179,.08)',
        color: CTA,
        filter: 'drop-shadow(0 0 8px rgba(89,217,179,.25))'
      }}
    >
      {children}
    </div>
  );
}

/* ===== Modal: darker, squarer, thicker borders, white text on CTA ===== */
function CreateModal({
  open, onClose, onCreate
}: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [name, setName] = useState('');
  if (!open) return null;
  const can = name.trim().length > 1;

  return (
    <>
      <div
        className="fixed inset-0 z-[5000]"
        style={{ background: 'rgba(0,0,0,.78)', backdropFilter: 'blur(6px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[5001] grid place-items-center px-6">
        <div
          onClick={(e)=>e.stopPropagation()}
          className="w-full"
          style={{
            maxWidth: 640,              // a bit wider than a square, not full-width
            background: PANEL,
            color: TEXT,
            border: `2px solid ${GREEN_LINE}`,
            borderRadius: 8,
            boxShadow: '0 24px 96px rgba(0,0,0,.6)'
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{ borderBottom: `2px solid ${GREEN_LINE}` }}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid place-items-center"
                style={{
                  width: 40, height: 40, borderRadius: 10,
                  background: 'color-mix(in oklab, #07110e 96%, white 4%)',
                  border: `2px solid ${GREEN_LINE}`
                }}
              >
                <Bot className="w-5 h-5" style={{ color: CTA }} />
              </div>
              <div>
                <div className="text-lg font-semibold">Create New Subaccount</div>
                <div className="text-xs" style={{ color: MUTED }}>Organize your AI agents</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 text-sm" style={{ color: MUTED }}>✕</button>
          </div>

          <div className="px-6 py-5">
            <label className="block text-xs mb-1" style={{ color: MUTED }}>Subaccount Name</label>
            <input
              value={name}
              onChange={(e)=>setName(e.target.value)}
              onKeyDown={(e)=>{ if(e.key==='Enter' && can) onCreate(name.trim()); }}
              className="w-full h-[44px] px-3 text-sm outline-none"
              style={{ background: PANEL, border: `2px solid ${GREEN_LINE}`, color: TEXT, borderRadius: 8 }}
              placeholder="Enter subaccount name..."
              autoFocus
            />
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="w-full h-[44px] font-semibold"
              style={{ background: PANEL, border: `2px solid ${GREEN_LINE}`, color: TEXT, borderRadius: 6 }}
            >
              Cancel
            </button>
            <button
              disabled={!can}
              onClick={()=> onCreate(name.trim())}
              className="w-full h-[44px] font-semibold disabled:opacity-60"
              style={{ background: CTA, color: '#fff', borderRadius: 6 }}
            >
              Create Subaccount
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ===== Types ===== */
type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'Dental Chatbot', agents: 1, active: true },
  ]);
  const [createOpen, setCreateOpen] = useState(false);

  const count = useMemo(() => subs.length, [subs]);

  function handleCreate(name: string) {
    const next: Sub = { id: genId(), name, agents: 0, active: true };
    setSubs((s) => [next, ...s]);
    setCreateOpen(false);
  }

  /* Card metrics: squared + a bit taller; create inner tile a bit more rounded */
  const CardRadius = 10;
  const CardHeight = 280;
  const CreateInnerRadius = 12;

  return (
    <div className="px-6 pb-16 pt-6" style={{ background: CANVAS, color: TEXT, minHeight: '100dvh' }}>
      {/* ===== Header row: section name left; right has "You have | N | Subaccounts" and CTA ===== */}
      <div className="flex items-end gap-4">
        <div className="pb-3">
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.02em' }}>Subaccounts</div>
          <div style={{ height: 1, background: GREEN_LINE, marginTop: 10, width: 220 }} />
        </div>

        <div className="ml-auto flex items-end gap-10 pb-2">
          <div className="text-right">
            <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
            <div style={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
            <div style={{ fontSize: 12, color: MUTED }}>Subaccounts</div>
          </div>

          <button
            onClick={()=> setCreateOpen(true)}
            className="px-4 h-[40px] font-semibold"
            style={{
              background: CTA, color: '#fff',
              borderRadius: 10,
              border: `1px solid ${CTA}`,
              boxShadow: '0 12px 26px rgba(89,217,179,.18)',
            }}
          >
            New Subaccount
          </button>
        </div>
      </div>

      {/* ===== Grid: up to 4 squares per row ===== */}
      <div
        className="grid gap-6 mt-8"
        style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}
      >
        {/* Create card (dashed, squared, stripes UNDER content) */}
        <button
          onClick={()=> setCreateOpen(true)}
          className="relative text-left group overflow-hidden"
          style={{
            height: CardHeight, borderRadius: CardRadius,
            background: PANEL, border: `2px dashed ${GREEN_LINE}`,
          }}
        >
          {/* stripes under content */}
          <div
            aria-hidden
            className="absolute inset-0 z-0 pointer-events-none"
            style={{ borderRadius: CardRadius, background: bandedBackground(15) }}
          />

          {/* content */}
          <div
            className="absolute inset-0 z-10 grid"
            style={{ gridTemplateRows: 'auto 1fr auto', padding: '20px 24px' }}
          >
            <div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
                Add new workspace
              </div>
            </div>

            <div className="grid place-items-center">
              <IconTile radius={CreateInnerRadius}>
                <Plus size={62} strokeWidth={2.4} />
              </IconTile>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED }}>Click to create</div>
          </div>

          {/* hover outline / glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition"
            style={{ borderRadius: CardRadius, boxShadow: `0 0 0 1px ${GREEN_LINE}, 0 12px 40px rgba(89,217,179,.12)` }}
          />
        </button>

        {/* Existing subaccounts (solid border, stripes under content) */}
        {subs.map((s) => (
          <div
            key={s.id}
            className="relative overflow-hidden"
            style={{
              height: CardHeight, borderRadius: CardRadius,
              background: PANEL, border: `2px solid ${GREEN_LINE}`,
            }}
          >
            {/* stripes under content */}
            <div
              aria-hidden
              className="absolute inset-0 z-0 pointer-events-none"
              style={{ borderRadius: CardRadius, background: bandedBackground(15) }}
            />

            {/* content */}
            <div
              className="absolute inset-0 z-10 grid"
              style={{ gridTemplateRows: 'auto 1fr auto', padding: '20px 24px', color: TEXT }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>
                  ID: {s.id}
                </div>
              </div>

              <div className="grid place-items-center">
                <IconTile>
                  <Bot size={58} strokeWidth={2.4} />
                </IconTile>
              </div>

              <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: MUTED }}>
                <span>{s.agents} AI Agents</span>
                <span>•</span>
                <span style={{ color: s.active ? CTA : MUTED }}>{s.active ? 'Active' : 'Paused'}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      <CreateModal
        open={createOpen}
        onClose={()=> setCreateOpen(false)}
        onCreate={handleCreate}
      />

      {/* page bg */}
      <style jsx>{`
        :global(body) { background: ${CANVAS}; }
      `}</style>
    </div>
  );
}
