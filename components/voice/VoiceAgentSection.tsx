// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff, MessageSquare, ListTree, AudioLines,
  Shield
} from 'lucide-react';

/* =============================================================================
   CONFIG / TOKENS
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

type TranscriptTurn = { role: 'assistant'|'user'|'system'; text: string; ts: number };
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
      systemPrompt: string; // the prompt you edit in the UI (single source of truth)
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

type Settings = {
  openaiKey: string;
  xiKey: string; // ElevenLabs
};

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;

const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const LS_SETTINGS = 'voice:settings.v1';

const readLS = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; }
  catch { return null; }
};
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   SMALL HELPERS
============================================================================= */
const DEFAULT_SCAFFOLD = '';

type CharTok = { ch: string; added: boolean };
function charDiffAdded(oldStr: string, newStr: string): CharTok[] {
  const o = [...oldStr]; const n = [...newStr];
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) for (let j = n.length - 1; j >= 0; j--) {
    dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const out: CharTok[] = []; let i = 0, j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { out.push({ ch: n[j], added: false }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; }
    else { out.push({ ch: n[j], added: true }); j++; }
  }
  while (j < n.length) out.push({ ch: n[j++], added: true });
  return out;
}

function extractGreetingFromPrompt(prompt: string): string | undefined {
  const m =
    prompt.match(/^\s*1\.\s*Greet.*?["“](.*?)["”]/im) ||
    prompt.match(/\[Greeting\]\s*([\s\S]*?)(?=\n\[|$)/i);
  return m ? (m[1] || m[0]).toString().trim() : undefined;
}

const yesNo = (s:string)=>/(^|\b)(yes|yeah|yup|sure|ok|okay|correct)\b/i.test(s)?'yes':/(^|\b)(no|nope|nah)\b/i.test(s)?'no':undefined;

function basicSlotExtract(text: string) {
  const name = text.match(/\b(?:I am|I'm|my name is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)?.[1];
  const phone = text.match(/(\+?\d[\d\s\-().]{7,}\d)/)?.[1];
  const service = text.match(/\b(?:book|schedule|need|for)\s+(?:a |an )?([a-z ]+?)(?: appointment| visit| checkup| consult)?\b/i)?.[1]?.trim();
  const provider = text.match(/\b(?:with|for)\s+Dr\.?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/i)?.[1];
  const date = text.match(/\b(?:on|for)\s+((?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\w*\s+\d{1,2}|\d{4}-\d{2}-\d{2}|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\w*\s+\d{1,2})/i)?.[1];
  const time = text.match(/\bat\s+(\d{1,2}(:\d{2})?\s?(?:am|pm)?)\b/i)?.[1];
  const patientStatus = /new patient/i.test(text) ? 'new' : (/returning|follow-?up/i.test(text) ? 'returning' : undefined);
  return { name, phone, service, provider, date, time, patientStatus };
}

function policyGuard(text: string) {
  if (/^\s*(understood|noted|okay|ok)[.!]?\s*(is there anything|anything else)?.*$/i.test(text)) {
    return 'I can help you book, reschedule, or cancel an appointment. What would you like to do?';
  }
  return text;
}

/* =============================================================================
   LAYOUT UTILS
============================================================================= */
function useAppSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>, fallbackCollapsed: boolean) {
  useEffect(() => {
    const scope = scopeRef.current; if (!scope) return;
    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;
    let target = findSidebar();
    if (!target) { setVar(fallbackCollapsed ? 72 : 248); return; }
    setVar(target.getBoundingClientRect().width);
    const ro = new ResizeObserver(() => setVar(target!.getBoundingClientRect().width));
    ro.observe(target);
    const mo = new MutationObserver(() => setVar(target!.getBoundingClientRect().width));
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
    const onTransitionEnd = () => setVar(target!.getBoundingClientRect().width);
    target.addEventListener('transitionend', onTransitionEnd);
    return () => { ro.disconnect(); mo.disconnect(); target.removeEventListener('transitionend', onTransitionEnd); };
  }, [scopeRef, fallbackCollapsed]);
}

/* =============================================================================
   COMPONENT
============================================================================= */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [sbCollapsed, setSbCollapsed] = useState(false);
  useEffect(() => {
    const mo = new MutationObserver(() => {
      setSbCollapsed(document.body.getAttribute('data-sb-collapsed') === 'true');
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-sb-collapsed', 'class'] });
    return () => mo.disconnect();
  }, []);
  useAppSidebarWidth(scopeRef, sbCollapsed);

  /* ---------- Settings (BYO keys) ---------- */
  const [settings, setSettings] = useState<Settings>(() => readLS<Settings>(LS_SETTINGS) || { openaiKey: '', xiKey: '' });
  const saveSettings = (s: Settings) => { setSettings(s); writeLS(LS_SETTINGS, s); };

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
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'', systemPrompt: '' },
          voice: { provider:'elevenlabs', voiceId:'wBXNqKUATyqu0RtYt25i', voiceLabel:'Custom 1 (11L)' },
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
    await new Promise(r => setTimeout(r, 200));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'', systemPrompt: '' },
        voice: { provider:'elevenlabs', voiceId:'4RZ84U1b4WCqpu57LvIq', voiceLabel:'Custom 2 (11L)' },
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

  /* ---------- Voices ---------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'wBXNqKUATyqu0RtYt25i', label: 'Custom 1 (11L)' },
    { value: '4RZ84U1b4WCqpu57LvIq', label: 'Custom 2 (11L)' },
    // common catalog fallbacks:
    { value: 'Rachel', label: 'Rachel (11L default)' },
    { value: 'Aria',   label: 'Aria (11L default)' },
  ];

  /* ---------- ElevenLabs speaker hook (uses user key via header) ---------- */
  useEffect(() => {
    (window as any).elevenlabsSpeak = async (text: string, voiceId: string) => {
      try {
        if (!settings.xiKey) throw new Error('No ElevenLabs key set. Open Settings.');
        const r = await fetch('/api/tts', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-elevenlabs-key': settings.xiKey,
          },
          body: JSON.stringify({ text, voiceId }),
        });
        if (!r.ok) throw new Error(await r.text());
        const blob = await r.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        await audio.play().catch(() => {});
        audio.onended = () => URL.revokeObjectURL(url);
      } catch (err) {
        console.error('TTS error', err);
        // fallback handled by speakText()
      }
    };
  }, [settings.xiKey]);

  /* ---------- Helpers for speech + LLM ---------- */
  function speakText(text: string, voiceProvider: VoiceProvider, voiceId: string, voiceLabel: string) {
    const custom = (window as any).elevenlabsSpeak;
    if (voiceProvider === 'elevenlabs' && typeof custom === 'function') {
      try { custom(text, voiceId); return; } catch {}
    }
    const synth = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const match = voices.find(v => v.name.toLowerCase().includes((voiceLabel||'').toLowerCase()));
    if (match) u.voice = match;
    synth.cancel(); synth.speak(u);
  }

  async function callLLM(system: string, turns: TranscriptTurn[], userTurn: string) {
    const messages = [
      { role:'system', content: system },
      ...turns.filter(t => t.role !== 'system').map(t => ({ role: t.role, content: t.text })),
      { role:'user', content: userTurn }
    ];
    try {
      if (!settings.openaiKey) throw new Error('No OpenAI key set. Open Settings.');
      const r = await fetch('/api/llm', {
        method:'POST',
        headers:{
          'content-type':'application/json',
          'x-openai-key': settings.openaiKey,
        },
        body: JSON.stringify({ system, messages, temperature: 0.2 }),
      });
      if (r.ok) { const j = await r.json(); if (j?.reply) return String(j.reply); }
    } catch {}
    return null;
  }

  /* ---------- Web call + logs ---------- */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);

  function getRecognizer(onFinalText: (text:string)=>void) {
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
  const recogRef = useRef<any | null>(null);

  function pushTurn(role: TranscriptTurn['role'], text: string) {
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

    if (!settings.openaiKey) { alert('Add your OpenAI API key in Settings.'); return; }
    if (active.config.voice.provider === 'elevenlabs' && !settings.xiKey) {
      alert('Add your ElevenLabs API key in Settings or switch voice provider.');
      return;
    }

    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id); setTranscript([]);

    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);

    const system = (active.config.model.systemPrompt || DEFAULT_SCAFFOLD).trim();
    const greet =
      (active.config.model.firstMessage || '').trim() ||
      extractGreetingFromPrompt(system) ||
      'Hello, how can I help you today?';

    if (active.config.model.firstMessageMode === 'assistant_first') {
      pushTurn('assistant', greet);
      speakText(greet, active.config.voice.provider, active.config.voice.voiceId, active.config.voice.voiceLabel);
    }
    pushTurn('system', system);

    const rec = getRecognizer(async (finalText) => {
      pushTurn('user', finalText);

      let reply = await callLLM(system, transcript, finalText);
      if (!reply) {
        // minimal slot filling fallback
        const all = transcript.map(t => `${t.role}: ${t.text}`).join('\n') + `\nuser: ${finalText}`;
        const got = basicSlotExtract(all);
        const have = {
          service: !!got.service,
          status: !!got.patientStatus,
          name:   !!got.name,
          phone:  !!got.phone,
          date:   !!got.date,
          time:   !!got.time,
        };
        if (!have.service) reply = 'What type of appointment do you need? For example, “primary care”, “dermatology”, or “physical therapy.”';
        else if (!have.status) reply = 'Are you a new or returning patient?';
        else if (!have.name) reply = 'What is your full name (first and last)?';
        else if (!have.phone) reply = 'What is the best phone number to reach you?';
        else if (!have.date) reply = 'What day works for you? You can say “Wednesday the 12th” or give a date.';
        else if (!have.time) reply = 'What time works best for you? For example, 10am or 3:30pm.';
        else {
          const sum = `To confirm: ${got.name}, ${got.patientStatus} patient, service ${got.service}${got.provider ? ` with ${got.provider}`:''}, ${got.date} at ${got.time}. Phone ${got.phone}. Is that correct?`;
          const lastAi = [...transcript].reverse().find(t=>t.role==='assistant')?.text || '';
          if (/Is that correct\??$/i.test(lastAi)) {
            const yn = yesNo(finalText);
            reply = yn==='yes'
              ? 'All set—your appointment is confirmed. Anything else I can help you with?'
              : yn==='no' ? 'No problem. Which detail should we update—service, date, time, name, or phone?' : sum;
          } else reply = sum;
        }
      }

      reply = policyGuard(reply || '');
      pushTurn('assistant', reply);
      speakText(reply, active.config.voice.provider, active.config.voice.voiceId, active.config.voice.voiceLabel);
    });

    if (!rec) {
      const msg = 'Browser speech recognition is not available. Try Chrome/Edge, or wire in your server transcriber.';
      pushTurn('assistant', msg);
      speakText(msg, active.config.voice.provider, active.config.voice.voiceId, active.config.voice.voiceLabel);
      return;
    }
    recogRef.current = rec; try { rec.start(); } catch {}
  }

  function endCall(reason: string) {
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    window.speechSynthesis?.cancel?.();
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls);
    setCurrentCallId(null);
  }

  const callsForAssistant = (readLS<CallLog[]>(LS_CALLS) || []).filter(c => c.assistantId === active?.id);

  /* ---------- Telephony helpers ---------- */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
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
    const linkedId = active?.config.telephony?.linkedNumberId;
    const numbers = active?.config.telephony?.numbers ?? [];
    const num = numbers.find(n=>n.id===linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[num.id] = active!.id; // link phone-number -> assistant
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active!.name}.`);
  };

  /* ---------- Early returns ---------- */
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

  /* =================================== RENDER =================================== */
  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ================= ASSISTANTS RAIL ================= */}
      <aside className="hidden lg:flex flex-col" style={{
        position:'fixed',
        left:'calc(var(--app-sidebar-w, 248px) - 1px)',
        top:'var(--app-header-h, 64px)',
        width: 'var(--va-rail-w, 360px)',
        height:'calc(100vh - var(--app-header-h, 64px))',
        borderRight:'1px solid var(--va-border)',
        background:'var(--va-sidebar)',
        boxShadow:'var(--va-shadow-side)',
        zIndex: 10,
      }}>
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" />
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
            <Search className="w-4 h-4 icon" />
            <input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search assistants"
                   className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }} />
          </div>

          <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5 icon" /> Folders
          </div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
            <FolderOpen className="w-4 h-4 icon" /> All
          </button>

          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isEdit = editingId === a.id;
              return (
                <div key={a.id} className="w-full rounded-xl p-3" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-sm)' }}>
                  <button className="w-full text-left flex items-center justify-between" onClick={()=> setActiveId(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4 icon" />
                        {!isEdit ? (
                          <span className="truncate">{a.name}</span>
                        ) : (
                          <input autoFocus value={tempName} onChange={(e)=> setTempName(e.target.value)}
                                 onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }}
                                 className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
                                 style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }} />
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                    </div>
                    <Check className="w-4 h-4 icon" />
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); beginRename(a); }} className="btn btn--ghost text-xs"><Edit3 className="w-3.5 h-3.5 icon" /> Rename</button>
                        <button onClick={(e)=> { e.stopPropagation(); setDeleting({ id:a.id, name:a.name }); }} className="btn btn--danger text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn btn--green text-xs"><Check className="w-3.5 h-3.5 text-white" /><span className="text-white">Save</span></button>
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

      {/* =================================== MAIN =================================== */}
      <div className="va-main" style={{
        marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
        paddingRight:'clamp(20px, 4vw, 40px)',
        paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
        paddingBottom:'88px'
      }}>
        {/* top action bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky" style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
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
            <SettingsButton settings={settings} onSave={saveSettings} />
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})} className="btn btn--ghost"><Copy className="w-4 h-4 icon" /> Copy Prompt</button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
            <button onClick={publish} className="btn btn--green"><Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span></button>
          </div>
        </div>

        {/* content body */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select value={active.config.model.provider} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as Provider } } }))} items={[{ value:'openai', label:'OpenAI' }]} />
              </Field>
              <Field label="Model">
                <Select value={active.config.model.model} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, model: v as ModelId } } }))} items={[
                  { value:'gpt-4o', label:'GPT-4o' },
                  { value:'gpt-4o-mini', label:'GPT-4o mini' },
                  { value:'gpt-4.1', label:'GPT-4.1' },
                  { value:'gpt-3.5-turbo', label:'GPT-3.5 Turbo' },
                ]} />
              </Field>
              <Field label="First Message Mode">
                <Select value={active.config.model.firstMessageMode} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessageMode: v as any } } }))} items={[
                  { value:'assistant_first', label:'Assistant speaks first' },
                  { value:'user_first', label:'User speaks first' },
                ]} />
              </Field>
              <Field label="First Message">
                <input value={active.config.model.firstMessage} onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } }))} className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
              </Field>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: '' } } }))} className="btn btn--ghost"><RefreshCw className="w-4 h-4 icon" /> Clear</button>
                </div>
              </div>
              <textarea rows={26} value={active.config.model.systemPrompt || ''} onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))} className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none" style={{
                background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                minHeight: 560
              }} placeholder={`Paste your full prompt here (e.g., your Riley spec). This exact text becomes the system message.`} />
            </div>
          </Section>

          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select value={active.config.voice.provider} onChange={(v)=>{
                  const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
                  updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
                }} items={[
                  { value:'openai', label:'OpenAI (browser TTS)' },
                  { value:'elevenlabs', label:'ElevenLabs (best human sound)' },
                ]} />
              </Field>
              <Field label="Voice">
                <Select value={active.config.voice.voiceId} onChange={(v)=>{
                  const list = active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices;
                  const found = list.find(x=>x.value===v);
                  updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId:v, voiceLabel: found?.label || v } } }));
                }} items={active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices} />
              </Field>
            </div>

            <div className="mt-3">
              <button onClick={()=> { alert('Voices come from your ElevenLabs account. Make sure your API Key is set in Settings.'); }} className="btn btn--ghost"><UploadCloud className="w-4 h-4 icon" /> Manage ElevenLabs Voices</button>
            </div>
          </Section>

          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(360px, 1fr))' }}>
              <Field label="Provider"><Select value={active.config.transcriber.provider} onChange={()=>{}} items={[{ value:'deepgram', label:'Deepgram (server)' }]} /></Field>
              <Field label="Model"><Select value={active.config.transcriber.model} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, model: v as any } } }))} items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]} /></Field>
              <Field label="Language"><Select value={active.config.transcriber.language} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, language: v as any } } }))} items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]} /></Field>
            </div>
          </Section>

          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Enable End Call Function"><Select value={String(active.config.tools.enableEndCall)} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, tools:{ ...a.config.tools, enableEndCall: v==='true' } } }))} items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]} /></Field>
              <Field label="Dial Keypad"><Select value={String(active.config.tools.dialKeypad)} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, tools:{ ...a.config.tools, dialKeypad: v==='true' } } }))} items={[{ value:'true', label:'Enabled' }, { value:'false', label:'Disabled' }]} /></Field>
            </div>
          </Section>

          <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4 icon" />}>
            <TelephonyEditor numbers={active.config.telephony?.numbers ?? []} linkedId={active.config.telephony?.linkedNumberId} onLink={(id)=> setLinkedNumber(id)} onAdd={addPhone} onRemove={removePhone} />
          </Section>

          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
            <div className="flex items-center gap-2 mb-3">
              {!currentCallId ? (
                <button onClick={startCall} className="btn btn--green"><PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span></button>
              ) : (
                <button onClick={()=> endCall('Ended by user')} className="btn btn--danger"><PhoneOff className="w-4 h-4" /> End Call</button>
              )}
              <div className="text-xs opacity-70">Uses YOUR prompt (system message) + YOUR ElevenLabs key if selected.</div>
            </div>
            <div className="rounded-2xl p-3" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : t.role==='system' ? 'rgba(59,130,246,.18)' : 'rgba(255,255,255,.06)',
                      border: '1px solid var(--va-border)'
                    }}>{t.role==='assistant' ? 'AI' : t.role==='system' ? 'SYSTEM' : 'You'}</div>
                    <div className="text-sm whitespace-pre-wrap">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

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
                          background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : t.role==='system' ? 'rgba(59,130,246,.18)' : 'rgba(255,255,255,.06)',
                          border: '1px solid var(--va-border)'
                        }}>{t.role==='assistant' ? 'AI' : t.role==='system' ? 'SYSTEM' : 'User'}</div>
                        <div className="text-sm whitespace-pre-wrap">{t.text}</div>
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
          <DeleteModal open={true} name={deleting.name} onCancel={()=> setDeleting(null)} onConfirm={()=> { removeAssistant(deleting.id); setDeleting(null); }} />
        )}
      </AnimatePresence>

      <StyleBlock />
    </div>
  );
}

/* =============================================================================
   Settings Button (BYO keys)
============================================================================= */
function SettingsButton({ settings, onSave }:{ settings: Settings; onSave: (s:Settings)=>void }) {
  const [open, setOpen] = useState(false);
  const [openaiKey, setOpenaiKey] = useState(settings.openaiKey);
  const [xiKey, setXiKey] = useState(settings.xiKey);

  return (
    <>
      <button className="btn btn--ghost" onClick={()=> setOpen(true)}>
        <Shield className="w-4 h-4 icon" /> Keys
      </button>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-lg rounded-2xl"
              style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Shield className="w-4 h-4 icon" /> API Keys (BYO)</div>
                <button onClick={()=> setOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <div className="mb-1.5 text-[13px] font-medium">OpenAI Key</div>
                  <input type="password" value={openaiKey} onChange={(e)=> setOpenaiKey(e.target.value)} placeholder="sk-..."
                    className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                    style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
                </div>
                <div>
                  <div className="mb-1.5 text-[13px] font-medium">ElevenLabs Key</div>
                  <input type="password" value={xiKey} onChange={(e)=> setXiKey(e.target.value)} placeholder="eleven_..."
                    className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                    style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button onClick={()=> setOpen(false)} className="btn btn--ghost">Cancel</button>
                  <button onClick={()=> { onSave({ openaiKey, xiKey }); setOpen(false); }} className="btn btn--green"><span className="text-white">Save</span></button>
                </div>
                <div className="text-xs opacity-70">
                  Your keys are stored locally in your browser (localStorage) and sent only to your server on each request in headers
                  <code> x-openai-key</code> / <code> x-elevenlabs-key</code>. If not set, the APIs refuse to run.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/* =============================================================================
   Delete Modal
============================================================================= */
function DeleteModal({ open, name, onCancel, onConfirm }:{ open: boolean; name: string; onCancel: () => void; onConfirm: () => void; }) {
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

/* =============================================================================
   Atoms + Styles (same as before)
============================================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>{children}</div>);
}
function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 rounded-xl relative" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-[22%] -left-[22%] w-[70%] h-[70%] rounded-full"
           style={{ background:'radial-gradient(circle, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)', filter:'blur(40px)' }} />
      <button type="button" onClick={()=> setOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (<motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }} transition={{ duration:.18 }} className="px-5 pb-5">{children}</motion.div>)}
      </AnimatePresence>
    </div>
  );
}
function TelephonyEditor({ numbers, linkedId, onLink, onAdd, onRemove }:{
  numbers: PhoneNum[]; linkedId?: string; onLink: (id?: string) => void; onAdd: (e164: string, label?: string) => void; onRemove: (id: string) => void;
}) {
  const [e164, setE164] = useState(''); const [label, setLabel] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3, minmax(240px, 1fr))' }}>
        <div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>Phone Number (E.164)</div>
          <input value={e164} onChange={(e)=> setE164(e.target.value)} placeholder="+1xxxxxxxxxx"
                 className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                 style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
        </div>
        <div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>Label</div>
          <input value={label} onChange={(e)=> setLabel(e.target.value)} placeholder="Support line"
                 className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                 style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
        </div>
        <div className="flex items-end">
          <button onClick={()=> { onAdd(e164, label); setE164(''); setLabel(''); }} className="btn btn--green w-full justify-center">
            <PhoneIcon className="w-4 h-4 text-white" /><span className="text-white">Add Number</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {numbers.length === 0 && (<div className="text-sm opacity-70">No phone numbers added yet.</div>)}
        {numbers.map(n => (
          <div key={n.id} className="flex items-center justify-between rounded-xl px-3 py-2"
               style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
            <div className="min-w-0">
              <div className="font-medium truncate">{n.label || 'Untitled'}</div>
              <div className="text-xs opacity-70">{n.e164}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="linked_number" checked={linkedId===n.id} onChange={()=> onLink(n.id)} />
                Linked
              </label>
              <button onClick={()=> onRemove(n.id)} className="btn btn--danger text-xs"><Trash2 className="w-4 h-4" /> Remove</button>
            </div>
          </div>
        ))}
        {numbers.length > 0 && (<div className="text-xs opacity-70">The number marked as <b>Linked</b> will attach on <i>Publish</i>.</div>)}
      </div>
    </div>
  );
}
function StyleBlock() {
  return (<style jsx global>{`
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
.${SCOPE} .va-main{ max-width: none !important; }
.${SCOPE} .icon{ color: var(--accent); }
.${SCOPE} .btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1; border:1px solid var(--va-border); }
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }
`}</style>);
}

/* =============================================================================
   Minimal Select
============================================================================= */
type Item = { value: string; label: string; icon?: React.ReactNode };
function usePortalPos(open: boolean, ref: React.RefObject<HTMLElement>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  useLayoutEffect(() => {
    if (!open) return; const r = ref.current?.getBoundingClientRect(); if (!r) return;
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
      <button ref={btn} type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
              style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>

      <AnimatePresence>
        {open && rect && (
          <motion.div ref={portal} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3 rounded-xl"
            style={{
              top: rect.up ? rect.top - 8 : rect.top + 8,
              left: rect.left, width: rect.width, transform: rect.up ? 'translateY(-100%)' : 'none',
              background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)'
            }}>
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 icon" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it => (
                <button key={it.value} onClick={() => { onChange(it.value); setOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left" style={{ color:'var(--text)' }}>
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
