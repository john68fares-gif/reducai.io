'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3,
  ChevronLeft, ChevronRight as ChevronRightIcon,
  FileText, Mic2, BookOpen, SlidersHorizontal, PanelLeft, Bot, UploadCloud,
  RefreshCw, Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff,
  MessageSquare, ListTree, AudioLines, Volume2, Save
} from 'lucide-react';

import { SCOPE, Field, Section, Select, DeleteModal, StyleBlock, useAppSidebarWidth } from '@/components/voice/ui';

/* =============================================================================
   SCOPED STORAGE REGISTRIES (adjust these keys if your app uses different ones)
============================================================================= */
// All app-wide saved OpenAI keys from your “API Keys” page:
const REG_OPENAI_KEYS  = `${SCOPE}:registry.openaiKeys.v1`;  // [{id,name,key}]

// All app-wide saved phone numbers from your “Phone Numbers” page:
const REG_PHONE_NUMS   = `${SCOPE}:registry.phoneNumbers.v1`; // [{id,label,e164}]

/* =============================================================================
   LOCAL STORAGE + TYPES
============================================================================= */
const LS_LIST   = 'voice:assistants.v1';
const LS_CALLS  = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const ak = (id: string) => `voice:assistant:${id}`;

type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type TranscriptTurn = { role: 'assistant'|'user'; text: string; ts: number };
type CallLog = {
  id: string;
  assistantId: string;
  assistantName: string;
  startedAt: number;
  endedAt?: number;
  endedReason?: string;
  type: 'Web';
  assistantPhoneNumber?: string; // resolved e164 snapshot
  transcript: TranscriptTurn[];
};

type RegistryOpenAIKey = { id: string; name: string; key: string };
type RegistryPhone     = { id: string; label?: string; e164: string };

type Assistant = {
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  published?: boolean;
  config: {
    model: {
      provider: Provider;
      model: ModelId;
      firstMessageMode: 'assistant_first' | 'user_first';
      firstMessage: string;
      systemPrompt: string;
      temperature?: number;
      /** reference to REG_OPENAI_KEYS entry */
      openaiKeyId?: string;
    };
    voice: { provider: VoiceProvider; voiceId: string; voiceLabel: string };
    transcriber: {
      provider: 'deepgram';
      model: 'nova-2' | 'nova-3';
      language: 'en' | 'multi';
      denoise: boolean;
      confidenceThreshold: number;
      numerals: boolean;
    };
    tools: { enableEndCall: boolean; dialKeypad: boolean };
    /** reference to REG_PHONE_NUMS entry */
    telephony?: { linkedPhoneId?: string };
  };
};

const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   BASE PROMPT
============================================================================= */
const BASE_PROMPT = `[Identity]
You are a friendly, fast, accurate voice assistant.

[Style]
* Natural, conversational, concise.
* Answer questions normally; ask for missing info one step at a time.

[System Behaviors]
* Confirm key details before finalizing.
* Offer next steps where it helps.

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

/* =============================================================================
   Speech Recognition + TTS (ElevenLabs-first for US voices)
============================================================================= */
function makeRecognizer(onFinalText: (text:string)=>void) {
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true; r.interimResults = true; r.lang = 'en-US';
  r.onresult = (e: any) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) final += e.results[i][0].transcript;
    if (final.trim()) onFinalText(final.trim());
  };
  return r;
}

async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;
  await new Promise(res => {
    const t = setInterval(() => { voices = synth.getVoices(); if (voices.length) { clearInterval(t); res(null); } }, 50);
    setTimeout(() => { clearInterval(t); res(null); }, 1500);
  });
  return synth.getVoices();
}

async function speakBrowserUS(text: string) {
  const synth = window.speechSynthesis;
  try { synth.resume(); } catch {}
  const voices = await ensureVoicesReady();
  const us = voices.find(v => /US|en-US/i.test(`${v.name} ${v.lang}`)) || voices[0];
  const u = new SpeechSynthesisUtterance(text);
  u.voice = us; u.rate = 1; u.pitch = 1; u.volume = 1;
  synth.cancel(); synth.speak(u);
}

async function speak(text: string, provider: VoiceProvider, voiceId: string) {
  if (provider === 'elevenlabs') {
    try {
      const r = await fetch('/api/tts/elevenlabs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }) // server uses env ELEVENLABS_API_KEY
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      await a.play();
      a.onended = () => URL.revokeObjectURL(url);
      return;
    } catch (e) {
      console.warn('ElevenLabs failed; using browser TTS as fallback:', e);
    }
  }
  await speakBrowserUS(text);
}

/* =============================================================================
   Registry helpers (read once, then used everywhere)
============================================================================= */
function getRegistryKeys(): RegistryOpenAIKey[] {
  return readLS<RegistryOpenAIKey[]>(REG_OPENAI_KEYS) || [];
}
function getRegistryPhones(): RegistryPhone[] {
  return readLS<RegistryPhone[]>(REG_PHONE_NUMS) || [];
}
function getOpenAIKeyById(id?: string): string | undefined {
  const all = getRegistryKeys();
  if (!all.length) return undefined;
  if (!id) return all[0]?.key;
  return all.find(k => k.id === id)?.key || all[0]?.key;
}
function getPhoneById(id?: string): RegistryPhone | undefined {
  const all = getRegistryPhones();
  if (!all.length || !id) return undefined;
  return all.find(p => p.id === id);
}

/* =============================================================================
   LLM roundtrip via /api/chat (uses registry OpenAI key)
============================================================================= */
async function chatLLM({
  systemPrompt, model, temperature, keyId, history
}:{
  systemPrompt: string;
  model: ModelId;
  temperature?: number;
  keyId?: string;
  history: { role:'system'|'user'|'assistant'; content:string }[];
}): Promise<string> {
  const apiKey = getOpenAIKeyById(keyId);
  const resp = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({
      agent: { name: 'VoiceAgent', prompt: systemPrompt, model, temperature: temperature ?? 0.5, apiKey },
      messages: history
    })
  });
  if (!resp.ok) return `Sorry, I hit an error: ${await resp.text().catch(()=> 'Chat server error.')}`;
  const data = await resp.json().catch(()=> ({}));
  return (data?.reply || '').trim() || '…';
}

/* =============================================================================
   Component
============================================================================= */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [sbCollapsed, setSbCollapsed] = useState(false);
  useEffect(() => {
    const onEvt = (e: Event) => { const d = (e as CustomEvent).detail || {}; if (typeof d.collapsed === 'boolean') setSbCollapsed(!!d.collapsed); };
    window.addEventListener('layout:sidebar', onEvt as EventListener);
    return () => window.removeEventListener('layout:sidebar', onEvt as EventListener);
  }, []);
  useAppSidebarWidth(scopeRef, sbCollapsed);

  /* ---------- Assistants ---------- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (!list.length) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        folder: 'Voice',
        updatedAt: Date.now(),
        published: false,
        config: {
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello! How can I help today?', systemPrompt: BASE_PROMPT, temperature: 0.5, openaiKeyId: undefined },
          voice: { provider:'elevenlabs', voiceId:'rachel', voiceLabel:'Rachel (US)' },
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
          telephony: { linkedPhoneId: undefined }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      // ensure shape
      const fixed = list.map(a => ({
        ...a,
        config: {
          ...a.config,
          model: { ...a.config.model },
          telephony: { linkedPhoneId: a.config.telephony?.linkedPhoneId }
        }
      }));
      writeLS(LS_LIST, fixed);
      setAssistants(fixed); setActiveId(fixed[0].id);
    }
    if (!readLS<CallLog[]>(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS<Record<string,string>>(LS_ROUTES)) writeLS(LS_ROUTES, {});
  }, []);

  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId, rev]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x);
    writeLS(LS_LIST, list);
    setAssistants(list);
    setRev(r => r + 1);
  };

  const addAssistant = async () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello!', systemPrompt: '', temperature:0.5, openaiKeyId: undefined },
        voice: { provider:'elevenlabs', voiceId:'rachel', voiceLabel:'Rachel (US)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
        telephony: { linkedPhoneId: undefined }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
    setEditingId(id); setTempName('New Assistant');
  };

  const removeAssistant = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id);
    if (!list.length) setActiveId('');
    setRev(r => r + 1);
  };

  /* ---------- Voice choices ---------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (Browser fallback)' },
    { value: 'ember', label: 'Ember (Browser fallback)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (US)' },
    { value: 'adam',   label: 'Adam (US)'   },
    { value: 'bella',  label: 'Bella (US)'  },
  ];

  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const [pendingVoiceLabel, setPendingVoiceLabel] = useState<string | null>(null);
  useEffect(() => {
    if (active) {
      setPendingVoiceId(active.config.voice.voiceId);
      setPendingVoiceLabel(active.config.voice.voiceLabel);
    }
  }, [active?.id]); // eslint-disable-line

  const handleVoiceProviderChange = (v: string) => {
    const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
    setPendingVoiceId(list[0].value);
    setPendingVoiceLabel(list[0].label);
    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
  };
  const handleVoiceIdChange = (v: string) => {
    if (!active) return;
    const list = active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices;
    const found = list.find(x=>x.value===v);
    setPendingVoiceId(v);
    setPendingVoiceLabel(found?.label || v);
  };
  const saveVoice = async () => {
    if (!active || !pendingVoiceId) return;
    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId: pendingVoiceId, voiceLabel: pendingVoiceLabel || pendingVoiceId } } }));
    await speak('Voice saved.', active.config.voice.provider, pendingVoiceId);
  };
  const testVoice = async () => {
    if (!active || !pendingVoiceId) return;
    await speak('This is a quick preview of the selected voice.', active.config.voice.provider, pendingVoiceId);
  };

  /* ---------- Call + Chat ---------- */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const recogRef = useRef<any | null>(null);
  const chatHistoryRef = useRef<{ role: 'system'|'user'|'assistant'; content: string }[]>([]);

  function pushTurn(role: 'assistant'|'user', text: string) {
    const turn = { role, text, ts: Date.now() };
    setTranscript(t => {
      const next = [...t, turn];
      if (currentCallId) {
        const calls = readLS<CallLog[]>(LS_CALLS) || [];
        const idx = calls.findIndex(c => c.id === currentCallId);
        if (idx >= 0) { calls[idx] = { ...calls[idx], transcript: [...calls[idx].transcript, turn] }; writeLS(LS_CALLS, calls); }
      }
      return next;
    });
  }

  async function startCall() {
    if (!active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id);
    setTranscript([]);
    chatHistoryRef.current = [];

    const linkedPhone = getPhoneById(active.config.telephony?.linkedPhoneId);
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedPhone?.e164, transcript: [] });
    writeLS(LS_CALLS, calls);

    const greet = active.config.model.firstMessage || 'Hello! How can I help today?';
    const sys = active.config.model.systemPrompt || BASE_PROMPT;
    if (active.config.model.firstMessageMode === 'assistant_first') {
      pushTurn('assistant', greet);
      await speak(greet, active.config.voice.provider, active.config.voice.voiceId);
      chatHistoryRef.current = [{ role:'system', content: sys }, { role:'assistant', content: greet }];
    } else {
      chatHistoryRef.current = [{ role:'system', content: sys }];
    }

    const rec = makeRecognizer(async (finalText) => {
      pushTurn('user', finalText);
      const reply = await chatLLM({
        systemPrompt: sys,
        model: active.config.model.model,
        temperature: active.config.model.temperature,
        keyId: active.config.model.openaiKeyId,
        history: [...chatHistoryRef.current, { role: 'user', content: finalText }]
      });
      chatHistoryRef.current.push({ role:'user', content: finalText }, { role:'assistant', content: reply });
      pushTurn('assistant', reply);
      await speak(reply, active.config.voice.provider, active.config.voice.voiceId);
    });

    if (!rec) {
      const msg = 'Speech recognition is unavailable here. Try Chrome/Edge.';
      pushTurn('assistant', msg);
      await speak(msg, active.config.voice.provider, active.config.voice.voiceId);
      return;
    }
    recogRef.current = rec; try { rec.start(); } catch {}
  }

  function endCall(reason: string) {
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    window.speechSynthesis.cancel();
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls);
    setCurrentCallId(null);
  }

  const callsForAssistant = (readLS<CallLog[]>(LS_CALLS) || []).filter(c => c.assistantId === active?.id);

  /* ---------- UI helpers ---------- */
  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const beginRename = (a: Assistant) => { setEditingId(a.id); setTempName(a.name); };
  const saveRename = (a: Assistant) => {
    const name = (tempName || '').trim() || 'Untitled';
    if (a.id === activeId) updateActive(x => ({ ...x, name }));
    else {
      const cur = readLS<Assistant>(ak(a.id));
      if (cur) writeLS(ak(a.id), { ...cur, name, updatedAt: Date.now() });
      const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === a.id ? { ...x, name, updatedAt: Date.now() } : x);
      writeLS(LS_LIST, list); setAssistants(list); setRev(r => r + 1);
    }
    setEditingId(null);
  };

  const publish = () => {
    if (!active) return;
    const linkedPhone = getPhoneById(active.config.telephony?.linkedPhoneId);
    if (!linkedPhone) { alert('Pick a linked Phone Number from the registry before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[linkedPhone.id] = active.id; // phoneId -> assistant
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${linkedPhone.e164} is now linked to ${active.name}.`);
  };

  if (!active) {
    return (
      <div ref={scopeRef} className={SCOPE} style={{ color:'var(--text)' }}>
        <div className="px-6 py-10 opacity-70">Create your first assistant.</div>
        <StyleBlock />
      </div>
    );
  }

  /* ---------- Registries for selects ---------- */
  const allKeys   = getRegistryKeys();   // [{id,name,key}]
  const allPhones = getRegistryPhones(); // [{id,label,e164}]

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ======== left rail (trimmed) ======== */}
      <aside className="hidden lg:flex flex-col"
        style={{ position:'fixed', left:'calc(var(--app-sidebar-w, 248px) - 1px)', top:'var(--app-header-h, 64px)', width: 'var(--va-rail-w, 360px)', height:'calc(100vh - var(--app-header-h, 64px))', borderRight:'1px solid var(--va-border)', background:'var(--va-sidebar)', boxShadow:'var(--va-shadow-side)', zIndex: 10 }}>
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold"><PanelLeft className="w-4 h-4" /> <span>Assistants</span></div>
          <button onClick={addAssistant} className="btn btn--green">
            <Plus className="w-3.5 h-3.5 text-white" /> <span className="text-white">Create</span>
          </button>
        </div>
        <div className="p-3 min-h-0 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
            <Search className="w-4 h-4" />
            <input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search assistants" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }} />
          </div>
          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isActive = a.id === activeId;
              const isEdit = editingId === a.id;
              return (
                <div key={a.id} className="w-full rounded-xl p-3" style={{ background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)', border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}` }}>
                  <button className="w-full text-left flex items-center justify-between" onClick={()=> setActiveId(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        {!isEdit ? <span className="truncate">{a.name}</span> : (
                          <input autoFocus value={tempName} onChange={(e)=> setTempName(e.target.value)} onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }} className="bg-transparent rounded-md px-2 py-1 outline-none w-full" style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }} />
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {isActive ? <Check className="w-4 h-4" /> : null}
                  </button>
                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); setEditingId(a.id); setTempName(a.name); }} className="btn btn--ghost text-xs"><Edit3 className="w-3.5 h-3.5" /> Rename</button>
                        <button onClick={(e)=> { e.stopPropagation(); setDeleting({ id:a.id, name:a.name }); }} className="btn btn--danger text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn btn--green text-xs"><Check className="w-3.5 h-3.5 text-white" /> <span className="text-white">Save</span></button>
                        <button onClick={(e)=> { e.stopPropagation(); setEditingId(null); }} className="btn btn--ghost text-xs">Cancel</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ======== main editor ======== */}
      <div className="va-main" style={{ marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`, paddingRight:'clamp(20px, 4vw, 40px)', paddingTop:'calc(var(--app-header-h, 64px) + 12px)', paddingBottom:'88px' }}>
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
          {/* MODEL */}
          <Section title="Model" icon={<FileText className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(300px, 1fr))' }}>
              <Field label="Provider">
                <Select value={active.config.model.provider} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as Provider } } }))} items={[{ value:'openai', label:'OpenAI' }]} />
              </Field>
              <Field label="Model">
                <Select
                  value={active.config.model.model}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, model: v as ModelId } } }))}
                  items={[
                    { value:'gpt-4o', label:'GPT-4o' },
                    { value:'gpt-4o-mini', label:'GPT-4o mini' },
                    { value:'gpt-4.1', label:'GPT-4.1' },
                    { value:'gpt-3.5-turbo', label:'GPT-3.5 Turbo' },
                  ]}
                />
              </Field>

              {/* OpenAI key is SELECTED from registry; we never store the raw key here */}
              <Field label="OpenAI Key (from Keys page)">
                <Select
                  value={active.config.model.openaiKeyId || ''}
                  onChange={(id)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, openaiKeyId: id || undefined } } }))}
                  items={allKeys.map(k => ({ value:k.id, label:k.name }))}
                  placeholder={allKeys.length ? 'Choose a saved key…' : 'No keys found (add in Keys page)'}
                />
              </Field>

              <Field label="Temperature">
                <input
                  type="number" step={0.1} min={0} max={1}
                  value={active.config.model.temperature ?? 0.5}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, temperature: Number(e.target.value) } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}
                />
              </Field>
            </div>

            <div className="grid gap-6 mt-4" style={{ gridTemplateColumns:'repeat(2, minmax(300px, 1fr))' }}>
              <Field label="First Message Mode">
                <Select
                  value={active.config.model.firstMessageMode}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessageMode: v as any } } }))}
                  items={[{ value:'assistant_first', label:'Assistant speaks first' }, { value:'user_first', label:'User speaks first' }]}
                />
              </Field>
              <Field label="First Message">
                <input value={active.config.model.firstMessage} onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } }))} className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }} />
              </Field>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">System Prompt</div>
                <button onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))} className="btn btn--ghost">
                  <RefreshCw className="w-4 h-4" /> Reset
                </button>
              </div>
              <textarea
                rows={14}
                value={active.config.model.systemPrompt || ''}
                onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', minHeight: 320 }}
              />
            </div>
          </Section>

          {/* VOICE */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(300px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={handleVoiceProviderChange}
                  items={[
                    { value:'elevenlabs', label:'ElevenLabs (US)' },
                    { value:'openai',     label:'Browser Fallback' },
                  ]}
                />
              </Field>
              <Field label="Voice">
                <Select
                  value={pendingVoiceId || active.config.voice.voiceId}
                  onChange={handleVoiceIdChange}
                  items={active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices}
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={testVoice} className="btn btn--ghost"><Volume2 className="w-4 h-4" /> Test Voice</button>
              <button onClick={saveVoice} className="btn btn--green"><Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span></button>
              <button onClick={()=> { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your importer.'); }} className="btn btn--ghost">
                <UploadCloud className="w-4 h-4" /> Import from ElevenLabs
              </button>
            </div>
          </Section>

          {/* TRANSCRIBER (unchanged) */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(300px, 1fr))' }}>
              <Field label="Provider"><Select value="deepgram" onChange={()=>{}} items={[{ value:'deepgram', label:'Deepgram' }]} /></Field>
              <Field label="Model"><Select value={active.config.transcriber.model} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, model: v as any } } }))} items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]} /></Field>
              <Field label="Language"><Select value={active.config.transcriber.language} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, language: v as any } } }))} items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]} /></Field>
            </div>
          </Section>

          {/* TELEPHONY — from REGISTRY, not local add/remove */}
          <Section title="Telephony (from Phone Numbers page)" icon={<PhoneIcon className="w-4 h-4" />}>
            <div className="space-y-2">
              {allPhones.length === 0 && <div className="text-sm opacity-70">No phone numbers found. Add them in the Phone Numbers page.</div>}
              {allPhones.map(p => (
                <label key={p.id} className="flex items-center justify-between rounded-xl px-3 py-2"
                       style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.label || 'Untitled'}</div>
                    <div className="text-xs opacity-70">{p.e164}</div>
                  </div>
                  <input
                    type="radio"
                    name="linked_phone"
                    checked={active.config.telephony?.linkedPhoneId === p.id}
                    onChange={()=> updateActive(a => ({ ...a, config:{ ...a.config, telephony:{ linkedPhoneId: p.id } } }))}
                  />
                </label>
              ))}
              {allPhones.length > 0 && (
                <div className="text-xs opacity-70">Pick which saved phone to link to this assistant. (Managed in Phone Numbers page.)</div>
              )}
            </div>
          </Section>

          {/* CALL */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4" />}>
            <div className="flex items-center gap-2 mb-3">
              {!currentCallId ? (
                <button onClick={startCall} className="btn btn--green"><PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span></button>
              ) : (
                <button onClick={()=> endCall('Ended by user')} className="btn btn--danger"><PhoneOff className="w-4 h-4" /> End Call</button>
              )}
              <div className="text-xs opacity-70">Speaks with ElevenLabs US voices when selected. Brain = your OpenAI key from Keys page.</div>
            </div>
            <div className="rounded-2xl p-3" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{ background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)', border: '1px solid var(--va-border)' }}>
                      {t.role==='assistant' ? 'AI' : 'You'}
                    </div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* LOGS */}
          <Section title="Call Logs" icon={<ListTree className="w-4 h-4" />}>
            <div className="space-y-3">
              {callsForAssistant.length === 0 && <div className="text-sm opacity-60">No calls yet.</div>}
              {callsForAssistant.map(log => (
                <details key={log.id} className="rounded-xl" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4" />
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                      {log.endedAt ? <span className="opacity-70">• {Math.max(1, Math.round((log.endedAt - log.startedAt)/1000))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{ background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)', border: '1px solid var(--va-border)' }}>
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

      {/* Delete modal */}
      <AnimatePresence>
        {deleting && (
          <DeleteModal
            open={true}
            name={deleting.name}
            onCancel={()=> setDeleting(null)}
            onConfirm={()=> { removeAssistant(deleting.id); setDeleting(null); }}
          />
        )}
      </AnimatePresence>

      <StyleBlock />
    </div>
  );
}
