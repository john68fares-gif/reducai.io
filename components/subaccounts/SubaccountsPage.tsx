// FILE: components/subaccounts/SubaccountsPage.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Bot } from 'lucide-react';

type Row = { id: string; title: string; agents: number; active: boolean; logoUrl?: string };

const CTA       = '#59d9b3';
const CTA_HOVER = '#54cfa9';
const CTA_LINE  = 'rgba(89,217,179,.20)';

export default function SubaccountsPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');

  // Fetch existing subs
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const r = await fetch('/api/subaccounts').catch(()=>null as any);
        const j = r?.ok ? await r.json() : [];
        if (!alive) return;
        const rows: Row[] = (Array.isArray(j) ? j : (j?.items || []))
          .map((x:any) => ({
            id: String(x?.id || ''),
            title: String(x?.name || 'Untitled'),
            agents: Number(x?.agents ?? 0),
            active: Boolean(x?.active ?? true),
            logoUrl: String(x?.logoUrl || '')
          }));
        setItems(rows);
      } finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(i => i.title.toLowerCase().includes(needle) || i.id.toLowerCase().includes(needle));
  }, [items, q]);

  async function createSub() {
    const n = name.trim();
    if (!n) return;
    // optimistic card; if you have an API endpoint, call it here
    const newRow: Row = {
      id: Math.random().toString(36).slice(2, 10),
      title: n,
      agents: 0,
      active: true
    };
    setItems(prev => [newRow, ...prev]);
    setShowCreate(false);
    setName('');
  }

  return (
    <section className="px-4 md:px-6 lg:px-8 py-6" style={{ color:'var(--text)' }}>
      <Header
        q={q}
        onQ={setQ}
        onCreate={()=>setShowCreate(true)}
      />

      <CardsGrid
        items={filtered}
        loading={loading}
        onCreate={()=>setShowCreate(true)}
        onOpen={(id)=>window.open(`/subaccounts/${encodeURIComponent(id)}`, '_blank', 'noreferrer')}
      />

      {/* Create modal (self-contained) */}
      <Modal open={showCreate} onClose={()=>setShowCreate(false)}>
        <div className="text-lg font-semibold mb-1">Create New Subaccount</div>
        <div className="text-sm mb-4" style={{ color:'var(--text-muted)' }}>
          Organize your AI agents by workspace.
        </div>
        <label className="text-xs mb-1 block" style={{ color:'var(--text-muted)' }}>Subaccount Name</label>
        <input
          value={name}
          onChange={(e)=>setName(e.target.value)}
          autoFocus
          placeholder="Enter subaccount name…"
          className="w-full rounded-[8px] px-3 mb-3 bg-transparent outline-none"
          style={{ height:40, border:'1px solid var(--border-weak)', background:'var(--panel-bg)' }}
        />
        <div className="flex justify-end gap-2">
          <button
            className="rounded-[8px] px-3"
            style={{ height:38, border:'1px solid var(--border-weak)', background:'var(--panel-bg)' }}
            onClick={()=>setShowCreate(false)}
          >
            Cancel
          </button>
          <button
            className="rounded-[8px] px-3 font-semibold"
            style={{ height:38, background:CTA, color:'#0a0f0d', boxShadow:'0 10px 22px rgba(89,217,179,.28)' }}
            onClick={createSub}
          >
            Create Subaccount
          </button>
        </div>
      </Modal>
    </section>
  );
}

/* ---------- Header ---------- */
function Header({ q, onQ, onCreate }:{ q:string; onQ:(v:string)=>void; onCreate:()=>void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-5">
      <h1 className="text-xl md:text-2xl font-semibold mr-auto">Launch &amp; Deploy</h1>

      <div className="relative">
        <input
          value={q}
          onChange={(e)=>onQ(e.target.value)}
          placeholder="Search subaccounts…"
          className="rounded-[8px] pl-9 pr-3"
          style={{ height:40, minWidth:260, background:'var(--panel-bg)', border:'1px solid var(--border-weak)' }}
        />
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color:'var(--text-muted)' }}/>
      </div>

      <button
        onClick={onCreate}
        className="inline-flex items-center gap-2 rounded-[8px] font-semibold"
        style={{ height:40, padding:'0 14px', background:CTA, color:'#0c1110', boxShadow:'0 10px 22px rgba(89,217,179,.28)' }}
        onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
        onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = CTA)}
      >
        <Plus className="w-4 h-4" /> New Subaccount
      </button>
    </div>
  );
}

/* ---------- Grid + Card ---------- */
function CardsGrid({
  items, loading, onCreate, onOpen
}:{ items:Row[]; loading:boolean; onCreate:()=>void; onOpen:(id:string)=>void }) {
  return (
    <>
      {/* 3 per row on desktop; squares on small screens */}
      <div
        className="grid gap-4"
        style={{
          gridTemplateColumns: 'repeat(1, minmax(0, 1fr))'
        }}
      >
        <style jsx>{`
          @media (min-width: 760px){
            div[data-grid]{
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 16px;
            }
          }
        `}</style>

        <div data-grid className="grid gap-4">
          {/* Create tile */}
          <Card onClick={onCreate} create />

          {loading && <SkeletonCards />}
          {!loading && items.map(item => (
            <Card key={item.id} data={item} onClick={()=>onOpen(item.id)} />
          ))}
        </div>
      </div>
    </>
  );
}

function Card({ create, data, onClick }:{
  create?: boolean;
  data?: Row;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group rounded-[12px] text-left relative overflow-hidden"
      style={{
        border:'1px solid var(--border-weak)',
        background:'var(--panel-bg)',
        boxShadow:'0 20px 40px rgba(0,0,0,.18), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px '+CTA_LINE,
        padding:16,
        minHeight:170,                // rectangle on desktop
        aspectRatio:'1 / 1',          // becomes square when grid shrinks
      }}
    >
      {/* soft vignette */}
      <span className="absolute inset-0 pointer-events-none"
            style={{ background:'radial-gradient(120% 80% at 50% 20%, rgba(89,217,179,.10), transparent 60%)' }} />

      {/* Title */}
      <div className="relative z-10">
        <div className="text-sm font-semibold mb-3">
          {create ? 'Create Subaccount' : (data?.title || 'Untitled')}
        </div>

        <div
          className="rounded-[12px] grid place-items-center mb-3"
          style={{
            height:96,
            background:'rgba(255,255,255,.04)',
            border:'1px solid var(--border-weak)',
            boxShadow:'inset 0 0 0 1px rgba(0,0,0,.04)'
          }}
        >
          {create
            ? <Plus className="w-7 h-7" style={{ color:CTA }} />
            : <Bot   className="w-7 h-7" style={{ color:CTA }} />
          }
        </div>

        {/* Meta */}
        {!create ? (
          <div className="text-xs flex items-center gap-3" style={{ color:'var(--text-muted)' }}>
            <span>{data?.agents || 0} AI Agents</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: data?.active ? '#22c55e' : '#ef4444' }} />
              {data?.active ? 'Active' : 'Paused'}
            </span>
          </div>
        ) : (
          <div className="text-xs" style={{ color:'var(--text-muted)' }}>Click to create</div>
        )}
      </div>

      {/* glow on hover */}
      <span className="absolute inset-0 rounded-[12px] opacity-0 group-hover:opacity-10"
            style={{ background:CTA, transition:'opacity .18s var(--ease)' }} />
    </button>
  );
}

function SkeletonCards() {
  return (
    <>
      {[0,1,2].map(i=>(
        <div key={i} className="rounded-[12px]" style={{ border:'1px solid var(--border-weak)', background:'var(--panel-bg)', minHeight:170 }} />
      ))}
    </>
  );
}

/* ---------- Modal (simple, no external deps) ---------- */
function Modal({ open, onClose, children }:{
  open: boolean; onClose: ()=>void; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9996, background:'rgba(8,10,12,.78)' }}
        onClick={onClose}
      />
      <div
        className="fixed left-1/2 top-1/2 rounded-[12px] p-4 w-[90vw] max-w-[520px]"
        style={{
          zIndex: 9997,
          transform:'translate(-50%,-50%)',
          background:'var(--panel-bg)',
          border:'1px solid var(--border-weak)',
          boxShadow:'0 30px 60px rgba(0,0,0,.30), 0 0 0 1px rgba(255,255,255,.06) inset'
        }}
        onClick={(e)=>e.stopPropagation()}
      >
        {children}
      </div>
    </>
  );
}
