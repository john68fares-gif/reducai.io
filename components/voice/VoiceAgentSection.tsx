'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Bot, Check, Copy, Mic2, Phone as PhoneIcon, Rocket, Sparkles, Trash2,
  RefreshCw, X, ChevronDown, ChevronRight
} from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

const AssistantRail = dynamic(() => import('./AssistantRail'), { ssr: false });
const WebCallButton = dynamic(() => import('./WebCallButton'), { ssr: false });

/* ====== storage keys shared with the rest of your app ====== */
const K_ASSISTANTS = 'voice:assistants.v2';
const K_SELECTED   = 'voice:assistants:selected';
const K_STEP2      = 'voicebuilder:step2';       // { fromE164, apiKeyId } (from your StepV2 page)
const K_APIKEY_SEL = 'apiKeys.selectedId';       // selected OpenAI key id (scopedStorage)

type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';

type Assistant = {
  id: string;
  name: string;
  createdAt: number;
  config: {
    model: { provider: Provider; model: ModelId; firstMessage: string; systemPrompt: string };
    voice: { provider: 'openai'|'elevenlabs'; voiceId: string; voiceLabel: string };
  };
};

type Token = { t: 'same'|'add'|'del'; ch: string };

const uid = (p='a') => `${p}_${Math.random().toString(36).slice(2, 9)}`;

/* ---------- character diff (add+del) ---------- */
function diffChars(a: string, b: string): Token[] {
  const A = [...a], B = [...b];
  const dp = Array(A.length+1).fill(0).map(() => Array(B.length+1).fill(0));
  for (let i=A.length-1;i>=0;i--) for (let j=B.length-1;j>=0;j--) {
    dp[i][j] = A[i]===B[j] ? 1 + dp[i+1][j+1] : Math.max(dp[i+1][j], dp[i][j+1]);
  }
  const out: Token[] = [];
  let i=0,j=0;
  while (i<A.length && j<B.length) {
    if (A[i]===B[j]) { out.push({t:'same', ch:B[j]}); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) { out.push({t:'del', ch:A[i++]}); }
    else { out.push({t:'add', ch:B[j++]}); }
  }
  while (i<A.length) out.push({t:'del', ch:A[i++]});
  while (j<B.length) out.push({t:'add', ch:B[j++]});
  return out;
}

/* ---------- small select control ---------- */
function Select({
  value, items, onChange, placeholder
}:{ value:string; items:{value:string;label:string}[]; onChange:(v:string)=>void; placeholder?:string }) {
  return (
    <select
      value={value}
      onChange={(e)=>onChange(e.target.value)}
      className="rounded-[12px] px-3 py-2 text-sm border bg-transparent"
      style={{borderColor:'var(--border)', color:'var(--text)'}}
    >
      {placeholder ? <option value="" disabled>{placeholder}</option> : null}
      {items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
    </select>
  );
}

/* ===================================== PAGE ===================================== */
export default function VoiceAgentSection() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const active = useMemo(() => assistants.find(a => a.id === activeId) || null, [assistants, activeId]);

  /* badges: api key + from number (imported from StepV2) */
  const [apiKeyId, setApiKeyId] = useState<string>('');
  const [fromE164, setFromE164] = useState<string>('');

  /* generate overlay state */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typing, setTyping] = useState<Token[] | null>(null);
  const [typed, setTyped] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [nextPrompt, setNextPrompt] = useState('');

  /* hydrate */
  useEffect(() => {
    const boot = async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();

      // assistants
      const list = (await ss.getJSON<Assistant[]>(K_ASSISTANTS, [])) || [];
      const seeded = list.length ? list : [{
        id: uid('agent'),
        name: 'New Assistant',
        createdAt: Date.now(),
        config: {
          model: { provider:'openai', model:'gpt-4o', firstMessage: '', systemPrompt: '' }, // EMPTY
          voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' }
        }
      }];
      if (!list.length) await ss.setJSON(K_ASSISTANTS, seeded);
      setAssistants(seeded);

      // selection
      const sel = await ss.getJSON<string>(K_SELECTED, seeded[0].id);
      setActiveId(seeded.some(a=>a.id===sel) ? sel : seeded[0].id);

      // key + number (from StepV2 + Keys page)
      const step2 = await ss.getJSON<{fromE164?:string;apiKeyId?:string}>(K_STEP2, {} as any);
      const chosenKey = step2?.apiKeyId || await ss.getJSON<string>(K_APIKEY_SEL, '');
      setApiKeyId(chosenKey || '');
      setFromE164(step2?.fromE164 || '');
    };
    boot();
  }, []);

  /* persist on change */
  useEffect(() => { (async () => {
    const ss = await scopedStorage(); await ss.setJSON(K_ASSISTANTS, assistants);
  })(); }, [assistants]);

  /* ---------------- actions ---------------- */
  const createAssistant = async () => {
    const a: Assistant = {
      id: uid('agent'),
      name: 'New Assistant',
      createdAt: Date.now(),
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessage:'', systemPrompt:'' }, // EMPTY
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' }
      }
    };
    setAssistants(p => [...p, a]);
    setActiveId(a.id);
    const ss = await scopedStorage(); await ss.setJSON(K_SELECTED, a.id);
  };

  const renameAssistant = (id:string, name:string) =>
    setAssistants(list => list.map(a => a.id===id ? {...a, name: name || 'Untitled'} : a));

  const deleteAssistant = (id:string) => {
    setAssistants(list => {
      const next = list.filter(a => a.id!==id);
      if (activeId===id && next.length) setActiveId(next[0].id);
      return next;
    });
  };

  const patchActive = (mut:(a:Assistant)=>Assistant) =>
    setAssistants(list => list.map(a => a.id===activeId ? mut(a) : a));

  /* -------------- generate with diff typing -------------- */
  function startTypingDiff(oldText: string, newText: string) {
    const toks = diffChars(oldText, newText);
    setTyping(toks);
    setTyped(0);
    setNextPrompt(newText);
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      setTyped(c => {
        const n = Math.min(toks.length, c+6);
        if (n >= toks.length && timerRef.current) { window.clearInterval(timerRef.current); timerRef.current = null; }
        return n;
      });
    }, 12);
  }

  const handleGenerate = () => {
    if (!active) return;
    const hint = genText.trim();
    if (!hint) { setGenOpen(false); return; }

    // super simple composer – you can plug your smarter builder here
    const base = (active.config.model.systemPrompt || '').trim();
    const newPrompt =
`[Identity]
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

    startTypingDiff(base || '(empty)', newPrompt);
    setGenOpen(false);
    setGenText('');
  };

  const acceptTyping = () => {
    if (!active) return;
    const final = nextPrompt.replace(/^\(empty\)\n?/, ''); // drop placeholder
    patchActive(a => ({...a, config:{...a.config, model:{...a.config.model, systemPrompt: final}}}));
    setTyping(null);
    setNextPrompt('');
  };
  const declineTyping = () => { setTyping(null); setNextPrompt(''); };

  /* badges */
  const badges = (
    <div className="flex flex-wrap gap-2">
      <span className="px-2.5 py-1 rounded-full text-xs border"
        style={{borderColor:'var(--border)', background: apiKeyId ? 'rgba(0,255,194,.10)':'rgba(255,0,0,.10)', color:'var(--text)'}}>
        {apiKeyId ? 'OpenAI key loaded' : 'OpenAI key missing'}
      </span>
      <span className="px-2.5 py-1 rounded-full text-xs border"
        style={{borderColor:'var(--border)', background: fromE164 ? 'rgba(0,255,194,.10)':'rgba(255,0,0,.10)', color:'var(--text)'}}>
        {fromE164 ? `Phone ${fromE164}` : 'Phone missing'}
      </span>
    </div>
  );

  if (!active) {
    return (
      <div className="p-6 space-y-4">
        {badges}
        <button onClick={createAssistant} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
          <Bot className="w-4 h-4 inline mr-2" /> Create Assistant
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans" style={{background:'var(--bg)', color:'var(--text)'}}>
      {/* top bar */}
      <div className="sticky top-0 z-10 border-b" style={{background:'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor:'var(--border)'}}>
        <div className="mx-auto max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={18}/><span className="font-semibold">Voice Studio</span><span className="opacity-50">/</span>
            <span className="text-sm">{active.name}</span>
          </div>
          {badges}
        </div>
      </div>

      <div className="mx-auto max-w-[1400px] px-4 py-6 grid lg:grid-cols-[360px,1fr] gap-6">
        {/* left rail */}
        <div>
          <AssistantRail
            assistants={assistants.map(a => ({id:a.id, name:a.name, folder:'Unfiled', updatedAt:a.createdAt}))}
            activeId={activeId}
            onSelect={async(id)=>{ setActiveId(id); const ss=await scopedStorage(); await ss.setJSON(K_SELECTED,id); }}
            onCreate={createAssistant}
            onRename={renameAssistant}
            onDelete={deleteAssistant}
            defaultCollapsed={false}
          />
        </div>

        {/* editor */}
        <div className="rounded-xl p-4 border space-y-4" style={{borderColor:'var(--border)', background:'var(--panel)'}}>
          {/* model line */}
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <div className="text-xs opacity-70 mb-1">Model</div>
              <Select
                value={active.config.model.model}
                onChange={(v)=>patchActive(a=>({...a, config:{...a.config, model:{...a.config.model, model: v as ModelId}}}))}
                items={[
                  {value:'gpt-4o', label:'GPT-4o'},
                  {value:'gpt-4o-mini', label:'GPT-4o mini'},
                  {value:'gpt-4.1', label:'GPT-4.1'},
                  {value:'gpt-3.5-turbo', label:'GPT-3.5 Turbo'},
                ]}
              />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">First Message</div>
              <input
                value={active.config.model.firstMessage}
                onChange={(e)=>patchActive(a=>({...a, config:{...a.config, model:{...a.config.model, firstMessage:e.target.value}}}))}
                placeholder="(empty = default greeting)"
                className="w-full rounded-[12px] px-3 py-2 text-sm border bg-transparent"
                style={{borderColor:'var(--border)', color:'var(--text)'}}
              />
            </div>
            <div>
              <div className="text-xs opacity-70 mb-1">Voice</div>
              <Select
                value={active.config.voice.voiceId}
                onChange={(v)=>patchActive(a=>({...a, config:{...a.config, voice:{...a.config.voice, voiceId:v, voiceLabel: v==='alloy'?'Alloy (OpenAI)':v}}}))}
                items={[{value:'alloy',label:'Alloy (OpenAI)'},{value:'ember',label:'Ember (OpenAI)'}]}
              />
            </div>
          </div>

          {/* prompt header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold text-sm"><Sparkles size={16}/> System Prompt</div>
            <div className="flex items-center gap-2">
              <button
                onClick={()=>patchActive(a=>({...a, config:{...a.config, model:{...a.config.model, systemPrompt:''}}}))}
                className="px-3 py-2 rounded-md border text-sm"
                style={{borderColor:'var(--border)'}}
              ><RefreshCw size={14}/> Reset</button>
              <button
                onClick={()=>setGenOpen(true)}
                className="px-3 py-2 rounded-md border text-sm"
                style={{borderColor:'var(--border)'}}
              ><Sparkles size={14}/> Generate / Edit</button>
            </div>
          </div>

          {/* prompt body */}
          {!typing ? (
            <textarea
              rows={18}
              value={active.config.model.systemPrompt || '(empty)'}
              onChange={(e)=>patchActive(a=>({...a, config:{...a.config, model:{...a.config.model, systemPrompt:e.target.value}}}))}
              className="w-full rounded-[14px] px-3 py-3 text-[14px] leading-6 outline-none"
              style={{background:'var(--panel)', border:'1px solid var(--border)', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color:'var(--text)'}}
            />
          ) : (
            <div>
              <div
                className="w-full rounded-[14px] px-3 py-3 text-[14px] leading-6"
                style={{background:'var(--panel)', border:'1px solid var(--border)', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', color:'var(--text)'}}
              >
                {(() => {
                  const slice = (typing || []).slice(0, typed);
                  const out: React.ReactNode[] = [];
                  let buf = ''; let mode: Token['t'] = slice[0]?.t || 'same';

                  const flush = (key:string) => {
                    if (!buf) return;
                    if (mode==='add') out.push(<ins key={key} style={{background:'rgba(0,255,194,.15)', textDecoration:'none', borderRadius:4, padding:'1px 2px'}}>{buf}</ins>);
                    else if (mode==='del') out.push(<del key={key} style={{background:'rgba(255,0,0,.12)', color:'#fda4a4', borderRadius:4, padding:'1px 2px'}}>{buf}</del>);
                    else out.push(<span key={key}>{buf}</span>);
                    buf = '';
                  };

                  slice.forEach((tk, i) => {
                    if (tk.t !== mode) { flush(`f-${i}`); mode = tk.t; buf = tk.ch; }
                    else { buf += tk.ch; }
                  });
                  flush('tail');
                  if (typed < (typing?.length || 0)) out.push(<span key="caret" className="animate-pulse"> ▌</span>);

                  return out;
                })()}
              </div>

              <div className="mt-3 flex items-center gap-2 justify-end">
                <button onClick={declineTyping} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><X size={14}/> Decline</button>
                <button onClick={acceptTyping} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Check size={14}/> Accept</button>
              </div>
            </div>
          )}

          {/* web call */}
          <div className="pt-2 flex items-center gap-3">
            <WebCallButton
              greet={active.config.model.firstMessage || 'Hello. How may I help you today?'}
              voiceLabel={active.config.voice.voiceLabel}
              systemPrompt={(active.config.model.systemPrompt || '').trim() || 'You are a helpful assistant.'}
              model={active.config.model.model}
              apiKeyId={apiKeyId}
              fromE164={fromE164}
              onTurn={(role, text)=>console.log(role==='assistant'?'AI:':'You:', text)}
            />
            <div className="text-xs opacity-70">Uses your selected OpenAI key + “From” number (badges above).</div>
          </div>

          {/* footer actions */}
          <div className="flex items-center gap-2 justify-end pt-2">
            <button
              onClick={()=>navigator.clipboard.writeText(active.config.model.systemPrompt || '')}
              className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}
            ><Copy size={14}/> Copy Prompt</button>
            <button className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}} onClick={()=>alert('Publish connects your linked number to this assistant server-side.')}>
              <Rocket size={14}/> Publish
            </button>
            <button onClick={()=>deleteAssistant(active.id)} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Trash2 size={14}/> Delete</button>
          </div>
        </div>
      </div>

      {/* generate overlay */}
      {genOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{background:'rgba(0,0,0,.45)'}}>
          <div className="w-full max-w-2xl rounded-2xl border" style={{background:'var(--panel)', borderColor:'var(--border)'}}>
            <div className="px-4 py-3 flex items-center justify-between border-b" style={{borderColor:'var(--border)'}}>
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4"/> Generate / Edit Prompt</div>
              <button onClick={()=>setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4">
              <input
                value={genText}
                onChange={(e)=>setGenText(e.target.value)}
                placeholder="e.g., Booking assistant for dental clinic, confirm name/phone/date"
                className="w-full rounded-[12px] px-3 py-3 text-[15px] border bg-transparent"
                style={{borderColor:'var(--border)', color:'var(--text)'}}
              />
              <div className="mt-3 flex items-center justify-end gap-2">
                <button onClick={()=>setGenOpen(false)} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}>Cancel</button>
                <button onClick={handleGenerate} className="px-3 py-2 rounded-md border text-sm" style={{borderColor:'var(--border)'}}><Sparkles size={14}/> Generate</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* page theming similar to Improve */}
      <style jsx global>{`
        :root:not([data-theme="dark"]) {
          --bg:#f7f9fb; --text:#101316; --panel:#ffffff; --border:rgba(0,0,0,.12);
        }
        [data-theme="dark"] {
          --bg:#0b0c10; --text:#eef2f5; --panel:#0f1315; --border:rgba(255,255,255,.10);
        }
      `}</style>
    </div>
  );
}
