// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, PhoneOff, PhoneCall, Mic, MicOff } from 'lucide-react';

type State = 'idle' | 'connecting' | 'in-call' | 'ended' | 'error';

type Props = {
  model: string;
  systemPrompt: string;
  voiceName?: string;
  assistantName?: string;

  // Streaming transcript hooks (used by your VoiceAgentSection to mirror as chat)
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onAssistantText?: (text: string, isFinal: boolean) => void;

  // Lifecycle
  onStateChange?: (state: State, err?: string) => void;
  onClose?: () => void;
};

export default function WebCallButton({
  model,
  systemPrompt,
  voiceName = 'Alloy (American)',
  assistantName = 'Assistant',
  onUserTranscript,
  onAssistantText,
  onStateChange,
  onClose,
}: Props) {
  const [state, setState] = useState<State>('idle');
  const [muted, setMuted] = useState(false);
  const [err, setErr] = useState<string>('');

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const dataRef = useRef<RTCDataChannel | null>(null);

  // Optional: browser speech-rec as a fallback live-caption for the *user* side.
  const recoRef = useRef<SpeechRecognition | null>(null);

  const setAndEmit = (s: State, e?: string) => {
    setState(s);
    if (e) setErr(e);
    onStateChange?.(s, e);
  };

  const stopAll = async () => {
    try {
      dataRef.current?.close();
    } catch {}
    try {
      pcRef.current?.getSenders().forEach(s => s.track && s.track.stop());
      pcRef.current?.getReceivers().forEach(r => r.track && r.track.stop());
    } catch {}
    try {
      pcRef.current?.close();
    } catch {}
    pcRef.current = null;
    try {
      micStreamRef.current?.getTracks().forEach(t => t.stop());
    } catch {}
    micStreamRef.current = null;

    try {
      if (recoRef.current) {
        (recoRef.current as any).onresult = null;
        (recoRef.current as any).onend = null;
        (recoRef.current as any).onerror = null;
        recoRef.current.stop();
      }
    } catch {}
  };

  const startRecoFallback = () => {
    const SR: any = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec: SpeechRecognition = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (ev: SpeechRecognitionEvent) => {
      const res = ev.results[ev.results.length - 1];
      if (!res) return;
      const txt = res[0]?.transcript || '';
      onUserTranscript?.(txt, res.isFinal);
    };
    rec.onerror = () => {};
    rec.onend = () => {
      // try to keep it alive while in-call
      if (state === 'in-call') {
        try { rec.start(); } catch {}
      }
    };
    try { rec.start(); } catch {}
    recoRef.current = rec;
  };

  const startCall = async () => {
    setErr('');
    setAndEmit('connecting');

    try {
      // 1) Get mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;

      // 2) Create PC
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      // 3) Add mic track
      mic.getTracks().forEach(t => pc.addTrack(t, mic));

      // 4) Remote audio
      pc.ontrack = (ev) => {
        const [stream] = ev.streams;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = stream;
      };

      // 5) Data channel for realtime events
      const dc = pc.createDataChannel('oai-events');
      dataRef.current = dc;
      dc.onopen = () => {};
      dc.onmessage = (ev) => {
        // OpenAI Realtime sends JSON events over the data channel.
        // We’ll parse what we can; different releases may vary.
        try {
          const msg = JSON.parse(ev.data);
          // Examples (these names may evolve; we handle common cases):
          // {type:'transcript.delta', role:'user'|'assistant', text:'…', final:false}
          // {type:'response.output_text.delta', text:'…', final:false}
          const t = (msg?.text ?? msg?.delta ?? '').toString();
          const isFinal = !!msg?.final;

          if (!t) return;

          if (msg?.role === 'user' || msg?.type?.includes('transcript') && msg?.source === 'user') {
            onUserTranscript?.(t, isFinal);
          } else {
            onAssistantText?.(t, isFinal);
          }
        } catch {
          // ignore non-JSON frames
        }
      };

      // 6) Create offer
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      // 7) Get ephemeral token from your server
      const ephemRes = await fetch('/api/voice/ephemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          systemPrompt,
          voiceName,
          assistantName,
        }),
      });
      if (!ephemRes.ok) {
        const t = await ephemRes.text();
        throw new Error(`Failed to mint ephemeral token: ${t}`);
      }
      const ephem = await ephemRes.json();
      const token =
        ephem?.token ||
        ephem?.client_secret?.value || // some server examples return this shape
        '';

      if (!token) throw new Error('Missing ephemeral token');

      // 8) Exchange SDP with OpenAI Realtime over REST
      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/sdp',
          },
          body: offer.sdp,
        }
      );

      if (!sdpRes.ok) {
        const t = await sdpRes.text();
        throw new Error(`Realtime SDP exchange failed: ${t}`);
      }
      const answerSdp = await sdpRes.text();
      const answer = { type: 'answer' as const, sdp: answerSdp };
      await pc.setRemoteDescription(answer);

      // 9) Connected
      setAndEmit('in-call');
      startRecoFallback();
    } catch (e: any) {
      await stopAll();
      setAndEmit('error', e?.message || 'Failed to start call');
    }
  };

  const hangup = async () => {
    await stopAll();
    setAndEmit('ended');
    onClose?.();
  };

  const toggleMute = () => {
    const stream = micStreamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = !track.enabled;
    setMuted(!track.enabled);
  };

  // Auto-start when the panel mounts
  useEffect(() => {
    startCall();
    return () => {
      stopAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statusText = useMemo(() => {
    if (state === 'connecting') return 'Connecting…';
    if (state === 'in-call') return 'Live';
    if (state === 'ended') return 'Ended';
    if (state === 'error') return `Error: ${err || 'Unknown'}`;
    return 'Ready';
  }, [state, err]);

  return (
    <div
      className="fixed inset-y-0 right-0 w-[min(620px,92vw)] shadow-2xl"
      style={{
        background: 'var(--panel, #0d0f11)',
        borderLeft: '1px solid rgba(255,255,255,.1)',
        zIndex: 9997,
        display: 'grid',
        gridTemplateRows: 'auto 1fr auto',
      }}
      role="dialog"
      aria-label="Voice call"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 h-[64px]"
        style={{ borderBottom: '1px solid rgba(255,255,255,.1)', color: 'var(--text,#e6f1ef)' }}
      >
        <div className="flex items-center gap-3">
          <div className="font-semibold">{assistantName}</div>
          <div
            className="text-xs px-2 py-1 rounded"
            style={{
              background: 'rgba(89,217,179,.10)',
              border: '1px solid rgba(89,217,179,.22)',
            }}
          >
            {statusText}
          </div>
        </div>
        <button
          onClick={hangup}
          className="inline-flex items-center gap-2 px-3 h-9 rounded"
          style={{ border: '1px solid rgba(255,255,255,.12)' }}
          title="End call"
        >
          <PhoneOff className="w-4 h-4" />
          End
        </button>
      </div>

      {/* Body */}
      <div className="p-5">
        <div className="text-sm opacity-80 mb-2" style={{ color: 'var(--text,#e6f1ef)' }}>
          Model: {model} • Voice: {voiceName}
        </div>
        <audio ref={remoteAudioRef} autoPlay playsInline />
        {state === 'error' && (
          <div className="mt-3 text-sm" style={{ color: '#fca5a5' }}>
            {err}
          </div>
        )}
        {state !== 'error' && (
          <div className="mt-3 text-xs opacity-70" style={{ color: 'var(--text,#e6f1ef)' }}>
            You’re on a live web call. Your microphone audio is sent to the model and the model’s
            voice plays back here. Transcripts stream to your UI via the provided callbacks.
          </div>
        )}
      </div>

      {/* Footer controls */}
      <div
        className="p-4 flex items-center justify-between gap-3"
        style={{ borderTop: '1px solid rgba(255,255,255,.1)' }}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="inline-flex items-center gap-2 px-3 h-10 rounded font-medium"
            style={{
              color: 'var(--text,#e6f1ef)',
              border: '1px solid rgba(255,255,255,.12)',
              background: 'var(--panel,#0d0f11)',
            }}
            title={muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />} {muted ? 'Unmute' : 'Mute'}
          </button>

          <button
            onClick={startCall}
            disabled={state === 'connecting' || state === 'in-call'}
            className="inline-flex items-center gap-2 px-3 h-10 rounded font-semibold"
            style={{
              background: state === 'in-call' ? 'rgba(89,217,179,.35)' : '#59d9b3',
              color: '#0a0f0d',
              opacity: state === 'in-call' ? 0.7 : 1,
            }}
            title="Start call"
          >
            <PhoneCall className="w-4 h-4" />
            {state === 'in-call' ? 'Live' : 'Start'}
          </button>
        </div>

        <button
          onClick={() => {
            hangup();
            onClose?.();
          }}
          className="inline-flex items-center gap-2 px-3 h-10 rounded"
          style={{ border: '1px solid rgba(255,255,255,.12)', color: 'var(--text,#e6f1ef)' }}
        >
          <X className="w-4 h-4" />
          Close
        </button>
      </div>
    </div>
  );
}
