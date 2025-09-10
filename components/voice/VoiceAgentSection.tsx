'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scopedStorage } from '@/utils/scoped-storage';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff, MessageSquare, ListTree, AudioLines, Volume2, Save,
  KeyRound
} from 'lucide-react';

import AssistantRail from './AssistantRail';
import WebCallButton from './WebCallButton';

/* =============================================================================
CONFIG
============================================================================= */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

const TICK_MS = 10;
const CHUNK_SIZE = 6;

type Provider = 'openai';
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-3.5-turbo';
type VoiceProvider = 'openai' | 'elevenlabs';

type PhoneNum = { id: string; label?: string; e164: string };

type TranscriptTurn = { role: 'assistant'|'user'; text: string; ts: number };
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

const LS_LIST   = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS  = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

// API Keys buckets (same as your Step2)
type ApiKey = { id: string; name: string; key: string };
const LS_KEYS = 'apiKeys.v1';
const LS_SELECTED = 'apiKeys.selectedId';

/* =============================================================================
UTILS
============================================================================= */
const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* =============================================================================
DIFF with add/remove highlighting
============================================================================= */
type DiffTok = { ch: string; added?: boolean; removed?: boolean };
function diffChars(a: string, b: string): DiffTok[] {
  // LCS to mark removals/additions
  const A = [...a], B = [...b];
  const dp = Array(A.length + 1).fill(0).map(() => Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) {
    for (let j = B.length - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i+1][j+1] + 1 : Math.max(dp[i+1][j], dp[i][j+1]);
    }
  }
  const out: DiffTok[] = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] === B[j]) { out.push({ ch: B[j] }); i++; j++; }
    else if (dp[i+1][j] >= dp[i][j+1]) { out.push({ ch: A[i], removed: true }); i++; }
    else { out.push({ ch: B[j], added: true }); j++; }
  }
  while (i < A.length) out.push({ ch: A[i++], removed: true });
  while (j < B.length) out.push({ ch: B[j++], added: true });
  return out;
}

/* =============================================================================
BROWSER SPEAK fallback (same as before)
============================================================================= */
async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;
  await new Promise(res => {
    const t = setInterval(() => {
      voices = synth.getVoices();
      if (voices.length) { clearInterval(t); res(null); }
    }, 50);
    setTimeout(() => { clearInterval(t); res(null); }, 1500);
  });
  return synth.getVoices();
}
async function speakWithVoice(text: string, voiceLabel: string){
  const synth = window.speechSynthesis;
  try { synth.resume(); } catch {}
  const voices = await ensureVoicesReady();
  const prefs = (voiceLabel || '').toLowerCase().includes('ember')
    ? ['Samantha','Google US English','Serena','Victoria','Alex','Microsoft Aria']
    : (voiceLabel || '').toLowerCase().includes('alloy')
    ? ['Alex','Daniel','Google UK English Male','Microsoft David','Fred','Samantha']
    : ['Google US English','Samantha','Alex','Daniel'];
  const pick = () => {
    for (const p of prefs) {
      const v = voices.find(v => v.name.toLowerCase().includes(p.toLowerCase()));
      if (v) return v;
    }
    return voices.find(v => /en-|english/i.test(`${v.lang} ${v.name}`)) || voices[0];
  };
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pick(); u.rate = 1; u.pitch = 0.95; u.volume = 1;
  synth.cancel(); synth.speak(u);
}

/* =============================================================================
PROMPT GEN (server)
============================================================================= */
async function generatePromptViaLLM({
  apiKey, model, currentPrompt, userNote,
}: { apiKey?: string; model: string; currentPrompt: string; userNote: string; }): Promise<{ prompt: string; firstMessage?: string }> {
  const r = await fetch('/api/generate-prompt', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(apiKey ? { 'x-openai-key': apiKey } : {}),
    },
    body: JSON.stringify({ model, currentPrompt, userNote }),
  });
  if (!r.ok) throw new Error('gen failed');
  return await r.json();
}

/* =============================================================================
PAGE
============================================================================= */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  /* Assistants boot (unchanged logic from your original) */
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
        folder: 'Health',
        updatedAt: Date.now(),
        published: false,
        config: {
          model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: 'You are a helpful assistant.' },
          voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
          transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
          tools: { enableEndCall:true, dialKeypad:true },
          telephony: { numbers: [], linkedNumberId: undefined }
        }
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      setAssistants(list); setActiveId(list[0].id);
    }
    if (!readLS<CallLog[]>(LS_CALLS)) writeLS(LS_CALLS, []);
    if (!readLS<Record<string,string>>(LS_ROUTES)) writeLS(LS_ROUTES, {});
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

  /* ----------------------- API KEYS (dropdown) ----------------------- */
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyId, setApiKeyId] = useState('');
  const [apiKeyVal, setApiKeyVal] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isClient) return;
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      const v1 = await ss.getJSON<ApiKey[]>(LS_KEYS, []);
      const legacy = await ss.getJSON<ApiKey[]>('apiKeys', []);
      const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];
      const cleaned = merged.filter(Boolean).map((k: any) => ({
        id: String(k?.id || ''),
        name: String(k?.name || ''),
        key: String(k?.key || ''),
      })).filter(k => k.id && k.name);
      setApiKeys(cleaned);

      const globalSelected = await ss.getJSON<string>(LS_SELECTED, '');
      const chosen = (globalSelected && cleaned.some(k => k.id === globalSelected))
        ? globalSelected
        : (cleaned[0]?.id || '');
      setApiKeyId(chosen);
      const found = cleaned.find(k => k.id === chosen);
      setApiKeyVal(found?.key || undefined);
    })();
  }, [isClient]);

  const handleSelectKey = async (id: string) => {
    setApiKeyId(id);
    const found = apiKeys.find(k => k.id === id);
    setApiKeyVal(found?.key || undefined);
    try {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      await ss.setJSON(LS_SELECTED, id);
    } catch {}
  };

  /* ----------------------- Prompt Generate overlay ----------------------- */
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');
  const [typing, setTyping] = useState<DiffTok[] | null>(null);
  const [typedCount, setTypedCount] = useState(0);
  const [lastNew, setLastNew] = useState('');
  const [pendingFirstMsg, setPendingFirstMsg] = useState<string | undefined>(undefined);
  const typingTimer = useRef<number | null>(null);
  const typingBoxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!typingBoxRef.current) return;
    typingBoxRef.current.scrollTop = typingBoxRef.current.scrollHeight;
  }, [typedCount]);

  const startTyping = (tokens: DiffTok[]) => {
    setTyping(tokens); setTypedCount(0);
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

  const handleGenerate = async () => {
    if (!active) return;
    try {
      const { prompt, firstMessage } = await generatePromptViaLLM({
        apiKey: apiKeyVal,
        model: active.config.model.model,
        currentPrompt: active.config.model.systemPrompt || '',
        userNote: genText || '',
      });
      setLastNew(prompt);
      setPendingFirstMsg(firstMessage);
      startTyping(diffChars(active.config.model.systemPrompt || '', prompt));
      setGenOpen(false);
      setGenText('');
    } catch {
      // If key/model fails, just show a minimal failure diff
      const fallback = (genText || '').trim() ? `${(active.config.model.systemPrompt||'').trim()}\n\n[Refinements]\n- ${genText.trim()}` : (active.config.model.systemPrompt||'');
      setLastNew(fallback);
      startTyping(diffChars(active.config.model.systemPrompt || '', fallback));
      setGenOpen(false);
    }
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
          firstMessage: typeof pendingFirstMsg === 'string'
            ? pendingFirstMsg
            : a.config.model.firstMessage
        }
      }
    }));
    setTyping(null);
    setPendingFirstMsg(undefined);
  };
  const declineTyping = () => { setTyping(null); setPendingFirstMsg(undefined); };

  /* ----------------------- Transcript + WebCall ----------------------- */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);

  function pushTurn(role: 'assistant'|'user', text: string) {
    const turn = { role, text, ts: Date.now() };
    setTranscript(t => [...t, turn]);
  }

  async function startCall() {
    if (!active) return;
    setTranscript([]);
    setCurrentCallId(`call_${Math.random().toString(36).slice(2)}`);
    if (active.config.model.firstMessageMode === 'assistant_first') {
      const greet = active.config.model.firstMessage || 'Hello. How may I help you today?';
      pushTurn('assistant', greet);
      await speakWithVoice(greet, active.config.voice.voiceLabel);
    }
  }
  function endCall(reason: string) {
    setCurrentCallId(null);
    try { window.speechSynthesis.cancel(); } catch {}
  }

  /* ------------------------ UI ------------------------ */
  if (!isClient) {
    return (<div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      <StyleBlock /><div className="px-6 py-10 opacity-70 text-sm">Loading…</div></div>);
  }
  if (!active) {
    return (<div ref={scopeRef} className={SCOPE} style={{ color:'var(--text)' }}>
      <div className="px-6 py-10 opacity-70">Create your first assistant.</div><StyleBlock /></div>);
  }

  const visible = assistants;
  const apiKeyItems = apiKeys.map(k => ({ value: k.id, label: `${k.name} ••••${(k.key||'').slice(-4).toUpperCase()}` }));

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Rail (kept same visuals) */}
      <AssistantRail
        assistants={visible.map(a => ({ id:a.id, name:a.name, folder:a.folder, updatedAt:a.updatedAt }))}
        activeId={activeId}
        onSelect={setActiveId}
        onCreate={() => {
          const id = `agent_${Math.random().toString(36).slice(2,8)}`;
          const a: Assistant = {
            id, name:'New Assistant', updatedAt: Date.now(), published:false,
            config: {
              model: { provider:'openai', model:'gpt-4o', firstMessageMode:'assistant_first', firstMessage:'Hello.', systemPrompt: 'You are a helpful assistant.' },
              voice: { provider:'openai', voiceId:'alloy', voiceLabel:'Alloy (OpenAI)' },
              transcriber: { provider:'deepgram', model:'nova-2', language:'en', denoise:false, confidenceThreshold:0.4, numerals:false },
              tools: { enableEndCall:true, dialKeypad:true },
              telephony: { numbers: [], linkedNumberId: undefined }
            }
          };
          writeLS(ak(id), a);
          const list = [...assistants, a]; writeLS(LS_LIST, list);
          setAssistants(list); setActiveId(id);
        }}
        onRename={(id, name) => {
          const cur = readLS<Assistant>(ak(id)); if (cur) writeLS(ak(id), { ...cur, name, updatedAt: Date.now() });
          const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === id ? { ...x, name, updatedAt: Date.now() } : x);
          writeLS(LS_LIST, list); setAssistants(list); setRev(r => r+1);
        }}
        onDelete={(id) => {
          const list = assistants.filter(a => a.id !== id);
          writeLS(LS_LIST, list); setAssistants(list);
          localStorage.removeItem(ak(id));
          if (activeId === id && list.length) setActiveId(list[0].id);
          if (!list.length) setActiveId('');
          setRev(r => r + 1);
        }}
      />

      {/* Main */}
      <div
        className="va-main"
        style={{
          marginLeft:`calc(var(--app-sidebar-w, 248px) + var(--va-rail-w, 360px))`,
          paddingRight:'clamp(20px, 4vw, 40px)',
          paddingTop:'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom:'88px'
        }}
      >
        {/* top action bar */}
        <div className="px-2 pb-3 flex items-center justify-between sticky"
             style={{ top:'calc(var(--app-header-h, 64px) + 8px)', zIndex:2 }}>
          <div className="flex items-center gap-2">
            {!currentCallId ? (
              <WebCallButton
                greet={active.config.model.firstMessage || 'Hello.'}
                voiceLabel={active.config.voice.voiceLabel}
                systemPrompt={active.config.model.systemPrompt || 'You are a helpful assistant.'}
                model={active.config.model.model}
                onTurn={(r,t)=> pushTurn(r,t)}
                apiKey={apiKeyVal} // <-- uses selected key
              />
            ) : (
              <button onClick={()=> endCall('Ended by user')} className="btn btn--danger">
                <PhoneOff className="w-4 h-4" /> End Call
              </button>
            )}
            <button onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail:{ id: active.id } }))} className="btn btn--ghost">
              <MessageSquare className="w-4 h-4 icon" /> Chat
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* KEY DROPDOWN (same style tokens) */}
            <div style={{ minWidth: 280 }}>
              <Field label="OpenAI Key">
                <Select
                  value={apiKeyId || ''}
                  onChange={(v)=> handleSelectKey(v)}
                  leftIcon={<KeyRound className="w-4 h-4 icon" />}
                  items={apiKeyItems}
                  placeholder="Pick a saved key…"
                />
              </Field>
            </div>

            <button
              onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
              className="btn btn--ghost"
            >
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> {
              const linkedId = active.config.telephony?.linkedNumberId;
              const numbers = active.config.telephony?.numbers ?? [];
              const num = numbers.find(n=>n.id===linkedId);
              if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
              const routes = readLS<Record<string,string>>(LS_ROUTES) || {};
              routes[num.id] = active.id; writeLS(LS_ROUTES, routes);
              updateActive(a => ({ ...a, published: true }));
              alert(`Published! ${num.e164} is now linked to ${active.name}.`);
            }} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {/* content body */}
        <div className="mx-auto grid grid-cols-12 gap-10" style={{ maxWidth:'min(2400px, 98vw)' }}>
          {/* Model */}
          <Section title="Model" icon={<FileText className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(4, minmax(360px, 1fr))' }}>
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
                    onClick={()=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: 'You are a helpful assistant.' } } }))}
                    className="btn btn--ghost"
                  ><RefreshCw className="w-4 h-4 icon" /> Reset</button>
                  <button onClick={()=> setGenOpen(true)} className="btn btn--green">
                    <Sparkles className="w-4 h-4 text-white" /> <span className="text-white">Generate / Edit</span>
                  </button>
                </div>
              </div>

              {!typing ? (
                <textarea
                  rows={26}
                  value={active.config.model.systemPrompt || ''}
                  onChange={(e)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, systemPrompt: e.target.value } } }))}
                  className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                  style={{
                    background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                    boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                    fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    minHeight: 560
                  }}
                />
              ) : (
                <div>
                  <div
                    ref={typingBoxRef}
                    className="w-full rounded-2xl px-3 py-3 text-[14px] leading-6 outline-none"
                    style={{
                      background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)',
                      boxShadow:'var(--va-shadow), inset 0 1px 0 rgba(255,255,255,.03)', color:'var(--text)',
                      fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                      whiteSpace:'pre-wrap', minHeight: 560, maxHeight: 680, overflowY:'auto'
                    }}
                  >
                    {(() => {
                      const slice = typing.slice(0, typedCount);
                      const out: JSX.Element[] = [];
                      let buf = ''; let mode: 'norm'|'add'|'rem' = slice.length ? (slice[0].added ? 'add' : slice[0].removed ? 'rem' : 'norm') : 'norm';
                      const push = (m: typeof mode, s: string, i: number) => {
                        if (!s) return;
                        if (m==='add') out.push(<ins key={`a-${i}`} style={{ background:'rgba(16,185,129,.18)', padding:'1px 2px', borderRadius:4 }}>{s}</ins>);
                        else if (m==='rem') out.push(<del key={`r-${i}`} style={{ background:'rgba(239,68,68,.18)', padding:'1px 2px', borderRadius:4, textDecorationColor:'rgba(239,68,68,.7)' }}>{s}</del>);
                        else out.push(<span key={`n-${i}`}>{s}</span>);
                      };
                      slice.forEach((t, i) => {
                        const m = t.added ? 'add' : t.removed ? 'rem' : 'norm';
                        if (m !== mode) { push(mode, buf, i); buf = t.ch; mode = m; }
                        else { buf += t.ch; }
                      });
                      if (buf) push(mode, buf, 99999);
                      if (typedCount < (typing?.length || 0)) out.push(<span key="caret" className="animate-pulse"> ▌</span>);
                      return out;
                    })()}
                  </div>

                  <div className="flex items-center gap-2 justify-end mt-3">
                    <button onClick={declineTyping} className="btn btn--ghost"><X className="w-4 h-4 icon" /> Decline</button>
                    <button onClick={acceptTyping} className="btn btn--green"><Check className="w-4 h-4 text-white" /><span className="text-white">Accept</span></button>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* Voice (unchanged controls) */}
          <Section title="Voice" icon={<Mic2 className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(2, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select
                  value={active.config.voice.provider}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, provider: v as any } } }))}
                  items={[{ value:'openai', label:'OpenAI' }, { value:'elevenlabs', label:'ElevenLabs' }]}
                />
              </Field>
              <Field label="Voice">
                <Select
                  value={active.config.voice.voiceId}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId: v, voiceLabel: v } } }))}
                  items={[
                    ...(active.config.voice.provider==='elevenlabs'
                      ? [{ value:'rachel', label:'Rachel (ElevenLabs)' }, { value:'adam', label:'Adam (ElevenLabs)' }, { value:'bella', label:'Bella (ElevenLabs)' }]
                      : [{ value:'alloy', label:'Alloy (OpenAI)' }, { value:'ember', label:'Ember (OpenAI)' }])
                  ]}
                />
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button onClick={()=> speakWithVoice('This is a quick preview of the selected voice.', active.config.voice.voiceLabel)} className="btn btn--ghost">
                <Volume2 className="w-4 h-4 icon" /> Test Voice
              </button>
              <button onClick={()=> speakWithVoice('Voice saved.', active.config.voice.voiceLabel)} className="btn btn--green">
                <Save className="w-4 h-4 text-white" /> <span className="text-white">Save Voice</span>
              </button>
            </div>
          </Section>

          {/* Transcriber / Tools / Telephony sections -> keep your prior code or trim */}
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
        </div>
      </div>

      {/* Generate overlay */}
      <AnimatePresence>
        {genOpen && (
          <motion.div className="fixed inset-0 z-[999] flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ background:'rgba(0,0,0,.45)' }}>
            <motion.div
              initial={{ y:10, opacity:0, scale:.98 }} animate={{ y:0, opacity:1, scale:1 }} exit={{ y:8, opacity:0, scale:.985 }}
              className="w-full max-w-2xl rounded-2xl"
              style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow-lg)' }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid var(--va-border)' }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Sparkles className="w-4 h-4 icon" /> Generate / Edit Prompt</div>
                <button onClick={()=> setGenOpen(false)} className="p-2 rounded-lg hover:opacity-80"><X className="w-4 h-4 icon" /></button>
              </div>
              <div className="p-4">
                <input
                  value={genText}
                  onChange={(e)=> setGenText(e.target.value)}
                  placeholder={`Tell me what to improve (tone, data to collect, first message, rules)…`}
                  className="w-full rounded-2xl px-3 py-3 text-[15px] outline-none"
                  style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)', color:'var(--text)' }}
                />
                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={()=> setGenOpen(false)} className="btn btn--ghost">Cancel</button>
                  <button onClick={handleGenerate} className="btn btn--green"><span className="text-white">Generate</span></button>
                </div>
              </div>
            </motion.div>
          </motion.div>
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
  return (<div><div className="mb-1.5 text-[13px] font-medium" style={{ color:'var(--text)' }}>{label}</div>{children}</div>);
}

type Item = { value: string; label: string; icon?: React.ReactNode; leftIcon?: React.ReactNode };
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
        className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-[15px]"
        style={{ background:'var(--va-input-bg)', color:'var(--text)', border:'1px solid var(--va-input-border)', boxShadow:'var(--va-input-shadow)' }}
      >
        {leftIcon ? <span className="shrink-0">{leftIcon}</span> : null}
        {sel ? <span className="flex items-center gap-2 min-w-0">{sel.icon}<span className="truncate">{sel.label}</span></span> : <span className="opacity-70">{placeholder || 'Select…'}</span>} <span className="ml-auto" /> <ChevronDown className="w-4 h-4 icon" />
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
                  onMouseLeave={(e)=>{ (e.currentTarget as any).style.background='transparent'; (e.currentTarget as any).style.border='1px solid transparent'; }}
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

/* =============================================================================
Scoped CSS (dark visuals preserved)
============================================================================= */
function StyleBlock() {
  return (<style jsx global>{`
.${SCOPE}{
  --accent:${ACCENT};
  --bg:#0b0c10;
  --text:#eef2f5;
  --text-muted: color-mix(in oklab, var(--text) 65%, transparent);
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
.${SCOPE} .va-main{ max-width: none !important; }
.${SCOPE} .icon{ color: var(--accent); }
.${SCOPE} .btn{
  display:inline-flex; align-items:center; gap:.5rem;
  border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1;
  border:1px solid var(--va-border);
}
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }
`}</style>);
}
