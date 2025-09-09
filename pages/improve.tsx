// pages/improve.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Save, MessageSquare, Settings2, Edit3, X } from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  prompt: string;
};

const STORAGE_KEY = 'chatbots';

type Message = { role: 'user' | 'assistant'; text: string };

export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);

  // Improve overlay
  const [improveOpen, setImproveOpen] = useState(false);
  const [improveTarget, setImproveTarget] = useState<Message | null>(null);
  const [improveText, setImproveText] = useState('');

  // Load agents
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  // Load prompt when agent selected
  useEffect(() => {
    const agent = agents.find((a) => a.id === selectedId);
    if (agent) setPrompt(agent.prompt || '');
  }, [selectedId, agents]);

  const saveChanges = () => {
    if (!selectedId) return;
    const next = agents.map((a) =>
      a.id === selectedId ? { ...a, prompt } : a
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAgents(next);
    alert('Changes saved');
  };

  const send = async () => {
    const value = input.trim();
    if (!value) return;
    setMessages((prev) => [...prev, { role: 'user', text: value }]);
    setInput('');

    try {
      const res = await fetch('/api/voice/improve-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw: prompt,
          company: 'Your Company',
          language: 'en-US',
        }),
      });
      const data = await res.json();
      const reply =
        data?.data?.prompt ||
        `(mock: ${model}, temp ${temperature}) → response to "${value}"`;

      setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '⚠️ Error contacting API' },
      ]);
    }
  };

  const openImprove = (m: Message) => {
    setImproveTarget(m);
    setImproveText(m.text);
    setImproveOpen(true);
  };

  const applyImprove = () => {
    if (!improveTarget) return;
    // Replace the text with the improved version
    setMessages((msgs) =>
      msgs.map((m) =>
        m === improveTarget ? { ...m, text: improveText } : m
      )
    );
    setImproveOpen(false);
  };

  return (
    <div
      className="min-h-screen px-6 py-10 md:pl-[260px]"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Prompt Editor */}
        <div className="panel p-6 space-y-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[var(--brand)]" /> Improve Agent
          </h1>

          {/* Agent selector */}
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full p-2 rounded-md border bg-[var(--card)] border-[var(--border)] text-[var(--text)]"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Prompt editor */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Edit your agent’s prompt here…"
            className="w-full h-[400px] p-3 rounded-lg border bg-[var(--card)] border-[var(--border)] text-sm text-[var(--text)] outline-none"
          />

          <button
            onClick={saveChanges}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold btn-brand"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>

        {/* Test Lab */}
        <div className="panel p-6 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--brand)]" /> Tuning Lab
          </h2>

          {/* Model + temp */}
          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex-1 p-2 rounded-md border bg-[var(--card)] border-[var(--border)] text-[var(--text)]"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-3.5">GPT-3.5</option>
            </select>
            <div className="flex items-center gap-2 text-sm">
              <span>Temp:</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
              <span>{temperature.toFixed(1)}</span>
            </div>
          </div>

          {/* Chat window */}
          <div className="h-[400px] overflow-y-auto rounded-lg border bg-[var(--card)] border-[var(--border)] p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`relative p-3 rounded-md max-w-[80%] text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-[var(--brand)] text-black'
                    : 'bg-[var(--panel)] text-[var(--text)]'
                }`}
              >
                {m.text}
                {m.role === 'assistant' && (
                  <button
                    onClick={() => openImprove(m)}
                    className="absolute -right-7 top-2 text-[var(--text-muted)] hover:text-[var(--brand)]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message…"
              className="flex-1 p-2 rounded-md border bg-[var(--card)] border-[var(--border)] text-[var(--text)]"
            />
            <button onClick={send} className="px-4 py-2 rounded-md font-semibold btn-brand">
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Improve Overlay */}
      {improveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="panel w-full max-w-[600px] p-6 space-y-4 relative">
            <button
              onClick={() => setImproveOpen(false)}
              className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--brand)]"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[var(--brand)]" /> Improve Response
            </h3>
            <textarea
              value={improveText}
              onChange={(e) => setImproveText(e.target.value)}
              className="w-full h-[200px] p-3 rounded-lg border bg-[var(--card)] border-[var(--border)] text-sm text-[var(--text)] outline-none"
            />
            <button
              onClick={applyImprove}
              className="w-full px-4 py-2 rounded-md font-semibold btn-brand"
            >
              Save Improvement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
