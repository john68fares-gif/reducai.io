'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

/** -------------------- Types -------------------- */
export type FirstMessageMode = 'assistant_first' | 'user_first';
export type VoiceProvider = 'openai' | 'elevenlabs';

export type Turn = { role: 'assistant' | 'user'; text: string; ts: number };

export type WebCallButtonProps = {
  /** Prompting */
  systemPrompt: string;
  firstMessageMode: FirstMessageMode;
  firstMessage?: string;

  /** Voice */
  voice: {
    provider: VoiceProvider;
    voiceId: string;
    voiceLabel: string;
    /** Optional — if you want to pass a key at runtime for ElevenLabs (header: X-11Labs-Key) */
    elevenLabsKey?: string;
  };

  /** Callbacks */
  onTurn?: (turn: Turn) => void;
  onStart?: (callId: string) => void;
  onEnd?: (callId: string, reason: string) => void;

  /** Button text overrides */
  labelStart?: string;
  labelEnd?: string;

  /** Extra className for the button */
  className?: string;
};

/** -------------------- Minimal agent from prompt -------------------- */
function parseCollectFields(prompt: string): string[] {
  const m = prompt.match(/\[Data\s*to\s*Collect\]\s*([\s\S]*?)(?=\n\[|$)/i);
  if (!m) return ['Full Name', 'Phone Number', 'Email', 'Appointment Date/Time'];
  const lines = m[1]
    .split(/\r?\n/)
    .map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
    .filter(Boolean);
  return lines.length ? lines : ['Full Name', 'Phone Number', 'Email', 'Appointment Date/Time'];
}
function extractName(s: string) {
  const m = s.match(/\b(?:i am|i'm|my name is|this is)\s+([a-z][a-z '-]+(?:\s+[a-z][a-z '-]+){0,2})/i);
  return m?.[1]?.trim();
}
function extractPhone(s: string) {
  const m = s.replace(/[^\d+]/g, '').match(/(\+?\d{10,15})/);
  return m?.[1];
}
function extractEmail(s: string) {
  const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0];
}
function extractDateTime(s: string) {
  const m = s.match(
    /\b(?:mon|tue|wed|thu|fri|sat|sun|tomorrow|today)\b.*?\b(\d{1,2}(:\d{2})?\s?(am|pm)?)|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+\d{1,2}(:\d{2})?\s?(am|pm)?/i
  );
  return m?.[0];
}
function makePromptAgent(systemPrompt: string) {
  const fields = parseCollectFields(systemPrompt);
  const state: Record<string, string> = {};
  function professionalTone(text: string) {
    return text.replace(/\s+/g, ' ').replace(/\bi am\b/gi, 'I’m').trim();
  }
  function confirmationLine() {
    const parts = fields.map((f) => {
      const k = f.toLowerCase();
      return `${f}: ${state[k] ? state[k] : '—'}`;
    });
    return parts.join(' • ');
  }
  function tryAutoFill(user: string) {
    const map: Array<{ keys: string[]; val?: string | null }> = [
      { keys: ['full name', 'name'], val: extractName(user) || null },
      { keys: ['phone number', 'phone', 'digits'], val: extractPhone(user) || null },
      { keys: ['email'], val: extractEmail(user) || null },
      { keys: ['appointment date/time', 'date/time', 'date', 'time'], val: extractDateTime(user) || null },
    ];
    for (const f of fields) {
      const k = f.toLowerCase();
      if (state[k]) continue;
      const hit = map.find((m) => m.keys.includes(k));
      if (hit?.val) state[k] = hit.val;
    }
  }
  function nextMissing(): string | null {
    for (const f of fields) if (!state[f.toLowerCase()]) return f;
    return null;
  }
  function askFor(fieldLabel: string) {
    const k = fieldLabel.toLowerCase();
    const cue =
      k.includes('name')
        ? 'your full name'
        : k.includes('phone')
        ? 'the best phone number to reach you'
        : k.includes('email')
        ? 'your email (optional)'
        : k.includes('date') || k.includes('time')
        ? 'a preferred date and time'
        : fieldLabel.toLowerCase();
    return `Got it. What’s ${cue}?`;
  }
  return {
    reply(userText: string) {
      tryAutoFill(userText);
      const missing = nextMissing();
      if (missing) return professionalTone(askFor(missing));
      return professionalTone(`Thanks. Here’s what I have: ${confirmationLine()}. Should I confirm or change anything?`);
    },
    summary() {
      return professionalTone(`Summary — ${confirmationLine()}.`);
    },
  };
}

/** -------------------- Speech (ASR + TTS) -------------------- */
function makeRecognizer(onFinalText: (text: string) => void) {
  const SR: any = (typeof window !== 'undefined' && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition)) || null;
  if (!SR) return null;
  const r = new SR();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';
  r.onresult = (e: any) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) final += res[0].transcript;
    }
    if (final.trim()) onFinalText(final.trim());
  };
  return r;
}

async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let voices = synth.getVoices();
  if (voices.length) return voices;
  await new Promise<void>((res) => {
    const t = setInterval(() => {
      voices = synth.getVoices();
      if (voices.length) {
        clearInterval(t);
        res();
      }
    }, 50);
    setTimeout(() => {
      clearInterval(t);
      res();
    }, 1500);
  });
  return synth.getVoices();
}

async function speakWithVoice(text: string, voiceLabel: string) {
  const synth = window.speechSynthesis;
  try {
    synth.resume();
  } catch {}
  const voices = await ensureVoicesReady();
  const lbl = (voiceLabel || '').toLowerCase();
  const prefs = lbl.includes('ember')
    ? ['Samantha', 'Google US English', 'Serena', 'Victoria', 'Alex', 'Microsoft Aria']
    : lbl.includes('alloy')
    ? ['Alex', 'Daniel', 'Google UK English Male', 'Microsoft David', 'Fred', 'Samantha']
    : lbl.includes('rachel')
    ? ['Samantha', 'Microsoft Aria', 'Google US English', 'Victoria', 'Alex']
    : lbl.includes('adam')
    ? ['Daniel', 'Alex', 'Google UK English Male', 'Microsoft David']
    : lbl.includes('bella')
    ? ['Victoria', 'Samantha', 'Google US English', 'Serena']
    : ['Google US English', 'Samantha', 'Alex', 'Daniel'];

  const pick = () => {
    for (const p of prefs) {
      const v = voices.find((v) => v.name.toLowerCase().includes(p.toLowerCase()));
      if (v) return v;
    }
    return voices.find((v) => /en-|english/i.test(`${v.lang} ${v.name}`)) || voices[0];
  };

  const u = new SpeechSynthesisUtterance(text);
  u.voice = pick();
  u.rate = 1;
  u.pitch = 0.95;
  u.volume = 1;

  synth.cancel();
  synth.speak(u);
}

async function speak(text: string, opts: { provider: VoiceProvider; voiceId: string; voiceLabel: string; userKey?: string }) {
  try {
    window.speechSynthesis.cancel();
  } catch {}
  if (opts.provider === 'elevenlabs') {
    try {
      const r = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(opts.userKey ? { 'x-11labs-key': opts.userKey } : {}),
        },
        body: JSON.stringify({ voiceId: opts.voiceId, text }),
      });
      if (!r.ok) throw new Error(`TTS failed (${r.status})`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      (audio as any).playsInline = true;
      await audio.play();
      return;
    } catch (err) {
      console.error('[WebCallButton] ElevenLabs TTS failed, falling back:', err);
    }
  }
  await speakWithVoice(text, opts.voiceLabel);
}

/** -------------------- Component -------------------- */
export default function WebCallButton({
  systemPrompt,
  firstMessageMode,
  firstMessage = 'Hello. How may I help you today?',
  voice,
  onTurn,
  onStart,
  onEnd,
  labelStart = 'Start Web Call',
  labelEnd = 'End Call',
  className,
}: WebCallButtonProps) {
  const [liveId, setLiveId] = useState<string | null>(null);
  const recRef = useRef<any | null>(null);
  const agentRef = useRef<ReturnType<typeof makePromptAgent> | null>(null);

  const pushTurn = useCallback(
    async (role: 'assistant' | 'user', text: string) => {
      const t: Turn = { role, text, ts: Date.now() };
      onTurn?.(t);
      if (role === 'assistant') {
        await speak(text, {
          provider: voice.provider,
          voiceId: voice.voiceId,
          voiceLabel: voice.voiceLabel,
          userKey: voice.elevenLabsKey,
        });
      }
    },
    [onTurn, voice]
  );

  const start = useCallback(async () => {
    if (liveId) return;
    const id = `call_${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    setLiveId(id);
    onStart?.(id);

    // Build prompt agent
    agentRef.current = makePromptAgent(systemPrompt || '');

    // Greeting if assistant-first
    if (firstMessageMode === 'assistant_first') {
      await pushTurn('assistant', firstMessage);
    }

    // Speech recognition
    const rec = makeRecognizer(async (finalText) => {
      await pushTurn('user', finalText);
      const reply = agentRef.current?.reply(finalText) || 'Understood.';
      await pushTurn('assistant', reply);
    });

    if (!rec) {
      const msg = 'Browser speech recognition is not available. Use Chrome or Edge.';
      await pushTurn('assistant', msg);
      console.warn('[WebCallButton] SpeechRecognition not available.');
      // Keep call running for TTS-only flows; you can end here if you want.
      return;
    }

    recRef.current = rec;
    try {
      rec.start();
    } catch (e) {
      console.error('[WebCallButton] recognizer.start error:', e);
    }
  }, [firstMessage, firstMessageMode, liveId, onStart, pushTurn, systemPrompt]);

  const end = useCallback(
    (reason: string) => {
      try {
        recRef.current?.stop?.();
      } catch {}
      recRef.current = null;
      try {
        window.speechSynthesis.cancel();
      } catch {}
      const id = liveId;
      setLiveId(null);
      if (id) onEnd?.(id, reason);
    },
    [liveId, onEnd]
  );

  // Hard-guard against SSR hydration issues
  useEffect(() => {
    // noop on server
  }, []);

  const running = !!liveId;

  return (
    <button
      onClick={() => (running ? end('Ended by user') : start())}
      className={className || (running ? 'btn btn--danger' : 'btn btn--green')}
      aria-pressed={running}
    >
      {running ? (
        <>
          <PhoneOff className="w-4 h-4" />
          {labelEnd}
        </>
      ) : (
        <>
          <PhoneCall className="w-4 h-4 text-white" />
          <span className="text-white">{labelStart}</span>
        </>
      )}
    </button>
  );
}
