// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Settings2, Bot, RefreshCw,
  SlidersHorizontal, History, RotateCcw, ChevronDown, Send, Sparkles,
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

// =========================== Types ===========================
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

type Version = {
  id: string;            // generated
  ts: number;            // epoch ms
  label: string;         // auto-named
  name: string;
  model: string;
  temperature: number;
  system: string;
};

// =========================== Styles ===========================
const PANEL: React.CSSProperties = {
  background: 'var(--panel)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  borderRadius: 18,
};

const CARD: React.CSSProperties = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-card)',
  borderRadius: 14,
};

// denser page: reduce paddings, enlarge core zones
const DENSE_PAD = '14px';

// =========================== Refinements ===========================
const CHIP_LIBRARY = [
  { key: 'yes_no', label: 'Only answer Yes/No', line: 'Respond strictly with “Yes” or “No” unless explicitly asked to elaborate.' },
  { key: 'concise', label: 'Be concise', line: 'Keep responses under 1–2 sentences unless more detail is requested.' },
  { key: 'ask_clarify', label: 'Ask clarifying first', line: 'If the request is ambiguous, ask a concise clarifying question before answering.' },
  { key: 'no_greeting', label: 'No greeting', line: 'Do not start with greetings or pleasantries; go straight to the answer.' },
];

const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';

// =========================== Helpers ===========================
function fmtTime(ts: number) {
  const d = new Date(ts);
  return d.toLocaleString();
}
function autoNameVersion(prev: Partial<BotRow> | null, next: BotRow) {
  const parts: string[] = [];
  if (prev?.name !== next.name) parts.push(`name→${next.name.slice(0,18)}`);
  if (prev?.model !== next.model) parts.push(`model→${next.model}`);
  const tPrev = typeof prev?.temperature === 'number' ? prev!.temperature : null;
  if (tPrev !== next.temperature) parts.push(`temp→${next.temperature.toFixed(2)}`);
  if ((prev?.system || '').trim() !== (next.system || '').trim()) {
    const delta = Math.abs((next.system?.length || 0) - (prev?.system?.length || 0));
    parts.push(delta >= 48 ? 'prompt edited (big)' : 'prompt edited');
  }
  const base = parts.length ? parts.join(' · ') : 'minor edit';
  return base.length > 56 ? base.slice(0, 56) + '…' : base;
}
function versionsKey(ownerId: string, agentId: string) {
  return `versions:${ownerId}:${agentId}`;
}
function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>): string {
  // strip old block
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = CHIP_LIBRARY.filter(c => active[c.key]).map(c => `- ${c.line}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}

// =========================== Component ===========================
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({});

  // save state
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false); // unsaved changes

  // versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(true);

  // inline test
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<{role:'user'|'assistant', text:string}[]>([]);
  const [testing, setTesting] = useState(false);

  // sticky save status text
  const statusText = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved';

  // ---------- boot: get user id ----------
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);
    })();
  }, []);

  // ---------- fetch bots ----------
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

  // ---------- sync editor with selection ----------
  useEffect(() => {
    if (!selected) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    // chips from system
    const next: Record<string, boolean> = {};
    CHIP_LIBRARY.forEach(c => { next[c.key] = (selected.system || '').includes(c.line); });
    setChips(next);
    setDirty(false);
    // load versions
    if (userId) {
      try {
        const raw = localStorage.getItem(versionsKey(userId, selected.id));
        setVersions(raw ? JSON.parse(raw) : []);
      } catch { setVersions([]); }
    }
    // reset test log
    setTestLog([]);
  }, [selectedId]);

  // mark dirty on editor changes
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system !== (selected.system || ''));
    setDirty(d);
  }, [name, model, temperature, system, selected]);

  // ---------- keyboard shortcut Cmd/Ctrl+S ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (!saving && dirty) void saveEdits();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, dirty, name, model, temperature, system]);

  // ---------- helpers ----------
  function setChip(key: string, val: boolean) {
    const next = { ...chips, [key]: val };
    setChips(next);
    setSystem(s => applyRefinementsToSystem(s, next));
  }
  function toggleChip(key: string) { setChip(key, !chips[key]); }

  function storeVersions(owner: string, agent: string, arr: Version[]) {
    localStorage.setItem(versionsKey(owner, agent), JSON.stringify(arr));
  }

  // ---------- actions ----------
  async function saveEdits() {
    if (!userId || !selectedId) return;
    setSaving(true);
    try {
      // create version snapshot BEFORE writing
      const prev = list.find(b => b.id === selectedId) || null;
      const candidate: BotRow = {
        id: selectedId, ownerId: userId, name, model, temperature, system,
        createdAt: prev?.createdAt, updatedAt: new Date().toISOString()
      };
      const v: Version = {
        id: `v_${Date.now()}`,
        ts: Date.now(),
        label: autoNameVersion(prev, candidate),
        name: candidate.name, model: candidate.model,
        temperature: candidate.temperature, system: candidate.system,
      };
      const nextVersions = [v, ...versions].slice(0, 25); // keep last 25
      setVersions(nextVersions);
      storeVersions(userId, selectedId, nextVersions);

      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      // refresh list + keep selection
      await fetchBots(userId);
      setSelectedId(selectedId);
      setDirty(false);
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
      // clear versions
      try { localStorage.removeItem(versionsKey(userId, selectedId)); } catch {}
      await fetchBots(userId);
      setSelectedId(null);
      setDirty(false);
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  function restoreVersion(v: Version) {
    setName(v.name);
    setModel(v.model);
    setTemperature(v.temperature);
    setSystem(v.system);
    setDirty(true);
  }

  // soft test: try endpoint if it exists; otherwise show notice.
  async function runTest() {
    if (!testInput.trim() || !selected) return;
    setTesting(true);
    setTestLog(l => [...l, { role: 'user', text: testInput }]);
    try {
      // If your project has a chat test route, it will work; else 404 will be caught gracefully.
      const res = await fetch('/api/assistants/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: selected.model,
          system: selected.system,
          message: testInput,
        }),
      });
      if (!res.ok) throw new Error('No test endpoint configured');
      const json = await res.json();
      const answer = json?.message || '…';
      setTestLog(l => [...l, { role: 'assistant', text: String(answer) }]);
    } catch {
      setTestLog(l => [...l, {
        role: 'assistant',
        text: 'No live test endpoint configured. Go to API Keys to connect or use your chat sandbox.',
      }]);
    } finally {
      setTesting(false);
      setTestInput('');
    }
  }

  // ---------- filters ----------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.model || '').toLowerCase().includes(q) ||
      (b.id || '').toLowerCase().includes(q)
    );
  }, [list, query]);

  // =========================== UI ===========================
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Sticky head: denser, with status */}
      <header className="sticky top-0 z-20 backdrop-blur px-6 py-3 border-b" style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1500px] mx-auto flex items-center gap-3">
          <h1 className="text-[20px] font-semibold">Tuning</h1>
          <div className="text-xs px-2 py-[2px] rounded-full" style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
            {statusText}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => userId && fetchBots(userId)}
              className="px-3 py-1.5 rounded-md text-sm"
              style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}
            >
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>
            <button
              onClick={() => !saving && dirty && saveEdits()}
              disabled={!dirty || saving}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ background:'var(--brand)', color:'#00120a' }}
            >
              <Save className="inline w-4 h-4 mr-1" /> Save (⌘/Ctrl+S)
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-[1500px] px-6 py-5">
        <div className="grid" style={{ gridTemplateColumns: '300px 1.25fr 0.85fr', gap: '16px' }}>
          {/* Left rail */}
          <aside className="p-[12px]" style={PANEL}>
            <div className="flex items-center gap-2 mb-3">
              <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Assistants</div>
            </div>

            <div className="relative mb-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assistants"
                className="w-full rounded-md pl-9 pr-3 py-2 text-sm outline-none"
                style={CARD}
              />
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
            </div>

            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
              {loading ? (
                <div className="flex items-center justify-center py-10 opacity-70">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-sm opacity-80 py-10 text-center px-3">
                  No agents yet.
                  <div className="mt-2">
                    <Link href="/builder"
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: 'var(--brand)', color: '#00120a' }}>
                      Go to Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((b) => (
                    <li key={b.id}>
                      <button
                        onClick={() => setSelectedId(b.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${selectedId === b.id ? 'ring-1' : ''}`}
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

          {/* Editor */}
          <section className="p-[12px]" style={PANEL}>
            {!selected ? (
              <div className="grid place-items-center h-[60vh] opacity-70">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" style={{ color:'var(--brand)' }} />
                  <div className="font-semibold">Editor</div>
                  <div className="ml-auto flex gap-2">
                    <button
                      onClick={() => !saving && dirty && saveEdits()}
                      disabled={!dirty || saving}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                      style={{ background:'var(--brand)', color:'#00120a' }}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save
                    </button>
                    <button
                      onClick={deleteSelected}
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                      style={{ background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.35)' }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </button>
                  </div>
                </div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap:'12px' }}>
                  <div>
                    <div className="text-xs mb-1 opacity-70">Name</div>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 rounded-md outline-none"
                      style={CARD}
                      placeholder="Agent name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs mb-1 opacity-70">Model</div>
                      <select
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full px-3 py-2 rounded-md outline-none"
                        style={CARD}
                      >
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                      </select>
                    </div>
                    <div>
                      <div className="text-xs mb-1 opacity-70">Temperature ({temperature.toFixed(2)})</div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={temperature}
                        onChange={(e) => setTemperature(parseFloat(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </div>

                {/* Refinements */}
                <div>
                  <div className="text-xs mb-1 opacity-70">Refinements</div>
                  <div className="flex flex-wrap gap-2">
                    {CHIP_LIBRARY.map(c => (
                      <button
                        key={c.key}
                        onClick={() => toggleChip(c.key)}
                        className="px-3 py-1.5 rounded-md text-sm transition"
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
                </div>

                {/* System Prompt */}
                <div>
                  <div className="text-xs mb-1 opacity-70">System Prompt</div>
                  <textarea
                    value={system}
                    onChange={(e) => setSystem(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                    style={CARD}
                    placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                  />
                  <div className="flex items-center justify-end text-xs opacity-70 mt-1">
                    {(system?.length || 0).toLocaleString()} chars · est {(Math.max(1, Math.round(system.length/4))).toLocaleString()} tokens
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Versions + Test */}
          <aside className="p-[12px] space-y-3" style={PANEL}>
            {/* Versions */}
            <div className="p-[10px]" style={CARD}>
              <button
                onClick={() => setVersionsOpen(v => !v)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2 font-semibold">
                  <History className="w-4 h-4" style={{ color:'var(--brand)' }} />
                  Versions
                </div>
                <ChevronDown className={`w-4 h-4 transition ${versionsOpen ? 'rotate-180' : ''}`} />
              </button>

              {versionsOpen && (
                <div className="mt-2 space-y-2">
                  {(!selected || !versions?.length) && (
                    <div className="text-xs opacity-70">
                      Versions are created when you click <b>Save</b>. You can restore any snapshot.
                    </div>
                  )}
                  {versions?.map(v => (
                    <div key={v.id} className="p-2 rounded-md text-sm flex items-center gap-2"
                         style={{ background:'color-mix(in oklab, var(--text) 5%, transparent)', border:'1px solid var(--border)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{v.label}</div>
                        <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                      </div>
                      <button
                        onClick={() => restoreVersion(v)}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ background:'color-mix(in oklab, var(--brand) 18%, transparent)', border:'1px solid var(--brand)' }}
                      >
                        <RotateCcw className="inline w-3 h-3 mr-1" />
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Test panel */}
            <div className="p-[10px] space-y-2" style={CARD}>
              <div className="flex items-center gap-2 font-semibold">
                <Sparkles className="w-4 h-4" style={{ color:'var(--brand)' }} />
                Test
              </div>

              <div className="text-xs opacity-70">
                Send a quick message to try your prompt. If no test backend is configured, you’ll
                see a notice. You can wire this to any route later.
              </div>

              <div className="space-y-2 max-h-[42vh] overflow-auto rounded-md p-2"
                   style={{ background:'rgba(0,0,0,.25)', border:'1px solid var(--border)' }}>
                {testLog.length === 0 ? (
                  <div className="text-xs opacity-60">No messages yet.</div>
                ) : testLog.map((m, i) => (
                  <div key={i} className={`text-sm ${m.role === 'user' ? 'text-[var(--text)]' : 'opacity-80'}`}>
                    <b>{m.role === 'user' ? 'You' : 'AI'}:</b> {m.text}
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                  onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); !testing && runTest(); }}}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 rounded-md outline-none text-sm"
                  style={{ ...CARD, padding: DENSE_PAD }}
                />
                <button
                  onClick={runTest}
                  disabled={testing || !testInput.trim()}
                  className="px-3 py-2 rounded-md text-sm disabled:opacity-60"
                  style={{ background:'var(--brand)', color:'#00120a' }}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>

              <div className="text-xs opacity-60">
                Need keys? Go to <Link className="underline" href="/api-keys">API Keys</Link>.
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
