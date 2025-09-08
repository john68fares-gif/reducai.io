// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon
} from 'lucide-react';

/* =============================================================================
   CONFIG / TOKENS
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

/* Typing speed (fast) */
const TICK_MS = 10;
const CHUNK_SIZE = 6;

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
   PROMPT HELPERS
============================================================================= */
const BASE_PROMPT = `[Identity]
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.

[Style]
- Maintain a professional and approachable demeanor.
- Use clear and concise language, avoiding overly technical jargon.

[System Behaviors]
- Summarize & confirm before finalizing.
- Offer next steps when appropriate.

[Task & Goals]
- Understand intent, collect required details, and provide guidance.

[Data to Collect]
- Full Name
- Phone Number
- Email (if provided)
- Appointment Date/Time (if applicable)

[Safety]
- No medical/legal/financial advice beyond high-level pointers.
- Decline restricted actions, suggest alternatives.

[Handover]
- When done, summarize details and hand off if needed.`.trim();

const SECTION_KEYS = [
  'Identity',
  'Style',
  'System Behaviors',
  'Task & Goals',
  'Data to Collect',
  'Safety',
  'Handover',
  'Refinements',
] as const;
type SectionKey = typeof SECTION_KEYS[number];

function toTitle(s: string) {
  return s
    .replace(/\s+/g, ' ')
    .split(' ')
    .map(w => (w.length ? w[0].toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .replace(/\b(Id|Url|Dob)\b/gi, m => m.toUpperCase());
}

function readSectionsFromPrompt(txt: string): Record<SectionKey, string> {
  const out = Object.fromEntries(SECTION_KEYS.map(k => [k, ''])) as Record<SectionKey, string>;
  if (!txt) return out;
  const rx = /\[([^\]]+)\]\s*([\s\S]*?)(?=\n\[[^\]]+\]|\s*$)/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(txt))) {
    const key = m[1].trim();
    const body = m[2].trim();
    const canon = SECTION_KEYS.find(k => k.toLowerCase() === key.toLowerCase());
    if (canon) out[canon] = body;
  }
  return out;
}

function sectionsToPrompt(s: Record<SectionKey, string>): string {
  return SECTION_KEYS
    .filter(k => k !== 'Refinements' || (s['Refinements'] && s['Refinements'].trim()))
    .map(k => `[${k}]\n${(s[k] || '').trim()}`)
    .join('\n\n')
    .trim();
}

function buildDefaultsFromHint(hint: string): Record<SectionKey, string> {
  const short = hint.trim().split(/\s+/).length <= 3 ? hint.trim() : 'Assistant';
  const collectMatch = hint.match(/collect(?:\s*[:\-])?\s*(.*)$/i);
  const fields = collectMatch
    ? collectMatch[1].split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
    : [];

  const collectList =
    fields.length
      ? fields.map(f => `- ${toTitle(f)}`).join('\n')
      : `- Full Name
- Phone Number
- Email (if provided)
- Appointment Date/Time (if applicable)`;

  return {
    'Identity': `You are a helpful, fast, and accurate ${short.toLowerCase()} that completes tasks and collects information.`,
    'Style': `- Friendly, concise, affirmative.\n- Ask one question at a time and confirm critical details.`,
    'System Behaviors': `- Summarize & confirm before finalizing.\n- Offer next steps when appropriate.`,
    'Task & Goals': `- Understand intent, collect required details, and provide guidance.`,
    'Data to Collect': collectList,
    'Safety': `- No medical/legal/financial advice beyond high-level pointers.\n- Decline restricted actions, suggest alternatives.`,
    'Handover': `- When done, summarize details and hand off if needed.`,
    'Refinements': ''
  };
}

/** Merge user free-text into sections. Also returns optional firstMessage override. */
function mergeInputIntoSections(input: string, basePrompt: string): {
  merged: Record<SectionKey, string>;
  firstMessage?: string;
} {
  const current = readSectionsFromPrompt(basePrompt || BASE_PROMPT);

  let firstMessage: string | undefined;

  const raw = input.trim();
  if (!raw) return { merged: current };

  const fm = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  if (fm) {
    firstMessage = fm[1].trim();
    return { merged: current, firstMessage };
  }

  let consumed = false;
  SECTION_KEYS.forEach(key => {
    const rx = new RegExp(`\$begin:math:display$${key}\\$end:math:display$\\s*([\\s\\S]*?)(?=\\n\$begin:math:display$[^\\$end:math:display$]+\\]|\\s*$)`, 'i');
    const m = raw.match(rx);
    if (m) {
      current[key] = m[1].trim();
      consumed = true;
    }
  });

  if (!consumed && (raw.split(/\s+/).length <= 3 || /collect|fields|capture|gather/i.test(raw))) {
    const d = buildDefaultsFromHint(raw);
    SECTION_KEYS.forEach(k => { if (d[k]) current[k] = d[k]; });
    consumed = true;
  }

  if (!consumed) {
    const line = `- ${raw.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
    current['Refinements'] = current['Refinements']
      ? `${current['Refinements']}\n${line}`
      : line;
  }

  return { merged: current, firstMessage };
}

/* =============================================================================
   DIFF (character-level)
============================================================================= */
type CharTok = { ch: string; added: boolean };
function charDiffAdded(oldStr: string, newStr: string): CharTok[] {
  const o = [...oldStr];
  const n = [...newStr];
  const dp: number[][] = Array(o.length + 1).fill(0).map(() => Array(n.length + 1).fill(0));
  for (let i = o.length - 1; i >= 0; i--) {
    for (let j = n.length - 1; j >= 0; j--) {
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
============================================================================= */
export default function VoiceAgentSection() {
  /* ---------- Sync with APP sidebar collapse ---------- */
  const scopeRef = useRef<HTMLDivElement | null>(null);

  // NEW: measure the *actual right edge* of your app sidebar and store it
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    // Try a few common selectors; feel free to replace with your exact one.
    const findAppSidebar = (): HTMLElement | null => {
      return (
        document.querySelector('[data-app-sidebar]') ||
        document.querySelector('[data-sidebar]') ||
        document.querySelector('aside[role="navigation"]') ||
        document.querySelector('aside')
      ) as HTMLElement | null;
    };

    let appSb = findAppSidebar();

    const apply = () => {
      // If it moved in the DOM, re-find
      if (!appSb || !document.body.contains(appSb)) appSb = findAppSidebar();
      const r = appSb?.getBoundingClientRect();
      const right = r ? Math.round(r.right) : 248; // fallback
      scope.style.setProperty('--app-sidebar-right', `${right}px`);
    };

    apply();

    const ro = appSb && 'ResizeObserver' in window ? new ResizeObserver(apply) : null;
    ro?.observe(appSb!);

    const mo = new MutationObserver(apply);
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-sb-collapsed', 'class'] });

    window.addEventListener('resize', apply);
    window.addEventListener('scroll', apply, { passive: true });

    return () => {
      ro?.disconnect();
      mo.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', apply);
    };
  }, []);

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

  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId, rev]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now() } : x);
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
    setRev(r => r + 1);
  };

  /* ---------- Rail collapse/expand (manual) ---------- */
  const [railCollapsed, setRailCollapsed] = useState(false);

  /* ---------- Generate (live type + accept/decline) ---------- */
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
    const { merged, firstMessage } = mergeInputIntoSections(genText, current || BASE_PROMPT);
    const nextPrompt = sectionsToPrompt(merged);

    setLastNew(nextPrompt);
    setPendingFirstMsg(firstMessage);
    startTyping(charDiffAdded(current, nextPrompt));
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

  /* ---------- Voices (static options) ---------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam',   label: 'Adam (ElevenLabs)'   },
    { value: 'bella',  label: 'Bella (ElevenLabs)'  },
  ];

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

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* ================= ASSISTANTS RAIL ================= */}
      <aside
        className="hidden lg:flex flex-col"
        data-collapsed={railCollapsed ? 'true' : 'false'}
        style={{
          position:'fixed',
          // CHANGED: snap to the actual right edge of the main sidebar
          left:'calc(var(--app-sidebar-right, 248px) - 1px)',
          top:'var(--app-header-h, 64px)',
          width: railCollapsed ? '72px' : 'var(--va-rail-w, 360px)',
          height:'calc(100vh - var(--app-header-h, 64px))',
          borderLeft:'none',
          borderRight:'1px solid var(--va-border)',
          background:'var(--va-sidebar)',
          boxShadow:'var(--va-shadow-side)',
          zIndex: 10
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" />
            {!railCollapsed && <span>Assistants</span>}
          </div>
          <div className="flex items-center gap-2">
            {!railCollapsed && (
              <button onClick={addAssistant} className="btn--green px-3 py-1.5 text-xs rounded-lg">
                {creating ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/50 border-t-transparent animate-spin" /> : <Plus className="w-3.5 h-3.5 text-white" />}
                <span className="text-white">{creating ? 'Creating…' : 'Create'}</span>
              </button>
            )}
            <button
              title={railCollapsed ? 'Expand assistants' : 'Collapse assistants'}
              className="btn--ghost px-2 py-1"
              onClick={() => setRailCollapsed(v => !v)}
            >
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

          {!railCollapsed && (
            <>
              <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
                <Folder className="w-3.5 h-3.5 icon" /> Folders
              </div>
              <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
                <FolderOpen className="w-4 h-4 icon" /> All
              </button>
            </>
          )}

          <div className="mt-4 space-y-2">
            {visible.map(a => {
              const isActive = a.id === activeId;
              const isEdit = editingId === a.id;
              if (railCollapsed) {
                return (
                  <button
                    key={a.id}
                    onClick={()=> setActiveId(a.id)}
                    className="w-full rounded-xl p-3 grid place-items-center"
                    style={{
                      background: isActive ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                      border: `1px solid ${isActive ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`,
                      boxShadow:'var(--va-shadow-sm)'
                    }}
                    title={a.name}
                  >
                    <Bot className="w-4 h-4 icon" />
                  </button>
                );
              }
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
                            className="bg-transparent rounded-md px-2 py-1 outline-none w-full"
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
          // CHANGED: margin starts exactly after the main sidebar
          marginLeft:`calc(var(--app-sidebar-right, 248px) + ${railCollapsed ? '72px' : 'var(--va-rail-w, 360px)'})`,
          paddingRight:'clamp(20px, 4vw, 40px)',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom:'88px'
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

        {/* content body — WIDER */}
        <!-- (unchanged content below) -->
