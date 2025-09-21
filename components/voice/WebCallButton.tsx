// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mic, MicOff, PhoneOff, Loader2, MessageSquare } from 'lucide-react';

type Props = {
  model: string;
  systemPrompt: string;
  voiceName: string;
  assistantName: string;
  apiKey: string;
  onClose?: () => void;

  firstMode?: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg?: string;
  languageHint?: 'auto' | 'en' | 'de' | 'nl' | 'es' | 'ar';

  phoneFilter?: boolean;
  farMic?: boolean;
  ambience?: 'off' | 'kitchen' | 'cafe';
  ambienceLevel?: number;
};

type TranscriptRow = {
  id: string;
  who: 'user' | 'assistant';
  text: string;
  done?: boolean;
};

const CTA = '#59d9b3';

const FRIENDLY_TO_ID: Record<string, string> = {
  Breeze: 'alloy', Orion: 'alloy',
  Nova: 'verse',  Flow: 'verse',
  Terra: 'coral', Aster: 'coral',
  Maya: 'amber',  Kai: 'amber',
  Willow: 'alloy', Aria: 'verse', Flint: 'coral', Ivy: 'amber',
  Alloy: 'alloy', Verse: 'verse', Coral: 'coral', Amber: 'amber',
};
const RAW_ID_PATTERN = /^[a-z0-9._-]{3,}$/i;

const BACKCHANNEL_LINES = [
  'Okay, I’m on it.', 'Let me check that…', 'One moment—checking.', 'Sure, give me a sec…'
];
const THINKING_FILLERS = ['hmm…', 'uh…', 'let’s see…', 'right…', 'okay…'];
const LAUGHS = ['ha— that’s good!', 'heh, nice one.', '(soft laugh) yeah, that got me.'];

const THINKING_PAUSE_MS = [900, 1200, 1500, 1800];
const BACKCHANNEL_PROB = 0.18;
const BACKCHANNEL_COOLDOWN_MS = 4000;

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp01(v:number){ return Math.max(0, Math.min(1, v)); }

type Mood = 'joke' | 'sad' | 'angry' | 'positive' | 'neutral';
function detectMood(s: string): Mood {
  const t = (s || '').toLowerCase();
  if (!t.trim()) return 'neutral';
  if (/(haha|lol|lmao|🤣|😅|😆|grap|grappig|good one)/.test(t)) return 'joke';
  if (/(sad|upset|depress|bad day|😢|😭|verdrietig|baal)/.test(t)) return 'sad';
  if (/(angry|mad|furious|annoyed|wtf|sucks|terrible|awful|!{2,}|boos)/.test(t)) return 'angry';
  if (/(great|awesome|nice|love|perfect|amazing|thanks|geweldig|top)/.test(t)) return 'positive';
  return 'neutral';
}
function styleForMood(m: Mood) {
  switch (m) {
    case 'joke': return 'If the caller makes a joke, react with a short, natural laugh before answering.';
    case 'sad': return 'Sound warm and supportive. Slow down slightly and acknowledge feelings first.';
    case 'angry': return 'Stay calm and professional. Acknowledge frustration; focus on solutions.';
    case 'positive': return 'Be upbeat and friendly; don’t oversell.';
    default: return 'Keep a relaxed conversational tone.';
  }
}

function languageNudge(lang: Props['languageHint']) {
  if (lang === 'auto') return 'Auto-detect and reply in the user’s language (English, German, Dutch, Spanish, or Arabic).';
  const map: Record<string, string> = {
    en: 'Respond in natural, conversational English with contractions.',
    de: 'Antworte natürlich und umgangssprachlich auf Deutsch.',
    nl: 'Antwoord in natuurlijk, informeel Nederlands; gebruik korte zinnen en alledaagse woorden.',
    es: 'Responde en español conversacional y natural.',
    ar: 'يرجى الرد بالعربية بأسلوب محادثة طبيعي.',
  };
  return map[lang] || '';
}

function createSaturator(ac: AudioContext, drive=1.15) {
  const shaper = ac.createWaveShaper();
  const curve = new Float32Array(1024);
  for (let i=0; i<curve.length; i++){
    const x = (i / (curve.length-1)) * 2 - 1;
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

  const g = ac.createGain(); g.gain.value = clamp01(level) * 0.22;

  noise.connect(band); band.connect(hp); hp.connect(g); g.connect(ac.destination);
  noise.start();

  return () => { try{noise.stop()}catch{}; [noise, band, hp, g].forEach(n=>{try{(n as any).disconnect()}catch{}}); };
}

async function attachProcessedAudio(
  audioEl: HTMLAudioElement,
  remoteStream: MediaStream,
  opts: { phoneFilter: boolean; farMic: boolean; ambience: 'off'|'kitchen'|'cafe'; ambienceLevel: number }
){
  const { phoneFilter, farMic, ambience, ambienceLevel } = opts;
  if (!phoneFilter) {
    audioEl.srcObject = remoteStream;
    try { await audioEl.play(); } catch (e) { console.warn('[AUDIO PLAY BLOCKED]', e); }
    return () => {};
  }

  const AC = (window.AudioContext || (window as any).webkitAudioContext);
  const ac = new AC();

  const src = ac.createMediaStreamSource(remoteStream);

  const hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass';  lp.frequency.value = 5200;

  const presence = ac.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 2700; presence.Q.value = 0.9; presence.gain.value = 2.4;
  const body = ac.createBiquadFilter(); body.type = 'lowshelf'; body.frequency.value = 180; body.gain.value = 2.0;

  const sat = createSaturator(ac, 1.15);

  const comp = ac.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 16; comp.ratio.value = 2.0;
  comp.attack.value = 0.005;  comp.release.value = 0.18;

  const wetGain = ac.createGain(); wetGain.gain.value = farMic ? 0.015 : 0.0;

  const merger = ac.createGain();
  const dryGain = ac.createGain(); dryGain.gain.value = 1.0;

  const dest = ac.createMediaStreamDestination();

  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dryGain); dryGain.connect(merger);
  comp.connect(wetGain); wetGain.connect(merger);
  merger.connect(dest);

  audioEl.srcObject = dest.stream;
  try { await audioEl.play(); } catch (e) { console.warn('[AUDIO PLAY BLOCKED]', e); }

  let ambCleanup: null | (()=>void) = null;
  if (ambience !== 'off') ambCleanup = createAmbience(ac, ambience, ambienceLevel);

  return () => {
    [src,hp,lp,presence,body,sat,comp,wetGain,merger,dryGain].forEach(n=>{try{(n as any).disconnect()}catch{}});
    try{ ac.close() }catch{}
    if (ambCleanup) { try{ ambCleanup() }catch{} }
  };
}

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
  farMic = false,
  ambience = 'off',
  ambienceLevel = 0.08,
}: Props) {
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);

  const closeChainRef = useRef<null | (()=>void)>(null);
  const vadLoopRef = useRef<number | null>(null);
  const lastMicActiveAtRef = useRef<number>(0);
  const lastCancelAtRef = useRef<number>(0); // throttle response.cancel
  const speakingRef = useRef<boolean>(false); // mic > threshold state

  const [log, setLog] = useState<TranscriptRow[]>([]);
  const transcriptsRef = useRef<Record<string, string>>({}); // always-fresh transcript text
  const lastBackchannelAtRef = useRef<number>(0);

  const voiceId = useMemo(() => {
    const key = (voiceName || '').trim();
    if (RAW_ID_PATTERN.test(key) && !FRIENDLY_TO_ID[key]) return key.toLowerCase();
    return FRIENDLY_TO_ID[key] || 'alloy';
  }, [voiceName]);

  const addLine = (who: TranscriptRow['who'], text: string) => {
    const id = `${who}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    setLog((prev) => [...prev, { id, who, text, done: true }]);
  };

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

  function safeSend(dc: RTCDataChannel | null, payload: any) {
    if (!dc || dc.readyState !== 'open') return;
    try { dc.send(JSON.stringify(payload)); } catch (e) { console.error('[DC send failed]', e); }
  }

  // ---------- ENFORCE PROMPT PER TURN ----------
  function respondFor(userText: string, extras: string[] = []) {
    const mood = detectMood(userText);
    const moodStyle = styleForMood(mood);
    const langHint = languageNudge(languageHint);
    const dutchLikely = / de | het | een | jij | je | we | wij | lekker | alsjeblieft | dank je | bedankt | hoe | wat | waarom | grap /.test(userText.toLowerCase());
    const nlAdj = dutchLikely ? 'Spreek vlot en informeel Nederlands; varieer intonatie en tempo.' : '';

    const instructions = [
      systemPrompt,                // <- your strict rules LIVE HERE
      langHint,
      moodStyle,
      nlAdj,
      'Do not speak over the caller. Pause ~1s before replying.',
      ...extras,
    ].filter(Boolean).join('\n');

    console.log('[TURN INSTRUCTIONS]', instructions);
    safeSend(dcRef.current, {
      type: 'response.create',
      response: {
        modalities: ['audio'],
        instructions: `${instructions}\n\nUser: "${userText}"\nAssistant:`,
      },
    });
  }

  function sendBackchannel(dc: RTCDataChannel | null) {
    const now = Date.now();
    if (now - (lastBackchannelAtRef.current || 0) < BACKCHANNEL_COOLDOWN_MS) return;
    if (Math.random() > BACKCHANNEL_PROB) return;
    lastBackchannelAtRef.current = now;
    safeSend(dc, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(BACKCHANNEL_LINES) } });
  }

  function splitFirstMessages(input: string): string[] {
    if (!input) return [];
    return input.split(/\r?\n|\|/g).map(s => s.trim()).filter(Boolean).slice(0, 20);
  }

  async function setupVAD() {
    try {
      const mic = micStreamRef.current;
      if (!mic) return () => {};

      const AC = (window.AudioContext || (window as any).webkitAudioContext);
      const ac = new AC();
      const src = ac.createMediaStreamSource(mic);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.85;
      src.connect(analyser);

      const buf = new Uint8Array(analyser.frequencyBinCount);

      const loop = () => {
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i=0;i<buf.length;i++) sum += buf[i]*buf[i];
        const rms = Math.sqrt(sum / buf.length) / 255;

        const active = rms > 0.06;
        if (active) {
          lastMicActiveAtRef.current = Date.now();
          if (!speakingRef.current) {
            // rising edge -> user started talking
            speakingRef.current = true;
            // throttle cancel to avoid nuking assistant continuously
            const now = Date.now();
            if (now - lastCancelAtRef.current > 1200) {
              lastCancelAtRef.current = now;
              safeSend(dcRef.current, { type: 'response.cancel' });
              if (audioRef.current) audioRef.current.volume = 0.27;
              // console.log('[VAD] cancel sent');
            }
          }
        } else {
          speakingRef.current = false;
          if (audioRef.current) audioRef.current.volume = 1.0;
        }

        vadLoopRef.current = requestAnimationFrame(loop);
      };
      vadLoopRef.current = requestAnimationFrame(loop);

      return () => { try{ ac.close() }catch{} };
    } catch {
      return () => {};
    }
  }

  function userIsSilentFor(ms:number) {
    return Date.now() - (lastMicActiveAtRef.current || 0) > ms;
  }

  async function startCall() {
    setError('');
    if (!apiKey) { setError('No API key selected.'); return; }

    try {
      setConnecting(true);

      // 1) ephemeral session
      const sessionRes = await fetch('/api/voice/ephemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-OpenAI-Key': apiKey },
        body: JSON.stringify({ model, voiceName, assistantName, systemPrompt }),
      });

      const raw = await sessionRes.text();
      if (!sessionRes.ok) throw new Error(`Ephemeral token error: ${raw}`);
      const session = JSON.parse(raw);
      const EPHEMERAL = session?.client_secret?.value;
      console.log('[EPHEMERAL]', !!EPHEMERAL);
      if (!EPHEMERAL) throw new Error('Missing ephemeral client_secret.value');

      // 2) mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = mic;

      // 3) peer
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      pc.oniceconnectionstatechange = () => {
        console.log('[ICE]', pc.iceConnectionState);
      };

      const remote = new MediaStream();
      pc.ontrack = async (e) => {
        e.streams[0]?.getAudioTracks().forEach((t) => remote.addTrack(t));
        if (!audioRef.current) return;
        if (closeChainRef.current) { try{ closeChainRef.current() }catch{} closeChainRef.current = null; }
        closeChainRef.current = await attachProcessedAudio(
          audioRef.current,
          remote,
          { phoneFilter, farMic, ambience, ambienceLevel }
        );
      };

      const sendTrack = mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // 4) data channel
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onerror = (e) => console.error('[DC error]', e);
      dc.onclose = () => console.warn('[DC closed]');

      dc.onopen = () => {
        console.log('[DC] open');

        // Keep session.update minimal—don’t put behavior rules here.
        safeSend(dc, {
          type: 'session.update',
          session: {
            voice: voiceId,
            input_audio_format: { type: 'input_audio_format', audio_format: 'pcm16' },
            output_audio_format: { type: 'output_audio_format', audio_format: 'pcm16' },
          },
        });

        // Smoke test: force speech so you know audio works
        safeSend(dc, {
          type: 'response.create',
          response: { modalities: ['audio'], instructions: 'Test—voice is live. If you can hear me, say hello.' }
        });

        // Optional: assistant speaks first, but include systemPrompt so rules apply
        if (firstMode === 'Assistant speaks first') {
          const lines = splitFirstMessages(firstMsg || 'Hello.');
          const startAt = Date.now();
          const gate = setInterval(() => {
            const quiet = userIsSilentFor(1000);
            const timeout = Date.now() - startAt > 2000;
            if (quiet || timeout) {
              clearInterval(gate);
              lines.forEach((ln, idx) => {
                setTimeout(() => { respondFor(ln, ['Keep it to one or two short sentences.']); }, idx * 240);
              });
            }
          }, 120);
        }
      };

      // messages
      dc.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          const t = msg?.type as string;

          if (t?.includes('error') || t === 'response.error') {
            console.error('[Realtime ERROR]', msg);
            setError(prev => prev ? prev : (msg?.error?.message || 'Realtime error.'));
          }

          if (t === 'response.output_text.delta') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            const delta = String(msg?.delta || '');
            upsertRow(id, 'assistant', (prev) => ({ text: (prev?.text || '') + delta }));
          }
          if (t === 'response.completed' || t === 'response.stop') {
            const id = msg?.response_id || msg?.id || 'assistant_current';
            upsertRow(id, 'assistant', { done: true });
          }

          if (t === 'transcript.delta') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            const delta = String(msg?.delta || '');
            transcriptsRef.current[id] = (transcriptsRef.current[id] || '') + delta;
            upsertRow(id, 'user', (prev) => ({ text: (prev?.text || '') + delta }));
          }
          if (t === 'transcript.completed') {
            const id = msg?.transcript_id || msg?.id || 'user_current';
            const text = (transcriptsRef.current[id] || '').trim();
            upsertRow(id, 'user', { done: true });

            // light turn effects (don’t overwrite rules!)
            const wait = pick(THINKING_PAUSE_MS);
            setTimeout(() => {
              if (detectMood(text) === 'joke') {
                safeSend(dcRef.current, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(LAUGHS) } });
              } else if (Math.random() < 0.08) {
                safeSend(dcRef.current, { type: 'response.create', response: { modalities: ['audio'], instructions: pick(THINKING_FILLERS) } });
              } else {
                sendBackchannel(dcRef.current);
              }
            }, wait);

            if (text) respondFor(text);
          }

          if (t === 'response.output_text' && typeof msg?.text === 'string') {
            addLine('assistant', msg.text);
          }
        } catch {
          // non-JSON frames
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[PC]', pc.connectionState);
        if (pc.connectionState === 'connected') { setConnected(true); setConnecting(false); }
        else if (['disconnected','failed','closed'].includes(pc.connectionState)) { endCall(false); }
      };

      // 5) SDP
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const url = `https://api.openai.com/v1/realtime?model=${encodeURIComponent(model || 'gpt-4o-realtime-preview')}`;
      const answerRes = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${EPHEMERAL}`,
          'Content-Type': 'application/sdp',
          'OpenAI-Beta': 'realtime=v1',
        },
        body: offer.sdp,
      });
      const ansText = await answerRes.text();
      if (!answerRes.ok) throw new Error(`Realtime SDP failed: ${ansText}`);
      console.log('[SDP answer len]', ansText.length);

      const answer = { type: 'answer' as RTCSdpType, sdp: ansText };
      await pc.setRemoteDescription(answer);

      if (audioRef.current) {
        audioRef.current.muted = false;
        try { await audioRef.current.play(); } catch (e) { console.warn('[AUDIO PLAY BLOCKED]', e); }
      }

      // start VAD after audio is flowing
      const stopVad = await setupVAD();
      const prevCleanup = closeChainRef.current;
      closeChainRef.current = () => { try{ prevCleanup && prevCleanup() }catch{}; try{ stopVad && stopVad() }catch{} };

      setError(''); // clear transient errors

    } catch (e: any) {
      console.error('[startCall error]', e);
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
    cleanup();
    setConnected(false);
    setConnecting(false);
    if (userIntent) onClose?.();
  }

  useEffect(() => {
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

      <div className="grid grid-cols-[1fr] sm:grid-cols-[1.1fr_.9fr] gap-0">
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
            <audio ref={audioRef} autoPlay playsInline />
          </div>
        </div>
      </div>
    </div>
  );
}
