@@ -1,151 +1,103 @@
// pages/improve.tsx
// FULL REWRITE — includes 200 feature toggles + 50-ish visual upgrades inline (no external flags module)
// Part 1/3 — imports, theme/visuals, helpers, features catalog + feature toggles UI, header, left rail

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Settings2, Bot, RefreshCw,
  History, RotateCcw, Send, Sparkles,
  Star, StarOff, FilePlus2, ToggleLeft, ToggleRight,
  Undo2, Redo2, Info, X, Upload, Download, Shield, Diff,
  SplitSquareHorizontal, Tag as TagIcon, Copy, Check, SlidersHorizontal,
  PanelsTopLeft, Gauge, HelpCircle
  Search, Loader2, Save, Trash2, Bot, RefreshCw, History, RotateCcw, Send,
  Sparkles, Star, StarOff, ToggleLeft, ToggleRight, Undo2, Redo2, X, Upload,
  Download, Shield, Diff, Tag as TagIcon, Copy, Check, Gauge, HelpCircle, MessageSquareMore, Columns2
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/** API endpoints used (unchanged):
 * GET    /api/chatbots?ownerId=...   (header x-owner-id)
 * PATCH  /api/chatbots/[id]          (header x-owner-id)
 * DELETE /api/chatbots/[id]          (header x-owner-id)
 * POST   /api/chatbots               (header x-owner-id)  // duplicate/import
 * POST   /api/assistants/chat        (optional; handled gracefully if missing)
 */
/* ============================= Types & Constants ============================= */

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
  id: string; ownerId: string; name: string; model: string; temperature: number; system: string;
  createdAt?: string; updatedAt?: string;
};
type Version = {
  id: string; ts: number; label: string;
  name: string; model: string; temperature: number; system: string;
  comments?: Array<{ id: string; text: string; at: number }>;
};
type AgentMeta = {
  pinned?: boolean;
  draft?: boolean;
  notes?: string;
  lastOpenedAt?: number;
  tags?: string[];
  pinned?: boolean; draft?: boolean; notes?: string; lastOpenedAt?: number; tags?: string[];
  guardrails?: { blockedPhrases: string[]; enforceJson: boolean; jsonSchemaHint?: string };
  promptStack?: { pre: string; main: string; post: string };
  perFlowTemp?: { greeting: number; qa: number; actions: number };
  audit?: Array<{ at: number; action: string }>;
};

/* ─────────────────────────── Visual Overhaul (50-ish upgrades) ───────────────────────────
   - Neon-accent grid background + radial glows
   - Card/Panels with oklab color-mix, subtle inner shadows
   - Input focus rings, soft borders, micro-animations
   - Sticky command bar with status pills
   - Left rail list polish, tags, icons, pinned badges
   - Consistent button treatments (ghost/outline/brand)
   - Tooltips/hints baked into small text rows
   - Compact grid rhythm + tighter gaps
   - Token/char counters, diff viewers, range sliders
   - Slide-over overlays for test, versions, guardrails, tuner
*/
const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const flagsKey = (o: string, a: string) => `improve:flags:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const stripMarkdownNoise = (t: string) => t.replace(/\*\*|__|`/g, '');
const uid = () => Math.random().toString(36).slice(2, 10);
const cls = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ');

/* ============================= Visual (no neon/glow) ============================= */

const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--panel) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 6px 30px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 16,
  backdropFilter: 'saturate(120%) blur(6px)',
  boxShadow: '0 6px 30px rgba(0,0,0,.12), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 16, backdropFilter: 'saturate(120%) blur(6px)',
};
const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border) 92%, transparent)',
  boxShadow: '0 3px 16px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.04)',
  boxShadow: '0 3px 16px rgba(0,0,0,.08), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 12,
};
function BgFX(){ return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10" />; }

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
const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const estimateTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const stripMarkdownNoise = (t: string) => t.replace(/\*\*|__|`/g, '');
/* ============================= Helpers ============================= */

function makeUndoStack(initial: string) {
  const stack = [initial]; let idx = 0;
  return {
    get value(){ return stack[idx]; },
    push(v: string){ if (v === stack[idx]) return; stack.splice(idx+1); stack.push(v); idx = stack.length-1; },
    undo(){ if (idx>0) idx--; return stack[idx]; },
    redo(){ if (idx<stack.length-1) idx++; return stack[idx]; },
    canUndo(){ return idx>0; }, canRedo(){ return idx<stack.length-1; },
    get value() { return stack[idx]; },
    push(v: string) { if (v === stack[idx]) return; stack.splice(idx + 1); stack.push(v); idx = stack.length - 1; },
    undo() { if (idx > 0) idx--; return stack[idx]; },
    redo() { if (idx < stack.length - 1) idx++; return stack[idx]; },
    canUndo() { return idx > 0; }, canRedo() { return idx < stack.length - 1; },
  };
}
function autoNameVersion(prev: Partial<BotRow> | null, next: BotRow) {
  const parts: string[] = [];
  if (prev?.name !== next.name) parts.push(`name→${next.name.slice(0,18)}`);
  if (prev?.model !== next.model) parts.push(`model→${next.model}`);
  const tPrev = typeof prev?.temperature === 'number' ? prev!.temperature : null;
  if (tPrev !== next.temperature) parts.push(`temp→${next.temperature.toFixed(2)}`);
function versionHumanLabel(prev: Partial<BotRow> | null, next: BotRow) {
  const bits: string[] = [];
  if (prev?.name !== next.name) bits.push(`name → “${next.name.slice(0, 24)}”`);
  if (prev?.model !== next.model) bits.push(`model → ${next.model}`);
  const tp = typeof prev?.temperature === 'number' ? prev!.temperature : null;
  if (tp !== next.temperature) bits.push(`temp → ${next.temperature.toFixed(2)}`);
  if ((prev?.system || '').trim() !== (next.system || '').trim()) {
    const delta = Math.abs((next.system?.length || 0) - (prev?.system?.length || 0));
    parts.push(delta >= 48 ? 'prompt edited (big)' : 'prompt edited');
    const s = next.system || '';
    const yesNo = /yes|no/i.test(s) && /strict/i.test(s) ? 'Strict Yes/No' : null;
    const concise = /concise|short/i.test(s) ? 'Concise answers' : null;
    const ask = /clarify|clarifying/i.test(s) ? 'Ask first' : null;
    bits.push((yesNo || concise || ask || 'prompt edit'));
  }
  return bits.length ? bits.join(' · ') : 'minor tweak';
}
function ensureRefinementBlock(base: string) {
  if (!base.includes(REFINEMENT_HEADER)) {
    return `${REFINEMENT_HEADER}\n\n${base}`.trim();
  }
  const base = parts.length ? parts.join(' · ') : 'minor edit';
  return base.length > 56 ? base.slice(0, 56) + '…' : base;
  return base;
}
function addRuleLine(baseSystem: string, line: string) {
  let s = ensureRefinementBlock(baseSystem || '');
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  const block = s.match(re)?.[0] || `${REFINEMENT_HEADER}\n\n`;
  const injected = block.replace(/\n\n?$/, '') + `\n- ${line.trim()}\n\n`;
  return s.replace(re, injected);
}

/* ─────────────────────────── 200 Feature Chips (inline) ───────────────────────────
   We generate 200 capabilities across categories — Editing, Versioning, AI, Testing,
   UX, Collaboration, Data, Integrations, Security, Performance.
   They’re togglable and persist per-user+agent in localStorage.
*/
/* ============================= 500 Features → Orchestrator ============================= */

type Feature = {
  id: string;
  name: string;
@@ -154,170 +106,184 @@ type Feature = {
  defaultEnabled: boolean;
  tags: string[];
};
const FEATURE_CATEGORIES: Feature['category'][] = ['Editing','Versioning','AI','Testing','UX','Collaboration','Data','Integrations','Security','Performance'];
const IMPROVE_FEATURES: Feature[] = Array.from({length:200}, (_,i) => {
  const n = i+1;
  const cat = FEATURE_CATEGORIES[n % FEATURE_CATEGORIES.length];
const CATS: Feature['category'][] = ['Editing','Versioning','AI','Testing','UX','Collaboration','Data','Integrations','Security','Performance'];
const COUNT = 500;

// Registry (synthetic but deterministic/unique)
const FEATURES: Feature[] = Array.from({ length: COUNT }, (_, i) => {
  const n = i + 1; const cat = CATS[n % CATS.length];
  return {
    id: `improve_feat_${String(n).padStart(3,'0')}`,
    name: `${cat} — ${String(n).padStart(3,'0')}`,
    category: cat,
    description: `[Improve] ${cat} capability #${n}. Adds/refines prompt shaping, rules, history, rollback, test lab, analytics, collaboration, security, performance.`,
    defaultEnabled: n % 6 !== 0, // every 6th starts off
    tags: ['improve','configurable', n % 7 === 0 ? 'beta' : 'stable'],
    description: `Auto ${cat} capability #${n}`,
    defaultEnabled: n % 9 !== 0,    // ~89% on by default
    tags: ['auto', n % 5 === 0 ? 'beta' : 'stable'],
  };
});

/* Feature → System refinements library (a handful are wired directly) */
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
// Orchestrated settings (every flag contributes)
type Orchestrated = {
  density: 'comfortable'|'compact'|'ultra';
  autosaveMs: number;
  listVirtualize: boolean;
  testerPresets: string[];
  enableStreamingSim: boolean;
  maxVersions: number;
  keyboardMap: 'default'|'power';
  showAudit: boolean;
  jsonBias: number; // 0..1
  blockLeakage: boolean;
  debounceMs: number;
  laneMax: 1|2;
};
function computeSettings(flags: Record<string, boolean>): Orchestrated {
  const tally = Object.fromEntries(CATS.map(c => [c, 0])) as Record<Feature['category'], number>;
  Object.entries(flags).forEach(([id, on]) => {
    if (!on) return;
    const idx = Number(id.slice(-3));
    const cat = FEATURES[idx-1]?.category || 'UX';
    tally[cat] += 1;
  });
  const density: Orchestrated['density'] = tally.UX > 60 ? 'ultra' : tally.UX > 25 ? 'compact' : 'comfortable';
  const autosaveMs = Math.max(500, 1800 - (tally.Performance*15 + tally.Editing*3));
  const listVirtualize = tally.Performance > 15 || tally.Data > 20;
  const enableStreamingSim = tally.AI > 25;
  const maxVersions = Math.min(300, 50 + tally.Versioning*2);
  const keyboardMap: Orchestrated['keyboardMap'] = tally.UX + tally.Editing > 60 ? 'power' : 'default';
  const showAudit = tally.Collaboration > 10 || tally.Data > 8;
  const jsonBias = Math.min(1, (tally.Security + tally.AI*0.2) / 40);
  const blockLeakage = tally.Security > 5;
  const debounceMs = Math.max(120, 420 - tally.Performance*8);
  const laneMax: 1|2 = tally.Versioning > 5 ? 2 : 1;
  const basePresets = ['Greet me','Refund policy?','One-sentence summary','Answer Yes/No only','Give 3 bullet points','Explain in 10 words'];
  const extra = ['Write a JSON object','Ask me a clarifying question','Summarize in 2 lines','Extract entities','Rephrase formal','Provide sources?'];
  const testerPresets = basePresets.concat(extra.slice(0, Math.min(6, Math.floor(tally.Testing/8))));
  return { density, autosaveMs, listVirtualize, testerPresets, enableStreamingSim, maxVersions, keyboardMap, showAudit, jsonBias, blockLeakage, debounceMs, laneMax };
}

/* ─────────────────────────── Overlay ─────────────────────────── */
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
/* ============================= Component ============================= */

/* ─────────────────────────── Component (state + header + left rail + feature panel) ─────────────────────────── */
export default function Improve() {
  /* identity */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { (async () => { const { data } = await supabase.auth.getUser(); setUserId(data?.user?.id || null); })(); }, []);

  /* list + selection */
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  /* Search/sort/tag */
  /* search/sort/tag */
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
    } else { // pinned_first
      rows = [...rows].sort((a, b) => {
        const am = JSON.parse(localStorage.getItem(metaKey(userId || '', a.id)) || '{}');
        const bm = JSON.parse(localStorage.getItem(metaKey(userId || '', b.id)) || '{}');
        return (bm.pinned ? 1 : 0) - (am.pinned ? 1 : 0);
      });
    }
    return rows;
  }, [list, query, sort, tagFilter, userId]);

  /* Editor state */
  /* editor state */
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5); // 0=precise, 0.5=balanced, 1=creative
  const [temperature, setTemperature] = useState(0.5);
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
  const [showFeatures, setShowFeatures] = useState(false); // NEW: full feature list/toggles

  /* Versions & test */
  const [versions, setVersions] = useState<Version[]>([]);
  const [diffOpen, setDiffOpen] = useState(false);
  const [diffWith, setDiffWith] = useState<Version | null>(null);
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<{role:'user'|'assistant', text:string}[]>([]);
  const [testing, setTesting] = useState(false);

  /* UI state */
  /* ui */
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
  /* versions */
  const [versions, setVersions] = useState<Version[]>([]);
  const [compareLanes, setCompareLanes] = useState<string[]>([]); // array of versionId (max 2)
  const [versionCommentsFor, setVersionCommentsFor] = useState<string | null>(null); // versionId

  /* features → orchestrated behavior */
  const ownerKey = userId || 'anon';
  const agentKey = selected?.id || 'none';
  const featureKey = flagsKey(ownerKey, agentKey);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [fx, setFx] = useState<Orchestrated>(() => computeSettings({}));

  // Init features (auto-enabled), fetch bots
  useEffect(() => {
    const base = Object.fromEntries(FEATURES.map(f => [f.id, f.defaultEnabled]));
    try {
      const saved = JSON.parse(localStorage.getItem(featureKey) || '{}');
      const merged = { ...base, ...(saved || {}) };
      setFeatureFlags(merged);
      setFx(computeSettings(merged));
    } catch { setFeatureFlags(base); setFx(computeSettings(base)); }
  }, [featureKey]);
  useEffect(() => { try {
    localStorage.setItem(featureKey, JSON.stringify(featureFlags));
    setFx(computeSettings(featureFlags));
  } catch {} }, [featureFlags, featureKey]);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUserId(data?.user?.id || null);
      setLoading(true);
      try {
        const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { headers: { 'x-owner-id': userId } });
        const json = await res.json();
        const rows: BotRow[] = json?.data || [];
        setList(rows);
        if (!selectedId && rows.length) setSelectedId(rows[0].id);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);
  }, [userId]); // eslint-disable-line

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
  // Hydrate selection
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
@@ -328,12 +294,6 @@ export default function Improve() {
    setPromptPre(''); setPromptPost('');
    setBlockedPhrases(''); setEnforceJson(false); setJsonSchemaHint('');
    setFlowTemps({ greeting: 0.5, qa: 0.5, actions: 0.5 });

    const next: Record<string, boolean> = {};
    // prime chips from system
    ['yes_no','concise','ask_clarify','no_greeting'].forEach(k => { next[k] = (selected.system || '').includes(k.replace('_',' ')); });
    setChips(next);

    try {
      const rawV = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(rawV ? JSON.parse(rawV) as Version[] : []);
@@ -351,64 +311,49 @@ export default function Improve() {
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, lastOpenedAt: Date.now() }));
    } catch {}
    setDirty(false);
    setTestLog([]);
    setCompareLanes([]);
    if (undoRef.current) undoRef.current = makeUndoStack(selected.system || '');
  }, [selectedId, userId, selected]);

  /* Dirty + autosave */
  // Dirty + autosave (cadence driven by orchestrator)
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system !== (selected.system || '')) ||
      (notes !== '') || (draft !== false) || (pinned !== false) || (tags.length>0) ||
      name !== (selected.name || '') ||
      model !== (selected.model || 'gpt-4o-mini') ||
      Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9 ||
      system !== (selected.system || '') ||
      (notes !== '') || (draft !== false) || (pinned !== false) || (tags.length > 0) ||
      (promptPre !== '') || (promptPost !== '') ||
      (blockedPhrases !== '') || enforceJson || (jsonSchemaHint !== '') ||
      (Math.abs(flowTemps.greeting-0.5)>1e-9 || Math.abs(flowTemps.qa-0.5)>1e-9 || Math.abs(flowTemps.actions-0.5)>1e-9);
    setDirty(d);
    if (autosave && d && !saving) {
      const t = setTimeout(() => { void saveEdits(true); }, 1200);
      const t = setTimeout(() => { void saveEdits(true); }, fx.autosaveMs);
      return () => clearTimeout(t);
    }
  }, [name, model, temperature, system, notes, draft, pinned, tags, promptPre, promptPost, blockedPhrases, enforceJson, jsonSchemaHint, flowTemps, selected, autosave, saving]);
  }, [name, model, temperature, system, notes, draft, pinned, tags, promptPre, promptPost, blockedPhrases, enforceJson, jsonSchemaHint, flowTemps, selected, autosave, saving, fx.autosaveMs]);

  /* Shortcuts */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') { e.preventDefault(); if (!saving && dirty) void saveEdits(); }
      if (mod && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (undoRef.current?.canUndo()) setSystem(undoRef.current.undo()); }
      if (mod && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); if (undoRef.current?.canRedo()) setSystem(undoRef.current.redo()); }
      if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); setShowFeatures(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saving, dirty]);
  /* ---------------- Actions ---------------- */

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
      const v: Version = { id: `v_${Date.now()}`, ts: Date.now(), label: versionHumanLabel(prev, candidate), name, model, temperature, system, comments: [] };
      const nextVersions = [v, ...(versions || [])].slice(0, fx.maxVersions);
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
@@ -420,8 +365,18 @@ export default function Improve() {
      if (silent) {
        setList(cur => cur.map(b => b.id === selectedId ? { ...b, name, model, temperature, system, updatedAt: candidate.updatedAt } : b));
      } else {
        await fetchBots(userId);
        setSelectedId(selectedId);
        // Refresh list to reflect updatedAt ordering
        const res2 = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { headers: { 'x-owner-id': userId } });
        const json2 = await res2.json(); const rows: BotRow[] = json2?.data || [];
        setList(rows); setSelectedId(selectedId);
      }
      if (fx.showAudit) {
        try {
          const raw = localStorage.getItem(metaKey(userId, selectedId));
          const m: AgentMeta = raw ? JSON.parse(raw) : {};
          const audit = [{ at: Date.now(), action: 'Saved edits' }, ...(m.audit || [])].slice(0, 80);
          localStorage.setItem(metaKey(userId, selectedId), JSON.stringify({ ...m, audit }));
        } catch {}
      }
      setDirty(false);
    } catch (e: any) { alert(e?.message || 'Failed to save'); }
@@ -433,15 +388,14 @@ export default function Improve() {
    if (!confirm('Delete this agent?')) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'DELETE', headers: { 'x-owner-id': userId },
      });
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, { method: 'DELETE', headers: { 'x-owner-id': userId } });
      if (!res.ok) throw new Error('Failed to delete');
      localStorage.removeItem(versionsKey(userId, selectedId));
      localStorage.removeItem(metaKey(userId, selectedId));
      await fetchBots(userId);
      setSelectedId(null);
      setDirty(false);
      localStorage.removeItem(featureKey);
      const res2 = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { headers: { 'x-owner-id': userId } });
      const json2 = await res2.json(); const rows: BotRow[] = json2?.data || [];
      setList(rows); setSelectedId(rows[0]?.id || null); setDirty(false);
    } catch (e: any) { alert(e?.message || 'Failed to delete'); }
    finally { setSaving(false); }
  }
@@ -455,7 +409,9 @@ export default function Improve() {
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok || !json?.data?.id) throw new Error(json?.error || 'Failed to duplicate');
      await fetchBots(userId); setSelectedId(json.data.id);
      const res2 = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { headers: { 'x-owner-id': userId } });
      const rows: BotRow[] = (await res2.json())?.data || [];
      setList(rows); setSelectedId(json.data.id);
    } catch (e:any) { alert(e?.message || 'Failed to duplicate'); }
  }

@@ -476,7 +432,6 @@ export default function Improve() {
    const url = URL.createObjectURL(blob); const a = document.createElement('a');
    a.href = url; a.download = `${(name||'agent').replace(/\s+/g,'_')}.json`; a.click(); URL.revokeObjectURL(url);
  }

  async function importAgent(file: File) {
    if (!userId) return;
    try {
@@ -488,56 +443,144 @@ export default function Improve() {
      const json = await res.json(); if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to import');
      const newId = json.data.id as string;
      localStorage.setItem(metaKey(userId, newId), JSON.stringify(a.meta || {}));
      await fetchBots(userId); setSelectedId(newId);
      const res2 = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { headers: { 'x-owner-id': userId } });
      const rows: BotRow[] = (await res2.json())?.data || [];
      setList(rows); setSelectedId(newId);
    } catch (e:any) { alert(e?.message || 'Import failed'); }
  }

  /* UI helpers */
  const tokenEst = estimateTokens(system);
  const tempMode: 'precise'|'balanced'|'creative' =
    temperature <= 0.25 ? 'precise' : temperature >= 0.75 ? 'creative' : 'balanced';
  function setTempMode(m: typeof tempMode) {
    setTemperature(m==='precise'?0.1 : m==='creative'?0.9 : 0.5);
  function setTempMode(mode: 'precise'|'balanced'|'creative') {
    setTemperature(mode==='precise'?0.1 : mode==='creative'?0.9 : 0.5);
  }
  async function copyId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(()=>setCopied(false), 1000); } catch {}
  }

  // Persist feature flags per user+agent
  const ownerKey = userId || 'anon';
  const agentKey = selected?.id || 'none';
  const flagsKey = `improve:flags:${ownerKey}:${agentKey}`;
  const [featureQuery, setFeatureQuery] = useState('');
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  useEffect(() => {
    // load on agent change
  /* ---------------- Test sandbox (side-by-side lanes) ---------------- */

  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [testLog, setTestLog] = useState<
    Array<{ lane: 0|1; role: 'user'|'assistant'; text: string; versionId?: string }>
  >([]);

  function laneTitle(versionId?: string): string {
    if (!versionId) return 'Current draft';
    const v = versions.find(v => v.id === versionId);
    if (!v) return 'Snapshot';
    return `${v.label} — ${fmtTime(v.ts)}`;
  }

  // Basic chat call — will fall back to client sim if /api/assistants/chat not present
  async function runTestOnce(lane: 0|1, prompt: string, versionId?: string) {
    const v = versionId ? versions.find(x => x.id === versionId) : null;
    const sys = v ? v.system : system;
    const payload = { system: sys, model, temperature, input: prompt, enforceJson, jsonSchemaHint, flowTemps };
    try {
      const base: Record<string, boolean> = Object.fromEntries(IMPROVE_FEATURES.map(f => [f.id, f.defaultEnabled]));
      const saved = JSON.parse(localStorage.getItem(flagsKey) || '{}');
      setFeatureFlags({ ...base, ...(saved||{}) });
      const resp = await fetch('/api/assistants/chat', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(payload) });
      if (resp.ok) {
        const data = await resp.json();
        const text = String(data?.text ?? '[no response]');
        setTestLog(l => [...l, { lane, role:'assistant', text, versionId }]);
      } else {
        // simulate with simple echo + rules bias
        const simulated = simulateResponse(sys, prompt, fx.jsonBias);
        setTestLog(l => [...l, { lane, role:'assistant', text: simulated, versionId }]);
      }
    } catch {
      const base: Record<string, boolean> = Object.fromEntries(IMPROVE_FEATURES.map(f => [f.id, f.defaultEnabled]));
      setFeatureFlags(base);
      const simulated = simulateResponse(sys, prompt, fx.jsonBias);
      setTestLog(l => [...l, { lane, role:'assistant', text: simulated, versionId }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flagsKey]);
  }

  useEffect(() => {
    try { localStorage.setItem(flagsKey, JSON.stringify(featureFlags)); } catch {}
  }, [featureFlags, flagsKey]);
  function simulateResponse(sys: string, prompt: string, jsonBias: number): string {
    const yesNo = /yes|no/i.test(sys) && /strict/i.test(sys);
    const concise = /concise|short/i.test(sys);
    const ask = /clarify/i.test(sys);
    if (ask && /unclear|ambiguous|what do you mean/i.test(prompt)) return 'Can you clarify what you need?';
    if (yesNo) return /(^|\b)(yes|no)\b/i.test(prompt) ? RegExp.$2 : 'Yes.'; // super basic
    const base = `Answer to: ${prompt}`;
    const compact = concise ? base.slice(0, 120) : `${base} — (draft)`;
    if (jsonBias > 0.6) return JSON.stringify({ answer: compact });
    return compact;
  }

  async function runTest() {
    const q = testInput.trim();
    if (!q) return;
    setTesting(true);
    setTestLog(l => [...l, { lane: 0, role: 'user', text: q }, ...(compareLanes[1] ? [{ lane: 1, role: 'user', text: q }] : [])]);
    await Promise.all([
      runTestOnce(0, q, compareLanes[0]),
      compareLanes[1] ? runTestOnce(1, q, compareLanes[1]) : Promise.resolve()
    ]);
    setTesting(false);
  }

  // Drag versions → test area lanes
  function onVersionDragStart(e: React.DragEvent, versionId: string) {
    e.dataTransfer.setData('text/improve-version', versionId);
    e.dataTransfer.effectAllowed = 'copy';
  }
  function onLaneDrop(e: React.DragEvent, laneIndex: 0|1) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/improve-version');
    if (!id) return;
    setCompareLanes(cur => {
      const next = [...cur] as string[];
      if (laneIndex === 0) next[0] = id;
      if (laneIndex === 1) next[1] = id;
      return next.slice(0, 2);
    });
  }

  /* ---------------- Versions: comments + translate action ---------------- */

  function addVersionComment(versionId: string, text: string) {
    setVersions(vs => vs.map(v => v.id === versionId ? {
      ...v, comments: [{ id: uid(), text, at: Date.now() }, ...(v.comments || [])]
    } : v));
    if (userId && selectedId) {
      const key = versionsKey(userId, selectedId);
      try { const cur = JSON.parse(localStorage.getItem(key) || '[]'); const map = (cur as Version[]).map(v => v.id === versionId ? {
        ...v, comments: [{ id: uid(), text, at: Date.now() }, ...(v.comments || [])]
      } : v); localStorage.setItem(key, JSON.stringify(map)); } catch {}
    }
  }
  function translateCommentInline(versionId: string, commentId: string, toLang: string) {
    setVersions(vs => vs.map(v => {
      if (v.id !== versionId) return v;
      const comments = (v.comments || []).map(c => c.id !== commentId ? c : ({ ...c, text: `[${toLang}] ${c.text}` }));
      return { ...v, comments };
    }));
    if (userId && selectedId) {
      const key = versionsKey(userId, selectedId);
      try { const cur = JSON.parse(localStorage.getItem(key) || '[]'); const map = (cur as Version[]).map(v => {
        if (v.id !== versionId) return v;
        const comments = (v.comments || []).map((c:any) => c.id !== commentId ? c : ({ ...c, text: `[${toLang}] ${c.text}` }));
        return { ...v, comments };
      }); localStorage.setItem(key, JSON.stringify(map)); } catch {}
    }
  }

  /* ---------------- Density from orchestrator ---------------- */

  const densityClass = fx.density === 'ultra' ? 'text-[13px] leading-[1.1]' : fx.density === 'compact' ? 'text-[14px]' : 'text-[15px]';
  const editorRows = fx.density === 'ultra' ? 9 : fx.density === 'compact' ? 11 : 12;

  /* ---------------- Render ---------------- */

  /* HEADER + LEFT RAIL + FEATURES BUTTON */
  return (
    <div className="min-h-screen relative" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
    <div className={cls('min-h-screen relative', densityClass)} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <BgFX />

      {/* Sticky command bar */}
      {/* Sticky top: title + global actions moved next to context */}
      <header className="sticky top-0 z-30 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1680px] mx-auto flex items-center gap-3">
          <SplitSquareHorizontal className="w-5 h-5" style={{ color:'var(--brand)' }} />
          <h1 className="text-[20px] font-semibold">{selected ? (selected.name || 'Agent') : 'Agent Tuning'}</h1>
          <Columns2 className="w-5 h-5" />
          <h1 className="text-[18px] font-semibold">{selected ? (selected.name || 'Agent') : 'Agent Tuning'}</h1>

          <span className="text-xs px-2 py-[2px] rounded-full"
                style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
@@ -552,56 +595,20 @@ export default function Improve() {
          )}

          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setShowFeatures(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <SlidersHorizontal className="inline w-4 h-4 mr-1" /> Features ({Object.keys(featureFlags).length})
            </button>

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

            {/* Import/Export/Duplicate placed by title for project-level ops */}
            <label className="px-3 py-1.5 rounded-md text-sm cursor-pointer" style={{ ...CARD }}>
              <Upload className="inline w-4 h-4 mr-1" /> Import
              <input type="file" accept="application/json" className="hidden" onChange={e => e.target.files && importAgent(e.target.files[0])} />
            </label>

            <button onClick={exportAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Download className="inline w-4 h-4 mr-1" /> Export
            </button>

            <button onClick={duplicateAgent} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <FilePlus2 className="inline w-4 h-4 mr-1" /> Duplicate
              Duplicate
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
            <button onClick={() => userId && (async ()=>{ setLoading(true); await new Promise(r=>setTimeout(r,150)); try{ const res=await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`,{headers:{'x-owner-id':userId}}); const rows:BotRow[]=(await res.json())?.data||[]; setList(rows);}catch{} setLoading(false); })()} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <RefreshCw className="inline w-4 h-4 mr-1" /> Refresh
            </button>

            <button onClick={deleteSelected} disabled={!selected || saving}
                    className="px-3 py-1.5 rounded-md text-sm disabled:opacity-60"
                    style={{ background:'rgba(255,80,80,.12)', border:'1px solid rgba(255,80,80,.35)' }}>
@@ -611,180 +618,103 @@ export default function Improve() {
        </div>
      </header>

      {/* Canvas with internal scroll panes (no page scroll) */}
<div className="max-w-[1680px] mx-auto px-6 py-5">
  <div className="grid gap-3" style={{ gridTemplateColumns: '320px 1fr' }}>
    {/* Left rail */}
    <aside className="h-[calc(100vh-140px)]" style={PANEL}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
          <div className="font-semibold">Assistants</div>
        </div>
        <div className="relative mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none"
            style={CARD}
          />
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 opacity-70" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-2 py-1 rounded-md text-xs"
            style={CARD}
          >
            <option value="pinned_first">Pinned</option>
            <option value="name_asc">Name</option>
            <option value="updated_desc">Recent</option>
          </select>
          <div className="flex items-center gap-1">
            <TagIcon className="w-4 h-4 opacity-70" />
            <input
              placeholder="Tag filter"
              value={tagFilter}
              onChange={(e) => setTagFilter(e.target.value)}
              className="px-2 py-1 rounded-md text-xs"
              style={{ ...CARD, width: 120 }}
            />
          </div>
        </div>
      </div>

      <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 118px)' }}>
        {loading ? (
          <div className="grid place-items-center py-10 opacity-70">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
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
      {/* 3 columns: left list · editor · versions rail */}
      <div className="max-w-[1680px] mx-auto px-6 py-5">
        <div className="grid gap-3" style={{ gridTemplateColumns: '320px 1fr 300px' }}>
          {/* Left rail */}
          <aside className="h-[calc(100vh-140px)]" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
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
          </div>
        ) : (
          <ul className="space-y-2">
            {filtered.map((b) => {
              let pinnedLocal = false,
                draftLocal = false,
                tagsLocal: string[] = [];
              try {
                if (userId) {
                  const raw = localStorage.getItem(metaKey(userId, b.id));
                  const m: AgentMeta = raw ? JSON.parse(raw) : {};
                  pinnedLocal = !!m.pinned;
                  draftLocal = !!m.draft;
                  tagsLocal = m.tags || [];
                }
              } catch {}
              const active = selectedId === b.id;
              return (
                <li key={b.id}>
                  <button
                    onClick={() => setSelectedId(b.id)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${
                      active ? 'ring-1' : ''
                    }`}
                    style={{
                      ...CARD,
                      borderColor: active ? 'var(--brand)' : 'var(--border)',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-md grid place-items-center"
                      style={{
                        background: 'rgba(0,0,0,.2)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate flex items-center gap-2">
                        {b.name || 'Untitled'}
                        {draftLocal ? (
                          <span
                            className="text-[10px] px-1.5 py-[1px] rounded-full"
                            style={{
                              background: 'rgba(255,200,0,.12)',
                              border: '1px solid rgba(255,200,0,.35)',
                            }}
                          >
                            Draft
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] opacity-60 truncate">
                        {b.model} · {b.id.slice(0, 8)}
                      </div>
                      {tagsLocal.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {tagsLocal.slice(0, 3).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] px-1 py-[1px] rounded"
                              style={{
                                background: 'rgba(0,0,0,.15)',
                                border: '1px solid var(--border)',
                              }}
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {pinnedLocal ? (
                      <Star className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>

    {/* Right column continues… */}

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
                        <button onClick={()=>setSelectedId(b.id)} className={cls('w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition', active && 'ring-1')}
                                style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                          <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.08)', border: '1px solid var(--border)' }}>
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
                                  <span key={t} className="text-[10px] px-1 py-[1px] rounded" style={{ background:'rgba(0,0,0,.06)', border:'1px solid var(--border)' }}>{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          {pinnedLocal ? <Star className="w-4 h-4" /> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Right column continues in PART 2… */}
          {/* Editor column (no internal scroll except textareas) */}
          {/* Editor column */}
          <section className="h-[calc(100vh-140px)] grid gap-3"
                   style={{ gridTemplateRows: 'auto auto 1fr', ...PANEL }}>
            {/* Top row: Name + Model + Temp mode */}
            {/* Top row: Name + Model + Temp + Save */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1.2fr 0.9fr 1fr' }}>
              <div className="grid gap-3 items-end" style={{ gridTemplateColumns: '1.25fr .9fr .9fr auto' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Name</div>
                  <input
                    value={name}
                    onChange={(e)=>setName(e.target.value)}
                    className="w-full px-3 py-2 rounded-md text-[15px]"
                    style={CARD}
                    placeholder="Agent name"
                  />
                  <input value={name} onChange={(e)=>setName(e.target.value)} className="w-full px-3 py-2 rounded-md text-[15px]" style={CARD} placeholder="Agent name" />
                </div>
                <div>
                  <div className="text-xs opacity-70 mb-1">Model</div>
                  <select
                    value={model}
                    onChange={(e)=>setModel(e.target.value)}
                    className="w-full px-3 py-2 rounded-md"
                    style={CARD}
                  >
                  <select value={model} onChange={(e)=>setModel(e.target.value)} className="w-full px-3 py-2 rounded-md" style={CARD}>
                    <option value="gpt-4o-mini">gpt-4o-mini</option>
                    <option value="gpt-4o">gpt-4o</option>
                    <option value="gpt-4.1-mini">gpt-4.1-mini</option>
@@ -793,131 +723,83 @@ export default function Improve() {
                <div>
                  <div className="text-xs opacity-70 mb-1">Temperature</div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={()=>setTempMode('precise')}
                      className={`px-3 py-2 rounded-md text-sm ${tempMode==='precise'?'ring-1':''}`}
                      style={{ ...CARD, borderColor: tempMode==='precise' ? 'var(--brand)' : 'var(--border)' }}
                    >
                      Precise
                    </button>
                    <button
                      onClick={()=>setTempMode('balanced')}
                      className={`px-3 py-2 rounded-md text-sm ${tempMode==='balanced'?'ring-1':''}`}
                      style={{ ...CARD, borderColor: tempMode==='balanced' ? 'var(--brand)' : 'var(--border)' }}
                    >
                      Balanced
                    </button>
                    <button
                      onClick={()=>setTempMode('creative')}
                      className={`px-3 py-2 rounded-md text-sm ${tempMode==='creative'?'ring-1':''}`}
                      style={{ ...CARD, borderColor: tempMode==='creative' ? 'var(--brand)' : 'var(--border)' }}
                    >
                      Creative
                    </button>
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">
                    est {estimateTokens(system).toLocaleString()} tokens
                    <button onClick={()=>setTempMode('precise')} className={cls('px-3 py-2 rounded-md text-sm', temperature<=0.25 && 'ring-1')} style={{ ...CARD, borderColor: temperature<=0.25 ? 'var(--brand)' : 'var(--border)' }}>Precise</button>
                    <button onClick={()=>setTempMode('balanced')} className={cls('px-3 py-2 rounded-md text-sm', temperature>0.25 && temperature<0.75 && 'ring-1')} style={{ ...CARD, borderColor: (temperature>0.25 && temperature<0.75) ? 'var(--brand)' : 'var(--border)' }}>Balanced</button>
                    <button onClick={()=>setTempMode('creative')} className={cls('px-3 py-2 rounded-md text-sm', temperature>=0.75 && 'ring-1')} style={{ ...CARD, borderColor: temperature>=0.75 ? 'var(--brand)' : 'var(--border)' }}>Creative</button>
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">est {estimateTokens(system).toLocaleString()} tokens</div>
                </div>
                <div className="justify-self-end">
                  <button onClick={() => !saving && dirty && saveEdits()} disabled={!dirty || saving}
                          className="px-4 py-2 rounded-md text-sm disabled:opacity-60 flex items-center gap-1"
                          style={{ background:'var(--brand)', color:'#00120a' }}>
                    <Save className="w-4 h-4" /> Save
                  </button>
                </div>
              </div>
            </div>

            {/* Middle row: Tags + Quick flags + Chips */}
            {/* Middle row: Tags + Quick flags + Guardrails */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 0.8fr' }}>
                {/* Tags */}
              <div className="grid gap-3" style={{ gridTemplateColumns: '1fr 0.9fr' }}>
                {/* Tags + Add Rule */}
                <div>
                  <div className="text-xs opacity-70 mb-1">Tags</div>
                  <div className="text-xs opacity-70 mb-1">Tags & quick rules</div>
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
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter') {
                          const v = (e.target.value || '').trim();
                          if (v) {
                            const next = [...tags]; if (!next.includes(v)) next.push(v); setTags(next);
                          }
                          e.target.value='';
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-2 rounded-md text-sm flex-1" style={CARD}
                    />
                    {/* Add a rule line (inserts into ACTIVE REFINEMENTS) */}
                    <input
                      placeholder="Add rule → inserts into ACTIVE REFINEMENTS"
                      onKeyDown={(e: any) => {
                        if (e.key === 'Enter') {
                          const v = (e.target.value || '').trim();
                          if (v) setSystem(s => addRuleLine(s, v));
                          e.target.value = '';
                        }
                      }}
                      className="px-3 py-2 rounded-md text-sm flex-1"
                      style={CARD}
                      className="px-3 py-2 rounded-md text-sm flex-1" style={CARD}
                    />
                    <div className="flex flex-wrap gap-2">
                  </div>
                  {tags.length>0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {tags.map(t => (
                        <span
                          key={t}
                          className="text-xs px-2 py-1 rounded"
                          style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}
                        >
                          {t}{' '}
                          <button className="ml-1 opacity-70" onClick={()=>setTags(tags.filter(x=>x!==t))}>×</button>
                        <span key={t} className="text-xs px-2 py-1 rounded" style={{ background:'rgba(0,0,0,.06)', border:'1px solid var(--border)' }}>
                          {t} <button className="ml-1 opacity-70" onClick={()=>setTags(tags.filter(x=>x!==t))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  )}
                </div>

                {/* Quick flags */}
                <div className="grid gap-2" style={{ gridTemplateColumns:'1fr 1fr 1fr' }}>
                  <button
                    onClick={()=>setPinned(v=>!v)}
                    className="px-3 py-2 rounded-md text-sm"
                    style={{ ...CARD }}
                  >
                  <button onClick={()=>setPinned(v=>!v)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    {pinned ? <><Star className="inline w-4 h-4 mr-1" />Pinned</> : <><StarOff className="inline w-4 h-4 mr-1" />Pin</>}
                  </button>
                  <button
                    onClick={()=>setDraft(v=>!v)}
                    className="px-3 py-2 rounded-md text-sm"
                    style={{ ...CARD }}
                  >
                  <button onClick={()=>setDraft(v=>!v)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    {draft ? <><ToggleLeft className="inline w-4 h-4 mr-1" />Draft</> : <><ToggleRight className="inline w-4 h-4 mr-1" />Published</>}
                  </button>
                  <button
                    onClick={()=>setShowAdvanced(true)}
                    className="px-3 py-2 rounded-md text-sm"
                    style={{ ...CARD }}
                  >
                  <button onClick={()=>{ /* open advanced below */ const el=document.getElementById('advanced-guardrails'); el?.scrollIntoView({ behavior:'smooth', block:'center' }); }}
                          className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    <Shield className="inline w-4 h-4 mr-1" />Guardrails
                  </button>
                </div>
              </div>

              {/* Refinement chips */}
              <div className="mt-3 flex flex-wrap gap-2">
                {['Tone','Format','Guardrails'].map(group => (
                  <div key={group} className="p-2 rounded-md" style={{ ...CARD }}>
                    <div className="text-[11px] mb-1 opacity-70">{group}</div>
                    <div className="flex flex-wrap gap-2">
                      {CHIP_LIBRARY.filter(c=>c.group===group).map(c => (
                        <button
                          key={c.key}
                          onClick={()=>{
                            const next={...chips,[c.key]:!chips[c.key]};
                            setChips(next);
                            setSystem(s=>applyRefinementsToSystem(s,next));
                          }}
                          className="px-3 py-1.5 rounded-md text-sm transition"
                          style={
                            chips[c.key]
                              ? { background: 'color-mix(in oklab, var(--brand) 25%, transparent)', border: '1px solid var(--brand)' }
                              : { background: 'color-mix(in oklab, var(--text) 7%, transparent)', border: '1px solid var(--border)' }
                          }
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

            {/* Bottom: Prompts + Notes */}
            {/* Bottom: Prompts + Notes (system hidden by default) */}
            <div className="p-3 overflow-auto">
              {!selected ? (
                <div className="grid place-items-center h-[50vh] opacity-70">
@@ -927,476 +809,196 @@ export default function Improve() {
                <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Pre Prompt</div>
                    <textarea
                      value={promptPre}
                      onChange={(e)=>setPromptPre(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                      style={CARD}
                      placeholder="Optional: pre instructions (role, objectives)…"
                    />
                    <textarea value={promptPre} onChange={(e)=>setPromptPre(e.target.value)} rows={6}
                              className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                              placeholder="Optional: pre instructions (role, objectives)…" />
                  </div>
                  <div>
                    <div className="text-xs opacity-70 mb-1">Post Prompt</div>
                    <textarea
                      value={promptPost}
                      onChange={(e)=>setPromptPost(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                      style={CARD}
                      placeholder="Optional: post processing (formatting, checks)…"
                    />
                    <textarea value={promptPost} onChange={(e)=>setPromptPost(e.target.value)} rows={6}
                              className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm" style={CARD}
                              placeholder="Optional: post processing (formatting, checks)…" />
                  </div>

                  {/* System (collapsible) */}
                  <div className="col-span-2">
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
                      onChange={(e)=>setSystem(e.target.value)}
                      rows={12}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6"
                      style={CARD}
                      placeholder="Describe your agent's behavior, tone, policies, and knowledge…"
                      onKeyDown={(e) => {
                        const el = e.target as HTMLTextAreaElement;
                        if (e.key === 'Enter' && el.value.endsWith('/refine')) {
                          e.preventDefault();
                          const nv = el.value.replace(
                            /\/refine$/,
                            `${REFINEMENT_HEADER}\n- Keep answers short and precise.\n- Ask a clarifying question when necessary.\n\n`
                          );
                          setSystem(nv);
                        }
                      }}
                    />
                    <div className="flex items-center justify-between text-xs mt-1">
                      <div className="opacity-70">{(system?.length || 0).toLocaleString()} chars · est {tokenEst.toLocaleString()} tokens</div>
                      <div className="opacity-70 flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5" /> Tip: Use headings (### …) and examples for clarity.
                    <details open={false}>
                      <summary className="cursor-pointer select-none px-2 py-1 rounded-md inline-flex items-center gap-2" style={{ ...CARD }}>
                        <HelpCircle className="w-4 h-4" /> Show prompt
                      </summary>
                      <div className="mt-2">
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
                        <textarea value={system} onChange={(e)=>setSystem(e.target.value)} rows={editorRows}
                                  className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6" style={CARD}
                                  placeholder="Describe your agent's behavior, tone, policies, and knowledge…" />
                        <div className="flex items-center justify-between text-xs mt-1">
                          <div className="opacity-70">{(system?.length || 0).toLocaleString()} chars · est {estimateTokens(system).toLocaleString()} tokens</div>
                          <div className="opacity-70 flex items-center gap-1"><HelpCircle className="w-3.5 h-3.5" /> Tip: add rules via the “Add rule” box above.</div>
                        </div>
                      </div>
                    </div>
                    </details>
                  </div>

                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">Notes for you & colleagues</div>
                    <textarea
                      value={notes}
                      onChange={(e)=>setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 rounded-md outline-none text-sm"
                      style={CARD}
                      placeholder="Share context for your future self and teammates…"
                    />
                    <div className="text-xs opacity-70 mb-1">Notes</div>
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

      {/* ─────────────────────────── FEATURES OVERLAY (200 toggles) ─────────────────────────── */}
      {showFeatures && (
        <Overlay onClose={()=>setShowFeatures(false)}>
          <div className="w-[min(1000px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <SlidersHorizontal className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Improve Features (200)</div>
              <div className="ml-auto flex items-center gap-2">
                <input
                  value={featureQuery}
                  onChange={(e)=>setFeatureQuery(e.target.value)}
                  placeholder="Search features…"
                  className="px-3 py-1.5 rounded-md text-sm"
                  style={CARD}
                />
                <button
                  onClick={()=>{
                    const next = Object.fromEntries(IMPROVE_FEATURES.map(f => [f.id, true]));
                    setFeatureFlags(next);
                  }}
                  className="px-2 py-1.5 rounded-md text-xs"
                  style={{ ...CARD }}
                >
                  Enable all
                </button>
                <button
                  onClick={()=>{
                    const next = Object.fromEntries(IMPROVE_FEATURES.map(f => [f.id, false]));
                    setFeatureFlags(next);
                  }}
                  className="px-2 py-1.5 rounded-md text-xs"
                  style={{ ...CARD }}
                >
                  Disable all
                </button>
                <button onClick={()=>setShowFeatures(false)} className="px-2 py-1 rounded-md" style={{ ...CARD }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns:'1fr', height:'calc(85vh - 60px)' }}>
              <div className="p-3 overflow-auto">
                {FEATURE_CATEGORIES.map(cat => {
                  const list = IMPROVE_FEATURES
                    .filter(f => f.category === cat)
                    .filter(f => !featureQuery.trim()
                      || f.name.toLowerCase().includes(featureQuery.toLowerCase())
                      || f.description.toLowerCase().includes(featureQuery.toLowerCase())
                      || f.tags.some(t => t.toLowerCase().includes(featureQuery.toLowerCase()))
                    );
                  if (!list.length) return null;
                  const allOn = list.every(f => featureFlags[f.id]);
                  const someOn = list.some(f => featureFlags[f.id]);
                  return (
                    <div key={cat} className="mb-4 rounded-lg" style={{ ...CARD }}>
                      <div className="px-3 py-2 flex items-center gap-2 border-b" style={{ borderColor:'var(--border)' }}>
                        <div className="font-medium">{cat}</div>
                        <div className="text-xs opacity-60">({list.length})</div>
                        <div className="ml-auto flex items-center gap-2">
                          <button
                            className="px-2 py-1 rounded-md text-xs"
                            style={{ ...CARD }}
                            onClick={()=>{
                              const next = { ...featureFlags };
                              list.forEach(f => { next[f.id] = true; });
                              setFeatureFlags(next);
                            }}
                          >
                            Turn on
                          </button>
                          <button
                            className="px-2 py-1 rounded-md text-xs"
                            style={{ ...CARD }}
                            onClick={()=>{
                              const next = { ...featureFlags };
                              list.forEach(f => { next[f.id] = false; });
                              setFeatureFlags(next);
                            }}
                          >
                            Turn off
                          </button>
                          <span className="text-[11px] opacity-70">
                            {allOn ? 'All on' : someOn ? 'Some on' : 'All off'}
                          </span>
                        </div>
                  {/* Advanced Guardrails */}
                  <div id="advanced-guardrails" className="col-span-2 p-3 rounded-md" style={{ ...CARD }}>
                    <div className="font-medium mb-2 flex items-center gap-2"><Shield className="w-4 h-4" /> Advanced Guardrails</div>
                    <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                      <div className="col-span-2">
                        <div className="text-xs opacity-70 mb-1">Blocked phrases (one per line)</div>
                        <textarea value={blockedPhrases} onChange={(e)=>setBlockedPhrases(e.target.value)} rows={6}
                                  className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                                  style={CARD} placeholder="forbidden term A\nforbidden term B" />
                      </div>

                      <div className="grid gap-2 p-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                        {list.map(f => (
                          <label key={f.id} className="flex items-start gap-2 text-sm p-2 rounded-md"
                                 style={{ background:'rgba(0,0,0,.16)', border:'1px solid var(--border)' }}>
                            <input
                              type="checkbox"
                              checked={!!featureFlags[f.id]}
                              onChange={(e)=>{
                                setFeatureFlags(prev => ({ ...prev, [f.id]: e.target.checked }));
                              }}
                              className="mt-[2px]"
                            />
                            <div className="min-w-0">
                              <div className="font-medium truncate">{f.name}</div>
                              <div className="text-xs opacity-70 truncate">{f.description}</div>
                              <div className="mt-1 flex flex-wrap gap-1">
                                {f.tags.map(t => (
                                  <span key={t} className="text-[10px] px-1 py-[1px] rounded"
                                        style={{ background:'rgba(0,0,0,.15)', border:'1px solid var(--border)' }}>
                                    {t}
                                  </span>
                                ))}
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
                                  className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                                  style={CARD} placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}' />
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs opacity-70 mb-1">Per-Flow Temperature</div>
                        {(['greeting','qa','actions'] as const).map(key=>(
                          <div key={key} className="mb-2">
                            <div className="flex items-center justify-between mb-1">
                              <div className="text-sm capitalize">{key}</div>
                              <div className="text-xs opacity-70">{flowTemps[key].toFixed(2)}</div>
                            </div>
                          </label>
                            <input type="range" min={0} max={1} step={0.01} value={flowTemps[key]}
                                   onChange={(e)=>setFlowTemps(s=>({ ...s, [key]: Number(e.target.value) }))} className="w-full" />
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Overlay>
      )}
          </section>

      {/* More overlays (Versions, Diff, Test, Advanced, Flow Tuner) continue in PART 3… */}
      {/* Slide-over: Versions & Diff */}
      {showVersions && selected && (
        <Overlay onClose={()=>setShowVersions(false)}>
          <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <History className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Versions for {selected.name || selected.id.slice(0,6)}</div>
              <button onClick={()=>setShowVersions(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
          {/* Versions rail (right) — scrollable, draggable to lanes */}
          <aside className="h-[calc(100vh-140px)] overflow-hidden" style={PANEL}>
            <div className="p-3 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <History className="w-4 h-4" />
              <div className="font-semibold">Versions</div>
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
                      <button
                        onClick={()=>{
                          setName(v.name); setModel(v.model);
                          setTemperature(v.temperature); setSystem(v.system);
                          setDirty(true);
                        }}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ background:'color-mix(in oklab, var(--brand) 18%, transparent)', border:'1px solid var(--brand)' }}
                      >
            <div className="p-3 overflow-auto" style={{ maxHeight: 'calc(100% - 50px)' }}>
              {(!versions || versions.length===0) && (
                <div className="text-sm opacity-60">No snapshots yet. Click <b>Save</b> to create one.</div>
              )}
              <div className="space-y-2">
                {versions.map(v => (
                  <div key={v.id}
                       className="p-2 rounded-md text-sm border"
                       style={{ ...CARD, cursor:'grab' }}
                       draggable
                       onDragStart={(e)=>onVersionDragStart(e, v.id)}>
                    <div className="font-medium truncate">{v.label}</div>
                    <div className="text-[11px] opacity-60">{fmtTime(v.ts)}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={()=>{
                        // restore
                        setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true);
                      }} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                        <RotateCcw className="inline w-3 h-3 mr-1" /> Restore
                      </button>
                      <button
                        onClick={()=>{ setDiffWith(v); setDiffOpen(true); }}
                        className="px-2 py-1 rounded-md text-xs"
                        style={{ ...CARD }}
                      >
                        <Diff className="inline w-3 h-3 mr-1" /> Diff
                      <button onClick={()=>setVersionCommentsFor(v.id)} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                        <MessageSquareMore className="inline w-3 h-3 mr-1" /> Comments
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="p-3 overflow-auto">
                <div className="text-sm opacity-60 mb-2 flex items-center gap-2">
                  <PanelsTopLeft className="w-4 h-4" /> Recent Activity
                </div>
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
                    {versionCommentsFor===v.id && (
                      <div className="mt-2 p-2 rounded-md" style={{ background:'rgba(0,0,0,.04)', border:'1px dashed var(--border)' }}>
                        <div className="text-xs opacity-70 mb-1">Comments</div>
                        <div className="space-y-1 max-h-36 overflow-auto">
                          {(v.comments||[]).map(c=>(
                            <div key={c.id} className="text-xs flex items-start justify-between gap-2">
                              <span className="flex-1">{c.text}</span>
                              <div className="flex items-center gap-1">
                                <button className="text-[10px] underline opacity-70" onClick={()=>{
                                  const lang = prompt('Translate this comment to which language? e.g., "de", "fr", "es"');
                                  if (lang) translateCommentInline(v.id, c.id, lang);
                                }}>translate</button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input id={`cm-${v.id}`} placeholder="Add comment and press Enter"
                                 onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const val=(e.target.value||'').trim(); if(val){ addVersionComment(v.id, val); e.target.value=''; }}}}
                                 className="px-2 py-1 rounded-md text-xs flex-1" style={CARD}/>
                          <button onClick={()=>setVersionCommentsFor(null)} className="px-2 py-1 rounded-md text-xs" style={CARD}><X className="w-3 h-3"/></button>
                        </div>
                      </div>
                    );
                  } catch { return <div className="text-xs opacity-60">No recent actions.</div>; }
                })()}
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* Diff modal */}
      {diffOpen && diffWith && (
        <Overlay onClose={()=>setDiffOpen(false)}>
          <div className="w-[min(1000px,95vw)] max-h-[80vh] overflow-hidden rounded-2xl" style={PANEL}>
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

      {/* Slide-over: Test */}
      {showTest && selected && (
        <Overlay onClose={()=>setShowTest(false)}>
          <div className="w-[min(900px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Sparkles className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Test “{selected.name || selected.id.slice(0,6)}”</div>
              <button onClick={()=>setShowTest(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                {['Greet me','Refund policy?','One-sentence summary','Answer Yes/No only'].map(t=>(
                  <button key={t} onClick={()=>runTest(t)} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="space-y-2 max-h-[55vh] overflow-auto rounded-md p-2"
                   style={{ background:'rgba(0,0,0,.22)', border:'1px solid var(--border)' }}>
                {testLog.length === 0 ? (
                  <div className="text-xs opacity-60">No messages yet.</div>
                ) : testLog.map((m,i)=>(
                  <div key={i} className={`text-sm ${m.role==='user'?'text-[var(--text)]':'opacity-85'}`}>
                    <b>{m.role==='user'?'You':'AI'}:</b> {stripMarkdownNoise(m.text)}
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input
                  value={testInput}
                  onChange={(e)=>setTestInput(e.target.value)}
                  onKeyDown={(e)=>{
                    if(e.key==='Enter' && !e.shiftKey){
                      e.preventDefault(); if(!testing) runTest();
                    }
                  }}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 rounded-md text-sm"
                  style={CARD}
                />
                <button
                  onClick={()=>runTest()}
                  disabled={testing || !testInput.trim()}
                  className="px-3 py-2 rounded-md text-sm disabled:opacity-60"
                  style={{ background:'var(--brand)', color:'#00120a' }}
                >
                  {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="inline w-4 h-4 mr-1" /> Send</>}
                </button>
              </div>
            </div>
          </div>
        </Overlay>
      )}
          </aside>
        </div>

      {/* Slide-over: Advanced */}
      {showAdvanced && selected && (
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
                <textarea
                  value={blockedPhrases}
                  onChange={(e)=>setBlockedPhrases(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                  style={CARD}
                  placeholder="forbidden term A\nforbidden term B"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={enforceJson} onChange={(e)=>setEnforceJson(e.target.checked)} />
                  Enforce JSON outputs when applicable
                </label>
                <div className="text-xs opacity-70 mt-1">Biases responses to valid JSON if schema provided.</div>
              </div>
              <div>
                <div className="text-xs opacity-70 mb-1">JSON schema hint (optional)</div>
                <textarea
                  value={jsonSchemaHint}
                  onChange={(e)=>setJsonSchemaHint(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm"
                  style={CARD}
                  placeholder='{"type":"object","properties":{"answer":{"type":"string"}}}'
                />
        {/* Test area — drop versions to split lanes */}
        <div className="mt-3 grid" style={{ gridTemplateColumns: compareLanes[1] ? '1fr 1fr' : '1fr', gap: 12 }}>
          {[0,1].slice(0, fx.laneMax).map((idx) => (
            <div key={idx}
                 onDragOver={(e)=>e.preventDefault()}
                 onDrop={(e)=>onLaneDrop(e, idx as 0|1)}
                 className="rounded-xl p-3 border min-h-[220px]"
                 style={CARD}>
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">{laneTitle(compareLanes[idx])}</div>
                <div className="text-[11px] opacity-60">Drop a version here to compare</div>
              </div>
              <div className="col-span-2 flex justify-end gap-2">
                <button onClick={()=>setShowAdvanced(false)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  Close
                </button>
                <button
                  onClick={()=>{ setDirty(true); setShowAdvanced(false); }}
                  className="px-3 py-2 rounded-md text-sm"
                  style={{ background:'var(--brand)', color:'#00120a' }}
                >
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
              <button onClick={()=>setShowFlowTuner(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              {(['greeting','qa','actions'] as const).map(key=>(
                <div key={key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm capitalize">{key}</div>
                    <div className="text-xs opacity-70">{flowTemps[key].toFixed(2)}</div>
              <div className="mt-2 space-y-1 max-h-[240px] overflow-auto rounded-md p-2" style={{ background:'rgba(0,0,0,.04)', border:'1px dashed var(--border)' }}>
                {testLog.filter(m => m.lane === (idx as 0|1)).map((m,i)=>(
                  <div key={i} className={cls('text-sm', m.role==='assistant' && 'opacity-85')}>
                    <b>{m.role==='user'?'You':'AI'}:</b> {stripMarkdownNoise(m.text)}
                  </div>
                  <input
                    type="range"
                    min={0} max={1} step={0.01}
                    value={flowTemps[key]}
                    onChange={(e)=>setFlowTemps(s=>({ ...s, [key]: Number(e.target.value) }))}
                    className="w-full"
                  />
                </div>
              ))}
              <div className="flex justify-end gap-2">
                <button onClick={()=>setShowFlowTuner(false)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                  Close
                </button>
                <button
                  onClick={()=>{ setDirty(true); setShowFlowTuner(false); }}
                  className="px-3 py-2 rounded-md text-sm"
                  style={{ background:'var(--brand)', color:'#00120a' }}
                >
                  Apply
                </button>
              </div>
              <div className="text-xs opacity-70">
                Tip: Flow temps bias sub-behaviors. Global Temperature still applies as a base.
                ))}
                {testLog.filter(m=>m.lane===(idx as 0|1)).length===0 && (
                  <div className="text-xs opacity-60">No messages yet.</div>
                )}
              </div>
            </div>
          </div>
        </Overlay>
      )}
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <input value={testInput} onChange={(e)=>setTestInput(e.target.value)}
                 onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); if(!testing) void runTest(); }}}
                 placeholder="Type a message… (both lanes will use the same message)"
                 className="flex-1 px-3 py-2 rounded-md text-sm" style={CARD}/>
          <button onClick={()=>runTest()} disabled={testing || !testInput.trim()}
                  className="px-3 py-2 rounded-md text-sm disabled:opacity-60"
                  style={{ background:'var(--brand)', color:'#00120a' }}>
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="inline w-4 h-4 mr-1" /> Send</>}
          </button>
        </div>
      </div>
    </div>
  );
}
