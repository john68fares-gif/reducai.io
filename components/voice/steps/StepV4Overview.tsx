// components/voice/steps/StepV4Overview.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { CARD_STYLE, GreenButton } from '../atoms';
import { Settings2, Sparkles, AlertCircle, ArrowLeft, Link as LinkIcon } from 'lucide-react';

type Props = { onBack?: () => void };

export default function StepV4Overview({ onBack }: Props) {
  const s1 = useMemo(() => safeGet<any>('voicebuilder:step1', {}), []);
  const s2 = useMemo(() => safeGet<any>('voicebuilder:step2', {}), []);
  const s3 = useMemo(() => safeGet<any>('voicebuilder:step3', {}), []);
  const creds = useMemo(() => safeGet<any>('telephony:twilioCreds', {}), []);

  // Step 3 may be { compiled, ... } or { prompt, ... }
  const systemPrompt: string | undefined = s3?.compiled || s3?.prompt;

  // Step 1 keys (be lenient about names)
  const name = s1?.name || s1?.title || 'Untitled Agent';
  const language = s1?.language || s3?.language || 'en';
  const ttsVoice = s1?.ttsVoice || 'Polly.Joanna';
  const greeting = s1?.greeting || s3?.greetingLine || '';
  const speakingStyle = s1?.speakingStyle || s3?.style || '';
  const responseDelayMs = s1?.responseDelayMs ?? s3?.latency?.delayMs ?? 600;
  const speakingRatePct = s1?.speakingRatePct ?? 100;
  const pitchSemitones = s1?.pitchSemitones ?? 0;
  const bargeIn = !!(s1?.bargeIn ?? s3?.barge?.allow);

  const fromE164 = s2?.fromE164;

  const ready =
    !!name && !!language && !!fromE164 && !!systemPrompt &&
    !!creds?.accountSid && !!creds?.authToken;

  const [msg, setMsg] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!ready) { alert('Missing required fields in previous steps.'); return; }
    setLoading(true); setMsg('');

    try {
      // 1) Save the build locally
      const buildId = crypto?.randomUUID?.() || String(Date.now());
      const bots = safeGet<any[]>('chatbots', []);
      const build = {
        id: buildId,
        name,
        title: name,
        type: 'voice',
        industry: s1?.industry || '',
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
        prompt: systemPrompt,          // <-- FIX: use compiled/prompt
        fromE164,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bots.unshift(build);
      localStorage.setItem('chatbots', JSON.stringify(bots));

      // 2) Persist voice settings backup for editor
      localStorage.setItem('voice:settings:backup', JSON.stringify({
        systemPrompt,                  // <-- FIX: use compiled/prompt
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

      // 3) Attach number
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          accountSid: creds.accountSid,
          authToken: creds.authToken,
          phoneNumber: fromE164,
          agentId: buildId,
        }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed.');

      // 4) Map number -> agent
      const map = safeGet<Record<string,string>>('voice:numberBindings', {});
      map[fromE164] = buildId;
      localStorage.setItem('voice:numberBindings', JSON.stringify(map));

      setMsg(`Agent created and attached to ${fromE164}`);
    } catch (e:any) {
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

      <div className="p-7 md:p-8 space-y-6" style={CARD_STYLE}>
        <div className="flex items-center gap-2 text-white/90 font-semibold">
          <Settings2 className="w-4 h-4 text-[#6af7d1]" /> Configuration
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Li label="Name" value={name} />
          <Li label="Industry" value={s1?.industry} />
          <Li label="Language" value={language} />
          <Li label="TTS Voice" value={ttsVoice} />
          <Li label="Greeting" value={greeting} />
          <Li label="Style" value={labelStyle(speakingStyle)} />
          <Li label="Delay (ms)" value={String(responseDelayMs)} />
          <Li label="Rate (%)" value={String(speakingRatePct)} />
          <Li label="Pitch (st)" value={String(pitchSemitones)} />
          <Li label="Barge-in" value={bargeIn ? 'Enabled' : 'Disabled'} />
          <Li label="From Number" value={fromE164} />
        </ul>

        <div className="rounded-2xl border p-4 text-sm" style={{ borderColor:'rgba(255,255,255,0.16)', background:'#101314' }}>
          <div className="flex items-center gap-2 text-[#6af7d1] font-semibold">
            <Sparkles className="w-4 h-4" /> Ready
          </div>
          <div className="text-white/70 mt-1">We’ll save your agent, set the webhook on your number, and you can test immediately.</div>
          <div className="text-amber-300/90 mt-2 flex items-center gap-2 text-xs">
            <AlertCircle className="w-3.5 h-3.5" />
            Your Twilio credentials never leave this request; they’re stored only in your browser.
          </div>
        </div>

        {msg && (
          <div className="rounded-2xl border p-3 text-sm" style={{ borderColor:'rgba(255,255,255,0.16)', background:'rgba(255,255,255,0.05)' }}>
            {msg}
          </div>
        )}

        <div className="flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <GreenButton onClick={handleGenerate} disabled={!ready || loading}>
            <LinkIcon className="w-4 h-4" /> {loading ? 'Attaching…' : 'Create & Attach'}
          </GreenButton>
        </div>
      </div>
    </section>
  );
}

function Li({ label, value }:{ label:string; value?:string }) {
  return (
    <li className="rounded-2xl border px-4 py-3" style={{ borderColor:'rgba(255,255,255,0.16)', background:'#101314' }}>
      <div className="text-xs text-white/60">{label}</div>
      <div className="text-white mt-0.5 truncate">{value || '—'}</div>
    </li>
  );
}
function labelStyle(s?: string) {
  if (s === 'conversational') return 'Conversational';
  if (s === 'professional') return 'Professional';
  if (s === 'newscaster') return 'Newscaster';
  return '—';
}
function safeGet<T>(k: string, f: T): T { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : f; } catch { return f; } }
