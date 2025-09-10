'use client';

import React, { useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

type SR = SpeechRecognition & { start: () => void; stop: () => void };

export default function WebCallButton({
  greet, voiceLabel, systemPrompt, model, apiKeyId, fromE164, onTurn,
}: {
  greet: string;
  voiceLabel: string;
  systemPrompt: string;
  model: string;
  apiKeyId: string;       // selected OpenAI key id (from scopedStorage)
  fromE164: string;       // selected phone (for server logging / routing)
  onTurn: (role:'user'|'assistant', text:string) => void;
}) {
  const [live, setLive] = useState(false);
  const recRef = useRef<SR | null>(null);

  function makeRecognizer(onFinal:(t:string)=>void): SR | null {
    const C: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!C) return null;
    const r: SR = new C(); r.continuous = true; r.interimResults = true; r.lang = 'en-US';
    r.onresult = (e: SpeechRecognitionEvent) => {
      let fin=''; for (let i=e.resultIndex;i<e.results.length;i++){ const res=e.results[i]; if(res.isFinal) fin+=res[0].transcript; }
      if (fin.trim()) onFinal(fin.trim());
    };
    (r as any)._shouldRestart = true;
    r.onend = () => { if ((r as any)._shouldRestart) { try { r.start(); } catch {} } };
    return r;
  }

  async function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
    const s = window.speechSynthesis; let v = s.getVoices(); if (v.length) return v;
    await new Promise<void>(res=>{const t=setInterval(()=>{v=s.getVoices(); if(v.length){clearInterval(t);res();}},50); setTimeout(res,1200);});
    return s.getVoices();
  }
  function pickVoice(vs:SpeechSynthesisVoice[]) {
    const want = voiceLabel.toLowerCase();
    const prefs = want.includes('ember') ? ['Samantha','Google US English','Serena','Victoria','Alex']
                 : want.includes('alloy') ? ['Alex','Daniel','Google UK English Male','Samantha']
                 : ['Google US English','Samantha','Alex','Daniel'];
    for (const p of prefs) { const v = vs.find(v=>v.name.toLowerCase().includes(p.toLowerCase())); if (v) return v; }
    return vs[0];
  }
  async function speak(text:string){
    const s = window.speechSynthesis; try { s.cancel(); } catch {}
    const v = await ensureVoices(); const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice(v); u.rate = 1; u.pitch = .95; s.speak(u);
  }

  async function ask(userText:string): Promise<string> {
    const r = await fetch('/api/voice/chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-apikey-id': apiKeyId || '' },
      body: JSON.stringify({ model, system: systemPrompt, user: userText, fromE164 })
    });
    if (!r.ok) throw new Error('I could not reach the model. Check your OpenAI key.');
    const j = await r.json();
    return (j?.text || 'Understood.').trim();
  }

  async function start() {
    if (!apiKeyId) {
      const msg = 'OpenAI key is missing. Add it in API Keys.';
      onTurn('assistant', msg); await speak(msg); return;
    }
    onTurn('assistant', greet || 'Hello. How may I help you today?'); await speak(greet || 'Hello. How may I help you today?');

    const rec = makeRecognizer(async (finalText) => {
      onTurn('user', finalText);
      try { const reply = await ask(finalText); onTurn('assistant', reply); await speak(reply); }
      catch (e:any) { const msg = e?.message || 'Model unavailable.'; onTurn('assistant', msg); await speak(msg); }
    });

    if (!rec) {
      const msg='Speech recognition not available in this browser.'; onTurn('assistant', msg); await speak(msg); return;
    }
    recRef.current = rec; try { rec.start(); } catch {}
    setLive(true);
  }
  function stop(){
    const r = recRef.current; if (r) { (r as any)._shouldRestart=false; try { r.stop(); } catch {} }
    recRef.current = null; try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
  }

  return !live ? (
    <button onClick={start} className="btn btn--green px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
      <PhoneCall className="w-4 h-4 text-white"/><span className="text-white">Start Web Call</span>
    </button>
  ) : (
    <button onClick={stop} className="btn btn--danger px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
      <PhoneOff className="w-4 h-4"/> End Call
    </button>
  );
}
