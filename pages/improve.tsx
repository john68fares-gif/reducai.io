// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Copy, History, Info, Loader2, Plus, Send, Settings2,
  Sparkles, Trash2, Undo2, Redo2, ChevronDown, ChevronUp, HelpCircle, X
} from 'lucide-react';

/* =============================================================================
   SAFE STORAGE (SSR/Edge safe) + ACCOUNT SCOPING
   - All keys are prefixed with an account id.
============================================================================= */
type Backend = {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
};
function makeMemoryBackend(): Backend {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => { m.set(k, v); },
    removeItem: (k) => { m.delete(k); },
  };
}
function resolveBackend(): Backend {
  if (typeof window === 'undefined') return makeMemoryBackend();
  const ls: any = (window as any).localStorage;
  if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') return ls as Backend;
  return makeMemoryBackend();
}
function getAccountKey(): string {
  if (typeof window === 'undefined') return 'anon';
  try {
    const g = (window as any).__ACCOUNT_ID__ || (window as any).__USER_ID__;
    if (g) return String(g);
  } catch {}
  try {
    const u = new URL(window.location.href);
    const p = u.searchParams.get('acc');
    if (p) return p;
  } catch {}
  try {
    const m = document.cookie.match(/(?:^|;\s*)accid=([^;]+)/);
    if (m) return decodeURIComponent(m[1]);
  } catch {}
  try {
    const id = (window as any).localStorage?.getItem('account:id');
    if (id) return id;
  } catch {}
  return 'anon';
}
function createScopedStorage(scope: string) {
  const backend = resolveBackend();
  const account = getAccountKey();
  const prefix = `${account}:${scope}:`;
  return {
    getItem<T = any>(k: string): T | null {
      try {
        const raw = backend.getItem(prefix + k);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch { return null; }
    },
    setItem<T = any>(k: string, v: T): void {
      try { backend.setItem(prefix + k, JSON.stringify(v)); } catch {}
    },
    removeItem(k: string): void {
      try { backend.removeItem(prefix + k); } catch {}
    },
    // raw access for scanning keys (browser only)
    _allKeys(): string[] {
      try {
        if (typeof window === 'undefined') return [];
        const keys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i++) {
          const k = window.localStorage.key(i);
          if (!k) continue;
          if (k.startsWith(prefix)) keys.push(k.slice(prefix.length));
        }
        return keys;
      } catch { return []; }
    }
  };
}
const store = createScopedStorage('reduc');

/* =============================================================================
   CONFIG
============================================================================= */
const SCOPE = 'improve';
const MAX_REFINEMENTS = 5;
const TYPING_LATENCY_MS = 950;
const DEFAULT_TEMPERATURE = 0.5;

type ModelId =
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4.1'
  | 'gpt-4.1-mini'
  | 'o3'
  | 'o3-mini';

const MODEL_OPTIONS: Array<{ value: ModelId; label: string }> = [
  { value: 'gpt-4o',       label: 'GPT-4o' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o mini' },
  { value: 'gpt-4.1',      label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'o3',           label: 'o3 (reasoning)' },
  { value: 'o3-mini',      label: 'o3-mini (reasoning, fast)' },
];

/* Canonical keys */
const K_SELECTED_AGENT_ID = `${SCOPE}:selectedAgentId`;
const K_AGENT_LIST        = `agents:all`;                  // canonical list of agents (shared)
const K_AGENT_META_PREFIX = `agents:meta:`;               // per-agent tuning (shared)
const K_IMPROVE_STATE     = `${SCOPE}:agent:`;            // Improve's full per-agent state (history, etc.)

/* =============================================================================
   TYPES
============================================================================= */
type Agent = {
  id: string;
  name: string;
  createdAt: number;
  model: ModelId;
  temperature?: number;
};
type Refinement = { id: string; text: string; enabled: boolean; createdAt: number; };
type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string; reason?: string; createdAt: number; };
type AgentState = {
  model: ModelId;
  temperature: number;
  refinements: Refinement[];
  history: ChatMessage[];
  versions: Array<{ id: string; label: string; createdAt: number; snapshot: Omit<AgentState, 'versions'> }>;
  undo: Array<Omit<AgentState, 'versions' | 'undo' | 'redo'>>;
  redo: Array<Omit<AgentState, 'versions' | 'undo' | 'redo'>>;
};
type AgentMeta = {
  model: ModelId;
  temperature: number;
  refinements: Refinement[];
  updatedAt: number;
};

/* =============================================================================
   HELPERS
============================================================================= */
function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
function now() { return Date.now(); }
function clamp01(n: number) { return Math.max(0, Math.min(1, n)); }

function normalizeAgents(list: any): Agent[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((a) => a && a.id && a.name)
    .map((a) => ({
      id: String(a.id),
      name: String(a.name),
      createdAt: Number(a.createdAt || Date.now()),
      model: (MODEL_OPTIONS.some(m => m.value === a.model) ? a.model : 'gpt-4o') as ModelId,
      temperature: typeof a.temperature === 'number' ? a.temperature : DEFAULT_TEMPERATURE
    }));
}

/* Discover agents that may have been created elsewhere and write them to K_AGENT_LIST */
function discoverAgents(): Agent[] {
  // primary
  const main = normalizeAgents(store.getItem(K_AGENT_LIST));
  if (main.length) return main;

  // try a few common alternates to pick up existing agents
  const altKeys = [
    `${SCOPE}:agents`,                // old Improve list
    `assistants:list`,
    `builder:agents`,
    `voice:assistants`,
    `chat:agents`
  ];
  for (const k of altKeys) {
    const list = normalizeAgents(store.getItem(k));
    if (list.length) { store.setItem(K_AGENT_LIST, list); return list; }
  }

  // last resort: scan storage for arrays that look like agents
  try {
    for (const k of store._allKeys()) {
      const val = store.getItem(k);
      const list = normalizeAgents(val);
      if (list.length) { store.setItem(K_AGENT_LIST, list); return list; }
    }
  } catch {}

  return [];
}

function loadAgents(): Agent[] {
  const list = discoverAgents();
  if (list.length) return list;

  // create one if nothing exists
  const fallback = [{
    id: uid('agent'),
    name: 'My First Agent',
    createdAt: now(),
    model: 'gpt-4o' as ModelId,
    temperature: DEFAULT_TEMPERATURE,
  }];
  store.setItem(K_AGENT_LIST, fallback);
  return fallback;
}
function saveAgents(list: Agent[]) { store.setItem(K_AGENT_LIST, list); }

function loadAgentMeta(agentId: string): AgentMeta | null {
  return store.getItem(`${K_AGENT_META_PREFIX}${agentId}`);
}
function saveAgentMeta(agentId: string, meta: AgentMeta) {
  store.setItem(`${K_AGENT_META_PREFIX}${agentId}`, meta);
}

function loadImproveState(agentId: string): AgentState | null {
  return store.getItem(`${K_IMPROVE_STATE}${agentId}`);
}
function saveImproveState(agentId: string, st: AgentState) {
  store.setItem(`${K_IMPROVE_STATE}${agentId}`, st);
}

function loadSelectedAgentId(): string | null { return store.getItem(K_SELECTED_AGENT_ID); }
function saveSelectedAgentId(agentId: string) { store.setItem(K_SELECTED_AGENT_ID, agentId); }

function pickLatestAgent(agents: Agent[]): Agent | null {
  return agents.length ? [...agents].sort((a,b)=>b.createdAt-a.createdAt)[0] : null;
}

/* Reason text for the "Why?" modal */
function buildReasonFromRefinements(refs: Refinement[]): string {
  const active = refs.filter(r => r.enabled);
  if (!active.length) return 'No special requests are active—using a default helpful tone.';
  const bullets = active.slice(0, 3).map(r => r.text);
  return `Following your active refinements: ${bullets.join('; ')}.`;
}

/* Smarter default replies so it doesn’t feel same-y */
function defaultAnswerFor(text: string, history: ChatMessage[]): string {
  const t = text.trim().toLowerCase();
  if (!t) return "Sure—what would you like to do?";

  const isGreeting = /^(hi|hey|hello|yo|hiya|heya|sup)\b/.test(t);
  const isStatus   = /\b(how are (you|u)|hru|wyd|what'?s up|wbu)\b/.test(t);
  const isHelp     = /\b(help|assist|support)\b/.test(t);
  const isStart    = /\b(let'?s|lets)\s*(start|begin|kick ?off|work|get started)\b/.test(t);
  const isQuestion = t.endsWith('?');
  const isNTM      = t === 'ntm' || t === 'not much' || t === 'not too much';

  const countUser = (re: RegExp) =>
    history.filter(m => m.role === 'user' && re.test(m.content.toLowerCase())).length;

  const greetingCount = countUser(/^(hi|hey|hello|yo|hiya|heya|sup)\b/i) + (isGreeting ? 1 : 0);
  const startCount    = countUser(/\b(let'?s|lets)\s*(start|begin|kick ?off|work|get started)\b/i) + (isStart ? 1 : 0);

  const actions = 'We can ① set a quick goal, ② outline a 3-step plan, or ③ make a to-do checklist.';

  if (isGreeting || isStatus) {
    if (greetingCount <= 1) return "Hey! I’m here and ready to help. What are you working on?";
    if (greetingCount === 2) return "Hi again — want me to set a quick goal or create a starter plan?";
    return "Ready when you are. " + actions;
  }
  if (isStart) {
    if (startCount <= 1) return "Great — let’s kick this off. " + actions;
    return "Okay, picking up: " + actions + " Tell me which one and any constraints.";
  }
  if (isHelp) {
    return "Absolutely. Tell me your objective and any constraints (deadline, style, length). " + actions;
  }
  if (isQuestion) {
    return "Here’s a concise answer. If you want a specific tone or length, add a rule on the left.";
  }
  if (isNTM) {
    return "No worries. Want to spin up something small? " + actions;
  }
  return "Got it. Here’s a concise response. If you want a different tone or structure, add a rule on the left.";
}

/* =============================================================================
   MAIN
============================================================================= */
export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [state, setState] = useState<AgentState | null>(null);

  const [input, setInput] = useState('');
  const [addingRefine, setAddingRefine] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWhyFor, setShowWhyFor] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot
  useEffect(() => {
    const list = loadAgents();
    setAgents(list);

    const savedId = loadSelectedAgentId();
    const selected = list.find(a => a.id === savedId) ?? pickLatestAgent(list);
    if (selected) {
      setAgentId(selected.id);
      hydrateFromAgent(selected.id, list);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function hydrateFromAgent(id: string, list: Agent[] = agents) {
    const agent = list.find(a => a.id === id);
    if (!agent) return;

    // Start with Improve state (history etc)
    const base: AgentState = loadImproveState(id) ?? {
      model: agent.model,
      temperature: agent.temperature ?? DEFAULT_TEMPERATURE,
      refinements: [],
      history: [{
        id: uid('sys'),
        role: 'system',
        content: 'This is the Improve panel. Your agent will reply based on the active refinements.',
        createdAt: now(),
      }],
      versions: [],
      undo: [],
      redo: [],
    };

    // Overlay agent meta tuning if it exists (source of truth for tuning)
    const meta = loadAgentMeta(id);
    if (meta) {
      base.model = meta.model;
      base.temperature = meta.temperature;
      base.refinements = meta.refinements ?? base.refinements;
    }

    // guard invalid model
    if (!MODEL_OPTIONS.some(m => m.value === base.model)) base.model = 'gpt-4o';

    setState(base);
    saveImproveState(id, base);
  }

  // Persist Improve state
  useEffect(() => {
    if (!agentId || !state) return;
    saveImproveState(agentId, state);
  }, [agentId, state]);

  // Auto-sync tuning back to the agent’s own record (so other pages see it)
  useEffect(() => {
    if (!agentId || !state) return;
    // update meta
    const meta: AgentMeta = {
      model: state.model,
      temperature: state.temperature,
      refinements: state.refinements,
      updatedAt: now(),
    };
    saveAgentMeta(agentId, meta);

    // also reflect model/temperature on the agent list
    setAgents(prev => {
      const next = prev.map(a => a.id === agentId ? { ...a, model: state.model, temperature: state.temperature } : a);
      saveAgents(next);
      return next;
    });
  }, [agentId, state?.model, state?.temperature, state?.refinements]);

  // Scroll
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state?.history.length, isSending]);

  // Undo helpers
  function snapshotCore(st: AgentState): Omit<AgentState, 'versions' | 'undo' | 'redo'> {
    const { model, temperature, refinements, history } = st;
    return { model, temperature, refinements: [...refinements], history: [...history] };
  }
  function pushUndo(ss: Omit<AgentState, 'versions' | 'undo' | 'redo'>) {
    setState(prev => prev ? { ...prev, undo: [...prev.undo, ss], redo: [] } : prev);
  }

  // Refinements
  function handleAddRefinement() {
    if (!state) return;
    const text = addingRefine.trim();
    if (!text) return;
    const newRef: Refinement = { id: uid('ref'), text, enabled: true, createdAt: now() };
    const nextRefs = [newRef, ...state.refinements].slice(0, MAX_REFINEMENTS);
    pushUndo(snapshotCore(state));
    setState({ ...state, refinements: nextRefs });
    setAddingRefine('');
  }
  function toggleRefinement(id: string) {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, refinements: state.refinements.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r) });
  }
  function deleteRefinement(id: string) {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, refinements: state.refinements.filter(r => r.id !== id) });
  }
  function clearRefinements() {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, refinements: [] });
  }

  // Settings
  function changeModel(m: ModelId) {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, model: m });
  }
  function changeTemperature(t: number) {
    if (!state) return;
    const val = clamp01(t);
    pushUndo(snapshotCore(state));
    setState({ ...state, temperature: val });
  }
  function selectAgent(id: string) {
    const a = agents.find(x => x.id === id);
    if (!a) return;
    saveSelectedAgentId(a.id);
    setAgentId(a.id);
    hydrateFromAgent(a.id);
  }
  function saveVersion() {
    if (!state) return;
    const ver = { id: uid('ver'), label: new Date().toLocaleString(), createdAt: now(), snapshot: snapshotCore(state) };
    setState({ ...state, versions: [ver, ...state.versions] });
  }
  function loadVersion(verId: string) {
    if (!state) return;
    const ver = state.versions.find(v => v.id === verId);
    if (!ver) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, ...ver.snapshot });
  }
  function undo() {
    if (!state || !state.undo.length) return;
    const last = state.undo.at(-1)!;
    const newUndo = state.undo.slice(0, -1);
    const redoSnap = snapshotCore(state);
    setState({ ...state, ...last, undo: newUndo, redo: [...state.redo, redoSnap] } as AgentState);
  }
  function redo() {
    if (!state || !state.redo.length) return;
    const last = state.redo.at(-1)!;
    const newRedo = state.redo.slice(0, -1);
    const undoSnap = snapshotCore(state);
    setState({ ...state, ...last, redo: newRedo, undo: [...state.undo, undoSnap] } as AgentState);
  }

  // New agent (optional)
  function createAgent() {
    const a: Agent = {
      id: uid('agent'),
      name: `Agent ${agents.length + 1}`,
      createdAt: now(),
      model: 'gpt-4o',
      temperature: DEFAULT_TEMPERATURE,
    };
    const next = [...agents, a];
    saveAgents(next);
    setAgents(next);
    saveSelectedAgentId(a.id);
    setAgentId(a.id);

    const st: AgentState = {
      model: a.model,
      temperature: a.temperature ?? DEFAULT_TEMPERATURE,
      refinements: [],
      history: [{
        id: uid('sys'),
        role: 'system',
        content: 'This is the Improve panel. Your agent will reply based on the active refinements.',
        createdAt: now(),
      }],
      versions: [],
      undo: [],
      redo: [],
    };
    saveImproveState(a.id, st);
    setState(st);
  }

  // Chat
  async function sendMessage() {
    if (!state) return;
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: uid('m'), role: 'user', content: text, createdAt: now() };
    pushUndo(snapshotCore(state));
    setState({ ...state, history: [...state.history, userMsg] });
    setInput('');
    setIsSending(true);

    await new Promise(r => setTimeout(r, TYPING_LATENCY_MS));

    const active = state.refinements.filter(r => r.enabled).map(r => r.text.toLowerCase());
    const wantsYesNo   = active.some(s => s.includes('yes or no') || s.includes('yes/no'));
    const wantsOneWord = active.some(s => s.includes('one word') || s.includes('1 word'));
    const noGreeting   = active.some(s => s.includes('no greeting') || s.includes('no hello'));

    let reply: string;
    if (wantsOneWord) reply = 'Yes';
    else if (wantsYesNo) reply = 'Yes';
    else {
      const base = defaultAnswerFor(text, [...state.history, userMsg]);
      reply = noGreeting ? base.replace(/^hey!?\s*/i, '').trim() : base;
    }

    const aiMsg: ChatMessage = {
      id: uid('m'),
      role: 'assistant',
      content: reply,
      reason: buildReasonFromRefinements(state.refinements),
      createdAt: now(),
    };
    setState(prev => prev ? { ...prev, history: [...prev.history, aiMsg] } : prev);
    setIsSending(false);
  }

  function copyLast() {
    if (!state) return;
    const last = [...state.history].reverse().find(m => m.role === 'assistant');
    if (last) navigator.clipboard?.writeText(last.content);
  }

  // Derived
  const selectedAgent = useMemo(() => agents.find(a => a.id === agentId) ?? null, [agents, agentId]);
  const safeSelectedId = useMemo(
    () => (agentId && agents.some(a => a.id === agentId)) ? agentId : (agents[0]?.id ?? ''),
    [agentId, agents]
  );

  if (!state || !selectedAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center font-sans"
           style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="opacity-80 flex items-center gap-3">
          <Loader2 className="animate-spin" /> Loading Improve…
        </div>
      </div>
    );
  }

  /* =============================================================================
     UI
  ============================================================================= */
  return (
    <div className={`${SCOPE} min-h-screen font-sans`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 backdrop-blur-sm border-b"
           style={{ background: 'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor: 'var(--border)' }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex items-center justify-between">
          {/* Agent picker */}
          <div className="flex items-center gap-3">
            <Bot size={20} />
            <span className="font-semibold">Improve</span>
            <span className="opacity-60">/</span>

            <select
              className="rounded-md px-2 py-1 text-sm border bg-transparent"
              style={{ borderColor: 'var(--border)' }}
              value={safeSelectedId}
              onChange={(e) => {
                const id = e.target.value;
                if (id && id !== agentId) selectAgent(id);
              }}
              title="Pick which agent you want to tune"
            >
              {agents.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <button
              onClick={createAgent}
              className="px-2 py-1 rounded-md border"
              style={{ borderColor: 'var(--border)' }}
              title="Create a new agent"
            >
              + New
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={undo} className="px-2 py-1 rounded-md border" style={{ borderColor: 'var(--border)' }}>
              <Undo2 size={16} />
            </button>
            <button onClick={redo} className="px-2 py-1 rounded-md border" style={{ borderColor: 'var(--border)' }}>
              <Redo2 size={16} />
            </button>
            <button
              onClick={() => setShowSettings(v => !v)}
              className="px-2 py-1 rounded-md flex items-center gap-2 border"
              style={{ borderColor: 'var(--border)' }}
            >
              <Settings2 size={16} /> Settings {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="text-xs opacity-70 mb-1">
                  Model <span className="opacity-60">(applies to <strong>{selectedAgent.name}</strong>)</span>
                </div>
                <select
                  className="w-full rounded-md px-2 py-2 border bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                  value={state.model}
                  onChange={e => changeModel(e.target.value as ModelId)}
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
                <div className="mt-2 text-xs opacity-60">
                  Tuning is auto-saved to this agent (per account).
                </div>
              </div>

              <div className="rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="text-xs opacity-70 mb-1">Creativity (Temperature)</div>
                <input type="range" min={0} max={1} step={0.05} value={state.temperature}
                       onChange={(e) => changeTemperature(parseFloat(e.target.value))}
                       className="w-full" />
                <div className="text-xs opacity-60 mt-1">{state.temperature.toFixed(2)}</div>
              </div>

              <div className="rounded-lg p-3 flex items-center justify-between gap-2 border"
                   style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <button onClick={saveVersion} className="flex items-center gap-2 px-3 py-2 rounded-md border"
                        style={{ borderColor: 'var(--border)' }} title="Save snapshot of current settings & chat">
                  <History size={16} /> Save Version
                </button>
                <button onClick={copyLast} className="flex items-center gap-2 px-3 py-2 rounded-md border"
                        style={{ borderColor: 'var(--border)' }} title="Copy last reply">
                  <Copy size={16} /> Copy Reply
                </button>
                <button onClick={clearRefinements} className="flex items-center gap-2 px-3 py-2 rounded-md border"
                        style={{ borderColor: 'var(--border)' }} title="Clear all refinements">
                  <Trash2 size={16} /> Clear Rules
                </button>
              </div>
            </div>

            {!!state.versions.length && (
              <div className="mt-3 rounded-lg p-3 border" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                <div className="text-xs opacity-70 mb-2">Versions</div>
                <div className="flex flex-wrap gap-2">
                  {state.versions.map(v => (
                    <button key={v.id} onClick={() => loadVersion(v.id)}
                            className="px-3 py-1 rounded-full border text-sm"
                            style={{ borderColor: 'var(--border)' }}
                            title={new Date(v.createdAt).toLocaleString()}>
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main layout */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 grid lg:grid-cols-[420px,1fr] gap-6">
        {/* Left: Refinements */}
        <div>
          <div className="rounded-xl p-4 border"
               style={{ borderColor: 'var(--border)', background: 'var(--panel)', boxShadow: 'var(--shadow-soft)' }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Your Refinements</div>
              <span className="text-xs opacity-60">{state.refinements.length}/{MAX_REFINEMENTS}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent"
                style={{ borderColor: 'var(--border)' }}
                placeholder='Add a rule (e.g., “Only answer Yes/No”)'
                value={addingRefine}
                onChange={(e) => setAddingRefine(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddRefinement(); }}
              />
              <button onClick={handleAddRefinement}
                      className="px-3 py-2 rounded-md flex items-center gap-2 border"
                      style={{ borderColor: 'var(--border)' }}>
                <Plus size={16} /> Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {state.refinements.map(ref => (
                <div key={ref.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 border"
                     style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ref.enabled} onChange={() => toggleRefinement(ref.id)}
                           className="w-4 h-4" style={{ accentColor: 'var(--brand)' }} />
                    <span className="text-sm">{ref.text}</span>
                  </label>
                  <button onClick={() => deleteRefinement(ref.id)} className="opacity-60 hover:opacity-100" title="Remove">
                    <X size={16} />
                  </button>
                </div>
              ))}
              {!state.refinements.length && (
                <div className="text-sm opacity-60">Add up to {MAX_REFINEMENTS} short rules. Tick to enable/disable each rule.</div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['Only answer Yes/No','One word replies','No greeting','Be concise','Ask clarifying question first'].map(t => (
                <button key={t} onClick={() => { setAddingRefine(t); setTimeout(handleAddRefinement, 0); }}
                        className="text-xs px-2 py-1 rounded-full border"
                        style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl p-4 border"
               style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
            <div className="flex items-center gap-2 font-semibold"><HelpCircle size={16} /> Tips</div>
            <ul className="mt-2 text-sm opacity-80 list-disc pl-5 space-y-1">
              <li>Tuning (model, temperature, rules) is auto-saved onto the selected agent.</li>
              <li>“Save &amp; Rerun” happens when you send a message.</li>
              <li>Use <em>Versions</em> to snapshot settings + chat for quick rollback.</li>
            </ul>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="rounded-xl flex flex-col border"
             style={{ borderColor: 'var(--border)', background: 'var(--panel)', boxShadow: 'var(--shadow-soft)', minHeight: 560 }}>
          {/* conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {state.history.map(msg => (
              <div key={msg.id} className={`max-w-[80%] ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                <div className="rounded-lg px-3 py-2 text-sm border"
                     style={{
                       borderColor: 'var(--border)',
                       background: msg.role === 'user' ? 'var(--card)' : 'var(--panel)'
                     }}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => setShowWhyFor(msg.id)}
                              className="text-xs px-2 py-1 rounded-md flex items-center gap-1 border"
                              style={{ borderColor: 'var(--border)' }}
                              title="Why this reply?">
                        <Info size={14} /> Why?
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isSending && (
              <div className="max-w-[80%]">
                <div className="rounded-lg px-3 py-2 text-sm border" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'currentColor', animationDelay: '0ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'currentColor', animationDelay: '120ms' }} />
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: 'currentColor', animationDelay: '240ms' }} />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* composer */}
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent"
                style={{ borderColor: 'var(--border)' }}
                placeholder="Type your message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              />
              <button
                onClick={sendMessage}
                disabled={isSending}
                className="px-3 py-2 rounded-md flex items-center gap-2 border disabled:opacity-60"
                style={{ borderColor: 'var(--border)' }}
                title="Save & Rerun"
              >
                {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <QuickChip icon={<Sparkles size={14} />} label="Make it shorter" onClick={() => setAddingRefine('Be concise')} />
              <QuickChip icon={<Sparkles size={14} />} label="No greeting" onClick={() => setAddingRefine('No greeting')} />
              <QuickChip icon={<Sparkles size={14} />} label="Yes/No only" onClick={() => setAddingRefine('Only answer Yes/No')} />
              <QuickChip icon={<Sparkles size={14} />} label="1-word" onClick={() => setAddingRefine('One word replies')} />
            </div>
          </div>
        </div>
      </div>

      {/* Why modal */}
      {showWhyFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)' }}>
          <div className="w-[520px] max-w-[92vw] rounded-xl p-4 border"
               style={{ background: 'var(--panel)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-soft)' }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><Info size={16} /> Why this reply?</div>
              <button onClick={() => setShowWhyFor(null)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
            </div>
            <div className="mt-3 text-sm leading-relaxed">{buildReasonFromRefinements(state.refinements)}</div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowWhyFor(null)}
                      className="px-3 py-2 rounded-md text-sm border"
                      style={{ borderColor: 'var(--border)' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   Small UI
============================================================================= */
function QuickChip({ icon, label, onClick }: { icon?: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 border"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
      title="Add as refinement"
    >
      {icon}{label}
    </button>
  );
}
