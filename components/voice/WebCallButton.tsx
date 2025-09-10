'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

/**
 * Minimal “agent”: echo user for now.
 * Replace the reply() body with your real API call if you want LLM responses.
 */
const agent = {
  async reply(userText: string) {
    return `You said: ${userText}.`;
  },
};

/* ----------------------- AUDIO + TTS HELPERS ----------------------- */

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
      // give up after 1.5s but return whatever we have
      res();
    }, 1500);
  });
  return synth.getVoices();
}

function pickVoice(voices: SpeechSynthesisVoice[], label: string) {
  const l = (label || '').toLowerCase();
  const prefs =
    l.includes('ember')
      ? ['Samantha', 'Google US English', 'Serena', 'Victoria', 'Alex', 'Microsoft Aria']
      : l.includes('alloy')
      ? ['Alex', 'Daniel', 'Google UK English Male', 'Microsoft David', 'Fred', 'Samantha']
      : ['Google US English', 'Samantha', 'Alex', 'Daniel'];

  for (const p of prefs) {
    const v = voices.find((v) => v.name.toLowerCase().includes(p.toLowerCase()));
    if (v) return v;
  }
  return voices.find((v) => /en-|english/i.test(`${v.lang} ${v.name}`)) || voices[0];
}

async function speak(text: string, label: string) {
  const synth = window.speechSynthesis;
  try {
    synth.cancel();
  } catch {}
  const voices = await ensureVoicesReady();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pickVoice(voices, label);
  u.rate = 1;
  u.pitch = 0.95;
  u.volume = 1;
  synth.speak(u);
}

/**
 * Some browsers (Chrome/iOS) block audio until:
 * 1) We have a user gesture, and
 * 2) An AudioContext is resumed and a sound was “played”.
 * We play a one-sample silent buffer to unlock playback.
 */
async function unlockAutoplay(): Promise<void> {
  const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AC) return;
  const ctx = new AC();
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {}
  }
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
    src.stop(0);
  } catch {}
}

/**
 * Ask for mic permission (and immediately stop tracks). This both grants SR mic access
 * and improves reliability of SR start() on some platforms.
 */
async function primeMicrophone(): Promise<void> {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    // user denied or not available; we still proceed, SR might prompt on start
  }
}

/* ----------------------- SPEECH RECOGNITION ----------------------- */

type SR = SpeechRecognition & {
  start: () => void;
  stop: () => void;
};

function makeRecognizer(onFinalText: (text: string) => void): SR | null {
  const SRClass: any =
    (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
  if (!SRClass) return null;

  const r: SR = new SRClass();
  r.continuous = true;
  r.interimResults = true;
  r.lang = 'en-US';

  r.onresult = (e: SpeechRecognitionEvent) => {
    let final = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) final += res[0].transcript;
    }
    if (final.trim()) onFinalText(final.trim());
  };

  // auto-restart on end (keeps session live unless we explicitly stop)
  (r as any)._shouldRestart = true;
  r.onend = () => {
    if ((r as any)._shouldRestart) {
      try {
        r.start();
      } catch {}
    }
  };

  return r;
}

/* ----------------------- COMPONENT ----------------------- */

export default function WebCallButton({
  greet = 'Hello. How may I help you today?',
  voiceLabel = 'Alloy (OpenAI)',
  onTranscript,
}: {
  greet?: string;
  voiceLabel?: string;
  onTranscript?: (role: 'user' | 'assistant', text: string) => void;
}) {
  const [live, setLive] = useState(false);
  const [ready, setReady] = useState(false);
  const recRef = useRef<SR | null>(null);

  // Feature-detect once on mount (client only)
  useEffect(() => {
    setReady(typeof window !== 'undefined' && !!((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition));
  }, []);

  const start = async () => {
    // gate everything behind a click (user gesture)
    await unlockAutoplay();
    await primeMicrophone();

    // greet first (after user gesture, so speechSynthesis is allowed)
    await speak(greet, voiceLabel);

    // init SR
    const rec = makeRecognizer(async (finalText) => {
      onTranscript?.('user', finalText);
      const reply = await agent.reply(finalText);
      onTranscript?.('assistant', reply);
      await speak(reply, voiceLabel);
    });

    if (!rec) {
      await speak('Speech recognition is not available in this browser.', voiceLabel);
      return;
    }

    recRef.current = rec;
    (rec as any)._shouldRestart = true;

    try {
      rec.start();
      setLive(true);
    } catch (err) {
      console.error('SR start error', err);
      await speak('I could not access speech recognition. Please check microphone permissions.', voiceLabel);
      (rec as any)._shouldRestart = false;
      try { rec.stop(); } catch {}
      recRef.current = null;
      setLive(false);
    }
  };

  const stop = async () => {
    const rec = recRef.current;
    if (rec) {
      (rec as any)._shouldRestart = false;
      try { rec.stop(); } catch {}
    }
    recRef.current = null;
    try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
  };

  if (!ready && !live) {
    // Still let user try — but give a hint
    return (
      <button onClick={start} className="btn btn--green" title="Starts a browser-based voice call.">
        <PhoneCall className="w-4 h-4 text-white" />
        <span className="text-white">Start Web Call</span>
      </button>
    );
  }

  return !live ? (
    <button onClick={start} className="btn btn--green">
      <PhoneCall className="w-4 h-4 text-white" />
      <span className="text-white">Start Web Call</span>
    </button>
  ) : (
    <button onClick={stop} className="btn btn--danger">
      <PhoneOff className="w-4 h-4" />
      End Call
    </button>
  );
}
