// pages/voice.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import {
  Bot, Plus, Trash2, Edit3, Check, Search, ChevronLeft, ChevronRight as ChevronRightIcon,
  FileText, Sparkles, RefreshCw, X, PhoneCall, PhoneOff, MessageSquare, Volume2,
  Mic2, ListTree, Phone as PhoneIcon, Copy, ChevronDown
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ============================================================================
   THEME (light + dark, neon glow, press)
============================================================================ */
const SCOPE = 'voice-studio';
const BRAND = '#00ffc2';
const BRAND_DARK = '#59d9b3';

function ThemeBlock() {
  return (
    <style jsx global>{`
      .${SCOPE}{
        --bg:#f7f9fb;
        --text:#101316;
        --muted:color-mix(in oklab, var(--text) 56%, transparent);
        --panel:#ffffff;
        --card:#ffffff;
        --border:rgba(0,0,0,.10);
        --brand:${BRAND_DARK};
        --ring:rgba(0,255,194,.10);
        --shadow-soft:0 28px 70px rgba(0,0,0,.12),0 12px 28px rgba(0,0,0,.08);
        --shadow-lg:0 42px 110px rgba(0,0,0,.16),0 20px 48px rgba(0,0,0,.10);
        --rail-w:340px;
      }
      [data-theme="dark"] .${SCOPE}{
        --bg:#0b0f11;
        --text:#eef2f5;
        --muted:color-mix(in oklab, var(--text) 68%, transparent);
        --panel:
          radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
          linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
        --card:#0f1315;
        --border:rgba(255,255,255,.10);
        --brand:${BRAND_DARK};
        --ring:rgba(0,255,194,.14);
        --shadow-soft:0 28px 70px rgba(0,0,0,.55),0 12px 28px rgba(0,0,0,.40);
        --shadow-lg:0 48px 120px rgba(0,0,0,.66),0 24px 60px rgba(0,0,0,.50);
      }
      .${SCOPE} .btn{display:inline-flex;align-items:center;gap:.5rem;border-radius:16px;padding:.7rem 1rem;font-size:14px;line-height:1;border:1px solid var(--border);transition:transform .06s ease, box-shadow .12s ease, background .12s ease;}
      .${SCOPE} .btn-ghost{background:var(--card);box-shadow:0 10px 24px rgba(0,0,0,.08);}
      [data-theme="dark"] .${SCOPE} .btn-ghost{box-shadow:0 10px 24px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.04);}
      .${SCOPE} .btn-brand{background:var(--brand);color:#fff;box-shadow:0 10px 24px rgba(0,255,194,.25);}
      .${SCOPE} .btn-brand:hover{transform:translateY(-1px);}
      .${SCOPE} .btn-brand:active{transform:translateY(0);}

      .${SCOPE} .chip{border-radius:14px;padding:.55rem .8rem;background:var(--card);border:1px solid var(--border);box-shadow:0 4px 12px rgba(0,0,0,.10)}
      [data-theme="dark"] .${SCOPE} .chip{box-shadow:0 4px 14px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.05);}

      .${SCOPE} .input{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:.8rem .9rem;outline:none;color:var(--text);box-shadow:inset 0 1px 0 rgba(255,255,255,.10);}
      .${SCOPE} .area{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:1rem;outline:none;color:var(--text);box-shadow:inset 0 1px 0 rgba(255,255,255,.08);}
      .${SCOPE} .panel{background:var(--panel);border:1px solid var(--border);border-radius:26px;box-shadow:var(--shadow-soft);}
      .${SCOPE} .card{background:var(--card);border:1px solid var(--border);border-radius:18px;box-shadow:var(--shadow-soft);}
      .${SCOPE} .icon{color:var(--brand);}

      /* diff colors */
      .${SCOPE} ins{background:rgba(0,255,194,.16); text-decoration:none; border-radius:4px; padding:1px 2px;}
      .${SCOPE} del{background:rgba(255,68,68,.14); color:inherit; border-radius:4px; padding:1px 2px;}

      /* neon focus ring */
      .${SCOPE} .input:focus, .${SCOPE} .area:focus, .${SCOPE} select:focus, .${SCOPE} button:focus{box-shadow:0 0 0 3px var(--ring); outline:none;}
    `}</style>
  );
}

/* ============================================================================
   TYPES & LOCAL STORAGE
============================================================================ */
type Provider = 'openai';
type ModelId = 'gpt-4o'|'gpt-4o-mini'|'gpt-4.1'|'gpt-3.5-turbo';
type Assistant = {
  id: string; name: string; folder?: string; updatedAt: number;
  config: {
    model: { provider: Provider; model: ModelId; firstMessageMode: 'assistant_first'|'user_first'; firstMessage: string; systemPrompt: string };
  };
};
type Turn = { role:'user'|'assistant'; text:string; ts:number };

const K_LIST = 'voice:assistants.v2';
const K_PREFIX = 'voice:assistant:';
const k = (id:string)=> `${K_PREFIX}${id}`;

/* ============================================================================
   SMALL HELPERS
============================================================================ */
const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,8)}${Date.now().toString(36).slice(-4)}`;
const BASE_PROMPT = `You are a helpful, fast, and accurate assistant. Keep it concise. Summarize & confirm when appropriate.`;

/* --- Character diff (LCS) and streamer --- */
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

/* ============================================================================
   ASSISTANT RAIL (inline, compact)
============================================================================ */
function useSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>, fallbackCollapsed:boolean){
  useEffect(()=> {
    const scope=scopeRef.current; if(!scope) return;
    const setVar=(w:number)=>scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const find=()=> (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
                   (document.querySelector('#app-sidebar') as HTMLElement) ||
                   (document.querySelector('.app-sidebar') as HTMLElement) ||
                   (document.querySelector('aside.sidebar') as HTMLElement) || null;
    let el=find(); if(!el){ setVar(fallbackCollapsed?72:248); return; }
    setVar(el.getBoundingClientRect().width);
    const ro=new ResizeObserver(()=>setVar(el!.getBoundingClientRect().width));
    ro.observe(el);
    const mo=new MutationObserver(()=>setVar(el!.getBoundingClientRect().width));
    mo.observe(el,{attributes:true,attributeFilter:['class','style']});
    const onEnd=()=>setVar(el!.getBoundingClientRect().width);
    el.addEventListener('transitionend', onEnd);
    return ()=>{ ro.disconnect(); mo.disconnect(); el.removeEventListener('transitionend', onEnd); };
  },[scopeRef,fallbackCollapsed]);
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
  useSidebarWidth(scopeRef,false);
  const visible=useMemo(()=> items.filter(a=>a.name.toLowerCase().includes(q.trim().toLowerCase())),[items,q]);

  return (
    <div ref={scopeRef}>
      <aside className="hidden lg:flex flex-col"
             style={{position:'fixed', left:'calc(var(--app-sidebar-w, 248px) - 1px)', top:'64px',
                     width: collapsed ? 72 : 'var(--rail-w, 340px)', height:'calc(100vh - 64px)',
                     background:'var(--panel)', borderRight:'1px solid var(--border)', boxShadow:'var(--shadow-soft)', zIndex:10}}>
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="icon" size={16}/> Assistants</div>
          <div className="flex items-center gap-2">
            {!collapsed && <button onClick={onCreate} className="btn btn-brand"><Plus size={14}/> <span className="text-white">Create</span></button>}
            <button onClick={()=>setCollapsed(v=>!v)} className="btn btn-ghost" title={collapsed?'Expand':'Collapse'}>
              {collapsed ? <ChevronRightIcon size={16} className="icon"/> : <ChevronLeft size={16} className="icon"/>}
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          {!collapsed && (
            <div className="flex items-center gap-2 chip mb-2">
              <Search size={14} className="icon"/><input className="bg-transparent outline-none text-sm w-full"
                placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} />
            </div>
          )}

          <div className="mt-2 space-y-2">
            {visible.map(a=>{
              const isActive=a.id===activeId;
              const isEdit=editing===a.id;
              if(collapsed){
                return (
                  <button key={a.id} onClick={()=>onSelect(a.id)} title={a.name}
                    className="w-full rounded-xl p-3 grid place-items-center"
                    style={{background:isActive?'color-mix(in oklab, var(--brand) 12%, transparent)':'var(--card)', border:'1px solid var(--border)'}}>
                    <Bot size={16} className="icon"/>
                  </button>
                );
              }
              return (
                <div key={a.id} className="card p-3" style={{ background:isActive?'color-mix(in oklab, var(--brand) 10%, var(--card))':'var(--card)' }}>
                  <button onClick={()=>onSelect(a.id)} className="w-full text-left flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot size={16} className="icon"/>
                        {!isEdit ? <span className="truncate">{a.name}</span> : (
                          <input autoFocus className="input px-2 py-1 w-full" value={temp}
                            onChange={e=>setTemp(e.target.value)}
                            onKeyDown={(e)=>{ if(e.key==='Enter'){ onRename(a.id, (temp||'').trim()||'Untitled'); setEditing(null); }
                                              if(e.key==='Escape') setEditing(null); }} />
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color:'var(--muted)' }}>
                        {a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isActive ? <Check size={16} className="icon"/> : null}
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={()=>{ setEditing(a.id); setTemp(a.name); }} className="btn btn-ghost text-xs"><Edit3 size={14} className="icon"/> Rename</button>
                        <button onClick={()=>onDelete(a.id)} className="btn text-xs" style={{ background:'rgba(220,38,38,.12)', borderColor:'rgba(220,38,38,.35)', color:'#fca5a5' }}>
                          <Trash2 size={14}/> Delete
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={()=>{ onRename(a.id, (temp||'').trim()||'Untitled'); setEditing(null); }} className="btn btn-brand text-xs"><Check size={14}/> <span className="text-white">Save</span></button>
                        <button onClick={()=>setEditing(null)} className="btn btn-ghost text-xs">Cancel</button>
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

/* ============================================================================
   WEB CALL (SR + TTS + fetch /api/voice/chat with x-openai-key)
============================================================================ */
function WebCallInline({
  greet, voiceLabel, systemPrompt, model, apiKey, fromE164, onTurn
}:{
  greet:string; voiceLabel:string; systemPrompt:string; model:string; apiKey:string; fromE164:string;
  onTurn:(role:'user'|'assistant',text:string)=>void;
}){
  const [live,setLive]=useState(false);
  const recRef=useRef<SpeechRecognition & { start:()=>void; stop:()=>void } | null>(null);

  async function ensureVoices():Promise<SpeechSynthesisVoice[]>{
    const synth=window.speechSynthesis; let v=synth.getVoices(); if(v.length) return v;
    await new Promise<void>(res=>{ const t=setInterval(()=>{ v=synth.getVoices(); if(v.length){ clearInterval(t); res(); } },50); setTimeout(res,1200);});
    return window.speechSynthesis.getVoices();
  }
  function pickVoice(vs:SpeechSynthesisVoice[]){
    const l=(voiceLabel||'').toLowerCase();
    const prefs = l.includes('ember') ? ['Samantha','Google US English','Serena','Alex','Aria']
                : l.includes('alloy') ? ['Alex','Daniel','Google UK English Male','David']
                : ['Google US English','Samantha','Alex','Daniel'];
    for(const p of prefs){ const v=vs.find(v=>v.name.toLowerCase().includes(p.toLowerCase())); if(v) return v; }
    return vs.find(v=>/en-|english/i.test(`${v.lang} ${v.name}`)) || vs[0];
  }
  async function speak(text:string){
    const synth=window.speechSynthesis; try{synth.cancel();}catch{}
    const u=new SpeechSynthesisUtterance(text); u.voice=pickVoice(await ensureVoices()); u.rate=1; u.pitch=.95;
    synth.speak(u);
  }

  function makeRecognizer(onFinal:(t:string)=>void){
    const C:any=(window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if(!C) return null;
    const r: any=new C(); r.continuous=true; r.interimResults=true; r.lang='en-US';
    r.onresult=(e:SpeechRecognitionEvent)=>{ let fin=''; for(let i=e.resultIndex;i<e.results.length;i++){ const res=e.results[i]; if(res.isFinal) fin+=res[0].transcript; } if(fin.trim()) onFinal(fin.trim()); };
    (r as any)._keep=true; r.onend=()=>{ if((r as any)._keep){ try{ r.start(); }catch{} } };
    return r;
  }

  async function ask(userText:string):Promise<string>{
    if(!apiKey){
      const msg = 'Pick an OpenAI API Key above, then try again.';
      onTurn('assistant', msg); await speak(msg); return '';
    }
    const r=await fetch('/api/voice/chat', {
      method:'POST',
      headers:{ 'content-type':'application/json', 'x-openai-key': apiKey },
      body: JSON.stringify({ model, system: systemPrompt, user: userText, fromE164 })
    });
    if(!r.ok) throw new Error('I could not reach the model. Check your OpenAI key.');
    const j=await r.json(); return (j?.text || 'Understood.').trim();
  }

  async function start(){
    onTurn('assistant', greet); await speak(greet);
    const rec=makeRecognizer(async (finalText)=>{
      onTurn('user', finalText);
      try{
        const reply=await ask(finalText);
        if(reply){ onTurn('assistant', reply); await speak(reply); }
      }catch(e:any){
        const msg = e?.message || 'I could not reach the model. Check your OpenAI key.';
        onTurn('assistant', msg); await speak(msg);
      }
    });
    if(!rec){
      const msg='Speech recognition is not available in this browser.';
      onTurn('assistant', msg); await speak(msg); return;
    }
    recRef.current=rec; try{ rec.start(); }catch{} setLive(true);
  }
  function stop(){
    const r:any=recRef.current; if(r){ r._keep=false; try{ r.stop(); }catch{} }
    recRef.current=null; try{ window.speechSynthesis.cancel(); }catch{} setLive(false);
  }

  return !live ? (
    <button onClick={start} className="btn btn-brand"><PhoneCall size={16}/><span className="text-white">Start Web Call</span></button>
  ) : (
    <button onClick={stop} className="btn" style={{ background:'rgba(220,38,38,.12)', borderColor:'rgba(220,38,38,.35)', color:'#fca5a5' }}>
      <PhoneOff size={16}/> End Call
    </button>
  );
}

/* ============================================================================
   MAIN PAGE
============================================================================ */
export default function VoicePage(){
  const [assistants,setAssistants]=useState<Assistant[]>([]);
  const [activeId,setActiveId]=useState('');
  const active=useMemo(()=>assistants.find(a=>a.id===activeId) || null,[assistants,activeId]);

  const [apiKeys,setApiKeys]=useState<Array<{id:string;name:string;key:string}>>([]);
  const [apiKeyId,setApiKeyId]=useState('');
  const [apiKey,setApiKey]=useState(''); // actual secret used in header

  const [numbers,setNumbers]=useState<Array<{id:string;e164?:string;label?:string;provider?:string;status?:string}>>([]);
  const [fromE164,setFrom]=useState('');

  const [genOpen,setGenOpen]=useState(false);
  const [genInput,setGenInput]=useState('');
  const [typing,setTyping]=useState<Tok[]|null>(null);
  const [typedCount,setTypedCount]=useState(0);
  const [previewPrompt,setPreviewPrompt]=useState('');
  const typingBoxRef=useRef<HTMLDivElement|null>(null);
  const typingTimer=useRef<number| null>(null);

  const [turns,setTurns]=useState<Turn[]>([]);

  /* ---------- bootstrap storage ---------- */
  useEffect(()=> {
    // load assistants
    const ls = typeof window!=='undefined' ? localStorage.getItem(K_LIST) : null;
    let list:Assistant[]=[];
    try{ list = ls ? JSON.parse(ls) : []; }catch{}
    if(!list.length){
      const seed:Assistant = {
        id: uid('agent'),
        name: 'My First Voice Agent',
        updatedAt: Date.now(),
        config: { model:{ provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello. How may I help you today?', systemPrompt:'' } }
      };
      list=[seed];
      localStorage.setItem(K_LIST, JSON.stringify(list));
      localStorage.setItem(k(seed.id), JSON.stringify(seed));
    }
    setAssistants(list); setActiveId(list[0].id);

    // load API keys from scoped storage
    (async()=>{
      try{
        const ss=await scopedStorage(); await ss.ensureOwnerGuard();
        const saved=await ss.getJSON<Array<{id:string;name:string;key:string}>>('apiKeys.v1', []);
        const cleaned=(Array.isArray(saved)?saved:[]).filter(Boolean).map(x=>({id:String(x.id),name:String(x.name),key:String(x.key)}));
        setApiKeys(cleaned);

        // global selection or first
        const chosen=await ss.getJSON<string>('apiKeys.selectedId','');
        const pick = (chosen && cleaned.some(k=>k.id===chosen)) ? chosen : (cleaned[0]?.id || '');
        setApiKeyId(pick);
      }catch{}
    })();

    // phone numbers (from your telephony endpoint)
    (async()=>{
      try{
        const r=await fetch('/api/telephony/phone-numbers',{ cache:'no-store' });
        const j=await r.json();
        const list = j?.ok ? j.data : j;
        setNumbers(Array.isArray(list) ? list : []);
      }catch{ setNumbers([]); }
    })();
  },[]);

  // keep apiKey in sync with selected id (client-only; never expose server-side)
  useEffect(()=>{ (async()=>{
    try{
      const ss=await scopedStorage();
      const all=await ss.getJSON<Array<{id:string;name:string;key:string}>>('apiKeys.v1', []);
      const hit=Array.isArray(all)?all.find(k=>k.id===apiKeyId):null;
      setApiKey(hit?.key || '');
      if(apiKeyId) await ss.setJSON('apiKeys.selectedId', apiKeyId);
    }catch{ setApiKey(''); }
  })(); },[apiKeyId]);

  /* ---------- rail ops ---------- */
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

  /* ---------- typing stream ---------- */
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
    if(!ask){ setGenOpen(false); return; }

    // very simple merge: if user gives short hint, compose a base; else treat as full prompt replacement
    const next = ask.split(/\s+/).length<=6
      ? `You are a ${ask.toLowerCase()}.\n\nKeep answers short. Confirm critical details.\n\nSafety: decline restricted actions politely.`
      : ask;

    setPreviewPrompt(next);
    setTyping(charDiff(before, next));
    setGenOpen(false); setGenInput('');
  }
  function acceptTyping(){
    if(!active) return;
    const next={ ...active, config:{ ...active.config, model:{ ...active.config.model, systemPrompt: previewPrompt } } };
    saveAssistant(next); setTyping(null);
  }
  function declineTyping(){ setTyping(null); }

  /* ---------- dropdown helpers ---------- */
  const keyOptions = useMemo(()=> apiKeys.map(k=>({ value:k.id, label:`${k.name}`, sub:`••••${(k.key||'').slice(-4).toUpperCase()}` })), [apiKeys]);
  const numOptions = useMemo(()=> numbers.map(n=>({ value:n.e164||'', label:(n.e164||n.id||'').trim() + (n.label?` — ${n.label}`:'') })), [numbers]);

  /* ---------- derived safe active ---------- */
  if(!active){
    return (
      <div className={`${SCOPE} min-h-screen`} style={{ background:'var(--bg)', color:'var(--text)' }}>
        <ThemeBlock />
        <div className="min-h-screen grid place-items-center">
          <div className="panel p-8">
            <div className="text-xl font-semibold">No assistants</div>
            <div className="text-sm mt-1" style={{ color:'var(--muted)' }}>Create one to get started.</div>
            <div className="mt-4"><button className="btn btn-brand" onClick={createAssistant}><Plus size={16}/><span className="text-white">Create</span></button></div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- main ---------- */
  return (
    <div className={`${SCOPE} min-h-screen font-sans`} style={{ background:'var(--bg)', color:'var(--text)' }}>
      <ThemeBlock />

      <AssistantRail
        items={assistants} activeId={activeId}
        onSelect={setActiveId} onCreate={createAssistant}
        onRename={renameAssistant} onDelete={deleteAssistant}
      />

      <main
        style={{
          marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--rail-w, 340px))`,
          paddingRight:'clamp(20px,4vw,40px)', paddingTop:'76px', paddingBottom:'80px'
        }}
      >
        <div className="grid grid-cols-12 gap-8" style={{ maxWidth:'min(1600px, 98vw)' }}>
          {/* ===================== MODEL CARD ===================== */}
          <section className="col-span-12 panel p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 font-semibold text-sm"><FileText className="icon" size={16}/> Model</div>
              <div className="flex items-center gap-2">
                <button onClick={()=> {
                  const next={ ...active, config:{ ...active.config, model:{ ...active.config.model, systemPrompt:'' } } };
                  saveAssistant(next);
                }} className="btn btn-ghost"><RefreshCw size={16} className="icon"/> Reset</button>
                <button onClick={()=>setGenOpen(true)} className="btn btn-brand"><Sparkles size={16}/><span className="text-white">Generate</span></button>
              </div>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(4, minmax(260px, 1fr))' }}>
              <div>
                <div className="text-[13px] mb-1" style={{ color:'var(--text)' }}>Provider</div>
                <select className="input w-full" value={active.config.model.provider}
                        onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, provider:e.target.value as Provider } } })}>
                  <option value="openai">OpenAI</option>
                </select>
              </div>
              <div>
                <div className="text-[13px] mb-1">Model</div>
                <select className="input w-full" value={active.config.model.model}
                        onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, model:e.target.value as ModelId } } })}>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </div>
              <div>
                <div className="text-[13px] mb-1">First Message Mode</div>
                <select className="input w-full" value={active.config.model.firstMessageMode}
                        onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, firstMessageMode:e.target.value as any } } })}>
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </div>
              <div>
                <div className="text-[13px] mb-1">First Message</div>
                <input className="input w-full" value={active.config.model.firstMessage}
                       onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, firstMessage:e.target.value } } })}/>
              </div>
            </div>

            {/* System Prompt editor OR typing diff */}
            {!typing ? (
              <div className="mt-4">
                <div className="text-[13px] mb-1">System Prompt</div>
                <textarea rows={18} className="area w-full"
                          placeholder="(Empty) — New agents start blank, as requested."
                          value={active.config.model.systemPrompt}
                          onChange={e=> saveAssistant({ ...active, config:{ ...active.config, model:{ ...active.config.model, systemPrompt:e.target.value } } })}/>
              </div>
            ) : (
              <div className="mt-4">
                <div className="text-[13px] mb-1">Proposed Prompt (diff streaming)</div>
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
                  <button className="btn btn-ghost" onClick={declineTyping}><X size={16}/> Decline</button>
                  <button className="btn btn-brand" onClick={acceptTyping}><Check size={16}/><span className="text-white">Accept</span></button>
                </div>
              </div>
            )}
          </section>

          {/* ===================== KEYS/NUMBER + WEB CALL ===================== */}
          <section className="col-span-12 panel p-5">
            <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3, minmax(260px, 1fr))' }}>
              <div>
                <div className="text-[13px] mb-1">OpenAI API Key</div>
                <InlineSelect
                  value={apiKeyId} onChange={setApiKeyId}
                  options={keyOptions} placeholder="Select an API Key…"
                  left={<svg width="16" height="16"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor"/></svg>}
                />
                <div className="text-xs mt-1" style={{ color:'var(--muted)' }}>
                  Reads from your <b>API Keys</b> page (scoped storage).
                </div>
              </div>
              <div>
                <div className="text-[13px] mb-1">From Number</div>
                <InlineSelect
                  value={fromE164} onChange={setFrom}
                  options={numOptions} placeholder={numbers.length?'— Choose —':'No numbers imported'}
                  left={<PhoneIcon size={14} className="icon" />}
                />
                <div className="text-xs mt-1" style={{ color:'var(--muted)' }}>
                  Used for identification in your voice backend (optional).
                </div>
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-2">
                  <button className="btn btn-ghost" onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt||'').catch(()=>{})}>
                    <Copy size={14} className="icon"/> Copy Prompt
                  </button>
                  <WebCallInline
                    greet={active.config.model.firstMessage || 'Hello. How may I help you today?'}
                    voiceLabel="Alloy"
                    systemPrompt={(active.config.model.systemPrompt || BASE_PROMPT).trim()}
                    model={active.config.model.model}
                    apiKey={apiKey}
                    fromE164={fromE164}
                    onTurn={(role,text)=> setTurns(t=>[...t,{role,text,ts:Date.now()}])}
                  />
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-6">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2"><Mic2 className="icon" size={16}/> Live Transcript</div>
                <div className="card p-3" style={{ minHeight:180 }}>
                  {turns.length===0 ? <div className="text-sm" style={{ color:'var(--muted)' }}>No transcript yet.</div> : (
                    <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                      {turns.map((t,i)=>(
                        <div key={i} className="flex gap-2">
                          <div className="text-xs px-2 py-0.5 rounded-full chip" style={{ background: t.role==='assistant' ? 'rgba(0,255,194,.12)' : 'var(--card)' }}>
                            {t.role==='assistant' ? 'AI' : 'You'}
                          </div>
                          <div className="text-sm">{t.text}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="col-span-12 lg:col-span-6">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2"><ListTree className="icon" size={16}/> Quick Generate</div>
                <div className="card p-3">
                  <input className="input w-full mb-2" placeholder='e.g. "Sales agent for roofers" or full prompt'
                         value={genInput} onChange={e=>setGenInput(e.target.value)}
                         onKeyDown={e=>{ if(e.key==='Enter') handleGenerate(); }} />
                  <div className="flex items-center justify-end gap-2">
                    <button className="btn btn-ghost" onClick={()=>setGenInput('')}>Clear</button>
                    <button className="btn btn-brand" onClick={handleGenerate}><Sparkles size={16}/><span className="text-white">Generate</span></button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ===================== CALL LOG (simple local) ===================== */}
          <section className="col-span-12 panel p-5">
            <div className="text-sm font-semibold mb-2 flex items-center gap-2"><MessageSquare className="icon" size={16}/> Session Transcript</div>
            <div className="card p-3">
              {turns.length===0 ? <div className="text-sm" style={{ color:'var(--muted)' }}>Talk to your assistant to see messages here.</div> : (
                <div className="space-y-2">
                  {turns.map((t,i)=>(
                    <div key={i} className="flex gap-2">
                      <div className="text-xs px-2 py-0.5 rounded-full chip" style={{ background: t.role==='assistant' ? 'rgba(0,255,194,.12)' : 'var(--card)' }}>
                        {t.role==='assistant' ? 'AI' : 'You'}
                      </div>
                      <div className="text-sm">{t.text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Generate overlay */}
      {genOpen && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,.45)' }}>
          <div className="panel w-full max-w-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="icon" size={16}/> Generate / Edit Prompt</div>
              <button onClick={()=>setGenOpen(false)} className="btn btn-ghost"><X size={16}/></button>
            </div>
            <input className="input w-full mb-3" placeholder={`Examples:
• sales agent
• collect name, phone, date
• full prompt pasted here`}
              value={genInput} onChange={e=>setGenInput(e.target.value)} />
            <div className="flex items-center justify-end gap-2">
              <button onClick={()=>setGenOpen(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleGenerate} className="btn btn-brand"><Sparkles size={16}/><span className="text-white">Generate</span></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   InlineSelect (with portal-free simple menu)
============================================================================ */
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
      <button ref={btnRef} className="w-full chip flex items-center justify-between gap-2 h-[46px]" onClick={()=>setOpen(v=>!v)}>
        <span className="flex items-center gap-2 min-w-0">{left}<span className="truncate">{sel ? sel.label : <span style={{ color:'var(--muted)' }}>{placeholder}</span>}</span></span>
        <span className="text-xs" style={{ color:'var(--muted)' }}>{sel?.sub || ''}</span>
        <ChevronDown size={14} style={{ color:'var(--muted)' }}/>
      </button>

      {open && rect && (
        <div className="fixed z-[9999] p-3 card" style={{ left:rect.left, top:rect.top, width:rect.width }}>
          <div className="chip flex items-center gap-2 mb-3">
            <Search size={14} className="icon"/><input className="bg-transparent outline-none text-sm w-full" placeholder="Search…"
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
