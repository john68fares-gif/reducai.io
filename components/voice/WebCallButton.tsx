// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, User, Mic, MicOff, X, Loader2, ChevronDown, Search, Check, Lock } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   TYPES / PROPS
────────────────────────────────────────────────────────────────────────── */
type ProsodyOpts = {
  fillerWords?: boolean;
  microPausesMs?: number;
  phoneFilter?: boolean;
  turnEndPauseMs?: number;       // server VAD pause
  preSpeechDelayMs?: number;     // small "thinking" delay before assistant starts
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

  // audio polish
  phoneFilter?: boolean;
  farMic?: boolean;
  ambience?: 'off' | 'kitchen' | 'cafe';
  ambienceLevel?: number;

  breathing?: boolean;
  breathingLevel?: number;

  // local ASR so user transcript always shows
  clientASR?: 'off' | 'auto' | 'deepgram';
  deepgramKey?: string; // (not used in this minimal drop but kept for API parity)

  // gate settings
  minUserSilenceMs?: number;     // default 3000
  maxGreetingChars?: number;     // default 220
};

/* ──────────────────────────────────────────────────────────────────────────
   CONSTANTS
────────────────────────────────────────────────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

const RAW_ID = /^[a-z0-9._-]{3,}$/i;
const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));
const fmtTime = (ts:number)=>new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

const LANG_NAME = { auto:'Auto', en:'English', de:'Deutsch', nl:'Nederlands', es:'Español', ar:'العربية' } as const;
const resolveVoiceId = (key:string) => {
  const k = (key||'').trim();
  return RAW_ID.test(k) ? k.toLowerCase() : k || 'alloy';
};

/* ──────────────────────────────────────────────────────────────────────────
   SMALL SELECT (for language)
────────────────────────────────────────────────────────────────────────── */
type Opt = { value: string; label: string; disabled?: boolean; iconLeft?: React.ReactNode };
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, openUp=false
}:{
  value: string; onChange: (v: string) => void; options: Opt[];
  placeholder?: string; leftIcon?: React.ReactNode; openUp?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef = useRef<HTMLButtonElement|null>(null);
  const menuRef = useRef<HTMLDivElement|null>(null);
  const searchRef = useRef<HTMLInputElement|null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [menuPos, setMenuPos] = useState<{left:number; top:number; width:number} | null>(null);

  const current = options.find(o => o.value === value) || null;
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter(o => o.label.toLowerCase().includes(q)) : options;
  }, [options, query, value]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ left: r.left, top: openUp ? r.top - 8 : r.bottom + 8, width: r.width });
  }, [open, openUp]);

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
      setMenuPos({ left: r.left, top: openUp ? r.top - 8 : r.bottom + 8, width: r.width });
    };
    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('resize', onResize);
    };
  }, [open, openUp]);

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
            transform: openUp ? 'translateY(-100%)' : 'none',
            background:'#101314',
            border:'1px solid rgba(255,255,255,.16)',
            borderRadius:10,
            boxShadow:'0 24px 64px rgba(0,0,0,.60), 0 8px 20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)'
          }}
        >
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
   AUDIO POLISH (saturator, ambience, breath, envelope)
────────────────────────────────────────────────────────────────────────── */
function createSaturator(ac: AudioContext, drive=1.05){
  const sh=ac.createWaveShaper(); const curve=new Float32Array(1024);
  for(let i=0;i<curve.length;i++){ const x=(i/(curve.length-1))*2-1; curve[i]=Math.tanh(x*drive); }
  sh.curve=curve; sh.oversample='2x'; return sh;
}

function createAmbience(ac: AudioContext, kind:'kitchen'|'cafe', level=0.06){
  const src=ac.createBufferSource(); const len=ac.sampleRate*2;
  const buf=ac.createBuffer(1, len, ac.sampleRate); const d=buf.getChannelData(0); let prev=0;
  for(let i=0;i<len;i++){ const w=Math.random()*2-1; prev=prev*0.97+w*0.03; d[i]=prev; }
  src.buffer=buf; src.loop=true;
  const band=ac.createBiquadFilter(); band.type='bandpass'; band.frequency.value=kind==='kitchen'?950:350; band.Q.value=kind==='kitchen'?0.9:0.6;
  const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=120;
  const g=ac.createGain(); g.gain.value=clamp01(level)*0.14;
  src.connect(band); band.connect(hp); hp.connect(g); g.connect(ac.destination);
  src.start();
  return ()=>{ try{src.stop()}catch{}; [src,band,hp,g].forEach(n=>{try{(n as any).disconnect()}catch{}}); };
}

function createBreather(ac: AudioContext, level=0.08){
  const noise = ac.createBufferSource();
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const d = buf.getChannelData(0);
  let prev=0;
  for (let i=0;i<len;i++){ const w=Math.random()*2-1; prev=prev*0.98 + w*0.02; d[i]=prev; }
  noise.buffer = buf; noise.loop = true;

  const bp = ac.createBiquadFilter(); bp.type='bandpass'; bp.frequency.value=380; bp.Q.value=0.6;
  const hp = ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=140;

  const gain = ac.createGain(); gain.gain.value = clamp01(level) * 0.10; // lower bed
  const lfo = ac.createOscillator(); lfo.frequency.value = 0.22;
  const lfoGain = ac.createGain(); lfoGain.gain.value = clamp01(level) * 0.10;

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
  const presence=ac.createBiquadFilter(); presence.type='peaking'; presence.frequency.value=2800; presence.Q.value=0.9; presence.gain.value=1.5;
  const body=ac.createBiquadFilter(); body.type='lowshelf'; body.frequency.value=160; body.gain.value=1.1;
  const sat=createSaturator(ac,1.05);
  const comp=ac.createDynamicsCompressor();
  comp.threshold.value=-22; comp.knee.value=18; comp.ratio.value=1.6; comp.attack.value=0.01; comp.release.value=0.18;

  const dry=ac.createGain(); dry.gain.value=1.0;
  const merge=ac.createGain();

  // voice envelope (fade on/off per phrase)
  const master = ac.createGain(); master.gain.value = 0.9;
  const analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.88;

  const dest=ac.createMediaStreamDestination();

  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dry); dry.connect(merge);
  merge.connect(master); master.connect(analyser); analyser.connect(dest);

  // envelope
  const buf = new Uint8Array(analyser.frequencyBinCount);
  let speaking=false; let lastEnergy=0; let lastAbove=Date.now();
  const base = 0.9, minFloor = 0.15;
  const tick = ()=>{
    analyser.getByteFrequencyData(buf);
    const energy = buf.reduce((s,v)=>s+v,0)/(buf.length*255);
    const now = ac.currentTime;
    const ms = performance.now();
    if (energy > 0.06 && lastEnergy <= 0.06){
      speaking=true;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(base, now, 0.16);
      lastAbove = ms;
    } else if (energy > 0.06){
      lastAbove = ms;
    }
    if (speaking && ms - lastAbove > 300){
      speaking=false;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(minFloor, now, 0.20);
    }
    lastEnergy = energy;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  (audioEl as any).srcObject=dest.stream;
  await audioEl.play().catch(()=>{});

  let ambClean:null|(()=>void)=null; if(ambience!=='off') ambClean=createAmbience(ac,ambience,ambienceLevel);

  // optional breath bed
  let breathStop: null | (()=>void) = null;
  if (breathing){
    const { node, stop } = createBreather(ac, breathingLevel ?? 0.12);
    breathStop = stop;
    const breathGain = ac.createGain(); breathGain.gain.value = clamp01(breathingLevel ?? 0.12) * 0.9;
    node.connect(breathGain); breathGain.connect(master);
    const an = ac.createAnalyser(); an.fftSize = 512; an.smoothingTimeConstant = 0.85;
    comp.connect(an);
    const buf2 = new Uint8Array(an.frequencyBinCount);
    const gate = ()=> {
      an.getByteFrequencyData(buf2);
      const loud = buf2.reduce((s,v)=>s+v,0) / (buf2.length*255);
      const target = loud > 0.08 ? 0.02 : breathGain.gain.value;
      const now = ac.currentTime;
      breathGain.gain.setTargetAtTime(target, now, 0.10);
      requestAnimationFrame(gate);
    };
    requestAnimationFrame(gate);
  }

  return ()=>{ [src,hp,lp,presence,body,sat,comp,merge,master,analyser,dry].forEach(n=>{try{(n as any).disconnect()}catch{}}); try{ambClean&&ambClean()}catch{}; try{breathStop&&breathStop()}catch{}; try{ac.close()}catch{}; };
}

/* ──────────────────────────────────────────────────────────────────────────
   LOCAL ASR (for on-screen user transcript)
────────────────────────────────────────────────────────────────────────── */
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

function startWebSpeechASR(opts: { lang?: string; onInterim: (t: string)=>void; onFinal: (t: string)=>void }) {
  const W: any = window as any;
  const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.continuous = true; rec.interimResults = true;
  if (opts.lang) rec.lang = opts.lang;
  rec.onresult = (e: any) => {
    let interim = ''; let finalText = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += res[0].transcript;
      else interim = res[0].transcript;
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
  ambienceLevel=0.06,
  breathing=true,
  breathingLevel=0.12,
  clientASR='auto',
  deepgramKey, // eslint-disable-line @typescript-eslint/no-unused-vars
  minUserSilenceMs=3000,
  maxGreetingChars=220,
}: Props){
  const [connecting,setConnecting]=useState(false);
  const [connected,setConnected]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState<string>('');

  const voiceId = useMemo(()=> resolveVoiceId(voiceName), [voiceName]);

  const [log,setLog]=useState<{ id:string; who:'user'|'assistant'; text:string; at:number; done?:boolean }[]>([]);
  const logRef=useRef(log);
  useEffect(()=>{ logRef.current=log; },[log]);

  const audioRef=useRef<HTMLAudioElement|null>(null);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const micStreamRef=useRef<MediaStream|null>(null);
  const dcRef=useRef<RTCDataChannel|null>(null);

  const closeChainRef=useRef<null|(()=>void)>(null);
  const vadLoopRef=useRef<number|null>(null);
  const scrollerRef=useRef<HTMLDivElement|null>(null);

  // GATE: only play assistant audio after enough user silence
  const holdingRef = useRef<boolean>(false);
  const holdUntilRef = useRef<number>(0);
  const userSpeakingRef = useRef<boolean>(false);
  const lastUserSpeechAtRef = useRef<number>(0);
  const greetingProtectedUntilRef = useRef<number>(0);

  // Transcription merge: local+server → single bubble
  const userTurnIdRef = useRef<string | null>(null);
  const serverToLocalUser = useRef<Map<string,string>>(new Map());
  const userInterimRef = useRef<Map<string,{final:string; interim:string}>>(new Map());

  // assistant turn id
  const currentAssistantIdRef = useRef<string | null>(null);

  // language UI state
  const [uiLang, setUiLang] = useState<Props['languageHint']>(languageHint || 'auto');
  const uiLangRef = useRef(uiLang);
  useEffect(()=>{ uiLangRef.current = uiLang; },[uiLang]);

  useEffect(()=>{ const el=scrollerRef.current; if(!el) return; el.scrollTop=el.scrollHeight; },[log,connecting,connected]);

  const newId = (p:'user'|'assistant') => `${p}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
  const safeSend=(dc:RTCDataChannel|null, payload:any)=>{
    if(!dc||dc.readyState!=='open') return; try{ dc.send(JSON.stringify(payload)); }catch{}
  };

  /* ── transcript helpers — single bubble per user/assistant turn ───────── */
  const beginUserTurn = (serverId?:string) => {
    let id = newId('user');
    userTurnIdRef.current = id;
    if (serverId) serverToLocalUser.current.set(serverId, id);
    userInterimRef.current.set(id, { final:'', interim:'' });
    setLog(prev => [...prev, { id, who:'user', text:'', at:Date.now(), done:false }]);
    return id;
  };

  const updateUserInterim = (txt:string, serverId?:string) => {
    let id = serverId ? serverToLocalUser.current.get(serverId) : userTurnIdRef.current;
    if (!id) id = beginUserTurn(serverId);
    const buf = userInterimRef.current.get(id) || { final:'', interim:'' };
    buf.interim = txt;
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

  const addAssistantDelta = (delta:string) => {
    if (!currentAssistantIdRef.current) {
      currentAssistantIdRef.current = newId('assistant');
      setLog(prev=>[...prev,{ id:currentAssistantIdRef.current!, who:'assistant', text:'', at:Date.now(), done:false }]);
    }
    const id = currentAssistantIdRef.current!;
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===id);
      if(i===-1){ return [...prev,{ id, who:'assistant', text:delta, at:Date.now(), done:false }]; }
      const next=[...prev]; next[i]={...next[i], text:(next[i].text||'')+delta}; return next;
    });
  };
  const endAssistantTurn = () => {
    const id = currentAssistantIdRef.current;
    if (!id) return;
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===id);
      if(i===-1) return prev;
      const next=[...prev]; next[i]={...next[i], done:true}; return next;
    });
    currentAssistantIdRef.current = null;
  };

  /* ── GATE helpers ────────────────────────────────────────────────────── */
  const holdNow = (ms:number)=>{
    holdingRef.current = true;
    holdUntilRef.current = Date.now() + Math.max(0, ms);
    if (audioRef.current) audioRef.current.muted = true;
  };
  const releaseIfQuiet = ()=>{
    const now = Date.now();
    const duringGreeting = now < greetingProtectedUntilRef.current;
    const gateExpired = now >= holdUntilRef.current;
    const userQuiet = (now - lastUserSpeechAtRef.current) >= (minUserSilenceMs || 0);
    if (!duringGreeting && gateExpired && userQuiet){
      holdingRef.current = false;
      if (audioRef.current) audioRef.current.muted = false;
    }
  };

  /* ── mic VAD: track if the user is talking (for gating/ducking only) ─── */
  async function setupVAD(){
    try{
      const mic=micStreamRef.current; if(!mic) return;
      const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
      const src=ac.createMediaStreamSource(mic); const an=ac.createAnalyser(); an.fftSize=512; an.smoothingTimeConstant=0.88;
      src.connect(an);
      const buf=new Uint8Array(an.frequencyBinCount);
      const loop=()=>{ an.getByteFrequencyData(buf);
        const energy = buf.reduce((s,v)=>s+v,0)/(buf.length*255);
        const speaking = energy > 0.06;
        if (speaking){ userSpeakingRef.current = true; lastUserSpeechAtRef.current = Date.now(); }
        else { userSpeakingRef.current = false; }
        if (audioRef.current) audioRef.current.volume = speaking ? 0.35 : 1.0;
        vadLoopRef.current=requestAnimationFrame(loop);
      };
      vadLoopRef.current=requestAnimationFrame(loop);
      return ()=>{ try{ac.close()}catch{} };
    }catch{ return ()=>{}; }
  }

  /* ────────────────────────────────────────────────────────────────────────
     START CALL
  ──────────────────────────────────────────────────────────────────────── */
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

      // 2.5) local ASR to populate the UI immediately
      try {
        const bcp = langToBCP47(uiLangRef.current);
        if (clientASR !== 'off') startWebSpeechASR({
          lang: bcp,
          onInterim: (t)=>{ updateUserInterim(t); },
          onFinal:  (t)=>{ commitUserFinal(t); lastUserSpeechAtRef.current = Date.now(); holdNow(minUserSilenceMs); }
        });
      } catch {}

      // 3) peer
      const pc=new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] }); pcRef.current=pc;

      const remote=new MediaStream();
      pc.ontrack=async (e)=>{
        e.streams[0]?.getAudioTracks().forEach(t=>remote.addTrack(t));
        if(!audioRef.current) return;
        if(closeChainRef.current){ try{closeChainRef.current()}catch{}; closeChainRef.current=null; }
        closeChainRef.current=await attachProcessedAudio(audioRef.current, remote, {
          phoneFilter: !!(prosody?.phoneFilter ?? phoneFilter),
          farMic,
          ambience,
          ambienceLevel,
          breathing: !!breathing,
          breathingLevel: clamp01(breathingLevel ?? 0.12)
        });
      };

      pc.addTrack(mic.getAudioTracks()[0], mic);
      pc.addTransceiver('audio',{ direction:'recvonly' });

      // 4) data channel
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        const preDelay = Math.max(300, prosody?.preSpeechDelayMs ?? 600);
        const style = [
          systemPrompt || '',
          uiLangRef.current==='auto'
            ? 'Auto-detect the caller’s language from their first complete sentence and stick to it unless they ask to change.'
            : `Speak ONLY ${LANG_NAME[uiLangRef.current]} for the entire call.`,
          (prosody?.fillerWords ?? true) ? 'Use mild, natural disfluencies occasionally (don’t overuse).' : '',
          `Allow micro pauses (~${prosody?.microPausesMs ?? 120} ms) inside sentences.`,
          'Between sentences, breathe lightly and wait ~450–600 ms.',
          'Keep answers concise; match the caller’s pace and energy.',
        ].filter(Boolean).join('\n\n');

        safeSend(dc,{ type:'session.update', session:{
          instructions: style,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities:['audio','text'],
          input_audio_transcription:{ enabled:true, provider:'openai', model:'whisper-1', ...(uiLangRef.current!=='auto'?{language:uiLangRef.current}:{}) },
          turn_detection:{
            type:'server_vad',
            threshold:0.5,
            prefix_silence_ms: 100,
            silence_duration_ms: Math.max(260, prosody?.turnEndPauseMs ?? 280),
          },
        }});

        // single client-side greeting (optional, never duplicated)
        const wantClientGreeting =
          greetMode==='client' ||
          (greetMode==='server' && firstMode==='Assistant speaks first');

        const greet = () => {
          const text = (firstMsg||'Hello.').split(/\r?\n|\|/g).map(s=>s.trim()).filter(Boolean).slice(0,6).join(' ').slice(0, maxGreetingChars);
          greetingProtectedUntilRef.current = Date.now() + Math.max(1800, 1200 + text.length*10);
          setTimeout(()=>{
            safeSend(dc,{ type:'response.create', response:{ modalities:['audio','text'], instructions: text }});
          }, preDelay);
        };

        if (greetMode==='client') greet();
        else if (wantClientGreeting) setTimeout(()=>{ // only if server stays quiet
          if (!currentAssistantIdRef.current) greet();
        }, 1200);

        // check the gate often
        const timer = window.setInterval(releaseIfQuiet, 250);
        dc.onclose = () => { clearInterval(timer); };
      };

      // 5) events — merge transcripts, enforce gate, tidy assistant turns
      dc.onmessage=(ev)=>{
        let raw:any;
        try{ raw=JSON.parse(ev.data); }catch{ return; }
        const t=String(raw?.type||'').replace(/^realtime\./,'');

        // user speech boundaries from server (for gating)
        if (/^input_audio_buffer\.speech_started$|^input_speech\.start$/.test(t)) {
          userSpeakingRef.current = true;
          lastUserSpeechAtRef.current = Date.now();
          beginUserTurn(raw?.id);
          return;
        }
        if (/^input_audio_buffer\.speech_ended$|^input_speech\.end$/.test(t)) {
          userSpeakingRef.current = false;
          commitUserFinal(undefined, raw?.id);
          holdNow(minUserSilenceMs);
          setTimeout(releaseIfQuiet, minUserSilenceMs + 12);
          return;
        }

        // server-side user transcript stream (merge → one bubble)
        if (t==='transcript.delta' || t==='input_audio_transcript.delta' || t==='input_audio_buffer.transcript.delta' || t==='conversation.item.input_audio_transcript.delta'){
          const sid = raw?.transcript_id || raw?.id || raw?.item_id;
          if (raw?.delta) updateUserInterim(String(raw.delta), sid);
          return;
        }
        if (t==='transcript.completed' || t==='input_audio_transcript.completed' || t==='input_audio_buffer.transcript.completed' || t==='conversation.item.input_audio_transcript.completed'){
          const sid = raw?.transcript_id || raw?.id || raw?.item_id;
          commitUserFinal(undefined, sid);
          return;
        }

        // assistant text stream → one bubble
        if (t==='response.output_text.delta' || t==='response.audio_transcript.delta'){
          if (raw?.delta) addAssistantDelta(String(raw.delta));
          return;
        }
        if (t==='response.audio_transcript.completed' || t==='response.completed' || t==='response.stop'){
          endAssistantTurn(); return;
        }

        // whole-text payloads (fallbacks)
        if (t==='response.output_text' && typeof raw?.text==='string'){
          addAssistantDelta(String(raw.text)); endAssistantTurn(); return;
        }
      };

      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='connected'){
          setConnected(true); setConnecting(false);
          holdingRef.current = false; releaseIfQuiet();
        }else if(['disconnected','failed','closed'].includes(pc.connectionState)){ endCall(false); }
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
    try{ dcRef.current?.close(); }catch{}
    dcRef.current = null;
    try{ pcRef.current?.close(); }catch{}
    pcRef.current=null;
    try{ micStreamRef.current?.getTracks()?.forEach(t=>t.stop()); }catch{}
    micStreamRef.current=null;
    try{ closeChainRef.current && closeChainRef.current(); }catch{}
    closeChainRef.current = null;
    holdingRef.current = false;
    currentAssistantIdRef.current = null;
    userTurnIdRef.current = null;
    serverToLocalUser.current.clear();
    userInterimRef.current.clear();
  }
  function endCall(userIntent=true){ cleanup(); setConnected(false); setConnecting(false); if(userIntent) onClose?.(); }

  // Restart session when voice or language changes
  useEffect(()=>{ startCall(); return ()=>{ cleanup(); }; // eslint-disable-next-line
  },[voiceId, uiLang]);

  /* ────────────────────────────────────────────────────────────────────────
     UI (UNCHANGED PANEL)
  ───────────────────────────────────────────────────────────────────────── */
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

      <div ref={scrollerRef} className="space-y-3 overflow-y-auto" style={{ maxHeight:'calc(100vh - 72px - 52px - 84px)', scrollbarWidth:'thin' }}>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 items-center text-xs">
        <div className="flex items-center gap-2">
          {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span style={{ opacity:.85 }}>
            {connected ? 'Connected' : (connecting ? 'Connecting…' : 'Idle')}
          </span>
        </div>

        <div className="flex items-center gap-2 justify-end">
          <span style={{ opacity:.8, minWidth:70 }}>Language</span>
          <div style={{ width: 160 }}>
            <StyledSelect
              value={uiLang || 'auto'}
              onChange={(v)=> setUiLang(v as Props['languageHint'])}
              options={[
                { value:'auto', label:'Auto' },
                { value:'en', label:'English' },
                { value:'de', label:'Deutsch' },
                { value:'nl', label:'Nederlands' },
                { value:'es', label:'Español' },
                { value:'ar', label:'العربية' },
              ]}
              openUp
            />
          </div>
        </div>

        <div className="col-span-1 sm:col-span-2 flex justify-end">
          <audio ref={audioRef} autoPlay playsInline />
        </div>
      </div>
    </div>
  );

  const panel = (
    <>
      <style>{`
        .va-card{
          --panel:#0d0f11; --text:#e6f1ef; --text-muted:#9fb4ad;
          --panel-bg:var(--panel);
          border-left: 1px solid ${GREEN_LINE};
          background:var(--panel-bg);
          color:var(--text);
          box-shadow:0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px ${GREEN_LINE};
          overflow:hidden; isolation:isolate;
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

      <div
        className="fixed inset-0"
        style={{
          zIndex: 100008,
          background: 'linear-gradient(90deg, rgba(10,13,15,0.35) 0%, rgba(10,13,15,0.6) 32%, rgba(10,13,15,0.88) 60%, rgba(10,13,15,0.94) 100%)'
        }}
        onClick={()=>endCall(true)}
        aria-hidden
      />
      <aside
        className={`va-card ${className||''}`}
        style={{
          position:'fixed', top:0, right:0, bottom:0,
          width:'clamp(380px, 34vw, 560px)',
          zIndex: 100012,
          display:'grid', gridTemplateRows:'72px 1fr 84px',
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
