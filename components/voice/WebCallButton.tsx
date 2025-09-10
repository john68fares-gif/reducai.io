'use client';

import React, { useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

type SR = SpeechRecognition & { start: () => void; stop: () => void };

export type WebCallButtonProps = {
  greet: string;
  voiceLabel: string;
  systemPrompt: string;          // sent to server exactly as-is
  model: string;                 // e.g. "gpt-4o" / "gpt-4o-mini"
  onTurn: (role: 'user' | 'assistant', text: string) => void; // transcript sink
  apiKey?: string;               // <-- selected OpenAI key
};

export default function WebCallButton({
  greet, voiceLabel, systemPrompt, model, onTurn, apiKey,
}: WebCallButtonProps) {
  const [live, setLive] = useState(false);
  const recRef = useRef<SR | null>(null);

  // --- SR
  function makeRecognizer(onFinal: (t: string) => void): SR | null {
    const C: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!C) return null;
    const r: SR = new C();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';
    r.onresult = (e: SpeechRecognitionEvent) => {
      let fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]; if (res.isFinal) fin += res[0].transcript;
      }
      if (fin.trim()) onFinal(fin.trim());
    };
    (r as any)._shouldRestart = true;
    r.onend = () => { if ((r as any)._shouldRestart) { try { r.start(); } catch {} } };
    return r;
  }

  // --- Browser TTS
  async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
    const synth = window.speechSynthesis;
    let v = synth.getVoices(); if (v.length) return v;
    await new Promise<void>(res => {
      const t = setInterval(()=>{ v = synth.getVoices(); if (v.length){ clearInterval(t); res(); } }, 50);
      setTimeout(()=>{ res(); }, 1500);
    });
    return window.speechSynthesis.getVoices();
  }
  function pickVoice(voices: SpeechSynthesisVoice[]) {
    const l = (voiceLabel||'').toLowerCase();
    const prefs = l.includes('ember')
      ? ['Samantha','Google US English','Serena','Victoria','Alex','Microsoft Aria']
      : l.includes('alloy')
      ? ['Alex','Daniel','Google UK English Male','Microsoft David','Fred','Samantha']
      : ['Google US English','Samantha','Alex','Daniel'];
    for (const p of prefs) {
      const v = voices.find(v => v.name.toLowerCase().includes(p.toLowerCase()));
      if (v) return v;
    }
    return voices.find(v => /en-|english/i.test(`${v.lang} ${v.name}`)) || voices[0];
  }
  async function speak(text: string) {
    const synth = window.speechSynthesis;
    try { synth.cancel(); } catch {}
    const voices = await ensureVoicesReady();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice(voices);
    u.rate = 1; u.pitch = .95; u.volume = 1;
    synth.speak(u);
  }

  // --- LLM call (uses selected key)
  async function askLLM(userText: string): Promise<string> {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { 'x-openai-key': apiKey } : {}), // <— pass selected key
      },
      body: JSON.stringify({ model, system: systemPrompt, user: userText }),
    });
    if (!r.ok) throw new Error('chat failed');
    const j = await r.json();
    return (j?.text || '').trim() || 'Understood.';
  }

  async function start() {
    onTurn('assistant', greet);
    await speak(greet);

    const rec = makeRecognizer(async (finalText) => {
      onTurn('user', finalText);
      try {
        const reply = await askLLM(finalText);
        onTurn('assistant', reply);
        await speak(reply);
      } catch {
        const msg = 'I could not reach the model. Check your OpenAI key.';
        onTurn('assistant', msg);
        await speak(msg);
      }
    });

    if (!rec) {
      const msg = 'Speech recognition not available in this browser.';
      onTurn('assistant', msg);
      await speak(msg);
      return;
    }

    recRef.current = rec;
    try { rec.start(); } catch {}
    setLive(true);
  }

  async function stop() {
    const rec = recRef.current;
    if (rec) { (rec as any)._shouldRestart = false; try { rec.stop(); } catch {} }
    recRef.current = null;
    try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
  }

  return !live ? (
    <button onClick={start} className="btn btn--green">
      <PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span>
    </button>
  ) : (
    <button onClick={stop} className="btn btn--danger">
      <PhoneOff className="w-4 h-4" /> End Call
    </button>
  );
}
