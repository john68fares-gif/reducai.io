// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Bot, Check, ChevronDown, ChevronRight, Copy, Edit3, FileText, Folder,
  FolderOpen, Mic2, PanelLeft, Plus, RefreshCw, Search, SlidersHorizontal,
  Sparkles, Trash2, UploadCloud, X
} from 'lucide-react';

/* ==============================  THEME  ==================================== */
const SCOPE = 'va-root';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea473';
const BTN_SHADOW = '0 14px 30px rgba(16,185,129,.22)';

/* OpenAI glyph */
const OpenAIIcon = () => (
  <svg width="16" height="16" viewBox="0 0 256 256" aria-hidden>
    <path fill="currentColor" d="M214.7 111.7c1.9-7.6 1.5-15.7-1.2-23.3-7.6-21.3-28.6-35.2-51.4-33.6-12.1-19.9-36.5-29-59-21.2-22.1 7.6-36.7 28.6-35.4 51.5-19.9 12.1-29 36.5-21.2 59 7.6 22.1 28.6 36.7 51.5 35.4 12.1 19.9 36.5 29 59 21.2 22.1-7.6 36.7-28.6 35.4-51.5 8.7-5.5 15.5-13.9 18.9-24.1ZM156 193.2c-9.2 3.2-19.2 2.7-28-1.4l17.4-30.1c4.8-0.7 9.2-3.8 11.6-8.4c1.2-2.4 1.8-5 1.8-7.6v-40l27 15.6v28.6c0 17.1-10.7 32.8-29.8 43.3Zm-76.9-8.7c-9.2-5.2-16-13.2-19.6-23c-3.6-10-3-20.4 1.2-29.7l27 15.6v16.1c0 4.9 2.6 9.4 6.7 11.9l31 17.9c-15.1 2.8-31-0.1-46.3-8.8ZM62.8 92.5c5.2-9.2 13.2-16 23-19.6c10-3.6 20.4-3 29.7 1.2l-15.6 27h-16.1c-4.9 0-9.4 2.6-11.9 6.7l-17.9 31c-2.8-15.1 0.1-31 8.8-46.3Zm118.4 5.1l-31-17.9c-3.6-2.1-7.8-2.5-11.7-1.4c-3.8 1.1-7 3.6-9.1 7.1l-17.5 30.3l-27-15.6l16.6-28.7c9.7-16.7 31.1-22.4 48-12.7c0.6 0.3 1.1 0.7 1.7 1l30 17.3c-0.7 7.4-0.8 13.4 0 20.6Z"/>
  </svg>
);

/* ============================  STORAGE / TYPES  ============================ */
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

/* ============================  BASE PROMPT  ================================ */
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

/* helper: apply a refinement */
const applyRefinement = (base: string, add: string) => {
  const clean = add.trim();
  return clean ? `${base}\n\n[Refinements]\n- ${clean.replace(/\n+/g,' ').replace(/\s{2,}/g,' ').trim()}` : base;
};

/* small diff: marks inserts/deletes for preview */
function diffText(oldStr: string, newStr: string) {
  const o = oldStr.split(/\s+/); const n = newStr.split(/\s+/);
  const dp: number[][] = Array(o.length + 1).fill(0).map(()=>Array(n.length + 1).fill(0));
  for (let i=o.length-1;i>=0;i--) for (let j=n.length-1;j>=0;j--) dp[i][j] = o[i]===n[j] ? 1+dp[i+1][j+1] : Math.max(dp[i+1][j], dp[i][j+1]);
  const out:string[] = []; let i=0, j=0;
  while (i<o.length && j<n.length) {
    if (o[i]===n[j]) { out.push(o[i++]); j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) out.push(`<del>${o[i++]}</del>`);
    else out.push(`<ins>${n[j++]}</ins>`);
  }
  while (i<o.length) out.push(`<del>${o[i++]}</del>`);
  while (j<n.length) out.push(`<ins>${n[j++]}</ins>`);
  return out.join(' ');
}

/* ==============================  PAGE  ===================================== */
export default function VoiceAgentSection() {
  /* assistants */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const active = useMemo(() => activeId ? readLS<Assistant>(ak(activeId)) : null, [activeId]);

  /* rail search */
  const [query, setQuery] = useState('');

  /* create + delete modals */
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* prompt generate overlay */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [pending, setPending] = useState<{ preview: string; html: string } | null>(null);

  /* init from LS or seed */
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
      writeLS(ak(seed.id), seed);
      writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      setAssistants(list); setActiveId(list[0].id);
    }
  }, []);

  /* helpers */
  const updateActive = (mut: (a: Assistant)=>Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id===next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list);
    setAssistants(list);
  };

  const visible = useMemo(
    () => assistants.filter(a => a.name.toLowerCase().includes(query.trim().toLowerCase())),
    [assistants, query]
  );

  /* create flow (with loading) */
  const createAssistant = async () => {
    setCreating(true);
    await new Promise(r => setTimeout(r, 550)); // tasteful loading
    const id = `ag_${Math.random().toString(36).slice(2,8)}`;
    const blank: Assistant = {
      id, name: 'New Assistant', updatedAt: Date.now(),
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'', systemPrompt: '' },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true }
      }
    };
    writeLS(ak(id), blank);
    const list = [...assistants, blank];
    writeLS(LS_LIST, list);
    setAssistants(list);
    setActiveId(id);
    setCreating(false);
  };

  /* delete (overlay) */
  const confirmDelete = () => {
    if (!deleteId) return;
    const list = assistants.filter(a => a.id !== deleteId);
    writeLS(LS_LIST, list);
    localStorage.removeItem(ak(deleteId));
    setAssistants(list);
    if (activeId === deleteId) setActiveId(list[0]?.id || '');
    setDeleteId(null);
  };

  /* generate / edit: we keep overlay + diff; “works” without backend */
  const openGenerate = () => { setGenOpen(true); setGenText(''); };
  const submitGenerate = async () => {
    if (!active) return;
    const preview = applyRefinement(
      active.config.model.systemPrompt || '',
      genText || 'Tighten the tone, keep answers brief and ask one clarifying question before giving steps.'
    );
    setPending({ preview, html: diffText(active.config.model.systemPrompt || '', preview) });
    setGenOpen(false);
  };
  const acceptChanges = () => {
    if (!active || !pending) return;
    updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: pending.preview }}}));
    setPending(null);
  };

  /* voices */
  type Item = { value: string; label: string; icon?: React.ReactNode };
  const openaiVoices: Item[] = [{ value:'alloy', label:'Alloy (OpenAI)' }, { value:'ember', label:'Ember (OpenAI)' }];
  const elevenVoices: Item[] = [{ value:'rachel', label:'Rachel (ElevenLabs)' }, { value:'adam', label:'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }];

  if (!active) {
    return (
      <div className={SCOPE}><RailStyles /><div className="px-6 py-10 opacity-70">Create your first assistant.</div></div>
    );
  }

  return (
    <div className={SCOPE}>
      <RailStyles />

      {/* ===================== FIXED ASSISTANT RAIL ===================== */}
      <aside
        aria-label="Assistant rail"
        className="va-rail"
        style={{
          position:'fixed',
          top:'var(--app-header-h, 64px)',
          left:'var(--app-sidebar-w, 248px)',
          width:'var(--va-rail-w, 312px)',
          height:'calc(100vh - var(--app-header-h, 64px))',
          background:'var(--va-rail-bg)',
          borderRight:'1px solid var(--va-border)',
          boxShadow:'var(--va-rail-shadow)',
          zIndex:6,
          display:'flex',
          flexDirection:'column'
        }}
      >
        <div className="px-3 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PanelLeft className="w-4 h-4 icon" /> Assistants
          </div>
          <button onClick={createAssistant} className="btn--green px-3 py-1.5 text-xs rounded-lg">
            {creating ? <span className="w-3.5 h-3.5 rounded-full border-2 border-white/60 border-t-transparent animate-spin" /> : <Plus className="w-3.5 h-3.5 text-white" />}
            <span className="text-white">{creating ? 'Creating…' : 'Create'}</span>
          </button>
        </div>

        {/* rail body never scrolls; only this list region does */}
        <div className="p-3 flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 rounded-lg px-2.5 py-2 mb-2"
               style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
            <Search className="w-4 h-4 icon" />
            <input
              value={query}
              onChange={(e)=> setQuery(e.target.value)}
              placeholder="Search assistants"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color:'var(--text)' }}
            />
          </div>

          <div className="text-xs font-semibold flex items-center gap-2 mt-3 mb-1" style={{ color:'var(--text-muted)' }}>
            <Folder className="w-3.5 h-3.5 icon" /> Folders
          </div>
          <button className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-white/5">
            <FolderOpen className="w-4 h-4 icon" /> All
          </button>

          <div className="mt-3 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
            {visible.map(a => (
              <button
                key={a.id}
                onClick={()=> setActiveId(a.id)}
                className="w-full text-left rounded-xl p-3 flex items-center justify-between mb-2"
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
            ))}
          </div>
        </div>
      </aside>

      {/*  =====================  MAIN CONTENT  =====================  */}
      <div
        className="va-main"
        style={{
          paddingLeft:'calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 312px))',
          paddingRight:'24px',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom:'48px'
        }}
      >
        {/* top actions bar */}
        <div className="sticky top-[var(--app-header-h,64px)] z-[5] bg-[var(--va-topbar)] border-b border-[var(--va-border)] flex items-center justify-between px-4 py-3 rounded-xl mb-6">
          <div className="flex items-center gap-3 min-w-0">
            <Bot className="w-5 h-5 icon" />
            <input
              value={active.name}
              onChange={(e)=> updateActive(a => ({ ...a, name: e.target.value }))}
              className="text-[15px] font-semibold bg-transparent outline-none rounded-lg px-2 py-1 min-w-[140px] max-w-[420px]"
              style={{ border:'1px solid var(--va-border)', background:'var(--va-chip)', color:'var(--text)' }}
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
              className="btn--ghost"
            >
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> setDeleteId(active.id)} className="btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
          </div>
        </div>

        {/* sections */}
        <div className="max-w-[1600px] mx-auto grid grid-cols-12 gap-8">
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              <Field label="Provider">
                <Select
                  value={active.config.model.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as Provider } } }))}
                  items={[{ value:'openai', label:'OpenAI', icon:<OpenAIIcon/> }]}
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
                  className="w-full rounded-xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
              </Field>
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn--ghost"
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                  <button onClick={openGenerate} className="btn--green">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={18}
                value={active.config.model.systemPrompt}
                onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                className="w-full rounded-xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                  boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                  fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                }}
              />
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
                onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:import-elevenlabs'))}
                className="btn--ghost"
              ><UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs</button>
            </div>
          </Section>

          <Section title="Transcriber" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
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
        </div>
      </div>

      {/* ====== Generate overlay ====== */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-xl rounded-2xl" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
              <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Edit3 className="w-4 h-4 icon" /> Edit Prompt</div>
                <button className="p-2 rounded-lg hover:opacity-70" onClick={()=> setGenOpen(false)}><X className="w-4 h-4" /></button>
              </div>
              <div className="p-5">
                <input
                  value={genText}
                  onChange={(e)=> setGenText(e.target.value)}
                  placeholder="Describe how you'd like to edit the prompt…"
                  className="w-full rounded-[14px] px-3 py-3 text-sm outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
                <div className="mt-4 flex items-center justify-end gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn--ghost">Cancel</button>
                  <button onClick={submitGenerate} className="btn--green"><span className="text-white">Submit Edit</span></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== Accept / Discard tray ====== */}
      <AnimatePresence>
        {pending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
            className="fixed right-6 bottom-6 z-[998] rounded-2xl p-4 w-[min(680px,calc(100vw-24px))]"
            style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}
          >
            <div className="text-sm font-semibold mb-2" style={{ color:'var(--text)' }}>Proposed Changes</div>
            <div className="rounded-[12px] p-3 mb-3 text-[13px] leading-6 overflow-y-auto max-h-[280px]"
                 style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                 dangerouslySetInnerHTML={{ __html: pending.html }} />
            <div className="flex gap-2">
              <button onClick={()=> setPending(null)} className="btn--ghost">✕ Discard Changes</button>
              <button onClick={acceptChanges} className="btn--green"><span className="text-white">Accept Changes ✓</span></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====== Delete modal ====== */}
      <AnimatePresence>
        {deleteId && (
          <motion.div className="fixed inset-0 z-[1000] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.55)' }}>
            <motion.div initial={{ y:12, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ y:10, opacity:0 }}
              className="w-full max-w-md rounded-2xl overflow-hidden"
              style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}>
              <div className="px-5 py-4 flex items-center gap-3" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="w-10 h-10 rounded-xl grid place-items-center" style={{ background:'rgba(220,38,38,.12)' }}>
                  <Trash2 className="w-5 h-5" style={{ color:'#fca5a5' }} />
                </div>
                <div className="text-lg font-semibold">Delete assistant?</div>
              </div>
              <div className="px-5 py-4 text-sm" style={{ color:'var(--text-muted)' }}>
                This action removes the assistant and its configuration from this browser.
              </div>
              <div className="px-5 pb-5 flex gap-2 justify-end">
                <button className="btn--ghost" onClick={()=> setDeleteId(null)}>Cancel</button>
                <button className="btn--danger" onClick={confirmDelete}><Trash2 className="w-4 h-4" /> Delete</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================  ATOMS  ===================================== */
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
      style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}
    >
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

/* basic select (portal-less, consistent) */
type Opt = { value: string; label: string; icon?: React.ReactNode };
function Select({ value, items, onChange }: { value: string; items: Opt[]; onChange: (v: string)=>void }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const on = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    window.addEventListener('mousedown', on);
    return () => window.removeEventListener('mousedown', on);
  }, []);

  const sel = items.find(i => i.value === value) || null;

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        onClick={()=> setOpen(v=>!v)}
        className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-[15px]"
        style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
      >
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : 'Select…'}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:4 }}
            className="absolute z-10 mt-2 w-full rounded-xl p-2"
            style={{ background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)' }}
          >
            {items.map(it => (
              <button
                key={it.value}
                onClick={()=> { onChange(it.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-[10px] flex items-center gap-2 hover:bg-[rgba(16,185,129,.10)]"
                style={{ color:'var(--text)' }}
              >
                {it.icon}{it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================  SCOPED STYLES  ============================== */
function RailStyles() {
  return (
    <style jsx global>{`
      .${SCOPE}{
        --accent:${ACCENT};
        --va-rail-w:312px;

        /* fallbacks if your layout doesn't set them */
        --app-header-h: var(--app-header-h, 64px);
        --app-sidebar-w: var(--app-sidebar-w, 248px);

        /* dark palette (matches your app) */
        --text:#eef2f5;
        --text-muted:rgba(255,255,255,.70);
        --va-card:#0f1315;
        --va-topbar:#0e1214;
        --va-rail-bg:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
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
        --va-rail-shadow:8px 0 28px rgba(0,0,0,.42);
      }
      :root:not([data-theme="dark"]) .${SCOPE}{
        --text:#101316;
        --text-muted:rgba(0,0,0,.60);
        --va-card:#ffffff;
        --va-topbar:#ffffff;
        --va-rail-bg:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
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
        --va-rail-shadow:8px 0 26px rgba(0,0,0,.08);
      }
      .${SCOPE} .icon{ color: var(--accent); }

      /* API-keys-like buttons */
      .${SCOPE} .btn--green{
        display:inline-flex; align-items:center; gap:.5rem;
        border-radius:14px; padding:.6rem .9rem;
        background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW};
        border:1px solid rgba(255,255,255,.08);
        transition:transform .04s ease, background .18s ease;
      }
      .${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
      .${SCOPE} .btn--green:active{ transform:translateY(1px); }

      .${SCOPE} .btn--ghost{
        display:inline-flex; align-items:center; gap:.5rem;
        border-radius:14px; padding:.55rem .85rem; font-size:14px;
        background:var(--va-card); color:var(--text);
        border:1px solid var(--va-border); box-shadow:var(--va-shadow-sm);
      }
      .${SCOPE} .btn--danger{
        display:inline-flex; align-items:center; gap:.5rem;
        border-radius:14px; padding:.55rem .85rem; font-size:14px;
        background:rgba(220,38,38,.12); color:#fca5a5;
        border:1px solid rgba(220,38,38,.35); box-shadow:0 10px 24px rgba(220,38,38,.15);
      }

      .${SCOPE} .va-range{ -webkit-appearance:none; height:4px; background:color-mix(in oklab, var(--accent) 24%, #0000); border-radius:999px; outline:none; }
      .${SCOPE} .va-range::-webkit-slider-thumb{ -webkit-appearance:none; width:14px;height:14px;border-radius:50%;background:var(--accent); border:2px solid #fff; box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }
      .${SCOPE} .va-range::-moz-range-thumb{ width:14px;height:14px;border:0;border-radius:50%;background:var(--accent); box-shadow:0 0 0 3px color-mix(in oklab, var(--accent) 25%, transparent); }

      .${SCOPE} ins{ background:rgba(16,185,129,.18); color:var(--text); text-decoration:none; padding:1px 2px; border-radius:4px; }
      .${SCOPE} del{ background:rgba(239,68,68,.18); color:#fca5a5; text-decoration:line-through; padding:1px 2px; border-radius:4px; }
    `}</style>
  );
}
