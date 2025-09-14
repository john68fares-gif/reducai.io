// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Copy, Sparkles, ChevronDown, ChevronRight,
  FileText, Mic2, BookOpen, SlidersHorizontal, UploadCloud,
  RefreshCw, X, Phone as PhoneIcon, Rocket, PhoneOff,
  MessageSquare, ListTree, AudioLines, Volume2, Save
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';

/* ──────────────────────────────────────────────────────────────────────────── */
/* THEME / SIZING                                                              */
/* ──────────────────────────────────────────────────────────────────────────── */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

const EDGE_GUTTER = 24;      // 24px left/right breathing room
const MAX_LANE_W = 1560;     // roomy clamp for big screens

/* ──────────────────────────────────────────────────────────────────────────── */
/* TYPES (trimmed)                                                             */
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
/* REUSABLE UI                                                                 */
/* ──────────────────────────────────────────────────────────────────────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="rounded-2xl relative transition-shadow"
      style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,.02), rgba(255,255,255,.01))',
        border: '1px solid var(--va-border)',
        boxShadow: '0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.40)',
        overflow: 'hidden'
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[20%] -left-[12%] w-[58%] h-[58%] rounded-full"
        style={{
          background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 16%, transparent) 0%, transparent 70%)',
          filter: 'blur(42px)', opacity: .75
        }}
      />
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ borderBottom: open ? '1px solid var(--va-border)' : 'none' }}
      >
        <span className="flex items-center gap-2 text-sm font-semibold tracking-wide">
          <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent)' }} />
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
/* PROMPT HELPERS                                                              */
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
/* GLOBAL STYLE                                                                */
/* ──────────────────────────────────────────────────────────────────────────── */
function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  --accent:${ACCENT};
  --bg:#0b0c10; --text:#eef2f5;
  --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:#0f1315; --va-topbar:#0e1214;
  --va-sidebar:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
  --va-chip:rgba(255,255,255,.03); --va-border:rgba(255,255,255,.10);
  --va-input-bg:rgba(255,255,255,.03); --va-input-border:rgba(255,255,255,.14);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  --va-menu-bg:#101314; --va-menu-border:rgba(255,255,255,.16);
  --va-shadow:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.4);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.66), 0 20px 48px rgba(0,0,0,.5);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
  --va-shadow-side:8px 0 28px rgba(0,0,0,.42);

  --va-rail-w:320px;        /* updated live by AssistantRail */
  --app-sidebar-w:248px;    /* updated if you have an app sidebar */
  --va-edge-gutter:${EDGE_GUTTER}px;

  overflow-x:hidden;        /* nuke horizontal jiggle globally */
}
:root:not([data-theme="dark"]) .${SCOPE}{
  --bg:#f7f9fb; --text:#101316;
  --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
  --va-card:#ffffff; --va-topbar:#ffffff;
  --va-sidebar:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
  --va-chip:#ffffff; --va-border:rgba(0,0,0,.10);
  --va-input-bg:#ffffff; --va-input-border:rgba(0,0,0,.12);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.85);
  --va-menu-bg:#ffffff; --va-menu-border:rgba(0,0,0,.10);
  --va-shadow:0 28px 70px rgba(0,0,0,.12), 0 12px 28px rgba(0,0,0,.08);
  --va-shadow-lg:0 42px 110px rgba(0,0,0,.16), 0 22px 54px rgba(0,0,0,.10);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.10);
}
.${SCOPE} .icon{ color: var(--accent); }

/* Buttons */
.${SCOPE} .topbar-btn, .${SCOPE} .btn{
  height:42px; padding:0 .95rem; border-radius:12px; display:inline-flex; align-items:center; gap:.5rem;
  border:1px solid var(--va-border); background:var(--va-card); color:var(--text);
}
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s, background .18s; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }

/* Inputs & selects */
.${SCOPE} .va-input{ width:100%; min-width:0; height:42px; border-radius:12px; padding:0 .9rem; font-size:15px; outline:none;
  background:var(--va-input-bg); border:1px solid var(--va-input-border); box-shadow:var(--va-input-shadow); color:var(--text); }
.${SCOPE} .va-input:focus{ border-color: color-mix(in oklab, var(--accent) 50%, var(--va-input-border));
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent), var(--va-input-shadow); }
.${SCOPE} .va-select{
  width:100%; min-width:0; height:42px; font-size:15px; border-radius:12px; outline:none;
  padding:0 2.2rem 0 .9rem;
  background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.02)), var(--va-input-bg);
  border:1px solid var(--va-input-border); color:var(--text);
  -webkit-appearance:none; appearance:none; box-shadow:var(--va-input-shadow);
  transition: border-color .15s, box-shadow .15s, background .15s;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23A8B3BE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
  background-repeat:no-repeat; background-position:right .7rem center;
}
.${SCOPE} .va-select:hover{ background:linear-gradient(180deg, rgba(255,255,255,.06), rgba(255,255,255,.03)), var(--va-input-bg); }
.${SCOPE} .va-select:focus{ border-color: color-mix(in oklab, var(--accent) 50%, var(--va-input-border));
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 18%, transparent), var(--va-input-shadow); }

/* Lane = content area that shifts with rail and expands */
.${SCOPE} .va-lane{
  position: relative;
  box-sizing: border-box;
  padding: 12px var(--va-edge-gutter) 96px var(--va-edge-gutter);
  margin-left: calc(var(--app-sidebar-w,0px) + var(--va-rail-w,0px) + var(--va-edge-gutter,24px));
  width: calc(100vw - var(--app-sidebar-w,0px) - var(--va-rail-w,0px) - (var(--va-edge-gutter,24px) * 2));
  max-width: min(${MAX_LANE_W}px, 100vw - var(--app-sidebar-w,0px) - var(--va-rail-w,0px) - (var(--va-edge-gutter,24px) * 2));
  overflow-x: hidden;
}

/* When rail collapses, allow a little more width */
@media (min-width: 1024px){
  html[data-va-rail-collapsed="true"] .${SCOPE} .va-lane{
    max-width: min(${MAX_LANE_W + 120}px, 100vw - var(--app-sidebar-w,0px) - var(--va-rail-w,0px) - (var(--va-edge-gutter,24px) * 2));
  }
}

/* container guards (in case Tailwind .container leaks in) */
.${SCOPE} .va-lane .container{ max-width:none !important; padding-left:0 !important; padding-right:0 !important; }
.${SCOPE} .va-lane [class*="max-w-"]{ max-width:none !important; }

/* compact tweak for 13–14" laptops */
@media (max-width: 1280px){
  .${SCOPE}{ --va-rail-w: 320px; }
}
`}</style>
  );
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
    if (!active) return;
    const current = active.config.model.systemPrompt || '';
    const { prompt, firstMessage } = mergeInput(genText, current || BASE_PROMPT);
    setTypingPreview(prompt); setPendingFirstMsg(firstMessage); setGenOpen(false); setGenText('');
  };
  const acceptGenerate = () => {
    if (!active) return;
    const nextFirst = typeof pendingFirstMsg === 'string' ? pendingFirstMsg : active.config.model.firstMessage;
    updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: typingPreview || a.config.model.systemPrompt, firstMessage: nextFirst } } }));
    setTypingPreview(null); setPendingFirstMsg(undefined);
  };

  /* transcript + mock call controls (minimal for demo) */
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
      <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <StyleBlock />
        <div className="px-6 py-10 opacity-70 text-sm">Loading…</div>
      </div>
    );
  }

  const railData: AssistantLite[] = assistants.map(a => ({ id: a.id, name: a.name, folder: a.folder, updatedAt: a.updatedAt }));

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Fixed assistants rail (collapsible) */}
      <AssistantRail
        assistants={railData}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={onCreate}
        onRename={onRename}
        onDelete={onDelete}
      />

      {/* CONTENT LANE — shifts left/right & widens when rail collapses */}
      <div className="va-lane">
        {/* Top actions */}
        <div className="pb-3 flex items-center justify-between sticky" style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
          <div className="flex items-center gap-8">
            {!currentCallId ? (
              <button onClick={()=> onTurn('assistant', greet)} className="btn btn--green">
                <span className="text-white">Start Web Call</span>
              </button>
            ) : (
              <button onClick={endWebCallSession} className="btn btn--danger">
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            )}
            <button className="topbar-btn"><MessageSquare className="w-4 h-4 icon" /> Chat</button>
            <button className="topbar-btn" onClick={() => navigator.clipboard.writeText(BASE_PROMPT).catch(()=>{})}><Copy className="w-4 h-4 icon" /> Copy Prompt</button>
          </div>

          <div className="flex items-center gap-8">
            <button className="btn btn--green"><Rocket className="w-4 h-4 text-white" /><span className="text-white">Publish</span></button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-6 md:gap-6 mb-6" style={{ gridTemplateColumns:'repeat(2, minmax(260px,1fr))' }}>
          <div className="rounded-xl p-4" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
            <div className="text-[13px] opacity-80 mb-1.5">Cost</div>
            <div className="text-[20px] font-semibold mb-3">~$0.1/min</div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.06)', border:'1px solid var(--va-border)' }}>
              <div className="h-full" style={{ width:'72%', background:'linear-gradient(90deg,#22d3ee,#fde047,#fb923c,#10b981)' }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
            <div className="text-[13px] opacity-80 mb-1.5">Latency</div>
            <div className="text-[20px] font-semibold mb-3">~1050 ms</div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background:'rgba(255,255,255,.06)', border:'1px solid var(--va-border)' }}>
              <div className="h-full" style={{ width:'78%', background:'linear-gradient(90deg,#22d3ee,#fde047,#fb923c,#10b981)' }} />
            </div>
          </div>
        </div>

        {/* Model */}
        <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
          <div className="grid gap-4 md:gap-6" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
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

          <div className="mt-6" style={{ minWidth: 0 }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
              <div className="flex items-center gap-2">
                <button className="topbar-btn" onClick={()=> setTypingPreview(null)}><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                <button onClick={() => setGenOpen(true)} className="btn btn--green"><Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span></button>
              </div>
            </div>

            {!typingPreview ? (
              <textarea
                rows={24}
                defaultValue={BASE_PROMPT}
                className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)',
                  boxShadow: 'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color: 'var(--text)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  minHeight: 520
                }}
              />
            ) : (
              <div>
                <div className="w-full rounded-xl px-3 py-3 text-[14px] leading-6"
                     style={{
                       background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)',
                       boxShadow: 'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color: 'var(--text)',
                       whiteSpace: 'pre-wrap', minHeight: 520, maxHeight: 680, overflowY: 'auto'
                     }}>
                  {typingPreview}
                </div>
                <div className="flex items-center gap-2 justify-end mt-3">
                  <button onClick={()=> { setTypingPreview(null); setPendingFirstMsg(undefined); }} className="topbar-btn"><X className="w-4 h-4 icon" /> Decline</button>
                  <button onClick={acceptGenerate} className="btn btn--green"><Check className="w-4 h-4 text-white" /><span className="text-white">Accept</span></button>
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Voice */}
        <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))' }}>
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
            <button className="btn btn--green"><Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span></button>
            <button onClick={() => alert('Hook “voiceagent:import-11labs” to your importer.')} className="topbar-btn">
              <UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs
            </button>
          </div>
        </Section>

        {/* Transcriber */}
        <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))' }}>
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

        {/* Tools */}
        <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
          <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(220px, 1fr))' }}>
            <Field label="Enable End Call Function">
              <select className="va-select" defaultValue="true">
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
            <Field label="Dial Keypad">
              <select className="va-select" defaultValue="true">
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
              </select>
            </Field>
          </div>
        </Section>

        {/* Transcript */}
        <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon />"}>
          <div className="rounded-xl p-3" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
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
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> Generate / Edit Prompt</div>
                <button onClick={() => setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4">
                <input value={genText} onChange={(e) => setGenText(e.target.value)}
                  placeholder={`Examples:\n• assistant\n• collect full name, phone, date\n• [Identity] AI Sales Agent for roofers\n• first message: Hey—quick question to get you booked…`}
                  className="va-input"/>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => setGenOpen(false)} className="topbar-btn">Cancel</button>
                  <button onClick={handleGenerate} className="btn btn--green"><span className="text-white">Generate</span></button>
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
