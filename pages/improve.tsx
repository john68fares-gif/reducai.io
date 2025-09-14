// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Settings2, Bot, RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

type BotRow = {
  id: string;
  ownerId: string;
  name: string;
  model: string;
  temperature: number;
  system: string;
  createdAt?: string;
  updatedAt?: string;
};

const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 20,
};
const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 16,
};

// Quick refinement chips (toggle -> inject into SYSTEM as ACTIVE REFINEMENTS)
const CHIP_LIBRARY = [
  { key: 'yes_no', label: 'Only answer Yes/No', line: 'Respond strictly with “Yes” or “No” unless explicitly asked to elaborate.' },
  { key: 'concise', label: 'Be concise', line: 'Keep responses under 1–2 sentences unless more detail is requested.' },
  { key: 'ask_clarify', label: 'Ask clarifying first', line: 'If the request is ambiguous, ask a concise clarifying question before answering.' },
  { key: 'no_greeting', label: 'No greeting', line: 'Do not start with greetings or pleasantries; go straight to the answer.' },
];

export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Editor state
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');

  // refinement chips state
  const [chips, setChips] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);
    })();
  }, []);

  async function fetchBots(uid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, {
        headers: { 'x-owner-id': uid },
      });
      const json = await res.json();
      const rows: BotRow[] = json?.data || [];
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (userId) fetchBots(userId); }, [userId]);

  // Sync editor with current selection
  useEffect(() => {
    if (!selected) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    // derive chips from current system (best-effort)
    const next: Record<string, boolean> = {};
    CHIP_LIBRARY.forEach(c => { next[c.key] = (selected.system || '').includes(c.line); });
    setChips(next);
  }, [selectedId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.model || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q)
    );
  }, [list, query]);

  // ---------- Refinements block injection ----------
  function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>): string {
    const header = '### ACTIVE REFINEMENTS';
    const existingLines: string[] = [];
    const linesWanted = CHIP_LIBRARY.filter(c => active[c.key]).map(c => `- ${c.line}`);

    // strip existing block if present
    let stripped = baseSystem;
    const re = new RegExp(`^${header}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
    if (re.test(stripped)) stripped = stripped.replace(re, '').trim();

    const block = linesWanted.length
      ? `${header}\n${linesWanted.join('\n')}\n\n`
      : '';

    // Put block at top for determinism
    return (block + stripped).trim();
  }

  function toggleChip(key: string) {
    const next = { ...chips, [key]: !chips[key] };
    setChips(next);
    setSystem(s => applyRefinementsToSystem(s, next));
  }

  // ---------- Actions ----------
  async function saveEdits() {
    if (!userId || !selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');
      await fetchBots(userId);
      setSelectedId(selectedId);
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!userId || !selectedId) return;
    if (!confirm('Delete this agent?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'DELETE',
        headers: { 'x-owner-id': userId },
      });
      if (!res.ok) throw new Error('Failed to delete');
      await fetchBots(userId);
      setSelectedId(null);
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  // ---------- UI ----------
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <header className="px-6 pt-6 pb-3">
        <h1 className="text-xl font-semibold">Tuning</h1>
      </header>

      <div className="mx-auto w-full max-w-[1400px] px-6 pb-16">
        <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: '18px' }}>
          {/* Left rail – NO create here */}
          <aside className="p-3" style={PANEL}>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
              <div className="font-semibold">Assistants</div>
              <div className="ml-auto">
                <button
                  onClick={() => userId && fetchBots(userId)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)', border: '1px solid var(--border)' }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh
                </button>
              </div>
            </div>

            <div className="relative mb-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assistants"
                className="w-full rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
                style={CARD}
              />
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
            </div>

            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 260px)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-10 opacity-70">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState />
              ) : (
                <ul className="space-y-2">
                  {filtered.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setSelectedId(b.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 ${selectedId === b.id ? 'ring-1' : ''}`}
                        style={{
                          ...CARD,
                          borderColor: selectedId === b.id ? 'var(--brand)' : 'var(--border)',
                        }}
                      >
                        <div className="w-7 h-7 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--border)' }}>
                          <Bot className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate">{b.name || 'Untitled'}</div>
                          <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0, 8)}</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>

          {/* Right panel */}
          <main className="p-4" style={PANEL}>
            {!selected ? (
              <div className="grid place-items-center h-[60vh] opacity-70">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
              </div>
            ) : (
              <div className="grid gap-12" style={{ gridTemplateColumns: '1fr 360px' }}>
                {/* Editor */}
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <Settings2 className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    <div className="font-semibold">Editor</div>
                    <div className="ml-auto flex gap-2">
                      <button
                        onClick={saveEdits}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                        style={{ background: 'var(--brand)', color: '#00120a' }}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                      </button>
                      <button
                        onClick={deleteSelected}
                        disabled={saving}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                        style={{ background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.35)' }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Field label="Name">
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg outline-none"
                        style={CARD}
                        placeholder="Agent name"
                      />
                    </Field>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Model">
                        <select
                          value={model}
                          onChange={(e) => setModel(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg outline-none"
                          style={CARD}
                        >
                          <option value="gpt-4o-mini">gpt-4o-mini</option>
                          <option value="gpt-4o">gpt-4o</option>
                          <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                        </select>
                      </Field>

                      <Field label={`Temperature (${temperature.toFixed(2)})`}>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.01}
                          value={temperature}
                          onChange={(e) => setTemperature(parseFloat(e.target.value))}
                          className="w-full"
                        />
                      </Field>
                    </div>

                    {/* Refinements (chips) */}
                    <Field label="Refinements">
                      <div className="flex flex-wrap gap-2">
                        {CHIP_LIBRARY.map(c => (
                          <button
                            key={c.key}
                            onClick={() => toggleChip(c.key)}
                            className="px-3 py-1.5 rounded-lg text-sm"
                            style={{
                              ...(chips[c.key]
                                ? { background: 'color-mix(in oklab, var(--brand) 25%, transparent)', border: '1px solid var(--brand)' }
                                : { background: 'color-mix(in oklab, var(--text) 7%, transparent)', border: '1px solid var(--border)' }),
                            }}
                          >
                            <SlidersHorizontal className="inline w-3.5 h-3.5 mr-1.5 opacity-80" />
                            {c.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field label="System Prompt">
                      <textarea
                        value={system}
                        onChange={(e) => setSystem(e.target.value)}
                        rows={16}
                        className="w-full px-3 py-2 rounded-lg outline-none font-mono text-sm"
                        style={CARD}
                        placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                      />
                    </Field>
                  </div>
                </section>

                {/* Tips / Meta */}
                <aside className="space-y-3">
                  <div className="p-3" style={CARD}>
                    <div className="font-semibold mb-1">Meta</div>
                    <div className="text-xs opacity-80">ID: {selected.id}</div>
                    <div className="text-xs opacity-80">Updated: {selected.updatedAt || '—'}</div>
                  </div>

                  <div className="p-3" style={CARD}>
                    <div className="font-semibold mb-1">Tips</div>
                    <ul className="text-sm opacity-80 list-disc pl-5 space-y-1">
                      <li>Use <b>Refinements</b> to quickly adjust tone and guardrails.</li>
                      <li>Click <b>Save</b> to persist changes to this agent.</li>
                      <li>All agents shown here belong to <b>your account</b>.</li>
                    </ul>
                  </div>
                </aside>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs mb-1 opacity-70">{label}</div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-sm opacity-80 py-10 text-center px-3">
      No agents yet.
      <div className="mt-2">
        <Link
          href="/builder"
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--brand)', color: '#00120a' }}
        >
          Go to Builder
        </Link>
      </div>
    </div>
  );
}
