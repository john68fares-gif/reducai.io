'use client';

import React, { useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

type SR = SpeechRecognition & { start: () => void; stop: () => void };

export default function WebCallButton({
  greet, voiceLabel, systemPrompt, model, onTurn,
}: {
  greet: string;
  voiceLabel: string;
  systemPrompt: string;
  model: string;
  onTurn: (role:'user'|'assistant', text:string) => void;
}) {
  const [live, setLive] = useState(false);
  const recRef = useRef<SR | null>(null);

  function makeRecognizer(onFinal: (t: string) => void): SR | null {
    const C: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!C) return null;
    const r: SR = new C();
    r.continuous = true; r.interimResults = true; r.lang = 'en-US';
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

  async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
    const synth = window.speechSynthesis;
    let v = synth.getVoices(); if (v.length) return v;
    await new Promise<void>(res => {
      const t = setInterval(()=>{ v = synth.getVoices(); if (v.length){ clearInterval(t); res(); } }, 50);
      setTimeout(()=> res(), 1500);
    });
    return window.speechSynthesis.getVoices();
  }
  function pickVoice(voices: SpeechSynthesisVoice[]) {
    const l = (voiceLabel||'').toLowerCase();
    const prefs = l.includes('alloy')
      ? ['Alex','Daniel','Google UK English Male','Microsoft David','Samantha']
      : ['Google US English','Samantha','Alex','Daniel'];
    for (const p of prefs) {
      const v = voices.find(v => v.name.toLowerCase().includes(p.toLowerCase()));
      if (v) return v;
    }
    return voices.find(v => /en-|english/i.test(`${v.lang} ${v.name}`)) || voices[0];
  }
  async function speak(text: string) {
    const synth = window.speechSynthesis; try { synth.cancel(); } catch {}
    const voices = await ensureVoicesReady();
    const u = new SpeechSynthesisUtterance(text); u.voice = pickVoice(voices);
    u.rate = 1; u.pitch = .95; u.volume = 1; synth.speak(u);
  }

  async function askLLM(userText: string): Promise<string> {
    const userKey = localStorage.getItem('voice:openaiKey') || '';
    if (!userKey) throw new Error('no_key');
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-openai-key': userKey },
      body: JSON.stringify({ model, system: systemPrompt, user: userText }),
    });
    if (!r.ok) throw new Error(await r.text().catch(()=> 'chat_failed'));
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
      } catch (e:any) {
        const msg = e?.message === 'no_key'
          ? 'Missing OpenAI key. Click “Import OpenAI Key” and paste your key.'
          : 'I could not reach the model. Check your OpenAI key.';
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

  function stop() {
    const rec = recRef.current;
    if (rec) { (rec as any)._shouldRestart = false; try { rec.stop(); } catch {} }
    recRef.current = null;
    try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
  }

  return !live ? (
    <button onClick={start} className="btn btn--green inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-emerald-500 text-white">
      <PhoneCall className="w-4 h-4" /> Start Web Call
    </button>
  ) : (
    <button onClick={stop} className="btn btn--danger inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm bg-red-600/15 text-red-500 border border-red-500/30">
      <PhoneOff className="w-4 h-4" /> End Call
    </button>
  );
}
