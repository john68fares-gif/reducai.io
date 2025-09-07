// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X
} from 'lucide-react';

/* =============================================================================
   THEME / TOKENS
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

/* tiny OpenAI glyph */
const OpenAIIcon = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" aria-hidden>
    <path fill="currentColor" d="M214.7 111.7c1.9-7.6 1.5-15.7-1.2-23.3-7.6-21.3-28.6-35.2-51.4-33.6-12.1-19.9-36.5-29-59-21.2-22.1 7.6-36.7 28.6-35.4 51.5-19.9 12.1-29 36.5-21.2 59 7.6 22.1 28.6 36.7 51.5 35.4 12.1 19.9 36.5 29 59 21.2 22.1-7.6 36.7-28.6 35.4-51.5 8.7-5.5 15.5-13.9 18.9-24.1ZM156 193.2c-9.2 3.2-19.2 2.7-28-1.4l17.4-30.1c4.8-0.7 9.2-3.8 11.6-8.4c1.2-2.4 1.8-5 1.8-7.6v-40l27 15.6v28.6c0 17.1-10.7 32.8-29.8 43.3Zm-76.9-8.7c-9.2-5.2-16-13.2-19.6-23c-3.6-10-3-20.4 1.2-29.7l27 15.6v16.1c0 4.9 2.6 9.4 6.7 11.9l31 17.9c-15.1 2.8-31-0.1-46.3-8.8ZM62.8 92.5c5.2-9.2 13.2-16 23-19.6c10-3.6 20.4-3 29.7 1.2l-15.6 27h-16.1c-4.9 0-9.4 2.6-11.9 6.7l-17.9 31c-2.8-15.1 0.1-31 8.8-46.3Zm118.4 5.1l-31-17.9c-3.6-2.1-7.8-2.5-11.7-1.4c-3.8 1.1-7 3.6-9.1 7.1l-17.5 30.3l-27-15.6l16.6-28.7c9.7-16.7 31.1-22.4 48-12.7c0.6 0.3 1.1 0.7 1.7 1l30 17.3c-0.7 7.4-0.8 13.4 0 20.6Z"/>
  </svg>
);

/* =============================================================================
   STORAGE + TYPES
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type Assistant = {
  id: string;
  name: string;
  folder?: string;
  updatedAt: number;
  config: {
    model: {
      provider: Provider;
      model: ModelId;
      firstMessageMode: 'assistant_first' | 'user_first';
      firstMessage: string;
      systemPrompt: string;
    };
    voice: { provider: VoiceProvider; voiceId: string; voiceLabel: string };
    transcriber: { provider: 'deepgram'; model: 'nova-2' | 'nova-3'; language: 'en' | 'multi'; denoise: boolean; confidenceThreshold: number; numerals: boolean };
    tools: { enableEndCall: boolean; dialKeypad: boolean };
  };
};
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;

const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
   BASE PROMPT + builders
============================================================================= */
const BASE_PROMPT = `[Identity]
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.

[Style]
- Maintain a professional and approachable demeanor.
- Use clear and concise language, avoiding overly technical jargon.

[Response Guidelines]
- Keep responses short and focused on the user's immediate query.
- Verify user-provided information before proceeding with further steps.

[Task & Goals]
1. Greet the user warmly and inquire about how you can assist them today.
2. Listen carefully to the user's request or question.
3. Provide relevant and accurate information based on the user's needs.
<wait for user response>
4. If a query requires further action, guide the user through step-by-step instructions.

[Error Handling / Fallback]
- If a user's request is unclear or you encounter difficulty understanding, ask for clarification politely.
- If a task cannot be completed, inform the user empathetically and suggest alternative solutions or resources.`.trim();

/** Expand short instructions into a fully structured prompt. */
function buildStructuredPrompt(input: string): string {
  const raw = input.trim();

  // If it's super short (e.g., "assistant", "medical intake"), build a full scaffold.
  const isShort = raw.split(/\s+/).length <= 3;

  // Try to extract a "collect" list if user pasted fields.
  const collectMatch = raw.match(/collect(?:\s*[:\-])?\s*(.*)$/i);
  let fields: string[] = [];
  if (collectMatch) {
    fields = collectMatch[1]
      .split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
      .map(s => s.replace(/^[\-\*\d\.\s]+/, '')); // strip bullets
  } else {
    // also detect common nouns in short comma-lists
    if (/,/.test(raw)) {
      fields = raw.split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
    }
  }

  const title = isShort ? (raw || 'Assistant') : 'Assistant';

  const sections = [
`[Identity]
You are a helpful, fast, and accurate ${title.toLowerCase()} that completes tasks and collects information.`,

`[Style]
- Friendly, to-the-point, concise.
- Never over-explain; confirm critical details.`,

`[System Behaviors]
- Ask one targeted question at a time.
- Confirm understanding and summarize before finalizing.
- If the user seems unsure, suggest next best actions.`,

`[Task & Goals]
- Understand the caller's intent.
- Collect the required details accurately.
- Provide relevant guidance or next steps.`,

`[Data to Collect]
${fields.length ? fields.map(f => `- ${toTitle(f)}`).join('\n') : '- Full Name\n- Phone Number\n- Email (if provided)\n- Appointment Date/Time (if applicable)'}
`,

`[Safety]
- Do not provide medical, legal, or financial advice beyond high-level information.
- If the user asks for restricted actions, politely decline and suggest alternatives.`,

`[Handover]
- When all required info is gathered, summarize the details and provide a clear next step.
- If needed, hand off to a human agent with the collected summary.`,

`[First Message]
Hello.`
  ];

  return sections.join('\n\n').trim();
}

function toTitle(s: string) {
  return s.replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .replace(/\b(Id|Url|Dob)\b/gi, m => m.toUpperCase());
}

/* =============================================================================
   DIFF & TYPING
============================================================================= */

/** Tokenize by words and mark which are "added" vs old text using LCS. */
function tokenizeDiff(oldStr: string, newStr: string): { text: string; added: boolean }[] {
  const o = oldStr.split(/\s+/);
  const n = newStr.split(/\s+/);
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) {
    for (let j = n.length - 1; j >= 0; j--) {
      dp[i][j] = o[i] === n[j] ? 1 + dp[i + 1][j + 1] : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const tokens: { text: string; added: boolean }[] = [];
  let i = 0, j = 0;
  while (i < o.length && j < n.length) {
    if (o[i] === n[j]) { tokens.push({ text: n[j], added: false }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { i++; } // deletion (we don't render it)
    else { tokens.push({ text: n[j], added: true }); j++; }
  }
  while (j < n.length) tokens.push({ text: n[j++], added: true }); // remaining are additions
  return tokens;
}

/** Renders a "typing" effect with green highlights for tokens marked added */
function TypingHighlighter({ tokens, onDone }: { tokens: { text: string; added: boolean }[]; onDone: () => void }) {
  const [idx, setIdx] = useState(0);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const step = () => {
      setIdx(v => {
        const next = Math.min(v + Math.max(1, Math.floor(tokens.length / 180)), tokens.length);
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [tokens.length]);

  useEffect(() => {
    // Scroll to bottom as we type
    if (!boxRef.current) return;
    boxRef.current.scrollTop = boxRef.current.scrollHeight;
    if (idx >= tokens.length) onDone();
  }, [idx, tokens.length, onDone]);

  const toRender = tokens.slice(0, idx);
  return (
    <div
      ref={boxRef}
      className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none"
      style={{
        background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
        boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
        fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        whiteSpace:'pre-wrap',
        height: '420px',
        overflowY:'auto'
      }}
    >
      {toRender.map((t, i) => t.added
        ? <ins key={i} style={{ background:'rgba(16,185,129,.18)', padding:'1px 2px', borderRadius:4 }}>{t.text}</ins>
        : <span key={i}>{t.text}</span>
      ).reduce((acc, el, i) => (i ? acc.concat([' ', el]) : acc.concat([el])), [] as (JSX.Element|string)[]) }
    </div>
  );
}

/* =============================================================================
   Delete Modal (overlay)
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
          Are you sure you want to delete <span style={{ color:'var(--text)' }}>&ldquo;{name}&rdquo;</span>? This cannot be undone.
        </div>
        <div className="px-5 pb-5 flex gap-2 justify-end">
          <button onClick={onCancel} className="btn--ghost">Cancel</button>
          <button onClick={onConfirm} className="btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* =============================================================================
   PAGE
============================================================================= */
export default function VoiceAgentSection() {
  /* ---------- Assistants list ---------- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (!list.length) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        folder: 'Health',
        updatedAt: Date.now(),
        config: {
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
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

  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list); setAssistants(list);
  };

  const [creating, setCreating] = useState(false);
  const addAssistant = async () => {
    setCreating(true);
    await new Promise(r => setTimeout(r, 420));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(),
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: '' },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true }
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
  };

  /* ---------- Generate: ON-TEXTAREA LIVE TYPIST with green highlights ---------- */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typingTokens, setTypingTokens] = useState<{ text: string; added: boolean }[] | null>(null);
  const [isTypingLive, setIsTypingLive] = useState(false);

  function makeNewPromptFrom(input: string, current: string): string {
    const small = input.trim();
    if (!small) return current || BASE_PROMPT;

    // If very short ("assistant", "medical intake") → structured
    if (small.split(/\s+/).length <= 3) return buildStructuredPrompt(small);

    // If looks like a list of requirements → build structured and insert those under Data to Collect.
    if (/collect|fields|capture|gather/i.test(small)) {
      return buildStructuredPrompt(small);
    }

    // Otherwise, treat as an addendum to current
    const block = `\n\n[Refinements]\n- ${small.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
    return (current || BASE_PROMPT) + block;
  }

  const handleGenerate = () => {
    if (!active) return;
    const current = active.config.model.systemPrompt || '';
    const next = makeNewPromptFrom(genText, current);

    // Prepare tokens for typing highlighter (only added words marked)
    const tokens = tokenizeDiff(current, next);
    setTypingTokens(tokens);
    setIsTypingLive(true);
    setGenOpen(false);
  };

  const onTypingDone = () => {
    if (!active || !typingTokens) { setIsTypingLive(false); return; }
    // Reassemble plain text and set as the real prompt
    const plain = typingTokens.map(t => t.text).join(' ').replace(/\s+\n/g, '\n').trim();
    updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: plain } } }));
    setIsTypingLive(false);
    setTypingTokens(null);
  };

  /* ---------- Voices etc. ---------- */
  const openaiVoices: { value:string; label:string }[] = [{ value:'alloy', label:'Alloy (OpenAI)' }, { value:'ember', label:'Ember (OpenAI)' }];
  const elevenVoices: { value:string; label:string }[] = [{ value:'rachel', label:'Rachel (ElevenLabs)' }, { value:'adam', label:'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }];

  if (!active) return (
    <div className={SCOPE} style={{ color:'var(--text)' }}>
      <div className="px-6 py-10 opacity-70">Create your first assistant.</div>
      <StyleBlock />
    </div>
  );

  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase()));

  /* ---------- Inline rename helpers ---------- */
  const beginRename = (a: Assistant) => { setEditingId(a.id); setTempName(a.name); };
  const saveRename = (a: Assistant) => {
    const name = (tempName || '').trim() || 'Untitled';
    if (a.id === activeId) {
      updateActive(x => ({ ...x, name }));
    } else {
      const cur = readLS<Assistant>(ak(a.id));
      if (cur) writeLS(ak(a.id), { ...cur, name, updatedAt: Date.now() });
      const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === a.id ? { ...x, name, updatedAt: Date.now() } : x);
      writeLS(LS_LIST, list); setAssistants(list);
    }
    setEditingId(null);
  };

  return (
    <div className={`${SCOPE}`} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ================= ASSISTANT RAIL ================= */}
      <aside
        className="hidden lg:flex flex-col"
        style={{
          position:'fixed',
          left:'var(--app-sidebar-w, 248px)',
          top:'var(--app-header-h, 64px)',
          width:'var(--va-rail-w, 312px)',
          height:'calc(100vh - var(--app-header-h, 64px))',
          borderRight:'1px solid var(--va-border)',
          background:'var(--va-sidebar)',
          boxShadow:'var(--va-shadow-side)',
          zIndex: 10
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" /> Assistants
          </div>
          <button onClick={addAssistant} className="btn--green px-3 py-1.5 text-xs rounded-lg">
            {creating ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/50 border-t-transparent animate-spin" /> : <Plus className="w-3.5 h-3.5 text-white" />}
            <span className="text-white">{creating ? 'Creating…' : 'Create'}</span>
          </button>
        </div>

        <div className="p-3 min-h-0 flex-1 overflow-y-auto" style={{ scrollbarWidth:'thin' }}>
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
            style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
            <Search className="w-4 h-4 icon" />
            <input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search assistants"
                  className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
          </div>

          <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5 icon" /> Folders
          </div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
            <FolderOpen className="w-4 h-4 icon" /> All
          </button>

          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isActive = a.id === activeId;
              const isEdit = editingId === a.id;
              return (
                <div
                  key={a.id}
                  className="w-full rounded-xl p-3"
                  style={{
                    background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                    border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`,
                    boxShadow:'var(--va-shadow-sm)'
                  }}
                >
                  <button className="w-full text-left flex items-center justify-between"
                          onClick={()=> setActiveId(a.id)}>
                    <div className="min-w-0">
                      <div className="font-medium truncate flex items-center gap-2">
                        <Bot className="w-4 h-4 icon" />
                        {!isEdit ? (
                          <span className="truncate">{a.name}</span>
                        ) : (
                          <input
                            autoFocus
                            value={tempName}
                            onChange={(e)=> setTempName(e.target.value)}
                            onKeyDown={(e)=> { if (e.key==='Enter') saveRename(a); if (e.key==='Escape') setEditingId(null); }}
                            className="bg-transparent rounded-md px-2 py-1 outline-none"
                            style={{ border:'1px solid var(--va-input-border)', color:'var(--text)' }}
                          />
                        )}
                      </div>
                      <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                    </div>
                    {isActive ? <Check className="w-4 h-4 icon" /> : null}
                  </button>

                  <div className="mt-2 flex items-center gap-2">
                    {!isEdit ? (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); beginRename(a); }} className="btn--ghost text-xs px-2 py-1"><Edit3 className="w-3.5 h-3.5 icon" /> Rename</button>
                        <button onClick={(e)=> { e.stopPropagation(); setDeleting({ id:a.id, name:a.name }); }} className="btn--danger text-xs px-2 py-1"><Trash2 className="w-3.5 h-3.5" /> Delete</button>
                      </>
                    ) : (
                      <>
                        <button onClick={(e)=> { e.stopPropagation(); saveRename(a); }} className="btn--green text-xs px-2 py-1"><Check className="w-3.5 h-3.5 text-white" /><span className="text-white">Save</span></button>
                        <button onClick={(e)=> { e.stopPropagation(); setEditingId(null); }} className="btn--ghost text-xs px-2 py-1">Cancel</button>
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
      <div
        className="va-main"
        style={{
          marginLeft:'calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 312px))',
          paddingRight:'clamp(12px, 3vw, 24px)',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom:'56px'
        }}
      >
        {/* top action bar */}
        <div className="px-2 pb-3 flex items-center justify-end sticky"
             style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
                    className="btn--ghost">
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>

        {/* content body */}
        <div className="max-w-[1600px] mx-auto px-2 sm:px-4 grid grid-cols-12 gap-8">
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.model.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as Provider } } }))}
                  items={[{ value:'openai', label:'OpenAI', icon:<OpenAIIcon /> }]}
                  leftIcon={<OpenAIIcon />}
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
                  className="w-full rounded-xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
              </Field>
            </div>

            {/* System Prompt */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn--ghost"
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                  <button onClick={()=> setGenOpen(true)} className="btn--green">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              {/* ACTUAL PROMPT EDITOR
                  - While typingLive: show TypingHighlighter (the “re-type from zero” view)
                  - After done: fallback to the real textarea with new text */}
              {!isTypingLive ? (
                <textarea
                  rows={18}
                  value={active.config.model.systemPrompt || ''}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } })) }
                  className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none"
                  style={{
                    background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                    boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                  }}
                />
              ) : (
                <TypingHighlighter tokens={typingTokens || []} onDone={onTypingDone} />
              )}
            </div>
          </Section>

          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={(v)=>{
                    const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
                    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
                  }}
                  items={[
                    { value:'openai', label:'OpenAI', icon:<OpenAIIcon/> },
                    { value:'elevenlabs', label:'ElevenLabs' },
                  ]}
                  leftIcon={<OpenAIIcon />}
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
                onClick={()=> { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your ElevenLabs importer.'); }}
                className="btn--ghost"
              ><UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs</button>
            </div>
          </Section>

          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                    className="va-range w-full"
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

          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
      </div>

      {/* ---------------- Generate overlay ---------------- */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-xl rounded-xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Edit3 className="w-4 h-4 icon" /> Generate / Edit Prompt</div>
                <button onClick={()=> setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4">
                <input
                  value={genText}
                  onChange={(e)=> setGenText(e.target.value)}
                  placeholder={`e.g., assistant\nor: collect full name, phone, date\nor: Add a step to verify phone via OTP`}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn--ghost">Cancel</button>
                  <button onClick={handleGenerate} className="btn--green"><span className="text-white">Generate</span></button>
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

      <StyleBlock />
    </div>
  );
}

/* =============================================================================
   Atoms
============================================================================= */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}
function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div
      className="col-span-12 rounded-xl relative"
      style={{
        background:'var(--va-card)',
        border:'1px solid var(--va-border)',
        boxShadow:'var(--va-shadow)',
      }}
    >
      {/* subtle glow */}
      <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
           style={{ background:'radial-gradient(circle, color-mix(in oklab, var(--accent) 16%, transparent) 0%, transparent 70%)', filter:'blur(38px)' }} />
      <button type="button" onClick={()=> setOpen(v=>!v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
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
   Scoped CSS (only this page)
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
        --va-rail-w:312px;
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

      .${SCOPE} .btn--green{
        display:inline-flex; align-items:center; gap:.5rem;
        border-radius:12px; padding:.6rem .9rem;
        background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW};
        border:1px solid rgba(255,255,255,.08);
        transition:transform .04s ease, background .18s ease;
      }
      .${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
      .${SCOPE} .btn--green:active{ transform:translateY(1px); }

      .${SCOPE} .btn--ghost{
        display:inline-flex; align-items:center; gap:.5rem;
        border-radius:12px; padding:.55rem .85rem; font-size:14px;
        background:var(--va-card); color:var(--text);
        border:1px solid var(--va-border); box-shadow:var(--va-shadow-sm);
      }
      .${SCOPE} .btn--danger{
        display:inline-flex; align-items:center; gap:.5rem;
        border-radius:12px; padding:.55rem .85rem; font-size:14px;
        background:rgba(220,38,38,.12); color:#fca5a5;
        border:1px solid rgba(220,38,38,.35); box-shadow:0 10px 24px rgba(220,38,38,.15);
      }

      .${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
      .${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
      .${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }

      /* iPad rail width */
      @media (max-width: 1180px){
        .${SCOPE}{ --va-rail-w: 288px; }
      }
    `}</style>
  );
}

/* =============================================================================
   Minimal Select used above
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
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px]"
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
                  onMouseLeave={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='transparent'; (e.currentTarget as HTMLButtonElement).style.border='1px solid transparent'; }}
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
