// pages/improve.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Save, MessageSquare, Settings2 } from 'lucide-react';

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
      setMessages((prev) => [...prev, { role: 'assistant', text: `(${model}, temp ${temperature}) → response to "${value}"` }]);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-white text-black dark:bg-[#0b0c10] dark:text-white px-6 py-10 md:pl-[260px]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Prompt Editor */}
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Improve Agent
          </h1>

          {/* Agent selector */}
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-black dark:text-white"
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
            className="w-full h-[400px] p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-sm text-black dark:text-white outline-none"
          />

          <button
            onClick={saveChanges}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-semibold bg-green-400 text-black hover:bg-green-300 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-800/50"
          >
            <Save className="w-4 h-4" /> Save Changes
          </button>
        </div>

        {/* Right: Test Lab */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Test Lab
          </h2>

          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-black dark:text-white"
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
          <div className="h-[400px] overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#0d0f11] p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`p-2 rounded-md max-w-[80%] ${
                  m.role === 'user'
                    ? 'ml-auto bg-green-100 dark:bg-emerald-900/30'
                    : 'bg-gray-200 dark:bg-[#1a1d21]'
                }`}
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
              className="flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-black dark:text-white"
            />
            <button
              onClick={send}
              className="px-4 py-2 rounded-md bg-green-400 text-black font-semibold hover:bg-green-300 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-800/50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
