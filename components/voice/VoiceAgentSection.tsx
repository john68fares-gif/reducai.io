// components/voice/AssistantRail.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Plus, Bot, Folder, FolderOpen, Trash2, Edit3, X } from 'lucide-react';

/* -----------------------------------------------------------------------------
   Optional scoped storage (won't crash if missing)
----------------------------------------------------------------------------- */
type Scoped = {
  getJSON<T>(key: string, fallback: T): Promise<T>;
  setJSON(key: string, value: unknown): Promise<void>;
};
let scopedStorageFn: undefined | (() => Promise<Scoped>);
try {
  scopedStorageFn = require('@/utils/scoped-storage').scopedStorage;
} catch { /* no-op */ }

/* -----------------------------------------------------------------------------
   Types
----------------------------------------------------------------------------- */
export type AssistantLite = {
  id: string;
  name: string;
  purpose?: string;
  createdAt?: number;
};

const KEYS = {
  list: 'agents',                   // primary scoped key
  localFallback: 'agents',          // localStorage fallback
};

const GREEN = 'var(--brand, #10b981)'; // respect theme
const GREEN_HOVER = 'color-mix(in oklab, var(--brand, #10b981) 86%, black)';

/* -----------------------------------------------------------------------------
   Theme tokens (light & dark by CSS vars) + compact controls
----------------------------------------------------------------------------- */
function LocalTokens() {
  return (
    <style>{`
      .rail { width: 312px; color: var(--text); }
      .rail .panel {
        background: var(--panel); border: 1px solid var(--border); border-radius: 18px;
        box-shadow: var(--shadow-soft, 0 12px 30px rgba(0,0,0,.18));
      }
      .rail .card {
        background: var(--card); border: 1px solid var(--border); border-radius: 12px;
        box-shadow: var(--shadow-card, 0 6px 16px rgba(0,0,0,.12));
      }

      .rail .input {
        height: 34px; width: 100%; border-radius: 12px; padding: 0 .7rem;
        background: var(--card); border: 1px solid var(--border); color: var(--text);
        font-size: 13px; outline: none; transition: box-shadow .16s ease, border-color .16s ease;
      }
      .rail .input:focus {
        border-color: color-mix(in oklab, var(--brand, #10b981) 40%, var(--border));
        box-shadow: 0 0 0 3px color-mix(in oklab, var(--brand, #10b981) 18%, transparent);
      }

      .rail .btn {
        height: 34px; padding: 0 .75rem; border-radius: 12px;
        display: inline-flex; align-items: center; gap: .45rem;
        background: var(--card); color: var(--text); border: 1px solid var(--border);
        font-size: 13px; font-weight: 600; transition: transform .06s ease, box-shadow .16s ease, border-color .16s ease;
      }
      .rail .btn:hover { transform: translateY(-1px); }
      .rail .btn-primary {
        background: ${GREEN}; color: #0b1210; border: 1px solid ${GREEN};
        box-shadow: 0 8px 20px color-mix(in oklab, var(--brand, #10b981) 40%, transparent);
      }
      .rail .btn-primary:hover { background: ${GREEN_HOVER}; }

      .rail .item {
        display: flex; align-items: center; gap: 10px;
        padding: 10px 12px; border-radius: 12px;
        background: var(--card); border: 1px solid var(--border);
        transition: box-shadow .18s ease, transform .12s ease, outline-color .18s ease, border-color .18s ease;
        outline: 0 solid transparent;
      }
      /* Hover shadow request */
      .rail .item:hover {
        transform: translateY(-1px);
        box-shadow:
          0 10px 24px rgba(0,0,0,.16),
          inset 0 1px 0 rgba(255,255,255,.06);
        border-color: color-mix(in oklab, var(--brand, #10b981) 24%, var(--border));
      }
      .rail .item.active {
        outline: 2px solid color-mix(in oklab, var(--brand, #10b981) 32%, transparent);
        border-color: color-mix(in oklab, var(--brand, #10b981) 36%, var(--border));
        box-shadow:
          0 12px 30px color-mix(in oklab, var(--brand, #10b981) 22%, transparent),
          inset 0 1px 0 rgba(255,255,255,.08);
      }

      .rail .muted { color: var(--text-muted); }
      .rail .icon { width: 14px; height: 14px; }

      /* Light / dark niceties if host app lacks vars */
      :root:not([data-theme="dark"]) .rail {
        --panel: #fff; --card: #fafafa; --border: rgba(0,0,0,.08);
        --text: #0f1412; --text-muted: rgba(15,20,18,.62);
      }
      [data-theme="dark"] .rail {
        --panel: rgba(16,22,21,.96); --card: rgba(22,28,27,.9); --border: rgba(255,255,255,.12);
        --text: #E9FBF5; --text-muted: #9bb7ae;
      }
    `}</style>
  );
}

/* -----------------------------------------------------------------------------
   Storage helpers
----------------------------------------------------------------------------- */
async function loadAssistants(): Promise<AssistantLite[]> {
  // 1) scoped storage
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      const arr = await ss.getJSON<AssistantLite[]>(KEYS.list, []);
      if (Array.isArray(arr)) return normalize(arr);
    }
  } catch {}
  // 2) local fallback
  try {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(KEYS.localFallback);
      if (raw) return normalize(JSON.parse(raw));
    }
  } catch {}
  return [];
}
async function saveAssistants(list: AssistantLite[]) {
  try {
    if (scopedStorageFn) {
      const ss = await scopedStorageFn();
      await ss.setJSON(KEYS.list, list);
    }
  } catch {}
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(KEYS.localFallback, JSON.stringify(list));
    }
  } catch {}
}
function normalize(arr: AssistantLite[]): AssistantLite[] {
  return (arr || []).map((x, i) => ({
    id: String(x.id ?? x['agentId'] ?? x['slug'] ?? `idx_${i}`),
    name: String(x.name ?? x['title'] ?? `Assistant ${i + 1}`),
    purpose: x.purpose ?? x['desc'] ?? '',
    createdAt: x.createdAt ?? Date.now(),
  }));
}

/* -----------------------------------------------------------------------------
   Component
----------------------------------------------------------------------------- */
export default function AssistantRail() {
  const [assistants, setAssistants] = useState<AssistantLite[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [q, setQ] = useState('');
  const [focused, setFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  // boot
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

  // keyboard: ESC clears
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (document.activeElement === searchRef.current && e.key === 'Escape') {
        setQ('');
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // debounced filter
  const [debouncedQ, setDebouncedQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim().toLowerCase()), 140);
    return () => clearTimeout(t);
  }, [q]);

  const filtered = useMemo(() => {
    if (!debouncedQ) return assistants;
    return assistants.filter(a =>
      a.name.toLowerCase().includes(debouncedQ) ||
      (a.purpose || '').toLowerCase().includes(debouncedQ)
    );
  }, [assistants, debouncedQ]);

  async function onDelete(id: string) {
    const victim = assistants.find(a => a.id === id);
    const ok = window.confirm(`Delete “${victim?.name ?? 'assistant'}”? This can’t be undone.`);
    if (!ok) return;
    const next = assistants.filter(a => a.id !== id);
    setAssistants(next);
    if (activeId === id) setActiveId(next[0]?.id || '');
    await saveAssistants(next);
  }

  function onCreate() {
    const name = prompt('New assistant name?');
    if (!name) return;
    const next: AssistantLite = {
      id: `a_${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,
      name: name.trim(),
      createdAt: Date.now(),
      purpose: '',
    };
    const list = [next, ...assistants];
    setAssistants(list);
    setActiveId(next.id);
    saveAssistants(list);
  }

  return (
    <div className="rail px-3 py-4">
      <LocalTokens />

      <div className="mb-2 text-[11px] font-semibold tracking-[.12em] muted">ASSISTANTS</div>

      <div className="panel p-3">
        {/* header */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl grid place-items-center card">
              <Bot className="icon" />
            </div>
            <div className="font-semibold text-[13px]">Assistants</div>
          </div>
          <button className="btn btn-primary" onClick={onCreate}>
            <Plus className="icon" /> Create
          </button>
        </div>

        {/* search */}
        <div className="card mb-3 px-2 py-1.5">
          <div className="flex items-center gap-2">
            <Search className="icon muted" />
            <input
              ref={searchRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              className="input"
              placeholder="Search assistants"
              style={{
                border: 'none',
                background: 'transparent',
                paddingLeft: 0,
                height: 30,
                boxShadow: focused ? '0 0 0 3px color-mix(in oklab, var(--brand, #10b981) 12%, transparent)' : 'none',
              }}
            />
            {q && (
              <button
                aria-label="Clear search"
                className="btn"
                onClick={() => setQ('')}
                style={{ height: 28, padding: '0 6px' }}
              >
                <X className="icon" />
              </button>
            )}
          </div>
        </div>

        {/* list */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <div className="muted text-[12px] px-1 py-2">No assistants found</div>
          ) : (
            filtered.map(a => {
              const active = a.id === activeId;
              return (
                <div
                  key={a.id}
                  className={`item ${active ? 'active' : ''}`}
                  onClick={() => setActiveId(a.id)}
                  role="button"
                >
                  <div className="w-8 h-8 rounded-xl grid place-items-center card">
                    {active ? <FolderOpen className="icon" /> : <Folder className="icon" />}
                  </div>

                  <div className="min-w-0 text-left flex-1">
                    <div className="font-semibold text-[13px] truncate">{a.name}</div>
                    <div className="muted text-[11.5px] truncate">{a.purpose || '—'}</div>
                  </div>

                  <div className="flex items-center gap-1 opacity-90">
                    <button
                      className="btn"
                      aria-label="Rename"
                      onClick={(e) => {
                        e.stopPropagation();
                        const name = prompt('Rename assistant', a.name) || '';
                        const trimmed = name.trim();
                        if (!trimmed || trimmed === a.name) return;
                        const next = assistants.map(x => x.id === a.id ? { ...x, name: trimmed } : x);
                        setAssistants(next);
                        saveAssistants(next);
                      }}
                      style={{ height: 28, padding: '0 8px' }}
                    >
                      <Edit3 className="icon" />
                    </button>
                    <button
                      className="btn"
                      aria-label="Delete"
                      onClick={(e) => { e.stopPropagation(); onDelete(a.id); }}
                      style={{ height: 28, padding: '0 8px' }}
                    >
                      <Trash2 className="icon" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* foot hint */}
        <div className="muted text-[11.5px] mt-3 px-1">
          Tip: data is saved to your workspace (with a safe local fallback).
        </div>
      </div>
    </div>
  );
}
