// components/voice/WebCallButton.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bot, User, Mic, MicOff, X, Loader2, ChevronDown, Search, Check, Lock } from 'lucide-react';

/* ──────────────────────────────────────────────────────────────────────────
   PROPS (logic unchanged)
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
  voiceName: string;         // friendly or id
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

  /** NEW (optional): which account/agent to store under (so it syncs across devices). */
  accountId?: string;
  agentId?: string;
  /** NEW (optional): pass your scoped storage client. If omitted, we try window.scopedStorage, else localStorage. */
  scoped?: ScopedLike;
};

/* ──────────────────────────────────────────────────────────────────────────
   STYLE / CONSTANTS
────────────────────────────────────────────────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

const RAW_ID = /^[a-z0-9._-]{3,}$/i;
const HUMAN_LIKE = new Set(['alloy','verse','coral','amber','sage','juniper','opal','pebble','cobalt']);
const DEFAULT_VOICES = ['alloy','verse','coral','amber','sage','juniper'];
const FRIENDLY_TO_ID: Record<string,string> = {
  'Alloy (American)':'alloy','Verse (American)':'verse','Coral (British)':'coral','Amber (Australian)':'amber',
  Alloy:'alloy', Verse:'verse', Coral:'coral', Amber:'amber', Sage:'sage', Juniper:'juniper'
};

type TranscriptRow = { id:string; who:'user'|'assistant'; text:string; at:number; done?:boolean };

const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));
const fmtTime = (ts:number)=>new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

const resolveVoiceId = (key:string) => {
  const k = (key||'').trim();
  if (RAW_ID.test(k) && !FRIENDLY_TO_ID[k]) return k.toLowerCase();
  return FRIENDLY_TO_ID[k] || k || 'alloy';
};

/* ──────────────────────────────────────────────────────────────────────────
   SMALL SELECT (unchanged appearance)
────────────────────────────────────────────────────────────────────────── */
type Opt = { value: string; label: string; disabled?: boolean; iconLeft?: React.ReactNode };
function StyledSelect({
  value, onChange, options, placeholder, leftIcon, menuTop, openUp=false
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
  openUp?: boolean;
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
   AUDIO POLISH — add subtle envelope + optional breath (no logic changes)
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
  const gain = ac.createGain(); gain.gain.value = clamp01(level) * 0.10;
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
  opts:{ phoneFilter:boolean; farMic:boolean; ambience:'off'|'kitchen'|'cafe'; ambienceLevel:number }
){
  const { phoneFilter, ambience, ambienceLevel } = opts;

  // Early attach (prevents "site crash" from unmet autoplay)
  (audioEl as any).srcObject = remote;
  await audioEl.play().catch(()=>{});

  if(!phoneFilter){
    return ()=>{};
  }

  const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
  const src=ac.createMediaStreamSource(remote);

  const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=70;
  const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=12000;
  const presence=ac.createBiquadFilter(); presence.type='peaking'; presence.frequency.value=2800; presence.Q.value=0.9; presence.gain.value=1.4;
  const body=ac.createBiquadFilter(); body.type='lowshelf'; body.frequency.value=160; body.gain.value=1.1;
  const sat=createSaturator(ac,1.05);
  const comp=ac.createDynamicsCompressor();
  comp.threshold.value=-22; comp.knee.value=18; comp.ratio.value=1.6; comp.attack.value=0.01; comp.release.value=0.18;

  // Envelope + breathing (subtle, non-invasive)
  const master = ac.createGain(); master.gain.value = 0.9;
  const analyser = ac.createAnalyser(); analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.88;

  const merge=ac.createGain(); const dry=ac.createGain(); dry.gain.value=1.0;
  const dest=ac.createMediaStreamDestination();

  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dry); dry.connect(merge);
  merge.connect(master); master.connect(analyser); analyser.connect(dest);

  // Replace audio element with processed output
  (audioEl as any).srcObject = dest.stream;
  await audioEl.play().catch(()=>{});

  // Light ambience (optional)
  let ambClean: null | (()=>void) = null;
  if(ambience!=='off') ambClean = createAmbience(ac, ambience, ambienceLevel);

  // Envelope: fade in/out on phrase boundaries
  const buf = new Uint8Array(analyser.frequencyBinCount);
  let speaking=false; let lastEnergy=0; let lastAbove=performance.now();
  const base = 0.9, minFloor = 0.16;
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
    if (speaking && ms - lastAbove > 320){
      speaking=false;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(minFloor, now, 0.20);
    }
    lastEnergy = energy;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  return ()=>{ try{ambClean && ambClean();}catch{}; [src,hp,lp,presence,body,sat,comp,merge,master,analyser,dry].forEach(n=>{try{(n as any).disconnect()}catch{}}); try{ac.close()}catch{}; };
}

/* ──────────────────────────────────────────────────────────────────────────
   PERSISTENCE — save every call to *scoped storage* (account-wide)
────────────────────────────────────────────────────────────────────────── */
function makeScopedAdapter(scoped?: ScopedLike){
  // Priority: explicit prop -> window.scopedStorage -> localStorage (dev)
  const winAny: any = (typeof window !== 'undefined') ? window : {};
  const globalScoped = winAny.scopedStorage;
  const client = scoped || globalScoped;

  const get = async (key:string) => {
    try{
      if (client?.get) return await client.get(key);
      const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null;
    }catch{ return null; }
  };
  const set = async (key:string, value:any) => {
    try{
      if (client?.set) return await client.set(key, value);
      localStorage.setItem(key, JSON.stringify(value));
    }catch{}
  };
  const merge = async (key:string, patch:any) => {
    try{
      if (client?.merge) return await client.merge(key, patch);
      const cur = await get(key) || {};
      await set(key, { ...cur, ...patch });
    }catch{}
  };
  return { get, set, merge };
}

/* ──────────────────────────────────────────────────────────────────────────
   COMPONENT  — AI logic preserved; panel + transcript + persistence added
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
  accountId='default',
  agentId='default',
  scoped,
}: Props){
  const [connecting,setConnecting]=useState(false);
  const [connected,setConnected]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState<string>('');

  // voice list (unchanged)
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

  // persistence per-call
  const scopedStore = useMemo(()=> makeScopedAdapter(scoped), [scoped]);
  const STORE_KEY = `calls:${accountId}:${agentId}`;
  const callRef = useRef<{ id:string; startedAt:number; endedAt?:number; transcript: TranscriptRow[] }>({
    id: `call_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
    startedAt: Date.now(),
    transcript: []
  });

  useEffect(()=>{ const el=scrollerRef.current; if(!el) return; el.scrollTop=el.scrollHeight; },[log,connecting,connected]);

  // voices fetch (unchanged behavior)
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
      if(i===-1){
        const base:TranscriptRow={ id, who, text:'', at:Date.now(), done:false };
        const p=typeof patch==='function' ? (patch as any)(undefined) : patch;
        const nextRow={...base,...p};
        const next=[...prev,nextRow];
        // persist partials lightly (only every few chars)
        if (nextRow.done || (nextRow.text && nextRow.text.length%48===0)) persistTranscript(next);
        return next;
      }
      const next=[...prev];
      const p=typeof patch==='function' ? (patch as any)(next[i]):patch;
      next[i]={...next[i],...p};
      if (next[i].done || (next[i].text && next[i].text.length%48===0)) persistTranscript(next);
      return next;
    });
  };
  const addLine=(who:TranscriptRow['who'], text:string)=>{
    const id=`${who}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    const row={id,who,text,at:Date.now(),done:true};
    setLog(prev=>{ const next=[...prev,row]; persistTranscript(next); return next; });
  };

  const safeSend=(dc:RTCDataChannel|null, payload:any)=>{
    if(!dc||dc.readyState!=='open') return; try{ dc.send(JSON.stringify(payload)); }catch{}
  };

  // Save transcript to scoped storage (append under account+agent)
  async function persistTranscript(rows: TranscriptRow[]){
    callRef.current.transcript = rows;
    try{
      const list = (await scopedStore.get(STORE_KEY)) || [];
      const idx = list.findIndex((c:any)=>c?.id===callRef.current.id);
      if (idx === -1) list.push(callRef.current);
      else list[idx] = callRef.current;
      await scopedStore.set(STORE_KEY, list);
    }catch{/* ignore */}
  }

  // minimal output ducking while you speak (unchanged)
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

  /* ────────────────────────────────────────────────────────────────────────
     START CALL — same logic, tiny additions:
     - remove languageNudge (so systemPrompt rules language)
     - longer server VAD pause
     - pre-speech delay in instructions hint (soft)
  ──────────────────────────────────────────────────────────────────────── */
  async function startCall(){
    setError('');
    if(!apiKey){ setError('No API key selected.'); onError?.('No API key'); return; }
    try{
      setConnecting(true);
      callRef.current = { id: `call_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, startedAt: Date.now(), transcript: [] };
      persistTranscript([]);

      // 1) ephemeral
      const sessionRes=await fetch(ephemeralEndpoint,{
        method:'POST', headers:{ 'Content-Type':'application/json', 'X-OpenAI-Key':apiKey },
        body:JSON.stringify({ model, voiceName:voiceId, assistantName, systemPrompt }),
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

      // 4) data channel (unchanged)
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        // Build instructions from your systemPrompt only
        const style = [
          systemPrompt || '',
          // soft human touches; these are stylistic and non-breaking
          'Before speaking, pause ~450ms as if thinking.',
          `Use gentle micro-pauses (~${prosody?.microPausesMs ?? 120}ms) within sentences.`,
          'Between sentences, breathe lightly and keep a natural pace.',
        ].filter(Boolean).join('\n\n');
        baseInstructionsRef.current = style;

        // session config (same, but with longer turn_end silence)
        safeSend(dc,{ type:'session.update', session:{
          instructions: baseInstructionsRef.current,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities:['audio','text'],
          // Let the server wait longer before it replies (less barge-in)
          turn_detection:{
            type:'server_vad',
            threshold:0.5,
            prefix_silence_ms: 100,
            silence_duration_ms: Math.max(900, prosody?.turnEndPauseMs ?? 1600), // ← longer pause by default
          },
        }});

        // ——— Greeting logic (kept as-is) ———
        const wantClientGreeting =
          greetMode==='client' ||
          (greetMode==='server' && firstMode==='Assistant speaks first');

        if (wantClientGreeting) {
          const greet = () => {
            const lines=(firstMsg||'Hello.').split(/\r?\n|\|/g).map(s=>s.trim()).filter(Boolean).slice(0,6);
            for(const ln of lines){
              safeSend(dc,{ type:'response.create', response:{ modalities:['audio','text'], instructions: ln }});
            }
          };

          if (greetMode==='client') {
            greet();
          } else {
            setTimeout(()=>{
              if (!sawAssistantDeltaRef.current) greet();
            }, 1200);
          }
        }
      };

      // 5) events — EXACTLY your logic; plus persistence
      dc.onmessage=(ev)=>{
        try{
          const msg=JSON.parse(ev.data); const t=msg?.type as string;

          // assistant stream
          if(t==='response.output_text.delta'){
            sawAssistantDeltaRef.current = true;
            const id=msg?.response_id||msg?.id||'assistant_current';
            const delta=String(msg?.delta||'');
            upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+delta }));
          }
          if(t==='response.completed'||t==='response.stop'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            upsert(id,'assistant',{ done:true });
          }
          if(t==='response.output_text' && typeof msg?.text==='string'){
            sawAssistantDeltaRef.current = true;
            addLine('assistant', msg.text);
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
            addLine('user', msg.text);
          }
        }catch{}
      };

      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='connected'){ setConnected(true); setConnecting(false); }
        else if(['disconnected','failed','closed'].includes(pc.connectionState)){ endCall(false); }
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
    dcRef.current=null;
    try{ pcRef.current?.close(); }catch{}
    pcRef.current=null;
    try{ micStreamRef.current?.getTracks()?.forEach(t=>t.stop()); }catch{}
    micStreamRef.current=null;
    try{ closeChainRef.current && closeChainRef.current(); }catch{}
    closeChainRef.current = null;

    // finalize and persist call end
    (async()=>{
      try{
        callRef.current.endedAt = Date.now();
        const list = (await scopedStore.get(STORE_KEY)) || [];
        const idx = list.findIndex((c:any)=>c?.id===callRef.current.id);
        if (idx === -1) list.push(callRef.current); else list[idx] = callRef.current;
        await scopedStore.set(STORE_KEY, list);
      }catch{}
    })();
  }
  function endCall(userIntent=true){ cleanup(); setConnected(false); setConnecting(false); if(userIntent) onClose?.(); }

  // start on mount / voice change
  useEffect(()=>{ startCall(); return ()=>{ cleanup(); }; // eslint-disable-next-line
  },[voiceId]);

  /* ────────────────────────────────────────────────────────────────────────
     UI — full-height slide-over panel (top → bottom)
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
        {/* Voice dropdown left in (your logic chooses actual voice id) */}
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
