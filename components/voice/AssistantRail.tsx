// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Search, Plus, Bot, Folder, FolderOpen, Trash2, Edit3,
} from 'lucide-react';

// Optional: if your project has scoped storage utils, we’ll try to use them.
// If not available, the try/catch keeps the rail from crashing.
let scopedStorageFn: undefined | (() => Promise<any>);
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  scopedStorageFn = require('@/utils/scoped-storage').scopedStorage;
} catch { /* noop – fallback to localStorage */ }

const GREEN = '#10b981';
const GREEN_HOVER = '#0ea473';

type AssistantLite = {
  id: string;
  name: string;
  purpose?: string;
  createdAt?: number;
};

function LocalTokens() {
  return (
    <style>{`
      .rail { --panel: rgba(13,15,17,0.92); --card: rgba(18,20,23,0.88);
              --border: rgba(106,247,209,0.18); --text: #E9FBF5; --muted: #9bb7ae; }
      .rail { color: var(--text); width: 312px; background: transparent; }
      .box  { background: var(--panel); border: 1px solid var(--border); border-radius: 22px;
              box-shadow: inset 0 0 22px rgba(0,0,0,.28), 0 0 18px rgba(106,247,209,.05), 0 0 22px rgba(0,255,194,.05); }
      .card { background: var(--card); border: 1px solid var(--border); border-radius: 14px;
              box-shadow: 0 16px 36px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.07), 0 0 0 1px rgba(0,255,194,.05); }
      .input {
        width:100%; height:46px; border-radius:14px; background:var(--card); border:1px solid var(--border);
        color:var(--text); padding:0 .9rem; outline:none; font-size:14px;
      }
      .btn { height:46px; padding:0 .9rem; border-radius:14px; display:inline-flex; align-items:center; gap:.5rem;
             background:var(--card); color:var(--text); border:1px solid var(--border); font-weight:600; font-size:14px; }
      .btn-primary { height:46px; padding:0 1.1rem; border-radius:18px; display:inline-flex; align-items:center; gap:.6rem;
                     background:${GREEN}; border:1px solid ${GREEN}; color:#fff; font-weight:700;
                     box-shadow:0 10px 24px rgba(16,185,129,.22); }
      .btn-primary:hover { background:${GREEN_HOVER}; box-shadow:0 12px 28px rgba(16,185,129,.32); }
      .item { border:1px solid var(--border); border-radius:12px; background:var(--card); padding:10px 12px;
              display:flex; align-items:center; gap:10px; }
      .item.active { outline:2px solid rgba(106,247,209,.28); }
      .muted { color: var(--muted); }
      .hr { border-top:1px solid var(--border); }
    `}</style>
  );
}

/** Robust loader:
 * - tries scoped storage ('agents') per-account
 * - falls back to any localStorage key ending with ":agents" or "agents"
 * - never throws (returns [])
 */
async function loadAssistants(): Promise<AssistantLite[]> {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      const list = await ss.getJSON<AssistantLite[]>('agents', []);
      if (Array.isArray(list)) return normalize(list);
    }
  } catch { /* ignore */ }

  if (typeof window !== 'undefined') {
    try {
      const keys = Object.keys(localStorage).filter(k => /(^|:)agents$/.test(k));
      const lists = keys.flatMap(k => {
        try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; }
      });
      return normalize(lists as AssistantLite[]);
    } catch { /* ignore */ }
  }
  return [];
}

function normalize(arr: AssistantLite[]): AssistantLite[] {
  return (arr || []).map((x, i) => ({
    id: String(x.id ?? x['agentId'] ?? x['slug'] ?? `idx_${i}`),
    name: String(x.name ?? x['title'] ?? `Assistant ${i + 1}`),
    purpose: x.purpose ?? x['desc'] ?? '',
    createdAt: x.createdAt ?? Date.now(),
  }));
}

export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [q, setQ] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await loadAssistants();
      if (!alive) return;
      setAssistants(list);
      if (list[0]) setActiveId(list[0].id);
    })();
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return !s ? assistants : assistants.filter(a => a.name.toLowerCase().includes(s));
  }, [assistants, q]);

  return (
    <div className="rail px-3 py-4">
      <LocalTokens />

      <div className="mb-3 text-xs font-semibold tracking-[.12em] muted">ASSISTANTS</div>

      <div className="box p-3">
        {/* Header actions */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl grid place-items-center card">
              <Bot size={16} />
            </div>
            <div className="font-semibold">Assistants</div>
          </div>
          <button className="btn-primary">
            <Plus size={16} /> Create
          </button>
        </div>

        {/* Search */}
        <div className="card mb-3">
          <div className="flex items-center gap-2 px-3">
            <Search size={16} className="muted" />
            <input
              className="input"
              placeholder="Search assistants"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              style={{ border: 'none', background: 'transparent', height: 44, paddingLeft: 0 }}
            />
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="muted text-sm px-1 py-2">No assistants found</div>
          ) : (
            filtered.map(a => (
              <button
                key={a.id}
                className={`item w-full ${a.id === activeId ? 'active' : ''}`}
                onClick={() => setActiveId(a.id)}
              >
                <div className="w-9 h-9 rounded-xl grid place-items-center card">
                  {a.id === activeId ? <FolderOpen size={16} /> : <Folder size={16} />}
                </div>
                <div className="min-w-0 text-left flex-1">
                  <div className="font-semibold text-sm truncate">{a.name}</div>
                  {a.purpose ? (
                    <div className="muted text-xs truncate">{a.purpose}</div>
                  ) : (
                    <div className="muted text-xs">—</div>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-80">
                  <button className="p-2 rounded-lg hover:opacity-80" aria-label="Rename">
                    <Edit3 size={16} />
                  </button>
                  <button className="p-2 rounded-lg hover:opacity-80" aria-label="Delete">
                    <Trash2 size={16} />
                  </button>
                </div>
              </button>
            ))
          )}
        </div>

        <div className="hr my-3" />

        {/* Footer hint */}
        <div className="muted text-[12px] px-1">
          Tip: agents are loaded from your account storage (scoped) with a local fallback.
        </div>
      </div>
    </div>
  );
}
