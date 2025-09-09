'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Mic2, BookOpen, SlidersHorizontal, AudioLines, ListTree, Rocket,
  Copy, Trash2, MessageSquare, Phone as PhoneIcon, PhoneCall, PhoneOff, Save,
  Volume2, Sparkles, RefreshCw, Check, X, ChevronDown, ChevronRight
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from './AssistantRail';
import TelephonyEditor, { type PhoneNum } from './TelephonyEditor';
import { scopedStorage } from '@/utils/scoped-storage';

/* =============================================================================
   THEME TOKENS (same visuals)
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

/* =============================================================================
   TYPES + STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo' | 'gpt-4.1-mini';
type VoiceProvider = 'openai' | 'elevenlabs';

type TranscriptTurn = { role: 'assistant' | 'user'; text: string; ts: number };
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

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

const readLS = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; }
  catch { return null; }
};
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   PROMPT (unchanged copy you gave me)
============================================================================= */
const BASE_PROMPT = `[Identity]
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.

[Style]
* Maintain a professional and approachable demeanor.
* Use clear and concise language, avoiding overly technical jargon.

[System Behaviors]
* Summarize & confirm before finalizing.
* Offer next steps when appropriate.

[Task & Goals]
* Understand intent, collect required details, and provide guidance.

[Data to Collect]
- Full Name
- Phone Number
- Email (if provided)
- Appointment Date/Time (if applicable)

[Safety]
* No medical/legal/financial advice beyond high-level pointers.
* Decline restricted actions, suggest alternatives.

[Handover]
* When done, summarize details and hand off if needed.`.trim();

/* =============================================================================
   ElevenLabs TTS (server route) + iOS unlock
============================================================================= */
let audioUnlocked = false;
const sharedAudio: HTMLAudioElement | null =
  typeof window !== 'undefined' ? new Audio() : null;

async function unlockAudioOnce() {
  if (audioUnlocked || !sharedAudio) return;
  try {
    sharedAudio.muted = true;
    sharedAudio.src = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA';
    await sharedAudio.play().catch(() => {});
    sharedAudio.pause(); sharedAudio.currentTime = 0; sharedAudio.muted = false;
    audioUnlocked = true;
  } catch {}
}

async function tts(text: string, voiceId: string) {
  const r = await fetch('/api/tts/elevenlabs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ voiceId, text })
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);

  if (!sharedAudio) {
    const a = new Audio(url);
    await a.play();
    a.onended = () => URL.revokeObjectURL(url);
    return;
  }
  try { await sharedAudio.play(); } catch {}
  sharedAudio.src = url;
  try { await sharedAudio.play(); }
  catch { await unlockAudioOnce(); await sharedAudio.play(); }
  sharedAudio.onended = () => URL.revokeObjectURL(url);
}

/* =============================================================================
   Browser SpeechRecognition (guarded)
============================================================================= */
function makeRecognizer(onFinalText: (text: string) => void) {
  if (typeof window === 'undefined') return null;
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';
  r.onresult = (e: any) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) final += e.results[i][0].transcript;
    }
    if (final.trim()) onFinalText(final.trim());
  };
  return r;
}

/* =============================================================================
   API-KEY + MODEL (scoped storage)
   - same keys used in Step2ModelSettings you sent
============================================================================= */
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

type ApiKey = { id: string; name: string; key: string };

async function loadSelectedKeyAndModel(): Promise<{ apiKey?: string; model?: ModelId }> {
  try {
    const ss = await scopedStorage();
    await ss.ensureOwnerGuard();

    const keys = await ss.getJSON<ApiKey[]>(LS_KEYS, []);
    const selectedId = await ss.getJSON<string>(LS_SELECTED, '');
    const step2 = await ss.getJSON<{ model?: string; apiKeyId?: string } | null>('builder:step2', null);

    const id = (step2?.apiKeyId && step2.apiKeyId) || selectedId;
    const key = (keys || []).find(k => k.id === id)?.key;
    const model = (step2?.model as ModelId) || 'gpt-4o';

    return { apiKey: key, model };
  } catch {
    return { apiKey: undefined, model: 'gpt-4o' };
  }
}

/* =============================================================================
   PAGE
============================================================================= */
export default function VoiceAgentSection() {
  /* assistants bootstrap */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
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
          model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT, temperature: 0.5 },
          voice: { provider: 'elevenlabs', voiceId: 'Rachel', voiceLabel: 'Rachel (ElevenLabs)' },
          transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
          tools: { enableEndCall: true, dialKeypad: true },
          telephony: { numbers: [], linkedNumberId: undefined },
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      const fixed = list.map(a => ({ ...a, config: { ...a.config, telephony: a.config.telephony || { numbers: [], linkedNumberId: undefined } } }));
      writeLS(LS_LIST, fixed);
      setAssistants(fixed); setActiveId(fixed[0].id);
    }
    if (!readLS<CallLog[]>(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS<Record<string, string>>(LS_ROUTES)) writeLS(LS_ROUTES, {});
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

  /* rail callbacks */
  const onCreate = async () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name: 'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT, temperature: 0.5 },
        voice: { provider: 'elevenlabs', voiceId: 'Rachel', voiceLabel: 'Rachel (ElevenLabs)' },
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
        tools: { enableEndCall: true, dialKeypad: true },
        telephony: { numbers: [], linkedNumberId: undefined }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  };
  const onRename = (id: string, name: string) => {
    const cur = readLS<Assistant>(ak(id)); if (cur) writeLS(ak(id), { ...cur, name, updatedAt: Date.now() });
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

  /* Voice: save & test (ElevenLabs route + iOS unlock) */
  const testVoice = async () => {
    if (!active) return;
    await unlockAudioOnce();
    await tts('This is a quick preview of the selected voice.', active.config.voice.voiceId);
  };
  const saveVoice = async () => {
    if (!active) return;
    await unlockAudioOnce();
    await tts('Voice saved.', active.config.voice.voiceId);
  };

  /* Telephony helpers */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim();
    if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return {
        ...a,
        config: { ...a.config, telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label || '').trim() || undefined }], linkedNumberId: a.config.telephony?.linkedNumberId } }
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
    const num = numbers.find(n => n.id === linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[num.id] = active.id;
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  /* Web call + transcript + OpenAI chat via /api/chat with per-user key */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const recogRef = useRef<any | null>(null);

  function pushTurn(role: 'assistant' | 'user', text: string) {
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

  async function callLLM(userText: string): Promise<string> {
    if (!active) return '…';
    const { apiKey, model } = await loadSelectedKeyAndModel();
    const agent = {
      name: active.name,
      prompt: active.config.model.systemPrompt || BASE_PROMPT,
      model: (active.config.model.model || model || 'gpt-4o') as string,
      temperature: active.config.model.temperature ?? 0.5,
      apiKey, // <-- per-user key from scoped storage
    };
    const messages = [
      ...(transcript.map(t => ({ role: t.role, content: t.text })) as any[]),
      { role: 'user', content: userText }
    ];
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ agent, messages })
    });
    if (!r.ok) throw new Error(await r.text());
    const data = await r.json();
    return String(data.reply || 'Okay.');
  }

  async function startCall() {
    if (!active) return;
    await unlockAudioOnce();

    const id = `call_${crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id);
    setTranscript([]);

    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);

    const greet = active.config.model.firstMessage || 'Hello. How may I help you today?';
    if (active.config.model.firstMessageMode === 'assistant_first') {
      pushTurn('assistant', greet);
      await tts(greet, active.config.voice.voiceId);
    }

    const rec = makeRecognizer(async (finalText) => {
      pushTurn('user', finalText);
      try {
        const reply = await callLLM(finalText);
        pushTurn('assistant', reply);
        await tts(reply, active.config.voice.voiceId);
      } catch (e: any) {
        const msg = `LLM error: ${e?.message || e}`;
        pushTurn('assistant', msg);
        await tts('Sorry, there was an error.', active.config.voice.voiceId);
      }
    });
    if (!rec) {
      const msg = 'Browser speech recognition is not available here. Use Chrome or Edge.';
      pushTurn('assistant', msg);
      await tts(msg, active.config.voice.voiceId);
      return;
    }
    recogRef.current = rec; try { rec.start(); } catch {}
  }

  function endCall(reason: string) {
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls);
    setCurrentCallId(null);
    try { window.speechSynthesis.cancel(); } catch {}
  }

  const callsForAssistant = (readLS<CallLog[]>(LS_CALLS) || []).filter(c => c.assistantId === active?.id);

  if (!active) {
    return (
      <div className={SCOPE} style={{ color: 'var(--text)' }}>
        <div className="px-6 py-10 opacity-70">Create your first assistant.</div>
        <StyleBlock />
      </div>
    );
  }

  const railData: AssistantLite[] = assistants.map(a => ({ id: a.id, name: a.name, folder: a.folder, updatedAt: a.updatedAt }));

  return (
    <div className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* LEFT RAIL */}
      <AssistantRail
        assistants={railData}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />

      {/* MAIN */}
      <div
        className="va-main"
        style={{
          marginLeft: `calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
          paddingRight: 'clamp(20px, 4vw, 40px)',
          paddingTop: 'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom: '88px'
        }}
      >
        {/* top bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky"
             style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
          <div className="flex items-center gap-2">
            {!currentCallId ? (
              <button onClick={startCall} className="btn btn--green">
                <PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Call Assistant</span>
              </button>
            ) : (
              <button onClick={() => endCall('Ended by user')} className="btn btn--danger">
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            )}
            <button onClick={() => window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail: { id: active.id } }))} className="btn btn--ghost">
              <MessageSquare className="w-4 h-4 icon" /> Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(() => {})}
              className="btn btn--ghost"
            >
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={() => { onDelete(active.id); }} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={publish} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth: 'min(2400px, 98vw)' }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(4, minmax(360px, 1fr))' }}>
              <Field label="Provider"><MiniSelect value="openai" items={[{ value: 'openai', label: 'OpenAI' }]} onChange={() => {}} /></Field>
              <Field label="Model">
                <MiniSelect
                  value={active.config.model.model}
                  items={[
                    { value: 'gpt-4o', label: 'GPT-4o' },
                    { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
                    { value: 'gpt-4.1', label: 'GPT-4.1' },
                    { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
                    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
                  ]}
                  onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, model: v as ModelId } } }))}
                />
              </Field>
              <Field label="First Message Mode">
                <MiniSelect
                  value={active.config.model.firstMessageMode}
                  items={[{ value: 'assistant_first', label: 'Assistant speaks first' }, { value: 'user_first', label: 'User speaks first' }]}
                  onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessageMode: v as any } } }))}
                />
              </Field>
              <Field label="First Message">
                <input
                  value={active.config.model.firstMessage}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessage: e.target.value } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)', color: 'var(--text)' }}
                />
              </Field>
            </div>

            {/* System prompt */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn btn--ghost"
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                </div>
              </div>
              <textarea
                rows={20}
                value={active.config.model.systemPrompt || ''}
                onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: e.target.value } } }))}
                className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)',
                  boxShadow: 'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color: 'var(--text)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  minHeight: 440
                }}
              />
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <MiniSelect
                  value={active.config.voice.provider}
                  items={[{ value: 'elevenlabs', label: 'ElevenLabs' }, { value: 'openai', label: 'OpenAI (browser TTS)' }]}
                  onChange={(v) => updateActive(a => {
                    const fallback = v === 'elevenlabs'
                      ? { voiceId: 'Rachel', voiceLabel: 'Rachel (ElevenLabs)' }
                      : { voiceId: 'Samantha', voiceLabel: 'Samantha (Browser)' };
                    return { ...a, config: { ...a.config, voice: { provider: v as VoiceProvider, ...fallback } } };
                  })}
                />
              </Field>
              <Field label="Voice">
                <MiniSelect
                  value={active.config.voice.voiceId}
                  items={
                    active.config.voice.provider === 'elevenlabs'
                      ? [
                          { value: 'Rachel', label: 'Rachel (US)' },
                          { value: 'Adam', label: 'Adam (US)' },
                          { value: 'Bella', label: 'Bella (US)' },
                        ]
                      : [
                          { value: 'Samantha', label: 'Samantha (en-US)' },
                          { value: 'Alex', label: 'Alex (en-US)' },
                          { value: 'Victoria', label: 'Victoria (en-US)' },
                        ]
                  }
                  onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, voiceId: v, voiceLabel: v } } }))}
                />
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={testVoice} className="btn btn--ghost">
                <Volume2 className="w-4 h-4 icon" /> Test Voice
              </button>
              <button onClick={saveVoice} className="btn btn--green">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
            </div>
          </Section>

          {/* Transcriber (UI only, no server change) */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(360px, 1fr))' }}>
              <Field label="Provider"><MiniSelect value="deepgram" items={[{ value: 'deepgram', label: 'Deepgram' }]} onChange={() => {}} /></Field>
              <Field label="Model">
                <MiniSelect value={active.config.transcriber.model} items={[{ value: 'nova-2', label: 'Nova 2' }, { value: 'nova-3', label: 'Nova 3' }]}
                            onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, model: v as any } } }))} />
              </Field>
              <Field label="Language">
                <MiniSelect value={active.config.transcriber.language} items={[{ value: 'en', label: 'English' }, { value: 'multi', label: 'Multi' }]}
                            onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, language: v as any } } }))} />
              </Field>
            </div>
          </Section>

          {/* Tools */}
          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Enable End Call Function">
                <MiniSelect value={String(active.config.tools.enableEndCall)} items={[{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]}
                            onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, enableEndCall: v === 'true' } } }))} />
              </Field>
              <Field label="Dial Keypad">
                <MiniSelect value={String(active.config.tools.dialKeypad)} items={[{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]}
                            onChange={(v) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, dialKeypad: v === 'true' } } }))} />
              </Field>
            </div>
          </Section>

          {/* Telephony */}
          <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4 icon" />}>
            <TelephonyEditor
              numbers={active.config.telephony?.numbers ?? []}
              linkedId={active.config.telephony?.linkedNumberId}
              onLink={setLinkedNumber}
              onAdd={addPhone}
              onRemove={removePhone}
            />
          </Section>

          {/* Web Call */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
            <div className="flex items-center gap-2 mb-3">
              {!currentCallId ? (
                <button onClick={startCall} className="btn btn--green">
                  <PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span>
                </button>
              ) : (
                <button onClick={() => endCall('Ended by user')} className="btn btn--danger">
                  <PhoneOff className="w-4 h-4" /> End Call
                </button>
              )}
              <div className="text-xs opacity-70">Talk to the assistant using your browser mic. ElevenLabs audio for replies.</div>
            </div>
            <div className="rounded-2xl p-3" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: t.role === 'assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                      border: '1px solid var(--va-border)'
                    }}>{t.role === 'assistant' ? 'AI' : 'You'}</div>
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
                <details key={log.id} className="rounded-xl" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 icon" />
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                      {log.endedAt ? <span className="opacity-70">• {Math.max(1, Math.round((log.endedAt - log.startedAt) / 1000))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: t.role === 'assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                          border: '1px solid var(--va-border)'
                        }}>{t.role === 'assistant' ? 'AI' : 'User'}</div>
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

      <StyleBlock />
    </div>
  );
}

/* =============================================================================
   Small atoms (unchanged visuals)
============================================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 rounded-xl relative" style={{ background: 'var(--va-card)', border: '1px solid var(--va-border)', boxShadow: 'var(--va-shadow)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-[22%] -left-[22%] w-[70%] h-[70%] rounded-full"
           style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }} className="px-5 pb-5">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
type Item = { value: string; label: string };
function MiniSelect({ value, items, onChange }: { value: string; items: Item[]; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
      style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-input-shadow)', color: 'var(--text)' }}
    >
      {items.map(it => <option key={it.value} value={it.value}>{it.label}</option>)}
    </select>
  );
}

/* =============================================================================
   Scoped CSS (exact theme)
============================================================================= */
function StyleBlock() {
  return (
    <style jsx global>{`
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
.${SCOPE} .va-main{ max-width: none !important; }
.${SCOPE} .icon{ color: var(--accent); }

.${SCOPE} .btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1; border:1px solid var(--va-border); }
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }
`}</style>
  );
}
