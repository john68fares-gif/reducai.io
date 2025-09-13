// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';
import { scopedStorage } from '@/utils/scoped-storage';

type SR = SpeechRecognition & { start: () => void; stop: () => void };

type SavedKey = {
  id: string;
  name?: string;
  key: string;
  provider?: 'openai' | 'elevenlabs' | 'deepgram';
};

const LS_KEYS = 'apiKeys.v1';         // where keys are stored
const LS_SELECTED = 'apiKeys.selectedId'; // for completeness (not required here)

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

  // ---- NEW: resolve the actual secret key from the selected id (or fallbacks)
  const [resolvedKey, setResolvedKey] = useState<string>('');
  const [keyError, setKeyError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setKeyError(null);
      let key = '';

      // 1) Try to load from scoped storage by apiKeyId
      if (apiKeyId) {
        try {
          const ss = await scopedStorage();
          await ss.ensureOwnerGuard();
          const all = (await ss.getJSON<SavedKey[]>(LS_KEYS, [])) || [];
          const match = all.find(k => (k.provider === 'openai' || !k.provider) && k.id === apiKeyId);
          if (match?.key) key = String(match.key).trim();
        } catch (e) {
          // swallow – will fall back
        }
      }

      // 2) Fallback to window.__OPENAI_KEY if set elsewhere
      if (!key && typeof window !== 'undefined' && (window as any).__OPENAI_KEY) {
        key = String((window as any).__OPENAI_KEY || '').trim();
      }

      // 3) Fallback to public env key (dev/local)
      // @ts-ignore
      if (!key && typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_OPENAI_API_KEY) {
        // @ts-ignore
        key = String(process.env.NEXT_PUBLIC_OPENAI_API_KEY || '').trim();
      }

      if (!cancelled) {
        setResolvedKey(key);
        if (!key) {
          setKeyError('OpenAI key is missing. Select one on the Voice page (API Key dropdown).');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [apiKeyId]);

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

  // ---- patched: send Authorization header with the resolved key; keep x-apikey-id for logging/back-compat
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
      const msg = await safeError(r);
      throw new Error(msg || 'I could not reach the model. Check your OpenAI key.');
    }
    const j = await r.json();
    return (j?.text || 'Understood.').trim();
  }

  async function safeError(r: Response): Promise<string> {
    try {
      const t = await r.text();
      try {
        const j = JSON.parse(t);
        return (j?.error || j?.message || t || '').toString();
      } catch {
        return (t || '').toString();
      }
    } catch {
      return '';
    }
  }

  async function start() {
    if (!resolvedKey) {
      const msg = keyError || 'OpenAI key is missing. Add it in API Keys.';
      onTurn('assistant', msg); await speak(msg); return;
    }
    onTurn('assistant', greet || 'Hello. How may I help you today?'); await speak(greet || 'Hello. How may I help you today?');

    const rec = makeRecognizer(async (finalText) => {
      onTurn('user', finalText);
      try { const reply = await ask(finalText); onTurn('assistant', reply); await speak(reply); }
      catch (e:any) { const msg = (e?.message || 'Model unavailable.'); onTurn('assistant', msg); await speak(msg); }
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
    <div className="inline-flex items-center gap-2">
      <button onClick={start} className="btn btn--green px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
        <PhoneCall className="w-4 h-4 text-white"/><span className="text-white">Start Web Call</span>
      </button>
      {!resolvedKey && (
        <span className="text-xs px-2 py-1 rounded-lg"
              style={{ background:'rgba(220,38,38,.12)', border:'1px solid rgba(220,38,38,.35)', color:'#fca5a5' }}>
          OpenAI key not loaded
        </span>
      )}
    </div>
  ) : (
    <button onClick={stop} className="btn btn--danger px-3 py-2 rounded-md border" style={{borderColor:'var(--border)'}}>
      <PhoneOff className="w-4 h-4"/> End Call
    </button>
  );
}
