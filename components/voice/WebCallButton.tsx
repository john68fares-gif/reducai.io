'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Mic, MicOff, X, Bot, User, Loader2, ChevronDown } from 'lucide-react';

/* ───────────────────────── Props ───────────────────────── */
type Props = {
  className?: string;
  model: string;                 // initial model from Voice Agent
  models?: string[];             // ✅ full list injected by Voice Agent
  systemPrompt: string;
  voiceName: string;             // friendly or OpenAI voice id
  assistantName: string;
  apiKey: string;
  onClose?: () => void;

  firstMode?: 'Assistant speaks first' | 'User speaks first' | 'Silent until tool required';
  firstMsg?: string;
  languageHint?: 'auto' | 'en' | 'de' | 'nl' | 'es' | 'ar';

  // Audio realism
  phoneFilter?: boolean;
  farMic?: boolean;
  ambience?: 'off' | 'kitchen' | 'cafe';
  ambienceLevel?: number;
};

/* ───────────────────────── Types / utils ───────────────────────── */
type TranscriptRow = { id:string; who:'user'|'assistant'; text:string; at:number; done?:boolean };
type Mood = 'joke'|'sad'|'angry'|'positive'|'neutral';

const RAW_ID = /^[a-z0-9._-]{3,}$/i;
const pick = <T,>(a:T[]) => a[Math.floor(Math.random()*a.length)];
const clamp01 = (v:number)=>Math.max(0,Math.min(1,v));
const fmt = (ts:number)=>new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

/* voices */
const HUMAN_LIKE = new Set(['alloy','verse','coral','amber','sage','juniper','opal','pebble','cobalt']);
const DEFAULT_VOICES = ['alloy','verse','coral','amber','sage','juniper'];
const FRIENDLY_TO_ID: Record<string,string> = {
  'Alloy (American)':'alloy','Verse (American)':'verse','Coral (British)':'coral','Amber (Australian)':'amber',
  Alloy:'alloy', Verse:'verse', Coral:'coral', Amber:'amber', Sage:'sage', Juniper:'juniper'
};

/* humanization */
const BACKCHANNEL = ['Let me check that…','One moment—checking.','Sure, give me a sec…','Okay, I’m on it.','Alright, looking that up…'];
const FILLERS = ['hmm…','uh…','let’s see…','right…','okay…'];
const LAUGHS = ['ha— that’s good!','heh, nice one.','(soft laugh) yeah, that got me.'];
const THINKING_PAUSE = [900,1200,1500,1800];
const BACKCHANNEL_PROB = 0.18;
const BACKCHANNEL_COOLDOWN_MS = 4200;

/* mood + language */
function detectMood(s:string):Mood{
  const t=(s||'').toLowerCase();
  if(!t.trim())return'neutral';
  if(/(haha|lol|🤣|😅|😆|good one|grap|grappig)/.test(t))return'joke';
  if(/(sad|upset|depress|😭|😢|bad day|verdrietig|baal)/.test(t))return'sad';
  if(/(angry|mad|furious|annoyed|wtf|sucks|terrible|awful|!!+|boos)/.test(t))return'angry';
  if(/(great|awesome|nice|love|perfect|amazing|thanks!?|top|geweldig|lekker)/.test(t))return'positive';
  return'neutral';
}
function styleForMood(m:Mood){
  switch(m){
    case'joke':return'If the caller jokes, give a short natural laugh before answering.';
    case'sad':return'Sound warm and supportive. Slow down slightly and acknowledge feelings.';
    case'angry':return'Stay calm and professional. Lower intensity, acknowledge frustration, focus on solutions.';
    case'positive':return'Be upbeat and friendly; keep it natural.';
    default:return'Keep a relaxed conversational tone.';
  }
}
function languageNudge(lang: Props['languageHint']){
  if(lang==='auto')return'Auto-detect and reply in the user’s language (English, German, Dutch, Spanish, or Arabic).';
  const map:Record<string,string>={
    en:'Respond in natural, conversational English with contractions.',
    de:'Antworte natürlich und umgangssprachlich auf Deutsch.',
    nl:'Antwoord in natuurlijk, informeel Nederlands.',
    es:'Responde en español conversacional.',
    ar:'يرجى الرد بالعربية بأسلوب محادثة طبيعي.',
  }; return map[lang]||'';
}
function baseStyle(lang: Props['languageHint']){
  const langN=languageNudge(lang);
  const shared=[
    'If the user states explicit formatting rules, follow them strictly until they say otherwise.',
    'Do not speak over the caller; if the caller starts talking, stop.',
    'Wait ~1–2 seconds of silence before replying (unless a brief acknowledgement).',
    'Use natural pacing with mild disfluencies; avoid rigid menu patterns.',
  ].join(' ');
  return `${langN}\n\n${shared}`;
}
const turnStyleNudge=()=>pick([
  'Vary intonation; avoid flat delivery.',
  'Give a short acknowledgement before details.',
  'If the user hesitates, slow down and simplify.',
  'Keep options conversational, not templated.',
]);

/* ───────────────────────── WebAudio (phone/ambience) ───────────────────────── */
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
async function attachProcessedAudio(audioEl:HTMLAudioElement, remote:MediaStream, opts:{phoneFilter:boolean;farMic:boolean;ambience:'off'|'kitchen'|'cafe';ambienceLevel:number}){
  const { phoneFilter, farMic, ambience, ambienceLevel } = opts;
  if(!phoneFilter){ (audioEl as any).srcObject=remote; await audioEl.play().catch(()=>{}); return ()=>{}; }
  const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
  const src=ac.createMediaStreamSource(remote);
  const hp=ac.createBiquadFilter(); hp.type='highpass'; hp.frequency.value=70;
  const lp=ac.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=12000;
  const presence=ac.createBiquadFilter(); presence.type='peaking'; presence.frequency.value=2800; presence.Q.value=0.9; presence.gain.value=1.6;
  const body=ac.createBiquadFilter(); body.type='lowshelf'; body.frequency.value=160; body.gain.value=1.2;
  const sat=createSaturator(ac,1.05);
  const comp=ac.createDynamicsCompressor();
  comp.threshold.value=-20; comp.knee.value=18; comp.ratio.value=1.7; comp.attack.value=0.008; comp.release.value=0.18;
  const wet=ac.createGain(); wet.gain.value=farMic?0.01:0.0;
  const merge=ac.createGain(); const dry=ac.createGain(); dry.gain.value=1.0; const dest=ac.createMediaStreamDestination();
  src.connect(hp); hp.connect(lp); lp.connect(presence); presence.connect(body); body.connect(sat); sat.connect(comp);
  comp.connect(dry); dry.connect(merge); comp.connect(wet); wet.connect(merge); merge.connect(dest);
  (audioEl as any).srcObject=dest.stream; await audioEl.play().catch(()=>{});
  let ambClean:null|(()=>void)=null; if(ambience!=='off') ambClean=createAmbience(ac,ambience,ambienceLevel);
  return ()=>{ [src,hp,lp,presence,body,sat,comp,wet,merge,dry].forEach(n=>{try{(n as any).disconnect()}catch{}}); try{ac.close()}catch{}; if(ambClean) try{ambClean()}catch{} };
}

/* ───────────────────────── Component ───────────────────────── */
export default function WebCallPanel({
  className,
  model,
  models = [],                // ✅ models from parent (Voice Agent)
  systemPrompt,
  voiceName: voiceProp,
  assistantName,
  apiKey,
  onClose,
  firstMode='Assistant speaks first',
  firstMsg='Hello.',
  languageHint='auto',
  phoneFilter=false,
  farMic=false,
  ambience='off',
  ambienceLevel=0.08,
}: Props){
  const [connecting,setConnecting]=useState(false);
  const [connected,setConnected]=useState(false);
  const [muted,setMuted]=useState(false);
  const [error,setError]=useState<string>('');
  const [voices,setVoices]=useState<string[]>([]);
  const [selectedVoice,setSelectedVoice]=useState<string>('');
  const [selectedModel,setSelectedModel]=useState<string>(model || 'gpt-4o-realtime-preview');
  const [log,setLog]=useState<TranscriptRow[]>([]);
  const logRef=useRef<TranscriptRow[]>([]);
  useEffect(()=>{ logRef.current=log; },[log]);

  const audioRef=useRef<HTMLAudioElement|null>(null);
  const pcRef=useRef<RTCPeerConnection|null>(null);
  const micStreamRef=useRef<MediaStream|null>(null);
  const dcRef=useRef<RTCDataChannel|null>(null);

  const closeChainRef=useRef<null|(()=>void)>(null);
  const vadLoopRef=useRef<number|null>(null);
  const lastMicActiveAtRef=useRef<number>(0);
  const lastBackchannelAtRef=useRef<number>(0);
  const baseInstructionsRef=useRef<string>('');
  const scrollerRef=useRef<HTMLDivElement|null>(null);

  // resolve voice id
  const voiceId=useMemo(()=>{
    const key=(selectedVoice||voiceProp||'').trim();
    if(RAW_ID.test(key)&&!FRIENDLY_TO_ID[key]) return key.toLowerCase();
    return FRIENDLY_TO_ID[key] || key || 'alloy';
  },[selectedVoice,voiceProp]);

  // fetch voices (filtered)
  useEffect(()=>{
    let cancelled=false;
    (async()=>{
      const fallback=Array.from(new Set([voiceProp,...DEFAULT_VOICES].filter(Boolean))) as string[];
      try{
        const r=await fetch('https://api.openai.com/v1/voices',{ headers:{ Authorization:`Bearer ${apiKey}` }});
        if(!r.ok) throw new Error(String(r.status));
        const j=await r.json();
        let ids:Array<string>=Array.isArray(j?.data)? j.data.map((v:any)=>v?.id).filter(Boolean):[];
        ids=ids.filter(id=>HUMAN_LIKE.has(id)); if(!ids.length) ids=fallback;
        if(!cancelled){ setVoices(ids); setSelectedVoice(ids[0]||'alloy'); }
      }catch{
        if(!cancelled){ setVoices(fallback); setSelectedVoice(fallback[0]||'alloy'); }
      }
    })();
    return()=>{ cancelled=true; };
  },[apiKey,voiceProp]);

  // helpers
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
  const splitFirst=(input:string)=> (input||'').split(/\r?\n|\|/g).map(s=>s.trim()).filter(Boolean).slice(0,20);

  // auto scroll to bottom
  useEffect(()=>{
    const el=scrollerRef.current; if(!el) return;
    el.scrollTop = el.scrollHeight;
  },[log,connecting,connected]);

  // gentle VAD ducking
  async function setupVAD(){
    try{
      const mic=micStreamRef.current; if(!mic) return;
      const AC=(window.AudioContext||(window as any).webkitAudioContext); const ac=new AC();
      const src=ac.createMediaStreamSource(mic); const an=ac.createAnalyser(); an.fftSize=512; an.smoothingTimeConstant=0.88;
      src.connect(an);
      const buf=new Uint8Array(an.frequencyBinCount);
      const loop=()=>{ an.getByteFrequencyData(buf); let sum=0; for(let i=0;i<buf.length;i++) sum+=buf[i]*buf[i];
        const rms=Math.sqrt(sum/buf.length)/255;
        if(rms>0.07){ lastMicActiveAtRef.current=Date.now(); if(audioRef.current) audioRef.current.volume=0.35; }
        else{ if(audioRef.current) audioRef.current.volume=1.0; }
        vadLoopRef.current=requestAnimationFrame(loop);
      };
      vadLoopRef.current=requestAnimationFrame(loop);
      return ()=>{ try{ac.close()}catch{} };
    }catch{ return ()=>{}; }
  }
  const userSilentFor=(ms:number)=> Date.now()-(lastMicActiveAtRef.current||0)>ms;

  /* ─────────────── start call ─────────────── */
  async function startCall(){
    setError('');
    if(!apiKey){ setError('No API key selected.'); return; }
    try{
      setConnecting(true);
      // 1) ephemeral
      const sessionRes=await fetch('/api/voice/ephemeral',{
        method:'POST', headers:{ 'Content-Type':'application/json', 'X-OpenAI-Key':apiKey },
        body:JSON.stringify({ model: selectedModel, voiceName:voiceId, assistantName, systemPrompt }),
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
        closeChainRef.current=await attachProcessedAudio(audioRef.current, remote, { phoneFilter, farMic, ambience, ambienceLevel });
      };

      const sendTrack=mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio',{ direction:'recvonly' });

      // 4) data channel
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        const style=[baseStyle(languageHint),turnStyleNudge()].join(' ');
        baseInstructionsRef.current=`${systemPrompt || ''}\n\n${style}`;

        // ✅ Ensure text + transcription are emitted
        safeSend(dc,{ type:'session.update', session:{
          instructions: baseInstructionsRef.current,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities: ['audio','text'],
          input_audio_transcription: { enabled: true },
        }});

        if(firstMode==='Assistant speaks first'){
          const lines=splitFirst(firstMsg||'Hello.');
          const startAt=Date.now();
          const gate=setInterval(()=>{
            const quiet=userSilentFor(1200);
            const timeout=Date.now()-startAt>2200;
            if(quiet||timeout){
              clearInterval(gate);
              lines.forEach((ln,idx)=>{
                const jitter=220+Math.random()*240;
                const delay=idx*(340+Math.random()*200)+jitter;
                setTimeout(()=> safeSend(dc,{ type:'response.create', response:{ modalities:['audio'], instructions: ln } }), delay);
              });
            }
          },120);
        }
      };

      // 5) messages (TRANSCRIPTS for user + assistant)
      dc.onmessage=(ev)=>{
        try{
          const msg=JSON.parse(ev.data); const t=msg?.type as string;

          // Assistant text stream
          if(t==='response.output_text.delta'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            const delta=msg?.delta||'';
            upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+String(delta) }));
          }
          if(t==='response.completed'||t==='response.stop'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            upsert(id,'assistant',{ done:true });
          }
          if(t==='response.output_text' && typeof msg?.text==='string'){
            addLine('assistant', msg.text);
          }

          // Some models emit assistant speech-only; if they send audio transcript deltas, capture those too.
          if(t==='response.audio_transcript.delta'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            const delta=msg?.delta||'';
            upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+String(delta) }));
          }
          if(t==='response.audio_transcript.done'){
            const id=msg?.response_id||msg?.id||'assistant_current';
            upsert(id,'assistant',{ done:true });
          }

          // User speech transcript stream
          if(t==='transcript.delta'){
            const id=msg?.transcript_id||msg?.id||'user_current';
            const delta=msg?.delta||'';
            upsert(id,'user',(prev)=>({ text:(prev?.text||'')+String(delta) }));
          }
          if(t==='transcript.completed'){
            const id=msg?.transcript_id||msg?.id||'user_current';
            upsert(id,'user',{ done:true });

            const row = logRef.current.find(r=>r.id===id);
            const text=(row?.text||'').trim();
            const mood=detectMood(text);

            const dutchLikely=/ de | het | een | jij | je | we | wij | lekker | alsjeblieft | dank je | bedankt | hoe | wat | waarom | grap /.test(text.toLowerCase());
            const langAdj=dutchLikely ? 'Spreek vlot en informeel Nederlands; varieer intonatie en tempo.' : '';
            const appended=`${baseInstructionsRef.current}\n\n${styleForMood(mood)} ${turnStyleNudge()} ${langAdj}`.trim();

            safeSend(dcRef.current,{ type:'session.update', session:{ instructions: appended } });

            const wait=pick(THINKING_PAUSE);
            setTimeout(()=>{
              const now=Date.now();
              if(now-(lastBackchannelAtRef.current||0)>BACKCHANNEL_COOLDOWN_MS && Math.random()<=BACKCHANNEL_PROB){
                lastBackchannelAtRef.current=now;
                safeSend(dcRef.current,{ type:'response.create', response:{ modalities:['audio'], instructions: pick(BACKCHANNEL) }});
              }
              if(mood==='joke'){
                safeSend(dcRef.current,{ type:'response.create', response:{ modalities:['audio'], instructions: pick(LAUGHS) }});
              } else if(Math.random()<0.08){
                safeSend(dcRef.current,{ type:'response.create', response:{ modalities:['audio'], instructions: pick(FILLERS) }});
              }
            }, wait);
          }
        }catch{}
      };

      pc.onconnectionstatechange=()=>{
        if(pc.connectionState==='connected'){ setConnected(true); setConnecting(false); }
        else if(['disconnected','failed','closed'].includes(pc.connectionState)){ endCall(false); }
      };

      // 6) SDP
      const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
      const url=`https://api.openai.com/v1/realtime?model=${encodeURIComponent(selectedModel)}`;
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
      setError(e?.message||'Failed to start call.'); cleanup();
    }
  }

  /* controls / cleanup */
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
    closeChainRef.current = null; // ✅ do NOT reassign the ref object itself
  }
  function endCall(userIntent=true){ cleanup(); setConnected(false); setConnecting(false); if(userIntent) onClose?.(); }

  // re-start call when model/voice changes
  useEffect(()=>{ lastMicActiveAtRef.current=Date.now(); startCall(); return ()=>{ cleanup(); }; // eslint-disable-next-line
  },[selectedModel,voiceId]);

  /* ───────────────────────── UI — fixed overlay via portal ───────────────────────── */
  const panel = (
    <aside
      className={`fixed top-0 right-0 h-screen w-[min(480px,95vw)] bg-[#0d0f11] border-l border-[rgba(255,255,255,.12)] shadow-2xl flex flex-col ${className||''}`}
      style={{ zIndex: 200000 }}
      role="dialog"
      aria-label="Voice call panel"
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,255,255,.10)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="inline-grid place-items-center w-7 h-7 rounded-full" style={{ background:'rgba(89,217,179,.12)' }}>
            <Bot className="w-4 h-4" style={{ color:'#59d9b3' }} />
          </div>
          <div className="min-w-0">
            <div className="text-xs" style={{ color:'rgba(255,255,255,.6)' }}>Talking to</div>
            <div className="font-semibold truncate" style={{ color:'#e6f1ef' }}>{assistantName || 'Assistant'}</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Model selector — from Voice Agent */}
          <div className="relative">
            <select
              className="appearance-none bg-transparent text-xs rounded-[8px] px-2.5 py-1.5 pr-7"
              style={{ border:'1px solid rgba(255,255,255,.14)', color:'#e6f1ef' }}
              value={selectedModel}
              onChange={(e)=>setSelectedModel(e.target.value)}
              title="Model"
            >
              { (models.length ? models : [model]).map(m => (
                <option key={m} value={m}>{m}</option>
              )) }
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-2" style={{ color:'rgba(255,255,255,.6)' }} />
          </div>

          {/* Voice selector */}
          <div className="relative">
            <select
              className="appearance-none bg-transparent text-xs rounded-[8px] px-2.5 py-1.5 pr-7"
              style={{ border:'1px solid rgba(255,255,255,.14)', color:'#e6f1ef' }}
              value={voiceId}
              onChange={(e)=>setSelectedVoice(e.target.value)}
              title="Voice"
            >
              {(voices.length?voices:DEFAULT_VOICES).map(v=>(
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 absolute right-2 top-2" style={{ color:'rgba(255,255,255,.6)' }} />
          </div>

          <button
            onClick={toggleMute}
            className="w-8 h-8 rounded-[8px] grid place-items-center"
            style={{ border:'1px solid rgba(255,255,255,.14)', color:'#e6f1ef', background: muted ? 'rgba(239,68,68,.14)' : 'transparent' }}
            title={muted ? 'Unmute mic' : 'Mute mic'} aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted ? <MicOff className="w-4 h-4"/> : <Mic className="w-4 h-4" />}
          </button>

          <button
            onClick={()=>endCall(true)}
            className="w-8 h-8 rounded-[8px] grid place-items-center"
            style={{ border:'1px solid rgba(239,68,68,.38)', background:'rgba(239,68,68,.18)', color:'#ffd7d7' }}
            title="End call"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transcript — WhatsApp-style */}
      <div ref={scrollerRef} className="px-3 py-3 space-y-3 overflow-y-auto" style={{ scrollbarWidth:'thin', color:'#e6f1ef' }}>
        {log.length===0 && (
          <div className="text-sm" style={{ color:'rgba(255,255,255,.6)' }}>
            {connecting ? 'Connecting to voice…' : (firstMode==='Assistant speaks first' ? 'Waiting for assistant…' : 'Say hello! We’ll show the transcript here.')}
          </div>
        )}

        {log.map(row=>(
          <div key={row.id} className={`flex ${row.who==='user' ? 'justify-end' : 'justify-start'}`}>
            {row.who==='assistant' && (
              <div className="mr-2 mt-[2px] shrink-0 rounded-full w-7 h-7 grid place-items-center"
                   style={{ background:'rgba(89,217,179,.12)', border:'1px solid rgba(89,217,179,.25)' }}>
                <Bot className="w-4 h-4" style={{ color:'#59d9b3' }} />
              </div>
            )}

            <div className="max-w-[80%] rounded-2xl px-3 py-2 text-[0.95rem] leading-snug border"
                 style={{
                   background: row.who==='user' ? 'rgba(56,196,143,.18)' : 'rgba(255,255,255,.06)',
                   borderColor: row.who==='user' ? 'rgba(56,196,143,.35)' : 'rgba(255,255,255,.14)',
                 }}>
              <div>{row.text || <span style={{ opacity:.5 }}>…</span>}</div>
              <div className="text-[10px] mt-1 opacity-60 text-right">{fmt(row.at)}</div>
            </div>

            {row.who==='user' && (
              <div className="ml-2 mt-[2px] shrink-0 rounded-full w-7 h-7 grid place-items-center"
                   style={{ background:'rgba(255,255,255,.10)', border:'1px solid rgba(255,255,255,.18)' }}>
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="text-xs px-3 py-2 rounded-[8px] border"
               style={{ background:'rgba(239,68,68,.12)', borderColor:'rgba(239,68,68,.25)', color:'#ffd7d7' }}>
            {error}
          </div>
        )}
      </div>

      {/* Footer status */}
      <div className="px-3 py-2 border-t border-[rgba(255,255,255,.10)]" style={{ color:'#e6f1ef' }}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span style={{ opacity:.85 }}>
              {connected ? 'Connected' : (connecting ? 'Connecting…' : 'Idle')}
              {' '}• Model: {selectedModel} • Voice: {voiceId}
            </span>
          </div>
          <audio ref={audioRef} autoPlay playsInline />
        </div>
      </div>
    </aside>
  );

  if (typeof window === 'undefined') return null;
  return createPortal(panel, document.body);
}
