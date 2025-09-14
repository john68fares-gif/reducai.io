// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Bot, Folder, FolderOpen, Trash2, Edit3, X, AlertTriangle } from 'lucide-react';

/* ========== Scoped storage (safe optional) ========== */
type Scoped = { getJSON<T>(k: string, f: T): Promise<T>; setJSON(k: string, v: unknown): Promise<void>; };
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try { scopedStorageFn = require('@/utils/scoped-storage').scopedStorage; } catch {}

/* ========== Types ========== */
export type AssistantLite = { id: string; name: string; purpose?: string; createdAt?: number; };
const KEYS = { list: 'agents', local: 'agents' };

/* ========== Theme + styles ========== */
function LocalTokens() {
  return (
    <style>{`
      .rail { width: 312px; color: var(--text); }
      .panel {
        background: var(--panel); border: 1px solid var(--border);
        border-radius: 18px; box-shadow: var(--shadow-soft);
      }
      .card {
        background: var(--card); border: 1px solid var(--border);
        border-radius: 12px; box-shadow: var(--shadow-card);
      }

      .input {
        height: 34px; border-radius: 12px; padding: 0 .7rem;
        background: var(--card); border: 1px solid var(--border); color: var(--text);
        font-size: 13px; outline: none; transition: box-shadow .16s ease, border-color .16s ease;
      }
      .input:focus {
        border-color: color-mix(in oklab, var(--brand) 40%, var(--border));
        box-shadow: 0 0 0 2px color-mix(in oklab, var(--brand) 18%, transparent);
      }

      .btn {
        height: 32px; padding: 0 .7rem; border-radius: 10px;
        display: inline-flex; align-items: center; gap: .4rem;
        background: var(--card); color: var(--text); border: 1px solid var(--border);
        font-size: 13px; font-weight: 500; transition: transform .06s ease;
      }
      .btn:hover { transform: translateY(-1px); }
      .btn-create {
        background: var(--panel); border: 1px solid var(--border);
        color: #fff; font-weight: 600;
      }

      .item {
        display: flex; align-items: center; gap: 10px;
        padding: 9px 11px; border-radius: 10px;
        background: var(--card); border: 1px solid var(--border);
        transition: box-shadow .18s ease, transform .12s ease;
      }
      .item:hover {
        transform: translateY(-1px);
        box-shadow: 0 10px 20px rgba(0,0,0,.16);
      }
      .item.active {
        border-color: color-mix(in oklab, var(--brand) 40%, var(--border));
        box-shadow: 0 0 0 2px color-mix(in oklab, var(--brand) 25%, transparent);
      }

      .muted { color: var(--text-muted); }
      .icon { width: 14px; height: 14px; }
    `}</style>
  );
}

/* ========== Storage ========== */
async function loadAssistants(): Promise<AssistantLite[]> {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      return await ss.getJSON(KEYS.list, []);
    }
  } catch {}
  try {
    const raw = localStorage.getItem(KEYS.local);
    return raw ? JSON.parse(raw) : [];
  } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try { if (scopedStorageFn) { const ss = await scopedStorageFn(); await ss.setJSON(KEYS.list, list); } } catch {}
  try { localStorage.setItem(KEYS.local, JSON.stringify(list)); } catch {}
}

/* ========== ConfirmDelete modal ========== */
function ConfirmDelete({ name, onCancel, onConfirm }: { name: string; onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-4">
      <div className="panel w-full max-w-sm p-6">
        <div className="flex gap-3">
          <AlertTriangle className="w-5 h-5" style={{ color: 'salmon' }} />
          <div className="min-w-0">
            <div className="font-semibold">Delete assistant?</div>
            <div className="text-sm muted">You’re about to remove <span style={{ color: 'var(--text)' }}>{name}</span>.</div>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'rgba(255,120,120,.12)', borderColor: 'rgba(255,120,120,.35)', color: 'rgba(255,160,160,.95)' }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ========== Main ========== */
export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState('');
  const [q, setQ] = useState('');
  const [confirming, setConfirming] = useState<AssistantLite | null>(null);

  useEffect(() => { loadAssistants().then(setAssistants); }, []);
  const filtered = useMemo(() => assistants.filter(a => a.name.toLowerCase().includes(q.toLowerCase())), [assistants, q]);

  const doDelete = async (id: string) => {
    const next = assistants.filter(a => a.id !== id);
    setAssistants(next);
    if (activeId === id) setActiveId(next[0]?.id || '');
    await saveAssistants(next);
  };

  return (
    <div className="rail px-3 py-4">
      <LocalTokens />
      <div className="mb-2 text-[11px] font-semibold tracking-[.12em] muted">ASSISTANTS</div>

      <div className="panel p-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg grid place-items-center card">
              <Bot className="icon" />
            </div>
            <div className="text-[13px] font-semibold">Assistants</div>
          </div>
          <button className="btn btn-create" onClick={() => {
            const name = prompt('Assistant name?'); if (!name) return;
            const a = { id: crypto.randomUUID(), name };
            const list = [a, ...assistants];
            setAssistants(list); setActiveId(a.id); saveAssistants(list);
          }}>
            <Plus className="icon" /> Create
          </button>
        </div>

        <div className="card mb-3 px-2 py-1.5 flex items-center gap-2">
          <Search className="icon muted" />
          <input className="input flex-1 border-0 bg-transparent" value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" />
          {q && <button className="btn" onClick={() => setQ('')}><X className="icon" /></button>}
        </div>

        <div className="space-y-2">
          {filtered.map(a => (
            <div key={a.id} className={`item ${a.id === activeId ? 'active' : ''}`} onClick={() => setActiveId(a.id)}>
              <div className="w-7 h-7 rounded-lg grid place-items-center card">
                {a.id === activeId ? <FolderOpen className="icon" /> : <Folder className="icon" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold truncate">{a.name}</div>
                <div className="muted text-[11.5px] truncate">{a.purpose || '—'}</div>
              </div>
              <div className="flex gap-1">
                <button
                  className="btn"
                  onClick={(e) => { e.stopPropagation(); const name = prompt('Rename', a.name); if (!name) return;
                    const list = assistants.map(x => x.id === a.id ? { ...x, name } : x);
                    setAssistants(list); saveAssistants(list);
                  }}
                >
                  <Edit3 className="icon" />
                </button>
                <button className="btn" onClick={(e) => { e.stopPropagation(); setConfirming(a); }}>
                  <Trash2 className="icon" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirming && (
        <ConfirmDelete
          name={confirming.name}
          onCancel={() => setConfirming(null)}
          onConfirm={() => { doDelete(confirming.id); setConfirming(null); }}
        />
      )}
    </div>
  );
}
