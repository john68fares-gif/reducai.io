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

/* Look & feel (aligned with api-keys + improve spacing) */
const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

const FRAME: React.CSSProperties = {
  background: 'var(--frame-bg, var(--panel))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--frame-shadow, var(--shadow-soft))',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: 'var(--card-bg, var(--card))',
  border: '1px solid var(--border)',
  boxShadow: 'var(--card-shadow, var(--shadow-card))',
  borderRadius: 20,
};

/* Storage */
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

/* ---------- Modals (theme + buttons exactly like api-keys) ---------- */
function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center px-4 animate-[fadeIn_140ms_ease]"
      style={{ background: 'rgba(0,0,0,0.60)' }}
    >
      <div className="w-full max-w-[740px] rounded-[24px] overflow-hidden animate-[popIn_140ms_ease]" style={FRAME}>
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
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: 'var(--brand-weak)' }}>
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
  const [name, setName] = useState('');
  useEffect(() => { if (open) setName(''); }, [open]);
  if (!open) return null;

  const can = name.trim().length > 1;
  return (
    <ModalShell>
      <ModalHeader icon={<Plus className="w-6 h-6" style={{ color: 'var(--brand)' }} />} title="Create Assistant" onClose={onClose} />
      <div className="px-7 py-6 space-y-5">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Assistant Name <span style={{ color: 'var(--brand)' }}>*</span>
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
          className="w-full h-[46px] rounded-[18px] font-semibold"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={() => can && onCreate(name.trim())}
          className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
      <ModalHeader icon={<Edit3 className="w-6 h-6" style={{ color: 'var(--brand)' }} />} title="Rename Assistant" onClose={onClose} />
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
          className="w-full h-[46px] rounded-[18px] font-semibold"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
        >
          Cancel
        </button>
        <button
          disabled={!can}
          onClick={() => can && onSave(val.trim())}
          className="w-full h-[46px] rounded-[18px] font-semibold flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
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
          className="w-full h-[46px] rounded-[18px] font-semibold"
          style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)' }}
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

/* ---------- List item (sidebar-style) ---------- */
function AssistantItem({
  a, active, onClick, onRename, onDelete,
}: {
  a: AssistantLite;
  active: boolean;
  onClick: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const bg = active ? 'rgba(16,185,129,.14)' : 'var(--sb-icon-bg, rgba(0,0,0,.06))';
  const border = active ? 'rgba(16,185,129,.45)' : 'var(--sb-icon-border, rgba(0,0,0,.12))';
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
          <div className="text-[13px] font-semibold truncate" style={{ color: 'var(--sidebar-text, var(--text))' }}>{a.name}</div>
          <div className="text-[11px] truncate" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>{a.purpose || '—'}</div>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            className="px-2 h-[28px] rounded-[8px] border"
            style={{ background: 'var(--rail-chip-bg)', borderColor: 'var(--rail-chip-border)' }}
            onClick={(e) => { e.stopPropagation(); onRename(); }}
            aria-label="Rename"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            className="px-2 h-[28px] rounded-[8px] border"
            style={{ background: 'var(--rail-chip-bg)', borderColor: 'var(--rail-chip-border)' }}
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

/* ---------- Main ---------- */
export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState('');
  const [q, setQ] = useState('');

  // Modals
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
      className="assistant-rail h-full"
      style={{ background: 'var(--sidebar-bg)', borderRight: '1px solid var(--sidebar-border)', color: 'var(--sidebar-text)' }}
    >
      {/* Sticky section label (like improve spacing) */}
      <div className="sticky top-0 z-10 px-3 pt-3 pb-2 backdrop-blur"
           style={{ background: 'color-mix(in oklab, var(--sidebar-bg) 92%, transparent)', boxShadow: '0 1px 0 var(--sidebar-border)' }}>
        <div className="text-[11px] font-semibold tracking-[.12em]" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>
          ASSISTANTS
        </div>
      </div>

      {/* Band: Actions (green CTA) */}
      <div className="px-3">
        <div className="rounded-[16px] p-3 mb-3" style={{ background: 'var(--rail-band-bg)', border: '1px solid var(--rail-band-border)', boxShadow: 'var(--rail-band-shadow)' }}>
          <button
            type="button"
            className="w-full inline-flex items-center justify-center gap-2 rounded-[18px] font-semibold"
            style={{ height: 46, background: BTN_GREEN, color: '#fff' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="w-4 h-4" /> Create Assistant
          </button>
        </div>
      </div>

      {/* Band: Search (white in light mode, themed in dark) */}
      <div className="px-3">
        <div className="rounded-[16px] p-3 mb-3" style={{ background: 'var(--rail-band-bg)', border: '1px solid var(--rail-band-border)', boxShadow: 'var(--rail-band-shadow)' }}>
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" style={{ color: 'var(--rail-input-muted)' }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search assistants"
              className="flex-1 h-[36px] rounded-[10px] px-3 text-sm outline-none border"
              style={{
                background: 'var(--rail-input-bg)',
                borderColor: 'var(--rail-input-border)',
                color: 'var(--rail-input-text)',
                boxShadow: 'var(--rail-input-shadow, none)',
              }}
            />
            {q && (
              <button
                onClick={() => setQ('')}
                className="px-2 h-[36px] rounded-[10px] border"
                style={{ background: 'var(--rail-input-bg)', borderColor: 'var(--rail-input-border)' }}
                aria-label="Clear search"
              >
                <X className="w-4 h-4" style={{ color: 'var(--rail-input-muted)' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* List section with comfy spacing like improve */}
      <div className="px-3 pb-4">
        <div className="rounded-[16px] p-3"
             style={{ background: 'var(--rail-list-bg)', border: '1px solid var(--rail-list-border)', boxShadow: 'var(--rail-list-shadow)', maxHeight: 'calc(100vh - 210px)', overflow: 'auto' }}>
          <div className="text-[11px] font-semibold mb-2" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>
            ALL
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
              <div className="text-xs py-8 text-center" style={{ color: 'var(--sidebar-muted, var(--text-muted))' }}>
                No assistants found.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={addAssistant} />
      <RenameModal open={!!renId} initial={renName} onClose={() => setRenId(null)} onSave={saveRename} />
      <ConfirmDelete open={!!delId} name={delName} onClose={() => setDelId(null)} onConfirm={confirmDelete} />

      {/* Theme tokens to match light/dark & spacing like improve.tsx */}
      <style jsx>{`
        :global(:root:not([data-theme="dark"])) .assistant-rail {
          /* Inputs: crisp light */
          --rail-input-bg: #ffffff;
          --rail-input-border: rgba(0, 0, 0, 0.12);
          --rail-input-text: #0f172a;
          --rail-input-muted: #64748b;
          --rail-input-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);

          /* Bands and list surfaces (light) */
          --rail-band-bg: #ffffff;
          --rail-band-border: rgba(0, 0, 0, 0.08);
          --rail-band-shadow: 0 2px 12px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.5);

          --rail-list-bg: #ffffff;
          --rail-list-border: rgba(0, 0, 0, 0.08);
          --rail-list-shadow: 0 3px 14px rgba(0, 0, 0, 0.08);

          --rail-chip-bg: #ffffff;
          --rail-chip-border: rgba(0, 0, 0, 0.12);
        }

        :global([data-theme="dark"]) .assistant-rail {
          /* Inputs: match your card/border tokens */
          --rail-input-bg: var(--card);
          --rail-input-border: var(--border);
          --rail-input-text: var(--text);
          --rail-input-muted: var(--text-muted);
          --rail-input-shadow: none;

          /* Bands and list surfaces (dark) — echo improve.tsx softness */
          --rail-band-bg: color-mix(in oklab, var(--panel) 96%, transparent);
          --rail-band-border: color-mix(in oklab, var(--border) 92%, transparent);
          --rail-band-shadow: 0 6px 30px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.04);

          --rail-list-bg: color-mix(in oklab, var(--card) 96%, transparent);
          --rail-list-border: color-mix(in oklab, var(--border) 92%, transparent);
          --rail-list-shadow: 0 3px 16px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.04);

          --rail-chip-bg: var(--card);
          --rail-chip-border: var(--border);
        }

        .assistant-rail input::placeholder { color: var(--rail-input-muted); opacity: 0.9; }
      `}</style>
    </div>
  );
}
