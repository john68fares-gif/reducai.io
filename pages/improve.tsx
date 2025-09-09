'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, Copy, History, Info, Loader2, Plus, Send, Settings2,
  Sparkles, Trash2, Undo2, Redo2, ChevronDown, ChevronUp, HelpCircle, X
} from 'lucide-react';

import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

/* =============================================================================
   CONFIG / KEYS
============================================================================= */
const SCOPE = 'improve';
const MAX_REFINEMENTS = 5;
const DEFAULT_TEMPERATURE = 0.5;
const TYPING_LATENCY_MS = 700;

const K_SELECTED_AGENT_ID = `${SCOPE}:selectedAgentId`;   // string
const K_AGENT_LIST        = `agents`;                     // Agent[]
const K_AGENT_META_PREFIX = `agents:meta:`;               // per-agent tuning (model/temp/rules)
const K_IMPROVE_STATE     = `${SCOPE}:agent:`;            // Improve (chat/history/versions)

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
   STORAGE + UTIL
============================================================================= */
type Store = Awaited<ReturnType<typeof scopedStorage>>;
const now = () => Date.now();
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;

/** Try to map *anything* that looks like an agent into our Agent type. */
function mapAnyToAgent(x: any, idx: number): Agent | null {
  if (!x) return null;
  const id = String(x.id ?? x.agentId ?? x.slug ?? `tmp_${idx}_${Date.now()}`);
  const name = String(x.name ?? x.title ?? `Agent ${idx+1}`);
  const createdAt = Number(x.createdAt ?? x.created_at ?? Date.now());
  const modelRaw = String(x.model ?? x.modelId ?? x.engine ?? 'gpt-4o');
  const model: ModelId = (MODEL_OPTIONS.some(m=>m.value===modelRaw) ? modelRaw : 'gpt-4o') as ModelId;
  const temperature = typeof x.temperature === 'number'
    ? x.temperature
    : typeof x.temp === 'number'
      ? x.temp
      : typeof x.creativity === 'number'
        ? x.creativity
        : DEFAULT_TEMPERATURE;
  return { id, name, createdAt, model, temperature };
}

function normalizeAgents(list: any): Agent[] {
  if (!Array.isArray(list)) return [];
  const out: Agent[] = [];
  list.forEach((x, i) => {
    const a = mapAnyToAgent(x, i);
    if (a) out.push(a);
  });
  // de-dupe by id
  const seen = new Set<string>();
  return out.filter(a => (seen.has(a.id) ? false : (seen.add(a.id), true)));
}

/** Discover agents from common keys and collapse them into `agents`. */
async function loadAgentsFromAny(store: Store): Promise<Agent[]> {
  const candidates = [
    K_AGENT_LIST,
    'chatbots',           // legacy in your guard list
    'builds',             // sometimes used as “agents”
    'assistants',
    'voice:assistants',
  ];
  for (const key of candidates) {
    const raw = await store.getJSON<any>(key, []);
    const list = normalizeAgents(raw);
    if (list.length) {
      // normalize to unified list key
      await store.setJSON(K_AGENT_LIST, list);
      return list;
    }
  }
  return [];
}

function reasonFrom(refs: Refinement[]): string {
  const active = refs.filter(r => r.enabled);
  if (!active.length) return 'No special requests are active—using a default helpful tone.';
  return `Following your active refinements: ${active.slice(0,3).map(r=>r.text).join('; ')}.`;
}

/** Tiny PRNG for variation controlled by temperature. */
function mulberry32(seed: number) { return function() { let t = seed += 0x6D2B79F5; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const pick = <T,>(rng: ()=>number, arr: T[]) => arr[Math.floor(rng() * arr.length)];

/** Generate an answer that varies with temperature, model and rules. */
function synthAnswer(text: string, state: AgentState): string {
  const t = text.trim();
  const temp = clamp01(state.temperature);
  const seed = Math.abs(hashCode(t) ^ Math.floor(temp * 1000) ^ Date.now());
  const rng = mulberry32(seed);

  const active = state.refinements.filter(r=>r.enabled).map(r=>r.text.toLowerCase());
  const wantsYesNo   = active.some(s => /yes\/?no|yes or no/.test(s));
  const wantsOneWord = active.some(s => /one\s*word|1[-\s]*word/.test(s));
  const noGreeting   = active.some(s => /no (greeting|hello)/.test(s));

  const removeRestrictions = active.some(s =>
    /remove (any )?restrictions|no restrictions|uncensored|no filter|any subject|answer anything/i.test(s)
  );

  // If "ask clarifying question first" is active
  const askClarify = active.some(s => /clarifying question first|clarify first/i.test(s));

  // Yes/No / One-word modes
  if (wantsOneWord) return pick(rng, ['Yes', 'Sure', 'Okay', 'Ready']);
  if (wantsYesNo)   return pick(rng, ['Yes.', 'No.', 'Yes – proceeding.', 'No.']);

  // Model style
  const style = (() => {
    switch (state.model) {
      case 'o3':
        return (msg: string) =>
          `${noGreeting ? '' : 'Let’s reason it out.'} ${msg}\n\n` +
          `**Plan**: 1) understand goal 2) propose steps 3) deliver draft.`;
      case 'o3-mini':
        return (msg: string) => `${noGreeting ? '' : 'Quick take:'} ${msg}`;
      case 'gpt-4.1':
        return (msg: string) => `${noGreeting ? '' : 'Here’s a balanced answer:'} ${msg}`;
      case 'gpt-4.1-mini':
        return (msg: string) => `${msg}`;
      case 'gpt-4o':
      case 'gpt-4o-mini':
      default:
        return (msg: string) => `${noGreeting ? '' : 'Got it.'} ${msg}`;
    }
  })();

  // Base variants
  const variants = [
    `Here’s a concise answer. If you want a specific tone or length, add a rule on the left.`,
    `Okay — I’ll answer directly. You can refine with rules any time.`,
    `Sure. I’ll keep it tight. Add “be concise / casual / formal” as needed.`,
  ];

  // If "remove restrictions", we avoid adding extra caveats from the UI.
  const preface = removeRestrictions ? '' : pick(rng, variants);
  const body =
    askClarify
      ? `Before I answer, what’s the exact goal and any constraints (deadline, style, length)?`
      : (t.endsWith('?')
          ? `Here’s the answer you asked for.`
          : `I’ll proceed based on your last message.`);

  // Temperature controls how much fluff we add
  const extras = temp < 0.25
    ? ''
    : temp < 0.6
      ? pick(rng, [
          ` Next, I can outline 3 quick steps.`,
          ` Want a short checklist too?`,
          ` I can also draft a quick version.`,
        ])
      : pick(rng, [
          ` Next options: ① 3-step plan ② 5-bullet summary ③ quick draft — pick one.`,
          ` Preferences? Tone (casual/formal), length (short/medium/long), or target audience.`,
          ` I can also propose multiple approaches and compare trade-offs.`,
        ]);

  return style(`${preface ? preface + ' ' : ''}${body}${extras}`.trim());
}

function hashCode(s: string) {
  let h = 0, i = 0, len = s.length;
  while (i < len) { h = ((h << 5) - h + s.charCodeAt(i++)) | 0; }
  return h | 0;
}

/* =============================================================================
   COMPONENT
============================================================================= */
export default function ImprovePage() {
  const [store, setStore] = useState<Store | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [state, setState] = useState<AgentState | null>(null);

  const [input, setInput] = useState('');
  const [addingRefine, setAddingRefine] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showWhyFor, setShowWhyFor] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Boot
  useEffect(() => {
    (async () => {
      const st = await scopedStorage();
      await st.ensureOwnerGuard();
      await migrateLegacyKeysToUser();
      setStore(st);

      let list = normalizeAgents(await st.getJSON<any[]>(K_AGENT_LIST, []));
      if (!list.length) list = await loadAgentsFromAny(st);

      if (!list.length) {
        list = [{
          id: uid('agent'),
          name: 'My First Agent',
          createdAt: now(),
          model: 'gpt-4o',
          temperature: DEFAULT_TEMPERATURE,
        }];
      }
      await st.setJSON(K_AGENT_LIST, list);
      setAgents(list);

      const savedId = await st.getJSON<string | null>(K_SELECTED_AGENT_ID, null as any);
      const selected = list.find(a => a.id === savedId) ?? [...list].sort((a,b)=>b.createdAt-a.createdAt)[0];
      if (selected) {
        setAgentId(selected.id);
        await hydrateFromAgent(st, selected.id, list);
      }
    })();
  }, []);

  async function hydrateFromAgent(st: Store, id: string, list: Agent[] = agents) {
    const agent = list.find(a => a.id === id);
    if (!agent) return;

    let base: AgentState =
      await st.getJSON<AgentState | null>(K_IMPROVE_STATE + id, null as any) ?? {
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

    const meta = await st.getJSON<AgentMeta | null>(K_AGENT_META_PREFIX + id, null as any);
    if (meta) {
      base.model = meta.model;
      base.temperature = meta.temperature;
      base.refinements = meta.refinements ?? base.refinements;
    }
    if (!MODEL_OPTIONS.some(m => m.value === base.model)) base.model = 'gpt-4o';

    setState(base);
    await st.setJSON(K_IMPROVE_STATE + id, base);
  }

  // Persist Improve state
  useEffect(() => {
    if (!store || !agentId || !state) return;
    store.setJSON(K_IMPROVE_STATE + agentId, state);
  }, [store, agentId, state]);

  // Auto-save tuning to meta + list
  useEffect(() => {
    if (!store || !agentId || !state) return;
    (async () => {
      setIsSaving(true);
      const meta: AgentMeta = {
        model: state.model,
        temperature: state.temperature,
        refinements: state.refinements,
        updatedAt: now(),
      };
      await store.setJSON(K_AGENT_META_PREFIX + agentId, meta);

      const latest = normalizeAgents(await store.getJSON<any[]>(K_AGENT_LIST, []));
      const next = latest.map(a => a.id === agentId ? { ...a, model: state.model, temperature: state.temperature } : a);
      await store.setJSON(K_AGENT_LIST, next);
      setAgents(next);

      setIsSaving(false);
    })();
  }, [store, agentId, state?.model, state?.temperature, JSON.stringify(state?.refinements || [])]);

  // Scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [state?.history.length, isSending]);

  // helpers
  function snapshotCore(st: AgentState) {
    const { model, temperature, refinements, history } = st;
    return { model, temperature, refinements: [...refinements], history: [...history] };
  }
  function pushUndo(ss: ReturnType<typeof snapshotCore>) {
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
  const toggleRefinement = (id: string) => state && setState({
    ...state,
    refinements: state.refinements.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r),
  });
  const deleteRefinement = (id: string) => state && setState({
    ...state,
    refinements: state.refinements.filter(r => r.id !== id),
  });
  const clearRefinements = () => state && setState({ ...state, refinements: [] });

  // Settings
  const changeModel = (m: ModelId) => state && setState({ ...state, model: m });
  const changeTemperature = (t: number) => state && setState({ ...state, temperature: clamp01(t) });

  async function selectAgent(id: string) {
    if (!store) return;
    const a = agents.find(x => x.id === id);
    if (!a) return;
    await store.setJSON(K_SELECTED_AGENT_ID, id);
    setAgentId(id);
    await hydrateFromAgent(store, id);
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

  function createAgent() {
    (async () => {
      if (!store) return;
      const a: Agent = {
        id: uid('agent'),
        name: `Agent ${agents.length + 1}`,
        createdAt: now(),
        model: 'gpt-4o',
        temperature: DEFAULT_TEMPERATURE,
      };
      const next = [...agents, a];
      setAgents(next);
      await store.setJSON(K_AGENT_LIST, next);
      await selectAgent(a.id);

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
      await store.setJSON(K_IMPROVE_STATE + a.id, st);
      setState(st);
    })();
  }

  async function sendMessage() {
    if (!state) return;
    const text = input.trim();
    if (!text) return;

    const userMsg: ChatMessage = { id: uid('m'), role: 'user', content: text, createdAt: now() };
    pushUndo(snapshotCore(state));
    setState({ ...state, history: [...state.history, userMsg] });
    setInput('');
    setIsSending(true);

    // fake latency
    await new Promise(r => setTimeout(r, TYPING_LATENCY_MS));

    // build reply respecting rules + temperature/style
    const reply = synthAnswer(text, state);

    const aiMsg: ChatMessage = {
      id: uid('m'),
      role: 'assistant',
      content: reply,
      reason: reasonFrom(state.refinements),
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
          <div className="flex items-center gap-3">
            <Bot size={20} />
            <span className="font-semibold">Improve</span>
            <span className="opacity-60">/</span>

            <label className="text-sm opacity-70">AI to tune</label>
            <select
              className="rounded-md px-2 py-1 text-sm border bg-transparent"
              style={{ borderColor: 'var(--border)' }}
              value={safeSelectedId}
              onChange={(e) => { const id = e.target.value; if (id && id !== agentId) selectAgent(id); }}
              title="Pick which agent you want to tune"
            >
              {agents.map(a => (<option key={a.id} value={a.id}>{a.name}</option>))}
            </select>

            <button onClick={createAgent} className="px-2 py-1 rounded-md border" style={{ borderColor: 'var(--border)' }}>
              + New
            </button>

            <div className="ml-2 text-xs flex items-center gap-1 opacity-80">
              {isSaving ? (<><Loader2 size={14} className="animate-spin" /> Saving…</>) : (<><Check size={14} /> Saved</>)}
            </div>
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
                  {MODEL_OPTIONS.map(m => (<option key={m.value} value={m.value}>{m.label}</option>))}
                </select>
                <div className="mt-2 text-xs opacity-60">Tuning is auto-saved to this agent (per account).</div>
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
              {[
                'Only answer Yes/No',
                'One word replies',
                'No greeting',
                'Be concise',
                'Ask clarifying question first',
                // the “no extra UI restrictions” switches:
                'Remove any restrictions',
                'Any subject is open',
              ].map(t => (
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
              <li>Choose **AI to tune** from the top bar — changes auto-save to that agent.</li>
              <li>“Send” both saves and re-runs with your latest rules.</li>
              <li>“Remove any restrictions / Any subject is open” disables extra UI guardrails (your model/provider may still enforce theirs).</li>
            </ul>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="rounded-xl flex flex-col border"
             style={{ borderColor: 'var(--border)', background: 'var(--panel)', boxShadow: 'var(--shadow-soft)', minHeight: 560 }}>
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

      {showWhyFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.5)' }}>
          <div className="w-[520px] max-w-[92vw] rounded-xl p-4 border"
               style={{ background: 'var(--panel)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-soft)' }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><Info size={16} /> Why this reply?</div>
              <button onClick={() => setShowWhyFor(null)} className="opacity-60 hover:opacity-100"><X size={16} /></button>
            </div>
            <div className="mt-3 text-sm leading-relaxed">{reasonFrom(state.refinements)}</div>
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
