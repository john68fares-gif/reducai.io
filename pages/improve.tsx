// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, Copy, History, Info, Loader2, Plus, Send, Settings2,
  Trash2, Undo2, Redo2, ChevronDown, ChevronUp, HelpCircle, X,
  RefreshCw, Search
} from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

/* =============================================================================
   CONSTANTS / KEYS
============================================================================= */
const SCOPE = 'improve';
const MAX_REFINEMENTS = 5;
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

type Agent = { id: string; name: string; createdAt: number; model: ModelId; temperature?: number; };
type Refinement = { id: string; text: string; enabled: boolean; createdAt: number; };
type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string; createdAt: number; };
type AgentState = {
  model: ModelId; temperature: number; refinements: Refinement[];
  history: ChatMessage[];
};

/* =============================================================================
   SMALL UTILS
============================================================================= */
const now = () => Date.now();
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;
const clamp01 = (n:number)=>Math.max(0,Math.min(1,n));

function reasonFrom(refs:Refinement[]):string{
  const active=refs.filter(r=>r.enabled);
  if(!active.length) return 'No active rules.';
  return `Active rules: ${active.slice(0,3).map(r=>r.text).join('; ')}.`;
}

function mapAnyToAgent(x:any):Agent|null{
  if(!x || !x.id) return null;
  const modelRaw = String(x.model ?? 'gpt-4o');
  const model = (MODEL_OPTIONS.some(m => m.value === modelRaw) ? modelRaw : 'gpt-4o') as ModelId;
  return {
    id: String(x.id),
    name: String(x.name ?? 'Untitled Agent'),
    createdAt: Number(x.createdAt ?? Date.now()),
    model,
    temperature: typeof x.temperature === 'number' ? x.temperature : undefined,
  };
}

/* =============================================================================
   API HELPERS
============================================================================= */

// Supabase → current user id (authoritative owner id)
async function getOwnerId(): Promise<string|null> {
  const { data } = await supabase.auth.getUser();
  return data?.user?.id ?? null;
}

async function fetchUserAgents(ownerId:string): Promise<Agent[]> {
  try{
    const qs = `?ownerId=${encodeURIComponent(ownerId)}`;
    const res = await fetch(`/api/chatbots${qs}`, {
      method:'GET',
      cache:'no-store',
      headers: { 'x-owner-id': ownerId }
    });
    if(!res.ok) return [];
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    return (arr.map(mapAnyToAgent).filter(Boolean) as Agent[]).sort((a,b)=>b.createdAt-a.createdAt);
  }catch{ return []; }
}

async function patchAgent(id:string, ownerId:string, patch:Partial<{model:ModelId;temperature:number;name:string;instructions:string}>) {
  await fetch(`/api/chatbots/${id}`, {
    method:'PATCH',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ ...patch, ownerId })
  });
}

async function composeAndChat(agentId:string, state:AgentState, ownerId:string, userMsg:string){
  const system = [
    `You are a helpful assistant.`,
    state.refinements.filter(r=>r.enabled).length
      ? `Active refinements: ${state.refinements.filter(r=>r.enabled).map(r=>r.text).join('; ')}.`
      : null
  ].filter(Boolean).join('\n\n');

  const msgs = [...state.history, { id: uid('m'), role:'user' as const, content:userMsg, createdAt: now() }]
    .filter(m=>m.role!=='system')
    .slice(-20)
    .map(m=>({ role: m.role==='assistant'?'assistant':'user', content: m.content }));

  const r = await fetch('/api/improve/chat', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({
      agentId,
      model: state.model,
      temperature: state.temperature,
      system,
      messages: msgs,
      guardLevel: state.refinements.some(r=>r.enabled && /remove (any )?restrictions|uncensored/i.test(r.text)) ? 'provider-only' : 'lenient'
    })
  });
  if(!r.ok){ throw new Error(await r.text().catch(()=>`HTTP ${r.status}`)); }
  return r.json() as Promise<{content:string; modelUsed:string; finish_reason?:string;}>;
}

/* =============================================================================
   MAIN
============================================================================= */
export default function ImprovePage(){
  const [ownerId,setOwnerId] = useState<string|null>(null);
  const [agents,setAgents]=useState<Agent[]>([]);
  const [agentId,setAgentId]=useState<string>('');
  const [state,setState]=useState<AgentState|null>(null);

  const [input,setInput]=useState('');
  const [addingRefine,setAddingRefine]=useState('');
  const [isSending,setIsSending]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [isSaving,setIsSaving]=useState(false);
  const [isRefreshing,setIsRefreshing]=useState(false);

  const scrollRef=useRef<HTMLDivElement>(null);

  // boot
  useEffect(()=>{(async()=>{
    const uid = await getOwnerId();
    setOwnerId(uid);
    if(!uid) return;

    const list = await fetchUserAgents(uid);
    setAgents(list);

    if(list.length){
      setAgentId(list[0].id);
      const a = list[0];
      setState({
        model: a.model,
        temperature: typeof a.temperature==='number' ? a.temperature : DEFAULT_TEMPERATURE,
        refinements: [],
        history: [{ id: uid2(), role:'system', content:'This is the Improve panel. Your agent will reply based on the active refinements.', createdAt: now() }]
      });
    }
  })();},[]);

  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; },[state?.history.length,isSending]);

  function uid2(){ return uid('m'); }

  // persistence to assistant (model & temperature)
  useEffect(()=>{
    if(!ownerId || !agentId || !state) return;
    const to = setTimeout(async ()=>{
      try{
        setIsSaving(true);
        await patchAgent(agentId, ownerId, { model: state.model, temperature: state.temperature });
        // reflect also in dropdown list
        setAgents(prev => prev.map(a => a.id===agentId ? { ...a, model: state.model, temperature: state.temperature } : a));
      } finally {
        setIsSaving(false);
      }
    }, 500);
    return ()=>clearTimeout(to);
  },[ownerId, agentId, state?.model, state?.temperature]);

  if(!ownerId){
    return (
      <div className="min-h-screen grid place-items-center" style={{background:'var(--bg)',color:'var(--text)'}}>
        <div className="flex items-center gap-2 opacity-80">
          <Loader2 className="animate-spin"/><span>Checking session…</span>
        </div>
      </div>
    );
  }

  if(agents.length===0){
    return (
      <div className="min-h-screen grid place-items-center" style={{background:'var(--bg)',color:'var(--text)'}}>
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">No agents yet</div>
          <div className="opacity-70 text-sm">Create an agent in the Builder. We only show bots saved by your account.</div>
          <a href="/builder" className="inline-block px-4 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>Go to Builder</a>
        </div>
      </div>
    );
  }

  const selectedAgent = agents.find(a=>a.id===agentId)!;

  async function refreshAgents(){
    if(!ownerId) return;
    setIsRefreshing(true);
    try{
      const list = await fetchUserAgents(ownerId);
      setAgents(list);
      if(!list.find(a=>a.id===agentId) && list.length){
        setAgentId(list[0].id);
        const a=list[0];
        setState(s=>s?{...s, model:a.model, temperature:a.temperature ?? DEFAULT_TEMPERATURE }:s);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  function addRule(){
    if(!state) return;
    const t = addingRefine.trim(); if(!t) return;
    const ref:Refinement={id:uid('ref'),text:t,enabled:true,createdAt:now()};
    setState({...state,refinements:[ref,...state.refinements].slice(0,MAX_REFINEMENTS)});
    setAddingRefine('');
  }
  const toggleRef=(id:string)=>state&&setState({...state,refinements:state.refinements.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)});
  const delRef=(id:string)=>state&&setState({...state,refinements:state.refinements.filter(r=>r.id!==id)});
  const clearRefs=()=>state&&setState({...state,refinements:[]});
  const changeModel=(m:ModelId)=>state&&setState({...state,model:m});
  const changeTemperature=(t:number)=>state&&setState({...state,temperature:clamp01(t)});

  async function send(){
    if(!state || !agentId || !input.trim()) return;
    const text = input.trim();
    setInput('');
    const userMsg:ChatMessage={id:uid2(),role:'user',content:text,createdAt:now()};
    setState({...state,history:[...state.history,userMsg]});
    setIsSending(true);
    try{
      const res = await composeAndChat(agentId, state, ownerId!, text);
      const aiMsg:ChatMessage={id:uid2(),role:'assistant',content:res.content,createdAt:now()};
      setState(prev=>prev?{...prev,history:[...prev.history,aiMsg]}:prev);
    }catch(e:any){
      const aiMsg:ChatMessage={id:uid2(),role:'assistant',content:`(Error) ${e?.message||'Failed.'}`,createdAt:now()};
      setState(prev=>prev?{...prev,history:[...prev.history,aiMsg]}:prev);
    }finally{
      setIsSending(false);
    }
  }

  return (
    <div className={`${SCOPE} min-h-screen font-sans`} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 backdrop-blur-sm border-b" style={{ background:'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor:'var(--border)' }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20}/><span className="font-semibold">Improve</span><span className="opacity-60">/</span>
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-70">AI to tune</span>
              <AgentPicker
                agents={agents}
                selectedId={selectedAgent.id}
                onSelect={(id)=>setAgentId(id)}
                onRefresh={refreshAgents}
                isRefreshing={isRefreshing}
              />
              <div className="ml-1 text-xs flex items-center gap-1 opacity-80">
                {isSaving ? (<><Loader2 size={14} className="animate-spin"/> Saving…</>) : (<><Check size={14}/> Saved</>)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={()=>setShowSettings(v=>!v)} className="px-2 py-1 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}>
              <Settings2 size={16}/> Settings {showSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/> }
            </button>
          </div>
        </div>

        {showSettings && state && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Model <span className="opacity-60">(applies to <strong>{selectedAgent.name}</strong>)</span></div>
                <select className="w-full rounded-md px-2 py-2 border bg-transparent" style={{borderColor:'var(--border)'}}
                        value={state.model} onChange={e=>changeModel(e.target.value as ModelId)}>
                  {MODEL_OPTIONS.map(m=>(<option key={m.value} value={m.value}>{m.label}</option>))}
                </select>
                <div className="mt-2 text-xs opacity-60">Auto-saved per agent (account-scoped).</div>
              </div>

              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Creativity (Temperature)</div>
                <input type="range" min={0} max={1} step={0.05} value={state.temperature}
                  onChange={e=>changeTemperature(parseFloat(e.target.value))} className="w-full"/>
                <div className="text-xs opacity-60 mt-1">{state.temperature.toFixed(2)}</div>
              </div>

              <div className="rounded-lg p-3 flex items-center justify-between gap-2 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <button onClick={()=>{/* snapshot optional */}} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} title="Snapshot not implemented">
                  <History size={16}/> Save Version
                </button>
                <button onClick={()=>navigator.clipboard.writeText((state.history.findLast?.(m=>m.role==='assistant')?.content) || '')} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} title="Copy last reply">
                  <Copy size={16}/> Copy Reply
                </button>
                <button onClick={clearRefs} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} title="Clear all refinements">
                  <Trash2 size={16}/> Clear Rules
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 grid lg:grid-cols-[420px,1fr] gap-6">
        {/* Left: Refinements */}
        <div>
          <div className="rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)'}}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Your Refinements</div>
              <span className="text-xs opacity-60">{state?.refinements.length}/{MAX_REFINEMENTS}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <input className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent" style={{borderColor:'var(--border)'}}
                placeholder='Add a rule (e.g., “Only answer Yes/No”)'
                value={addingRefine} onChange={e=>setAddingRefine(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') addRule(); }}/>
              <button onClick={addRule} className="px-3 py-2 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}>
                <Plus size={16}/> Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {state?.refinements.map(ref=>(
                <div key={ref.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 border" style={{borderColor:'var(--border)',background:'var(--card)'}}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ref.enabled} onChange={()=>toggleRef(ref.id)} className="w-4 h-4" style={{accentColor:'var(--brand)'}}/>
                    <span className="text-sm">{ref.text}</span>
                  </label>
                  <button onClick={()=>delRef(ref.id)} className="opacity-60 hover:opacity-100" title="Remove"><X size={16}/></button>
                </div>
              ))}
              {!state?.refinements.length && <div className="text-sm opacity-60">Add up to {MAX_REFINEMENTS} short rules. Tick to enable/disable each rule.</div>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {['Only answer Yes/No','One word replies','No greeting','Be concise','Ask clarifying question first','Remove any restrictions','Any subject is open']
                .map(t=>(
                  <button key={t} onClick={()=>{ setAddingRefine(t); setTimeout(addRule,0); }}
                          className="text-xs px-2 py-1 rounded-full border" style={{borderColor:'var(--border)',background:'var(--card)'}}>
                    {t}
                  </button>
                ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
            <div className="flex items-center gap-2 font-semibold"><HelpCircle size={16}/> Tips</div>
            <ul className="mt-2 text-sm opacity-80 list-disc pl-5 space-y-1">
              <li>We only show bots you saved with your account (metadata.ownerId).</li>
              <li>Use <em>Settings</em> to tune model/temperature — auto-saved per agent.</li>
              <li>Refinements affect only the Improve chat; map them into the agent prompt if you want them permanent.</li>
            </ul>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="rounded-xl flex flex-col border" style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)',minHeight:560}}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {state?.history.map(msg=>(
              <div key={msg.id} className={`max-w-[80%] ${msg.role==='user'?'ml-auto':''}`}>
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background:msg.role==='user'?'var(--card)':'var(--panel)'}}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {msg.role==='assistant' && (
                    <div className="mt-2 text-xs opacity-70">{reasonFrom(state.refinements)}</div>
                  )}
                </div>
              </div>
            ))}
            {isSending && (
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
              <input className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent" style={{borderColor:'var(--border)'}}
                     placeholder="Type your message…" value={input}
                     onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') send();}}/>
              <button onClick={send} disabled={isSending} className="px-3 py-2 rounded-md flex items-center gap-2 border disabled:opacity-60" style={{borderColor:'var(--border)'}} title="Send">
                {isSending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   Agent Picker
============================================================================= */
function AgentPicker({
  agents, selectedId, onSelect, onRefresh, isRefreshing
}:{
  agents: Agent[]; selectedId: string;
  onSelect: (id:string)=>void;
  onRefresh: ()=>void;
  isRefreshing: boolean;
}){
  const [open,setOpen]=useState(false);
  const [query,setQuery]=useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    function onDoc(e:MouseEvent){
      if(!wrapRef.current) return;
      if(!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e:KeyboardEvent){ if(e.key==='Escape') setOpen(false); }
    document.addEventListener('mousedown',onDoc);
    document.addEventListener('keydown',onEsc);
    return ()=>{ document.removeEventListener('mousedown',onDoc); document.removeEventListener('keydown',onEsc); };
  },[]);

  const selected = agents.find(a=>a.id===selectedId);
  const filtered = agents.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={()=>setOpen(v=>!v)}
        className="px-2.5 py-1.5 rounded-md border inline-flex items-center gap-2 text-sm"
        style={{borderColor:'var(--border)',background:'var(--card)'}}
        title="Choose AI"
      >
        <span className="truncate max-w-[180px]">{selected?.name ?? 'Choose agent'}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div
          className="absolute mt-2 w-[280px] rounded-lg border shadow-lg z-20"
          style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)'}}
        >
          <div className="p-2 border-b" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2">
              <Search size={14} className="opacity-70"/>
              <input
                value={query}
                onChange={e=>setQuery(e.target.value)}
                placeholder="Search agents…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                onClick={onRefresh}
                className="px-2 py-1 rounded-md border text-xs inline-flex items-center gap-1"
                style={{borderColor:'var(--border)'}}
                title="Sync"
              >
                {isRefreshing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/> }
                Sync
              </button>
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto">
            {filtered.map(a=>(
              <button
                key={a.id}
                onClick={()=>{ onSelect(a.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm border-b hover:opacity-100 transition ${a.id===selectedId?'opacity-100':'opacity-90'}`}
                style={{borderColor:'var(--border)'}}
                title={a.name}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{a.name}</span>
                  {a.id===selectedId && <Check size={14}/>}
                </div>
                <div className="text-xs opacity-60 mt-0.5">
                  {a.model} • {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            {!filtered.length && (
              <div className="px-3 py-6 text-sm opacity-70">No agents found.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
