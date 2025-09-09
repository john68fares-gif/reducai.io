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

import TelephonyEditor, { PhoneNum } from '@/components/voice/TelephonyEditor';
import {
  SCOPE, Field, Section, Select, DeleteModal, StyleBlock, useAppSidebarWidth
} from '@/components/voice/ui';

/* =============================================================================
   STORAGE + TYPES
============================================================================= */
const LS_LIST   = 'voice:assistants.v1';
const LS_CALLS  = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const LS_OPENAI_KEYS = 'apikeys:openai.v1'; // filled by your “API Keys” page

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
  assistantPhoneNumber?: string;
  transcript: TranscriptTurn[];
};

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
      openaiKeyId?: string; // reference to key stored by your API-key page
      temperature?: number;
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
    telephony?: { numbers: PhoneNum[]; linkedNumberId?: string };
  };
};

type OpenAIKey = { id: string; name: string; key: string };

const readLS = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
};
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   DEFAULT PROMPT
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
   BROWSER ASR + TTS (ElevenLabs-first to ensure American voices)
============================================================================= */
function makeRecognizer(onFinalText: (text:string)=>void) {
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';
  r.onresult = (e: any) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) final += res[0].transcript;
    }
    if (final.trim()) onFinalText(final.trim());
  };
  return r;
}

async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;
  await new Promise(res => {
    const t = setInterval(() => {
      voices = synth.getVoices();
      if (voices.length) { clearInterval(t); res(null); }
    }, 50);
    setTimeout(() => { clearInterval(t); res(null); }, 1500);
  });
  return synth.getVoices();
}

// Extreme fallback (only if ElevenLabs fails hard)
async function speakBrowser(text: string) {
  const synth = window.speechSynthesis;
  try { synth.resume(); } catch {}
  const voices = await ensureVoicesReady();
  // Prefer any "US" voice to avoid UK accent when falling back
  const us = voices.find(v => /US|en-US/i.test(`${v.name} ${v.lang}`)) || voices[0];
  const u = new SpeechSynthesisUtterance(text);
  u.voice = us; u.rate = 1; u.pitch = 1; u.volume = 1;
  synth.cancel(); synth.speak(u);
}

// Always try ElevenLabs for American voices when provider === 'elevenlabs'
async function speak(text: string, provider: VoiceProvider, voiceId: string, voiceLabel: string) {
  if (provider === 'elevenlabs') {
    try {
      const r = await fetch('/api/tts/elevenlabs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId }), // server uses env ELEVENLABS_API_KEY
      });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = new Audio(url);
      await a.play();
      a.onended = () => URL.revokeObjectURL(url);
      return;
    } catch (e) {
      console.warn('ElevenLabs TTS failed, falling back to browser:', e);
    }
  }
  // fallback (OpenAI/provider==openai or failure)
  await speakBrowser(text);
}

/* =============================================================================
   LLM CHAT (like your text agent) USING /api/chat
   - Pull OpenAI key from your API-key registry in localStorage
============================================================================= */
function getOpenAIKeyFromRegistry(keyId?: string): string | undefined {
  const list = readLS<OpenAIKey[]>(LS_OPENAI_KEYS) || [];
  if (!list.length) return undefined;
  if (!keyId) return list[0]?.key;
  return list.find(k => k.id === keyId)?.key || list[0]?.key;
}

/* =============================================================================
   COMPONENT
============================================================================= */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.body.getAttribute('data-sb-collapsed') === 'true';
  });
  useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (typeof detail.collapsed === 'boolean') setSbCollapsed(!!detail.collapsed);
    };
    window.addEventListener('layout:sidebar', onEvt as EventListener);
    const mo = new MutationObserver(() => {
      setSbCollapsed(document.body.getAttribute('data-sb-collapsed') === 'true');
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-sb-collapsed', 'class'] });
    return () => { window.removeEventListener('layout:sidebar', onEvt as EventListener); mo.disconnect(); };
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
        folder: 'Health',
        updatedAt: Date.now(),
        published: false,
        config: {
          model: {
            provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first',
            firstMessage:'Hello! How can I help today?', systemPrompt: BASE_PROMPT, temperature: 0.5
          },
          voice: { provider:'elevenlabs', voiceId:'rachel', voiceLabel:'Rachel (ElevenLabs)' }, // American by default
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
          telephony: { numbers: [], linkedNumberId: undefined }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      const fixed = list.map(a => ({
        ...a,
        config:{ ...a.config, telephony: a.config.telephony || { numbers: [], linkedNumberId: undefined } }
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

  const [creating, setCreating] = useState(false);
  const addAssistant = async () => {
    setCreating(true); await new Promise(r => setTimeout(r, 200));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello!', systemPrompt:'', temperature:0.5 },
        voice: { provider:'elevenlabs', voiceId:'rachel', voiceLabel:'Rachel (ElevenLabs)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
        telephony: { numbers: [], linkedNumberId: undefined }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
    setCreating(false); setEditingId(id); setTempName('New Assistant');
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
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' }, // US
    { value: 'adam',   label: 'Adam (ElevenLabs)'   }, // US
    { value: 'bella',  label: 'Bella (ElevenLabs)'  }, // US
  ];

  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const [pendingVoiceLabel, setPendingVoiceLabel] = useState<string | null>(null);

  useEffect(() => {
    if (active) {
      setPendingVoiceId(active.config.voice.voiceId);
      setPendingVoiceLabel(active.config.voice.voiceLabel);
    }
  }, [active?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
    updateActive(a => ({
      ...a,
      config: { ...a.config, voice: { ...a.config.voice, voiceId: pendingVoiceId, voiceLabel: pendingVoiceLabel || pendingVoiceId } }
    }));
    await speak('Voice saved.', active.config.voice.provider, pendingVoiceId, pendingVoiceLabel || pendingVoiceId);
  };
  const testVoice = async () => {
    if (!active || !pendingVoiceLabel || !pendingVoiceId) return;
    await speak('This is a quick preview of the selected voice.', active.config.voice.provider, pendingVoiceId, pendingVoiceLabel);
  };

  /* ---------- Web call ---------- */
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

  async function llmReply(userText: string): Promise<string> {
    if (!active) return 'Understood.';
    const { model, systemPrompt, temperature, openaiKeyId } = active.config.model;
    const key = getOpenAIKeyFromRegistry(openaiKeyId);

    // Build chat history (system + rolling turns)
    if (chatHistoryRef.current.length === 0) {
      chatHistoryRef.current.push({ role:'system', content: systemPrompt || BASE_PROMPT });
    }
    chatHistoryRef.current.push({ role: 'user', content: userText });

    const resp = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        agent: {
          name: active.name,
          prompt: systemPrompt || BASE_PROMPT,
          model,
          temperature: typeof temperature === 'number' ? temperature : 0.5,
          apiKey: key // provided by your API-key page registry
        },
        messages: chatHistoryRef.current
      })
    });

    if (!resp.ok) {
      const err = await resp.text().catch(()=> 'Chat server error.');
      return `Sorry, I hit an error: ${err}`;
    }
    const data = await resp.json();
    const text = (data?.reply || '').trim() || '…';
    chatHistoryRef.current.push({ role:'assistant', content: text });
    return text;
  }

  async function startCall() {
    if (!active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id);
    setTranscript([]);
    chatHistoryRef.current = []; // reset thread

    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);

    const greet = active.config.model.firstMessage || 'Hello! How can I help today?';
    if (active.config.model.firstMessageMode === 'assistant_first') {
      pushTurn('assistant', greet);
      await speak(greet, active.config.voice.provider, active.config.voice.voiceId, active.config.voice.voiceLabel);
      // also seed chat with system + greeting as assistant turn so continuity feels natural
      chatHistoryRef.current = [
        { role:'system', content: active.config.model.systemPrompt || BASE_PROMPT },
        { role:'assistant', content: greet }
      ];
    } else {
      chatHistoryRef.current = [
        { role:'system', content: active.config.model.systemPrompt || BASE_PROMPT }
      ];
    }

    const rec = makeRecognizer(async (finalText) => {
      pushTurn('user', finalText);
      const reply = await llmReply(finalText);
      pushTurn('assistant', reply);
      await speak(reply, active.config.voice.provider, active.config.voice.voiceId, active.config.voice.voiceLabel);
    });

    if (!rec) {
      const msg = 'Browser speech recognition is not available here. Use Chrome or Edge.';
      pushTurn('assistant', msg);
      await speak(msg, active.config.voice.provider, active.config.voice.voiceId, active.config.voice.voiceLabel);
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

  if (!active) {
    return (
      <div ref={scopeRef} className={SCOPE} style={{ color:'var(--text)' }}>
        <div className="px-6 py-10 opacity-70">Create your first assistant.</div>
        <StyleBlock />
      </div>
    );
  }

  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));
  const beginRename = (a: Assistant) => { setEditingId(a.id); setTempName(a.name); };
  const saveRename = (a: Assistant) => {
    const name = (tempName || '').trim() || 'Untitled';
    if (a.id === activeId) updateActive(x => ({ ...x, name }));
    else {
      const cur = readLS<Assistant>(ak(a.id));
      if (cur) writeLS(ak(a.id), { ...cur, name, updatedAt: Date.now() });
      const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === a.id ? { ...x, name, updatedAt: Date.now() } : x);
      writeLS(LS_LIST, list); setAssistants(list);
      setRev(r => r + 1);
    }
    setEditingId(null);
  };

  /* ---------- Telephony helpers ---------- */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim();
    if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return {
        ...a,
        config: {
          ...a.config,
          telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label||'').trim() || undefined }], linkedNumberId: a.config.telephony?.linkedNumberId }
        }
      };
    });
  };
  const removePhone = (id: string) => {
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      const linked = a.config.telephony?.linkedNumberId;
      const nextLinked = linked === id ? undefined : linked;
      return { ...a, config: { ...a.config, telephony: { numbers: nums.filter(n => n.id !== id), linkedNumberId: nextLinked } } };
    });
  };
  const setLinkedNumber = (id?: string) => {
    updateActive(a => ({ ...a, config: { ...a.config, telephony: { numbers: a.config.telephony?.numbers || [], linkedNumberId: id } } }));
  };

  const publish = () => {
    const linkedId = active.config.telephony?.linkedNumberId;
    const numbers = active.config.telephony?.numbers ?? [];
    const num = numbers.find(n=>n.id===linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[num.id] = active.id; writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ================= ASSISTANTS RAIL ================= */}
      <aside
        className="hidden lg:flex flex-col"
        data-collapsed={false}
        style={{
          position:'fixed',
          left:'calc(var(--app-sidebar-w, 248px) - 1px)',
          top:'var(--app-header-h, 64px)',
          width: 'var(--va-rail-w, 360px)',
          height:'calc(100vh - var(--app-header-h, 64px))',
          borderRight:'1px solid var(--va-border)',
          background:'var(--va-sidebar)',
          boxShadow:'var(--va-shadow-side)',
          zIndex: 10
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4" />
            <span>Assistants</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={addAssistant} className="btn btn--green">
              {creating ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/50 border-t-transparent animate-spin" /> : <Plus className="w-3.5 h-3.5 text-white" />}
              <span className="text-white">{creating ? 'Creating…' : 'Create'}</span>
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
               style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
            <Search className="w-4 h-4" />
            <input
              value={query}
              onChange={(e)=> setQuery(e.target.value)}
              placeholder="Search assistants"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color:'var(--text)' }}
            />
          </div>

          <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5" /> Folders
          </div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
            <FolderOpen className="w-4 h-4" /> All
          </button>

          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isActive = a.id === activeId;
              const isEdit = editingId === a.id;
              return (
                <div key={a.id} className="w-full rounded-xl p-3"
                     style={{
                       background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                       border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`
                     }}>
                  <button className="w-full text-left flex items-center justify-between"
                          onClick={()=> setActiveId(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4" />
                        {!isEdit ? (
                          <span className="truncate">{a.name}</span>
                        ) : (
                          <input
                            autoFocus
                            value={tempName}
                            onChange={(e)=> setTempName(e.target.value)}
                            onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }}
                            className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
                            style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }}
                          />
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">
                        {a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    {isActive ? <Check className="w-4 h-4" /> : null}
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); beginRename(a); }} className="btn btn--ghost text-xs"><Edit3 className="w-3.5 h-3.5" /> Rename</button>
                        <button onClick={(e)=> { e.stopPropagation(); setDeleting({ id:a.id, name:a.name }); }} className="btn btn--danger text-xs"><Trash2 className="w-4 h-4" /> Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn btn--green text-xs"><Check className="w-4 h-4 text-white" /><span className="text-white">Save</span></button>
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

      {/* =================================== EDITOR =================================== */}
      <div
        className="va-main"
        style={{
          marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
          paddingRight:'clamp(20px, 4vw, 40px)',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom:'88px'
        }}
      >
        {/* top bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky"
             style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            {!currentCallId ? (
              <button onClick={startCall} className="btn btn--green">
                <PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Call Assistant</span>
              </button>
            ) : (
              <button onClick={()=> endCall('Ended by user')} className="btn btn--danger">
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            )}
            <button onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail:{ id: active.id } }))} className="btn btn--ghost">
              <MessageSquare className="w-4 h-4" /> Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
              className="btn btn--ghost"
            >
              <Copy className="w-4 h-4" /> Copy Prompt
            </button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={publish} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {/* content */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          <Section title="Model" icon={<FileText className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(300px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.model.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as Provider } } }))}
                  items={[{ value:'openai', label:'OpenAI' }]}
                />
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
              <Field label="OpenAI API Key (from API Keys page)">
                <Select
                  value={active.config.model.openaiKeyId || ''}
                  onChange={(id)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, openaiKeyId: id || undefined } } }))}
                  items={(readLS<OpenAIKey[]>(LS_OPENAI_KEYS) || []).map(k => ({ value:k.id, label:k.name }))}
                  placeholder="Choose a saved key…"
                />
              </Field>
              <Field label="Temperature">
                <input
                  type="number" step={0.1} min={0} max={1}
                  value={active.config.model.temperature ?? 0.5}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, temperature: Number(e.target.value) } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
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
                <input
                  value={active.config.model.firstMessage}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
              </Field>
            </div>

            {/* System Prompt */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold">System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn btn--ghost"
                  ><RefreshCw className="w-4 h-4" /> Reset</button>
                </div>
              </div>
              <textarea
                rows={16}
                value={active.config.model.systemPrompt || ''}
                onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                  boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                  fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  minHeight: 360
                }}
              />
            </div>
          </Section>

          <Section title="Voice" icon={<Mic2 className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(300px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={handleVoiceProviderChange}
                  items={[
                    { value:'elevenlabs', label:'ElevenLabs (Natural, US)' },
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

          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(300px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.transcriber.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, provider: v as any } } }))}
                  items={[{ value:'deepgram', label:'Deepgram' }]}
                />
              </Field>
              <Field label="Model">
                <Select
                  value={active.config.transcriber.model}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, model: v as any } } }))}
                  items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]}
                />
              </Field>
              <Field label="Language">
                <Select
                  value={active.config.transcriber.language}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, language: v as any } } }))}
                  items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]}
                />
              </Field>
              <Field label="Confidence Threshold">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={active.config.transcriber.confidenceThreshold}
                    onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } } }))}
                    className="va-range w-full"
                  />
                  <span className="text-xs" style={{ color:'var(--text-muted)' }}>{active.config.transcriber.confidenceThreshold.toFixed(2)}</span>
                </div>
              </Field>
              <Field label="Denoise">
                <Select
                  value={String(active.config.transcriber.denoise)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, denoise: v==='true' } } }))}
                  items={[{ value:'false', label:'Off' }, { value:'true', label:'On' }]}
                />
              </Field>
              <Field label="Use Numerals">
                <Select
                  value={String(active.config.transcriber.numerals)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, numerals: v==='true' } } }))}
                  items={[{ value:'false', label:'No' }, { value:'true', label:'Yes' }]}
                />
              </Field>
            </div>
          </Section>

          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(300px, 1fr))' }}>
              <Field label="Enable End Call Function">
                <Select
                  value={String(active.config.tools.enableEndCall)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, tools:{ ...a.config.tools, enableEndCall: v==='true' } } }))}
                  items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]}
                />
              </Field>
              <Field label="Dial Keypad">
                <Select
                  value={String(active.config.tools.dialKeypad)}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, tools:{ ...a.config.tools, dialKeypad: v==='true' } } }))}
                  items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]}
                />
              </Field>
            </div>
          </Section>

          <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4" />}>
            <TelephonyEditor
              numbers={active.config.telephony?.numbers ?? []}
              linkedId={active.config.telephony?.linkedNumberId}
              onLink={setLinkedNumber}
              onAdd={addPhone}
              onRemove={removePhone}
            />
          </Section>

          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4" />}>
            <div className="flex items-center gap-2 mb-3">
              {!currentCallId ? (
                <button onClick={startCall} className="btn btn--green">
                  <PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span>
                </button>
              ) : (
                <button onClick={()=> endCall('Ended by user')} className="btn btn--danger">
                  <PhoneOff className="w-4 h-4" /> End Call
                </button>
              )}
              <div className="text-xs opacity-70">Speaks with ElevenLabs voices (US) when selected.</div>
            </div>
            <div className="rounded-2xl p-3" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                      border: '1px solid var(--va-border)'
                    }}>{t.role==='assistant' ? 'AI' : 'You'}</div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

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
                      {log.endedAt ? <span className="opacity-70">• {(Math.max(1, Math.round((log.endedAt - log.startedAt)/1000)))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                          border: '1px solid var(--va-border)'
                        }}>{t.role==='assistant' ? 'AI' : 'User'}</div>
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

      {/* Delete overlay */}
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
