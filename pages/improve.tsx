'use client';

import React, { useEffect, useState } from 'react';
import { MessageSquare, Save, Settings2, Wand2, History, X } from 'lucide-react';

/* ------------------ Types ------------------ */
type Agent = {
  id: string;
  name: string;
  prompt: string;
  model?: string;
  temperature?: number;
};

type Message = { role: 'user' | 'assistant'; text: string };
type Version = { id: string; name: string; prompt: string; createdAt: number };

const STORAGE_KEY = 'chatbots';
const VERSIONS_KEY = (agentId: string) => `chatbot:${agentId}:versions`;

/* ------------------ Component ------------------ */
export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const [versions, setVersions] = useState<Version[]>([]);
  const [showImprove, setShowImprove] = useState<null | { msg: Message }>(null);

  /* Load agents */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  /* When agent changes, load prompt + versions */
  useEffect(() => {
    const agent = agents.find((a) => a.id === selectedId);
    if (agent) {
      setPrompt(agent.prompt || '');
      try {
        const saved = JSON.parse(
          localStorage.getItem(VERSIONS_KEY(agent.id)) || '[]'
        );
        if (Array.isArray(saved)) setVersions(saved);
      } catch {}
    } else {
      setPrompt('');
      setVersions([]);
    }
    setMessages([]);
  }, [selectedId, agents]);

  /* Save versions */
  const saveVersion = (newPrompt: string, name?: string) => {
    if (!selectedId) return;
    const next: Version = {
      id: String(Date.now()),
      name: name || `v${versions.length + 1}`,
      prompt: newPrompt,
      createdAt: Date.now(),
    };
    const updated = [...versions, next];
    setVersions(updated);
    localStorage.setItem(VERSIONS_KEY(selectedId), JSON.stringify(updated));
    setPrompt(newPrompt);
  };

  /* Send message */
  const send = async () => {
    const value = input.trim();
    if (!value || !selectedId) return;

    setMessages((prev) => [...prev, { role: 'user', text: value }]);
    setInput('');
    setLoading(true);

    const agent = agents.find((a) => a.id === selectedId);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: value,
          agentPrompt: prompt,
          model: agent?.model || 'gpt-4o-mini',
          temperature: agent?.temperature ?? 0.7,
        }),
      });
      const data = await r.json();
      if (data.ok) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.reply.replace(/\*\*/g, '') },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: `(error) ${data.error}` },
        ]);
      }
    } catch (e: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: `(error) ${e.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-white text-black dark:bg-[#0b0c10] dark:text-white px-6 py-10 md:pl-[260px]">
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8 max-w-7xl mx-auto">
        {/* Left: Chat + Improve */}
        <div className="flex flex-col space-y-6">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Settings2 className="w-5 h-5" /> Tuning Lab
          </h1>

          {/* Agent selector */}
          <select
            value={selectedId || ''}
            onChange={(e) => setSelectedId(e.target.value)}
            className="p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11]"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          {/* Chat */}
          <div className="flex-1 flex flex-col rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#0d0f11] p-4 space-y-3 h-[500px] overflow-y-auto">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`relative p-2 rounded-md max-w-[80%] ${
                  m.role === 'user'
                    ? 'ml-auto bg-green-100 dark:bg-emerald-900/30'
                    : 'bg-gray-200 dark:bg-[#1a1d21]'
                }`}
              >
                {m.text}
                {m.role === 'assistant' && (
                  <button
                    onClick={() => setShowImprove({ msg: m })}
                    className="absolute -top-3 -right-3 p-1 rounded-full bg-white dark:bg-[#0d0f11] border border-gray-300 dark:border-gray-700 shadow text-xs"
                  >
                    <Wand2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {loading && (
              <div className="text-sm text-gray-500">AI is typing…</div>
            )}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder="Type a message…"
              className="flex-1 p-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11]"
            />
            <button
              onClick={send}
              disabled={loading}
              className="px-4 py-2 rounded-md bg-green-400 text-black font-semibold hover:bg-green-300 dark:bg-emerald-900/30 dark:text-emerald-100"
            >
              Send
            </button>
          </div>
        </div>

        {/* Right: Versions */}
        <div className="space-y-6">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <History className="w-5 h-5" /> Versions
          </h2>
          {versions.length === 0 ? (
            <div className="text-gray-500 dark:text-gray-400">
              No versions yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li
                  key={v.id}
                  className="p-3 rounded-md border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#0d0f11]"
                >
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(v.createdAt).toLocaleString()}
                  </div>
                  <button
                    onClick={() => setPrompt(v.prompt)}
                    className="mt-2 text-sm px-2 py-1 rounded bg-green-400 text-black dark:bg-emerald-900/30 dark:text-emerald-100"
                  >
                    Use this version
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Improve overlay */}
      {showImprove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white dark:bg-[#0b0c10] rounded-lg p-6 max-w-lg w-full space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-lg">Improve Response</h3>
              <button
                onClick={() => setShowImprove(null)}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-[#1a1d21]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              The assistant used the following prompt context. Edit it or
              describe how you want it to change:
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-40 p-2 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11]"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  saveVersion(prompt);
                  setShowImprove(null);
                }}
                className="flex-1 px-4 py-2 rounded bg-green-400 text-black font-semibold dark:bg-emerald-900/30 dark:text-emerald-100"
              >
                <Save className="w-4 h-4" /> Save as new version
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
