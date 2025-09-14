// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';

/* Optional scoped storage */
type Scoped = { getJSON<T>(k: string, f: T): Promise<T>; setJSON(k: string, v: unknown): Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  scopedStorageFn = require('@/utils/scoped-storage').scopedStorage;
} catch {}

export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };
const STORAGE_KEY = 'agents';
const BRAND = '#10b981';
const BRAND_DEEP = '#12a989';
const BRAND_WEAK = 'rgba(0,255,194,.10)';

async function loadAssistants(): Promise<AssistantLite[]> {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      const a = await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []);
      return Array.isArray(a) ? a : [];
    }
  } catch {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      await ss.setJSON(STORAGE_KEY, list);
    }
  } catch {}
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

/* ---------- Assistant Item (sidebar style) ---------- */
function AssistantItem({
  a,
  active,
  onClick,
  onRename,
  onDelete,
}: {
  a: AssistantLite;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const bg = active ? 'rgba(16,185,129,.14)' : 'var(--sb-icon-bg)';
  const border = active ? 'rgba(16,185,129,.45)' : 'var(--sb-icon-border)';
  const halo = active
    ? `0 0 0 1px ${BRAND_WEAK}, 0 8px 18px rgba(0,0,0,.22), 0 0 18px rgba(16,185,129,.25)`
    : 'inset 0 0 10px rgba(0,0,0,.16)';

  return (
    <div className="group">
      <div
        className="flex items-center h-10 rounded-[12px] pr-2 cursor-pointer"
        onClick={onClick}
        style={{
          transition: 'gap 300ms cubic-bezier(0.16,1,0.3,1), padding 300ms cubic-bezier(0.16,1,0.3,1)',
          paddingLeft: 10,
          gap: 10,
        }}
      >
        <div
          className="w-10 h-10 rounded-[12px] grid place-items-center"
          style={{
            background: bg,
            border: `1px solid ${border}`,
            boxShadow: halo,
            color: BRAND_DEEP,
          }}
        >
          <Bot className="w-[18px] h-[18px]" strokeWidth={2} />
        </div>

        <div className="overflow-hidden flex-1">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--sidebar-text)' }}>
            {a.name}
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted)' }}>
            {a.purpose || '—'}
          </div>
        </div>

        {/* Actions on hover */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="px-2 h-[28px] rounded-[8px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            className="px-2 h-[28px] rounded-[8px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="h-[2px] rounded-full"
        style={{
          marginLeft: 12,
          marginRight: 12,
          background: active
            ? 'linear-gradient(90deg, transparent, rgba(16,185,129,.35), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(16,185,129,.0), transparent)',
        }}
      />
    </div>
  );
}

/* ---------- Main ---------- */
export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const list = await loadAssistants();
      setAssistants(list);
      if (list[0]) setActiveId(list[0].id);
    })();
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? assistants : assistants.filter((a) => a.name.toLowerCase().includes(s) || (a.purpose || '').toLowerCase().includes(s));
  }, [assistants, q]);

  function addAssistant(name: string) {
    const a: AssistantLite = {
      id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      name,
      createdAt: Date.now(),
      purpose: '',
    };
    const next = [a, ...assistants];
    setAssistants(next);
    setActiveId(a.id);
    saveAssistants(next);
  }

  return (
    <div
      className="px-3 py-4 h-full"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        color: 'var(--sidebar-text)',
      }}
    >
      {/* Section label */}
      <div className="text-[11px] font-semibold tracking-[.12em] mb-2" style={{ color: 'var(--sidebar-muted)' }}>
        ASSISTANTS
      </div>

      {/* Create button */}
      <button
        type="button"
        className="mb-3 inline-flex items-center gap-2 select-none w-full justify-center"
        style={{
          height: 34,
          borderRadius: 10,
          background: BRAND,
          color: '#fff',
          border: `1px solid ${BRAND}`,
          boxShadow: '0 10px 24px rgba(16,185,129,.22)',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
        }}
        onClick={() => {
          const name = prompt('Assistant name?');
          if (name) addAssistant(name);
        }}
      >
        <Plus className="w-4 h-4" /> Create Assistant
      </button>

      {/* Search */}
      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4" style={{ color: 'var(--sidebar-muted)' }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search assistants"
          className="flex-1 h-[34px] rounded-[10px] px-3 text-sm outline-none"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="px-2 h-[34px] rounded-[10px]"
            style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      {/* Assistants list */}
      <div className="space-y-[6px]">
        <AnimatePresence initial={false}>
          {filtered.map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AssistantItem
                a={a}
                active={a.id === activeId}
                onClick={() => setActiveId(a.id)}
                onRename={() => alert('Rename')}
                onDelete={() => alert('Delete')}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-xs" style={{ color: 'var(--sidebar-muted)' }}>
            No assistants found.
          </div>
        )}
      </div>
    </div>
  );
}
