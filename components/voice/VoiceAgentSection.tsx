// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, Loader2, Mic2, FileText, BookOpen, Phone, Wrench, Sparkles, Volume2, Play, Save, Rocket } from 'lucide-react';

type ModelId = 'gpt-4o'|'gpt-4o-mini'|'gpt-4.1'|'gpt-4.1-mini'|'o3'|'o3-mini';
type Agent = { id: string; name: string; createdAt: number; model: ModelId };

const GREEN = '#10b981';
const GREEN_HOVER = '#0ea371';

export default function VoiceAgentSection() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      // keep it dumb: same data shape your Improve page expects
      const r = await fetch('/api/chatbots', { cache: 'no-store' }).catch(() => null);
      const j = await r?.json().catch(() => null);
      const rows = Array.isArray(j?.data) ? j.data : [];
      const list: Agent[] = rows.map((a: any) => ({
        id: a.id, name: a.name, createdAt: a.createdAt ?? Date.now(),
        model: (a.model as ModelId) ?? 'gpt-4o-mini'
      }));
      setAgents(list);
      setAgentId(list[0]?.id ?? null);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!agentId) return;
    const t = setTimeout(() => setSaving(false), 400);
    return () => clearTimeout(t);
  }, [agentId]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-10" style={{ color:'var(--text)' }}>
        <div className="flex items-center gap-2"><Loader2 className="animate-spin"/><span>Loading…</span></div>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="mx-auto w-full max-w-[1400px] px-4 py-16" style={{ color:'var(--text)' }}>
        <div className="text-center">
          <div className="text-lg font-semibold">No agents yet</div>
          <div className="opacity-70 text-sm mt-1">Create an AI in the Builder first.</div>
          <a href="/builder" className="inline-block mt-4 px-4 py-2 rounded-md border" style={{ borderColor:'var(--border)', background:'var(--card)' }}>
            Go to Builder
          </a>
        </div>
      </div>
    );
  }

  const selected = agents.find(a => a.id === agentId)!;

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 py-6" style={{ color:'var(--text)' }}>
      <LocalStyles />

      {/* top row — same look/feel as Improve; only green on primary actions */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20}/><span className="font-semibold">Voice Studio</span><span className="opacity-60">/</span>
            <AgentPicker
              agents={agents}
              selectedId={selected.id}
              onSelect={(id)=>{ setAgentId(id); setSaving(true); }}
              onRefresh={async ()=>{
                const r = await fetch('/api/chatbots', { cache: 'no-store' }).catch(()=>null);
                const j = await r?.json().catch(()=>null);
                const rows = Array.isArray(j?.data) ? j.data : [];
                const list: Agent[] = rows.map((a: any) => ({
                  id: a.id, name: a.name, createdAt: a.createdAt ?? Date.now(),
                  model: (a.model as ModelId) ?? 'gpt-4o-mini'
                }));
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

      {/* BODY — empty boxes, Improve-style surfaces */}
      <div className="grid lg:grid-cols-[420px,1fr] gap-6">
        {/* LEFT column */}
        <div className="space-y-6">
          <Section title="Model" icon={<FileText size={16}/>}>
            {/* empty body for now */}
            <Placeholder />
          </Section>

          <Section title="Voice" icon={<Mic2 size={16}/>}>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green"><Play size={16}/> Test Voice</button>
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green"><Save size={16}/> Save</button>
            </div>
          </Section>

          <Section title="Transcriber" icon={<BookOpen size={16}/>}>
            <Placeholder />
          </Section>
        </div>

        {/* RIGHT column */}
        <div className="space-y-6">
          <Section title="System Prompt" icon={<Sparkles size={16}/>}>
            <Placeholder tall />
            <div className="mt-3">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green"><Save size={16}/> Save Prompt</button>
            </div>
          </Section>

          <Section title="Telephony" icon={<Phone size={16}/>}>
            <Placeholder />
            <div className="mt-3">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green"><Save size={16}/> Save Telephony</button>
            </div>
          </Section>

          <Section title="Tools" icon={<Wrench size={16}/>}>
            <Placeholder />
            <div className="mt-3">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green"><Save size={16}/> Save Tools</button>
            </div>
          </Section>

          <Section title="Quick Web Test" icon={<Volume2 size={16}/>}>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2 btn-green"><Play size={16}/> Start Test</button>
              <button className="px-3 py-2 rounded-md inline-flex items-center gap-2" style={{ border:'1px solid var(--border)', background:'var(--card)' }}>
                Options
              </button>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ── styled like Improve (panel/card/border/tight typography); only buttons green ── */
function LocalStyles() {
  return (
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
}

/* ── primitives (same visual language as Improve) ── */
function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 border" style={{ borderColor:'var(--border)', background:'var(--panel)' }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-5 h-5 grid place-items-center rounded-md" style={{ background:'var(--card)', border:'1px solid var(--border)' }}>
          {icon}
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      {children}
    </div>
  );
}

function Placeholder({ tall }: { tall?: boolean }) {
  return (
    <div className="rounded-md border" style={{ borderColor:'var(--border)', background:'var(--card)', height: tall ? 180 : 80 }} />
  );
}

/* ── dropdown like Improve, no extra styling beyond tokens ── */
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
            <input
              value={q}
              onChange={e=>setQ(e.target.value)}
              placeholder="Search agents…"
              className="w-full bg-transparent outline-none text-sm"
            />
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
                <div className="text-xs opacity-60 mt-0.5">{new Date(a.createdAt).toLocaleDateString()}</div>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-6 text-sm opacity-70">No agents found.</div>}
          </div>

          <div className="p-2">
            <button onClick={onRefresh} className="w-full px-2 py-1 rounded-md border text-xs" style={{ borderColor:'var(--border)', background:'var(--card)' }}>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
