// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, User, Mic, MicOff, X, Loader2, ChevronDown, Search, Check, Lock } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   PROPS
────────────────────────────────────────────────────────────────────────── */
type ProsodyOpts = {
  fillerWords?: boolean;
  microPausesMs?: number;    // tiny pauses inside sentences
  phoneFilter?: boolean;
  turnEndPauseMs?: number;   // pause after user stops
  preSpeechDelayMs?: number; // delay before assistant starts speaking
};

type Props = {
  className?: string;

  model: string;
  systemPrompt: string;
  voiceName: string;
  assistantName: string;
  apiKey: string;

  ephemeralEndpoint?: string;

  onClose?: () => void;
  onError?: (e: any) => void;

  firstMode?: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg?: string;
  greetMode?: 'server' | 'client' | 'off';

  languageHint?: 'auto' | 'en' | 'de' | 'nl' | 'es' | 'ar';
  prosody?: ProsodyOpts;

  phoneFilter?: boolean;
  farMic?: boolean;
  ambience?: 'off' | 'kitchen' | 'cafe';
  ambienceLevel?: number;

  // humanizing extras
  breathing?: boolean;       // subtle breath noise
  breathingLevel?: number;   // 0..1 (default 0.08)

  // NEW: local fallback ASR so *your* words always appear
  clientASR?: 'off' | 'auto' | 'deepgram';
  deepgramKey?: string; // required if clientASR='deepgram'
};

/* ──────────────────────────────────────────────────────────────────────────
   THEME / CONSTANTS
────────────────────────────────────────────────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';
const HUMAN_LIKE = new Set(['alloy','verse','coral','amber','sage','juniper','opal','pebble','cobalt','ash','ballad','echo','shimmer','marin','cedar']);
const DEFAULT_VOICES = ['alloy','verse','coral','amber','sage','juniper'];
const FRIENDLY_TO_ID: Record<string,string> = {
  'Alloy (American)':'alloy','Verse (American)':'verse','Coral (British)':'coral','Amber (Australian)':'amber',
  Alloy:'alloy', Verse:'verse', Coral:'coral', Amber:'amber', Sage:'sage', Juniper:'juniper',
  Ash:'ash', Echo:'echo', Ballad:'ballad', Shimmer:'shimmer', Marin:'marin', Cedar:'cedar'
};

/* ──────────────────────────────────────────────────────────────────────────
   SELECT (same look)
────────────────────────────────────────────────────────────────────────── */
type Opt = { value: string; label: string; disabled?: boolean; iconLeft?: React.ReactNode };
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuTop
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const menuRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{left:number; top:number; width:number} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ left: r.left, top: r.bottom + 8, width: r.width });
  }, [open]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onResize = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ left: r.left, top: r.bottom + 8, width: r.width });
    };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={btnRef}
        type="button"
        onClick={() => { setOpen(v=>!v); setTimeout(()=>searchRef.current?.focus(),0); }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[8px] text-sm outline-none transition"
        style={{
          height:'var(--control-h)',
          background:'var(--vs-input-bg, #101314)',
          border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))',
          color:'var(--text)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted)' }} />
      </button>

      {open && IS_CLIENT ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100020] p-2"
          style={{
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'#101314',
            border:'1px solid rgba(255,255,255,.16)',
            borderRadius:10,
            boxShadow:'0 24px 64px rgba(0,0,0,.60), 0 8px 20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[8px]"
            style={{ background:'#101314', border:'1px solid rgba(255,255,255,.14)', color:'var(--text)' }}
          >
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              ref={searchRef}
              value={query}
              onChange={(e)=>setQuery(e.target.value)}
              placeholder="Filter…"
              className="w-full bg-transparent outline-none text-sm"
              style={{ color:'var(--text)' }}
            />
          </div>

          <div className="max-h-72 overflow-y-auto pr-1" style={{ scrollbarWidth:'thin' }}>
            {filtered.map(o => (
              <button
                key={o.value}
                disabled={!!o.disabled}
                onClick={()=>{ if (o.disabled) return; onChange(o.value); setOpen(false); }}
                className="w-full text-left text-sm px-2.5 py-2 rounded-[8px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
                style={{
                  color: o.disabled ? 'var(--text-muted)' : 'var(--text)',
                  background:'transparent',
                  border:'1px solid transparent',
                  cursor:o.disabled?'not-allowed':'pointer',
                }}
                onMouseEnter={(e)=>{ if (o.disabled) return; const el=e.currentTarget as HTMLButtonElement; el.style.background = 'rgba(0,255,194,0.08)'; el.style.border = '1px solid rgba(0,255,194,0.25)'; }}
                onMouseLeave={(e)=>{ const el=e.currentTarget as HTMLButtonElement; el.style.background = 'transparent'; el.style.border = '1px solid transparent'; }}
              >
                {o.disabled ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : (
                  <span className="inline-flex items-center justify-center w-3.5 h-3.5">
                    <Check className="w-3.5 h-3.5" style={{ opacity: o.value===value ? 1 : 0 }} />
                  </span>
                )}
                <span className="truncate">{o.label}</span>
                <span />
              </button>
            ))}
            {filtered.length===0 && (
              <div className="px-3 py-6 text-sm" style={{ color:'var(--text-muted)' }}>No matches.</div>
            )}
          </div>
        </div>,
        document.body
      ) : null}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
   TRANSCRIPT / UTILS
────────────────────────────────────────────────────────────────────────── */
type TranscriptRow = { id:string; who:'user'|'assistant'; text:string; at:number; done?:boolean };

const RAW_ID = /^[a-z0-9._-]{3,}$/i;
const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));
const fmtTime = (ts:number)=>new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

function languageNudge(lang: Props['languageHint']){
  if (lang==='auto') return 'Auto-detect and reply in the caller’s language (EN/DE/NL/ES/AR).';
  const map:Record<string,string>={
    en:'Reply in natural conversational English with gentle pauses.',
    de:'Antworte natürlich auf Deutsch mit sanften Pausen.',
    nl:'Antwoord in natuurlijk Nederlands met zachte pauzes.',
    es:'Responde en español conversacional con pausas suaves.',
    ar:'يرجى الرد بالعربية بأسلوب محادثة طبيعي مع توقفات لطيفة.',
  }; return map[lang||'auto']||'';
}

const resolveVoiceId = (key:string) => {
  const k = (key||'').trim();
  if (RAW_ID.test(k) && !FRIENDLY_TO_ID[k]) return k.toLowerCase();
  return FRIENDLY_TO_ID[k] || k || 'alloy';
};

const langToBCP47 = (hint: Props['languageHint']) => {
  switch (hint) {
    case 'nl': return 'nl-NL';
    case 'de': return 'de-DE';
    case 'es': return 'es-ES';
    case 'ar': return 'ar';
    case 'en': return 'en-US';
    default:   return undefined;
  }
};

/* ──────────────────────────────────────────────────────────────────────────
   AUDIO ENHANCERS (phone-ish polish + optional ambience + breathing)
────────────────────────────────────────────────────────────────────────── */
function createSaturator(ac: AudioContext, drive=1.05){
  const sh=ac.createWaveShaper(); const curve=new Float32Array(1024);
  for(let i=0;i<curve.length;i++){ const x=(i/(curve.length-1))*2-1; curve[i]=Math.tanh(x*drive); }
  sh.curve=curve; sh.oversample='2x'; return sh;
}
function createAmbience(ac: AudioContext, kind:'kitchen'|'cafe', level=0.08){
  const src=ac.createBufferSource(); const len=ac.sampleRate*2;
  const buf=ac.createBuffer(1,len,ac.sampleRate); const d=buf.getChannelData(0); let prev=0;
  for(let i=0;i<len;i++){ const w=Math.random()*2-1; prev=prev*0.97+w*0.03; d[i]=prev; }
  src.buffer=buf; src.loop=true;
  const band=ac.createBiquadFilter(); band.type='bandpass'; band.frequency.value=kind==='kitchen'?950:350; band.Q.value=kind==='kitchen'?0.9:0.6;
  const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=120;
  const g=ac.createGain(); g.gain.value=clamp01(level)*0.18;
  src.connect(band); band.connect(hp); hp.connect(g); g.connect(ac.destination);
  src.start();
  return ()=>{ try{src.stop()}catch{}; [src,band,hp,g].forEach(n=>{try{(n as any).disconnect()}catch{}}); };
}

function createBreather(ac: AudioContext, level=0.08){
  // Low, band-limited noise modulated at ~0.24 Hz (inhale/exhale)
  const noise = ac.createBufferSource();
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let prev=0;
  for (let i=0;i<len;i++){ const w=Math.random()*2-1; prev=prev*0.98 + w*0.02; d[i]=prev; }
  noise.buffer = buf; noise.loop = true;

  const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=380; bp.Q.value=0.6;
  const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=140;

  const gain = ac.createGain(); gain.gain.value = clamp01(level) * 0.15; // very subtle
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.24;
  const lfoGain = ac.createGain(); lfoGain.gain.value = clamp01(level) * 0.12;

  lfo.connect(lfoGain); lfoGain.connect(gain.gain);
  noise.connect(bp); bp.connect(hp); hp.connect(gain);
  noise.start(); lfo.start();

  return { node: gain, stop: ()=>{ try{noise.stop()}catch{}; try{lfo.stop()}catch{}; [bp,hp,lfoGain,noise,gain].forEach(n=>{try{(n as any).disconnect()}catch{}}); } };
}

async function attachProcessedAudio(
  audioEl:HTMLAudioElement,
  remote:MediaStream,
  opts:{
    phoneFilter:boolean; farMic:boolean;
    ambience:'off'|'kitchen'|'cafe'; ambienceLevel:number;
    breathing:boolean; breathingLevel:number;
  }
){
  const { phoneFilter, farMic, ambience, ambienceLevel, breathing, breathingLevel } = opts;

  // Simple path
  if(!phoneFilter && !breathing){
    (audioEl as any).srcObject=remote; await audioEl.play().catch(()=>{}); return ()=>{};
  }

  const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
  const src=ac.createMediaStreamSource(remote);

  // Base polish
  const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=70;
  const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=12000;
  const presence=ac.createBiquadFilter(); presence.type='peaking'; presence.frequency.value=2800; presence.Q.value=0.9; presence.gain.value=1.6;
  const body=ac.createBiquadFilter(); body.type='lowshelf'; body.frequency.value=160; body.gain.value=1.2;
  const sat=createSaturator(ac,1.05);
  const comp=ac.createDynamicsCompressor();
  comp.threshold.value=-20; comp.knee.value=18; comp.ratio.value=1.7; comp.attack.value=0.008; comp.release.value=0.18;

  const dry=ac.createGain(); dry.gain.value=1.0;
  const merge=ac.createGain();
  const dest=ac.createMediaStreamDestination();

  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dry); dry.connect(merge);

  // Breathing (auto-gated)
  let breathStop: null | (()=>void) = null;
  if (breathing){
    const { node, stop } = createBreather(ac, breathingLevel);
    breathStop = stop;
    const breathGain = ac.createGain(); breathGain.gain.value = breathingLevel * 0.9;
    node.connect(breathGain); breathGain.connect(merge);

    // Gate: when assistant is loud, fade breath down; when silent, fade up
    const an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.85;
    comp.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const gate = ()=> {
      an.getByteFrequencyData(buf);
      let sum=0; for(let i=0;i<buf.length;i++) sum += buf[i];
      const loud = sum / (buf.length*255);
      const target = loud > 0.08 ? 0.02 : (breathingLevel * 0.9);
      const now = ac.currentTime;
      breathGain.gain.setTargetAtTime(target, now, 0.12);
      requestAnimationFrame(gate);
    };
    requestAnimationFrame(gate);
  }

  merge.connect(dest);
  (audioEl as any).srcObject=dest.stream;
  await audioEl.play().catch(()=>{});

  let ambClean:null|(()=>void)=null; if(ambience!=='off') ambClean=createAmbience(ac,ambience,ambienceLevel);

  return ()=>{ [src,hp,lp,presence,body,sat,comp,merge,dry].forEach(n=>{try{(n as any).disconnect()}catch{}}); try{ambClean&&ambClean()}catch{}; try{breathStop&&breathStop()}catch{}; try{ac.close()}catch{}; };
}

/* ──────────────────────────────────────────────────────────────────────────
   CLIENT-SIDE ASR (Web Speech / Deepgram)
────────────────────────────────────────────────────────────────────────── */
function startWebSpeechASR(opts: { lang?: string; onDelta: (t: string)=>void; onFinal: (t: string)=>void }) {
  const W: any = window as any;
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  if (opts.lang) rec.lang = opts.lang;

  let partial = '';
  rec.onresult = (e: any) => {
    let interim = '';
    let finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim += res[0].transcript;
    }
    if (interim && interim !== partial) {
      partial = interim;
      opts.onDelta(interim);
    }
    if (finalText) {
      partial = '';
      opts.onFinal(finalText);
    }
  };

  let stopped = false;
  rec.onerror = () => {};
  rec.onend = () => { if (!stopped) { try { rec.start(); } catch {} } };

  try { rec.start(); } catch {}
  return () => { stopped = true; try { rec.stop(); } catch {} };
}

function startDeepgramASR(opts: {
  lang?: string;
  deepgramKey: string;
  stream: MediaStream;
  onDelta: (t: string)=>void;
  onFinal: (t: string)=>void;
}) {
  const url = 'wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true'
            + (opts.lang ? `&language=${encodeURIComponent(opts.lang)}` : '');
  const ws = new WebSocket(url, ['token', opts.deepgramKey]);

  let recorder: MediaRecorder | null = null;

  ws.onopen = () => {
    recorder = new MediaRecorder(opts.stream, { mimeType: 'audio/webm;codecs=opus' });
    recorder.ondataavailable = (e) => { if (e.data.size > 0 && ws.readyState === ws.OPEN) ws.send(e.data); };
    recorder.start(250);
  };

  ws.onmessage = (ev) => {
    try {
      const data = JSON.parse(ev.data);
      const alt = data?.channel?.alternatives?.[0];
      if (!alt) return;
      const transcript = alt.transcript || '';
      if (!transcript) return;
      if (data.type === 'Results' && data.is_final) opts.onFinal(transcript);
      else opts.onDelta(transcript);
    } catch {}
  };

  const stop = () => { try { recorder?.stop(); } catch {}; try { ws.close(); } catch {}; };
  ws.onerror = stop; ws.onclose = stop;
  return stop;
}

/* ──────────────────────────────────────────────────────────────────────────
   COMPONENT
────────────────────────────────────────────────────────────────────────── */
export default function WebCallButton({
  className,
  model,
  systemPrompt,
  voiceName,
  assistantName,
  apiKey,
  ephemeralEndpoint = '/api/voice/ephemeral',
  onClose,
  onError,
  firstMode='User speaks first',
  firstMsg='Hello.',
  greetMode='server',
  languageHint='auto',
  prosody,
  phoneFilter=false,
  farMic=false,
  ambience='off',
  ambienceLevel=0.08,
  breathing=true,
  breathingLevel=0.08,

  // NEW defaults
  clientASR='auto',
  deepgramKey,
}: Props){
  const [connecting,setConnecting]=useState(false);
  const [connected,setConnected]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState<string>('');

  const [voices,setVoices]=useState<string[]>([]);
  const [selectedVoice,setSelectedVoice]=useState<string>('');
  const voiceId = useMemo(()=> resolveVoiceId(selectedVoice || voiceName), [selectedVoice, voiceName]);

  const [log,setLog]=useState<TranscriptRow[]>([]);
  const logRef=useRef<TranscriptRow[]>([]);
  useEffect(()=>{ logRef.current=log; },[log]);

  const audioRef=useRef<HTMLAudioElement|null>(null);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const micStreamRef=useRef<MediaStream|null>(null);
  const dcRef=useRef<RTCDataChannel|null>(null);

  const closeChainRef=useRef<null|(()=>void)>(null);
  const vadLoopRef=useRef<number|null>(null);
  const baseInstructionsRef=useRef<string>('');
  const scrollerRef=useRef<HTMLDivElement|null>(null);
  const sawAssistantDeltaRef=useRef<boolean>(false);

  // pacing
  const lastRestRef=useRef<number>(0);

  // local ASR
  const asrStopRef = useRef<null | (()=>void)>(null);

  useEffect(()=>{ const el=scrollerRef.current; if(!el) return; el.scrollTop=el.scrollHeight; },[log,connecting,connected]);

  // fetch voices (filter to human-like)
  useEffect(()=>{
    let cancelled=false;
    const fallback = Array.from(new Set([voiceName,...DEFAULT_VOICES].filter(Boolean))) as string[];
    (async()=>{
      try{
        const r=await fetch('https://api.openai.com/v1/voices',{ headers:{ Authorization:`Bearer ${apiKey}` }});
        if(!r.ok) throw new Error(String(r.status));
        const j=await r.json();
        let ids:Array<string>=Array.isArray(j?.data)? j.data.map((v:any)=>v?.id).filter(Boolean):[];
        ids=ids.filter(id=>HUMAN_LIKE.has(id)); if(!ids.length) ids=fallback;
        if(!cancelled){ setVoices(ids); setSelectedVoice(ids.includes(resolveVoiceId(voiceName))? resolveVoiceId(voiceName) : (ids[0]||'alloy')); }
      }catch{
        if(!cancelled){ setVoices(fallback); setSelectedVoice(resolveVoiceId(voiceName) || fallback[0]||'alloy'); }
      }
    })();
    return()=>{ cancelled=true; };
  },[apiKey, voiceName]);

  const upsert=(id:string, who:TranscriptRow['who'], patch:Partial<TranscriptRow>|((p?:TranscriptRow)=>Partial<TranscriptRow>))=>{
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===id);
      if(i===-1){ const base:TranscriptRow={ id, who, text:'', at:Date.now(), done:false };
        const p=typeof patch==='function' ? (patch as any)(undefined) : patch;
        return [...prev,{...base,...p}];
      }
      const next=[...prev]; const p=typeof patch==='function' ? (patch as any)(next[i]):patch; next[i]={...next[i],...p}; return next;
    });
  };
  const addLine=(who:TranscriptRow['who'], text:string)=>{
    const id=`${who}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    setLog(prev=>[...prev,{id,who,text,at:Date.now(),done:true}]);
  };
  const safeSend=(dc:RTCDataChannel|null, payload:any)=>{
    if(!dc||dc.readyState!=='open') return; try{ dc.send(JSON.stringify(payload)); }catch{}
  };

  // minimal mic VAD ducking (drops TTS volume while user speaks)
  async function setupVAD(){
    try{
      const mic=micStreamRef.current; if(!mic) return;
      const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
      const src=ac.createMediaStreamSource(mic); const an=ac.createAnalyser(); an.fftSize=512; an.smoothingTimeConstant=0.88;
      src.connect(an);
      const buf=new Uint8Array(an.frequencyBinCount);
      const loop=()=>{ an.getByteFrequencyData(buf); let sum=0; for(let i=0;i<buf.length;i++) sum+=buf[i]*i;
        const loud=sum/(buf.length*buf.length);
        if(loud>0.5){ if(audioRef.current) audioRef.current.volume=0.35; } else { if(audioRef.current) audioRef.current.volume=1.0; }
        vadLoopRef.current=requestAnimationFrame(loop);
      };
      vadLoopRef.current=requestAnimationFrame(loop);
      return ()=>{ try{ac.close()}catch{} };
    }catch{ return ()=>{}; }
  }

  // Duck audio for ~500ms at sentence boundaries
  function restBetweenSentences(delta: string){
    if(!audioRef.current) return;
    if(!/[.!?…]\s*$/.test(delta)) return;
    const now=Date.now();
    if(now - lastRestRef.current < 700) return;
    lastRestRef.current = now;
    const el = audioRef.current;
    const prev = el.volume;
    el.volume = 0.0;
    setTimeout(()=>{ el.volume = prev || 1.0; }, 500);
  }

  async function startCall(){
    setError('');
    if(!apiKey){ setError('No API key selected.'); onError?.('No API key'); return; }
    try{
      setConnecting(true);

      // 1) ephemeral token
      const sessionRes=await fetch(ephemeralEndpoint,{
        method:'POST', headers:{ 'Content-Type':'application/json', 'X-OpenAI-Key':apiKey },
        body:JSON.stringify({ model, voiceName:voiceId, assistantName, systemPrompt }),
      });
      if(!sessionRes.ok) throw new Error(`Ephemeral token error: ${await sessionRes.text()}`);
      const session=await sessionRes.json(); const EPHEMERAL=session?.client_secret?.value;
      if(!EPHEMERAL) throw new Error('Missing ephemeral client_secret.value');

      // 2) mic
      const mic=await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation:true, noiseSuppression:true, autoGainControl:true }
      }); micStreamRef.current=mic;

      // 🔊 LOCAL FALLBACK ASR — print your speech immediately
      try {
        if (asrStopRef.current) { try { asrStopRef.current(); } catch {}; asrStopRef.current = null; }
        const lang = langToBCP47(languageHint);

        const onDelta = (txt: string) => {
          upsert('user_local', 'user', (prev) => ({ text: txt, done: false, at: prev?.at || Date.now() }));
        };
        const onFinal = (txt: string) => {
          upsert('user_local', 'user', (prev) => ({ text: (txt || prev?.text || '').trim(), done: true, at: prev?.at || Date.now() }));
        };

        if (clientASR === 'deepgram') {
          if (!deepgramKey) throw new Error('Missing deepgramKey');
          const stop = startDeepgramASR({ lang, deepgramKey: deepgramKey!, stream: mic, onDelta, onFinal });
          if (stop) asrStopRef.current = stop;
        } else if (clientASR === 'auto') {
          const stop = startWebSpeechASR({ lang, onDelta, onFinal });
          if (stop) asrStopRef.current = stop;
        }
      } catch {}

      // 3) peer
      const pc=new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] }); pcRef.current=pc;
      const remote=new MediaStream();
      pc.ontrack=async (e)=>{
        e.streams[0]?.getAudioTracks().forEach(t=>remote.addTrack(t));
        if(!audioRef.current) return;
        if(closeChainRef.current){ try{closeChainRef.current()}catch{}; closeChainRef.current=null; }
        const usePhone = prosody?.phoneFilter ?? phoneFilter;
        closeChainRef.current=await attachProcessedAudio(audioRef.current, remote, {
          phoneFilter: !!usePhone,
          farMic,
          ambience,
          ambienceLevel,
          breathing: !!breathing,
          breathingLevel: clamp01(breathingLevel ?? 0.08)
        });
      };
      const sendTrack=mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio',{ direction:'recvonly' });

      // 4) data channel
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        const preDelay = Math.max(300, prosody?.preSpeechDelayMs ?? 500);
        const style = [
          systemPrompt || '',
          languageNudge(languageHint),
          prosody?.fillerWords ? 'Use mild, natural disfluencies.' : '',
          prosody?.microPausesMs ? `Allow micro pauses (~${prosody.microPausesMs} ms).` : '',
          `Before starting to speak, pause about ${preDelay} ms as if thinking.`,
          `Between sentences, take a short breath and wait about 500 ms before continuing.`,
          (prosody?.turnEndPauseMs ? `Wait ~${prosody.turnEndPauseMs} ms of silence before replying.` : 'Wait ~200 ms of silence before replying.'),
        ].filter(Boolean).join('\n\n');
        baseInstructionsRef.current = style;

        // ✅ session config (TRANSCRIPTION ON + robust VAD)
        safeSend(dc,{ type:'session.update', session:{
          instructions: baseInstructionsRef.current,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities:['audio','text'],
          input_audio_transcription:{
            enabled:true,
            provider:'openai',
            model:'gpt-4o-mini-transcribe',
            ...(languageHint && languageHint!=='auto' ? { language: languageHint } : {}),
            fallback_models:['whisper-1']
          },
          turn_detection:{
            type:'server_vad',
            threshold:0.5,
            prefix_silence_ms: 80,
            silence_duration_ms: Math.max(180, prosody?.turnEndPauseMs ?? 200),
          },
        }});

        // Optional greeting (respects pre-speech delay)
        const wantClientGreeting =
          greetMode==='client' || (greetMode==='server' && firstMode==='Assistant speaks first');

        const greet = () => {
          const lines=(firstMsg||'Hello.').split(/\r?\n|\|/g).map(s=>s.trim()).filter(Boolean).slice(0,6);
          setTimeout(()=>{
            for(const ln of lines){
              safeSend(dc,{ type:'response.create', response:{ modalities:['audio','text'], instructions: ln }});
            }
          }, preDelay);
        };

        if (greetMode==='client') {
          greet();
        } else if (wantClientGreeting) {
          setTimeout(()=>{ if (!sawAssistantDeltaRef.current) greet(); }, 1200);
        }
      };

      // 5) events — ASSISTANT + USER transcripts (normalize names)
      dc.onmessage=(ev)=>{
        let raw:any;
        try{ raw=JSON.parse(ev.data); }catch{ return; }
        const t0=String(raw?.type||'');
        const t=t0.replace(/^realtime\./,''); // normalize

        /* ASSISTANT STREAM — used only to trigger rests */
        if(t==='response.output_text.delta'){
          sawAssistantDeltaRef.current = true;
          const id=raw?.response_id||raw?.id||'assistant_current';
          const d=String(raw?.delta||'');
          restBetweenSentences(d);
          upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+d }));
        }
        if(t==='response.output_text' && typeof raw?.text==='string'){
          sawAssistantDeltaRef.current = true;
          addLine('assistant', raw.text);
        }
        if(t==='response.audio_transcript.delta'){
          const id=raw?.response_id||raw?.id
