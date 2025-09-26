// components/subaccounts/SubaccountsPage.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Bot, ChevronRight, Search } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';

type Subaccount = {
  id: string;
  name: string;
  agents: number;
  status: 'active' | 'inactive';
};

const CTA          = '#59d9b3';                    // brand mint
const GREEN_LINE   = 'rgba(89,217,179,.22)';       // thin lines / borders
const PANEL        = 'rgba(12,16,18,.82)';
const TEXT         = 'rgba(232,244,241,.92)';
const MUTED        = 'rgba(180,206,198,.56)';
const RADIUS       = 10;                            // squared-ish corners
const RADIUS_ICON  = 12;

// util: read sidebar width to infer collapsed
function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => {
      const raw = getComputedStyle(el).getPropertyValue('--sidebar-w').trim();
      const n = Number(raw.replace('px','')) || 0;
      setCollapsed(n > 0 && n < 100); // your Sidebar sets 68px when collapsed
    };
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    const id = setInterval(read, 600); // defensive in case CSS var flips without resize
    return () => { ro.disconnect(); clearInterval(id); };
  }, []);
  return collapsed;
}

// striped / stepped banding background
function stripedCard(stepAlpha = 0.06, centerDarken = 0.58) {
  // center slightly darker; horizontal stepped lines lighten ~2% each
  return `
    radial-gradient(120% 160% at 50% 40%, rgba(0,0,0,${centerDarken}) 0%, rgba(0,0,0,0.38) 60%, rgba(0,0,0,0.28) 100%),
    repeating-linear-gradient(
      90deg,
      rgba(145, 255, 230, ${stepAlpha}) 0px,
      rgba(145, 255, 230, ${stepAlpha}) 2px,
      transparent 2px,
      transparent 6px
    ),
    linear-gradient(180deg, rgba(20,26,28,.72), rgba(10,12,14,.72))
  `;
}

// dashed frame used only by the “Create Subaccount” card
function dashedFrame() {
  return `
    repeating-linear-gradient(
      90deg,
      rgba(89,217,179,.22) 0 8px,
      rgba(89,217,179,0) 8px 16px
    )
  `;
}

/* ---------- Create modal (simple, same visual language as your rail) ---------- */
function CreateModal({ open, onClose, onCreate }:{
  open:boolean; onClose:()=>void; onCreate:(name:string)=>void;
}) {
  const [val,setVal] = useState('');
  useEffect(()=>{ if(open) setVal(''); },[open]);
  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="veil"
        className="fixed inset-0 z-[9999]"
        initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
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
            borderRadius: RADIUS,
            background: `linear-gradient(90deg, ${PANEL} 0%, color-mix(in oklab, ${PANEL} 97%, white 3%) 50%, ${PANEL} 100%)`,
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: '0 10px 40px rgba(0,0,0,.45)',
          }}
        >
          <div
            className="flex items-center gap-3 px-6 py-4"
            style={{ borderBottom:`1px solid ${GREEN_LINE}` }}
          >
            <div className="grid place-items-center"
              style={{ width:42, height:42, borderRadius:RADIUS_ICON, background:'rgba(89,217,179,.10)' }}>
              <Plus className="w-5 h-5" style={{ color: CTA }} />
            </div>
            <div className="min-w-0">
              <div className="text-lg font-semibold" style={{ color: TEXT }}>Create New Subaccount</div>
              <div className="text-xs" style={{ color: MUTED }}>Organize your AI agents</div>
            </div>
          </div>

          <div className="px-6 py-5">
            <label className="block text-xs mb-1" style={{ color: MUTED }}>Subaccount Name</label>
            <input
              value={val}
              onChange={e=>setVal(e.target.value)}
              placeholder="e.g., Dental Chatbot"
              className="w-full h-[44px] px-3 text-sm outline-none"
              style={{
                color: TEXT,
                background: 'rgba(8,10,12,.65)',
                border: `1px solid ${GREEN_LINE}`,
                borderRadius: RADIUS,
              }}
              autoFocus
            />
          </div>

          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={onClose}
              className="w-full h-[44px] font-semibold"
              style={{
                borderRadius: RADIUS,
                background:'rgba(12,16,18,.75)',
                color: TEXT,
                border:`1px solid rgba(255,255,255,.10)`
              }}
            >
              Cancel
            </button>
            <button
              disabled={val.trim().length<2}
              onClick={()=> val.trim() && onCreate(val.trim())}
              className="w-full h-[44px] font-semibold disabled:opacity-60"
              style={{
                borderRadius: RADIUS,
                background: CTA,
                color: '#0b1110',
                border: `1px solid ${CTA}`,
                boxShadow: '0 6px 22px rgba(89,217,179,.35)'
              }}
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

/* -------------------------------- Page -------------------------------- */
export default function SubaccountsPage() {
  const isCollapsed = useSidebarCollapsed();

  // demo data; replace with your fetch if needed
  const [items, setItems] = useState<Subaccount[]>([
    { id:'create-card', name:'__CREATE__', agents:0, status:'inactive' },
    { id:'1', name:'Dental Chatbot', agents:1, status:'active' },
    // leave third empty for now; grid is already ready for 3-up
  ]);

  const [modalOpen,setModalOpen] = useState(false);
  const gridCols = useMemo(() => {
    // always 3-up on desktop; below 1200px gracefully wraps with CSS
    return 'repeat(3, minmax(0, 1fr))';
  }, []);

  // Card height: square when sidebar expanded; slightly shorter (more rectangular) when collapsed
  const CARD_H = isCollapsed ? 148 : 168;

  return (
    <div className="h-full w-full" style={{ color: TEXT }}>
      {/* Top bar */}
      <div className="px-6 pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold" style={{ color: TEXT }}>Launch &amp; Deploy</div>
          <button
            onClick={()=>setModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 h-[38px] font-semibold"
            style={{
              borderRadius: 999,
              background: CTA,
              color: '#0b1110',
              border: `1px solid ${CTA}`,
              boxShadow: '0 8px 30px rgba(89,217,179,.35)'
            }}
          >
            <Plus className="w-4 h-4" />
            New Subaccount
          </button>
        </div>

        {/* tabs */}
        <div className="mt-5 flex items-center gap-8 text-sm">
          <button className="relative pb-2 font-medium" style={{ color: TEXT }}>
            Subaccounts
            <span
              className="absolute left-0 right-0 -bottom-[1px] h-[2px] rounded-full"
              style={{ background: `linear-gradient(90deg, transparent, ${CTA}, transparent)` }}
            />
          </button>
          <button className="pb-2" style={{ color: MUTED }}>Legacy View</button>
        </div>

        {/* search */}
        <div className="mt-4 relative">
          <input
            placeholder="Search subaccounts..."
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
      </div>

      {/* cards */}
      <div className="px-6 pb-10 pt-6">
        <div
          className="grid gap-6"
          style={{
            gridTemplateColumns: gridCols,
          }}
        >
          {items.map((it) =>
            it.name === '__CREATE__' ? (
              <CreateCard key="create" onClick={()=>setModalOpen(true)} height={CARD_H} />
            ) : (
              <SubCard key={it.id} item={it} height={CARD_H} />
            )
          )}
        </div>
      </div>

      <CreateModal
        open={modalOpen}
        onClose={()=>setModalOpen(false)}
        onCreate={(name)=>{
          setItems((prev)=> [
            prev[0],
            { id: crypto.randomUUID(), name, agents:0, status:'inactive' },
            ...prev.slice(1),
          ]);
          setModalOpen(false);
        }}
      />

      {/* small responsive tweak so it still wraps nicely under 1200px */}
      <style jsx>{`
        @media (max-width: 1300px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }
        @media (max-width: 860px) {
          div[style*="grid-template-columns"] {
            grid-template-columns: repeat(1, minmax(0, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------ Cards ------------------------------ */

function CreateCard({ onClick, height }:{ onClick:()=>void; height:number }) {
  return (
    <button
      onClick={onClick}
      className="group w-full text-left relative"
      style={{
        borderRadius: RADIUS,
        height,
        padding: 18,
        background: stripedCard(.06, .60),
        border: `1px dashed ${GREEN_LINE}`,
        boxShadow: '0 8px 26px rgba(0,0,0,.38)',
        overflow:'hidden'
      }}
    >
      {/* dashed frame hint */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: RADIUS,
          mask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          WebkitMask: 'linear-gradient(#000,#000) content-box, linear-gradient(#000,#000)',
          background: dashedFrame(),
          padding: 1.5,
          opacity: .45
        }}
      />

      <div className="flex items-center gap-3">
        <div
          className="grid place-items-center"
          style={{
            width: 44, height: 44,
            borderRadius: RADIUS_ICON,
            background: 'rgba(89,217,179,.10)',
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: 'inset 0 0 18px rgba(0,0,0,.28)'
          }}
        >
          <Plus className="w-6 h-6" style={{ color: CTA }} />
        </div>
        <div className="min-w-0">
          <div className="text-[16px] font-semibold" style={{ color: TEXT }}>Create Subaccount</div>
          <div className="text-[12px]" style={{ color: MUTED }}>Add new workspace</div>
        </div>
      </div>

      <div className="mt-3 text-[12px]" style={{ color: MUTED }}>Click to create</div>

      {/* hover glow */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[10px] opacity-0 group-hover:opacity-[.22] transition-opacity"
        style={{ background: CTA, mixBlendMode:'screen' }}
      />
    </button>
  );
}

function SubCard({ item, height }:{ item:Subaccount; height:number }) {
  return (
    <a
      href={`/subaccounts/${item.id}`}
      className="group block relative"
      style={{
        borderRadius: RADIUS,
        height,
        padding: 18,
        background: stripedCard(.045, .58),
        border: `1px solid ${GREEN_LINE}`,
        boxShadow: '0 10px 28px rgba(0,0,0,.40), inset 0 0 0 1px rgba(255,255,255,.02)',
        overflow:'hidden'
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid place-items-center"
          style={{
            width: 44, height: 44,
            borderRadius: RADIUS_ICON,
            background: 'rgba(89,217,179,.10)',
            border: `1px solid ${GREEN_LINE}`,
            boxShadow: 'inset 0 0 18px rgba(0,0,0,.28)'
          }}
        >
          <Bot className="w-6 h-6" style={{ color: CTA }} />
        </div>

        <div className="min-w-0">
          <div className="text-[16px] font-semibold truncate" style={{ color: TEXT }}>{item.name}</div>
          <div className="text-[12px] flex items-center gap-2" style={{ color: MUTED }}>
            {item.agents} AI Agents
            <span className="inline-flex items-center gap-1">
              <span className="w-[6px] h-[6px] rounded-full" style={{ background: item.status==='active' ? CTA : '#94a3b8' }} />
              <span style={{ color: item.status==='active' ? CTA : MUTED }}>
                {item.status.charAt(0).toUpperCase()+item.status.slice(1)}
              </span>
            </span>
          </div>
        </div>

        <ChevronRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-80 transition-opacity" style={{ color: MUTED }} />
      </div>

      {/* hover glow */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-[10px] opacity-0 group-hover:opacity-[.18] transition-opacity"
        style={{ background: CTA, mixBlendMode:'screen' }}
      />
    </a>
  );
}
