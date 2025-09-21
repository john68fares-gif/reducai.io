// components/voice/VoiceAgentSection.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from "react";
import dynamic from "next/dynamic";
import { createPortal } from "react-dom";
import {
  Wand2,
  ChevronDown,
  ChevronUp,
  Gauge,
  Mic,
  Volume2,
  Rocket,
  Search,
  Check,
  Lock,
  KeyRound,
  Play,
  Square,
  X,
  Upload,
  Link as LinkIcon,
} from "lucide-react";
import { scopedStorage } from "@/utils/scoped-storage";
import WebCallButton from "@/components/voice/WebCallButton";

/* ==============================================
   Config
================================================ */
const EPHEMERAL_TOKEN_ENDPOINT = "/api/voice/ephemeral";
const CTA = "#59d9b3";
const CTA_HOVER = "#54cfa9";
const GREEN_LINE = "rgba(89,217,179,.20)";
const ACTIVE_KEY = "va:activeId";
const Z_OVERLAY = 100000;
const Z_MODAL = 100001;
const IS_CLIENT = typeof window !== "undefined" && typeof document !== "undefined";

/* ==============================================
   Assistant rail
================================================ */
const AssistantRail = dynamic(
  () =>
    import("@/components/voice/AssistantRail")
      .then((m) => m.default ?? m)
      .catch(() => Promise.resolve(() => <div className="px-3 py-3 text-xs opacity-70">Rail unavailable</div>)),
  { ssr: false, loading: () => <div className="px-3 py-3 text-xs opacity-70">Loading…</div> }
);

class RailBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(p: any) {
    super(p);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    return this.state.hasError ? (
      <div className="px-3 py-3 text-xs opacity-70">Rail crashed</div>
    ) : (
      this.props.children
    );
  }
}

/* ==============================================
   Little helpers
================================================ */
function PhoneFilled(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" {...props} aria-hidden>
      <path
        d="M6.62 10.79a15.053 15.053 0 006.59 6.59l2.2-2.2a1 1 0 011.03-.24c1.12.37 2.33.57 3.56.57a1 1 0 011 1v3.5a1 1 0 01-1 1C11.3 22 2 12.7 2 2.99a1 1 0 011-1H6.5a1 1 0 011 1c0 1.23.2 2.44.57 3.56a1 1 0 01-.24 1.03l-2.2 2.2z"
        fill="currentColor"
      />
    </svg>
  );
}

const isFn = (f: any): f is Function => typeof f === "function";
const isStr = (v: any): v is string => typeof v === "string";
const nonEmpty = (v: any): v is string => isStr(v) && v.trim().length > 0;
const coerceStr = (v: any): string => (isStr(v) ? v : "");
const safeTrim = (v: any): string => (nonEmpty(v) ? v.trim() : "");

const Tokens = () => (
  <style jsx global>{`
    .va-scope {
      --bg: #0b0c10;
      --panel: #0d0f11;
      --text: #e6f1ef;
      --text-muted: #9fb4ad;

      --s-2: 8px;
      --s-3: 12px;
      --s-4: 16px;
      --s-5: 20px;
      --s-6: 24px;
      --radius-outer: 10px;
      --control-h: 44px;
      --header-h: 88px;
      --fz-title: 18px;
      --fz-sub: 15px;
      --fz-body: 14px;
      --fz-label: 12.5px;
      --lh-body: 1.45;
      --ease: cubic-bezier(0.22, 0.61, 0.36, 1);

      --app-sidebar-w: 240px;
      --rail-w: 260px;

      --page-bg: var(--bg);
      --panel-bg: var(--panel);
      --input-bg: var(--panel);
      --input-border: rgba(255, 255, 255, 0.1);
      --input-shadow: 0 0 0 1px rgba(255, 255, 255, 0.06) inset;

      --border-weak: rgba(255, 255, 255, 0.1);
      --card-shadow: 0 22px 44px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(255, 255, 255, 0.06) inset,
        0 0 0 1px ${GREEN_LINE};

      --green-weak: rgba(89, 217, 179, 0.12);
      --red-weak: rgba(239, 68, 68, 0.14);
    }

    .va-portal {
      --vs-menu-bg: #101314;
      --vs-menu-border: rgba(255, 255, 255, 0.16);
      --vs-input-bg: #101314;
      --vs-input-border: rgba(255, 255, 255, 0.14);
      --text: #e6f1ef;
      --text-muted: #9fb4ad;
    }

    .va-card {
      border-radius: 10px;
      border: 1px solid var(--border-weak);
      background: var(--panel-bg);
      box-shadow: var(--card-shadow);
      overflow: hidden;
      isolation: isolate;
    }

    .va-head {
      min-height: var(--header-h);
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      padding: 0 16px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      color: var(--text);
      background: linear-gradient(
        90deg,
        var(--panel-bg) 0%,
        color-mix(in oklab, var(--panel-bg) 97%, white 3%) 50%,
        var(--panel-bg) 100%
      );
    }
  `}</style>
);

/* ==============================================
   Types / storage
================================================ */
type ApiKey = { id: string; name: string; key: string };

type AgentData = {
  name: string;
  provider: "openai" | "anthropic" | "google";
  model: string;
  firstMode: "Assistant speaks first" | "User speaks first" | "Silent until tool required";
  firstMsg?: string; // legacy (for migration)
  firstMsgs: string[]; // NEW: up to 20
  systemPrompt: string; // frontend (pretty)
  systemPromptBackend?: string; // backend compact
  language?: string;

  ttsProvider: "openai" | "elevenlabs";
  voiceName: string;
  apiKeyId?: string;

  asrProvider: "deepgram" | "whisper" | "assemblyai";
  asrModel: string;

  denoise: boolean;
  numerals: boolean;
};

const BLANK_TEMPLATE_NOTE =
  "This is a blank template with minimal defaults. You can change the model and messages, or click Generate to tailor the prompt to your business.";

const PROMPT_SKELETON = `[Identity]

[Style]

[Response Guidelines]

[Task & Goals]

[Error Handling / Fallback]`;

/* ==============================================
   Prompt engine (dual-layer)
================================================ */
import {
  DEFAULT_PROMPT as _DEFAULT_PROMPT,
  looksLikeFullPrompt as _looksLikeFullPrompt,
  normalizeFullPrompt as _normalizeFullPrompt,
  applyInstructions as _applyInstructions,
  compilePrompt,
} from "@/lib/prompt-engine";

const looksLikeFullPromptRT = (raw: string) => (isFn(_looksLikeFullPrompt) ? !!_looksLikeFullPrompt(raw) : false);
const normalizeFullPromptRT = (raw: string) => (isFn(_normalizeFullPrompt) ? coerceStr(_normalizeFullPrompt(raw)) : raw);
const applyInstructionsRT = (base: string, raw: string) =>
  isFn(_applyInstructions) ? (_applyInstructions as any)(base, raw) : { merged: base, summary: "Updated." };
const DEFAULT_PROMPT_RT = nonEmpty(_DEFAULT_PROMPT) ? _DEFAULT_PROMPT! : PROMPT_SKELETON;

/* ==============================================
   Defaults
================================================ */
const DEFAULT_AGENT: AgentData = {
  name: "Assistant",
  provider: "openai",
  model: "gpt-4o",
  firstMode: "Assistant speaks first",
  firstMsgs: ["Hello."],
  systemPrompt:
    normalizeFullPromptRT(
      `
[Identity]
- You are a helpful, professional AI assistant for this business.

[Style]
- Clear, concise, friendly.

[Response Guidelines]
- Ask one clarifying question when essential info is missing.

[Task & Goals]
- Guide users to their next best action (booking, purchase, or escalation).

[Error Handling / Fallback]
- If unsure, ask a specific clarifying question first.
`.trim()
    ) +
    "\n\n" +
    `# ${BLANK_TEMPLATE_NOTE}\n`,
  systemPromptBackend: "",
  ttsProvider: "openai",
  voiceName: "Alloy (American)",
  apiKeyId: "",
  asrProvider: "deepgram",
  asrModel: "Nova 2",
  denoise: false,
  numerals: false,
  language: "English",
};

const keyFor = (id: string) => `va:agent:${id}`;
const versKeyFor = (id: string) => `va:versions:${id}`;

const loadAgentData = (id: string): AgentData => {
  try {
    const raw = IS_CLIENT ? localStorage.getItem(keyFor(id)) : null;
    if (raw) {
      const parsed = { ...DEFAULT_AGENT, ...(JSON.parse(raw) || {}) } as AgentData;
      // 🔁 migrate legacy firstMsg -> firstMsgs
      if (!parsed.firstMsgs || !Array.isArray(parsed.firstMsgs)) {
        const seed = parsed.firstMsg && parsed.firstMsg.trim().length ? [parsed.firstMsg] : ["Hello."];
        parsed.firstMsgs = seed;
      }
      return parsed;
    }
  } catch {}
  return { ...DEFAULT_AGENT };
};
const saveAgentData = (id: string, data: AgentData) => {
  try {
    if (IS_CLIENT) localStorage.setItem(keyFor(id), JSON.stringify(data));
  } catch {}
};
const pushVersion = (id: string, snapshot: any) => {
  try {
    if (!IS_CLIENT) return;
    const raw = localStorage.getItem(versKeyFor(id));
    const arr = raw ? JSON.parse(raw) : [];
    arr.unshift({ id: `v_${Date.now()}`, ts: Date.now(), ...snapshot });
    localStorage.setItem(versKeyFor(id), JSON.stringify(arr.slice(0, 50)));
  } catch {}
};

/* ==============================================
   Mock backend (save/publish)
================================================ */
async function apiSave(agentId: string, payload: AgentData) {
  const r = await fetch(`/api/voice/agent/${agentId}/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => null as any);
  if (!r?.ok) throw new Error("Save failed");
  return r.json();
}
async function apiPublish(agentId: string) {
  const r = await fetch(`/api/voice/agent/${agentId}/publish`, { method: "POST" }).catch(() => null as any);
  if (!r?.ok) throw new Error("Publish failed");
  return r.json();
}

/* ==============================================
   Option helpers
================================================ */
type Opt = { value: string; label: string; disabled?: boolean; note?: string };

const providerOpts: Opt[] = [
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic — coming soon", disabled: true, note: "soon" },
  { value: "google", label: "Google — coming soon", disabled: true, note: "soon" },
];

function useOpenAIModels(selectedKey: string | undefined) {
  const [opts, setOpts] = useState<Opt[]>([
    { value: "gpt-5", label: "GPT 5" },
    { value: "gpt-5-mini", label: "GPT 5 Mini" },
    { value: "gpt-4.1", label: "GPT 4.1" },
    { value: "gpt-4.1-mini", label: "GPT 4.1 Mini" },
    { value: "gpt-4o", label: "GPT 4o" },
    { value: "gpt-4o-mini", label: "GPT 4o Mini" },
    { value: "o4", label: "o4" },
    { value: "o4-mini", label: "o4 Mini" },
    { value: "gpt-4o-realtime-preview", label: "GPT 4o Realtime Preview" },
    { value: "gpt-4o-realtime-preview-mini", label: "GPT 4o Realtime Preview Mini" },
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let aborted = false;
    (async () => {
      if (!selectedKey) return;
      setLoading(true);
      try {
        const r = await fetch("/api/openai/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: selectedKey }),
        });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();
        const models = Array.isArray(j?.models) ? j.models : [];
        if (!aborted && models.length) {
          setOpts(models.map((m: any) => ({ value: String(m.value), label: String(m.label) })));
        }
      } catch {
        // keep defaults
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [selectedKey]);

  return { opts, loading };
}

const ttsProviders: Opt[] = [
  { value: "openai", label: "OpenAI" },
  { value: "elevenlabs", label: "ElevenLabs — coming soon", disabled: true, note: "soon" },
];

const asrProviders: Opt[] = [
  { value: "deepgram", label: "Deepgram" },
  { value: "whisper", label: "Whisper — coming soon", disabled: true, note: "soon" },
  { value: "assemblyai", label: "AssemblyAI — coming soon", disabled: true, note: "soon" },
];

const asrModelsFor = (asr: string): Opt[] =>
  asr === "deepgram"
    ? [
        { value: "Nova 2", label: "Nova 2" },
        { value: "Nova", label: "Nova" },
      ]
    : [{ value: "coming", label: "Models coming soon", disabled: true }];

/* ==============================================
   UI atoms
================================================ */
const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className="inline-flex items-center"
    style={{
      height: 28,
      width: 50,
      padding: "0 6px",
      borderRadius: 999,
      justifyContent: "flex-start",
      background: checked ? "color-mix(in oklab, #59d9b3 18%, var(--input-bg))" : "var(--input-bg)",
      border: "1px solid var(--input-border)",
      boxShadow: "var(--input-shadow)",
    }}
    aria-pressed={checked}
  >
    <span
      style={{
        width: 18,
        height: 18,
        borderRadius: 999,
        background: checked ? CTA : "rgba(255,255,255,.12)",
        transform: `translateX(${checked ? 22 : 0}px)`,
        transition: "transform .18s var(--ease)",
      }}
    />
  </button>
);

/* ==============================================
   Styled select (portal) – visual/behavior fixes kept
================================================ */
function StyledSelect({
  value,
  onChange,
  options,
  placeholder,
  leftIcon,
  menuTop,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  placeholder?: string;
  leftIcon?: React.ReactNode;
  menuTop?: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [menuPos, setMenuPos] = useState<{ left: number; top: number; width: number } | null>(null);

  const current = options.find((o) => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ left: r.left, top: r.bottom + 8, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onResize = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    window.addEventListener("mousedown", off);
    window.addEventListener("keydown", onEsc);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("mousedown", off);
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setTimeout(() => searchRef.current?.focus(), 0);
        }}
        className="w-full flex items-center justify-between gap-3 px-3 py-3 rounded-[14px] text-sm outline-none transition"
        style={{
          background: "var(--vs-input-bg, #101314)",
          border: "1px solid var(--vs-input-border, rgba(255,255,255,.14))",
          boxShadow: "var(--vs-input-shadow, none)",
          color: "var(--text)",
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : placeholder || "— Choose —"}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
      </button>

      {open && IS_CLIENT
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[100020] p-3 va-portal"
              style={{
                left: menuPos?.left ?? 0,
                top: menuPos?.top ?? 0,
                width: menuPos?.width ?? btnRef.current?.getBoundingClientRect().width ?? 280,
                background: "var(--vs-menu-bg, #101314)",
                border: "1px solid var(--vs-menu-border, rgba(255,255,255,.16))",
                borderRadius: 20,
                boxShadow: "0 28px 70px rgba(0,0,0,.60), 0 10px 26px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)",
              }}
            >
              {menuTop ? <div className="mb-2">{menuTop}</div> : null}

              <div
                className="flex items-center gap-2 mb-3 px-2 py-2 rounded-[12px]"
                style={{
                  background: "var(--vs-input-bg, #101314)",
                  border: "1px solid var(--vs-input-border, rgba(255,255,255,.14))",
                  color: "var(--text)",
                }}
              >
                <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Type to filter…"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color: "var(--text)" }}
                />
              </div>

              <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
                {filtered.map((o) => (
                  <button
                    key={o.value}
                    disabled={!!o.disabled}
                    onClick={() => {
                      if (o.disabled) return;
                      onChange(o.value);
                      setOpen(false);
                    }}
                    className="w-full text-left text-sm px-3 py-2 rounded-[10px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                    style={{
                      color: o.disabled ? "var(--text-muted)" : "var(--text)",
                      background: "transparent",
                      border: "1px solid transparent",
                      cursor: o.disabled ? "not-allowed" : "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (o.disabled) return;
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "rgba(0,255,194,0.10)";
                      el.style.border = "1px solid rgba(0,255,194,0.35)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLButtonElement;
                      el.style.background = "transparent";
                      el.style.border = "1px solid transparent";
                    }}
                  >
                    {o.disabled ? <Lock className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" style={{ opacity: o.value === value ? 1 : 0 }} />}
                    <span className="truncate">{o.label}</span>
                    <span />
                  </button>
                ))}
                {filtered.length === 0 && (
                  <div className="px-3 py-6 text-sm" style={{ color: "var(--text-muted)" }}>
                    No matches.
                  </div>
                )}
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}

/* ==============================================
   Diff helpers (plus typing effect)
================================================ */
function computeLineDiff(base: string, next: string) {
  const a = (base || "").split("\n");
  const b = (next || "").split("\n");
  const setA = new Set(a);
  const setB = new Set(b);
  const rows: Array<{ t: "same" | "add" | "rem"; text: string }> = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const la = a[i];
    const lb = b[i];
    if (la === lb && la !== undefined) {
      rows.push({ t: "same", text: la! });
      continue;
    }
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: "add", text: lb });
    if (la !== undefined && !setB.has(la)) rows.push({ t: "rem", text: la });
  }
  for (let j = a.length; j > b.length; j--) {
    const la = a[j];
    if (la !== undefined && !setB.has(la)) rows.push({ t: "rem", text: la });
  }
  for (let j = a.length; j < b.length; j++) {
    const lb = b[j];
    if (lb !== undefined && !setA.has(lb)) rows.push({ t: "add", text: lb });
  }
  return rows;
}

/* Animated typing diff: types the new prompt line by line,
   showing additions (green) and removals (red/strike) */
function TypingDiff({
  base,
  next,
  speed = 12, // chars per tick
  tickMs = 18,
}: {
  base: string;
  next: string;
  speed?: number;
  tickMs?: number;
}) {
  const rows = useMemo(() => computeLineDiff(base, next), [base, next]);
  const [typed, setTyped] = useState<string[]>([]);
  const [cursor, setCursor] = useState({ row: 0, col: 0 });

  useEffect(() => {
    setTyped([]);
    setCursor({ row: 0, col: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, next]);

  useEffect(() => {
    let timer: any;
    function step() {
      setTyped((prev) => {
        const r = rows[cursor.row];
        if (!r) return prev;
        const current = prev.slice();
        const rendered = (current[cursor.row] ?? "");
        const full = r.text || "";
        const targetCol = Math.min(cursor.col + speed, full.length);
        const chunk = full.slice(0, targetCol);
        current[cursor.row] = chunk;
        if (targetCol >= full.length) {
          // advance row
          setCursor((c) => ({ row: c.row + 1, col: 0 }));
        } else {
          setCursor((c) => ({ ...c, col: targetCol }));
        }
        return current;
      });
      timer = setTimeout(step, tickMs);
    }
    // stop when finished
    if (cursor.row >= rows.length) return;
    timer = setTimeout(step, tickMs);
    return () => clearTimeout(timer);
  }, [cursor, rows, speed, tickMs]);

  return (
    <pre
      className="rounded-[12px] px-3 py-3 text-sm"
      style={{
        background: "var(--input-bg)",
        border: "1px solid var(--input-border)",
        color: "var(--text)",
        whiteSpace: "pre-wrap",
        lineHeight: "1.55",
      }}
    >
      {rows.map((r, i) => {
        const text = (typed[i] ?? (i < cursor.row ? r.text : "") || " ") + (i < rows.length - 1 ? "\n" : "");
        if (r.t === "same") return <span key={i}>{text}</span>;
        if (r.t === "add")
          return (
            <span
              key={i}
              style={{
                background: "rgba(89,217,179,.12)",
                borderLeft: "3px solid " + CTA,
                display: "block",
                padding: "2px 6px",
                borderRadius: 6,
                margin: "2px 0",
              }}
            >
              {text}
            </span>
          );
        return (
          <span
            key={i}
            style={{
              background: "rgba(239,68,68,.14)",
              borderLeft: "3px solid #ef4444",
              display: "block",
              padding: "2px 6px",
              borderRadius: 6,
              margin: "2px 0",
              textDecoration: "line-through",
              opacity: 0.9,
            }}
          >
            {text}
          </span>
        );
      })}
    </pre>
  );
}

/* ==============================================
   Page
================================================ */
type ChatMsg = { id: string; role: "user" | "assistant" | "system"; text: string };

export default function VoiceAgentSection() {
  /* align rail to app sidebar */
  useEffect(() => {
    if (!IS_CLIENT) return;
    const candidates = ['[data-app-sidebar]', 'aside[aria-label="Sidebar"]', 'aside[class*="sidebar"]', '#sidebar'];
    const el = document.querySelector<HTMLElement>(candidates.join(", "));
    const setW = (w: number) => document.documentElement.style.setProperty("--app-sidebar-w", `${Math.round(w)}px`);
    if (!el) {
      setW(240);
      return;
    }
    setW(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? el.getBoundingClientRect().width;
      setW(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const [activeId, setActiveId] = useState<string>(() => {
    try {
      return IS_CLIENT ? localStorage.getItem(ACTIVE_KEY) || "" : "";
    } catch {
      return "";
    }
  });
  const [data, setData] = useState<AgentData>(() => (activeId ? loadAgentData(activeId) : DEFAULT_AGENT));

  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string>("");
  const [toastKind, setToastKind] = useState<"info" | "error">("info");
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);

  const [showCall, setShowCall] = useState(false);

  // Generate overlay
  const [showGenerate, setShowGenerate] = useState(false);
  const [composerText, setComposerText] = useState("");
  const [genPhase, setGenPhase] = useState<"idle" | "editing" | "loading" | "review">("idle");

  // typing inside prompt box
  const basePromptRef = useRef<string>("");
  const [proposedPrompt, setProposedPrompt] = useState("");
  const [changesSummary, setChangesSummary] = useState("");

  // file uploads + sheets link
  const [files, setFiles] = useState<File[]>([]);
  const [sheetsUrl, setSheetsUrl] = useState<string>("");

  // models list (live from API when key selected)
  const selectedKey = apiKeys.find((k) => k.id === data.apiKeyId)?.key;
  const { opts: openaiModels, loading: loadingModels } = useOpenAIModels(selectedKey);

  // TTS preview
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!IS_CLIENT || !("speechSynthesis" in window)) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    (window.speechSynthesis as any).onvoiceschanged = load;
    return () => {
      (window.speechSynthesis as any).onvoiceschanged = null;
    };
  }, []);
  function speakPreview(line?: string) {
    if (!IS_CLIENT || !("speechSynthesis" in window)) return;
    const u = new SpeechSynthesisUtterance(line || `Hi, I'm ${data.name || "your assistant"}. This is a preview.`);
    const byName = voices.find((v) => v.name.toLowerCase().includes((data.voiceName || "").split(" ")[0]?.toLowerCase() || ""));
    const en = voices.find((v) => v.lang?.startsWith("en"));
    if (byName) u.voice = byName;
    else if (en) u.voice = en;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }
  const stopPreview = () => {
    if (IS_CLIENT && "speechSynthesis" in window) window.speechSynthesis.cancel();
  };

  /* listen for active rail id */
  useEffect(() => {
    if (!IS_CLIENT) return;
    const handler = (e: Event) => setActiveId((e as CustomEvent<string>).detail);
    window.addEventListener("assistant:active", handler as EventListener);
    return () => window.removeEventListener("assistant:active", handler as EventListener);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setData(loadAgentData(activeId));
    try {
      if (IS_CLIENT) localStorage.setItem(ACTIVE_KEY, activeId);
    } catch {}
  }, [activeId]);

  useEffect(() => {
    if (activeId) saveAgentData(activeId, data);
  }, [activeId, data]);

  // load keys (best effort)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const store = await scopedStorage().catch(() => null);
        if (!mounted) return;
        if (!store) {
          setApiKeys([]);
          return;
        }

        store.ensureOwnerGuard?.().catch(() => {});

        const v1 = await store.getJSON<ApiKey[]>("apiKeys.v1", []).catch(() => []);
        const legacy = await store.getJSON<ApiKey[]>("apiKeys", []).catch(() => []);
        const merged = Array.isArray(v1) && v1.length ? v1 : Array.isArray(legacy) ? legacy : [];

        const cleaned = merged
          .filter(Boolean)
          .map((k: any) => ({ id: String(k?.id || ""), name: String(k?.name || ""), key: String(k?.key || "") }))
          .filter((k) => k.id && k.name);

        if (!mounted) return;
        setApiKeys(cleaned);

        // select a key if none set
        const globalSelected = await store.getJSON<string>("apiKeys.selectedId", "").catch(() => "");
        const chosen =
          (data.apiKeyId && cleaned.some((k) => k.id === data.apiKeyId)) ? data.apiKeyId! :
          (globalSelected && cleaned.some((k) => k.id === globalSelected)) ? globalSelected :
          (cleaned[0]?.id || "");

        if (chosen && chosen !== data.apiKeyId) {
          setData((prev) => ({ ...prev, apiKeyId: chosen }));
          await store.setJSON("apiKeys.selectedId", chosen).catch(() => {});
        }
      } catch {
        if (!mounted) return;
        setApiKeys([]);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField<K extends keyof AgentData>(k: K) {
    return (v: AgentData[K]) => {
      setData((prev) => {
        const next = { ...prev, [k]: v };
        if (k === "name" && activeId) {
          try {
            if (IS_CLIENT) localStorage.setItem(keyFor(activeId), JSON.stringify(next));
          } catch {}
          try {
            if (IS_CLIENT)
              window.dispatchEvent(
                new CustomEvent("assistant:update", { detail: { id: activeId, name: String(v) } })
              );
          } catch {}
        }
        return next;
      });
    };
  }

  async function doSave() {
    if (!activeId) {
      setToastKind("error");
      setToast("Select or create an agent");
      return;
    }
    setSaving(true);
    setToast("");
    try {
      await apiSave(activeId, data);
      setToastKind("info");
      setToast("Saved");
    } catch {
      setToastKind("error");
      setToast("Save failed");
    } finally {
      setSaving(false);
      setTimeout(() => setToast(""), 1400);
    }
  }
  async function doPublish() {
    if (!activeId) {
      setToastKind("error");
      setToast("Select or create an agent");
      return;
    }
    setPublishing(true);
    setToast("");
    try {
      await apiPublish(activeId);
      setToastKind("info");
      setToast("Published");
    } catch {
      setToastKind("error");
      setToast("Publish failed");
    } finally {
      setPublishing(false);
      setTimeout(() => setToast(""), 1400);
    }
  }

  /* ==============================================
     Call launch
  ================================================ */
  const openCall = () => {
    const key = apiKeys.find((k) => k.id === data.apiKeyId)?.key || "";
    if (!key) {
      setToastKind("error");
      setToast("Select an OpenAI API key first.");
      setTimeout(() => setToast(""), 2200);
      return;
    }
    setShowCall(true);
  };

  // Prefer a realtime-capable model for the *transport*, but show the selected label in the UI
  const selectedModelLabel = data.model || "gpt-4o-realtime-preview";
  const callTransportModel = useMemo(() => {
    const m = (data.model || "").toLowerCase();
    if (m.includes("realtime")) return data.model;
    return "gpt-4o-realtime-preview";
  }, [data.model]);

  // inline review?
  const inInlineReview = genPhase === "review" && !showGenerate;

  // files
  const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const arr = e.target.files ? Array.from(e.target.files) : [];
    if (!arr.length) return;
    setFiles((prev) => [...prev, ...arr].slice(0, 12));
  };

  // pick random firstMsg per call
  const pickFirstMsg = () => {
    const arr = (data.firstMsgs || []).filter((s) => s && s.trim().length);
    if (!arr.length) return "";
    return arr[Math.floor(Math.random() * arr.length)];
  };

  return (
    <section className="va-scope" style={{ background: "var(--bg)", color: "var(--text)" }}>
      <Tokens />

      {/* rail + content */}
      <div className="grid w-full" style={{ gridTemplateColumns: "260px 1fr" }}>
        <div className="sticky top-0 h-screen" style={{ borderRight: "1px solid rgba(255,255,255,.06)" }}>
          <RailBoundary>
            <AssistantRail />
          </RailBoundary>
        </div>

        <div
          className="px-3 md:px-5 lg:px-6 py-5 mx-auto w-full max-w-[1160px]"
          style={{ fontSize: "var(--fz-body)", lineHeight: "var(--lh-body)" }}
        >
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <button
              onClick={doSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height: "var(--control-h)", background: "var(--panel)", border: "1px solid rgba(255,255,255,.10)", color: "var(--text)" }}
            >
              {saving ? "Saving…" : "Save"}
            </button>

            <button
              onClick={doPublish}
              disabled={publishing}
              className="inline-flex items-center gap-2 rounded-[10px] px-4 text-sm transition hover:-translate-y-[1px] disabled:opacity-60"
              style={{ height: "var(--control-h)", background: "var(--panel)", border: "1px solid rgba(255,255,255,.10)", color: "var(--text)" }}
            >
              <Rocket className="w-4 h-4" /> {publishing ? "Publishing…" : "Publish"}
            </button>

            <button
              onClick={openCall}
              className="inline-flex items-center gap-2 rounded-[10px] select-none"
              style={{
                height: "var(--control-h)",
                padding: "0 18px",
                background: CTA,
                color: "#ffffff",
                fontWeight: 700,
                boxShadow: "0 10px 22px rgba(89,217,179,.20)",
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = CTA_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = CTA)}
            >
              <PhoneFilled style={{ color: "#ffffff" }} />
              <span style={{ color: "#ffffff" }}>Talk to Assistant</span>
            </button>
          </div>

          {toast ? (
            <div
              className="mb-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-[10px]"
              style={{
                background: toastKind === "error" ? "rgba(239,68,68,.12)" : "rgba(89,217,179,.10)",
                color: "var(--text)",
                boxShadow:
                  toastKind === "error"
                    ? "0 0 0 1px rgba(239,68,68,.25) inset"
                    : "0 0 0 1px rgba(89,217,179,.16) inset",
              }}
            >
              <Check className="w-4 h-4" /> {toast}
            </div>
          ) : null}

          {/* Quick stats */}
          <div className="grid gap-3 md:grid-cols-2 mb-3">
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Cost
                </div>
                <div />
              </div>
              <div className="p-4">
                <div className="font-semibold" style={{ fontSize: "15px" }}>
                  ~$0.1/min
                </div>
              </div>
            </div>
            <div className="va-card">
              <div className="va-head" style={{ minHeight: 56 }}>
                <div className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Latency
                </div>
                <div />
              </div>
              <div className="p-4">
                <div className="font-semibold" style={{ fontSize: "15px" }}>
                  ~1050 ms
                </div>
              </div>
            </div>
          </div>

          {/* Model */}
          <Section
            title="Model"
            icon={<Gauge className="w-4 h-4" style={{ color: CTA }} />}
            desc="Configure the model, assistant name, and first message(s)."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px]">Assistant Name</div>
                <input
                  value={data.name}
                  onChange={(e) => setField("name")(e.target.value)}
                  className="w-full bg-transparent outline-none rounded-[10px] px-3"
                  style={{ height: "44px", background: "var(--panel)", border: "1px solid rgba(255,255,255,.10)", color: "var(--text)" }}
                  placeholder="e.g., Riley"
                />
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">Provider</div>
                <StyledSelect
                  value={data.provider}
                  onChange={(v) => setField("provider")(v as AgentData["provider"])}
                  options={providerOpts}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
              <div>
                <div className="mb-2 text-[12.5px]">Model</div>
                <StyledSelect
                  value={data.model}
                  onChange={setField("model")}
                  options={openaiModels}
                  placeholder={loadingModels ? "Loading models…" : "Choose a model"}
                />
                <div className="mt-2 text-xs opacity-70">
                  Displayed model: <span className="font-semibold">{selectedModelLabel}</span>
                </div>
              </div>
              <div>
                <div className="mb-2 text-[12.5px]">First Message Mode</div>
                <StyledSelect
                  value={data.firstMode}
                  onChange={setField("firstMode")}
                  options={[
                    { value: "Assistant speaks first", label: "Assistant speaks first" },
                    { value: "User speaks first", label: "User speaks first" },
                    { value: "Silent until tool required", label: "Silent until tool required" },
                  ]}
                />
              </div>
            </div>

            {/* Multiple first messages */}
            <div className="mt-4">
              <div className="mb-2 text-[12.5px]">First Messages (max 20)</div>
              <div className="space-y-2">
                {data.firstMsgs.map((msg, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={msg}
                      onChange={(e) => {
                        const copy = [...data.firstMsgs];
                        copy[i] = e.target.value;
                        setField("firstMsgs")(copy);
                      }}
                      className="flex-1 bg-transparent outline-none rounded-[10px] px-3"
                      style={{ height: 40, background: "var(--panel)", border: "1px solid rgba(255,255,255,.10)" }}
                      placeholder={`Variant ${i + 1}`}
                    />
                    <button
                      onClick={() => setField("firstMsgs")(data.firstMsgs.filter((_, j) => j !== i))}
                      className="px-2 rounded-[10px]"
                      style={{ border: "1px solid rgba(255,255,255,.10)" }}
                      title="Remove"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {data.firstMsgs.length < 20 && (
                  <button
                    onClick={() => setField("firstMsgs")([...(data.firstMsgs || []), ""])}
                    className="text-xs"
                    style={{ color: CTA }}
                  >
                    + Add message
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* Voice */}
          <Section
            title="Voice"
            icon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
            desc="Choose TTS and preview the voice."
            defaultOpen={true}
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="mb-2 text-[12.5px] flex items-center gap-2">
                  <KeyRound className="w-4 h-4 opacity-80" /> OpenAI API Key
                </div>
                <StyledSelect
                  value={data.apiKeyId || ""}
                  onChange={async (val) => {
                    setField("apiKeyId")(val);
                    try {
                      const store = await scopedStorage();
                      await store.ensureOwnerGuard?.();
                      await store.setJSON("apiKeys.selectedId", val);
                    } catch {}
                  }}
                  options={[
                    { value: "", label: "Select an API key…" },
                    ...apiKeys.map((k) => ({ value: k.id, label: `${k.name} ••••${(k.key || "").slice(-4).toUpperCase()}` })),
                  ]}
                  leftIcon={<KeyRound className="w-4 h-4" style={{ color: CTA }} />}
                />
                <div className="mt-2 text-xs" style={{ color:
