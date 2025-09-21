// components/voice/WebCallButton.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, PhoneOff, Mic, MicOff, Bot, User, Volume2, ChevronDown, Check, Lock, Search, Loader2, Play, Square
} from 'lucide-react';

const IS_CLIENT = typeof window !== 'undefined' && typeof document !== 'undefined';

// ——— visual tokens (match VoiceAgentSection)
const CTA = '#59d9b3';
const GREEN_LINE = 'rgba(89,217,179,.20)';

// Types
type Prosody = {
  fillerWords?: boolean;
  microPausesMs?: number;
  phoneFilter?: boolean;
  turnEndPauseMs?: number;
};

type LogRow = {
  id: string;
  who: 'user' | 'assistant';
  text: string;
  at: number;
};

type Opt = { value: string; label: string; disabled?: boolean; iconLeft?: React.ReactNode };

type Props = {
  model: string;                       // e.g., "gpt-4o-realtime-preview" or your own
  systemPrompt?: string;               // full backend/system content
  assistantName?: string;              // label
  voiceName?: string;                  // OpenAI TTS voice (ex: "alloy")
  apiKey: string;                      // API key selected in your panel (used only to mint ephemeral)
  ephemeralEndpoint: string;           // your /api/voice/ephemeral route
  prosody?: Prosody;                   // optional voice tweaks
  onError?: (err: any) => void;
  onClose?: () => void;

  // Optional: allow the panel to choose a voice using the dropdown (styled like the rest)
  availableVoices?: Opt[];             // if omitted we show a small non-interactive voice tag
};

// ————————————————————————————————————————————————————————————————————————
// Mini “StyledSelect” — Matches the look & feel in VoiceAgentSection (namespaced)
// ————————————————————————————————————————————————————————————————————————
function VASelect({
  value, onChange, options, placeholder, leftIcon, menuTop
}:{
  value: string; onChange: (v: string) => void;
  options: Opt[]; placeholder?: string; leftIcon?: React.ReactNode; menuTop?: React.ReactNode;
}) {
  const wrapRef = useRef<HTMLDivElement|null>(null);
  const btnRef  = useRef<HTMLButtonElement|null>(null);
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

  useEffect(() => {
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
          height:'var(--control-h,40px)',
          background:'var(--vs-input-bg, #101314)',
          border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))',
          color:'var(--text, #e6f1ef)'
        }}
      >
        <span className="flex items-center gap-2 truncate">
          {leftIcon}
          <span className="truncate">{current ? current.label : (placeholder || '— Choose —')}</span>
        </span>
        <ChevronDown className="w-4 h-4" style={{ color:'var(--text-muted, #9fb4ad)' }} />
      </button>

      {open && IS_CLIENT ? createPortal(
        <div
          ref={menuRef}
          className="fixed z-[100020] p-2"
          style={{
            left: (menuPos?.left ?? 0),
            top: (menuPos?.top ?? 0),
            width: (menuPos?.width ?? (btnRef.current?.getBoundingClientRect().width ?? 280)),
            background:'var(--vs-menu-bg, #101314)',
            border:'1px solid var(--vs-menu-border, rgba(255,255,255,.16))',
            borderRadius:10,
            boxShadow:'0 24px 64px rgba(0,0,0,.60), 0 8px 20px rgba(0,0,0,.45), 0 0 0 1px rgba(0,255,194,.10)'
          }}
        >
          {menuTop ? <div className="mb-2">{menuTop}</div> : null}

          <div
            className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-[8px]"
            style={{ background:'var(--vs-input-bg, #101314)', border:'1px solid var(--vs-input-border, rgba(255,255,255,.14))', color:'var(--text)' }}
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

// ————————————————————————————————————————————————————————————————————————
// WebCallButton — full-height right sheet with chat + realtime wiring
// ————————————————————————————————————————————————————————————————————————
export default function WebCallButton(props: Props) {
  const {
    model,
    systemPrompt,
    assistantName = 'Assistant',
    voiceName: initialVoice = 'alloy',
    apiKey,
    ephemeralEndpoint,
    prosody,
    onError,
    onClose,
    availableVoices,
  } = props;

  // UI state
  const [open, setOpen] = useState(true);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string>('');
  const [voiceName, setVoiceName] = useState(initialVoice);

  const [log, setLog] = useState<LogRow[]>([]);
  const audioRef = useRef<HTMLAudioElement|null>(null);
  const pcRef = useRef<RTCPeerConnection|null>(null);
  const dcRef = useRef<RTCDataChannel|null>(null);
  const micRef = useRef<MediaStream|null>(null);
  const currentAssistantIdRef = useRef<string| null>(null);
  const currentUserIdRef = useRef<string| null>(null);

  const pushRow = useCallback((who: 'user'|'assistant', text: string) => {
    const id = `${who}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
    setLog(prev => [...prev, { id, who, text, at: Date.now() }]);
    return id;
  }, []);

  const appendRow = useCallback((id: string, more: string) => {
    setLog(prev => prev.map(r => r.id === id ? { ...r, text: r.text + more } : r));
  }, []);

  const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });

  // ——— negotiate OpenAI Realtime over WebRTC with input transcription enabled
  const startCall = useCallback(async () => {
    if (!IS_CLIENT) return;
    setError('');
    setConnecting(true);

    try {
      // 1) Get mic
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      micRef.current = mic;

      // 2) Mint ephemeral key (server route you provided)
      const epRes = await fetch(ephemeralEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) });
      if (!epRes.ok) throw new Error(`Ephemeral error: ${await epRes.text()}`);
      const epJson = await epRes.json();
      const ephemeralKey: string =
        epJson?.client_secret?.value || epJson?.client_secret || epJson?.value || epJson?.token || '';

      if (!ephemeralKey) throw new Error('No ephemeral token returned');

      // 3) Create RTCPeerConnection
      const pc = new RTCPeerConnection();
      pcRef.current = pc;

      // remote audio to element
      pc.ontrack = (e) => {
        const [stream] = e.streams;
        if (audioRef.current) audioRef.current.srcObject = stream;
      };

      // add mic
      mic.getTracks().forEach(t => pc.addTrack(t, mic));

      // play incoming
      pc.addTransceiver('audio', { direction: 'recvonly' });

      // 4) Data channel for events
      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        // Enable user transcription from the Realtime API
        const update = {
          type: 'session.update',
          session: {
            input_audio_transcription: { enabled: true, model: 'gpt-4o-transcribe' }, // server picks best
            instructions: systemPrompt || undefined,
            voice: voiceName || undefined,
          }
        };
        dc.send(JSON.stringify(update));
      };

      dc.onmessage = (m) => {
        try {
          const msg = JSON.parse(m.data);
          // Handle deltas for both user and assistant
          switch (msg.type) {
            case 'input_audio_transcription.delta': {
              if (!currentUserIdRef.current) {
                currentUserIdRef.current = pushRow('user', msg.delta || '');
              } else {
                appendRow(currentUserIdRef.current, msg.delta || '');
              }
              break;
            }
            case 'input_audio_transcription.completed': {
              currentUserIdRef.current = null;
              break;
            }
            case 'response.output_text.delta': // assistant text delta
            case 'response.delta': {
              const chunk = msg.delta || msg.text || '';
              if (!chunk) break;
              if (!currentAssistantIdRef.current) {
                currentAssistantIdRef.current = pushRow('assistant', chunk);
              } else {
                appendRow(currentAssistantIdRef.current, chunk);
              }
              break;
            }
            case 'response.completed': {
              currentAssistantIdRef.current = null;
              break;
            }
            case 'error': {
              const e = typeof msg.error === 'string' ? msg.error : (msg.error?.message || 'Unknown error');
              setError(e);
              props.onError?.(e);
              break;
            }
            default:
              // ignore other events
              break;
          }
        } catch {}
      };

      // 5) SDP offer/answer with Realtime endpoint
      const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
      await pc.setLocalDescription(offer);

      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp',
        },
        body: offer.sdp as any,
      });

      if (!sdpRes.ok) {
        const t = await sdpRes.text();
        throw new Error(`Realtime SDP failed: ${t}`);
      }

      const answerSDP = await sdpRes.text();
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSDP });

      setConnected(true);
      setConnecting(false);

    } catch (err: any) {
      const msg = err?.message || String(err);
      setError(msg);
      setConnecting(false);
      props.onError?.(msg);
      stopCall(); // ensure cleanup
    }
  }, [apiKey, ephemeralEndpoint, model, systemPrompt, voiceName, appendRow, pushRow, props]);

  const stopCall = useCallback(() => {
    try {
      dcRef.current?.close();
    } catch {}
    try {
      pcRef.current?.close();
    } catch {}
    micRef.current?.getTracks().forEach(t => t.stop());
    dcRef.current = null;
    pcRef.current = null;
    micRef.current = null;
    setConnected(false);
    setConnecting(false);
  }, []);

  // start on mount; stop on unmount or close
  useEffect(() => {
    if (!open) return;
    startCall();
    return () => stopCall();
  }, [open, startCall, stopCall]);

  // mute/unmute mic
  useEffect(() => {
    micRef.current?.getAudioTracks().forEach(t => (t.enabled = !muted));
  }, [muted]);

  // ——— UI
  const header = (
    <div
      className="px-4 md:px-5 flex items-center justify-between"
      style={{
        minHeight: 72,
        background:`linear-gradient(90deg,var(--panel, #0d0f11) 0%,color-mix(in oklab,var(--panel, #0d0f11) 97%, white 3%) 50%,var(--panel, #0d0f11) 100%)`,
        borderBottom: `1px solid ${GREEN_LINE}`
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-lg grid place-items-center shrink-0"
          style={{ background:'rgba(89,217,179,.12)', border:'1px solid rgba(89,217,179,.25)' }}
        >
          <Bot className="w-5 h-5" style={{ color: CTA }} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate" style={{ fontSize: 16 }}>{assistantName}</div>
          <div className="text-xs truncate" style={{ color:'var(--text-muted, #9fb4ad)' }}>
            {connected ? 'Connected' : connecting ? 'Connecting…' : 'Idle'}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {availableVoices ? (
          <div style={{ width: 160 }}>
            <VASelect
              value={voiceName}
              onChange={(v)=>setVoiceName(v)}
              options={availableVoices}
              placeholder="Voice"
              leftIcon={<Volume2 className="w-4 h-4" style={{ color: CTA }} />}
              menuTop={
                <div className="flex items-center justify-between px-3 py-2 rounded-[8px]"
                  style={{ background:'var(--panel, #0d0f11)', border:'1px solid rgba(255,255,255,.10)' }}
                >
                  <div className="text-xs" style={{ color:'var(--text-muted)' }}>Preview</div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={()=>{
                        // simple browser TTS preview
                        if (!('speechSynthesis' in window)) return;
                        const u = new SpeechSynthesisUtterance(`This is ${voiceName} preview.`);
                        window.speechSynthesis.cancel();
                        window.speechSynthesis.speak(u);
                      }}
                      className="w-8 h-8 rounded-full grid place-items-center"
                      aria-label="Play voice"
                      style={{ background: CTA, color:'#0a0f0d' }}
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={()=>{ try { window.speechSynthesis.cancel(); } catch {} }}
                      className="w-8 h-8 rounded-full grid place-items-center border"
                      aria-label="Stop preview"
                      style={{ background: 'var(--panel)', color:'var(--text)', borderColor:'rgba(255,255,255,.10)' }}
                    >
                      <Square className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              }
            />
          </div>
        ) : (
          <div className="text-xs px-2 py-1 rounded-[8px] border"
               style={{ color:'var(--text-muted)', borderColor:'rgba(255,255,255,.14)' }}>
            Voice: {voiceName}
          </div>
        )}

        <button
          onClick={()=>setMuted(m=>!m)}
          className="w-9 h-9 rounded-[8px] grid place-items-center"
          style={{ background:'var(--panel, #0d0f11)', border:'1px solid rgba(255,255,255,.12)', color:'var(--text)' }}
          aria-label={muted ? 'Unmute mic' : 'Mute mic'}
          title={muted ? 'Unmute mic' : 'Mute mic'}
        >
          {muted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        </button>
        <button
          onClick={() => { setOpen(false); stopCall(); onClose?.(); }}
          className="w-9 h-9 rounded-[8px] grid place-items-center"
          style={{ background:'rgba(239,68,68,.12)', border:'1px solid rgba(239,68,68,.25)', color:'#ffd7d7' }}
          aria-label="End"
          title="End"
        >
          <PhoneOff className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setOpen(false); stopCall(); onClose?.(); }}
          className="w-9 h-9 rounded-[8px] grid place-items-center"
          style={{ background:'var(--panel, #0d0f11)', border:`1px solid ${GREEN_LINE}`, color:'var(--text)' }}
          aria-label="Close"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  if (!open || !IS_CLIENT) return null;

  // ——— SHEET: full-height right side, overlay style (top→bottom)
  const panel = (
    <aside
      className="va-card"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 'clamp(380px, 34vw, 560px)',
        zIndex: 100010,
        background: 'var(--panel, #0d0f11)',
        color: 'var(--text, #e6f1ef)',
        borderLeft: '1px solid rgba(89,217,179,.20)',
        borderTopLeftRadius: 10,
        borderBottomLeftRadius: 10,
        borderTopRightRadius: 0,
        borderBottomRightRadius: 0,

        display: 'grid',
        gridTemplateRows: '72px 1fr 56px',
        overflow: 'hidden',
        boxShadow:'0 22px 44px rgba(0,0,0,.28), 0 0 0 1px rgba(255,255,255,.06) inset, 0 0 0 1px rgba(89,217,179,.20)',
      }}
      role="dialog"
      aria-label="Voice call panel"
    >
      {header}

      {/* Body: scrollable chat */}
      <div className="p-3 md:p-4" style={{ overflowY: 'auto' }}>
        <div className="space-y-3">
          {log.length === 0 && (
            <div
              className="text-sm rounded-[8px] px-3 py-2 border"
              style={{ color: 'var(--text-muted, #9fb4ad)', background: 'var(--panel, #0d0f11)', borderColor: 'rgba(255,255,255,.10)' }}
            >
              {connecting ? 'Connecting to voice…' : 'Say something to start — your words will appear here.'}
            </div>
          )}

          {log.map((row) => (
            <div key={row.id} className={`flex ${row.who === 'user' ? 'justify-end' : 'justify-start'}`}>
              {row.who === 'assistant' && (
                <div
                  className="mr-2 mt-[2px] shrink-0 rounded-full w-8 h-8 grid place-items-center"
                  style={{ background: 'rgba(89,217,179,.12)', border: '1px solid rgba(89,217,179,.25)' }}
                >
                  <Bot className="w-4 h-4" style={{ color: CTA }} />
                </div>
              )}
              <div
                className="max-w-[78%] rounded-2xl px-3 py-2 text-[0.95rem] leading-snug border"
                style={{
                  background: row.who === 'user' ? 'rgba(56,196,143,.18)' : 'rgba(255,255,255,.06)',
                  borderColor: row.who === 'user' ? 'rgba(56,196,143,.35)' : 'rgba(255,255,255,.14)',
                }}
              >
                <div>{row.text || <span style={{ opacity: 0.5 }}>…</span>}</div>
                <div className="text-[10px] mt-1 opacity-60 text-right">{fmtTime(row.at)}</div>
              </div>
              {row.who === 'user' && (
                <div
                  className="ml-2 mt-[2px] shrink-0 rounded-full w-8 h-8 grid place-items-center"
                  style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.18)' }}
                >
                  <User className="w-4 h-4" />
                </div>
              )}
            </div>
          ))}

          {error && (
            <div
              className="text-xs px-3 py-2 rounded-[8px] border"
              style={{ background: 'rgba(239,68,68,.12)', borderColor: 'rgba(239,68,68,.25)', color: '#ffd7d7' }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Footer: status + audio sink */}
      <div className="px-3 py-2 border-t" style={{ borderColor: 'rgba(255,255,255,.10)' }}>
        <div className="flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {connecting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span style={{ opacity: 0.85 }}>{connected ? 'Connected' : connecting ? 'Connecting…' : 'Idle'}</span>
          </div>
          <audio ref={audioRef} autoPlay playsInline />
        </div>
      </div>
    </aside>
  );

  return createPortal(panel, document.body);
}
