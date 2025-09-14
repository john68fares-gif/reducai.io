// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Copy, Sparkles, ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  UploadCloud, RefreshCw, X, Phone as PhoneIcon, Rocket, PhoneOff, MessageSquare, ListTree,
  AudioLines, Volume2, Save, Trash2, KeyRound
} from 'lucide-react';

import AssistantRail, { type AssistantLite } from '@/components/voice/AssistantRail';
import WebCallButton from '@/components/voice/WebCallButton';
import { scopedStorage } from '@/utils/scoped-storage';

/* ======= Theme (Cosmic Night from your screenshots) ======= */
const SCOPE = 'va-scope';
const ACCENT_DARK = 'oklch(0.5417 0.1790 288.0332)';     // purple
const TEXT_DARK = 'oklch(0.3015 0.0572 282.8)';
const CARD_DARK = '#0e1213';
const BG_DARK   = '#0b0f12';

type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type PhoneNum = { id: string; label?: string; e164: string };
type TranscriptTurn = { role: 'assistant' | 'user'; text: string; ts: number };

type CallLog = {
  id: string;
  assistantId: string;
  assistantName: string;
  startedAt: number;
  endedAt?: number;
  endedReason?: string;
  type: 'Web';
  assistantPhoneNumber?: string;
  transcript: TranscriptTurn[];
  costUSD?: number;
};

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
    telephony?: { numbers: PhoneNum[]; linkedNumberId?: string };
  };
};

type ApiKey = { id: string; name: string; key: string; provider?: 'openai'|'elevenlabs'|'deepgram' };

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

/* =================== small helpers/LS =================== */
const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

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

/* -------------------- Prompt helpers -------------------- */
function sectionRegex(name: string) {
  return new RegExp(String.raw`\[${name}\]\s*([\s\S]*?)(?=\n\[|$)`, 'i');
}
function setSection(prompt: string, name: string, body: string) {
  const re = sectionRegex(name);
  if (re.test(prompt)) return prompt.replace(re, `[${name}]\n${body.trim()}\n`);
  const nl = prompt.endsWith('\n') ? '' : '\n';
  return `${prompt}${nl}\n[${name}]\n${body.trim()}\n`;
}
function mergeInput(freeText: string, current: string) {
  const out = { prompt: current || BASE_PROMPT, firstMessage: undefined as string | undefined };
  const raw = (freeText || '').trim();
  if (!raw) return out;
  const m = raw.match(/^(?:first\s*message|greeting)\s*[:\-]\s*(.+)$/i);
  if (m) { out.firstMessage = m[1].trim(); return out; }
  const blocks = [...raw.matchAll(/\[(Identity|Style|System Behaviors|Task & Goals|Data to Collect|Safety|Handover|Refinements)\]\s*([\s\S]*?)(?=\n\[|$)/gi)];
  if (blocks.length) {
    let next = out.prompt;
    for (const b of blocks) next = setSection(next, b[1], b[2]);
    out.prompt = next;
    return out;
  }
  const hasRef = sectionRegex('Refinements').test(out.prompt);
  const bullet = `- ${raw.replace(/\s+/g, ' ').trim()}`;
  out.prompt = hasRef
    ? out.prompt.replace(sectionRegex('Refinements'), (_m, body) => `[Refinements]\n${(body || '').trim()}\n${bullet}\n`)
    : `${out.prompt}\n\n[Refinements]\n${bullet}\n`;
  return out;
}

/* -------------------- UI atoms -------------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>{label}</div>
      {children}
    </div>
  );
}
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 rounded-xl relative"
         style={{ background: 'var(--va-card)', border: '1px solid var(--va-border)', boxShadow: 'var(--va-shadow)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-[22%] -left-[22%] w-[70%] h-[70%] rounded-full"
           style={{ background: 'radial-gradient(circle, color-mix(in oklab, var(--accent) 18%, transparent) 0%, transparent 70%)', filter: 'blur(46px)' }} />
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-4">
        <span className="flex items-center gap-2 text-sm font-semibold">{icon}{title}</span>
        {open ? <ChevronDown className="w-4 h-4 icon" /> : <ChevronRight className="w-4 h-4 icon" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }} className="px-5 pb-5">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------- Telephony editor -------------------- */
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
    <div className="space-y-4">
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, minmax(240px, 1fr))' }}>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>Phone Number (E.164)</div>
          <input value={e164} onChange={(e) => setE164(e.target.value)} placeholder="+1xxxxxxxxxx"
                 className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none native-input"
                 style={{ color: 'var(--text)' }}/>
        </div>
        <div>
          <div className="mb-1.5 text-[13px] font-medium" style={{ color: 'var(--text)' }}>Label</div>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Support line"
                 className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none native-input"
                 style={{ color: 'var(--text)' }}/>
        </div>
        <div className="flex items-end">
          <button onClick={() => { onAdd(e164, label); setE164(''); setLabel(''); }} className="btn btn--green w-full justify-center">
            <PhoneIcon className="w-4 h-4 text-white" /><span className="text-white">Add Number</span>
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {numbers.length === 0 && <div className="text-sm opacity-70">No phone numbers added yet.</div>}
        {numbers.map(n => (
          <div key={n.id} className="flex items-center justify-between rounded-xl px-3 py-2 native-surface">
            <div className="min-w-0">
              <div className="font-medium truncate">{n.label || 'Untitled'}</div>
              <div className="text-xs opacity-70">{n.e164}</div>
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs">
                <input type="radio" name="linked_number" checked={linkedId === n.id} onChange={() => onLink(n.id)} />
                Linked
              </label>
              <button onClick={() => onRemove(n.id)} className="btn btn--danger text-xs"><Trash2 className="w-4 h-4" /> Remove</button>
            </div>
          </div>
        ))}
        {numbers.length > 0 && <div className="text-xs opacity-70">The number marked as <b>Linked</b> will be attached to this assistant on <i>Publish</i>.</div>}
      </div>
    </div>
  );
}

/* -------------------- Scoped CSS (Cosmic Night + select fix) -------------------- */
function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  --accent:${ACCENT_DARK};
  --bg:${BG_DARK};
  --text:${TEXT_DARK};
  --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:${CARD_DARK};
  --va-topbar:${CARD_DARK};
  --va-sidebar:linear-gradient(180deg,#0e1213 0%,#0b0f12 100%);
  --va-chip:rgba(255,255,255,.04);
  --va-border:oklch(0.9115 0.0216 285.9625 / .16);
  --va-input-bg:#101314;
  --va-input-border:oklch(0.9115 0.0216 285.9625 / .22);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  --va-menu-bg:#101314;
  --va-menu-border:oklch(0.9115 0.0216 285.9625 / .22);
  --va-shadow:0 36px 90px rgba(0,0,0,.60), 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(140,140,255,.10);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.35);
  --va-rail-w:360px;
}
.${SCOPE} .va-main{ max-width: none !important; color:var(--text); }
.${SCOPE} .icon{ color: var(--accent); }

.${SCOPE} .btn{
  display:inline-flex; align-items:center; gap:.5rem;
  border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1;
  border:1px solid var(--va-border);
  background: var(--va-card); color: var(--text);
}
.${SCOPE} .btn--green{ background: var(--accent); color:#fff; box-shadow: 0 10px 24px color-mix(in oklab, var(--accent) 30%, transparent); }
.${SCOPE} .btn--green:hover{ filter: brightness(1.06); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; border-color:rgba(220,38,38,.35); }

.${SCOPE} .native-input{
  background: var(--va-input-bg);
  border: 1px solid var(--va-input-border);
  box-shadow: var(--va-input-shadow);
  color: var(--text);
}

/* fix native select look */
.${SCOPE} select{
  appearance:none; -webkit-appearance:none; -moz-appearance:none;
  background: var(--va-input-bg);
  border: 1px solid var(--va-input-border);
  box-shadow: var(--va-input-shadow);
  color: var(--text);
  border-radius: 14px; padding: .75rem .9rem;
}
.${SCOPE} select:focus{
  outline:none;
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--accent) 22%, transparent);
}
.${SCOPE} textarea{
  background: var(--va-input-bg);
  border: 1px solid var(--va-input-border);
  box-shadow: var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03);
  color: var(--text);
}
.${SCOPE} .native-surface{
  background: var(--va-input-bg);
  border: 1px solid var(--va-input-border);
}

@media (max-width: 1180px){ .${SCOPE}{ --va-rail-w: 320px; } }
`}</style>
  );
}

/* ========================================================================== */
/*                                   PAGE                                     */
/* ========================================================================== */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);

  // client gate
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  // assistants
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<Assistant | null>(null);
  const [rev, setRev] = useState(0);

  // API Key state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState<string>('');
  const [openaiKey, setOpenaiKey] = useState<string>('');

  /* -------------------- bootstrap -------------------- */
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

    // Load API keys from scoped storage
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        const keys = await ss.getJSON<ApiKey[]>(LS_KEYS, []);
        const cleaned = (keys || []).filter(k => k?.id && (k.provider === 'openai' || !k.provider)) as ApiKey[];
        setApiKeys(cleaned);
        const sel = await ss.getJSON<string>(LS_SELECTED, '');
        const chosen = cleaned.find(k => k.id === sel) ? sel : (cleaned[0]?.id || '');
        setApiKeyId(chosen);
        const match = cleaned.find(k => k.id === chosen);
        setOpenaiKey(match?.key ? String(match.key) : '');
      } catch {
        setApiKeys([]); setApiKeyId(''); setOpenaiKey('');
      }
    })();
  }, [isClient]);

  // persist selected key id globally
  useEffect(() => {
    (async () => {
      try {
        const ss = await scopedStorage();
        await ss.ensureOwnerGuard();
        if (apiKeyId) await ss.setJSON(LS_SELECTED, apiKeyId);
      } catch {}
    })();
  }, [apiKeyId]);

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

  // Create/Delete/Rename for AssistantRail
  const [creating, setCreating] = useState(false);
  const onCreate = async () => {
    setCreating(true);
    await new Promise(r => setTimeout(r, 240));
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
    setCreating(false);
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

  // Generate overlay (prompt merge)
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typingPreview, setTypingPreview] = useState<string | null>(null);
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);

  const handleGenerate = () => {
    if (!active) return;
    const current = active.config.model.systemPrompt || '';
    const { prompt, firstMessage } = mergeInput(genText, current || BASE_PROMPT);
    setTypingPreview(prompt);
    setPendingFirstMsg(firstMessage);
    setGenOpen(false);
    setGenText('');
  };
  const acceptGenerate = () => {
    if (!active) return;
    updateActive(a => ({
      ...a,
      config: { ...a.config, model: { ...a.config.model, systemPrompt: typingPreview || a.config.model.systemPrompt, firstMessage: typeof pendingFirstMsg === 'string' ? pendingFirstMsg : a.config.model.firstMessage } }
    }));
    setTypingPreview(null); setPendingFirstMsg(undefined);
  };
  const declineGenerate = () => { setTypingPreview(null); setPendingFirstMsg(undefined); };

  // Voice select/fns
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

  // Telephony helpers
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

  // Transcript + call logs
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

  if (!isClient) return (<div ref={scopeRef} className={SCOPE}><StyleBlock /><div className="px-6 py-10 opacity-70 text-sm">Loading…</div></div>);
  if (!active) return (<div ref={scopeRef} className={SCOPE}><StyleBlock /><div className="px-6 py-10 opacity-70">Create your first assistant.</div></div>);

  const railData: AssistantLite[] = assistants.map(a => ({ id: a.id, name: a.name, folder: a.folder, updatedAt: a.updatedAt }));

  const greet = active.config.model.firstMessageMode === 'assistant_first'
    ? (active.config.model.firstMessage || 'Hello. How may I help you today?')
    : 'Listening…';

  const linkedE164 = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164 || '';

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <AssistantRail assistants={railData} activeId={activeId} onSelect={setActiveId} onCreate={onCreate} onRename={onRename} onDelete={onDelete} />

      <div className="va-main" style={{ marginLeft: `calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`, paddingRight: 'clamp(20px, 4vw, 40px)', paddingTop: 'calc(var(--app-header-h, 64px) + 12px)', paddingBottom: '88px' }}>

        {/* Top actions */}
        <div className="px-2 pb-3 flex items-center justify-between sticky" style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
          <div className="flex items-center gap-2">
            {!currentCallId ? (
              <WebCallButton
                greet={greet}
                voiceLabel={active.config.voice.voiceLabel}
                systemPrompt={active.config.model.systemPrompt || BASE_PROMPT}
                model={active.config.model.model}
                apiKeyId={apiKeyId}
                apiKey={openaiKey}
                fromE164={linkedE164}
                onTurn={onTurn}
              />
            ) : (
              <button onClick={() => { endWebCallSession('Ended by user'); window.speechSynthesis?.cancel(); }} className="btn btn--danger">
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            )}

            <button onClick={() => window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail: { id: active.id } }))} className="btn">
              <MessageSquare className="w-4 h-4 icon" /> Chat
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* API Key dropdown */}
            <div className="relative">
              <select
                value={apiKeyId}
                onChange={(e) => {
                  const id = e.target.value;
                  setApiKeyId(id);
                  const match = apiKeys.find(k => k.id === id);
                  setOpenaiKey(match?.key ? String(match.key) : '');
                }}
                className="pr-9"
                style={{ minWidth: 240 }}
              >
                <option value="">Select OpenAI key…</option>
                {apiKeys.map(k => (
                  <option key={k.id} value={k.id}>{k.name} ••••{(k.key || '').slice(-4).toUpperCase()}</option>
                ))}
              </select>
              <KeyRound className="w-4 h-4 absolute right-3 top-3.5" style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Key badge */}
            <span className="text-xs px-2 py-1 rounded-lg" style={{ border:'1px solid var(--va-border)' }}>
              Key: {openaiKey ? `••••${openaiKey.slice(-4)}` : '—'}
            </span>

            <button onClick={() => navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})} className="btn">
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={() => onDelete(active.id)} className="btn btn--danger"><Trash2 className="w-4 h-4" /> Delete</button>
            <button onClick={publish} className="btn btn--green"><Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span></button>
          </div>
        </div>

        {/* Body */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth: 'min(2400px, 98vw)' }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(4, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <select value={active.config.model.provider} onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, provider: e.target.value as Provider } } }))}>
                  <option value="openai">OpenAI</option>
                </select>
              </Field>
              <Field label="Model">
                <select value={active.config.model.model} onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, model: e.target.value as ModelId } } }))}>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o mini</option>
                  <option value="gpt-4.1">GPT-4.1</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                </select>
              </Field>
              <Field label="First Message Mode">
                <select value={active.config.model.firstMessageMode} onChange={e => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessageMode: e.target.value as any } } }))}>
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </select>
              </Field>
              <Field label="First Message">
                <input value={active.config.model.firstMessage} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, firstMessage: e.target.value } } }))} className="native-input" />
              </Field>
            </div>

            {/* System Prompt */}
            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> System Prompt</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: BASE_PROMPT } } }))} className="btn">
                    <RefreshCw className="w-4 h-4 icon" /> Reset
                  </button>
                  <button onClick={() => setGenOpen(true)} className="btn btn--green">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              {!typingPreview ? (
                <textarea rows={26} value={active.config.model.systemPrompt || ''} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, model: { ...a.config.model, systemPrompt: e.target.value } } }))} />
              ) : (
                <div>
                  <div className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6"
                       style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)', boxShadow: 'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color: 'var(--text)', whiteSpace: 'pre-wrap', minHeight: 560, maxHeight: 680, overflowY: 'auto' }}>
                    {typingPreview}
                  </div>
                  <div className="flex items-center gap-2 justify-end mt-3">
                    <button onClick={() => { setTypingPreview(null); setPendingFirstMsg(undefined); }} className="btn"><X className="w-4 h-4 icon" /> Decline</button>
                    <button onClick={acceptGenerate} className="btn btn--green"><span className="text-white"><ChevronRight /> Accept</span></button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <select value={active.config.voice.provider} onChange={(e) => handleVoiceProviderChange(e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>
              <Field label="Voice">
                <select value={pendingVoiceId || active.config.voice.voiceId} onChange={(e) => handleVoiceIdChange(e.target.value)}>
                  {(active.config.voice.provider === 'elevenlabs' ? [
                    { value: 'rachel', label: 'Rachel (ElevenLabs)' },
                    { value: 'adam', label: 'Adam (ElevenLabs)' },
                    { value: 'bella', label: 'Bella (ElevenLabs)' },
                  ] : [
                    { value: 'alloy', label: 'Alloy (OpenAI)' },
                    { value: 'ember', label: 'Ember (OpenAI)' },
                  ]).map(v => (<option key={v.value} value={v.value}>{v.label}</option>))}
                </select>
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={async () => { try { const u = new SpeechSynthesisUtterance('This is a quick preview of the selected voice.'); window.speechSynthesis.cancel(); window.speechSynthesis.speak(u); } catch {} }} className="btn">
                <Volume2 className="w-4 h-4 icon" /> Test Voice
              </button>
              <button onClick={saveVoice} className="btn btn--green">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
              <button onClick={() => { window.dispatchEvent(new CustomEvent('voiceagent:import-11labs')); alert('Hook “voiceagent:import-11labs” to your importer.'); }} className="btn">
                <UploadCloud className="w-4 h-4 icon" /> Import from ElevenLabs
              </button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(3, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <select value={active.config.transcriber.provider} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, provider: e.target.value as any } } }))}>
                  <option value="deepgram">Deepgram</option>
                </select>
              </Field>
              <Field label="Model">
                <select value={active.config.transcriber.model} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, model: e.target.value as any } } }))}>
                  <option value="nova-2">Nova 2</option>
                  <option value="nova-3">Nova 3</option>
                </select>
              </Field>
              <Field label="Language">
                <select value={active.config.transcriber.language} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, language: e.target.value as any } } }))}>
                  <option value="en">English</option>
                  <option value="multi">Multi</option>
                </select>
              </Field>

              <Field label="Confidence Threshold">
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={1} step={0.01} value={active.config.transcriber.confidenceThreshold}
                         onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, confidenceThreshold: Number(e.target.value) } } }))} className="w-full" />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{active.config.transcriber.confidenceThreshold.toFixed(2)}</span>
                </div>
              </Field>
              <Field label="Denoise">
                <select value={String(active.config.transcriber.denoise)} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, denoise: e.target.value === 'true' } } }))}>
                  <option value="false">Off</option>
                  <option value="true">On</option>
                </select>
              </Field>
              <Field label="Use Numerals">
                <select value={String(active.config.transcriber.numerals)} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, transcriber: { ...a.config.transcriber, numerals: e.target.value === 'true' } } }))}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* Tools */}
          <Section title="Tools" icon={<SlidersHorizontal className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns: 'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Enable End Call Function">
                <select value={String(active.config.tools.enableEndCall)} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, enableEndCall: e.target.value === 'true' } } }))}>
                  <option value="true">Enabled</option>
                  <option value="false">Disabled</option>
                </select>
              </Field>
              <Field label="Dial Keypad">
                <select value={String(active.config.tools.dialKeypad)} onChange={(e) => updateActive(a => ({ ...a, config: { ...a.config, tools: { ...a.config.tools, dialKeypad: e.target.value === 'true' } } }))}>
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
            <div className="rounded-2xl p-3 native-surface">
              {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                {transcript.map((t, idx) => (
                  <div key={idx} className="flex gap-2">
                    <div className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: t.role === 'assistant' ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : 'rgba(255,255,255,.06)',
                      border: '1px solid var(--va-border)'
                    }}>{t.role === 'assistant' ? 'AI' : 'You'}</div>
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
              {callsForAssistant.map(log => (
                <details key={log.id} className="rounded-xl native-surface">
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
                          background: t.role === 'assistant' ? 'color-mix(in oklab, var(--accent) 20%, transparent)' : 'rgba(255,255,255,.06)',
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

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      style={{ background: 'rgba(0,0,0,.45)' }}>
            <motion.div initial={{ y: 10, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 8, opacity: 0, scale: .985 }}
                        className="w-full max-w-2xl rounded-2xl native-surface" style={{ boxShadow: 'var(--va-shadow)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--va
