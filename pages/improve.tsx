// pages/improve.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Check, ChevronDown, ChevronUp, Copy, History, Info, Loader2, RefreshCw, Search, Send, Settings2, Sparkles, Trash2, Undo2, Redo2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';

type ModelId = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3' | 'o3-mini';
const MODEL_OPTIONS: { value: ModelId; label: string }[] = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'o3', label: 'o3 (reasoning)' },
  { value: 'o3-mini', label: 'o3-mini (reasoning, fast)' },
];

type Agent = { id: string; name: string; createdAt: number; model: ModelId; temperature?: number; };

type ChatMessage = { id: string; role: 'user' | 'assistant'; content: string; createdAt: number; };

const uid = (p='id') => `${p}_${Math.random().toString(36).slice(2,9)}${Date.now().toString(36).slice(-4)}`;
const now = () => Date.now();

export default function ImprovePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(0.5);
  const [model, setModel] = useState<ModelId>('gpt-4o-mini');
  const [history, setHistory] = useState<ChatMessage[]>([
    { id: uid('m'), role: 'assistant', content: 'This is the Improve panel. Your agent will reply based on the active refinements.', createdAt: now() },
  ]);

  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1) Load logged-in user id (supabase)
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) setUserId(session.user.id);
    })();
  }, []);

  // 2) Fetch agents for this user
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      if (!res.ok) return;
      const list = (await res.json()) as Agent[];
      setAgents(list);
      if (list.length) {
        const first = list[0];
        setAgentId(first.id);
        setModel(first.model);
        setTemperature(first.temperature ?? 0.5);
      }
    })();
  }, [userId]);

  // Scroll chat down
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [history.length, isSending]);

  const selectedAgent = useMemo(() => agents.find(a => a.id === agentId) ?? null, [agents, agentId]);

  async function syncFromOpenAI() {
    if (!userId) return;
    try {
      setIsRefreshing(true);
      await fetch('/api/chatbots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ownerId: userId }),
      });
      const res = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const list = res.ok ? ((await res.json()) as Agent[]) : [];
      setAgents(list);
      if (list.length && (!agentId || !list.find(a => a.id === agentId))) {
        setAgentId(list[0].id);
        setModel(list[0].model);
        setTemperature(list[0].temperature ?? 0.5);
      }
    } finally {
      setIsRefreshing(false);
    }
  }

  async function persistModelTemp(nextModel?: ModelId, nextTemp?: number) {
    if (!agentId || !userId) return;
    setIsSaving(true);
    try {
      await fetch(`/api/chatbots/${agentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerId: userId,
          ...(nextModel ? { model: nextModel } : {}),
          ...(typeof nextTemp === 'number' ? { temperature: nextTemp } : {}),
        }),
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function sendMessage() {
    if (!agentId) return;
    const text = input.trim();
    if (!text) return;
    const userMsg: ChatMessage = { id: uid('m'), role: 'user', content: text, createdAt: now() };
    setHistory(h => [...h, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const r = await fetch('/api/improve/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId,
          model,
          temperature,
          system: '',
          guardLevel: 'lenient',
          messages: history.filter(m => m.role !== 'assistant').slice(-6).map(m => ({ role: m.role, content: m.content })).concat({ role: 'user', content: text }),
        }),
      });
      const data = await r.json();
      const aiMsg: ChatMessage = {
        id: uid('m'),
        role: 'assistant',
        content: data?.content || '(no reply)',
        createdAt: now(),
      };
      setHistory(h => [...h, aiMsg]);
    } catch (e: any) {
      setHistory(h => [...h, { id: uid('m'), role: 'assistant', content: `(Error) ${e?.message || 'send failed'}`, createdAt: now() }]);
    } finally {
      setIsSending(false);
    }
  }

  if (!userId) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="flex items-center gap-2"><Loader2 className="animate-spin" /> Loading…</div>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <div className="text-center space-y-3">
          <div className="text-lg font-semibold">No agents yet</div>
          <div className="opacity-70 text-sm">Create an AI in the Builder first (this list only shows agents that belong to <strong>your</strong> account).</div>
          <div className="flex items-center justify-center gap-2">
            <a href="/builder" className="px-4 py-2 rounded-md border" style={{ borderColor: 'var(--border)' }}>Go to Builder</a>
            <button onClick={syncFromOpenAI} className="px-4 py-2 rounded-md border inline-flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Sync from OpenAI
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Top bar */}
      <div className="sticky top-0 z-20 backdrop-blur-sm border-b" style={{ background:'color-mix(in oklab, var(--panel) 88%, transparent)', borderColor:'var(--border)' }}>
        <div className="mx-auto w-full max-w-[1400px] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bot size={20}/><span className="font-semibold">Improve</span><span className="opacity-60">/</span>
            <AgentPicker
              agents={agents}
              selectedId={agentId!}
              onSelect={(id) => {
                const a = agents.find(x => x.id === id)!;
                setAgentId(a.id);
                setModel(a.model);
                setTemperature(a.temperature ?? 0.5);
              }}
              onRefresh={syncFromOpenAI}
              isRefreshing={isRefreshing}
            />
            <div className="ml-1 text-xs flex items-center gap-1 opacity-80">
              {isSaving ? (<><Loader2 size={14} className="animate-spin"/> Saving…</>) : (<><Check size={14}/> Saved</>)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSettings(v => !v)} className="px-2 py-1 rounded-md border inline-flex items-center gap-2" style={{ borderColor: 'var(--border)' }}>
              <Settings2 size={16}/> Settings {showSettings ? <ChevronUp size={16}/> : <ChevronDown size={16}/> }
            </button>
          </div>
        </div>

        {showSettings && (
          <div className="mx-auto w-full max-w-[1400px] px-4 pb-3 grid md:grid-cols-3 gap-3">
            <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
              <div className="text-xs opacity-70 mb-1">Model</div>
              <select
                className="w-full rounded-md px-2 py-2 border bg-transparent"
                style={{borderColor:'var(--border)'}}
                value={model}
                onChange={e => { const m = e.target.value as ModelId; setModel(m); persistModelTemp(m, undefined); }}
              >
                {MODEL_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>

            <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
              <div className="text-xs opacity-70 mb-1">Creativity (Temperature)</div>
              <input type="range" min={0} max={1} step={0.05} value={temperature}
                     onChange={e => { const t = parseFloat(e.target.value); setTemperature(t); }}
                     onMouseUp={() => persistModelTemp(undefined, temperature)}
                     onTouchEnd={() => persistModelTemp(undefined, temperature)}
                     className="w-full"/>
              <div className="text-xs opacity-60 mt-1">{temperature.toFixed(2)}</div>
            </div>

            <div className="rounded-lg p-3 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
              <div className="text-xs opacity-70 mb-2">Quick actions</div>
              <div className="flex gap-2">
                <button onClick={() => setHistory(h => [...h])} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}><History size={16}/> Save Version</button>
                <button onClick={() => { try { const last = [...history].reverse().find(m => m.role==='assistant')?.content || ''; navigator.clipboard.writeText(last); } catch {} }} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}><Copy size={16}/> Copy Reply</button>
                <button onClick={() => setHistory(h => h.slice(0,1))} className="px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}><Trash2 size={16}/> Clear</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Chat */}
      <div className="mx-auto w-full max-w-[1400px] px-4 py-6 grid lg:grid-cols-[420px,1fr] gap-6">
        {/* Left (tiny demo refinements area just to keep layout) */}
        <div className="rounded-xl p-4 border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
          <div className="font-semibold mb-2">Your Refinements</div>
          <div className="text-sm opacity-70">Refinements are local only in this simplified build.</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Chip label="Be concise"/><Chip label="No greeting"/><Chip label="Yes/No only"/><Chip label="1-word"/>
          </div>
        </div>

        <div className="rounded-xl flex flex-col border" style={{borderColor:'var(--border)',background:'var(--panel)',minHeight:560}}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {history.map(m => (
              <div key={m.id} className={`max-w-[80%] ${m.role==='user' ? 'ml-auto' : ''}`}>
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background: m.role==='user' ? 'var(--card)' : 'var(--panel)'}}>
                  <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
                </div>
              </div>
            ))}
            {isSending && (
              <div className="max-w-[80%]">
                <div className="rounded-lg px-3 py-2 text-sm border" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
                  <span className="inline-flex gap-1 items-center">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{background:'currentColor',animationDelay:'0ms'}}/>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{background:'currentColor',animationDelay:'120ms'}}/>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{background:'currentColor',animationDelay:'240ms'}}/>
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2">
              <input className="flex-1 rounded-md px-3 py-2 text-sm border bg-transparent" style={{borderColor:'var(--border)'}} placeholder="Type your message…"
                     value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key==='Enter') sendMessage(); }}/>
              <button onClick={sendMessage} disabled={isSending} className="px-3 py-2 rounded-md flex items-center gap-2 border disabled:opacity-60" style={{borderColor:'var(--border)'}}>
                {isSending ? <Loader2 size={16} className="animate-spin"/> : <Send size={16}/>} Send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({ label }: { label: string }) {
  return <span className="text-xs px-2 py-1 rounded-full border" style={{borderColor:'var(--border)',background:'var(--card)'}}>{label}</span>;
}

function AgentPicker({
  agents, selectedId, onSelect, onRefresh, isRefreshing
}: {
  agents: Agent[]; selectedId: string; onSelect: (id:string)=>void; onRefresh: ()=>void; isRefreshing: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e:MouseEvent) => { if (!wrapRef.current?.contains(e.target as Node)) setOpen(false); };
    const onEsc = (e:KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onEsc); };
  }, []);

  const selected = agents.find(a => a.id === selectedId);
  const filtered = agents.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div ref={wrapRef} className="relative">
      <button onClick={() => setOpen(v => !v)} className="px-2.5 py-1.5 rounded-md border inline-flex items-center gap-2 text-sm" style={{borderColor:'var(--border)',background:'var(--card)'}}>
        <span className="truncate max-w-[180px]">{selected?.name ?? 'Choose agent'}</span>
        <ChevronDown size={14} />
      </button>

      {open && (
        <div className="absolute mt-2 w-[280px] rounded-lg border shadow-lg z-20" style={{borderColor:'var(--border)',background:'var(--panel)'}}>
          <div className="p-2 border-b" style={{borderColor:'var(--border)'}}>
            <div className="flex items-center gap-2">
              <Search size={14} className="opacity-70"/>
              <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search agents…" className="flex-1 bg-transparent outline-none text-sm"/>
              <button onClick={onRefresh} className="px-2 py-1 rounded-md border text-xs inline-flex items-center gap-1" style={{borderColor:'var(--border)'}}>
                {isRefreshing ? <Loader2 size={12} className="animate-spin"/> : <RefreshCw size={12}/>} Sync
              </button>
            </div>
          </div>

          <div className="max-h-[260px] overflow-y-auto">
            {filtered.map(a => (
              <button key={a.id} onClick={() => { onSelect(a.id); setOpen(false); }}
                      className={`w-full text-left px-3 py-2 text-sm border-b hover:opacity-100 transition ${a.id===selectedId?'opacity-100':'opacity-90'}`}
                      style={{borderColor:'var(--border)'}} title={a.name}>
                <div className="flex items-center justify-between">
                  <span className="truncate">{a.name}</span>
                  {a.id===selectedId && <Check size={14}/>}
                </div>
                <div className="text-xs opacity-60 mt-0.5">
                  {a.model} • {new Date(a.createdAt).toLocaleDateString()}
                </div>
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-6 text-sm opacity-70">No agents found.</div>}
          </div>
        </div>
      )}
    </div>
  );
}
