'use client';

import React, { useEffect, useState } from 'react';
import { Save, MessageSquare, Settings2 } from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  prompt: string;
};

const STORAGE_KEY = 'chatbots';

export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);

  // Load bots from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  // When switching agent
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
    // mock reply for now
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `(${model}, temp ${temperature}) → response to "${value}"` },
      ]);
    }, 600);
  };

  return (
    <div
      className="min-h-screen px-6 py-10 md:pl-[260px]"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Prompt Editor */}
        <div
          className="space-y-6 p-6 rounded-2xl"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5" style={{ color: 'var(--brand)' }} /> Improve Agent
          </h1>

          {/* Agent selector */}
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full p-2 rounded-md text-sm outline-none"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
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
            className="w-full h-[400px] p-3 rounded-lg text-sm outline-none resize-none"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
          />

          <button
            onClick={saveChanges}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold"
            style={{
              background: 'var(--brand)',
              color: '#fff',
              boxShadow: '0 0 10px var(--brand)',
            }}
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>

        {/* Right: Test Lab */}
        <div
          className="space-y-6 p-6 rounded-2xl"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" style={{ color: 'var(--brand)' }} /> Test Lab
          </h2>

          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex-1 p-2 rounded-md text-sm outline-none"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-3.5">GPT-3.5</option>
            </select>
            <div className="flex items-center gap-2 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Temp:</span>
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
          <div
            className="h-[400px] overflow-y-auto rounded-lg p-4 space-y-3"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--border)',
            }}
          >
            {messages.map((m, i) => (
              <div
                key={i}
                className="p-2 rounded-md max-w-[80%]"
                style={{
                  background:
                    m.role === 'user'
                      ? 'rgba(0,255,194,0.15)'
                      : 'rgba(255,255,255,0.08)',
                  color: 'var(--text)',
                  marginLeft: m.role === 'user' ? 'auto' : undefined,
                }}
              >
                {m.text}
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
              className="flex-1 p-2 rounded-md text-sm outline-none"
              style={{
                background: 'var(--panel)',
                border: '1px solid var(--border)',
                color: 'var(--text)',
              }}
            />
            <button
              onClick={send}
              className="px-4 py-2 rounded-md font-semibold"
              style={{
                background: 'var(--brand)',
                color: '#fff',
                boxShadow: '0 0 10px var(--brand)',
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
