// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Check, Copy, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  UploadCloud, RefreshCw, X, Phone as PhoneIcon, Rocket, MessageSquare, AudioLines, Volume2, Save
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';
import WebCallButton from '@/components/voice/WebCallButton';

/* =============================================================================
   STYLE TOKENS — tuned to your screenshots (dark “cosmic night” w/ green accent)
============================================================================= */
const SCOPE = 'va-scope';

const TOKENS = {
  accent: '#10b981',
  accentHover: '#0ea371',
  shadow: '0 12px 28px rgba(16,185,129,.18)',
  cardBgDark: '#0f1315',
  appBgDark: '#0b0d10',
  textDark: '#eaf1f4',
  textMutedDark: 'color-mix(in oklab, #eaf1f4 65%, transparent)',
  borderDark: 'rgba(255,255,255,.10)',
  inputBgDark: 'rgba(255,255,255,.03)',
  inputBorderDark: 'rgba(255,255,255,.14)',
  inputShadowDark: 'inset 0 1px 0 rgba(255,255,255,.06)',
};

/* =============================================================================
   LOCAL STORAGE HELPERS / TYPES (kept from your original flow)
============================================================================= */
type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type PhoneNum = { id: string; label?: string; e164: string };
type TranscriptTurn = { role: 'assistant' | 'user'; text: string; ts: number };
type CallLog = {
  id: string; assistantId: string; assistantName: string; startedAt: number; endedAt?: number;
  endedReason?: string; type: 'Web'; assistantPhoneNumber?: string; transcript: TranscriptTurn[]; costUSD?: number;
};
type Assistant = {
  id: string; name: string; folder?: string; updatedAt: number; published?: boolean;
  config: {
    model: {
      provider: Provider; model: ModelId;
      firstMessageMode: 'assistant_first' | 'user_first'; firstMessage: string; systemPrompt: string;
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
    telephony?: { numbers: PhoneNum[]; linkedNumberId?: string };
  };
};

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; } };
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
   SMALL UI ATOMS
============================================================================= */
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
    <div className="va-card">
      <button type="button" onClick={() => setOpen(v => !v)} className="va-card__header">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: .18 }} className="va-card__body"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =============================================================================
   TELEPHONY EDITOR (unchanged structure, fixed widths)
============================================================================= */
function TelephonyEditor({ numbers, linkedId, onLink, onAdd, onRemove }: {
  numbers: PhoneNum[];
  linkedId?: string;
  onLink: (id?: string) => void;
  onAdd: (e164: string, label?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [e164, setE164] = useState('');
  const [label, setLabel] = useState('');
  return (
    <div className="space-y-4" style={{ minWidth: 0 }}>
      <div className="grid gap-4 auto-cols-fr" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div style={{ minWidth: 0 }}>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>Phone Number (E.164)</div>
          <input value={e164} onChange={(e) => setE164(e.target.value)} placeholder="+1xxxxxxxxxx"
                 className="w-full va-input" />
        </div>
        <div style={{ minWidth: 0 }}>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>Label</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Support line"
                 className="w-full va-input" />
        </div>
        <div className="flex items-end">
          <button onClick={() => { onAdd(e164, label); setE164(''); setLabel(''); }} className="btn btn--green w-full justify-center">
            <PhoneIcon className="w-4 h-4 text-white" /><span className="text-white">Add Number</span>
          </button>
        </div>
      </div>

      <div className="space-y-2" style={{ minWidth: 0 }}>
        {numbers.length === 0 && <div className="text-sm opacity-70">No phone numbers added yet.</div>}
        {numbers.map(n => (
          <div key={n.id} className="flex items-center justify-between rounded-xl px-3 py-2"
               style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', minWidth: 0 }}>
            <div className="min-w-0">
              <div className="font-medium truncate">{n.label || 'Untitled'}</div>
              <div className="text-xs opacity-70">{n.e164}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="linked_number" checked={linkedId === n.id} onChange={() => onLink(n.id)} />
                Linked
              </label>
              <button onClick={() => onRemove(n.id)} className="btn btn--danger text-xs">Remove</button>
            </div>
          </div>
        ))}
        {numbers.length > 0 && <div className="text-xs opacity-70">The number marked as <b>Linked</b> will be attached to this assistant on <i>Publish</i>.</div>}
      </div>
    </div>
  );
}

/* =============================================================================
   PAGE
============================================================================= */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  /* ---------- assistants bootstrapping (kept) ---------- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<Assistant | null>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!isClient) return;
    const list = readLS<Assistant[]>(LS_LIST) || [];
    if (!list.length) {
      const seed: Assistant = {
        id: 'riley',
        name: 'Riley',
        folder: 'Default',
        updatedAt: Date.now(),
        published: false,
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
      writeLS(LS_LIST, fixed);
      setAssistants(fixed); setActiveId(fixed[0].id);
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
    const next = mut(active);
    writeLS(ak(next.id), next);
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x =>
      x.id === next.id ? { ...x, name: next.name, folder: next.folder, updatedAt: Date.now(), published: next.published } : x
    );
    writeLS(LS_LIST, list);
    setAssistants(list);
    setActive(next);
    setRev(r => r + 1);
  };

  /* ---------- create/rename/delete in rail ---------- */
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
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
  };
  const onRename = (id: string, name: string) => {
    const cur = readLS<Assistant>(ak(id)); if (cur) writeLS(ak(id), { ...cur, name, updatedAt: Date.now() });
    const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === id ? { ...x, name, updatedAt: Date.now() } : x);
    writeLS(LS_LIST, list); setAssistants(list); setRev(r => r + 1);
  };
  const onDelete = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id);
    if (!list.length) setActiveId('');
    setRev(r => r + 1);
  };

  /* ---------- voice options ---------- */
  const openaiVoices = [
    { value: 'alloy', label: 'Alloy (OpenAI)' },
    { value: 'ember', label: 'Ember (OpenAI)' },
  ];
  const elevenVoices = [
    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
    { value: 'adam', label: 'Adam (ElevenLabs)' },
    { value: 'bella', label: 'Bella (ElevenLabs)' },
  ];
  const [pendingVoiceId, setPendingVoiceId] = useState<string | null>(null);
  const [pendingVoiceLabel, setPendingVoiceLabel] = useState<string | null>(null);
  useEffect(() => {
    if (active) { setPendingVoiceId(active.config.voice.voiceId); setPendingVoiceLabel(active.config.voice.voiceLabel); }
  }, [active?.id]);
  const handleVoiceProviderChange = (v: string) => {
    const list = v === 'elevenlabs' ? elevenVoices : openaiVoices;
    setPendingVoiceId(list[0].value); setPendingVoiceLabel(list[0].label);
    updateActive(a => ({ ...a, config: { ...a.config, voice: { provider: v as VoiceProvider, voiceId: list[0].value, voiceLabel: list[0].label } } }));
  };
  const handleVoiceIdChange = (v: string) => {
    if (!active) return;
    const list = active.config.voice.provider === 'elevenlabs' ? elevenVoices : openaiVoices;
    const found = list.find(x => x.value === v);
    setPendingVoiceId(v); setPendingVoiceLabel(found?.label || v);
  };
  const saveVoice = async () => {
    if (!active || !pendingVoiceId) return;
    updateActive(a => ({ ...a, config: { ...a.config, voice: { ...a.config.voice, voiceId: pendingVoiceId, voiceLabel: pendingVoiceLabel || pendingVoiceId } } }));
    try {
      const utter = new SpeechSynthesisUtterance('Voice saved.');
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(utter);
    } catch {}
  };

  /* ---------- telephony ---------- */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return { ...a, config: { ...a.config, telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label || '').trim() || undefined }], linkedNumberId: a.config.telephony?.linkedNumberId } } };
    });
  };
  const removePhone = (id: string) => {
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      const linked = a.config.telephony?.linkedNumberId;
      const nextLinked = linked === id ? undefined : linked;
      return { ...a, config: { ...a.config, telephony: { numbers: nums.filter(n => n.id !== id), linkedNumberId: nextLinked } } };
    });
  };
  const setLinkedNumber = (id?: string) => {
    updateActive(a => ({ ...a, config: { ...a.config, telephony: { numbers: a.config.telephony?.numbers || [], linkedNumberId: id } } }));
  };
  const publish = () => {
    if (!active) return;
    const linkedId = active.config.telephony?.linkedNumberId;
    const numbers = active.config.telephony?.numbers ?? [];
    const num = numbers.find(n => n.id === linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[num.id] = active.id;
    writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  /* ---------- transcript & logs ---------- */
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callsForAssistant, setCallsForAssistant] = useState<CallLog[]>([]);

  const ensureCall = () => {
    if (currentCallId || !active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);
    setCurrentCallId(id);
  };

  const onTurn = (role: 'user' | 'assistant', text: string) => {
    if (!active) return;
    ensureCall();
    const turn = { role, text, ts: Date.now() };
    setTranscript(t => {
      const next = [...t, turn];
      if (currentCallId) {
        const calls = readLS<CallLog[]>(LS_CALLS) || [];
        const idx = calls.findIndex(c => c.id === currentCallId);
        if (idx >= 0) { calls[idx] = { ...calls[idx], transcript: [...calls[idx].transcript, turn] }; writeLS(LS_CALLS, calls); }
      }
      return next;
    });
  };

  const endWebCallSession = (reason = 'Ended by user') => {
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls);
    setCurrentCallId(null);
  };

  useEffect(() => {
    if (!isClient || !active?.id) { setCallsForAssistant([]); return; }
    const list = readLS<CallLog[]>(LS_CALLS) || [];
    setCallsForAssistant(list.filter(c => c.assistantId === active.id));
  }, [isClient, active?.id, currentCallId, transcript.length, rev]);

  /* ---------- layout: observe sidebars and enforce 4px gutters ---------- */
  const railWidthRef = useRef(360);   // AssistantRail actual width
  const appSidebarWidthRef = useRef(248); // App sidebar width

  useLayoutEffect(() => {
    if (!isClient) return;

    const root = document.documentElement;

    function setVars() {
      root.style.setProperty('--va-rail-w', `${railWidthRef.current}px`);
      root.style.setProperty('--app-sidebar-w', `${appSidebarWidthRef.current}px`);
      root.style.setProperty('--va-edge-gutter', '4px'); // left & right gutters you asked for
    }

    // Observe the app sidebar (assumes it has data attribute or fixed left bar)
    const appSidebar =
      document.querySelector<HTMLElement>('[data-app-sidebar]') ||
      document.getElementById('app-sidebar') ||
      document.querySelector<HTMLElement>('.app-sidebar');

    const rail =
      document.querySelector<HTMLElement>('[data-va-rail]') ||
      document.querySelector<HTMLElement>('.assistant-rail');

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const w = e.contentRect.width;
        if (!w) continue;
        if (e.target === appSidebar) appSidebarWidthRef.current = Math.round(w);
        if (e.target === rail) railWidthRef.current = Math.round(w);
      }
      setVars();
    });

    if (appSidebar) ro.observe(appSidebar);
    if (rail) ro.observe(rail);

    // Fallback apply once
    setVars();

    return () => ro.disconnect();
  }, [isClient]);

  if (!isClient) {
    return (
      <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <StyleBlock />
        <div className="px-2 sm:px-3 md:px-4 py-8 opacity-70 text-sm">Loading…</div>
      </div>
    );
  }
  if (!active) {
    return (
      <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <StyleBlock />
        <div className="px-2 sm:px-3 md:px-4 py-8 opacity-70">Create your first assistant.</div>
      </div>
    );
  }

  const railData: AssistantLite[] = assistants.map(a => ({ id: a.id, name: a.name, folder: a.folder, updatedAt: a.updatedAt }));
  const greet = active.config.model.firstMessageMode === 'assistant_first'
    ? (active.config.model.firstMessage || 'Hello. How may I help you today?')
    : 'Listening…';

  // linked number (used only for display/logging)
  const linkedE164 = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164 || '';

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Rail */}
      <AssistantRail assistants={railData} activeId={activeId} onSelect={setActiveId} onCreate={onCreate} onRename={onRename} onDelete={onDelete} />

      {/* Main – margin-left responds to live measured widths; 4px gutters */}
      <div
        className="va-main"
        style={{
          marginLeft: 'calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px) + var(--va-edge-gutter, 4px))',
          paddingRight: 'var(--va-edge-gutter, 4px)',
          paddingLeft: 'var(--va-edge-gutter, 4px)',
          paddingTop: 'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom: '88px',
        }}
      >
        {/* Top actions — uniform height */}
        <div className="px-0 pb-3 flex items-center justify-between sticky" style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
          <div className="flex items-center gap-8">
            {/* WebCall Button */}
            {!currentCallId ? (
              <WebCallButton
                greet={greet}
                voiceLabel={active.config.voice.voiceLabel}
                systemPrompt={active.config.model.systemPrompt || BASE_PROMPT}
                model={active.config.model.model}
                apiKeyId={'' /* provided by your chat route via header; leave string if you route from scoped storage */}
                fromE164={linkedE164}
                onTurn={onTurn}
              />
            ) : (
              <button onClick={() => { endWebCallSession('Ended by user'); window.speechSynthesis?.cancel(); }} className="btn btn--danger btn--h">
                End Call
              </button>
            )}

            <button onClick={() => window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail: { id: active.id } }))}
                    className="btn btn--ghost btn--h"><MessageSquare className="w-4 h-4 icon" /> Chat</button>

            <button onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(() => {})} className="btn btn--ghost btn--h">
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
          </div>

          <div className="flex items-center gap-8">
            <button onClick={publish} className="btn btn--green btn--h"><Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span></button>
          </div>
        </div>

        {/* Body – cards fill width and never overflow; responsive grid */}
        <div className="mx-auto grid gap-6 md:gap-8" style={{ gridTemplateColumns: '1fr', maxWidth: 'min(2200px, 100%)', minWidth: 0 }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', minWidth: 0 }}>
              {/* Provider */}
              <Field label="Provider">
                <select
                  value={active.config.model.provider}
                  onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, provider: e.target.value as Provider } } }))}
                  className="w-full va-input"
                  style={{ minWidth: 0 }}
                >
                  <option value="openai">OpenAI</option>
                </select>
              </Field>

              {/* Model */}
              <Field label="Model">
                <select
                  value={active.config.model.model}
                  onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, model: e.target.value as ModelId } } }))}
                  className="w-full va-input"
                >
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </Field>

              {/* First message mode */}
              <Field label="First Message Mode">
                <select
                  value={active.config.model.firstMessageMode}
                  onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessageMode: e.target.value as any } } }))}
                  className="w-full va-input"
                >
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </Field>

              {/* First message */}
              <Field label="First Message">
                <input
                  value={active.config.model.firstMessage}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessage: e.target.value } } }))}
                  className="w-full va-input"
                />
              </Field>
            </div>

            {/* System Prompt */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: BASE_PROMPT } } }))} className="btn btn--ghost btn--h">
                    <RefreshCw className="w-4 h-4 icon" /> Reset
                  </button>
                  <button onClick={() => alert('Hook up your generator overlay here.')} className="btn btn--green btn--h">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              <textarea
                rows={22}
                value={active.config.model.systemPrompt || ''}
                onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: e.target.value } } }))}
                className="w-full va-textarea"
                style={{ minHeight: 520 }}
              />
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', minWidth: 0 }}>
              <Field label="Provider">
                <select
                  value={active.config.voice.provider}
                  onChange={(e) => handleVoiceProviderChange(e.target.value)}
                  className="w-full va-input"
                >
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>
              <Field label="Voice">
                <select
                  value={pendingVoiceId || active.config.voice.voiceId}
                  onChange={(e) => handleVoiceIdChange(e.target.value)}
                  className="w-full va-input"
                >
                  {(active.config.voice.provider === 'elevenlabs' ? elevenVoices : openaiVoices).map(v => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={async () => { try { const u = new SpeechSynthesisUtterance('This is a quick preview of the selected voice.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} }}
                className="btn btn--ghost btn--h">
                <Volume2 className="w-4 h-4 icon" /> Test Voice
              </button>
              <button onClick={saveVoice} className="btn btn--green btn--h">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
              <button
                onClick={() => { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your importer.'); }}
                className="btn btn--ghost btn--h">
                <UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs
              </button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', minWidth: 0 }}>
              <Field label="Provider">
                <select
                  value={active.config.transcriber.provider}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, provider: e.target.value as any } } }))}
                  className="w-full va-input"
                >
                  <option value="deepgram">Deepgram</option>
                </select>
              </Field>
              <Field label="Model">
                <select
                  value={active.config.transcriber.model}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, model: e.target.value as any } } }))}
                  className="w-full va-input"
                >
                  <option value="nova-2">Nova 2</option>
                  <option value="nova-3">Nova 3</option>
                </select>
              </Field>
              <Field label="Language">
                <select
                  value={active.config.transcriber.language}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, language: e.target.value as any } } }))}
                  className="w-full va-input"
                >
                  <option value="en">English</option>
                  <option value="multi">Multi</option>
                </select>
              </Field>

              <Field label="Confidence Threshold">
                <div className="flex items-center gap-3">
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={active.config.transcriber.confidenceThreshold}
                    onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } } }))}
                    className="w-full"
                  />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{active.config.transcriber.confidenceThreshold.toFixed(2)}</span>
                </div>
              </Field>
              <Field label="Denoise">
                <select
                  value={String(active.config.transcriber.denoise)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, denoise: e.target.value === 'true' } } }))}
                  className="w-full va-input"
                >
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </Field>
              <Field label="Use Numerals">
                <select
                  value={String(active.config.transcriber.numerals)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, numerals: e.target.value === 'true' } } }))}
                  className="w-full va-input"
                >
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* Tools */}
          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', minWidth: 0 }}>
              <Field label="Enable End Call Function">
                <select
                  value={String(active.config.tools.enableEndCall)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, enableEndCall: e.target.value === 'true' } } }))}
                  className="w-full va-input"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
              <Field label="Dial Keypad">
                <select
                  value={String(active.config.tools.dialKeypad)}
                  onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, dialKeypad: e.target.value === 'true' } } }))}
                  className="w-full va-input"
                >
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
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

          {/* Web test + transcript */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
            <div className="rounded-2xl p-3" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
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

          {/* Logs */}
          <Section title="Call Logs" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="space-y-3">
              {callsForAssistant.length === 0 && <div className="text-sm opacity-60">No calls yet.</div>}
              {callsForAssistant.map(log => (
                <details key={log.id} className="rounded-xl" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
                  <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                    <div className="text-sm flex items-center gap-2">
                      <PhoneIcon className="w-4 h-4 icon" />
                      <span>{new Date(log.startedAt).toLocaleString()}</span>
                      {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                      {log.endedAt ? <span className="opacity-70">• {(Math.max(1, Math.round((log.endedAt - log.startedAt) / 1000)))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: t.role === 'assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                          border: '1px solid var(--va-border)'
                        }}>{t.role === 'assistant' ? 'AI' : 'User'}</div>
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

/* =============================================================================
   GLOBAL STYLES scoped to this page
============================================================================= */
function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  --accent:${TOKENS.accent};
  --bg:${TOKENS.appBgDark};
  --text:${TOKENS.textDark};
  --text-muted:${TOKENS.textMutedDark};
  --va-card:${TOKENS.cardBgDark};
  --va-border:${TOKENS.borderDark};
  --va-input-bg:${TOKENS.inputBgDark};
  --va-input-border:${TOKENS.inputBorderDark};
  --va-input-shadow:${TOKENS.inputShadowDark};
  --va-shadow:0 24px 70px rgba(0,0,0,.55), 0 10px 28px rgba(0,0,0,.40);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
  --va-rail-w: 360px;
  --app-sidebar-w: 248px;
  --va-edge-gutter: 4px;
}

.${SCOPE} .icon{ color: var(--accent); }

/* Cards */
.${SCOPE} .va-card{
  position: relative;
  background: var(--va-card);
  border: 1px solid var(--va-border);
  border-radius: 16px;
  box-shadow: var(--va-shadow);
  overflow: visible; /* prevent dropdown clipping while keeping contents inside */
  min-width: 0;
}
.${SCOPE} .va-card__header{
  width: 100%; display:flex; align-items:center; justify-content:space-between;
  padding: 12px 16px; border-bottom: 1px solid var(--va-border);
}
.${SCOPE} .va-card__body{ padding: 16px; }

/* Inputs */
.${SCOPE} .va-input{
  min-width:0; max-width:100%;
  border-radius: 14px; padding: .7rem .9rem; font-size: 15px; line-height: 1.1;
  color: var(--text); background: var(--va-input-bg);
  border: 1px solid var(--va-input-border); box-shadow: var(--va-input-shadow);
}
.${SCOPE} .va-textarea{
  min-width:0; max-width:100%;
  border-radius: 14px; padding: .8rem .9rem; font-size: 14px;
  color: var(--text); background: var(--va-input-bg);
  border: 1px solid var(--va-input-border);
  box-shadow: var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03);
  white-space: pre-wrap;
}

/* Buttons — unified height */
.${SCOPE} .btn{
  display:inline-flex; align-items:center; gap:.55rem;
  border-radius:14px; padding:0 .95rem; font-size:14px; line-height:1;
  height:40px; border:1px solid var(--va-border);
}
.${SCOPE} .btn--h{ height:40px; }
.${SCOPE} .btn--green{ background:${TOKENS.accent}; color:#fff; box-shadow:${TOKENS.shadow}; transition:background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${TOKENS.accentHover}; }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; border-color:rgba(220,38,38,.35); }

/* Main — honors dynamic widths + 4px gutters on both sides */
.${SCOPE} .va-main{
  max-width: none !important;
}

/* Make sure no child can exceed its box width */
.${SCOPE} .va-main *{ min-width: 0; }
`}</style>
  );
}
