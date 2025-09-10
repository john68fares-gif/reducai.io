'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scopedStorage } from '@/utils/scoped-storage';
import AssistantSidebar, { Assistant, PhoneNum } from './AssistantSidebar';
import WebCallButton, { TranscriptTurn } from './WebCallButton';
import {
  AudioLines, BookOpen, Check, Copy, FileText, ListTree, MessageSquare, Mic2, Phone as PhoneIcon,
  RefreshCw, Rocket, Save, SlidersHorizontal, Sparkles, Trash2, UploadCloud, Volume2, ChevronDown, ChevronRight, X
} from 'lucide-react';

/* ====== THEME VARS ====== */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

/* ====== STORAGE KEYS ====== */
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

/* ====== BASE PROMPT ====== */
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

/* ====== SMALL HELPERS ====== */
const readLS = <T,>(k: string): T | null => {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; }
};
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ====== UI SELECT ====== */
type Item = { value: string; label: string; icon?: React.ReactNode };
function Select({ value, items, onChange }: { value: string; items: Item[]; onChange: (v:string)=>void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={()=> setOpen(v=>!v)} className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
              style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}>
        {items.find(i=>i.value===value)?.label || 'Select…'}
        <span className="ml-auto" />
        <ChevronDown className="w-4 h-4 icon" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
            className="absolute z-[9999] p-3 rounded-xl w-full mt-2"
            style={{ background:'var(--va-menu-bg)', border:'1px solid var(--va-menu-border)', boxShadow:'var(--va-shadow-lg)' }}>
            {items.map(it=>(
              <button key={it.value} onClick={()=> { onChange(it.value); setOpen(false); }}
                className="w-full text-left px-3 py-2 rounded-[10px]" style={{ color:'var(--text)' }}>
                {it.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ====== PAGE ====== */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  /* Assistants state */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<Assistant | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [rev, setRev] = useState(0);

  /* OpenAI key (Step2 storage) */
  const [openaiKey, setOpenaiKey] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const ss = await scopedStorage(); await ss.ensureOwnerGuard();
        const v1 = await ss.getJSON<any[]>(LS_KEYS, []);
        const legacy = await ss.getJSON<any[]>('apiKeys', []);
        const all = v1?.length ? v1 : (legacy || []);
        const selectedId = await ss.getJSON<string>(LS_SELECTED, '');
        const key = all.find((k:any)=>k.id===selectedId)?.key || all[0]?.key || null;
        if (mounted) setOpenaiKey(key);
      } catch { if (mounted) setOpenaiKey(null); }
    })();
    return () => { mounted = false; };
  }, []);

  /* Seed + load */
  useEffect(() => {
    if (!isClient) return;
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
          telephony: { numbers: [], linkedNumberId: undefined }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      const fixed = list.map(a => ({ ...a, config:{ ...a.config, telephony: a.config.telephony || { numbers: [], linkedNumberId: undefined } } }));
      writeLS(LS_LIST, fixed);
      setAssistants(fixed); setActiveId(fixed[0].id);
    }
    if (!readLS(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS(LS_ROUTES)) writeLS(LS_ROUTES, {});
  }, [isClient]);

  useEffect(() => {
    if (!isClient || !activeId) { setActive(null); return; }
    setActive(readLS<Assistant>(ak(activeId)));
  }, [isClient, activeId, rev]);

  const updateActive = (mut: (a: Assistant) => Assistant) => {
    if (!active) return;
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x);
    writeLS(LS_LIST, list);
    setAssistants(list);
    setActive(next);
    setRev(r => r + 1);
  };

  async function onCreateAssistant() {
    await new Promise(r => setTimeout(r, 260));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name:'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: '' },
        voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
        transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
        tools: { enableEndCall:true, dialKeypad:true },
        telephony: { numbers: [], linkedNumberId: undefined }
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  }
  function onDeleteAssistant(id: string) {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id);
    if (!list.length) setActiveId('');
    setRev(r => r + 1);
  }
  function onRenameAssistant(id: string, name: string) {
    const cur = readLS<Assistant>(ak(id));
    if (cur) writeLS(ak(id), { ...cur, name, updatedAt: Date.now() });
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === id ? { ...x, name, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list); setAssistants(list);
    setRev(r => r + 1);
  }

  /* Voice options */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam',   label: 'Adam (ElevenLabs)'   },
    { value: 'bella',  label: 'Bella (ElevenLabs)'  },
  ];
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const [pendingVoiceLabel, setPendingVoiceLabel] = useState<string | null>(null);
  useEffect(() => {
    if (active) { setPendingVoiceId(active.config.voice.voiceId); setPendingVoiceLabel(active.config.voice.voiceLabel); }
  }, [active?.id]);

  function handleVoiceProviderChange(v: string) {
    const list = v==='elevenlabs' ? elevenVoices : openaiVoices;
    setPendingVoiceId(list[0].value);
    setPendingVoiceLabel(list[0].label);
    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ provider: v as any, voiceId: list[0].value, voiceLabel: list[0].label } } }));
  }
  function handleVoiceIdChange(v: string) {
    if (!active) return;
    const list = active.config.voice.provider==='elevenlabs' ? elevenVoices : openaiVoices;
    const found = list.find(x=>x.value===v);
    setPendingVoiceId(v);
    setPendingVoiceLabel(found?.label || v);
  }
  async function saveVoice() {
    if (!active || !pendingVoiceId) return;
    updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId: pendingVoiceId, voiceLabel: pendingVoiceLabel || pendingVoiceId } } }));
    // tiny audible confirm using browser TTS
    try { window.speechSynthesis.cancel(); } catch {}
    const u = new SpeechSynthesisUtterance('Voice saved.');
    window.speechSynthesis.speak(u);
  }

  /* Telephony helpers */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim();
    if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return { ...a, config:{ ...a.config, telephony:{ numbers:[...nums, { id:`ph_${Date.now().toString(36)}`, e164:norm, label:(label||'').trim()||undefined }], linkedNumberId: a.config.telephony?.linkedNumberId } } };
    });
  };
  const removePhone = (id: string) => {
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      const linked = a.config.telephony?.linkedNumberId;
      return { ...a, config:{ ...a.config, telephony:{ numbers: nums.filter(n=>n.id!==id), linkedNumberId: linked===id ? undefined : linked } } };
    });
  };
  const setLinkedNumber = (id?: string) => {
    updateActive(a => ({ ...a, config:{ ...a.config, telephony:{ numbers: a.config.telephony?.numbers || [], linkedNumberId: id } } }));
  };

  const publish = () => {
    if (!active) return;
    const linkedId = active.config.telephony?.linkedNumberId;
    const numbers = active.config.telephony?.numbers ?? [];
    const num = numbers.find(n=>n.id===linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string,string>>(LS_ROUTES) || {};
    routes[num.id] = active.id;
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  /* Transcript + call logs */
  const [live, setLive] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [callsForAssistant, setCallsForAssistant] = useState<any[]>([]);

  function pushTurn(t: TranscriptTurn) {
    setTranscript(prev => {
      const next = [...prev, t];
      const currentCallId = (window as any).__currentCallId || null;
      if (currentCallId) {
        const calls = readLS<any[]>(LS_CALLS) || [];
        const idx = calls.findIndex(c => c.id === currentCallId);
        if (idx >= 0) { calls[idx] = { ...calls[idx], transcript: [...calls[idx].transcript, t] }; writeLS(LS_CALLS, calls); }
      }
      return next;
    });
  }

  useEffect(() => {
    if (!isClient || !active?.id) { setCallsForAssistant([]); return; }
    const list = readLS<any[]>(LS_CALLS) || [];
    setCallsForAssistant(list.filter(c => c.assistantId === active.id));
  }, [isClient, active?.id, live, transcript.length, rev]);

  // When live toggles on, allocate a call log id
  useEffect(() => {
    if (!live || !active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    (window as any).__currentCallId = id;
    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<any[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);
    return () => {
      const calls2 = (readLS<any[]>(LS_CALLS) || []).map(c => c.id === id ? ({ ...c, endedAt: Date.now(), endedReason: 'Ended by user' }) : c);
      writeLS(LS_CALLS, calls2);
      (window as any).__currentCallId = null;
    };
  }, [live]);

  if (!isClient) return <div ref={scopeRef} className={SCOPE}><StyleBlock /><div className="px-6 py-10 opacity-70 text-sm">Loading…</div></div>;
  if (!active) return <div ref={scopeRef} className={SCOPE}><StyleBlock /><div className="px-6 py-10">Create your first assistant.</div></div>;

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Sidebar */}
      <AssistantSidebar
        railCollapsed={false}
        setRailCollapsed={()=>{}}
        assistants={assistants}
        activeId={activeId}
        setActiveId={setActiveId}
        onCreate={onCreateAssistant}
        onDelete={onDeleteAssistant}
        onRename={onRenameAssistant}
      />

      {/* Main */}
      <div className="va-main" style={{
        marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
        paddingRight:'clamp(20px, 4vw, 40px)',
        paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
        paddingBottom:'88px'
      }}>
        {/* Top bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky"
             style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            <WebCallButton
              disabled={!active}
              live={live}
              setLive={setLive}
              cfg={{
                firstMessageMode: active.config.model.firstMessageMode,
                firstMessage: active.config.model.firstMessage,
                systemPrompt: active.config.model.systemPrompt || BASE_PROMPT,
                model: active.config.model.model,
                voice: { provider: active.config.voice.provider, voiceId: active.config.voice.voiceId, voiceLabel: active.config.voice.voiceLabel }
              }}
              openaiKey={openaiKey}
              onTurn={pushTurn}
              onError={(m)=> console.warn('[call]', m)}
            />
            <button onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail:{ id: active.id } }))} className="btn btn--ghost">
              <MessageSquare className="w-4 h-4 icon" /> Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})} className="btn btn--ghost">
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> onDeleteAssistant(active.id)} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={publish} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {/* Panels */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.model.provider}
                  items={[{ value:'openai', label:'OpenAI' }]}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as any } } }))}
                />
              </Field>
              <Field label="Model">
                <Select
                  value={active.config.model.model}
                  items={[
                    { value:'gpt-4o', label:'GPT-4o' },
                    { value:'gpt-4o-mini', label:'GPT-4o mini' },
                    { value:'gpt-4.1', label:'GPT-4.1' },
                    { value:'gpt-3.5-turbo', label:'GPT-3.5 Turbo' },
                  ]}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, model: v as any } } }))}
                />
              </Field>
              <Field label="First Message Mode">
                <Select
                  value={active.config.model.firstMessageMode}
                  items={[{ value:'assistant_first', label:'Assistant speaks first' }, { value:'user_first', label:'User speaks first' }]}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, firstMessageMode: v as any } } }))}
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

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: BASE_PROMPT } } }))}
                    className="btn btn--ghost"
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                </div>
              </div>
              <textarea
                rows={20}
                value={active.config.model.systemPrompt || ''}
                onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                style={{
                  background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                  boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                  fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  minHeight: 420
                }}
              />
              <div className="text-xs opacity-70 mt-2">
                To include rolling context, add a section to your prompt: <code>[AllowHistory] yes</code>.  
                Otherwise only the latest user message is sent with the system prompt.
              </div>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  items={[{ value:'openai', label:'OpenAI' }, { value:'elevenlabs', label:'ElevenLabs' }]}
                  onChange={handleVoiceProviderChange}
                />
              </Field>
              <Field label="Voice">
                <Select
                  value={pendingVoiceId || active.config.voice.voiceId}
                  items={active.config.voice.provider==='elevenlabs'
                    ? elevenVoices
                    : [{ value:'alloy', label:'Alloy (OpenAI)' }, { value:'ember', label:'Ember (OpenAI)' }]}
                  onChange={handleVoiceIdChange}
                />
              </Field>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <button onClick={saveVoice} className="btn btn--green">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
              <button
                onClick={()=> { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your importer.'); }}
                className="btn btn--ghost"
              ><UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs</button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(360px, 1fr))' }}>
              <Field label="Provider"><Select value="deepgram" items={[{ value:'deepgram', label:'Deepgram' }]} onChange={()=>{}} /></Field>
              <Field label="Model"><Select value={active.config.transcriber.model} items={[{ value:'nova-2', label:'Nova 2' }, { value:'nova-3', label:'Nova 3' }]} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, model: v as any } } }))} /></Field>
              <Field label="Language"><Select value={active.config.transcriber.language} items={[{ value:'en', label:'English' }, { value:'multi', label:'Multi' }]} onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, transcriber:{ ...a.config.transcriber, language: v as any } } }))} /></Field>
            </div>
          </Section>

          {/* Telephony */}
          <Section title="Telephony" icon={<PhoneIcon className="w-4 h-4 icon" />}>
            <TelephonyEditor
              numbers={active.config.telephony?.numbers ?? []}
              linkedId={active.config.telephony?.linkedNumberId}
              onLink={setLinkedNumber}
              onAdd={addPhone}
              onRemove={removePhone}
            />
          </Section>

          {/* Web call test */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
            <div className="rounded-2xl p-3" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                      border: '1px solid var(--va-border)'
                    }}>{t.role==='assistant' ? 'AI' : 'You'}</div>
                    <div className="text-sm">{t.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Logs */}
          <Section title="Call Logs" icon={<ListTree className="w-4 h-4 icon" />}>
            <div className="space-y-3">
              {callsForAssistant.length === 0 && <div className="text-sm opacity-60">No calls yet.</div>}
              {callsForAssistant.map((log:any) => (
                <details key={log.id} className="rounded-xl" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 icon" />
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                      {log.endedAt ? <span className="opacity-70">• {(Math.max(1, Math.round((log.endedAt - log.startedAt)/1000)))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t: TranscriptTurn, i: number) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                          border: '1px solid var(--va-border)'
                        }}>{t.role==='assistant' ? 'AI' : 'User'}</div>
                        <div className="text-sm">{t.text}</div>
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </Section>
        </div>
      </div>

      <StyleBlock />
    </div>
  );
}

/* ====== UI bits ====== */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (<div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>{children}</div>);
}
function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 rounded-xl relative" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
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

/* ====== Telephony UI ====== */
function TelephonyEditor({ numbers, linkedId, onLink, onAdd, onRemove }:{
  numbers: PhoneNum[];
  linkedId?: string;
  onLink: (id?: string) => void;
  onAdd: (e164: string, label?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [e164, setE164] = useState('');
  const [label, setLabel] = useState('');
  return (
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns:'repeat(3, minmax(240px, 1fr))' }}>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>Phone Number (E.164)</div>
          <input value={e164} onChange={(e)=> setE164(e.target.value)} placeholder="+1xxxxxxxxxx"
                 className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                 style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>Label</div>
          <input value={label} onChange={(e)=> setLabel(e.target.value)} placeholder="Support line"
                 className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                 style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }} />
        </div>
        <div className="flex items-end">
          <button onClick={()=> { onAdd(e164, label); setE164(''); setLabel(''); }} className="btn btn--green w-full justify-center">
            <PhoneIcon className="w-4 h-4 text-white" /><span className="text-white">Add Number</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {numbers.length === 0 && <div className="text-sm opacity-70">No phone numbers added yet.</div>}
        {numbers.map(n => (
          <div key={n.id} className="flex items-center justify-between rounded-xl px-3 py-2"
               style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
            <div className="min-w-0">
              <div className="font-medium truncate">{n.label || 'Untitled'}</div>
              <div className="text-xs opacity-70">{n.e164}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="linked_number" checked={linkedId===n.id} onChange={()=> onLink(n.id)} />
                Linked
              </label>
              <button onClick={()=> onRemove(n.id)} className="btn btn--danger text-xs"><Trash2 className="w-4 h-4" /> Remove</button>
            </div>
          </div>
        ))}
        {numbers.length > 0 && <div className="text-xs opacity-70">The number marked as <b>Linked</b> will be attached on <i>Publish</i>.</div>}
      </div>
    </div>
  );
}

/* ====== Styles ====== */
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
  --va-rail-w:360px;
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
.${SCOPE} .btn{
  display:inline-flex; align-items:center; gap:.5rem;
  border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1;
  border:1px solid var(--va-border);
}
.${SCOPE} .btn--green{
  background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW};
  transition:transform .04s ease, background .18s ease;
}
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }
`}</style>
  );
}
