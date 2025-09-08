// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
} from 'lucide-react';

/* =============================================================================
   TYPES + STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

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
  };
};

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;

const readLS = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; }
  catch { return null; }
};
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   PROMPT HELPERS
============================================================================= */
const BASE_PROMPT = `[Identity]
You are Riley, a friendly and efficient voice assistant for Wellness Partners, a multi-specialty health clinic. Your primary goal is to assist in scheduling, confirming, rescheduling, or canceling appointments while providing clear and useful information to create a seamless booking experience.

[Style]
- Maintain a warm and friendly tone throughout interactions.
- Be patient and helpful, especially with confused or elderly callers.
- Use clear, concise language with occasional conversational elements like "Let me check that for you".
- Speak at a measured pace; pronounce medical terms and provider names clearly.

[Response Guidelines]
- Keep responses concise and focused on the task.
- Confirm dates, times, and names explicitly to ensure accuracy.
- Ask one question at a time to avoid overwhelming the caller.
- Use phonetic spelling for verification when necessary.

[Task & Goals]
1) Greet the caller: "Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?"
2) Determine appointment type + gather details (service type, provider preference, patient status).
3) Collect patient info, offer times, confirm details.
4) Provide prep instructions and summarize.
5) Offer optional reminders and close politely.

[Error Handling / Fallback]
- If unclear: ask “Could you please repeat that?”
- If brief delay: “I’m experiencing a brief delay. Please bear with me for a moment.”
- If multiple requests: handle one step at a time.`.trim();

type CharTok = { ch: string; added: boolean };

function charDiffAdded(oldStr: string, newStr: string): CharTok[] {
  const o = [...oldStr];
  const n = [...newStr];

  const dp: number[][] = Array(o.length + 1)
    .fill(0)
    .map(() => Array(n.length + 1).fill(0));

  for (let i = o.length - 1; i >= 0; i--) {
    for (let j = n.length - 1; j >= 0; j--) { // ← fixed loop condition
      dp[i][j] =
        o[i] === n[j]
          ? 1 + dp[i + 1][j + 1]
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: CharTok[] = [];
  let i = 0, j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { out.push({ ch: n[j], added: false }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; }
    else { out.push({ ch: n[j], added: true }); j++; }
  }
  while (j < n.length) out.push({ ch: n[j++], added: true });
  return out;
}

function setSection(prompt: string, name: string, body: string) {
  const section = name.replace(/^\[|\]$/g, '');
  const re = new RegExp(String.raw`$begin:math:display$${section}$end:math:display$\s*([\s\S]*?)(?=\n\[|$)`, 'i');
  if (re.test(prompt)) return prompt.replace(re, `[${section}]\n${body.trim()}\n`);
  const nl = prompt.endsWith('\n') ? '' : '\n';
  return `${prompt}${nl}\n[${section}]\n${body.trim()}\n`;
}
function parseFirstMessage(raw: string): string | null {
  const m = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  return m ? m[1].trim() : null;
}
function mergeInput(genText: string, currentPrompt: string) {
  const raw = (genText || '').trim();
  const out = { prompt: currentPrompt || BASE_PROMPT, firstMessage: undefined as string | undefined };
  if (!raw) return out;

  const fm = parseFirstMessage(raw);
  if (fm) { out.firstMessage = fm; return out; }

  const sectionBlocks = [...raw.matchAll(/\[([^\]]+)\]\s*([\s\S]*?)(?=\n\[|$)/g)];
  if (sectionBlocks.length) {
    let next = out.prompt || BASE_PROMPT;
    sectionBlocks.forEach((m) => {
      const sec = m[1]; const body = m[2];
      next = setSection(next, `[${sec}]`, body);
    });
    out.prompt = next;
    return out;
  }

  const hasRef = /\[Refinements\]/i.test(out.prompt);
  const bullet = `- ${raw.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
  out.prompt = hasRef
    ? out.prompt.replace(/\[Refinements\]\s*([\s\S]*?)(?=\n\[|$)/i, (m, body) => `[Refinements]\n${(body || '').trim()}\n${bullet}\n`)
    : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* =============================================================================
   PAGE (rail is NOT fixed; it collapses and always hugs the main sidebar)
============================================================================= */
export default function VoiceAgentSection() {
  // Assistants state
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [rev, setRev] = useState(0);

  // Rail collapse (this drives width only; no fixed positioning)
  const [railCollapsed, setRailCollapsed] = useState(false);

  // Prompt generation overlay
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typing, setTyping] = useState<CharTok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [lastNew, setLastNew] = useState('');
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);
  const typingBoxRef = useRef<HTMLDivElement | null>(null);
  const typingTimer = useRef<number | null>(null);

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
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Thank you for calling Wellness Partners. This is Riley, your scheduling assistant. How may I help you today?', systemPrompt: BASE_PROMPT },
          voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      setAssistants(list); setActiveId(list[0].id);
    }
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
    await new Promise(r => setTimeout(r, 300));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello! How may I help you today?', systemPrompt: '' },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
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

  // typing diff animator
  const startTyping = (tokens: CharTok[]) => {
    setTyping(tokens);
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
    }, 12);
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

  // voice select options
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam',   label: 'Adam (ElevenLabs)'   },
    { value: 'bella',  label: 'Bella (ElevenLabs)'  },
  ];

  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  /* ============================== RENDER ============================== */
  if (!active) return null;

  // Tailwind column spans based on collapse state (no fixed positioning)
  const leftCols = railCollapsed ? 'lg:col-span-[72px]' : 'lg:col-span-3';
  const rightCols = railCollapsed ? 'lg:col-span-9' : 'lg:col-span-9'; // keep editor wide; grid gap handles space

  return (
    <div className="voice-studio">
      {/* top bar that matches your collections look */}
      <div className="section-bar">
        <span className="section-pill">Voice Studio</span>
        <span className="font-semibold">Assistants & Prompts</span>
        <span className="ml-auto text-sm text-[var(--text-muted)]">Riley builder</span>
      </div>

      <div className="section-body">
        <div className="grid grid-cols-12 gap-6">
          {/* ======= LEFT RAIL (NOT FIXED) ======= */}
          <aside
            className={`col-span-12 lg:col-span-3 flush-left builder-card inner-line ${railCollapsed ? 'overflow-hidden' : ''}`}
            style={{ borderRadius: 16 }}
          >
            <div className="flex items-center justify-between px-3 py-3 border-b" style={{ borderColor:'var(--border)' }}>
              <div className="flex items-center gap-2">
                <Bot className="w-4 h-4" />
                <span className="font-semibold">Assistants</span>
              </div>
              <div className="flex items-center gap-2">
                {!railCollapsed && (
                  <button onClick={addAssistant} className="btn btn-brand btn-round px-3 py-1.5">
                    {creating ? 'Creating…' : (<><Plus className="w-4 h-4" />Create</>)}
                  </button>
                )}
                <button
                  className="btn btn-ghost btn-round px-2 py-1.5"
                  title={railCollapsed ? 'Expand' : 'Collapse'}
                  onClick={() => setRailCollapsed(v => !v)}
                >
                  {railCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {!railCollapsed && (
              <div className="p-3">
                <div className="flex items-center gap-2 builder-input px-2.5 py-2 mb-3">
                  <Search className="w-4 h-4" />
                  <input
                    value={query}
                    onChange={(e)=> setQuery(e.target.value)}
                    placeholder="Search assistants"
                    className="w-full bg-transparent outline-none text-sm"
                  />
                </div>

                <div className="text-xs font-semibold flex items-center gap-2 mt-2 mb-1 muted">
                  <Folder className="w-3.5 h-3.5" /> Folders
                </div>
                <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-black/5 dark:hover:bg-white/5">
                  <FolderOpen className="w-4 h-4" /> All
                </button>

                <div className="mt-4 space-y-2">
                  {visible.map(a => {
                    const isActive = a.id === activeId;
                    const isEdit = editingId === a.id;
                    return (
                      <div
                        key={a.id}
                        className={`builder-card lift-hover px-3 py-3 ${isActive ? 'ring-brand' : ''}`}
                        style={{ borderRadius: 14 }}
                      >
                        <button className="w-full text-left flex items-center justify-between" onClick={()=> setActiveId(a.id)}>
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
                                  className="input w-full"
                                />
                              )}
                            </div>
                            <div className="text-[11px] mt-0.5 muted truncate">
                              {a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}
                            </div>
                          </div>
                          {isActive ? <Check className="w-4 h-4" /> : null}
                        </button>

                        <div className="mt-2 flex items-center gap-2">
                          {!isEdit ? (
                            <>
                              <button onClick={(e)=> { e.stopPropagation(); beginRename(a); }} className="btn btn-ghost text-xs"><Edit3 className="w-3.5 h-3.5" /> Rename</button>
                              <button onClick={(e)=> { e.stopPropagation(); removeAssistant(a.id); }} className="btn text-xs btn-ghost"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                            </>
                          ) : (
                            <>
                              <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn btn-brand text-xs"><Check className="w-3.5 h-3.5" /> Save</button>
                              <button onClick={(e)=> { e.stopPropagation(); setEditingId(null); }} className="btn btn-ghost text-xs">Cancel</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* ======= RIGHT EDITOR ======= */}
          <main className="col-span-12 lg:col-span-9 editor-gutter">
            <div className="grid grid-cols-12 gap-6">
              {/* Model */}
              <Section title="Model" icon={<FileText className="w-4 h-4" />}>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                      items={[{ value:'assistant_first', label:'Assistant first' }, { value:'user_first', label:'User first' }]}
                    />
                  </Field>
                  <Field label="First Message">
                    <input
                      value={active.config.model.firstMessage}
                      onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } }))}
                      className="input w-full"
                    />
                  </Field>
                </div>

                {/* System Prompt */}
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" /> System Prompt</div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                        className="btn btn-ghost"
                      ><RefreshCw className="w-4 h-4" /> Reset</button>
                      <button onClick={()=> setGenOpen(true)} className="btn btn-brand btn-round">
                        <Sparkles className="w-4 h-4" /> Generate / Edit
                      </button>
                      <button
                        onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
                        className="btn btn-ghost"
                      >
                        <Copy className="w-4 h-4" /> Copy
                      </button>
                    </div>
                  </div>

                  {!typing ? (
                    <textarea
                      rows={20}
                      value={active.config.model.systemPrompt || ''}
                      onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                      className="w-full input"
                      style={{ minHeight: 420, fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                    />
                  ) : (
                    <div>
                      <div
                        ref={typingBoxRef}
                        className="w-full input"
                        style={{ minHeight: 420, whiteSpace:'pre-wrap', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                      >
                        {(() => {
                          const slice = typing.slice(0, typedCount);
                          const out: JSX.Element[] = [];
                          let buf = '';
                          let added = slice.length ? slice[0].added : false;
                          slice.forEach((t, i) => {
                            if (t.added !== added) {
                              out.push(added
                                ? <ins key={`ins-${i}`} style={{ background:'rgba(0,255,194,.18)', padding:'1px 2px', borderRadius:4 }}>{buf}</ins>
                                : <span key={`nor-${i}`}>{buf}</span>);
                              buf = t.ch;
                              added = t.added;
                            } else {
                              buf += t.ch;
                            }
                          });
                          if (buf) out.push(added
                            ? <ins key="tail-ins" style={{ background:'rgba(0,255,194,.18)', padding:'1px 2px', borderRadius:4 }}>{buf}</ins>
                            : <span key="tail-nor">{buf}</span>);
                          if (typedCount < (typing?.length || 0)) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                          return out;
                        })()}
                      </div>

                      <div className="flex items-center gap-2 justify-end mt-3">
                        <button onClick={declineTyping} className="btn btn-ghost"><X className="w-4 h-4" /> Decline</button>
                        <button onClick={acceptTyping} className="btn btn-brand btn-round"><Check className="w-4 h-4" /> Accept</button>
                      </div>
                    </div>
                  )}
                </div>
              </Section>

              {/* Voice */}
              <Section title="Voice" icon={<Mic2 className="w-4 h-4" />}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Provider">
                    <Select
                      value={active.config.voice.provider}
                      onChange={(v)=>{
                        const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
                        updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
                      }}
                      items={[
                        { value:'openai', label:'OpenAI' },
                        { value:'elevenlabs', label:'ElevenLabs' },
                      ]}
                    />
                  </Field>
                  <Field label="Voice">
                    <Select
                      value={active.config.voice.voiceId}
                      onChange={(v)=>{
                        const list = active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices;
                        const found = list.find(x=>x.value===v);
                        updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId:v, voiceLabel: found?.label || v } } }));
                      }}
                      items={active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices}
                    />
                  </Field>
                </div>

                <div className="mt-3">
                  <button
                    onClick={()=> { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your importer.'); }}
                    className="btn btn-ghost btn-round"
                  ><UploadCloud className="w-4 h-4" /> Import from ElevenLabs</button>
                </div>
              </Section>

              {/* Transcriber */}
              <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
                <div className="grid gap-4 md:grid-cols-3">
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
                        className="w-full"
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
              <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4" />}>
                <div className="grid gap-4 md:grid-cols-2">
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
            </div>
          </main>
        </div>
      </div>

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4 backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="panel w-full max-w-2xl"
              style={{ borderRadius: 16 }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" /> Generate / Edit Prompt</div>
                <button onClick={()=> setGenOpen(false)} className="btn btn-ghost px-2 py-1.5"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4">
                <input
                  value={genText}
                  onChange={(e)=> setGenText(e.target.value)}
                  placeholder={`Paste or write edits. Supports [Sections] and "first message: ...".`}
                  className="input w-full"
                />

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn btn-ghost">Cancel</button>
                  <button onClick={handleGenerate} className="btn btn-brand btn-round">Generate</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
   Atoms
============================================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium">{label}</div>
      {children}
    </div>
  );
}

function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 builder-card inner-line" style={{ borderRadius: 16 }}>
      <button type="button" onClick={()=> setOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
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
   Minimal Select (portal-less, iPad friendly)
============================================================================= */
type Item = { value: string; label: string; icon?: React.ReactNode };
function Select({ value, items, onChange, placeholder, leftIcon }: {
  value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => {
      if (btn.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [open]);

  const filtered = items.filter(i => i.label.toLowerCase().includes(q.trim().toLowerCase()));
  const sel = items.find(i => i.value === value) || null;

  return (
    <div className="relative">
      <button
        ref={btn}
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-3 builder-input"
        style={{ borderRadius: 12 }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="muted">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute z-[50] mt-2 p-3 panel w-full"
            style={{ borderRadius: 12 }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 builder-input" style={{ borderRadius: 10 }}>
              <Search className="w-4 h-4" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm"/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1">
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left hover:bg-black/5 dark:hover:bg-white/5"
                >
                  {it.icon}{it.label}
                </button>
              ))}
              {filtered.length === 0 && <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
