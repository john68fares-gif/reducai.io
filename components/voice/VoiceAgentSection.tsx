"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

/* ==========================================
   Voice Agent Page — Working Spec Implementation
   - Single-file, drop-in React component
   - Tailwind-only UI (no external UI deps)
   - Matches data, API, behavior, UI, error copy, security, and checklist
   ========================================== */

// ---------- Types (from spec) ----------
export type Settings = {
  systemPrompt: string;
  language: string; // e.g. "en-US"
  ttsVoice: string; // e.g. "Polly.Joanna" or "alice"
  fromE164: string; // selected imported number
  assistantId?: string; // optional for widget test
  publicKey?: string; // optional for widget test
};

export type NumberItem = {
  id: string;
  e164?: string;
  label?: string;
  provider?: string;
  status?: string;
};

// ---------- LocalStorage Keys (from spec) ----------
const LS_KEYS = {
  twilioCreds: "telephony:twilioCreds",
  backupSettings: "voice:settings:backup",
  chatbots: "chatbots",
} as const;

type TwilioCreds = { accountSid: string; authToken: string };

type Banner = { kind: "success" | "error" | "info"; message: string } | null;

// ---------- Safe JSON helpers ----------
function getJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function setJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------- Fetch helpers with strict JSON check ----------
async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<{ ok: true; data: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(input, init);
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("application/json")) {
      return { ok: false, error: "Server did not return JSON." };
    }
    const body = (await res.json()) as any;
    if (!res.ok) {
      const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
      return { ok: false, error: msg };
    }
    return { ok: true, data: body as T };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Network error" };
  }
}

// ---------- Spec'd API wrappers ----------
async function apiGetNumbers() {
  return fetchJSON<{ ok: boolean; data: NumberItem[] }>("/api/telephony/phone-numbers");
}

async function apiAttachNumber(phoneNumber: string, creds: TwilioCreds) {
  return fetchJSON<{ ok: boolean }>("/api/telephony/attach-number", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phoneNumber, credentials: { accountSid: creds.accountSid, authToken: creds.authToken } }),
  });
}

async function apiCreateAgent(payload: { fromNumber?: string; voice: string; language: string; prompt: string }) {
  return fetchJSON<{ ok: boolean; agentId?: string }>("/api/voice/agents", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiSaveSettings(settings: Settings) {
  return fetchJSON<{ ok: boolean }>("/api/voice-agent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(settings),
  });
}

// ---------- Prompt Shaper (local function per spec) ----------
function shapePromptForScheduling(raw: string, businessContext?: string) {
  const cleaned = (raw || "").trim();
  const extra = (businessContext || "").trim();
  return [
    `# Appointment Scheduling Agent Prompt`,
    ``,
    `## Identity & Purpose`,
    `You are a voice assistant that efficiently schedules, confirms, reschedules, or cancels appointments while providing clear information about services and ensuring a smooth booking experience. You minimize friction and capture all needed details for scheduling.`,
    ``,
    `## Voice & Persona`,
    `### Personality`,
    `- Friendly, organized, and efficient`,
    `- Patient and helpful, especially with elderly or confused callers`,
    `- Warm but professional`,
    `- Confident and competent in managing the scheduling system`,
    `### Speech Characteristics`,
    `- Clear, concise language with natural contractions`,
    `- Short sentences, no filler`,
    `- Confirm key details back to the caller`,
    `- Avoid jargon; use plain language`,
    ``,
    `## Conversation Flow`,
    `### 1) Intro`,
    `- Greet briefly and state purpose: scheduling and information.`,
    `- If the caller already states their intent, respond to that immediately.`,
    `### 2) Determination`,
    `- Determine if this is: New appointment, Reschedule, Cancel, or Urgent.`,
    `- Collect essentials: full name, phone number, reason for visit, preferred date/time windows.`,
    `### 3) Scheduling`,
    `- Offer earliest suitable options that match the caller’s preferences.`,
    `- Confirm exact date, time, practitioner (if applicable), and location.`,
    `### 4) Confirmation & Wrap-up`,
    `- Read back the appointment details.`,
    `- Provide preparation instructions if needed.`,
    `- Offer to send confirmation by SMS or email if the system supports it.`,
    `- Close warmly and succinctly.`,
    ``,
    `## Response Guidelines`,
    `- Answer any question or objection directly before asking your next question.`,
    `- One question at a time.`,
    `- Use bullet points for options.`,
    `- Never guess. If unsure, say what you can do and offer an alternative.`,
    `- Keep responses under 3 short sentences unless reading back details.`,
    ``,
    `## Scenario Handling`,
    `- **New**: Capture name, contact, reason, availability; propose options; confirm details.`,
    `- **Urgent**: If the issue sounds urgent or severe, advise immediate emergency services if appropriate; otherwise prioritize sooner slots.`,
    `- **Rescheduling**: Confirm existing appointment; collect new availability; update and confirm changes.`,
    `- **Insurance**: Provide general info; if policy checks are needed, gather policy name/ID and explain it may be verified later.`,
    ``,
    `## Knowledge Base`,
    `- Services/types offered`,
    `- Operating hours & holiday closures`,
    `- Preparation or paperwork required`,
    `- Cancellation/no-show policy`,
    ``,
    `## Call Management`,
    `- If the call drops, attempt to call back if the system allows.`,
    `- If the caller requests a human, offer a callback and collect the best time.`,
    ``,
    extra ? `## Additional Business Context\n${extra}` : "",
    ``,
    `---`,
    `# Source Material (for reference only — do not read verbatim)`,
    cleaned ? cleaned : `No additional raw notes provided.`,
  ]
    .filter(Boolean)
    .join("\n");
}

// ---------- Seed prompt from Builder (Step 1 + 3) ----------
function trySeedPromptFromChatbots(): { prompt: string; language?: string } | null {
  try {
    const bots = getJSON<any[]>(LS_KEYS.chatbots, []);
    if (!bots?.length) return null;
    const last = bots[bots.length - 1];

    // Heuristic extraction (handles various builder shapes)
    const name = last?.name || last?.aiName || last?.title || "Your Clinic";
    const industry = last?.industry || last?.sector || "Healthcare";
    const lang = last?.language || last?.lang || "en-US";

    const faq = last?.faq || last?.companyFAQ || last?.knowledge?.faq || [];
    const flow = last?.questionFlow || last?.flow || [];
    const personality = last?.personality || last?.tone || "Friendly and professional.";
    const notes = last?.notes || last?.rawNotes || last?.additionalContext || "";

    const businessContext = [
      `Business Name: ${name}`,
      `Industry: ${industry}`,
      `Language Pref: ${lang}`,
      personality ? `Personality: ${personality}` : "",
      flow?.length ? `Question Flow: ${Array.isArray(flow) ? flow.join(" | ") : String(flow)}` : "",
      faq?.length ? `FAQ: ${Array.isArray(faq) ? faq.map((f: any) => (typeof f === "string" ? f : f?.q)).filter(Boolean).join(" | ") : String(faq)}` : "",
      notes ? `Notes: ${notes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const shaped = shapePromptForScheduling("", businessContext);
    return { prompt: shaped, language: lang };
  } catch {
    return null;
  }
}

// ---------- Audio Ping (robust play/stop per spec) ----------
function useAudioPing() {
  const ctxRef = useRef<AudioContext | null>(null);
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const play = async () => {
    if (isPlaying) return;
    try {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AC();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880; // pleasant beep
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      ctxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;
      setIsPlaying(true);
    } catch (e) {
      console.error(e);
    }
  };

  const stop = async () => {
    try {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch {}
        try { oscRef.current.disconnect(); } catch {}
      }
      if (gainRef.current) {
        try { gainRef.current.disconnect(); } catch {}
      }
      if (ctxRef.current) {
        try { await ctxRef.current.close(); } catch {}
      }
    } finally {
      oscRef.current = null;
      gainRef.current = null;
      ctxRef.current = null;
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => { // cleanup on unmount
      stop();
    };
  }, []);

  return { isPlaying, play, stop };
}

// ---------- Simple UI atoms ----------
const Card: React.FC<React.PropsWithChildren<{ title: string; actions?: React.ReactNode }>> = ({ title, actions, children }) => (
  <div className="rounded-2xl border border-emerald-500/20 bg-[#0d0f11]/95 shadow-[0_0_40px_-15px_rgba(16,185,129,0.35)]">
    <div className="flex items-center justify-between px-5 py-4 border-b border-emerald-500/10">
      <h2 className="text-lg font-semibold text-white/90">{title}</h2>
      <div className="flex items-center gap-2">{actions}</div>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
  <button
    {...props}
    className={[
      "px-4 py-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
      "hover:bg-emerald-500/15 active:scale-[.99] transition",
      props.disabled ? "opacity-50 cursor-not-allowed" : "",
      className,
    ].join(" ")}
  />
);

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({ className = "", ...props }) => (
  <input
    {...props}
    className={[
      "w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white placeholder-white/40",
      "focus:outline-none focus:ring-2 focus:ring-emerald-400/30",
      className,
    ].join(" ")}
  />
);

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ className = "", children, ...props }) => (
  <select
    {...props}
    className={[
      "w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-white",
      "focus:outline-none focus:ring-2 focus:ring-emerald-400/30",
      className,
    ].join(" ")}
  >
    {children}
  </select>
);

const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = ({ className = "", ...props }) => (
  <textarea
    {...props}
    className={[
      "w-full min-h-[220px] px-3 py-2 rounded-xl bg-black/40 border border-white/10 text-white",
      "focus:outline-none focus:ring-2 focus:ring-emerald-400/30",
      className,
    ].join(" ")}
  />
);

// ---------- Main Page Component ----------
export default function VoiceAgentPage() {
  const [banner, setBanner] = useState<Banner>(null);

  // Numbers
  const [numbers, setNumbers] = useState<NumberItem[]>([]);

  // Settings state
  const [settings, setSettings] = useState<Settings>(() => {
    const saved = getJSON<Settings | null>(LS_KEYS.backupSettings, null);
    if (saved) return saved;
    // default blank — seed on mount if possible
    return { systemPrompt: "", language: "en-US", ttsVoice: "alice", fromE164: "", assistantId: "", publicKey: "" };
  });

  // Derived Twilio creds
  const twilioCreds = useMemo<TwilioCreds | null>(() => getJSON<TwilioCreds | null>(LS_KEYS.twilioCreds, null), [settings.fromE164]);

  // Audio ping hook
  const audio = useAudioPing();

  // Widget mounting
  const widgetContainerRef = useRef<HTMLDivElement | null>(null);
  const [widgetMounted, setWidgetMounted] = useState(false);

  function showBanner(b: Banner, ttl = 3500) {
    setBanner(b);
    if (b) {
      window.clearTimeout((showBanner as any)._t);
      (showBanner as any)._t = window.setTimeout(() => setBanner(null), ttl);
    }
  }

  // Initial load: settings + numbers + seed prompt if needed
  useEffect(() => {
    (async () => {
      // Fetch numbers
      const res = await apiGetNumbers();
      if (res.ok && res.data?.ok) {
        setNumbers(res.data.data || []);
      } else if (!res.ok) {
        showBanner({ kind: "error", message: res.error || "Failed to fetch numbers" });
      }

      // Seed prompt if empty and chatbots exist
      if (!settings.systemPrompt) {
        const seeded = trySeedPromptFromChatbots();
        if (seeded) {
          setSettings((s) => ({ ...s, systemPrompt: seeded.prompt, language: seeded.language || s.language }));
        }
      }
    })();
  }, []);

  // Persist backup on every settings change
  useEffect(() => {
    setJSON(LS_KEYS.backupSettings, settings);
  }, [settings]);

  const refreshNumbers = async () => {
    const res = await apiGetNumbers();
    if (res.ok && res.data?.ok) {
      setNumbers(res.data.data || []);
      if (!res.data.data?.length) {
        showBanner({ kind: "info", message: "No numbers imported." });
      }
    } else {
      showBanner({ kind: "error", message: res.ok ? "Failed to refresh numbers" : res.error });
    }
  };

  const attachNumber = async () => {
    const e164 = settings.fromE164?.trim();
    if (!e164) {
      showBanner({ kind: "error", message: "Select a phone number first." });
      return;
    }
    const creds = twilioCreds;
    if (!creds?.accountSid || !creds?.authToken) {
      showBanner({ kind: "error", message: "No Twilio credentials found from import. Import a number with Twilio first." });
      return;
    }
    const res = await apiAttachNumber(e164, creds);
    if (res.ok && (res.data as any)?.ok) {
      showBanner({ kind: "success", message: `Number attached to agent: ${e164}` });
    } else {
      const msg = res.ok ? "Attach failed." : res.error;
      showBanner({ kind: "error", message: msg });
    }
  };

  const createAgent = async () => {
    const payload = {
      fromNumber: settings.fromE164 || undefined,
      voice: settings.ttsVoice || "alice",
      language: settings.language || "en-US",
      prompt: settings.systemPrompt || "",
    };
    const res = await apiCreateAgent(payload);
    if (res.ok && (res.data as any)?.ok) {
      const id = (res.data as any)?.agentId || "";
      const liveText = settings.fromE164 ? ` — live at ${settings.fromE164}` : "";
      showBanner({ kind: "success", message: `Agent created${liveText}.` });
      if (id) {
        // Optionally keep it somewhere if needed later
      }
    } else {
      const msg = res.ok ? "Create failed." : res.error;
      showBanner({ kind: "error", message: msg });
    }
  };

  const saveAll = async () => {
    // Always mirror to backup; also try server PUT (if available)
    setJSON(LS_KEYS.backupSettings, settings);
    const res = await apiSaveSettings(settings);
    if (res.ok && (res.data as any)?.ok) {
      showBanner({ kind: "success", message: "Settings saved." });
    } else if (!res.ok && res.error === "Server did not return JSON.") {
      // Server may not support yet — still OK because we backed up locally
      showBanner({ kind: "info", message: "Saved locally. (Server save not available)" });
    } else if (!res.ok) {
      showBanner({ kind: "error", message: res.error });
    } else {
      showBanner({ kind: "error", message: "Save failed." });
    }
  };

  const improvePrompt = () => {
    const bots = getJSON<any[]>(LS_KEYS.chatbots, []);
    const last = bots?.[bots.length - 1];
    const extra = last
      ? [
          last?.name || last?.aiName || last?.title ? `Business Name: ${last?.name || last?.aiName || last?.title}` : "",
          last?.industry ? `Industry: ${last.industry}` : "",
          last?.language ? `Language Pref: ${last.language}` : "",
          last?.notes ? `Notes: ${last.notes}` : "",
        ]
          .filter(Boolean)
          .join("\n")
      : "";

    const shaped = shapePromptForScheduling(settings.systemPrompt, extra);
    setSettings((s) => ({ ...s, systemPrompt: shaped }));
    showBanner({ kind: "success", message: "Prompt improved." });
  };

  const mountWidget = async () => {
    if (!settings.assistantId || !settings.publicKey) {
      showBanner({ kind: "error", message: "Provide Assistant ID and Public Key first." });
      return;
    }

    // Clear old content
    if (widgetContainerRef.current) widgetContainerRef.current.innerHTML = "";

    // Load widget script if needed (idempotent)
    const existing = document.querySelector<HTMLScriptElement>(`script[data-vapi-widget="true"]`);
    if (!existing) {
      const script = document.createElement("script");
      script.dataset.vapiWidget = "true";
      script.src = "https://cdn.jsdelivr.net/npm/@vapi-ai/web/dist/index.umd.js"; // generic widget CDN
      script.async = true;
      document.head.appendChild(script);
      await new Promise<void>((resolve) => {
        script.onload = () => resolve();
        // also resolve after short timeout in case it's already cached
        setTimeout(() => resolve(), 1200);
      });
    }

    // Mount custom element
    const el = document.createElement("vapi-widget") as any;
    (el as any).assistant = settings.assistantId;
    (el as any).publicKey = settings.publicKey;
    (el as any).autostart = false;
    widgetContainerRef.current?.appendChild(el);
    setWidgetMounted(true);
    showBanner({ kind: "success", message: "Widget mounted." });
  };

  // ---------- UI ----------
  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-[#07110e] via-[#06110e] to-black text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 backdrop-blur supports-[backdrop-filter]:bg-black/40 bg-black/30 border-b border-emerald-500/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-wide">Voice Agent</h1>
          <div className="flex items-center gap-3">
            <Button onClick={createAgent}>Create Agent</Button>
            <Button onClick={saveAll} className="border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15">Save</Button>
          </div>
        </div>
      </header>

      {/* Banner */}
      {banner && (
        <div className={`mx-auto max-w-6xl px-4 pt-4`}> 
          <div
            className={[
              "rounded-xl px-4 py-3 border",
              banner.kind === "success" && "bg-emerald-500/10 border-emerald-400/30 text-emerald-200",
              banner.kind === "error" && "bg-rose-500/10 border-rose-400/30 text-rose-200",
              banner.kind === "info" && "bg-amber-500/10 border-amber-400/30 text-amber-200",
            ].join(" ")}
          >
            {banner.message}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-6xl px-4 py-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prompt Card */}
        <Card
          title="Prompt"
          actions={
            <>
              <Button onClick={improvePrompt}>Improve Prompt</Button>
              <Button onClick={saveAll} className="border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15">Save</Button>
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Language (BCP-47)</label>
              <Input
                value={settings.language}
                onChange={(e) => setSettings((s) => ({ ...s, language: e.target.value }))}
                placeholder="en-US"
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">TTS Voice</label>
              <Input
                value={settings.ttsVoice}
                onChange={(e) => setSettings((s) => ({ ...s, ttsVoice: e.target.value }))}
                placeholder="alice or Polly.Joanna"
              />
            </div>
            <div className="flex items-end">
              <div className="text-xs text-white/50">Tip: Match voice to language for best clarity.</div>
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm text-white/70 mb-1">System Prompt</label>
            <TextArea
              value={settings.systemPrompt}
              onChange={(e) => setSettings((s) => ({ ...s, systemPrompt: e.target.value }))}
              placeholder="Write or paste your scheduling prompt…"
            />
          </div>
        </Card>

        {/* Number Card */}
        <Card
          title="Number"
          actions={
            <>
              <Button onClick={refreshNumbers}>Refresh Imported Numbers</Button>
              <Button onClick={attachNumber}>Attach Number to Agent</Button>
            </>
          }
        >
          <p className="text-sm text-white/60 mb-3">
            Uses your Twilio creds saved during import (never asks twice).
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">From Number</label>
              <Select
                value={settings.fromE164}
                onChange={(e) => setSettings((s) => ({ ...s, fromE164: e.target.value }))}
              >
                <option value="">Select an imported number…</option>
                {numbers.map((n) => (
                  <option key={n.id} value={n.e164 || n.id}>
                    {(n.e164 || n.id) + (n.label ? ` — ${n.label}` : "")}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Twilio Credentials</label>
              <Input
                value={twilioCreds ? `${twilioCreds.accountSid} / ****${(twilioCreds.authToken || "").slice(-4)}` : "(none)"}
                readOnly
              />
              {!twilioCreds && (
                <div className="text-xs text-rose-300/80 mt-1">
                  No Twilio credentials found from import. Import a number with Twilio first.
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Quick Tests Card */}
        <Card
          title="Quick Tests"
          actions={
            <>
              {!audio.isPlaying ? (
                <Button onClick={audio.play}>Play Ping</Button>
              ) : (
                <Button onClick={audio.stop}>Stop Ping</Button>
              )}
            </>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-white/70 mb-1">Assistant ID</label>
              <Input
                value={settings.assistantId || ""}
                onChange={(e) => setSettings((s) => ({ ...s, assistantId: e.target.value }))}
                placeholder="asst_..."
              />
            </div>
            <div>
              <label className="block text-sm text-white/70 mb-1">Public Key</label>
              <Input
                value={settings.publicKey || ""}
                onChange={(e) => setSettings((s) => ({ ...s, publicKey: e.target.value }))}
                placeholder="pk_..."
              />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button onClick={mountWidget}>Show Widget</Button>
            <Button onClick={saveAll} className="border-sky-400/30 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15">Save</Button>
          </div>
          <div className="mt-4">
            <div id="widget-slot" ref={widgetContainerRef} className="min-h-[90px] rounded-lg border border-white/10 bg-black/30 p-3" />
            {!widgetMounted && (
              <div className="text-xs text-white/50 mt-2">Widget will mount here when Assistant ID + Public Key are set.</div>
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
