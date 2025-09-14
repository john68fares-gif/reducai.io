// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bot, Check, ChevronDown, Loader2, Mic2, FileText, BookOpen,
  Settings2, Phone, Wrench, Sparkles, Volume2, Play, Save, Rocket
} from 'lucide-react';

/* =============================================================================
   TYPES (simple)
============================================================================= */
type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3' | 'o3-mini';
type Agent = { id: string; name: string; createdAt: number; model: ModelId; temperature: number };

/* =============================================================================
   UTIL
============================================================================= */
const GREEN = '#10b981';
const GREEN_HOVER = '#0ea371';

const uid = (p='id') =>
  `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;

async function listAgents(): Promise<Agent[]> {
  // Same shape as /improve page expects (adjust backend if needed)
  const r = await fetch(`/api/chatbots`, { cache: 'no-store' });
  if (!r.ok) return [];
  const j = await r.json();
  const rows = Array.isArray(j?.data) ? j.data : [];
  return rows.map((a: any) => ({
    id: a.id,
    name: a.name,
    createdAt: a.createdAt ?? Date.now(),
    model: (a.model as ModelId) ?? 'gpt-4o-mini',
    temperature: typeof a.temperature === 'number' ? a.temperature : 0.5
  }));
}

/* =============================================================================
   COMPONENT
============================================================================= */
export default function VoiceAgentSection() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // local dummy state (you’ll wire these later)
  const [model, setModel] = useState<ModelId>('gpt-4o-mini');
  const [voiceProvider, setVoiceProvider] = useState<'openai'|'elevenlabs'>('openai');
  const [voiceId, setVoiceId] = useState('alloy');
  const [transcriber, setTranscriber] = useState<'deepgram'>('deepgram');
  const [transcriberModel, setTranscriberModel] = useState<'nova-2'|'nova-3'>('nova-2');

  // green button style
  const Styles = () => (
    <style>{`
      .btn-green{
        background:${GREEN};
        color:#fff;
        border:1px solid ${GREEN};
        box-shadow:0 10px 24px rgba(16,185,129,.22);
        transition:background .18s ease, transform .05s ease, box-shadow .18s ease, opacity .18s ease;
      }
      .btn-green:hover{ background:${GREEN_HOVER}; box-shadow:0 12px 28px rgba(16,185,129,.32); }
      .btn-green:active{ transform:translateY(1px); }
      .btn-green:disabled{ opacity:.6; cursor:not-allowed; }
    `}</style>
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      const list = await listAgents();
      setAgents(list);
      setAgentId(list[0]?.id ?? null);
      if (list[0]) setModel(list[0].model);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!agentId) return;
    // mimic a small delayed “Saved” indicator when core knobs change
    const t = setTimeout(() => { setSaving(false); }, 500);
    return () => clearTimeout(t);
  }, [agentId, model]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10" style={{ color: 'var(--text)' }}>
        <div className="flex items-center gap-2"><Loader2 className="animate-spin"/><span>Loading…</span></div>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16" style={{ color: 'var(--text)' }}>
        <div className="text-center">
          <div className="text-lg font-semibold">No agents yet</div>
          <div className="opacity-70 text-sm mt-1">
            Create an AI in the Builder first (this list only shows agents that belong to your account).
          </div>
          <a href="/builder" className="inline-block mt-4 px-4 py-2 rounded-md border"
             style={{ borderColor:'var(--border)', background:'var(--card)' }}>
            Go to Builder
          </a>
        </div>
      </div>
    );
  }

  const selected = agents.find(a => a.id === agentId)!;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6" style={{ color: 'var(--text)' }}>
      <Styles />
      {/* Top row — mirrors Improve: left cluster + green primary on the right */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20}/><span className="font-semibold">Voice Studio</span><span className="opacity-60">/</span>
            <AgentPicker
              agents={agents}
              selectedId={selected.id}
              onSelect={(id) => {
                setAgentId(id);
                const a = agents.find(x => x.id === id);
                if (a) setModel(a.model);
                setSaving(true);
              }}
              onRefresh={async () => {
                const list = await listAgents();
                setAgents(list);
                if (!list.find(a=>a.id===agentId)) setAgentId(list[0]?.id ?? null);
              }}
            />
            <div className="ml-2 text-xs flex items-center gap-1 opacity-80">
              {saving ? (<><Loader2 size={14} className="animate-spin"/> Saving…</>) : (<><Check size={14}/> Saved</>)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
              <Rocket size={16}/> Publish
            </button>
          </div>
        </div>
      </div>

      {/* Body grid — same spacing/feel as Improve */}
      <div className="grid lg:grid-cols-[420px,1fr] gap-6">
        {/* LEFT COLUMN */}
        <div className="space-y-6">
          {/* Model */}
          <Section title="Model" icon={<FileText size={16}/>}>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Provider">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }} defaultValue="openai">
                  <option value="openai">OpenAI</option>
                </select>
              </Field>
              <Field label="Model">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }}
                        value={model}
                        onChange={(e)=>{ setModel(e.target.value as ModelId); setSaving(true); }}>
                  {(['gpt-4o','gpt-4o-mini','gpt-4.1','gpt-4.1-mini','o3','o3-mini'] as ModelId[]).map(m =>
                    <option key={m} value={m}>{m}</option>
                  )}
                </select>
              </Field>
            </div>
          </Section>

          {/* Voice */}
          <Section title="Voice" icon={<Mic2 size={16}/>}>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Provider">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }}
                        value={voiceProvider}
                        onChange={(e)=>setVoiceProvider(e.target.value as 'openai'|'elevenlabs')}>
                  <option value="openai">OpenAI</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
              </Field>
              <Field label="Voice">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }}
                        value={voiceId} onChange={(e)=>setVoiceId(e.target.value)}>
                  <option value="alloy">Alloy</option>
                  <option value="ember">Ember</option>
                </select>
              </Field>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
                <Play size={16}/> Test Voice
              </button>
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
                <Save size={16}/> Save Voice
              </button>
            </div>
          </Section>

          {/* Transcriber */}
          <Section title="Transcriber" icon={<BookOpen size={16}/>}>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Provider">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }} value={transcriber} onChange={()=>{}}>
                  <option value="deepgram">Deepgram</option>
                </select>
              </Field>
              <Field label="Model">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }}
                        value={transcriberModel}
                        onChange={(e)=>setTranscriberModel(e.target.value as 'nova-2'|'nova-3')}>
                  <option value="nova-2">Nova 2</option>
                  <option value="nova-3">Nova 3</option>
                </select>
              </Field>
              <Field label="Language">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }} defaultValue="en">
                  <option value="en">English</option>
                  <option value="multi">Multi</option>
                </select>
              </Field>
            </div>
          </Section>
        </div>

        {/* RIGHT COLUMN */}
        <div className="space-y-6">
          {/* Prompt */}
          <Section title="System Prompt" icon={<Sparkles size={16}/>}>
            <textarea
              rows={10}
              className="w-full rounded-md px-3 py-2 text-sm border bg-transparent"
              style={{ borderColor:'var(--border)', fontFamily:'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
              placeholder="Write your system prompt here…"
              defaultValue={`[Identity]
You are a helpful voice agent.

[Style]
Be concise and clear.`}
            />
            <div className="mt-3 flex items-center gap-2">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
                <Save size={16}/> Save Prompt
              </button>
            </div>
          </Section>

          {/* Telephony */}
          <Section title="Telephony" icon={<Phone size={16}/>}>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Linked Number">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }} defaultValue="">
                  <option value="">Not linked</option>
                </select>
              </Field>
              <Field label="Route">
                <select className="w-full rounded-md px-2 py-2 border bg-transparent"
                        style={{ borderColor:'var(--border)' }} defaultValue="">
                  <option value="">Default</option>
                </select>
              </Field>
            </div>
            <div className="mt-3">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
                <Save size={16}/> Save Telephony
              </button>
            </div>
          </Section>

          {/* Tools */}
          <Section title="Tools" icon={<Wrench size={16}/>}>
            <div className="grid md:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked /> End Call Tool
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" defaultChecked /> Dial Keypad
              </label>
            </div>
            <div className="mt-3">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
                <Save size={16}/> Save Tools
              </button>
            </div>
          </Section>

          {/* Quick test box */}
          <Section title="Quick Web Test" icon={<Volume2 size={16}/>}>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green">
                <Play size={16}/> Start Test
              </button>
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2"
                      style={{ border:'1px solid var(--border)', background:'var(--card)' }}>
                <Settings2 size={16}/> Options
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   PRIMITIVES (styled like Improve)
============================================================================= */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 border"
         style={{ borderColor:'var(--border)', background:'var(--panel)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 grid place-items-center rounded-md"
             style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          {icon}
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs opacity-70 mb-1">{label}</div>
      {children}
    </div>
  );
}

/* =============================================================================
   Agent Picker (mirrors Improve)
============================================================================= */
function AgentPicker({
  agents, selectedId, onSelect, onRefresh
}:{
  agents: Agent[]; selectedId: string; onSelect: (id:string)=>void; onRefresh: ()=>void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(()=>{
    const onDoc = (e: MouseEvent) => { if(!wrapRef.current) return; if(!wrapRef.current.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e: KeyboardEvent) => { if(e.key==='Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return ()=>{ document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  },[]);

  const selected = agents.find(a => a.id===selectedId);
  const filtered = agents.filter(a => a.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={()=>setOpen(v=>!v)}
        className="px-2.5 py-1.5 rounded-md border inline-flex items-center gap-2 text-sm"
        style={{ borderColor:'var(--border)', background:'var(--card)' }}
      >
        <span className="truncate max-w-[180px]">{selected?.name ?? 'Choose agent'}</span>
        <ChevronDown size={14}/>
      </button>

      {open && (
        <div className="absolute mt-2 w-[280px] rounded-lg border shadow-lg z-20"
             style={{ borderColor:'var(--border)', background:'var(--panel)' }}>
          <div className="p-2 border-b" style={{ borderColor:'var(--border)' }}>
            <div className="flex items-center gap-2">
              <input
                value={q}
                onChange={e=>setQ(e.target.value)}
                placeholder="Search agents…"
                className="flex-1 bg-transparent outline-none text-sm"
              />
              <button
                onClick={onRefresh}
                className="px-2 py-1 rounded-md border text-xs inline-flex items-center gap-1"
                style={{ borderColor:'var(--border)', background:'var(--card)' }}
              >
                Refresh
              </button>
            </div>
          </div>
          <div className="max-h-[260px] overflow-y-auto">
            {filtered.map(a=>(
              <button
                key={a.id}
                onClick={()=>{ onSelect(a.id); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm border-b ${a.id===selectedId?'opacity-100':'opacity-90'}`}
                style={{ borderColor:'var(--border)' }}
                title={a.name}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate">{a.name}</span>
                  {a.id===selectedId && <Check size={14}/>}
                </div>
                <div className="text-xs opacity-60 mt-0.5">{a.model} • {new Date(a.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-6 text-sm opacity-70">No agents found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
