// components/voice/WebCallButton.tsx
'use client';

import React, { useState, useRef } from 'react';
import { Phone, PhoneOff, Loader2 } from 'lucide-react';

type Props = {
  agentId: string;
  agent: {
    name: string;
    systemPrompt: string;
    model: string;
    voiceName: string;
    apiKeyId?: string;
  };
};

export default function WebCallButton({ agentId, agent }: Props) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  async function startCall() {
    try {
      setLoading(true);

      // ask backend for ephemeral session
      const r = await fetch('/api/voice/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      const { client_secret } = await r.json();
      if (!client_secret) throw new Error('No session secret');

      // setup WebRTC peer connection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // play remote audio
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      pc.ontrack = (e) => { audioEl.srcObject = e.streams[0]; };

      // mic input
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // datachannel for control/debug
      pc.createDataChannel('oai-events');

      // offer → Realtime API
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const resp = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${client_secret}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
      });

      const answer = {
        type: 'answer',
        sdp: await resp.text(),
      } as RTCSessionDescriptionInit;

      await pc.setRemoteDescription(answer);

      setActive(true);
    } catch (e) {
      console.error('WebCall failed:', e);
    } finally {
      setLoading(false);
    }
  }

  function endCall() {
    pcRef.current?.close();
    pcRef.current = null;
    setActive(false);
  }

  return (
    <button
      disabled={loading}
      onClick={active ? endCall : startCall}
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold ${
        active ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
      }`}
    >
      {loading ? (
        <Loader2 className="animate-spin w-4 h-4" />
      ) : active ? (
        <PhoneOff className="w-4 h-4" />
      ) : (
        <Phone className="w-4 h-4" />
      )}
      {active ? 'End Call' : `Call ${agent.name || 'Assistant'}`}
    </button>
  );
}
