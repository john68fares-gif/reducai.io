// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, Copy, History, Info, Loader2, Plus, RefreshCw, Send, Settings2,
  Sparkles, Trash2, Undo2, Redo2, ChevronDown, ChevronUp, HelpCircle, X
} from 'lucide-react';
// NOTE: We intentionally avoid importing your scoped-storage util here to
// prevent "getItem is not a function" crashes. This file has its own safe shim.

/* =============================================================================
   SAFE STORAGE (local to this file)
   - JSON-safe
   - SSR/Edge safe (falls back to in-memory)
   - Same shape as your previous helper for this page's needs
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
  if (ls && typeof ls.getItem === 'function' && typeof ls.setItem === 'function') {
    return ls as Backend;
  }
  // Some environments shim localStorage incorrectly → fail gracefully
  return makeMemoryBackend();
}

function createScopedStorage(scope: string) {
  const backend = resolveBackend();
  const key = (k: string) => `${scope}:${k}`;
  return {
    getItem<T = any>(k: string): T | null {
      try {
        const raw = backend.getItem(key(k));
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch { return null; }
    },
    setItem<T = any>(k: string, v: T): void {
      try {
        backend.setItem(key(k), JSON.stringify(v));
      } catch { /* ignore quota/serialization errors */ }
    },
    removeItem(k: string): void {
      try { backend.removeItem(key(k)); } catch {}
    },
  };
}

const scopedStorage = createScopedStorage('reduc'); // namespaced for your app

/* =============================================================================
   CONFIG
============================================================================= */

const SCOPE = 'improve';
const BRAND = '#00ffc2';
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

// storage keys (scoped by account/user internally via scopedStorage)
const K_SELECTED_AGENT_ID = `${SCOPE}:selectedAgentId`;
const K_AGENT_LIST = `${SCOPE}:agents`; // [{id, name, createdAt, model, temperature}]
const K_AGENT_STATE_PREFIX = `${SCOPE}:agent:`; // + agentId => per-agent state (model, temp, refinements, versions)

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

type Refinement = {
  id: string;
  text: string;
  enabled: boolean;
  createdAt: number;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reason?: string; // short reason shown when pressing "Why this reply?"
  createdAt: number;
};

type AgentState = {
  model: ModelId;
  temperature: number;
  refinements: Refinement[]; // last 5 only
  history: ChatMessage[];
  versions: Array<{ id: string; label: string; createdAt: number; snapshot: Omit<AgentState, 'versions'> }>;
  undo: Array<Omit<AgentState, 'versions' | 'undo' | 'redo'>>;
  redo: Array<Omit<AgentState, 'versions' | 'undo' | 'redo'>>;
};

/* =============================================================================
   HELPERS
============================================================================= */

function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

function now() { return Date.now(); }

function loadAgents(): Agent[] {
  return scopedStorage.getItem<Agent[]>(K_AGENT_LIST) ?? [];
}

function saveAgents(list: Agent[]) {
  scopedStorage.setItem(K_AGENT_LIST, list);
}

function loadAgentState(agentId: string): AgentState | null {
  return scopedStorage.getItem<AgentState>(`${K_AGENT_STATE_PREFIX}${agentId}`);
}

function saveAgentState(agentId: string, state: AgentState) {
  scopedStorage.setItem(`${K_AGENT_STATE_PREFIX}${agentId}`, state);
}

function loadSelectedAgentId(): string | null {
  return scopedStorage.getItem<string>(K_SELECTED_AGENT_ID);
}
function saveSelectedAgentId(agentId: string) {
  scopedStorage.setItem(K_SELECTED_AGENT_ID, agentId);
}

function pickLatestAgent(agents: Agent[]): Agent | null {
  if (!agents.length) return null;
  return [...agents].sort((a, b) => b.createdAt - a.createdAt)[0];
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

/* Builds a one-line reason from active refinements */
function buildReasonFromRefinements(refs: Refinement[]): string {
  const active = refs.filter(r => r.enabled);
  if (!active.length) return 'No special requests are active.';
  const bullets = active.slice(0, 3).map(r => r.text);
  return `Following your active refinements: ${bullets.join('; ')}.`;
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
  const [showWhyFor, setShowWhyFor] = useState<string | null>(null); // message id

  const scrollRef = useRef<HTMLDivElement>(null);

  /* ------------------------------ Bootstrapping ------------------------------ */
  useEffect(() => {
    // Load known agents
    const list = loadAgents();

    // Ensure at least one agent exists (demo case)
    let ensured = list;
    if (!list.length) {
      ensured = [{
        id: uid('agent'),
        name: 'My First Agent',
        createdAt: now(),
        model: 'gpt-4o',
        temperature: DEFAULT_TEMPERATURE,
      }];
      saveAgents(ensured);
    }
    setAgents(ensured);

    // Select saved agent or latest
    const savedId = loadSelectedAgentId();
    const selected =
      ensured.find(a => a.id === savedId) ??
      pickLatestAgent(ensured);

    if (selected) {
      setAgentId(selected.id);
      // hydrate state
      const st: AgentState = loadAgentState(selected.id) ?? {
        model: selected.model,
        temperature: selected.temperature ?? DEFAULT_TEMPERATURE,
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

      // Ensure model is valid (no ghost options)
      if (!MODEL_OPTIONS.some(m => m.value === st.model)) {
        st.model = 'gpt-4o';
      }

      setState(st);
      saveAgentState(selected.id, st);
    }
  }, []);

  /* ------------------------------ Persist & Scroll ------------------------------ */
  useEffect(() => {
    if (!agentId || !state) return;
    saveAgentState(agentId, state);
  }, [agentId, state]);

  useEffect(() => {
    // autoscroll to bottom on new messages
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state?.history.length, isSending]);

  /* ------------------------------ Actions ------------------------------ */

  function pushUndo(snapshot: Omit<AgentState, 'versions' | 'undo' | 'redo'>) {
    setState(prev => prev ? { ...prev, undo: [...prev.undo, snapshot], redo: [] } : prev);
  }

  function snapshotCore(st: AgentState): Omit<AgentState, 'versions' | 'undo' | 'redo'> {
    const { model, temperature, refinements, history } = st;
    return { model, temperature, refinements: [...refinements], history: [...history] };
  }

  function handleAddRefinement() {
    const text = addingRefine.trim();
    if (!text || !state) return;

    const newRef: Refinement = {
      id: uid('ref'),
      text,
      enabled: true,
      createdAt: now(),
    };

    const nextRefs = [newRef, ...state.refinements].slice(0, MAX_REFINEMENTS);

    pushUndo(snapshotCore(state));
    setState({ ...state, refinements: nextRefs });
    setAddingRefine('');
  }

  function toggleRefinement(id: string) {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({
      ...state,
      refinements: state.refinements.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r),
    });
  }

  function deleteRefinement(id: string) {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({
      ...state,
      refinements: state.refinements.filter(r => r.id !== id),
    });
  }

  function clearRefinements() {
    if (!state) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, refinements: [] });
  }

  function changeModel(m: ModelId) {
    if (!state || !agentId) return;
    pushUndo(snapshotCore(state));
    setState({ ...state, model: m });
    // also store on agent record so it persists across sessions & first-time pick
    setAgents(prev => {
      const next = prev.map(a => a.id === agentId ? { ...a, model: m } : a);
      saveAgents(next);
      return next;
    });
  }

  function changeTemperature(t: number) {
    if (!state || !agentId) return;
    const val = clamp01(t);
    pushUndo(snapshotCore(state));
    setState({ ...state, temperature: val });
    setAgents(prev => {
      const next = prev.map(a => a.id === agentId ? { ...a, temperature: val } : a);
      saveAgents(next);
      return next;
    });
  }

  function selectAgent(id: string) {
    const a = agents.find(x => x.id === id);
    if (!a) return;
    saveSelectedAgentId(a.id);
    setAgentId(a.id);

    // hydrate state (keep existing if found)
    const loaded: AgentState = loadAgentState(a.id) ?? {
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

    if (!MODEL_OPTIONS.some(m => m.value === loaded.model)) {
      loaded.model = 'gpt-4o';
    }

    setState(loaded);
    saveAgentState(a.id, loaded);
  }

  function saveVersion() {
    if (!state) return;
    const ver = {
      id: uid('ver'),
      label: new Date().toLocaleString(),
      createdAt: now(),
      snapshot: snapshotCore(state),
    };
    const next = { ...state, versions: [ver, ...state.versions] };
    setState(next);
  }

  function loadVersion(verId: string) {
    if (!state) return;
    const ver = state.versions.find(v => v.id === verId);
    if (!ver) return;
    pushUndo(snapshotCore(state));
    setState({
      ...state,
      model: ver.snapshot.model,
      temperature: ver.snapshot.temperature,
      refinements: ver.snapshot.refinements,
      history: ver.snapshot.history,
    });
  }

  function undo() {
    if (!state || !state.undo.length) return;
    const last = state.undo[state.undo.length - 1];
    const newUndo = state.undo.slice(0, -1);
    const redoSnap = snapshotCore(state);
    setState({
      ...state,
      ...last,
      undo: newUndo,
      redo: [...state.redo, redoSnap],
    } as AgentState);
  }

  function redo() {
    if (!state || !state.redo.length) return;
    const last = state.redo[state.redo.length - 1];
    const newRedo = state.redo.slice(0, -1);
    const undoSnap = snapshotCore(state);
    setState({
      ...state,
      ...last,
      redo: newRedo,
      undo: [...state.undo, undoSnap],
    } as AgentState);
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || !state) return;

    const userMsg: ChatMessage = {
      id: uid('m'),
      role: 'user',
      content: text,
      createdAt: now(),
    };

    pushUndo(snapshotCore(state));
    setState({ ...state, history: [...state.history, userMsg] });
    setInput('');
    setIsSending(true);

    // Simulated call to your API → here we just “respect” refinements
    await new Promise(r => setTimeout(r, TYPING_LATENCY_MS));

    const reason = buildReasonFromRefinements(state.refinements);

    // Very light “constraint application”
    let reply = `Here's my answer to: "${text}"`;
    const active = state.refinements.filter(r => r.enabled).map(r => r.text.toLowerCase());

    const wantsYesNo = active.some(s => s.includes('yes or no') || s.includes('yes/no'));
    const wantsOneWord = active.some(s => s.includes('one word') || s.includes('1 word'));
    const noGreeting = active.some(s => s.includes('no greeting') || s.includes('no hello'));

    if (wantsOneWord) reply = 'Yes';
    else if (wantsYesNo) reply = 'Yes or No: Yes';
    else reply = (noGreeting ? '' : '') + `I considered your constraints and answered directly: ${text ? '…' : ''}`.trim();

    const aiMsg: ChatMessage = {
      id: uid('m'),
      role: 'assistant',
      content: reply,
      reason,
      createdAt: now(),
    };

    setState(prev => prev ? { ...prev, history: [...prev.history, aiMsg] } : prev);

    setIsSending(false);
  }

  function copyLast() {
    if (!state) return;
    const last = [...state.history].reverse().find(m => m.role === 'assistant');
    if (!last) return;
    navigator.clipboard?.writeText(last.content);
  }

  /* ------------------------------ Derived ------------------------------ */
  const selectedAgent = useMemo(() => agents.find(a => a.id === agentId) ?? null, [agents, agentId]);

  if (!state || !selectedAgent) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
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
      <div className="sticky top-0 z-20 border-b border-white/5 backdrop-blur-sm"
           style={{ background: 'color-mix(in oklab, var(--bg) 90%, transparent)' }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20} />
            <span className="font-semibold">Improve</span>
            <span className="opacity-60">/</span>
            {/* Agent selector */}
            <select
              className="bg-transparent border border-white/10 rounded-md px-2 py-1 text-sm"
              value={selectedAgent.id}
              onChange={e => selectAgent(e.target.value)}
            >
              {agents.map(a => (
                <option key={a.id} value={a.id} className="bg-black">
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={undo} className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20">
              <Undo2 size={16} />
            </button>
            <button onClick={redo} className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20">
              <Redo2 size={16} />
            </button>
            <button
              onClick={() => setShowSettings(v => !v)}
              className="px-2 py-1 rounded-md border border-white/10 hover:border-white/20 flex items-center gap-2"
            >
              <Settings2 size={16} /> Settings
              {showSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-white/10 p-3">
                <div className="text-xs opacity-70 mb-1">Model</div>
                <select
                  className="w-full bg-transparent border border-white/10 rounded-md px-2 py-2"
                  value={state.model}
                  onChange={e => changeModel(e.target.value as ModelId)}
                >
                  {MODEL_OPTIONS.map(m => (
                    <option key={m.value} value={m.value} className="bg-black">
                      {m.label}
                    </option>
                  ))}
                </select>
                <div className="mt-2 text-xs opacity-60">
                  Only valid, supported options are shown. Your choice is saved to this agent.
                </div>
              </div>

              <div className="rounded-lg border border-white/10 p-3">
                <div className="text-xs opacity-70 mb-1">Creativity (Temperature)</div>
                <input
                  type="range"
                  min={0} max={1} step={0.05}
                  value={state.temperature}
                  onChange={(e) => changeTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs opacity-60 mt-1">{state.temperature.toFixed(2)}</div>
              </div>

              <div className="rounded-lg border border-white/10 p-3 flex items-center justify-between gap-2">
                <button
                  onClick={saveVersion}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 hover:border-white/20"
                  title="Save snapshot of current settings & chat"
                >
                  <History size={16} /> Save Version
                </button>
                <button
                  onClick={copyLast}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 hover:border-white/20"
                  title="Copy last reply"
                >
                  <Copy size={16} /> Copy Reply
                </button>
                <button
                  onClick={clearRefinements}
                  className="flex items-center gap-2 px-3 py-2 rounded-md border border-white/10 hover:border-white/20"
                  title="Clear all refinements"
                >
                  <Trash2 size={16} /> Clear Rules
                </button>
              </div>
            </div>

            {/* Versions */}
            {!!state.versions.length && (
              <div className="mt-3 rounded-lg border border-white/10 p-3">
                <div className="text-xs opacity-70 mb-2">Versions</div>
                <div className="flex flex-wrap gap-2">
                  {state.versions.map(v => (
                    <button
                      key={v.id}
                      onClick={() => loadVersion(v.id)}
                      className="px-3 py-1 rounded-full border border-white/10 hover:border-white/20 text-sm"
                      title={new Date(v.createdAt).toLocaleString()}
                    >
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
        {/* Left: Refinements (tick boxes) */}
        <div>
          <div className="rounded-xl border border-white/10 p-4"
               style={{ boxShadow: '0 10px 24px rgba(0,0,0,.25)' }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Your Refinements</div>
              <span className="text-xs opacity-60">{state.refinements.length}/{MAX_REFINEMENTS}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <input
                className="flex-1 bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm"
                placeholder="Add a rule (e.g., “Only answer Yes/No”)"
                value={addingRefine}
                onChange={(e) => setAddingRefine(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddRefinement(); }}
              />
              <button
                onClick={handleAddRefinement}
                className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 flex items-center gap-2"
              >
                <Plus size={16} /> Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {state.refinements.map(ref => (
                <div key={ref.id}
                     className="flex items-center justify-between gap-2 rounded-md border border-white/10 px-3 py-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ref.enabled}
                      onChange={() => toggleRefinement(ref.id)}
                      className="accent-[var(--brand,#00ffc2)] w-4 h-4"
                    />
                    <span className="text-sm">{ref.text}</span>
                  </label>
                  <button
                    onClick={() => deleteRefinement(ref.id)}
                    className="opacity-60 hover:opacity-100"
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
              {!state.refinements.length && (
                <div className="text-sm opacity-60">
                  Add up to {MAX_REFINEMENTS} short rules. Tick to enable/disable each rule.
                </div>
              )}
            </div>

            {/* Templates row */}
            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Only answer Yes/No',
                'One word replies',
                'No greeting',
                'Be concise',
                'Ask clarifying question first'
              ].map(t => (
                <button
                  key={t}
                  onClick={() => { setAddingRefine(t); setTimeout(handleAddRefinement, 0); }}
                  className="text-xs px-2 py-1 rounded-full border border-white/10 hover:border-white/20"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Tips / contextual info */}
          <div className="mt-4 rounded-xl border border-white/10 p-4">
            <div className="flex items-center gap-2 font-semibold"><HelpCircle size={16} /> Tips</div>
            <ul className="mt-2 text-sm opacity-80 list-disc pl-5 space-y-1">
              <li>Refinements are auto-saved to this agent.</li>
              <li>“Save & Rerun” happens automatically when you send a message.</li>
              <li>Use <em>Versions</em> to snapshot settings + chat for quick rollback.</li>
            </ul>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="rounded-xl border border-white/10 flex flex-col"
             style={{ boxShadow: '0 10px 24px rgba(0,0,0,.25)', minHeight: 560 }}>
          {/* conversation */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {state.history.map(msg => (
              <div key={msg.id} className={`max-w-[80%] ${msg.role === 'user' ? 'ml-auto' : ''}`}>
                <div
                  className={`rounded-lg px-3 py-2 text-sm border ${
                    msg.role === 'user'
                      ? 'border-white/10'
                      : 'border-white/10'
                  }`}
                  style={{
                    background: msg.role === 'user' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.2)',
                  }}
                >
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>

                  {msg.role === 'assistant' && (
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        onClick={() => setShowWhyFor(msg.id)}
                        className="text-xs px-2 py-1 rounded-md border border-white/10 hover:border-white/20 flex items-center gap-1"
                        title="Why this reply?"
                      >
                        <Info size={14} /> Why?
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* typing indicator */}
            {isSending && (
              <div className="max-w-[80%]">
                <div className="rounded-lg px-3 py-2 text-sm border border-white/10" style={{ background: 'rgba(0,0,0,0.2)' }}>
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
          <div className="border-t border-white/10 p-3">
            <div className="flex items-center gap-2">
              <input
                className="flex-1 bg-transparent border border-white/10 rounded-md px-3 py-2 text-sm"
                placeholder="Type your message…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              />
              <button
                onClick={sendMessage}
                disabled={isSending}
                className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 flex items-center gap-2 disabled:opacity-60"
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/50">
          <div className="w-[520px] max-w-[92vw] rounded-xl border border-white/10 p-4"
               style={{ background: 'color-mix(in oklab, var(--bg) 92%, black)', boxShadow: '0 10px 24px rgba(0,0,0,.35)' }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><Info size={16} /> Why this reply?</div>
              <button onClick={() => setShowWhyFor(null)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
            </div>
            <div className="mt-3 text-sm leading-relaxed">
              {buildReasonFromRefinements(state.refinements)}
            </div>
            <div className="mt-3 text-xs opacity-70">
              Tip: Toggle specific refinements on the left to change how the AI answers.
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowWhyFor(null)}
                      className="px-3 py-2 rounded-md border border-white/10 hover:border-white/20 text-sm">
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
      className="text-xs px-2 py-1 rounded-full border border-white/10 hover:border-white/20 inline-flex items-center gap-1"
      title="Add as refinement"
    >
      {icon}{label}
    </button>
  );
}
