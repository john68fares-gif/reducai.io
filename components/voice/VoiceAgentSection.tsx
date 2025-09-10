// pages/voice-agent.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
import { Sparkles, RefreshCw, PhoneCall, PhoneOff, Copy } from 'lucide-react';

/** ---------- minimal look tokens ---------- */
const ACCENT = '#10b981';
const card = { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.14)' };

/** ---------- tiny prompt helpers (short + safe) ---------- */
const BASE_PROMPT = `[Identity]
You are a helpful assistant that books appointments.

[Style]
- Friendly, concise, confirms critical details.

[System Behaviors]
- Ask for missing details one at a time.
- Summarize before finalizing.

[Data to Collect]
- Full Name
- Phone Number
- Email (optional)
- Appointment Date/Time

[Safety]
- No medical/legal/financial advice beyond high-level pointers.

[Handover]
- Provide a short summary and next steps.`;

function mergePrompt(gen: string, current: string) {
  const raw = (gen || '').trim();
  if (!raw) return { prompt: current, firstMessage: undefined as string | undefined };

  // quick “first message: ...” support
  const m = raw.match(/^first\s*message\s*:\s*(.+)$/i);
  if (m) return { prompt: current, firstMessage: m[1].trim() };

  // If short or includes “collect”, build a tiny defaults prompt
  if (raw.split(/\s+/).length <= 4 || /(^|\s)collect(\s|:)/i.test(raw)) {
    return {
      prompt: `[Identity]\nYou are a fast appointment agent.\n\n[Data to Collect]\n- Full Name\n- Phone Number\n- Email (optional)\n- Appointment Date/Time\n\n[Style]\n- Friendly, concise.\n\n[System Behaviors]\n- Confirm, then summarize.`,
      firstMessage: undefined,
    };
  }

  // Otherwise append to end under a Refinements section
  const hasRef = /\[Refinements\]/i.test(current);
  const bullet = `- ${raw.replace(/\n+/g,' ').replace(/\s{2,}/g,' ')}`;
  const prompt = hasRef
    ? current.replace(/\[Refinements\][\s\S]*$/i, (s) => s + `\n${bullet}`)
    : `${current}\n\n[Refinements]\n${bullet}\n`;
  return { prompt, firstMessage: undefined };
}

/** ---------- speech utils (SR + TTS) ---------- */
type SR = SpeechRecognition & { start: () => void; stop: () => void };

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
      const res = e.results[i];
      if (res.isFinal) fin += res[0].transcript;
    }
    if (fin.trim()) onFinal(fin.trim());
  };
  (r as any)._keep = true;
  r.onend = () => { if ((r as any)._keep) { try { r.start(); } catch {} } };
  return r;
}

async function ensureVoicesReady(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  let v = synth.getVoices(); if (v.length) return v;
  await new Promise<void>(res => {
    const t = setInterval(()=>{ v = synth.getVoices(); if (v.length){ clearInterval(t); res(); } }, 50);
    setTimeout(()=>res(), 1200);
  });
  return window.speechSynthesis.getVoices();
}
function pickVoice(voices: SpeechSynthesisVoice[], label: string) {
  const L = (label||'').toLowerCase();
  const prefs = L.includes('ember')
    ? ['Samantha','Google US English','Serena','Victoria','Alex','Microsoft Aria']
    : L.includes('alloy')
    ? ['Alex','Daniel','Google UK English Male','Microsoft David','Fred','Samantha']
    : ['Google US English','Samantha','Alex','Daniel'];
  for (const p of prefs) {
    const v = voices.find(v => v.name.toLowerCase().includes(p.toLowerCase()));
    if (v) return v;
  }
  return voices.find(v => /en-|english/i.test(`${v.lang} ${v.name}`)) || voices[0];
}
async function speak(text: string, label: string) {
  const synth = window.speechSynthesis;
  try { synth.cancel(); } catch {}
  const voices = await ensureVoicesReady();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = pickVoice(voices, label);
  u.rate = 1; u.pitch = .95; u.volume = 1;
  synth.speak(u);
}

/** ---------- page ---------- */
type Turn = { role: 'assistant'|'user'; text: string; ts: number };

export default function VoiceAgentPage() {
  // minimal state
  const [apiKey, setApiKey] = useState('');
  const [phone, setPhone] = useState('');
  const [model, setModel] = useState<'gpt-4o'|'gpt-4o-mini'|'gpt-4.1'|'gpt-3.5-turbo'>('gpt-4o');
  const [firstMessage, setFirstMessage] = useState('Hello. How may I help you today?');
  const [voiceLabel, setVoiceLabel] = useState('Alloy (OpenAI)');
  const [systemPrompt, setSystemPrompt] = useState(BASE_PROMPT);

  // generate overlay
  const [genOpen, setGenOpen] = useState(false);
  const [genText, setGenText] = useState('');

  // call state
  const [live, setLive] = useState(false);
  const recRef = useRef<SR | null>(null);
  const [transcript, setTranscript] = useState<Turn[]>([]);

  // localStorage hydrate
  useEffect(() => {
    try {
      const k = localStorage.getItem('va:key'); if (k) setApiKey(JSON.parse(k));
      const p = localStorage.getItem('va:phone'); if (p) setPhone(JSON.parse(p));
      const m = localStorage.getItem('va:model'); if (m) setModel(JSON.parse(m));
      const f = localStorage.getItem('va:first'); if (f) setFirstMessage(JSON.parse(f));
      const s = localStorage.getItem('va:system'); if (s) setSystemPrompt(JSON.parse(s));
      const v = localStorage.getItem('va:voice'); if (v) setVoiceLabel(JSON.parse(v));
    } catch {}
  }, []);
  useEffect(() => { try { localStorage.setItem('va:key', JSON.stringify(apiKey)); } catch {} }, [apiKey]);
  useEffect(() => { try { localStorage.setItem('va:phone', JSON.stringify(phone)); } catch {} }, [phone]);
  useEffect(() => { try { localStorage.setItem('va:model', JSON.stringify(model)); } catch {} }, [model]);
  useEffect(() => { try { localStorage.setItem('va:first', JSON.stringify(firstMessage)); } catch {} }, [firstMessage]);
  useEffect(() => { try { localStorage.setItem('va:system', JSON.stringify(systemPrompt)); } catch {} }, [systemPrompt]);
  useEffect(() => { try { localStorage.setItem('va:voice', JSON.stringify(voiceLabel)); } catch {} }, [voiceLabel]);

  function push(role: 'assistant'|'user', text: string) {
    setTranscript(t => [...t, { role, text, ts: Date.now() }]);
  }

  async function askLLM(userText: string): Promise<string> {
    const r = await fetch('/api/va-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ model, system: systemPrompt, user: userText, key: apiKey }),
    });
    if (!r.ok) throw new Error('chat failed');
    const j = await r.json();
    return (j?.text || '').trim() || 'Understood.';
  }

  async function start() {
    // checks
    if (!apiKey) {
      const msg = 'Add your OpenAI API key first.';
      push('assistant', msg); await speak(msg, voiceLabel); return;
    }

    // greet
    push('assistant', firstMessage);
    await speak(firstMessage, voiceLabel);

    // SR
    const rec = makeRecognizer(async (finalText) => {
      push('user', finalText);
      try {
        const reply = await askLLM(finalText);
        push('assistant', reply);
        await speak(reply, voiceLabel);
      } catch {
        const msg = 'I could not reach the model. Check your OpenAI key.';
        push('assistant', msg);
        await speak(msg, voiceLabel);
      }
    });

    if (!rec) {
      const msg = 'Speech recognition not available in this browser.';
      push('assistant', msg);
      await speak(msg, voiceLabel);
      return;
    }
    recRef.current = rec;
    try { rec.start(); } catch {}
    setLive(true);
  }

  function stop() {
    const rec = recRef.current;
    if (rec) { (rec as any)._keep = false; try { rec.stop(); } catch {} }
    recRef.current = null;
    try { window.speechSynthesis.cancel(); } catch {}
    setLive(false);
  }

  function doGenerate() {
    const { prompt, firstMessage: fm } = mergePrompt(genText, systemPrompt || BASE_PROMPT);
    setSystemPrompt(prompt);
    if (fm) setFirstMessage(fm);
    setGenText('');
    setGenOpen(false);
  }

  return (
    <>
      <Head><title>Voice Agent</title></Head>
      <div style={{
        minHeight:'100vh', background:'#0b0c10', color:'#eef2f5',
        padding:'24px', display:'grid', gap:'24px', alignContent:'start'
      }}>
        {/* Top bar: call + copy prompt */}
        <div style={{ display:'flex', gap:12, justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:12 }}>
            {!live ? (
              <button onClick={start} style={btnGreen}><PhoneCall size={16} color="#fff"/><span style={{color:'#fff'}}>Start Web Call</span></button>
            ) : (
              <button onClick={stop} style={btnDanger}><PhoneOff size={16}/><span>End Call</span></button>
            )}
          </div>
          <div style={{ display:'flex', gap:12 }}>
            <button
              onClick={()=> navigator.clipboard.writeText(systemPrompt).catch(()=>{})}
              style={btnGhost}
            ><Copy size={16} color={ACCENT}/><span>Copy Prompt</span></button>
          </div>
        </div>

        {/* Settings card */}
        <div style={{ ...card, borderRadius:16, padding:16, boxShadow:'0 20px 60px rgba(0,0,0,.35)' }}>
          <div style={{ display:'grid', gap:16, gridTemplateColumns:'repeat(4, minmax(220px, 1fr))' }}>
            <Field label="OpenAI API Key">
              <input value={apiKey} onChange={e=>setApiKey(e.target.value)} placeholder="sk-..." style={inp}/>
            </Field>
            <Field label="Phone Number (E.164)">
              <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+1xxxxxxxxxx" style={inp}/>
            </Field>
            <Field label="Model">
              <select value={model} onChange={e=>setModel(e.target.value as any)} style={inp}>
                <option value="gpt-4o">GPT-4o</option>
                <option value="gpt-4o-mini">GPT-4o mini</option>
                <option value="gpt-4.1">GPT-4.1</option>
                <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
              </select>
            </Field>
            <Field label="First Message">
              <input value={firstMessage} onChange={e=>setFirstMessage(e.target.value)} style={inp}/>
            </Field>
          </div>

          {/* System prompt header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:16, marginBottom:8 }}>
            <div style={{ fontSize:14, fontWeight:600, display:'flex', alignItems:'center', gap:8, color:ACCENT }}>
              <Sparkles size={16} color={ACCENT}/> System Prompt
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=> setSystemPrompt(BASE_PROMPT)} style={btnGhost}><RefreshCw size={16} color={ACCENT}/>Reset</button>
              <button onClick={()=> setGenOpen(true)} style={btnGreen}><Sparkles size={16} color="#fff"/><span style={{color:'#fff'}}>Generate / Edit</span></button>
            </div>
          </div>

          <textarea
            rows={18}
            value={systemPrompt}
            onChange={(e)=> setSystemPrompt(e.target.value)}
            style={{
              ...inp, minHeight:340, lineHeight:'1.45', fontSize:14,
              fontFamily:'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
            }}
          />
        </div>

        {/* Transcript */}
        <div style={{ ...card, borderRadius:16, padding:16 }}>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:8, color:ACCENT }}>Transcript</div>
          {transcript.length === 0 && <div style={{ opacity:.7, fontSize:14 }}>No transcript yet.</div>}
          <div style={{ display:'grid', gap:8, maxHeight:360, overflowY:'auto' }}>
            {transcript.map((t, i) => (
              <div key={i} style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <div style={{
                  fontSize:11, padding:'2px 8px', borderRadius:999,
                  background: t.role==='assistant' ? 'rgba(16,185,129,.15)' : 'rgba(255,255,255,.06)',
                  border:'1px solid rgba(255,255,255,.12)'
                }}>{t.role==='assistant' ? 'AI' : 'You'}</div>
                <div style={{ fontSize:14 }}>{t.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Generate overlay */}
      {genOpen && (
        <div style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,.45)', display:'grid', placeItems:'center', zIndex:9999, padding:16
        }}>
          <div style={{ width:'100%', maxWidth:640, ...card, borderRadius:14, background:'#0f1315' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
              <div style={{ fontWeight:600, fontSize:14, display:'flex', gap:8, alignItems:'center', color:ACCENT }}><Sparkles size={16} color={ACCENT}/>Generate / Edit Prompt</div>
              <button onClick={()=> setGenOpen(false)} style={{ ...btnGhost, padding:'6px 10px' }}>Close</button>
            </div>
            <div style={{ padding:14 }}>
              <input
                value={genText}
                onChange={e=>setGenText(e.target.value)}
                placeholder={`Examples:
- assistant
- collect full name, phone, date
- [Identity] AI Sales Agent for roofers
- first message: Hey—quick question to get you booked…`}
                style={{ ...inp, minHeight:48 }}
              />
              <div style={{ display:'flex', justifyContent:'flex-end', gap:8, marginTop:12 }}>
                <button onClick={()=> setGenOpen(false)} style={btnGhost}>Cancel</button>
                <button onClick={doGenerate} style={btnGreen}><span style={{color:'#fff'}}>Generate</span></button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** ---------- tiny UI atoms ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'grid', gap:6 }}>
      <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
      {children}
    </label>
  );
}

const inp: React.CSSProperties = {
  width:'100%', borderRadius:12, padding:'12px 12px', background:'rgba(255,255,255,.03)',
  border:'1px solid rgba(255,255,255,.14)', outline:'none', color:'#eef2f5', fontSize:14,
  boxShadow:'inset 0 1px 0 rgba(255,255,255,.06)'
};

const btnBase: React.CSSProperties = {
  display:'inline-flex', alignItems:'center', gap:8, padding:'10px 14px', borderRadius:12,
  border:'1px solid rgba(255,255,255,.14)', background:'rgba(255,255,255,.03)', color:'#eef2f5',
  boxShadow:'0 12px 26px rgba(0,0,0,.35)', cursor:'pointer'
};
const btnGhost = btnBase;
const btnGreen: React.CSSProperties = { ...btnBase, background:ACCENT, borderColor:ACCENT, boxShadow:'0 10px 24px rgba(16,185,129,.22)' };
const btnDanger: React.CSSProperties = { ...btnBase, background:'rgba(220,38,38,.12)', color:'#fca5a5', borderColor:'rgba(220,38,38,.35)' };
