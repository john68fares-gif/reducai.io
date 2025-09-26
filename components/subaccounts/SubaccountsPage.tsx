'use client';

import React, { useMemo, useState } from 'react';
import { Plus, Search, X, Bot } from 'lucide-react';
import clsx from 'clsx';

// ——— helpers ———
type Subaccount = {
  id: string;
  name: string;
  active?: boolean;
  agents?: number;
};

const brand = '#10b981';
const panel = 'var(--card, rgba(255,255,255,.03))';
const border = 'var(--border, rgba(255,255,255,.10))';
const weakGreen = 'rgba(16,185,129,.12)';
const greenLine = 'rgba(16,185,129,.25)';

function makeId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function SubaccountsPage() {
  // seed with 1 example (like your screenshot)
  const [subs, setSubs] = useState<Subaccount[]>([
    { id: '68b7f14b2cb8bbab698dd0a1', name: 'Dental Chatbot', active: true, agents: 0 },
  ]);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subs;
    return subs.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  }, [query, subs]);

  const total = subs.length;

  function createSub() {
    const name = (newName || '').trim();
    if (!name) return;
    const id = makeId();
    setSubs(prev => [{ id, name, active: true, agents: 0 }, ...prev]);
    setNewName('');
    setShowCreate(false);
  }

  function openSub(s: Subaccount) {
    // opens detail in a new tab as requested
    window.open(`/subaccounts/${s.id}`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="w-full">
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <div className="text-[12.5px]" style={{ color: 'var(--muted, #9fb4ad)' }}>
            Launch & Deploy
          </div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text, #e6f1ef)' }}>
            Subaccounts
          </h1>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-[10px] px-4 h-10 font-semibold shadow"
            style={{
              background: brand,
              color: '#03120d',
              boxShadow: '0 10px 22px rgba(16,185,129,.28)',
            }}
          >
            New Subaccount
          </button>

          <div
            className="hidden sm:flex items-center justify-center rounded-[10px] px-3 h-10 text-sm"
            style={{ border: `1px solid ${border}`, background: 'transparent', color: 'var(--text,#e6f1ef)' }}
            aria-label="Total Subaccounts"
          >
            {total} <span className="opacity-70 ml-1 text-xs">Total Subaccounts</span>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div
          className="flex items-center gap-2 rounded-[12px] px-3 h-11"
          style={{ background: 'var(--panel, rgba(255,255,255,.02))', border: `1px solid ${border}` }}
        >
          <Search className="w-4 h-4 opacity-70" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search subaccounts..."
            className="w-full bg-transparent outline-none text-sm"
            style={{ color: 'var(--text, #e6f1ef)' }}
          />
        </div>
      </div>

      {/* Grid: ALWAYS rectangles (no aspect-square) */}
      <div
        className={clsx(
          'grid gap-4',
          'grid-cols-1',
          'sm:grid-cols-2',
          'lg:grid-cols-3' // 3 per row on desktop like your ref
        )}
      >
        {/* Create tile */}
        <button
          onClick={() => setShowCreate(true)}
          className="group text-left rounded-[16px] overflow-hidden"
          style={{
            background: panel,
            border: `1px solid ${border}`,
            boxShadow:
              '0 18px 36px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ' +
              'rgba(16,185,129,.18)',
          }}
        >
          <div className="p-5">
            <div className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text,#e6f1ef)' }}>
              Create Subaccount
            </div>

            <div
              className="rounded-[14px] grid place-items-center mb-3"
              style={{
                height: 116, // rectangle height; keeps shape on small screens
                background: 'rgba(255,255,255,.03)',
                border: `1px solid ${border}`,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,.03)',
              }}
            >
              <div
                className="w-12 h-12 rounded-[12px] grid place-items-center transition-transform group-hover:scale-105"
                style={{ background: weakGreen, color: brand, boxShadow: `0 0 0 1px ${greenLine} inset` }}
              >
                <Plus className="w-6 h-6" />
              </div>
            </div>

            <div className="text-xs opacity-80" style={{ color: 'var(--muted,#9fb4ad)' }}>
              Click to create
            </div>
          </div>
        </button>

        {/* Existing subaccounts */}
        {filtered.map((s) => (
          <div
            key={s.id}
            role="button"
            onClick={() => openSub(s)}
            className="rounded-[16px] overflow-hidden cursor-pointer"
            style={{
              background: panel,
              border: `1px solid ${border}`,
              boxShadow:
                '0 18px 36px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ' +
                'rgba(255,255,255,.06)',
            }}
          >
            <div className="p-5">
              <div className="text-[15px] font-semibold mb-3" style={{ color: 'var(--text,#e6f1ef)' }}>
                {s.name}
              </div>

              <div
                className="rounded-[14px] grid place-items-center mb-3"
                style={{
                  height: 116, // rectangle visual (matches create tile)
                  background: 'rgba(255,255,255,.03)',
                  border: `1px solid ${border}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-[12px] grid place-items-center"
                  style={{ background: weakGreen, color: brand, boxShadow: `0 0 0 1px ${greenLine} inset` }}
                >
                  <Bot className="w-6 h-6" />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs" style={{ color: 'var(--muted,#9fb4ad)' }}>
                <div className="truncate max-w-[70%]">
                  <span className="opacity-70 mr-1">ID:</span>
                  <span className="opacity-90">{s.id.slice(0, 10)}…</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="opacity-90">{s.agents ?? 0} AI Agents</span>
                  <span className="inline-flex items-center gap-1">
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ background: s.active ? brand : '#f87171' }}
                    />
                    {s.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create overlay (modal) */}
      {showCreate && (
        <>
          <div
            className="fixed inset-0"
            style={{ background: 'rgba(8,10,12,.70)', zIndex: 60 }}
            onClick={() => setShowCreate(false)}
          />
          <div
            className="fixed left-1/2 top-1/2 w-[92vw] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] overflow-hidden"
            style={{
              zIndex: 61,
              background: 'var(--panel, rgba(15,18,20,.96))',
              border: `1px solid ${border}`,
              boxShadow: '0 28px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(255,255,255,.05) inset',
            }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: `1px solid ${border}` }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-8 h-8 grid place-items-center rounded-[10px]"
                  style={{ background: weakGreen, color: brand, boxShadow: `0 0 0 1px ${greenLine} inset` }}
                >
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-semibold" style={{ color: 'var(--text,#e6f1ef)' }}>
                    Create New Subaccount
                  </div>
                  <div className="text-xs opacity-80" style={{ color: 'var(--muted,#9fb4ad)' }}>
                    Organize your AI agents
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-full p-1.5"
                style={{ border: `1px solid ${border}` }}
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <label className="block text-[12.5px] mb-2" style={{ color: 'var(--text,#e6f1ef)' }}>
                Subaccount Name
              </label>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Enter subaccount name..."
                className="w-full rounded-[10px] px-3 h-11 bg-transparent outline-none text-sm"
                style={{
                  color: 'var(--text,#e6f1ef)',
                  border: `1px solid ${border}`,
                  boxShadow: '0 0 0 1px rgba(255,255,255,.04) inset',
                }}
              />

              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => setShowCreate(false)}
                  className="rounded-[10px] px-4 h-10"
                  style={{ border: `1px solid ${border}`, color: 'var(--text,#e6f1ef)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={createSub}
                  disabled={!newName.trim()}
                  className="rounded-[10px] px-4 h-10 font-semibold disabled:opacity-50"
                  style={{ background: brand, color: '#03120d', boxShadow: '0 10px 22px rgba(16,185,129,.28)' }}
                >
                  Create Subaccount
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
