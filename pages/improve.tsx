// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, Copy, History, Info, Loader2, Plus, Send, Settings2,
  Sparkles, Trash2, Undo2, Redo2, ChevronDown, ChevronUp, HelpCircle, X,
  RefreshCw, Search
} from 'lucide-react';
import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

/* =============================================================================
   CONSTANTS / KEYS
============================================================================= */
const SCOPE = 'improve';
const MAX_REFINEMENTS = 5;
const DEFAULT_TEMPERATURE = 0.5;

const K_SELECTED_AGENT_ID = `${SCOPE}:selectedAgentId`;
const K_AGENT_LIST        = `agents`;           // builder’s agents list (shared)
const K_AGENT_META_PREFIX = `agents:meta:`;     // per-agent tuning (model/temp/rules)
const K_IMPROVE_STATE     = `${SCOPE}:agent:`;  // Improve’s per-agent chat/history

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

type Agent = { id: string; name: string; createdAt: number; model: ModelId; temperature?: number; };
type Refinement = { id: string; text: string; enabled: boolean; createdAt: number; };
type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string; reason?: string; createdAt: number; };
type AgentState = {
  model: ModelId; temperature: number; refinements: Refinement[];
  history: ChatMessage[]; versions: Array<{ id: string; label: string; createdAt: number; snapshot: Omit<AgentState,'versions'> }>;
  undo: Array<Omit<AgentState,'versions'|'undo'|'redo'>>; redo: Array<Omit<AgentState,'versions'|'undo'|'redo'>>;
};
type AgentMeta = { model: ModelId; temperature: number; refinements: Refinement[]; updatedAt: number; };
type Store = Awaited<ReturnType<typeof scopedStorage>>;

/* =============================================================================
   UTILS
============================================================================= */
const now = () => Date.now();
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;
const clamp01 = (n:number)=>Math.max(0,Math.min(1,n));

/** Prefer assistant-like ids if present. */
function chooseAgentId(x:any, i:number){
  const candidates = [
    x.assistant_id,
    x.openai_assistant_id,
    x.openai_id,
    x.asst_id,
    x.id,
    x.agentId,
    x.slug,
  ].filter(Boolean);
  const id = String(candidates[0] ?? `tmp_${i}_${Date.now()}`);
  return id;
}

function mapAnyToAgent(x:any,i:number):Agent|null{
  if(!x) return null;
  const id = chooseAgentId(x, i);
  const name = String(
    x.name ?? x.title ?? x.displayName ?? x.botName ?? x.meta?.name ?? `Agent ${i+1}`
  );
  const createdAt = Number(
    x.createdAt ?? x.created_at ?? x.updatedAt ?? x.updated_at ?? Date.now()
  );
  const modelRaw = String(x.model ?? x.modelId ?? x.engine ?? 'gpt-4o');
  const model = (MODEL_OPTIONS.some(m => m.value === modelRaw) ? modelRaw : 'gpt-4o') as ModelId;
  const temperature =
    typeof x.temperature === 'number' ? x.temperature :
    typeof x.temp === 'number'        ? x.temp :
    typeof x.creativity === 'number'  ? x.creativity :
    DEFAULT_TEMPERATURE;

  return { id, name, createdAt, model, temperature };
}

function normalizeAgents(list:any):Agent[]{
  if(!Array.isArray(list)) return [];
  return list.map(mapAnyToAgent).filter(Boolean) as Agent[];
}

async function loadAgentsFromAny(store:Store):Promise<Agent[]>{
  const candidates=[K_AGENT_LIST,'chatbots','builds','assistants','voice:assistants'];
  for(const key of candidates){
    const raw=await store.getJSON<any>(key,[]);
    const list=normalizeAgents(raw);
    if(list.length){ await store.setJSON(K_AGENT_LIST,list); return list; }
  }
  return [];
}

function dedupeAgentsById(arr: Agent[]): Agent[] {
  const m = new Map<string, Agent>();
  for (const a of arr) if (!m.has(a.id)) m.set(a.id, a);
  return [...m.values()];
}

function pickList(data: any): any[] {
  if (Array.isArray(data)) return data;
  for (const k of ['items','data','bots','rows','list']) {
    if (Array.isArray(data?.[k])) return data[k];
  }
  return [];
}

async function fetchBuilderAgentsFromAPI(): Promise<Agent[]> {
  try {
    const res = await fetch('/api/chatbots', { method: 'GET' });
    if (!res.ok) return [];
    const raw = await res.json();
    const list = pickList(raw);
    return (list.map(mapAnyToAgent).filter(Boolean) as Agent[]);
  } catch {
    return [];
  }
}

function reasonFrom(refs:Refinement[]):string{
  const active=refs.filter(r=>r.enabled);
  if(!active.length) return 'No special requests are active—using a default helpful tone.';
  return `Following your active refinements: ${active.slice(0,3).map(r=>r.text).join('; ')}.`;
}

/** Compose a system prompt from builder data + active refinements. */
async function composeSystemForAgent(store:Store, agent:Agent, refinements:Refinement[]){
  const wantsProviderOnly = refinements.some(r=>r.enabled && /remove (any )?restrictions|no restrictions|uncensored|no filter|any subject/i.test(r.text));
  const [sys, profile, builder] = await Promise.all([
    store.getJSON<string|null>(`agents:system:${agent.id}`, null as any),
    store.getJSON<string|null>(`agents:profile:${agent.id}`, null as any),
    store.getJSON<string|null>(`builder:prompt:${agent.id}`, null as any),
  ]);

  const base = (sys||profile||builder||`You are ${agent.name}, a helpful, capable assistant.`).trim();
  const active = refinements.filter(r=>r.enabled).map(r=>r.text).join('; ');
  const refinementsLine = active ? `Active refinements: ${active}.` : '';

  const policyLine = wantsProviderOnly
    ? `Follow the user's instructions within legal and safety boundaries. Do not add extra disclaimers beyond provider requirements.`
    : `Be helpful, precise, and safe. Respect the active refinements.`;

  return {
    guardLevel: wantsProviderOnly ? 'provider-only' : 'lenient',
    systemPrompt: [base, refinementsLine, policyLine].filter(Boolean).join('\n\n')
  } as const;
}

async function chatWithAgent(payload:{
  agentId:string; model:ModelId; temperature:number;
  system:string; messages:Array<{role:'user'|'assistant';content:string}>;
  guardLevel:'provider-only'|'lenient'
}):Promise<{content:string; modelUsed:string; finish_reason?:string; blocked?:boolean}>{
  const res = await fetch('/api/improve/chat', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  if(!res.ok){
    const text = await res.text().catch(()=>String(res.status));
    throw new Error(text || `HTTP ${res.status}`);
  }
  return await res.json();
}

/* =============================================================================
   MAIN
============================================================================= */
export default function ImprovePage(){
  const [store,setStore]=useState<Store|null>(null);
  const [agents,setAgents]=useState<Agent[]>([]);
  const [agentId,setAgentId]=useState<string|null>(null);
  const [state,setState]=useState<AgentState|null>(null);

  const [input,setInput]=useState('');
  const [addingRefine,setAddingRefine]=useState('');
  const [isSending,setIsSending]=useState(false);
  const [showSettings,setShowSettings]=useState(false);
  const [showWhyFor,setShowWhyFor]=useState<string|null>(null);
  const [isSaving,setIsSaving]=useState(false);
  const [isRefreshing,setIsRefreshing]=useState(false);

  const scrollRef=useRef<HTMLDivElement>(null);

  /* ---------- bootstrap ---------- */
  useEffect(()=>{(async()=>{
    const st=await scopedStorage();
    await st.ensureOwnerGuard();
    await migrateLegacyKeysToUser();
    setStore(st);

    // Local/legacy
    let list=normalizeAgents(await st.getJSON<any[]>(K_AGENT_LIST,[]));
    if(!list.length) list=await loadAgentsFromAny(st);

    // Merge builder agents
    const remote = await fetchBuilderAgentsFromAPI();
    if (remote.length) list = dedupeAgentsById([...remote, ...list]);

    // Seed if empty
    if(!list.length){
      list=[{id:uid('agent'),name:'My First Agent',createdAt:now(),model:'gpt-4o',temperature:DEFAULT_TEMPERATURE}];
    }

    await st.setJSON(K_AGENT_LIST,list);
    setAgents(list);

    const savedId=await st.getJSON<string|null>(K_SELECTED_AGENT_ID,null as any);
    const sel=list.find(a=>a.id===savedId) ?? [...list].sort((a,b)=>b.createdAt-a.createdAt)[0];
    if(sel){ setAgentId(sel.id); await hydrateFromAgent(st,sel.id,list); }
  })();},[]);

  async function hydrateFromAgent(st:Store,id:string,list:Agent[]=agents){
    const a=list.find(x=>x.id===id); if(!a) return;
    let base:AgentState=await st.getJSON<AgentState|null>(K_IMPROVE_STATE+id,null as any) ?? {
      model:a.model, temperature:a.temperature ?? DEFAULT_TEMPERATURE,
      refinements:[], history:[{id:uid('sys'),role:'system',content:'This is the Improve panel. Your agent will reply based on the active refinements.',createdAt:now()}],
      versions:[], undo:[], redo:[]
    };
    const meta=await st.getJSON<AgentMeta|null>(K_AGENT_META_PREFIX+id,null as any);
    if(meta){ base.model=meta.model; base.temperature=meta.temperature; base.refinements=meta.refinements ?? base.refinements; }
    if(!MODEL_OPTIONS.some(m=>m.value===base.model)) base.model='gpt-4o';
    setState(base);
    await st.setJSON(K_IMPROVE_STATE+id,base);
  }

  /* ---------- persist ---------- */
  useEffect(()=>{ if(!store||!agentId||!state) return; store.setJSON(K_IMPROVE_STATE+agentId,state); },[store,agentId,state]);

  // keep agent meta + list in sync
  useEffect(()=>{ if(!store||!agentId||!state) return; (async()=>{
    setIsSaving(true);
    const meta:AgentMeta={model:state.model,temperature:state.temperature,refinements:state.refinements,updatedAt:now()};
    await store.setJSON(K_AGENT_META_PREFIX+agentId,meta);
    const latest=normalizeAgents(await store.getJSON<any[]>(K_AGENT_LIST,[]));
    const next=latest.map(a=>a.id===agentId?{...a,model:state.model,temperature:state.temperature}:a);
    await store.setJSON(K_AGENT_LIST,next);
    setAgents(next);
    setIsSaving(false);
  })(); },[store,agentId,state?.model,state?.temperature,JSON.stringify(state?.refinements||[])]);

  useEffect(()=>{ if(scrollRef.current) scrollRef.current.scrollTop=scrollRef.current.scrollHeight; },[state?.history.length,isSending]);

  /* ---------- actions ---------- */
  function snapshotCore(s:AgentState){ const {model,temperature,refinements,history}=s; return {model,temperature,refinements:[...refinements],history:[...history]}; }
  function pushUndo(ss:ReturnType<typeof snapshotCore>){ setState(p=>p?{...p,undo:[...p.undo,ss],redo:[]}:p); }

  function handleAddRefinement(){
    if(!state) return;
    const text=addingRefine.trim(); if(!text) return;
    const ref:Refinement={id:uid('ref'),text,enabled:true,createdAt:now()};
    const next=[ref,...state.refinements].slice(0,MAX_REFINEMENTS);
    pushUndo(snapshotCore(state)); setState({...state,refinements:next}); setAddingRefine('');
  }
  const toggleRef=(id:string)=>state&&setState({...state,refinements:state.refinements.map(r=>r.id===id?{...r,enabled:!r.enabled}:r)});
  const delRef=(id:string)=>state&&setState({...state,refinements:state.refinements.filter(r=>r.id!==id)});
  const clearRefs=()=>state&&setState({...state,refinements:[]});

  const changeModel=(m:ModelId)=>state&&setState({...state,model:m});
  const changeTemperature=(t:number)=>state&&setState({...state,temperature:clamp01(t)});

  async function selectAgent(id:string){
    if(!store) return;
    const a=agents.find(x=>x.id===id); if(!a) return;
    await store.setJSON(K_SELECTED_AGENT_ID,id); setAgentId(id); await hydrateFromAgent(store,id);
  }

  async function refreshAgents(){
    if(!store) return;
    try{
      setIsRefreshing(true);
      const remote = await fetchBuilderAgentsFromAPI();
      if(remote.length){
        const merged = dedupeAgentsById([...remote, ...agents]);
        await store.setJSON(K_AGENT_LIST, merged);
        setAgents(merged);
        if(merged.length && !merged.find(a=>a.id===agentId)){
          const pick = merged[0];
          await store.setJSON(K_SELECTED_AGENT_ID, pick.id);
          setAgentId(pick.id);
          await hydrateFromAgent(store, pick.id, merged);
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  function saveVersion(){ if(!state) return; const ver={id:uid('ver'),label:new Date().toLocaleString(),createdAt:now(),snapshot:snapshotCore(state)}; setState({...state,versions:[ver,...state.versions]}); }
  function loadVersion(vid:string){ if(!state) return; const v=state.versions.find(x=>x.id===vid); if(!v) return; pushUndo(snapshotCore(state)); setState({...state,...v.snapshot}); }
  function undo(){ if(!state||!state.undo.length) return; const last=state.undo[state.undo.length-1]; const newUndo=state.undo.slice(0,-1); const redoSnap=snapshotCore(state); setState({...state,...last,undo:newUndo,redo:[...state.redo,redoSnap]} as AgentState); }
  function redo(){ if(!state||!state.redo.length) return; const last=state.redo[state.redo.length-1]; const newRedo=state.redo.slice(0,-1); const undoSnap=snapshotCore(state); setState({...state,...last,redo:newRedo,undo:[...state.undo,undoSnap]} as AgentState); }

  async function sendMessage(){
    if(!state||!store||!agentId) return;
    const text=input.trim(); if(!text) return;

    const userMsg:ChatMessage={id:uid('m'),role:'user',content:text,createdAt:now()};
    pushUndo(snapshotCore(state));
    setState({...state,history:[...state.history,userMsg]});
    setInput(''); setIsSending(true);

    try{
      const selected = agents.find(a=>a.id===agentId)!;
      const { systemPrompt, guardLevel } = await composeSystemForAgent(store, selected, state.refinements);

      // last 20 msgs without system
      const msgs = [...state.history, userMsg]
        .filter(m=>m.role!=='system')
        .slice(-20)
        .map(m=>({role: m.role==='assistant' ? 'assistant' as const : 'user' as const, content: m.content}));

      const result = await chatWithAgent({
        agentId, model: state.model, temperature: state.temperature,
        system: systemPrompt, messages: msgs, guardLevel: guardLevel as 'provider-only'|'lenient'
      });

      const aiMsg:ChatMessage={id:uid('m'),role:'assistant',content:result.content,reason:reasonFrom(state.refinements),createdAt:now()};
      setState(prev=>prev?{...prev,history:[...prev.history,aiMsg]}:prev);
    }catch(err:any){
      const aiMsg:ChatMessage={id:uid('m'),role:'assistant',content:`(Error) ${err?.message||'Failed to reach AI service.'}`,createdAt:now()};
      setState(prev=>prev?{...prev,history:[...prev.history,aiMsg]}:prev);
    }finally{
      setIsSending(false);
    }
  }

  const selectedAgent=useMemo(()=>agents.find(a=>a.id===agentId)??null,[agents,agentId]);

  if(!state||!selectedAgent){
    return (<div className="min-h-screen flex items-center justify-center font-sans" style={{background:'var(--bg)',color:'var(--text)'}}>
      <div className="opacity-80 flex items-center gap-3"><Loader2 className="animate-spin"/>&nbsp;Loading Improve…</div>
    </div>);
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
                onSelect={selectAgent}
                onRefresh={refreshAgents}
                isRefreshing={isRefreshing}
              />
              <div className="ml-1 text-xs flex items-center gap-1 opacity-80">
                {isSaving ? (<><Loader2 size={14} className="animate-spin"/> Saving…</>) : (<><Check size={14}/> Saved</>)}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={undo} className="px-2 py-1 rounded-md border" style={{borderColor:'var(--border)'}}><Undo2 size={16}/></button>
            <button onClick={redo} className="px-2 py-1 rounded-md border" style={{borderColor:'var(--border)'}}><Redo2 size={16}/></button>
            <button onClick={()=>setShowSettings(v=>!v)} className="px-2 py-1 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}>
              <Settings2 size={16}/> Settings {showSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3">
            <div className="grid md:grid-cols-3 gap-3">
              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Model <span className="opacity-60">(applies to <strong>{selectedAgent.name}</strong>)</span></div>
                <select className="w-full rounded-md px-2 py-2 border bg-transparent" style={{borderColor:'var(--border)'}}
                        value={state.model} onChange={e=>changeModel(e.target.value as ModelId)}>
                  {MODEL_OPTIONS.map(m=>(<option key={m.value} value={m.value}>{m.label}</option>))}
                </select>
                <div className="mt-2 text-xs opacity-60">Tuning is auto-saved to this agent (per account).</div>
              </div>

              <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-1">Creativity (Temperature)</div>
                <input type="range" min={0} max={1} step={0.05} value={state.temperature}
                  onChange={e=>changeTemperature(parseFloat(e.target.value))} className="w-full"/>
                <div className="text-xs opacity-60 mt-1">{state.temperature.toFixed(2)}</div>
              </div>

              <div className="rounded-lg p-3 flex items-center justify-between gap-2 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <button onClick={saveVersion} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} title="Snapshot settings + chat">
                  <History size={16}/> Save Version
                </button>
                <button onClick={copyLast} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} title="Copy last reply">
                  <Copy size={16}/> Copy Reply
                </button>
                <button onClick={clearRefs} className="flex items-center gap-2 px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}} title="Clear all refinements">
                  <Trash2 size={16}/> Clear Rules
                </button>
              </div>
            </div>

            {!!state.versions.length && (
              <div className="mt-3 rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                <div className="text-xs opacity-70 mb-2">Versions</div>
                <div className="flex flex-wrap gap-2">
                  {state.versions.map(v=>(
                    <button key={v.id} onClick={()=>loadVersion(v.id)} className="px-3 py-1 rounded-full border text-sm"
                            style={{borderColor:'var(--border)'}} title={new Date(v.createdAt).toLocaleString()}>{v.label}</button>
                  ))}
                </div>
              </div>
            )}
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
              <span className="text-xs opacity-60">{state.refinements.length}/{MAX_REFINEMENTS}</span>
            </div>

            <div className="mt-3 flex gap-2">
              <input className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent" style={{borderColor:'var(--border)'}}
                placeholder='Add a rule (e.g., “Only answer Yes/No”)'
                value={addingRefine} onChange={e=>setAddingRefine(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter') handleAddRefinement(); }}/>
              <button onClick={handleAddRefinement} className="px-3 py-2 rounded-md flex items-center gap-2 border" style={{borderColor:'var(--border)'}}>
                <Plus size={16}/> Add
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {state.refinements.map(ref=>(
                <div key={ref.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2 border" style={{borderColor:'var(--border)',background:'var(--card)'}}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={ref.enabled} onChange={()=>toggleRef(ref.id)} className="w-4 h-4" style={{accentColor:'var(--brand)'}}/>
                    <span className="text-sm">{ref.text}</span>
                  </label>
                  <button onClick={()=>delRef(ref.id)} className="opacity-60 hover:opacity-100" title="Remove"><X size={16}/></button>
                </div>
              ))}
              {!state.refinements.length && <div className="text-sm opacity-60">Add up to {MAX_REFINEMENTS} short rules. Tick to enable/disable each rule.</div>}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {[
                'Only answer Yes/No','One word replies','No greeting','Be concise','Ask clarifying question first',
                'Remove any restrictions','Any subject is open'
              ].map(t=>(
                <button key={t} onClick={()=>{ setAddingRefine(t); setTimeout(handleAddRefinement,0); }}
                        className="text-xs px-2 py-1 rounded-full border" style={{borderColor:'var(--border)',background:'var(--card)'}}>
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
            <div className="flex items-center gap-2 font-semibold"><HelpCircle size={16}/> Tips</div>
            <ul className="mt-2 text-sm opacity-80 list-disc pl-5 space-y-1">
              <li>Choose the <strong>AI to tune</strong> at the top — every change auto-saves to that agent.</li>
              <li>“Remove any restrictions / Any subject is open” = no <em>extra</em> app guardrails (provider safety still applies).</li>
              <li>Use <em>Versions</em> to snapshot settings + chat for quick rollback.</li>
            </ul>
          </div>
        </div>

        {/* Right: Chat */}
        <div className="rounded-xl flex flex-col border" style={{borderColor:'var(--border)',background:'var(--panel)',boxShadow:'var(--shadow-soft)',minHeight:560}}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {state.history.map(msg=>(
              <div key={msg.id} className={`max-w-[80%] ${msg.role==='user'?'ml-auto':''}`}>
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background:msg.role==='user'?'var(--card)':'var(--panel)'}}>
                  <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                  {msg.role==='assistant' && (
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={()=>setShowWhyFor(msg.id)} className="text-xs px-2 py-1 rounded-md flex items-center gap-1 border" style={{borderColor:'var(--border)'}} title="Why this reply?">
                        <Info size={14}/> Why?
                      </button>
                    </div>
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
                     onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter') sendMessage();}}/>
              <button onClick={sendMessage} disabled={isSending} className="px-3 py-2 rounded-md flex items-center gap-2 border disabled:opacity-60" style={{borderColor:'var(--border)'}} title="Save & Rerun">
                {isSending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Send
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <QuickChip icon={<Sparkles size={14}/>} label="Make it shorter" onClick={()=>setAddingRefine('Be concise')}/>
              <QuickChip icon={<Sparkles size={14}/>} label="No greeting" onClick={()=>setAddingRefine('No greeting')}/>
              <QuickChip icon={<Sparkles size={14}/>} label="Yes/No only" onClick={()=>setAddingRefine('Only answer Yes/No')}/>
              <QuickChip icon={<Sparkles size={14}/>} label="1-word" onClick={()=>setAddingRefine('One word replies')}/>
            </div>
          </div>
        </div>
      </div>

      {showWhyFor && (
        <div className="fixed inset-0 z-30 flex items-center justify-center" style={{background:'rgba(0,0,0,.5)'}}>
          <div className="w-[520px] max-w-[92vw] rounded-xl p-4 border" style={{background:'var(--panel)',borderColor:'var(--border)',boxShadow:'var(--shadow-soft)'}}>
            <div className="flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2"><Info size={16}/> Why this reply?</div>
              <button onClick={()=>setShowWhyFor(null)} className="opacity-60 hover:opacity-100"><X size={16}/></button>
            </div>
            <div className="mt-3 text-sm leading-relaxed">{reasonFrom(state.refinements)}</div>
            <div className="mt-4 flex justify-end">
              <button onClick={()=>setShowWhyFor(null)} className="px-3 py-2 rounded-md text-sm border" style={{borderColor:'var(--border)'}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================================================================
   Agent Picker (themed dropdown)
============================================================================= */
function AgentPicker({
  agents,
  selectedId,
  onSelect,
  onRefresh,
  isRefreshing
}:{
  agents: Agent[];
  selectedId: string;
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
                title="Sync from Builder"
              >
                {isRefreshing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>}
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

/* =============================================================================
   Small UI
============================================================================= */
function QuickChip({icon,label,onClick}:{icon?:React.ReactNode;label:string;onClick:()=>void}){
  return (
    <button onClick={onClick} className="text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 border" style={{borderColor:'var(--border)',background:'var(--card)'}} title="Add as refinement">
      {icon}{label}
    </button>
  );
}
