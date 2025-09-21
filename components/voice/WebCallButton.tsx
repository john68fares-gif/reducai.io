// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, MessageSquare } from 'lucide-react';

type Props = {
  model: string;
  systemPrompt: string;
  voiceName: string;          // Friendly label (e.g., "Breeze", "Orion", "Nova"...)
  assistantName: string;
  apiKey: string;
  onClose?: () => void;

  // Conversation boot config
  firstMode?: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg?: string;          // You can provide multiple, separated by "|" or newlines
  languageHint?: 'auto' | 'en' | 'de' | 'nl' | 'es' | 'ar';

  // Optional audio realism flags (you can surface later in UI)
  phoneFilter?: boolean;      // default true
  farMic?: boolean;           // default true — adds small room “distance”
  ambience?: 'off' | 'kitchen' | 'cafe'; // default 'off'
  ambienceLevel?: number;     // 0..1 (default .12)

  // NEW, non-breaking (have defaults)
  bargeIn?: boolean;          // default true — stop speaking when caller talks
  minSilenceMs?: number;      // default 1600 — wait this long of silence before assistant speaks first
  farMicAmount?: number;      // 0..1 wet mix (default 0.08 — very light)
};

type TranscriptRow = {
  id: string;
  who: 'user' | 'assistant';
  text: string;
  done?: boolean;
};

const CTA = '#59d9b3';

/* ───────── Voices (distinct timbres; no accent labels) ───────── */
const VOICE_DISPLAY_TO_ID: Record<string, string> = {
  // smooth/neutral
  'Breeze': 'alloy',
  'Orion':  'alloy',
  // warm/approachable
  'Nova':   'verse',
  'Flow':   'verse',
  // crisp/precise
  'Terra':  'coral',
  'Aster':  'coral',
  // bright/energetic
  'Maya':   'amber',
  'Kai':    'amber',

  // fallbacks
  'Alloy':  'alloy',
  'Verse':  'verse',
  'Coral':  'coral',
  'Amber':  'amber',
};

/* ───────── Humanization content ───────── */
const BACKCHANNEL_LINES = [
  "Let me check that for you…",
  "One moment—checking.",
  "Okay, give me a sec…",
  "Sure, I’m on it.",
  "Alright, looking that up…",
  "Just a second…",
  "Got it—let me pull that up.",
  "Mm-hmm… checking now.",
  "Okay… one sec…",
];

const THINKING_FILLERS = ["hmm…", "uh…", "let’s see…", "right…", "okay…"];

const BACKCHANNEL_PROB = 0.22;
const BACKCHANNEL_COOLDOWN_MS = 4500;

// tiny pause after user stops talking (just for acks)
const THINKING_PAUSE_MS = [220, 380, 540, 760];

/* ───────── Tiny utils ───────── */
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp01(v:number){ return Math.max(0, Math.min(1, v)); }

/* ───────── WebAudio builders ───────── */
// small-room impulse (for very light “far mic”)
function makeImpulseResponse(ac: AudioContext, duration=0.09, decay=1.6) {
  const rate = ac.sampleRate;
  const length = Math.round(rate * duration);
  const ir = ac.createBuffer(2, length, rate);
  for (let ch=0; ch<2; ch++){
    const data = ir.getChannelData(ch);
    for (let i=0;i<length;i++){
      const t = i/length;
      data[i] = (Math.random()*2-1) * Math.pow(1 - t, decay) * 0.35; // light tail
    }
  }
  return ir;
}

// colored-noise ambience (kitchen/cafe)
function createAmbience(ac: AudioContext, kind: 'kitchen'|'cafe', level = 0.12) {
  const noise = ac.createBufferSource();
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let prev = 0;
  for (let i=0;i<len;i++){
    const white = Math.random()*2-1;
    prev = prev*0.97 + white*0.03; // pink-ish
    data[i] = prev;
  }
  noise.buffer = buf;
  noise.loop = true;

  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = kind === 'kitchen' ? 950 : 350;
  band.Q.value = kind === 'kitchen' ? 0.9 : 0.6;

  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 120;

  const gain = ac.createGain();
  gain.gain.value = clamp01(level) * 0.35; // conservative

  noise.connect(band); band.connect(hp); hp.connect(gain); gain.connect(ac.destination);
  noise.start();

  return () => { try{noise.stop()}catch{}; try{noise.disconnect()}catch{}; try{band.disconnect()}catch{}; try{hp.disconnect()}catch{}; try{gain.disconnect()}catch{}; };
}

/* ───────── Component ───────── */
export default function WebCallButton({
  model,
  systemPrompt,
  voiceName,
  assistantName,
  apiKey,
  onClose,
  firstMode = 'Assistant speaks first',
  firstMsg = 'Hello.',
  languageHint = 'auto',
  phoneFilter = true,
  farMic = true,
  ambience = 'off',
  ambienceLevel = 0.12,
  bargeIn = true,
  minSilenceMs = 1600,
  farMicAmount = 0.08, // very light by default
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  // WebAudio “phone call” chain
  const acRef = useRef<AudioContext | null>(null);
  const phoneChainCleanupRef = useRef<(() => void) | null>(null);
  const ambienceCleanupRef = useRef<(() => void) | null>(null);

  // simple mic VAD for barge-in / silence detection
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const vadLoopRef = useRef<number | null>(null);
  const lastMicActiveAtRef = useRef<number>(0);

  const [log, setLog] = useState<TranscriptRow[]>([]);
  const lastBackchannelAtRef = useRef<number>(0);

  // Map friendly voice name -> OpenAI voice id
  const voiceId = useMemo(() => {
    const key = (voiceName || '').trim();
    if (VOICE_DISPLAY_TO_ID[key]) return VOICE_DISPLAY_TO_ID[key];
    const lower = key.toLowerCase();
    const found = Object.keys(VOICE_DISPLAY_TO_ID).find(k => lower.includes(k.toLowerCase()));
    return found ? VOICE_DISPLAY_TO_ID[found] : 'alloy';
  }, [voiceName]);

  // Helpers to add/patch transcript lines
  const upsertRow = (id: string, who: TranscriptRow['who'], patch: Partial<TranscriptRow> | ((prev?: TranscriptRow)=>Partial<TranscriptRow>)) => {
    setLog((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      if (i === -1) {
        const base: TranscriptRow = { id, who, text: '', done: false };
        const p = typeof patch === 'function' ? patch(undefined) : patch;
        return [...prev, { ...base, ...p }];
      }
      const next = [...prev];
      const p = typeof patch === 'function' ? patch(next[i]) : patch;
      next[i] = { ...next[i], ...p };
      return next;
    });
  };

  const addLine = (who: TranscriptRow['who'], text: string) => {
    const id = `${who}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLog((prev) => [...prev, { id, who, text, done: true }]);
  };

  // safely send JSON on DC
  function safeSend(dc: RTCDataChannel | null, payload: any) {
    if (!dc || dc.readyState !== 'open') return;
    try { dc.send(JSON.stringify(payload)); } catch {/* noop */}
  }

  function languageNudge() {
    if (languageHint === 'auto') {
      return 'Auto-detect and reply in the user’s language (English, German, Dutch, Spanish, or Arabic).';
    }
    const map: Record<string, string> = {
      en: 'Respond in English.',
      de: 'Antworte auf Deutsch.',
      nl: 'Antwoord in het Nederlands.',
      es: 'Responde en español.',
      ar: 'يرجى الرد باللغة العربية.',
    };
    return map[languageHint] || '';
  }

  /* ───────── Phone / far-mic processing with *parallel* wet/dry ───────── */
  async function attachPhoneAudio(remoteStream: MediaStream) {
    if (!phoneFilter) {
      if (audioRef.current) {
        audioRef.current.srcObject = remoteStream;
        await audioRef.current.play().catch(() => {});
      }
      phoneChainCleanupRef.current = null;
      return;
    }

    try {
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ac = new AC();
      acRef.current = ac;

      // optional ambience
      if (ambience !== 'off') {
        ambienceCleanupRef.current = createAmbience(ac, ambience as ('kitchen'|'cafe'), ambienceLevel);
      }

      const src = ac.createMediaStreamSource(remoteStream);

      // band-limit like a phone speaker but not too harsh
      const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 260;
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 3600;

      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 18; comp.ratio.value = 2.4; comp.attack.value = 0.006; comp.release.value = 0.22;

      // parallel wet/dry for subtle distance (VERY low wet gain by default)
      const convolver = ac.createConvolver();
      convolver.buffer = makeImpulseResponse(ac, 0.08, 1.6);

      const dryGain = ac.createGain(); dryGain.gain.value = 1.0;
      const wetGain = ac.createGain(); wetGain.gain.value = farMic ? clamp01(farMicAmount) * 0.6 : 0.0;

      const merger = ac.createChannelMerger(2);
      const master = ac.createGain(); master.gain.value = 1.0;

      const dest = ac.createMediaStreamDestination();

      // chain (src -> hp -> lp -> comp -> [dry,wet] -> merger -> master -> dest)
      src.connect(hp); hp.connect(lp); lp.connect(comp);
      comp.connect(dryGain); dryGain.connect(merger, 0, 0);
      comp.connect(convolver); convolver.connect(wetGain); wetGain.connect(merger, 0, 0);
      merger.connect(master);
      master.connect(dest);

      if (audioRef.current) {
        audioRef.current.srcObject = dest.stream;
        await audioRef.current.play().catch(() => {/* iOS needs gesture */});
      }

      phoneChainCleanupRef.current = () => {
        try { src.disconnect(); } catch {}
        try { hp.disconnect(); } catch {}
        try { lp.disconnect(); } catch {}
        try { comp.disconnect(); } catch {}
        try { convolver.disconnect(); } catch {}
        try { dryGain.disconnect(); } catch {}
        try { wetGain.disconnect(); } catch {}
        try { merger.disconnect(); } catch {}
        try { master.disconnect(); } catch {}
        try { ac.close(); } catch {}
        acRef.current = null;
        if (ambienceCleanupRef.current) { try { ambienceCleanupRef.current(); } catch {} ambienceCleanupRef.current = null; }
      };
    } catch {
      if (audioRef.current) {
        audioRef.current.srcObject = remoteStream;
        audioRef.current.play().catch(() => {});
      }
      phoneChainCleanupRef.current = null;
    }
  }

  /* ───────── Mic VAD for barge-in + silence wait ───────── */
  async function setupVAD() {
    try {
      const mic = micStreamRef.current;
      if (!mic) return;

      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ac = acRef.current || new AC();
      acRef.current = ac;

      const src = ac.createMediaStreamSource(mic);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      src.connect(analyser);
      micAnalyserRef.current = analyser;

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i=0;i<buf.length;i++) sum += buf[i]*buf[i];
        const rms = Math.sqrt(sum / buf.length) / 255; // 0..1
        if (rms > 0.06) {
          lastMicActiveAtRef.current = Date.now();
          if (bargeIn) {
            // Stop assistant if it’s speaking
            safeSend(dcRef.current, { type: 'response.cancel' });
            // Duck audio element slightly for a moment
            if (audioRef.current) audioRef.current.volume = 0.25;
          }
        } else {
          if (audioRef.current) audioRef.current.volume = 1.0;
        }
        vadLoopRef.current = requestAnimationFrame(loop);
      };
      vadLoopRef.current = requestAnimationFrame(loop);
    } catch {
      // best-effort; ignore if VAD cannot init
    }
  }

  function userIsSilentFor(ms:number) {
    return Date.now() - (lastMicActiveAtRef.current || 0) > ms;
  }

  function sendBackchannel(dc: RTCDataChannel | null) {
    const now = Date.now();
    if (now - (lastBackchannelAtRef.current || 0) < BACKCHANNEL_COOLDOWN_MS) return;
    if (Math.random() > BACKCHANNEL_PROB) return;

    const line = pick(BACKCHANNEL_LINES);
    lastBackchannelAtRef.current = now;

    safeSend(dc, { type: 'response.create', response: { modalities: ['audio'], instructions: line } });
  }

  // Split firstMsg into multiple entries by "|" or newline
  function splitFirstMessages(input: string): string[] {
    if (!input) return [];
    return input
      .split(/\r?\n|\|/g)
      .map(s => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  async function startCall() {
    setError('');
    if (!apiKey) { setError('No API key selected. Choose one in the dropdown.'); return; }

    try {
      setConnecting(true);

      // 1) Ephemeral session
      const sessionRes = await fetch('/api/voice/ephemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': apiKey },
        body: JSON.stringify({ model, voiceName, assistantName, systemPrompt }),
      });

      if (!sessionRes.ok) throw new Error(`Ephemeral token error: ${await sessionRes.text()}`);
      const session = await sessionRes.json();
      const EPHEMERAL = session?.client_secret?.value;
      if (!EPHEMERAL) throw new Error('Missing ephemeral client_secret.value');

      // 2) Mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;

      // 3) RTCPeerConnection & audio
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      const remote = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getAudioTracks().forEach((t) => remote.addTrack(t));
        attachPhoneAudio(remote);
      };

      const sendTrack = mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // 4) Data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        // Style: human pacing, mood adaptation, sector-aware tone
        const extraStyle = [
          'Do not speak over the caller. If the caller starts speaking, stop immediately.',
          `Wait about ${(minSilenceMs/1000).toFixed(1)} seconds of silence before replying (unless acknowledging).`,
          'Use natural pacing with brief pauses; occasional mild disfluencies are okay (do not overuse).',
          'Match the caller’s mood: calm for intense moments, warm for sadness, upbeat for good news; laugh softly at appropriate jokes.',
          'For clinics/legal: professional and concise. For food/retail: friendly and efficient.',
        ].join(' ');

        const sessionUpdate = {
          type: 'session.update',
          session: {
            instructions: `${systemPrompt || ''}\n\n${languageNudge()}\n\n${extraStyle}`,
            voice: voiceId,
            input_audio_format: { type: 'input_audio_format', audio_format: 'pcm16' },
            output_audio_format: { type: 'output_audio_format', audio_format: 'pcm16' },
          },
        };
        safeSend(dc, sessionUpdate);

        // Assistant speaks first — but only after caller is quiet for a moment
        if (firstMode === 'Assistant speaks first') {
          const lines = splitFirstMessages(firstMsg || 'Hello.');

          const kick = () => {
            lines.forEach((ln, idx) => {
              const jitter = 220 + Math.random()*220;
              const delay = idx * (320 + Math.random()*180) + jitter;
              setTimeout(() => {
                safeSend(dc, { type: 'response.create', response: { modalities: ['audio'], instructions: ln } });
              }, delay);
            });
          };

          const startAt = Date.now();
          const gate = setInterval(() => {
            const quiet = userIsSilentFor(minSilenceMs);
            const timeout = Date.now() - startAt > (minSilenceMs + 1200);
            if (quiet || timeout) { clearInterval(gate); kick(); }
          }, 120);
        }
      };

      // Handle realtime messages
      dc.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const t = msg?.type as string;

          // assistant text streaming
          if (t === 'response.output_text.delta') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            const delta = msg?.delta || '';
            upsertRow(id, 'assistant', (prev) => ({ text: (prev?.text || '') + String(delta) }));
          }
          if (t === 'response.completed' || t === 'response.stop') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            upsertRow(id, 'assistant', { done: true });
          }

          // user transcript
          if (t === 'transcript.delta') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            const delta = msg?.delta || '';
            upsertRow(id, 'user', (prev) => ({ text: (prev?.text || '') + String(delta) }));
          }
          if (t === 'transcript.completed') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            upsertRow(id, 'user', { done: true });

            // Add a small “thinking” pause + occasional backchannel/filler
            const wait = pick(THINKING_PAUSE_MS);
            setTimeout(() => {
              sendBackchannel(dcRef.current);
              if (Math.random() < 0.08) {
                safeSend(dcRef.current, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(THINKING_FILLERS) } });
              }
            }, wait);
          }

          // Fallback: full text
          if (t === 'response.output_text' && typeof msg?.text === 'string') {
            addLine('assistant', msg.text);
          }
        } catch {
          // ignore non-JSON frames
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

      // 5) SDP
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

      const answer = { type: 'answer' as RTCSdpType, sdp: await answerRes.text() };
      await pc.setRemoteDescription(answer);

      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(() => {});
      }

      // start VAD last (so ac exists)
      setupVAD();
    } catch (e: any) {
      setConnecting(false);
      setConnected(false);
      setError(e?.message || 'Failed to start call.');
      cleanup();
    }
  }

  function toggleMute() {
    const tracks = micStreamRef.current?.getAudioTracks() || [];
    const next = !muted;
    tracks.forEach((t) => (t.enabled = !next));
    setMuted(next);
  }

  function cleanup() {
    if (vadLoopRef.current) cancelAnimationFrame(vadLoopRef.current);
    vadLoopRef.current = null;

    try { dcRef.current?.close(); } catch {}
    dcRef.current = null;

    try { pcRef.current?.close(); } catch {}
    pcRef.current = null;

    try { micStreamRef.current?.getTracks()?.forEach((t) => t.stop()); } catch {}
    micStreamRef.current = null;

    try { phoneChainCleanupRef.current?.(); } catch {}
    phoneChainCleanupRef.current = null;

    if (ambienceCleanupRef.current) { try { ambienceCleanupRef.current(); } catch {} ambienceCleanupRef.current = null; }

    try { acRef.current?.close(); } catch {}
    acRef.current = null;
  }

  function endCall(userIntent = true) {
    cleanup();
    setConnected(false);
    setConnecting(false);
    if (userIntent) onClose?.();
  }

  useEffect(() => {
    // Prime silence timer so “Assistant speaks first” waits unless user already talking
    lastMicActiveAtRef.current = Date.now();
    startCall();
    return () => { cleanup(); };
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
                {connecting ? 'Connecting to voice…' : (firstMode === 'Assistant speaks first' ? 'Waiting for assistant…' : 'Say hello! We’ll show the transcript here.')}
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
                  {muted ? 'Mic muted' : 'Mic live'} • Model: {model || 'gpt-4o-realtime-preview'} • Voice: {voiceName}
                </span>
              </div>
            </div>

            {/* Hidden audio sink (processed through WebAudio chain) */}
            <audio ref={audioRef} autoPlay playsInline />
          </div>
        </div>
      </div>
    </div>
  );
}
