'use client';

import React, { useEffect, useRef } from 'react';
import { PhoneCall, PhoneOff } from 'lucide-react';

export type TranscriptTurn = { role: 'assistant'|'user'; text: string; ts: number };

export type WebCallConfig = {
  firstMessageMode: 'assistant_first'|'user_first';
  firstMessage: string;
  systemPrompt: string;
  model: string; // e.g. 'gpt-4o'
  voice: { provider: 'openai'|'elevenlabs'; voiceId: string; voiceLabel: string; userKey?: string };
};

type Props = {
  disabled?: boolean;
  live: boolean;
  setLive(v:boolean): void;
  cfg: WebCallConfig;
  onTurn(turn: TranscriptTurn): void;
  onError?(msg: string): void;
  openaiKey: string | null;
};

/* ============================ Speech utils ============================ */
function makeRecognizer(onFinalText: (text:string)=>void) {
  const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
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
  await new Promise(res => {
    const t = setInterval(() => {
      voices = synth.getVoices();
      if (voices.length) { clearInterval(t); res(null); }
    }, 50);
    setTimeout(() => { clearInterval(t); res(null); }, 1500);
  });
  return synth.getVoices();
}

async function speakWithVoice(text: string, voiceLabel: string){
  const synth = window.speechSynthesis;
  try { synth.resume(); } catch {}
  const voices = await ensureVoicesReady();
  const preferred = voices.find(v => /English|en-/i.test(`${v.lang} ${v.name}`)) || voices[0];
  const u = new SpeechSynthesisUtterance(text);
  u.voice = preferred;
  synth.cancel(); synth.speak(u);
}

async function speak(text: string, opts: { provider:'openai'|'elevenlabs'; voiceId: string; voiceLabel: string; userKey?: string }) {
  try { window.speechSynthesis.cancel(); } catch {}
  if (opts.provider === 'elevenlabs') {
    const r = await fetch('/api/tts', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(opts.userKey ? { 'x-11labs-key': opts.userKey } : {}) },
      body: JSON.stringify({ voiceId: opts.voiceId, text }),
    });
    if (!r.ok) return speakWithVoice(text, opts.voiceLabel);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    (audio as any).playsInline = true;
    try { await audio.play(); } catch { await speakWithVoice(text, opts.voiceLabel); }
    return;
  }
  await speakWithVoice(text, opts.voiceLabel);
}

/* ============================ Local prompt agent ============================ */
function parseCollectFields(prompt: string): string[] {
  const m = prompt.match(/\[Data\s*to\s*Collect\]\s*([\s\S]*?)(?=\n\[|$)/i);
  if (!m) return ['Full Name','Phone Number','Email','Appointment Date/Time'];
  const lines = m[1].split(/\r?\n/).map(s => s.replace(/^\s*[-*]\s*/, '').trim()).filter(Boolean);
  return lines.length ? lines : ['Full Name','Phone Number','Email','Appointment Date/Time'];
}
function makePromptAgent(systemPrompt: string){
  const fields = parseCollectFields(systemPrompt);
  const state: Record<string, string> = {};
  function nextMissing(): string | null { for (const f of fields) if (!state[f.toLowerCase()]) return f; return null; }
  function extractName(s: string){ const m = s.match(/\b(?:i am|i'm|my name is|this is)\s+([a-z][a-z '-]+(?:\s+[a-z][a-z '-]+){0,2})/i); return m?.[1]?.trim(); }
  function extractPhone(s: string){ const m = s.replace(/[^\d+]/g,'').match(/(\+?\d{10,15})/); return m?.[1]; }
  function extractEmail(s: string){ const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i); return m?.[0]; }
  function extractDateTime(s: string){
    const m = s.match(/\b(?:mon|tue|wed|thu|fri|sat|sun|tomorrow|today)\b.*?\b(\d{1,2}(:\d{2})?\s?(am|pm)?)|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\s+\d{1,2}(:\d{2})?\s?(am|pm)?/i);
    return m?.[0];
  }
  function tryAutoFill(user: string){
    const map: Array<{keys: string[], val?: string|null}> = [
      { keys:['full name','name'],              val: extractName(user) || null },
      { keys:['phone number','phone','digits'], val: extractPhone(user) || null },
      { keys:['email'],                          val: extractEmail(user) || null },
      { keys:['appointment date/time','date/time','date','time'], val: extractDateTime(user) || null },
    ];
    for (const f of fields) {
      const k = f.toLowerCase();
      if (state[k]) continue;
      const hit = map.find(m => m.keys.includes(k));
      if (hit?.val) state[k] = hit.val;
    }
  }
  function professionalTone(text: string){ return text.replace(/\s+/g,' ').replace(/\bi am\b/gi,'I’m').trim(); }
  function askFor(fieldLabel: string){
    const k = fieldLabel.toLowerCase();
    const cue =
      k.includes('name') ? 'your full name'
    : k.includes('phone') ? 'the best phone number to reach you'
    : k.includes('email') ? 'your email (optional)'
    : k.includes('date') || k.includes('time') ? 'a preferred date and time'
    : fieldLabel.toLowerCase();
    return `Got it. What’s ${cue}?`;
  }
  function confirmationLine(){ return fields.map(f => `${f}: ${state[f.toLowerCase()] || '—'}`).join(' • '); }
  return {
    reply(userText: string){
      tryAutoFill(userText);
      const missing = nextMissing();
      if (missing) return professionalTone(askFor(missing));
      return professionalTone(`Thanks. Here’s what I have: ${confirmationLine()}. Should I confirm or change anything?`);
    }
  };
}

/* ============================ OpenAI chat ============================ */
function promptAllowsHistory(systemPrompt: string): boolean {
  // Only include history if the prompt explicitly opts in
  return /\[AllowHistory\]\s*yes/i.test(systemPrompt);
}

async function openaiChat({
  apiKey, model, systemPrompt, userText, history,
}: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  userText: string;
  history?: Array<{ role: 'user'|'assistant'; content: string }>;
}): Promise<string> {
  const msgs = [{ role: 'system', content: systemPrompt }, ...(history||[]), { role: 'user', content: userText }];
  const body = JSON.stringify({ model, temperature: 0.3, messages: msgs });
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}`);
  const j = await res.json();
  return j?.choices?.[0]?.message?.content?.trim() || '…';
}

/* ============================ Component ============================ */
export default function WebCallButton({ disabled, live, setLive, cfg, onTurn, onError, openaiKey }: Props) {
  const recogRef = useRef<any|null>(null);
  const chatHistoryRef = useRef<Array<{ role:'user'|'assistant'; content:string }>>([]);
  const localAgentRef = useRef<ReturnType<typeof makePromptAgent> | null>(null);

  useEffect(() => { localAgentRef.current = makePromptAgent(cfg.systemPrompt || ''); }, [cfg.systemPrompt]);

  async function start() {
    if (disabled || live) return;
    setLive(true);

    // assistant-first greeting
    if (cfg.firstMessageMode === 'assistant_first') {
      const greet = cfg.firstMessage || 'Hello. How may I help you today?';
      onTurn({ role:'assistant', text:greet, ts: Date.now() });
      await speak(greet, cfg.voice);
      if (promptAllowsHistory(cfg.systemPrompt)) chatHistoryRef.current.push({ role:'assistant', content:greet });
    }

    const rec = makeRecognizer(async (final) => {
      onTurn({ role:'user', text: final, ts: Date.now() });
      if (promptAllowsHistory(cfg.systemPrompt)) chatHistoryRef.current.push({ role:'user', content: final });

      let reply = '';
      if (openaiKey) {
        try {
          // If history not allowed, send only system + last user
          const hist = promptAllowsHistory(cfg.systemPrompt)
            ? chatHistoryRef.current.slice(-4)
            : [];
          reply = await openaiChat({
            apiKey: openaiKey,
            model: cfg.model,
            systemPrompt: cfg.systemPrompt,
            userText: final,
            history: hist
          });
        } catch (e:any) {
          reply = 'Sorry—something went wrong reaching the model.';
          onError?.(e?.message || 'OpenAI error');
        }
      } else {
        // Fallback: local agent
        reply = localAgentRef.current?.reply(final) || 'Understood.';
      }

      onTurn({ role:'assistant', text: reply, ts: Date.now() });
      await speak(reply, cfg.voice);
      if (promptAllowsHistory(cfg.systemPrompt)) chatHistoryRef.current.push({ role:'assistant', content: reply });
    });

    if (!rec) {
      const msg = 'Browser speech recognition is not available. Use Chrome or Edge.';
      onTurn({ role:'assistant', text: msg, ts: Date.now() });
      await speak(msg, cfg.voice);
      setLive(false);
      return;
    }
    recogRef.current = rec;
    try { rec.start(); } catch {}
  }

  async function stop() {
    try { recogRef.current?.stop?.(); } catch {}
    recogRef.current = null;
    try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
  }

  return !live ? (
    <button onClick={start} disabled={disabled} className="btn btn--green">
      <PhoneCall className="w-4 h-4 text-white" /><span className="text-white">Start Web Call</span>
    </button>
  ) : (
    <button onClick={stop} className="btn btn--danger">
      <PhoneOff className="w-4 h-4" /> End Call
    </button>
  );
}
