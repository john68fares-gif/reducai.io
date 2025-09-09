// pages/improve.tsx
"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Settings2, Send, Wrench } from "lucide-react";

type Agent = {
  id: string;
  name: string;
  prompt: string;
};

const STORAGE_KEY = "chatbots";

export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; text: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.5);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  const selectedAgent = agents.find((a) => a.id === selectedId) || null;

  const send = async () => {
    const value = input.trim();
    if (!value || !selectedAgent) return;

    setMessages((prev) => [...prev, { role: "user", text: value }]);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent: {
            name: selectedAgent.name,
            prompt: selectedAgent.prompt,
            model,
            temperature,
          },
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.text })),
            { role: "user", content: value },
          ],
        }),
      });

      const data = await resp.json();
      if (data.ok) {
        setMessages((prev) => [...prev, { role: "assistant", text: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `⚠️ Error: ${data.error}` },
        ]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", text: "⚠️ Failed to reach server." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-10 md:pl-[260px] bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Settings2 className="w-5 h-5" /> Tuning Lab
        </h1>

        {/* Agent selector + Settings */}
        <div className="flex items-center gap-4">
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="px-3 py-2 rounded-md border border-gray-700 bg-[#0d0f11] text-white"
          >
            <option value="">Select an agent…</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="px-3 py-2 rounded-md border border-gray-700 bg-[#0d0f11] text-white"
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

        {/* Chat area */}
        <div className="rounded-xl border border-gray-700 bg-[#0d0f11] p-4 h-[500px] overflow-y-auto space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg max-w-[80%] ${
                m.role === "user"
                  ? "ml-auto bg-[var(--brand)] text-black"
                  : "bg-gray-800 text-white"
              }`}
            >
              {m.text}
              {m.role === "assistant" && (
                <button
                  className="ml-2 text-xs text-[var(--brand)] hover:underline"
                  onClick={() => alert("Improve UI to edit prompts goes here")}
                >
                  Improve
                </button>
              )}
            </div>
          ))}
          {loading && (
            <div className="p-2 text-sm text-gray-400">…thinking</div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            className="flex-1 p-3 rounded-md border border-gray-700 bg-[#0d0f11] text-white"
          />
          <button
            onClick={send}
            disabled={loading || !selectedAgent}
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-black font-semibold hover:opacity-90"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
