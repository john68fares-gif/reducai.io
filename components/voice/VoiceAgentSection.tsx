'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, FileText, Mic2, BookOpen, SlidersHorizontal, Phone as PhoneIcon,
  Rocket, PhoneCall, PhoneOff, MessageSquare, ListTree, AudioLines, Volume2, Save,
  Copy, RefreshCw, X, ChevronDown, ChevronRight,
} from 'lucide-react';

import AssistantSidebar, { Assistant } from './AssistantSidebar';
import WebCallButton from './WebCallButton';

/* ===== tokens ===== */
const SCOPE = 'va-scope';
const ACCENT = '#10b981', ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

type TranscriptTurn = { role: 'assistant'|'user'; text: string; ts: number };
type PhoneNum = { id: string; label?: string; e164: string };
type CallLog = {
  id: string; assistantId: string; assistantName: string; startedAt: number;
  endedAt?: number; endedReason?: string; type: 'Web'; assistantPhoneNumber?: string;
  transcript: TranscriptTurn[]; costUSD?: number;
};

/* ===== storage keys ===== */
const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

const readLS = <T,>(k: string): T | null => { try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : null; } catch { return null; } };
const writeLS = <T,>(k: string, v: T) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

/* ===== base prompt ===== */
const BASE_PROMPT = `[Identity]
You are an intelligent and responsive assistant designed to help users with a wide range of inquiries and tasks.

[Style]
- Maintain a professional and approachable demeanor.
- Use clear and concise language.

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

/* ===== component ===== */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [isClient, setIsClient] = useState(false);
  useEffect(()=>{ setIsClient(true); }, []);

  /* sidebar width sync (like your original) */
  useEffect(() => {
    const scope = scopeRef.current; if (!scope) return;
    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);
    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;

    let target = findSidebar();
    if (!target) { setVar(document.body.getAttribute('data-sb-collapsed') === 'true' ? 72 : 248); return; }
    setVar(target.getBoundingClientRect().width);

    const ro = new ResizeObserver(() => setVar(target!.getBoundingClientRect().width));
    ro.observe(target);
    const mo = new MutationObserver(() => setVar(target!.getBoundingClientRect().width));
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });
    const onTransitionEnd = () => setVar(target!.getBoundingClientRect().width);
    target.addEventListener('transitionend', onTransitionEnd);
    return () => { ro.disconnect(); mo.disconnect(); target.removeEventListener('transitionend', onTransitionEnd); };
  }, []);

  /* assistants state (same schema) */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<Assistant | null>(null);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
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
          model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: BASE_PROMPT },
          voice: { provider: 'openai', voiceId: 'alloy', voiceLabel: 'Alloy (OpenAI)' },
          transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
          tools: { enableEndCall: true, dialKeypad: true },
          telephony: { numbers: [], linkedNumberId: undefined },
        },
      };
      writeLS(ak(seed.id), seed); writeLS(LS_LIST, [seed]);
      setAssistants([seed]); setActiveId(seed.id);
    } else {
      const fixed = list.map(a => ({ ...a, config: { ...a.config, telephony: a.config.telephony || { numbers: [], linkedNumberId: undefined } } }));
      writeLS(LS_LIST, fixed); setAssistants(fixed); setActiveId(fixed[0].id);
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
    setAssistants(list); setActive(next); setRev(r => r + 1);
  };

  const addAssistant = async () => {
    setCreating(true); await new Promise(r=>setTimeout(r, 360));
    const id = `agent_${Math.random().toString(36).slice(2, 8)}`;
    const a: Assistant = {
      id, name: 'New Assistant', updatedAt: Date.now(), published: false,
      config: {
        model: { provider: 'openai', model: 'gpt-4o', firstMessageMode: 'assistant_first', firstMessage: 'Hello.', systemPrompt: '' },
        voice: { provider: 'openai', voiceId: 'alloy', voiceLabel: 'Alloy (OpenAI)' },
        transcriber: { provider: 'deepgram', model: 'nova-2', language: 'en', denoise: false, confidenceThreshold: 0.4, numerals: false },
        tools: { enableEndCall: true, dialKeypad: true },
        telephony: { numbers: [], linkedNumberId: undefined },
      }
    };
    writeLS(ak(id), a);
    const list = [...assistants, a]; writeLS(LS_LIST, list);
    setAssistants(list); setActiveId(id);
    setCreating(false); setEditingId(id); setTempName('New Assistant');
  };

  const removeAssistant = (id: string) => {
    const list = assistants.filter(a => a.id !== id);
    writeLS(LS_LIST, list); setAssistants(list);
    localStorage.removeItem(ak(id));
    if (activeId === id && list.length) setActiveId(list[0].id);
    if (!list.length) setActiveId('');
    setRev(r => r + 1);
  };

  /* transcript + logs */
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptTurn[]>([]);
  const [callsForAssistant, setCallsForAssistant] = useState<CallLog[]>([]);

  useEffect(() => {
    if (!isClient || !active?.id) { setCallsForAssistant([]); return; }
    const list = readLS<CallLog[]>(LS_CALLS) || [];
    setCallsForAssistant(list.filter(c => c.assistantId === active.id));
  }, [isClient, active?.id, currentCallId, transcript.length, rev]);

  function pushTurn(role: 'assistant'|'user', text: string) {
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
  }

  function beginCall() {
    if (!active) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setCurrentCallId(id);
    setTranscript([]);

    const linkedNum = active.config.telephony?.numbers.find((n: PhoneNum) => n.id === active.config.telephony?.linkedNumberId)?.e164;
    const calls = readLS<CallLog[]>(LS_CALLS) || [];
    calls.unshift({ id, assistantId: active.id, assistantName: active.name, startedAt: Date.now(), type: 'Web', assistantPhoneNumber: linkedNum, transcript: [] });
    writeLS(LS_CALLS, calls);
  }
  function endCall(reason: string) {
    if (!currentCallId) return;
    const calls = (readLS<CallLog[]>(LS_CALLS) || []).map(c => c.id === currentCallId ? { ...c, endedAt: Date.now(), endedReason: reason } : c);
    writeLS(LS_CALLS, calls);
    setCurrentCallId(null);
  }

  if (!isClient || !active) {
    return (
      <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <StyleBlock />
        <div className="px-6 py-10 opacity-70 text-sm">Loading…</div>
      </div>
    );
  }

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* SIDEBAR */}
      <AssistantSidebar
        scopeClass={SCOPE}
        assistants={assistants}
        activeId={activeId}
        railCollapsed={railCollapsed}
        creating={creating}
        query={query}
        onToggleRail={()=> setRailCollapsed(v=>!v)}
        onCreate={addAssistant}
        onPick={(id)=> setActiveId(id)}
        onQuery={setQuery}
        onRenameStart={(a)=> { setEditingId(a.id); setTempName(a.name); }}
        onRenameSave={(a, name)=> {
          const nm = (name||'').trim() || 'Untitled';
          if (a.id === activeId) updateActive(x => ({ ...x, name: nm }));
          else {
            const cur = readLS<Assistant>(ak(a.id)); if (cur) writeLS(ak(a.id), { ...cur, name: nm, updatedAt: Date.now() });
            const list = (readLS<Assistant[]>(LS_LIST) || []).map(x => x.id === a.id ? { ...x, name: nm, updatedAt: Date.now() } : x);
            writeLS(LS_LIST, list); setAssistants(list); setRev(r=>r+1);
          }
          setEditingId(null);
        }}
        onDeleteAsk={(a)=> removeAssistant(a.id)}
        editingId={editingId}
        tempName={tempName}
        setTempName={setTempName}
      />

      {/* MAIN */}
      <div
        className="va-main"
        style={{
          marginLeft: `calc(var(--app-sidebar-w, 248px) + ${railCollapsed ? '72px' : 'var(--va-rail-w, 360px)'})`,
          paddingRight: 'clamp(20px, 4vw, 40px)',
          paddingTop: 'calc(var(--app-header-h, 64px) + 12px)',
          paddingBottom: '88px',
        }}
      >
        {/* Top bar: call + chat */}
        <div className="px-2 pb-3 flex items-center justify-between sticky" style={{ top: 'calc(var(--app-header-h, 64px) + 8px)', zIndex: 2 }}>
          <div className="flex items-center gap-2">
            {currentCallId
              ? <button onClick={()=> { endCall('Ended by user'); }} className="btn btn--danger"><PhoneOff className="w-4 h-4" /> End Call</button>
              : <WebCallButton
                  greet={active.config.model.firstMessage || 'Hello. How may I help you today?'}
                  voiceLabel={active.config.voice.voiceLabel}
                  systemPrompt={(active.config.model.systemPrompt || BASE_PROMPT)}
                  model={active.config.model.model}
                  onTurn={(role, text)=> {
                    if (!currentCallId) beginCall();
                    pushTurn(role, text);
                  }}
                />
            }
            <button onClick={()=> window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail: { id: active.id } }))} className="btn btn--ghost">
              <MessageSquare className="w-4 h-4 icon" /> Chat
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})} className="btn btn--ghost">
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> alert('Deploy flow unchanged in this split.')} className="btn btn--green">
              <Rocket className="w-4 h-4 text-white" /><span className="text-white">{active.published ? 'Republish' : 'Publish'}</span>
            </button>
          </div>
        </div>

        {/* MODEL / VOICE / etc — keep your existing sections (shortened here for space) */}
        <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
          <div className="rounded-2xl p-3" style={{ background: 'var(--va-input-bg)', border: '1px solid var(--va-input-border)' }}>
            {transcript.length === 0 && <div className="text-sm opacity-60">No transcript yet.</div>}
            <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
              {transcript.map((t, idx) => (
                <div key={idx} className="flex gap-2">
                  <div className="text-xs px-2 py-0.5 rounded-full"
                       style={{ background: t.role === 'assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)', border: '1px solid var(--va-border)' }}>
                    {t.role === 'assistant' ? 'AI' : 'You'}
                  </div>
                  <div className="text-sm">{t.text}</div>
                </div>
              ))}
            </div>
          </div>
        </Section>

        <Section title="Call Logs" icon={<ListTree className="w-4 h-4 icon" />}>
          <div className="space-y-3">
            {callsForAssistant.length === 0 && <div className="text-sm opacity-60">No calls yet.</div>}
            {callsForAssistant.map(log => (
              <details key={log.id} className="rounded-xl" style={{ background:'var(--va-input-bg)', border:'1px solid var(--va-input-border)' }}>
                <summary className="cursor-pointer px-3 py-2 flex items-center justify-between">
                  <div className="text-sm flex items-center gap-2">
                    <PhoneIcon className="w-4 h-4 icon" />
                    <span>{new Date(log.startedAt).toLocaleString()}</span>
                    {log.assistantPhoneNumber ? <span className="opacity-70">• {log.assistantPhoneNumber}</span> : null}
                    {log.endedAt ? <span className="opacity-70">• {Math.max(1, Math.round((log.endedAt - log.startedAt) / 1000))}s</span> : null}
                  </div>
                  <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                </summary>
                <div className="px-3 pb-3 space-y-2">
                  {log.transcript.map((t, i) => (
                    <div key={i} className="flex gap-2">
                      <div className="text-xs px-2 py-0.5 rounded-full"
                           style={{ background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)', border: '1px solid var(--va-border)' }}>
                        {t.role==='assistant' ? 'AI' : 'User'}
                      </div>
                      <div className="text-sm">{t.text}</div>
                    </div>
                  ))}
                </div>
              </details>
            ))}
          </div>
        </Section>
      </div>

      <StyleBlock />
    </div>
  );
}

/* --------- simple Section + style from your original (trimmed) --------- */
function Section({ title, icon, children }:{ title: string; icon: React.ReactNode; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="col-span-12 rounded-xl relative" style={{ background:'var(--va-card)', border:'1px solid var(--va-border)', boxShadow:'var(--va-shadow)' }}>
      <div aria-hidden className="pointer-events-none absolute -top-[22%] -left-[22%] w-[70%] h-[70%] rounded-full"
           style={{ background:'radial-gradient(circle, color-mix(in oklab, var(--accent) 14%, transparent) 0%, transparent 70%)', filter:'blur(40px)' }} />
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

function StyleBlock() {
  return (
    <style jsx global>{`
.${SCOPE}{
  --accent:${ACCENT};
  --bg:#0b0c10; --text:#eef2f5; --text-muted:color-mix(in oklab, var(--text) 65%, transparent);
  --va-card:#0f1315; --va-sidebar:linear-gradient(180deg,#0d1113 0%,#0b0e10 100%);
  --va-border:rgba(255,255,255,.10); --va-input-bg:rgba(255,255,255,.03); --va-input-border:rgba(255,255,255,.14);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.06);
  --va-shadow:0 24px 70px rgba(0,0,0,.55); --va-shadow-lg:0 42px 110px rgba(0,0,0,.66);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.35); --va-shadow-side:8px 0 28px rgba(0,0,0,.42);
  --va-rail-w:360px;
}
:root:not([data-theme="dark"]) .${SCOPE}{
  --bg:#f7f9fb; --text:#101316; --text-muted:color-mix(in oklab, var(--text) 55%, transparent);
  --va-card:#ffffff; --va-sidebar:linear-gradient(180deg,#ffffff 0%,#f7f9fb 100%);
  --va-border:rgba(0,0,0,.10); --va-input-bg:#ffffff; --va-input-border:rgba(0,0,0,.12);
  --va-input-shadow:inset 0 1px 0 rgba(255,255,255,.85);
  --va-shadow:0 28px 70px rgba(0,0,0,.12); --va-shadow-lg:0 42px 110px rgba(0,0,0,.16);
  --va-shadow-sm:0 12px 26px rgba(0,0,0,.10); --va-shadow-side:8px 0 26px rgba(0,0,0,.08);
}
.${SCOPE} .icon{ color: var(--accent); }
.${SCOPE} .btn{ display:inline-flex; align-items:center; gap:.5rem; border-radius:14px; padding:.65rem 1rem; font-size:14px; line-height:1; border:1px solid var(--va-border); }
.${SCOPE} .btn--green{ background:${ACCENT}; color:#fff; box-shadow:${BTN_SHADOW}; transition:transform .04s ease, background .18s ease; }
.${SCOPE} .btn--green:hover{ background:${ACCENT_HOVER}; }
.${SCOPE} .btn--green:active{ transform:translateY(1px); }
.${SCOPE} .btn--ghost{ background:var(--va-card); color:var(--text); box-shadow:var(--va-shadow-sm); }
.${SCOPE} .btn--danger{ background:rgba(220,38,38,.12); color:#fca5a5; box-shadow:0 10px 24px rgba(220,38,38,.15); border-color:rgba(220,38,38,.35); }
`}</style>
  );
}
