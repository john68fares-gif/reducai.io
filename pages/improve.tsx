// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, Copy, History, Info, Loader2, Plus, Send, Settings2,
  Sparkles, Trash2, Undo2, Redo2, ChevronDown, ChevronUp, HelpCircle, X,
  RefreshCw, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client'; // used only to get current user id

/* =============================================================================
   CONSTANTS / KEYS
============================================================================= */
const SCOPE = 'improve';
const MAX_REFINEMENTS = 5;
const DEFAULT_TEMPERATURE = 0.5;

/* =============================================================================
   TYPES
============================================================================= */
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

type Agent = { id: string; name: string; createdAt: number; model: ModelId; temperature: number };
type Refinement = { id: string; text: string; enabled: boolean; createdAt: number };
type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number };

type AgentState = {
  model: ModelId;
  temperature: number;
  refinements: Refinement[];
  history: ChatMessage[];
};

const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;
const now = () => Date.now();

async function apiList(userId: string): Promise<Agent[]> {
  const r = await fetch(`/api/chatbots?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
  if (!r.ok) return [];
  const json = await r.json();
  const rows = Array.isArray(json?.data) ? json.data : [];
  return rows.map((a: any) => ({
    id: a.id, name: a.name, createdAt: a.createdAt,
    model: (a.model as ModelId) ?? 'gpt-4o-mini',
    temperature: typeof a.temperature === 'number' ? a.temperature : DEFAULT_TEMPERATURE
  }));
}

async function apiPatch(userId: string, id: string, payload: Partial<{ model: string; temperature: number }>) {
  await fetch(`/api/chatbots/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, ...payload })
  });
}

async function chatProxy(payload: {
  model: string; temperature: number; system: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
}) {
  const r = await fetch('/api/improve/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) throw new Error(await r.text().catch(()=>`HTTP ${r.status}`));
  return await r.json();
}

/* =============================================================================
   PAGE
============================================================================= */
export default function ImprovePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [state, setState] = useState<AgentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [addingRefine, setAddingRefine] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1) fetch current user id
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    })();
  }, []);

  // 2) list assistants for this user
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoading(true);
      const list = await apiList(userId);
      setAgents(list);
      setLoading(false);

      if (list.length) {
        setAgentId(list[0].id);
        hydrate(list[0]);
      } else {
        setAgentId(null);
        setState(null);
      }
    })();
  }, [userId]);

  function hydrate(a: Agent) {
    setState({
      model: a.model,
      temperature: a.temperature ?? DEFAULT_TEMPERATURE,
      refinements: [],
      history: [{ id: uid('sys'), role: 'system', content: 'This is the Improve panel. Your agent will reply based on the active refinements.', createdAt: now() }]
    });
  }

  async function onSelect(id: string) {
    setAgentId(id);
    const a = agents.find(x => x.id === id);
    if (a) hydrate(a);
  }

  // 3) persist model/temperature to the assistant (per account)
  useEffect(() => {
    if (!userId || !agentId || !state) return;
    const t = setTimeout(async () => {
      setSaving(true);
      try {
        await apiPatch(userId, agentId, {
          model: state.model,
          temperature: state.temperature
        });
      } finally {
        setSaving(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [userId, agentId, state?.model, state?.temperature]);

  // chat send
  async function send() {
    if (!state) return;
    const inputEl = document.getElementById('improve-input') as HTMLInputElement | null;
    const text = inputEl?.value?.trim() || '';
    if (!text) return;

    const userMsg: ChatMessage = { id: uid('m'), role: 'user', content: text, createdAt: now() };
    setState({ ...state, history: [...state.history, userMsg] });
    if (inputEl) inputEl.value = '';
    setIsSending(true);

    try {
      const sys = buildSystem(state.refinements);
      const msgs = [...state.history, userMsg]
        .filter(m => m.role !== 'system')
        .slice(-20)
        .map(m => ({ role: m.role === 'assistant' ? 'assistant' as const : 'user' as const, content: m.content }));

      const out = await chatProxy({
        model: state.model,
        temperature: state.temperature,
        system: sys,
        messages: msgs
      });

      const ai: ChatMessage = { id: uid('m'), role: 'assistant', content: out?.content || '(no reply)', createdAt: now() };
      setState(prev => prev ? { ...prev, history: [...prev.history, ai] } : prev);
    } catch (e: any) {
      const ai: ChatMessage = { id: uid('m'), role: 'assistant', content: `(Error) ${e?.message || 'failed'}`, createdAt: now() };
      setState(prev => prev ? { ...prev, history: [...prev.history, ai] } : prev);
    } finally {
      setIsSending(false);
      setTimeout(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, 0);
    }
  }

  function buildSystem(refs: Refinement[]) {
    const active = refs.filter(r => r.enabled).map(r => r.text).join('; ');
    return [
      `You are a helpful assistant.`,
      active ? `Active refinements: ${active}.` : ''
    ].filter(Boolean).join('\n\n');
  }

  // UI
  if (!userId) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div>Please sign in to use Improve.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Loading…</div>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="text-center">
          <div className="text-lg font-semibold">No agents yet</div>
          <div className="opacity-70 text-sm">Create an AI in the Builder first (this list only shows agents that belong to <b>your</b> account).</div>
          <a href="/builder" className="inline-block mt-3 px-4 py-2 rounded-md border" style={{ borderColor: 'var(--border)' }}>Go to Builder</a>
        </div>
      </div>
    );
  }

  const selected = agents.find(a => a.id === agentId)!;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 backdrop-blur-sm border-b" style={{ background:'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor:'var(--border)' }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20}/><span className="font-semibold">Improve</span><span className="opacity-60">/</span>
            <AgentPicker agents={agents} selectedId={selected.id} onSelect={onSelect} onRefresh={async ()=>{
              const list = await apiList(userId);
              setAgents(list);
              if (!list.find(a=>a.id===agentId)) {
                setAgentId(list[0]?.id || null);
                if (list[0]) hydrate(list[0]);
              }
            }} />
            <div className="ml-2 text-xs flex items-center gap-1 opacity-80">
              {saving ? (<><Loader2 size={14} className="animate-spin"/> Saving…</>) : (<><Check size={14}/> Saved</>)}
            </div>
          </div>

          <button onClick={()=>setShowSettings(v=>!v)} className="px-2 py-1 rounded-md border flex items-center gap-2" style={{borderColor:'var(--border)'}}>
            <Settings2 size={16}/> Settings {showSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/> }
          </button>
        </div>

        {showSettings && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Model (applies to <b>{selected.name}</b>)</div>
                <select className="w-full rounded-md px-2 py-2 border bg-transparent" style={{borderColor:'var(--border)'}}
                        value={state?.model} onChange={e=>state && setState({...state, model: e.target.value as ModelId})}>
                  {MODEL_OPTIONS.map(m=> <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Creativity (Temperature)</div>
                <input type="range" min={0} max={1} step={0.05} value={state?.temperature ?? 0.5}
                       onChange={e=>state && setState({...state, temperature: parseFloat(e.target.value)})} className="w-full"/>
                <div className="text-xs opacity-60 mt-1">{state?.temperature.toFixed(2)}</div>
              </div>

              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Quick rules</div>
                <div className="flex flex-wrap gap-2">
                  {['Be concise','No greeting','Only answer Yes/No','One word replies'].map(t=>(
                    <button key={t} onClick={()=> addRule(t)} className="text-xs px-2 py-1 rounded-full border" style={{borderColor:'var(--border)',background:'var(--card)'}}>{t}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 grid lg:grid-cols-[420px,1fr] gap-6">
        {/* Left: rules */}
        <div className="rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
          <div className="flex items-center justify-between">
            <div className="font-semibold">Your Refinements</div>
            <span className="text-xs opacity-60">{state?.refinements.length ?? 0}/{MAX_REFINEMENTS}</span>
          </div>

          <div className="mt-3 flex gap-2">
            <input id="rule-input" className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent" style={{borderColor:'var(--border)'}}
                   placeholder='Add a rule (e.g., "Only answer Yes/No")'
                   value={addingRefine} onChange={e=>setAddingRefine(e.target.value)}
                   onKeyDown={e=>{ if(e.key==='Enter') addRule(); }}/>
            <button onClick={()=>addRule()} className="px-3 py-2 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}><Plus size={16}/> Add</button>
          </div>

          <div className="mt-4 space-y-2">
            {state?.refinements.map(r=>(
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 border" style={{borderColor:'var(--border)',background:'var(--card)'}}>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={r.enabled} onChange={()=>toggleRule(r.id)} className="w-4 h-4" />
                  <span className="text-sm">{r.text}</span>
                </label>
                <button onClick={()=>removeRule(r.id)} className="opacity-60 hover:opacity-100" title="Remove"><X size={16}/></button>
              </div>
            ))}
          </div>
        </div>

        {/* Right: chat */}
        <div className="rounded-xl flex flex-col border" style={{borderColor:'var(--border)',background:'var(--panel)',minHeight:560}}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {state?.history.map(msg=>(
              <div key={msg.id} className={`max-w-[80%] ${msg.role==='user'?'ml-auto':''}`}>
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background:msg.role==='user'?'var(--card)':'var(--panel)'}}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2">
              <input id="improve-input" className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent" style={{borderColor:'var(--border)'}}
                     placeholder="Type your message…" onKeyDown={e=>{ if(e.key==='Enter') send(); }}/>
              <button onClick={send} disabled={isSending} className="px-3 py-2 rounded-md flex items-center gap-2 border disabled:opacity-60" style={{borderColor:'var(--border)'}}>
                {isSending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  function addRule(text?: string) {
    const t = (text ?? addingRefine).trim();
    if (!t || !state) return;
    if (state.refinements.length >= MAX_REFINEMENTS) return;
    setState({ ...state, refinements: [{ id: uid('ref'), text: t, enabled: true, createdAt: now() }, ...state.refinements] });
    setAddingRefine('');
  }
  function toggleRule(id: string) {
    if (!state) return;
    setState({ ...state, refinements: state.refinements.map(r=> r.id===id ? { ...r, enabled: !r.enabled } : r) });
  }
  function removeRule(id: string) {
    if (!state) return;
    setState({ ...state, refinements: state.refinements.filter(r=> r.id!==id) });
  }
}

/* ---------------- Agent Picker ---------------- */
function AgentPicker({
  agents, selectedId, onSelect, onRefresh
}:{
  agents: Agent[]; selectedId: string; onSelect: (id:string)=>void; onRefresh: ()=>void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const onDoc = (e: MouseEvent) => { if(!wrapRef.current) return; if(!wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  },[]);

  const selected = agents.find(a => a.id===selectedId);
  const filtered = agents.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <button onClick={()=>setOpen(v=>!v)} className="px-2.5 py-1.5 rounded-md border inline-flex items-center gap-2 text-sm" style={{borderColor:'var(--border)',background:'var(--card)'}}>
        <span className="truncate max-w-[180px]">{selected?.name ?? 'Choose agent'}</span>
        <ChevronDown size={14}/>
      </button>

      {open && (
        <div className="absolute mt-2 w-[280px] rounded-lg border shadow-lg z-20" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
          <div className="p-2 border-b" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2">
              <Search size={14} className="opacity-70"/>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search agents…" className="flex-1 bg-transparent outline-none text-sm"/>
              <button onClick={onRefresh} className="px-2 py-1 rounded-md border text-xs inline-flex items-center gap-1" style={{borderColor:'var(--border)'}}><RefreshCw size={12}/>Sync</button>
            </div>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.map(a=>(
              <button key={a.id} onClick={()=>{ onSelect(a.id); setOpen(false); }} className={`w-full text-left px-3 py-2 text-sm border-b ${a.id===selectedId?'opacity-100':'opacity-90'}`} style={{borderColor:'var(--border)'}} title={a.name}>
                <div className="flex items-center justify-between"><span className="truncate">{a.name}</span>{a.id===selectedId && <Check size={14}/>}</div>
                <div className="text-xs opacity-60 mt-0.5">{a.model} • {new Date(a.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-6 text-sm opacity-70">No agents found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
