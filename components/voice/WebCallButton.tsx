'use client';

import React, { useEffect, useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

type SR = SpeechRecognition & { start: () => void; stop: () => void };

type SavedKey = { id: string; name?: string; key: string; provider?: 'openai'|'elevenlabs'|'deepgram' };

const LS_KEYS = 'apiKeys.v1';

export default function WebCallButton({
  greet, voiceLabel, systemPrompt, model, apiKeyId, apiKey, fromE164, onTurn,
}: {
  greet: string;
  voiceLabel: string;
  systemPrompt: string;
  model: string;
  apiKeyId: string;        // selected key id (for logging/back-compat)
  apiKey?: string;         // resolved secret (preferred)
  fromE164: string;
  onTurn: (role:'user'|'assistant', text:string) => void;
}) {
  const [live, setLive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const recRef = useRef<SR | null>(null);
  const interimBufRef = useRef<string>('');
  const idleTimerRef = useRef<any>(null);

  // Resolve key if not provided directly
  const [resolvedKey, setResolvedKey] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (apiKey && apiKey.trim()) { setResolvedKey(apiKey.trim()); return; }

      let key = '';
      if (apiKeyId) {
        try {
          const ss = await scopedStorage();
          await ss.ensureOwnerGuard();
          const all = (await ss.getJSON<SavedKey[]>(LS_KEYS, [])) || [];
          const match = all.find(k => (k.provider === 'openai' || !k.provider) && k.id === apiKeyId);
          if (match?.key) key = String(match.key).trim();
        } catch {}
      }
      if (!key && typeof window !== 'undefined' && (window as any).__OPENAI_KEY) {
        key = String((window as any).__OPENAI_KEY || '').trim();
      }
      // @ts-ignore
      if (!key && typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OPENAI_API_KEY) {
        // @ts-ignore
        key = String(process.env.NEXT_PUBLIC_OPENAI_API_KEY || '').trim();
      }
      if (!cancelled) setResolvedKey(key);
    })();
    return () => { cancelled = true; };
  }, [apiKey, apiKeyId]);

  function makeRecognizer(onFinal:(t:string)=>void): SR | null {
    const C: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!C) return null;
    const r: SR = new C();
    r.continuous = true;
    r.interimResults = true;
    r.lang = navigator.language || 'en-US';

    r.onstart = () => { setErrMsg(null); setLive(true); };
    r.onerror = (e: any) => {
      const code = e?.error || 'recognition_error';
      const map: Record<string,string> = {
        'no-speech': 'No speech detected. Check your microphone.',
        'audio-capture': 'No microphone found or permission denied.',
        'not-allowed': 'Microphone permission denied. Allow mic access and try again.',
        'service-not-allowed': 'Speech service not allowed in this context.',
      };
      setErrMsg(map[code] || `Speech recognition error: ${code}`);
    };
    r.onend = () => { if (live) { try { r.start(); } catch {} } else { setLive(false); } };
    r.onresult = (e: SpeechRecognitionEvent) => {
      let finalText = '';
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText += res[0].transcript;
        else interimText += res[0].transcript;
      }
      // treat short pauses as final to catch quick phrases
      if (finalText.trim()) onFinal(finalText.trim());
      else if (interimText.trim()) {
        interimBufRef.current = interimText.trim();
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        idleTimerRef.current = setTimeout(() => {
          const t = interimBufRef.current.trim();
          if (t) { interimBufRef.current = ''; onFinal(t); }
        }, 900);
      }
    };
    return r;
  }

  async function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
    const s = window.speechSynthesis;
    let v = s.getVoices();
    if (v.length) return v;
    await new Promise<void>(res => {
      const t = setInterval(() => { v = s.getVoices(); if (v.length) { clearInterval(t); res(); } }, 50);
      setTimeout(() => { clearInterval(t); res(); }, 1200);
    });
    return s.getVoices();
  }
  function pickVoice(vs:SpeechSynthesisVoice[]) {
    const want = (voiceLabel || '').toLowerCase();
    const prefs = want.includes('ember') ? ['Samantha','Google US English','Serena','Victoria','Alex']
                 : want.includes('alloy') ? ['Alex','Daniel','Google UK English Male','Samantha']
                 : ['Google US English','Samantha','Alex','Daniel'];
    for (const p of prefs) { const v = vs.find(v=>v.name.toLowerCase().includes(p.toLowerCase())); if (v) return v; }
    return vs[0] || undefined;
  }
  async function speak(text:string){
    const s = window.speechSynthesis; try { s.cancel(); } catch {}
    const v = await ensureVoices(); const u = new SpeechSynthesisUtterance(text);
    u.voice = pickVoice(v); u.rate = 1; u.pitch = .95; s.speak(u);
  }

  async function ask(userText:string): Promise<string> {
    const r = await fetch('/api/voice/chat', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKeyId ? { 'x-apikey-id': apiKeyId } : {}),
        ...(resolvedKey ? { Authorization: `Bearer ${resolvedKey}` } : {}),
      },
      body: JSON.stringify({ model, system: systemPrompt, user: userText, fromE164 })
    });
    if (!r.ok) {
      const msg = await r.text().catch(()=> '');
      throw new Error(msg || 'I could not reach the model. Check your OpenAI key.');
    }
    const j = await r.json();
    return (j?.text || 'Understood.').trim();
  }

  async function start() {
    if (starting || live) return;
    setStarting(true); setErrMsg(null);

    if (!resolvedKey) {
      const msg = 'OpenAI key is missing. Select one on the Voice page (API Key dropdown).';
      onTurn('assistant', msg); await speak(msg); setStarting(false); return;
    }

    try { await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch {
      const msg = 'Mic permission denied. Allow microphone and try again.';
      onTurn('assistant', msg); await speak(msg); setStarting(false); return;
    }

    const hello = greet || 'Hello. How may I help you today?';
    onTurn('assistant', hello); await speak(hello);

    const rec = makeRecognizer(async (finalText) => {
      onTurn('user', finalText);
      try { const reply = await ask(finalText); onTurn('assistant', reply); await speak(reply); }
      catch (e:any) { const msg = e?.message || 'Model unavailable.'; onTurn('assistant', msg); await speak(msg); }
    });

    if (!rec) {
      const msg = 'Speech recognition is not available in this browser.';
      onTurn('assistant', msg); await speak(msg); setStarting(false); return;
    }

    recRef.current = rec;
    try { rec.start(); } catch { setErrMsg('Could not start recognition.'); setStarting(false); return; }
    setLive(true); setStarting(false);
  }

  function stop(){
    setLive(false);
    const r = recRef.current;
    if (r) { try { (r as any)._shouldRestart = false; r.stop(); } catch {} }
    recRef.current = null;
    interimBufRef.current = '';
    if (idleTimerRef.current) { clearTimeout(idleTimerRef.current); idleTimerRef.current = null; }
    try { window.speechSynthesis.cancel(); } catch {}
  }

  return !live ? (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={start}
        disabled={starting}
        className="btn btn--green px-3 py-2 rounded-md border"
        style={{ borderColor: 'var(--va-border)' }}
      >
        <PhoneCall className="w-4 h-4 text-white"/>
        <span className="text-white">{starting ? 'Starting…' : 'Start Web Call'}</span>
      </button>
      {(!resolvedKey || errMsg) && (
        <span className="text-xs px-2 py-1 rounded-lg"
              style={{ background:'rgba(220,38,38,.12)', border:'1px solid rgba(220,38,38,.35)', color:'#fca5a5' }}>
          {errMsg || 'OpenAI key not loaded'}
        </span>
      )}
    </div>
  ) : (
    <button onClick={stop} className="btn btn--danger px-3 py-2 rounded-md border" style={{borderColor:'var(--va-border)'}}>
      <PhoneOff className="w-4 h-4"/> End Call
    </button>
  );
}
