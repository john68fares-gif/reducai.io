'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, Square, Play, X, Loader2 } from 'lucide-react';

type Msg = { role: 'user' | 'assistant' | 'system'; content: string };

export default function WebCallButton({
  model,
  systemPrompt,
  voiceName,
  apiKey,               // pass the actual key (or fetch server-side token if you prefer)
  assistantName = 'Assistant',
  onClose,
}: {
  model: string;
  systemPrompt: string;
  voiceName: string;
  apiKey: string;
  assistantName?: string;
  onClose: () => void;
}) {
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState<'none'|'transcribe'|'reply'>('none');
  const [error, setError] = useState<string>('');
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'system', content: systemPrompt },
    { role: 'assistant', content: `Hi! I’m ${assistantName}. How can I help?` },
  ]);

  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // TTS (use selected voice if available)
  const voices = typeof window !== 'undefined' && 'speechSynthesis' in window
    ? window.speechSynthesis.getVoices()
    : [];
  const ttsVoice = useMemo(() => {
    const candidates = voices.filter(v => v.name.toLowerCase().includes((voiceName||'').split(' ')[0]?.toLowerCase()||''));
    return candidates[0] || voices.find(v => v.lang?.startsWith('en')) || null;
  }, [voices, voiceName]);

  function speak(text: string) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    const u = new SpeechSynthesisUtterance(text);
    if (ttsVoice) u.voice = ttsVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  }

  // refresh voices (Chrome async quirk)
  useEffect(() => {
    if (!('speechSynthesis' in window)) return;
    const fn = () => { /* trigger re-render by state swap if needed */ };
    (window.speechSynthesis as any).onvoiceschanged = fn;
    return () => { (window.speechSynthesis as any).onvoiceschanged = null; };
  }, []);

  async function startRec() {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = handleStop;
      mr.start();
      mediaRecRef.current = mr;
      setRecording(true);
    } catch (e:any) {
      setError(e?.message || 'Microphone permission denied.');
    }
  }

  function stopRec() {
    mediaRecRef.current?.stop();
    mediaRecRef.current?.stream.getTracks().forEach(t => t.stop());
    setRecording(false);
  }

  async function handleStop() {
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    chunksRef.current = [];

    // 1) Transcribe
    setLoading('transcribe');
    const fd = new FormData();
    fd.append('audio', blob, 'audio.webm');
    try {
      const tr = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'x-openai-key': apiKey },
        body: fd
      });
      if (!tr.ok) throw new Error('Transcription failed');
      const { text } = await tr.json();
      if (!text || !text.trim()) { setLoading('none'); return; }

      // push user msg
      setMsgs(m => [...m, { role: 'user', content: text }]);

      // 2) Ask assistant
      setLoading('reply');
      const rr = await fetch('/api/voice/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-openai-key': apiKey
        },
        body: JSON.stringify({
          model,
          systemPrompt,
          messages: [...msgs.filter(m => m.role !== 'system'), { role: 'user', content: text }]
        })
      });
      if (!rr.ok) throw new Error('Reply failed');
      const { reply } = await rr.json();

      // push assistant msg + speak
      setMsgs(m => [...m, { role: 'assistant', content: reply }]);
      speak(reply);
      setLoading('none');
    } catch (e:any) {
      setLoading('none');
      setError(e?.message || 'Something went wrong.');
    }
  }

  return (
    <aside
      className="fixed inset-y-0 right-0"
      style={{
        zIndex: 9997,
        width: 'min(560px,92vw)',
        background:'var(--panel-bg)',
        borderLeft:'1px solid rgba(255,255,255,.10)',
        boxShadow:'-28px 0 80px rgba(0,0,0,.55)',
        display:'grid', gridTemplateRows:'auto 1fr auto'
      }}
      aria-label="Voice chat"
    >
      <div className="flex items-center justify-between px-4 h-[64px]"
           style={{ background:'var(--panel-bg)', borderBottom:'1px solid rgba(255,255,255,.1)' }}>
        <div className="font-semibold">Chat with {assistantName}</div>
        <button onClick={onClose} className="px-2 py-1 rounded border"
                style={{ color:'var(--text)', borderColor:'var(--input-border)', background:'var(--panel-bg)' }}>
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto flex flex-col gap-3">
        {msgs.filter(m => m.role !== 'system').map((m, i) => (
          <div key={i}
               style={{
                 alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                 background: m.role === 'user' ? 'rgba(89,217,179,.12)' : 'rgba(255,255,255,.06)',
                 border: '1px solid rgba(255,255,255,.10)',
                 padding: '10px 12px',
                 borderRadius: 12,
                 maxWidth: '82%'
               }}>
            <div style={{ fontSize: 11, opacity: .65, marginBottom: 4 }}>
              {m.role === 'user' ? 'You' : assistantName}
            </div>
            <div>{m.content}</div>
          </div>
        ))}
        {loading !== 'none' && (
          <div style={{ opacity:.8, fontSize:13, display:'inline-flex', alignItems:'center', gap:8 }}>
            <Loader2 className="w-4 h-4 animate-spin" /> {loading === 'transcribe' ? 'Transcribing…' : 'Thinking…'}
          </div>
        )}
        {error && <div style={{ color:'#ef4444', fontSize:13 }}>{error}</div>}
      </div>

      <div className="p-3" style={{ borderTop:'1px solid rgba(255,255,255,.10)' }}>
        <div className="flex items-center gap-2">
          {!recording ? (
            <button onClick={startRec} className="h-11 px-4 rounded-md font-semibold inline-flex items-center gap-2"
                    style={{ background:'var(--panel-bg)', border:'1px solid var(--input-border)', color:'var(--text)' }}>
              <Mic className="w-4 h-4" /> Hold to speak
            </button>
          ) : (
            <button onClick={stopRec} className="h-11 px-4 rounded-md font-semibold inline-flex items-center gap-2"
                    style={{ background:'rgba(239,68,68,.15)', border:'1px solid rgba(239,68,68,.35)', color:'#ffdddd' }}>
              <Square className="w-4 h-4" /> Stop
            </button>
          )}
          <div style={{ fontSize:12, opacity:.7 }}>
            Model: {model} • Voice: {voiceName}
          </div>
        </div>
      </div>
    </aside>
  );
}
