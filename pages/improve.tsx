// pages/improve.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, Settings2, Edit3, X, Save } from 'lucide-react';

type Agent = {
  id: string;
  name: string;
  prompt: string[]; // store prompts as array of rules
};

const STORAGE_KEY = 'chatbots';
type Message = { role: 'user' | 'assistant'; text: string; usedPrompts?: string[] };

export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);

  // Overlay for improvements
  const [improveOpen, setImproveOpen] = useState(false);
  const [targetMessage, setTargetMessage] = useState<Message | null>(null);
  const [editPrompt, setEditPrompt] = useState('');
  const [userInstruction, setUserInstruction] = useState('');

  // Load agents
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  const agent = agents.find((a) => a.id === selectedId);

  const send = async () => {
    const value = input.trim();
    if (!value || !agent) return;

    setMessages((prev) => [...prev, { role: 'user', text: value }]);
    setInput('');

    // Fake AI logic: pick some rules from agent.prompt
    const used = agent.prompt.slice(0, 2); // simulate subset of prompts
    const reply = `Hello! Thanks for your message: "${value}".`;

    setMessages((prev) => [...prev, { role: 'assistant', text: reply, usedPrompts: used }]);
  };

  const openImprove = (m: Message) => {
    if (!m.usedPrompts) return;
    setTargetMessage(m);
    setEditPrompt(m.usedPrompts[0] || ''); // default: first rule
    setUserInstruction('');
    setImproveOpen(true);
  };

  const applyImprove = () => {
    if (!agent || !targetMessage) return;

    const nextAgents = agents.map((a) => {
      if (a.id !== agent.id) return a;

      let newPrompts = [...a.prompt];
      if (editPrompt) {
        // Replace the first used prompt for now
        const idx = a.prompt.indexOf(targetMessage.usedPrompts?.[0] || '');
        if (idx >= 0) newPrompts[idx] = editPrompt;
      }
      if (userInstruction) {
        // Append user suggestion as a new refinement
        newPrompts.push(`Refinement: ${userInstruction}`);
      }
      return { ...a, prompt: newPrompts };
    });

    setAgents(nextAgents);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextAgents));
    setImproveOpen(false);
  };

  return (
    <div
      className="min-h-screen px-6 py-10 md:pl-[260px]"
      style={{ background: 'var(--bg)', color: 'var(--text)' }}
    >
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Agent selector */}
        <div className="panel p-6 space-y-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-[var(--brand)]" /> Choose Agent
          </h1>
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
        </div>

        {/* Right: Tuning Lab */}
        <div className="panel p-6 space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[var(--brand)]" /> Tuning Lab
          </h2>

          {/* Chat window */}
          <div className="h-[500px] overflow-y-auto rounded-lg border bg-[var(--card)] border-[var(--border)] p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`relative p-3 rounded-md max-w-[80%] text-sm ${
                  m.role === 'user'
                    ? 'ml-auto bg-[var(--brand)] text-black'
                    : 'bg-[var(--panel)] text-[var(--text)]'
                }`}
              >
                {m.text.replace(/\*\*/g, '')}
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
            <button
              onClick={send}
              className="px-4 py-2 rounded-md font-semibold btn-brand"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Improve Overlay */}
      {improveOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(0,0,0,0.6)' }}
        >
          <div className="panel w-full max-w-[700px] p-6 space-y-4 relative">
            <button
              onClick={() => setImproveOpen(false)}
              className="absolute top-3 right-3 text-[var(--text-muted)] hover:text-[var(--brand)]"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[var(--brand)]" /> Improve Response
            </h3>

            {targetMessage?.usedPrompts && (
              <>
                <label className="block text-sm mb-1">Edit used prompt:</label>
                <textarea
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  className="w-full h-[120px] p-3 rounded-lg border bg-[var(--card)] border-[var(--border)] text-sm text-[var(--text)]"
                />
              </>
            )}

            <label className="block text-sm mb-1">Or describe what to change:</label>
            <input
              value={userInstruction}
              onChange={(e) => setUserInstruction(e.target.value)}
              placeholder="E.g. Instead of 'Hello', say 'Hi'"
              className="w-full p-2 rounded-md border bg-[var(--card)] border-[var(--border)] text-[var(--text)]"
            />

            <button
              onClick={applyImprove}
              className="w-full px-4 py-2 rounded-md font-semibold btn-brand flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Improvement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
