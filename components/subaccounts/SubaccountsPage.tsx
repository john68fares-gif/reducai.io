// components/subaccounts/SubaccountsPage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Bot, ChevronRight, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

type Subaccount = { id: string; name: string; agents: number; status: 'active'|'inactive' };

const CTA        = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.22)';
const PANEL_DK   = 'rgba(12,16,18,.82)';
const TEXT       = 'rgba(232,244,241,.92)';
const MUTED      = 'rgba(180,206,198,.56)';
const R          = 8;     // tighter corners (squared)
const R_ICON     = 10;

// detect collapse via your --sidebar-w variable (68px when collapsed)
function useSidebarCollapsed(){
  const [collapsed, set] = useState(false);
  useEffect(()=>{
    const read = () => {
      const raw = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-w').trim();
      const n = Number(raw.replace('px','')) || 0;
      set(n > 0 && n < 100);
    };
    read();
    const id = setInterval(read, 500);
    return () => clearInterval(id);
  },[]);
  return collapsed;
}

/** base gradient (dark center) — stripes moved to a subtle overlay (::after) */
function cardBase() {
  return `
    radial-gradient(120% 160% at 50% 38%, rgba(0,0,0,.58) 0%, rgba(0,0,0,.40) 58%, rgba(0,0,0,.30) 100%),
    linear-gradient(180deg, rgba(16,20,22,.70), rgba(10,12,14,.70))
  `;
}

/** very subtle mint pinstripes — used in ::after */
const stripeOverlay = `
  repeating-linear-gradient(
    90deg,
    rgba(89,217,179,.28) 0 1px,
    rgba(89,217,179,0)   1px 8px
  )
`;

/* ---------------- Modal (unchanged visuals) ---------------- */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [val,setVal] = useState('');
  useEffect(()=>{ if(open) setVal(''); },[open]);
  if(!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="veil" className="fixed inset-0 z-[9999]"
        initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        style={{ background:'rgba(6,8,10,.62)', backdropFilter:'blur(6px)' }}
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[10000] grid place-items-center px-4">
        <motion.div
          initial={{ opacity:0, y:10, scale:.98 }}
          animate={{ opacity:1, y:0, scale:1 }}
          exit={{ opacity:0, y:8, scale:.98 }}
          transition={{ duration:.18, ease:'easeOut' }}
          className="w-full max-w-[560px] overflow-hidden"
          style={{
            borderRadius:R,
            background:`linear-gradient(90deg, ${PANEL_DK} 0%, color-mix(in oklab, ${PANEL_DK} 97%, white 3%) 50%, ${PANEL_DK} 100%)`,
            border:`1px solid ${GREEN_LINE}`, boxShadow:'0 10px 40px rgba(0,0,0,.45)'
          }}
        >
          <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom:`1px solid ${GREEN_LINE}` }}>
            <div className="grid place-items-center" style={{ width:40, height:40, borderRadius:R_ICON, background:'rgba(89,217,179,.10)' }}>
              <Plus className="w-5 h-5" style={{ color:CTA }} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold" style={{ color:TEXT }}>Create New Subaccount</div>
              <div className="text-xs" style={{ color:MUTED }}>Organize your AI agents</div>
            </div>
          </div>

          <div className="px-6 py-5">
            <label className="block text-xs mb-1" style={{ color:MUTED }}>Subaccount Name</label>
            <input
              value={val} onChange={e=>setVal(e.target.value)} autoFocus
              placeholder="e.g., Dental Chatbot"
              className="w-full h-[44px] px-3 text-sm outline-none"
              style={{ color:TEXT, background:'rgba(8,10,12,.65)', border:`1px solid ${GREEN_LINE}`, borderRadius:R }}
            />
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button onClick={onClose} className="w-full h-[44px] font-semibold"
              style={{ borderRadius:R, background:'rgba(12,16,18,.75)', color:TEXT, border:'1px solid rgba(255,255,255,.10)' }}>
              Cancel
            </button>
            <button
              disabled={val.trim().length<2}
              onClick={()=> val.trim() && onCreate(val.trim())}
              className="w-full h-[44px] font-semibold disabled:opacity-60"
              style={{ borderRadius:R, background:CTA, color:'#0b1110', border:`1px solid ${CTA}`, boxShadow:'0 6px 22px rgba(89,217,179,.35)' }}
            >
              Create Subaccount
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}

/* ---------------- Page ---------------- */
export default function SubaccountsPage() {
  const collapsed = useSidebarCollapsed();

  const [items,setItems] = useState<Subaccount[]>([
    { id:'__create__', name:'__create__', agents:0, status:'inactive' },
    { id:'1', name:'Dental Chatbot', agents:1, status:'active' },
  ]);

  // lock 3-up on desktop
  const gridCols = useMemo(()=> 'repeat(3, minmax(0, 1fr))', []);
  const CARD_H   = collapsed ? 140 : 168; // more rectangular when collapsed

  const [open,setOpen] = useState(false);

  return (
    <div className="h-full w-full" style={{ color:TEXT }}>
      {/* header / tabs / search */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold" style={{ color:TEXT }}>Launch &amp; Deploy</div>
          <button onClick={()=>setOpen(true)}
            className="inline-flex items-center gap-2 px-4 h-[38px] font-semibold"
            style={{ borderRadius:999, background:CTA, color:'#0b1110', border:`1px solid ${CTA}`, boxShadow:'0 8px 30px rgba(89,217,179,.35)' }}>
            <Plus className="w-4 h-4" /> New Subaccount
          </button>
        </div>

        <div className="mt-5 flex items-center gap-8 text-sm">
          <button className="relative pb-2 font-medium" style={{ color:TEXT }}>
            Subaccounts
            <span className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-full"
                  style={{ background:`linear-gradient(90deg, transparent, ${CTA}, transparent)` }} />
          </button>
          <button className="pb-2" style={{ color:MUTED }}>Legacy View</button>
        </div>

        <div className="mt-4 relative">
          <input
            placeholder="Search subaccounts..." className="w-full h-[40px] pr-3 pl-9 text-sm outline-none"
            style={{ color:TEXT, background:'rgba(8,10,12,.55)', border:`1px solid ${GREEN_LINE}`, borderRadius:999 }}
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color:MUTED }} />
        </div>
      </div>

      {/* cards */}
      <div className="px-6 pb-10 pt-6">
        <div className="grid gap-6" style={{ gridTemplateColumns: gridCols }}>
          {items.map((it) =>
            it.id==='__create__'
              ? <CreateCard key="create" height={CARD_H} onClick={()=>setOpen(true)} />
              : <SubCard key={it.id} item={it} height={CARD_H} />
          )}
        </div>
      </div>

      <CreateModal open={open} onClose={()=>setOpen(false)}
        onCreate={(name)=>{
          setItems(p => [p[0], { id: crypto.randomUUID(), name, agents:0, status:'inactive' }, ...p.slice(1)]);
          setOpen(false);
        }} />

      {/* responsive — only drop to 2/1 columns on smaller widths */}
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

function CreateCard({ onClick, height }:{ onClick:()=>void; height:number }) {
  return (
    <button onClick={onClick} className="group w-full text-left relative overflow-hidden"
      style={{
        borderRadius:R, height, padding:18, background:cardBase(),
        border:`1px dashed ${GREEN_LINE}`, boxShadow:'0 8px 26px rgba(0,0,0,.38)'
      }}>
      {/* SUBTLE STRIPES (very faint) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ borderRadius:R, background:stripeOverlay, opacity:.08, mixBlendMode:'overlay' }} />

      <div className="flex items-center gap-3 relative z-[1]">
        <div className="grid place-items-center"
          style={{ width:42, height:42, borderRadius:R_ICON, background:'rgba(89,217,179,.10)', border:`1px solid ${GREEN_LINE}`, boxShadow:'inset 0 0 18px rgba(0,0,0,.28)'}}>
          <Plus className="w-5 h-5" style={{ color:CTA }} />
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold" style={{ color:TEXT }}>Create Subaccount</div>
          <div className="text-[12px]" style={{ color:MUTED }}>Add new workspace</div>
        </div>
      </div>

      <div className="mt-3 text-[12px] relative z-[1]" style={{ color:MUTED }}>Click to create</div>

      {/* soft hover glow */}
      <div aria-hidden className="absolute inset-0 rounded-[8px] opacity-0 group-hover:opacity-[.18] transition-opacity"
           style={{ background:CTA, mixBlendMode:'screen' }} />
    </button>
  );
}

function SubCard({ item, height }:{ item:Subaccount; height:number }) {
  return (
    <a href={`/subaccounts/${item.id}`} className="group block relative overflow-hidden"
       style={{
         borderRadius:R, height, padding:18, background:cardBase(),
         border:`1px solid ${GREEN_LINE}`,
         boxShadow:'0 10px 28px rgba(0,0,0,.40), inset 0 0 0 1px rgba(255,255,255,.02)'
       }}>
      {/* SUBTLE STRIPES (same treatment as create card) */}
      <div aria-hidden className="absolute inset-0 pointer-events-none"
           style={{ borderRadius:R, background:stripeOverlay, opacity:.08, mixBlendMode:'overlay' }} />

      <div className="flex items-center gap-3 relative z-[1]">
        <div className="grid place-items-center"
          style={{ width:42, height:42, borderRadius:R_ICON, background:'rgba(89,217,179,.10)', border:`1px solid ${GREEN_LINE}`, boxShadow:'inset 0 0 18px rgba(0,0,0,.28)' }}>
          <Bot className="w-5 h-5" style={{ color:CTA }} />
        </div>

        <div className="min-w-0">
          <div className="text-[15px] font-semibold truncate" style={{ color:TEXT }}>{item.name}</div>
          <div className="text-[12px] flex items-center gap-2" style={{ color:MUTED }}>
            {item.agents} AI Agents
            <span className="inline-flex items-center gap-1">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background:item.status==='active'?CTA:'#94a3b8' }} />
              <span style={{ color:item.status==='active'?CTA:MUTED }}>
                {item.status.charAt(0).toUpperCase()+item.status.slice(1)}
              </span>
            </span>
          </div>
        </div>

        <ChevronRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-80 transition-opacity" style={{ color:MUTED }} />
      </div>

      <div aria-hidden className="absolute inset-0 rounded-[8px] opacity-0 group-hover:opacity-[.14] transition-opacity"
           style={{ background:CTA, mixBlendMode:'screen' }} />
    </a>
  );
}
