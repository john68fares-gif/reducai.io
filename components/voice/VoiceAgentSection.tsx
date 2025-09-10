// pages/voice.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Plus, Trash2, Edit3, Check, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  FileText, Sparkles, RefreshCw, X, MessageSquare, Copy, ChevronDown, KeyRound, Phone as PhoneIcon
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* =============================================================================
   THEME — v0.dev-like sections, toned-down glow, light/dark
============================================================================= */
const SCOPE = 'voice-v2';
const BRAND = '#59d9b3';

function Theme() {
  return (
    <style jsx global>{`
      .${SCOPE}{
        --bg:#f8fafc;
        --text:#0b1117;
        --muted:color-mix(in oklab, var(--text) 58%, transparent);
        --panel:#ffffff;
        --card:#ffffff;
        --border:rgba(0,0,0,.10);
        --brand:${BRAND};
        --ring:rgba(0,255,194,.12);
        --shadow-sm:0 6px 18px rgba(0,0,0,.06);
        --shadow-md:0 10px 28px rgba(0,0,0,.08);
        --shadow-lg:0 22px 60px rgba(0,0,0,.10);
        --rail-w:320px;
      }
      [data-theme="dark"] .${SCOPE}{
        --bg:#0c1012;
        --text:#e9eef2;
        --muted:color-mix(in oklab, var(--text) 72%, transparent);
        --panel:linear-gradient(180deg, #0f1416 0%, #0c1113 100%);
        --card:#0f1416;
        --border:rgba(255,255,255,.10);
        --ring:rgba(0,255,194,.16);
        --shadow-sm:0 6px 18px rgba(0,0,0,.30);
        --shadow-md:0 12px 30px rgba(0,0,0,.35);
        --shadow-lg:0 26px 70px rgba(0,0,0,.45);
      }

      .${SCOPE} .section{background:var(--panel);border:1px solid var(--border);border-radius:24px;box-shadow:var(--shadow-md)}
      .${SCOPE} .subcard{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow-sm)}
      .${SCOPE} .label{font-size:12px;color:var(--muted)}
      .${SCOPE} .h{font-size:14px;font-weight:600;color:var(--text);display:flex;align-items:center;gap:.5rem}
      .${SCOPE} .input, .${SCOPE} .select, .${SCOPE} .area{
        background:var(--card);border:1px solid var(--border);border-radius:14px;color:var(--text);outline:none;
        padding:.7rem .85rem; box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
      }
      .${SCOPE} .area{border-radius:18px;padding:1rem}
      .${SCOPE} .btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:14px;padding:.65rem .9rem;border:1px solid var(--border);
        background:var(--card); color:var(--text); transition:transform .06s ease, box-shadow .12s ease, background .12s ease;}
      .${SCOPE} .btn:hover{transform:translateY(-1px)}
      .${SCOPE} .btn:active{transform:translateY(0)}
      .${SCOPE} .btn-brand{background:var(--brand);color:#0b1112;border-color:transparent;box-shadow:0 6px 18px rgba(0,255,194,.18)}
      .${SCOPE} .btn-brand:hover{box-shadow:0 10px 28px rgba(0,255,194,.20)}
      .${SCOPE} .chip{border-radius:12px;padding:.45rem .7rem;background:var(--card);border:1px solid var(--border)}

      /* diff styling */
      .${SCOPE} ins{background:rgba(0,255,194,.16); text-decoration:none; border-radius:4px; padding:1px 2px;}
      .${SCOPE} del{background:rgba(244,63,94,.14); color:inherit; border-radius:4px; padding:1px 2px;}

      /* focus ring, subtle */
      .${SCOPE} .input:focus, .${SCOPE} .select:focus, .${SCOPE} .area:focus, .${SCOPE} .btn:focus{box-shadow:0 0 0 3px var(--ring);outline:none}
    `}</style>
  );
}

/* =============================================================================
   TYPES & STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o'|'gpt-4o-mini'|'gpt-4.1'|'gpt-3.5-turbo';
type Assistant = {
  id: string; name: string; updatedAt: number;
  config: { model: { provider: Provider; model: ModelId; firstMessageMode: 'assistant_first'|'user_first'; firstMessage: string; systemPrompt: string } };
};
type Turn = { role:'user'|'assistant'; text:string; ts:number };

const K_LIST = 'voice:assistants.v2';
const K_PREFIX = 'voice:assistant:';
const k = (id:string)=> `${K_PREFIX}${id}`;
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-4)}`;

/* =============================================================================
   DIFF + STREAM
============================================================================= */
type Tok = { ch:string; added:boolean; removed?:boolean };
function charDiff(oldStr:string, newStr:string):Tok[] {
  const o=[...oldStr], n=[...newStr];
  const dp=Array(o.length+1).fill(0).map(()=>Array(n.length+1).fill(0));
  for(let i=o.length-1;i>=0;i--)for(let j=n.length-1;j>=0;j--) dp[i][j]=o[i]===n[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  const out:Tok[]=[]; let i=0,j=0;
  while(i<o.length && j<n.length){
    if(o[i]===n[j]){ out.push({ch:n[j],added:false}); i++; j++; }
    else if(dp[i+1][j]>=dp[i][j+1]){ out.push({ch:o[i],added:false,removed:true}); i++; }
    else { out.push({ch:n[j],added:true}); j++; }
  }
  while(i<o.length){ out.push({ch:o[i],added:false,removed:true}); i++; }
  while(j<n.length){ out.push({ch:n[j],added:true}); j++; }
  return out;
}

/* =============================================================================
   ASSISTANT RAIL (compact)
============================================================================= */
function useSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>){
  useEffect(()=> {
    const scope=scopeRef.current; if(!scope) return;
    const setVar=(w:number)=>scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const find=()=> (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
                   (document.querySelector('#app-sidebar') as HTMLElement) ||
                   (document.querySelector('.app-sidebar') as HTMLElement) ||
                   (document.querySelector('aside.sidebar') as HTMLElement) || null;
    let el=find(); if(!el){ setVar(248); return; }
    setVar(el.getBoundingClientRect().width);
    const ro=new ResizeObserver(()=>setVar(el!.getBoundingClientRect().width));
    ro.observe(el);
    const onEnd=()=>setVar(el!.getBoundingClientRect().width);
    el.addEventListener('transitionend', onEnd);
    return ()=>{ ro.disconnect(); el.removeEventListener('transitionend', onEnd); };
  },[scopeRef]);
}

function AssistantRail({
  items, activeId, onSelect, onCreate, onRename, onDelete
}:{
  items: Assistant[]; activeId:string; onSelect:(id:string)=>void;
  onCreate:()=>void; onRename:(id:string,name:string)=>void; onDelete:(id:string)=>void;
}){
  const scopeRef=useRef<HTMLDivElement|null>(null);
  const [collapsed,setCollapsed]=useState(false);
  const [q,setQ]=useState('');
  const [editing,setEditing]=useState<string| null>(null);
  const [temp,setTemp]=useState('');
  useSidebarWidth(scopeRef);
  const visible=useMemo(()=> items.filter(a=>a.name.toLowerCase().includes(q.trim().toLowerCase())),[items,q]);

  return (
    <div ref={scopeRef}>
      <aside className="hidden lg:flex flex-col"
        style={{position:'fixed', left:'calc(var(--app-sidebar-w, 248px) - 1px)', top:'64px',
                width: collapsed ? 72 : 'var(--rail-w, 320px)', height:'calc(100vh - 64px)',
                background:'var(--panel)', borderRight:'1px solid var(--border)', boxShadow:'var(--shadow-md)', zIndex:10}}>
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="h"><Bot size={16} style={{color:BRAND}}/> Assistants</div>
          <div className="flex items-center gap-2">
            {!collapsed && <button onClick={onCreate} className="btn"><Plus size={14}/> Create</button>}
            <button onClick={()=>setCollapsed(v=>!v)} className="btn" title={collapsed?'Expand':'Collapse'}>
              {collapsed ? <ChevronRightIcon size={16}/> : <ChevronLeft size={16}/>}
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          {!collapsed && (
            <div className="chip mb-2 flex items-center gap-2">
              <Search size={14} style={{color:BRAND}}/><input className="bg-transparent outline-none text-sm w-full"
                placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
          )}

          <div className="space-y-2">
            {visible.map(a=>{
              const isActive=a.id===activeId;
              const isEdit=editing===a.id;
              if(collapsed){
                return (
                  <button key={a.id} onClick={()=>onSelect(a.id)} title={a.name}
                    className="w-full rounded-xl p-3 grid place-items-center"
                    style={{background:isActive?'color-mix(in oklab, var(--brand) 10%, transparent)':'var(--card)', border:'1px solid var(--border)'}}>
                    <Bot size={16} style={{color:BRAND}}/>
                  </button>
                );
              }
              return (
                <div key={a.id} className="subcard p-3" style={{ background:isActive?'color-mix(in oklab, var(--brand) 8%, var(--card))':'var(--card)' }}>
                  <button onClick={()=>onSelect(a.id)} className="w-full text-left flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot size={16} style={{color:BRAND}}/>
                        {!isEdit ? <span className="truncate">{a.name}</span> : (
                          <input autoFocus className="input px-2 py-1 w-full" value={temp}
                            onChange={e=>setTemp(e.target.value)}
                            onKeyDown={(e)=>{ if(e.key==='Enter'){ onRename(a.id, (temp||'').trim()||'Untitled'); setEditing(null); }
                                              if(e.key==='Escape') setEditing(null); }} />
                        )}
                      </div>
                      <div className="label mt-1">{new Date(a.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {isActive ? <Check size={16} style={{color:BRAND}}/> : null}
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={()=>{ setEditing(a.id); setTemp(a.name); }} className="btn text-xs"><Edit3 size={14}/> Rename</button>
                        <button onClick={()=>onDelete(a.id)} className="btn text-xs" style={{ background:'rgba(220,38,38,.10)', borderColor:'rgba(220,38,38,.28)', color:'#fda4af' }}>
                          <Trash2 size={14}/> Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={()=>{ onRename(a.id, (temp||'').trim()||'Untitled'); setEditing(null); }} className="btn text-xs" style={{background:BRAND, color:'#0b1112', borderColor:'transparent'}}><Check size={14}/> Save</button>
                        <button onClick={()=>setEditing(null)} className="btn text-xs">Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* =============================================================================
   INLINE SELECT (dropdown, no auto-select)
============================================================================= */
function InlineSelect({
  value, onChange, options, placeholder='— Choose —', left
}:{
  value:string; onChange:(v:string)=>void;
  options:Array<{value:string; label:string; sub?:string}>;
  placeholder?:string; left?:React.ReactNode;
}){
  const [open,setOpen]=useState(false);
  const [rect,setRect]=useState<{top:number; left:number; width:number}|null>(null);
  const [q,setQ]=useState('');
  const btnRef=useRef<HTMLButtonElement|null>(null);
  const filtered=useMemo(()=> {
    const s=q.trim().toLowerCase();
    if(!s) return options;
    return options.filter(o=> (o.label+' '+(o.sub||'')).toLowerCase().includes(s));
  },[options,q]);

  useLayoutEffect(()=>{ if(!open) return; const r=btnRef.current?.getBoundingClientRect(); if(r) setRect({ top:r.bottom+8, left:r.left, width:r.width }); },[open]);
  useEffect(()=>{ if(!open) return; const close=(e:MouseEvent)=>{ if(btnRef.current?.contains(e.target as Node)) return; setOpen(false); }; window.addEventListener('mousedown', close); return ()=>window.removeEventListener('mousedown', close); },[open]);

  const sel=options.find(o=>o.value===value) || null;

  return (
    <>
      <button ref={btnRef} className="w-full chip flex items-center justify-between gap-2 h-[44px]" onClick={()=>setOpen(v=>!v)}>
        <span className="flex items-center gap-2 min-w-0">{left}<span className="truncate">{sel ? sel.label : <span style={{ color:'var(--muted)' }}>{placeholder}</span>}</span></span>
        <span className="text-xs" style={{ color:'var(--muted)' }}>{sel?.sub || ''}</span>
        <ChevronDown size={14} style={{ color:'var(--muted)' }}/>
      </button>

      {open && rect && (
        <div className="fixed z-[9999] p-3 subcard" style={{ left:rect.left, top:rect.top, width:rect.width }}>
          <div className="chip flex items-center gap-2 mb-3">
            <Search size={14} style={{color:BRAND}}/><input className="bg-transparent outline-none text-sm w-full" placeholder="Search…"
              value={q} onChange={e=>setQ(e.target.value)} />
          </div>
          <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
            {filtered.map(o=>(
              <button key={o.value||o.label} onClick={()=>{ onChange(o.value); setOpen(false); }}
                      className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-[rgba(0,255,194,.10)]"
                      style={{ border:'1px solid transparent' }}>
                <span className="flex-1 truncate">{o.label}</span>
                {o.sub && <span className="text-xs" style={{ color:'var(--muted)' }}>{o.sub}</span>}
              </button>
            ))}
            {filtered.length===0 && <div className="px-3 py-6 text-sm" style={{ color:'var(--muted)' }}>No items.</div>}
          </div>
        </div>
      )}
    </>
  );
}

/* =============================================================================
   MAIN
============================================================================= */
export default function VoicePage(){
  const [assistants,setAssistants]=useState<Assistant[]>([]);
  const [activeId,setActiveId]=useState('');
  const active=useMemo(()=>assistants.find(a=>a.id===activeId) || null,[assistants,activeId]);

  // keys & numbers (not auto-selected)
  const [apiKeys,setApiKeys]=useState<Array<{id:string;name:string;key:string}>>([]);
  const [apiKeyId,setApiKeyId]=useState('');
  const [apiKey,setApiKey]=useState('');
  const [numbers,setNumbers]=useState<Array<{id:string;e164?:string;label?:string;provider?:string;status?:string}>>([]);
  const [fromE164,setFrom]=useState('');

  // generate/diff
  const [genInput,setGenInput]=useState('');
  const [typing,setTyping]=useState<Tok[]|null>(null);
  const [typedCount,setTypedCount]=useState(0);
  const [previewPrompt,setPreviewPrompt]=useState('');
  const typingBoxRef=useRef<HTMLDivElement|null>(null);
  const typingTimer=useRef<number| null>(null);

  const [turns,setTurns]=useState<Turn[]>([]);

  /* bootstrap */
  useEffect(()=> {
    // assistants
    const ls = typeof window!=='undefined' ? localStorage.getItem(K_LIST) : null;
    let list:Assistant[]=[];
    try{ list = ls ? JSON.parse(ls) : []; }catch{}
    if(!list.length){
      const seed:Assistant = {
        id: uid('agent'),
        name: 'My First Voice Agent',
        updatedAt: Date.now(),
        config: { model:{ provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first',
          firstMessage:'Hello. How may I help you today?', systemPrompt:'' } } // EMPTY prompt by default
      };
      list=[seed];
      localStorage.setItem(K_LIST, JSON.stringify(list));
      localStorage.setItem(k(seed.id), JSON.stringify(seed));
    }
    setAssistants(list); setActiveId(list[0].id);

    // api keys
    (async()=>{
      try{
        const ss=await scopedStorage(); await ss.ensureOwnerGuard();
        const saved=await ss.getJSON<Array<{id:string;name:string;key:string}>>('apiKeys.v1', []);
        const cleaned=(Array.isArray(saved)?saved:[]).filter(Boolean).map(x=>({id:String(x.id),name:String(x.name),key:String(x.key)}));
        setApiKeys(cleaned);
        // DO NOT auto-pick. user must choose.
        setApiKeyId('');
      }catch{}
    })();

    // phone numbers
    (async()=>{
      try{
        const r=await fetch('/api/telephony/phone-numbers',{ cache:'no-store' });
        const j=await r.json();
        const list = j?.ok ? j.data : j;
        setNumbers(Array.isArray(list) ? list : []);
      }catch{ setNumbers([]); }
    })();
  },[]);

  // keep actual secret for selected id
  useEffect(()=>{ (async()=>{
    try{
      const ss=await scopedStorage();
      const all=await ss.getJSON<Array<{id:string;name:string;key:string}>>('apiKeys.v1', []);
      const hit=Array.isArray(all)?all.find(k=>k.id===apiKeyId):null;
      setApiKey(hit?.key || '');
      // do NOT set global selection here; we’ll only store if user picked
      if(apiKeyId) await ss.setJSON('apiKeys.selectedId', apiKeyId);
    }catch{ setApiKey(''); }
  })(); },[apiKeyId]);

  /* rail updates */
  const saveAssistant=(a:Assistant)=>{
    try{ localStorage.setItem(k(a.id), JSON.stringify(a)); }catch{}
    setAssistants(prev=>{
      const next=prev.map(x=>x.id===a.id?{...a,updatedAt:Date.now()}:x);
      localStorage.setItem(K_LIST, JSON.stringify(next));
      return next;
    });
  };
  const createAssistant=()=>{
    const fresh:Assistant = {
      id: uid('agent'),
      name: 'Untitled Agent',
      updatedAt: Date.now(),
      config: { model:{ provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt:'' } }
    };
    try{ localStorage.setItem(k(fresh.id), JSON.stringify(fresh)); }catch{}
    const next=[fresh, ...assistants]; localStorage.setItem(K_LIST, JSON.stringify(next));
    setAssistants(next); setActiveId(fresh.id);
  };
  const renameAssistant=(id:string, name:string)=>{
    const cur=assistants.find(a=>a.id===id); if(!cur) return;
    saveAssistant({ ...cur, name });
  };
  const deleteAssistant=(id:string)=>{
    const next=assistants.filter(a=>a.id!==id);
    try{ localStorage.removeItem(k(id)); localStorage.setItem(K_LIST, JSON.stringify(next)); }catch{}
    setAssistants(next);
    if(activeId===id && next[0]) setActiveId(next[0].id);
  };

  /* typing stream */
  useEffect(()=>{ if(!typing) return; setTypedCount(0); if(typingTimer.current) window.clearInterval(typingTimer.current);
    typingTimer.current = window.setInterval(()=> setTypedCount(c=> {
      const step = 6; const n=Math.min(c+step, typing.length);
      if(n>=typing.length && typingTimer.current){ window.clearInterval(typingTimer.current); typingTimer.current=null; }
      return n;
    }), 12);
  },[typing]);
  useEffect(()=>{ if(typingBoxRef.current) typingBoxRef.current.scrollTop=typingBoxRef.current.scrollHeight; },[typedCount]);

  function handleGenerate(){
    if(!active) return;
    const before = active.config.model.systemPrompt || '';
    const ask = genInput.trim();
    if(!ask){ return; }

    // simple: short hint -> template; long -> as-is
    const next = ask.split(/\s+/).length<=6
      ? `You are a ${ask.toLowerCase()}. Keep responses concise. Confirm key details. Politely decline restricted requests.`
      : ask;

    setPreviewPrompt(next);
    setTyping(charDiff(before, next));
    setGenInput('');
  }
  function acceptTyping(){
    if(!active) return;
    const next={ ...active, config:{ ...active.config, model:{ ...active.config.model, systemPrompt: previewPrompt } } };
    saveAssistant(next); setTyping(null);
  }
  function declineTyping(){ setTyping(null); }

  const keyOptions = useMemo(()=> apiKeys.map(k=>({ value:k.id, label:`${k.name}`, sub:`••••${(k.key||'').slice(-4).toUpperCase()}` })), [apiKeys]);
  const numOptions = useMemo(()=> numbers.map(n=>({ value:n.e164||'', label:(n.e164||n.id||'').trim() + (n.label?` — ${n.label}`:'') })), [numbers]);

  if(!active){
    return (
      <div className={`${SCOPE} min-h-screen`} style={{ background:'var(--bg)', color:'var(--text)' }}>
        <Theme />
        <div className="min-h-screen grid place-items-center">
          <div className="section p-8">
            <div className="h">No assistants</div>
            <div className="label mt-1">Create one to get started.</div>
            <div className="mt-4"><button className="btn" onClick={createAssistant}><Plus size={16}/> Create</button></div>
          </div>
        </div>
      </div>
    );
  }

  /* ============================== LAYOUT ============================== */
  return (
    <div className={`${SCOPE} min-h-screen font-sans`} style={{ background:'var(--bg)', color:'var(--text)' }}>
      <Theme />

      {/* left rail */}
      <AssistantRail
        items={assistants} activeId={activeId}
        onSelect={setActiveId} onCreate={createAssistant}
        onRename={renameAssistant} onDelete={deleteAssistant}
      />

      <main style={{ marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--rail-w, 320px))`, padding:'76px clamp(18px,3vw,38px) 80px' }}>
        <div className="max-w-[1200px] mx-auto grid gap-8">
          {/* SECTION: Prompt — generate on top */}
          <section className="section p-6">
            <div className="flex items-center justify-between">
              <div className="h"><FileText size={16} style={{color:BRAND}}/> Prompt</div>
              <div className="flex items-center gap-2">
                <div className="chip text-xs">New agents start empty</div>
                <button onClick={()=> {
                  const next={ ...active, config:{ ...active.config, model:{ ...active.config.model, systemPrompt:'' } } };
                  saveAssistant(next);
                }} className="btn"><RefreshCw size={16}/> Reset</button>
              </div>
            </div>

            {/* Generate row right above editor */}
            <div className="mt-4 subcard p-3">
              <div className="label mb-2">Generate / Edit</div>
              <div className="flex gap-2">
                <input className="input flex-1" placeholder='e.g. "sales agent for roofers" or paste a full prompt'
                       value={genInput} onChange={e=>setGenInput(e.target.value)}
                       onKeyDown={e=>{ if(e.key==='Enter') handleGenerate(); }}/>
                <button className="btn-brand btn" onClick={handleGenerate}><Sparkles size={16}/> Generate</button>
              </div>
            </div>

            {/* Editor OR diff stream */}
            {!typing ? (
              <div className="mt-4">
                <div className="label mb-2">System Prompt</div>
                <textarea rows={18} className="area w-full"
                  placeholder="(Empty)"
                  value={active.config.model.systemPrompt}
                  onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, systemPrompt:e.target.value } } })}/>
                <div className="mt-2 flex gap-2 justify-end">
                  <button className="btn" onClick={()=>navigator.clipboard.writeText(active.config.model.systemPrompt||'').catch(()=>{})}><Copy size={14}/> Copy</button>
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <div className="label mb-2">Proposed Changes (typing + diff)</div>
                <div ref={typingBoxRef} className="area w-full" style={{ whiteSpace:'pre-wrap', maxHeight:560, overflowY:'auto' }}>
                  {(() => {
                    const slice=typing.slice(0, typedCount);
                    const out: JSX.Element[]=[]; let buf=''; let mode:'add'|'del'|'norm'='norm';
                    const flush=()=>{
                      if(!buf) return;
                      if(mode==='add') out.push(<ins key={out.length}>{buf}</ins>);
                      else if(mode==='del') out.push(<del key={out.length}>{buf}</del>);
                      else out.push(<span key={out.length}>{buf}</span>);
                      buf='';
                    };
                    for(const t of slice){
                      const m = t.added ? 'add' : t.removed ? 'del' : 'norm';
                      if(m!==mode){ flush(); mode=m as any; }
                      buf+=t.ch;
                    }
                    flush();
                    if(typedCount < typing.length) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                    return out;
                  })()}
                </div>
                <div className="mt-3 flex items-center gap-2 justify-end">
                  <button className="btn" onClick={()=>setTyping(null)}><X size={16}/> Decline</button>
                  <button className="btn-brand btn" onClick={acceptTyping}><Check size={16}/> Accept</button>
                </div>
              </div>
            )}
          </section>

          {/* SECTION: Config (Provider/Model/First Message) */}
          <section className="section p-6">
            <div className="h"><MessageSquare size={16} style={{color:BRAND}}/> Conversation Setup</div>
            <div className="grid gap-4 mt-4 md:grid-cols-3">
              <div className="subcard p-3">
                <div className="label mb-1">Provider</div>
                <select className="select w-full" value={active.config.model.provider}
                        onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, provider:e.target.value as Provider } } })}>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div className="subcard p-3">
                <div className="label mb-1">Model</div>
                <select className="select w-full" value={active.config.model.model}
                        onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, model:e.target.value as ModelId } } })}>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div className="subcard p-3">
                <div className="label mb-1">First Message Mode</div>
                <select className="select w-full" value={active.config.model.firstMessageMode}
                        onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, firstMessageMode:e.target.value as any } } })}>
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </div>
            </div>
            <div className="subcard p-3 mt-4">
              <div className="label mb-1">First Message</div>
              <input className="input w-full" value={active.config.model.firstMessage}
                     onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, firstMessage:e.target.value } } })}/>
            </div>
          </section>

          {/* SECTION: API Key & Phone Number (dropdowns; NOT auto-loaded) */}
          <section className="section p-6">
            <div className="h"><KeyRound size={16} style={{color:BRAND}}/> Credentials</div>
            <div className="grid gap-4 mt-4 md:grid-cols-3">
              <div className="subcard p-3">
                <div className="label mb-1">OpenAI API Key</div>
                <InlineSelect
                  value={apiKeyId} onChange={setApiKeyId}
                  options={apiKeys.map(k=>({ value:k.id, label:k.name, sub:`••••${(k.key||'').slice(-4).toUpperCase()}` }))}
                  placeholder="Select an API Key…"
                  left={<KeyRound size={14} style={{color:BRAND}}/>}
                />
                <div className="label mt-2">Loaded from your API Keys page (scoped).</div>
              </div>

              <div className="subcard p-3">
                <div className="label mb-1">From Number</div>
                <InlineSelect
                  value={fromE164} onChange={setFrom}
                  options={numbers.map(n=>({ value:n.e164||'', label:(n.e164||n.id||'').trim() + (n.label?` — ${n.label}`:'') }))}
                  placeholder={numbers.length ? '— Choose —' : 'No numbers imported'}
                  left={<PhoneIcon size={14} style={{color:BRAND}}/>}
                />
                <div className="label mt-2">Used for your telephony backend. Optional here.</div>
              </div>

              <div className="subcard p-3">
                <div className="label mb-1">Status</div>
                <div className="chip text-sm inline-flex items-center gap-2">
                  <div style={{width:8,height:8,borderRadius:999, background: apiKey ? BRAND : '#f87171'}}/>
                  {apiKey ? 'API Key selected' : 'No API Key'}
                </div>
              </div>
            </div>
          </section>

          {/* SECTION: Transcript (no webcam/mic, just a log if you later connect backend) */}
          <section className="section p-6">
            <div className="h"><MessageSquare size={16} style={{color:BRAND}}/> Session Transcript</div>
            <div className="subcard p-3 mt-3">
              {turns.length===0 ? (
                <div className="label">No transcript yet.</div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                  {turns.map((t,i)=>(
                    <div key={i} className="flex gap-2">
                      <div className="text-xs px-2 py-0.5 chip">{t.role==='assistant'?'AI':'You'}</div>
                      <div className="text-sm">{t.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
