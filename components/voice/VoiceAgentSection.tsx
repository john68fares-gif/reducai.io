// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Rocket
} from 'lucide-react';

/* =============================================================================
   TYPES + STORAGE
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type PhoneNum = { id: string; label?: string; e164: string };

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
    telephony?: { numbers: PhoneNum[] };
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
  return s
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .replace(/\b(Id|Url|Dob)\b/gi, m => m.toUpperCase());
}

function buildDefaultsFromHint(hint: string) {
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

/** Replace or add a named section like [Identity] ... */
function setSection(prompt: string, name: string, body: string) {
  const section = name.replace(/^\[|\]$/g, '');
  const re = new RegExp(String.raw`$begin:math:display$${section}$end:math:display$\s*([\s\S]*?)(?=\n\[|$)`, 'i');
  if (re.test(prompt)) {
    return prompt.replace(re, `[${section}]\n${body.trim()}\n`);
  }
  const nl = prompt.endsWith('\n') ? '' : '\n';
  return `${prompt}${nl}\n[${section}]\n${body.trim()}\n`;
}

/** Parse quick "first message:" directive */
function parseFirstMessage(raw: string): string | null {
  const m = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  return m ? m[1].trim() : null;
}

/** Merge free-text into prompt smartly: section-aware, "first message", collect, or refinements */
function mergeInput(genText: string, currentPrompt: string) {
  const raw = (genText || '').trim();
  const out = { prompt: currentPrompt || BASE_PROMPT, firstMessage: undefined as string | undefined };
  if (!raw) return out;

  // 1) first message
  const fm = parseFirstMessage(raw);
  if (fm) {
    out.firstMessage = fm;
    return out;
  }

  // 2) Explicit sections present → replace/add them
  const sectionBlocks = [...raw.matchAll(/\[(Identity|Style|System Behaviors|Task & Goals|Data to Collect|Safety|Handover|Refinements)\]\s*([\s\S]*?)(?=\n\[|$)/gi)];
  if (sectionBlocks.length) {
    let next = out.prompt;
    sectionBlocks.forEach((m) => {
      const sec = m[1];
      const body = m[2];
      next = setSection(next, `[${sec}]`, body);
    });
    out.prompt = next;
    return out;
  }

  // 3) Short hint or "collect ..." → rebuild defaults around it
  if (raw.split(/\s+/).length <= 3 || /(^|\s)collect(\s|:)/i.test(raw)) {
    out.prompt = buildDefaultsFromHint(raw);
    return out;
  }

  // 4) Otherwise append as a refinement bullet (create section if missing)
  const hasRef = /\[Refinements\]/i.test(out.prompt);
  const bullet = `- ${raw.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
  out.prompt = hasRef
    ? out.prompt.replace(/\[Refinements\]\s*([\s\S]*?)(?=\n\[|$)/i, (m, body) => `[Refinements]\n${(body || '').trim()}\n${bullet}\n`)
    : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* =============================================================================
   DIFF (character-level, for Generate overlay)
============================================================================= */
type CharTok = { ch: string; added: boolean };
function charDiffAdded(oldStr: string, newStr: string): CharTok[] {
  const o = [...oldStr];
  const n = [...newStr];
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) {
    for (let j = n.length - 1; j--) {
      dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
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

/* =============================================================================
   PAGE
   - Sidebar rail is NOT fixed.
   - It collapses/expands and always sits flush to your main sidebar
     using your CSS helpers: .voice-studio .flush-left / .editor-gutter
============================================================================= */
export default function VoiceAgentSection() {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  const [rev, setRev] = useState(0);

  // NEW: collapse state for the assistants rail
  const [railCollapsed, setRailCollapsed] = useState(false);

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
        const next = Math.min(c + 6, tokens.length);
        if (next >= tokens.length && typingTimer.current) {
          window.clearInterval(typingTimer.current);
          typingTimer.current = null;
        }
        return next;
      });
    }, 10);
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
    setGenOpen(false);
    setGenText('');
    setTyping(charDiffAdded(current, prompt));
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

  const addAssistant = async () => {
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

  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      const next: Assistant = {
        ...a,
        config: {
          ...a.config,
          telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label||'').trim() || undefined }] }
        }
      };
      return next;
    });
  };
  const removePhone = (id: string) => {
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return { ...a, config: { ...a.config, telephony: { numbers: nums.filter(n => n.id !== id) } } };
    });
  };

  const publish = () => {
    window.dispatchEvent(new CustomEvent('voiceagent:publish', { detail: { id: active?.id } }));
    if (active) updateActive(a => ({ ...a, published: true }));
    alert('Publish triggered (hook into your deploy flow).');
  };

  if (!active) return null;

  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  /* =============================== RENDER =============================== */
  return (
    <div className="voice-studio">
      {/* A single flex row so the assistants rail sits flush with your main app sidebar and moves with it */}
      <div className="flex gap-4">
        {/* ===== Assistants Rail (NOT fixed) ===== */}
        <aside
          className="flush-left builder-card inner-line"
          style={{
            width: railCollapsed ? 72 : 320,
            transition: 'width var(--dur) var(--ease)',
            minHeight: 'calc(100vh - var(--app-header-h, 64px))',
            overflow: 'hidden'
          }}
        >
          <div
            className="flex items-center justify-between px-3 py-3 border-b"
            style={{ borderColor: 'var(--border)' }}
          >
            {!railCollapsed ? (
              <div className="flex items-center gap-2">
                <span className="section-pill">Assistants</span>
              </div>
            ) : <div className="w-5" />}

            <div className="flex items-center gap-2">
              {!railCollapsed && (
                <button onClick={addAssistant} className="btn btn-brand btn-round">
                  <Plus className="w-4 h-4" /> Create
                </button>
              )}
              <button
                onClick={() => setRailCollapsed(v => !v)}
                className="btn btn-ghost btn-round"
                title={railCollapsed ? 'Expand' : 'Collapse'}
              >
                {railCollapsed ? <ChevronRightIcon className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {/* Search */}
            <div className="builder-card px-2.5 py-2 flex items-center gap-2">
              <Search className="w-4 h-4" />
              {!railCollapsed && (
                <input
                  value={query}
                  onChange={(e)=> setQuery(e.target.value)}
                  placeholder="Search assistants"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color:'var(--text)' }}
                />
              )}
            </div>

            {/* List */}
            <div className="space-y-2">
              {visible.map(a => {
                const isActive = a.id === activeId;
                const isEdit = editingId === a.id;
                return (
                  <div
                    key={a.id}
                    className="builder-card px-3 py-2 cursor-pointer"
                    onClick={()=> setActiveId(a.id)}
                    style={{
                      borderColor: isActive ? 'var(--brand-weak)' : 'var(--border)',
                      boxShadow: isActive ? 'var(--shadow-strong)' : 'var(--shadow-card)'
                    }}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Bot className="w-4 h-4" style={{ color: 'var(--brand)' }} />
                      {!railCollapsed && (
                        <div className="min-w-0 flex-1">
                          {!isEdit ? (
                            <div className="font-medium truncate">{a.name}</div>
                          ) : (
                            <input
                              autoFocus
                              value={tempName}
                              onChange={(e)=> setTempName(e.target.value)}
                              onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }}
                              className="input w-full"
                            />
                          )}
                          <div className="text-[11px] mt-0.5 muted truncate">
                            {(a.folder || 'Unfiled') + ' • ' + new Date(a.updatedAt).toLocaleDateString()}
                          </div>

                          <div className="mt-2 flex items-center gap-2">
                            {!isEdit ? (
                              <>
                                <button onClick={(e)=> { e.stopPropagation(); beginRename(a); }} className="btn btn-ghost btn-round text-xs"><Edit3 className="w-3.5 h-3.5" /> Rename</button>
                                <button onClick={(e)=> { e.stopPropagation(); setDeleting({ id:a.id, name:a.name }); }} className="btn btn-ghost btn-round text-xs"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                              </>
                            ) : (
                              <>
                                <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn btn-brand btn-round text-xs"><Check className="w-3.5 h-3.5" /> Save</button>
                                <button onClick={(e)=> { e.stopPropagation(); setEditingId(null); }} className="btn btn-ghost btn-round text-xs">Cancel</button>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && !railCollapsed && (
                <div className="muted text-sm px-1.5">No assistants yet.</div>
              )}
            </div>
          </div>
        </aside>

        {/* ===== Editor Column ===== */}
        <main className="editor-gutter flex-1">
          {/* Top action bar */}
          <div className="section-bar elevate">
            <span className="section-pill">Voice Agent</span>
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
                className="btn btn-ghost btn-round"
              >
                <Copy className="w-4 h-4" /> Copy Prompt
              </button>
              <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn-ghost btn-round">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
              <button onClick={publish} className="btn btn-brand btn-round">
                <Rocket className="w-4 h-4" /> {active.published ? 'Republish' : 'Publish'}
              </button>
            </div>
          </div>

          <div className="section-body grid grid-cols-12 gap-6">
            <Section title="Model" icon={<FileText className="w-4 h-4" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(260px, 1fr))' }}>
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
                    onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } })) }
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
                      className="btn btn-ghost btn-round"
                    ><RefreshCw className="w-4 h-4" /> Reset</button>
                    <button onClick={()=> setGenOpen(true)} className="btn btn-brand btn-round">
                      <Sparkles className="w-4 h-4" /> Generate / Edit
                    </button>
                  </div>
                </div>

                {!typing ? (
                  <textarea
                    rows={22}
                    value={active.config.model.systemPrompt || ''}
                    onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } })) }
                    className="w-full input input-elevated"
                    style={{ fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace' }}
                  />
                ) : (
                  <div>
                    <div
                      ref={typingBoxRef}
                      className="w-full input input-elevated"
                      style={{
                        whiteSpace:'pre-wrap',
                        minHeight: 320,
                        maxHeight: 560,
                        overflowY:'auto',
                        fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                      }}
                    >
                      {(() => {
                        const slice = typing.slice(0, typedCount);
                        const out: JSX.Element[] = [];
                        let buf = '';
                        let added = slice.length ? slice[0].added : false;
                        slice.forEach((t, i) => {
                          if (t.added !== added) {
                            out.push(added
                              ? <ins key={`ins-${i}`} style={{ background:'var(--brand-weak)', padding:'1px 2px', borderRadius:4 }}>{buf}</ins>
                              : <span key={`nor-${i}`}>{buf}</span>);
                            buf = t.ch;
                            added = t.added;
                          } else {
                            buf += t.ch;
                          }
                        });
                        if (buf) out.push(added
                          ? <ins key="tail-ins" style={{ background:'var(--brand-weak)', padding:'1px 2px', borderRadius:4 }}>{buf}</ins>
                          : <span key="tail-nor">{buf}</span>);
                        if (typedCount < (typing?.length || 0)) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                        return out;
                      })()}
                    </div>

                    <div className="flex items-center gap-2 justify-end mt-3">
                      <button onClick={declineTyping} className="btn btn-ghost btn-round"><X className="w-4 h-4" /> Decline</button>
                      <button onClick={acceptTyping} className="btn btn-brand btn-round"><Check className="w-4 h-4" /> Accept</button>
                    </div>
                  </div>
                )}
              </div>
            </Section>

            <Section title="Voice" icon={<Mic2 className="w-4 h-4" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(260px, 1fr))' }}>
                <Field label="Provider">
                  <Select
                    value={active.config.voice.provider}
                    onChange={(v)=>{
                      const list = v==='elevenlabs'
                        ? [{ value: 'rachel', label: 'Rachel (ElevenLabs)' }, { value: 'adam', label: 'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }]
                        : [{ value: 'alloy', label: 'Alloy (OpenAI)' }, { value: 'ember', label: 'Ember (OpenAI)' }];
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
                      const list = active.config.voice.provider==='elevenlabs'
                        ? [{ value: 'rachel', label: 'Rachel (ElevenLabs)' }, { value: 'adam', label: 'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }]
                        : [{ value: 'alloy', label: 'Alloy (OpenAI)' }, { value: 'ember', label: 'Ember (OpenAI)' }];
                      const found = list.find(x=>x.value===v);
                      updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId:v, voiceLabel: found?.label || v } } }));
                    }}
                    items={active.config.voice.provider==='elevenlabs'
                      ? [{ value: 'rachel', label: 'Rachel (ElevenLabs)' }, { value: 'adam', label: 'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }]
                      : [{ value: 'alloy', label: 'Alloy (OpenAI)' }, { value: 'ember', label: 'Ember (OpenAI)' }]}
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

            <Section title="Transcriber" icon={<BookOpen className="w-4 h-4" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(240px, 1fr))' }}>
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

            <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4" />}>
              <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(260px, 1fr))' }}>
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

            <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4" />}>
              <TelephonyEditor
                numbers={active.config.telephony?.numbers ?? []}
                onAdd={addPhone}
                onRemove={removePhone}
              />
            </Section>
          </div>
        </main>
      </div>

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4 backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div
              initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="panel elevate w-full max-w-2xl rounded-2xl"
            >
              <div className="px-4 py-3 flex items-center justify-between border-b" style={{ borderColor:'var(--border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4" /> Generate / Edit Prompt</div>
                <button onClick={()=> setGenOpen(false)} className="btn btn-ghost btn-round"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-4">
                <input
                  value={genText}
                  onChange={(e)=> setGenText(e.target.value)}
                  placeholder={`Examples:
• assistant
• collect full name, phone, date
• [Identity] AI Sales Agent for roofers
• first message: Hey—quick question to get you booked…`}
                  className="input input-elevated w-full"
                />

                <div className="mt-3 flex items-center justify-end gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn btn-ghost btn-round">Cancel</button>
                  <button onClick={handleGenerate} className="btn btn-brand btn-round">Generate</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete overlay */}
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
    </div>
  );
}

/* =============================================================================
   Delete Modal
============================================================================= */
function DeleteModal({ open, name, onCancel, onConfirm }:{
  open: boolean; name: string; onCancel: () => void; onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <motion.div className="fixed inset-0 z-[9998] flex items-center justify-center p-4 backdrop"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ y: 10, opacity: .9, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }}
        className="panel elevate w-full max-w-md rounded-2xl">
        <div className="px-5 py-4 flex items-center justify-between border-b" style={{ borderColor:'var(--border)' }}>
          <div className="text-sm font-semibold">Delete Assistant</div>
          <button onClick={onCancel} className="btn btn-ghost btn-round"><X className="w-4 h-4" /></button>
        </div>
        <div className="px-5 py-4 text-sm" style={{ color:'var(--text-muted)' }}>
          Are you sure you want to delete <span style={{ color:'var(--text)' }}>“{name}”</span>? This cannot be undone.
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn btn-ghost btn-round">Cancel</button>
          <button onClick={onConfirm} className="btn btn-ghost btn-round"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </motion.div>
    </motion.div>
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
    <div className="col-span-12 builder-card glow-spot inner-line">
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
   Telephony editor
============================================================================= */
function TelephonyEditor({ numbers, onAdd, onRemove }:{
  numbers: PhoneNum[];
  onAdd: (e164: string, label?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [e164, setE164] = useState('');
  const [label, setLabel] = useState('');

  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3, minmax(240px, 1fr))' }}>
        <div>
          <div className="mb-1.5 text-[13px] font-medium">Phone Number (E.164)</div>
          <input
            value={e164}
            onChange={(e)=> setE164(e.target.value)}
            placeholder="+1xxxxxxxxxx"
            className="input w-full"
          />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium">Label</div>
          <input
            value={label}
            onChange={(e)=> setLabel(e.target.value)}
            placeholder="Support line"
            className="input w-full"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={()=> { onAdd(e164, label); setE164(''); setLabel(''); }}
            className="btn btn-brand btn-round w-full justify-center"
          >
            <PhoneIcon className="w-4 h-4" /> Add Number
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {numbers.length === 0 && (
          <div className="text-sm" style={{ color:'var(--text-muted)' }}>No phone numbers added yet.</div>
        )}
        {numbers.map(n => (
          <div key={n.id} className="builder-card px-3 py-2 inner-line flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-medium truncate">{n.label || 'Untitled'}</div>
              <div className="text-xs" style={{ color:'var(--text-muted)' }}>{n.e164}</div>
            </div>
            <button onClick={()=> onRemove(n.id)} className="btn btn-ghost btn-round text-xs"><Trash2 className="w-4 h-4" /> Remove</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =============================================================================
   Minimal Select (portal-less; mobile/iPad friendly)
============================================================================= */
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
        className="w-full flex items-center gap-3 px-3 py-3 input"
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && rect && (
          <motion.div
            ref={portal}
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="panel elevate fixed z-[9999] p-3 rounded-xl"
            style={{
              top: rect.up ? rect.top - 8 : rect.top + 8,
              left: rect.left, width: rect.width, transform: rect.up ? 'translateY(-100%)' : 'none'
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 input">
              <Search className="w-4 h-4" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm"/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1">
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-[10px] text-left hover:ring-brand"
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
