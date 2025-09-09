// pages/improve.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Settings2, Send } from "lucide-react";
import { AgentProvider } from "@/components/agents/AgentContext";

/* ================= Types ================= */
type Msg = { role: "user" | "assistant"; text: string };
type Agent = { id: string; name: string; prompt: string; firstMessage?: string };

/* ================= Helpers ================= */
const STORAGE_KEY = "chatbots";                          // your agents store
const THREAD_KEY = (id: string) => `improve:thread:${id}`; // per-agent thread

const clamp = (s: string, n = 8000) => String(s ?? "").slice(0, n);
const hash = (s: string) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return String(h);
};

/* Quick refinement dictionary -> instruction text the model will follow */
const REFINEMENT_MAP: Record<string, string> = {
  "talk-less": "Keep replies to 1–2 short sentences unless the user asks for detail.",
  "answer-only": "Only answer the user's question. Do not include any follow-up question.",
  "no-followup": "Do not ask a follow-up question.",
  "bullets": "Use concise bullet points instead of paragraphs.",
  "friendlier": "Use a friendly, professional tone with one brief empathetic sentence maximum.",
  "more-feedback": "Briefly reflect the user's intent in 1 sentence, then provide a clear next step.",
};

type Creativity = "basic" | "balanced" | "creative";

/* ================= Inner Component ================= */
function ImproveInner() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");

  const [model, setModel] = useState("gpt-4o-mini");
  const [creativity, setCreativity] = useState<Creativity>("balanced");
  const temperature = useMemo(() => (creativity === "basic" ? 0.2 : creativity === "creative" ? 0.8 : 0.5), [creativity]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAssistantHashRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Coach UI state
  const [improveOpenIdx, setImproveOpenIdx] = useState<number | null>(null);
  const [activeRefinements, setActiveRefinements] = useState<string[]>([]);
  const [customRefinement, setCustomRefinement] = useState("");
  const [applyToFuture, setApplyToFuture] = useState(false);

  /* Load agents list */
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      if (Array.isArray(saved)) setAgents(saved);
    } catch {}
  }, []);

  const selectedAgent = useMemo(
    () => agents.find((a) => a.id === selectedId) || null,
    [agents, selectedId]
  );

  /* Load thread for selected agent + seed first message */
  useEffect(() => {
    lastAssistantHashRef.current = null;
    setError(null);
    setImproveOpenIdx(null);

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
    } catch {}

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
    } catch {}
  }, [messages, selectedAgent?.id]);

  /* Auto-scroll on new messages */
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  /* Utilities */
  const refinementStrings = useMemo(() => {
    const base = activeRefinements.map((k) => REFINEMENT_MAP[k] || k);
    const custom = customRefinement.trim() ? [customRefinement.trim()] : [];
    return [...base, ...custom];
  }, [activeRefinements, customRefinement]);

  function toggleRefinement(key: string) {
    setActiveRefinements((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function persistRefinementsToAgentPrompt() {
    if (!selectedAgent || refinementStrings.length === 0) return;
    const updatedAgents = agents.map((a) => {
      if (a.id !== selectedAgent.id) return a;
      const block = "\n\n[REFINEMENTS DEFAULT]\n" + refinementStrings.map((r) => `- ${r}`).join("\n");
      const nextPrompt = a.prompt.includes("[REFINEMENTS DEFAULT]")
        ? a.prompt.replace(/\[REFINEMENTS DEFAULT][\s\S]*?$/i, "[REFINEMENTS DEFAULT]\n" + refinementStrings.map((r) => `- ${r}`).join("\n"))
        : (a.prompt + block);
      return { ...a, prompt: nextPrompt };
    });
    setAgents(updatedAgents);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedAgents));
    } catch {}
  }

  /* Send (normal) */
  const send = async () => {
    const value = input.trim();
    if (!value || !selectedAgent || loading) return;

    setMessages((prev) => [...prev, { role: "user", text: value }]);
    setInput("");
    await generateReply(messages, { newestUser: value });
  };

  /* Re-run last assistant message with refinements */
  const applyAndRerun = async (assistantIndex: number) => {
    if (!selectedAgent || loading) return;
    // Find the last user message BEFORE this assistant turn
    const slice = messages.slice(0, assistantIndex); // up to the assistant we’re replacing
    let lastUserIdx = -1;
    for (let i = slice.length - 1; i >= 0; i--) {
      if (slice[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx === -1) return;

    const historyUpToUser = slice.slice(0, lastUserIdx); // messages before that user
    const userContent = slice[lastUserIdx].text;

    // Replace that assistant message by regenerating from that user turn
    await generateReply(historyUpToUser, { newestUser: userContent, replaceFromIndex: assistantIndex });
  };

  async function generateReply(history: Msg[], opts: { newestUser: string; replaceFromIndex?: number }) {
    if (!selectedAgent) return;
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
            ...history.map((m) => ({ role: m.role, content: clamp(m.text) })),
            { role: "user", content: clamp(opts.newestUser) },
          ],
          directives: refinementStrings, // << the coach directives
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
        // Replace an existing assistant message if requested, else append
        if (typeof opts.replaceFromIndex === "number") {
          setMessages((prev) => {
            const copy = prev.slice(0, opts.replaceFromIndex);
            // If last element in copy is a user at the same index, do nothing; we only replace assistant
            return [...copy, { role: "assistant", text: candidate }, ...prev.slice(opts.replaceFromIndex + 1)];
          });
        } else {
          setMessages((prev) => [...prev, { role: "assistant", text: candidate }]);
        }
        lastAssistantHashRef.current = candHash;

        if (applyToFuture && refinementStrings.length) {
          persistRefinementsToAgentPrompt();
        }
      }
    } catch (e: any) {
      const msg = "Failed to reach server.";
      setError(msg);
      setMessages((prev) => [...prev, { role: "assistant", text: `⚠️ ${msg}` }]);
    } finally {
      setLoading(false);
    }
  }

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
        <div className="rounded-xl p-4 flex flex-wrap items-center gap-4" style={{ background: "#0d0f11", border: "1px solid rgba(255,255,255,.08)" }}>
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
                <option key={a.id} value={a.id}>{a.name}</option>
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

          {/* Creativity */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/60">Creativity</span>
            <div className="inline-flex rounded-md overflow-hidden border" style={{ borderColor: "rgba(255,255,255,.1)" }}>
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

        {/* Error */}
        {error && (
          <div className="rounded-md px-3 py-2 text-sm" style={{ background: "#2a1111", color: "#ffb3b3", border: "1px solid #552222" }}>
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
            <div key={i} className="space-y-2">
              <div
                className={`max-w-[85%] p-3 rounded-xl leading-relaxed ${
                  m.role === "user" ? "ml-auto text-black" : "mr-auto text-white"
                }`}
                style={
                  m.role === "user"
                    ? { background: "var(--brand)" }
                    : { background: "#0f1113", border: "1px solid rgba(255,255,255,.08)" }
                }
              >
                {m.text}
              </div>

              {/* Tools under assistant messages */}
              {m.role === "assistant" && (
                <div className={`flex items-center gap-3 ${m.role === "assistant" ? "mr-auto" : "ml-auto"}`}>
                  <button
                    onClick={() => setImproveOpenIdx((idx) => (idx === i ? null : i))}
                    className="text-xs text-white/60 hover:text-white"
                    title="Coach and re-run this answer"
                  >
                    Improve
                  </button>
                  <button
                    onClick={() => alert(whyThisAnswerText(model, temperature, refinementStrings))}
                    className="text-xs text-white/60 hover:text-white"
                    title="Show active rules & refinements"
                  >
                    Why this?
                  </button>
                </div>
              )}

              {/* Coach panel */}
              {improveOpenIdx === i && (
                <div className="mr-auto max-w-[85%] rounded-lg p-3 space-y-3" style={{ background: "#0f1113", border: "1px solid rgba(255,255,255,.08)" }}>
                  <div className="text-xs text-white/60">Refinements (override previous rules)</div>
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(REFINEMENT_MAP).map((key) => (
                      <button
                        key={key}
                        onClick={() => toggleRefinement(key)}
                        className={`px-2.5 py-1.5 text-xs rounded-md border ${
                          activeRefinements.includes(key)
                            ? "bg-white/10 border-white/20 text-white"
                            : "border-white/10 text-white/70 hover:bg-white/5"
                        }`}
                      >
                        {labelForRefinement(key)}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={customRefinement}
                      onChange={(e) => setCustomRefinement(e.target.value)}
                      placeholder="Add a custom directive (e.g., 'Only answer my question, no extras')"
                      className="flex-1 px-3 py-2 rounded-md bg-[#0f1113] text-white outline-none"
                      style={{ border: "1px solid rgba(255,255,255,.08)" }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-white/70">
                      <input
                        type="checkbox"
                        checked={applyToFuture}
                        onChange={(e) => setApplyToFuture(e.target.checked)}
                      />
                      Apply to future messages (save to this agent)
                    </label>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => applyAndRerun(i)}
                        className="px-3 py-2 rounded-md text-sm font-medium"
                        style={{ background: "var(--brand)", color: "#03231c" }}
                      >
                        Apply & Re-run
                      </button>
                      <button
                        onClick={() => setImproveOpenIdx(null)}
                        className="px-3 py-2 rounded-md text-sm text-white/70 hover:bg-white/5"
                        style={{ border: "1px solid rgba(255,255,255,.1)" }}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="mr-auto p-3 rounded-xl text-white" style={{ background: "#0f1113", border: "1px solid rgba(255,255,255,.08)" }}>
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

/* ================= Support fns ================= */
function labelForRefinement(key: string) {
  switch (key) {
    case "talk-less": return "Talk less";
    case "answer-only": return "Answer only";
    case "no-followup": return "No follow-up question";
    case "bullets": return "Bullet points";
    case "friendlier": return "Friendlier tone";
    case "more-feedback": return "More feedback";
    default: return key;
  }
}

function whyThisAnswerText(model: string, temperature: number, refinements: string[]) {
  const list = refinements.length
    ? refinements.map((r) => `• ${r}`).join("\n")
    : "• (none)";
  return [
    "Why this answer",
    `Model: ${model}`,
    `Creativity (temperature): ${temperature}`,
    "Base rules:",
    "• Answer first, then (by default) ask one relevant follow-up",
    "• Don't repeat answered questions",
    "• No prompt/code/path leakage",
    "Active refinements (priority):",
    list,
  ].join("\n");
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
