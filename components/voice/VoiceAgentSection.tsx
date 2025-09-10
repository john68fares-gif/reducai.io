// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, FileText, Mic2, BookOpen, SlidersHorizontal,
  Rocket, Trash2, Copy, MessageSquare, ListTree, AudioLines,
  Volume2, Save, ChevronDown, ChevronRight, X, Check, Phone as PhoneIcon
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';
import WebCallButton from '@/components/voice/WebCallButton';

/* =============================================================================
   THEME / TOKENS (dark from your Improve panel). Green buttons unchanged.
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

/* =============================================================================
   TYPES + STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type PhoneNum = { id: string; label?: string; e164: string };
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
   LOCAL MERGE (fallback if generator API fails)
============================================================================= */
function sectionRegex(name: string) {
  return new RegExp(String.raw`\[${name}\]\s*([\s\S]*?)(?=\n\[|$)`, 'i');
}
function setSection(prompt: string, name: string, body: string) {
  const re = sectionRegex(name);
  if (re.test(prompt)) return prompt.replace(re, `[${name}]\n${body.trim()}\n`);
  const nl = prompt.endsWith('\n') ? '' : '\n';
  return `${prompt}${nl}\n[${name}]\n${body.trim()}\n`;
}
function mergeInput(freeText: string, current: string) {
  const out = { prompt: current || BASE_PROMPT, firstMessage: undefined as string | undefined };
  const raw = (freeText || '').trim();
  if (!raw) return out;

  const m = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  if (m) { out.firstMessage = m[1].trim(); return out; }

  const blocks = [...raw.matchAll(/\[(Identity|Style|System Behaviors|Task & Goals|Data to Collect|Safety|Handover|Refinements)\]\s*([\s\S]*?)(?=\n\[|$)/gi)];
  if (blocks.length) {
    let next = out.prompt;
    for (const b of blocks) next = setSection(next, b[1], b[2]);
    out.prompt = next;
    return out;
  }

  const hasRef = sectionRegex('Refinements').test(out.prompt);
  const bullet = `- ${raw.replace(/\s+/g, ' ').trim()}`;
  out.prompt = hasRef
    ? out.prompt.replace(sectionRegex('Refinements'), (_m, body) => `[Refinements]\n${(body || '').trim()}\n${bullet}\n`)
    : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* =============================================================================
   DIFF (char-level LCS) with added/removed flags
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
  // client gate
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
        folder: 'Default',
        updatedAt: Date.now(),
        published: false,
        config: {
          model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello. How may I help you today?', systemPrompt: BASE_PROMPT },
          voice: { provider: 'openai', voiceId: 'alloy', voiceLabel: 'Alloy (OpenAI)' },
          transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
          tools: { enableEndCall: true, dialKeypad: true },
          telephony: { numbers: [], linkedNumberId: undefined }
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
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x
    );
    writeLS(LS_LIST, list);
    setAssistants(list);
    setActive(next);
    setRev(r => r + 1);
  };

  /* -------------------- Assistants CRUD (rail) -------------------- */
  const onCreate = async () => {
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name: 'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT },
        voice: { provider: 'openai', voiceId: 'alloy', voiceLabel: 'Alloy (OpenAI)' },
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

  /* -------------------- Prompt Generator -------------------- */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typingToks, setTypingToks] = useState<DiffTok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);

  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!typingBoxRef.current) return;
    typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight;
  }, [typedCount]);

  function startTyping(tokens: DiffTok[]) {
    setTypingToks(tokens);
    setTypedCount(0);
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    typingTimer.current = window.setInterval(() => {
      setTypedCount(c => {
        const next = Math.min(c + 6, tokens.length);
        if (next >= tokens.length && typingTimer.current) {
          window.clearInterval(typingTimer.current);
          typingTimer.current = null;
        }
        return next;
      });
    }, 10);
  }

  async function generatePrompt() {
    if (!active) return;
    setIsGenerating(true);
    const current = active.config.model.systemPrompt || BASE_PROMPT;

    // Try server generator first
    let nextPrompt = '';
    let nextFirst: string | undefined = undefined;
    try {
      const r = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: active.config.model.model,
          currentPrompt: current,
          instructions: genText, // your “what should change”
        }),
      });
      if (!r.ok) throw new Error('bad status');
      const j = await r.json();
      nextPrompt = (j?.prompt || '').trim();
      nextFirst = (j?.firstMessage || '').trim() || undefined;
      if (!nextPrompt) throw new Error('empty prompt');
    } catch {
      // Fallback to local merge (safe)
      const { prompt, firstMessage } = mergeInput(genText, current || BASE_PROMPT);
      nextPrompt = prompt;
      nextFirst = firstMessage;
    }

    setPendingFirstMsg(nextFirst);
    const toks = diffChars(current, nextPrompt);
    startTyping(toks);
    setGenOpen(false);
    setGenText('');
    setIsGenerating(false);
  }

  function acceptTyping() {
    if (!active || !typingToks) return;
    // reconstruct new string from tokens (drop deletions)
    const newPrompt = typingToks.filter(t => t.type !== 'del').map(t => t.ch).join('');
    updateActive(a => ({
      ...a,
      config: { ...a.config, model: { ...a.config.model, systemPrompt: newPrompt, firstMessage: typeof pendingFirstMsg === 'string' ? pendingFirstMsg : a.config.model.firstMessage } }
    }));
    setTypingToks(null);
    setPendingFirstMsg(undefined);
  }
  function declineTyping() { setTypingToks(null); setPendingFirstMsg(undefined); }

  /* -------------------- Voice & Telephony -------------------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam', label: 'Adam (ElevenLabs)' },
    { value: 'bella', label: 'Bella (ElevenLabs)' },
  ];
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const [pendingVoiceLabel, setPendingVoiceLabel] = useState<string | null>(null);
  useEffect(() => {
    if (active) { setPendingVoiceId(active.config.voice.voiceId); setPendingVoiceLabel(active.config.voice.voiceLabel); }
  }, [active?.id]);
  const handleVoiceProviderChange = (v: string) => {
    const list = v === 'elevenlabs' ? elevenVoices : openaiVoices;
    setPendingVoiceId(list[0].value); setPendingVoiceLabel(list[0].label);
    updateActive(a => ({ ...a, config: { ...a.config, voice: { provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
  };
  const handleVoiceIdChange = (v: string) => {
    if (!active) return;
    const list = active.config.voice.provider === 'elevenlabs' ? elevenVoices : openaiVoices;
    const found = list.find(x => x.value === v);
    setPendingVoiceId(v); setPendingVoiceLabel(found?.label || v);
  };
  const saveVoice = async () => {
    if (!active || !pendingVoiceId) return;
    updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, voiceId: pendingVoiceId, voiceLabel: pendingVoiceLabel || pendingVoiceId } } }));
    try { const u = new SpeechSynthesisUtterance('Voice saved.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {}
  };

  // Telephony
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return { ...a, config: { ...a.config, telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label || '').trim() || undefined }], linkedNumberId: a.config.telephony?.linkedNumberId } } };
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

  /* -------------------- Transcript + Logs (fed by WebCallButton) -------------------- */
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
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
  const onTurn = (role: 'user' | 'assistant', text: string) => {
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
  };
  useEffect(() => {
    if (!isClient || !active?.id) { setCallsForAssistant([]); return; }
    const list = readLS<CallLog[]>(LS_CALLS) || [];
    setCallsForAssistant(list.filter(c => c.assistantId === active.id));
  }, [isClient, active?.id, currentCallId, transcript.length, rev]);

  if (!isClient) return (<Shell><div className="opacity-70 text-sm px-6 py-10">Loading…</div></Shell>);
  if (!active)   return (<Shell><div className="opacity-70 px-6 py-10">Create your first assistant.</div></Shell>);

  const railData: AssistantLite[] = assistants.map(a => ({ id: a.id, name: a.name, folder: a.folder, updatedAt: a.updatedAt }));
  const greet = active.config.model.firstMessageMode === 'assistant_first'
    ? (active.config.model.firstMessage || 'Hello. How may I help you today?')
    : 'Listening…';

  return (
    <div className={`${SCOPE}`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Assistant rail */}
      <AssistantRail
        assistants={railData}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />

      {/* Main */}
      <div
        className="va-main"
        style={{
          marginLeft: `calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
          paddingRight: 'clamp(20px, 4vw, 40px)',
          paddingTop: 'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom: '88px'
        }}
      >
        {/* Top actions */}
        <div className="px-2 pb-3 flex items-center justify-between sticky" style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
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
              <button onClick={() => { endWebCallSession('Ended by user'); window.speechSynthesis?.cancel(); }} className="btn btn--danger">
                <PhoneIcon className="w-4 h-4" /> End Call
              </button>
            )}
            <button onClick={() => window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail: { id: active.id } }))}
                    className="btn btn--ghost"><MessageSquare className="w-4 h-4" /> Chat</button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(() => {})} className="btn btn--ghost">
              <Copy className="w-4 h-4" /> Copy Prompt
            </button>
            <button onClick={() => onDelete(active.id)} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
            <button onClick={publish} className="btn btn--green"><Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span></button>
          </div>
        </div>

        {/* Body (dark Improve-style panels) */}
        <div className="mx-auto grid grid-cols-12 gap-6" style={{ maxWidth: 'min(1600px, 98vw)' }}>
          {/* Model */}
          <Panel title="Model" icon={<FileText className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(4, minmax(260px, 1fr))' }}>
              <Field label="Provider">
                <select
                  value={active.config.model.provider}
                  onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, provider: e.target.value as Provider } } }))}
                  className="inp"
                >
                  <option value="openai">OpenAI</option>
                </select>
              </Field>
              <Field label="Model">
                <select
                  value={active.config.model.model}
                  onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, model: e.target.value as ModelId } } }))}
                  className="inp"
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </Field>
              <Field label="First Message Mode">
                <select
                  value={active.config.model.firstMessageMode}
                  onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessageMode: e.target.value as any } } }))}
                  className="inp"
                >
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </Field>
              <Field label="First Message">
                <input
                  value={active.config.model.firstMessage}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessage: e.target.value } } }))}
                  className="inp"
                />
              </Field>
            </div>

            {/* System Prompt */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                          className="btn btn--ghost">
                    Reset
                  </button>
                  <button onClick={() => setGenOpen(true)} className="btn btn--green">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              {!typingToks ? (
                <textarea
                  rows={24}
                  value={active.config.model.systemPrompt || ''}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: e.target.value } } }))}
                  className="mono"
                  style={{ minHeight: 520 }}
                />
              ) : (
                <div>
                  <div
                    ref={typingBoxRef}
                    className="mono diffbox"
                  >
                    {(() => {
                      const slice = typingToks.slice(0, typedCount);
                      const frag: JSX.Element[] = [];
                      let buf = '';
                      let mode: DiffTok['type'] = slice.length ? slice[0].type : 'same';

                      const pushBuf = (key: string) => {
                        if (!buf) return;
                        if (mode === 'same') frag.push(<span key={key}>{buf}</span>);
                        if (mode === 'add')  frag.push(<ins key={key} className="add">{buf}</ins>);
                        if (mode === 'del')  frag.push(<del key={key} className="del">{buf}</del>);
                        buf = '';
                      };

                      slice.forEach((t, i) => {
                        if (t.type !== mode) { pushBuf(`k-${i}`); mode = t.type; buf = t.ch; }
                        else buf += t.ch;
                      });
                      pushBuf('tail');
                      if (typedCount < typingToks.length) frag.push(<span key="caret" className="caret">▌</span>);
                      return frag;
                    })()}
                  </div>

                  <div className="flex items-center gap-2 justify-end mt-3">
                    <button onClick={declineTyping} className="btn btn--ghost"><X className="w-4 h-4" /> Decline</button>
                    <button onClick={acceptTyping} className="btn btn--green"><Check className="w-4 h-4 text-white" /><span className="text-white">Accept</span></button>
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Voice */}
          <Panel title="Voice" icon={<Mic2 className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' }}>
              <Field label="Provider">
                <select value={active.config.voice.provider} onChange={(e) => handleVoiceProviderChange(e.target.value)} className="inp">
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>
              <Field label="Voice">
                <select value={pendingVoiceId || active.config.voice.voiceId} onChange={(e) => handleVoiceIdChange(e.target.value)} className="inp">
                  {(active.config.voice.provider === 'elevenlabs' ? elevenVoices : openaiVoices).map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={async () => { try { const u = new SpeechSynthesisUtterance('This is a quick preview of the selected voice.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} }}
                className="btn btn--ghost">
                <Volume2 className="w-4 h-4" /> Test Voice
              </button>
              <button onClick={saveVoice} className="btn btn--green">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
            </div>
          </Panel>

          {/* Transcriber */}
          <Panel title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(260px, 1fr))' }}>
              <Field label="Provider">
                <select
                  value={active.config.transcriber.provider}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, provider: e.target.value as any } } }))}
                  className="inp"
                >
                  <option value="deepgram">Deepgram</option>
                </select>
              </Field>
              <Field label="Model">
                <select
                  value={active.config.transcriber.model}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, model: e.target.value as any } } }))}
                  className="inp"
                >
                  <option value="nova-2">Nova 2</option>
                  <option value="nova-3">Nova 3</option>
                </select>
              </Field>
              <Field label="Language">
                <select
                  value={active.config.transcriber.language}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, language: e.target.value as any } } }))}
                  className="inp"
                >
                  <option value="en">English</option>
                  <option value="multi">Multi</option>
                </select>
              </Field>

              <Field label="Confidence Threshold">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={active.config.transcriber.confidenceThreshold}
                    onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } } }))}
                    className="range"
                  />
                  <span className="text-xs" style={{ color: 'var(--muted)' }}>{active.config.transcriber.confidenceThreshold.toFixed(2)}</span>
                </div>
              </Field>
              <Field label="Denoise">
                <select
                  value={String(active.config.transcriber.denoise)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, denoise: e.target.value === 'true' } } }))}
                  className="inp"
                >
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </Field>
              <Field label="Use Numerals">
                <select
                  value={String(active.config.transcriber.numerals)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, numerals: e.target.value === 'true' } } }))}
                  className="inp"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
            </div>
          </Panel>

          {/* Tools */}
          <Panel title="Tools" icon={<SlidersHorizontal className="w-4 h-4" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(260px, 1fr))' }}>
              <Field label="Enable End Call Function">
                <select
                  value={String(active.config.tools.enableEndCall)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, enableEndCall: e.target.value === 'true' } } }))}
                  className="inp"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
              <Field label="Dial Keypad">
                <select
                  value={String(active.config.tools.dialKeypad)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, dialKeypad: e.target.value === 'true' } } }))}
                  className="inp"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
            </div>
          </Panel>

          {/* Web test + transcript */}
          <Panel title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4" />}>
            <div className="rounded-xl p-3 border panel">
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full tag">{t.role === 'assistant' ? 'AI' : 'You'}</div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          {/* Logs */}
          <Panel title="Call Logs" icon={<ListTree className="w-4 h-4" />}>
            <div className="space-y-3">
              {callsForAssistant.length === 0 && <div className="text-sm opacity-60">No calls yet.</div>}
              {callsForAssistant.map(log => (
                <details key={log.id} className="rounded-xl border panel">
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4" />
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                      {log.endedAt ? <span className="opacity-70">• {(Math.max(1, Math.round((log.endedAt - log.startedAt) / 1000)))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full tag">{t.role === 'assistant' ? 'AI' : 'User'}</div>
                        <div className="text-sm">{t.text}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ background: 'rgba(0,0,0,.5)' }}>
            <motion.div
              initial={{ y: 10, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0, scale: .985 }}
              className="w-full max-w-2xl rounded-2xl border"
              style={{ background: 'var(--panel)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-lg)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" /> Generate / Edit Prompt</div>
                <button onClick={() => setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4">
                <input
                  value={genText}
                  onChange={(e) => setGenText(e.target.value)}
                  placeholder={`Tell me changes, e.g.:
• tighten Style, be concise
• [Identity] AI Sales Agent for roofers
• first message: Hey—quick question to get you booked…`}
                  className="inp"
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => setGenOpen(false)} className="btn btn--ghost">Cancel</button>
                  <button onClick={generatePrompt} disabled={isGenerating} className="btn btn--green">
                    {isGenerating ? 'Generating…' : 'Generate'}
                  </button>
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
   SMALL UI
============================================================================= */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${SCOPE} min-h-screen`} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {children}
      <StyleBlock />
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}
function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12">
      <div className="rounded-xl border" style={{ background: 'var(--panel)', borderColor: 'var(--border)', boxShadow: 'var(--shadow-soft)' }}>
        <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4">
          <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>
        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}>
              <div className="px-5 pb-5">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* =============================================================================
   STYLES (dark, from your Improve panel). Green buttons unchanged.
============================================================================= */
function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  --bg:#0b0c10;
  --text:#eef2f5;
  --muted:color-mix(in oklab, var(--text) 65%, transparent);
  --panel:#0f1315;
  --card:#0f1315;
  --border:rgba(255,255,255,.10);
  --shadow-soft:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.4);
  --shadow-lg:0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
  --va-rail-w:360px;
}
/* keep your green buttons */
.${SCOPE} .btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1; border:1px solid var(--border); }
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--card); color:var(--text); box-shadow:0 12px 26px rgba(0,0,0,.35); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; border-color:rgba(220,38,38,.35); box-shadow:0 10px 24px rgba(220,38,38,.15); }

/* inputs / selects */
.${SCOPE} .inp{ width:100%; border-radius:12px; padding:.65rem .8rem; background:var(--card); color:var(--text); border:1px solid var(--border); outline:none; }
.${SCOPE} .range{ width:100%; }

/* textareas with mono font */
.${SCOPE} .mono{
  width:100%;
  border-radius:12px;
  padding:.75rem .9rem;
  background:var(--card);
  color:var(--text);
  border:1px solid var(--border);
  outline:none;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

/* diff preview */
.${SCOPE} .diffbox{
  min-height:520px; max-height:680px; overflow-y:auto; white-space:pre-wrap; border:1px solid var(--border);
  border-radius:12px; padding:.75rem .9rem; background:var(--card); color:var(--text);
}
.${SCOPE} .diffbox ins.add{ background:rgba(16,185,129,.18); text-decoration:none; padding:1px 2px; border-radius:4px; }
.${SCOPE} .diffbox del.del{ background:rgba(239,68,68,.18); text-decoration:line-through; padding:1px 2px; border-radius:4px; }
.${SCOPE} .diffbox .caret{ animation:pulse 1s infinite; }
@keyframes pulse{ 0%{opacity:1} 50%{opacity:.25} 100%{opacity:1} }

/* tags */
.${SCOPE} .tag{ background:rgba(255,255,255,.06); border:1px solid var(--border); }

/* main width override */
.${SCOPE} .va-main{ max-width:none !important; }
`}</style>
  );
}
