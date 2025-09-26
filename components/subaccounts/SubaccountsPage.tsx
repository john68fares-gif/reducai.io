'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot } from 'lucide-react';

/* Brand/colors (unchanged) */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const TEXT       = 'rgba(236,242,247,.92)';
const MUTED      = 'rgba(176,196,210,.60)';
const PANEL      = '#0c1114';   // card base
const CANVAS     = '#070b0d';

/* IDs */
function genId() {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return (t + r).slice(0, 8) + '-' + (t + r).slice(8, 13) + '-' + (t + r).slice(13, 18);
}

/* ===== stripes: center = PANEL; +1% lightness per step; capped to 7% ===== */
function bandedBackground(steps = 15) {
  const center = Math.ceil(steps / 2);
  const bandW = 100 / steps;
  const MAX = 0.07;                 // ≤ 7% total on the far edge (very subtle)
  const parts: string[] = [];

  for (let i = 1; i <= steps; i++) {
    const dist = Math.abs(i - center);     // 0..7
    const lighten = Math.min(0.01 * dist, MAX);
    // only PANEL→white (no extra tint) so the middle equals PANEL exactly
    const col = `color-mix(in oklab, ${PANEL} ${100 - lighten*100}%, white ${lighten*100}%)`;
    const s = (i - 1) * bandW;
    const e = i * bandW;
    parts.push(`${col} ${s}%, ${col} ${e}%`);
  }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}

/* Icon tile (unchanged except border 2px to match cards) */
function IconTile({ children, size = 124, radius = 12 }:{
  children:React.ReactNode; size?:number; radius?:number
}) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width:size, height:size, borderRadius:radius,
        background: `
          linear-gradient(180deg, rgba(89,217,179,.10), rgba(89,217,179,.02)),
          radial-gradient(60% 90% at 50% 10%, rgba(255,255,255,.05), rgba(255,255,255,0))
        `,
        border:`2px solid ${GREEN_LINE}`,
        boxShadow:'inset 0 0 0 1px rgba(255,255,255,.03), 0 8px 24px rgba(89,217,179,.10)',
        color:CTA,
        filter:'drop-shadow(0 0 10px rgba(89,217,179,.30))'
      }}
    >
      {children}
    </div>
  );
}

/* ===== overlay: slightly wider than square (not huge), squared + thick borders ===== */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void
}) {
  const [name, setName] = useState('');
  if (!open) return null;
  const can = name.trim().length > 1;

  return (
    <>
      <div
        className="fixed inset-0 z-[5000]"
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[5001] grid place-items-center px-6">
        <div
          onClick={(e)=>e.stopPropagation()}
          className="w-full"
          style={{
            /* about square height, just a bit wider; not 100% wide */
            maxWidth: 660,                     // was 820
            background: PANEL,
            color: TEXT,
            border: `2px solid ${GREEN_LINE}`,
            borderRadius: 8,
            boxShadow: '0 20px 80px rgba(0,0,0,.55)'
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{
              borderBottom: `2px solid ${GREEN_LINE}`,
              background: `linear-gradient(90deg, ${PANEL}, color-mix(in oklab, ${PANEL} 96%, white 4%), ${PANEL})`
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid place-items-center"
                style={{ width: 40, height: 40, borderRadius: 10, background:'color-mix(in oklab, #0a1411 50%, white 2%)', border:`2px solid ${GREEN_LINE}` }}
              >
                <Bot className="w-5 h-5" style={{ color: CTA, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
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
              style={{ background:PANEL, border:`2px solid ${GREEN_LINE}`, color:TEXT, borderRadius: 8 }}
              placeholder="Enter subaccount name..."
              autoFocus
            />
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="w-full h-[44px] font-semibold"
              style={{ background:PANEL, border:`2px solid ${GREEN_LINE}`, color:TEXT, borderRadius: 6 }}
            >
              Cancel
            </button>
            <button
              disabled={!can}
              onClick={()=> onCreate(name.trim())}
              className="w-full h-[44px] font-semibold disabled:opacity-60"
              style={{ background:CTA, color:'#fff', borderRadius: 6 }}
            >
              Create Subaccount
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

type Sub = { id: string; name: string; agents: number; active: boolean };

export default function SubaccountsPage() {
  const [subs, setSubs] = useState<Sub[]>([
    { id: genId(), name: 'Dental Chatbot', agents: 1, active: true },
  ]);
  const [open, setOpen] = useState(false);
  const count = useMemo(() => subs.length, [subs]);

  function createSubNow(name: string) {
    setSubs([{ id: genId(), name, agents: 0, active: true }, ...subs]);
  }

  /* Card proportions: square-ish, slightly bigger */
  const CardRadius = 10;
  const CardHeight = 280;

  return (
    <div className="px-6 pb-16 pt-6" style={{ background: CANVAS, color: TEXT, minHeight: '100dvh' }}>
      {/* header */}
      <div className="flex items-end gap-4">
        <div className="pb-3">
          <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.02em' }}>Subaccounts</div>
          <div style={{ height: 2, background: GREEN_LINE, marginTop: 10, width: 240 }} />
        </div>

        <div className="ml-auto flex items-end gap-10 pb-2">
          <div className="text-right">
            <div style={{ fontSize: 12, letterSpacing: '.04em', color: MUTED }}>You have</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{count}</div>
            <div style={{ fontSize: 12, color: MUTED }}>Subaccounts</div>
          </div>

          <button
            onClick={()=>setOpen(true)}
            className="px-4 h-[40px] font-semibold"
            style={{ background: CTA, color: '#fff', borderRadius: 8, border: `2px solid ${GREEN_LINE}`, boxShadow: '0 12px 26px rgba(89,217,179,.18)' }}
          >
            New Subaccount
          </button>
        </div>
      </div>

      {/* grid (4 per row) */}
      <div className="grid gap-6 mt-8" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        {/* create card */}
        <button
          onClick={()=>setOpen(true)}
          className="relative text-left group overflow-hidden"
          style={{
            height: CardHeight,
            borderRadius: CardRadius,
            background: PANEL,
            border: `2px dashed ${GREEN_LINE}`,
          }}
        >
          <div aria-hidden className="absolute inset-0" style={{ borderRadius: CardRadius, background: bandedBackground(15) }} />

          <div className="absolute inset-0 p-6 flex flex-col">
            <div style={{ fontSize: 18, fontWeight: 700 }}>Create Subaccount</div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>Add new workspace</div>

            <div className="flex-1 grid place-items-center">
              <IconTile radius={12}>
                <Plus size={62} strokeWidth={2.4} />
              </IconTile>
            </div>

            <div style={{ textAlign: 'center', fontSize: 12, color: MUTED, marginTop: 6 }}>Click to create</div>
          </div>

          <div
            className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition"
            style={{ borderRadius: CardRadius, boxShadow: `0 0 0 2px ${GREEN_LINE}, 0 12px 40px rgba(89,217,179,.16)` }}
          />
        </button>

        {/* existing subs */}
        {subs.map((s) => (
          <div
            key={s.id}
            className="relative overflow-hidden"
            style={{
              height: CardHeight,
              borderRadius: CardRadius,
              background: PANEL,
              border: `2px solid ${GREEN_LINE}`,
            }}
          >
            <div aria-hidden className="absolute inset-0" style={{ borderRadius: CardRadius, background: bandedBackground(15) }} />

            <div className="absolute inset-0 p-6 flex flex-col" style={{ color: TEXT }}>
              <div style={{ fontSize: 18, fontWeight: 700 }}>{s.name}</div>
              <div style={{ fontSize: 12, color: MUTED, marginTop: 4, letterSpacing: '.04em' }}>ID: {s.id}</div>

              <div className="flex-1 grid place-items-center">
                <IconTile>
                  <Bot size={58} strokeWidth={2.4} />
                </IconTile>
              </div>

              <div className="flex items-center justify-center gap-2" style={{ fontSize: 12, color: MUTED }}>
                <span>{s.agents} AI Agents</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <span style={{ width:6, height:6, borderRadius:9999, background: s.active ? CTA : 'rgba(255,193,7,.9)' }} />
                  {s.active ? 'Active' : 'Paused'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <CreateModal
        open={open}
        onClose={()=>setOpen(false)}
        onCreate={(name)=>{
          createSubNow(name);
          setOpen(false);
        }}
      />

      <style jsx>{`
        :global(body){ background:${CANVAS}; }
      `}</style>
    </div>
  );
}
