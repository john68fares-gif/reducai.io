/******************************************************************************************
  FULL WORKING SET (single message) — Vapi-FREE in-browser calling
  Files included:
    1) app/layout.tsx             – base layout
    2) app/page.tsx               – renders the section
    3) app/api/llm/route.ts       – server route that calls OpenAI (or mock if no key)
    4) components/voice/VoiceAgentSection.tsx – full UI + Web Speech (STT/TTS) calling,
       uniform buttons, nicer Generate overlay, Telephony linking, Transcript + Logs.
  Notes:
    • Requires Next.js App Router.
    • Set OPENAI_API_KEY in your env for real LLM replies. If absent, it will mock.
    • Web calling uses browser mic + speechSynthesis (no Vapi, no phone bill).
******************************************************************************************/

/* ============================== 1) app/layout.tsx ============================== */
import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Voice Agent Studio", description: "Build & test voice agents (web only)" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

/* ============================== 2) app/page.tsx =============================== */
"use client";
import VoiceAgentSection from "@/components/voice/VoiceAgentSection";
export default function Page() { return <VoiceAgentSection />; }

/* ========================== 3) app/api/llm/route.ts =========================== */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { system, message } = await req.json();
  const key = process.env.OPENAI_API_KEY;

  // If no key, return a friendly mock so dev works instantly
  if (!key) {
    const reply = `Mock reply: I heard "${message}". What else should I do?`;
    return NextResponse.json({ reply });
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system || "You are a helpful voice assistant." },
        { role: "user", content: message || "" },
      ],
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ reply: "LLM error: " + text.slice(0, 180) }, { status: 200 });
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content ?? "Okay.";
  return NextResponse.json({ reply });
}

/* ============ 4) components/voice/VoiceAgentSection.tsx (FULL) ================ */
// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff, Play, MessageSquare, ListTree, Archive,
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
type TranscriptTurn = { role: 'assistant'|'user'; text: string; ts: number };
type CallLog = {
  id: string; assistantId: string; assistantName: string; startedAt: number; endedAt?: number;
  type: 'Web'|'PSTN'; assistantPhoneNumber?: string; customerPhoneNumber?: string; endedReason?: string;
  transcript: TranscriptTurn[]; costUSD?: number;
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
const LS_PHONE_NUMBERS = 'voice:phoneNumbers.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   PROMPT HELPERS
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

function toTitle(s: string) {
  return s.replace(/\s+/g, ' ').split(' ').map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : '')).join(' ')
          .replace(/\b(Id|Url|Dob)\b/gi, m => m.toUpperCase());
}
function setSection(prompt: string, name: string, body: string) {
  const section = name.replace(/^\[|\]$/g, '');
  const re = new RegExp(String.raw`\[${section}\]\s*([\s\S]*?)(?=\n\[|$)`, 'i');
  if (re.test(prompt)) return prompt.replace(re, `[${section}]\n${body.trim()}\n`);
  const nl = prompt.endsWith('\n') ? '' : '\n';
  return `${prompt}${nl}\n[${section}]\n${body.trim()}\n`;
}
function mergeInput(genText: string, currentPrompt: string) {
  const raw = (genText || '').trim();
  const out = { prompt: currentPrompt || BASE_PROMPT, firstMessage: undefined as string | undefined };
  if (!raw) return out;
  const fm = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  if (fm) { out.firstMessage = fm[1].trim(); return out; }
  const blocks = [...raw.matchAll(/\[(Identity|Style|System Behaviors|Task & Goals|Data to Collect|Safety|Handover|Refinements)\]\s*([\s\S]*?)(?=\n\[|$)/gi)];
  if (blocks.length) { let next = out.prompt; blocks.forEach(m => next = setSection(next, `[${m[1]}]`, m[2])); out.prompt = next; return out; }
  if (raw.split(/\s+/).length <= 3 || /(^|\s)collect(\s|:)/i.test(raw)) {
    const fields = raw.match(/collect[:\-\s]+(.+)$/i)?.[1]?.split(/[,\n;]/).map(s=>s.trim()).filter(Boolean) || [];
    const collectList = fields.length ? fields.map(f=>`- ${toTitle(f)}`).join('\n') : `- Full Name\n- Phone Number\n- Email (if provided)\n- Appointment Date/Time (if applicable)`;
    out.prompt = setSection(BASE_PROMPT, '[Data to Collect]', collectList); return out;
  }
  const hasRef = /\[Refinements\]/i.test(out.prompt);
  const bullet = `- ${raw.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
  out.prompt = hasRef
    ? out.prompt.replace(/\[Refinements\]\s*([\s\S]*?)(?=\n\[|$)/i, (m, b) => `[Refinements]\n${(b||'').trim()}\n${bullet}\n`)
    : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* =============================================================================
   DIFF (character-level)
============================================================================= */
type CharTok = { ch: string; added: boolean };
function charDiffAdded(oldStr: string, newStr: string): CharTok[] {
  const o = [...oldStr]; const n = [...newStr];
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) for (let j = n.length - 1; j >= 0; j--) dp[i][j] = o[i] === n[j] ? 1 + dp[i+1][j+1] : Math.max(dp[i+1][j], dp[i][j+1]);
  const out: CharTok[] = []; let i=0,j=0;
  while (i<o.length && j<n.length) {
    if (o[i]===n[j]) { out.push({ch:n[j],added:false}); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) i++; else { out.push({ch:n[j],added:true}); j++; }
  }
  while (j<n.length) out.push({ch:n[j++],added:true});
  return out;
}

/* =============================================================================
   SIDEBAR WIDTH FIX
============================================================================= */
function useAppSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>, fallbackCollapsed: boolean) {
  useEffect(() => {
    const scope = scopeRef.current; if (!scope) return;
    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) || null;
    let target = findSidebar();
    if (!target) { setVar(fallbackCollapsed ? 72 : 248); return; }
    setVar(target.getBoundingClientRect().width);
    const ro = new ResizeObserver(()=> setVar(target!.getBoundingClientRect().width)); ro.observe(target);
    const mo = new MutationObserver(()=> setVar(target!.getBoundingClientRect().width));
    mo.observe(target, { attributes:true, attributeFilter:['class','style'] });
    const onEnd = () => setVar(target!.getBoundingClientRect().width);
    target.addEventListener('transitionend', onEnd);
    return ()=> { ro.disconnect(); mo.disconnect(); target.removeEventListener('transitionend', onEnd); };
  }, [scopeRef, fallbackCollapsed]);
}

/* =============================================================================
   BROWSER VOICE (no SDK)
============================================================================= */
type RecogType = any; // vendor type
function makeRecognizer(onText: (text:string)=>void) {
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SR) return null;
  const r: RecogType = new SR();
  r.continuous = true; r.interimResults = true; r.lang = 'en-US';
  r.onresult = (e: any) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) final += res[0].transcript;
    }
    if (final.trim()) onText(final.trim());
  };
  return r;
}
function speak(text: string) {
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1; u.pitch = 1; u.volume = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

/* =============================================================================
   PAGE
============================================================================= */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(() => (typeof document==='undefined') ? false : document.body.getAttribute('data-sb-collapsed') === 'true');
  useEffect(() => {
    const onEvt = (e: Event) => { const d = (e as CustomEvent).detail || {}; if (typeof d.collapsed === 'boolean') setSbCollapsed(!!d.collapsed); };
    window.addEventListener('layout:sidebar', onEvt as EventListener);
    const mo = new MutationObserver(()=> setSbCollapsed(document.body.getAttribute('data-sb-collapsed') === 'true'));
    mo.observe(document.body, { attributes:true, attributeFilter:['data-sb-collapsed','class'] });
    return ()=> { window.removeEventListener('layout:sidebar', onEvt as EventListener); mo.disconnect(); };
  }, []);
  useAppSidebarWidth(scopeRef, sbCollapsed);

  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState(''); const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null); const [tempName, setTempName] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [rev, setRev] = useState(0);

  // Calls
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [callType, setCallType] = useState<'Web'|'PSTN'>('Web');
  const recogRef = useRef<any | null>(null);

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
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
          voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
          telephony: { numbers: [] }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else { setAssistants(list); setActiveId(list[0].id); }
    if (!readLS<CallLog[]>(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS<PhoneNum[]>(LS_PHONE_NUMBERS)) writeLS(LS_PHONE_NUMBERS, [
      { id: 'pn_usa_1', e164: '+15551234567', label: 'US Support' },
      { id: 'pn_usa_2', e164: '+15557654321', label: 'US Sales' },
    ]);
    if (!readLS<Record<string, string>>(LS_ROUTES)) writeLS(LS_ROUTES, {});
  }, []);

  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId, rev]);
  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x);
    writeLS(LS_LIST, list); setAssistants(list); setRev(r => r + 1);
  };

  const [creating, setCreating] = useState(false);
  const addAssistant = async () => {
    setCreating(true); await new Promise(r => setTimeout(r, 300));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: '' },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
        telephony: { numbers: [] }
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

  const [railCollapsed, setRailCollapsed] = useState(false);

  // Generate overlay
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typing, setTyping] = useState<CharTok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [lastNew, setLastNew] = useState('');
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);
  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const startTyping = (tokens: CharTok[]) => {
    setTyping(tokens); setTypedCount(0);
    if (typingTimer.current) window.clearInterval(typingTimer.current);
    typingTimer.current = window.setInterval(() => {
      setTypedCount(c => {
        const next = Math.min(c + CHUNK_SIZE, tokens.length);
        if (next >= tokens.length && typingTimer.current) { window.clearInterval(typingTimer.current); typingTimer.current = null; }
        return next;
      });
    }, TICK_MS);
  };
  useEffect(() => { if (!typingBoxRef.current) return; typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight; }, [typedCount]);

  const handleGenerate = () => {
    if (!active) return;
    const current = active.config.model.systemPrompt || '';
    const { prompt, firstMessage } = mergeInput(genText, current || BASE_PROMPT);
    setLastNew(prompt); setPendingFirstMsg(firstMessage); startTyping(charDiffAdded(current, prompt));
    setGenOpen(false); setGenText('');
  };
  const acceptTyping = () => {
    if (!active) return;
    updateActive(a => ({
      ...a,
      config: { ...a.config, model: { ...a.config.model,
        systemPrompt: lastNew || a.config.model.systemPrompt,
        firstMessage: typeof pendingFirstMsg === 'string' ? pendingFirstMsg : a.config.model.firstMessage } }
    }));
    setTyping(null); setPendingFirstMsg(undefined);
  };
  const declineTyping = () => { setTyping(null); setPendingFirstMsg(undefined); };

  const openaiVoices = [{ value: 'alloy', label: 'Alloy (OpenAI)' }, { value: 'ember', label: 'Ember (OpenAI)' }];
  const elevenVoices = [{ value: 'rachel', label: 'Rachel (ElevenLabs)' }, { value: 'adam', label: 'Adam (ElevenLabs)' }, { value: 'bella', label: 'Bella (ElevenLabs)' }];

  if (!active) return (<div ref={scopeRef} className={SCOPE} style={{ color:'var(--text)' }}><div className="px-6 py-10 opacity-70">Create your first assistant.</div><StyleBlock/></div>);

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

  // Telephony helpers (UI + local routing)
  const importFromPhoneNumbersPage = () => {
    const globalNums = readLS<PhoneNum[]>(LS_PHONE_NUMBERS) || [];
    const existing = active.config.telephony?.numbers ?? []; const byId = new Set(existing.map(n=>n.id));
    const merged = [...existing, ...globalNums.filter(n=>!byId.has(n.id))];
    updateActive(a => ({ ...a, config: { ...a.config, telephony: { ...(a.config.telephony||{numbers:[]}), numbers: merged } } }));
  };
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
    updateActive(a => ({ ...a, config: { ...a.config, telephony: { numbers: [...(a.config.telephony?.numbers||[]), { id:`ph_${Date.now().toString(36)}`, e164:norm, label:label?.trim()||undefined }], linkedNumberId: a.config.telephony?.linkedNumberId } } }));
  };
  const removePhone = (id: string) => {
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      const linked = a.config.telephony?.linkedNumberId;
      const nextLinked = linked === id ? undefined : linked;
      return { ...a, config: { ...a.config, telephony: { numbers: nums.filter(n => n.id !== id), linkedNumberId: nextLinked } } };
    });
  };
  const publish = () => {
    const linkedId = active.config.telephony?.linkedNumberId;
    const numbers = active.config.telephony?.numbers ?? [];
    const num = numbers.find(n=>n.id===linkedId);
    if (!num) { alert('Pick a Phone Number before publishing.'); return; }
    const routes = readLS<Record<string,string>>(LS_ROUTES) || {}; routes[num.id] = active.id; writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    window.dispatchEvent(new CustomEvent('voiceagent:publish', { detail:{ assistantId: active.id, assistantName: active.name, phoneNumberId: num.id, e164: num.e164 } }));
    alert('Published! Number is linked to this assistant.');
  };

  /* --------- Web calling without SDK (browser STT/TTS) --------- */
  const pushTurn = (role: 'assistant'|'user', text: string) => {
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
  const startCall = async () => {
    if (!active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id); setTranscript([]);
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({
      id, assistantId: active.id, assistantName: active.name,
      startedAt: Date.now(), type: callType,
      assistantPhoneNumber: (active.config.telephony?.numbers || []).find(n=>n.id===active.config.telephony?.linkedNumberId)?.e164,
      transcript: [],
    });
    writeLS(LS_CALLS, calls);

    // For PSTN, you’d normally dial via provider. We keep it web-only here:
    const greet = active.config.model.firstMessage || 'Hello. How may I help you today?';
    pushTurn('assistant', greet); speak(greet);

    const r = makeRecognizer(async (finalText) => {
      pushTurn('user', finalText);
      try {
        const res = await fetch('/api/llm', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ system: active.config.model.systemPrompt, message: finalText })
        });
        const { reply } = await res.json();
        const out = reply || 'Okay.';
        pushTurn('assistant', out); speak(out);
      } catch {
        const out = 'Sorry, I could not process that.';
        pushTurn('assistant', out); speak(out);
      }
    });
    if (!r) { const msg = 'Browser STT not available. Use Chrome/Edge.'; pushTurn('assistant', msg); speak(msg); return; }
    recogRef.current = r; try { r.start(); } catch {}
  };
  const endCall = (reason: string) => {
    if (recogRef.current) { try { recogRef.current.stop(); } catch {} recogRef.current = null; }
    window.speechSynthesis.cancel();
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls); setCurrentCallId(null);
  };

  const callsForAssistant = (readLS<CallLog[]>(LS_CALLS) || []).filter(c => c.assistantId === active.id);

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ================= ASSISTANTS RAIL ================= */}
      <aside className="hidden lg:flex flex-col" data-collapsed={railCollapsed ? 'true' : 'false'}
        style={{
          position:'fixed', left:'calc(var(--app-sidebar-w, 248px) - 1px)',
          top:'var(--app-header-h, 64px)', width: railCollapsed ? '72px' : 'var(--va-rail-w, 360px)',
          height:'calc(100vh - var(--app-header-h, 64px))', borderRight:'1px solid var(--va-border)',
          background:'var(--va-sidebar)', boxShadow:'var(--va-shadow-side)', zIndex:10, willChange:'left'
        }}>
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold"><PanelLeft className="w-4 h-4 icon" /> {!railCollapsed && <span>Assistants</span>}</div>
          <div className="flex items-center gap-2">
            {!railCollapsed && (
              <button onClick={addAssistant} className="btn btn--green">
                {creating ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/50 border-t-transparent animate-spin" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                <span className="text-white">{creating ? 'Creating…' : 'Create'}</span>
              </button>
            )}
            <button title={railCollapsed ? 'Expand assistants' : 'Collapse assistants'} className="btn btn--ghost" onClick={() => setRailCollapsed(v => !v)}>
              {railCollapsed ? <ChevronRightIcon className="w-4 h-4 icon" /> : <ChevronLeft className="w-4 h-4 icon" />}
            </button>
          </div>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          {!railCollapsed && (
            <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
              style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 icon" />
              <input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search assistants"
                     className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
          )}

          {!railCollapsed && (<><div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5 icon" /> Folders</div>
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
              <FolderOpen className="w-4 h-4 icon" /> All
            </button></>)}

          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isActive = a.id === activeId; const isEdit = editingId === a.id;
              if (railCollapsed) return (
                <button key={a.id} onClick={()=> setActiveId(a.id)} className="w-full rounded-xl p-3 grid place-items-center"
                  style={{ background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                           border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`, boxShadow:'var(--va-shadow-sm)' }}
                  title={a.name}><Bot className="w-4 h-4 icon" /></button>);
              return (
                <div key={a.id} className="w-full rounded-xl p-3"
                  style={{ background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                           border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`, boxShadow:'var(--va-shadow-sm)' }}>
                  <button className="w-full text-left flex items-center justify-between" onClick={()=> setActiveId(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2"><Bot className="w-4 h-4 icon" />
                        {!isEdit ? (<span className="truncate">{a.name}</span>) : (
                          <input autoFocus value={tempName} onChange={(e)=> setTempName(e.target.value)}
                                 onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }}
                                 className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
                                 style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }}/>
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {isActive ? <Check className="w-4 h-4 icon" /> : null}
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

      {/* =================================== EDITOR =================================== */}
      <div className="va-main"
        style={{ marginLeft:`calc(var(--app-sidebar-w, 248px) + ${railCollapsed ? '72px' : 'var(--va-rail-w, 360px)'})`,
                 paddingRight:'clamp(20px, 4vw, 40px)', paddingTop:'calc(var(--app-header-h, 64px) + 12px)', paddingBottom:'88px' }}>
        {/* Top bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky" style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            <button className="btn btn--ghost" onClick={()=> setCallType(c => c==='Web'?'PSTN':'Web')}>
              <ListTree className="w-4 h-4 icon" /> {callType}
            </button>
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
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})} className="btn btn--ghost">
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={()=> publish()} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          {/* LEFT */}
          <div className="col-span-12 xl:col-span-7 space-y-10">
            <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(260px, 1fr))' }}>
                <Field label="Provider"><Select value={active.config.model.provider} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,model:{...a.config.model,provider:v as Provider}}}))} items={[{value:'openai',label:'OpenAI'}]} /></Field>
                <Field label="Model"><Select value={active.config.model.model} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,model:{...a.config.model,model:v as ModelId}}}))}
                  items={[{value:'gpt-4o',label:'GPT-4o'},{value:'gpt-4o-mini',label:'GPT-4o mini'},{value:'gpt-4.1',label:'GPT-4.1'},{value:'gpt-3.5-turbo',label:'GPT-3.5 Turbo'}]} /></Field>
                <Field label="First Message Mode"><Select value={active.config.model.firstMessageMode} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,model:{...a.config.model,firstMessageMode:v as any}}}))}
                  items={[{value:'assistant_first',label:'Assistant speaks first'},{value:'user_first',label:'User speaks first'}]} /></Field>
                <Field label="First Message"><input value={active.config.model.firstMessage} onChange={(e)=>updateActive(a=>({...a,config:{...a.config,model:{...a.config.model,firstMessage:e.target.value}}}))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}/></Field>
              </div>

              <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                  <div className="flex items-center gap-2">
                    <button onClick={()=>updateActive(a=>({...a,config:{...a.config,model:{...a.config.model,systemPrompt:BASE_PROMPT}}}))} className="btn btn--ghost"><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                    <button onClick={()=> setGenOpen(true)} className="btn btn--green"><Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span></button>
                  </div>
                </div>

                {!typing ? (
                  <textarea rows={20} value={active.config.model.systemPrompt || ''} onChange={(e)=>updateActive(a=>({...a,config:{...a.config,model:{...a.config.model,systemPrompt:e.target.value}}}))}
                    className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                    style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                             fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace', minHeight:420 }} />
                ) : (
                  <div>
                    <div ref={typingBoxRef} className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                      style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                               fontFamily:'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace', whiteSpace:'pre-wrap', minHeight:420, maxHeight:560, overflowY:'auto' }}>
                      {(() => {
                        const slice = typing.slice(0, typedCount); const out: JSX.Element[] = []; let buf=''; let added = slice.length ? slice[0].added : false;
                        slice.forEach((t, i) => { if (t.added !== added) { out.push(added ? <ins key={`ins-${i}`} style={{background:'rgba(16,185,129,.18)',padding:'1px 2px',borderRadius:4}}>{buf}</ins> : <span key={`nor-${i}`}>{buf}</span>); buf = t.ch; added = t.added; } else buf += t.ch; });
                        if (buf) out.push(added ? <ins key="tail-ins" style={{background:'rgba(16,185,129,.18)',padding:'1px 2px',borderRadius:4}}>{buf}</ins> : <span key="tail-nor">{buf}</span>);
                        if (typedCount < (typing?.length || 0)) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
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

            <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(260px, 1fr))' }}>
                <Field label="Provider"><Select value={active.config.voice.provider} onChange={(v)=>{ const list = v==='elevenlabs'?elevenVoices:openaiVoices;
                  updateActive(a=>({...a,config:{...a.config,voice:{provider:v as VoiceProvider, voiceId:list[0].value, voiceLabel:list[0].label}}})) }}
                  items={[{value:'openai',label:'OpenAI'},{value:'elevenlabs',label:'ElevenLabs'}]} /></Field>
                <Field label="Voice"><Select value={active.config.voice.voiceId} onChange={(v)=>{ const list = active.config.voice.provider==='elevenlabs'?elevenVoices:openaiVoices;
                  const found = list.find(x=>x.value===v); updateActive(a=>({...a,config:{...a.config,voice:{...a.config.voice, voiceId:v, voiceLabel:found?.label||v}}})) }}
                  items={active.config.voice.provider==='elevenlabs'?elevenVoices:openaiVoices} /></Field>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button onClick={()=> alert('Hook “voiceagent:import-11labs” to your importer.')} className="btn btn--ghost"><UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs</button>
                <button onClick={()=> window.speechSynthesis.speak(new SpeechSynthesisUtterance('This is a test output device check.'))} className="btn btn--ghost"><Play className="w-4 h-4 icon" /> Test Output</button>
              </div>
            </Section>

            <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(260px, 1fr))' }}>
                <Field label="Provider"><Select value={active.config.transcriber.provider} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,transcriber:{...a.config.transcriber, provider:v as any}}}))} items={[{value:'deepgram',label:'Deepgram'}]} /></Field>
                <Field label="Model"><Select value={active.config.transcriber.model} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,transcriber:{...a.config.transcriber, model:v as any}}}))}
                  items={[{value:'nova-2',label:'Nova 2'},{value:'nova-3',label:'Nova 3'}]} /></Field>
                <Field label="Language"><Select value={active.config.transcriber.language} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,transcriber:{...a.config.transcriber, language:v as any}}}))}
                  items={[{value:'en',label:'English'},{value:'multi',label:'Multi'}]} /></Field>
                <Field label="Confidence Threshold"><div className="flex items-center gap-3"><input type="range" min={0} max={1} step={0.01}
                  value={active.config.transcriber.confidenceThreshold} onChange={(e)=>updateActive(a=>({...a,config:{...a.config,transcriber:{...a.config.transcriber, confidenceThreshold:Number(e.target.value)}}}))} className="va-range w-full"/>
                  <span className="text-xs" style={{ color:'var(--text-muted)' }}>{active.config.transcriber.confidenceThreshold.toFixed(2)}</span></div></Field>
                <Field label="Denoise"><Select value={String(active.config.transcriber.denoise)} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,transcriber:{...a.config.transcriber, denoise:v==='true'}}}))}
                  items={[{value:'false',label:'Off'},{value:'true',label:'On'}]} /></Field>
                <Field label="Use Numerals"><Select value={String(active.config.transcriber.numerals)} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,transcriber:{...a.config.transcriber, numerals:v==='true'}}}))}
                  items={[{value:'false',label:'No'},{value:'true',label:'Yes'}]} /></Field>
              </div>
            </Section>

            <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(260px, 1fr))' }}>
                <Field label="Enable End Call Function"><Select value={String(active.config.tools.enableEndCall)} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,tools:{...a.config.tools, enableEndCall:v==='true'}}}))}
                  items={[{value:'true',label:'Enabled'},{value:'false',label:'Disabled'}]} /></Field>
                <Field label="Dial Keypad"><Select value={String(active.config.tools.dialKeypad)} onChange={(v)=>updateActive(a=>({...a,config:{...a.config,tools:{...a.config.tools, dialKeypad:v==='true'}}}))}
                  items={[{value:'true',label:'Enabled'},{value:'false',label:'Disabled'}]} /></Field>
              </div>
            </Section>

            <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4 icon" />}>
              <div className="mb-3"><button className="btn btn--ghost" onClick={importFromPhoneNumbersPage}><UploadCloud className="w-4 h-4 icon" /> Import from Phone Numbers</button></div>
              <TelephonyEditor numbers={active.config.telephony?.numbers ?? []} linkedId={active.config.telephony?.linkedNumberId}
                onAdd={addPhone} onRemove={removePhone} onLink={(id)=> updateActive(a=>({...a,config:{...a.config,telephony:{...(a.config.telephony||{numbers:[]}), linkedNumberId:id }}}))} />
            </Section>
          </div>

          {/* RIGHT */}
          <div className="col-span-12 xl:col-span-5 space-y-10">
            <Section title="Call Transcript" icon={<Archive className="w-4 h-4 icon" />}>
              <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {transcript.length === 0 && (<div className="text-sm opacity-70">No transcript yet. Start a call to see messages here.</div>)}
                {transcript.map((t, i) => (
                  <div key={i} className="rounded-xl px-3 py-2"
                       style={{ background: t.role==='assistant' ? 'rgba(255,255,255,.04)' : 'rgba(16,185,129,.08)', border: '1px solid var(--va-border)' }}>
                    <div className="text-[11px] opacity-70 mb-0.5">{t.role==='assistant'?'Assistant':'You'} • {new Date(t.ts).toLocaleTimeString()}</div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Call Logs" icon={<ListTree className="w-4 h-4 icon" />}>
              <div className="space-y-2">
                {callsForAssistant.length === 0 && <div className="text-sm opacity-70">No calls yet.</div>}
                {callsForAssistant.map(c => (
                  <div key={c.id} className="rounded-xl px-3 py-3" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)' }}>
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">{c.type} • {new Date(c.startedAt).toLocaleString()}</div>
                      <div className="text-xs opacity-70">{c.endedReason || 'In progress'}</div>
                    </div>
                    {(c.assistantPhoneNumber || c.customerPhoneNumber) && (
                      <div className="text-xs opacity-70 mt-1">
                        {c.assistantPhoneNumber ? <>Assistant #: {c.assistantPhoneNumber} • </> : null}
                        {c.customerPhoneNumber ? <>Customer #: {c.customerPhoneNumber}</> : null}
                      </div>
                    )}
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm">Transcript</summary>
                      <div className="mt-2 space-y-2">
                        {c.transcript.map((t, i) => (
                          <div key={i} className="rounded-lg px-2 py-1" style={{ background:'rgba(255,255,255,.03)', border:'1px solid var(--va-border)' }}>
                            <div className="text-[11px] opacity-70">{t.role==='assistant'?'Assistant':'You'} • {new Date(t.ts).toLocaleTimeString()}</div>
                            <div className="text-sm">{t.text}</div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        </div>
      </div>

      {/* ---------------- Generate overlay ---------------- */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-2xl rounded-2xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Edit3 className="w-4 h-4 icon" /> Generate / Edit Prompt</div>
                <button onClick={()=> setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4">
                <input value={genText} onChange={(e)=> setGenText(e.target.value)}
                  placeholder={`Examples:
• assistant
• collect full name, phone, date
• [Identity] AI Sales Agent for roofers
• first message: Hey—quick question to get you booked…`}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}/>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn btn--ghost">Cancel</button>
                  <button onClick={handleGenerate} className="btn btn--green"><span className="text-white">Generate</span></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete overlay */}
      <AnimatePresence>
        {deleting && (<DeleteModal open={true} name={deleting.name} onCancel={()=> setDeleting(null)} onConfirm={()=> { removeAssistant(deleting.id); setDeleting(null); }} />)}
      </AnimatePresence>

      <StyleBlock />
    </div>
  );
}

/* =============================================================================
   Delete Modal
============================================================================= */
function DeleteModal({ open, name, onCancel, onConfirm }:{ open: boolean; name: string; onCancel: () => void; onConfirm: () => void; }) {
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-[9998] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ background:'rgba(0,0,0,.55)' }}>
      <motion.div initial={{ y: 10, opacity: .9, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }}
        className="w-full max-w-md rounded-2xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="text-sm font-semibold" style={{ color:'var(--text)' }}>Delete Assistant</div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color:'var(--text-muted)' }}>Are you sure you want to delete <span style={{ color:'var(--text)' }}>“{name}”</span>? This cannot be undone.</div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn--ghost">Cancel</button>
          <button onClick={onConfirm} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =============================================================================
   Atoms
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

/* =============================================================================
   Telephony editor
============================================================================= */
type Item = { value: string; label: string; icon?: React.ReactNode };
function TelephonyEditor({ numbers, linkedId, onAdd, onRemove, onLink }:{ numbers: PhoneNum[]; linkedId?: string; onAdd: (e164: string, label?: string) => void; onRemove: (id: string) => void; onLink: (id: string) => void; }) {
  const [e164, setE164] = useState(''); const [label, setLabel] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3, minmax(220px, 1fr))' }}>
        <div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>Phone Number (E.164)</div>
          <input value={e164} onChange={(e)=> setE164(e.target.value)} placeholder="+1xxxxxxxxxx" className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
            style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}/></div>
        <div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>Label</div>
          <input value={label} onChange={(e)=> setLabel(e.target.value)} placeholder="Support line" className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
            style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}/></div>
        <div className="flex items-end">
          <button onClick={()=> { onAdd(e164, label); setE164(''); setLabel(''); }} className="btn btn--green w-full justify-center">
            <PhoneIcon className="w-4 h-4 text-white" /><span className="text-white">Add Number</span>
          </button>
        </div>
      </div>
      <div className="space-y-2">
        {numbers.length === 0 && (<div className="text-sm opacity-70">No phone numbers added yet.</div>)}
        {numbers.map(n => {
          const linked = n.id === linkedId;
          return (
            <div key={n.id} className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              <div className="min-w-0">
                <div className="font-medium truncate">{n.label || 'Untitled'} {linked ? <span className="text-xs opacity-70">• Linked</span> : null}</div>
                <div className="text-xs opacity-70">{n.e164}</div>
              </div>
              <div className="flex items-center gap-2">
                {!linked ? (<button onClick={()=> onLink(n.id)} className="btn btn--green text-xs"><Check className="w-4 h-4 text-white" /> <span className="text-white">Link</span></button>)
                 : (<button onClick={()=> onLink('' as any)} className="btn btn--ghost text-xs">Unlink</button>)}
                <button onClick={()=> onRemove(n.id)} className="btn btn--danger text-xs"><Trash2 className="w-4 h-4" /> Remove</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =============================================================================
   Minimal Select
============================================================================= */
function usePortalPos(open: boolean, ref: React.RefObject<HTMLElement>) {
  const [rect, setRect] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  useLayoutEffect(() => { if (!open) return; const r = ref.current?.getBoundingClientRect(); if (!r) return; const up = r.bottom + 320 > window.innerHeight; setRect({ top: up ? r.top : r.bottom, left: r.left, width: r.width, up }); }, [open]);
  return rect;
}
function Select({ value, items, onChange, placeholder, leftIcon }: { value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode; }) {
  const [open, setOpen] = useState(false); const [q, setQ] = useState(''); const btn = useRef<HTMLButtonElement | null>(null); const portal = useRef<HTMLDivElement | null>(null);
  const rect = usePortalPos(open, btn);
  useEffect(() => { if (!open) return; const on = (e: MouseEvent) => { if (btn.current?.contains(e.target as Node) || portal.current?.contains(e.target as Node)) return; setOpen(false); }; window.addEventListener('mousedown', on); return () => window.removeEventListener('mousedown', on); }, [open]);
  const filtered = items.filter(i => i.label.toLowerCase().includes(q.trim().toLowerCase())); const sel = items.find(i => i.value === value) || null;
  return (
    <>
      <button ref={btn} type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
        style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" /><ChevronDown className="w-4 h-4 icon" />
      </button>
      <AnimatePresence>
        {open && rect && (
          <motion.div ref={portal} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3 rounded-xl"
            style={{ top: rect.up ? rect.top - 8 : rect.top + 8, left: rect.left, width: rect.width, transform: rect.up ? 'translateY(-100%)' : 'none',
                     background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)' }}>
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-lg" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 icon" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it => (
                <button key={it.value} onClick={() => { onChange(it.value); setOpen(false); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left"
                        style={{ color:'var(--text)' }} onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(16,185,129,.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(16,185,129,.35)'; }}
                        onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}>
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
   Scoped CSS
============================================================================= */
function StyleBlock() {
  return (<style jsx global>{`
.${SCOPE}{ --accent:${ACCENT}; --bg:#0b0c10; --text:#eef2f5; --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:#0f1315; --va-topbar:#0e1214; --va-sidebar:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
  --va-chip:rgba(255,255,255,.03); --va-border:rgba(255,255,255,.10); --va-input-bg:rgba(255,255,255,.03);
  --va-input-border:rgba(255,255,255,.14); --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06); --va-menu-bg:#101314;
  --va-menu-border:rgba(255,255,255,.16); --va-shadow:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.4);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5); --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
  --va-shadow-side:8px 0 28px rgba(0,0,0,.42); --va-rail-w:360px; }
:root:not([data-theme="dark"]) .${SCOPE}{ --bg:#f7f9fb; --text:#101316; --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
  --va-card:#ffffff; --va-topbar:#ffffff; --va-sidebar:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
  --va-chip:#ffffff; --va-border:rgba(0,0,0,.10); --va-input-bg:#ffffff; --va-input-border:rgba(0,0,0,.12);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.85); --va-menu-bg:#ffffff; --va-menu-border:rgba(0,0,0,.10);
  --va-shadow:0 28px 70px rgba(0,0,0,.12), 0 12px 28px rgba(0,0,0,.08); --va-shadow-lg:0 42px 110px rgba(0,0,0,.16), 0 22px 54px rgba(0,0,0,.10);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.10); --va-shadow-side:8px 0 26px rgba(0,0,0,.08); }
.${SCOPE} .va-main{ max-width: none !important; } .${SCOPE} .icon{ color: var(--accent); }

/* UNIFIED BUTTONS (same size) */
.${SCOPE} .btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1; border:1px solid var(--va-border); }
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; } .${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }

.${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
.${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
.${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }

.${SCOPE} aside{ transition:none !important; } @media (max-width:1180px){ .${SCOPE}{ --va-rail-w:320px; } }
`}</style>);
}
