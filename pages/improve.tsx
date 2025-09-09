// pages/improve.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Bot, Save, MessageSquare, Settings2, Wand2, X } from 'lucide-react';

type Agent = { id: string; name: string; prompt: string };
type Msg = { role: 'user' | 'assistant'; text: string; id: string };

const STORAGE_KEY = 'chatbots';

export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('gpt-4o-mini');
  const [temperature, setTemperature] = useState(0.5);

  const [improvingMsg, setImprovingMsg] = useState<Msg | null>(null);
  const [improveText, setImproveText] = useState('');
  const [improvePrompt, setImprovePrompt] = useState('');

  // Load agents
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  const send = () => {
    const value = input.trim();
    if (!value) return;
    const id = crypto.randomUUID();
    setMessages(prev => [...prev, { role: 'user', text: value, id }]);
    setInput('');

    // mock reply
    setTimeout(() => {
      const replyId = crypto.randomUUID();
      setMessages(prev => [
        ...prev,
        { role: 'assistant', text: `(${model}, temp ${temperature}) → response to "${value}"`, id: replyId }
      ]);
    }, 600);
  };

  const openImprove = (msg: Msg) => {
    setImprovingMsg(msg);
    setImproveText('');
    setImprovePrompt(selectedAgent?.prompt || '');
  };

  const saveImprove = () => {
    if (!selectedId || !improvingMsg) return;
    const updated = agents.map(a =>
      a.id === selectedId ? { ...a, prompt: improvePrompt } : a
    );
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setAgents(updated);
    setImprovingMsg(null);
  };

  const selectedAgent = agents.find(a => a.id === selectedId);

  return (
    <div className="min-h-screen bg-white text-black dark:bg-[#0b0c10] dark:text-white px-6 py-10 md:pl-[260px]">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left side: Chat + improve */}
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" /> Tuning Lab
          </h1>

          {/* Agent selector */}
          <select
            value={selectedId || ''}
            onChange={e => setSelectedId(e.target.value)}
            className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-black dark:text-white"
          >
            <option value="">Select an agent…</option>
            {agents.map(a => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Chat */}
          <div className="h-[460px] overflow-y-auto rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#0d0f11] p-4 space-y-3">
            {messages.map(m => (
              <div key={m.id} className="flex items-start gap-2">
                <div
                  className={`p-2 rounded-md max-w-[80%] ${
                    m.role === 'user'
                      ? 'ml-auto bg-green-100 dark:bg-emerald-900/30'
                      : 'bg-gray-200 dark:bg-[#1a1d21]'
                  }`}
                >
                  {m.text}
                </div>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => openImprove(m)}
                    className="p-1 rounded hover:bg-white/10"
                    title="Improve this response"
                  >
                    <Wand2 className="w-4 h-4 text-emerald-400" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
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

        {/* Right side: Model + Temp */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Settings
          </h2>

          <div className="flex items-center gap-3">
            <select
              value={model}
              onChange={e => setModel(e.target.value)}
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
                onChange={e => setTemperature(parseFloat(e.target.value))}
              />
              <span>{temperature.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Improve Overlay */}
      {improvingMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-white dark:bg-[#0d0f11] border border-gray-300 dark:border-gray-700 rounded-xl p-6 w-full max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-emerald-400" /> Improve Response
              </h3>
              <button onClick={() => setImprovingMsg(null)} className="p-1 rounded hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-sm text-gray-600 dark:text-gray-400">
              AI chose this response based on its current prompt. You can edit the prompt directly
              or describe how you want it improved.
            </div>

            <textarea
              value={improvePrompt}
              onChange={e => setImprovePrompt(e.target.value)}
              className="w-full h-[180px] p-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0b0c10] text-sm text-black dark:text-white"
            />

            <input
              value={improveText}
              onChange={e => setImproveText(e.target.value)}
              placeholder="Describe how to improve (optional)…"
              className="w-full p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-black dark:text-white"
            />

            <button
              onClick={saveImprove}
              className="px-4 py-2 rounded-md font-semibold bg-green-400 text-black hover:bg-green-300 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-800/50"
            >
              Save Improvement
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
