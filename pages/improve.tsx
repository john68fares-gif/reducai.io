// pages/improve.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Send } from "lucide-react";
import { AgentProvider } from "@/components/agents/AgentContext";

/* ================= Types ================= */
type Msg = { role: "user" | "assistant"; text: string };
type Agent = { id: string; name: string; prompt: string; firstMessage?: string };

/* ================= Helpers ================= */
const STORAGE_KEY = "chatbots";
const THREAD_KEY = (id: string) => `improve:thread:${id}`;
const clamp = (s: string, n = 8000) => String(s ?? "").slice(0, n);
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
};

/* ================= Inner Component ================= */
function ImproveInner() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const [model, setModel] = useState("gpt-4o-mini");
  // Simpler, not-scammmy control: three presets instead of a raw slider.
  type CreativityLevel = "basic" | "balanced" | "creative";
  const [creativity, setCreativity] = useState<CreativityLevel>("balanced");
  const temperature = useMemo(() => {
    if (creativity === "basic") return 0.2;
    if (creativity === "creative") return 0.8;
    return 0.5;
  }, [creativity]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAssistantHashRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* Load agents list */
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

  /* Load thread for selected agent + seed first message */
  useEffect(() => {
    lastAssistantHashRef.current = null;
    setError(null);

    if (!selectedAgent) {
      setMessages([]);
      return;
    }

    try {
      const raw = sessionStorage.getItem(THREAD_KEY(selectedAgent.id));
      if (raw) {
        const parsed: Msg[] = JSON.parse(raw);
        setMessages(parsed);
        const lastA = [...parsed].reverse().find((m) => m.role === "assistant");
        lastAssistantHashRef.current = lastA ? hash(lastA.text) : null;
        return;
      }
    } catch {
      // ignore
    }

    if (selectedAgent.firstMessage?.trim()) {
      const fm = selectedAgent.firstMessage.trim();
      setMessages([{ role: "assistant", text: fm }]);
      lastAssistantHashRef.current = hash(fm);
    } else {
      setMessages([]);
    }
  }, [selectedAgent?.id]);

  /* Persist thread */
  useEffect(() => {
    if (!selectedAgent) return;
    try {
      sessionStorage.setItem(THREAD_KEY(selectedAgent.id), JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, selectedAgent?.id]);

  /* Auto-scroll on new messages */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  /* Send message */
  const send = async () => {
    const value = input.trim();
    if (!value || !selectedAgent || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: value }]);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data?.ok) {
        const msg = data?.error || "Server error";
        setError(msg);
        setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
      } else {
        const candidate: string = String(data.reply || "").trim();
        const candHash = hash(candidate);
        if (lastAssistantHashRef.current && candHash === lastAssistantHashRef.current) {
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
    } catch (e: any) {
      setError("Failed to reach server.");
      setMessages((prev) => [...prev, { role: "assistant", text: "⚠️ Failed to reach server." }]);
    } finally {
      setLoading(false);
    }
  };

  /* UI */
  return (
    <div className="min-h-screen px-6 py-10 md:pl-[260px] bg-[var(--bg)] text-[var(--text)]">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-semibold flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-white/5">
              <Settings2 className="w-4 h-4 text-white/80" />
            </span>
            <span className="text-white/90">Tuning Lab</span>
          </h1>
        </div>

        {/* Controls */}
        <div
          className="rounded-xl p-4 flex flex-wrap items-center gap-4"
          style={{ background: "#0d0f11", border: "1px solid rgba(255,255,255,.08)" }}
        >
          {/* Agent */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Agent</span>
            <select
              value={selectedId || ""}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="px-3 py-2 rounded-md border border-gray-700 bg-[#0f1113] text-white"
            >
              <option value="">Select…</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Model</span>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="px-3 py-2 rounded-md border border-gray-700 bg-[#0f1113] text-white"
            >
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-3.5">GPT-3.5</option>
            </select>
          </div>

          {/* Creativity (Basic | Balanced | Creative) */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Creativity</span>
            <div
              className="inline-flex rounded-md overflow-hidden border"
              style={{ borderColor: "rgba(255,255,255,.1)" }}
            >
              {(["basic", "balanced", "creative"] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setCreativity(level)}
                  className={`px-3 py-2 text-sm ${
                    creativity === level ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5"
                  }`}
                >
                  {level === "basic" ? "Basic" : level === "balanced" ? "Balanced" : "Creative"}
                </button>
              ))}
            </div>
            <span className="text-xs text-white/40">({temperature.toFixed(1)})</span>
          </div>
        </div>

        {/* Error (inline) */}
        {error && (
          <div
            className="rounded-md px-3 py-2 text-sm"
            style={{ background: "#2a1111", color: "#ffb3b3", border: "1px solid #552222" }}
          >
            {error}
          </div>
        )}

        {/* Chat */}
        <div
          ref={scrollRef}
          className="rounded-xl p-4 h-[520px] overflow-y-auto space-y-3"
          style={{ background: "#0d0f11", border: "1px solid rgba(255,255,255,.08)" }}
          aria-live="polite"
        >
          {messages.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] p-3 rounded-xl leading-relaxed ${
                m.role === "user"
                  ? "ml-auto text-black"
                  : "mr-auto text-white"
              }`}
              style={
                m.role === "user"
                  ? { background: "var(--brand)" }
                  : { background: "#0f1113", border: "1px solid rgba(255,255,255,.08)" }
              }
            >
              {m.text}
            </div>
          ))}

          {loading && (
            <div
              className="mr-auto p-3 rounded-xl text-white"
              style={{ background: "#0f1113", border: "1px solid rgba(255,255,255,.08)" }}
            >
              <TypingDots />
            </div>
          )}
        </div>

        {/* Input row */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type a message…"
            className="flex-1 p-3 rounded-md bg-[#0f1113] text-white outline-none"
            style={{ border: "1px solid rgba(255,255,255,.08)" }}
          />
          <button
            onClick={send}
            disabled={loading || !selectedAgent}
            className="px-4 py-2 rounded-md font-semibold disabled:opacity-50"
            style={{ background: "var(--brand)", color: "#03231c" }}
            title="Send"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ================= Page Wrapper ================= */
export default function ImprovePage() {
  return (
    <AgentProvider>
      <ImproveInner />
    </AgentProvider>
  );
}

/* ================= Typing Dots ================= */
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
      className="w-2 h-2 inline-block rounded-full bg-white/80"
      style={{ animation: "improve-bounce 1s infinite", animationDelay: delay }}
    />
  );
}
const style = `
@keyframes improve-bounce {
  0%, 80%, 100% { transform: scale(0.66); opacity:.6; }
  40% { transform: scale(1); opacity:1; }
}`;
if (typeof document !== "undefined" && !document.getElementById("improve-bounce-style")) {
  const el = document.createElement("style");
  el.id = "improve-bounce-style";
  el.textContent = style;
  document.head.appendChild(el);
}
