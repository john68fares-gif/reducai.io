// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, MessageSquare } from 'lucide-react';

type Props = {
  model: string;
  systemPrompt: string;
  voiceName: string;
  assistantName: string;
  apiKey: string;            // <- from your dropdown (selected key value)
  onClose?: () => void;
};

type TranscriptRow = {
  id: string;
  who: 'user' | 'assistant';
  text: string;
  done?: boolean;
};

const CTA = '#59d9b3';

export default function WebCallButton({
  model,
  systemPrompt,
  voiceName,
  assistantName,
  apiKey,
  onClose,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const [log, setLog] = useState<TranscriptRow[]>([]);

  // Map "nice" voice name to OpenAI voice id
  const voiceId = useMemo(() => {
    const v = (voiceName || '').toLowerCase();
    if (v.includes('alloy')) return 'alloy';
    if (v.includes('verse')) return 'verse';
    if (v.includes('coral')) return 'coral';
    if (v.includes('amber')) return 'amber';
    return 'alloy';
  }, [voiceName]);

  // Helpers to add/patch transcript lines
  const upsertRow = (id: string, who: TranscriptRow['who'], patch: Partial<TranscriptRow>) => {
    setLog((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      if (i === -1) {
        return [...prev, { id, who, text: patch.text ?? '', done: !!patch.done }];
      }
      const next = [...prev];
      next[i] = { ...next[i], ...patch };
      return next;
    });
  };

  const addLine = (who: TranscriptRow['who'], text: string) => {
    const id = `${who}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLog((prev) => [...prev, { id, who, text, done: true }]);
  };

  async function startCall() {
    setError('');
    if (!apiKey) {
      setError('No API key selected. Choose one in the dropdown.');
      return;
    }

    try {
      setConnecting(true);

      // 1) Ask our server to mint an ephemeral session from the *selected* user key
      const sessionRes = await fetch('/api/voice/ephemeral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OpenAI-Key': apiKey, // <- passes the selected key securely to your route
        },
        body: JSON.stringify({
          model,
          voiceName,
          assistantName,
          systemPrompt,
        }),
      });

      if (!sessionRes.ok) {
        const t = await sessionRes.text();
        throw new Error(`Ephemeral token error: ${t}`);
      }
      const session = await sessionRes.json();
      const EPHEMERAL = session?.client_secret?.value;
      if (!EPHEMERAL) throw new Error('Missing ephemeral client_secret.value');

      // 2) Prepare local microphone stream
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;

      // 3) Create RTCPeerConnection and hook up audio
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // Remote audio sink
      const remote = new MediaStream();
      if (audioRef.current) {
        audioRef.current.srcObject = remote;
        // On Safari you usually need a user gesture before play; we try anyway:
        audioRef.current.play().catch(() => {/* ignored */});
      }

      pc.ontrack = (e) => {
        e.streams[0]?.getAudioTracks().forEach((t) => remote.addTrack(t));
      };

      // We want to *send* mic and *receive* assistant audio
      const sendTrack = mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // 4) Data channel for events (transcripts, etc.)
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        // Provide session params (instructions/voice) as a runtime update too.
        const sessionUpdate = {
          type: 'session.update',
          session: {
            instructions: systemPrompt || '',
            voice: voiceId,
            input_audio_format: { type: 'input_audio_format', audio_format: 'pcm16' },
            output_audio_format: { type: 'output_audio_format', audio_format: 'pcm16' },
          },
        };
        safeSend(dc, sessionUpdate);
      };

      // Handle realtime messages
      dc.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const t = msg?.type as string;

          // assistant text as it streams
          if (t === 'response.output_text.delta') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            const delta = msg?.delta || '';
            upsertRow(id, 'assistant', (prev => ({ text: (prev?.text || '') + String(delta) })) as any);
          }
          if (t === 'response.completed' || t === 'response.stop') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            upsertRow(id, 'assistant', { done: true });
          }

          // user transcript (depending on model, may send transcript.* events)
          if (t === 'transcript.delta') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            const delta = msg?.delta || '';
            upsertRow(id, 'user', (prev => ({ text: (prev?.text || '') + String(delta) })) as any);
          }
          if (t === 'transcript.completed') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            upsertRow(id, 'user', { done: true });
          }

          // Fallback: some payloads deliver text blocks differently
          if (t === 'response.output_text' && typeof msg?.text === 'string') {
            addLine('assistant', msg.text);
          }
        } catch {
          // Non-JSON or unknown message; ignore
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') {
          setConnected(true);
          setConnecting(false);
        } else if (['disconnected', 'failed', 'closed'].includes(pc.connectionState)) {
          endCall(false);
        }
      };

      // 5) Create SDP offer and send it to OpenAI Realtime
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const baseUrl = 'https://api.openai.com/v1/realtime';
      const url = `${baseUrl}?model=${encodeURIComponent(model || 'gpt-4o-realtime-preview')}`;

      const answerRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${EPHEMERAL}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offer.sdp,
      });

      if (!answerRes.ok) {
        const txt = await answerRes.text();
        throw new Error(`Realtime SDP failed: ${txt}`);
      }

      const answer = {
        type: 'answer' as RTCSdpType,
        sdp: await answerRes.text(),
      };
      await pc.setRemoteDescription(answer);

      // On iOS mobile, call play() after a user gesture (we already attempted above)
      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(() => {/* user gesture required */});
      }
    } catch (e: any) {
      setConnecting(false);
      setConnected(false);
      setError(e?.message || 'Failed to start call.');
      cleanup();
    }
  }

  function safeSend(dc: RTCDataChannel | null, payload: any) {
    if (!dc || dc.readyState !== 'open') return;
    try { dc.send(JSON.stringify(payload)); } catch {/* noop */}
  }

  function toggleMute() {
    const tracks = micStreamRef.current?.getAudioTracks() || [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  function cleanup() {
    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;

    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;

    try {
      micStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    micStreamRef.current = null;
  }

  function endCall(userIntent = true) {
    cleanup();
    setConnected(false);
    setConnecting(false);
    if (userIntent) onClose?.();
  }

  useEffect(() => {
    // Auto-connect when this panel mounts
    startCall();

    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 w-[min(640px,92vw)] rounded-2xl overflow-hidden"
      style={{ zIndex: 9999, border: '1px solid rgba(255,255,255,.12)', background: '#0d0f11', boxShadow: '0 24px 80px rgba(0,0,0,.6)' }}
      role="dialog"
      aria-label="Voice call panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3"
           style={{ borderBottom: '1px solid rgba(255,255,255,.10)', background: 'linear-gradient(90deg, #0d0f11 0%, rgba(255,255,255,.04) 50%, #0d0f11 100%)' }}>
        <div className="min-w-0">
          <div className="text-sm opacity-80">Talking to</div>
          <div className="font-semibold truncate">{assistantName || 'Assistant'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="h-9 w-9 rounded-full grid place-items-center"
            style={{ border: '1px solid rgba(255,255,255,.14)', background: muted ? 'rgba(239,68,68,.16)' : 'transparent', color: '#e6f1ef' }}
            title={muted ? 'Unmute mic' : 'Mute mic'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          <button
            onClick={() => endCall(true)}
            className="h-9 px-3 rounded-full font-semibold"
            style={{ background: 'rgba(239,68,68,.18)', border: '1px solid rgba(239,68,68,.38)', color: '#ffd7d7' }}
            title="End call"
          >
            <span className="inline-flex items-center gap-2"><PhoneOff className="w-4 h-4" /> End</span>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="grid grid-cols-[1fr] sm:grid-cols-[1.1fr_.9fr] gap-0">
        {/* Transcript */}
        <div className="p-3 sm:p-4" style={{ borderRight: '1px solid rgba(255,255,255,.10)' }}>
          <div className="flex items-center gap-2 text-sm mb-2 opacity-80">
            <MessageSquare className="w-4 h-4" /> Live transcript
          </div>
          <div className="h-[42vh] sm:h-[48vh] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
            {log.length === 0 && (
              <div className="text-sm opacity-70">
                {connecting ? 'Connecting to voice…' : 'Say hello! We’ll show the transcript here.'}
              </div>
            )}
            <div className="flex flex-col gap-2">
              {log.map((row) => (
                <div key={row.id} className="max-w-[95%]"
                     style={{ alignSelf: row.who === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div className="text-[11px] mb-1 opacity-70" style={{ textAlign: row.who === 'user' ? 'right' : 'left' }}>
                    {row.who === 'user' ? 'You' : (assistantName || 'Assistant')}
                  </div>
                  <div
                    className="px-3 py-2 rounded-xl text-sm"
                    style={{
                      background: row.who === 'user' ? 'rgba(255,255,255,.06)' : 'rgba(89,217,179,.10)',
                      border: `1px solid ${row.who === 'user' ? 'rgba(255,255,255,.12)' : 'rgba(89,217,179,.22)'}`,
                      color: '#e6f1ef'
                    }}
                  >
                    {row.text || <span className="opacity-50">…</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && (
            <div className="mt-3 text-xs px-3 py-2 rounded-lg"
                 style={{ background: 'rgba(239,68,68,.12)', border: '1px solid rgba(239,68,68,.25)', color: '#ffd7d7' }}>
              {error}
            </div>
          )}
        </div>

        {/* Status + audio element */}
        <div className="p-4 grid content-center">
          <div className="mx-auto w-full max-w-[320px] text-center">
            <div
              className="mx-auto rounded-2xl px-4 py-6"
              style={{ background: 'rgba(89,217,179,.08)', border: '1px solid rgba(89,217,179,.22)' }}
            >
              <div className="text-sm opacity-80 mb-1">Status</div>
              <div className="font-semibold mb-3" style={{ color: connected ? CTA : '#e6f1ef' }}>
                {connected ? 'Connected' : (connecting ? 'Connecting…' : 'Idle')}
              </div>
              <div className="flex items-center justify-center gap-2">
                {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span className="text-xs opacity-70">
                  {muted ? 'Mic muted' : 'Mic live'} • Model: {model || 'gpt-4o-realtime-preview'}
                </span>
              </div>
            </div>

            {/* Hidden audio sink (auto plays assistant voice) */}
            <audio ref={audioRef} autoPlay playsInline />
          </div>
        </div>
      </div>
    </div>
  );
}
