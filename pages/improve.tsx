// pages/improve.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Send } from "lucide-react";

/** ================= Types ================= */
type Msg = { role: "user" | "assistant"; text: string };

type Agent = {
  id: string;
  name: string;
  prompt: string;
  // optional fields if present in your project
  phoneNumberId?: string;   // -> enables server-side per-agent key on /api/chat
  firstMessage?: string;    // -> seeds first assistant message on new thread
};

const STORAGE_KEY = "chatbots";                // your existing agents list in localStorage
const THREAD_KEY = (agentId: string) => `improve:thread:${agentId}`; // per-agent thread (session)

/** Tiny helpers */
const clamp = (s: string, n = 8000) => String(s ?? "").slice(0, n);
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i) | 0;
  return String(h);
};

export default function ImprovePage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [temperature, setTemperature] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const lastAssistantHashRef = useRef<string | null>(null);

  /** Load agents once */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setAgents(saved);
    } catch {
      // ignore
    }
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId]
  );

  /** Load thread when agent changes; seed firstMessage if provided */
  useEffect(() => {
    lastAssistantHashRef.current = null;

    if (!selectedAgent) {
      setMessages([]);
      return;
    }

    try {
      const raw = sessionStorage.getItem(THREAD_KEY(selectedAgent.id));
      if (raw) {
        const parsed: Msg[] = JSON.parse(raw);
        setMessages(parsed);
        // reset last hash to the last assistant message (if any)
        const lastA = [...parsed].reverse().find((m) => m.role === "assistant");
        lastAssistantHashRef.current = lastA ? hash(lastA.text) : null;
        return;
      }
    } catch {
      // ignore
    }

    // No existing thread → seed with firstMessage if present
    if (selectedAgent.firstMessage?.trim()) {
      const fm = selectedAgent.firstMessage.trim();
      setMessages([{ role: "assistant", text: fm }]);
      lastAssistantHashRef.current = hash(fm);
    } else {
      setMessages([]);
    }
  }, [selectedAgent?.id]);

  /** Persist the thread per-agent in sessionStorage */
  useEffect(() => {
    if (!selectedAgent) return;
    try {
      sessionStorage.setItem(THREAD_KEY(selectedAgent.id), JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, selectedAgent?.id]);

  /** Send message */
  const send = async () => {
    const value = input.trim();
    if (!value || !selectedAgent || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: value }]);
    setInput("");
    setLoading(true);

    try {
      const bodyForNewRoute = {
        // Preferred path: uses your new /api/chat that looks up agent by phoneNumberId and uses per-agent key
        phoneNumberId: selectedAgent.phoneNumberId,
        model,
        temperature,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: clamp(m.text) })),
          { role: "user", content: clamp(value) },
        ],
      };

      const bodyForLegacyRoute = {
        // Fallback path: old shape you previously had
        agent: {
          name: selectedAgent.name,
          prompt: clamp(selectedAgent.prompt, 12000),
          model,
          temperature,
        },
        messages: [
          ...messages.map((m) => ({ role: m.role, content: clamp(m.text) })),
          { role: "user", content: clamp(value) },
        ],
      };

      // Decide which body to send: if agent has phoneNumberId → use new shape, else legacy
      const useNewShape = Boolean(selectedAgent.phoneNumberId);
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useNewShape ? bodyForNewRoute : bodyForLegacyRoute),
      });

      const data = await resp.json();

      if (!resp.ok || !data?.ok) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", text: `⚠️ Error: ${data?.error || "Server error"}` },
        ]);
      } else {
        const candidate: string = String(data.reply || "").trim();
        const candHash = hash(candidate);
        if (lastAssistantHashRef.current && candHash === lastAssistantHashRef.current) {
          // Anti-loop guard
          const guarded =
            candidate +
            "\n\n(Thanks—I'll avoid repeating myself. Could you share one new detail so I can move you forward?)";
          setMessages((prev) => [...prev, { role: "assistant", text: guarded }]);
          lastAssistantHashRef.current = hash(guarded);
        } else {
          setMessages((prev) => [...prev, { role: "assistant", text: candidate }]);
          lastAssistantHashRef.current = candHash;
        }
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
        <div className="flex flex-wrap items-center gap-4">
          <select
            value={selectedId || ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
            className="px-3 py-2 rounded-md border border-gray-700 bg-[#0d0f11] text-white"
            aria-label="Select agent"
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
            aria-label="Model"
          >
            <option value="gpt-4o-mini">GPT-4o Mini</option>
            <option value="gpt-4o">GPT-4o</option>
            <option value="gpt-3.5">GPT-3.5</option>
          </select>

          <div className="flex items-center gap-2 text-sm">
            <span>Temp:</span>
            <input
              aria-label="Temperature"
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
            </div>
          ))}

          {loading && (
            <div className="p-2 text-sm text-gray-400">
              <TypingDots />
            </div>
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
            className="px-4 py-2 rounded-md bg-[var(--brand)] text-black font-semibold hover:opacity-90 disabled:opacity-50"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Simple typing indicator (3 bouncing dots) — CSS-only */
function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1">
      <Dot delay="0ms" />
      <Dot delay="120ms" />
      <Dot delay="240ms" />
    </span>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="w-2 h-2 inline-block rounded-full bg-gray-400"
      style={{
        animation: "improve-bounce 1s infinite",
        animationDelay: delay,
      }}
    />
  );
}

/** keyframes for the dots (scoped, won’t affect global styles) */
const style = `
@keyframes improve-bounce {
  0%, 80%, 100% { transform: scale(0.66); opacity: .6; }
  40% { transform: scale(1); opacity: 1; }
}
`;
if (typeof document !== "undefined" && !document.getElementById("improve-bounce-style")) {
  const el = document.createElement("style");
  el.id = "improve-bounce-style";
  el.textContent = style;
  document.head.appendChild(el);
}
