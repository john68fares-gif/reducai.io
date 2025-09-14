// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Settings2, Bot, RefreshCw,
  SlidersHorizontal, History, RotateCcw, ChevronDown, Send, Sparkles,
  Star, StarOff, Filter, Diff, FilePlus2, ToggleLeft, ToggleRight,
  Undo2, Redo2, Info, X, Upload, Download, Shield, Code2,
  SplitSquareHorizontal, PanelLeftClose, PanelRightClose, Tag, HelpCircle, Copy, Check, PanelsTopLeft
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/**
 * IMPORTANT
 * - No backend changes. Uses:
 *   GET    /api/chatbots?ownerId=...    (header x-owner-id)
 *   PATCH  /api/chatbots/[id]           (header x-owner-id)
 *   DELETE /api/chatbots/[id]           (header x-owner-id)
 *   POST   /api/chatbots                (header x-owner-id)  // duplicate/import
 *   POST   /api/assistants/chat         (optional test endpoint; safe if missing)
 *
 * - Dense, featureful UI with smooth animations and site-matching colors.
 * - All advanced features are client-side (localStorage) so nothing breaks.
 */

/* ─────────────────────────────────── Types ─────────────────────────────────── */
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
  tags?: string[];
  guardrails?: { blockedPhrases: string[]; enforceJson: boolean; jsonSchemaHint?: string };
  promptStack?: { pre: string; main: string; post: string };
  conditional?: Array<{ when: string; rule: string }>;
  perFlowTemp?: { greeting: number; qa: number; actions: number };
  theme?: 'auto' | 'dark' | 'light' | 'neon';
  audit?: Array<{ at: number; action: string }>;
};

/* ─────────────────────────────────── Styles ─────────────────────────────────── */
const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--panel) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 6px 30px rgba(0,0,0,.25), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 20,
  backdropFilter: 'saturate(120%) blur(6px)',
};

const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 4px 18px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 14,
};

const DENSE_PAD = '12px';

/* Subtle animated background grid with gradients */
function BgFX() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, color-mix(in oklab, var(--brand) 10%, transparent), transparent 60%), radial-gradient(1000px 800px at 110% 120%, color-mix(in oklab, var(--brand) 8%, transparent), transparent 60%)',
        maskImage:
          'radial-gradient(1200px 900px at 0% 0%, #000 40%, transparent), radial-gradient(1200px 900px at 100% 100%, #000 40%, transparent)',
      }}
    >
      <div
        className="absolute inset-0 opacity-[.06] animate-[gridpan_28s_linear_infinite]"
        style={{
          background:
            'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
          backgroundSize: '32px 32px',
        }}
      />
      <style jsx>{`
        @keyframes gridpan {
          0% { transform: translateX(0); }
          50% { transform: translateX(16px); }
          100% { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

/* Windows logo (inline SVG) to display Win+S etc. */
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M2 4l9-1.5v9L2 11V4Zm10 0l10-1.7v10.2L12 12V4Zm-10 9l9 0.5v9L2 20v-7Zm10 0l10 0.6V22L12 20v-7Z" />
    </svg>
  );
}

/* ───────────────────────────── Helpers / Constants ───────────────────────────── */
const CHIP_LIBRARY = [
  { key: 'yes_no', group: 'Format', label: 'Only answer Yes/No', line: 'Respond strictly with “Yes” or “No” unless explicitly asked to elaborate.' },
  { key: 'concise', group: 'Tone', label: 'Be concise', line: 'Keep responses under 1–2 sentences unless more detail is requested.' },
  { key: 'ask_clarify', group: 'Guardrails', label: 'Ask clarifying first', line: 'If the request is ambiguous, ask a concise clarifying question before answering.' },
  { key: 'no_greeting', group: 'Tone', label: 'No greeting', line: 'Do not start with greetings or pleasantries; go straight to the answer.' },
];

const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
function fmtTime(ts: number) { return new Date(ts).toLocaleString(); }
function versionsKey(ownerId: string, agentId: string) { return `versions:${ownerId}:${agentId}`; }
function metaKey(ownerId: string, agentId: string) { return `meta:${ownerId}:${agentId}`; }
function estimateTokens(s: string) { return Math.max(1, Math.round((s || '').length / 4)); }

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

function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>): string {
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = CHIP_LIBRARY.filter(c => active[c.key]).map(c => `- ${c.line}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}

/* Tiny line diff for modal */
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

/* ─────────────────────────────────── Component ─────────────────────────────────── */
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);

  /* Layout: rail collapse + split pane */
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [colRatio, setColRatio] = useState(0.60); // editor width ratio (0..1)
  const dragRef = useRef<{dragging:boolean; startX:number; startRatio:number}>({dragging:false,startX:0,startRatio:0});

  /* Sorting / tags */
  const [sort, setSort] = useState<'pinned_first'|'name_asc'|'name_desc'|'updated_desc'|'updated_asc'>('pinned_first');
  const [tagFilter, setTagFilter] = useState<string>('');

  /* Editor state */
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
  const [tags, setTags] = useState<string[]>([]);

  /* Stack / Guardrails / Conditionals / Flow temps */
  const [promptPre, setPromptPre] = useState('');
  const [promptPost, setPromptPost] = useState('');
  const [blockedPhrases, setBlockedPhrases] = useState<string>('');
  const [enforceJson, setEnforceJson] = useState(false);
  const [jsonSchemaHint, setJsonSchemaHint] = useState('');
  const [conditionals, setConditionals] = useState<Array<{when:string;rule:string}>>([]);
  const [flowTemps, setFlowTemps] = useState({ greeting: 0.5, qa: 0.5, actions: 0.5 });

  /* Save state + autosave */
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const autosaveTimer = useRef<number | null>(null);

  /* Versions / Diff */
  const [versions, setVersions] = useState<Version[]>([]);
  const [versionsOpen, setVersionsOpen] = useState(true);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffWith, setDiffWith] = useState<Version | null>(null);

  /* Test */
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<{role:'user'|'assistant', text:string}[]>([]);
  const [testing, setTesting] = useState(false);

  /* Status / feedback */
  const [copied, setCopied] = useState(false);
  const statusText = saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓';

  /* Undo/redo */
  const undoRef = useRef<ReturnType<typeof makeUndoStack> | null>(null);
  useEffect(() => { undoRef.current = makeUndoStack(''); }, []);

  /* Boot: user id */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const uid = data?.user?.id || null;
      setUserId(uid);
    })();
  }, []);

  /* Fetch bots */
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
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]);

  /* Load meta/versions on selection */
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
      setTags(Array.isArray(m.tags) ? m.tags : []);

      setPromptPre(m.promptStack?.pre || '');
      setPromptPost(m.promptStack?.post || '');
      setConditionals(Array.isArray(m.conditional) ? m.conditional : []);
      setFlowTemps(m.perFlowTemp || { greeting:0.5, qa:0.5, actions:0.5 });

      setBlockedPhrases((m.guardrails?.blockedPhrases || []).join('\n'));
      setEnforceJson(!!m.guardrails?.enforceJson);
      setJsonSchemaHint(m.guardrails?.jsonSchemaHint || '');

      // soft theme & audit not used visually for now, but preserved
      const audit = Array.isArray(m.audit) ? m.audit : [];
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, lastOpenedAt: Date.now(), audit }));
    } catch {
      setPinned(false); setDraft(false); setNotes(''); setTags([]);
      setPromptPre(''); setPromptPost(''); setConditionals([]); setFlowTemps({greeting:0.5,qa:0.5,actions:0.5});
      setBlockedPhrases(''); setEnforceJson(false); setJsonSchemaHint('');
    }

    setDirty(false);
    setTestLog([]);
    if (undoRef.current) undoRef.current = makeUndoStack(selected.system || '');
  }, [selectedId, userId, selected]);

  /* Mark dirty + autosave */
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system !== (selected.system || '')) ||
      (draft !== false) || (pinned !== false) || (notes !== '') ||
      (tags.length > 0) || (promptPre !== '') || (promptPost !== '') ||
      (blockedPhrases !== '') || enforceJson || (jsonSchemaHint !== '') ||
      (conditionals.length > 0) ||
      (Math.abs(flowTemps.greeting-0.5)>1e-9 || Math.abs(flowTemps.qa-0.5)>1e-9 || Math.abs(flowTemps.actions-0.5)>1e-9);
    setDirty(d);

    // autosave debounce
    if (autosave) {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = window.setTimeout(() => {
        if (d && !saving) saveEdits(true);
      }, 1200) as any;
    }
  }, [name, model, temperature, system, draft, pinned, notes, tags, promptPre, promptPost, blockedPhrases, enforceJson, jsonSchemaHint, conditionals, flowTemps, selected, autosave, saving]);

  /* Keyboard shortcuts (Win+S displayed; supports Ctrl/Cmd) */
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

  function addAudit(action: string) {
    if (!userId || !selected) return;
    try {
      const raw = localStorage.getItem(metaKey(userId, selected.id));
      const m: AgentMeta = raw ? JSON.parse(raw) : {};
      const audit = Array.isArray(m.audit) ? m.audit : [];
      audit.unshift({ at: Date.now(), action });
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, audit: audit.slice(0, 100) }));
    } catch {}
  }

  /* Chips */
  function setChip(key: string, val: boolean) {
    const next = { ...chips, [key]: val };
    setChips(next);
    setSystem(s => applyRefinementsToSystem(s, next));
  }
  function toggleChip(key: string) { setChip(key, !chips[key]); addAudit(`toggle chip: ${key}`); }

  /* Storage helpers */
  function storeVersions(owner: string, agent: string, arr: Version[]) {
    localStorage.setItem(versionsKey(owner, agent), JSON.stringify(arr));
  }
  function storeMeta(owner: string, agent: string, meta: AgentMeta) {
    localStorage.setItem(metaKey(owner, agent), JSON.stringify(meta));
  }

  /* Actions */
  async function saveEdits(silent = false) {
    if (!userId || !selectedId) return;
    if (!silent) setSaving(true);
    try {
      const prev = list.find(b => b.id === selectedId) || null;
      const candidate: BotRow = {
        id: selectedId, ownerId: userId, name, model, temperature, system,
        createdAt: prev?.createdAt, updatedAt: new Date().toISOString()
      };
      // version snapshot
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

      // persist core fields
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      // meta (client-only)
      const m: AgentMeta = {
        pinned, draft, notes, lastOpenedAt: Date.now(), tags,
        promptStack: { pre: promptPre, main: '', post: promptPost },
        conditional: conditionals,
        guardrails: {
          blockedPhrases: blockedPhrases.split('\n').map(s => s.trim()).filter(Boolean),
          enforceJson,
          jsonSchemaHint: jsonSchemaHint || undefined,
        },
        perFlowTemp: flowTemps,
      };
      storeMeta(userId, selectedId, m);

      await fetchBots(userId);
      setSelectedId(selectedId);
      setDirty(false);
      addAudit('save');
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    } finally {
      if (!silent) setSaving(false);
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
      addAudit('delete');
    } catch (e: any) {
      alert(e?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  async function duplicateAgent() {
    if (!selected || !userId) return;
    const cloneName = `${selected.name || 'Untitled'} (Copy)`;
    try {
      const resp = await fetch('/api/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({
          name: cloneName,
          model: selected.model,
          temperature: selected.temperature,
          system: selected.system,
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok || !json?.data?.id) throw new Error(json?.error || 'Failed to duplicate');
      await fetchBots(userId);
      setSelectedId(json.data.id);
      addAudit('duplicate');
    } catch (e: any) { alert(e?.message || 'Failed to duplicate'); }
  }

  function exportAgent() {
    if (!selected) return;
    const payload = {
      type: 'reduc.ai/agent',
      version: 1,
      agent: {
        id: selected.id,
        name, model, temperature, system,
        meta: {
          notes, pinned, draft, tags,
          promptStack: { pre: promptPre, main: '', post: promptPost },
          conditional: conditionals,
          guardrails: {
            blockedPhrases: blockedPhrases.split('\n').map(s=>s.trim()).filter(Boolean),
            enforceJson, jsonSchemaHint
          },
          perFlowTemp: flowTemps,
        },
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${(name||'agent').replace(/\s+/g,'_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addAudit('export');
  }

  async function importAgent(file: File) {
    if (!userId) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const a = parsed?.agent || parsed;
      const res = await fetch('/api/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({
          name: a.name || 'Imported Agent',
          model: a.model || 'gpt-4o-mini',
          temperature: typeof a.temperature === 'number' ? a.temperature : 0.5,
          system: a.system || '',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to import');
      const newId = json.data.id as string;
      const meta: AgentMeta = a.meta || {};
      storeMeta(userId, newId, meta);
      await fetchBots(userId);
      setSelectedId(newId);
      addAudit('import');
    } catch (e: any) { alert(e?.message || 'Import failed'); }
  }

  function restoreVersion(v: Version) {
    setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true);
    addAudit(`restore version: ${v.label}`);
  }
  function openDiff(v: Version) { setDiffWith(v); setDiffOpen(true); }

  /* Test (optional backend) */
  async function runTest(message?: string) {
    const msg = (message ?? testInput).trim();
    if (!msg || !selected) return;
    setTesting(true);
    setTestLog(l => [...l, { role: 'user', text: msg }]);
    try {
      const res = await fetch('/api/assistants/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selected.model, system, message: msg }),
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

  /* Stress test (simulated, local so it never breaks) */
  async function stressTest() {
    if (!selected) return;
    setTesting(true);
    setTestLog(l => [...l, { role: 'user', text: 'Running stress test (×50)…' }]);
    await new Promise(r => setTimeout(r, 600));
    setTestLog(l => [...l, { role: 'assistant', text: 'Consistency ~95%, avg output 12 words (simulated).' }]);
    setTesting(false);
  }

  /* Filters/sort */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const withMeta = list.map(b => {
      let pinned = false, lastOpenedAt = 0, tags: string[] = [];
      try {
        if (userId) {
          const raw = localStorage.getItem(metaKey(userId, b.id));
          const m: AgentMeta = raw ? JSON.parse(raw) : {};
          pinned = !!m.pinned; lastOpenedAt = m.lastOpenedAt || 0; tags = m.tags || [];
        }
      } catch {}
      return { b, pinned, lastOpenedAt, tags };
    }).filter(x => {
      const passQ = !q ||
        (x.b.name || '').toLowerCase().includes(q) ||
        (x.b.model || '').toLowerCase().includes(q) ||
        (x.b.id || '').toLowerCase().includes(q);
      const passTag = !tagFilter || x.tags.includes(tagFilter);
      return passQ && passTag;
    });
    const sorters: Record<typeof sort, (a:any,b:any)=>number> = {
      name_asc:(a,b)=> (a.b.name||'').localeCompare(b.b.name||''),
      name_desc:(a,b)=> (b.b.name||'').localeCompare(a.b.name||''),
      updated_desc:(a,b)=> new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime(),
      updated_asc:(a,b)=> new Date(a.b.updatedAt||0).getTime() - new Date(b.b.updatedAt||0).getTime(),
      pinned_first:(a,b)=> (Number(b.pinned)-Number(a.pinned)) || (new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime()),
    };
    return withMeta.sort(sorters[sort]).map(x=>x.b);
  }, [list, query, sort, userId, tagFilter]);

  /* Metrics */
  const tokenEst = estimateTokens(system);
  const issues = lintPrompt(system);

  /* Split drag handlers */
  function onDragStart(e: React.MouseEvent) {
    dragRef.current = { dragging: true, startX: e.clientX, startRatio: colRatio };
    window.addEventListener('mousemove', onDragMove as any);
    window.addEventListener('mouseup', onDragEnd as any, { once: true });
  }
  function onDragMove(e: MouseEvent) {
    if (!dragRef.current.dragging) return;
    const delta = e.clientX - dragRef.current.startX;
    const container = document.getElementById('improve-split');
    if (!container) return;
    const w = container.getBoundingClientRect().width;
    const newRatio = Math.min(0.8, Math.max(0.35, dragRef.current.startRatio + (delta / w)));
    setColRatio(newRatio);
  }
  function onDragEnd() {
    dragRef.current.dragging = false;
    window.removeEventListener('mousemove', onDragMove as any);
  }

  /* Tag helpers */
  function addTag(t: string) { if (!t) return; if (!tags.includes(t)) { setTags([...tags, t]); addAudit(`add tag: ${t}`); } }
  function removeTag(t: string) { setTags(tags.filter(x => x !== t)); addAudit(`remove tag: ${t}`); }

  /* Copy ID helper */
  async function copyId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(()=>setCopied(false), 1200); } catch {}
  }

  /* UI */
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <BgFX />

      {/* Sticky header */}
      <header className="sticky top-0 z-30 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1700px] mx-auto flex items-center gap-3">
          <SplitSquareHorizontal className="w-5 h-5" style={{ color:'var(--brand)' }} />
          <h1 className="text-[21px] font-semibold">{selected ? (selected.name || 'Agent') : 'Agent Tuning'}</h1>

          <span className="text-xs px-2 py-[2px] rounded-full"
                style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
            {statusText}
          </span>

          {selected && (
            <button onClick={copyId} className="text-xs px-2 py-1 rounded-md hover:opacity-90"
                    style={{ ...CARD, marginLeft: 6 }}>
              {copied ? <><Check className="inline w-3.5 h-3.5 mr-1" /> Copied</> : <><Copy className="inline w-3.5 h-3.5 mr-1" /> ID</>}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Sort + Tag filter */}
            <div className="hidden lg:flex items-center gap-2">
              <Filter className="w-4 h-4 opacity-70" />
              <select
                value={sort}
                onChange={e=>setSort(e.target.value as any)}
                className="px-2 py-1 rounded-md text-sm"
                style={{ ...CARD, padding:DENSE_PAD }}
              >
                <option value="pinned_first">Pinned first</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
                <option value="updated_desc">Recently updated</option>
                <option value="updated_asc">Least recently updated</option>
              </select>
              <div className="flex items-center gap-1">
                <Tag className="w-4 h-4 opacity-70" />
                <input
                  placeholder="Filter tag"
                  value={tagFilter}
                  onChange={(e)=>setTagFilter(e.target.value)}
                  className="px-2 py-1 rounded-md text-sm"
                  style={{ ...CARD, padding:DENSE_PAD, width: 130 }}
                />
              </div>
            </div>

            <button onClick={() => userId && fetchBots(userId)}
              className="px-3 py-1.5 rounded-md text-sm"
              style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>

            <label className="px-3 py-1.5 rounded-md text-sm cursor-pointer"
                   style={{ ...CARD }}>
              <Upload className="inline w-4 h-4 mr-1" /> Import
              <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
            </label>

            <button onClick={exportAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Download className="inline w-4 h-4 mr-1" /> Export
            </button>

            <button
              onClick={() => !saving && dirty && saveEdits()}
              disabled={!dirty || saving}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
              style={{ background:'var(--brand)', color:'#00120a' }}>
              <Save className="w-4 h-4" />
              <span>Save</span>
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] px-1.5 py-[1px] rounded"
                    style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                <WindowsIcon className="w-3 h-3" />+S
              </span>
            </button>

            <button
              onClick={deleteSelected}
              disabled={saving || !selected}
              className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
              style={{ background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.35)' }}
            >
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <div className="mx-auto w-full max-w-[1700px] px-6 py-5">
        <div className="flex gap-3">
          {/* Left rail */}
          <aside className={`transition-all ${leftCollapsed ? 'w-[56px]' : 'w-[320px]'}`}>
            <div className="p-[10px]" style={PANEL}>
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
                {!leftCollapsed && <div className="font-semibold">Assistants</div>}
                <button
                  onClick={()=>setLeftCollapsed(v=>!v)}
                  className="ml-auto px-2 py-1 rounded-md"
                  style={{ ...CARD }}
                  title={leftCollapsed ? 'Expand' : 'Collapse'}
                >
                  {leftCollapsed ? <PanelRightClose className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                </button>
              </div>

              {!leftCollapsed && (
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
              )}

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
                      let pinnedLocal = false; let draftLocal = false; let tagsLocal: string[] = [];
                      try {
                        if (userId) {
                          const raw = localStorage.getItem(metaKey(userId, b.id));
                          const m: AgentMeta = raw ? JSON.parse(raw) : {};
                          pinnedLocal = !!m.pinned; draftLocal = !!m.draft; tagsLocal = m.tags || [];
                        }
                      } catch {}
                      const active = selectedId === b.id;
                      return (
                        <li key={b.id}>
                          <button
                            onClick={() => setSelectedId(b.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                            style={{
                              ...CARD,
                              borderColor: active ? 'var(--brand)' : 'var(--border)',
                              transform: active ? 'translateY(-1px)' : 'none',
                              boxShadow: active ? '0 8px 18px rgba(0,0,0,.3)' : CARD.boxShadow as string
                            }}
                          >
                            <div className="w-8 h-8 rounded-md grid place-items-center animate-pulse"
                                 style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--border)' }}>
                              <Bot className="w-4 h-4" />
                            </div>
                            {!leftCollapsed && (
                              <div className="flex-1 min-w-0">
                                <div className="truncate flex items-center gap-2">
                                  {b.name || 'Untitled'}
                                  {draftLocal ? <span className="text-[10px] px-1.5 py-[1px] rounded-full" style={{ background:'rgba(255,200,0,.12)', border:'1px solid rgba(255,200,0,.35)' }}>Draft</span> : null}
                                </div>
                                <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0, 8)}</div>
                                {tagsLocal.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {tagsLocal.slice(0,3).map(t => (
                                      <span key={t} className="text-[10px] px-1 py-[1px] rounded"
                                            style={{ background:'rgba(0,0,0,.15)', border:'1px solid var(--border)' }}>{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            {pinnedLocal ? <Star className="w-4 h-4" style={{ color:'var(--brand)' }} /> : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </aside>

          {/* Split: Editor | Right */}
          <div id="improve-split" className="flex-1 grid gap-3 transition-[grid-template-columns]" style={{ gridTemplateColumns: `${Math.round(colRatio*100)}% 10px 1fr` }}>
            {/* Editor panel */}
            <section className="p-[12px]" style={PANEL}>
              {!selected ? (
                <div className="grid place-items-center h-[60vh] opacity-70">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-5 h-5" style={{ color:'var(--brand)' }} />
                    <div className="font-semibold text-[15px]">Editor</div>
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
                      <button
                        onClick={() => !saving && dirty && saveEdits()}
                        disabled={!dirty || saving}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                        style={{ background:'var(--brand)', color:'#00120a' }}
                      >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save
                        <span className="ml-1 inline-flex items-center gap-1 text-[11px] px-1.5 py-[1px] rounded"
                              style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                          <WindowsIcon className="w-3 h-3" />+S
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap:'12px' }}>
                    <div>
                      <div className="text-xs mb-1 opacity-70">Name</div>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 rounded-md outline-none text-[15px]"
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

                  {/* Tags */}
                  <div>
                    <div className="text-xs mb-1 opacity-70">Tags</div>
                    <div className="flex items-center gap-2">
                      <input
                        placeholder="Add tag and press Enter"
                        onKeyDown={(e:any)=>{ if(e.key==='Enter'){ addTag((e.target.value||'').trim()); e.target.value=''; }}}
                        className="px-3 py-2 rounded-md text-sm flex-1"
                        style={CARD}
                      />
                      <div className="flex flex-wrap gap-2">
                        {tags.map(t => (
                          <span key={t} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                            {t} <button className="ml-1 opacity-70" onClick={()=>removeTag(t)}>×</button>
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Refinements */}
                  <div>
                    <div className="text-xs mb-1 opacity-70">Refinements</div>
                    <div className="flex flex-wrap gap-2">
                      {['Tone','Format','Guardrails'].map(group => (
                        <div key={group} className="p-2 rounded-md" style={{ ...CARD }}>
                          <div className="text-[11px] mb-1 opacity-70">{group}</div>
                          <div className="flex flex-wrap gap-2">
                            {CHIP_LIBRARY.filter(c=>c.group===group).map(c => (
                              <button
                                key={c.key}
                                onClick={() => toggleChip(c.key)}
                                title={c.line}
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
                      ))}
                    </div>
                  </div>

                  {/* Prompt Stack */}
                  <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap:'12px' }}>
                    <div>
                      <div className="text-xs mb-1 opacity-70">Pre Prompt (runs before main)</div>
                      <textarea
                        value={promptPre}
                        onChange={(e)=>setPromptPre(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                        style={CARD}
                        placeholder="Optional: pre instructions (role, objectives)…"
                      />
                    </div>
                    <div>
                      <div className="text-xs mb-1 opacity-70">Post Prompt (runs after main)</div>
                      <textarea
                        value={promptPost}
                        onChange={(e)=>setPromptPost(e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                        style={CARD}
                        placeholder="Optional: post processing (formatting, checks)…"
                      />
                    </div>
                  </div>

                  {/* System Prompt */}
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
                      rows={18}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6"
                      style={CARD}
                      placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                      onKeyDown={(e) => {
                        // Easter egg: type /refine + Enter to inject a refinement header
                        const el = e.target as HTMLTextAreaElement;
                        if (e.key === 'Enter' && el.value.endsWith('/refine')) {
                          e.preventDefault();
                          const nv = el.value.replace(/\/refine$/, `${REFINEMENT_HEADER}\n- Keep answers short and precise.\n- Ask a question if user intent is unclear.\n\n`);
                          setSystem(nv);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="opacity-70">{(system?.length || 0).toLocaleString()} chars · est {tokenEst.toLocaleString()} tokens</div>
                      {issues.length ? (
                        <div className="flex items-center gap-2">
                          <Info className="w-3.5 h-3.5" style={{ color:'gold' }} />
                          <span className="opacity-80">{issues[0]}{issues.length>1 ? ` (+${issues.length-1} more)` : ''}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Guardrails / Flow temps */}
                  <div className="grid" style={{ gridTemplateColumns: '1.15fr 0.85fr', gap:'12px' }}>
                    <div className="p-2" style={CARD}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Shield className="w-4 h-4" style={{ color:'var(--brand)' }} /> Guardrails
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="text-xs mb-1 opacity-70">Blocked phrases (one per line)</div>
                          <textarea value={blockedPhrases} onChange={e=>setBlockedPhrases(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-md text-sm outline-none" style={CARD} />
                        </div>
                        <div>
                          <div className="text-xs mb-1 opacity-70">Require JSON output</div>
                          <label className="flex items-center gap-2 text-sm mb-2">
                            <input type="checkbox" checked={enforceJson} onChange={e=>setEnforceJson(e.target.checked)} /> Enforce JSON
                          </label>
                          <div className="text-xs mb-1 opacity-70">JSON schema hint (optional)</div>
                          <textarea value={jsonSchemaHint} onChange={e=>setJsonSchemaHint(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-md text-sm outline-none" style={CARD} placeholder='{"type":"object","properties":{...}}' />
                        </div>
                      </div>
                    </div>

                    <div className="p-2" style={CARD}>
                      <div className="flex items-center gap-2 mb-2 font-semibold">
                        <Code2 className="w-4 h-4" style={{ color:'var(--brand)' }} /> Flow Temperatures
                      </div>
                      {(['greeting','qa','actions'] as const).map(k=>(
                        <div key={k} className="mb-2">
                          <div className="text-xs mb-1 opacity-70 capitalize">{k} ({flowTemps[k].toFixed(2)})</div>
                          <input type="range" min={0} max={1} step={0.01} value={flowTemps[k]} onChange={(e)=>setFlowTemps(prev=>({...prev,[k]:parseFloat(e.target.value)}))} className="w-full" />
                        </div>
                      ))}
                      <div className="text-[11px] opacity-60 mt-2">These are saved in client meta only.</div>
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

                  {/* Footer quick toggles */}
                  <div className="flex items-center gap-3">
                    <label className="text-sm flex items-center gap-2" title="Auto-save every 1.2s while editing">
                      <input type="checkbox" checked={autosave} onChange={e=>setAutosave(e.target.checked)} />
                      Auto-save
                    </label>
                    <button className="text-sm px-2 py-1 rounded-md" style={{ ...CARD }} onClick={duplicateAgent}>
                      Duplicate
                    </button>
                    <button className="text-sm px-2 py-1 rounded-md" style={{ ...CARD }} onClick={()=>addAudit('open runbook')}>
                      Runbook (coming soon)
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Draggable divider */}
            <div
              onMouseDown={onDragStart}
              className="cursor-col-resize relative group"
              style={{ width: 10 }}
              title="Drag to resize"
            >
              <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-[color-mix(in_oklab,var(--text)_16%,transparent)] group-hover:bg-[var(--brand)]" />
            </div>

            {/* Right rail: Versions + Test + Activity */}
            <aside className="p-[12px] space-y-3" style={PANEL}>
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

              {/* Test */}
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
                  <button onClick={stressTest} className="px-2 py-1 rounded-md text-xs" style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                    Stress test ×50
                  </button>
                </div>

                <div className="space-y-2 max-h-[38vh] overflow-auto rounded-md p-2"
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

              {/* Activity (client-side audit) */}
              <div className="p-[10px] space-y-2" style={CARD}>
                <div className="flex items-center gap-2 font-semibold">
                  <PanelsTopLeft className="w-4 h-4" style={{ color:'var(--brand)' }} />
                  Recent Activity
                </div>
                <div className="space-y-1 max-h-[24vh] overflow-auto">
                  {userId && selected ? (() => {
                    try {
                      const raw = localStorage.getItem(metaKey(userId, selected.id));
                      const m: AgentMeta = raw ? JSON.parse(raw) : {};
                      const audit = (m.audit || []).slice(0, 12);
                      if (!audit.length) return <div className="text-xs opacity-60">No recent actions.</div>;
                      return audit.map((a, i) => (
                        <div key={i} className="text-xs flex items-center justify-between">
                          <span>{a.action}</span>
                          <span className="opacity-60">{fmtTime(a.at)}</span>
                        </div>
                      ));
                    } catch { return <div className="text-xs opacity-60">No recent actions.</div>; }
                  })() : <div className="text-xs opacity-60">No recent actions.</div>}
                </div>
              </div>
            </aside>
          </div>
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
