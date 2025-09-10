'use client';

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Folder, FolderOpen, Check, Trash2, Copy, Edit3, Sparkles,
  ChevronDown, ChevronRight, FileText, Mic2, BookOpen, SlidersHorizontal,
  PanelLeft, Bot, UploadCloud, RefreshCw, X, ChevronLeft, ChevronRight as ChevronRightIcon,
  Phone as PhoneIcon, Rocket, PhoneCall, PhoneOff, MessageSquare, ListTree, AudioLines, Volume2, Save
} from 'lucide-react';

import AssistantSidebar, { Assistant } from './AssistantSidebar';
import WebCall, { CallLog, TranscriptTurn } from './WebCall';

/* ============================== CONFIG ============================== */
const SCOPE = 'va-scope';
const ACCENT = '#10b981';
const ACCENT_HOVER = '#0ea371';
const BTN_SHADOW = '0 10px 24px rgba(16,185,129,.22)';

const LS_LIST = 'voice:assistants.v1';
const ak = (id: string) => `voice:assistant:${id}`;
const LS_CALLS = 'voice:calls.v1';
const LS_ROUTES = 'voice:phoneRoutes.v1';

function readLS<T>(k: string): T | null { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : null; } catch { return null; } }
function writeLS<T>(k: string, v: T) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

/* ============================== PROMPT HELPERS (same as your original) ============================== */
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

* Full Name
* Phone Number
* Email (if provided)
* Appointment Date/Time (if applicable)

[Safety]

* No medical/legal/financial advice beyond high-level pointers.
* Decline restricted actions, suggest alternatives.

[Handover]

* When done, summarize details and hand off if needed.`.trim();

/* ============================== UI Helpers (sidebar width) ============================== */
function useAppSidebarWidth(scopeRef: React.RefObject<HTMLDivElement>, fallbackCollapsed: boolean) {
  useEffect(() => {
    const scope = scopeRef.current;
    if (!scope) return;

    const setVar = (w: number) => scope.style.setProperty('--app-sidebar-w', `${Math.round(w)}px`);

    const findSidebar = () =>
      (document.querySelector('[data-app-sidebar]') as HTMLElement) ||
      (document.querySelector('#app-sidebar') as HTMLElement) ||
      (document.querySelector('.app-sidebar') as HTMLElement) ||
      (document.querySelector('aside.sidebar') as HTMLElement) ||
      null;

    let target = findSidebar();
    if (!target) { setVar(fallbackCollapsed ? 72 : 248); return; }
    setVar(target.getBoundingClientRect().width);

    const ro = new ResizeObserver(() => setVar(target!.getBoundingClientRect().width));
    ro.observe(target);

    const mo = new MutationObserver(() => setVar(target!.getBoundingClientRect().width));
    mo.observe(target, { attributes: true, attributeFilter: ['class', 'style'] });

    const onTransitionEnd = () => setVar(target!.getBoundingClientRect().width);
    target.addEventListener('transitionend', onTransitionEnd);

    return () => {
      ro.disconnect();
      mo.disconnect();
      target.removeEventListener('transitionend', onTransitionEnd);
    };
  }, [scopeRef, fallbackCollapsed]);
}

/* ============================== PAGE ============================== */
export default function VoiceAgentSection() {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(() => {
    if (typeof document === 'undefined') return false;
    return document.body.getAttribute('data-sb-collapsed') === 'true';
  });

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      if (typeof detail.collapsed === 'boolean') setSbCollapsed(!!detail.collapsed);
    };
    window.addEventListener('layout:sidebar', onEvt as EventListener);

    const mo = new MutationObserver(() => {
      setSbCollapsed(document.body.getAttribute('data-sb-collapsed') === 'true');
    });
    mo.observe(document.body, { attributes: true, attributeFilter: ['data-sb-collapsed', 'class'] });

    return () => { window.removeEventListener('layout:sidebar', onEvt as EventListener); mo.disconnect(); };
  }, []);

  useAppSidebarWidth(scopeRef, sbCollapsed);

  /* ---------- Assistants ---------- */
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeId, setActiveId] = useState('');
  const [active, setActive] = useState<Assistant | null>(null);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tempName, setTempName] = useState('');
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
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

  const [creating, setCreating] = useState(false);
  const addAssistant = async () => {
    setCreating(true);
    await new Promise(r => setTimeout(r, 360));
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

  /* ---------- Telephony helpers ---------- */
  const addPhone = (e164: string, label?: string) => {
    const norm = e164.trim(); if (!norm) return;
    updateActive(a => {
      const nums = a.config.telephony?.numbers ?? [];
      return {
        ...a,
        config: {
          ...a.config,
          telephony: { numbers: [...nums, { id: `ph_${Date.now().toString(36)}`, e164: norm, label: (label||'').trim() || undefined }], linkedNumberId: a.config.telephony?.linkedNumberId }
        }
      };
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
    const num = numbers.find(n=>n.id===linkedId);
    if (!num) { alert('Pick a Phone Number (Linked) before publishing.'); return; }
    const routes = readLS<Record<string, string>>(LS_ROUTES) || {};
    routes[num.id] = active.id; writeLS(LS_ROUTES, routes);
    updateActive(a => ({ ...a, published: true }));
    alert(`Published! ${num.e164} is now linked to ${active.name}.`);
  };

  // calls list for bottom section
  const [callsForAssistant, setCallsForAssistant] = useState<CallLog[]>([]);
  useEffect(() => {
    if (!isClient || !active?.id) { setCallsForAssistant([]); return; }
    const list = readLS<CallLog[]>(LS_CALLS) || [];
    setCallsForAssistant(list.filter(c => c.assistantId === active.id));
  }, [isClient, active?.id, rev]);

  if (!isClient) {
    return (<div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}><StyleBlock /><div className="px-6 py-10 opacity-70 text-sm">Loading…</div></div>);
  }
  if (!active) {
    return (<div ref={scopeRef} className={SCOPE} style={{ color:'var(--text)' }}><div className="px-6 py-10 opacity-70">Create your first assistant.</div><StyleBlock /></div>);
  }

  const linkedNum = active.config.telephony?.numbers.find(n => n.id === active.config.telephony?.linkedNumberId)?.e164;

  return (
    <div ref={scopeRef} className={SCOPE} style={{ background:'var(--bg)', color:'var(--text)' }}>
      {/* Assistants rail */}
      <AssistantSidebar
        railCollapsed={false} setRailCollapsed={()=>{}}
        assistants={assistants} activeId={activeId} setActiveId={setActiveId}
        creating={creating} onCreate={addAssistant}
        query={query} setQuery={setQuery}
        editingId={editingId} tempName={tempName}
        beginRename={beginRename} saveRename={saveRename}
        setTempName={setTempName} setDeleting={setDeleting}
      />

      {/* Main editor */}
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
            <button onClick={() => window.dispatchEvent(new CustomEvent('voiceagent:open-chat', { detail:{ id: active.id } }))} className="btn btn--ghost">
              Chat
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={()=> navigator.clipboard.writeText(active.config.model.systemPrompt || '').catch(()=>{})}
              className="btn btn--ghost"
            >
              <Copy className="w-4 h-4 icon" /> Copy Prompt
            </button>
            <button onClick={()=> setDeleting({ id: active.id, name: active.name })} className="btn btn--danger">
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button onClick={publish} className="btn btn--green">
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
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, provider: v as any } } }))}
                  items={[{ value:'openai', label:'OpenAI' }]}
                />
              </Field>
              <Field label="Model">
                <Select
                  value={active.config.model.model}
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, model:{ ...a.config.model, model: v as any } } }))}
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
            </div>
          </Section>

          {/* Voice */}
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
                  onChange={(v)=> updateActive(a => ({ ...a, config:{ ...a.config, voice:{ ...a.config.voice, voiceId: v, voiceLabel: (v==='ember'?'Ember (OpenAI)':v==='alloy'?'Alloy (OpenAI)':v) } } }))}
                  items={
                    active.config.voice.provider==='elevenlabs'
                      ? [{ value:'rachel', label:'Rachel (ElevenLabs)' },{ value:'adam', label:'Adam (ElevenLabs)' },{ value:'bella', label:'Bella (ElevenLabs)' }]
                      : [{ value:'alloy', label:'Alloy (OpenAI)' },{ value:'ember', label:'Ember (OpenAI)' }]
                  }
                />
              </Field>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen className="w-4 h-4 icon" />}>
            <div className="grid gap-6" style={{ gridTemplateColumns:'repeat(3, minmax(360px, 1fr))' }}>
              <Field label="Provider">
                <Select value={'deepgram'} onChange={()=>{}} items={[{ value:'deepgram', label:'Deepgram' }]} />
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

          {/* Web Call (button + transcript) */}
          <Section title="Call Assistant (Web test)" icon={<AudioLines className="w-4 h-4 icon" />}>
            <WebCall
              assistantId={active.id}
              assistantName={active.name}
              modelId={active.config.model.model}
              systemPrompt={active.config.model.systemPrompt || ''}
              firstMessageMode={active.config.model.firstMessageMode}
              firstMessage={active.config.model.firstMessage}
              voiceLabel={active.config.voice.voiceLabel}
              linkedNumberE164={linkedNum}
            />
          </Section>

          {/* Call Logs */}
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
                      {log.endedAt ? <span className="opacity-70">• {(Math.max(1, Math.round((log.endedAt - log.startedAt)/1000)))}s</span> : null}
                    </div>
                    <div className="text-xs opacity-60">{log.endedReason || (log.endedAt ? 'Completed' : 'Live')}</div>
                  </summary>
                  <div className="px-3 pb-3 space-y-2">
                    {log.transcript.map((t, i) => (
                      <div key={i} className="flex gap-2">
                        <div className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                          border: '1px
