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
  microPausesMs?: number;
  phoneFilter?: boolean;
  turnEndPauseMs?: number;
  preSpeechDelayMs?: number;
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
  breathing?: boolean;
  breathingLevel?: number;

  // Client-side ASR so YOUR transcript always appears and supports multi-language
  clientASR?: 'off' | 'auto' | 'deepgram';
  deepgramKey?: string;
};

/* ──────────────────────────────────────────────────────────────────────────
   THEME / CONSTANTS
────────────────────────────────────────────────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

// Filter OUT the coral voice per your note
const HUMAN_LIKE = new Set([
  'alloy','verse', /* 'coral', */ 'amber','sage','juniper','opal','pebble','cobalt','ash','ballad','echo','shimmer','marin','cedar'
]);
const DEFAULT_VOICES = ['alloy','verse','amber','sage','juniper']; // coral removed

const FRIENDLY_TO_ID: Record<string,string> = {
  'Alloy (American)':'alloy','Verse (American)':'verse','Amber (Australian)':'amber',
  Alloy:'alloy', Verse:'verse', Amber:'amber', Sage:'sage', Juniper:'juniper',
  Ash:'ash', Echo:'echo', Ballad:'ballad', Shimmer:'shimmer', Marin:'marin', Cedar:'cedar',
  // Coral intentionally not mapped
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
          background:'#101314',
          border:'1px solid rgba(255,255,255,.14)',
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
   (word-level handling: interim REPLACES, final COMMITS)
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
  // band-limited noise + slow LFO → breathy ambience (auto-gated)
  const noise = ac.createBufferSource();
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let prev=0;
  for (let i=0;i<len;i++){ const w=Math.random()*2-1; prev=prev*0.98 + w*0.02; d[i]=prev; }
  noise.buffer = buf; noise.loop = true;

  const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=380; bp.Q.value=0.6;
  const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=140;

  const gain = ac.createGain(); gain.gain.value = clamp01(level) * 0.15;
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
  const { phoneFilter, ambience, ambienceLevel, breathing, breathingLevel } = opts;

  if(!phoneFilter && !breathing){
    (audioEl as any).srcObject=remote; await audioEl.play().catch(()=>{}); return ()=>{};
  }

  const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
  const src=ac.createMediaStreamSource(remote);

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

  // Breathing bed (auto-dips when speech is loud)
  let breathStop: null | (()=>void) = null;
  if (breathing){
    const { node, stop } = createBreather(ac, breathingLevel ?? 0.08);
    breathStop = stop;
    const breathGain = ac.createGain(); breathGain.gain.value = clamp01(breathingLevel ?? 0.08) * 0.9;
    node.connect(breathGain); breathGain.connect(merge);

    const an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.85;
    comp.connect(an);
    const buf = new Uint8Array(an.frequencyBinCount);
    const gate = ()=> {
      an.getByteFrequencyData(buf);
      let sum=0; for(let i=0;i<buf.length;i++) sum += buf[i];
      const loud = sum / (buf.length*255);
      const target = loud > 0.08 ? 0.02 : (clamp01(breathingLevel ?? 0.08) * 0.9);
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
   LOCAL CLIENT ASR (so your words always show)
────────────────────────────────────────────────────────────────────────── */
const langToBCP47 = (hint: Props['languageHint']) => {
  switch (hint) {
    case 'nl': return 'nl-NL';
    case 'de': return 'de-DE';
    case 'es': return 'es-ES';
    case 'ar': return 'ar';      // Deepgram accepts 'ar' (modern standard); WebSpeech uses UA locale variants.
    case 'en': return 'en-US';
    default:   return undefined; // auto
  }
};

function startWebSpeechASR(opts: { lang?: string; onInterim: (t: string)=>void; onFinal: (t: string)=>void }) {
  const W: any = window as any;
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SR) return null;

  const rec = new SR();
  rec.continuous = true;
  rec.interimResults = true;
  if (opts.lang) rec.lang = opts.lang;

  rec.onresult = (e: any) => {
    let interim = '';
    let finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim = res[0].transcript; // REPLACE, don't accumulate
    }
    if (interim) opts.onInterim(interim);
    if (finalText) opts.onFinal(finalText);
  };

  rec.onerror = () => {};
  let stopped = false;
  rec.onend = () => { if (!stopped) { try { rec.start(); } catch {} } };

  try { rec.start(); } catch {}
  return () => { stopped = true; try { rec.stop(); } catch {} };
}

function startDeepgramASR(opts: {
  lang?: string;
  deepgramKey: string;
  stream: MediaStream;
  onInterim: (t: string)=>void;
  onFinal: (t: string)=>void;
}) {
  const url = 'wss://api.deepgram.com/v1/listen?punctuate=true&interim_results=true' + (opts.lang ? `&language=${encodeURIComponent(opts.lang)}` : '');
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
      const transcript = alt?.transcript || '';
      if (!transcript) return;
      if (data.is_final) opts.onFinal(transcript);
      else opts.onInterim(transcript); // REPLACE, not append
    } catch {}
  };

  const stop = () => {
    try { recorder?.stop(); } catch {}
    try { ws.close(); } catch {}
  };
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
  const scrollerRef=useRef<HTMLDivElement|null>(null);
  const sawAssistantDeltaRef=useRef<boolean>(false);

  // Per-turn mapping + interim buffers for word-level correctness
  const userTurnIdRef = useRef<string | null>(null);
  const serverToLocalUser = useRef<Map<string,string>>(new Map());
  const userInterimRef = useRef<Map<string,{final:string; interim:string}>>(new Map()); // NEW
  const asrStopRef=useRef<null|(()=>void)>(null);

  const lastRestRef=useRef<number>(0);

  useEffect(()=>{ const el=scrollerRef.current; if(!el) return; el.scrollTop=el.scrollHeight; },[log,connecting,connected]);

  // fetch voices (filter coral)
  useEffect(()=>{
    let cancelled=false;
    const fallback = Array.from(new Set([voiceName,...DEFAULT_VOICES].filter(Boolean))) as string[];
    (async()=>{
      try{
        const r=await fetch('https://api.openai.com/v1/voices',{ headers:{ Authorization:`Bearer ${apiKey}` }});
        if(!r.ok) throw new Error(String(r.status));
        const j=await r.json();
        let ids:Array<string>=Array.isArray(j?.data)? j.data.map((v:any)=>v?.id).filter(Boolean):[];
        ids=ids.filter(id=>HUMAN_LIKE.has(id) && id!=='coral'); if(!ids.length) ids=fallback;
        if(!cancelled){ setVoices(ids); setSelectedVoice(ids.includes(resolveVoiceId(voiceName))? resolveVoiceId(voiceName) : (ids[0]||'alloy')); }
      }catch{
        if(!cancelled){ setVoices(fallback); setSelectedVoice(resolveVoiceId(voiceName) || fallback[0]||'alloy'); }
      }
    })();
    return()=>{ cancelled=true; };
  },[apiKey, voiceName]);

  /* ── helpers to guarantee new bubble per turn + word-level interim ── */
  const newId = (p:'user'|'assistant') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;

  const beginUserTurn = (serverId?:string) => {
    const id = newId('user');
    userTurnIdRef.current = id;
    if (serverId) serverToLocalUser.current.set(serverId, id);
    userInterimRef.current.set(id, { final:'', interim:'' });
    setLog(prev => [...prev, { id, who:'user', text:'', at:Date.now(), done:false }]);
    return id;
  };

  // Replace interim, commit final
  const updateUserInterim = (txt:string, serverId?:string) => {
    let id = serverId ? serverToLocalUser.current.get(serverId) : userTurnIdRef.current;
    if (!id) id = beginUserTurn(serverId);
    const buf = userInterimRef.current.get(id) || { final:'', interim:'' };
    buf.interim = txt; // REPLACE (no duplications)
    userInterimRef.current.set(id, buf);
    const display = (buf.final + ' ' + buf.interim).replace(/\s+/g,' ').trim();
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===id);
      if(i===-1) return [...prev,{ id, who:'user', text:display, at:Date.now(), done:false }];
      const next=[...prev]; next[i]={...next[i], text:display, done:false}; return next;
    });
  };

  const commitUserFinal = (txt?:string, serverId?:string) => {
    const id = serverId ? (serverToLocalUser.current.get(serverId) || userTurnIdRef.current) : userTurnIdRef.current;
    if (!id) return;
    const buf = userInterimRef.current.get(id) || { final:'', interim:'' };
    if (txt) buf.final = (buf.final + ' ' + txt).replace(/\s+/g,' ').trim();
    else if (buf.interim) buf.final = (buf.final + ' ' + buf.interim).replace(/\s+/g,' ').trim();
    buf.interim = '';
    userInterimRef.current.set(id, buf);
    const display = buf.final;
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===id);
      if(i===-1) return prev;
      const next=[...prev]; next[i]={...next[i], text:display, done:true}; return next;
    });
    if (serverId) serverToLocalUser.current.delete(serverId);
    userTurnIdRef.current = null;
  };

  const addAssistantDelta = (respId:string, delta:string) => {
    // Same “replace interim” feel for assistant by soft-pausing volume at sentence ends
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===respId);
      if(i===-1){ return [...prev,{ id:respId, who:'assistant', text:delta, at:Date.now(), done:false }]; }
      const next=[...prev]; next[i]={...next[i], text:(next[i].text||'')+delta}; return next;
    });
  };
  const endAssistantTurn = (respId:string) => {
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===respId);
      if(i===-1) return prev;
      const next=[...prev]; next[i]={...next[i], done:true}; return next;
    });
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

  // Duck audio ~500ms at sentence boundaries (breath / rest)
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

      // 2.5) LOCAL ASR ⇒ interim replace + final commit
      try {
        const lang = langToBCP47(languageHint);
        if (asrStopRef.current) { try { asrStopRef.current(); } catch {} asrStopRef.current = null; }
        let started = false;
        const ensureStart = () => { if (!started) { beginUserTurn(); started = true; } };
        const onInterim = (txt: string) => { ensureStart(); updateUserInterim(txt); };
        const onFinal = (txt: string) => { ensureStart(); commitUserFinal(txt); started=false; };

        if (clientASR === 'deepgram' && deepgramKey) {
          const stop = startDeepgramASR({ lang, deepgramKey, stream: mic, onInterim, onFinal });
          if (stop) asrStopRef.current = stop;
        } else if (clientASR === 'auto') {
          const stop = startWebSpeechASR({ lang, onInterim, onFinal });
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

      // push mic
      pc.addTrack(mic.getAudioTracks()[0], mic);
      pc.addTransceiver('audio',{ direction:'recvonly' });

      // 4) data channel
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        // Defaults to keep it human without overdoing filler words
        const preDelay = Math.max(300, prosody?.preSpeechDelayMs ?? 550);
        const style = [
          systemPrompt || '',
          languageNudge(languageHint),
          (prosody?.fillerWords ?? true) ? 'Use mild, natural disfluencies (“uh”, “um”, “like”) occasionally. Do not overuse.' : '',
          `Allow micro pauses (~${prosody?.microPausesMs ?? 120} ms) inside sentences.`,
          `Before starting to speak, pause about ${preDelay} ms as if thinking.`,
          `Between sentences, take a light breath and wait ~500 ms before continuing.`,
          (prosody?.turnEndPauseMs ? `Wait ~${prosody.turnEndPauseMs} ms of silence before replying.` : 'Wait ~220 ms of silence before replying.'),
        ].filter(Boolean).join('\n\n');

        // If languageHint is 'auto' we omit language field for server ASR so it can detect Dutch/Arabic/Spanish/German.
        const input_audio_transcription: any = {
          enabled:true,
          provider:'openai',
          model:'gpt-4o-mini-transcribe',
          fallback_models:['whisper-1']
        };
        if (languageHint && languageHint!=='auto') input_audio_transcription.language = languageHint;

        safeSend(dc,{ type:'session.update', session:{
          instructions: style,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities:['audio','text'],
          input_audio_transcription,
          turn_detection:{
            type:'server_vad',
            threshold:0.5,
            prefix_silence_ms: 80,
            silence_duration_ms: Math.max(180, prosody?.turnEndPauseMs ?? 220),
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

      // 5) events — ASSISTANT + USER transcripts (word-level)
      dc.onmessage=(ev)=>{
        let raw:any;
        try{ raw=JSON.parse(ev.data); }catch{ return; }
        const t=String(raw?.type||'').replace(/^realtime\./,'');

        /* ASSISTANT STREAM */
        if(t==='response.output_text.delta'){
          sawAssistantDeltaRef.current = true;
          const id=raw?.response_id||raw?.id||newId('assistant');
          const d=String(raw?.delta||'');
          restBetweenSentences(d);
          addAssistantDelta(id,d);
          return;
        }
        if(t==='response.audio_transcript.delta'){
          const id=raw?.response_id||raw?.id||newId('assistant');
          const d=String(raw?.delta||''); restBetweenSentences(d);
          addAssistantDelta(id,d); return;
        }
        if(t==='response.audio_transcript.completed' || t==='response.completed' || t==='response.stop'){
          const id=raw?.response_id||raw?.id; if(id) endAssistantTurn(id); return;
        }
        if (t==='response.output_text' && typeof raw?.text==='string'){
          setLog(prev=>[...prev,{ id:newId('assistant'), who:'assistant', text:raw.text, at:Date.now(), done:true }]); return;
        }
        if (t==='conversation.item.created' && raw?.item?.type==='message' && raw?.item?.role==='assistant') {
          const text=(raw?.item?.content||[]).map((c:any)=>c?.text||c?.transcript||'').join(' ').trim();
          if (text) setLog(prev=>[...prev,{ id:newId('assistant'), who:'assistant', text, at:Date.now(), done:true }]);
          return;
        }

        /* USER (SERVER) — interim replace, final commit */
        if (/^input_audio_buffer\.speech_started$|^input_speech\.start$/.test(t)) { beginUserTurn(raw?.id); return; }
        if (/^input_audio_buffer\.speech_ended$|^input_speech\.end$/.test(t))   { commitUserFinal(undefined, raw?.id); return; }

        if (t==='transcript.delta'){ updateUserInterim(String(raw?.delta||''), raw?.transcript_id||raw?.id); return; }
        if (t==='transcript.completed'){ commitUserFinal(undefined, raw?.transcript_id||raw?.id); return; }

        if (t==='conversation.item.input_audio_transcript.delta'){ updateUserInterim(String(raw?.delta||''), raw?.item_id||raw?.id); return; }
        if (t==='conversation.item.input_audio_transcript.completed' || t==='conversation.item.completed'){ commitUserFinal(undefined, raw?.item_id||raw?.id); return; }

        if (t==='conversation.item.input_text.delta'){ updateUserInterim(String(raw?.delta||''), raw?.item_id||raw?.id); return; }
        if (t==='conversation.item.input_text.completed'){ commitUserFinal(undefined, raw?.item_id||raw?.id); return; }

        if (t==='input_audio_buffer.transcript.delta' || t==='input_audio_buffer.transcription.delta'){
          updateUserInterim(String(raw?.delta||''), raw?.transcript_id||raw?.id); return;
        }
        if (t==='input_audio_buffer.transcript.completed' || t==='input_audio_buffer.transcription.completed'){
          commitUserFinal(undefined, raw?.transcript_id||raw?.id); return;
        }

        if (t==='input_audio_transcript.delta' || t==='input_audio_transcription.delta' || t==='input_transcription.delta'){
          updateUserInterim(String(raw?.delta||''), raw?.id); return;
        }
        if (t==='input_audio_transcript.completed' || t==='input_audio_transcription.completed'
            || t==='input_transcription.completed' || t==='transcript.final'){
          commitUserFinal(undefined, raw?.id); return;
        }

        // Single-shot text
        if ((/transcript|transcription|input_audio_buffer|input_text/.test(t)) && typeof raw?.text==='string' && !raw?.delta){
          // treat as final
          beginUserTurn(); commitUserFinal(String(raw.text||'')); return;
        }
      };

      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='connected'){ setConnected(true); setConnecting(false); }
        else if(['disconnected','failed','closed'].includes(pc.connectionState)){ endCall(false); }
      };
      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s==='failed' || s==='disconnected') {
          setError('Network hiccup – reconnecting…');
        }
      };

      // 6) SDP
      const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
      const url=`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`;
      const answerRes=await fetch(url,{
        method:'POST',
        headers:{ Authorization:`Bearer ${EPHEMERAL}`, 'Content-Type':'application/sdp', 'OpenAI-Beta':'realtime=v1' },
        body: offer.sdp,
      });
      if(!answerRes.ok) throw new Error(`Realtime SDP failed: ${await answerRes.text()}`);
      const answer={ type:'answer' as RTCSdpType, sdp: await answerRes.text() };
      await pc.setRemoteDescription(answer);

      if(audioRef.current){ audioRef.current.muted=false; audioRef.current.play().catch(()=>{}); }

      const stopVad=await setupVAD();
      const prevClean=closeChainRef.current;
      closeChainRef.current=()=>{ try{prevClean&&prevClean()}catch{}; try{stopVad&&stopVad()}catch{} };
    }catch(e:any){
      setConnecting(false); setConnected(false);
      const msg = e?.message || 'Failed to start call.';
      setError(msg); onError?.(e);
      cleanup();
    }
  }

  function toggleMute(){
    const tracks=micStreamRef.current?.getAudioTracks()||[];
    const next=!muted; tracks.forEach(t=>t.enabled=!next); setMuted(next);
  }
  function cleanup(){
    if(vadLoopRef.current) cancelAnimationFrame(vadLoopRef.current);
    vadLoopRef.current=null;
    try{ asrStopRef.current && asrStopRef.current(); }catch{}
    asrStopRef.current = null;
    try{ dcRef.current?.close(); }catch{}
    dcRef.current = null;
    try{ pcRef.current?.close(); }catch{}
    pcRef.current=null;
    try{ micStreamRef.current?.getTracks()?.forEach(t=>t.stop()); }catch{}
    micStreamRef.current=null;
    try{ closeChainRef.current && closeChainRef.current(); }catch{}
    closeChainRef.current = null;
  }
  function endCall(userIntent=true){ cleanup(); setConnected(false); setConnecting(false); if(userIntent) onClose?.(); }

  useEffect(()=>{ startCall(); return ()=>{ cleanup(); }; // eslint-disable-next-line
  },[voiceId]);

  /* ────────────────────────────────────────────────────────────────────────
     UI — Slide-over panel (right) with lighter backdrop on the left
  ───────────────────────────────────────────────────────────────────────── */
  const backdrop = (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 100008,
        // More transparent at the left so you can see the section near the sidebar
        background: 'linear-gradient(90deg, rgba(10,13,15,0.35) 0%, rgba(10,13,15,0.6) 32%, rgba(10,13,15,0.88) 60%, rgba(10,13,15,0.94) 100%)'
      }}
      onClick={()=>endCall(true)}
      aria-hidden
    />
  );

  const header = (
    <div className="va-head" style={{ zIndex: 100011 }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="inline-grid place-items-center w-9 h-9 rounded-[8px]"
             style={{ background:'rgba(89,217,179,.12)', border:'1px solid rgba(89,217,179,.25)' }}>
          <Bot className="w-5 h-5" style={{ color: CTA }} />
        </div>
        <div className="min-w-0">
          <div className="text-xs" style={{ color:'var(--text-muted)' }}>Talking to</div>
          <div className="font-semibold truncate" style={{ color:'var(--text)' }}>{assistantName || 'Assistant'}</div>
        </div>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <div style={{ width: 200 }}>
          <StyledSelect
            value={voiceId}
            onChange={(v)=>setSelectedVoice(v)}
            // Filter Coral out of the options
            options={(voices.length?voices:DEFAULT_VOICES).filter(v=>v!=='coral').map(v=>({ value:v, label:v }))}
            placeholder="Voice"
          />
        </div>

        <button
          onClick={toggleMute}
          className="w-9 h-9 rounded-[8px] grid place-items-center transition"
          style={{
            border:'1px solid rgba(255,255,255,.14)', color:'var(--text)',
            background: muted ? 'rgba(239,68,68,.14)' : 'transparent'
          }}
          title={muted ? 'Unmute mic' : 'Mute mic'} aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4" />}
        </button>

        <button
          onClick={()=>endCall(true)}
          className="w-9 h-9 rounded-[8px] grid place-items-center transition"
          style={{ border:'1px solid rgba(239,68,68,.38)', background:'rgba(239,68,68,.18)', color:'#ffd7d7' }}
          title="End call"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="p-4" style={{ color:'var(--text)', background:'var(--panel-bg)' }}>
      <div className="text-xs pb-2 mb-3 border-b" style={{ borderColor:'rgba(255,255,255,.10)', color:'var(--text-muted)' }}>
        Transcript
      </div>

      <div ref={scrollerRef} className="space-y-3 overflow-y-auto" style={{ maxHeight:'calc(100vh - 72px - 52px - 50px)', scrollbarWidth:'thin' }}>
        {log.length===0 && (
          <div
            className="text-sm rounded-[8px] px-3 py-2 border"
            style={{ color:'var(--text-muted)', background:'var(--panel)', borderColor:'rgba(255,255,255,.10)' }}
          >
            {connecting ? 'Connecting to voice…' :
             firstMode==='Assistant speaks first' ? 'Assistant will greet you shortly…' : 'Say something to start — your words will appear here.'}
          </div>
        )}

        {log.map(row=>(
          // If a row is empty (no text yet), we skip rendering to avoid “…listening”
          row.text?.trim().length ? (
            <div key={row.id} className={`flex ${row.who==='user' ? 'justify-end' : 'justify-start'}`}>
              {row.who==='assistant' && (
                <div className="mr-2 mt-[2px] shrink-0 rounded-[8px] w-8 h-8 grid place-items-center"
                    style={{ background:'rgba(89,217,179,.12)', border:'1px solid rgba(89,217,179,.25)' }}>
                  <Bot className="w-4 h-4" style={{ color: CTA }} />
                </div>
              )}

              <div
                className="max-w-[78%] rounded-[12px] px-3 py-2 text-[0.95rem] leading-snug border transition"
                style={{
                  background: row.who==='user' ? 'rgba(56,196,143,.26)' : 'rgba(255,255,255,.10)',
                  borderColor: row.who==='user' ? 'rgba(56,196,143,.42)' : 'rgba(255,255,255,.18)',
                }}
              >
                <div>{row.text}</div>
                <div className="text-[10px] mt-1 opacity-60 text-right">{fmtTime(row.at)}</div>
              </div>

              {row.who==='user' && (
                <div className="ml-2 mt-[2px] shrink-0 rounded-[8px] w-8 h-8 grid place-items-center"
                    style={{ background:'rgba(255,255,255,.10)', border:'1px solid rgba(255,255,255,.18)' }}>
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ) : null
        ))}

        {error && (
          <div className="text-xs px-3 py-2 rounded-[8px] border"
               style={{ background:'rgba(239,68,68,.12)', borderColor:'rgba(239,68,68,.25)', color:'#ffd7d7' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );

  const footer = (
    <div className="px-3 py-2 border-t" style={{ borderColor:'rgba(255,255,255,.10)', color:'var(--text)', background:'var(--panel-bg)' }}>
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span style={{ opacity:.85 }}>
            {connected ? 'Connected' : (connecting ? 'Connecting…' : 'Idle')}
          </span>
        </div>
        <audio ref={audioRef} autoPlay playsInline />
      </div>
    </div>
  );

  const panel = (
    <>
      {/* plain CSS to avoid styled-jsx build issues */}
      <style>{`
        .va-card{
          --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;
          --panel-bg:var(--panel);
          border-left: 1px solid ${GREEN_LINE};
          background:var(--panel-bg);
          color:var(--text);
          box-shadow:0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${GREEN_LINE};
          overflow:hidden; isolation:isolate;

          /* Slide-in */
          transform: translateX(100%);
          animation: slideIn .42s cubic-bezier(.22,.87,.32,1) forwards;
        }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: .85; }
          to   { transform: translateX(0%);    opacity: 1; }
        }
        .va-head{
          min-height:72px;
          display:grid; grid-template-columns:1fr auto; align-items:center;
          padding:0 16px; border-bottom:1px solid ${GREEN_LINE};
          background:linear-gradient(90deg,var(--panel-bg) 0%,rgba(255,255,255,0.03) 50%,var(--panel-bg) 100%);
        }
      `}</style>

      {backdrop}
      <aside
        className={`va-card ${className||''}`}
        style={{
          position:'fixed', top:0, right:0, bottom:0,
          width:'clamp(380px, 34vw, 560px)',
          zIndex: 100012,
          display:'grid', gridTemplateRows:'72px 1fr 52px',
          borderTopLeftRadius: 14, borderBottomLeftRadius: 14,
        }}
        role="dialog"
        aria-label="Voice call panel"
      >
        {header}
        {body}
        {footer}
      </aside>
    </>
  );

  if (!IS_CLIENT) return null;
  return createPortal(panel, document.body);
}
