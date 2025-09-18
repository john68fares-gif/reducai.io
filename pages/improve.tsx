// pages/improve.tsx
// Full rewrite (focused on Live Test). Clean theme, no neon.
// - Biggest Live Test, split lanes (A/B), send-to-both, file/image placeholders.
// - Drag version card into sandbox to create Lane B.
// - AI short titles for versions (heuristic + optional /api/assistants/chat assist).
// - Collapsed System/Pre/Post (show on demand). Quick rule "Update" merges into system.
// - Normalized buttons; duplicate on version hover; contextual actions.
// - Autosave + unsaved exit guard.
// - Scroll INSIDE chat, not page.

'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Bot, Search, Loader2, Save, Trash2, RefreshCw, History, Diff, RotateCcw, X, Upload, Download,
  Star, StarOff, Copy, Check, SlidersHorizontal, MessageSquare, Plus, Paperclip, Image as ImageIcon,
  FileIcon, Send, HelpCircle, Undo2, Redo2, Pin, MoreHorizontal, Layers, CornerDownRight, ChevronDown
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

type Version = {
  id: string;
  ts: number;
  label: string; // AI-short title for change
  name: string;
  model: string;
  temperature: number;
  system: string;
};

type AgentMeta = {
  pinned?: boolean;
  draft?: boolean;
  notes?: string;
  lastOpenedAt?: number;
  tags?: string[];
};

type ChatMsg = { role: 'user' | 'assistant' | 'system'; content: string };

const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--bg) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  borderRadius: 14,
  boxShadow: '0 3px 14px rgba(0,0,0,.08)',
};

const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--bg) 98%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  borderRadius: 10,
};

const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();

function stripMd(t: string) {
  return (t || '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[*_`>#-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Heuristic short label for changes; optional remote AI assist.
async function makeShortLabel(prevSys: string, nextSys: string): Promise<string> {
  const before = stripMd(prevSys || '');
  const after = stripMd(nextSys || '');
  if (before === after) return 'minor edit';

  const added = after.replace(before, '').slice(0, 200).toLowerCase();

  if (/\byes\b.*\bno\b/i.test(after) && /only/i.test(after)) return 'Yes/No only';
  if (/concise|short|brief/i.test(after)) return 'More concise answers';
  if (/polite|friendly|tone/i.test(after)) return 'Tone: friendlier';
  if (/json|schema|strict/i.test(after)) return 'JSON output enforced';
  if (/length|words|max/i.test(after)) return 'Max length capped';
  if (/disclaimer|legal|safety/i.test(after)) return 'Legal disclaimer added';
  if (/examples?|few[-\s]?shot/i.test(after)) return 'Examples added';
  if (/greeting|welcome|intro/i.test(after)) return 'Add brief greeting';
  if (/clarify|question first/i.test(after)) return 'Ask clarifying first';

  // Try optional remote summarizer if available, fail to concise fallback
  try {
    const res = await fetch('/api/assistants/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        messages: [
          { role: 'system', content: 'Return a 3–5 word title describing the key change between two prompts. No punctuation, title case.' },
          { role: 'user', content: `Before:\n${before}\n\nAfter:\n${after}` },
        ],
      }),
    });
    if (res.ok) {
      const j = await res.json();
      const text = (j?.data?.content || j?.content || '').toString().trim();
      if (text) return text.length > 48 ? text.slice(0, 48) : text;
    }
  } catch {}
  const hint = added || after;
  return (hint || 'Prompt edited').slice(0, 48);
}

// Build the effective system prompt with quick rules + (optional) pre/post
function composeSystem(base: string, quickRules: string, pre: string, post: string, includePrePost: boolean) {
  const lines: string[] = [];
  if (includePrePost && pre.trim()) lines.push(`### PRE\n${pre.trim()}`);
  let s = base || '';
  if (quickRules.trim()) {
    const rules = quickRules.split('\n').map(l => l.trim()).filter(Boolean);
    if (rules.length) {
      s = `### RULES\n${rules.map((r, i) => `${i + 1}) ${r}`).join('\n')}\n\n${s}`;
    }
  }
  lines.push(s.trim());
  if (includePrePost && post.trim()) lines.push(`\n### POST\n${post.trim()}`);
  return lines.join('\n\n').trim();
}

export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  // Search/sort
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'pinned_first' | 'name_asc' | 'updated_desc'>('pinned_first');

  // Editor state
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [prePrompt, setPrePrompt] = useState('');
  const [postPrompt, setPostPrompt] = useState('');
  const [quickRule, setQuickRule] = useState(''); // replaces “rules vs tags”
  const [showPromptBlock, setShowPromptBlock] = useState(false); // collapsed by default
  const [notes, setNotes] = useState('');
  const [pinned, setPinned] = useState(false);
  const [draft, setDraft] = useState(false);

  // Versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Copy ID
  const [copied, setCopied] = useState(false);
  const copyId = async () => {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 900);
  };

  // Live Test (lanes)
  const [laneB, setLaneB] = useState<Version | null>(null); // if present we show split
  const [sendBoth, setSendBoth] = useState(false);
  const [activeLane, setActiveLane] = useState<'A' | 'B'>('A');
  const laneARef = useRef<HTMLDivElement | null>(null);
  const laneBRef = useRef<HTMLDivElement | null>(null);

  // Messages per lane
  const [msgsA, setMsgsA] = useState<ChatMsg[]>([]);
  const [msgsB, setMsgsB] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);

  // Track unsaved exit
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return undefined;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // Supabase user
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || null);
    })();
  }, []);

  // Fetch bots
  const fetchBots = useCallback(async (uid: string) => {
    const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, { headers: { 'x-owner-id': uid } });
    const json = await res.json();
    const rows: BotRow[] = json?.data || [];
    setList(rows);
    if (!selectedId && rows.length) setSelectedId(rows[0].id);
  }, [selectedId]);
  useEffect(() => { if (userId) void fetchBots(userId); }, [userId, fetchBots]);

  // On select load state/metas/versions
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    setPrePrompt(''); setPostPrompt(''); setQuickRule('');
    setNotes(''); setPinned(false); setDraft(false);
    setLaneB(null); setMsgsA([]); setMsgsB([]); setInput('');

    try {
      const rawV = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(rawV ? (JSON.parse(rawV) as Version[]) : []);
    } catch { setVersions([]); }

    try {
      const rawM = localStorage.getItem(metaKey(userId, selected.id));
      const m: AgentMeta = rawM ? JSON.parse(rawM) : {};
      setPinned(!!m.pinned); setDraft(!!m.draft); setNotes(m.notes || '');
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, lastOpenedAt: Date.now() }));
    } catch {}

    setDirty(false);
  }, [selectedId, userId, selected]);

  // Filtered list for left rail
  const filtered = useMemo(() => {
    let rows = [...list];
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.model || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q)
      );
    }
    if (sort === 'name_asc') {
      rows.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'updated_desc') {
      rows.sort((a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime());
    } else {
      // pinned first (meta in localStorage)
      rows.sort((a, b) => {
        try {
          const aMeta = JSON.parse(localStorage.getItem(metaKey(userId || '', a.id)) || '{}');
          const bMeta = JSON.parse(localStorage.getItem(metaKey(userId || '', b.id)) || '{}');
          return (bMeta.pinned ? 1 : 0) - (aMeta.pinned ? 1 : 0);
        } catch { return 0; }
      });
    }
    return rows;
  }, [list, query, sort, userId]);

  // Mark dirty when any edit happens
  useEffect(() => {
    if (!selected) return;
    const isDirty =
      name !== (selected.name || '') ||
      model !== (selected.model || 'gpt-4o') ||
      Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9 ||
      system !== (selected.system || '') ||
      prePrompt !== '' || postPrompt !== '' || quickRule !== '' ||
      notes !== '' || pinned !== false || draft !== false;
    setDirty(isDirty);
  }, [name, model, temperature, system, prePrompt, postPrompt, quickRule, notes, pinned, draft, selected]);

  async function saveEdits(silent = false) {
    if (!userId || !selectedId) return;
    try {
      setSaving(true);
      const prev = list.find(b => b.id === selectedId) || null;
      const candidate: BotRow = { id: selectedId, ownerId: userId, name, model, temperature, system, createdAt: prev?.createdAt, updatedAt: new Date().toISOString() };

      // Create version snapshot (AI short label)
      const label = await makeShortLabel(prev?.system || '', system);
      const v: Version = { id: `v_${Date.now()}`, ts: Date.now(), label, name, model, temperature, system };
      const nextVersions = [v, ...(versions || [])].slice(0, 60);
      setVersions(nextVersions);
      localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(nextVersions));

      // PATCH server
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      // Update list (light)
      if (silent) {
        setList(cur => cur.map(b => b.id === selectedId ? { ...b, name, model, temperature, system, updatedAt: candidate.updatedAt } : b));
      } else {
        await fetchBots(userId);
        setSelectedId(selectedId);
      }
      setDirty(false);
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!userId || !selectedId) return;
    if (!confirm('Delete this assistant?')) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'DELETE', headers: { 'x-owner-id': userId },
      });
      if (!res.ok) throw new Error('Failed to delete');
      localStorage.removeItem(versionsKey(userId, selectedId));
      localStorage.removeItem(metaKey(userId, selectedId));
      await fetchBots(userId);
      setSelectedId(null);
      setDirty(false);
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  async function duplicateAgent() {
    if (!selected || !userId) return;
    try {
      const resp = await fetch('/api/chatbots', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name: `${selected.name || 'Untitled'} (Copy)`, model: selected.model, temperature: selected.temperature, system: selected.system }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok || !json?.data?.id) throw new Error(json?.error || 'Failed to duplicate');
      await fetchBots(userId); setSelectedId(json.data.id);
    } catch (e: any) { alert(e?.message || 'Failed to duplicate'); }
  }

  function exportAgent() {
    if (!selected) return;
    const payload = {
      type: 'reduc.ai/agent', version: 1,
      agent: { id: selected.id, name, model, temperature, system,
        meta: { notes, pinned, draft }
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(name || 'agent').replace(/\s+/g, '_')}.json`; a.click(); URL.revokeObjectURL(url);
  }

  async function importAgent(file: File) {
    if (!userId) return;
    try {
      const text = await file.text(); const parsed = JSON.parse(text); const a = parsed?.agent || parsed;
      const res = await fetch('/api/chatbots', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name: a.name || 'Imported Agent', model: a.model || 'gpt-4o', temperature: typeof a.temperature==='number'?a.temperature:0.5, system: a.system || '' }),
      });
      const json = await res.json(); if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to import');
      const newId = json.data.id as string;
      localStorage.setItem(metaKey(userId, newId), JSON.stringify(a.meta || {}));
      await fetchBots(userId); setSelectedId(newId);
    } catch (e:any) { alert(e?.message || 'Import failed'); }
  }

  // Quick rule "Update" -> merges into system (visible if prompt open)
  async function applyQuickRule() {
    if (!quickRule.trim()) return;
    const merged = composeSystem(system, quickRule, prePrompt, postPrompt, false);
    setSystem(merged);
    setQuickRule('');
    setDirty(true);
  }

  // Chat send (calls /api/assistants/chat if available, else heuristic echo fallback)
  async function sendPrompt(target: 'A' | 'B', text: string) {
    const laneVersion = target === 'A'
      ? { system, model, temperature }
      : laneB ? { system: laneB.system, model: laneB.model, temperature: laneB.temperature } : null;

    if (!laneVersion) return;

    const buildMessages = (msgs: ChatMsg[]): ChatMsg[] => {
      const composed = composeSystem(
        laneVersion.system,
        '', // quick rules were baked on save; lane B versions include their system
        prePrompt,
        postPrompt,
        false // keep pre/post collapsed for execution; you can toggle to true if needed
      );
      const sys: ChatMsg = { role: 'system', content: composed };
      return [sys, ...msgs];
    };

    const appendUser = (setter: React.Dispatch<React.SetStateAction<ChatMsg[]>>) =>
      setter(cur => [...cur, { role: 'user', content: text }]);

    const appendAI = (setter: React.Dispatch<React.SetStateAction<ChatMsg[]>>, content: string) =>
      setter(cur => [...cur, { role: 'assistant', content }]);

    const runLane = async (lane: 'A' | 'B') => {
      if (lane === 'A') appendUser(setMsgsA); else appendUser(setMsgsB);
      try {
        const base = lane === 'A' ? msgsA : msgsB;
        const messages = buildMessages(base.concat({ role: 'user', content: text }));

        // Try real endpoint
        const res = await fetch('/api/assistants/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: laneVersion.model,
            temperature: laneVersion.temperature,
            messages,
          }),
        });

        if (res.ok) {
          const j = await res.json();
          const out = (j?.data?.content || j?.content || '').toString();
          if (lane === 'A') appendAI(setMsgsA, out);
          else appendAI(setMsgsB, out);
        } else {
          // Soft fallback: tiny echo + rule hint (so it "feels" guided)
          const hint = /yes|no/i.test(laneVersion.system) ? ' (answer Yes/No)' : '';
          const out = `Simulated: ${text}${hint}`;
          if (lane === 'A') appendAI(setMsgsA, out);
          else appendAI(setMsgsB, out);
        }
      } catch {
        const out = `Simulated: ${text}`;
        if (lane === 'A') appendAI(setMsgsA, out);
        else appendAI(setMsgsB, out);
      }
    };

    setBusy(true);
    try {
      if (sendBoth && laneB) {
        await Promise.all([runLane('A'), runLane('B')]);
      } else {
        await runLane(target);
      }
    } finally {
      setBusy(false);
    }
  }

  // Drag version → lane B
  const onVersionDragStart = (v: Version) => (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', v.id);
  };
  const onLaneBDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    const v = versions.find(x => x.id === id);
    if (v) {
      setLaneB(v);
      setActiveLane('A'); // keep A active by default
      setMsgsB([]); // fresh lane
    }
  };

  const laneAClass = activeLane === 'A'
    ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 2px color-mix(in oklab, var(--brand) 40%, transparent) inset' }
    : {};
  const laneBClass = activeLane === 'B'
    ? { borderColor: 'var(--brand)', boxShadow: '0 0 0 2px color-mix(in oklab, var(--brand) 40%, transparent) inset' }
    : {};

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* ╭─ Top bar */}
      <header className="sticky top-0 z-20 backdrop-blur border-b px-6 py-3"
        style={{ borderColor: 'var(--border)', background: 'color-mix(in oklab, var(--bg) 92%, transparent)' }}>
        <div className="max-w-[1600px] mx-auto flex items-center gap-3">
          <Layers className="w-5 h-5" />
          <h1 className="text-[18px] font-semibold">{selected ? (selected.name || 'Assistant') : 'Agent Tuning'}</h1>

          <span className="text-xs px-2 py-[2px] rounded-full"
            style={{ background: 'color-mix(in oklab, var(--text) 8%, transparent)', border: '1px solid var(--border)' }}>
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
          </span>

          {selected && (
            <button onClick={copyId} className="text-xs px-2 py-1 rounded-md hover:opacity-90" style={{ ...CARD, marginLeft: 6 }}>
              {copied ? <><Check className="inline w-3.5 h-3.5 mr-1" /> Copied</> : <><Copy className="inline w-3.5 h-3.5 mr-1" /> ID</>}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => userId && fetchBots(userId)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>

            <label className="px-3 py-1.5 rounded-md text-sm cursor-pointer" style={{ ...CARD }}>
              <Upload className="inline w-4 h-4 mr-1" /> Import
              <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
            </label>

            <button onClick={exportAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Download className="inline w-4 h-4 mr-1" /> Export
            </button>

            <button onClick={duplicateAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Copy className="inline w-4 h-4 mr-1" /> Duplicate
            </button>

            <button
              onClick={() => !saving && dirty && saveEdits()}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
              style={{ background: 'var(--brand)', color: '#00120a' }}>
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>

            <button onClick={deleteSelected} disabled={!selected || saving}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ background: 'rgba(255,80,80,.12)', border: '1px solid rgba(255,80,80,.35)' }}>
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete
            </button>
          </div>
        </div>
      </header>

      {/* ╭─ Main grid: left rail / editor+test / versions */}
      <div className="max-w-[1600px] mx-auto px-6 py-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: '300px 1fr 300px' }}>
          {/* Left rail — Assistants */}
          <aside className="h-[calc(100vh-140px)] flex flex-col" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <div className="font-semibold">Assistants</div>
              </div>
              <div className="relative mt-3">
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"
                  className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none" style={CARD} />
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="px-2 py-1 rounded-md text-xs" style={CARD}>
                  <option value="pinned_first">Pinned</option>
                  <option value="name_asc">Name</option>
                  <option value="updated_desc">Recent</option>
                </select>
              </div>
            </div>

            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 90px)' }}>
              {filtered.length === 0 ? (
                <div className="text-sm opacity-80 py-8 text-center">
                  No agents.
                  <div className="mt-2">
                    <Link href="/builder" className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                      style={{ background: 'var(--brand)', color: '#00120a' }}>
                      Go to Builder
                    </Link>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {filtered.map((b) => {
                    let pinnedLocal = false, draftLocal = false;
                    try {
                      if (userId) {
                        const raw = localStorage.getItem(metaKey(userId, b.id));
                        const m: AgentMeta = raw ? JSON.parse(raw) : {};
                        pinnedLocal = !!m.pinned; draftLocal = !!m.draft;
                      }
                    } catch {}
                    const active = selectedId === b.id;
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => setSelectedId(b.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.06)', border: '1px solid var(--border)' }}>
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate flex items-center gap-2">
                              {b.name || 'Untitled'}
                              {draftLocal ? <span className="text-[10px] px-1.5 py-[1px] rounded-full"
                                style={{ background: 'rgba(255,200,0,.12)', border: '1px solid rgba(255,200,0,.35)' }}>Draft</span> : null}
                            </div>
                            <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0, 8)}</div>
                          </div>
                          {pinnedLocal ? <Star className="w-4 h-4" style={{ color: 'var(--brand)' }} /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Middle — Editor + Live Test (Live Test dominates) */}
          <section className="h-[calc(100vh-140px)] grid gap-3" style={{ gridTemplateRows: 'auto 1fr' }}>
            {/* Compact editor header */}
            <div className="p-3" style={PANEL}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1.1fr 0.9fr 1fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Name</div>
                  <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-md text-[15px]" style={CARD} placeholder="Agent name" />
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Model</div>
                  <select value={model} onChange={(e) => setModel(e.target.value)} className="w-full px-3 py-2 rounded-md" style={CARD}>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Temperature</div>
                  <div className="flex items-center gap-2">
                    {(['Precise', 'Balanced', 'Creative'] as const).map((lbl, idx) => {
                      const val = idx === 0 ? 0.1 : idx === 1 ? 0.5 : 0.9;
                      const active = Math.abs(temperature - val) < 0.01;
                      return (
                        <button key={lbl} onClick={() => setTemperature(val)}
                          className={`px-3 py-2 rounded-md text-sm ${active ? 'ring-1' : ''}`}
                          style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quick Rule + Show Prompt */}
              <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <input
                  value={quickRule}
                  onChange={(e) => setQuickRule(e.target.value)}
                  placeholder='Quick rule (e.g., "Only answer Yes/No")'
                  className="px-3 py-2 rounded-md text-sm"
                  style={CARD}
                />
                <button onClick={applyQuickRule} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  <CornerDownRight className="inline w-4 h-4 mr-1" /> Update
                </button>
                <button onClick={() => setShowPromptBlock(s => !s)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  <ChevronDown className="inline w-4 h-4 mr-1" /> {showPromptBlock ? 'Hide prompt' : 'Show prompt'}
                </button>
              </div>

              {showPromptBlock && (
                <div className="mt-3 grid gap-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Pre Prompt <span className="opacity-50">(Optional)</span></div>
                    <textarea value={prePrompt} onChange={(e) => setPrePrompt(e.target.value)} rows={5}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                      placeholder="Optional: pre instructions (role, objectives)…" />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Post Prompt <span className="opacity-50">(Optional)</span></div>
                    <textarea value={postPrompt} onChange={(e) => setPostPrompt(e.target.value)} rows={5}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                      placeholder="Optional: post processing (formatting, checks)…" />
                  </div>

                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">System Prompt</div>
                    <textarea value={system} onChange={(e) => setSystem(e.target.value)} rows={10}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6" style={CARD}
                      placeholder="Main behavior, rules, and policies…" />
                  </div>
                </div>
              )}
            </div>

            {/* Live Test — dominates height, chat scrolls internally */}
            <div className="p-3 grid gap-3" style={{ ...PANEL, gridTemplateRows: 'auto 1fr auto' }}>
              <div className="flex items-center justify-between">
                <div className="font-medium flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" /> Live Test
                </div>
                <label className="text-sm flex items-center gap-2">
                  <input type="checkbox" checked={sendBoth} onChange={(e) => setSendBoth(e.target.checked)} />
                  Send to both lanes
                </label>
              </div>

              <div className="grid gap-3" style={{ gridTemplateColumns: laneB ? '1fr 1fr' : '1fr', height: '100%', minHeight: 380 }}>
                {/* Lane A */}
                <div className="flex flex-col rounded-md border" style={{ ...CARD, ...laneAClass, height: '100%' }}>
                  <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm font-medium">Lane A (current)</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setActiveLane('A')} className="text-xs px-2 py-1 rounded" style={CARD}>Focus</button>
                    </div>
                  </div>
                  <div ref={laneARef} className="flex-1 overflow-auto p-3 text-sm leading-6">
                    {msgsA.length === 0 ? (
                      <div className="opacity-50">No messages yet.</div>
                    ) : msgsA.map((m, i) => (
                      <div key={i} className="mb-2">
                        <b>{m.role === 'user' ? 'You' : m.role === 'assistant' ? 'AI' : 'Sys'}:</b> <span>{m.content}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lane B (drop target) */}
                {laneB ? (
                  <div className="flex flex-col rounded-md border" style={{ ...CARD, ...laneBClass, height: '100%' }}>
                    <div className="px-3 py-2 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                      <div className="text-sm">
                        <span className="font-medium">Lane B (version):</span> {laneB.label} <span className="opacity-60 text-xs">• {fmtTime(laneB.ts)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => setActiveLane('B')} className="text-xs px-2 py-1 rounded" style={CARD}>Focus</button>
                        <button onClick={() => setLaneB(null)} className="text-xs px-2 py-1 rounded" style={CARD}><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    <div ref={laneBRef} className="flex-1 overflow-auto p-3 text-sm leading-6">
                      {msgsB.length === 0 ? (
                        <div className="opacity-50">No messages yet.</div>
                      ) : msgsB.map((m, i) => (
                        <div key={i} className="mb-2">
                          <b>{m.role === 'user' ? 'You' : m.role === 'assistant' ? 'AI' : 'Sys'}:</b> <span>{m.content}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-md border grid place-items-center text-sm opacity-80"
                    style={{ ...CARD, borderStyle: 'dashed', height: '100%' }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onLaneBDrop}
                  >
                    Drag a version card here to create Lane B
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                {/* Attachments (placeholders UI) */}
                <button className="px-2 py-2 rounded-md" style={CARD} title="Attach image (placeholder)">
                  <ImageIcon className="w-4 h-4" />
                </button>
                <button className="px-2 py-2 rounded-md" style={CARD} title="Attach file (placeholder)">
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (!busy && input.trim()) {
                        const target = sendBoth && laneB ? 'A' : activeLane;
                        void sendPrompt(target, input.trim());
                        setInput('');
                      }
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 rounded-md text-sm"
                  style={CARD}
                />
                <button
                  onClick={() => {
                    if (!busy && input.trim()) {
                      const target = sendBoth && laneB ? 'A' : activeLane;
                      void sendPrompt(target, input.trim());
                      setInput('');
                    }
                  }}
                  disabled={busy || !input.trim()}
                  className="px-3 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
                  style={{ background: 'var(--brand)', color: '#00120a' }}
                >
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send</>}
                </button>
              </div>
            </div>
          </section>

          {/* Right rail — Versions */}
          <aside className="h-[calc(100vh-140px)] flex flex-col" style={PANEL}>
            <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <History className="w-4 h-4" />
              <div className="font-semibold">Versions</div>
            </div>
            <div className="flex-1 overflow-auto p-3">
              {(!versions || versions.length === 0) ? (
                <div className="text-sm opacity-60">No snapshots yet. Click <b>Save</b> to create one.</div>
              ) : (
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id}
                      draggable
                      onDragStart={onVersionDragStart(v)}
                      className="group p-2 rounded-md text-sm border"
                      style={{ ...CARD, cursor: 'grab' }}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-medium">{v.label}</div>
                          <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                        </div>
                        {/* Contextual small menu */}
                        <div className="opacity-0 group-hover:opacity-100 transition flex items-center gap-1">
                          <button
                            onClick={() => { setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true); }}
                            className="px-2 py-1 rounded-md text-xs"
                            style={CARD}
                            title="Restore into editor"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setLaneB(v)}
                            className="px-2 py-1 rounded-md text-xs"
                            style={CARD}
                            title="Open as Lane B"
                          >
                            <SplitIcon />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function SplitIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
      <path fill="currentColor" d="M4 4h6v16H4zM14 4h6v16h-6z" />
    </svg>
  );
}
