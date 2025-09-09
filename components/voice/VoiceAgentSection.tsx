// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Check, Trash2, Copy, Edit3, FileText, Mic2, BookOpen, PanelLeft,
  RefreshCw, Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff, MessageSquare,
  ListTree, AudioLines, Volume2, Save
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ============================================================================
   Tiny UI atoms (in-file to keep it self-contained)
============================================================================ */
const SCOPE = 'va-scope';
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>{children}</div>);
}
type Item = { value: string; label: string; icon?: React.ReactNode };
function Select({ value, items, onChange, placeholder }: {
  value: string; items: Item[]; onChange: (v: string)=>void; placeholder?: string;
}) {
  const [open,setOpen]=useState(false);
  const [q,setQ]=useState('');
  const btn=useRef<HTMLButtonElement|null>(null);
  const portal=useRef<HTMLDivElement|null>(null);
  const [rect,setRect]=useState<{top:number;left:number;width:number;up:boolean}|null>(null);
  const sel = items.find(i=>i.value===value)||null;
  const filtered = items.filter(i=>i.label.toLowerCase().includes(q.trim().toLowerCase()));
  useEffect(()=>{ if(!open) return; const r=btn.current?.getBoundingClientRect(); if(!r) return;
    const up=r.bottom+320>window.innerHeight; setRect({top:up?r.top:r.bottom,left:r.left,width:r.width,up});
  },[open]);
  useEffect(()=>{ if(!open) return; const on=(e:MouseEvent)=>{ if(btn.current?.contains(e.target as Node) || portal.current?.contains(e.target as Node)) return; setOpen(false); }; window.addEventListener('mousedown', on); return ()=>window.removeEventListener('mousedown', on); },[open]);
  return (
    <>
      <button ref={btn} type="button" onClick={()=>setOpen(v=>!v)} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
        style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)' }}>
        {sel ? <span className="truncate">{sel.label}</span> : <span className="opacity-70">{placeholder||'Select…'}</span>}
        <span className="ml-auto" />
        <svg width="16" height="16" viewBox="0 0 24 24" className="opacity-70"><path fill="currentColor" d="M7 10l5 5 5-5z"/></svg>
      </button>
      <AnimatePresence>
        {open && rect && (
          <div ref={portal} className="fixed z-[9999] p-3 rounded-xl"
            style={{ top: rect.up?rect.top-8:rect.top+8, left: rect.left, width: rect.width, transform: rect.up?'translateY(-100%)':'none',
              background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)'}}>
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg"
              style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              <Search className="w-4 h-4" /><input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it=>(
                <button key={it.value} onClick={()=>{ onChange(it.value); setOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-[10px]" style={{ color:'var(--text)' }}>
                  {it.label}
                </button>
              ))}
              {filtered.length===0 && <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>}
            </div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
function Section({ title, icon, children }:{ title:string; icon:React.ReactNode; children:React.ReactNode }) {
  return (
    <div className="col-span-12 rounded-xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)'}}>
      <div className="w-full flex items-center justify-between px-5 py-4"><span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span></div>
      <div className="px-5 pb-5">{children}</div>
    </div>
  );
}
function DeleteModal({ open, name, onCancel, onConfirm }:{
  open:boolean; name:string; onCancel:()=>void; onConfirm:()=>void;
}) {
  if(!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" style={{ background:'rgba(0,0,0,.55)' }}>
      <div className="w-full max-w-md rounded-2xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="text-sm font-semibold" style={{ color:'var(--text)' }}>Delete Assistant</div>
          <button onClick={onCancel}><svg width="18" height="18"><path d="M3 3l12 12M15 3L3 15" stroke="currentColor" strokeWidth="2"/></svg></button>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color:'var(--text-muted)' }}>
          Delete <span style={{ color:'var(--text)' }}>“{name}”</span>? This cannot be undone.
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn--ghost">Cancel</button>
          <button onClick={onConfirm} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </div>
    </div>
  );
}
function StyleBlock(){ return (<style jsx global>{`
.${SCOPE}{
  --accent:#10b981; --bg:#0b0c10; --text:#eef2f5; --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:#0f1315; --va-border:rgba(255,255,255,.10); --va-input-bg:rgba(255,255,255,.03);
  --va-input-border:rgba(255,255,255,.14); --va-menu-bg:#101314; --va-menu-border:rgba(255,255,255,.16);
}
:root:not([data-theme="dark"]) .${SCOPE}{
  --bg:#f7f9fb; --text:#101316; --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
  --va-card:#ffffff; --va-border:rgba(0,0,0,.10); --va-input-bg:#ffffff;
  --va-input-border:rgba(0,0,0,.12); --va-menu-bg:#ffffff; --va-menu-border:rgba(0,0,0,.10);
}
.btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:14px; padding:.65rem 1rem; font-size:14px; border:1px solid var(--va-border); }
.btn--green{ background:#10b981; color:#fff; }
.btn--ghost{ background:var(--va-card); color:var(--text); }
.btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; border-color:rgba(220,38,38,.35); }
`}</style>);}

/* ============================================================================
   Types & Local state
============================================================================ */
type Provider = 'openai';
type ModelId = 'gpt-4o'|'gpt-4o-mini'|'gpt-4.1'|'gpt-3.5-turbo';
type VoiceProvider = 'openai'|'elevenlabs';

type TranscriptTurn = { role:'assistant'|'user'; text:string; ts:number };
type CallLog = {
  id:string; assistantId:string; assistantName:string; startedAt:number; endedAt?:number; endedReason?:string;
  type:'Web'; assistantPhoneNumber?: string; transcript: TranscriptTurn[];
};
type RegistryOpenAIKey = { id:string; name:string; key:string };
type RegistryPhone     = { id:string; label?:string; e164:string };

type Assistant = {
  id:string; name:string; folder?:string; updatedAt:number; published?:boolean;
  config:{
    model:{ provider:Provider; model:ModelId; firstMessageMode:'assistant_first'|'user_first'; firstMessage:string; systemPrompt:string; temperature?:number; openaiKeyId?:string; };
    voice:{ provider:VoiceProvider; voiceId:string; voiceLabel:string };
    transcriber:{ provider:'deepgram'; model:'nova-2'|'nova-3'; language:'en'|'multi'; denoise:boolean; confidenceThreshold:number; numerals:boolean; };
    tools:{ enableEndCall:boolean; dialKeypad:boolean };
    telephony:{ linkedPhoneId?:string };
  };
};

const LS_LIST   = 'voice:assistants.v1';
const LS_CALLS  = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const ak = (id:string)=>`voice:assistant:${id}`;
const readLS = <T,>(k:string):T|null => { try{ const r=localStorage.getItem(k); return r?JSON.parse(r) as T:null; }catch{ return null; } };
const writeLS = <T,>(k:string,v:T)=>{ try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };

/* ============================================================================
   Scoped-storage buckets (match Step2ModelSettings)
============================================================================ */
const KEY_BUCKETS = ['apiKeys.v1','apiKeys'] as const;
const KEY_SELECTED = 'apiKeys.selectedId';
const PN_BUCKETS  = ['phoneNumbers.v1','phoneNumbers'] as const;

/* ============================================================================
   Prompt + Speech
============================================================================ */
const BASE_PROMPT = `[Identity]
You are a friendly, fast, accurate voice assistant.

[Style]
* Natural, conversational, concise.
* Answer questions normally; ask for missing info one step at a time.

[System Behaviors]
* Confirm key details before finalizing.
* Offer next steps where helpful.

[Task & Goals]
* Understand the user and help them complete tasks or get answers.

[Data to Collect]
- Full Name
- Phone Number
- Email (if provided)
- Appointment Date/Time (if applicable)

[Safety]
* No medical/legal/financial advice beyond high-level pointers.
* Decline restricted actions; suggest alternatives.`.trim();

/* ---------- Speech recognition ---------- */
function makeRecognizer(onFinal:(t:string)=>void){
  const SR:any=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition; if(!SR) return null;
  const r=new SR(); r.continuous=true; r.interimResults=true; r.lang='en-US';
  r.onresult=(e:any)=>{ let final=''; for(let i=e.resultIndex;i<e.results.length;i++){ if(e.results[i].isFinal) final+=e.results[i][0].transcript; } if(final.trim()) onFinal(final.trim()); };
  return r;
}

/* ---------- ElevenLabs (old working style) + browser fallback ---------- */
async function ttsElevenLabs(text:string, voiceId:string){
  const r=await fetch('/api/tts/elevenlabs',{ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ text, voiceId })});
  if(!r.ok) throw new Error(await r.text());
  const blob=await r.blob(); const url=URL.createObjectURL(blob); const a=new Audio(url); await a.play(); a.onended=()=>URL.revokeObjectURL(url);
}
async function ttsFallback(text:string){
  const s=window.speechSynthesis; const u=new SpeechSynthesisUtterance(text);
  const vs=s.getVoices(); u.voice = vs.find(v=>/US|en-US/i.test(`${v.name} ${v.lang}`)) || vs[0]; s.cancel(); s.speak(u);
}
async function speak(text:string, provider:VoiceProvider, voiceId:string){
  try{ if(provider==='elevenlabs'){ await ttsElevenLabs(text, voiceId); return; } }catch(e){ console.warn('TTS fallback', e); }
  await ttsFallback(text);
}

/* ============================================================================
   Component
============================================================================ */
export default function VoiceAgentSection(){
  /* ----- load registries from scoped storage (matches Step 2) ----- */
  const [apiKeys, setApiKeys]   = useState<RegistryOpenAIKey[]>([]);
  const [phones,  setPhones]    = useState<RegistryPhone[]>([]);
  const [selectedKeyId, setSelectedKeyId] = useState<string>('');
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState<string>('');

  useEffect(()=>{ (async()=>{
    try{
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      // API keys
      let keys:RegistryOpenAIKey[] = [];
      for (const b of KEY_BUCKETS){
        const v = await ss.getJSON<RegistryOpenAIKey[]>(b, []);
        if (Array.isArray(v) && v.length){ keys = v.filter(Boolean).map(k=>({ id:String(k.id), name:String(k.name), key:String(k.key) })); break; }
      }
      setApiKeys(keys);
      const selId = await ss.getJSON<string>(KEY_SELECTED, '');
      if (selId && keys.some(k=>k.id===selId)) setSelectedKeyId(selId);
      else if (keys[0]?.id) { setSelectedKeyId(keys[0].id); await ss.setJSON(KEY_SELECTED, keys[0].id); }

      // Phones
      let pns:RegistryPhone[] = [];
      for (const b of PN_BUCKETS){
        const v = await ss.getJSON<RegistryPhone[]>(b, []);
        if (Array.isArray(v) && v.length){ pns = v.filter(Boolean).map(p=>({ id:String(p.id), label:p.label?String(p.label):undefined, e164:String(p.e164) })); break; }
      }
      setPhones(pns);

      setLoaded(true);
    }catch(e:any){ setLoadErr(e?.message || 'Failed to load keys/phones'); setLoaded(true); }
  })(); },[]);

  const resolveKeyById = (id?:string)=> (id ? apiKeys.find(k=>k.id===id)?.key : apiKeys.find(Boolean)?.key) || '';
  const resolvePhoneById = (id?:string)=> (id ? phones.find(p=>p.id===id) : undefined);

  /* ----- assistants ----- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query,setQuery]=useState('');
  const [editingId,setEditingId]=useState<string|null>(null);
  const [tempName,setTempName]=useState('');
  const [deleting,setDeleting]=useState<{id:string;name:string}|null>(null);
  const [rev,setRev]=useState(0);

  useEffect(()=>{
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if(!list.length){
      const seed:Assistant = {
        id:'riley', name:'Riley', folder:'Voice', updatedAt:Date.now(), published:false,
        config:{
          model:{ provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello! How can I help today?', systemPrompt:BASE_PROMPT, temperature:0.5, openaiKeyId: '' },
          voice:{ provider:'elevenlabs', voiceId:'Rachel', voiceLabel:'Rachel (US)' },
          transcriber:{ provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools:{ enableEndCall:true, dialKeypad:true },
          telephony:{ linkedPhoneId: undefined }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    }else{
      writeLS(LS_LIST, list); setAssistants(list); setActiveId(list[0].id);
    }
    if (!readLS<CallLog[]>(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS<Record<string,string>>(LS_ROUTES)) writeLS(LS_ROUTES, {});
  },[]);

  // Default assistant key id (once registries are loaded)
  useEffect(()=>{
    if(!loaded || !activeId) return;
    const a = readLS<Assistant>(ak(activeId)); if(!a) return;
    if(!a.config.model.openaiKeyId){
      const idToUse = selectedKeyId || apiKeys[0]?.id || '';
      if (idToUse){
        const next:Assistant = { ...a, config:{ ...a.config, model:{ ...a.config.model, openaiKeyId: idToUse } } };
        writeLS(ak(next.id), next);
        const list = (readLS<Assistant[]>(LS_LIST) || []).map(x=>x.id===next.id?{...x, updatedAt:Date.now()}:x);
        writeLS(LS_LIST, list); setAssistants(list); setRev(r=>r+1);
      }
    }
  },[loaded, selectedKeyId, activeId, apiKeys]);

  const active = useMemo(()=> activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId, rev]);
  const updateActive = (mut:(a:Assistant)=>Assistant) => {
    if(!active) return;
    const next = mut(active); writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x=> x.id===next.id ? { ...x, name:next.name, folder:next.folder, updatedAt:Date.now(), published:next.published } : x);
    writeLS(LS_LIST, list); setAssistants(list); setRev(r=>r+1);
  };

  const addAssistant = async ()=>{
    const id=`agent_${Math.random().toString(36).slice(2,8)}`;
    const a:Assistant = {
      id, name:'New Assistant', updatedAt:Date.now(), published:false,
      config:{
        model:{ provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello!', systemPrompt:'', temperature:0.5, openaiKeyId: selectedKeyId || apiKeys[0]?.id },
        voice:{ provider:'elevenlabs', voiceId:'Rachel', voiceLabel:'Rachel (US)' },
        transcriber:{ provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools:{ enableEndCall:true, dialKeypad:true },
        telephony:{ linkedPhoneId: undefined }
      }
    };
    writeLS(ak(id), a); const list=[...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id); setEditingId(id); setTempName('New Assistant');
  };
  const removeAssistant = (id:string)=>{
    const list = assistants.filter(a=>a.id!==id); writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id)); if(activeId===id && list.length) setActiveId(list[0].id); if(!list.length) setActiveId(''); setRev(r=>r+1);
  };

  /* ----- voices (US stock) ----- */
  const openaiVoices=[{value:'alloy',label:'Alloy (Browser)'},{value:'ember',label:'Ember (Browser)'}];
  const elevenVoices=[{value:'Rachel',label:'Rachel (US)'},{value:'Adam',label:'Adam (US)'},{value:'Bella',label:'Bella (US)'}];
  const [pendingVoiceId,setPendingVoiceId]=useState<string|null>(null);
  const [pendingVoiceLabel,setPendingVoiceLabel]=useState<string|null>(null);
  useEffect(()=>{ if(active){ setPendingVoiceId(active.config.voice.voiceId); setPendingVoiceLabel(active.config.voice.voiceLabel);} },[active?.id]);
  const handleVoiceProviderChange=(v:string)=>{
    const list = v==='elevenlabs'?elevenVoices:openaiVoices;
    setPendingVoiceId(list[0].value); setPendingVoiceLabel(list[0].label);
    updateActive(a=>({...a, config:{...a.config, voice:{ provider:v as VoiceProvider, voiceId:list[0].value, voiceLabel:list[0].label }}}));
  };
  const handleVoiceIdChange=(v:string)=>{
    if(!active) return;
    const list = active.config.voice.provider==='elevenlabs'?elevenVoices:openaiVoices;
    const found = list.find(x=>x.value===v); setPendingVoiceId(v); setPendingVoiceLabel(found?.label||v);
  };
  const saveVoice=async()=>{
    if(!active||!pendingVoiceId) return;
    updateActive(a=>({...a, config:{...a.config, voice:{...a.config.voice, voiceId:pendingVoiceId, voiceLabel:pendingVoiceLabel||pendingVoiceId}}}));
    await speak('Voice saved.', active.config.voice.provider, pendingVoiceId);
  };
  const testVoice=async()=>{ if(!active||!pendingVoiceId) return; await speak('This is a quick preview of the selected voice.', active.config.voice.provider, pendingVoiceId); };

  /* ----- call & chat ----- */
  const [currentCallId,setCurrentCallId]=useState<string|null>(null);
  const [transcript,setTranscript]=useState<TranscriptTurn[]>([]);
  const recogRef=useRef<any|null>(null);
  const historyRef=useRef<{role:'system'|'user'|'assistant';content:string}[]>([]);

  function pushTurn(role:'assistant'|'user', text:string){
    const turn={ role, text, ts:Date.now() };
    setTranscript(t=>{
      const next=[...t, turn];
      if(currentCallId){
        const calls=readLS<CallLog[]>(LS_CALLS) || [];
        const idx=calls.findIndex(c=>c.id===currentCallId);
        if(idx>=0){ calls[idx]={...calls[idx], transcript:[...calls[idx].transcript, turn]}; writeLS(LS_CALLS, calls); }
      }
      return next;
    });
  }

  async function chatLLM(userText:string):Promise<string>{
    if(!active) return 'Understood.';
    const sys=active.config.model.systemPrompt || BASE_PROMPT;
    const keyId = active.config.model.openaiKeyId || selectedKeyId;
    const openaiKey = resolveKeyById(keyId);
    historyRef.current.push({ role:'user', content:userText });
    const resp = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        agent:{ name:active.name, prompt:sys, model:active.config.model.model, temperature:active.config.model.temperature ?? 0.5, apiKey: openaiKey },
        messages: [{ role:'system', content: sys }, ...historyRef.current]
      })
    });
    if(!resp.ok){ const err=await resp.text().catch(()=> 'Chat server error.'); return `Sorry, I hit an error: ${err}`; }
    const data = await resp.json().catch(()=> ({}));
    const text = (data?.reply||'').trim() || '…';
    historyRef.current.push({ role:'assistant', content:text });
    return text;
  }

  async function startCall(){
    if(!active) return;
    if(!loaded){ alert('Loading keys…'); return; }
    const id=`call_${crypto.randomUUID?.()||Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id); setTranscript([]); historyRef.current=[];
    const linkedPhone = resolvePhoneById(active.config.telephony?.linkedPhoneId);
    const calls=readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId:active.id, assistantName:active.name, startedAt:Date.now(), type:'Web', assistantPhoneNumber:linkedPhone?.e164, transcript:[] });
    writeLS(LS_CALLS, calls);

    const greet = active.config.model.firstMessage || 'Hello! How can I help today?';
    const sys = active.config.model.systemPrompt || BASE_PROMPT;
    historyRef.current = [{ role:'system', content: sys }];
    if (active.config.model.firstMessageMode==='assistant_first'){
      pushTurn('assistant', greet);
      await speak(greet, active.config.voice.provider, active.config.voice.voiceId);
      historyRef.current.push({ role:'assistant', content:greet });
    }

    const rec = makeRecognizer(async (finalText:string)=>{
      pushTurn('user', finalText);
      const reply = await chatLLM(finalText);
      pushTurn('assistant', reply);
      await speak(reply, active.config.voice.provider, active.config.voice.voiceId);
    });
    if(!rec){
      const msg='Speech recognition is unavailable here. Use Chrome/Edge.';
      pushTurn('assistant', msg); await speak(msg, active.config.voice.provider, active.config.voice.voiceId); return;
    }
    recogRef.current=rec; try{ rec.start(); }catch{}
  }
  function endCall(reason:string){
    if(recogRef.current){ try{ recogRef.current.stop(); }catch{} recogRef.current=null; }
    window.speechSynthesis.cancel();
    if(!currentCallId) return;
    const calls=(readLS<CallLog[]>(LS_CALLS)||[]).map(c=>c.id===currentCallId?{...c, endedAt:Date.now(), endedReason:reason}:c);
    writeLS(LS_CALLS, calls); setCurrentCallId(null);
  }

  /* ----- UI helpers ----- */
  const callsForAssistant=(readLS<CallLog[]>(LS_CALLS)||[]).filter(c=>c.assistantId===active?.id);
  const visible = assistants.filter(a=>a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const beginRename=(a:Assistant)=>{ setEditingId(a.id); setTempName(a.name); };
  const saveRename=(a:Assistant)=>{
    const name=(tempName||'').trim()||'Untitled';
    if(a.id===activeId) updateActive(x=>({...x, name}));
    else{
      const cur=readLS<Assistant>(ak(a.id)); if(cur) writeLS(ak(a.id), {...cur, name, updatedAt:Date.now()});
      const list=(readLS<Assistant[]>(LS_LIST)||[]).map(x=>x.id===a.id?{...x, name, updatedAt:Date.now()}:x);
      writeLS(LS_LIST, list); setAssistants(list); setRev(r=>r+1);
    }
    setEditingId(null);
  };

  const publish=()=>{
    if(!active) return;
    const p = resolvePhoneById(active.config.telephony?.linkedPhoneId);
    if(!p){ alert('Pick a linked phone from Phone Numbers (scoped storage) before publishing.'); return; }
    const routes=readLS<Record<string,string>>(LS_ROUTES)||{}; routes[p.id]=active.id; writeLS(LS_ROUTES, routes);
    updateActive(a=>({...a, published:true}));
    alert(`Published! ${p.e164} is now linked to ${active.name}.`);
  };

  if(!active){
    return (<div className={SCOPE}><div className="px-6 py-10 opacity-70">Create your first assistant.</div><StyleBlock /></div>);
  }

  /* ============================================================================
     Render
  ============================================================================ */
  return (
    <div className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* LEFT RAIL */}
      <aside className="hidden lg:flex flex-col" style={{ position:'fixed', left:'calc(var(--app-sidebar-w, 248px) - 1px)', top:'var(--app-header-h, 64px)', width:'360px', height:'calc(100vh - var(--app-header-h, 64px))', borderRight:'1px solid var(--va-border)', background:'var(--va-card)'}}>
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold"><PanelLeft className="w-4 h-4" /> Assistants</div>
          <button onClick={addAssistant} className="btn btn--green"><Plus className="w-3.5 h-3.5 text-white" /><span className="text-white">Create</span></button>
        </div>
        <div className="p-3 min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
            <Search className="w-4 h-4" /><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Search assistants" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
          </div>
          <div className="mt-4 space-y-2">
            {visible.map(a=>{
              const isActive=a.id===activeId; const isEdit=editingId===a.id;
              return (
                <div key={a.id} className="w-full rounded-xl p-3" style={{ background: isActive?'color-mix(in oklab, var(--accent) 10%, transparent)':'var(--va-card)', border:`1px solid ${isActive?'color-mix(in oklab, var(--accent) 35%, var(--va-border))':'var(--va-border)'}`}}>
                  <button className="w-full text-left flex items-center justify-between" onClick={()=>setActiveId(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" />
                        {!isEdit ? <span className="truncate">{a.name}</span> :
                        <input autoFocus value={tempName} onChange={(e)=>setTempName(e.target.value)} onKeyDown={(e)=>{ if(e.key==='Enter') saveRename(a); if(e.key==='Escape') setEditingId(null); }} className="bg-transparent rounded-md px-2 py-1 outline-none w-full" style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }}/>}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {isActive ? <Check className="w-4 h-4" /> : null}
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={(e)=>{ e.stopPropagation(); beginRename(a); }} className="btn btn--ghost text-xs"><Edit3 className="w-3.5 h-3.5" /> Rename</button>
                        <button onClick={(e)=>{ e.stopPropagation(); setDeleting({id:a.id, name:a.name}); }} className="btn btn--danger text-xs"><Trash2 className="w-4 h-4" /> Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e)=>{ e.stopPropagation(); saveRename(a); }} className="btn btn--green text-xs"><Check className="w-3.5 h-3.5 text-white" /> <span className="text-white">Save</span></button>
                        <button onClick={(e)=>{ e.stopPropagation(); setEditingId(null); }} className="btn btn--ghost text-xs">Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div className="va-main" style={{ marginLeft:'calc(var(--app-sidebar-w, 248px) + 360px)', padding:'24px 40px 88px' }}>
        {/* top bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky" style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            {!currentCallId ? (
              <button onClick={startCall} className="btn btn--green"><PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Call Assistant</span></button>
            ) : (
              <button onClick={()=> endCall('Ended by user')} className="btn btn--danger"><PhoneOff className="w-4 h-4" /> End Call</button>
            )}
            <button onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail:{ id: active.id } }))} className="btn btn--ghost">
              <MessageSquare className="w-4 h-4" /> Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})} className="btn btn--ghost"><Copy className="w-4 h-4" /> Copy Prompt</button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
            <button onClick={publish} className="btn btn--green"><Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span></button>
          </div>
        </div>

        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(280px, 1fr))' }}>
              <Field label="Provider">
                <Select value={active.config.model.provider} onChange={(v)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, provider:v as Provider}}}))} items={[{ value:'openai', label:'OpenAI' }]} />
              </Field>
              <Field label="Model">
                <Select value={active.config.model.model} onChange={(v)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, model:v as ModelId}}}))}
                  items={[
                    { value:'gpt-4o', label:'GPT-4o' },
                    { value:'gpt-4o-mini', label:'GPT-4o mini' },
                    { value:'gpt-4.1', label:'GPT-4.1' },
                    { value:'gpt-3.5-turbo', label:'GPT-3.5 Turbo' },
                  ]}/>
              </Field>
              <Field label="OpenAI Key (from scoped storage)">
                <Select
                  value={active.config.model.openaiKeyId || ''}
                  onChange={(id)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, openaiKeyId:id||undefined}}}))}
                  items={apiKeys.map(k=>({ value:k.id, label:`${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}` }))}
                  placeholder={loaded ? (apiKeys.length? 'Choose…' : (loadErr || 'No API keys found — add in API Keys page.')) : 'Loading keys…'}
                />
              </Field>
              <Field label="Temperature">
                <input type="number" step={0.1} min={0} max={1} value={active.config.model.temperature ?? 0.5}
                  onChange={(e)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, temperature:Number(e.target.value)}}}))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}/>
              </Field>
            </div>
            <div className="grid gap-6 mt-4" style={{ gridTemplateColumns:'repeat(2, minmax(280px, 1fr))' }}>
              <Field label="First Message Mode">
                <Select value={active.config.model.firstMessageMode} onChange={(v)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, firstMessageMode:v as any}}}))}
                  items={[{ value:'assistant_first', label:'Assistant speaks first' }, { value:'user_first', label:'User speaks first' }]}/>
              </Field>
              <Field label="First Message">
                <input value={active.config.model.firstMessage} onChange={(e)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, firstMessage:e.target.value}}}))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}/>
              </Field>
            </div>
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">System Prompt</div>
                <button onClick={()=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, systemPrompt:BASE_PROMPT}}}))} className="btn btn--ghost"><RefreshCw className="w-4 h-4" /> Reset</button>
              </div>
              <textarea rows={14} value={active.config.model.systemPrompt || ''} onChange={(e)=> updateActive(a=>({...a, config:{...a.config, model:{...a.config.model, systemPrompt:e.target.value}}}))}
                className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', minHeight:320 }}/>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(280px, 1fr))' }}>
              <Field label="Provider">
                <Select value={active.config.voice.provider} onChange={handleVoiceProviderChange}
                  items={[{ value:'elevenlabs', label:'ElevenLabs (US)' }, { value:'openai', label:'Browser Fallback' }]} />
              </Field>
              <Field label="Voice">
                <Select value={pendingVoiceId || active.config.voice.voiceId} onChange={handleVoiceIdChange}
                  items={(active.config.voice.provider==='elevenlabs'
                    ? elevenVoices
                    : openaiVoices
                  )}/>
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={testVoice} className="btn btn--ghost"><Volume2 className="w-4 h-4" /> Test Voice</button>
              <button onClick={saveVoice} className="btn btn--green"><Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span></button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(280px, 1fr))' }}>
              <Field label="Provider"><Select value="deepgram" onChange={()=>{}} items={[{ value:'deepgram', label:'Deepgram' }]} /></Field>
              <Field label="Model"><Select value={active.config.transcriber.model} onChange={(v)=> updateActive(a=>({...a, config:{...a.config, transcriber:{...a.config.transcriber, model:v as any}}}))} items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]} /></Field>
              <Field label="Language"><Select value={active.config.transcriber.language} onChange={(v)=> updateActive(a=>({...a, config:{...a.config, transcriber:{...a.config.transcriber, language:v as any}}}))} items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]} /></Field>
            </div>
          </Section>

          {/* Telephony (scoped storage) */}
          <Section title="Telephony (from Phone Numbers page)" icon={<PhoneIcon className="w-4 h-4" />}>
            <div className="space-y-2">
              {(!loaded) && <div className="text-sm opacity-70">Loading phone numbers…</div>}
              {(loaded && phones.length===0) && <div className="text-sm opacity-70">{loadErr || 'No phone numbers found. Add them on the Phone Numbers page.'}</div>}
              {phones.map(p=>(
                <label key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.label || 'Untitled'}</div>
                    <div className="text-xs opacity-70">{p.e164}</div>
                  </div>
                  <input type="radio" name="linked_phone" checked={active.config.telephony?.linkedPhoneId===p.id}
                    onChange={()=> updateActive(a=>({...a, config:{...a.config, telephony:{ linkedPhoneId:p.id }}}))}/>
                </label>
              ))}
              {phones.length>0 && <div className="text-xs opacity-70">Pick which saved phone to link to this assistant.</div>}
            </div>
          </Section>

          {/* Call */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4" />}>
            <div className="flex items-center gap-2 mb-3">
              {!currentCallId ? (
                <button onClick={startCall} className="btn btn--green"><PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span></button>
              ) : (
                <button onClick={()=> endCall('Ended by user')} className="btn btn--danger"><PhoneOff className="w-4 h-4" /> End Call</button>
              )}
              <div className="text-xs opacity-70">Brain = your OpenAI key from scoped storage. Voice = ElevenLabs (US) when selected.</div>
            </div>
            <div className="rounded-2xl p-3" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              {transcript.length===0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {transcript.map((t, i)=>(
                  <div key={i} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{ background:t.role==='assistant'?'rgba(16,185,129,.15)':'rgba(255,255,255,.06)', border:'1px solid var(--va-border)' }}>
                      {t.role==='assistant' ? 'AI' : 'You'}
                    </div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Logs */}
          <Section title="Call Logs" icon={<ListTree className="w-4 h-4" />}>
            <div className="space-y-3">
              {callsForAssistant.length===0 && <div className="text-sm opacity-60">No calls yet.</div>}
              {callsForAssistant.map(log=>(
                <details key={log.id} className="rounded-xl" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4" />
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                      {log.endedAt ? <span className="opacity-70">• {Math.max(1, Math.round((log.endedAt-log.startedAt)/1000))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t,i)=>(
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{ background:t.role==='assistant'?'rgba(16,185,129,.15)':'rgba(255,255,255,.06)', border:'1px solid var(--va-border)' }}>
                          {t.role==='assistant' ? 'AI' : 'User'}
                        </div>
                        <div className="text-sm">{t.text}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Delete */}
      <AnimatePresence>
        {deleting && <DeleteModal open={true} name={deleting.name} onCancel={()=>setDeleting(null)} onConfirm={()=>{ removeAssistant(deleting.id); setDeleting(null); }} />}
      </AnimatePresence>

      <StyleBlock />
    </div>
  );
}
