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
};

type Props = {
  className?: string;
  model: string;                 // hidden from UI
  systemPrompt: string;
  voiceName: string;             // friendly or id
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
};

/* ──────────────────────────────────────────────────────────────────────────
   STYLE / VOICE HELPERS
────────────────────────────────────────────────────────────────────────── */
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';
const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

const ALLOWED_VOICE_IDS = [
  'alloy','ash','ballad','coral','echo','sage','shimmer','verse','marin','cedar'
] as const;
const DEFAULT_VOICES = ['alloy','verse','coral','sage'];

const FRIENDLY_TO_ID_ENTRIES: Array<[RegExp, string]> = [
  [/^\s*alloy(\s*\(.*\))?\s*$/i, 'alloy'],
  [/^\s*verse(\s*\(.*\))?\s*$/i, 'verse'],
  [/^\s*coral(\s*\(.*\))?\s*$/i, 'coral'],
  // “Amber (Australian)” isn’t an id → map to a valid one
  [/^\s*amber(\s*\(.*\))?\s*$/i, 'cedar'],
  [/^\s*ash(\s*\(.*\))?\s*$/i, 'ash'],
  [/^\s*ballad(\s*\(.*\))?\s*$/i, 'ballad'],
  [/^\s*echo(\s*\(.*\))?\s*$/i, 'echo'],
  [/^\s*sage(\s*\(.*\))?\s*$/i, 'sage'],
  [/^\s*shimmer(\s*\(.*\))?\s*$/i, 'shimmer'],
  [/^\s*marin(\s*\(.*\))?\s*$/i, 'marin'],
  [/^\s*cedar(\s*\(.*\))?\s*$/i, 'cedar'],
];

function resolveVoiceId(input: string){
  if (!input) return 'alloy';
  const raw = String(input).trim();
  const lower = raw.toLowerCase();
  const exact = ALLOWED_VOICE_IDS.find(v => v === lower);
  if (exact) return exact;
  for (const [rx, id] of FRIENDLY_TO_ID_ENTRIES) if (rx.test(raw)) return id;
  const stripped = raw.replace(/\(.*?\)/g, '').trim().toLowerCase();
  return (ALLOWED_VOICE_IDS.find(v => v === stripped) ?? 'alloy');
}

/* ──────────────────────────────────────────────────────────────────────────
   StyledSelect (match your VoiceAgentSection)
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
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-[6px] text-sm outline-none transition"
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
            borderRadius:8,
            boxShadow:'0 24px 64px rgba(0,0,0,.60), 0 8px 20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[6px]"
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
                className="w-full text-left text-sm px-2.5 py-2 rounded-[6px] transition grid grid-cols-[18px_1fr_auto] items-center gap-2 disabled:opacity-60"
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

const fmtTime = (ts:number)=>new Date(ts).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

function languageNudge(lang: Props['languageHint']){
  if (lang==='auto') return 'Auto-detect and reply in the caller’s language (EN/DE/NL/ES/AR).';
  const map:Record<string,string>={
    en:'Reply in natural conversational English.',
    de:'Antworte natürlich auf Deutsch.',
    nl:'Antwoord in natuurlijk Nederlands.',
    es:'Responde en español conversacional.',
    ar:'يرجى الرد بالعربية بأسلوب محادثة طبيعي.',
  }; return map[lang||'auto']||'';
}

/* light phone-ish filter + ambience (optional) */
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
  const g=ac.createGain(); g.gain.value=0.18*Math.min(1,Math.max(0,level));
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

  useEffect(()=>{ const el=scrollerRef.current; if(!el) return; el.scrollTop=el.scrollHeight; },[log,connecting,connected]);

  // fetch voices from OpenAI Platform (best effort)
  useEffect(()=>{
    let cancelled=false;
    const fallback = Array.from(new Set([resolveVoiceId(voiceName), ...DEFAULT_VOICES])) as string[];
    (async()=>{
      try{
        const r=await fetch('https://api.openai.com/v1/voices',{ headers:{ Authorization:`Bearer ${apiKey}` }});
        if(!r.ok) throw new Error(String(r.status));
        const j=await r.json();
        let ids:Array<string>=Array.isArray(j?.data)? j.data.map((v:any)=>v?.id).filter(Boolean):[];
        ids = ids.filter(id => ALLOWED_VOICE_IDS.includes(String(id)));
        if(!ids.length) ids=fallback;
        if(!cancelled){
          setVoices(ids);
          const wanted = resolveVoiceId(voiceName);
          setSelectedVoice(ids.includes(wanted) ? wanted : (ids[0]||'alloy'));
        }
      }catch{
        if(!cancelled){
          setVoices(fallback);
          setSelectedVoice(fallback[0] || 'alloy');
        }
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

  // minimal VAD ducking
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

  async function startCall(){
    setError('');
    if(!apiKey){ setError('No API key selected.'); onError?.('No API key'); return; }
    try{
      setConnecting(true);

      // 1) ephemeral token from your backend
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
      const sendTrack=mic.getAudioTracks()[0];
      pc.addTrack(sendTrack, mic);
      pc.addTransceiver('audio',{ direction:'recvonly' });

      // 4) data channel
      const dc=pc.createDataChannel('oai-events'); dcRef.current=dc;

      dc.onopen=()=>{
        // base instructions
        const style = [
          systemPrompt || '',
          languageNudge(languageHint),
          prosody?.fillerWords ? 'Use mild, natural disfluencies.' : '',
          (prosody?.microPausesMs ? `Allow micro pauses (~${prosody.microPausesMs} ms).` : ''),
          (prosody?.turnEndPauseMs ? `Wait ~${prosody.turnEndPauseMs} ms of silence before replying.` : '')
        ].filter(Boolean).join('\n\n');
        baseInstructionsRef.current = style;

        // ── CRITICAL: transcripts on + server VAD ──
        safeSend(dc,{ type:'session.update', session:{
          instructions: baseInstructionsRef.current,
          voice: voiceId,
          input_audio_format:'pcm16',
          output_audio_format:'pcm16',
          modalities:['audio','text'],

          // USER speech → transcript (incremental + final)
          input_audio_transcription: { model: 'whisper-1' },

          // Let server handle turn-taking so deltas are clean
          turn_detection: {
            type: 'server_vad',
            threshold: 0.5,
            prefix_silence_ms: 80,
            silence_duration_ms: Math.max(120, prosody?.turnEndPauseMs ?? 160),
          },
        }});

        // ——— Greeting logic (no duplicates) ———
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

      // 5) events — catch ALL assistant + user transcript shapes
      dc.onmessage=(ev)=>{
        try{
          const msg=JSON.parse(ev.data);
          const t = String(msg?.type || '');

          // —— ASSISTANT TEXT STREAMS ——
          if (t === 'response.output_text.delta') {
            sawAssistantDeltaRef.current = true;
            const id=msg?.response_id||msg?.id||'assistant_current';
            const delta=msg?.delta||'';
            upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+String(delta) }));
          }
          if (t === 'response.output_text' && typeof msg?.text==='string') {
            sawAssistantDeltaRef.current = true;
            addLine('assistant', msg.text);
          }
          // Some runtimes also send spoken-audio transcript separately:
          if (t === 'response.audio_transcript.delta') {
            const id=msg?.response_id||msg?.id||'assistant_current';
            upsert(id,'assistant',(prev)=>({ text:(prev?.text||'')+String(msg?.delta||'') }));
          }
          if (t === 'response.audio_transcript.completed' || t === 'response.completed' || t === 'response.stop') {
            const id=msg?.response_id||msg?.id||'assistant_current';
            upsert(id,'assistant',{ done:true });
          }
          // Fallback: assistant message created with text content
          if (t === 'conversation.item.created' && msg?.item?.type==='message' && msg?.item?.role==='assistant') {
            const text=(msg?.item?.content||[]).map((c:any)=>c?.text||c?.transcript||'').join(' ').trim();
            if (text) addLine('assistant', text);
          }

          // —— USER TRANSCRIPTS ——
          const isUserDelta =
            /(^|\.)(input_.*transcript|transcript)(\.|_)delta$/.test(t) ||
            t === 'conversation.item.input_audio_transcript.delta' ||
            t === 'input_audio_buffer.transcript.delta';

          const isUserComplete =
            /(^|\.)(input_.*transcript|transcript)(\.|_)completed?$/.test(t) ||
            t === 'conversation.item.input_audio_transcript.completed' ||
            t === 'input_audio_buffer.transcript.completed';

          if (isUserDelta) {
            const id = msg?.transcript_id || msg?.item_id || msg?.id || 'user_current';
            const d  = msg?.delta || msg?.text || '';
            upsert(id,'user',(prev)=>({ text:(prev?.text||'')+String(d) }));
          }
          if (isUserComplete) {
            const id = msg?.transcript_id || msg?.item_id || msg?.id || 'user_current';
            upsert(id,'user',{ done:true });
          }

          // Single-shot fallback
          if ((t.includes('transcript') || t.includes('input_audio_buffer')) && typeof msg?.text === 'string' && !msg?.delta) {
            addLine('user', msg.text);
          }
        }catch{/* ignore parse errors */}
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
        headers:{ Authorization:`Bearer ${session.client_secret.value}`, 'Content-Type':'application/sdp', 'OpenAI-Beta':'realtime=v1' },
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
  }
  function endCall(userIntent=true){ cleanup(); setConnected(false); setConnecting(false); if(userIntent) onClose?.(); }

  // start on mount / when voice changes
  useEffect(()=>{ startCall(); return ()=>{ cleanup(); }; // eslint-disable-next-line
  },[voiceId]);

  /* ────────────────────────────────────────────────────────────────────────
     UI — FULL-HEIGHT RIGHT SHEET (overlay style), less rounded
  ───────────────────────────────────────────────────────────────────────── */
  const header = (
    <div className="va-head" style={{ minHeight: 68 }}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="inline-grid place-items-center w-9 h-9 rounded-[6px]"
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
          className="w-9 h-9 rounded-[6px] grid place-items-center"
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
          className="w-9 h-9 rounded-[6px] grid place-items-center"
          style={{ border:'1px solid rgba(239,68,68,.38)', background:'rgba(239,68,68,.18)', color:'#ffd7d7' }}
          title="End call"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="p-3 md:p-4" style={{ color:'var(--text)', overflowY:'auto' }}>
      <div ref={scrollerRef} className="space-y-3" style={{ minHeight:'100%' }}>
        {log.length===0 && (
          <div
            className="text-sm rounded-[6px] px-3 py-2 border"
            style={{ color:'var(--text-muted)', background:'var(--panel)', borderColor:'rgba(255,255,255,.10)' }}
          >
            {connecting ? 'Connecting to voice…' :
             firstMode==='Assistant speaks first' ? 'Assistant will greet you shortly…' : 'Say something to start — your words will appear here.'}
          </div>
        )}

        {log.map(row=>(
          <div key={row.id} className={`flex ${row.who==='user' ? 'justify-end' : 'justify-start'}`}>
            {row.who==='assistant' && (
              <div className="mr-2 mt-[2px] shrink-0 rounded-[6px] w-8 h-8 grid place-items-center"
                   style={{ background:'rgba(89,217,179,.12)', border:'1px solid rgba(89,217,179,.25)' }}>
                <Bot className="w-4 h-4" style={{ color: CTA }} />
              </div>
            )}
            <div
              className="max-w-[78%] rounded-[10px] px-3 py-2 text-[0.95rem] leading-snug border"
              style={{
                background: row.who==='user' ? 'rgba(56,196,143,.18)' : 'rgba(255,255,255,.06)',
                borderColor: row.who==='user' ? 'rgba(56,196,143,.35)' : 'rgba(255,255,255,.14)',
              }}
            >
              <div>{row.text || <span style={{ opacity:.5 }}>…</span>}</div>
              <div className="text-[10px] mt-1 opacity-60 text-right">{fmtTime(row.at)}</div>
            </div>
            {row.who==='user' && (
              <div className="ml-2 mt-[2px] shrink-0 rounded-[6px] w-8 h-8 grid place-items-center"
                   style={{ background:'rgba(255,255,255,.10)', border:'1px solid rgba(255,255,255,.18)' }}>
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {error && (
          <div className="text-xs px-3 py-2 rounded-[6px] border"
               style={{ background:'rgba(239,68,68,.12)', borderColor:'rgba(239,68,68,.25)', color:'#ffd7d7' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );

  const footer = (
    <div className="px-3 py-2 border-t" style={{ borderColor:'rgba(255,255,255,.10)', color:'var(--text)' }}>
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

  // full-height right sheet (overlay style)
  const panel = (
    <aside
      className={`va-card ${className || ''}`}
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'clamp(380px, 34vw, 560px)',
        zIndex: 100010,
        background: 'var(--panel-bg)',
        color: 'var(--text)',
        borderLeft: `1px solid ${GREEN_LINE}`,
        borderTopLeftRadius: 8,
        borderBottomLeftRadius: 8,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,
        display: 'grid',
        gridTemplateRows: '68px 1fr 52px',
        overflow: 'hidden',
        boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)',
      }}
      role="dialog"
      aria-label="Voice call panel"
    >
      {header}
      {body}
      {footer}
    </aside>
  );

  if (!IS_CLIENT) return null;
  return createPortal(panel, document.body);
}
