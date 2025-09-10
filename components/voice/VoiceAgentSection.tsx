// components/voice/VoiceStudioOne.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot, Check, Copy, Phone as PhoneIcon, PhoneCall, PhoneOff, RefreshCw,
  Rocket, Search, Sparkles, Trash2, X
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

/* ------------ shared keys (exactly what your other pages use) ----------- */
const K_ASSISTANTS = 'voice:assistants.v2';
const K_SELECTED   = 'voice:assistants:selected';
const K_STEP2      = 'voicebuilder:step2';       // { fromE164, apiKeyId } saved by StepV2
const K_APIKEY_SEL = 'apiKeys.selectedId';       // selected OpenAI key id

/* ------------ types ----------------------------------------------------- */
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type Assistant = {
  id: string;
  name: string;
  createdAt: number;
  config: {
    model: { model: ModelId; firstMessage: string; systemPrompt: string };
    voice: { provider: 'openai'|'elevenlabs'; voiceId: string; voiceLabel: string };
  };
};
type Token = { t:'same'|'add'|'del'; ch:string };
type SR = SpeechRecognition & { start:()=>void; stop:()=>void };

/* ------------ helpers --------------------------------------------------- */
const uid = (p='a') => `${p}_${Math.random().toString(36).slice(2,9)}`;

function diffChars(a:string,b:string):Token[]{
  const A=[...a], B=[...b];
  const dp=Array(A.length+1).fill(0).map(()=>Array(B.length+1).fill(0));
  for(let i=A.length-1;i>=0;i--)for(let j=B.length-1;j>=0;j--)
    dp[i][j]=A[i]===B[j]?1+dp[i+1][j+1]:Math.max(dp[i+1][j],dp[i][j+1]);
  const out:Token[]=[]; let i=0,j=0;
  while(i<A.length&&j<B.length){
    if(A[i]===B[j]){out.push({t:'same',ch:B[j]});i++;j++;}
    else if(dp[i+1][j]>=dp[i][j+1]){out.push({t:'del',ch:A[i++]});}
    else {out.push({t:'add',ch:B[j++]});}
  }
  while(i<A.length) out.push({t:'del',ch:A[i++]});
  while(j<B.length) out.push({t:'add',ch:B[j++]});
  return out;
}

function Select({value,items,onChange,placeholder}:{value:string;items:{value:string;label:string}[];onChange:(v:string)=>void;placeholder?:string}){
  return (
    <select value={value} onChange={(e)=>onChange(e.target.value)}
      className="rounded-[12px] px-3 py-2 text-sm border bg-transparent"
      style={{borderColor:'var(--border)',color:'var(--text)'}}>
      {placeholder?<option value="">{placeholder}</option>:null}
      {items.map(it=><option key={it.value} value={it.value}>{it.label}</option>)}
    </select>
  );
}

/* ====================================================================== */
/* ============================ MAIN FILE =============================== */
/* ====================================================================== */
export default function VoiceStudioOne(){
  const [assistants,setAssistants]=useState<Assistant[]>([]);
  const [activeId,setActiveId]=useState('');
  const active=useMemo(()=>assistants.find(a=>a.id===activeId)||null,[assistants,activeId]);

  // key + phone auto-load from storage
  const [apiKeyId,setApiKeyId]=useState('');     // read-only here; badge only
  const [fromE164,setFromE164]=useState('');

  // generate overlay + diff typing
  const [genOpen,setGenOpen]=useState(false);
  const [genText,setGenText]=useState('');
  const [typing,setTyping]=useState<Token[]|null>(null);
  const [typed,setTyped]=useState(0);
  const [pendingPrompt,setPendingPrompt]=useState('');
  const timerRef=useRef<number|null>(null);

  // transcript (right now we just log)
  const [turns,setTurns]=useState<Array<{role:'user'|'assistant'; text:string}>>([]);

  useEffect(()=>{(async()=>{
    const ss=await scopedStorage(); await ss.ensureOwnerGuard();

    // assistants
    let list=await ss.getJSON<Assistant[]>(K_ASSISTANTS, []);
    if(!Array.isArray(list)||!list.length){
      list=[{
        id:uid('agent'), name:'New Assistant', createdAt:Date.now(),
        config:{ model:{ model:'gpt-4o', firstMessage:'', systemPrompt:'' }, voice:{ provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' } }
      }];
      await ss.setJSON(K_ASSISTANTS,list);
    }
    setAssistants(list);

    // selection
    const sel=await ss.getJSON<string>(K_SELECTED, list[0].id);
    setActiveId(list.some(a=>a.id===sel)?sel:list[0].id);

    // key + phone
    const step2=await ss.getJSON<{fromE164?:string;apiKeyId?:string}>(K_STEP2, {} as any);
    const globalKey=await ss.getJSON<string>(K_APIKEY_SEL,'');
    setApiKeyId(step2?.apiKeyId || globalKey || '');
    setFromE164(step2?.fromE164 || '');
  })();},[]);

  useEffect(()=>{(async()=>{
    const ss=await scopedStorage(); await ss.setJSON(K_ASSISTANTS,assistants);
  })();},[assistants]);

  const patch=(mut:(a:Assistant)=>Assistant)=>setAssistants(arr=>arr.map(a=>a.id===activeId?mut(a):a));
  const create=async()=>{ const a:Assistant={id:uid('agent'),name:'New Assistant',createdAt:Date.now(),
    config:{model:{model:'gpt-4o',firstMessage:'',systemPrompt:''},voice:{provider:'openai',voiceId:'alloy',voiceLabel:'Alloy (OpenAI)'}}};
    setAssistants(x=>[...x,a]); setActiveId(a.id); const ss=await scopedStorage(); await ss.setJSON(K_SELECTED,a.id); };
  const rename=(id:string,name:string)=>setAssistants(xs=>xs.map(a=>a.id===id?{...a,name:name||'Untitled'}:a));
  const remove=(id:string)=>setAssistants(xs=>{const n=xs.filter(a=>a.id!==id); if(activeId===id&&n.length) setActiveId(n[0].id); return n;});

  function startTyping(oldText:string,newText:string){
    const toks=diffChars(oldText || '(empty)', newText);
    setTyping(toks); setTyped(0); setPendingPrompt(newText);
    if(timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current=window.setInterval(()=>setTyped(c=>{
      const n=Math.min(toks.length,c+6);
      if(n>=toks.length && timerRef.current){window.clearInterval(timerRef.current); timerRef.current=null;}
      return n;
    }),12);
  }
  function onGenerate(){
    if(!active) return;
    const hint=genText.trim(); if(!hint){ setGenOpen(false); return; }
    const newPrompt = `[Identity]
You are ${active.name}, a helpful voice assistant.

[Style]
Friendly, concise, on-task.

[Task]
${hint}

[Collect]
- Full Name
- Phone Number
- Email (optional)
- Preferred date/time

[Handover]
Summarize and confirm before ending.`.trim();
    startTyping(active.config.model.systemPrompt, newPrompt);
    setGenOpen(false); setGenText('');
  }
  const acceptDiff=()=>{ if(!active) return; patch(a=>({...a,config:{...a.config,model:{...a.config.model,systemPrompt:pendingPrompt}}})); setTyping(null); setPendingPrompt(''); };
  const declineDiff=()=>{ setTyping(null); setPendingPrompt(''); };

  const badges=(
    <div className="flex flex-wrap gap-2">
      <span className="px-2.5 py-1 rounded-full text-xs border"
        style={{borderColor:'var(--border)', background: apiKeyId?'rgba(0,255,194,.10)':'rgba(255,0,0,.12)'}}>
        {apiKeyId?'OpenAI key loaded':'OpenAI key missing'}
      </span>
      <span className="px-2.5 py-1 rounded-full text-xs border"
        style={{borderColor:'var(--border)', background: fromE164?'rgba(0,255,194,.10)':'rgba(255,0,0,.12)'}}>
        {fromE164?`Phone ${fromE164}`:'Phone missing'}
      </span>
    </div>
  );

  if(!active){
    return (
      <div className="min-h-screen p-6" style={{background:'var(--bg)',color:'var(--text)'}}>
        {badges}
        <div className="mt-4"><button onClick={create} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}><Bot className="w-4 h-4 inline mr-2"/>Create Assistant</button></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{background:'var(--bg)',color:'var(--text)'}}>
      {/* top */}
      <div className="sticky top-0 z-10 border-b" style={{background:'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor:'var(--border)'}}>
        <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={18}/><span className="font-semibold">Voice Studio</span><span className="opacity-50">/</span>
            <span className="text-sm">{active.name}</span>
          </div>
          {badges}
        </div>
      </div>

      {/* body */}
      <div className="mx-auto max-w-[1400px] px-4 py-6 grid lg:grid-cols-[340px,1fr] gap-6">
        {/* LEFT: inline rail */}
        <aside className="hidden lg:flex flex-col gap-3">
          <div className="rounded-xl p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
            <div className="flex items-center gap-2 text-sm font-semibold"><Bot className="w-4 h-4"/> Assistants</div>
            <div className="mt-2 flex items-center gap-2 rounded-md px-2 py-1.5 border" style={{borderColor:'var(--border)'}}>
              <Search className="w-4 h-4 opacity-70"/><input placeholder="Search"
                onChange={(e)=>{/* local filter optional */}} className="flex-1 bg-transparent outline-none text-sm" />
            </div>
            <div className="mt-3 space-y-2">
              {assistants.map(a=>{
                const is=a.id===activeId;
                return (
                  <div key={a.id} className="rounded-lg p-2 border"
                       style={{borderColor:is?'color-mix(in oklab, var(--border) 40%, rgba(0,255,194,.4))':'var(--border)', background:is?'rgba(0,255,194,.06)':'var(--panel)'}}>
                    <button className="w-full text-left flex items-center justify-between" onClick={async()=>{setActiveId(a.id); const ss=await scopedStorage(); await ss.setJSON(K_SELECTED,a.id);}}>
                      <div className="truncate">{a.name}</div>{is?<Check className="w-4 h-4"/>:null}
                    </button>
                    <div className="mt-2 flex gap-2">
                      <button onClick={()=>{ const n=prompt('Rename',a.name)||a.name; rename(a.id,n); }} className="px-2 py-1 rounded-md text-xs border" style={{borderColor:'var(--border)'}}>Rename</button>
                      <button onClick={()=>remove(a.id)} className="px-2 py-1 rounded-md text-xs border" style={{borderColor:'var(--border)'}}><Trash2 className="w-3.5 h-3.5 inline mr-1"/>Delete</button>
                    </div>
                  </div>
                );
              })}
              <button onClick={create} className="w-full px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Bot className="w-4 h-4 inline mr-2"/>Create</button>
            </div>
          </div>
        </aside>

        {/* RIGHT: editor */}
        <section className="rounded-xl p-4 border space-y-4" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
          {/* row: model / first message / voice */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs opacity-70 mb-1">Model</div>
              <Select value={active.config.model.model}
                onChange={(v)=>patch(a=>({...a,config:{...a.config,model:{...a.config.model,model:v as ModelId}}}))}
                items={[
                  {value:'gpt-4o',label:'GPT-4o'},
                  {value:'gpt-4o-mini',label:'GPT-4o mini'},
                  {value:'gpt-4.1',label:'GPT-4.1'},
                  {value:'gpt-3.5-turbo',label:'GPT-3.5 Turbo'},
                ]}/>
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">First Message</div>
              <input value={active.config.model.firstMessage}
                onChange={(e)=>patch(a=>({...a,config:{...a.config,model:{...a.config.model,firstMessage:e.target.value}}}))}
                placeholder="(empty = default greeting)"
                className="w-full rounded-[12px] px-3 py-2 text-sm border bg-transparent"
                style={{borderColor:'var(--border)'}}/>
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Voice</div>
              <Select value={active.config.voice.voiceId}
                onChange={(v)=>patch(a=>({...a,config:{...a.config,voice:{...a.config.voice,voiceId:v,voiceLabel:v==='alloy'?'Alloy (OpenAI)':v}}}))}
                items={[{value:'alloy',label:'Alloy (OpenAI)'},{value:'ember',label:'Ember (OpenAI)'}]}/>
            </div>
          </div>

          {/* prompt header + actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm"><Sparkles size={16}/> System Prompt</div>
            <div className="flex items-center gap-2">
              <button onClick={()=>patch(a=>({...a,config:{...a.config,model:{...a.config.model,systemPrompt:''}}}))}
                className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><RefreshCw size={14}/> Reset</button>
              <button onClick={()=>setGenOpen(true)}
                className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Sparkles size={14}/> Generate / Edit</button>
            </div>
          </div>

          {/* prompt body (typing diff) */}
          {!typing ? (
            <textarea rows={18}
              value={active.config.model.systemPrompt || '(empty)'}
              onChange={(e)=>patch(a=>({...a,config:{...a.config,model:{...a.config.model,systemPrompt:e.target.value}}}))}
              className="w-full rounded-[14px] px-3 py-3 text-[14px] leading-6 outline-none"
              style={{background:'var(--panel)',border:'1px solid var(--border)',color:'var(--text)',fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas'}}/>
          ) : (
            <div>
              <div className="w-full rounded-[14px] px-3 py-3 text-[14px] leading-6"
                   style={{background:'var(--panel)',border:'1px solid var(--border)',fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas'}}>
                {(() => {
                  const slice=(typing||[]).slice(0,typed);
                  const out:React.ReactNode[]=[]; let buf=''; let mode:string=slice[0]?.t||'same';
                  const flush=(k:string)=>{ if(!buf) return;
                    if(mode==='add') out.push(<ins key={k} style={{background:'rgba(0,255,194,.15)',textDecoration:'none',borderRadius:4,padding:'1px 2px'}}>{buf}</ins>);
                    else if(mode==='del') out.push(<del key={k} style={{background:'rgba(255,0,0,.12)',color:'#fda4a4',borderRadius:4,padding:'1px 2px'}}>{buf}</del>);
                    else out.push(<span key={k}>{buf}</span>); buf=''; };
                  slice.forEach((t,i)=>{ if(t.t!==mode){flush(`f-${i}`); mode=t.t; buf=t.ch;} else buf+=t.ch; });
                  flush('tail'); if(typed<(typing?.length||0)) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                  return out;
                })()}
              </div>
              <div className="mt-3 flex items-center gap-2 justify-end">
                <button onClick={declineDiff} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><X size={14}/> Decline</button>
                <button onClick={acceptDiff} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Check size={14}/> Accept</button>
              </div>
            </div>
          )}

          {/* web call */}
          <WebCallInline
            greet={active.config.model.firstMessage || 'Hello. How may I help you today?'}
            voiceLabel={active.config.voice.voiceLabel}
            systemPrompt={(active.config.model.systemPrompt||'You are a helpful assistant.').trim()}
            model={active.config.model.model}
            apiKeyId={apiKeyId}
            fromE164={fromE164}
            onTurn={(role,text)=>setTurns(t=>[...t,{role,text}])}
          />
          <div className="rounded-xl p-3 border" style={{borderColor:'var(--border)'}}>
            <div className="text-xs opacity-70 mb-2">Transcript (web test)</div>
            <div className="max-h-60 overflow-y-auto space-y-1 pr-1">
              {turns.map((t,i)=>(
                <div key={i} className="text-sm"><span className="opacity-60">{t.role==='assistant'?'AI':'You'}:</span> {t.text}</div>
              ))}
              {!turns.length && <div className="text-sm opacity-60">No transcript yet.</div>}
            </div>
          </div>

          {/* footer */}
          <div className="flex items-center gap-2 justify-end">
            <button onClick={()=>navigator.clipboard.writeText(active.config.model.systemPrompt||'')}
              className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Copy size={14}/> Copy Prompt</button>
            <button onClick={()=>alert('Publish = server link your number to this assistant.')}
              className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Rocket size={14}/> Publish</button>
            <button onClick={()=>remove(active.id)} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Trash2 size={14}/> Delete</button>
          </div>
        </section>
      </div>

      {/* Generate overlay */}
      {genOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{background:'rgba(0,0,0,.45)'}}>
          <div className="w-full max-w-2xl rounded-2xl border" style={{background:'var(--panel)',borderColor:'var(--border)'}}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{borderColor:'var(--border)'}}>
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4"/> Generate / Edit Prompt</div>
              <button onClick={()=>setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4"/></button>
            </div>
            <div className="p-4">
              <input value={genText} onChange={(e)=>setGenText(e.target.value)}
                placeholder="e.g., Booking agent for clinic, confirm name/phone/date"
                className="w-full rounded-[12px] px-3 py-3 text-[15px] border bg-transparent"
                style={{borderColor:'var(--border)'}}/>
              <div className="mt-3 flex items-center justify-end gap-2">
                <button onClick={()=>setGenOpen(false)} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}>Cancel</button>
                <button onClick={onGenerate} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Sparkles size={14}/> Generate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* theme close to your Improve page */}
      <style jsx global>{`
        :root:not([data-theme="dark"]) { --bg:#f7f9fb; --text:#101316; --panel:#ffffff; --border:rgba(0,0,0,.12); }
        [data-theme="dark"]          { --bg:#0b0c10; --text:#eef2f5; --panel:#0f1315; --border:rgba(255,255,255,.10); }
      `}</style>
    </div>
  );
}

/* ==================== Inline WebCall (no extra files) ==================== */
function WebCallInline({
  greet, voiceLabel, systemPrompt, model, apiKeyId, fromE164, onTurn
}:{
  greet:string; voiceLabel:string; systemPrompt:string; model:string; apiKeyId:string; fromE164:string;
  onTurn:(role:'user'|'assistant',text:string)=>void;
}){
  const [live,setLive]=useState(false);
  const recRef=useRef<SR|null>(null);

  function SRFactory(onFinal:(t:string)=>void):SR|null{
    const C:any=(window as any).webkitSpeechRecognition||(window as any).SpeechRecognition;
    if(!C) return null;
    const r:SR=new C(); r.continuous=true; r.interimResults=true; r.lang='en-US';
    r.onresult=(e:SpeechRecognitionEvent)=>{ let fin=''; for(let i=e.resultIndex;i<e.results.length;i++){const res=e.results[i]; if(res.isFinal) fin+=res[0].transcript;} if(fin.trim()) onFinal(fin.trim()); };
    (r as any)._keep=true; r.onend=()=>{ if((r as any)._keep){ try{ r.start(); }catch{} } };
    return r;
  }
  async function voices():Promise<SpeechSynthesisVoice[]>{ const s=window.speechSynthesis; let v=s.getVoices(); if(v.length) return v;
    await new Promise<void>(res=>{ const t=setInterval(()=>{v=s.getVoices(); if(v.length){clearInterval(t);res();}},50); setTimeout(res,1200); });
    return s.getVoices();
  }
  function pick(vs:SpeechSynthesisVoice[]){ const want=(voiceLabel||'').toLowerCase();
    const prefs=want.includes('ember')?['Samantha','Google US English','Serena','Victoria','Alex']
               :want.includes('alloy')?['Alex','Daniel','Google UK English Male','Samantha']
               :['Google US English','Samantha','Alex','Daniel'];
    for(const p of prefs){ const v=vs.find(v=>v.name.toLowerCase().includes(p.toLowerCase())); if(v) return v; }
    return vs[0];
  }
  async function speak(text:string){ const s=window.speechSynthesis; try{s.cancel();}catch{}; const u=new SpeechSynthesisUtterance(text); const vs=await voices(); u.voice=pick(vs); u.rate=1; u.pitch=.95; s.speak(u); }

  async function ask(userText:string):Promise<string>{
    // This expects a tiny pages route at /api/voice/chat that uses the real key server-side.
    const r=await fetch('/api/voice/chat',{ method:'POST', headers:{'content-type':'application/json','x-apikey-id':apiKeyId||''},
      body:JSON.stringify({ model, system:systemPrompt, user:userText, fromE164 }) });
    if(!r.ok) throw new Error('I could not reach the model. Check your OpenAI key.');
    const j=await r.json(); return (j?.text||'Understood.').trim();
  }

  async function start(){
    if(!apiKeyId){ const msg='OpenAI key is missing. Add it in API Keys.'; onTurn('assistant',msg); await speak(msg); return; }
    const hello=greet||'Hello. How may I help you today?'; onTurn('assistant',hello); await speak(hello);
    const rec=SRFactory(async (final)=>{
      onTurn('user',final);
      try{ const reply=await ask(final); onTurn('assistant',reply); await speak(reply); }
      catch(e:any){ const msg=e?.message||'Model unavailable.'; onTurn('assistant',msg); await speak(msg); }
    });
    if(!rec){ const msg='Speech recognition not available in this browser.'; onTurn('assistant',msg); await speak(msg); return; }
    recRef.current=rec; try{rec.start();}catch{}; setLive(true);
  }
  function stop(){ const r=recRef.current; if(r){(r as any)._keep=false; try{r.stop();}catch{} } recRef.current=null; try{window.speechSynthesis.cancel();}catch{}; setLive(false); }

  return !live ? (
    <button onClick={start} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)', background:'rgba(0,255,194,.10)'}}>
      <PhoneCall className="w-4 h-4 inline mr-2 text-white"/><span className="text-white">Start Web Call</span>
    </button>
  ) : (
    <button onClick={stop} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
      <PhoneOff className="w-4 h-4 inline mr-2"/>End Call
    </button>
  );
}
