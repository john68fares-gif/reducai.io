// pages/improve.tsx
'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

type AgentItem = { id: string; name: string; createdAt: number; model: string; temperature: number };

const MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o mini' },
  { value: 'gpt-4.1', label: 'GPT-4.1' },
  { value: 'gpt-4.1-mini', label: 'GPT-4.1 mini' },
  { value: 'o3', label: 'o3 (reasoning)' },
  { value: 'o3-mini', label: 'o3-mini (fast)' },
];

type ChatMsg = { role: 'user' | 'assistant'; content: string };

export default function ImprovePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [model, setModel] = useState<string>('gpt-4o-mini');
  const [temperature, setTemperature] = useState<number>(0.5);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [saving, setSaving] = useState(false);

  // Get Supabase user id
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const uid = session?.user?.id || null;
      setUserId(uid);
    })();
  }, []);

  // Load agents for this user
  async function loadAgents() {
    if (!userId) return;
    setLoadingAgents(true);
    try {
      const r = await fetch(`/api/chatbots?ownerId=${encodeURIComponent(userId)}`, { cache: 'no-store' });
      const list: AgentItem[] = r.ok ? await r.json() : [];
      setAgents(list);
      if (!selectedId && list.length) {
        select(list[0]);
      } else if (selectedId) {
        const found = list.find(a => a.id === selectedId);
        if (found) {
          setModel(found.model);
          setTemperature(found.temperature);
        }
      }
    } finally {
      setLoadingAgents(false);
    }
  }

  useEffect(() => { loadAgents(); /* eslint-disable-next-line */ }, [userId]);

  function select(a: AgentItem) {
    setSelectedId(a.id);
    setModel(a.model);
    setTemperature(a.temperature);
    setMsgs([]);
  }

  // Debounced save model/temp to assistant metadata
  useEffect(() => {
    if (!userId || !selectedId) return;
    const to = setTimeout(async () => {
      setSaving(true);
      try {
        await fetch(`/api/chatbots/${selectedId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ownerId: userId, model, temperature }),
        });
      } finally {
        setSaving(false);
      }
    }, 400);
    return () => clearTimeout(to);
  }, [userId, selectedId, model, temperature]);

  async function send() {
    const text = input.trim(); if (!text || !selectedId) return;
    setInput('');
    const next = [...msgs, { role: 'user', content: text }];
    setMsgs(next);

    const r = await fetch('/api/improve/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature,
        system: '',
        messages: next,
        guardLevel: 'lenient',
      }),
    });

    if (r.ok) {
      const data = await r.json();
      setMsgs([...next, { role: 'assistant', content: data.content || '' }]);
    } else {
      const t = await r.text().catch(() => '');
      setMsgs([...next, { role: 'assistant', content: `(error) ${t || r.statusText}` }]);
    }
  }

  if (userId === null) {
    return <Center>Checking session…</Center>;
  }

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="max-w-6xl mx-auto">
        <header className="mb-4 flex items-center justify-between">
          <div className="text-xl font-semibold">Tuning</div>
          <div className="text-sm opacity-70">{saving ? 'Saving…' : 'Saved'}</div>
        </header>

        {/* Empty state */}
        {!loadingAgents && agents.length === 0 && (
          <div className="grid place-items-center h-[60vh]">
            <div className="text-center space-y-3">
              <div className="font-medium">No agents yet</div>
              <div className="opacity-70 text-sm">
                Create an AI in the Builder first (this list only shows agents that belong to <strong>your</strong> account).
              </div>
              <div className="flex items-center gap-2 justify-center">
                <a href="/builder" className="px-3 py-2 rounded-md border" style={{ borderColor: 'var(--border)' }}>Go to Builder</a>
                <button onClick={loadAgents} className="px-3 py-2 rounded-md border" style={{ borderColor: 'var(--border)' }}>
                  Sync from OpenAI
                </button>
              </div>
            </div>
          </div>
        )}

        {agents.length > 0 && (
          <div className="grid gap-4 md:grid-cols-[360px,1fr]">
            {/* Left column */}
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <div className="text-sm opacity-70 mb-1">AI to tune</div>
              <select
                value={selectedId ?? ''}
                onChange={(e) => {
                  const a = agents.find(x => x.id === e.target.value);
                  if (a) select(a);
                }}
                className="w-full rounded-md border px-2 py-2 bg-transparent"
                style={{ borderColor: 'var(--border)' }}
              >
                {agents.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} — {new Date(a.createdAt).toLocaleDateString()}
                  </option>
                ))}
              </select>

              <div className="mt-4">
                <div className="text-sm opacity-70 mb-1">Model</div>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-md border px-2 py-2 bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>

              <div className="mt-4">
                <div className="text-sm opacity-70 mb-1">Creativity (Temperature): {temperature.toFixed(2)}</div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="mt-4">
                <button onClick={loadAgents} className="px-3 py-2 rounded-md border text-sm"
                        style={{ borderColor: 'var(--border)' }}>
                  Sync from OpenAI
                </button>
              </div>
            </div>

            {/* Right column = Chat */}
            <div className="rounded-lg border p-3 flex flex-col" style={{ borderColor: 'var(--border)', background: 'var(--panel)' }}>
              <div className="flex-1 overflow-y-auto space-y-3">
                {msgs.length === 0 && (
                  <div className="opacity-70 text-sm">This is the Improve panel. Your agent will reply based on the current model and temperature.</div>
                )}
                {msgs.map((m, i) => (
                  <div key={i} className={`max-w-[80%] ${m.role === 'user' ? 'ml-auto' : ''}`}>
                    <div className="rounded-md border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
                      <pre className="whitespace-pre-wrap">{m.content}</pre>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
                  placeholder="Type your message…"
                  className="flex-1 rounded-md border px-3 py-2 bg-transparent"
                  style={{ borderColor: 'var(--border)' }}
                />
                <button onClick={send} className="px-3 py-2 rounded-md border" style={{ borderColor: 'var(--border)' }}>
                  Send
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen grid place-items-center" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
    {children}
  </div>;
}
