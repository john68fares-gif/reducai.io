'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

type SR = SpeechRecognition & { start: () => void; stop: () => void };

export default function WebCallButton({
  greet, voiceLabel, systemPrompt, model, apiKeyId, fromE164, onTurn,
}: {
  greet: string;
  voiceLabel: string;
  systemPrompt: string;
  model: string;
  apiKeyId: string;     // selected OpenAI key id (from scoped storage)
  fromE164: string;     // selected phone (for server logging / routing)
  onTurn: (role:'user'|'assistant', text:string) => void;
}) {
  const [live, setLive] = useState(false);
  const recRef = useRef<SR | null>(null);
  const liveRef = useRef(false);
  const blockedRef = useRef(false);       // prevents repeated “missing key” spam
  const startedByUserRef = useRef(false); // guarantees explicit user gesture

  /* ---------------- Speech utils ---------------- */
  function makeRecognizer(onFinal:(t:string)=>void): SR | null {
    const C: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!C) return null;
    const r: SR = new C();
    r.continuous = true;
    r.interimResults = true;
    r.lang = 'en-US';

    r.onresult = (e: SpeechRecognitionEvent) => {
      if (!liveRef.current) return;
      let fin = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) fin += res[0].transcript;
      }
      const text = fin.trim();
      if (!text) return;
      onFinal(text);
    };

    // Never auto-respawn unless we’re live (explicitly started)
    (r as any)._shouldRestart = false;
    r.onend = () => {
      if ((r as any)._shouldRestart && liveRef.current) {
        try { r.start(); } catch {}
      }
    };
    r.onerror = () => {
      // On error, stop any restart loop
      (r as any)._shouldRestart = false;
    };
    return r;
  }

  async function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
    const s = window.speechSynthesis;
    let v = s.getVoices();
    if (v.length) return v;
    await new Promise<void>(res => {
      const t = setInterval(() => {
        v = s.getVoices();
        if (v.length) { clearInterval(t); res(); }
      }, 50);
      setTimeout(() => { clearInterval(t); res(); }, 1200);
    });
    return s.getVoices();
  }
  function pickVoice(vs:SpeechSynthesisVoice[]) {
    const want = (voiceLabel || '').toLowerCase();
    const prefs = want.includes('ember') ? ['Samantha','Google US English','Serena','Victoria','Alex']
                 : want.includes('alloy') ? ['Alex','Daniel','Google UK English Male','Samantha']
                 : ['Google US English','Samantha','Alex','Daniel'];
    for (const p of prefs) {
      const v = vs.find(v=>v.name.toLowerCase().includes(p.toLowerCase()));
      if (v) return v;
    }
    return vs[0];
  }
  async function speak(text:string){
    const s = window.speechSynthesis; try { s.cancel(); } catch {}
    const v = await ensureVoices();
    const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice(v); u.rate = 1; u.pitch = .95;
    s.speak(u);
  }

  /* ---------------- Model call ---------------- */
  async function ask(userText:string): Promise<string> {
    // Don’t hit the server if key is missing
    if (!apiKeyId) throw new Error('OpenAI key is missing. Select one on the Voice page (API Key dropdown).');

    const r = await fetch('/api/voice/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-apikey-id': apiKeyId,
      },
      body: JSON.stringify({ model, system: systemPrompt, user: userText, fromE164 })
    });
    if (!r.ok) {
      const msg = await r.text().catch(() => '');
      throw new Error(msg || 'I could not reach the model. Check your OpenAI key.');
    }
    const j = await r.json();
    return (j?.text || 'Understood.').trim();
  }

  /* ---------------- Start / Stop ---------------- */
  async function start() {
    // Must be an explicit user gesture. The onClick below sets this flag.
    if (!startedByUserRef.current) return;

    // Hard stop if key is missing — say it ONCE and don’t start listening.
    if (!apiKeyId) {
      if (!blockedRef.current) {
        blockedRef.current = true;
        const msg = 'OpenAI key is missing. Select one on the Voice page (API Key dropdown).';
        onTurn('assistant', msg);
        await speak(msg);
      }
      startedByUserRef.current = false;
      return;
    }

    blockedRef.current = false;
    liveRef.current = true;
    setLive(true);

    // Greeting
    const hello = greet || 'Hello. How may I help you today?';
    onTurn('assistant', hello);
    await speak(hello);

    const rec = makeRecognizer(async (finalText) => {
      if (!liveRef.current) return;
      onTurn('user', finalText);
      try {
        const reply = await ask(finalText);
        onTurn('assistant', reply);
        await speak(reply);
      } catch (e:any) {
        const msg = e?.message || 'Model unavailable.';
        onTurn('assistant', msg);
        await speak(msg);
      }
    });

    if (!rec) {
      const msg='Speech recognition not available in this browser.';
      onTurn('assistant', msg);
      await speak(msg);
      stop(); // ensure state cleanup
      return;
    }

    recRef.current = rec;
    // Only restart while “live”
    (rec as any)._shouldRestart = true;
    try { rec.start(); } catch {}

    // reset gesture latch
    startedByUserRef.current = false;
  }

  function stop(){
    liveRef.current = false;
    const r = recRef.current;
    if (r) {
      (r as any)._shouldRestart = false;
      try { r.stop(); } catch {}
    }
    recRef.current = null;
    try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
    startedByUserRef.current = false;
  }

  // Clean up on unmount / route change
  useEffect(() => () => stop(), []);

  /* ---------------- UI ---------------- */
  return !live ? (
    <button
      onMouseDown={() => { startedByUserRef.current = true; }} // guarantee user gesture
      onTouchStart={() => { startedByUserRef.current = true; }}
      onClick={start}
      className="btn btn--green px-3 py-2 rounded-md border"
      style={{borderColor:'var(--va-border)'}}
      aria-label="Start Web Call"
    >
      <PhoneCall className="w-4 h-4 text-white"/><span className="text-white">Start Web Call</span>
    </button>
  ) : (
    <button
      onClick={stop}
      className="btn btn--danger px-3 py-2 rounded-md border"
      style={{borderColor:'var(--va-border)'}}
      aria-label="End Web Call"
    >
      <PhoneOff className="w-4 h-4"/> End Call
    </button>
  );
}
