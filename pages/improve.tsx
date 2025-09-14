// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Settings2, Bot, RefreshCw,
  History, RotateCcw, ChevronDown, Send, Sparkles,
  Star, StarOff, FilePlus2, ToggleLeft, ToggleRight,
  Undo2, Redo2, Info, X, Upload, Download, Shield, Diff,
  SplitSquareHorizontal, Tag, Copy, Check, SlidersHorizontal,
  PanelsTopLeft, Gauge, HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/** API endpoints used (unchanged):
 * GET    /api/chatbots?ownerId=...   (header x-owner-id)
 * PATCH  /api/chatbots/[id]          (header x-owner-id)
 * DELETE /api/chatbots/[id]          (header x-owner-id)
 * POST   /api/chatbots               (header x-owner-id)  // duplicate/import
 * POST   /api/assistants/chat        (optional; handled gracefully if missing)
 */

/* ─────────────────────────── Types ─────────────────────────── */
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
  id: string; ts: number; label: string;
  name: string; model: string; temperature: number; system: string;
};
type AgentMeta = {
  pinned?: boolean;
  draft?: boolean;
  notes?: string;
  lastOpenedAt?: number;
  tags?: string[];
  guardrails?: { blockedPhrases: string[]; enforceJson: boolean; jsonSchemaHint?: string };
  promptStack?: { pre: string; main: string; post: string };
  perFlowTemp?: { greeting: number; qa: number; actions: number };
  audit?: Array<{ at: number; action: string }>;
};

/* ─────────────────────────── Styles ─────────────────────────── */
const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--panel) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 6px 30px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 16,
  backdropFilter: 'saturate(120%) blur(6px)',
};
const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 3px 16px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 12,
};
function BgFX() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(900px 600px at 10% -10%, color-mix(in oklab, var(--brand) 10%, transparent), transparent 60%), radial-gradient(900px 700px at 110% 120%, color-mix(in oklab, var(--brand) 8%, transparent), transparent 60%)',
          maskImage:
            'radial-gradient(1100px 800px at 0% 0%, #000 40%, transparent), radial-gradient(1100px 800px at 100% 100%, #000 40%, transparent)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[.06] animate-[gridpan_28s_linear_infinite]"
        style={{
          background:
            'linear-gradient(transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px), linear-gradient(90deg, transparent 31px, color-mix(in oklab, var(--text) 7%, transparent) 32px)',
          backgroundSize: '32px 32px',
        }}
      />
      <style jsx>{`@keyframes gridpan { 0%{transform:translateX(0)}50%{transform:translateX(16px)}100%{transform:translateX(0)} }`}</style>
    </div>
  );
}
function WindowsIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M2 4l9-1.5v9L2 11V4Zm10 0l10-1.7v10.2L12 12V4Zm-10 9l9 0.5v9L2 20v-7Zm10 0l10 0.6V22L12 20v-7Z" />
    </svg>
  );
}

/* ─────────────────────────── Helpers ─────────────────────────── */
const CHIP_LIBRARY = [
  { key: 'yes_no', group: 'Format', label: 'Only answer Yes/No', line: 'Respond strictly with “Yes” or “No” unless explicitly asked to elaborate.' },
  { key: 'concise', group: 'Tone', label: 'Be concise', line: 'Keep responses under 1–2 sentences unless more detail is requested.' },
  { key: 'ask_clarify', group: 'Guardrails', label: 'Ask clarifying first', line: 'If the request is ambiguous, ask a concise clarifying question before answering.' },
  { key: 'no_greeting', group: 'Tone', label: 'No greeting', line: 'Do not start with greetings or pleasantries; go straight to the answer.' },
];
const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const stripMarkdownNoise = (t: string) => t.replace(/\*\*|__|`/g, ''); // remove ** __ `

function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>) {
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = CHIP_LIBRARY.filter(c => active[c.key]).map(c => `- ${c.line}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}
function makeUndoStack(initial: string) {
  const stack = [initial]; let idx = 0;
  return {
    get value(){ return stack[idx]; },
    push(v: string){ if (v === stack[idx]) return; stack.splice(idx+1); stack.push(v); idx = stack.length-1; },
    undo(){ if (idx>0) idx--; return stack[idx]; },
    redo(){ if (idx<stack.length-1) idx++; return stack[idx]; },
    canUndo(){ return idx>0; }, canRedo(){ return idx<stack.length-1; },
  };
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

/* ─────────────────────────── Simple Overlay ─────────────────────────── */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">{children}</div>
    </div>
  );
}

/* ─────────────────────────── Component ─────────────────────────── */
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  /* Search/sort/tag */
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'pinned_first'|'name_asc'|'updated_desc'>('pinned_first');
  const [tagFilter, setTagFilter] = useState('');

  /* Editor state */
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5); // 0=precise, 0.5=balanced, 1=creative
  const [system, setSystem] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [promptPre, setPromptPre] = useState('');
  const [promptPost, setPromptPost] = useState('');

  /* Meta advanced (overlay) */
  const [blockedPhrases, setBlockedPhrases] = useState('');
  const [enforceJson, setEnforceJson] = useState(false);
  const [jsonSchemaHint, setJsonSchemaHint] = useState('');
  const [flowTemps, setFlowTemps] = useState({ greeting: 0.5, qa: 0.5, actions: 0.5 });

  /* Panels & overlays */
  const [showVersions, setShowVersions] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showFlowTuner, setShowFlowTuner] = useState(false);

  /* Versions & test */
  const [versions, setVersions] = useState<Version[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffWith, setDiffWith] = useState<Version | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<{role:'user'|'assistant', text:string}[]>([]);
  const [testing, setTesting] = useState(false);

  /* UI state */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const [copied, setCopied] = useState(false);

  /* Undo/redo for prompt */
  const undoRef = useRef<ReturnType<typeof makeUndoStack> | null>(null);
  useEffect(() => { undoRef.current = makeUndoStack(''); }, []);
  useEffect(() => { if (undoRef.current) undoRef.current.push(system); }, [system]);

  /* User ID */
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || null);
    })();
  }, []);

  /* Fetch list */
  async function fetchBots(uid: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(uid)}`, { headers: { 'x-owner-id': uid } });
      const json = await res.json();
      const rows: BotRow[] = json?.data || [];
      setList(rows);
      if (!selectedId && rows.length) setSelectedId(rows[0].id);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]); // eslint-disable-line

  /* Load selected meta/versions */
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    setNotes(''); setDraft(false); setPinned(false); setTags([]);
    setPromptPre(''); setPromptPost('');
    setBlockedPhrases(''); setEnforceJson(false); setJsonSchemaHint('');
    setFlowTemps({ greeting: 0.5, qa: 0.5, actions: 0.5 });

    const next: Record<string, boolean> = {};
    CHIP_LIBRARY.forEach(c => { next[c.key] = (selected.system || '').includes(c.line); });
    setChips(next);

    try {
      const rawV = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(rawV ? JSON.parse(rawV) as Version[] : []);
    } catch { setVersions([]); }
    try {
      const rawM = localStorage.getItem(metaKey(userId, selected.id));
      const m: AgentMeta = rawM ? JSON.parse(rawM) : {};
      setPinned(!!m.pinned); setDraft(!!m.draft);
      setNotes(m.notes || ''); setTags(Array.isArray(m.tags) ? m.tags : []);
      setPromptPre(m.promptStack?.pre || ''); setPromptPost(m.promptStack?.post || '');
      setBlockedPhrases((m.guardrails?.blockedPhrases || []).join('\n'));
      setEnforceJson(!!m.guardrails?.enforceJson);
      setJsonSchemaHint(m.guardrails?.jsonSchemaHint || '');
      setFlowTemps(m.perFlowTemp || { greeting:0.5, qa:0.5, actions:0.5 });
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, lastOpenedAt: Date.now() }));
    } catch {}
    setDirty(false);
    setTestLog([]);
    if (undoRef.current) undoRef.current = makeUndoStack(selected.system || '');
  }, [selectedId, userId, selected]);

  /* Dirty + autosave (no flicker: silent saves DO NOT refetch list) */
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system !== (selected.system || '')) ||
      (notes !== '') || (draft !== false) || (pinned !== false) || (tags.length>0) ||
      (promptPre !== '') || (promptPost !== '') ||
      (blockedPhrases !== '') || enforceJson || (jsonSchemaHint !== '') ||
      (Math.abs(flowTemps.greeting-0.5)>1e-9 || Math.abs(flowTemps.qa-0.5)>1e-9 || Math.abs(flowTemps.actions-0.5)>1e-9);
    setDirty(d);
    if (autosave && d && !saving) {
      const t = setTimeout(() => { void saveEdits(true); }, 1200);
      return () => clearTimeout(t);
    }
  }, [name, model, temperature, system, notes, draft, pinned, tags, promptPre, promptPost, blockedPhrases, enforceJson, jsonSchemaHint, flowTemps, selected, autosave, saving]);

  /* Shortcuts (Ctrl/Cmd) */
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

  /* Actions */
  async function saveEdits(silent = false) {
    if (!userId || !selectedId) return;
    if (!silent) setSaving(true);
    try {
      const prev = list.find(b => b.id === selectedId) || null;
      const candidate: BotRow = { id: selectedId, ownerId: userId, name, model, temperature, system, createdAt: prev?.createdAt, updatedAt: new Date().toISOString() };
      // version
      const v: Version = { id: `v_${Date.now()}`, ts: Date.now(), label: autoNameVersion(prev, candidate), name, model, temperature, system };
      const nextVersions = [v, ...(versions||[])].slice(0, 50);
      setVersions(nextVersions);
      localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(nextVersions));
      // patch
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      // meta (client)
      const meta: AgentMeta = {
        pinned, draft, notes, lastOpenedAt: Date.now(), tags,
        promptStack: { pre: promptPre, main: '', post: promptPost },
        guardrails: { blockedPhrases: blockedPhrases.split('\n').map(s=>s.trim()).filter(Boolean), enforceJson, jsonSchemaHint: jsonSchemaHint || undefined },
        perFlowTemp: flowTemps,
      };
      localStorage.setItem(metaKey(userId, selectedId), JSON.stringify(meta));

      if (silent) {
        // Update local list only → avoid flicker from refetch
        setList(cur => cur.map(b => b.id === selectedId ? { ...b, name, model, temperature, system, updatedAt: candidate.updatedAt } : b));
      } else {
        await fetchBots(userId);
        setSelectedId(selectedId);
      }
      setDirty(false);
    } catch (e: any) { alert(e?.message || 'Failed to save'); }
    finally { if (!silent) setSaving(false); }
  }

  async function deleteSelected() {
    if (!userId || !selectedId) return;
    if (!confirm('Delete this agent?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'DELETE', headers: { 'x-owner-id': userId },
      });
      if (!res.ok) throw new Error('Failed to delete');
      localStorage.removeItem(versionsKey(userId, selectedId));
      localStorage.removeItem(metaKey(userId, selectedId));
      await fetchBots(userId);
      setSelectedId(null);
      setDirty(false);
    } catch (e: any) { alert(e?.message || 'Failed to delete'); }
    finally { setSaving(false); }
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
    } catch (e:any) { alert(e?.message || 'Failed to duplicate'); }
  }

  function exportAgent() {
    if (!selected) return;
    const payload = {
      type: 'reduc.ai/agent', version: 1,
      agent: { id: selected.id, name, model, temperature, system,
        meta: {
          notes, pinned, draft, tags,
          promptStack: { pre: promptPre, main: '', post: promptPost },
          guardrails: { blockedPhrases: blockedPhrases.split('\n').map(s=>s.trim()).filter(Boolean), enforceJson, jsonSchemaHint },
          perFlowTemp: flowTemps,
        }
      }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(name||'agent').replace(/\s+/g,'_')}.json`; a.click(); URL.revokeObjectURL(url);
  }

  async function importAgent(file: File) {
    if (!userId) return;
    try {
      const text = await file.text(); const parsed = JSON.parse(text); const a = parsed?.agent || parsed;
      const res = await fetch('/api/chatbots', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name: a.name || 'Imported Agent', model: a.model || 'gpt-4o-mini', temperature: typeof a.temperature==='number'?a.temperature:0.5, system: a.system || '' }),
      });
      const json = await res.json(); if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to import');
      const newId = json.data.id as string;
      localStorage.setItem(metaKey(userId, newId), JSON.stringify(a.meta || {}));
      await fetchBots(userId); setSelectedId(newId);
    } catch (e:any) { alert(e?.message || 'Import failed'); }
  }

  /* Testing */
  async function runTest(message?: string) {
    const msg = (message ?? testInput).trim();
    if (!msg || !selected) return;
    setTesting(true);
    setTestLog(l => [...l, { role: 'user', text: msg }]);
    try {
      const res = await fetch('/api/assistants/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selected.model, system, message: msg })
      });
      if (!res.ok) throw new Error('No test endpoint configured');
      const json = await res.json();
      const answer = stripMarkdownNoise(String(json?.message || '…'));
      setTestLog(l => [...l, { role: 'assistant', text: answer }]);
    } catch {
      setTestLog(l => [...l, { role: 'assistant', text: 'Testing endpoint not configured. Use your chat sandbox or connect keys.' }]);
    } finally { setTesting(false); setTestInput(''); }
  }

  /* Filters */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const enriched = list.map(b => {
      let pinned=false; let tags: string[] = [];
      try {
        if (userId) {
          const raw = localStorage.getItem(metaKey(userId, b.id));
          const m: AgentMeta = raw ? JSON.parse(raw) : {};
          pinned = !!m.pinned; tags = m.tags || [];
        }
      } catch {}
      return { b, pinned, tags };
    }).filter(x => {
      const passQ = !q || (x.b.name||'').toLowerCase().includes(q) || (x.b.model||'').toLowerCase().includes(q) || (x.b.id||'').toLowerCase().includes(q);
      const passTag = !tagFilter || x.tags.includes(tagFilter);
      return passQ && passTag;
    });
    const sorter = (a:any,b:any) =>
      sort==='name_asc' ? (a.b.name||'').localeCompare(b.b.name||'') :
      sort==='updated_desc' ? (new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime()) :
      (Number(b.pinned)-Number(a.pinned)) || (new Date(b.b.updatedAt||0).getTime() - new Date(a.b.b.updatedAt||0).getTime());
    return enriched.sort(sorter).map(x=>x.b);
  }, [list, query, sort, tagFilter, userId]);

  /* UI helpers */
  const tokenEst = estimateTokens(system);
  const tempMode: 'precise'|'balanced'|'creative' =
    temperature <= 0.25 ? 'precise' : temperature >= 0.75 ? 'creative' : 'balanced';
  function setTempMode(m: typeof tempMode) {
    setTemperature(m==='precise'?0.1 : m==='creative'?0.9 : 0.5);
  }
  async function copyId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(()=>setCopied(false), 1000); } catch {}
  }

  /* Layout: fixed height with internal scroll panes (no page scroll) */
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <BgFX />

      {/* Sticky command bar */}
      <header className="sticky top-0 z-30 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1680px] mx-auto flex items-center gap-3">
          <SplitSquareHorizontal className="w-5 h-5" style={{ color:'var(--brand)' }} />
          <h1 className="text-[20px] font-semibold">{selected ? (selected.name || 'Agent') : 'Agent Tuning'}</h1>

          <span className="text-xs px-2 py-[2px] rounded-full"
                style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
            {saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'Saved ✓'}
          </span>

          {selected && (
            <button onClick={copyId} className="text-xs px-2 py-1 rounded-md hover:opacity-90"
                    style={{ ...CARD, marginLeft: 6 }}>
              {copied ? <><Check className="inline w-3.5 h-3.5 mr-1" /> Copied</> : <><Copy className="inline w-3.5 h-3.5 mr-1" /> ID</>}
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => userId && fetchBots(userId)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>

            <button onClick={() => setShowVersions(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <History className="inline w-4 h-4 mr-1" /> Versions
            </button>

            <button onClick={() => setShowAdvanced(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Shield className="inline w-4 h-4 mr-1" /> Advanced
            </button>

            <button onClick={() => setShowFlowTuner(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Gauge className="inline w-4 h-4 mr-1" /> Tune Flows
            </button>

            <button onClick={() => setShowTest(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Sparkles className="inline w-4 h-4 mr-1" /> Test
            </button>

            <label className="px-3 py-1.5 rounded-md text-sm cursor-pointer" style={{ ...CARD }}>
              <Upload className="inline w-4 h-4 mr-1" /> Import
              <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
            </label>

            <button onClick={exportAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Download className="inline w-4 h-4 mr-1" /> Export
            </button>

            <button onClick={duplicateAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <FilePlus2 className="inline w-4 h-4 mr-1" /> Duplicate
            </button>

            <button
              onClick={() => !saving && dirty && saveEdits()}
              disabled={!dirty || saving}
              className="px-4 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
              style={{ background:'var(--brand)', color:'#00120a' }}>
              <Save className="w-4 h-4" />
              <span>Save</span>
              <span className="ml-1 inline-flex items-center gap-1 text-[11px] px-1.5 py-[1px] rounded"
                    style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                <WindowsIcon className="w-3 h-3" />+S
              </span>
            </button>

            <button onClick={deleteSelected} disabled={!selected || saving}
                    className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                    style={{ background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.35)' }}>
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete
            </button>
          </div>
        </div>
      </header>

      {/* Canvas with internal scroll panes (no page scroll) */}
      <div className="max-w-[1680px] mx-auto px-6 py-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: '320px 1fr' }}>
          {/* Left rail */}
          <aside className="h-[calc(100vh-140px)]" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
                <div className="font-semibold">Assistants</div>
              </div>
              <div className="relative mt-3">
                <input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search"
                       className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none" style={CARD}/>
                <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <select value={sort} onChange={(e)=>setSort(e.target.value as any)} className="px-2 py-1 rounded-md text-xs" style={CARD}>
                  <option value="pinned_first">Pinned</option>
                  <option value="name_asc">Name</option>
                  <option value="updated_desc">Recent</option>
                </select>
                <div className="flex items-center gap-1">
                  <Tag className="w-4 h-4 opacity-70" />
                  <input placeholder="Tag filter" value={tagFilter} onChange={(e)=>setTagFilter(e.target.value)}
                         className="px-2 py-1 rounded-md text-xs" style={{ ...CARD, width:120 }}/>
                </div>
              </div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 118px)' }}>
              {loading ? (
                <div className="grid place-items-center py-10 opacity-70"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : filtered.length === 0 ? (
                <div className="text-sm opacity-80 py-10 text-center px-3">
                  No agents yet.
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
                    let pinnedLocal=false, draftLocal=false, tagsLocal: string[]=[];
                    try {
                      if (userId) {
                        const raw = localStorage.getItem(metaKey(userId, b.id));
                        const m: AgentMeta = raw ? JSON.parse(raw) : {};
                        pinnedLocal=!!m.pinned; draftLocal=!!m.draft; tagsLocal=m.tags||[];
                      }
                    } catch {}
                    const active = selectedId === b.id;
                    return (
                      <li key={b.id}>
                        <button onClick={()=>setSelectedId(b.id)} className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                                style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--border)' }}>
                            <Bot className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="truncate flex items-center gap-2">
                              {b.name || 'Untitled'}
                              {draftLocal ? <span className="text-[10px] px-1.5 py-[1px] rounded-full" style={{ background:'rgba(255,200,0,.12)', border:'1px solid rgba(255,200,0,.35)' }}>Draft</span> : null}
                            </div>
                            <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0,8)}</div>
                            {tagsLocal.length>0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {tagsLocal.slice(0,3).map(t => (
                                  <span key={t} className="text-[10px] px-1 py-[1px] rounded" style={{ background:'rgba(0,0,0,.15)', border:'1px solid var(--border)' }}>{t}</span>
                                ))}
                              </div>
                            )}
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

          {/* Editor column (no internal scroll except textareas) */}
          <section className="h-[calc(100vh-140px)] grid gap-3" style={{ gridTemplateRows: 'auto auto 1fr', ...PANEL }}>
            {/* Top row: Name + Model + Temp mode */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Name</div>
                  <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-3 py-2 rounded-md text-[15px]" style={CARD} placeholder="Agent name" />
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Model</div>
                  <select value={model} onChange={(e)=>setModel(e.target.value)} className="w-full px-3 py-2 rounded-md" style={CARD}>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Temperature</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>setTempMode('precise')} className={`px-3 py-2 rounded-md text-sm ${tempMode==='precise'?'ring-1':''}`} style={{ ...CARD, borderColor: tempMode==='precise' ? 'var(--brand)' : 'var(--border)' }}>Precise</button>
                    <button onClick={()=>setTempMode('balanced')} className={`px-3 py-2 rounded-md text-sm ${tempMode==='balanced'?'ring-1':''}`} style={{ ...CARD, borderColor: tempMode==='balanced' ? 'var(--brand)' : 'var(--border)' }}>Balanced</button>
                    <button onClick={()=>setTempMode('creative')} className={`px-3 py-2 rounded-md text-sm ${tempMode==='creative'?'ring-1':''}`} style={{ ...CARD, borderColor: tempMode==='creative' ? 'var(--brand)' : 'var(--border)' }}>Creative</button>
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">est {estimateTokens(system).toLocaleString()} tokens</div>
                </div>
              </div>
            </div>

            {/* Middle row: Tags + Flags + Chips */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 0.8fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Tags</div>
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Add tag and press Enter"
                      onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=(e.target.value||'').trim(); if(v){ const next=[...tags]; if(!next.includes(v)) next.push(v); setTags(next);} e.target.value=''; }}}
                      className="px-3 py-2 rounded-md text-sm flex-1"
                      style={CARD}
                    />
                    <div className="flex flex-wrap gap-2">
                      {tags.map(t => (
                        <span key={t} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                          {t} <button className="ml-1 opacity-70" onClick={()=>setTags(tags.filter(x=>x!==t))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid gap-2" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
                  <button onClick={()=>setPinned(v=>!v)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>{pinned ? <><Star className="inline w-4 h-4 mr-1" />Pinned</> : <><StarOff className="inline w-4 h-4 mr-1" />Pin</>}</button>
                  <button onClick={()=>setDraft(v=>!v)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>{draft ? <><ToggleLeft className="inline w-4 h-4 mr-1" />Draft</> : <><ToggleRight className="inline w-4 h-4 mr-1" />Published</>}</button>
                  <button onClick={()=>setShowAdvanced(true)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}><Shield className="inline w-4 h-4 mr-1" />Guardrails</button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['Tone','Format','Guardrails'].map(group => (
                  <div key={group} className="p-2 rounded-md" style={{ ...CARD }}>
                    <div className="text-[11px] mb-1 opacity-70">{group}</div>
                    <div className="flex flex-wrap gap-2">
                      {CHIP_LIBRARY.filter(c=>c.group===group).map(c => (
                        <button key={c.key} onClick={()=>{ const next={...chips,[c.key]:!chips[c.key]}; setChips(next); setSystem(s=>applyRefinementsToSystem(s,next)); }}
                                className="px-3 py-1.5 rounded-md text-sm transition"
                                style={ chips[c.key]
                                  ? { background: 'color-mix(in oklab, var(--brand) 25%, transparent)', border: '1px solid var(--brand)' }
                                  : { background: 'color-mix(in oklab, var(--text) 7%, transparent)', border: '1px solid var(--border)' } }>
                          <SlidersHorizontal className="inline w-3.5 h-3.5 mr-1.5 opacity-80" /> {c.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom: Prompts + Notes */}
            <div className="p-3 overflow-auto">
              {!selected ? (
                <div className="grid place-items-center h-[50vh] opacity-70">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Pre Prompt</div>
                    <textarea value={promptPre} onChange={(e)=>setPromptPre(e.target.value)} rows={6}
                              className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                              placeholder="Optional: pre instructions (role, objectives)…" />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Post Prompt</div>
                    <textarea value={promptPost} onChange={(e)=>setPromptPost(e.target.value)} rows={6}
                              className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                              placeholder="Optional: post processing (formatting, checks)…" />
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs opacity-70">System Prompt</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { if (undoRef.current?.canUndo()) setSystem(undoRef.current.undo()); }}
                                disabled={!undoRef.current?.canUndo()} className="px-2 py-1 rounded-md text-xs disabled:opacity-50" style={{ ...CARD }}>
                          <Undo2 className="inline w-3.5 h-3.5 mr-1" /> Undo
                        </button>
                        <button onClick={() => { if (undoRef.current?.canRedo()) setSystem(undoRef.current.redo()); }}
                                disabled={!undoRef.current?.canRedo()} className="px-2 py-1 rounded-md text-xs disabled:opacity-50" style={{ ...CARD }}>
                          <Redo2 className="inline w-3.5 h-3.5 mr-1" /> Redo
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={system}
                      onChange={(e)=>setSystem(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6"
                      style={CARD}
                      placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                      onKeyDown={(e) => {
                        const el = e.target as HTMLTextAreaElement;
                        if (e.key === 'Enter' && el.value.endsWith('/refine')) {
                          e.preventDefault();
                          const nv = el.value.replace(/\/refine$/, `${REFINEMENT_HEADER}\n- Keep answers short and precise.\n- Ask a clarifying question when necessary.\n\n`);
                          setSystem(nv);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="opacity-70">{(system?.length || 0).toLocaleString()} chars · est {tokenEst.toLocaleString()} tokens</div>
                      <div className="opacity-70 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" /> Tip: Use headings (### …) and examples for clarity.
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">Notes for you & colleagues</div>
                    <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={4}
                              className="w-full px-3 py-2 rounded-md outline-none text-sm" style={CARD}
                              placeholder="Share context for your future self and teammates…" />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Slide-over: Versions & Diff */}
      {showVersions && selected && (
        <Overlay onClose={()=>setShowVersions(false)}>
          <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <History className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Versions for {selected.name || selected.id.slice(0,6)}</div>
              <button onClick={()=>setShowVersions(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', height:'calc(85vh - 60px)' }}>
              <div className="p-3 overflow-auto border-r" style={{ borderColor:'var(--border)' }}>
                {(!versions || versions.length===0) && (
                  <div className="text-sm opacity-70">No snapshots yet. Click <b>Save</b> to create one.</div>
                )}
                <div className="space-y-2">
                  {versions.map(v => (
                    <div key={v.id} className="p-2 rounded-md text-sm flex items-center gap-2"
                         style={{ background:'color-mix(in oklab, var(--text) 5%, transparent)', border:'1px solid var(--border)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="truncate">{v.label}</div>
                        <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                      </div>
                      <button onClick={()=>{ setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true); }}
                              className="px-2 py-1 rounded-md text-xs" style={{ background:'color-mix(in oklab, var(--brand) 18%, transparent)', border:'1px solid var(--brand)' }}>
                        <RotateCcw className="inline w-3 h-3 mr-1" /> Restore
                      </button>
                      <button onClick={()=>{ setDiffWith(v); setDiffOpen(true); }}
                              className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                        <Diff className="inline w-3 h-3 mr-1" /> Diff
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 overflow-auto">
                <div className="text-sm opacity-60 mb-2 flex items-center gap-2"><PanelsTopLeft className="w-4 h-4" /> Recent Activity</div>
                {(() => {
                  try {
                    const raw = localStorage.getItem(metaKey(userId || '', selected.id));
                    const m: AgentMeta = raw ? JSON.parse(raw) : {};
                    const audit = (m.audit || []).slice(0, 50);
                    if (!audit.length) return <div className="text-xs opacity-60">No recent actions.</div>;
                    return (
                      <div className="space-y-1">
                        {audit.map((a,i)=>(
                          <div key={i} className="text-xs flex items-center justify-between">
                            <span>{a.action}</span><span className="opacity-60">{fmtTime(a.at)}</span>
                          </div>
                        ))}
                      </div>
                    );
                  } catch { return <div className="text-xs opacity-60">No recent actions.</div>; }
                })()}
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Diff modal within Versions panel */}
      {diffOpen && diffWith && (
        <Overlay onClose={()=>setDiffOpen(false)}>
          <div className="w-[min(1000px,95vw)] max-h-[80vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Diff className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Diff vs “{diffWith.label}”</div>
              <button onClick={()=>setDiffOpen(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid gap-3 p-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
              <pre className="p-2 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'65vh' }}>{diffWith.system}</pre>
              <pre className="p-2 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'65vh' }}>{system}</pre>
            </div>
          </div>
        </Overlay>
      )}

      {/* Slide-over: Test */}
      {showTest && selected && (
        <Overlay onClose={()=>setShowTest(false)}>
          <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Sparkles className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Test “{selected.name || selected.id.slice(0,6)}”</div>
              <button onClick={()=>setShowTest(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {['Greet me', 'Refund policy?', 'One-sentence summary', 'Answer Yes/No only'].map(t => (
                  <button key={t} onClick={()=>runTest(t)} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>{t}</button>
                ))}
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-auto rounded-md p-2" style={{ background:'rgba(0,0,0,.22)', border:'1px solid var(--border)' }}>
                {testLog.length === 0 ? (
                  <div className="text-xs opacity-60">No messages yet.</div>
                ) : testLog.map((m, i) => (
                  <div key={i} className={`text-sm ${m.role === 'user' ? 'text-[var(--text)]' : 'opacity-85'}`}>
                    <b>{m.role === 'user' ? 'You' : 'AI'}:</b> {stripMarkdownNoise(m.text)}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={testInput}
                  onChange={(e)=>setTestInput(e.target.value)}
                  onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if (!testing) runTest(); }}}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 rounded-md text-sm"
                  style={CARD}
                />
                <button onClick={()=>runTest()} disabled={testing || !testInput.trim()}
                        className="px-3 py-2 rounded-md text-sm disabled:opacity-60"
                        style={{ background:'var(--brand)', color:'#00120a' }}>
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="inline w-4 h-4 mr-1" /> Send</>}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Slide-over: Advanced (Guardrails) */}
      {showAdvanced && selected && (
        <Overlay onClose={()=>setShowAdvanced(false)}>
          <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Shield className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Advanced Guardrails</div>
              <button onClick={()=>setShowAdvanced(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
              <div className="col-span-2">
                <div className="text-xs opacity-70 mb-1">Blocked phrases (one per line)</div>
                <textarea value={blockedPhrases} onChange={(e)=>setBlockedPhrases(e.target.value)} rows={6}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                          placeholder="forbidden term A\nforbidden term B" />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={enforceJson} onChange={(e)=>setEnforceJson(e.target.checked)} />
                  Enforce JSON outputs when applicable
                </label>
                <div className="text-xs opacity-70 mt-1">Will bias responses to valid JSON if a schema is provided.</div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">JSON schema hint (optional)</div>
                <textarea value={jsonSchemaHint} onChange={(e)=>setJsonSchemaHint(e.target.value)} rows={4}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                          placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}' />
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={()=>setShowAdvanced(false)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  Close
                </button>
                <button onClick={()=>{ setDirty(true); setShowAdvanced(false); }} className="px-3 py-2 rounded-md text-sm"
                        style={{ background:'var(--brand)', color:'#00120a' }}>
                  Apply
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Slide-over: Flow Tuner */}
      {showFlowTuner && selected && (
        <Overlay onClose={()=>setShowFlowTuner(false)}>
          <div className="w-[min(760px,95vw)] max-h-[80vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Gauge className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Per-Flow Temperature</div>
              <button onClick={()=>setShowFlowTuner(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-4">
              {(['greeting','qa','actions'] as const).map(key => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm capitalize">{key}</div>
                    <div className="text-xs opacity-70">{flowTemps[key].toFixed(2)}</div>
                  </div>
                  <input type="range" min={0} max={1} step={0.01}
                         value={flowTemps[key]}
                         onChange={(e)=>setFlowTemps(s=>({ ...s, [key]: Number(e.target.value) }))}
                         className="w-full" />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <button onClick={()=>setShowFlowTuner(false)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  Close
                </button>
                <button onClick={()=>{ setDirty(true); setShowFlowTuner(false); }} className="px-3 py-2 rounded-md text-sm"
                        style={{ background:'var(--brand)', color:'#00120a' }}>
                  Apply
                </button>
              </div>
              <div className="text-xs opacity-70">
                Tip: Flow temps bias sub-behaviors. Your global Temperature mode still applies as a base.
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
