// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check, Copy, Sparkles, ChevronDown, ChevronRight,
  FileText, Mic2, BookOpen, UploadCloud,
  RefreshCw, X, Rocket, PhoneOff,
  MessageSquare, ListTree, AudioLines, Volume2, Save, Play
} from 'lucide-react';

/* =============================================================================
   TOKENS (match Improve page look; primary buttons = green)
============================================================================= */
const GREEN = '#10b981';      // emerald
const GREEN_HOVER = '#0ea371';

function LocalTokens() {
  return (
    <style>{`
      /* primary action button (only these are green) */
      .btn-primary{
        background:${GREEN};
        color:#fff;
        border:1px solid ${GREEN};
        border-radius:10px;
        padding:.5rem .8rem;
        display:inline-flex; align-items:center; gap:.5rem;
        transition:background .18s ease, transform .05s ease, box-shadow .18s ease, opacity .18s ease;
        box-shadow:0 10px 24px rgba(16,185,129,.22);
        height:40px; font-weight:600;
      }
      .btn-primary:hover{ background:${GREEN_HOVER}; box-shadow:0 12px 28px rgba(16,185,129,.32); }
      .btn-primary:active{ transform:translateY(1px); }
      .btn-primary:disabled{ opacity:.6; cursor:not-allowed; }

      /* neutral button like Improve */
      .btn{
        height:40px; padding:0 .85rem; border-radius:10px;
        display:inline-flex; align-items:center; gap:.5rem;
        border:1px solid var(--border); background:var(--card); color:var(--text);
        font-weight:560;
      }

      /* inputs/selects like Improve */
      .va-input{
        width:100%; min-width:0; height:40px; border-radius:10px;
        padding:0 .85rem; font-size:14.5px;
        background:var(--card); border:1px solid var(--border);
        color:var(--text); outline:none;
      }
      .va-select{
        width:100%; min-width:0; height:40px; border-radius:10px; outline:none;
        padding:0 2.1rem 0 .85rem; font-size:14.5px;
        background:var(--card); border:1px solid var(--border); color:var(--text);
        -webkit-appearance:none; appearance:none;
        background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='%23A8B3BE' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
        background-repeat:no-repeat; background-position:right .6rem center;
      }

      /* section surface like Improve */
      .va-section{ border:1px solid var(--border); background:var(--panel); border-radius:12px; }
      .va-card   { border:1px solid var(--border); background:var(--panel); border-radius:12px; }

      /* lighter, tighter text like your screenshots */
      .muted{ color: color-mix(in oklab, var(--text) 60%, transparent); }
    `}</style>
  );
}

/* =============================================================================
   TYPES
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3' | 'o3-mini';
type VoiceProvider = 'openai' | 'elevenlabs';
type PhoneNum = { id: string; label?: string; e164: string };
type TranscriptTurn = { role: 'assistant' | 'user'; text: string; ts: number };
type CallLog = {
  id: string; assistantId: string; assistantName: string; startedAt: number;
  endedAt?: number; endedReason?: string; type: 'Web'; assistantPhoneNumber?: string;
  transcript: TranscriptTurn[]; costUSD?: number;
};
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

/* =============================================================================
   STORAGE HELPERS (same logic as before)
============================================================================= */
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   BASE PROMPT (unchanged)
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
   SMALL UI PRIMS
============================================================================= */
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
    <div className="va-section relative overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3.5"
        style={{ borderBottom: open ? '1px solid var(--border)' : 'none', fontWeight: 560 }}
      >
        <span className="flex items-center gap-2 text-sm">
          <span className="inline-grid place-items-center w-5 h-5 rounded-md" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>{icon}</span>
          {title}
        </span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }}
            className="px-4 pb-4"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
   PROMPT MERGE (unchanged)
============================================================================= */
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

/* =============================================================================
   PAGE
============================================================================= */
export default function VoiceAgentSection() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  /* Data bootstrapping (same demo behavior, no rail) */
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
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10">
        <LocalTokens />
        <div className="opacity-70 text-sm">Loading…</div>
      </div>
    );
  }

  /* PAGE LAYOUT — EXACTLY like Improve: center width, outer px-4, section cards */
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6" style={{ color:'var(--text)' }}>
      <LocalTokens />

      {/* Top actions (Improve style) */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare size={18}/><span className="font-semibold">Voice Studio</span>
          <span className="opacity-60">/</span>

          {/* simple actions for list management */}
          <div className="flex items-center gap-2">
            <button onClick={onCreate} className="btn">New</button>
            <button onClick={() => active && onRename(active.id, prompt('Rename', active.name || '') || active.name)} className="btn">Rename</button>
            <button onClick={() => active && onDelete(active.id)} className="btn">Delete</button>
            {/* active selector */}
            <select className="va-select" value={activeId} onChange={e => setActiveId(e.target.value)}>
              {assistants.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!currentCallId ? (
            <button onClick={()=> onTurn('assistant', greet)} className="btn-primary"><Play className="w-4 h-4"/><span>Start Web Call</span></button>
          ) : (
            <button onClick={endWebCallSession} className="btn" style={{ color:'var(--text)' }}><PhoneOff className="w-4 h-4" /> End Call</button>
          )}
          <button className="btn" onClick={() => navigator.clipboard.writeText(BASE_PROMPT).catch(()=>{})}><Copy className="w-4 h-4" /> Copy Prompt</button>
          <button className="btn-primary"><Rocket className="w-4 h-4" /><span>Publish</span></button>
        </div>
      </div>

      {/* Stats row (Improve-like compact cards) */}
      <div className="grid gap-4 md:grid-cols-2 mb-6">
        <div className="va-card p-4">
          <div className="text-[12.5px] muted mb-1.5">Cost</div>
          <div className="text-[19px]" style={{ fontWeight: 560 }}>~$0.1/min</div>
        </div>
        <div className="va-card p-4">
          <div className="text-[12.5px] muted mb-1.5">Latency</div>
          <div className="text-[19px]" style={{ fontWeight: 560 }}>~1050 ms</div>
        </div>
      </div>

      {/* BODY grid like Improve: left column and right column */}
      <div className="grid lg:grid-cols-[420px,1fr] gap-6">

        {/* LEFT column */}
        <div className="space-y-6">
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4" />}>
            <div className="grid gap-4 md:gap-4" style={{ gridTemplateColumns: 'repeat(12, minmax(0, 1fr))' }}>
              <div style={{ gridColumn:'span 4 / span 4', minWidth:0 }}>
                <Field label="Provider">
                  <select className="va-select" value={active?.config.model.provider || 'openai'}
                          onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: e.target.value as Provider }}}))}>
                    <option value="openai">OpenAI</option>
                  </select>
                </Field>
              </div>
              <div style={{ gridColumn:'span 4 / span 4', minWidth:0 }}>
                <Field label="Model">
                  <select className="va-select" value={active?.config.model.model || 'gpt-4o-mini'}
                          onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, model: e.target.value as ModelId }}}))}>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o mini</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4.1-mini">GPT-4.1 mini</option>
                    <option value="o3">o3</option>
                    <option value="o3-mini">o3-mini</option>
                  </select>
                </Field>
              </div>
              <div style={{ gridColumn:'span 4 / span 4', minWidth:0 }}>
                <Field label="First Message Mode">
                  <select className="va-select" value={active?.config.model.firstMessageMode || 'assistant_first'}
                          onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessageMode: e.target.value as any }}}))}>
                    <option value="assistant_first">Assistant speaks first</option>
                    <option value="user_first">User speaks first</option>
                  </select>
                </Field>
              </div>
              <div style={{ gridColumn:'span 12 / span 12', minWidth:0 }}>
                <Field label="First Message">
                  <input className="va-input" defaultValue={active?.config.model.firstMessage || 'Hello. How may I help you today?'}
                         onBlur={e => active && updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value }}}))} />
                </Field>
              </div>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4" />}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Provider">
                <select className="va-select" value={active?.config.voice.provider || 'openai'}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, provider: e.target.value as VoiceProvider }}}))}>
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>
              <Field label="Voice">
                <select className="va-select" value={active?.config.voice.voiceId || 'alloy'}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId: e.target.value, voiceLabel: e.target.value }}}))}>
                  <option value="alloy">Alloy (OpenAI)</option>
                  <option value="ember">Ember (OpenAI)</option>
                </select>
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={() => { try { const u = new SpeechSynthesisUtterance('This is a quick preview of the selected voice.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} }} className="btn">
                <Volume2 className="w-4 h-4" /> Test Voice
              </button>
              <button className="btn-primary"><Save className="w-4 h-4" /> <span>Save Voice</span></button>
              <button onClick={() => alert('Hook “voiceagent:import-11labs” to your importer.')} className="btn">
                <UploadCloud className="w-4 h-4" /> Import from ElevenLabs
              </button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Provider">
                <select className="va-select" value={active?.config.transcriber.provider || 'deepgram'}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, provider: e.target.value as any }}}))}>
                  <option value="deepgram">Deepgram</option>
                </select>
              </Field>
              <Field label="Model">
                <select className="va-select" value={active?.config.transcriber.model || 'nova-2'}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, model: e.target.value as any }}}))}>
                  <option value="nova-2">Nova 2</option>
                  <option value="nova-3">Nova 3</option>
                </select>
              </Field>
              <Field label="Language">
                <select className="va-select" value={active?.config.transcriber.language || 'en'}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, language: e.target.value as any }}}))}>
                  <option value="en">English</option>
                  <option value="multi">Multi</option>
                </select>
              </Field>

              <Field label="Confidence Threshold">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={1} step={0.01}
                         defaultValue={active?.config.transcriber.confidenceThreshold ?? 0.4}
                         onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, confidenceThreshold: parseFloat(e.target.value) }}}))}
                         className="w-full"/>
                  <span className="text-xs muted">{(active?.config.transcriber.confidenceThreshold ?? 0.4).toFixed(2)}</span>
                </div>
              </Field>
              <Field label="Denoise">
                <select className="va-select" value={String(active?.config.transcriber.denoise ?? false)}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, denoise: e.target.value === 'true' }}}))}>
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </Field>
              <Field label="Use Numerals">
                <select className="va-select" value={String(active?.config.transcriber.numerals ?? false)}
                        onChange={e => active && updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, numerals: e.target.value === 'true' }}}))}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
            </div>
          </Section>
        </div>

        {/* RIGHT column */}
        <div className="space-y-6">

          {/* System Prompt */}
          <Section title="System Prompt" icon={<Sparkles className="w-4 h-4" />}>
            {!typingPreview ? (
              <textarea
                rows={18}
                defaultValue={active?.config.model.systemPrompt || BASE_PROMPT}
                className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background: 'var(--card)', border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  minHeight: 320, fontWeight: 500
                }}
                onBlur={(e)=> active && updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value }}}))}
              />
            ) : (
              <div>
                <div className="w-full rounded-xl px-3 py-3 text-[14px] leading-6"
                     style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--text)', whiteSpace: 'pre-wrap', minHeight: 320, maxHeight: 680, overflowY: 'auto', fontWeight: 500 }}>
                  {typingPreview}
                </div>
                <div className="flex items-center gap-2 justify-end mt-3">
                  <button onClick={()=> { setTypingPreview(null); setPendingFirstMsg(undefined); }} className="btn"><X className="w-4 h-4" /> Decline</button>
                  <button onClick={acceptGenerate} className="btn-primary"><Check className="w-4 h-4" /><span>Accept</span></button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <button className="btn" onClick={()=> setTypingPreview(null)}><RefreshCw className="w-4 h-4" /> Reset</button>
              <button onClick={() => setGenOpen(true)} className="btn-primary"><Sparkles className="w-4 h-4" /> <span>Generate / Edit</span></button>
            </div>
          </Section>

          {/* Transcript / Web test */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4" />}>
            <div className="rounded-xl p-3" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: t.role === 'assistant' ? 'color-mix(in oklab, #10b981 18%, transparent)' : 'rgba(255,255,255,.06)',
                      border: '1px solid var(--border)'
                    }}>{t.role === 'assistant' ? 'AI' : 'You'}</div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button onClick={()=> onTurn('assistant', 'Testing voice reply…')} className="btn-primary"><Play className="w-4 h-4"/> Start Test</button>
                <button onClick={()=> setTranscript([])} className="btn">Clear</button>
              </div>
            </div>
          </Section>

          {/* Logs */}
          <Section title="Call Logs" icon={<ListTree className="w-4 h-4" />}>
            <div className="text-sm opacity-60">No calls yet.</div>
          </Section>
        </div>
      </div>

      {/* Generate overlay (unchanged behavior) */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center p-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ background: 'rgba(0,0,0,.45)' }}>
            <motion.div
              initial={{ y: 10, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0, scale: .985 }}
              className="w-full max-w-2xl rounded-xl va-section"
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', fontWeight: 560 }}>
                <div className="flex items-center gap-2 text-sm"><Sparkles className="w-4 h-4" /> Generate / Edit Prompt</div>
                <button onClick={() => setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4">
                <input value={genText} onChange={(e) => setGenText(e.target.value)}
                  placeholder={`Examples:\n• assistant\n• collect full name, phone, date\n• [Identity] AI Sales Agent for roofers\n• first message: Hey—quick question to get you booked…`}
                  className="va-input"/>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => setGenOpen(false)} className="btn">Cancel</button>
                  <button onClick={handleGenerate} className="btn-primary"><span>Generate</span></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
