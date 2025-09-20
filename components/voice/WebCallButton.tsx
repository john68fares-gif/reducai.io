// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  model: string;
  systemPrompt: string;
  voiceName: string;
  assistantName: string;
  onClose?: () => void;

  // NEW: live transcript callbacks
  onUserTranscript?: (text: string, isFinal: boolean) => void;
  onAssistantText?: (text: string, isFinal: boolean) => void;
  onStateChange?: (state: 'idle'|'connecting'|'connected'|'error', errMsg?: string) => void;
};

export default function WebCallButton({
  model,
  systemPrompt,
  voiceName,
  assistantName,
  onClose,
  onUserTranscript,
  onAssistantText,
  onStateChange,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);

  // Buffers for partial streaming
  const userBufRef = useRef<string>('');
  const aiBufRef = useRef<string>('');

  function bumpState(s: 'idle'|'connecting'|'connected'|'error', msg?: string) {
    onStateChange?.(s, msg);
  }

  async function startCall() {
    setError('');
    setConnecting(true);
    bumpState('connecting');

    try {
      // 1) get ephemeral token from your backend
      const tokenRes = await fetch('/api/voice/ephemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voiceName, systemPrompt }),
      });
      const { token, error: tokenErr } = await tokenRes.json();
      if (!tokenRes.ok || !token) throw new Error(tokenErr || 'Failed to get ephemeral token');

      // 2) mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;

      // 3) peer connection
      const pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }] });
      pcRef.current = pc;

      // remote audio sink
      const remote = new MediaStream();
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remote;
        remoteAudioRef.current.play().catch(()=>{});
      }
      pc.ontrack = (e) => {
        e.streams[0]?.getAudioTracks().forEach(() => remote.addTrack(e.track));
      };

      // send mic
      mic.getAudioTracks().forEach((t) => pc.addTrack(t, mic));
      // request audio from model
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // data channel to receive events (transcripts, deltas, etc.)
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onmessage = (e) => {
        // Try to parse JSON event
        let ev: any = null;
        try { ev = JSON.parse(String(e.data)); } catch { /* ignore non-json */ }

        if (!ev || !ev.type) return;

        // These event names cover the common Realtime payloads.
        // Different previews may vary slightly; we handle broadly.
        switch (ev.type) {
          // USER (ASR) streaming text
          case 'input_audio_buffer.transcript.delta':
          case 'transcript.delta': {
            userBufRef.current += ev.delta || ev.text || '';
            onUserTranscript?.(userBufRef.current, false);
            break;
          }
          case 'input_audio_buffer.transcript.completed':
          case 'transcript.completed': {
            onUserTranscript?.(userBufRef.current, true);
            userBufRef.current = '';
            break;
          }

          // ASSISTANT text streaming
          case 'response.output_text.delta':
          case 'response.delta': {
            aiBufRef.current += ev.delta || ev.text || '';
            onAssistantText?.(aiBufRef.current, false);
            break;
          }
          case 'response.completed':
          case 'response.output_text.completed': {
            onAssistantText?.(aiBufRef.current, true);
            aiBufRef.current = '';
            break;
          }

          default: {
            // console.debug('rt event', ev.type, ev);
          }
        }
      };

      // 4) SDP offer/answer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(
        `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model || 'gpt-4o-realtime-preview')}`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/sdp' },
          body: offer.sdp!,
        }
      );
      if (!sdpRes.ok) throw new Error(`SDP exchange failed: ${await sdpRes.text()}`);
      const answerSdp = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

      // 5) have the assistant greet
      const greet = {
        type: 'response.create',
        response: {
          modalities: ['audio'],
          instructions: `You are ${assistantName}. Be concise and friendly.\n${systemPrompt || ''}`,
        },
      };
      const maybeSend = () => dc.readyState === 'open' && dc.send(JSON.stringify(greet));
      if (dc.readyState === 'open') maybeSend();
      else {
        const iv = setInterval(() => {
          if (dc.readyState === 'open') { clearInterval(iv); maybeSend(); }
        }, 120);
        setTimeout(() => clearInterval(iv), 3000);
      }

      setConnecting(false);
      setConnected(true);
      bumpState('connected');
    } catch (e: any) {
      const msg = e?.message || 'Call failed';
      setError(msg);
      setConnecting(false);
      setConnected(false);
      bumpState('error', msg);
      stopCall(true);
    }
  }

  function stopCall(silent?: boolean) {
    try { dcRef.current?.close(); } catch {}
    try { pcRef.current?.close(); } catch {}
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch {}
    dcRef.current = null; pcRef.current = null; micStreamRef.current = null;
    setConnected(false);
    if (!silent) bumpState('idle');
  }

  useEffect(() => () => stopCall(true), []);

  return (
    <aside
      className="fixed inset-y-0 right-0"
      style={{
        zIndex: 9997, width: 'min(620px,92vw)',
        background:'var(--panel-bg,#0d0f11)', borderLeft:'1px solid rgba(255,255,255,.10)',
        boxShadow:'-28px 0 80px rgba(0,0,0,.55)', display:'grid', gridTemplateRows:'auto auto'
      }}
    >
      <div className="flex items-center justify-between px-4 h-[64px]"
           style={{ borderBottom:'1px solid rgba(255,255,255,.1)', color:'var(--text,#e6f1ef)' }}>
        <div className="font-semibold">Live call with {assistantName || 'Assistant'}</div>
        <div className="flex items-center gap-2">
          <button
            onClick={connected ? () => stopCall() : startCall}
            className="px-3 h-[34px] rounded text-sm font-semibold"
            style={{
              background: connected ? 'rgba(239,68,68,.85)' : '#59d9b3',
              color: connected ? '#fff' : '#0a0f0d',
              border: '1px solid rgba(255,255,255,.10)',
            }}
          >
            {connecting ? 'Connecting…' : connected ? 'Hang up' : 'Start call'}
          </button>
          <button
            onClick={() => { stopCall(true); onClose?.(); }}
            className="px-3 h-[34px] rounded border text-sm"
            style={{ borderColor:'rgba(255,255,255,.15)', color:'var(--text,#e6f1ef)', background:'transparent' }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Hidden but playing remote audio */}
      <audio ref={remoteAudioRef} autoPlay playsInline />
    </aside>
  );
}
