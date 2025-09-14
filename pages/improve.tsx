// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Settings2, Bot, RefreshCw,
  SlidersHorizontal, History, RotateCcw, ChevronDown, Send, Sparkles,
  Star, StarOff, Filter, Diff, FilePlus2, ToggleLeft, ToggleRight, Undo2, Redo2, Info, X,
  Upload, Download, Wand2, BadgeCheck, Zap, Shield, LayoutGrid, ArrowRightCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { scopedStorage } from '@/utils/scoped-storage';

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
  id: string;
  ts: number;
  label: string;
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
};

// =========================== Styles ===========================
const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--panel) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 6px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 18,
  backdropFilter: 'saturate(120%) blur(6px)',
};

const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 4px 18px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 12,
};

const DENSE_PAD = '12px';

// Moving background grid (decorative)
function BgFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, color-mix(in oklab, var(--brand) 10%, transparent), transparent 60%), radial-gradient(1000px 800px at 110% 120%, color-mix(in oklab, var(--brand) 8%, transparent), transparent 60%)',
        maskImage:
          'radial-gradient(1000px 800px at 0% 0%, #000 40%, transparent), radial-gradient(1000px 800px at 100% 100%, #000 40%, transparent)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[.06] animate-[pan_28s_linear_infinite]"
        style={{
          background:
            'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
          backgroundSize: '32px 32px',
        }}
      />
      <style jsx>{`
        @keyframes pan {
          0% { transform: translateX(0); }
          50% { transform: translateX(16px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

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
function versionsKey(ownerId: string, agentId: string) { return `versions:${ownerId}:${agentId}`; }
function metaKey(ownerId: string, agentId: string) { return `meta:${ownerId}:${agentId}`; }

function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>): string {
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = CHIP_LIBRARY.filter(c => active[c.key]).map(c => `- ${c.line}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}

function estimateTokens(s: string) { return Math.max(1, Math.round((s || '').length / 4)); }

// very light diff
type DiffLine = { type: 'same'|'add'|'del'; text: string };
function simpleDiff(a: string, b: string): DiffLine[] {
  const A = (a || '').split('\n');
  const B = (b || '').split('\n');
  const max = Math.max(A.length, B.length);
  const out: DiffLine[] = [];
  for (let i=0;i<max;i++) {
    const l = A[i], r = B[i];
    if (l === r) out.push({ type:'same', text: r ?? '' });
    else {
      if (l !== undefined) out.push({ type:'del', text: l });
      if (r !== undefined) out.push({ type:'add', text: r });
    }
  }
  return out;
}

function lintPrompt(system: string): string[] {
  const issues: string[] = [];
  if ((system || '').length > 28000) issues.push('Prompt is very long; consider trimming for latency/cost.');
  if (/be polite/i.test(system) && !/examples?/i.test(system)) issues.push('“Be polite” is vague; consider concrete examples.');
  if (!/###/i.test(system)) issues.push('Consider section headers (### …) to structure rules.');
  return issues;
}

function makeUndoStack(initial: string) {
  const stack = [initial];
  let idx = 0;
  return {
    get value(){ return stack[idx]; },
    push(v: string){ if (v === stack[idx]) return; stack.splice(idx+1); stack.push(v); idx = stack.length-1; },
    undo(){ if (idx>0) idx--; return stack[idx]; },
    redo(){ if (idx<stack.length-1) idx++; return stack[idx]; },
    canUndo(){ return idx>0; },
    canRedo(){ return idx<stack.length-1; },
  };
}

// =========================== Component ===========================
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  // sorting/pin
  const [sort, setSort] = useState<'pinned_first'|'name_asc'|'name_desc'|'updated_desc'|'updated_asc'>('pinned_first');

  // editor state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(false);
  const [pinned, setPinned] = useState(false);

  // save state
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // versions
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffWith, setDiffWith] = useState<Version | null>(null);

  // inline test
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<{role:'user'|'assistant', text:string}[]>([]);
  const [testing, setTesting] = useState(false);

  // importer
  const [legacyCount, setLegacyCount] = useState<number>(0);
  const [importing, setImporting] = useState(false);

  // status
  const statusText = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved';

  // undo/redo
  const undoRef = useRef<ReturnType<typeof makeUndoStack> | null>(null);
  useEffect(() => { undoRef.current = makeUndoStack(''); }, []);

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
      // detect legacy builds
      detectLegacy();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]);

  // ---------- detect legacy builds (scopedStorage/localStorage) ----------
  async function detectLegacy() {
    try {
      // Cloud scoped
      let total = 0;
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
        total += (Array.isArray(cloud) ? cloud : []).length;
      } catch {}
      // Local
      try {
        const local = localStorage.getItem('chatbots');
        const list = local ? JSON.parse(local) : [];
        total += (Array.isArray(list) ? list : []).length;
      } catch {}
      setLegacyCount(total);
    } catch { setLegacyCount(0); }
  }

  async function importLegacy() {
    if (!userId) return;
    setImporting(true);
    try {
      const toCreate: Array<{name:string; model:string; temperature:number; system:string}> = [];

      // from scopedStorage
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
        const list = Array.isArray(cloud) ? cloud : [];
        for (const b of list) {
          toCreate.push({
            name: b.name || 'Imported Agent',
            model: b.model || 'gpt-4o-mini',
            temperature: Number(b.temperature ?? 0.5) || 0.5,
            system: b.system || b.prompt || '',
          });
        }
      } catch {}

      // from localStorage
      try {
        const localRaw = localStorage.getItem('chatbots');
        const local = localRaw ? JSON.parse(localRaw) : [];
        const list = Array.isArray(local) ? local : [];
        for (const b of list) {
          toCreate.push({
            name: b.name || 'Imported Agent',
            model: b.model || 'gpt-4o-mini',
            temperature: Number(b.temperature ?? 0.5) || 0.5,
            system: b.system || b.prompt || '',
          });
        }
      } catch {}

      // bulk create
      for (const a of toCreate) {
        await fetch('/api/chatbots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
          body: JSON.stringify(a),
        });
      }
      await fetchBots(userId);
      setLegacyCount(0);
    } catch (e) {
      console.error(e);
    } finally {
      setImporting(false);
    }
  }

  // ---------- load meta/versions on selection ----------
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');

    const next: Record<string, boolean> = {};
    CHIP_LIBRARY.forEach(c => { next[c.key] = (selected.system || '').includes(c.line); });
    setChips(next);

    try {
      const raw = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(raw ? JSON.parse(raw) as Version[] : []);
    } catch { setVersions([]); }

    try {
      const raw = localStorage.getItem(metaKey(userId, selected.id));
      const m = raw ? (JSON.parse(raw) as AgentMeta) : {};
      setPinned(!!m.pinned);
      setDraft(!!m.draft);
      setNotes(m.notes || '');
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, lastOpenedAt: Date.now() }));
    } catch { setPinned(false); setDraft(false); setNotes(''); }

    setDirty(false);
    setTestLog([]);
    if (undoRef.current) undoRef.current = makeUndoStack(selected.system || '');
  }, [selectedId]);

  // ---------- mark dirty ----------
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system !== (selected.system || '')) ||
      (draft !== false) || (pinned !== false) || (notes !== '');
    setDirty(d);
  }, [name, model, temperature, system, draft, pinned, notes, selected]);

  // ---------- keyboard shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saving && dirty) void saveEdits(); }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (undoRef.current?.canUndo()) setSystem(undoRef.current.undo()); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (undoRef.current?.canRedo()) setSystem(undoRef.current.redo()); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, dirty]);

  useEffect(() => { if (undoRef.current) undoRef.current.push(system); }, [system]);

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
  function storeMeta(owner: string, agent: string, meta: AgentMeta) {
    localStorage.setItem(metaKey(owner, agent), JSON.stringify(meta));
  }

  // ---------- actions ----------
  async function saveEdits() {
    if (!userId || !selectedId) return;
    setSaving(true);
    try {
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
      const nextVersions = [v, ...versions].slice(0, 50);
      setVersions(nextVersions);
      storeVersions(userId, selectedId, nextVersions);

      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      const m: AgentMeta = { pinned, draft, notes, lastOpenedAt: Date.now() };
      storeMeta(userId, selectedId, m);

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
      try { localStorage.removeItem(versionsKey(userId, selectedId)); } catch {}
      try { localStorage.removeItem(metaKey(userId, selectedId)); } catch {}
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
    setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true);
  }
  function openDiff(v: Version) { setDiffWith(v); setDiffOpen(true); }

  // soft test: optional backend
  async function runTest(message?: string) {
    const msg = (message ?? testInput).trim();
    if (!msg || !selected) return;
    setTesting(true);
    setTestLog(l => [...l, { role: 'user', text: msg }]);
    try {
      const res = await fetch('/api/assistants/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selected.model, system: selected.system, message: msg }),
      });
      if (!res.ok) throw new Error('No test endpoint configured');
      const json = await res.json();
      const answer = json?.message || '…';
      setTestLog(l => [...l, { role: 'assistant', text: String(answer) }]);
    } catch {
      setTestLog(l => [...l, { role: 'assistant', text: 'No live test endpoint configured. Connect keys or use your chat sandbox.' }]);
    } finally {
      setTesting(false);
      setTestInput('');
    }
  }

  // ---------- filter/sort ----------
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withMeta = list.map(b => {
      let pinned = false, lastOpenedAt = 0;
      try {
        const raw = userId ? localStorage.getItem(metaKey(userId, b.id)) : null;
        const m: AgentMeta = raw ? JSON.parse(raw) : {};
        pinned = !!m.pinned; lastOpenedAt = m.lastOpenedAt || 0;
      } catch {}
      return { b, pinned, lastOpenedAt };
    }).filter(x =>
      !q ||
      (x.b.name || '').toLowerCase().includes(q) ||
      (x.b.model || '').toLowerCase().includes(q) ||
      (x.b.id || '').toLowerCase().includes(q)
    );
    const sorters: Record<typeof sort, (a:any,b:any)=>number> = {
      name_asc:(a,b)=> (a.b.name||'').localeCompare(b.b.name||''),
      name_desc:(a,b)=> (b.b.name||'').localeCompare(a.b.name||''),
      updated_desc:(a,b)=> new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime(),
      updated_asc:(a,b)=> new Date(a.b.updatedAt||0).getTime() - new Date(b.b.updatedAt||0).getTime(),
      pinned_first:(a,b)=> (Number(b.pinned)-Number(a.pinned)) || (new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime()),
    };
    return withMeta.sort(sorters[sort]).map(x=>x.b);
  }, [list, query, sort, userId]);

  // metrics
  const tokenEst = estimateTokens(system);
  const issues = lintPrompt(system);

  // =========================== UI ===========================
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <BgFX />

      {/* Sticky head */}
      <header className="sticky top-0 z-20 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1500px] mx-auto flex items-center gap-3">
          <LayoutGrid className="w-5 h-5" style={{ color:'var(--brand)' }} />
          <h1 className="text-[20px] font-semibold">Agent Tuning</h1>
          <div className="text-xs px-2 py-[2px] rounded-full"
               style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
            {statusText}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <Filter className="w-4 h-4 opacity-70" />
              <select
                value={sort}
                onChange={e=>setSort(e.target.value as any)}
                className="px-2 py-1 rounded-md"
                style={{ ...CARD, padding:DENSE_PAD }}
              >
                <option value="pinned_first">Pinned first</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="updated_desc">Recently updated</option>
                <option value="updated_asc">Least recently updated</option>
              </select>
            </div>
            <button onClick={() => userId && fetchBots(userId)}
              className="px-3 py-1.5 rounded-md text-sm"
              style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>
            <button
              onClick={() => !saving && dirty && saveEdits()}
              disabled={!dirty || saving}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ background:'var(--brand)', color:'#00120a' }}>
              <Save className="inline w-4 h-4 mr-1" /> Save (⌘/Ctrl+S)
            </button>
          </div>
        </div>
      </header>

      {/* Legacy import banner */}
      {legacyCount > 0 && userId && (
        <div className="mx-auto w-full max-w-[1500px] px-6 pt-3">
          <div className="p-3 rounded-xl flex items-center gap-3"
               style={{ ...CARD, borderColor:'var(--brand)' }}>
            <BadgeCheck className="w-4 h-4" style={{ color:'var(--brand)' }} />
            <div className="text-sm">
              Found <b>{legacyCount}</b> previous builds (local/cloud). Import them to your account agents.
            </div>
            <div className="ml-auto flex gap-2">
              <button
                onClick={importLegacy}
                disabled={importing}
                className="px-3 py-1.5 rounded-md text-sm"
                style={{ background:'var(--brand)', color:'#00120a' }}
              >
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightCircle className="w-4 h-4 inline mr-1" />}
                Import builds
              </button>
              <button
                onClick={()=>setLegacyCount(0)}
                className="px-3 py-1.5 rounded-md text-sm"
                style={{ ...CARD }}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-[1500px] px-6 py-5">
        <div className="grid" style={{ gridTemplateColumns: '300px 1.1fr 0.9fr', gap: '14px' }}>
          {/* Left rail */}
          <aside className="p-[10px]" style={PANEL}>
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
                  {filtered.map((b) => {
                    let pinnedLocal = false; let draftLocal = false;
                    try {
                      const raw = userId ? localStorage.getItem(metaKey(userId, b.id)) : null;
                      const m: AgentMeta = raw ? JSON.parse(raw) : {};
                      pinnedLocal = !!m.pinned; draftLocal = !!m.draft;
                    } catch {}
                    return (
                      <li key={b.id}>
                        <button
                          onClick={() => setSelectedId(b.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${selectedId === b.id ? 'ring-1' : ''}`}
                          style={{
                            ...CARD,
                            borderColor: selectedId === b.id ? 'var(--brand)' : 'var(--border)',
                            transform: selectedId === b.id ? 'translateY(-1px)' : 'none'
                          }}
                        >
                          <div className="w-7 h-7 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--border)' }}>
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate flex items-center gap-2">
                              {b.name || 'Untitled'}
                              {draftLocal ? <span className="text-[10px] px-1.5 py-[1px] rounded-full" style={{ background:'rgba(255,200,0,.12)', border:'1px solid rgba(255,200,0,.35)' }}>Draft</span> : null}
                            </div>
                            <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0, 8)}</div>
                          </div>
                          {pinnedLocal ? <Star className="w-4 h-4" style={{ color:'var(--brand)' }} /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Editor */}
          <section className="p-[10px] space-y-3" style={PANEL}>
            {!selected ? (
              <div className="grid place-items-center h-[60vh] opacity-70">
                {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Settings2 className="w-4 h-4" style={{ color:'var(--brand)' }} />
                  <div className="font-semibold">Editor</div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={()=>{ setPinned(p=>!p); setDirty(true); }} className="px-2 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
                      {pinned ? <><Star className="inline w-4 h-4 mr-1" />Pinned</> : <><StarOff className="inline w-4 h-4 mr-1" />Pin</>}
                    </button>
                    <button onClick={()=>{ setDraft(d=>!d); setDirty(true); }} className="px-2 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
                      {draft ? <><ToggleLeft className="inline w-4 h-4 mr-1" />Draft</> : <><ToggleRight className="inline w-4 h-4 mr-1" />Published</>}
                    </button>
                    <button onClick={duplicateAgent} className="px-2 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
                      <FilePlus2 className="inline w-4 h-4 mr-1" /> Duplicate
                    </button>
                    <button onClick={exportAgent} className="px-2 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
                      <Download className="inline w-4 h-4 mr-1" /> Export
                    </button>
                    <label className="px-2 py-1.5 rounded-md text-sm cursor-pointer" style={{ ...CARD }}>
                      <Upload className="inline w-4 h-4 mr-1" /> Import
                      <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
                    </label>
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

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap:'10px' }}>
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

                  <div className="grid grid-cols-2 gap-2">
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

                {/* System Prompt + metrics + lint */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-xs opacity-70">System Prompt</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => { if (undoRef.current?.canUndo()) setSystem(undoRef.current.undo()); }}
                        disabled={!undoRef.current?.canUndo()}
                        className="px-2 py-1 rounded-md text-xs disabled:opacity-50"
                        style={{ ...CARD }}
                      >
                        <Undo2 className="inline w-3.5 h-3.5 mr-1" /> Undo
                      </button>
                      <button
                        onClick={() => { if (undoRef.current?.canRedo()) setSystem(undoRef.current.redo()); }}
                        disabled={!undoRef.current?.canRedo()}
                        className="px-2 py-1 rounded-md text-xs disabled:opacity-50"
                        style={{ ...CARD }}
                      >
                        <Redo2 className="inline w-3.5 h-3.5 mr-1" /> Redo
                      </button>
                    </div>
                  </div>

                  <textarea
                    value={system}
                    onChange={(e) => setSystem(e.target.value)}
                    rows={16}
                    className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                    style={CARD}
                    placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                  />
                  <div className="flex items-center justify-between text-xs mt-1">
                    <div className="opacity-70">{(system?.length || 0).toLocaleString()} chars · est {estimateTokens(system).toLocaleString()} tokens</div>
                    {issues.length ? (
                      <div className="flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" style={{ color:'gold' }} />
                        <span className="opacity-80">{issues[0]}{issues.length>1 ? ` (+${issues.length-1} more)` : ''}</span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <div className="text-xs mb-1 opacity-70">Notes (private)</div>
                  <textarea
                    value={notes}
                    onChange={e=>setNotes(e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 rounded-md outline-none text-sm"
                    style={CARD}
                    placeholder="Any context for teammates or yourself…"
                  />
                </div>
              </>
            )}
          </section>

          {/* Versions + Test (featureful right rail) */}
          <aside className="p-[10px] space-y-3" style={PANEL}>
            {/* Versions */}
            <div className="p-[10px]" style={CARD}>
              <button onClick={() => setVersionsOpen(v => !v)} className="w-full flex items-center justify-between">
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
                      Versions are created when you click <b>Save</b>. Restore or diff any snapshot.
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
                      <button
                        onClick={() => { setDiffWith(v); setDiffOpen(true); }}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ ...CARD }}
                      >
                        <Diff className="inline w-3 h-3 mr-1" />
                        Diff
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

              <div className="flex flex-wrap gap-2">
                {['Greet me', 'Refund policy?', 'One-sentence summary', 'Answer Yes/No only'].map(t => (
                  <button key={t} onClick={()=>runTest(t)} className="px-2 py-1 rounded-md text-xs"
                          style={{ background:'color-mix(in oklab, var(--text) 7%, transparent)', border:'1px solid var(--border)' }}>
                    {t}
                  </button>
                ))}
              </div>

              <div className="space-y-2 max-h-[40vh] overflow-auto rounded-md p-2"
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
                  onClick={() => runTest()}
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

      {/* Diff modal */}
      {diffOpen && diffWith && selected && (
        <div className="fixed inset-0 z-50 bg-black/70 grid place-items-center px-4">
          <div className="w-full max-w-5xl rounded-[16px] p-4" style={{ ...PANEL, borderRadius:16 }}>
            <div className="flex items-center gap-2 mb-3">
              <Diff className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Diff: current vs “{diffWith.label}”</div>
              <button onClick={()=>setDiffOpen(false)} className="ml-auto rounded-md px-2 py-1" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
              <div className="text-xs opacity-70">Current</div>
              <div className="text-xs opacity-70">Snapshot @ {fmtTime(diffWith.ts)}</div>
              <div className="p-2 rounded-md" style={{ ...CARD, maxHeight:'60vh', overflow:'auto' }}>
                {simpleDiff(diffWith.system, system).map((ln,i)=>(
                  <div key={i} style={{
                    whiteSpace:'pre-wrap',
                    background: ln.type==='add' ? 'rgba(0,200,120,.08)' : ln.type==='del' ? 'rgba(255,80,80,.08)' : 'transparent'
                  }}>
                    {ln.text}
                  </div>
                ))}
              </div>
              <div className="p-2 rounded-md" style={{ ...CARD, maxHeight:'60vh', overflow:'auto' }}>
                {simpleDiff(system, diffWith.system).map((ln,i)=>(
                  <div key={i} style={{
                    whiteSpace:'pre-wrap',
                    background: ln.type==='add' ? 'rgba(0,200,120,.08)' : ln.type==='del' ? 'rgba(255,80,80,.08)' : 'transparent'
                  }}>
                    {ln.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
