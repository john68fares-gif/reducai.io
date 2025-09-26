// FILE: components/subaccounts/SubaccountsPage.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import CreateSubaccountModal from './CreateSubaccountModal';
import SubaccountGrid from './SubaccountGrid';

/** Brand tokens (match VA/Sidebar) */
const CTA       = '#59d9b3';
const CTA_WEAK  = 'rgba(89,217,179,.12)';
const CTA_LINE  = 'rgba(89,217,179,.20)';

export type Subaccount = {
  id: string;
  name: string;
  status: 'Active' | 'Paused';
  agents: number;
  createdAt: number;
};

function uid() {
  const r = Math.random().toString(36).slice(2, 6);
  return `${Date.now().toString(36)}${r}`;
}

export default function SubaccountsPage() {
  const [items, setItems] = useState<Subaccount[]>([]);
  const [q, setQ] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  /** hydrate (swap with your API later) */
  useEffect(() => {
    // Seed a sample to show the look; remove when wiring API.
    setItems(prev => prev.length ? prev : [{
      id: '68b7f14b2cb8bbab698dd0a1',
      name: 'Dental Chatbot',
      status: 'Active',
      agents: 0,
      createdAt: Date.now() - 86400000
    }]);
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return items;
    return items.filter(x =>
      [x.name, x.id].join(' ').toLowerCase().includes(s)
    );
  }, [items, q]);

  function handleCreate(name: string) {
    const id = uid();
    const next: Subaccount = { id, name, status: 'Active', agents: 0, createdAt: Date.now() };
    setItems(curr => [next, ...curr]);
    setCreateOpen(false);
    // Optional: scroll to new card
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-sub-id="${id}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  /** open subaccount dashboard in a new tab */
  function openSubTab(id: string) {
    const url = `/subaccounts/${id}`; // <-- replace to your route if different
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  return (
    <section className="subaccounts-page">
      {/* Header */}
      <div className="sa-head">
        <div className="sa-title">Launch &amp; Deploy</div>
        <div className="sa-ctl">
          <div className="sa-search">
            <Search className="w-4 h-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subaccounts…"
            />
          </div>
          <button className="sa-new" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" />
            New Subaccount
          </button>
        </div>
      </div>

      {/* Grid (3 per row desktop, 2 on md, 1 on small) */}
      <SubaccountGrid
        items={filtered}
        onCreateClick={() => setCreateOpen(true)}
        onOpen={(id) => openSubTab(id)}
      />

      {/* Modal */}
      <CreateSubaccountModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      {/* Styles */}
      <style jsx>{`
        .subaccounts-page{
          --panel: var(--panel-bg, #0d0f11);
          --text: var(--text, #e6f1ef);
          --muted: var(--text-muted, #9fb4ad);
          --border: var(--border-weak, rgba(255,255,255,.10));
        }
        :root:not([data-theme="dark"]) .subaccounts-page{
          --panel:#ffffff; --text:#0b1620; --muted:#50606a; --border:rgba(0,0,0,.10);
        }

        .sa-head{
          display:flex; align-items:center; justify-content:space-between;
          gap:12px; padding:14px 6px 18px;
        }
        .sa-title{
          font-size:20px; font-weight:700; letter-spacing:.2px; color:var(--text);
          text-shadow:0 1px 0 rgba(0,0,0,.12);
        }
        .sa-ctl{ display:flex; align-items:center; gap:10px; }

        .sa-search{
          position:relative; display:flex; align-items:center; gap:8px;
          background:var(--panel); border:1px solid ${CTA_LINE}; border-radius:10px;
          height:38px; padding:0 10px; min-width:280px;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        }
        .sa-search :global(svg){ color:var(--muted); }
        .sa-search input{
          background:transparent; border:none; outline:none; color:var(--text);
          width:220px; font-size:14px;
        }

        .sa-new{
          height:38px; padding:0 12px; display:inline-flex; align-items:center; gap:8px;
          border-radius:10px; border:1px solid ${CTA_LINE};
          background:${CTA}; color:#031613; font-weight:700;
          box-shadow:0 10px 22px rgba(89,217,179,.28), 0 0 0 1px rgba(255,255,255,.06) inset;
          transition: transform .16s ease;
        }
        .sa-new:hover{ transform: translateY(-1px); }
        .sa-new :global(svg){ color:#05221c; }
        @media (max-width: 640px){
          .sa-head{ flex-direction:column; align-items:stretch; }
          .sa-ctl{ justify-content:space-between; }
          .sa-search{ flex:1; min-width:0; }
          .sa-search input{ width:100%; }
        }
      `}</style>
    </section>
  );
}
