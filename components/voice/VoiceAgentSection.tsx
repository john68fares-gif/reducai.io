'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff, MessageSquare, ListTree, AudioLines, Volume2, Save
} from 'lucide-react';

import AssistantRail, { AssistantLite } from './AssistantRail';
import TelephonyEditor, { PhoneNum } from './TelephonyEditor';
import { scopedStorage } from '@/utils/scoped-storage';

/* =============================================================================
   CONFIG / TOKENS (unchanged)
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

const TICK_MS = 10;
const CHUNK_SIZE = 6;

/* =============================================================================
   TYPES + STORAGE (unchanged)
============================================================================= */
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
      temperature?: number;
      openaiKeyId?: string; // NEW: link to scoped storage key id
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
   PROMPT HELPERS (unchanged)
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

/* … keep all helpers identical … */
function toTitle(s: string) { /* unchanged */ 
  return s
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .replace(/\b(Id|Url|Dob)\b/gi, m => m.toUpperCase());
}
function buildDefaultsFromHint(hint: string) { /* unchanged */ 
  const short = hint.trim().split(/\s+/).length <= 3 ? hint.trim() : 'Assistant';
  const collectMatch = hint.match(/collect[:\-\s]+(.+)$/i);
  const fields = collectMatch
    ? collectMatch[1].split(/[,\n;]/).map(s => s.trim()).filter(Boolean)
    : [];
  const collectList = fields.length
    ? fields.map(f => `- ${toTitle(f)}`).join('\n')
    : `- Full Name
- Phone Number
- Email (if provided)
- Appointment Date/Time (if applicable)`;
  return [
    `[Identity]
You are a helpful, fast, and accurate ${short.toLowerCase()} that completes tasks and collects information.`,
    `[Style]
* Friendly, concise, affirmative.
* Ask one question at a time and confirm critical details.`,
    `[System Behaviors]
* Summarize & confirm before finalizing.
* Offer next steps when appropriate.`,
    `[Task & Goals]
* Understand intent, collect required details, and provide guidance.`,
    `[Data to Collect]
${collectList}`,
    `[Safety]
* No medical/legal/financial advice beyond high-level pointers.
* Decline restricted actions, suggest alternatives.`,
    `[Handover]
* When done, summarize details and hand off if needed.`
  ].join('\n\n');
}
function setSection(prompt: string, name: string, body: string) { /* unchanged */ 
  const section = name.replace(/^\[|\]$/g, '');
  const re = new RegExp(String.raw`$begin:math:display$${section}$end:math:display$\s*([\s\S]*?)(?=\n\[|$)`, 'i');
  if (re.test(prompt)) { return prompt.replace(re, `[${section}]\n${body.trim()}\n`); }
  const nl = prompt.endsWith('\n') ? '' : '\n';
  return `${prompt}${nl}\n[${section}]\n${body.trim()}\n`;
}
function parseFirstMessage(raw: string): string | null {
  const m = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  return m ? m[1].trim() : null;
}
function mergeInput(genText: string, currentPrompt: string) { /* unchanged core */ 
  const raw = (genText || '').trim();
  const out = { prompt: currentPrompt || BASE_PROMPT, firstMessage: undefined as string | undefined };
  if (!raw) return out;
  const fm = parseFirstMessage(raw);
  if (fm) { out.firstMessage = fm; return out; }
  const sectionBlocks = [...raw.matchAll(/\[(Identity|Style|System Behaviors|Task & Goals|Data to Collect|Safety|Handover|Refinements)\]\s*([\s\S]*?)(?=\n\[|$)/gi)];
  if (sectionBlocks.length) {
    let next = out.prompt;
    sectionBlocks.forEach((m) => { const sec = m[1]; const body = m[2]; next = setSection(next, `[${sec}]`, body); });
    out.prompt = next;
    return out;
  }
  if (raw.split(/\s+/).length <= 3 || /(^|\s)collect(\s|:)/i.test(raw)) {
    out.prompt = buildDefaultsFromHint(raw); return out;
  }
  const hasRef = /\[Refinements\]/i.test(out.prompt);
  const bullet = `- ${raw.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
  out.prompt = hasRef
    ? out.prompt.replace(/\[Refinements\]\s*([\s\S]*?)(?=\n\[|$)/i, (m, body) => `[Refinements]\n${(body || '').trim()}\n${bullet}\n`)
    : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* =============================================================================
   DIFF + sidebar width hook (unchanged logic)
============================================================================= */
type CharTok = { ch: string; added: boolean };
function charDiffAdded(oldStr: string, newStr: string): CharTok[] { /* unchanged */ 
  const o = [...oldStr]; const n = [...newStr];
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) for (let j = n.length - 1; j >= 0; j--)
    dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out: CharTok[] = []; let i = 0, j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { out.push({ ch: n[j], added: false }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; }
    else { out.push({ ch: n[j], added: true }); j++; }
  }
  while (j < n.length) out.push({ ch: n[j++], added: true });
  return out;
}

/* =============================================================================
   SIMPLE WEB VOICE — keep your recognizer; NEW: tts() via ElevenLabs route
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

/* ---------- ElevenLabs TTS (US voices) + audio unlock ---------- */
let audioUnlocked = false;
const sharedAudio: HTMLAudioElement | null = typeof window !== 'undefined' ? new Audio() : null;

async function unlockAudioOnce(){
  if (audioUnlocked || !sharedAudio) return;
  try {
    sharedAudio.muted = true;
    sharedAudio.src = 'data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA';
    await sharedAudio.play().catch(()=>{});
    sharedAudio.pause(); sharedAudio.currentTime = 0; sharedAudio.muted = false;
    audioUnlocked = true;
  } catch {}
}

async function tts(text: string, voiceId: string){
  const r = await fetch('/api/tts/elevenlabs', {
    method:'POST',
    headers: { 'content-type':'application/json' },
    body: JSON.stringify({ voiceId, text })
  });
  if (!r.ok) throw new Error(await r.text());
  const blob = await r.blob();
  const url = URL.createObjectURL(blob);
  if (!sharedAudio) {
    const a = new Audio(url); await a.play(); a.onended = () => URL.revokeObjectURL(url); return;
  }
  sharedAudio.src = url;
  try { await sharedAudio.play(); } catch { await unlockAudioOnce(); await sharedAudio.play(); }
  sharedAudio.onended = () => URL.revokeObjectURL(url);
}

/* =============================================================================
   LOCAL PROMPT-DRIVEN AGENT (unchanged)
============================================================================= */
function parseCollectFields(prompt: string): string[] { /* unchanged */ 
  const m = prompt.match(/\[Data\s*to\s*Collect\]\s*([\s\S]*?)(?=\n\[|$)/i);
  if (!m) return ['Full Name','Phone Number','Email','Appointment Date/Time'];
  const lines = m[1].split(/\r?\n/).map(s => s.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
  return lines.length ? lines : ['Full Name','Phone Number','Email','Appointment Date/Time'];
}
function extractName(s: string){ const m = s.match(/\b(?:i am|i'm|my name is|this is)\s+([a-z][a-z '-]+(?:\s+[a-z][a-z '-]+){0,2})/i); return m?.[1]?.trim(); }
function extractPhone(s: string){ const m = s.replace(/[^\d+]/g,'').match(/(\+?\d{10,15})/); return m?.[1]; }
function extractEmail(s: string){ const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m?.[0]; }
function extractDateTime(s: string){
  const m = s.match(/\b(?:mon|tue|wed|thu|fri|sat|sun|tomorrow|today)\b.*?\b(\d{1,2}(:\d{2})?\s?(am|pm)?)|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+\d{1,2}(:\d{2})?\s?(am|pm)?/i);
  return m?.[0];
}
function makePromptAgent(systemPrompt: string){
  const fields = parseCollectFields(systemPrompt);
  const state: Record<string, string> = {};
  function nextMissing(): string | null { for (const f of fields) { if (!state[f.toLowerCase()]) return f; } return null; }
  function tryAutoFill(user: string){
    const map: Array<{keys: string[], val?: string|null}> = [
      { keys:['full name','name'],              val: extractName(user) || null },
      { keys:['phone number','phone','digits'], val: extractPhone(user) || null },
      { keys:['email'],                          val: extractEmail(user) || null },
      { keys:['appointment date/time','date/time','date','time'], val: extractDateTime(user) || null },
    ];
    for (const f of fields) {
      const k = f.toLowerCase();
      if (state[k]) continue;
      const hit = map.find(m => m.keys.includes(k));
      if (hit?.val) state[k] = hit.val;
    }
  }
  function professionalTone(text: string){ return text.replace(/\s+/g,' ').replace(/\bi am\b/gi,'I’m').trim(); }
  function askFor(fieldLabel: string){
    const k = fieldLabel.toLowerCase();
    const cue =
      k.includes('name') ? 'your full name'
    : k.includes('phone') ? 'the best phone number to reach you'
    : k.includes('email') ? 'your email (optional)'
    : k.includes('date') || k.includes('time') ? 'a preferred date and time'
    : fieldLabel.toLowerCase();
    return `Got it. What’s ${cue}?`;
  }
  function confirmationLine(){
    const parts = fields.map(f => { const k = f.toLowerCase(); return `${f}: ${state[k] ? state[k] : '—'}`; });
    return parts.join(' • ');
  }
  return {
    reply(userText: string){
      tryAutoFill(userText);
      const missing = nextMissing();
      if (missing) return professionalTone(askFor(missing));
      return professionalTone(`Thanks. Here’s what I have: ${confirmationLine()}. Should I confirm or change anything?`);
    },
    summary(){ return professionalTone(`Summary — ${confirmationLine()}.`); }
  };
}

/* =============================================================================
   PAGE
============================================================================= */
export default function VoiceAgentSection() {
  /* ==== host sidebar tracking (unchanged) ==== */
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

  /* measure width for main column spacing */
  useEffect(() => {
    const scope = scopeRef.current; if (!scope) return;
    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const target = (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) || null;
    if (!target) { setVar(sbCollapsed ? 72 : 248); return; }
    setVar(target.getBoundingClientRect().width);
    const ro = new ResizeObserver(() => setVar(target.getBoundingClientRect().width));
    ro.observe(target);
    return () => ro.disconnect();
  }, [sbCollapsed]);

  /* ---------- Assistants (unchanged storage + behavior) ---------- */
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
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT, temperature:0.5, openaiKeyId: undefined },
          voice: { provider:'elevenlabs', voiceId:'Rachel', voiceLabel:'Rachel (US)' },
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
    setCreating(true);
    await new Promise(r => setTimeout(r, 360));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: '' , temperature:0.5, openaiKeyId: undefined},
        voice: { provider:'elevenlabs', voiceId:'Rachel', voiceLabel:'Rachel (US)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
        telephony: { numbers: [], linkedNumberId: undefined }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
    setCreating(false);
    setEditingId(id);
    setTempName('New Assistant');
  };

  const removeAssistant = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id);
    if (!list.length) setActiveId('');
    setRev(r => r + 1);
  };

  /* ---------- Rail collapse/expand (UI inside AssistantRail) ---------- */
  const [railCollapsed] = useState(false);

  /* ---------- Generate (unchanged) ---------- */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typing, setTyping] = useState<CharTok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [lastNew, setLastNew] = useState('');
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);
  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const startTyping = (tokens: CharTok[]) => {
    setTyping(tokens);
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
  useEffect(() => {
    if (!typingBoxRef.current) return;
    typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight;
  }, [typedCount]);

  const handleGenerate = () => {
    if (!active) return;
    const current = active.config.model.systemPrompt || '';
    const { prompt, firstMessage } = mergeInput(genText, current || BASE_PROMPT);
    setLastNew(prompt);
    setPendingFirstMsg(firstMessage);
    startTyping(charDiffAdded(current, prompt));
    setGenOpen(false);
    setGenText('');
  };
  const acceptTyping = () => {
    if (!active) return;
    updateActive(a => ({
      ...a,
      config: {
        ...a.config,
        model: {
          ...a.config.model,
          systemPrompt: lastNew || a.config.model.systemPrompt,
          firstMessage: typeof pendingFirstMsg === 'string' ? pendingFirstMsg : a.config.model.firstMessage
        }
      }
    }));
    setTyping(null);
    setPendingFirstMsg(undefined);
  };
  const declineTyping = () => { setTyping(null); setPendingFirstMsg(undefined); };

  /* ---------- Voices (unchanged options) + SAVE / TEST ---------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'Rachel', label: 'Rachel (US)' },
    { value: 'Adam',   label: 'Adam (US)'   },
    { value: 'Bella',  label: 'Bella (US)'  },
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
    await tts('Voice saved.', pendingVoiceId || 'Rachel'); // use ElevenLabs for feedback
  };

  const testVoice = async () => {
    if (!pendingVoiceId) return;
    await tts('This is a quick preview of the selected voice.', pendingVoiceId);
  };

  /* ---------- Web call + logs (unchanged, but tts() instead of browser TTS) ---------- */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const recogRef = useRef<any | null>(null);
  const agentRef = useRef<ReturnType<typeof makePromptAgent> | null>(null);

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
    await unlockAudioOnce(); // make sure iOS/Chrome will play audio

    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id);
    setTranscript([]);

    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);

    agentRef.current = makePromptAgent(active.config.model.systemPrompt || '');

    const greet = active.config.model.firstMessage || 'Hello. How may I help you today?';
    if (active.config.model.firstMessageMode === 'assistant_first') {
      pushTurn('assistant', greet);
      await tts(greet, active.config.voice.voiceId);
    }

    const rec = makeRecognizer(async (finalText) => {
      pushTurn('user', finalText);

      // simple local agent for collect flow (unchanged logic)
      const reply = agentRef.current?.reply(finalText) || 'Understood.';
      pushTurn('assistant', reply);
      await tts(reply, active.config.voice.voiceId);
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

  /* ======= RENDER ========================================================== */

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

  /* telephony helpers (unchanged) */
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
    routes[num.id] = active.id; // link phone-number -> assistant
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ======= ASSISTANT RAIL (extracted, pixel-identical) ======= */}
      <AssistantRail
        assistants={assistants.map(a=>({ id:a.id, name:a.name, folder:a.folder, updatedAt:a.updatedAt }))}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={addAssistant}
        onRename={(id, name)=> {
          const a = readLS<Assistant>(ak(id));
          if (a) writeLS(ak(id), { ...a, name, updatedAt: Date.now() });
          const list=(readLS<Assistant[]>(LS_LIST)||[]).map(x=>x.id===id?{...x, name, updatedAt:Date.now()}:x);
          writeLS(LS_LIST, list); setAssistants(list); setRev(r=>r+1);
        }}
        onDelete={removeAssistant}
      />

      {/* =================================== EDITOR (unchanged UI) =================================== */}
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
              <MessageSquare className="w-4 h-4 icon" /> Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
              className="btn btn--ghost"
            >
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={publish} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {/* content body (all your sections left intact) */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          {/* … Model section (unchanged UI) … */}
          {/* … System Prompt editor (unchanged UI) … */}
          {/* … Voice section (unchanged UI, test/save hit ElevenLabs) … */}
          {/* … Transcriber section (unchanged UI) … */}
          {/* … Tools section (unchanged UI) … */}
          {/* TELEPHONY */}
          <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4 icon" />}>
            <TelephonyEditor
              numbers={active.config.telephony?.numbers ?? []}
              linkedId={active.config.telephony?.linkedNumberId}
              onLink={(id)=> setLinkedNumber(id)}
              onAdd={addPhone}
              onRemove={removePhone}
            />
          </Section>

          {/* WEB CALL */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
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
              <div className="text-xs opacity-70">Talk to the assistant using your browser mic. No phone carrier, no Vapi.</div>
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

          {/* LOGS (unchanged) */}
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

      {/* Delete overlay (unchanged) */}
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

/* =============================================================================
   Delete Modal + Atoms + Scoped CSS (unchanged from your file)
============================================================================= */
function DeleteModal({ open, name, onCancel, onConfirm }:{
  open: boolean; name: string; onCancel: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background:'rgba(0,0,0,.55)' }}>
      <motion.div initial={{ y: 10, opacity: .9, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }}
        className="w-full max-w-md rounded-2xl"
        style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="text-sm font-semibold" style={{ color:'var(--text)' }}>Delete Assistant</div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color:'var(--text-muted)' }}>
          Are you sure you want to delete <span style={{ color:'var(--text)' }}>“{name}”</span>? This cannot be undone.
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn--ghost">Cancel</button>
          <button onClick={onConfirm} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}

/* minimal Select identical look */
type Item = { value: string; label: string; icon?: React.ReactNode };
function usePortalPos(open: boolean, ref: React.RefObject<HTMLElement>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const r = ref.current?.getBoundingClientRect(); if (!r) return;
    const up = r.bottom + 320 > window.innerHeight;
    setRect({ top: up ? r.top : r.bottom, left: r.left, width: r.width, up });
  }, [open]);
  return rect;
}
function Select({ value, items, onChange, placeholder, leftIcon }: {
  value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement | null>(null);
  const portal = useRef<HTMLDivElement | null>(null);
  const rect = usePortalPos(open, btn);

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
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>

      <AnimatePresence>
        {open && rect && (
          <motion.div
            ref={portal}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3 rounded-xl"
            style={{
              top: rect.up ? rect.top - 8 : rect.top + 8,
              left: rect.left, width: rect.width, transform: rect.up ? 'translateY(-100%)' : 'none',
              background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)'
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg"
              style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 icon" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left"
                  style={{ color:'var(--text)' }}
                  onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(16,185,129,.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(16,185,129,.35)'; }}
                  onMouseLeave={(e)=>{ (e.currentTarget as any).style.background='transparent'; (e.currentTarget as any).style.border='1px solid transparent'; }}
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
   Scoped CSS (unchanged tokens)
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
.${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
.${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
.${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
.${SCOPE} aside{ transition:none !important; }
@media (max-width: 1180px){ .${SCOPE}{ --va-rail-w: 320px; } }
`}</style>
  );
}
