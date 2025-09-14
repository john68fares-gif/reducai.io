// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Copy, Sparkles, ChevronDown, ChevronRight,
  FileText, Mic2, BookOpen, SlidersHorizontal, UploadCloud,
  RefreshCw, X, Rocket, PhoneOff, MessageSquare,
  ListTree, AudioLines, Volume2, Save
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';

/* ──────────────────────────────────────────────────────────────────────────── */
/* THEME / SIZING                                                              */
/* ──────────────────────────────────────────────────────────────────────────── */
const SCOPE = 'va-scope';
const EDGE_GUTTER = 24;
const MAX_LANE_W = 1560;

/* ──────────────────────────────────────────────────────────────────────────── */
/* GLOBAL STYLE (no styled-jsx; safe in any React/Next build)                  */
/* ──────────────────────────────────────────────────────────────────────────── */
function StyleBlock() {
  const css = `
.${SCOPE}{
  --fw-regular: 500;
  --fw-medium:  560;
  --fw-semi:    600;
  --radius: 12px;

  /* ===== Dark theme tokens (from your photos) ===== */
  --background: oklch(0.1743 0.0227 283.0);
  --foreground: oklch(0.9185 0.0257 285.0);

  --card:       oklch(0.2284 0.0384 282.0);
  --card-fg:    var(--foreground);

  --popover:    oklch(0.2284 0.0384 282.0);
  --popover-fg: var(--foreground);

  --primary:    oklch(0.7162 0.1597 290.3962); /* purple brand from screenshots */
  --primary-fg: oklch(0.1743 0.0227 283.0);

  --secondary:    oklch(0.3139 0.0736 283.0);
  --secondary-fg: oklch(0.8367 0.0849 285.0);

  --accent:       oklch(0.3354 0.0828 280.0);
  --accent-fg:    var(--foreground);

  --muted:        oklch(0.2710 0.0621 281.4);
  --muted-fg:     oklch(0.7166 0.0462 285.0);

  --destructive:    oklch(0.6861 0.2061 14.99);
  --destructive-fg: oklch(1 0 0);

  --border: oklch(0.3261 0.0597 282.5832);
  --input:  var(--border);
  --ring:   var(--primary);

  --bg: var(--background);
  --text: var(--foreground);
  --text-muted: color-mix(in oklab, var(--foreground) 60%, transparent);

  --va-card:    var(--card);
  --va-topbar:  var(--card);
  --va-border:  var(--border);
  --va-input-bg:     var(--card);
  --va-input-border: var(--input);
  --va-input-shadow: inset 0 1px 0 color-mix(in oklab, white 6%, transparent);

  --va-menu-bg:     var(--card);
  --va-menu-border: var(--border);

  --va-shadow:    0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.40);
  --va-shadow-lg: 0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
  --va-shadow-sm: 0 12px 26px rgba(0,0,0,.35);

  --va-rail-w:320px;
  --app-sidebar-w:248px;
  --va-edge-gutter:${EDGE_GUTTER}px;

  font-weight: var(--fw-regular);
  letter-spacing: .005em;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg); color: var(--text);
  overflow-x:hidden;
}

/* Light theme tokens from your light screenshots */
:root:not([data-theme="dark"]) .${SCOPE}{
  --background: oklch(0.9730 0.0133 286.0);
  --foreground: oklch(0.3015 0.0572 282.0);

  --card:       oklch(1 0 0);
  --popover:    oklch(1 0 0);

  --primary:    oklch(0.5417 0.1790 288.0332);
  --primary-fg: oklch(1 0 0);

  --secondary:    oklch(0.9174 0.0435 292.0);
  --secondary-fg: oklch(0.4143 0.1039 288.1);

  --accent:       oklch(0.9221 0.0373 262.0);
  --muted:        oklch(0.9580 0.0133 286.0);
  --muted-fg:     oklch(0.5426 0.0465 284.0);

  --border: oklch(0.9115 0.0216 285.9625);
  --input:  var(--border);
  --ring:   oklch(0.5417 0.1790 288.0332);

  --bg: var(--background);
  --text: var(--foreground);
  --text-muted: color-mix(in oklab, var(--foreground) 55%, transparent);

  --va-card: var(--card);
  --va-topbar: var(--card);
  --va-border: var(--border);
  --va-input-bg: var(--card);
  --va-input-border: var(--input);
  --va-input-shadow: inset 0 1px 0 rgba(255,255,255,.85);
  --va-menu-bg: var(--card);
  --va-menu-border: var(--border);

  --va-shadow:    0 28px 70px rgba(0,0,0,.12), 0 12px 28px rgba(0,0,0,.08);
  --va-shadow-lg: 0 42px 110px rgba(0,0,0,.16), 0 22px 54px rgba(0,0,0,.10);
  --va-shadow-sm: 0 12px 26px rgba(0,0,0,.10);
}

/* Icon tint */
.${SCOPE} .icon{ color: var(--primary); }

/* ---------------- Assistant rail (matches screenshots) ---------------- */
aside[data-va-rail]{
  position: fixed;
  top: var(--app-header-h, 64px);
  left: 0;
  width: var(--va-rail-w);
  height: calc(100dvh - var(--app-header-h, 64px));
  background: linear-gradient(180deg, oklch(0.208 0.03 282) 0%, oklch(0.188 0.025 282) 100%);
  border-right: 1px solid var(--va-border);
  box-shadow: 8px 0 28px rgba(0,0,0,.42);
  padding: 10px 10px 14px 10px;
  display: flex; flex-direction: column; gap: 10px;
  z-index: 10;
}
aside[data-va-rail] .va-rail__section-title{
  font-size: 12.5px; letter-spacing: .02em; color: var(--text-muted);
  padding: 6px 10px 2px 12px; font-weight: 560;
}
aside[data-va-rail] .va-rail__list{ overflow:auto; margin-top:4px; padding:6px; border-radius:10px; }
aside[data-va-rail] .va-rail__item,
aside[data-va-rail] :where(a,button)[data-va-item]{
  display:grid; grid-template-columns: 1fr auto; align-items:center;
  gap:8px; padding:9px 10px; border-radius:10px; color:var(--text);
  background:transparent; border:1px solid transparent;
  transition: background .15s, border-color .15s; font-weight:520; text-align:left;
}
aside[data-va-rail] .va-rail__item:hover,
aside[data-va-rail] :where(a,button)[data-va-item]:hover{
  background: color-mix(in oklab, var(--primary) 10%, transparent);
  border-color: color-mix(in oklab, var(--primary) 18%, var(--va-border));
}
aside[data-va-rail] .va-rail__item[aria-current="true"],
aside[data-va-rail] :where(a,button)[data-va-item][data-active="true"]{
  background: color-mix(in oklab, var(--primary) 18%, transparent);
  border-color: color-mix(in oklab, var(--primary) 28%, var(--va-border));
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--primary) 35%, transparent);
}
aside[data-va-rail] .va-rail__name{ font-size:13.5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
aside[data-va-rail] .va-rail__meta{ font-size:11.5px; color:var(--text-muted); }
aside[data-va-rail] .va-rail__dot{ width:6px; height:6px; border-radius:50%; background:var(--primary);
  box-shadow:0 0 0 2px color-mix(in oklab, var(--primary) 18%, transparent); }
aside[data-va-rail] .va-rail__footer{ margin-top:auto; padding-top:8px; border-top:1px dashed color-mix(in oklab, var(--va-border) 80%, transparent); }
html[data-va-rail-collapsed="true"] aside[data-va-rail]{ width:72px; padding:10px 6px; }
html[data-va-rail-collapsed="true"] aside[data-va-rail] .va-rail__name,
html[data-va-rail-collapsed="true"] aside[data-va-rail] .va-rail__meta{ display:none; }

/* ---------------- Inputs / Buttons ---------------- */
.${SCOPE} .topbar-btn, .${SCOPE} .btn{
  height:40px; padding:0 .85rem; border-radius: var(--radius);
  display:inline-flex; align-items:center; gap:.5rem;
  border:1px solid var(--va-border); background:var(--va-card); color:var(--text);
  font-weight: var(--fw-medium);
}
.${SCOPE} .btn--green{
  background: var(--primary); color: var(--primary-fg);
  box-shadow: 0 10px 24px color-mix(in oklab, var(--primary) 35%, transparent);
  transition: transform .04s, background .18s, box-shadow .18s;
}
.${SCOPE} .btn--green:hover{
  background: color-mix(in oklab, var(--primary) 88%, black);
  box-shadow: 0 12px 28px color-mix(in oklab, var(--primary) 48%, transparent);
}
.${SCOPE} .btn--danger{
  background: color-mix(in oklab, var(--destructive) 18%, transparent);
  color: color-mix(in oklab, var(--destructive) 75%, white);
  border-color: color-mix(in oklab, var(--destructive) 35%, var(--va-border));
}
.${SCOPE} .va-input{
  width:100%; min-width:0; height:40px; border-radius: var(--radius);
  padding:0 .85rem; font-size:14.5px;
  background:var(--va-input-bg); border:1px solid var(--va-input-border);
  box-shadow:var(--va-input-shadow); color:var(--text); outline:none;
  font-weight: var(--fw-regular);
}
.${SCOPE} .va-input:focus{
  border-color: color-mix(in oklab, var(--ring) 60%, var(--va-input-border));
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 22%, transparent), var(--va-input-shadow);
}
.${SCOPE} .va-select{
  width:100%; min-width:0; height:40px; font-size:14.5px; border-radius: var(--radius); outline:none;
  padding:0 2.1rem 0 .85rem;
  background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), var(--va-input-bg);
  border:1px solid var(--va-input-border); color:var(--text);
  -webkit-appearance:none; appearance:none; box-shadow:var(--va-input-shadow);
  transition: border-color .15s, box-shadow .15s, background .15s;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23A8B3BE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat:no-repeat; background-position:right .6rem center;
}
.${SCOPE} .va-select:hover{ background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)), var(--va-input-bg); }
.${SCOPE} .va-select:focus{
  border-color: color-mix(in oklab, var(--ring) 60%, var(--va-input-border));
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--ring) 22%, transparent), var(--va-input-shadow);
}

/* ---------------- Section card & content lane ---------------- */
.${SCOPE} .section{
  border:1px solid var(--va-border);
  background: linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01));
  border-radius: 16px;
  box-shadow: var(--va-shadow);
}
.${SCOPE} .va-lane{
  position: relative;
  box-sizing: border-box;
  padding: 10px var(--va-edge-gutter) 88px var(--va-edge-gutter);
  margin-left: calc(var(--app-sidebar-w,0px) + var(--va-rail-w,0px) + var(--va-edge-gutter,24px));
  width: calc(100vw - var(--app-sidebar-w,0px) - var(--va-rail-w,0px) - (var(--va-edge-gutter,24px) * 2));
  max-width: min(${MAX_LANE_W}px, 100vw - var(--app-sidebar-w,0px) - var(--va-rail-w,0px) - (var(--va-edge-gutter,24px) * 2));
  overflow-x: hidden;
}
@media (min-width: 1024px){
  html[data-va-rail-collapsed="true"] .${SCOPE} .va-lane{
    max-width: min(${MAX_LANE_W + 120}px, 100vw - var(--app-sidebar-w,0px) - var(--va-rail-w,0px) - (var(--va-edge-gutter,24px) * 2));
  }
}
.${SCOPE} .va-lane .container{ max-width:none !important; padding-left:0 !important; padding-right:0 !important; }
.${SCOPE} .va-lane [class*="max-w-"]{ max-width:none !important; }
`;
  return <style>{css}</style>;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* TYPES                                                                       */
/* ──────────────────────────────────────────────────────────────────────────── */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';
type PhoneNum = { id: string; label?: string; e164: string };
type TranscriptTurn = { role: 'assistant' | 'user'; text: string; ts: number };
type CallLog = { id: string; assistantId: string; assistantName: string; startedAt: number; endedAt?: number; endedReason?: string; type: 'Web'; assistantPhoneNumber?: string; transcript: TranscriptTurn[]; costUSD?: number; };
type Assistant = {
  id: string; name: string; folder?: string; updatedAt: number; published?: boolean;
  config: {
    model: { provider: Provider; model: ModelId; firstMessageMode: 'assistant_first' | 'user_first'; firstMessage: string; systemPrompt: string; };
    voice: { provider: VoiceProvider; voiceId: string; voiceLabel: string };
    transcriber: { provider: 'deepgram'; model: 'nova-2' | 'nova-3'; language: 'en' | 'multi'; denoise: boolean; confidenceThreshold: number; numerals: boolean; };
    tools: { enableEndCall: boolean; dialKeypad: boolean };
    telephony?: { numbers: PhoneNum[]; linkedNumberId?: string };
  };
};

/* ──────────────────────────────────────────────────────────────────────────── */
/* STORAGE HELPERS                                                             */
/* ──────────────────────────────────────────────────────────────────────────── */
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ──────────────────────────────────────────────────────────────────────────── */
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

/* ──────────────────────────────────────────────────────────────────────────── */
/* UI HELPERS                                                                  */
/* ──────────────────────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="mb-1.5 text-[13px]" style={{ color: 'var(--text)', fontWeight: 560 }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="section relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[20%] -left-[12%] w-[58%] h-[58%] rounded-full"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--primary) 16%, transparent) 0%, transparent 70%)',
          filter: 'blur(42px)', opacity: .75
        }}
      />
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: open ? '1px solid var(--va-border)' : 'none', fontWeight: 560 }}
      >
        <span className="flex items-center gap-2 text-sm">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
          {icon}{title}
        </span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}
            className="px-5 pb-5"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* PROMPT MERGE                                                                */
/* ──────────────────────────────────────────────────────────────────────────── */
const sectionRegex = (name: string) => new RegExp(String.raw`\[${name}\]\s*([\s\S]*?)(?=\n\[|$)`, 'i');
const setSection = (p: string, name: string, body: string) => {
  const re = sectionRegex(name);
  if (re.test(p)) return p.replace(re, `[${name}]\n${body.trim()}\n`);
  const nl = p.endsWith('\n') ? '' : '\n';
  return `${p}${nl}\n[${name}]\n${body.trim()}\n`;
};
function mergeInput(freeText: string, current: string) {
  const out = { prompt: current || BASE_PROMPT, firstMessage: undefined as string | undefined };
  const raw = (freeText || '').trim(); if (!raw) return out;
  const m = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  if (m) { out.firstMessage = m[1].trim(); return out; }
  const blocks = [...raw.matchAll(/\[(Identity|Style|System Behaviors|Task & Goals|Data to Collect|Safety|Handover|Refinements)\]\s*([\s\S]*?)(?=\n\[|$)/gi)];
  if (blocks.length) { let next = out.prompt; for (const b of blocks) next = setSection(next, b[1], b[2]); out.prompt = next; return out; }
  const hasRef = sectionRegex('Refinements').test(out.prompt);
  const bullet = `- ${raw.replace(/\s+/g, ' ').trim()}`;
  out.prompt = hasRef ? out.prompt.replace(sectionRegex('Refinements'), (_m, body) => `[Refinements]\n${(body || '').trim()}\n${bullet}\n`)
                      : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* ──────────────────────────────────────────────────────────────────────────── */
/* PAGE                                                                        */
/* ──────────────────────────────────────────────────────────────────────────── */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  /* reflect rail collapsed state on <html> for CSS */
  useEffect(() => {
    const handler = () => {
      const rail = document.querySelector('aside[data-va-rail]') as HTMLElement | null;
      if (!rail) return;
      const collapsed = rail.getAttribute('data-va-collapsed') === 'true';
      document.documentElement.setAttribute('data-va-rail-collapsed', collapsed ? 'true' : 'false');
    };
    handler();
    const ro = new MutationObserver(handler);
    const rail = document.querySelector('aside[data-va-rail]');
    if (rail) ro.observe(rail, { attributes: true, attributeFilter: ['data-va-collapsed', 'style'] });
    window.addEventListener('resize', handler);
    window.addEventListener('voice:layout:ping', handler as any);
    return () => { ro.disconnect(); window.removeEventListener('resize', handler); window.removeEventListener('voice:layout:ping', handler as any); };
  }, []);

  /* Data bootstrapping (localStorage demo) */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState(''); const [active, setActive] = useState<Assistant | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!isClient) return;
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (!list.length) {
      const seed: Assistant = {
        id: 'riley', name: 'Riley', folder: 'Default', updatedAt: Date.now(), published: false,
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
      writeLS(LS_LIST, fixed); setAssistants(fixed); setActiveId(fixed[0].id);
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
    const next = mut(active); writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x
    );
    writeLS(LS_LIST, list); setAssistants(list); setActive(next); setRev(r => r + 1);
  };

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
    writeLS(ak(id), a); const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  };
  const onRename = (id: string, name: string) => {
    const cur = readLS<Assistant>(ak(id)); if (cur) writeLS(ak(id), { ...cur, name, updatedAt: Date.now() });
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === id ? { ...x, name, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list); setAssistants(list); setRev(r => r + 1);
  };
  const onDelete = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list); localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id); if (!list.length) setActiveId('');
    setRev(r => r + 1);
  };

  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typingPreview, setTypingPreview] = useState<string | null>(null);
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);

  const handleGenerate = () => {
    const current = active?.config.model.systemPrompt || '';
    const { prompt, firstMessage } = mergeInput(genText, current || BASE_PROMPT);
    setTypingPreview(prompt); setPendingFirstMsg(firstMessage); setGenOpen(false); setGenText('');
  };
  const acceptGenerate = () => {
    if (!active) return;
    const nextFirst = typeof pendingFirstMsg === 'string' ? pendingFirstMsg : active.config.model.firstMessage;
    updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: typingPreview || a.config.model.systemPrompt, firstMessage: nextFirst } } }));
    setTypingPreview(null); setPendingFirstMsg(undefined);
  };

  /* transcript + mock call controls */
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const greet = 'Hello. How may I help you today?';

  const onTurn = (role: 'user' | 'assistant', text: string) => {
    const turn = { role, text, ts: Date.now() };
    setTranscript(t => [...t, turn]);
    if (!currentCallId) setCurrentCallId('local-demo');
  };
  const endWebCallSession = () => setCurrentCallId(null);

  if (!isClient) {
    return (
      <div ref={scopeRef} className={SCOPE}>
        <StyleBlock />
        <div className="px-6 py-10 opacity-70 text-sm">Loading…</div>
      </div>
    );
  }

  const railData: AssistantLite[] = assistants.map(a => ({ id: a.id, name: a.name, folder: a.folder, updatedAt: a.updatedAt }));

  return (
    <div ref={scopeRef} className={SCOPE}>
      <AssistantRail
        assistants={railData}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />

      {/* CONTENT LANE */}
      <div className="va-lane">
        {/* Top actions */}
        <div className="pb-3 flex items-center justify-between sticky" style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
          <div className="flex items-center gap-6">
            {!currentCallId ? (
              <button onClick={()=> onTurn('assistant', greet)} className="btn btn--green"><span>Start Web Call</span></button>
            ) : (
              <button onClick={endWebCallSession} className="btn btn--danger">
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            )}
            <button className="topbar-btn"><MessageSquare className="w-4 h-4 icon" /> Chat</button>
            <button className="topbar-btn" onClick={() => navigator.clipboard.writeText(BASE_PROMPT).catch(()=>{})}><Copy className="w-4 h-4 icon" /> Copy Prompt</button>
          </div>

          <div className="flex items-center gap-6">
            <button className="btn btn--green"><Rocket className="w-4 h-4" /><span>Publish</span></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-5 md:gap-5 mb-6" style={{ gridTemplateColumns:'repeat(2, minmax(260px,1fr))' }}>
          <div className="rounded-xl p-4" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-sm)' }}>
            <div className="text-[12.5px] opacity-80 mb-1.5">Cost</div>
            <div className="text-[19px]" style={{ fontWeight: 560 }}>~$0.1/min</div>
          </div>
          <div className="rounded-xl p-4" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-sm)' }}>
            <div className="text-[12.5px] opacity-80 mb-1.5">Latency</div>
            <div className="text-[19px]" style={{ fontWeight: 560 }}>~1050 ms</div>
          </div>
        </div>

        {/* Model */}
        <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
          <div className="grid gap-4 md:gap-5" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
            <div style={{ gridColumn:'span 3 / span 3', minWidth:0 }}>
              <Field label="Provider">
                <select className="va-select" defaultValue="openai">
                  <option value="openai">OpenAI</option>
                </select>
              </Field>
            </div>
            <div style={{ gridColumn:'span 3 / span 3', minWidth:0 }}>
              <Field label="Model">
                <select className="va-select" defaultValue="gpt-4o-mini">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </Field>
            </div>
            <div style={{ gridColumn:'span 3 / span 3', minWidth:0 }}>
              <Field label="First Message Mode">
                <select className="va-select" defaultValue="assistant_first">
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </Field>
            </div>
            <div style={{ gridColumn:'span 3 / span 3', minWidth:0 }}>
              <Field label="First Message">
                <input className="va-input" defaultValue="Hello. How may I help you today?" />
              </Field>
            </div>
          </div>

          <div className="mt-5" style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm" style={{ fontWeight: 560 }}>
                <Sparkles className="w-4 h-4 icon" /> System Prompt
              </div>
              <div className="flex items-center gap-2">
                <button className="topbar-btn" onClick={()=> setTypingPreview(null)}><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                <button onClick={() => setGenOpen(true)} className="btn btn--green"><Sparkles className="w-4 h-4" /> <span>Generate / Edit</span></button>
              </div>
            </div>

            {!typingPreview ? (
              <textarea
                rows={22}
                defaultValue={BASE_PROMPT}
                className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)',
                  boxShadow: 'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color: 'var(--text)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  minHeight: 480, fontWeight: 500
                }}
              />
            ) : (
              <div>
                <div className="w-full rounded-xl px-3 py-3 text-[14px] leading-6"
                     style={{
                       background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)',
                       boxShadow: 'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color: 'var(--text)',
                       whiteSpace: 'pre-wrap', minHeight: 480, maxHeight: 680, overflowY: 'auto', fontWeight: 500
                     }}>
                  {typingPreview}
                </div>
                <div className="flex items-center gap-2 justify-end mt-3">
                  <button onClick={()=> { setTypingPreview(null); setPendingFirstMsg(undefined); }} className="topbar-btn"><X className="w-4 h-4 icon" /> Decline</button>
                  <button onClick={acceptGenerate} className="btn btn--green"><Check className="w-4 h-4" /><span>Accept</span></button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Voice */}
        <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))' }}>
            <Field label="Provider">
              <select className="va-select" defaultValue="openai">
                <option value="openai">OpenAI</option>
                <option value="elevenlabs">ElevenLabs</option>
              </select>
            </Field>
            <Field label="Voice">
              <select className="va-select" defaultValue="alloy">
                <option value="alloy">Alloy (OpenAI)</option>
                <option value="ember">Ember (OpenAI)</option>
              </select>
            </Field>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <button onClick={() => { try { const u = new SpeechSynthesisUtterance('This is a quick preview of the selected voice.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} }} className="topbar-btn">
              <Volume2 className="w-4 h-4 icon" /> Test Voice
            </button>
            <button className="btn btn--green"><Save className="w-4 h-4" /> <span>Save Voice</span></button>
            <button onClick={() => alert('Hook “voiceagent:import-11labs” to your importer.')} className="topbar-btn">
              <UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs
            </button>
          </div>
        </Section>

        {/* Transcriber */}
        <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
          <div className="grid gap-5" style={{ gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}>
            <Field label="Provider">
              <select className="va-select" defaultValue="deepgram">
                <option value="deepgram">Deepgram</option>
              </select>
            </Field>
            <Field label="Model">
              <select className="va-select" defaultValue="nova-2">
                <option value="nova-2">Nova 2</option>
                <option value="nova-3">Nova 3</option>
              </select>
            </Field>
            <Field label="Language">
              <select className="va-select" defaultValue="en">
                <option value="en">English</option>
                <option value="multi">Multi</option>
              </select>
            </Field>

            <Field label="Confidence Threshold">
              <div className="flex items-center gap-3">
                <input type="range" min={0} max={1} step={0.01} defaultValue={0.4} className="w-full"/>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>0.40</span>
              </div>
            </Field>
            <Field label="Denoise">
              <select className="va-select" defaultValue="false">
                <option value="false">Off</option>
                <option value="true">On</option>
              </select>
            </Field>
            <Field label="Use Numerals">
              <select className="va-select" defaultValue="false">
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Transcript */}
        <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
          <div className="rounded-xl p-3" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
            {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {transcript.map((t, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="text-xs px-2 py-0.5 rounded-full" style={{
                    background: t.role === 'assistant' ? 'color-mix(in oklab, var(--primary) 22%, transparent)' : 'rgba(255,255,255,.06)',
                    border: '1px solid var(--va-border)'
                  }}>{t.role === 'assistant' ? 'AI' : 'You'}</div>
                  <div className="text-sm">{t.text}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Logs placeholder */}
        <Section title="Call Logs" icon={<ListTree className="w-4 h-4 icon" />}>
          <div className="text-sm opacity-60">No calls yet.</div>
        </Section>
      </div>

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ background: 'rgba(0,0,0,.45)' }}>
            <motion.div
              initial={{ y: 10, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0, scale: .985 }}
              className="w-full max-w-2xl rounded-xl"
              style={{ background: 'var(--va-card)', border: '1px solid var(--va-border)', boxShadow: 'var(--va-shadow-lg)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--va-border)', fontWeight: 560 }}>
                <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4 icon" /> Generate / Edit Prompt</div>
                <button onClick={() => setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4">
                <input value={genText} onChange={(e) => setGenText(e.target.value)}
                  placeholder={`Examples:\n• assistant\n• collect full name, phone, date\n• [Identity] AI Sales Agent for roofers\n• first message: Hey—quick question to get you booked…`}
                  className="va-input"/>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => setGenOpen(false)} className="topbar-btn">Cancel</button>
                  <button onClick={handleGenerate} className="btn btn--green"><span>Generate</span></button>
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
