// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, Bot, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

/* Optional scoped storage (safe if missing) */
type Scoped = { getJSON<T>(k: string, f: T): Promise<T>; setJSON(k: string, v: unknown): Promise<void> };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  scopedStorageFn = require('@/utils/scoped-storage').scopedStorage;
} catch {}

export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number };

/* ------------------------------- Look & feel -------------------------------- */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

const FRAME: React.CSSProperties = {
  background: 'var(--panel)',          // uses your theme tokens
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 24,
};
const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 14,
};

/* ------------------------------- Storage helpers ---------------------------- */
const STORAGE_KEY = 'agents';
async function loadAssistants(): Promise<AssistantLite[]> {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      const a = await ss.getJSON<AssistantLite[]>(STORAGE_KEY, []);
      return Array.isArray(a) ? a : [];
    }
  } catch {}
  try { const raw = localStorage.getItem(STORAGE_KEY); if (raw) return JSON.parse(raw); } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(STORAGE_KEY, list); } } catch {}
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); } catch {}
}

/* --------------------------------- Modals ----------------------------------- */
function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center px-4 animate-[fadeIn_140ms_ease]"
         style={{ background: 'rgba(0,0,0,0.60)' }}>
      <div className="w-full max-w-[620px] overflow-hidden" style={FRAME}>
        {children}
      </div>
    </div>
  );
}

function ModalHeader({
  icon, title, subtitle, onClose,
}: { icon: React.ReactNode; title: string; subtitle?: string; onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-7 py-6" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
             style={{ background: 'var(--brand-weak)' }}>
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>{title}</div>
          {subtitle && <div className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>}
        </div>
      </div>
      <button onClick={onClose} className="p-2 rounded-full hover:opacity-70" aria-label="Close">
        <X className="w-5 h-5" style={{ color: 'var(--text)' }} />
      </button>
    </div>
  );
}

function CreateModal({
  open, onClose, onCreate,
}: { open: boolean; onClose: () => void; onCreate: (name: string) => void }) {
  const [val, setVal] = useState('');
  useEffect(() => { if (open) setVal(''); }, [open]);
  if (!open) return null;

  const can = val.trim().length > 1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-6 h-6" style={{ color: 'var(--brand)' }} />}
                   title="Create Assistant" onClose={onClose} />
      <div className="px-7 py-6 space-y-5">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Assistant Name <span style={{ color: 'var(--brand)' }}>*</span>
          </label>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            placeholder="e.g., Sales Bot"
            className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            autoFocus
          />
        </div>
      </div>

      <div className="px-7 pb-7 flex gap-3">
        <button
          onClick={onClose}
          className="w-full h-[46px] rounded-[18px] font-semibold border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={() => can && onCreate(val.trim())}
          className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: BTN_GREEN, color: '#fff' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
        >
          <Plus className="w-4 h-4" /> Create
        </button>
      </div>
    </ModalShell>
  );
}

function RenameModal({
  open, initial, onClose, onSave,
}: { open: boolean; initial: string; onClose: () => void; onSave: (v: string) => void }) {
  const [val, setVal] = useState(initial);
  useEffect(() => { if (open) setVal(initial); }, [open, initial]);
  if (!open) return null;

  const can = val.trim().length > 1;
  return (
    <ModalShell>
      <ModalHeader icon={<Edit3 className="w-6 h-6" style={{ color: 'var(--brand)' }} />}
                   title="Rename Assistant" onClose={onClose} />
      <div className="px-7 py-6 space-y-5">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Name</label>
          <input
            value={val}
            onChange={(e) => setVal(e.target.value)}
            className="w-full rounded-[14px] border px-4 h-[46px] text-sm outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
            autoFocus
          />
        </div>
      </div>

      <div className="px-7 pb-7 flex gap-3">
        <button
          onClick={onClose}
          className="w-full h-[46px] rounded-[18px] font-semibold border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={() => can && onSave(val.trim())}
          className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: BTN_GREEN, color: '#fff' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
        >
          Save
        </button>
      </div>
    </ModalShell>
  );
}

function ConfirmDelete({
  open, name, onClose, onConfirm,
}: { open: boolean; name?: string; onClose: () => void; onConfirm: () => void }) {
  if (!open) return null;
  return (
    <ModalShell>
      <ModalHeader
        icon={<AlertTriangle className="w-6 h-6" style={{ color: 'var(--brand)' }} />}
        title="Delete Assistant"
        subtitle="This action cannot be undone."
        onClose={onClose}
      />
      <div className="px-7 py-6 text-sm" style={{ color: 'var(--text)' }}>
        Are you sure you want to delete <b>“{name || 'assistant'}”</b>?
      </div>

      <div className="px-7 pb-7 flex gap-3">
        <button
          onClick={onClose}
          className="w-full h-[46px] rounded-[18px] font-semibold border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2"
          style={{ background: BTN_GREEN, color: '#fff' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
          onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
        >
          Delete
        </button>
      </div>
    </ModalShell>
  );
}

/* -------------------------- Sidebar-style list item ------------------------- */
function AssistantItem({
  a, active, onClick, onRename, onDelete,
}: {
  a: AssistantLite;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const bg = active ? 'rgba(16,185,129,.14)' : 'var(--sb-icon-bg, rgba(255,255,255,.06))';
  const border = active ? 'rgba(16,185,129,.45)' : 'var(--sb-icon-border, rgba(255,255,255,.12))';
  const halo = active
    ? `0 0 0 1px rgba(0,255,194,.10), 0 8px 18px rgba(0,0,0,.22), 0 0 18px rgba(16,185,129,.25)`
    : 'inset 0 0 10px rgba(0,0,0,.16)';

  return (
    <div className="group">
      <div
        className="flex items-center h-10 rounded-[12px] pr-2 cursor-pointer"
        onClick={onClick}
        style={{ paddingLeft: 10, gap: 10, transition: 'gap 300ms cubic-bezier(0.16,1,0.3,1), padding 300ms cubic-bezier(0.16,1,0.3,1)' }}
      >
        <div
          className="w-10 h-10 rounded-[12px] grid place-items-center"
          style={{ background: bg, border: `1px solid ${border}`, boxShadow: halo, color: 'var(--brand)' }}
        >
          <Bot className="w-[18px] h-[18px]" strokeWidth={2} />
        </div>

        <div className="overflow-hidden flex-1">
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--sidebar-text, var(--text))' }}>
            {a.name}
          </div>
          <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>
            {a.purpose || '—'}
          </div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="px-2 h-[28px] rounded-[8px] border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            aria-label="Rename"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            className="px-2 h-[28px] rounded-[8px] border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        className="h-[2px] rounded-full"
        style={{
          marginLeft: 12, marginRight: 12,
          background: active
            ? 'linear-gradient(90deg, transparent, rgba(16,185,129,.35), transparent)'
            : 'linear-gradient(90deg, transparent, rgba(16,185,129,.0), transparent)',
        }}
      />
    </div>
  );
}

/* ----------------------------------- Main ----------------------------------- */
export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState('');
  const [q, setQ] = useState('');

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [renId, setRenId] = useState<string | null>(null);
  const [delId, setDelId] = useState<string | null>(null);

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
    const a: AssistantLite = { id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name, createdAt: Date.now(), purpose: '' };
    const next = [a, ...assistants];
    setAssistants(next);
    setActiveId(a.id);
    saveAssistants(next);
    setCreateOpen(false);
  }
  function saveRename(name: string) {
    const next = assistants.map((x) => (x.id === renId ? { ...x, name } : x));
    setAssistants(next);
    saveAssistants(next);
    setRenId(null);
  }
  function confirmDelete() {
    const next = assistants.filter((x) => x.id !== delId);
    setAssistants(next);
    saveAssistants(next);
    if (activeId === delId) setActiveId(next[0]?.id || '');
    setDelId(null);
  }

  const renName = assistants.find((a) => a.id === renId)?.name || '';
  const delName = assistants.find((a) => a.id === delId)?.name;

  return (
    <div
      className="px-3 py-4 h-full"
      style={{
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        color: 'var(--sidebar-text)',
      }}
    >
      <div className="text-[11px] font-semibold tracking-[.12em] mb-2" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>
        ASSISTANTS
      </div>

      <button
        type="button"
        className="mb-3 inline-flex items-center gap-2 select-none w-full justify-center border rounded-[14px] hover:translate-y-[-1px] transition"
        style={{
          height: 40,
          background: 'color-mix(in oklab, var(--brand) 8%, var(--card))',
          color: 'var(--text)',
          borderColor: 'color-mix(in oklab, var(--brand) 35%, var(--border))',
          boxShadow: 'var(--shadow-card)',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
        }}
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="w-4 h-4" /> Create Assistant
      </button>

      <div className="flex items-center gap-2 mb-4">
        <Search className="w-4 h-4" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search assistants"
          className="flex-1 h-[34px] rounded-[10px] px-3 text-sm outline-none border"
          style={{ background: 'var(--card)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        {q && (
          <button
            onClick={() => setQ('')}
            className="px-2 h-[34px] rounded-[10px] border"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
            aria-label="Clear"
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </button>
        )}
      </div>

      <div className="space-y-[6px]">
        <AnimatePresence initial={false}>
          {filtered.map((a) => (
            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <AssistantItem
                a={a}
                active={a.id === activeId}
                onClick={() => setActiveId(a.id)}
                onRename={() => setRenId(a.id)}
                onDelete={() => setDelId(a.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-xs" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>
            No assistants found.
          </div>
        )}
      </div>

      {/* Modals cloned from api-keys look & feel */}
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addAssistant} />
      <RenameModal open={!!renId} initial={renName} onClose={() => setRenId(null)} onSave={saveRename} />
      <ConfirmDelete open={!!delId} name={delName} onClose={() => setDelId(null)} onConfirm={confirmDelete} />
    </div>
  );
}
