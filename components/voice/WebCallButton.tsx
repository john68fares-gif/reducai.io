// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, Mic, MicOff, X, Loader2, ChevronDown, Search, Check, Lock } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   PROPS  (AI logic preserved)  — apiKeyId preferred, with safe fallbacks
────────────────────────────────────────────────────────────────────────── */
type ProsodyOpts = {
  fillerWords?: boolean;
  microPausesMs?: number;
  phoneFilter?: boolean;
  turnEndPauseMs?: number;
};

type ScopedLike = {
  get: (key: string) => Promise<any>;
  set: (key: string, value: any) => Promise<void>;
  merge?: (key: string, patch: any) => Promise<void>;
};

type Props = {
  className?: string;

  model: string;

  systemPrompt: string;
  voiceName: string;
  assistantName: string;

  /** ID of the stored key (server will resolve to the real secret) */
  apiKeyId?: string;

  /** Raw secret, if you really want to pass it from the client (not recommended). */
  apiKey?: string;

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

  // account-scoped storage (cross-device persistence)
  accountId?: string;
  agentId?: string;
  scoped?: ScopedLike;
};

/* ──────────────────────────────────────────────────────────────────────────
   CONSTANTS / UTILS
────────────────────────────────────────────────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';
const ENV_FALLBACK_KEY = (process as any)?.env?.NEXT_PUBLIC_OPENAI_API_KEY || '';

const RAW_ID = /^[a-z0-9._-]{3,}$/i;
const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));

const HUMAN_LIKE = new Set(['alloy','verse','coral','amber','sage','juniper','opal','pebble','cobalt']);
const DEFAULT_VOICES = ['alloy','verse','coral','amber','sage','juniper'];
const FRIENDLY_TO_ID: Record<string,string> = {
  'Alloy (American)':'alloy','Verse (American)':'verse','Coral (British)':'coral','Amber (Australian)':'amber',
  Alloy:'alloy', Verse:'verse', Coral:'coral', Amber:'amber', Sage:'sage', Juniper:'juniper'
};

type TranscriptRow = { id:string; who:'user'|'assistant'; text:string; at:number; done?:boolean };

const resolveVoiceId = (key:string) => {
  const k = (key||'').trim();
  if (RAW_ID.test(k) && !FRIENDLY_TO_ID[k]) return k.toLowerCase();
  return FRIENDLY_TO_ID[k] || k || 'alloy';
};

// Infer target language from your systemPrompt (hard pin), or from languageHint
function inferLang(systemPrompt: string, hint: Props['languageHint']): 'en'|'de'|'nl'|'es'|'ar' {
  const p = systemPrompt.toLowerCase();
  if (/only\s+english|speak\s+english|reply\s+in\s+english/.test(p)) return 'en';
  if (/only\s+dutch|spreek\s+alleen\s+nederlands|reply\s+in\s+dutch|nederlands/.test(p)) return 'nl';
  if (/only\s+german|sprich\s+nur\s+deutsch|reply\s+in\s+german|deutsch/.test(p)) return 'de';
  if (/only\s+spanish|habla\s+solo\s+español|reply\s+in\s+spanish|español/.test(p)) return 'es';
  if (/only\s+arabic|تحدث\s+بالعربية\s+فقط|reply\s+in\s+arabic|العربية/.test(p)) return 'ar';
  switch (hint) {
    case 'de': case 'nl': case 'es': case 'ar': return hint;
    default: return 'en';
  }
}

// quick detector to catch obvious drift (optional nudge)
function looksNonTargetLanguage(text:string, target:'en'|'de'|'nl'|'es'|'ar'){
  const t = text.toLowerCase();
  if (!t) return false;
  const probes: Record<typeof target, RegExp[]> = {
    en: [/^(hola|buen[oa]s|gracias|por favor)\b/, /\b(danke|bitte|und|nicht)\b/, /\b(hallo|alsjeblieft|dank je)\b/, /[ء-ي]/],
    es: [/\b(hello|thanks|please)\b/, /\b(danke|bitte)\b/, /\b(hallo|alsjeblieft|dank)\b/, /[ء-ي]/],
    de: [/\b(hello|thanks|please)\b/, /\b(hola|gracias)\b/, /\b(alsjeblieft|dank)\b/, /[ء-ي]/],
    nl: [/\b(hello|thanks|please)\b/, /\b(hola|gracias)\b/, /\b(danke|bitte)\b/, /[ء-ي]/],
    ar: [/\b(hello|thanks|please|hola|gracias|danke|bitte|hallo|alsjeblieft)\b/],
  };
  return probes[target].some(r=>r.test(t));
}

/* ──────────────────────────────────────────────────────────────────────────
   SMALL SELECT (voice picker style) — stays open & repositions on scroll
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

  const recompute = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setMenuPos({ left: r.left, top: openUp ? r.top - 8 : r.bottom + 8, width: r.width });
  };

  useLayoutEffect(() => { if (open) recompute(); }, [open, openUp]);

  useEffect(() => {
    if (!open || !IS_CLIENT) return;
    const off = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      if (menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };

    let raf = 0;
    const onScroll = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(recompute); };
    const onResize = () => recompute();

    window.addEventListener('mousedown', off);
    window.addEventListener('keydown', onEsc);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('mousedown', off);
      window.removeEventListener('keydown', onEsc);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
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
                onClick={()=>{ if (o.disabled) return; onChange(o.value); }}
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
   AUDIO POLISH (gentle filter + phrase envelope for “breathing”)
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
  const g=ac.createGain(); g.gain.value=clamp01(level)*0.14;
  src.connect(band); band.connect(hp); hp.connect(g); g.connect(ac.destination);
  src.start();
  return ()=>{ try{src.stop()}catch{}; [src,band,hp,g].forEach(n=>{try{(n as any).disconnect()}catch{}}); };
}

async function attachProcessedAudio(
  audioEl:HTMLAudioElement,
  remote:MediaStream,
  opts:{ phoneFilter:boolean; farMic:boolean; ambience:'off'|'kitchen'|'cafe'; ambienceLevel:number }
){
  const { phoneFilter, ambience, ambienceLevel } = opts;

  // Early attach to avoid autoplay crash
  (audioEl as any).srcObject=remote; await audioEl.play().catch(()=>{});

  if(!phoneFilter) return ()=>{};

  const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
  const src=ac.createMediaStreamSource(remote);

  const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=70;
  const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=12000;
  const presence=ac.createBiquadFilter(); presence.type='peaking'; presence.frequency.value=2800; presence.Q.value=0.9; presence.gain.value=1.35;
  const body=ac.createBiquadFilter(); body.type='lowshelf'; body.frequency.value=160; body.gain.value=1.1;
  const sat=createSaturator(ac,1.05);
  const comp=ac.createDynamicsCompressor();
  comp.threshold.value=-22; comp.knee.value=18; comp.ratio.value=1.6; comp.attack.value=0.01; comp.release.value=0.18;

  // Envelope: light fade on/off around phrase edges
  const master = ac.createGain(); master.gain.value = 0.9;
  const analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.88;

  const merge=ac.createGain(); const dry=ac.createGain(); dry.gain.value=1.0;
  const dest=ac.createMediaStreamDestination();

  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dry); dry.connect(merge);
  merge.connect(master); master.connect(analyser); analyser.connect(dest);

  (audioEl as any).srcObject=dest.stream;
  await audioEl.play().catch(()=>{});

  const buf = new Uint8Array(analyser.frequencyBinCount);
  let speaking=false; let lastEnergy=0; let lastAbove=performance.now();
  const base = 0.9, minFloor = 0.15;
  const tick = ()=>{
    analyser.getByteFrequencyData(buf);
    const energy = buf.reduce((s,v)=>s+v,0)/(buf.length*255);
    const now = ac.currentTime; const ms = performance.now();
    if (energy > 0.06 && lastEnergy <= 0.06){
      speaking=true; master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(base, now, 0.16); lastAbove = ms;
    } else if (energy > 0.06){ lastAbove = ms; }
    if (speaking && ms - lastAbove > 300){
      speaking=false; master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(minFloor, now, 0.20);
    }
    lastEnergy = energy;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  // ambience (optional)
  let ambClean:null|(()=>void)=null; if(ambience!=='off') ambClean=createAmbience(ac,ambience,ambienceLevel);

  return ()=>{ [src,hp,lp,presence,body,sat,comp,merge,master,analyser,dry].forEach(n=>{try{(n as any).disconnect()}catch{}}); try{ambClean&&ambClean()}catch{}; try{ac.close()}catch{}; };
}

/* ──────────────────────────────────────────────────────────────────────────
   SCOPED STORAGE (cross-device, no localStorage)
────────────────────────────────────────────────────────────────────────── */
function makeScopedAdapter(scoped?: ScopedLike){
  const client = scoped || (typeof window!=='undefined' ? (window as any).scopedStorage : undefined);
  const get = async (key:string) => { if(!client) return null; return client.get(key); };
  const set = async (key:string, value:any) => { if(!client) return; return client.set(key,value); };
  const merge = async (key:string, patch:any) => {
    if(!client) return;
    if (client.merge) return client.merge(key, patch);
    const cur = await client.get(key); await client.set(key, { ...(cur||{}), ...patch });
  };
  return { get, set, merge, hasClient: !!client };
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
  apiKeyId,
  apiKey,               // may be undefined; we also check env fallback
  ephemeralEndpoint = '/api/voice/ephemeral',
  onClose,
  onError,
  firstMode='User speaks first',
  firstMsg='Hello.',
  greetMode='off',
  languageHint='auto',
  prosody,
  phoneFilter=false,
  farMic=false,
  ambience='off',
  ambienceLevel=0.08,
  accountId='default',
  agentId='default',
  scoped,
}: Props){
  const [connecting,setConnecting]=useState(false);
  const [connected,setConnected]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState<string>('');

  // voices (static allowlist)
  const [voices,setVoices]=useState<string[]>(() => DEFAULT_VOICES);
  const [selectedVoice,setSelectedVoice]=useState<string>(() => resolveVoiceId(voiceName));
  const voiceId = useMemo(()=> resolveVoiceId(selectedVoice || voiceName), [selectedVoice, voiceName]);

  // internal transcript buffer (NOT rendered)
  const [log,setLog]=useState<TranscriptRow[]>([]);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const micStreamRef=useRef<MediaStream|null>(null);
  const dcRef=useRef<RTCDataChannel|null>(null);
  const closeChainRef=useRef<null|(()=>void)>(null);
  const vadLoopRef=useRef<number|null>(null);

  const scopedStore = useMemo(()=> makeScopedAdapter(scoped), [scoped]);
  const STORE_KEY = `calls:${accountId}:${agentId}`;
  const callRef = useRef<{ id:string; startedAt:number; endedAt?:number; transcript: TranscriptRow[] }>({
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    startedAt: Date.now(),
    transcript: []
  });

  // Ensure selectedVoice is valid from allowlist
  useEffect(()=>{
    const rid = resolveVoiceId(voiceName);
    setVoices(DEFAULT_VOICES.filter(v=>HUMAN_LIKE.has(v)));
    setSelectedVoice(HUMAN_LIKE.has(rid) ? rid : (DEFAULT_VOICES[0]||'alloy'));
  },[voiceName]);

  const upsert=(id:string, who:TranscriptRow['who'], patch:Partial<TranscriptRow>|((p?:TranscriptRow)=>Partial<TranscriptRow>))=>{
    setLog(prev=>{
      const i=prev.findIndex(r=>r.id===id);
      const nowRow = (base?:TranscriptRow)=> {
        const src = base || { id, who, text:'', at:Date.now(), done:false };
        const p=typeof patch==='function' ? (patch as any)(base) : patch;
        return { ...src, ...p };
      };
      let next:TranscriptRow[];
      if(i===-1){ next=[...prev, nowRow()]; }
      else { next=[...prev]; next[i]=nowRow(next[i]); }
      persistTranscript(next);
      return next;
    });
  };

  async function persistTranscript(rows: TranscriptRow[]){
    if (!scopedStore.hasClient) return;
    callRef.current.transcript = rows;
    try{
      const list = (await scopedStore.get(STORE_KEY)) || [];
      const idx = list.findIndex((c:any)=>c?.id===callRef.current.id);
      if (idx === -1) list.push(callRef.current);
      else list[idx] = callRef.current;
      await scopedStore.set(STORE_KEY, list);
    }catch{}
  }

  // VAD ducking
  async function setupVAD(){
    try{
      const mic=micStreamRef.current; if(!mic) return;
      const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
      const src=ac.createMediaStreamSource(mic); const an=ac.createAnalyser(); an.fftSize=512; an.smoothingTimeConstant = 0.88;
      src.connect(an);
      const buf=new Uint8Array(an.frequencyBinCount);
      const loop=()=>{ an.getByteFrequencyData(buf); let sum=0; for(let i=0;i<buf.length;i++) sum+=buf[i]*i;
        const loud=sum/(buf.length*buf.length);
        if(audioRef.current) audioRef.current.volume = loud>0.5 ? 0.35 : 1.0;
        vadLoopRef.current=requestAnimationFrame(loop);
      };
      vadLoopRef.current=requestAnimationFrame(loop);
      return ()=>{ try{ac.close()}catch{} };
    }catch{ return ()=>{}; }
  }

  /* ────────────────────────────────────────────────────────────────────────
     START CALL  (language pinned; assistant-first greeting optional)
  ──────────────────────────────────────────────────────────────────────── */
  async function startCall(){
    setError('');
    const resolvedSecret = apiKey || ENV_FALLBACK_KEY || ''; // raw secret if provided
    const haveKey = !!apiKeyId || !!resolvedSecret;
    if(!haveKey){
      const msg = 'No API key provided. Select a key in Credentials or set NEXT_PUBLIC_OPENAI_API_KEY.';
      setError(msg); onError?.(msg); return;
    }
    try{
      setConnecting(true);
      callRef.current = { id: `call_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, startedAt: Date.now(), transcript: [] };
      persistTranscript([]);

      const TARGET_LANG = inferLang(systemPrompt, languageHint);

      // 1) ephemeral — server resolves apiKeyId → secret OR uses provided raw secret
      const sessionRes=await fetch(ephemeralEndpoint,{
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({
          model,
          voiceName:voiceId,
          assistantName,
          systemPrompt,
          // send BOTH; your server can prefer id, fallback to raw secret
          apiKeyId: apiKeyId || null,
          apiKey: resolvedSecret || null,
        }),
      });
      if(!sessionRes.ok) throw new Error(`Ephemeral token error: ${await sessionRes.text()}`);
      const session=await sessionRes.json(); const EPHEMERAL=session?.client_secret?.value;
      if(!EPHEMERAL) throw new Error('Missing ephemeral client_secret.value');

      // 2) mic
      const mic=await navigator.mediaDevices.getUserMedia({ audio:true }); micStreamRef.current=mic;

      // 3) peer
      const pc=new RTCPeerConnection({ iceServers:[{ urls:'stun:stun.l.google.com:19302' }] }); pcRef.current=pc;
      const remote=new MediaStream();
      pc.ontrack=async (e)=>{
        e.streams[0]?.getAudioTracks().forEach(t=>remote.addTrack(t));
        if(!audioRef.current) return;
        if(closeChainRef.current){ try{closeChainRef.current()}catch{}; closeChainRef.current=null; }
        const usePhone = prosody?.phoneFilter ?? phoneFilter;
        closeChainRef.current=await attachProcessedAudio(audioRef.current, remote, {
          phoneFilter: !!usePhone, farMic, ambience, ambienceLevel
        });
      };
      pc.addTrack(mic.getAudioTracks()[0], mic);
      pc.addTransceiver('audio',{ direction:'recvonly' });

      // 4) data channel
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        // STRICT language pin
        const langName: Record<typeof TARGET_LANG,string> = { en:'English', de:'German', nl:'Dutch', es:'Spanish', ar:'Arabic' };
        const strictLangBlock =
          `IMPORTANT: Speak ONLY ${langName[TARGET_LANG]} for the entire call. ` +
          `Do NOT code-switch or translate unless the caller explicitly requests a language change. ` +
          `If the user speaks another language, politely reply in ${langName[TARGET_LANG]} and ask if they want to switch languages.`;

        const style = [
          systemPrompt || '',
          strictLangBlock,
          'Before speaking, pause ~450ms as if thinking.',
          `Use gentle micro-pauses (~${prosody?.microPausesMs ?? 120}ms) within sentences.`,
          'Between sentences, breathe lightly and keep a natural pace.'
        ].join('\n\n');

        // ✅ Live transcription (OpenAI Whisper) with target language
        const input_audio_transcription:any = {
          enabled:true,
          provider:'openai',
          model:'whisper-1',
          language: TARGET_LANG
        };

        dc.send(JSON.stringify({ type:'session.update', session:{
          instructions: style,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities:['audio','text'],
          input_audio_transcription,
          turn_detection:{
            type:'server_vad',
            threshold:0.5,
            prefix_silence_ms: 100,
            silence_duration_ms: Math.max(900, prosody?.turnEndPauseMs ?? 1600),
          },
        }}));

        // Assistant-first greeting (server-voiced)
        if (firstMode === 'Assistant speaks first' && (firstMsg||'').trim()) {
          dc.send(JSON.stringify({
            type: 'response.create',
            response: {
              instructions: String(firstMsg).trim(),
              modalities: ['audio','text']
            }
          }));
        }
      };

      // 5) events — persist transcript; nudge if language drifts
      dc.onmessage=(ev)=>{
        try{
          const msg=JSON.parse(ev.data); const t=msg?.type as string;

          // assistant text stream
          if(t==='response.output_text.delta'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            const delta=String(msg?.delta||'');
            upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+delta }));

            if (looksNonTargetLanguage(delta, TARGET_LANG)) {
              const LN = { en:'English', nl:'Dutch', de:'German', es:'Spanish', ar:'Arabic' }[TARGET_LANG];
              dc.send(JSON.stringify({ type:'session.update', session:{ instructions: `REMINDER: Speak ONLY ${LN}.` }}));
            }
          }
          if(t==='response.completed'||t==='response.stop'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            upsert(id,'assistant',{ done:true });
          }
          if(t==='response.output_text' && typeof msg?.text==='string'){
            const text=String(msg.text||'');
            const id=`assistant_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
            upsert(id,'assistant',{ text, done:true, at:Date.now() } as any);
          }

          // user transcript
          if(t==='transcript.delta'){
            const id=msg?.transcript_id||msg?.id||'user_current';
            const d=String(msg?.delta||'');
            upsert(id,'user',(prev)=>({ text:(prev?.text||'')+d }));
          }
          if(t==='transcript.completed'){
            const id=msg?.transcript_id||msg?.id||'user_current';
            upsert(id,'user',{ done:true });
          }
          if(t==='input_audio_buffer.transcript' && typeof msg?.text==='string'){
            const id=`user_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
            upsert(id,'user',{ text:String(msg.text||''), done:true, at:Date.now() } as any);
          }
        }catch{}
      };

      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='connected'){ setConnected(true); setConnecting(false); }
        else if(['disconnected','failed','closed'].includes(pc.connectionState)){ endCall(false); }
      };

      // 6) SDP with ephemeral
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
    dcRef.current=null;
    try{ pcRef.current?.close(); }catch{}
    pcRef.current=null;
    try{ micStreamRef.current?.getTracks()?.forEach(t=>t.stop()); }catch{}
    micStreamRef.current=null;
    try{ closeChainRef.current && closeChainRef.current(); }catch{}
    closeChainRef.current = null;

    // persist call end
    (async()=>{
      try{
        const list = scopedStore.hasClient ? (await scopedStore.get(STORE_KEY)) || [] : [];
        callRef.current.endedAt = Date.now();
        if (scopedStore.hasClient){
          const idx = list.findIndex((c:any)=>c?.id===callRef.current.id);
          if (idx === -1) list.push(callRef.current); else list[idx] = callRef.current;
          await scopedStore.set(STORE_KEY, list);
        }
      }catch{}
    })();
  }
  function endCall(userIntent=true){ cleanup(); setConnected(false); setConnecting(false); if(userIntent) onClose?.(); }

  useEffect(()=>{ startCall(); return ()=>{ cleanup(); }; // eslint-disable-next-line
  },[voiceId, systemPrompt, languageHint, apiKeyId, apiKey]);

  /* ────────────────────────────────────────────────────────────────────────
     UI — slide-over; status only (transcript saved silently)
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
        <div style={{ width: 180 }}>
          <StyledSelect
            value={voiceId}
            onChange={(v)=>setSelectedVoice(v)}
            options={(voices.length?voices:DEFAULT_VOICES).map(v=>({ value:v, label:v }))}
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
      {/* Disclosure banner */}
      <div
        className="mb-3 text-[12.5px] px-3 py-2 rounded-[8px]"
        style={{ background:'rgba(89,217,179,.10)', border:'1px solid rgba(89,217,179,.25)', color:'var(--text)' }}
      >
        This voice is AI-generated.
      </div>

      <div className="text-xs pb-2 mb-3 border-b" style={{ borderColor:'rgba(255,255,255,.10)', color:'var(--text-muted)' }}>
        Status
      </div>

      <div className="space-y-3">
        <div
          className="text-sm rounded-[8px] px-3 py-2 border"
          style={{ color:'var(--text-muted)', background:'var(--panel)', borderColor:'rgba(255,255,255,.10)' }}
        >
          {error
            ? <span style={{ color:'#ffd7d7' }}>{error}</span>
            : (connecting ? 'Connecting to voice…' : (connected ? 'Connected. Speak when ready.' : 'Idle.'))
          }
        </div>
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
