// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, Check, ChevronDown, ChevronRight, Copy, Edit3, Folder, FolderOpen,
  Mic2, PanelLeft, Plus, RefreshCw, Search, Sparkles, Trash2, UploadCloud
} from 'lucide-react';

/* ========== Theme / constants (match your green + keep overlay glow) ========== */
const SCOPE = 'va-scope';
const ACCENT = '#14e4a3';
const ACCENT_HOVER = '#11c892';
const SIDEBAR_W = 320; // px
// expects --sidebar-w (left app rail) & --header-h from your layout; fallbacks here:
const railVar = 'var(--sidebar-w,260px)';
const headVar = 'var(--header-h,64px)';

/* ========== Types / storage helpers ========== */
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
const delLS = (k: string) => { try { localStorage.removeItem(k); } catch {} };

/* ========== Prompt base & helpers ========== */
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

function buildPromptWithRefinement(prev: string, refinement: string) {
  const trimmed = refinement.trim();
  if (!trimmed) return prev;
  const block = `\n\n[Refinements]\n- ${trimmed.replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim()}`;
  return prev + block;
}

/* ========== Tiny diff (line-level) for green/red highlights ========== */
type DiffChunk = { type: 'same'|'add'|'del'; text: string };
function lineDiff(oldStr: string, newStr: string): DiffChunk[] {
  const oldL = oldStr.split('\n');
  const newL = newStr.split('\n');
  const res: DiffChunk[] = [];

  // Very light, greedy pass: mark exact matches, then adds/dels
  let i = 0, j = 0;
  while (i < oldL.length || j < newL.length) {
    if (i < oldL.length && j < newL.length && oldL[i] === newL[j]) {
      res.push({ type: 'same', text: newL[j] }); i++; j++; continue;
    }
    if (j < newL.length && (i >= oldL.length || !oldL.slice(i).includes(newL[j]))) {
      res.push({ type: 'add', text: newL[j] }); j++; continue;
    }
    if (i < oldL.length && (j >= newL.length || !newL.slice(j).includes(oldL[i]))) {
      res.push({ type: 'del', text: oldL[i] }); i++; continue;
    }
    // fallback: treat as change (delete + add)
    if (i < oldL.length) { res.push({ type: 'del', text: oldL[i++] }); }
    if (j < newL.length) { res.push({ type: 'add', text: newL[j++] }); }
  }
  return res;
}

/* ========== Simple Select (uses native button + portal-ish menu) ========== */
type Item = { value: string; label: string; icon?: React.ReactNode };
function Select({ value, items, onChange, placeholder, leftIcon }:{
  value: string; items: Item[]; onChange: (v: string) => void; placeholder?: string; leftIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const btn = useRef<HTMLButtonElement|null>(null);
  const [rect, setRect] = useState<{top:number,left:number,width:number,up:boolean}|null>(null);
  useEffect(() => {
    if (!open) return;
    const r = btn.current?.getBoundingClientRect(); if (!r) return;
    const up = r.bottom + 320 > window.innerHeight;
    setRect({ top: up ? r.top : r.bottom, left: r.left, width: r.width, up });
  }, [open]);
  useEffect(() => {
    const on = (e: MouseEvent) => {
      if (!open) return;
      if (btn.current && !btn.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, [open]);

  const filtered = items.filter(i => i.label.toLowerCase().includes(q.toLowerCase()));
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
        {sel ? <span className="min-w-0 truncate flex items-center gap-2">{sel.icon}{sel.label}</span> : <span className="opacity-70">{placeholder || 'Select…'}</span>}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>

      <AnimatePresence>
        {open && rect && (
          <motion.div
            initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="fixed z-[9999] p-3 rounded-2xl"
            style={{
              top: rect.up ? rect.top - 8 : rect.top + 8,
              left: rect.left, width: rect.width, transform: rect.up ? 'translateY(-100%)' : 'none',
              background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)'
            }}
          >
            <div className="flex items-center gap-2 mb-3 px-2 py-2 rounded-xl"
                 style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
              <Search className="w-4 h-4 icon" />
              <input value={q} onChange={(e)=> setQ(e.target.value)} placeholder="Filter…" className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
            </div>
            <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
              {filtered.map(it => (
                <button
                  key={it.value}
                  onClick={() => { onChange(it.value); setOpen(false); }}
                  className="w-full text-left px-3 py-2 rounded-[12px]"
                  style={{ color:'var(--text)' }}
                  onMouseEnter={(e)=>{ (e.currentTarget as HTMLButtonElement).style.background='rgba(20,228,163,.10)'; (e.currentTarget as HTMLButtonElement).style.border='1px solid rgba(20,228,163,.35)'; }}
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

/* ========== Component ========== */
export default function VoiceAgentSection() {
  /* ---------- data ---------- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [query, setQuery] = useState('');

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

  const updateListMeta = (a: Assistant) => {
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === a.id ? { ...x, name: a.name, folder: a.folder, updatedAt: a.updatedAt } : x
    );
    writeLS(LS_LIST, list);
    setAssistants(list);
  };

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut({ ...active });
    next.updatedAt = Date.now();
    writeLS(ak(next.id), next);
    updateListMeta(next);
  };

  const addAssistant = () => {
    const id = `agent_${Math.random().toString(36).slice(2,8)}`;
    const base = active || (readLS<Assistant[]>(LS_LIST) || [])[0];
    const fresh: Assistant = base
      ? {
          id, name:'New Assistant', folder: undefined, updatedAt: Date.now(),
          config: {
            model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
            voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
            transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
            tools: { enableEndCall:true, dialKeypad:true }
          }
        }
      : {
          id, name:'New Assistant', updatedAt: Date.now(),
          config: {
            model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: BASE_PROMPT },
            voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
            transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
            tools: { enableEndCall:true, dialKeypad:true }
          }
        };
    writeLS(ak(id), fresh);
    const list = [...assistants, fresh]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  };

  const removeAssistant = (id: string) => {
    if (!confirm('Delete this assistant?')) return;
    const list = (readLS<Assistant[]>(LS_LIST) || []).filter(a => a.id !== id);
    writeLS(LS_LIST, list);
    delLS(ak(id));
    setAssistants(list);
    if (activeId === id) setActiveId(list[0]?.id || '');
  };

  /* ---------- generate / diff flow ---------- */
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [overlayText, setOverlayText] = useState('');
  const [staged, setStaged] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);

  const openGenerate = () => { setOverlayOpen(true); setOverlayText(''); };
  const submitGenerate = async () => {
    if (!active) return;
    setOverlayOpen(false);
    // build new prompt from overlay text
    const next = buildPromptWithRefinement(active.config.model.systemPrompt, overlayText);
    // simulate typing effect into a staging buffer
    setStaged(''); setTyping(true);
    let i = 0;
    const tick = () => {
      i = Math.min(next.length, i + Math.max(1, Math.floor(next.length / 120)));
      setStaged(next.slice(0, i));
      if (i < next.length) requestAnimationFrame(tick);
      else setTyping(false);
    };
    requestAnimationFrame(tick);
  };

  const acceptChanges = () => {
    if (!active || staged == null) return;
    updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: staged } } }));
    setStaged(null);
  };
  const discardChanges = () => { setStaged(null); setTyping(false); };

  /* ---------- voice items ---------- */
  const openaiVoices: Item[] = [{ value:'alloy', label:'Alloy (OpenAI)' }, { value:'ember', label:'Ember (OpenAI)' }];
  const elevenVoices: Item[] = [{ value:'rachel', label:'Rachel (ElevenLabs)' }, { value:'adam', label:'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }];

  if (!active) return null;
  const visible = assistants.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  /* ---------- diff view ---------- */
  const chunks: DiffChunk[] = staged != null ? lineDiff(active.config.model.systemPrompt, staged) : [];

  return (
    <div className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* SECONDARY SIDEBAR (fixed, below header, tight to left rail) */}
      <aside
        style={{
          position: 'fixed',
          top: `calc(${headVar})`,
          left: `calc(${railVar})`,
          width: SIDEBAR_W,
          height: `calc(100vh - ${headVar})`,
          borderRight: '1px solid var(--va-border)',
          background: 'var(--va-sidebar)',
          boxShadow: 'var(--va-shadow-side)',
          zIndex: 10,
          overflowY: 'auto'
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" /> Assistants
          </div>
          <button
            onClick={addAssistant}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs"
            style={{ background: ACCENT, color:'#00110b', boxShadow:'0 8px 22px rgba(20,228,163,.25)' }}
            onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background = ACCENT_HOVER}
            onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background = ACCENT}
          >
            <Plus className="w-3.5 h-3.5 icon--invert" /> Create
          </button>
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 rounded-xl px-2.5 py-2"
               style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
            <Search className="w-4 h-4 icon" />
            <input value={query} onChange={(e)=> setQuery(e.target.value)} placeholder="Search assistants"
                   className="w-full bg-transparent outline-none text-sm" style={{ color:'var(--text)' }}/>
          </div>

          <div className="mt-3 text-xs font-semibold flex items-center gap-2" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5 icon" /> Folders
          </div>
          <div className="mt-2">
            <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
              <FolderOpen className="w-4 h-4 icon" /> All
            </button>
          </div>

          <div className="mt-4 space-y-2" style={{ paddingBottom: 24 }}>
            {visible.map(a => (
              <div key={a.id} className="group">
                <button
                  onClick={()=> setActiveId(a.id)}
                  className="w-full text-left rounded-2xl p-3 flex items-center justify-between"
                  style={{
                    background: a.id===activeId ? 'color-mix(in oklab, var(--accent) 10%, transparent)' : 'var(--va-card)',
                    border: `1px solid ${a.id===activeId ? 'color-mix(in oklab, var(--accent) 35%, var(--va-border))' : 'var(--va-border)'}`,
                    boxShadow:'var(--va-shadow-sm)'
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate flex items-center gap-2">
                      <Bot className="w-4 h-4 icon" /><span className="truncate">{a.name}</span>
                    </div>
                    <div className="text-[11px] mt-0.5 opacity-70 truncate">{a.folder || 'Unfiled'} • {new Date(a.updatedAt).toLocaleDateString()}</div>
                  </div>
                  {a.id===activeId ? <Check className="w-4 h-4 icon" /> : null}
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN — pad left so it never sits under either sidebar, and under header */}
      <main
        style={{
          paddingLeft: `calc(${railVar} + ${SIDEBAR_W}px + 24px)`,
          paddingRight: '24px',
          paddingTop: `calc(${headVar} + 12px)`,
          paddingBottom: 32,
          minHeight: '100vh'
        }}
      >
        {/* top bar with rename + actions */}
        <div className="px-6 py-4 flex items-center justify-between rounded-2xl"
             style={{ border:'1px solid var(--va-border)', background:'var(--va-topbar)', boxShadow:'var(--va-shadow-sm)' }}>
          <div className="flex items-center gap-3">
            <Bot className="w-5 h-5 icon" />
            <input
              value={active.name}
              onChange={(e)=> updateActive(a => ({ ...a, name: e.target.value }))}
              onBlur={() => active && updateListMeta({ ...active, updatedAt: Date.now() })}
              className="text-[15px] font-semibold bg-transparent outline-none rounded-lg px-2 py-1"
              style={{ border:'1px solid var(--va-border)', background:'var(--va-chip)', color:'var(--text)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt).catch(()=>{})}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                    style={{ border:'1px solid var(--va-border)', background:'var(--va-card)', boxShadow:'var(--va-shadow-sm)' }}>
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> removeAssistant(active.id)}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-sm"
                    style={{ border:'1px solid var(--va-border)', background:'var(--va-card)', boxShadow:'var(--va-shadow-sm)' }}>
              <Trash2 className="w-4 h-4 icon" /> Delete
            </button>
          </div>
        </div>

        {/* MODEL CARD */}
        <div className="max-w-[1400px] mx-auto mt-6 grid grid-cols-12 gap-8">
          <Section title="Model" icon={<Edit3 className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessage: e.target.value } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
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
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ border:'1px solid var(--va-border)', background:'var(--va-card)' }}
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                  <button
                    onClick={openGenerate}
                    className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm"
                    style={{ background:ACCENT, color:'#00110b', boxShadow:'0 10px 24px rgba(20,228,163,.24)' }}
                    onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background=ACCENT_HOVER}
                    onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background=ACCENT}
                  >Generate / Edit</button>
                </div>
              </div>

              {/* Show normal textarea unless we’re staging a change */}
              {staged == null ? (
                <textarea
                  rows={18}
                  value={active.config.model.systemPrompt}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                  style={{
                    background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                    boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace'
                  }}
                />
              ) : (
                <div className="rounded-2xl p-3"
                     style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-shadow-sm)' }}>
                  <pre className="text-[13px] leading-6 whitespace-pre-wrap font-mono"
                       style={{ color:'var(--text)' }}>
                    {chunks.map((c, idx) => {
                      if (c.type === 'same') return <div key={idx}>{c.text}</div>;
                      if (c.type === 'add')  return <div key={idx} className="diff-add">{c.text}</div>;
                      return <div key={idx} className="diff-del">{c.text}</div>;
                    })}
                    {typing && <span className="opacity-60">▌</span>}
                  </pre>
                </div>
              )}
            </div>
          </Section>

          {/* VOICE (kept light; import hook fires a CustomEvent) */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={(v)=>{
                    const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
                    const first = list[0];
                    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as VoiceProvider, voiceId: first.value, voiceLabel: first.label } } }));
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
                onClick={()=> { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your ElevenLabs importer.'); }}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
                style={{ border:'1px solid var(--va-border)', background:'var(--va-card)', boxShadow:'var(--va-shadow-sm)' }}
              ><UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs</button>
            </div>
          </Section>
        </div>
      </main>

      {/* GENERATE OVERLAY you liked */}
      <AnimatePresence>
        {overlayOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-xl rounded-2xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Edit3 className="w-4 h-4 icon" /> Edit Prompt</div>
              </div>
              <div className="p-4">
                <input
                  value={overlayText}
                  onChange={(e)=> setOverlayText(e.target.value)}
                  placeholder="Describe how you'd like to edit the prompt (e.g., capture caller name, phone, appointment date)"
                  className="w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
                <div className="mt-3 flex items-center justify-end gap-2">
                  <button onClick={()=> setOverlayOpen(false)} className="px-3 py-2 rounded-lg text-sm"
                          style={{ border:'1px solid var(--va-border)', background:'var(--va-card)' }}>Cancel</button>
                  <button
                    onClick={submitGenerate}
                    className="px-3 py-2 rounded-lg text-sm"
                    style={{ background:ACCENT, color:'#00110b', boxShadow:'0 10px 24px rgba(20,228,163,.24)' }}
                    onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background = ACCENT_HOVER}
                    onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background = ACCENT}
                  >
                    Submit Edit
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ACCEPT / DISCARD BAR like your screenshot */}
      <AnimatePresence>
        {staged != null && (
          <motion.div
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 24, opacity: 0 }}
            className="fixed z-[998]"
            style={{
              left: `calc(${railVar} + ${SIDEBAR_W}px + 24px)`,
              bottom: 24
            }}
          >
            <div className="rounded-2xl p-3 flex items-center gap-3"
                 style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)', minWidth: 480 }}>
              <input
                disabled
                placeholder="Add follow-ups or refinements…"
                className="flex-1 rounded-xl px-3 py-2 text-sm"
                style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', color:'var(--text)', opacity:.7 }}
              />
              <button
                onClick={discardChanges}
                className="px-3 py-2 rounded-lg text-sm"
                style={{ border:'1px solid var(--va-border)', background:'var(--va-card)', color:'var(--text)' }}
              >
                ✕ Discard Changes
              </button>
              <button
                onClick={acceptChanges}
                className="px-3 py-2 rounded-lg text-sm font-semibold"
                style={{ background:ACCENT, color:'#00110b', boxShadow:'0 10px 24px rgba(20,228,163,.24)' }}
                onMouseEnter={(e)=> (e.currentTarget as HTMLButtonElement).style.background = ACCENT_HOVER}
                onMouseLeave={(e)=> (e.currentTarget as HTMLButtonElement).style.background = ACCENT}
              >
                Accept Changes ✓
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOKENS / COSMETICS */}
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

        .${SCOPE} .icon{ color: var(--accent); }
        .${SCOPE} .icon--invert{ color: #00110b; }

        /* diff colors */
        .${SCOPE} .diff-add{ background: rgba(20,228,163,.16); border-left: 3px solid rgba(20,228,163,.55); padding-left: 8px; }
        .${SCOPE} .diff-del{ background: rgba(255,70,70,.09); border-left: 3px solid rgba(255,70,70,.55); padding-left: 8px; text-decoration: line-through; opacity: .8; }

        /* sliders — thin green */
        .${SCOPE} input[type="range"]{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
        .${SCOPE} input[type="range"]::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
        .${SCOPE} input[type="range"]::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
      `}</style>
    </div>
  );
}

/* ========== Atoms ========== */
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
    <div className="col-span-12 rounded-2xl relative"
         style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
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
