// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, FileText, Mic2, BookOpen, SlidersHorizontal,
  Rocket, Trash2, Copy, MessageSquare, ListTree, AudioLines,
  Volume2, Save, ChevronDown, ChevronRight, X, Check, Phone as PhoneIcon, RefreshCw
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';
import WebCallButton from '@/components/voice/WebCallButton';

/* =============================================================================
CONFIG / TOKENS (same visuals as your old file)
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

const TICK_MS = 10;
const CHUNK_SIZE = 6;

/* =============================================================================
TYPES + STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type PhoneNum = { id: string; label?: string; e164: string };

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
  costUSD?: number;
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

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;

const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

const readLS = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
};
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
BASE PROMPT
============================================================================= */
const BASE_PROMPT = `[Identity]
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.

[Style]
- Maintain a professional and approachable demeanor.
- Use clear, concise language and avoid jargon.

[System Behaviors]
- Ask one question at a time.
- Summarize & confirm before finalizing.
- Offer next steps when appropriate.

[Task & Goals]
- Understand intent, collect required details, and provide guidance.

[Data to Collect]
- Full Name
- Phone Number
- Email (optional)
- Appointment Date/Time (if applicable)

[Safety]
- No medical/legal/financial advice beyond high-level pointers.
- Decline restricted actions; suggest alternatives.

[Handover]
- When done, summarize details and hand off if needed.`.trim();

/* =============================================================================
DIFF (char-level LCS) with add/del highlighting
============================================================================= */
type DiffTok = { ch: string; type: 'same' | 'add' | 'del' };
function diffChars(oldStr: string, newStr: string): DiffTok[] {
  const o = [...oldStr], n = [...newStr];
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) {
    for (let j = n.length - 1; j >= 0; j--) {
      dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffTok[] = [];
  let i = 0, j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { out.push({ ch: n[j], type: 'same' }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ ch: o[i], type: 'del' }); i++; }
    else { out.push({ ch: n[j], type: 'add' }); j++; }
  }
  while (i < o.length) out.push({ ch: o[i++], type: 'del' });
  while (j < n.length) out.push({ ch: n[j++], type: 'add' });
  return out;
}

/* =============================================================================
PAGE
============================================================================= */
export default function VoiceAgentSection() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  // assistants
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<Assistant | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!isClient) return;
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (!list.length) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        folder: 'Health',
        updatedAt: Date.now(),
        published: false,
        config: {
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
          voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
          telephony: { numbers: [], linkedNumberId: undefined }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      const fixed = list.map(a => ({ ...a, config:{ ...a.config, telephony: a.config.telephony || { numbers: [], linkedNumberId: undefined } } }));
      writeLS(LS_LIST, fixed);
      setAssistants(fixed); setActiveId(fixed[0].id);
    }
    if (!readLS<CallLog[]>(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS<Record<string,string>>(LS_ROUTES)) writeLS(LS_ROUTES, {});
  }, [isClient]);

  useEffect(() => {
    if (!isClient || !activeId) { setActive(null); return; }
    setActive(readLS<Assistant>(ak(activeId)));
  }, [isClient, activeId, rev]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x);
    writeLS(LS_LIST, list);
    setAssistants(list);
    setActive(next);
    setRev(r => r + 1);
  };

  /* ---------- Assistants CRUD wired to AssistantRail ---------- */
  const onCreate = async () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
        telephony: { numbers: [], linkedNumberId: undefined }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  };
  const onRename = (id: string, name: string) => {
    const cur = readLS<Assistant>(ak(id));
    if (cur) writeLS(ak(id), { ...cur, name, updatedAt: Date.now() });
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === id ? { ...x, name, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list); setAssistants(list); setRev(r => r + 1);
  };
  const onDelete = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id);
    if (!list.length) setActiveId('');
    setRev(r => r + 1);
  };

  /* ---------- Prompt Generator (server-powered, no parroting) ---------- */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typingToks, setTypingToks] = useState<DiffTok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);
  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!typingBoxRef.current) return;
    typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight;
  }, [typedCount]);

  const startTyping = (tokens: DiffTok[]) => {
    setTypingToks(tokens);
    setTypedCount(0);
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    typingTimer.current = window.setInterval(() => {
      setTypedCount(c => {
        const next = Math.min(c + CHUNK_SIZE, tokens.length);
        if (next >= tokens.length && typingTimer.current) {
          window.clearInterval(typingTimer.current);
          typingTimer.current = null;
        }
        return next;
      });
    }, TICK_MS);
  };

  async function generatePrompt() {
    if (!active) return;
    const current = active.config.model.systemPrompt || BASE_PROMPT;

    try {
      const r = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: active.config.model.model,
          currentPrompt: current,
          instructions: genText,        // what you type in the modal
        }),
      });
      if (!r.ok) throw new Error('gen failed');

      const j = await r.json();
      const nextPrompt: string = (j?.prompt || '').trim();
      const nextFirst: string | undefined = (j?.firstMessage || '').trim() || undefined;
      if (!nextPrompt) throw new Error('empty');

      setPendingFirstMsg(nextFirst);
      const tokens = diffChars(current, nextPrompt);
      startTyping(tokens);
      setGenOpen(false);
      setGenText('');
    } catch {
      // hard failure: show inline “couldn’t reach generator”
      alert('Could not reach the prompt generator (check OPENAI_API_KEY).');
    }
  }

  const acceptTyping = () => {
    if (!active || !typingToks) return;
    const newPrompt = typingToks.filter(t => t.type !== 'del').map(t => t.ch).join('');
    updateActive(a => ({
      ...a,
      config: {
        ...a.config,
        model: {
          ...a.config.model,
          systemPrompt: newPrompt,
          firstMessage: typeof pendingFirstMsg === 'string' ? pendingFirstMsg : a.config.model.firstMessage
        }
      }
    }));
    setTypingToks(null);
    setPendingFirstMsg(undefined);
  };
  const declineTyping = () => { setTypingToks(null); setPendingFirstMsg(undefined); };

  /* ---------- Voice (same visuals, your green buttons) ---------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam',   label: 'Adam (ElevenLabs)'   },
    { value: 'bella',  label: 'Bella (ElevenLabs)'  },
  ];
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const [pendingVoiceLabel, setPendingVoiceLabel] = useState<string | null>(null);
  useEffect(() => {
    if (active) {
      setPendingVoiceId(active.config.voice.voiceId);
      setPendingVoiceLabel(active.config.voice.voiceLabel);
    }
  }, [active?.id]);
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
    try { const u = new SpeechSynthesisUtterance('Voice saved.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {}
  };

  /* ---------- Telephony utils (unchanged visuals) ---------- */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return {
        ...a,
        config: { ...a.config, telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label||'').trim() || undefined }], linkedNumberId: a.config.telephony?.linkedNumberId } }
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
    if (!active) return;
    const linkedId = active.config.telephony?.linkedNumberId;
    const numbers = active.config.telephony?.numbers ?? [];
    const num = numbers.find(n=>n.id===linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[num.id] = active.id; // link phone-number -> assistant
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  /* ---------- Transcript + logs (fed by WebCallButton.onTurn) ---------- */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [callsForAssistant, setCallsForAssistant] = useState<CallLog[]>([]);
  const ensureCall = () => {
    if (currentCallId || !active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);
    setCurrentCallId(id);
  };
  const onTurn = (role: 'user'|'assistant', text: string) => {
    if (!active) return;
    ensureCall();
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
  };
  const endWebCallSession = (reason = 'Ended by user') => {
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls);
    setCurrentCallId(null);
    try { window.speechSynthesis.cancel(); } catch {}
  };
  useEffect(() => {
    if (!isClient || !active?.id) { setCallsForAssistant([]); return; }
    const list = readLS<CallLog[]>(LS_CALLS) || [];
    setCallsForAssistant(list.filter(c => c.assistantId === active.id));
  }, [isClient, active?.id, currentCallId, transcript.length, rev]);

  if (!isClient) {
    return (<div className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}><StyleBlock /><div className="px-6 py-10 opacity-70 text-sm">Loading…</div></div>);
  }
  if (!active) {
    return (<div className={SCOPE} style={{ color:'var(--text)' }}><StyleBlock /><div className="px-6 py-10 opacity-70">Create your first assistant.</div></div>);
  }

  const railData: AssistantLite[] = assistants.map(a => ({ id:a.id, name:a.name, folder:a.folder, updatedAt:a.updatedAt }));
  const greet = active.config.model.firstMessageMode === 'assistant_first'
    ? (active.config.model.firstMessage || 'Hello. How may I help you today?')
    : 'Listening…';

  return (
    <div className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Assistants rail (old visuals) */}
      <AssistantRail
        assistants={railData}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />

      {/* Main content (same layout as before) */}
      <div
        className="va-main"
        style={{
          marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
          paddingRight:'clamp(20px, 4vw, 40px)',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom:'88px'
        }}
      >
        {/* Top action bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky"
             style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            {!currentCallId ? (
              <WebCallButton
                greet={greet}
                voiceLabel={active.config.voice.voiceLabel}
                systemPrompt={active.config.model.systemPrompt || BASE_PROMPT}
                model={active.config.model.model}
                onTurn={onTurn}
              />
            ) : (
              <button onClick={()=> endWebCallSession('Ended by user')} className="btn btn--danger">
                <PhoneIcon className="w-4 h-4" /> End Call
              </button>
            )}
            <button onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail:{ id: active.id } }))}
                    className="btn btn--ghost"><MessageSquare className="w-4 h-4 icon" /> Chat</button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
              className="btn btn--ghost"
            >
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> onDelete(active.id)} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={publish} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(360px, 1fr))' }}>
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
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn btn--ghost"
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                  <button onClick={()=> setGenOpen(true)} className="btn btn--green">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              {!typingToks ? (
                <textarea
                  rows={26}
                  value={active.config.model.systemPrompt || ''}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                  style={{
                    background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                    boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    minHeight: 560
                  }}
                />
              ) : (
                <div>
                  <div
                    ref={typingBoxRef}
                    className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                    style={{
                      background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                      boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                      fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      whiteSpace:'pre-wrap',
                      minHeight: 560,
                      maxHeight: 680,
                      overflowY:'auto'
                    }}
                  >
                    {(() => {
                      const slice = typingToks.slice(0, typedCount);
                      const out: JSX.Element[] = [];
                      let buf = '';
                      let mode: DiffTok['type'] = slice.length ? slice[0].type : 'same';
                      const flush = (k: string) => {
                        if (!buf) return;
                        if (mode === 'same') out.push(<span key={k}>{buf}</span>);
                        if (mode === 'add')  out.push(<ins key={k} style={{ background:'rgba(16,185,129,.18)', padding:'1px 2px', borderRadius:4, textDecoration:'none' }}>{buf}</ins>);
                        if (mode === 'del')  out.push(<del key={k} style={{ background:'rgba(239,68,68,.18)', padding:'1px 2px', borderRadius:4 }}>{buf}</del>);
                        buf = '';
                      };
                      slice.forEach((t, i) => {
                        if (t.type !== mode) { flush(`k-${i}`); mode = t.type; buf = t.ch; }
                        else buf += t.ch;
                      });
                      flush('tail');
                      if (typedCount < typingToks.length) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                      return out;
                    })()}
                  </div>

                  <div className="flex items-center gap-2 justify-end mt-3">
                    <button onClick={declineTyping} className="btn btn--ghost"><X className="w-4 h-4 icon" /> Decline</button>
                    <button onClick={acceptTyping} className="btn btn--green"><Check className="w-4 h-4 text-white" /><span className="text-white">Accept</span></button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={handleVoiceProviderChange}
                  items={[
                    { value:'openai', label:'OpenAI' },
                    { value:'elevenlabs', label:'ElevenLabs' },
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
              <button
                onClick={()=>{ try { const u = new SpeechSynthesisUtterance('This is a quick preview of the selected voice.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} }}
                className="btn btn--ghost"
              >
                <Volume2 className="w-4 h-4 icon" /> Test Voice
              </button>
              <button onClick={saveVoice} className="btn btn--green">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(360px, 1fr))' }}>
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

          {/* Tools */}
          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(360px, 1fr))' }}>
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

          {/* Web test + transcript */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
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

          {/* Logs */}
          <Section title="Call Logs" icon={<ListTree className="w-4 h-4 icon" />}>
            <div className="space-y-3">
              {callsForAssistant.length === 0 && <div className="text-sm opacity-60">No calls yet.</div>}
              {callsForAssistant.map(log => (
                <details key={log.id} className="rounded-xl" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 icon" />
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

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div
              initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-2xl rounded-2xl"
              style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> Generate / Edit Prompt</div>
                <button onClick={()=> setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4">
                <input
                  value={genText}
                  onChange={(e)=> setGenText(e.target.value)}
                  placeholder={`Examples:\n• tighten Style, be concise\n• [Identity] AI Sales Agent for roofers\n• first message: Hey—quick question to get you booked…`}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn btn--ghost">Cancel</button>
                  <button onClick={generatePrompt} className="btn btn--green"><span className="text-white">Generate</span></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <StyleBlock />
    </div>
  );
}

/* =============================================================================
Atoms (unchanged visuals)
============================================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return ( <div>
    <div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>
    {children} </div>
  );
}
function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 rounded-xl relative"
         style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-[22%] -left-[22%] w-[70%] h-[70%] rounded-full"
           style={{ background:'radial-gradient(circle, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)', filter:'blur(40px)' }} />
      <button type="button" onClick={()=> setOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:.18 }} className="px-5 pb-5">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
Minimal Select (unchanged, your visuals)
============================================================================= */
type Item = { value: string; label: string; icon?: React.ReactNode };
function Select({ value, items, onChange, placeholder, leftIcon }: {
  value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement | null>(null);
  const portal = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => {
      if (btn.current?.contains(e.target as Node) || portal.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [open]);

  const filtered = items.filter(i => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = items.find(i => i.value === value) || null;

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
        style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>} <span className="ml-auto" /> <ChevronDown className="w-4 h-4 icon" /> 
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={portal}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3 rounded-xl"
            style={{
              // simple dropdown near button (not full portal calc to keep code short)
              top: (btn.current?.getBoundingClientRect().bottom || 0) + 8,
              left: (btn.current?.getBoundingClientRect().left || 0),
              width: (btn.current?.getBoundingClientRect().width || 280),
              background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)'
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg"
              style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left"
                  style={{ color:'var(--text)' }}
                >
                  {it.icon}{it.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =============================================================================
Scoped CSS (original dark style)
============================================================================= */
function StyleBlock() {
  return ( <style jsx global>{`
.${SCOPE}{
  --accent:${ACCENT};
  --bg:#0b0c10;
  --text:#eef2f5;
  --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:#0f1315;
  --va-topbar:#0e1214;
  --va-sidebar:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
  --va-chip:rgba(255,255,255,.03);
  --va-border:rgba(255,255,255,.10);
  --va-input-bg:rgba(255,255,255,.03);
  --va-input-border:rgba(255,255,255,.14);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  --va-menu-bg:#101314;
  --va-menu-border:rgba(255,255,255,.16);
  --va-shadow:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.4);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
  --va-shadow-side:8px 0 28px rgba(0,0,0,.42);
  --va-rail-w:360px;
}
:root:not([data-theme="dark"]) .${SCOPE}{
  --bg:#f7f9fb;
  --text:#101316;
  --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
  --va-card:#ffffff;
  --va-topbar:#ffffff;
  --va-sidebar:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
  --va-chip:#ffffff;
  --va-border:rgba(0,0,0,.10);
  --va-input-bg:#ffffff;
  --va-input-border:rgba(0,0,0,.12);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.85);
  --va-menu-bg:#ffffff;
  --va-menu-border:rgba(0,0,0,.10);
  --va-shadow:0 28px 70px rgba(0,0,0,.12), 0 12px 28px rgba(0,0,0,.08);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.16), 0 22px 54px rgba(0,0,0,.10);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.10);
  --va-shadow-side:8px 0 26px rgba(0,0,0,.08);
}

/* buttons */
.${SCOPE} .btn{
  display:inline-flex; align-items:center; gap:.5rem;
  border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1;
  border:1px solid var(--va-border);
}
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }

/* range */
.${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
.${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
.${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }

/* main width */
.${SCOPE} .va-main{ max-width: none !important; }
`}</style> );
}
