// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, ChevronDown, ChevronUp, Copy, History, Info, Loader2, Plus, Redo2,
  RefreshCw, Search, Send, Settings2, Trash2, Undo2, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/** ────────────────────────────────────────────────────────────────────────────
 * Types / constants
 * ─────────────────────────────────────────────────────────────────────────── */
type ModelId =
  | 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3' | 'o3-mini';

const MODEL_OPTIONS: Array<{ value: ModelId; label: string }> = [
  { value: 'gpt-4o',       label: 'GPT-4o' },
  { value: 'gpt-4o-mini',  label: 'GPT-4o mini' },
  { value: 'gpt-4.1',      label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'o3',           label: 'o3 (reasoning)' },
  { value: 'o3-mini',      label: 'o3-mini (reasoning, fast)' },
];

type Agent = {
  id: string;
  name: string;
  model: ModelId;
  temperature: number;
  createdAt: number;
};

type Refinement = { id: string; text: string; enabled: boolean };
type ChatMsg   = { id: string; role: 'user' | 'assistant'; content: string };

const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-3)}`;
const clamp01 = (n:number)=>Math.max(0,Math.min(1,n));

/** ────────────────────────────────────────────────────────────────────────────
 * API helpers (always send x-user-id)
 * ─────────────────────────────────────────────────────────────────────────── */
async function fetchAgents(userId: string): Promise<Agent[]> {
  const res = await fetch('/api/chatbots', {
    method: 'GET',
    headers: { 'x-user-id': userId },
    cache: 'no-store',
  });
  if (!res.ok) return [];
  const list = await res.json();
  // Normalize to Agent shape
  return (Array.isArray(list) ? list : []).map((a: any): Agent => ({
    id: String(a.id),
    name: String(a.name ?? 'Untitled Agent'),
    createdAt: Number(a.createdAt ?? Date.now()),
    model: (MODEL_OPTIONS.some(m => m.value === a.model) ? a.model : 'gpt-4o') as ModelId,
    temperature: typeof a.temperature === 'number' ? a.temperature : 0.5,
  }));
}

async function patchAgent(userId: string, id: string, data: Partial<Pick<Agent,'model'|'temperature'>> & { prompt?: string }) {
  const res = await fetch(`/api/chatbots/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-user-id': userId },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const text = await res.text().catch(()=>'');
    throw new Error(text || `Failed to save (${res.status})`);
  }
  return await res.json();
}

async function chatRelay(payload:{
  agentId: string;
  model: ModelId;
  temperature: number;
  system: string;
  messages: Array<{ role: 'user'|'assistant'; content: string }>;
}) {
  const res = await fetch('/api/improve/chat', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ ...payload, guardLevel: 'lenient' as const })
  });
  if(!res.ok){
    const t = await res.text().catch(()=>String(res.status));
    throw new Error(t || `HTTP ${res.status}`);
  }
  return await res.json() as { content: string; modelUsed: string; finish_reason?: string };
}

/** ────────────────────────────────────────────────────────────────────────────
 * Page
 * ─────────────────────────────────────────────────────────────────────────── */
export default function ImprovePage() {
  const [userId, setUserId] = useState<string | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => agents.find(a => a.id === selectedId) || null, [agents, selectedId]);

  // local tuning state per session (not persisted — the PATCH saves model/temp on the assistant)
  const [model, setModel] = useState<ModelId>('gpt-4o');
  const [temperature, setTemperature] = useState<number>(0.5);
  const [refinements, setRefinements] = useState<Refinement[]>([]);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<ChatMsg[]>([
    { id: uid('sys'), role: 'assistant', content: 'This is the Improve panel. Your agent will reply based on the active refinements.' }
  ]);

  const [loadingAgents, setLoadingAgents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [openSettings, setOpenSettings] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // read current user once
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || null);
    })();
  }, []);

  // load agents when userId is ready
  useEffect(() => {
    if (!userId) return;
    (async () => {
      setLoadingAgents(true);
      try {
        const list = await fetchAgents(userId);
        setAgents(list);
        if (list.length) {
          const first = list[0];
          setSelectedId(first.id);
          setModel(first.model);
          setTemperature(first.temperature);
        } else {
          setSelectedId(null);
        }
      } finally {
        setLoadingAgents(false);
      }
    })();
  }, [userId]);

  // auto-scroll chat
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [history, sending]);

  // debounced save when model/temperature changes
  useEffect(() => {
    if (!userId || !selected) return;
    const to = setTimeout(async () => {
      setSaving(true);
      try {
        await patchAgent(userId, selected.id, { model, temperature });
      } catch (e) {
        console.warn('Save failed:', e);
      } finally {
        setSaving(false);
      }
    }, 450);
    return () => clearTimeout(to);
  }, [userId, selected?.id, model, temperature]);

  const filteredAgents = useMemo(
    () => agents.filter(a => a.name.toLowerCase().includes(query.toLowerCase())),
    [agents, query]
  );

  function addRef(text: string) {
    if (!text.trim()) return;
    setRefinements(prev => [{ id: uid('ref'), text: text.trim(), enabled: true }, ...prev].slice(0,5));
  }
  function toggleRef(id: string) {
    setRefinements(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }
  function delRef(id: string) {
    setRefinements(prev => prev.filter(r => r.id !== id));
  }
  function clearRefs() { setRefinements([]); }

  const activeRefText = useMemo(() => {
    const on = refinements.filter(r => r.enabled).map(r => r.text);
    return on.length ? `Active refinements: ${on.join('; ')}.` : '';
  }, [refinements]);

  async function doSync() {
    if (!userId) return;
    setLoadingAgents(true);
    try {
      const list = await fetchAgents(userId);
      setAgents(list);
      // keep current selection if it still exists
      if (selectedId && list.some(a => a.id === selectedId)) return;
      if (list.length) {
        setSelectedId(list[0].id);
        setModel(list[0].model);
        setTemperature(list[0].temperature);
      } else {
        setSelectedId(null);
      }
    } finally {
      setLoadingAgents(false);
    }
  }

  async function send() {
    if (!selected || !input.trim()) return;
    const text = input.trim();
    setInput('');
    const userMsg: ChatMsg = { id: uid('m'), role: 'user', content: text };
    setHistory(prev => [...prev, userMsg]);
    setSending(true);
    try {
      const sys = [
        `You are ${selected.name}, a helpful assistant.`,
        activeRefText || undefined
      ].filter(Boolean).join('\n\n');

      const msgs = [...history, userMsg]
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .slice(-20)
        .map(({role, content}) => ({ role, content }));

      const out = await chatRelay({
        agentId: selected.id,
        model,
        temperature,
        system: sys,
        messages: msgs,
      });

      const ai: ChatMsg = { id: uid('m'), role: 'assistant', content: out.content || '(no content)' };
      setHistory(prev => [...prev, ai]);
    } catch (e: any) {
      const ai: ChatMsg = { id: uid('m'), role: 'assistant', content: `(error) ${e?.message || 'failed'}` };
      setHistory(prev => [...prev, ai]);
    } finally {
      setSending(false);
    }
  }

  async function copyLast() {
    const last = [...history].reverse().find(m => m.role === 'assistant');
    if (!last) return;
    try {
      await navigator.clipboard.writeText(last.content);
    } catch {}
  }

  // Empty states
  if (!userId) {
    return (
      <div className="min-h-screen grid place-items-center" style={{background:'var(--bg)', color:'var(--text)'}}>
        <div className="flex items-center gap-3 opacity-80">
          <Loader2 className="animate-spin" /> Getting your account…
        </div>
      </div>
    );
  }

  if (!loadingAgents && agents.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center" style={{background:'var(--bg)', color:'var(--text)'}}>
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">No agents yet</div>
          <div className="opacity-70 text-sm max-w-[420px]">
            Create an AI in the Builder first (this list only shows agents that belong to <strong>your</strong> account).
          </div>
          <a href="/builder" className="inline-block px-4 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>Go to Builder</a>
        </div>
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="min-h-screen grid place-items-center" style={{background:'var(--bg)', color:'var(--text)'}}>
        <div className="flex items-center gap-3 opacity-80">
          <Loader2 className="animate-spin" /> Loading…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Top rail */}
      <div className="sticky top-0 z-30 backdrop-blur-sm border-b" style={{ background:'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor:'var(--border)' }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={18}/><span className="font-semibold">Improve</span><span className="opacity-60">/</span>
            {/* Picker */}
            <div className="relative">
              <button
                onClick={()=>setPickerOpen(v=>!v)}
                className="px-2.5 py-1.5 rounded-md border inline-flex items-center gap-2 text-sm"
                style={{borderColor:'var(--border)',background:'var(--card)'}}
                title="Choose AI"
              >
                <span className="truncate max-w-[200px]">{selected?.name}</span>
                <ChevronDown size={14}/>
              </button>
              {pickerOpen && (
                <div className="absolute mt-2 w-[300px] rounded-lg border shadow-lg z-20"
                     style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)'}}>
                  <div className="p-2 border-b" style={{borderColor:'var(--border)'}}>
                    <div className="flex items-center gap-2">
                      <Search size={14} className="opacity-70"/>
                      <input
                        value={query}
                        onChange={(e)=>setQuery(e.target.value)}
                        placeholder="Search agents…"
                        className="flex-1 bg-transparent outline-none text-sm"
                      />
                      <button onClick={doSync} className="px-2 py-1 rounded-md border text-xs inline-flex items-center gap-1"
                              style={{borderColor:'var(--border)'}}
                              title="Refresh your agents">
                        {loadingAgents ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
                        Sync
                      </button>
                    </div>
                  </div>
                  <div className="max-h-[280px] overflow-y-auto">
                    {filteredAgents.map(a=>(
                      <button
                        key={a.id}
                        onClick={()=>{ setSelectedId(a.id); setModel(a.model); setTemperature(a.temperature); setPickerOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm border-b hover:opacity-100 transition ${a.id===selected.id?'opacity-100':'opacity-90'}`}
                        style={{borderColor:'var(--border)'}}
                        title={a.name}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate">{a.name}</span>
                          {a.id===selected.id && <Check size={14}/>}
                        </div>
                        <div className="text-xs opacity-60 mt-0.5">
                          {a.model} • {new Date(a.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                    {!filteredAgents.length && <div className="px-3 py-6 text-sm opacity-70">No agents for your account.</div>}
                  </div>
                </div>
              )}
            </div>
            <div className="ml-2 text-xs flex items-center gap-1 opacity-80">
              {saving ? (<><Loader2 size={14} className="animate-spin"/> Saving…</>) : (<><Check size={14}/> Saved</>)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-2 py-1 rounded-md border" style={{borderColor:'var(--border)'}} title="Undo (local)">
              <Undo2 size={16}/>
            </button>
            <button className="px-2 py-1 rounded-md border" style={{borderColor:'var(--border)'}} title="Redo (local)">
              <Redo2 size={16}/>
            </button>
            <button onClick={()=>setOpenSettings(v=>!v)} className="px-2 py-1 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}>
              <Settings2 size={16}/> Settings {openSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/> }
            </button>
          </div>
        </div>

        {openSettings && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Model <span className="opacity-60">(applies to <strong>{selected.name}</strong>)</span></div>
                <select className="w-full rounded-md px-2 py-2 border bg-transparent" style={{borderColor:'var(--border)'}}
                        value={model} onChange={e=>setModel(e.target.value as ModelId)}>
                  {MODEL_OPTIONS.map(m=> <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <div className="mt-2 text-xs opacity-60">Saved per agent (account-scoped).</div>
              </div>

              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Creativity (temperature)</div>
                <input type="range" min={0} max={1} step={0.05} value={temperature}
                       onChange={e=>setTemperature(clamp01(parseFloat(e.target.value)))} className="w-full"/>
                <div className="text-xs opacity-60 mt-1">{temperature.toFixed(2)}</div>
              </div>

              <div className="rounded-lg p-3 flex items-center justify-between gap-2 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <button className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} onClick={()=>setHistory(h=>[{id:uid('ver'),role:'assistant',content:`Snapshot saved (${new Date().toLocaleString()})`},...h])}>
                  <History size={16}/> Save Version
                </button>
                <button onClick={copyLast} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
                  <Copy size={16}/> Copy Reply
                </button>
                <button onClick={clearRefs} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
                  <Trash2 size={16}/> Clear Rules
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 grid lg:grid-cols-[420px,1fr] gap-6">
        {/* Left: Refinements */}
        <div>
          <div className="rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)'}}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Your Refinements</div>
              <span className="text-xs opacity-60">{refinements.length}/5</span>
            </div>

            <AddRule onAdd={addRef}/>

            <div className="mt-4 space-y-2">
              {refinements.map(ref=>(
                <div key={ref.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 border" style={{borderColor:'var(--border)',background:'var(--card)'}}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ref.enabled} onChange={()=>toggleRef(ref.id)} className="w-4 h-4" style={{accentColor:'var(--brand)'}}/>
                    <span className="text-sm">{ref.text}</span>
                  </label>
                  <button onClick={()=>delRef(ref.id)} className="opacity-60 hover:opacity-100" title="Remove"><X size={16}/></button>
                </div>
              ))}
              {!refinements.length && <div className="text-sm opacity-60">Add up to 5 short rules. Tick to enable/disable each rule.</div>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['Only answer Yes/No','One word replies','No greeting','Be concise','Ask clarifying question first','Any subject is open'].map(t=>(
                <button key={t} onClick={()=>addRef(t)} className="text-xs px-2 py-1 rounded-full border" style={{borderColor:'var(--border)',background:'var(--card)'}}>{t}</button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
            <div className="flex items-center gap-2 font-semibold"><Info size={16}/> Tips</div>
            <ul className="mt-2 text-sm opacity-80 list-disc pl-5 space-y-1">
              <li>The dropdown only shows agents that belong to <strong>your</strong> account.</li>
              <li>Changes to model & temperature auto-save to that agent.</li>
              <li>Use rules to quickly shift tone/structure without editing your main prompt.</li>
            </ul>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="rounded-xl flex flex-col border" style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)',minHeight:560}}>
          <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.map(m=>(
              <div key={m.id} className={`max-w-[80%] ${m.role==='user'?'ml-auto':''}`}>
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background:m.role==='user'?'var(--card)':'var(--panel)'}}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              </div>
            ))}
            {sending && (
              <div className="max-w-[80%]">
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{background:'currentColor',animationDelay:'0ms'}}/>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{background:'currentColor',animationDelay:'120ms'}}/>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{background:'currentColor',animationDelay:'240ms'}}/>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent"
                style={{borderColor:'var(--border)'}}
                placeholder="Type your message…"
                value={input}
                onChange={e=>setInput(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') send(); }}
              />
              <button onClick={send} disabled={sending} className="px-3 py-2 rounded-md flex items-center gap-2 border disabled:opacity-60" style={{borderColor:'var(--border)'}}>
                {sending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ────────────────────────────────────────────────────────────────────────────
 * Small sub-components
 * ─────────────────────────────────────────────────────────────────────────── */
function AddRule({ onAdd }:{ onAdd:(text:string)=>void }) {
  const [val,setVal] = useState('');
  return (
    <div className="mt-3 flex gap-2">
      <input
        className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent"
        style={{borderColor:'var(--border)'}}
        placeholder='Add a rule (e.g., “Only answer Yes/No”)'
        value={val}
        onChange={e=>setVal(e.target.value)}
        onKeyDown={e=>{ if(e.key==='Enter'){ onAdd(val); setVal(''); } }}
      />
      <button onClick={()=>{ onAdd(val); setVal(''); }} className="px-3 py-2 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}>
        <Plus size={16}/> Add
      </button>
    </div>
  );
}
