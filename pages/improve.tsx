'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Bot, RefreshCw,
  History, RotateCcw, Send, Sparkles, Star, StarOff,
  ToggleLeft, ToggleRight, Upload, Download, Shield,
  Diff, Tag as TagIcon, Copy, Check, HelpCircle, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/** API endpoints used (unchanged):
 * GET    /api/chatbots?ownerId=...   (header x-owner-id)
 * PATCH  /api/chatbots/[id]          (header x-owner-id)
 * DELETE /api/chatbots/[id]          (header x-owner-id)
 * POST   /api/chatbots               (header x-owner-id)  // duplicate/import
 * POST   /api/assistants/chat        (optional; graceful fallback if missing)
 */

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
  pinned?: boolean; draft?: boolean; notes?: string; lastOpenedAt?: number;
  tags?: string[];
  guardrails?: { blockedPhrases: string[]; enforceJson: boolean; jsonSchemaHint?: string };
  promptStack?: { pre: string; main: string; post: string };
  perFlowTemp?: { greeting: number; qa: number; actions: number };
  audit?: Array<{ at: number; action: string }>;
};

const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--panel) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 6px 30px rgba(0,0,0,.18), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 16,
  backdropFilter: 'saturate(120%) blur(4px)',
};
const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 3px 16px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 10,
};

const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const stripMarkdownNoise = (t: string) => t.replace(/\*\*|__|`/g, '');

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

const CHIP_LIBRARY = [
  { key: 'yes_no', group: 'Format', label: 'Only answer Yes/No', line: 'Respond strictly with “Yes” or “No” unless explicitly asked to elaborate.' },
  { key: 'concise', group: 'Tone', label: 'Be concise', line: 'Keep responses under 1–2 sentences unless more detail is requested.' },
  { key: 'ask_clarify', group: 'Guardrails', label: 'Ask clarifying first', line: 'If the request is ambiguous, ask a concise clarifying question before answering.' },
  { key: 'no_greeting', group: 'Tone', label: 'No greeting', line: 'Do not start with greetings or pleasantries; go straight to the answer.' },
];

function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>) {
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = CHIP_LIBRARY.filter(c => active[c.key]).map(c => `- ${c.line}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}

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

function VersionsRail({
  versions, onRestore, onDiff, dragVersionRef
}: {
  versions: Version[];
  onRestore: (v: Version) => void;
  onDiff: (v: Version) => void;
  dragVersionRef: React.MutableRefObject<Version | null>;
}) {
  return (
    <aside className="h-[calc(100vh-140px)]" style={{ ...PANEL, width: 280 }}>
      <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
        <History className="w-4 h-4" style={{ color: 'var(--brand)' }} />
        <div className="font-semibold">Versions</div>
      </div>
      <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 54px)' }}>
        {(!versions || versions.length === 0) ? (
          <div className="text-sm opacity-60">No snapshots yet. Click <b>Save</b> to create one.</div>
        ) : (
          <ul className="space-y-2">
            {versions.map(v => (
              <li key={v.id}>
                <div
                  draggable
                  onDragStart={() => { dragVersionRef.current = v; }}
                  onDragEnd={() => { dragVersionRef.current = null; }}
                  className="p-2 rounded-md text-sm cursor-grab active:cursor-grabbing"
                  style={{ ...CARD }}
                >
                  <div className="font-medium truncate">{v.label || 'Snapshot'}</div>
                  <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      onClick={() => onRestore(v)}
                      className="px-2 py-1 rounded-md text-xs"
                      style={{ background: 'color-mix(in oklab, var(--brand) 18%, transparent)', border: '1px solid var(--brand)' }}
                    >
                      Restore
                    </button>
                    <button
                      onClick={() => onDiff(v)}
                      className="px-2 py-1 rounded-md text-xs"
                      style={{ ...CARD }}
                    >
                      Diff
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
export default function Improve() {
  const [userId, setUserId] = useState<string | null>(null);
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  // search/sort/tag
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'pinned_first'|'name_asc'|'updated_desc'>('pinned_first');
  const [tagFilter, setTagFilter] = useState('');
  const filtered = useMemo(() => {
    let rows = list;
    if (query.trim()) {
      const q = query.toLowerCase();
      rows = rows.filter(b =>
        (b.name || '').toLowerCase().includes(q) ||
        (b.model || '').toLowerCase().includes(q) ||
        (b.id || '').toLowerCase().includes(q)
      );
    }
    if (tagFilter.trim()) {
      rows = rows.filter(b => {
        try {
          const raw = localStorage.getItem(metaKey(userId || '', b.id));
          const m: AgentMeta = raw ? JSON.parse(raw) : {};
          return (m.tags || []).some((t: string) =>
            t.toLowerCase().includes(tagFilter.toLowerCase())
          );
        } catch { return false; }
      });
    }
    if (sort === 'name_asc') {
      rows = [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (sort === 'updated_desc') {
      rows = [...rows].sort(
        (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
      );
    } else if (sort === 'pinned_first') {
      rows = [...rows].sort((a, b) => {
        const aMeta = JSON.parse(localStorage.getItem(metaKey(userId || '', a.id)) || '{}');
        const bMeta = JSON.parse(localStorage.getItem(metaKey(userId || '', b.id)) || '{}');
        return (bMeta.pinned ? 1 : 0) - (aMeta.pinned ? 1 : 0);
      });
    }
    return rows;
  }, [list, query, sort, tagFilter, userId]);

  // editor state
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [promptPre, setPromptPre] = useState('');
  const [promptPost, setPromptPost] = useState('');
  const [showSystem, setShowSystem] = useState(false);

  // advanced
  const [blockedPhrases, setBlockedPhrases] = useState('');
  const [enforceJson, setEnforceJson] = useState(false);
  const [jsonSchemaHint, setJsonSchemaHint] = useState('');
  const [flowTemps, setFlowTemps] = useState({ greeting: 0.5, qa: 0.5, actions: 0.5 });

  // overlays
  const [showVersions, setShowVersions] = useState(false); // keep legacy slide-over if you like
  const [showTest, setShowTest] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // versions & diff
  const [versions, setVersions] = useState<Version[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffWith, setDiffWith] = useState<Version | null>(null);

  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autosave, setAutosave] = useState(true);
  const [copied, setCopied] = useState(false);

  // undo
  const undoRef = useRef<ReturnType<typeof makeUndoStack> | null>(null);
  useEffect(() => { undoRef.current = makeUndoStack(''); }, []);
  useEffect(() => { if (undoRef.current) undoRef.current.push(system); }, [system]);

  // user id
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || null);
    })();
  }, []);

  // fetch list
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

  // load selected meta/versions
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
    ['yes_no','concise','ask_clarify','no_greeting'].forEach(k => { next[k] = (selected.system || '').includes(k.replace('_',' ')); });
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
    if (undoRef.current) undoRef.current = makeUndoStack(selected.system || '');
  }, [selectedId, userId, selected]);

  // dirty + autosave
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

  async function saveEdits(silent = false) {
    if (!userId || !selectedId) return;
    if (!silent) setSaving(true);
    try {
      const prev = list.find(b => b.id === selectedId) || null;
      const candidate: BotRow = { id: selectedId, ownerId: userId, name, model, temperature, system, createdAt: prev?.createdAt, updatedAt: new Date().toISOString() };
      const v: Version = { id: `v_${Date.now()}`, ts: Date.now(), label: autoNameVersion(prev, candidate), name, model, temperature, system };
      const maxKeep = 150;
      const nextVersions = [v, ...(versions||[])].slice(0, maxKeep);
      setVersions(nextVersions);
      localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(nextVersions));

      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      const meta: AgentMeta = {
        pinned, draft, notes, lastOpenedAt: Date.now(), tags,
        promptStack: { pre: promptPre, main: '', post: promptPost },
        guardrails: { blockedPhrases: blockedPhrases.split('\n').map(s=>s.trim()).filter(Boolean), enforceJson, jsonSchemaHint: jsonSchemaHint || undefined },
        perFlowTemp: flowTemps,
      };
      localStorage.setItem(metaKey(userId, selectedId), JSON.stringify(meta));

      if (silent) {
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

  const tempMode: 'precise'|'balanced'|'creative' =
    temperature <= 0.25 ? 'precise' : temperature >= 0.75 ? 'creative' : 'balanced';
  function setTempMode(m: typeof tempMode) {
    setTemperature(m==='precise'?0.1 : m==='creative'?0.9 : 0.5);
  }
  async function copyId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(()=>setCopied(false), 1000); } catch {}
  }

  // versions rail drag context
  const dragVersionRef = useRef<Version | null>(null);
  const prettyLabel = (v: Version) => `${v.label || 'Snapshot'} — ${fmtTime(v.ts)}`;

  // TEST LANES (A/B)
  type Lane = { id: 'A'|'B'; version?: Version | null; log: { role:'user'|'assistant', text:string }[] };
  const [lanes, setLanes] = useState<Lane[]>([{ id:'A', version:null, log: [] }]);
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [sendToBoth, setSendToBoth] = useState(true); // new toggle

  async function handleSend() {
    const q = testInput.trim();
    if (!q) return;
    setTesting(true);
    try {
      // Fan out user message according to toggle
      setLanes(prev => {
        const target = sendToBoth || prev.length === 1 ? prev : prev.filter(l => l.id !== 'A'); // if not both, send to B only (focused second lane)
        const ids = new Set(target.map(t=>t.id));
        return prev.map(l => ids.has(l.id) ? ({ ...l, log: [...l.log, { role:'user', text:q }] }) : l);
      });

      const current = [...lanes];
      const targets = sendToBoth || current.length === 1 ? current : current.filter(l => l.id !== 'A');

      const results = await Promise.all(targets.map(async (lane) => {
        try {
          const res = await fetch('/api/assistants/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: lane.version ? lane.version.model : model,
              system: lane.version ? lane.version.system : system,
              messages: [{ role:'user', content:q }],
              temperature: lane.version ? lane.version.temperature : temperature,
            })
          });
          if (res.ok) {
            const json = await res.json();
            const text = json?.reply || JSON.stringify(json);
            return { id: lane.id, text };
          }
        } catch {}
        const text = `Simulated reply for lane ${lane.id}: ${q}`;
        return { id: lane.id, text };
      }));

      setLanes(prev => prev.map(l => {
        const r = results.find(x => x.id === l.id);
        return r ? { ...l, log: [...l.log, { role:'assistant', text: r.text }] } : l;
      }));
      setTestInput('');
    } finally { setTesting(false); }
  }

  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header – compact. Keep only global actions that make sense here. */}
      <header className="sticky top-0 z-30 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1680px] mx-auto flex items-center gap-3">
          <Bot className="w-5 h-5" style={{ color:'var(--brand)' }} />
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
            <label className="px-3 py-1.5 rounded-md text-sm cursor-pointer" style={{ ...CARD }}>
              <Upload className="inline w-4 h-4 mr-1" /> Import
              <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
            </label>
            <button onClick={exportAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Download className="inline w-4 h-4 mr-1" /> Export
            </button>
            <button onClick={duplicateAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <RotateCcw className="inline w-4 h-4 mr-1" /> Duplicate
            </button>
            <button onClick={deleteSelected} disabled={!selected || saving}
                    className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                    style={{ background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.35)' }}>
              <Trash2 className="inline w-4 h-4 mr-1" /> Delete
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-column layout: Left rail · Editor · Versions rail */}
      <div className="max-w-[1680px] mx-auto px-6 py-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: '320px 1fr 280px' }}>
          {/* Left rail (Assistants) */}
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
                  <TagIcon className="w-4 h-4 opacity-70" />
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

          {/* Editor column */}
          <section className="h-[calc(100vh-140px)] grid gap-3"
                   style={{ gridTemplateRows: 'auto auto 1fr', ...PANEL }}>
            {/* Top row: Name + Model + Temp */}
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
                </div>
              </div>
            </div>

            {/* Middle row: Tags + Quick flags + Guardrails */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 0.8fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Tags</div>
                  <div className="flex items-center gap-2">
                    <input
                      placeholder="Add tag and press Enter"
                      onKeyDown={(e:any)=>{
                        if(e.key==='Enter'){
                          const v=(e.target.value||'').trim();
                          if(v){
                            const next=[...tags];
                            if(!next.includes(v)) next.push(v);
                            setTags(next);
                          }
                          e.target.value='';
                        }
                      }}
                      className="px-3 py-2 rounded-md text-sm flex-1" style={CARD}
                    />
                    <div className="flex flex-wrap gap-2">
                      {tags.map(t => (
                        <span key={t} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                          {t}{' '}<button className="ml-1 opacity-70" onClick={()=>setTags(tags.filter(x=>x!==t))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-2" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
                  <button onClick={()=>setPinned(v=>!v)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    {pinned ? <><Star className="inline w-4 h-4 mr-1" />Pinned</> : <><StarOff className="inline w-4 h-4 mr-1" />Pin</>}
                  </button>
                  <button onClick={()=>setDraft(v=>!v)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    {draft ? <><ToggleLeft className="inline w-4 h-4 mr-1" />Draft</> : <><ToggleRight className="inline w-4 h-4 mr-1" />Published</>}
                  </button>
                  <button onClick={()=>setShowAdvanced(true)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    <Shield className="inline w-4 h-4 mr-1" />Guardrails
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom: Prompts + Notes + System (collapsed) */}
            <div className="p-3 overflow-auto">
              {!selected ? (
                <div className="grid place-items-center h-[50vh] opacity-70">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Pre Prompt</div>
                    <textarea value={promptPre} onChange={(e)=>setPromptPre(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD} placeholder="Optional: pre instructions (role, objectives)…" />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Post Prompt</div>
                    <textarea value={promptPost} onChange={(e)=>setPromptPost(e.target.value)} rows={6} className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD} placeholder="Optional: post processing (formatting, checks)…" />
                  </div>

                  {/* System Prompt header with Add rule + toggle + Save nearby */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-xs opacity-70">System Prompt</div>
                      <div className="flex items-center gap-2">
                        {/* Add rule pill */}
                        <input
                          placeholder="Add rule (Enter)…"
                          className="px-2 py-1 rounded-md text-xs" style={CARD}
                          onKeyDown={(e:any)=>{
                            if(e.key==='Enter'){
                              const val = (e.target.value || '').trim();
                              if(!val) return;
                              const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`,'m');
                              const line = `- ${val}`;
                              let nv = system;
                              if (re.test(system)) {
                                nv = system.replace(new RegExp(`^(${REFINEMENT_HEADER}[\\s\\S]*?)\\n\\n`, 'm'), (_m, p1) => `${p1}\n${line}\n\n`);
                              } else {
                                nv = `${REFINEMENT_HEADER}\n${line}\n\n${system || ''}`;
                              }
                              setSystem(nv);
                              e.target.value='';
                            }
                          }}
                        />
                        <button onClick={()=>setShowSystem(s=>!s)} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                          {showSystem ? 'Hide prompt' : 'Show prompt'}
                        </button>
                        <button onClick={()=> !saving && dirty && saveEdits()} disabled={!dirty || saving}
                                className="px-2.5 py-1.5 rounded-md text-xs disabled:opacity-60"
                                style={{ background:'var(--brand)', color:'#00120a' }}>
                          <Save className="inline w-3.5 h-3.5 mr-1" /> Save
                        </button>
                      </div>
                    </div>

                    {showSystem && (
                      <>
                        <textarea
                          value={system}
                          onChange={(e)=>setSystem(e.target.value)}
                          rows={10}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6"
                          style={CARD}
                          placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                        />
                        <div className="flex items-center justify-between text-xs mt-1">
                          <div className="opacity-70">{(system?.length || 0).toLocaleString()} chars · est {estimateTokens(system).toLocaleString()} tokens</div>
                          <div className="opacity-70 flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> Tip: Use headings and examples.</div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Notes */}
                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">Notes</div>
                    <textarea value={notes} onChange={(e)=>setNotes(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-md outline-none text-sm" style={CARD} placeholder="Context for your future self and teammates…" />
                  </div>

                  {/* Test entrypoint */}
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium">Test sandbox</div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs flex items-center gap-1">
                          <input type="checkbox" checked={sendToBoth} onChange={(e)=>setSendToBoth(e.target.checked)} />
                          Send to both lanes
                        </label>
                        <button onClick={()=>setShowTest(true)} className="px-2.5 py-1.5 rounded-md text-xs" style={{ ...CARD }}>
                          <Sparkles className="inline w-3.5 h-3.5 mr-1" /> Expand
                        </button>
                      </div>
                    </div>

                    {/* Inline mini test (droppable & lanes) */}
                    <div
                      className="p-3 space-y-2 rounded-md"
                      style={{ background:'rgba(0,0,0,.08)', border:'1px solid var(--border)' }}
                      onDragOver={(e)=>{ e.preventDefault(); }}
                      onDrop={(e)=>{
                        e.preventDefault();
                        const v = dragVersionRef.current;
                        if (!v) return;
                        setLanes(prev => {
                          if (prev.length === 1) {
                            return [
                              { ...prev[0], version: prev[0].version ?? null },
                              { id: 'B', version: v, log: [] },
                            ];
                          }
                          return [{ ...prev[0] }, { id:'B', version: v, log: [] }];
                        });
                      }}
                    >
                      <div className="grid gap-2" style={{ gridTemplateColumns: lanes.length === 2 ? '1fr 1fr' : '1fr' }}>
                        {lanes.map(l => (
                          <div key={l.id} className="p-2 rounded-md" style={{ ...CARD }}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="text-sm font-medium">
                                Lane {l.id} {l.version ? '— ' + (prettyLabel(l.version)) : '(current)'}
                              </div>
                              {l.id === 'B' && (
                                <button onClick={()=>setLanes([{ ...lanes[0], id:'A' }])} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                                  Close B
                                </button>
                              )}
                            </div>
                            <div className="space-y-1 max-h-[160px] overflow-auto rounded-md p-2"
                                 style={{ background:'rgba(0,0,0,.06)', border:'1px solid var(--border)' }}>
                              {l.log.length === 0 ? (
                                <div className="text-xs opacity-60">Drag a version here, then send a message to compare.</div>
                              ) : l.log.map((m,i)=>(
                                <div key={i} className={`text-sm ${m.role==='user'?'text-[var(--text)]':'opacity-85'}`}>
                                  <b>{m.role==='user'?'You':'AI'}:</b> {stripMarkdownNoise(m.text)}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center gap-2 mt-2">
                        <input
                          value={testInput}
                          onChange={(e)=>setTestInput(e.target.value)}
                          onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend(); } }}
                          placeholder={lanes.length === 2 ? "Type once to test both lanes…" : "Type a message…"}
                          className="flex-1 px-3 py-2 rounded-md text-sm" style={CARD}
                        />
                        <button onClick={handleSend} disabled={testing || !testInput.trim()} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background:'var(--brand)', color:'#00120a' }}>
                          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="inline w-4 h-4 mr-1" /> Send</>}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Right versions rail */}
          <VersionsRail
            versions={versions}
            onRestore={(v)=>{ setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true); }}
            onDiff={(v)=>{ setDiffWith(v); setDiffOpen(true); }}
            dragVersionRef={dragVersionRef}
          />
        </div>
      </div>
      {/* Test overlay (bigger workspace; mirrors inline lanes) */}
      {showTest && (
        <Overlay onClose={()=>setShowTest(false)}>
          <div className="w-[min(1000px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Sparkles className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Test Sandbox</div>
              <div className="ml-auto flex items-center gap-3 text-xs">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={sendToBoth} onChange={(e)=>setSendToBoth(e.target.checked)} />
                  Send to both lanes
                </label>
                <button onClick={()=>setShowTest(false)} className="px-2 py-1 rounded-md" style={{ ...CARD }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-3">
              <div
                className="p-3 space-y-2 rounded-md"
                style={{ background:'rgba(0,0,0,.12)', border:'1px solid var(--border)' }}
                onDragOver={(e)=>{ e.preventDefault(); }}
                onDrop={(e)=>{
                  e.preventDefault();
                  const v = (document as any).dragVersion || null; // not used; we use ref below
                }}
              >
                <div
                  onDragOver={(e)=>e.preventDefault()}
                  onDrop={(e)=>{
                    e.preventDefault();
                    const v = (dragVersionRef.current);
                    if (!v) return;
                    setLanes(prev => prev.length === 1
                      ? [{ ...prev[0] }, { id:'B', version: v, log: [] }]
                      : [{ ...prev[0] }, { id:'B', version: v, log: [] }]
                    );
                  }}
                >
                  <div className="grid gap-3" style={{ gridTemplateColumns: lanes.length === 2 ? '1fr 1fr' : '1fr' }}>
                    {lanes.map(l => (
                      <div key={l.id} className="p-2 rounded-md" style={{ ...CARD }}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="text-sm font-medium">
                            Lane {l.id} {l.version ? '— ' + (l.version.label || 'Snapshot') : '(current)'}
                          </div>
                          {l.id === 'B' && (
                            <button onClick={()=>setLanes([{ ...lanes[0], id:'A' }])} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                              Close B
                            </button>
                          )}
                        </div>
                        <div className="space-y-1 max-h-[48vh] overflow-auto rounded-md p-2"
                             style={{ background:'rgba(0,0,0,.08)', border:'1px solid var(--border)' }}>
                          {l.log.length === 0 ? (
                            <div className="text-xs opacity-60">Drag a version in; then type to compare outputs.</div>
                          ) : l.log.map((m,i)=>(
                            <div key={i} className={`text-sm ${m.role==='user'?'text-[var(--text)]':'opacity-85'}`}>
                              <b>{m.role==='user'?'You':'AI'}:</b> {stripMarkdownNoise(m.text)}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <input
                    value={testInput}
                    onChange={(e)=>setTestInput(e.target.value)}
                    onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend(); } }}
                    placeholder={lanes.length === 2 ? "Type once to test both lanes…" : "Type a message…"}
                    className="flex-1 px-3 py-2 rounded-md text-sm" style={CARD}
                  />
                  <button onClick={handleSend} disabled={testing || !testInput.trim()} className="px-3 py-2 rounded-md text-sm disabled:opacity-60" style={{ background:'var(--brand)', color:'#00120a' }}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="inline w-4 h-4 mr-1" /> Send</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Advanced guardrails */}
      {showAdvanced && (
        <Overlay onClose={()=>setShowAdvanced(false)}>
          <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Shield className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Advanced Guardrails</div>
              <button onClick={()=>setShowAdvanced(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
              <div className="col-span-2">
                <div className="text-xs opacity-70 mb-1">Blocked phrases (one per line)</div>
                <textarea value={blockedPhrases} onChange={(e)=>setBlockedPhrases(e.target.value)} rows={6}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                          placeholder="forbidden term A\nforbidden term B"/>
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={enforceJson} onChange={(e)=>setEnforceJson(e.target.checked)} />
                  Enforce JSON outputs when applicable
                </label>
                <div className="text-xs opacity-70 mt-1">Bias responses to valid JSON if schema provided.</div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">JSON schema hint (optional)</div>
                <textarea value={jsonSchemaHint} onChange={(e)=>setJsonSchemaHint(e.target.value)} rows={4}
                          className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                          placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}'/>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={()=>setShowAdvanced(false)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>Close</button>
                <button onClick={()=>{ setDirty(true); setShowAdvanced(false); }} className="px-3 py-2 rounded-md text-sm" style={{ background:'var(--brand)', color:'#00120a' }}>Apply</button>
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Diff modal */}
      {diffOpen && diffWith && (
        <Overlay onClose={()=>setDiffOpen(false)}>
          <div className="w-[min(1000px,95vw)] max-height-[80vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Diff className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Diff vs “{diffWith.label}”</div>
              <button onClick={()=>setDiffOpen(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid gap-3 p-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
              <pre className="p-2 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'65vh' }}>
                {diffWith.system}
              </pre>
              <pre className="p-2 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'65vh' }}>
                {system}
              </pre>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}
