// app/(dashboard)/subaccounts/SubaccountsPage.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Bot } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/** Brand (same as AssistantRail) */
const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const TEXT_MUTED = 'color-mix(in oklab, var(--text) 55%, black 45%)';

type Sub = { id: string; name: string; agents: number; status: 'Active' | 'Paused' };

function rid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const r = Math.random().toString(16).slice(2) + Math.random().toString(16).slice(2);
  return `id_${r.slice(0, 8)}${r.slice(-8)}`;
}

/** ---------- Modal (squared) ---------- */
function CreateSubModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [name, setName] = useState('');
  if (!open) return null;
  const can = name.trim().length > 1;

  return (
    <>
      <motion.div
        className="fixed inset-0 z-[5000]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[5001] grid place-items-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 6, scale: 0.98 }}
          transition={{ duration: .18, ease: 'easeOut' }}
          className="w-full max-w-[520px] overflow-hidden"
          onClick={(e)=>e.stopPropagation()}
          style={{
            background:'var(--panel)',
            color:'var(--text)',
            border:`1px solid ${GREEN_LINE}`,
            borderRadius: 8, // squared
            boxShadow:'0 6px 40px rgba(0,0,0,.55)'
          }}
        >
          <div
            className="flex items-center justify-between px-6 py-4"
            style={{
              background:`linear-gradient(90deg,var(--panel) 0%, color-mix(in oklab,var(--panel) 96%, white 4%) 50%, var(--panel) 100%)`,
              borderBottom:`1px solid ${GREEN_LINE}`
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="grid place-items-center"
                style={{ width: 40, height: 40, borderRadius: 10, background:'var(--brand-weak)' }}
              >
                <Bot className="w-5 h-5" style={{ color: CTA, filter:'drop-shadow(0 0 8px rgba(89,217,179,.35))' }} />
              </div>
              <div>
                <div className="text-lg font-semibold">Create New Subaccount</div>
                <div className="text-xs" style={{ color: TEXT_MUTED }}>Organize your AI agents</div>
              </div>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 text-sm"
              style={{ color: TEXT_MUTED }}>✕</button>
          </div>

          <div className="px-6 py-5">
            <label className="block text-xs mb-1" style={{ color: TEXT_MUTED }}>Subaccount Name</label>
            <input
              value={name} onChange={(e)=>setName(e.target.value)}
              className="w-full h-[44px] px-3 text-sm outline-none"
              style={{
                background:'var(--panel)',
                border:`1px solid ${GREEN_LINE}`,
                color:'var(--text)',
                borderRadius: 8
              }}
              placeholder="Enter subaccount name..."
              autoFocus
              onKeyDown={(e)=>{ if(e.key==='Enter' && can) onCreate(name.trim()); }}
            />
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="w-full h-[44px] font-semibold"
              style={{ background:'var(--panel)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)', borderRadius: 8 }}
            >
              Cancel
            </button>
            <button
              disabled={!can}
              onClick={()=> onCreate(name.trim())}
              className="w-full h-[44px] font-semibold disabled:opacity-60"
              style={{ background: CTA, color:'#fff', borderRadius: 8 }}
            >
              Create Subaccount
            </button>
          </div>
        </motion.div>
      </div>
    </>
  );
}

/** ---------- Icon Tile (matches overlay style) ---------- */
function IconTile({ children }:{ children:React.ReactNode }) {
  return (
    <div
      className="grid place-items-center"
      style={{
        width: 120, height: 120,
        borderRadius: 12, // create tile is a bit rounder; sub tiles slightly less below
        background: `
          radial-gradient(72% 60% at 50% 35%, rgba(89,217,179,.12) 0%, rgba(89,217,179,0) 60%),
          linear-gradient(180deg, rgba(10,18,16,.0) 0%, rgba(10,18,16,.25) 100%),
          color-mix(in oklab, #0c1412 88%, ${CTA} 12%)
        `,
        border:`1px solid ${GREEN_LINE}`,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.02), 0 10px 40px rgba(0,0,0,.35)'
      }}
    >
      <div style={{ color: CTA, filter:'drop-shadow(0 0 10px rgba(89,217,179,.35))' }}>
        {children}
      </div>
    </div>
  );
}

/** ---------- The banded “striped” card background ---------- */
/** Center dark line + ~15 lighter bands toward edges, tinted green */
function bandedBackground({ darker=false }={}) {
  // base dark tint toward CTA so bands are on-brand
  const base = 'color-mix(in oklab, #0b1513 88%, ' + CTA + ' 12%)';
  const bandA = 'rgba(89,217,179,.10)';
  const bandB = 'rgba(89,217,179,.06)';
  const dim   = darker ? 'rgba(0,0,0,.35)' : 'rgba(0,0,0,.22)';

  return `
    /* subtle dark vignette */
    radial-gradient(100% 120% at 50% 10%, ${dim} 0%, rgba(0,0,0,0) 60%),
    /* CENTER darker hairline */
    linear-gradient(90deg, transparent 49.5%, rgba(0,0,0,.40) 50%, transparent 50.5%),
    /* 15-ish green-tinted bands that get lighter */
    repeating-linear-gradient(
      90deg,
      ${bandA} 0 8px,
      ${bandB} 8px 16px
    ),
    ${base}
  `;
}

/** ---------- Subaccount Card ---------- */
function SubCard({
  title, id, agents, status, isCreate, onClick
}:{
  title:string; id?:string; agents?:number; status?:'Active'|'Paused';
  isCreate?:boolean; onClick?:()=>void;
}) {
  const radius = isCreate ? 10 : 8;

  return (
    <button
      onClick={onClick}
      className="group relative w-full text-left"
      style={{
        height: 220, // bigger & a bit taller
        borderRadius: radius,
        background: bandedBackground({ darker: !isCreate }),
        border: `1px ${isCreate ? 'dashed' : 'solid'} ${GREEN_LINE}`,
        boxShadow: '0 18px 60px rgba(0,0,0,.35)',
        padding: 18
      }}
    >
      {/* subtle hover glow */}
      <span
        className="absolute inset-0 rounded-[8px] pointer-events-none"
        style={{
          borderRadius: radius,
          boxShadow:'0 0 0 0 rgba(89,217,179,.0)',
          transition:'box-shadow .18s ease'
        }}
      />
      <div className="h-full flex flex-col">
        <div className="flex items-baseline justify-between">
          <div className="text-[18px] font-semibold" style={{ color: 'var(--text)' }}>
            {title}
          </div>
          {!isCreate && (
            <div className="text-[11px] tracking-wide" style={{ color: TEXT_MUTED }}>
              ID: <span style={{ letterSpacing:'.02em' }}>{id}</span>
            </div>
          )}
        </div>

        <div className="flex-1 grid place-items-center">
          <div style={{ transform:'translateY(-4px)' }}>
            <IconTile>
              {isCreate
                ? <Plus className="w-12 h-12" />
                : <Bot className="w-12 h-12" />
              }
            </IconTile>
          </div>
        </div>

        <div className="mt-2 text-xs flex items-center gap-2" style={{ color: TEXT_MUTED }}>
          {isCreate ? 'Click to create'
            : (<>
                <span>{agents ?? 0} AI Agents</span>
                <span>•</span>
                <span className="inline-flex items-center gap-1">
                  <span style={{ width:6, height:6, borderRadius:9999, background: status==='Active' ? CTA : '#f59e0b' }} />
                  {status}
                </span>
              </>)
          }
        </div>
      </div>

      <style jsx>{`
        .group:hover > span {
          box-shadow: 0 0 0 3px rgba(89,217,179,.18), 0 10px 40px rgba(89,217,179,.18) inset;
        }
      `}</style>
    </button>
  );
}

/** ---------- Page ---------- */
export default function SubaccountsPage() {
  const [list, setList] = useState<Sub[]>([
    { id: rid(), name: 'aha', agents: 0, status: 'Active' }
  ]);
  const [open, setOpen] = useState(false);

  const total = list.length;
  const cards = useMemo(()=>[
    { key:'__create__', el: <SubCard key="create" title="Create Subaccount" isCreate onClick={()=>setOpen(true)} /> },
    ...list.map(s => ({ key:s.id, el:
      <SubCard key={s.id} title={s.name} id={s.id.slice(0,8)} agents={s.agents} status={s.status} />
    }))
  ],[list]);

  return (
    <div className="px-6 pb-12">
      {/* Header row */}
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold tracking-[.18em]" style={{ color: TEXT_MUTED, textTransform:'uppercase' }}>
            Subaccounts
          </div>
          {/* divider line under header height */}
          <div className="mt-2" style={{ height:1, background: GREEN_LINE }} />
        </div>

        <div className="flex items-center gap-3">
          {/* Count block */}
          <div
            className="px-3 py-2 text-right"
            style={{
              minWidth: 140,
              border:`1px solid ${GREEN_LINE}`,
              borderRadius: 8,
              background:`linear-gradient(90deg,var(--panel) 0%, color-mix(in oklab,var(--panel) 96%, white 4%) 50%, var(--panel) 100%)`
            }}
          >
            <div className="text-[11px]" style={{ color: TEXT_MUTED }}>You have</div>
            <div className="text-2xl leading-none font-semibold" style={{ color:'var(--text)' }}>{total}</div>
            <div className="text-[11px]" style={{ color: TEXT_MUTED }}>Subaccounts</div>
          </div>

          {/* New subaccount CTA — white text on your green */}
          <button
            onClick={()=>setOpen(true)}
            className="inline-flex items-center gap-2 font-semibold px-4 h-[40px]"
            style={{
              background: CTA,
              color: '#fff',
              borderRadius: 8,
              border:`1px solid ${GREEN_LINE}`,
              boxShadow:'0 12px 30px rgba(89,217,179,.25)'
            }}
          >
            <Plus className="w-4 h-4" style={{ color:'#fff' }} />
            New Subaccount
          </button>
        </div>
      </div>

      {/* 4-per-row grid of squared cards */}
      <div
        className="mt-6 grid gap-6"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))'
        }}
      >
        {cards.map(c => c.el)}
      </div>

      {/* Create Modal */}
      <AnimatePresence>{open && (
        <CreateSubModal
          open={open}
          onClose={()=>setOpen(false)}
          onCreate={(name)=>{
            const sub: Sub = { id: rid(), name, agents: 0, status:'Active' };
            setList([sub, ...list]);
            setOpen(false);
          }}
        />
      )}</AnimatePresence>
    </div>
  );
}
