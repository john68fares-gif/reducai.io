// components/voice/steps/StepV4Overview.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Settings2, Sparkles, AlertCircle, ArrowLeft, Link as LinkIcon,
  Loader2, Check, Cpu, BookText, FileText, Library, Phone
} from 'lucide-react';

/* ================== THEME / STYLES ================== */
const CARD_OUTER: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  boxShadow:
    'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05), 0 0 22px rgba(0,255,194,0.05)',
  borderRadius: 28,
};
const CARD_INNER: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
};
const ORB_STYLE: React.CSSProperties = {
  background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
  filter: 'blur(38px)',
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* ================== HELPERS ================== */
function safeGet<T>(k: string, f: T): T {
  try { const r = localStorage.getItem(k); return r ? (JSON.parse(r) as T) : f; } catch { return f; }
}
function labelStyle(s?: string) {
  if (s === 'conversational') return 'Conversational';
  if (s === 'professional') return 'Professional';
  if (s === 'newscaster') return 'Newscaster';
  return '—';
}

/* ================== COMPONENT ================== */
type Props = { onBack?: () => void };

export default function StepV4Overview({ onBack }: Props) {
  // Step state pulled from prior steps
  const s1 = useMemo(() => safeGet<any>('voicebuilder:step1', {}), []);
  const s2 = useMemo(() => safeGet<any>('voicebuilder:step2', {}), []);
  const s3 = useMemo(() => safeGet<any>('voicebuilder:step3', {}), []);
  const creds = useMemo(() => safeGet<any>('telephony:twilioCreds', {}), []);

  // Accept Step 3 either as { compiled } or { prompt }
  const systemPrompt: string | undefined = s3?.compiled || s3?.prompt;

  // Flatten important fields with good defaults
  const name = s1?.name || 'Untitled Agent';
  const industry = s1?.industry || '';
  const language = s1?.language || s3?.language || 'en';
  const ttsVoice = s1?.ttsVoice || 'Polly.Joanna';
  const greeting = s1?.greeting || s3?.greetingLine || 'Hello! How can I help?';
  const speakingStyle = s1?.speakingStyle || s3?.style || '';
  const responseDelayMs = s1?.responseDelayMs ?? s3?.latency?.delayMs ?? 600;
  const speakingRatePct = s1?.speakingRatePct ?? 100;
  const pitchSemitones = s1?.pitchSemitones ?? 0;
  const bargeIn = !!(s1?.bargeIn ?? s3?.barge?.allow);

  const fromE164 = s2?.fromE164; // +15551234567

  // Readiness checks (must be true to enable the button)
  const checks = {
    name: !!name,
    language: !!language,
    number: !!fromE164,
    prompt: !!systemPrompt,
    twilioSid: !!creds?.accountSid,
    twilioToken: !!creds?.authToken,
  };
  const ready = Object.values(checks).every(Boolean);

  // UI state
  const [msg, setMsg] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState('Preparing…');
  const [done, setDone] = useState(false);

  // Rotate loading messages for vibe
  useEffect(() => {
    if (!loading) return;
    const msgs = [
      'Compiling prompt blocks…',
      'Linking company knowledge…',
      'Setting up number routing…',
      'Warming up voice…',
      'Final checks & safety…',
    ];
    let i = 0;
    setLoadingMsg(msgs[i]);
    const id = setInterval(() => { i = (i + 1) % msgs.length; setLoadingMsg(msgs[i]); }, 1200);
    return () => clearInterval(id);
  }, [loading]);

  async function handleGenerate() {
    if (!ready) {
      alert('Please complete required fields first.');
      return;
    }
    setLoading(true); setMsg(''); setDone(false);

    try {
      // 1) Create and persist the agent locally (same store your gallery uses)
      const buildId = crypto?.randomUUID?.() || String(Date.now());
      const bots = safeGet<any[]>('chatbots', []);
      const build = {
        id: buildId,
        name,
        title: name,
        type: 'voice',
        industry,
        language,
        ttsVoice,
        config: {
          greeting,
          speakingStyle,
          responseDelayMs,
          speakingRatePct,
          pitchSemitones,
          bargeIn,
        },
        prompt: systemPrompt,      // <- compiled or prompt
        fromE164,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bots.unshift(build);
      localStorage.setItem('chatbots', JSON.stringify(bots));

      // 2) Save a backup for Editor
      localStorage.setItem('voice:settings:backup', JSON.stringify({
        systemPrompt,
        language,
        ttsVoice,
        fromE164,
        greeting,
        speakingStyle,
        responseDelayMs,
        speakingRatePct,
        pitchSemitones,
        bargeIn,
      }));

      // 3) Attach number in Twilio -> sets your Voice webhook
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          accountSid: creds.accountSid,
          authToken: creds.authToken,
          phoneNumber: fromE164,
          agentId: buildId,

          // minimal voice info used immediately by webhook
          greeting,
          ttsVoice,
          language: language.startsWith('en') ? 'en-US' : language, // normalize
        }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed.');

      // 4) Map number -> agent (enforce one agent per number locally)
      const map = safeGet<Record<string,string>>('voice:numberBindings', {});
      map[fromE164] = buildId;
      localStorage.setItem('voice:numberBindings', JSON.stringify(map));

      setMsg(`Agent created and attached to ${fromE164}. Call to test.`);
      setDone(true);
    } catch (e: any) {
      setMsg(e?.message || 'Application error while generating/attaching.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold">Final Review</h1>
        <div className="text-xs px-3 py-1 rounded-2xl border" style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}>
          Step 4 of 4
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Configuration */}
          <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
            <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
            <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
              <Settings2 className="w-4 h-4 text-[#6af7d1]" /> AI Configuration
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <Info label="AI Name" value={name} icon={<FileText className="w-3.5 h-3.5" />} />
              <Info label="Industry" value={industry || '—'} icon={<Library className="w-3.5 h-3.5" />} />
              <Info label="Style" value={labelStyle(speakingStyle)} icon={<BookText className="w-3.5 h-3.5" />} />
              <Info label="TTS Voice" value={ttsVoice} icon={<Cpu className="w-3.5 h-3.5" />} />
              <Info label="Language" value={language} icon={<FileText className="w-3.5 h-3.5" />} />
              <Info label="Delay (ms)" value={String(responseDelayMs)} icon={<FileText className="w-3.5 h-3.5" />} />
              <Info label="Rate (%)" value={String(speakingRatePct)} icon={<FileText className="w-3.5 h-3.5" />} />
              <Info label="Pitch (st)" value={String(pitchSemitones)} icon={<FileText className="w-3.5 h-3.5" />} />
            </div>
          </div>

          {/* Telephony */}
          <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
            <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
            <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
              <Phone className="w-4 h-4 text-[#6af7d1]" /> Phone Number
            </div>
            <div style={CARD_INNER} className="p-4 rounded-2xl text-sm">
              <div className="text-white/70">From Number (Twilio)</div>
              <div className="text-white mt-1">{fromE164 || '—'}</div>
              <div className="text-xs text-white/60 mt-2">
                We’ll point Twilio’s “A Call Comes In” to your voice webhook automatically.
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <div style={CARD_OUTER} className="p-6 rounded-[28px] relative">
            <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB_STYLE} />
            <div className="flex items-center gap-2 mb-4 text-white/90 font-semibold">
              <ChecklistIcon /> Requirements
            </div>

            <div style={CARD_INNER} className="p-4 rounded-2xl mb-4">
              <Req ok={checks.name} label="AI Name" />
              <Req ok={checks.language} label="Language" />
              <Req ok={checks.prompt} label="Prompt (Step 3)" />
              <Req ok={checks.number} label="Twilio Number" />
              <Req ok={checks.twilioSid} label="Twilio Account SID" />
              <Req ok={checks.twilioToken} label="Twilio Auth Token" />
            </div>

            <div className="rounded-2xl p-4 border" style={{ ...CARD_INNER, border: '1px solid rgba(255,255,255,0.18)' }}>
              <div className="flex items-center gap-2 text-[#6af7d1] font-semibold">
                <Sparkles className="w-4 h-4" />
                {ready ? 'Ready to Create & Attach' : 'Missing Requirements'}
              </div>
              <div className="text-xs text-white/70 mt-1">
                {ready
                  ? 'We’ll save your agent, set the Twilio webhook, and you can call to test.'
                  : 'Please complete the missing items above.'}
              </div>
              <div className="text-xs text-amber-300/80 mt-3 flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5" />
                Your Twilio credentials are used only to set the webhook and are not stored server-side.
              </div>
            </div>
          </div>
        </div>
      </div>

      {msg && (
        <div className="mt-6 rounded-2xl border p-3 text-sm" style={{ borderColor:'rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.05)' }}>
          {msg}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between mt-10">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Previous
        </button>
        <button
          onClick={handleGenerate}
          disabled={!ready || loading}
          className="inline-flex items-center gap-2 px-8 py-2 rounded-[24px] font-semibold select-none transition-colors duration-150 disabled:cursor-not-allowed"
          style={{
            background: ready && !loading ? BTN_GREEN : BTN_DISABLED,
            color: '#ffffff',
            boxShadow: ready && !loading ? '0 1px 0 rgba(0,0,0,0.18)' : 'none',
          }}
          onMouseEnter={(e) => {
            if (!ready || loading) return;
            (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER;
          }}
          onMouseLeave={(e) => {
            if (!ready || loading) return;
            (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN;
          }}
        >
          <LinkIcon className="w-4 h-4" /> {loading ? 'Attaching…' : 'Create & Attach'}
        </button>
      </div>

      {/* ===== Loading Overlay (spinner + cycling message + shimmer) ===== */}
      {loading && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center px-4">
          <div
            className="w-full max-w-md rounded-[28px] p-6 text-center relative overflow-hidden"
            style={{
              background:'linear-gradient(180deg, rgba(22,24,27,0.98) 0%, rgba(14,16,18,0.98) 100%)',
              border:'2px dashed rgba(0,255,194,0.30)',
              boxShadow:'0 0 24px rgba(0,255,194,0.12), inset 0 0 18px rgba(0,0,0,0.40)'
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -top-[35%] -left-[35%] w-[90%] h-[90%] rounded-full"
              style={{ background:'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter:'blur(40px)' }}
            />
            <Loader2 className="w-7 h-7 mx-auto animate-spin mb-3 text-[#6af7d1]" />
            <div className="text-lg font-semibold">Creating your voice agent…</div>
            <div className="text-sm text-white/70 mt-1">{loadingMsg}</div>

            <div className="mt-4 w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full w-1/2 animate-pulse rounded-full"
                style={{ background:'linear-gradient(90deg, transparent, rgba(106,247,209,0.85), transparent)' }}
              />
            </div>

            <div
              aria-hidden
              className="absolute left-0 right-0 top-0 h-[1px]"
              style={{ background:'linear-gradient(90deg, transparent, rgba(106,247,209,0.35), transparent)' }}
            />
          </div>
        </div>
      )}

      {/* Success toast */}
      {done && (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-[16px] px-4 py-3"
          style={{ background:'rgba(16,19,20,0.95)', border:'1px solid rgba(106,247,209,0.40)', boxShadow:'0 0 14px rgba(106,247,209,0.18)' }}
        >
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-[#6af7d1]" />
            <div className="text-sm">Agent generated and number attached. Call {fromE164} to test.</div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ================== SMALL UI PIECES ================== */
function Info({ label, value, icon }: { label: string; value?: string; icon?: React.ReactNode }) {
  return (
    <div style={CARD_INNER} className="p-3 rounded-2xl">
      <div className="text-xs text-white/60 flex items-center gap-1.5">{icon}{label}</div>
      <div className="text-white mt-0.5 truncate">{value || '—'}</div>
    </div>
  );
}
function Req({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-sm">
      <span
        className="inline-flex items-center justify-center w-4 h-4 rounded-[6px]"
        style={{ background: ok ? 'rgba(106,247,209,0.18)' : 'rgba(255,120,120,0.12)', border: `1px solid ${ok ? 'rgba(106,247,209,0.5)' : 'rgba(255,120,120,0.4)'}` }}
      >
        {ok ? <Check className="w-3 h-3 text-[#6af7d1]" /> : <AlertCircle className="w-3 h-3 text-[#ff8a8a]" />}
      </span>
      <span className={ok ? 'text-white/90' : 'text-white/60'}>{label}</span>
    </div>
  );
}
function ChecklistIcon() { return <div className="w-4 h-4 rounded-[6px] border border-[#6af7d1] text-[#6af7d1] flex items-center justify-center">✓</div>; }
