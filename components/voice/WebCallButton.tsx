// components/voice/WebCallPanel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Mic, MicOff, PhoneOff, Loader2, ChevronDown, X, Bot, User,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────
   Props
   ───────────────────────────────────────────────────────── */
type Props = {
  model: string;                 // e.g. "gpt-4o-realtime-preview"
  systemPrompt: string;
  voiceName: string;             // friendly or OpenAI voice id
  assistantName: string;
  apiKey: string;
  onClose?: () => void;

  firstMode?: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg?: string;
  languageHint?: 'auto' | 'en' | 'de' | 'nl' | 'es' | 'ar';

  // Audio realism flags
  phoneFilter?: boolean;         // default false (clearest)
  farMic?: boolean;
  ambience?: 'off' | 'kitchen' | 'cafe';
  ambienceLevel?: number;
};

/* ─────────────────────────────────────────────────────────
   Types / utils
   ───────────────────────────────────────────────────────── */
type TranscriptRow = {
  id: string;
  who: 'user' | 'assistant';
  text: string;
  at: number;
  done?: boolean;
};

type Mood = 'joke' | 'sad' | 'angry' | 'positive' | 'neutral';

const RAW_ID_PATTERN = /^[a-z0-9._-]{3,}$/i;
const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const fmtTime = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/* ─────────────────────────────────────────────────────────
   OpenAI voices (live + fallback)
   ───────────────────────────────────────────────────────── */
const DEFAULT_OAI_VOICES = ['alloy','verse','coral','amber','opal','sage','pebble','juniper','cobalt'];
const FRIENDLY_TO_ID: Record<string, string> = {
  Breeze:'alloy', Orion:'alloy',
  Nova:'verse', Flow:'verse',
  Terra:'coral', Aster:'coral',
  Maya:'amber', Kai:'amber',
  Willow:'alloy', Aria:'verse', Flint:'coral', Ivy:'amber',
  Alloy:'alloy', Verse:'verse', Coral:'coral', Amber:'amber',
};

/* ─────────────────────────────────────────────────────────
   Humanization snippets
   ───────────────────────────────────────────────────────── */
const BACKCHANNEL_LINES = [
  'Let me check that…','One moment—checking.','Sure, give me a sec…',
  'Okay, I’m on it.','Alright, looking that up…','Just a second…',
  'Got it—pulling that up.','Mm-hmm… checking now.',
];
const THINKING_FILLERS = ['hmm…','uh…','let’s see…','right…','okay…'];
const LAUGHS = ['ha— that’s good!','heh, nice one.','(soft laugh) yeah, that got me.','haha— okay, I like that.'];

const THINKING_PAUSE_MS = [900, 1200, 1500, 1800];
const BACKCHANNEL_PROB = 0.18;
const BACKCHANNEL_COOLDOWN_MS = 4200;

/* ─────────────────────────────────────────────────────────
   Mood / language helpers
   ───────────────────────────────────────────────────────── */
function detectMood(s: string): Mood {
  const t = (s || '').toLowerCase();
  if (!t.trim()) return 'neutral';
  if (/(haha|lol|lmao|🤣|😅|😆|grap|grappig|good one)/.test(t)) return 'joke';
  if (/(sad|upset|depress|bad day|:(\(|😢|😭)|verdrietig|baal)/.test(t)) return 'sad';
  if (/(angry|mad|furious|annoyed|wtf|sucks|terrible|awful|!{2,}|boos)/.test(t)) return 'angry';
  if (/(great|awesome|nice|love|perfect|amazing|thanks!?|top|lekker|geweldig)/.test(t)) return 'positive';
  return 'neutral';
}
function styleForMood(m: Mood) {
  switch (m) {
    case 'joke':     return 'If the caller makes a joke, react with a short, natural laugh before answering. Keep it light.';
    case 'sad':      return 'Sound warm and supportive. Slow down slightly and acknowledge feelings before giving info.';
    case 'angry':    return 'Stay calm and professional. Lower intensity, acknowledge frustration, and focus on solutions.';
    case 'positive': return 'Be upbeat and friendly; don’t oversell.';
    default:         return 'Keep a relaxed conversational tone.';
  }
}
function languageNudge(lang: Props['languageHint']) {
  if (lang === 'auto') return 'Auto-detect and reply in the user’s language (English, German, Dutch, Spanish, or Arabic).';
  const map: Record<string, string> = {
    en: 'Respond in natural, conversational English with contractions.',
    de: 'Antworte natürlich und umgangssprachlich auf Deutsch.',
    nl: 'Antwoord in natuurlijk, informeel Nederlands.',
    es: 'Responde en español conversacional.',
    ar: 'يرجى الرد بالعربية بأسلوب محادثة طبيعي.',
  };
  return map[lang] || '';
}
function baseStyle(lang: Props['languageHint']) {
  const langN = languageNudge(lang);
  const shared = [
    // PRIORITY RULE so your prompt “wins”
    'If the user states explicit formatting rules (e.g., “answer yes/no only”, “tell jokes”), follow those rules strictly until they say otherwise.',
    'Do not speak over the caller; if the caller starts talking, stop.',
    'Wait ~1–2 seconds of silence before replying (unless a brief acknowledgement).',
    'Use natural pacing with brief pauses and occasional mild disfluencies.',
    'Avoid rigid menu patterns; speak like a person.',
  ].join(' ');
  return `${langN}\n\n${shared}`;
}
function turnStyleNudge(): string {
  return pick([
    'Vary intonation; avoid flat delivery.',
    'Give a short acknowledgement before details.',
    'If the user hesitates, slow down and simplify.',
    'Keep options conversational, not templated.',
  ]);
}

/* ─────────────────────────────────────────────────────────
   WebAudio (clean defaults)
   ───────────────────────────────────────────────────────── */
function createSaturator(ac: AudioContext, drive = 1.05) {
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i = 0; i < curve.length; i++) {
    const x = (i / (curve.length - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * drive);
  }
  shaper.curve = curve;
  shaper.oversample = '2x';
  return shaper;
}
function createAmbience(ac: AudioContext, kind: 'kitchen'|'cafe', level = 0.08) {
  const noise = ac.createBufferSource();
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let prev = 0;
  for (let i=0;i<len;i++){
    const white = Math.random()*2-1;
    prev = prev*0.97 + white*0.03;
    data[i] = prev;
  }
  noise.buffer = buf; noise.loop = true;

  const band = ac.createBiquadFilter(); band.type = 'bandpass';
  band.frequency.value = kind === 'kitchen' ? 950 : 350;
  band.Q.value = kind === 'kitchen' ? 0.9 : 0.6;

  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;

  const g = ac.createGain(); g.gain.value = clamp01(level) * 0.18;

  noise.connect(band); band.connect(hp); hp.connect(g); g.connect(ac.destination);
  noise.start();

  return () => { try{noise.stop()}catch{}; [noise, band, hp, g].forEach(n=>{try{(n as any).disconnect()}catch{}}); };
}
async function attachProcessedAudio(
  audioEl: HTMLAudioElement,
  remoteStream: MediaStream,
  opts: { phoneFilter:boolean; farMic:boolean; ambience:'off'|'kitchen'|'cafe'; ambienceLevel:number }
){
  const { phoneFilter, farMic, ambience, ambienceLevel } = opts;

  if (!phoneFilter) {
    (audioEl as any).srcObject = remoteStream;
    await audioEl.play().catch(()=>{});
    return () => {};
  }

  const AC = (window.AudioContext || (window as any).webkitAudioContext);
  const ac = new AC();
  const src = ac.createMediaStreamSource(remoteStream);

  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 12000;

  const presence = ac.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 2800; presence.Q.value = 0.9; presence.gain.value = 1.6;
  const body = ac.createBiquadFilter(); body.type = 'lowshelf'; body.frequency.value = 160; body.gain.value = 1.2;

  const sat = createSaturator(ac, 1.05);
  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -20; comp.knee.value = 18; comp.ratio.value = 1.7;
  comp.attack.value = 0.008;  comp.release.value = 0.18;

  const wetGain = ac.createGain(); wetGain.gain.value = farMic ? 0.01 : 0.0;
  const merger = ac.createGain();
  const dryGain = ac.createGain(); dryGain.gain.value = 1.0;
  const dest = ac.createMediaStreamDestination();

  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dryGain); dryGain.connect(merger);
  comp.connect(wetGain); wetGain.connect(merger);
  merger.connect(dest);

  (audioEl as any).srcObject = dest.stream;
  await audioEl.play().catch(()=>{});

  let ambCleanup: null | (()=>void) = null;
  if (ambience !== 'off') ambCleanup = createAmbience(ac, ambience, ambienceLevel);

  return () => {
    [src,hp,lp,presence,body,sat,comp,wetGain,merger,dryGain].forEach(n=>{try{(n as any).disconnect()}catch{}});
    try{ ac.close() }catch{}
    if (ambCleanup) { try{ ambCleanup() }catch{} }
  };
}

/* ─────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────── */
export default function WebCallPanel({
  model: modelProp,
  systemPrompt,
  voiceName: voiceProp,
  assistantName,
  apiKey,
  onClose,
  firstMode = 'Assistant speaks first',
  firstMsg = 'Hello.',
  languageHint = 'auto',
  phoneFilter = false,
  farMic = false,
  ambience = 'off',
  ambienceLevel = 0.08,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string>('');

  const [selectedModel, setSelectedModel] = useState<string>(modelProp || 'gpt-4o-realtime-preview');
  const [voices, setVoices] = useState<string[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [log, setLog] = useState<TranscriptRow[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const closeChainRef = useRef<null | (()=>void)>(null);
  const vadLoopRef = useRef<number | null>(null);
  const lastMicActiveAtRef = useRef<number>(0);
  const lastBackchannelAtRef = useRef<number>(0);
  const baseInstructionsRef = useRef<string>('');

  // Resolve voice id
  const voiceId = useMemo(() => {
    const key = (selectedVoice || voiceProp || '').trim();
    if (RAW_ID_PATTERN.test(key) && !FRIENDLY_TO_ID[key]) return key.toLowerCase();
    return FRIENDLY_TO_ID[key] || key || 'alloy';
  }, [selectedVoice, voiceProp]);

  // Fetch OpenAI voices (real list) with fallback
  useEffect(() => {
    let cancelled = false;
    async function loadVoices() {
      const fallback = Array.from(new Set([voiceProp, ...DEFAULT_OAI_VOICES].filter(Boolean))) as string[];
      try {
        const res = await fetch('https://api.openai.com/v1/voices', {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        const ids: string[] = Array.isArray(data?.data) ? data.data.map((v:any)=>v?.id).filter(Boolean) : fallback;
        if (!cancelled) {
          setVoices(ids.length ? ids : fallback);
          setSelectedVoice((ids[0] as string) || 'alloy');
        }
      } catch {
        if (!cancelled) {
          setVoices(fallback);
          setSelectedVoice((fallback[0] as string) || 'alloy');
        }
      }
    }
    loadVoices();
    return () => { cancelled = true; };
  }, [apiKey, voiceProp]);

  // Helpers
  const upsertRow = (id: string, who: TranscriptRow['who'], patch: Partial<TranscriptRow> | ((prev?: TranscriptRow)=>Partial<TranscriptRow>)) => {
    setLog((prev) => {
      const i = prev.findIndex((r) => r.id === id);
      if (i === -1) {
        const base: TranscriptRow = { id, who, text: '', at: Date.now(), done: false };
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
    setLog((prev) => [...prev, { id, who, text, at: Date.now(), done: true }]);
  };
  function safeSend(dc: RTCDataChannel | null, payload: any) {
    if (!dc || dc.readyState !== 'open') return;
    try { dc.send(JSON.stringify(payload)); } catch {}
  }

  // Gentle VAD (duck only)
  async function setupVAD() {
    try {
      const mic = micStreamRef.current;
      if (!mic) return;
      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ac = new AC();
      const src = ac.createMediaStreamSource(mic);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.88;
      src.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i=0;i<buf.length;i++) sum += buf[i]*buf[i];
        const rms = Math.sqrt(sum / buf.length) / 255;
        if (rms > 0.07) {
          lastMicActiveAtRef.current = Date.now();
          if (audioRef.current) audioRef.current.volume = 0.35;
        } else {
          if (audioRef.current) audioRef.current.volume = 1.0;
        }
        vadLoopRef.current = requestAnimationFrame(loop);
      };
      vadLoopRef.current = requestAnimationFrame(loop);
      return () => { try{ ac.close() }catch{} };
    } catch { return () => {}; }
  }
  const userIsSilentFor = (ms:number) => Date.now() - (lastMicActiveAtRef.current || 0) > ms;
  function sendBackchannel(dc: RTCDataChannel | null) {
    const now = Date.now();
    if (now - (lastBackchannelAtRef.current || 0) < BACKCHANNEL_COOLDOWN_MS) return;
    if (Math.random() > BACKCHANNEL_PROB) return;
    lastBackchannelAtRef.current = now;
    safeSend(dc, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(BACKCHANNEL_LINES) } });
  }
  const splitFirstMessages = (input: string) => (input || '').split(/\r?\n|\|/g).map(s=>s.trim()).filter(Boolean).slice(0,20);

  // Start call
  async function startCall() {
    setError('');
    if (!apiKey) { setError('No API key selected.'); return; }

    try {
      setConnecting(true);

      // 1) ephemeral
      const sessionRes = await fetch('/api/voice/ephemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': apiKey },
        body: JSON.stringify({ model: selectedModel, voiceName: voiceId, assistantName, systemPrompt }),
      });
      if (!sessionRes.ok) throw new Error(`Ephemeral token error: ${await sessionRes.text()}`);
      const session = await sessionRes.json();
      const EPHEMERAL = session?.client_secret?.value;
      if (!EPHEMERAL) throw new Error('Missing ephemeral client_secret.value');

      // 2) mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;

      // 3) peer
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      const remote = new MediaStream();
      pc.ontrack = async (e) => {
        e.streams[0]?.getAudioTracks().forEach((t) => remote.addTrack(t));
        if (!audioRef.current) return;
        if (closeChainRef.current) { try{ closeChainRef.current() }catch{} closeChainRef.current = null; }
        closeChainRef.current = await attachProcessedAudio(
          audioRef.current, remote, { phoneFilter, farMic, ambience, ambienceLevel }
        );
      };

      const sendTrack = mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // 4) data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        const style = [baseStyle(languageHint), turnStyleNudge()].join(' ');

        // 🔒 Pin base + meta-rule so user rules win
        baseInstructionsRef.current = `${systemPrompt || ''}\n\n${style}`;

        safeSend(dc, {
          type: 'session.update',
          session: {
            instructions: baseInstructionsRef.current,
            voice: voiceId,
            // ← FIXED types (strings)
            input_audio_format: 'pcm16',
            output_audio_format: 'pcm16',
          },
        });

        if (firstMode === 'Assistant speaks first') {
          const lines = splitFirstMessages(firstMsg || 'Hello.');
          const startAt = Date.now();
          const gate = setInterval(() => {
            const quiet = userIsSilentFor(1200);
            const timeout = Date.now() - startAt > 2200;
            if (quiet || timeout) {
              clearInterval(gate);
              lines.forEach((ln, idx) => {
                const jitter = 220 + Math.random()*240;
                const delay = idx * (340 + Math.random()*200) + jitter;
                setTimeout(() => {
                  safeSend(dc, { type: 'response.create', response: { modalities: ['audio'], instructions: ln } });
                }, delay);
              });
            }
          }, 120);
        }
      };

      // 5) messages
      dc.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const t = msg?.type as string;

          if (t === 'response.output_text.delta') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            const delta = msg?.delta || '';
            upsertRow(id, 'assistant', (prev) => ({ text: (prev?.text || '') + String(delta) }));
          }
          if (t === 'response.completed' || t === 'response.stop') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            upsertRow(id, 'assistant', { done: true });
          }

          if (t === 'transcript.delta') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            const delta = msg?.delta || '';
            upsertRow(id, 'user', (prev) => ({ text: (prev?.text || '') + String(delta) }));
          }
          if (t === 'transcript.completed') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            const row = (log.find(r => r.id === id) || { text: '' });
            const text = (row.text || '').trim();
            const mood = detectMood(text);
            upsertRow(id, 'user', { done: true });

            // Append nudges; never overwrite base
            const dutchLikely = / de | het | een | jij | je | we | wij | lekker | alsjeblieft | dank je | bedankt | hoe | wat | waarom | grap /.test(text.toLowerCase());
            const langAdj = dutchLikely ? 'Spreek vlot en informeel Nederlands; varieer intonatie en tempo.' : '';
            const appended = `${baseInstructionsRef.current}\n\n${styleForMood(mood)} ${turnStyleNudge()} ${langAdj}`.trim();

            safeSend(dcRef.current, { type: 'session.update', session: { instructions: appended } });

            const wait = pick(THINKING_PAUSE_MS);
            setTimeout(() => {
              // subtle backchannel/fillers
              const now = Date.now();
              if (now - (lastBackchannelAtRef.current || 0) > BACKCHANNEL_COOLDOWN_MS && Math.random() <= BACKCHANNEL_PROB) {
                lastBackchannelAtRef.current = now;
                safeSend(dcRef.current, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(BACKCHANNEL_LINES) } });
              }
              if (mood === 'joke') {
                safeSend(dcRef.current, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(LAUGHS) } });
              } else if (Math.random() < 0.08) {
                safeSend(dcRef.current, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(THINKING_FILLERS) } });
              }
            }, wait);
          }

          if (t === 'response.output_text' && typeof msg?.text === 'string') {
            addLine('assistant', msg.text);
          }
        } catch {}
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') { setConnected(true); setConnecting(false); }
        else if (['disconnected','failed','closed'].includes(pc.connectionState)) { endCall(false); }
      };

      // 6) SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(selectedModel || 'gpt-4o-realtime-preview')}`;
      const answerRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${EPHEMERAL}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offer.sdp,
      });
      if (!answerRes.ok) throw new Error(`Realtime SDP failed: ${await answerRes.text()}`);

      const answer = { type: 'answer' as RTCSdpType, sdp: await answerRes.text() };
      await pc.setRemoteDescription(answer);

      if (audioRef.current) {
        audioRef.current.muted = false;
        audioRef.current.play().catch(()=>{});
      }

      const stopVad = await setupVAD();
      const prevCleanup = closeChainRef.current;
      closeChainRef.current = () => { try{ prevCleanup && prevCleanup() }catch{}; try{ stopVad && stopVad() }catch{} };

    } catch (e:any) {
      setConnecting(false); setConnected(false);
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
    try { closeChainRef.current && closeChainRef.current(); } catch {}
    closeChainRef.current = null;
  }
  function endCall(userIntent = true) {
    cleanup(); setConnected(false); setConnecting(false);
    if (userIntent) onClose?.();
  }

  useEffect(() => {
    lastMicActiveAtRef.current = Date.now();
    startCall();
    return () => { cleanup(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, voiceId]);

  /* ─────────────────────────── UI — RIGHT DRAWER PANEL ─────────────────────────── */
  return (
    <aside
      className="fixed top-0 right-0 h-screen w-[min(480px,95vw)] bg-[#0d0f11] border-l border-[rgba(255,255,255,.12)] shadow-2xl flex flex-col"
      style={{ zIndex: 9999 }}
      role="dialog"
      aria-label="Voice call panel"
    >
      {/* Header */}
      <header className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,255,255,.10)]">
        <div className="flex items-center gap-2 min-w-0">
          <Bot className="w-5 h-5 opacity-80" />
          <div className="truncate">
            <div className="text-xs opacity-70">Talking to</div>
            <div className="font-semibold truncate">{assistantName || 'Assistant'}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Model selector */}
          <div className="relative">
            <select
              className="appearance-none bg-transparent text-xs rounded-lg px-2.5 py-1.5 pr-7"
              style={{ border: '1px solid rgba(255,255,255,.16)', color: '#e6f1ef' }}
              value={selectedModel}
              onChange={(e)=>setSelectedModel(e.target.value)}
              title="Model"
            >
              <option value="gpt-4o-realtime-preview">gpt-4o-realtime-preview</option>
              <option value="gpt-4o-realtime-preview-2024-12-17">gpt-4o-realtime-preview-2024-12-17</option>
              <option value="gpt-4o-realtime-audio-preview">gpt-4o-realtime-audio-preview</option>
              <option value="gpt-4o-mini-tts">gpt-4o-mini-tts</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-2 opacity-60 pointer-events-none" />
          </div>

          {/* Voice selector (real OpenAI ids) */}
          <div className="relative">
            <select
              className="appearance-none bg-transparent text-xs rounded-lg px-2.5 py-1.5 pr-7"
              style={{ border: '1px solid rgba(255,255,255,.16)', color: '#e6f1ef' }}
              value={voiceId}
              onChange={(e)=>setSelectedVoice(e.target.value)}
              title="Voice"
            >
              {(voices.length ? voices : DEFAULT_OAI_VOICES).map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-2 opacity-60 pointer-events-none" />
          </div>

          <button
            onClick={toggleMute}
            className="h-8 w-8 rounded-full grid place-items-center"
            style={{ border: '1px solid rgba(255,255,255,.14)', background: muted ? 'rgba(239,68,68,.16)' : 'transparent', color: '#e6f1ef' }}
            title={muted ? 'Unmute mic' : 'Mute mic'}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={() => endCall(true)}
            className="h-8 w-8 rounded-full grid place-items-center"
            style={{ border: '1px solid rgba(239,68,68,.38)', background: 'rgba(239,68,68,.18)', color: '#ffd7d7' }}
            title="End call"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Chat list */}
      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {log.length === 0 && (
          <div className="text-sm opacity-70 px-2">
            {connecting ? 'Connecting to voice…' : (firstMode === 'Assistant speaks first' ? 'Waiting for assistant…' : 'Say hello! We’ll show the transcript here.')}
          </div>
        )}

        {log.map((row) => (
          <div key={row.id} className={`flex ${row.who === 'user' ? 'justify-end' : 'justify-start'}`}>
            {/* avatar */}
            {row.who === 'assistant' && (
              <div className="mr-2 mt-[2px] shrink-0 rounded-full bg-[rgba(89,217,179,.12)] border border-[rgba(89,217,179,.25)] w-7 h-7 grid place-items-center">
                <Bot className="w-4 h-4 opacity-80" />
              </div>
            )}

            {/* bubble */}
            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-[0.95rem] leading-snug border`}
                 style={{
                   background: row.who === 'user' ? 'rgba(56,196,143,.18)' : 'rgba(255,255,255,.06)',
                   borderColor: row.who === 'user' ? 'rgba(56,196,143,.35)' : 'rgba(255,255,255,.14)',
                   color: '#e6f1ef',
                 }}>
              <div>{row.text || <span className="opacity-50">…</span>}</div>
              <div className="text-[10px] mt-1 opacity-60 text-right">{fmtTime(row.at)}</div>
            </div>

            {row.who === 'user' && (
              <div className="ml-2 mt-[2px] shrink-0 rounded-full bg-[rgba(255,255,255,.10)] border border-[rgba(255,255,255,.18)] w-7 h-7 grid place-items-center">
                <User className="w-4 h-4 opacity-80" />
              </div>
            )}
          </div>
        ))}

        {/* error banner styled like “red box” */}
        {error && (
          <div className="text-xs px-3 py-2 rounded-lg border"
               style={{ background: 'rgba(239,68,68,.12)', borderColor: 'rgba(239,68,68,.25)', color: '#ffd7d7' }}>
            {error}
          </div>
        )}
      </main>

      {/* Footer status */}
      <footer className="border-t border-[rgba(255,255,255,.10)] px-3 py-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span className="opacity-80">
              {connected ? 'Connected' : (connecting ? 'Connecting…' : 'Idle')}
              {' '}• Model: {selectedModel} • Voice: {voiceId}
            </span>
          </div>
          <audio ref={audioRef} autoPlay playsInline />
        </div>
      </footer>
    </aside>
  );
}
