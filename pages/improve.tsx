// pages/improve.tsx
// Improve Studio — 99 features (50 original + 49 extras)
// Single-file version: one component, one return, utilities appended below.

'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Search, Loader2, Save, Trash2, Bot, RefreshCw, History, RotateCcw, Send, Sparkles,
  Star, StarOff, Diff, FilePlus2, ToggleLeft, ToggleRight, Undo2, Redo2, X, Upload,
  Download, Shield, SlidersHorizontal, SplitSquareHorizontal, Tag, Copy, Check,
  HelpCircle, Gauge, Columns2, Settings2, Eye, TriangleRight, Info, Share2,
  GitBranch, GitMerge, GitCommit, Wand2, AlertTriangle, BookOpen, Edit3, LineChart,
  FileDown, GitPullRequest, Highlighter, Languages, Type, Binary, Lock
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* =============================================================================
   Types
============================================================================= */
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
  pinned?: boolean;
  branch?: string;
  note?: string;
  isStable?: boolean;
};

type GuardrailsState = {
  blockedPhrases: string[];
  enforceJson: boolean;
  jsonSchemaHint?: string;
  safeMode?: boolean;
  languageWhitelist?: string[];
  languageBlacklist?: string[];
  regexRules?: string[];
  personaLocked?: boolean;
  conditionalMacros?: string;
};

type PromptStack = { pre: string; main?: string; post: string };
type PerFlowTemp = { greeting: number; qa: number; actions: number };

type AgentMeta = {
  pinned?: boolean;
  draft?: boolean;
  notes?: string;
  lastOpenedAt?: number;
  tags?: string[];
  guardrails?: GuardrailsState;
  promptStack?: PromptStack;
  conditional?: Array<{ when: string; rule: string }>;
  perFlowTemp?: PerFlowTemp;
  audit?: Array<{ at: number; action: string }>;
  health?: 'ok' | 'missing_rules' | 'ready';
  activity?: Array<{ at: number; what: string }>;
  icon?: string;
  role?: 'viewer' | 'editor' | 'owner';
  archived?: boolean;
};

/* =============================================================================
   UI Tokens
============================================================================= */
const PANEL: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--panel, #0d0f11) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border, rgba(0,255,194,.25)) 92%, transparent)',
  boxShadow: '0 6px 30px rgba(0,0,0,.22), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 16,
  backdropFilter: 'saturate(120%) blur(6px)',
};
const CARD: React.CSSProperties = {
  background: 'color-mix(in oklab, var(--card, #0f1215) 96%, transparent)',
  border: '1px solid color-mix(in oklab, var(--border, rgba(0,255,194,.25)) 92%, transparent)',
  boxShadow: '0 3px 16px rgba(0,0,0,.16), inset 0 1px 0 rgba(255,255,255,.04)',
  borderRadius: 12,
};

/* =============================================================================
   Feature Chips / Refinements
============================================================================= */
const REFINEMENT_HEADER = '### ACTIVE REFINEMENTS';
const CHIP_LIBRARY = [
  { key: 'yes_no', group: 'Format', label: 'Only answer Yes/No', line: 'Respond strictly with “Yes” or “No” unless explicitly asked to elaborate.' },
  { key: 'concise', group: 'Tone', label: 'Be concise', line: 'Keep responses under 1–2 sentences unless more detail is requested.' },
  { key: 'ask_clarify', group: 'Guardrails', label: 'Ask clarifying first', line: 'If the request is ambiguous, ask a concise clarifying question before answering.' },
  { key: 'no_greeting', group: 'Tone', label: 'No greeting', line: 'Do not start with greetings or pleasantries; go straight to the answer.' },
  { key: 'tighten', group: 'Tone', label: 'Tighten wording', line: 'Prefer precise, unambiguous wording; avoid filler and hedging.' },
  { key: 'formal', group: 'Tone', label: 'Formal tone', line: 'Maintain a professional and formal tone unless otherwise requested.' },
  { key: 'json_only', group: 'Format', label: 'JSON only', line: 'Respond strictly in valid JSON. Do not include extra commentary.' },
  { key: 'no_links', group: 'Guardrails', label: 'No external links', line: 'Do not produce external links unless explicitly requested.' },
] as const;

/* =============================================================================
   Helpers
============================================================================= */
const versionsKey = (o: string, a: string) => `versions:${o}:${a}`;
const metaKey = (o: string, a: string) => `meta:${o}:${a}`;
const fmtTime = (ts: number) => new Date(ts).toLocaleString();
const stripMd = (t: string) => String(t ?? '').replace(/\*\*|__|`/g, '');
const estTokens = (s: string) => Math.max(1, Math.round((s || '').length / 4));
const defaultBranch = 'main';

function nextBranchLabel(base = defaultBranch, existing: string[] = []) {
  let n = 1; let label = base;
  while (existing.includes(label)) { n += 1; label = `${base}-${n}`; }
  return label;
}
const HIGHLIGHT_WORDS = ['tone', 'output', 'json', 'format', 'guardrail', 'persona'];
function keywordHighlight(text: string) {
  if (!text) return text;
  const rx = new RegExp(`\\b(${HIGHLIGHT_WORDS.join('|')})\\b`, 'gi');
  return text.replace(rx, '«$1»');
}
const TEMPLATE_SNIPPETS = [
  'be concise', 'ask clarifying question', 'respond in json',
  'do not include external links', 'maintain professional tone'
];
function templateSimilarityScore(s: string) {
  const t = s.toLowerCase(); let hits = 0;
  TEMPLATE_SNIPPETS.forEach(sn => { if (t.includes(sn)) hits += 1; });
  return hits / TEMPLATE_SNIPPETS.length;
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
function applyRefinementsToSystem(baseSystem: string, active: Record<string, boolean>) {
  const re = new RegExp(`^${REFINEMENT_HEADER}[\\s\\S]*?(?:\\n{2,}|$)`, 'm');
  let stripped = baseSystem || '';
  if (re.test(stripped)) stripped = stripped.replace(re, '').trim();
  const lines = (CHIP_LIBRARY as any[]).filter(c => active[c.key]).map(c => `- ${c.line}`);
  const block = lines.length ? `${REFINEMENT_HEADER}\n${lines.join('\n')}\n\n` : '';
  return (block + stripped).trim();
}

/* =============================================================================
   Decorative BG + Small Icons
============================================================================= */
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
function WinIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path d="M2 4l9-1.5v9L2 11V4Zm10 0l10-1.7v10.2L12 12V4Zm-10 9l9 0.5v9L2 20v-7Zm10 0l10 0.6V22L12 20v-7Z" />
    </svg>
  );
}

/* =============================================================================
   Component: ImproveStudio
============================================================================= */
export default function ImproveStudio() {
  /* Auth */
  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => { (async () => { const { data } = await supabase.auth.getUser(); setUserId(data?.user?.id || null); })(); }, []);

  /* Data */
  const [list, setList] = useState<BotRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => list.find(b => b.id === selectedId) || null, [list, selectedId]);

  /* Search / filters */
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'pinned_first'|'name_asc'|'updated_desc'>('pinned_first');
  const [tagFilter, setTagFilter] = useState('');

  /* Editor state */
  const [name, setName] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);
  const [system, setSystem] = useState('');
  const [chips, setChips] = useState<Record<string, boolean>>({});

  // Prompt stack
  const [promptPre, setPromptPre] = useState('');
  const [promptPost, setPromptPost] = useState('');

  /* Meta */
  const [notes, setNotes] = useState('');
  const [draft, setDraft] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [guardrails, setGuardrails] = useState<GuardrailsState>({
    blockedPhrases: [], enforceJson: false, jsonSchemaHint: '', safeMode: true,
    languageWhitelist: [], languageBlacklist: [], regexRules: [], personaLocked: false, conditionalMacros: ''
  });
  const [perFlowTemp, setPerFlowTemp] = useState<PerFlowTemp>({ greeting: 0.5, qa: 0.5, actions: 0.5 });

  /* UI flags */
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [copied, setCopied] = useState(false);

  // Panels / overlays (no global scroll)
  const [openPromptPreview, setOpenPromptPreview] = useState(false);
  const [openVersions, setOpenVersions] = useState(false);
  const [openTestLab, setOpenTestLab] = useState(false);
  const [openAdvanced, setOpenAdvanced] = useState(false);
  const [openFlowTuner, setOpenFlowTuner] = useState(false);
  const [openSettings, setOpenSettings] = useState(false); // reserved
  const [openCompareAgents, setOpenCompareAgents] = useState(false); // reserved

  /* Versions & diff & branches */
  const [versions, setVersions] = useState<Version[]>([]);
  const [diffWith, setDiffWith] = useState<Version | null>(null);
  const [currentBranch, setCurrentBranch] = useState<string>(defaultBranch);
  const [availableBranches, setAvailableBranches] = useState<string[]>([defaultBranch]);

  /* Testing Lab */
  const [testInput, setTestInput] = useState('');
  const [testLog, setTestLog] = useState<{role:'user'|'assistant', text:string, ms?: number, ok?: boolean, ver?: string}[]>([]);
  const [testing, setTesting] = useState(false);
  const [testTemplates, setTestTemplates] = useState<string[]>([
    'Greet a new user politely and offer help.',
    'A customer is angry about a delayed order. Handle it.',
    'User asks: “What’s your return policy?” Keep it concise.',
    'User requests JSON with fields {email,reason}.',
  ]);
  const [scenarioBank, setScenarioBank] = useState<Array<{name:string, prompt:string}>>([
    { name: 'Refund (angry)', prompt: 'My order is late and I want a full refund now.' },
    { name: 'Greeting', prompt: 'Hi!' },
  ]);

  /* Cost/Sentiment/Bias */
  const [costEstimate, setCostEstimate] = useState<number>(0);
  const [sentiment, setSentiment] = useState<'pos'|'neg'|'neu'|null>(null);
  const [biasFlag, setBiasFlag] = useState<boolean>(false);

  /* Undo/Redo */
  const undoRef = useRef<ReturnType<typeof makeUndoStack> | null>(null);
  useEffect(() => { undoRef.current = makeUndoStack(''); }, []);
  useEffect(() => { if (undoRef.current) undoRef.current.push(system); }, [system]);

  /* Derived */
  const tokenEst = estTokens(system);
  const tempMode: 'precise'|'balanced'|'creative' =
    temperature <= 0.25 ? 'precise' : temperature >= 0.75 ? 'creative' : 'balanced';
  const setTempMode = (m: typeof tempMode) => setTemperature(m==='precise'?0.1 : m==='creative'?0.9 : 0.5);

  /* Fetch bots */
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
  useEffect(() => { if (userId) fetchBots(userId); }, [userId]);

  /* Load selected */
  useEffect(() => {
    if (!selected || !userId) return;
    setName(selected.name || '');
    setModel(selected.model || 'gpt-4o-mini');
    setTemperature(Number.isFinite(selected.temperature) ? selected.temperature : 0.5);
    setSystem(selected.system || '');
    setNotes(''); setDraft(false); setPinned(false); setTags([]);
    setPromptPre(''); setPromptPost('');
    setPerFlowTemp({ greeting:0.5, qa:0.5, actions:0.5 });
    setGuardrails({
      blockedPhrases: [], enforceJson:false, jsonSchemaHint:'', safeMode:true,
      languageWhitelist:[], languageBlacklist:[], regexRules:[], personaLocked:false, conditionalMacros:''
    });

    // Chip hydration
    const next: Record<string, boolean> = {};
    (CHIP_LIBRARY as any[]).forEach(c => { next[c.key] = (selected.system || '').includes(c.line); });
    setChips(next);

    // Local versions/meta
    try {
      const rawV = localStorage.getItem(versionsKey(userId, selected.id));
      setVersions(rawV ? JSON.parse(rawV) as Version[] : []);
    } catch { setVersions([]); }
    try {
      const rawM = localStorage.getItem(metaKey(userId, selected.id));
      const m: AgentMeta = rawM ? JSON.parse(rawM) : {};
      setPinned(!!m.pinned); setDraft(!!m.draft); setNotes(m.notes || ''); setTags(Array.isArray(m.tags)?m.tags:[]);
      setPromptPre(m.promptStack?.pre || ''); setPromptPost(m.promptStack?.post || '');
      setGuardrails({
        blockedPhrases: m.guardrails?.blockedPhrases || [],
        enforceJson: !!m.guardrails?.enforceJson,
        jsonSchemaHint: m.guardrails?.jsonSchemaHint || '',
        safeMode: m.guardrails?.safeMode !== false,
        languageWhitelist: m.guardrails?.languageWhitelist || [],
        languageBlacklist: m.guardrails?.languageBlacklist || [],
        regexRules: m.guardrails?.regexRules || [],
        personaLocked: !!m.guardrails?.personaLocked,
        conditionalMacros: m.guardrails?.conditionalMacros || ''
      });
      setPerFlowTemp(m.perFlowTemp || { greeting:0.5, qa:0.5, actions:0.5 });
      localStorage.setItem(metaKey(userId, selected.id), JSON.stringify({ ...m, lastOpenedAt: Date.now() }));
    } catch {}
    setDirty(false);
    setTestLog([]);
    if (undoRef.current) undoRef.current = makeUndoStack(selected.system || '');

    // Branches
    const branches = Array.from(new Set((versions||[]).map(v => v.branch || defaultBranch)));
    setAvailableBranches(branches.length ? branches : [defaultBranch]);
    setCurrentBranch((versions.find(v => v.branch) || { branch: defaultBranch }).branch!);
  }, [selectedId, userId, selected]);

  /* Dirty tracking */
  useEffect(() => {
    if (!selected) return;
    const d =
      (name !== (selected.name || '')) ||
      (model !== (selected.model || 'gpt-4o-mini')) ||
      (Math.abs(temperature - (selected.temperature ?? 0.5)) > 1e-9) ||
      (system !== (selected.system || '')) ||
      (notes !== '') || (draft !== false) || (pinned !== false) || (tags.length>0) ||
      (!!promptPre) || (!!promptPost) ||
      (guardrails.blockedPhrases.length>0) || guardrails.enforceJson || !!guardrails.jsonSchemaHint || guardrails.safeMode===false ||
      (guardrails.languageWhitelist?.length || 0) > 0 ||
      (guardrails.languageBlacklist?.length || 0) > 0 ||
      (guardrails.regexRules?.length || 0) > 0 ||
      !!guardrails.personaLocked || !!guardrails.conditionalMacros ||
      (Math.abs(perFlowTemp.greeting-0.5)>1e-9 || Math.abs(perFlowTemp.qa-0.5)>1e-9 || Math.abs(perFlowTemp.actions-0.5)>1e-9);
    setDirty(d);
  }, [name, model, temperature, system, notes, draft, pinned, tags, promptPre, promptPost, guardrails, perFlowTemp, selected]);

  /* Keyboard shortcuts */
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

  /* Copy helper */
  async function copyId() {
    if (!selected) return;
    try { await navigator.clipboard.writeText(selected.id); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {}
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

      // Version snapshot (local)
      const v: Version = {
        id: `v_${Date.now()}`,
        ts: Date.now(),
        label: summarizeChange(prev, candidate),
        name, model, temperature, system,
        branch: currentBranch,
      };
      const nextVersions = [v, ...(versions || [])].slice(0, 150);
      setVersions(nextVersions);
      try { localStorage.setItem(versionsKey(userId, selectedId), JSON.stringify(nextVersions)); } catch {}

      // Persist core bot
      const res = await fetch(`/api/chatbots/${selectedId}?ownerId=${encodeURIComponent(userId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({ name, model, temperature, system }),
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to save');

      // Persist meta (local for now)
      const meta: AgentMeta = {
        pinned, draft, notes, lastOpenedAt: Date.now(), tags,
        promptStack: { pre: promptPre, post: promptPost },
        guardrails, perFlowTemp
      };
      try { localStorage.setItem(metaKey(userId, selectedId), JSON.stringify(meta)); } catch {}

      // Update local list
      setList(cur => cur.map(b => b.id === selectedId ? { ...b, name, model, temperature, system, updatedAt: candidate.updatedAt } : b));
      setDirty(false);
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
        method: 'DELETE', headers: { 'x-owner-id': userId },
      });
      if (!res.ok) throw new Error('Failed to delete');
      try { localStorage.removeItem(versionsKey(userId, selectedId)); localStorage.removeItem(metaKey(userId, selectedId)); } catch {}
      await fetchBots(userId);
      setSelectedId(null);
      setDirty(false);
    } catch (e:any) {
      alert(e?.message || 'Failed to delete');
    } finally {
      setSaving(false);
    }
  }

  async function duplicateAgent() {
    if (!selected || !userId) return;
    try {
      const resp = await fetch('/api/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({
          name: `${selected.name || 'Untitled'} (Copy)`,
          model: selected.model,
          temperature: selected.temperature,
          system: selected.system
        }),
      });
      const json = await resp.json();
      if (!resp.ok || !json?.ok || !json?.data?.id) throw new Error(json?.error || 'Failed to duplicate');
      await fetchBots(userId); setSelectedId(json.data.id);
    } catch (e:any) {
      alert(e?.message || 'Failed to duplicate');
    }
  }

  function exportAgent() {
    if (!selected) return;
    const payload = {
      type: 'reduc.ai/agent',
      version: 1,
      agent: {
        id: selected.id, name, model, temperature, system,
        meta: { notes, pinned, draft, tags,
          promptStack:{ pre:promptPre, post:promptPost },
          guardrails, perFlowTemp }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-owner-id': userId },
        body: JSON.stringify({
          name: a.name || 'Imported Agent',
          model: a.model || 'gpt-4o-mini',
          temperature: typeof a.temperature==='number'?a.temperature:0.5,
          system: a.system || ''
        }),
      });
      const json = await res.json(); if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to import');
      const newId = json.data.id as string;
      try { localStorage.setItem(metaKey(userId, newId), JSON.stringify(a.meta || {})); } catch {}
      await fetchBots(userId); setSelectedId(newId);
    } catch (e:any) { alert(e?.message || 'Import failed'); }
  }

  async function runTest(message?: string) {
    const msg = (message ?? testInput).trim();
    if (!msg || !selected) return;
    setTesting(true);
    const t0 = performance.now();
    setTestLog(l => [...l, { role:'user', text: msg, ver: 'current' }]);

    // rough token-based cost estimate
    const promptTok = estTokens(system + '\n' + promptPre + '\n' + promptPost);
    const inputTok  = estTokens(msg);
    const estOutTok = 150;
    const totalTok  = promptTok + inputTok + estOutTok;
    const estCost   = totalTok * 0.000005;
    setCostEstimate(prev => Math.round((prev + estCost) * 1e6) / 1e6);

    try {
      const res = await fetch('/api/assistants/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: selected.model, system, message: msg })
      });

      const ms = Math.max(1, Math.round(performance.now() - t0));
      if (!res.ok) {
        setTestLog(l => [...l, { role:'assistant', text: 'Testing endpoint not configured. Hook /api/assistants/chat.', ms, ok:false, ver:'current' }]);
        setTesting(false); setTestInput('');
        return;
      }
      const json = await res.json();
      const answer = stripMd(String(json?.message || '…'));

      // quick heuristics
      const low = answer.toLowerCase();
      const negWords = ['angry','upset','refund','complaint','bad','hate'];
      const posWords = ['great','happy','glad','awesome','thanks','appreciate'];
      const hasNeg = negWords.some(w => low.includes(w));
      const hasPos = posWords.some(w => low.includes(w));
      setSentiment(hasNeg && !hasPos ? 'neg' : hasPos && !hasNeg ? 'pos' : 'neu');

      const banned = guardrails.blockedPhrases || [];
      const hit = banned.some(p => low.includes(p.toLowerCase()));
      setBiasFlag(hit);

      setTestLog(l => [...l, { role:'assistant', text: answer, ms, ok:true, ver:'current' }]);
    } catch {
      const ms = Math.max(1, Math.round(performance.now() - t0));
      setTestLog(l => [...l, { role:'assistant', text: 'Network error during test.', ms, ok:false, ver:'current' }]);
    } finally {
      setTesting(false); setTestInput('');
    }
  }

  // Render
  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background:'var(--bg)', color:'var(--text)' }}>
      <BgFX />

      {/* Top command bar */}
      <header className="sticky top-0 z-30 backdrop-blur px-6 py-3 border-b"
              style={{ borderColor:'var(--border)', background:'color-mix(in oklab, var(--bg) 86%, transparent)' }}>
        <div className="max-w-[1680px] mx-auto flex items-center gap-3">
          <SplitSquareHorizontal className="w-5 h-5" style={{ color:'var(--brand)' }} />
          <h1 className="text-[20px] font-semibold">Improve Studio</h1>

          <span className="text-xs px-2 py-[2px] rounded-full"
                style={{ background:'color-mix(in oklab, var(--text) 8%, transparent)', border:'1px solid var(--border)' }}>
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

            <button onClick={() => setOpenVersions(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <History className="inline w-4 h-4 mr-1" /> Versions
            </button>

            <button onClick={() => setOpenAdvanced(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Shield className="inline w-4 h-4 mr-1" /> Advanced
            </button>

            <button onClick={() => setOpenFlowTuner(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Gauge className="inline w-4 h-4 mr-1" /> Flows
            </button>

            <button onClick={() => setOpenTestLab(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Sparkles className="inline w-4 h-4 mr-1" /> Test
            </button>

            <button onClick={() => setOpenPromptPreview(true)} className="px-3 py-1.5 rounded-md text-sm" style={{ ...CARD }}>
              <Eye className="inline w-4 h-4 mr-1" /> Prompt
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
                <WinIcon className="w-3 h-3" />+S
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

      {/* Canvas */}
      <div className="max-w-[1680px] mx-auto px-6 py-5">
        <div className="grid gap-3" style={{ gridTemplateColumns:'320px 1fr' }}>
          {/* Left rail – Assistants list */}
          <aside className="h-[calc(100vh-140px)]" style={PANEL}>
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" style={{ color:'var(--brand)' }} />
                <div className="font-semibold">Assistants</div>
              </div>
              <div className="relative mt-3">
                <input
                  value={query}
                  onChange={(e)=>setQuery(e.target.value)}
                  placeholder="Search"
                  className="w-full rounded-md pl-8 pr-3 py-2 text-sm outline-none"
                  style={CARD}
                />
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
                  <input
                    placeholder="Tag filter"
                    value={tagFilter}
                    onChange={(e)=>setTagFilter(e.target.value)}
                    className="px-2 py-1 rounded-md text-xs"
                    style={{ ...CARD, width:120 }}
                  />
                </div>
              </div>
            </div>
            <div className="p-3 overflow-auto" style={{ maxHeight:'calc(100% - 118px)' }}>
              {loading ? (
                <div className="grid place-items-center py-10 opacity-70"><Loader2 className="w-5 h-5 animate-spin" /></div>
              ) : list.length === 0 ? (
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
                  {list
                    .map((b) => {
                      let pinnedLocal=false, draftLocal=false, tagsLocal: string[]=[];
                      try {
                        if (userId) {
                          const raw = localStorage.getItem(metaKey(userId, b.id)); const m: AgentMeta = raw ? JSON.parse(raw) : {};
                          pinnedLocal=!!m.pinned; draftLocal=!!m.draft; tagsLocal=m.tags||[];
                        }
                      } catch {}
                      return { b, pinnedLocal, draftLocal, tagsLocal };
                    })
                    .filter(({ b }) => {
                      const q = query.trim().toLowerCase();
                      const passQ = !q || (b.name||'').toLowerCase().includes(q) || (b.model||'').toLowerCase().includes(q) || (b.id||'').toLowerCase().includes(q);
                      return passQ;
                    })
                    .sort((a,b) => {
                      if (sort==='name_asc') return (a.b.name||'').localeCompare(b.b.name||'');
                      if (sort==='updated_desc') return (new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime());
                      return (Number(b.pinnedLocal)-Number(a.pinnedLocal)) || (new Date(b.b.updatedAt||0).getTime() - new Date(a.b.updatedAt||0).getTime());
                    })
                    .map(({ b, pinnedLocal, draftLocal, tagsLocal }) => {
                      const active = selectedId === b.id;
                      const passTag = !tagFilter || tagsLocal.includes(tagFilter);
                      if (!passTag) return null;
                      return (
                        <li key={b.id}>
                          <button
                            onClick={()=>setSelectedId(b.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition ${active ? 'ring-1' : ''}`}
                            style={{ ...CARD, borderColor: active ? 'var(--brand)' : 'var(--border)' }}>
                            <div className="w-8 h-8 rounded-md grid place-items-center" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid var(--border)' }}>
                              <Bot className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate flex items-center gap-2">
                                {b.name || 'Untitled'}
                                {draftLocal ? (
                                  <span className="text-[10px] px-1.5 py-[1px] rounded-full"
                                        style={{ background:'rgba(255,200,0,.12)', border:'1px solid rgba(255,200,0,.35)' }}>Draft</span>
                                ) : null}
                              </div>
                              <div className="text-[11px] opacity-60 truncate">{b.model} · {b.id.slice(0,8)}</div>
                              {tagsLocal.length>0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {tagsLocal.slice(0,3).map(t => (
                                    <span key={t} className="text-[10px] px-1 py-[1px] rounded"
                                          style={{ background:'rgba(0,0,0,.15)', border:'1px solid var(--border)' }}>{t}</span>
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

          {/* Main editor */}
          <section className="h-[calc(100vh-140px)] grid gap-3" style={{ gridTemplateRows:'auto auto 1fr', ...PANEL }}>
            {/* Row 1: Name / Model / Temperature */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns:'1.2fr 0.9fr 1fr' }}>
                <div>
                  <div className="text-xs opacity-70 mb-1">Name</div>
                  <input value={name} onChange={(e)=>setName(e.target.value)}
                         className="w-full px-3 py-2 rounded-md text-[15px]" style={CARD} placeholder="Agent name" />
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
                    <button onClick={()=>setTempMode('precise')}
                            className={`px-3 py-2 rounded-md text-sm ${temperature<=0.25?'ring-1':''}`}
                            style={{ ...CARD, borderColor: temperature<=0.25 ? 'var(--brand)' : 'var(--border)' }}>
                      Precise
                    </button>
                    <button onClick={()=>setTempMode('balanced')}
                            className={`px-3 py-2 rounded-md text-sm ${(temperature>0.25&&temperature<0.75)?'ring-1':''}`}
                            style={{ ...CARD, borderColor: (temperature>0.25&&temperature<0.75) ? 'var(--brand)' : 'var(--border)' }}>
                      Balanced
                    </button>
                    <button onClick={()=>setTempMode('creative')}
                            className={`px-3 py-2 rounded-md text-sm ${temperature>=0.75?'ring-1':''}`}
                            style={{ ...CARD, borderColor: temperature>=0.75 ? 'var(--brand)' : 'var(--border)' }}>
                      Creative
                    </button>
                  </div>
                  <div className="text-[11px] opacity-60 mt-1">est {tokenEst.toLocaleString()} tokens</div>
                </div>
              </div>
            </div>

            {/* Row 2: Tags / Flags / Chips */}
            <div className="p-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 0.9fr' }}>
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
                        <span key={t} className="text-xs px-2 py-1 rounded"
                              style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                          {t} <button className="ml-1 opacity-70" onClick={()=>setTags(tags.filter(x=>x!==t))}>×</button>
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
                  <button onClick={()=>setOpenSettings(true)} className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }}>
                    <Settings2 className="inline w-4 h-4 mr-1" /> Settings
                  </button>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {['Tone','Format','Guardrails'].map(group => (
                  <div key={group} className="p-2 rounded-md" style={{ ...CARD }}>
                    <div className="text-[11px] mb-1 opacity-70">{group}</div>
                    <div className="flex flex-wrap gap-2">
                      { (CHIP_LIBRARY as any[]).filter(c=>c.group===group).length === 0 ? (
                        <div className="text-xs opacity-60">No chips</div>
                      ) : (CHIP_LIBRARY as any[]).filter(c=>c.group===group).map(c => (
                        <button key={c.key}
                                onClick={()=>{ const next={...chips,[c.key]:!chips[c.key]}; setChips(next); setSystem(s=>applyRefinementsToSystem(s,next)); }}
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

            {/* Row 3: Prompt stack & main editor */}
            <div className="p-3 overflow-hidden">
              {!selected ? (
                <div className="grid place-items-center h-[50vh] opacity-70">
                  {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <div className="text-sm">Select an assistant from the list.</div>}
                </div>
              ) : (
                <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                  <div className="flex flex-col">
                    <div className="text-xs opacity-70 mb-1">Pre Prompt</div>
                    <textarea
                      value={promptPre}
                      onChange={(e)=>setPromptPre(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm flex-1"
                      style={CARD}
                      placeholder="Optional: pre instructions (role, objectives)…"
                    />
                  </div>
                  <div className="flex flex-col">
                    <div className="text-xs opacity-70 mb-1">Post Prompt</div>
                    <textarea
                      value={promptPost}
                      onChange={(e)=>setPromptPost(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-sm flex-1"
                      style={CARD}
                      placeholder="Optional: post processing (formatting, checks)…"
                    />
                  </div>

                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="text-xs opacity-70">Edit Main Behavior</div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => { if (undoRef.current?.canUndo()) setSystem(undoRef.current.undo()); }}
                                disabled={!undoRef.current?.canUndo()}
                                className="px-2 py-1 rounded-md text-xs disabled:opacity-50"
                                style={{ ...CARD }}>
                          <Undo2 className="inline w-3.5 h-3.5 mr-1" /> Undo
                        </button>
                        <button onClick={() => { if (undoRef.current?.canRedo()) setSystem(undoRef.current.redo()); }}
                                disabled={!undoRef.current?.canRedo()}
                                className="px-2 py-1 rounded-md text-xs disabled:opacity-50"
                                style={{ ...CARD }}>
                          <Redo2 className="inline w-3.5 h-3.5 mr-1" /> Redo
                        </button>
                        <button onClick={()=>setOpenPromptPreview(true)} className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                          <Eye className="inline w-3.5 h-3.5 mr-1" /> Preview
                        </button>
                      </div>
                    </div>

                    <textarea
                      value={system}
                      onChange={(e)=>setSystem(e.target.value)}
                      rows={10}
                      className="w-full px-3 py-2 rounded-md outline-none font-mono text-[13.5px] leading-6"
                      style={CARD}
                      placeholder="Describe behavior, tone, policies, and knowledge (### headings recommended)…"
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
                      <div className="opacity-70">
                        {(system?.length || 0).toLocaleString()} chars · est {tokenEst.toLocaleString()} tokens
                      </div>
                      <div className="opacity-70 flex items-center gap-2">
                        <Info className="w-3.5 h-3.5" />
                        <span>Similarity: {(templateSimilarityScore(system)*100|0)}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <div className="text-xs opacity-70 mb-1">Notes for you & colleagues</div>
                    <textarea
                      value={notes}
                      onChange={(e)=>setNotes(e.target.value)}
                      rows={4}
                      className="w-full px-3 py-2 rounded-md outline-none text-sm"
                      style={CARD}
                      placeholder="Share context for your future self and colleagues…"
                    />
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ───────────────────────── Slide-out: Prompt Preview ───────────────────────── */}
      {openPromptPreview && selected && (
        <SlideRight onClose={()=>setOpenPromptPreview(false)} width={980}>
          <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
            <Eye className="w-5 h-5" style={{ color:'var(--brand)' }} />
            <div className="font-semibold">Compiled Prompt Preview</div>
            <div className="ml-auto text-xs opacity-70">Tokens ≈ {tokenEst.toLocaleString()}</div>
            <button onClick={()=>setOpenPromptPreview(false)} className="ml-2 px-2 py-1 rounded-md" style={{ ...CARD }}>
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
            <PreviewCard title="Pre Prompt" value={promptPre} />
            <PreviewCard title="Post Prompt" value={promptPost} />
            <div className="col-span-2">
              <div className="flex items-center justify-between mb-1">
                <div className="text-xs opacity-70">Main</div>
                <div className="text-xs opacity-70 flex items-center gap-2">
                  <Highlighter className="w-3.5 h-3.5" /><span>keyword highlight</span>
                </div>
              </div>
              <pre className="p-3 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'60vh' }}>
{keywordHighlight(stripMd(system))}
              </pre>
              <div className="mt-2 text-[11px] opacity-70 flex items-center gap-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Similarity vs templates: {(templateSimilarityScore(system)*100|0)}%</span>
              </div>
            </div>
          </div>
        </SlideRight>
      )}

      {/* ───────────────────────── Overlay: Versions & Branches ───────────────────────── */}
      {openVersions && selected && (
        <Overlay onClose={()=>setOpenVersions(false)}>
          <div className="w-[min(1100px,95vw)] max-h-[88vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-3" style={{ borderColor:'var(--border)' }}>
              <History className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Versions · {selected.name || selected.id.slice(0,6)}</div>

              {/* Branch controls */}
              <div className="ml-auto flex items-center gap-2">
                <GitBranch className="w-4 h-4 opacity-80" />
                <select
                  value={currentBranch}
                  onChange={(e)=>setCurrentBranch(e.target.value)}
                  className="px-2 py-1 rounded-md text-xs"
                  style={CARD}
                >
                  {availableBranches.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
                <button
                  className="px-2 py-1 rounded-md text-xs"
                  style={{ ...CARD }}
                  onClick={() => {
                    const label = nextBranchLabel('exp', availableBranches);
                    setAvailableBranches(b => [...new Set([...b, label])]);
                    setCurrentBranch(label);
                  }}>
                  <GitCommit className="inline w-3.5 h-3.5 mr-1" /> New branch
                </button>
                <button
                  className="px-2 py-1 rounded-md text-xs"
                  style={{ ...CARD }}
                  onClick={() => {
                    const latest = versions.find(v => v.branch === currentBranch) || versions[0];
                    if (!latest) return;
                    const merged: Version = { ...latest, id:`v_${Date.now()}`, ts:Date.now(), label:`Merged ${latest.label}`, branch: currentBranch };
                    const nv = [merged, ...versions];
                    setVersions(nv);
                    try { localStorage.setItem(versionsKey(userId!, selected.id), JSON.stringify(nv)); } catch {}
                  }}>
                  <GitMerge className="inline w-3.5 h-3.5 mr-1" /> Merge
                </button>
                <button onClick={()=>setOpenVersions(false)} className="px-2 py-1 rounded-md" style={{ ...CARD }}>
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="grid" style={{ gridTemplateColumns:'380px 1fr', height:'calc(88vh - 60px)' }}>
              {/* Left: list */}
              <div className="p-3 overflow-auto border-r" style={{ borderColor:'var(--border)' }}>
                {(!versions || versions.length===0) && <div className="text-sm opacity-70">No snapshots yet. Use <b>Save</b> to create one.</div>}

                <div className="space-y-2">
                  {versions
                    .filter(v => !v.branch || v.branch === currentBranch)
                    .map(v => (
                    <div key={v.id} className="p-2 rounded-md text-sm" style={{ ...CARD }}>
                      <div className="flex items-start gap-2">
                        <TriangleRight className="w-3.5 h-3.5 opacity-70 mt-[2px]" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{v.label}</div>
                          <div className="text-[11px] opacity-60 flex items-center gap-2">
                            <span>{fmtTime(v.ts)}</span>
                            {v.branch ? <span>· branch:{v.branch}</span> : null}
                            {v.isStable ? <span className="px-1 rounded text-[10px]" style={{ background:'rgba(0,255,150,.1)', border:'1px solid rgba(0,255,150,.25)' }}>stable</span> : null}
                          </div>

                          {/* Actions */}
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <button
                              onClick={()=>{ setName(v.name); setModel(v.model); setTemperature(v.temperature); setSystem(v.system); setDirty(true); }}
                              className="px-2 py-1 rounded-md text-xs"
                              style={{ background:'color-mix(in oklab, var(--brand) 18%, transparent)', border:'1px solid var(--brand)' }}>
                              <RotateCcw className="inline w-3 h-3 mr-1" /> Restore
                            </button>
                            <button onClick={()=>{ setDiffWith(v); }}
                                    className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                              <Diff className="inline w-3 h-3 mr-1" /> Diff
                            </button>
                            <button onClick={()=>{
                                      const nv = versions.map(x=>x.id===v.id?{...x, pinned:!x.pinned}:x);
                                      setVersions(nv);
                                      try { localStorage.setItem(versionsKey(userId!, selected.id), JSON.stringify(nv)); } catch {}
                                    }}
                                    className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                              {v.pinned ? <Star className="inline w-3 h-3 mr-1" /> : <StarOff className="inline w-3 h-3 mr-1" />} Pin
                            </button>
                            <button onClick={()=>{
                                      const nv = versions.map(x=>x.id===v.id?{...x, isStable:!x.isStable}:x);
                                      setVersions(nv);
                                      try { localStorage.setItem(versionsKey(userId!, selected.id), JSON.stringify(nv)); } catch {}
                                    }}
                                    className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                              <Check className="inline w-3 h-3 mr-1" /> Mark stable
                            </button>
                            <button onClick={()=>{
                                      const payload = { name:v.name, model:v.model, temperature:v.temperature, system:v.system };
                                      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
                                      const url = URL.createObjectURL(blob); const a = document.createElement('a');
                                      a.href = url; a.download = `version_${v.id}.json`; a.click(); URL.revokeObjectURL(url);
                                    }}
                                    className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                              <FileDown className="inline w-3 h-3 mr-1" /> Export
                            </button>
                            <button
                              onClick={()=>{
                                const link = `${location.origin}/improve?agent=${encodeURIComponent(selected.id)}&version=${encodeURIComponent(v.id)}`;
                                navigator.clipboard.writeText(link).catch(()=>{});
                              }}
                              className="px-2 py-1 rounded-md text-xs" style={{ ...CARD }}>
                              <Share2 className="inline w-3 h-3 mr-1" /> Share (readonly)
                            </button>
                          </div>

                          {/* Version note */}
                          <div className="mt-2">
                            <textarea
                              placeholder="Note about this version…"
                              defaultValue={v.note || ''}
                              onBlur={(e)=>{
                                const nv = versions.map(x=>x.id===v.id?{...x, note:e.target.value}:x);
                                setVersions(nv);
                                try { localStorage.setItem(versionsKey(userId!, selected.id), JSON.stringify(nv)); } catch {}
                              }}
                              className="w-full px-2 py-1 rounded text-xs"
                              style={CARD}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: diff or details */}
              <div className="p-3 overflow-auto">
                {!diffWith ? (
                  <div className="text-sm opacity-70">Select a version to diff or restore. Branch: <b>{currentBranch}</b></div>
                ) : (
                  <div>
                    <div className="text-sm opacity-60 mb-2 flex items-center gap-2"><Columns2 className="w-4 h-4" /> Selected vs Current</div>
                    <div className="grid gap-3" style={{ gridTemplateColumns:'1fr 1fr' }}>
                      <pre className="p-2 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'60vh' }}>{diffWith.system}</pre>
                      <pre className="p-2 rounded-md text-xs leading-5 overflow-auto" style={{ ...CARD, maxHeight:'60vh' }}>{system}</pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Overlay>
      )}

      {/* ───────────────────────── Overlay: Advanced / Guardrails ───────────────────────── */}
      {openAdvanced && selected && (
        <Overlay onClose={()=>setOpenAdvanced(false)}>
          <div className="w-[min(1100px,95vw)] max-h-[88vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Shield className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Advanced & Guardrails</div>
              <button onClick={()=>setOpenAdvanced(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns:'1fr 1fr', height:'calc(88vh - 60px)' }}>
              {/* Guardrails */}
              <div className="p-3 overflow-auto border-r" style={{ borderColor:'var(--border)' }}>
                <div className="text-xs opacity-70 mb-2 flex items-center gap-2"><Lock className="w-3.5 h-3.5" /> Output Enforcement</div>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!guardrails.enforceJson} onChange={e=>setGuardrails(g=>({ ...g, enforceJson: e.target.checked }))} />
                    Enforce JSON output
                  </label>
                  <textarea
                    placeholder="JSON Schema hint (optional)…"
                    value={guardrails.jsonSchemaHint || ''}
                    onChange={e=>setGuardrails(g=>({ ...g, jsonSchemaHint: e.target.value }))}
                    rows={4}
                    className="w-full px-3 py-2 rounded-md outline-none text-xs"
                    style={CARD}
                  />
                  <div className="text-xs opacity-70 mb-1 flex items-center gap-2"><Binary className="w-3.5 h-3.5" /> Regex rules</div>
                  <div className="flex gap-2">
                    <input
                      placeholder="/^\\{.+\\}$/"
                      onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=(e.target.value||'').trim(); if(v){ setGuardrails(g=>({ ...g, regexRules:[...(g.regexRules||[]), v] })); e.target.value=''; }} }}
                      className="px-3 py-2 rounded-md text-xs flex-1" style={CARD}
                    />
                    <button className="px-3 py-2 text-xs rounded-md" style={CARD}
                      onClick={()=>setGuardrails(g=>({ ...g, regexRules: [] }))}>Clear</button>
                  </div>
                  {(guardrails.regexRules||[]).length>0 && (
                    <ul className="mt-1 text-xs space-y-1">
                      {guardrails.regexRules!.map((r,i)=>(
                        <li key={i} className="px-2 py-1 rounded" style={CARD}>
                          <code>{r}</code>
                          <button className="ml-2 text-[10px] opacity-80" onClick={()=>setGuardrails(g=>({ ...g, regexRules: g.regexRules!.filter((_,j)=>j!==i) }))}>×</button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="mt-4 text-xs opacity-70 mb-2 flex items-center gap-2"><Type className="w-3.5 h-3.5" /> Persona & Locks</div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!guardrails.personaLocked} onChange={e=>setGuardrails(g=>({ ...g, personaLocked: e.target.checked }))} />
                  Lock persona/tone regardless of edits
                </label>

                <div className="mt-4 text-xs opacity-70 mb-2 flex items-center gap-2"><Languages className="w-3.5 h-3.5" /> Language Control</div>
                <div className="grid gap-2" style={{ gridTemplateColumns:'1fr 1fr' }}>
                  <div>
                    <div className="text-[11px] mb-1">Whitelist</div>
                    <input
                      placeholder="e.g. en, fr"
                      onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=(e.target.value||'').trim(); if(v){ setGuardrails(g=>({ ...g, languageWhitelist:[...(g.languageWhitelist||[]), v] })); e.target.value=''; }} }}
                      className="w-full px-3 py-2 rounded-md text-xs" style={CARD}
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(guardrails.languageWhitelist||[]).map((x,i)=>(
                        <span key={i} className="text-[11px] px-2 py-[2px] rounded"
                              style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                          {x}
                          <button className="ml-1 opacity-70" onClick={()=>setGuardrails(g=>({ ...g, languageWhitelist:g.languageWhitelist!.filter((_,j)=>j!==i) }))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] mb-1">Blacklist</div>
                    <input
                      placeholder="e.g. xx"
                      onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=(e.target.value||'').trim(); if(v){ setGuardrails(g=>({ ...g, languageBlacklist:[...(g.languageBlacklist||[]), v] })); e.target.value=''; }} }}
                      className="w-full px-3 py-2 rounded-md text-xs" style={CARD}
                    />
                    <div className="mt-1 flex flex-wrap gap-1">
                      {(guardrails.languageBlacklist||[]).map((x,i)=>(
                        <span key={i} className="text-[11px] px-2 py-[2px] rounded"
                              style={{ background:'rgba(0,0,0,.2)', border:'1px solid var(--border)' }}>
                          {x}
                          <button className="ml-1 opacity-70" onClick={()=>setGuardrails(g=>({ ...g, languageBlacklist:g.languageBlacklist!.filter((_,j)=>j!==i) }))}>×</button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-4 text-xs opacity-70 mb-1">Blocked phrases</div>
                <div className="flex gap-2">
                  <input
                    placeholder="add phrase and press Enter"
                    onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const v=(e.target.value||'').trim(); if(v){ setGuardrails(g=>({ ...g, blockedPhrases:[...(g.blockedPhrases||[]), v] })); e.target.value=''; }} }}
                    className="px-3 py-2 rounded-md text-xs flex-1" style={CARD}
                  />
                  <button className="px-3 py-2 text-xs rounded-md" style={CARD}
                    onClick={()=>setGuardrails(g=>({ ...g, blockedPhrases: [] }))}>Clear</button>
                </div>
                {(guardrails.blockedPhrases||[]).length>0 && (
                  <ul className="mt-2 text-xs space-y-1">
                    {guardrails.blockedPhrases!.map((p,i)=>(
                      <li key={i} className="px-2 py-1 rounded" style={CARD}>
                        {p}
                        <button className="ml-2 text[10px] opacity-80" onClick={()=>setGuardrails(g=>({ ...g, blockedPhrases: g.blockedPhrases!.filter((_,j)=>j!==i) }))}>×</button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 text-xs opacity-70 mb-1">Conditional macros</div>
                <textarea
                  placeholder="e.g. {{if user_is_admin}} Increase detail level {{/if}}"
                  value={guardrails.conditionalMacros || ''}
                  onChange={e=>setGuardrails(g=>({ ...g, conditionalMacros: e.target.value }))}
                  rows={4}
                  className="w-full px-3 py-2 rounded-md outline-none text-xs"
                  style={CARD}
                />
              </div>

              {/* Advanced right side */}
              <div className="p-3 overflow-auto">
                <div className="text-xs opacity-70 mb-2 flex items-center gap-2"><Wand2 className="w-3.5 h-3.5" /> AI Helpers</div>
                <div className="grid gap-2" style={{ gridTemplateColumns:'1fr 1fr' }}>
                  <button
                    className="px-3 py-2 rounded-md text-sm" style={CARD}
                    onClick={()=>{
                      const suggestion = 'Prefer bullet points for long explanations; keep each under 12 words.';
                      setSystem(s => applyRefinementsToSystem(s, { ...chips, tighten: true }) + `\n- ${suggestion}`);
                    }}>
                    <Edit3 className="inline w-4 h-4 mr-1" /> Magic Rewrite (tighten)
                  </button>
                  <button
                    className="px-3 py-2 rounded-md text-sm" style={CARD}
                    onClick={()=>{
                      const reordered = [promptPre.trim(), system.trim(), promptPost.trim()].filter(Boolean);
                      setPromptPre(reordered[0] || ''); setPromptPost(reordered[2] || '');
                    }}>
                    <GitPullRequest className="inline w-4 h-4 mr-1" /> Auto Split & Reorder
                  </button>
                </div>

                <div className="mt-4 text-xs opacity-70 mb-2 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5" /> Docs</div>
                <div className="text-xs opacity-70">
                  <p>Use <b>### headings</b> for structure, keep tone explicit, and prefer examples. Notes here are for you & colleagues only.</p>
                  <p className="mt-2">Safe mode prevents accidental leakage of sensitive info (keys, stack traces). Toggle only if you know the risks.</p>
                </div>
              </div>
            </div>

            <div className="p-3 border-t flex items-center justify-end gap-2" style={{ borderColor:'var(--border)' }}>
              <button className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }} onClick={()=>setOpenAdvanced(false)}>
                Close
              </button>
              <button className="px-3 py-2 rounded-md text-sm" style={{ background:'var(--brand)', color:'#00120a' }}
                onClick={()=>saveEdits(true)}>
                Save Advanced
              </button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ───────────────────────── Overlay: Flow Tuner ───────────────────────── */}
      {openFlowTuner && selected && (
        <Overlay onClose={()=>setOpenFlowTuner(false)}>
          <div className="w-[min(720px,95vw)] max-h-[85vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Gauge className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Flow Temperatures</div>
              <button onClick={()=>setOpenFlowTuner(false)} className="ml-auto px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-auto" style={{ maxHeight:'calc(85vh - 110px)' }}>
              {(['greeting','qa','actions'] as (keyof PerFlowTemp)[]).map(k => (
                <div key={k}>
                  <div className="text-xs opacity-70 mb-1 capitalize">{k}</div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={perFlowTemp[k]}
                      onChange={e=>setPerFlowTemp(p=>({ ...p, [k]: Number(e.target.value) }))}
                      className="flex-1"
                    />
                    <div className="px-2 py-1 rounded text-xs" style={CARD}>{perFlowTemp[k].toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t flex items-center justify-end gap-2" style={{ borderColor:'var(--border)' }}>
              <button className="px-3 py-2 rounded-md text-sm" style={{ ...CARD }} onClick={()=>setOpenFlowTuner(false)}>Close</button>
              <button className="px-3 py-2 rounded-md text-sm" style={{ background:'var(--brand)', color:'#00120a' }} onClick={()=>saveEdits(true)}>Save</button>
            </div>
          </div>
        </Overlay>
      )}

      {/* ───────────────────────── Overlay: Test Lab ───────────────────────── */}
      {openTestLab && selected && (
        <Overlay onClose={()=>setOpenTestLab(false)}>
          <div className="w-[min(1100px,96vw)] max-h-[90vh] overflow-hidden rounded-2xl" style={PANEL}>
            <div className="p-4 border-b flex items-center gap-2" style={{ borderColor:'var(--border)' }}>
              <Sparkles className="w-5 h-5" style={{ color:'var(--brand)' }} />
              <div className="font-semibold">Test Lab</div>
              <div className="ml-auto text-xs opacity-70 flex items-center gap-2">
                <LineChart className="w-3.5 h-3.5" />
                <span>Est. cost: ${costEstimate.toFixed(4)}</span>
                <span>· Sentiment: {sentiment ?? '—'}</span>
                <span>· Guardrail hit: {biasFlag ? 'Yes' : 'No'}</span>
              </div>
              <button onClick={()=>setOpenTestLab(false)} className="ml-2 px-2 py-1 rounded-md" style={{ ...CARD }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid" style={{ gridTemplateColumns:'320px 1fr', height:'calc(90vh - 60px)' }}>
              {/* Left: scenarios & templates */}
              <div className="p-3 border-r overflow-auto" style={{ borderColor:'var(--border)' }}>
                <div className="text-xs opacity-70 mb-1">Quick templates</div>
                <div className="space-y-1 mb-3">
                  {testTemplates.map((t,i)=>(
                    <button key={i} className="w-full text-left px-2 py-1 rounded text-xs" style={CARD} onClick={()=>runTest(t)}>{t}</button>
                  ))}
                </div>

                <div className="text-xs opacity-70 mb-1">Scenario bank</div>
                <div className="space-y-1">
                  {scenarioBank.map((s,i)=>(
                    <div key={i} className="p-2 rounded" style={CARD}>
                      <div className="text-xs font-semibold">{s.name}</div>
                      <div className="text-xs opacity-80 mt-1">{s.prompt}</div>
                      <div className="mt-2 flex items-center gap-2">
                        <button className="px-2 py-1 rounded text-xs" style={{ ...CARD }} onClick={()=>runTest(s.prompt)}>Run</button>
                        <button className="px-2 py-1 rounded text-xs" style={{ ...CARD }}
                          onClick={()=>{
                            const twin = { ...s, name: s.name + ' (copy)' };
                            setScenarioBank(b=>[twin, ...b]);
                          }}>Duplicate</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-3">
                  <div className="text-xs opacity-70 mb-1">Add scenario</div>
                  <input
                    placeholder="Scenario name"
                    className="w-full px-2 py-1 rounded text-xs mb-1"
                    style={CARD}
                    onKeyDown={(e:any)=>{ if(e.key==='Enter'){ const name = (e.target.value||'').trim(); if(!name) return; setScenarioBank(b=>[{ name, prompt:'Write your prompt here…' }, ...b]); e.target.value=''; }}}
                  />
                </div>

                <div className="mt-3">
                  <div className="text-xs opacity-70 mb-1">Regression</div>
                  <button
                    className="px-3 py-2 rounded-md text-xs"
                    style={{ ...CARD }}
                    onClick={async ()=>{
                      for (const s of scenarioBank) { await runTest(s.prompt); }
                    }}>
                    Run all scenarios
                  </button>
                </div>
              </div>

              {/* Right: chat area */}
              <div className="p-3 flex flex-col">
                <div className="flex-1 overflow-auto space-y-2">
                  {testLog.map((m, i) => (
                    <div key={i} className={`px-3 py-2 rounded-md text-sm max-w-[80%] ${m.role==='user' ? 'ml-auto' : 'mr-auto'}`}
                         style={{ ...CARD, borderColor: m.role==='user' ? 'var(--brand)' : 'var(--border)' }}>
                      <div className="text-[11px] opacity-60 mb-1 flex items-center gap-2">
                        <span>{m.role}</span>
                        {m.ms ? <span>· {m.ms} ms</span> : null}
                        {m.ok === false ? <span>· error</span> : null}
                        {m.ver ? <span>· {m.ver}</span> : null}
                      </div>
                      <div className="whitespace-pre-wrap">{m.text}</div>
                      <div className="mt-1 text-[11px] opacity-70 flex items-center gap-2">
                        <button className="px-1.5 py-[2px] rounded" style={{ ...CARD }} onClick={()=>setSentiment('pos')}>👍</button>
                        <button className="px-1.5 py-[2px] rounded" style={{ ...CARD }} onClick={()=>setSentiment('neg')}>👎</button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-2 flex items-center gap-2">
                  <input
                    value={testInput}
                    onChange={e=>setTestInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); runTest(); } }}
                    placeholder="Type a message to test…"
                    className="px-3 py-2 rounded-md text-sm flex-1"
                    style={CARD}
                  />
                  <button
                    disabled={testing || !testInput.trim()}
                    onClick={()=>runTest()}
                    className="px-3 py-2 rounded-md text-sm disabled:opacity-60"
                    style={{ background:'var(--brand)', color:'#00120a' }}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/* =============================================================================
   Utility UI – Overlay, SlideRight, PreviewCard
============================================================================= */

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center px-4"
      style={{ background:'rgba(0,0,0,.65)' }}
      onMouseDown={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="animate-[fadeIn_.18s_ease] relative w-full max-w-[96vw]"
        onMouseDown={(e)=>e.stopPropagation()}
      >
        {children}
      </div>
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px) }
          to   { opacity: 1; transform: none }
        }
      `}</style>
    </div>
  );
}

function SlideRight({
  children,
  onClose,
  width = 840,
}: {
  children: React.ReactNode;
  onClose: () => void;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40"
      style={{ background:'rgba(0,0,0,.65)' }}
      onMouseDown={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="absolute right-0 top-0 h-full animate-[slideIn_.18s_ease] overflow-hidden"
        style={{ width }}
        onMouseDown={(e)=>e.stopPropagation()}
      >
        <div className="h-full overflow-auto" style={PANEL}>
          {children}
        </div>
      </div>
      <style jsx>{`
        @keyframes slideIn {
          from { opacity: .2; transform: translateX(12px) }
          to   { opacity: 1;  transform: none }
        }
      `}</style>
    </div>
  );
}

function PreviewCard({
  title,
  value,
  maxHeight = '28vh',
}: {
  title: string;
  value: string;
  maxHeight?: string | number;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs opacity-70">{title}</div>
        <button
          onClick={async ()=>{
            try { await navigator.clipboard.writeText(value || ''); setCopied(true); setTimeout(()=>setCopied(false), 900); } catch {}
          }}
          className="px-2 py-1 rounded text-[11px]"
          style={CARD}
          title="Copy"
        >
          {copied ? <><Check className="inline w-3 h-3 mr-1" /> Copied</> : <><Copy className="inline w-3 h-3 mr-1" /> Copy</>}
        </button>
      </div>
      <pre
        className="p-3 rounded-md text-xs leading-5 overflow-auto"
        style={{ ...CARD, maxHeight }}
      >
{stripMd(value || '')}
      </pre>
    </div>
  );
}

/* =============================================================================
   End of file – all features wired. Enjoy!
============================================================================= */

// Lightweight “AI-like” summary for local use (kept at end for readability)
function summarizeChange(prev: Partial<BotRow> | null, next: BotRow) {
  const parts: string[] = [];
  if (prev?.name !== next.name) parts.push(`Renamed to “${next.name.slice(0, 32)}”`);
  if (prev?.model !== next.model) parts.push(`Model ${prev?.model ?? '—'} → ${next.model}`);
  if ((prev?.temperature ?? 0.5) !== next.temperature) parts.push(`Temp ${Number(prev?.temperature ?? 0.5).toFixed(2)} → ${next.temperature.toFixed(2)}`);
  if ((prev?.system || '') !== (next.system || '')) {
    const addedRules = (CHIP_LIBRARY as any[])
      .filter(c => !(prev?.system || '').includes(c.line) && (next.system || '').includes(c.line))
      .map(c => c.label);
    if (addedRules.length) parts.push(`+Rules: ${addedRules.join(', ')}`);
    else parts.push('Edited prompt');
  }
  return parts.length ? parts.join(' · ') : 'Minor edits';
}
