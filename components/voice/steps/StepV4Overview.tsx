// components/voice/steps/StepV4Overview.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { CARD_STYLE, GreenButton, BTN_DISABLED, BTN_GREEN, BTN_GREEN_HOVER } from '../atoms';
import { Settings2, Check, Sparkles, AlertCircle, ArrowLeft, Link } from 'lucide-react';

type Props = { onBack?: () => void };

export default function StepV4Overview({ onBack }: Props) {
  const s1 = useMemo(() => safeGet('voicebuilder:step1', {}), []);
  const s2 = useMemo(() => safeGet('voicebuilder:step2', {}), []);
  const s3 = useMemo(() => safeGet('voicebuilder:step3', {}), []);
  const creds = useMemo(() => safeGet('telephony:twilioCreds', {}), []);

  const ready = !!s1?.name && !!s1?.language && !!s2?.fromE164 && !!s3?.prompt && !!creds?.accountSid && !!creds?.authToken;

  const [msg, setMsg] = useState<string>('');
  const [loading, setLoading] = useState(false);

  async function handleGenerate() {
    if (!ready) { alert('Missing required fields in previous steps.'); return; }
    setLoading(true); setMsg('');

    try {
      // 1) Create/save the “build” locally (same array your Builder uses)
      const buildId = crypto?.randomUUID?.() || String(Date.now());
      const bots = safeGet<any[]>('chatbots', []);
      const build = {
        id: buildId,
        name: s1.name,
        title: s1.name,
        type: 'voice',
        industry: s1.industry,
        language: s1.language,
        ttsVoice: s1.ttsVoice,
        config: {
          greeting: s1.greeting,
          speakingStyle: s1.speakingStyle,
          responseDelayMs: s1.responseDelayMs,
          speakingRatePct: s1.speakingRatePct,
          pitchSemitones: s1.pitchSemitones,
          bargeIn: !!s1.bargeIn,
        },
        prompt: s3.prompt,
        fromE164: s2.fromE164,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      bots.unshift(build);
      localStorage.setItem('chatbots', JSON.stringify(bots));

      // 2) Persist voice settings backup (for the Editor page)
      localStorage.setItem('voice:settings:backup', JSON.stringify({
        systemPrompt: s3.prompt,
        language: s1.language,
        ttsVoice: s1.ttsVoice || 'Polly.Joanna',
        fromE164: s2.fromE164,
        greeting: s1.greeting,
        speakingStyle: s1.speakingStyle,
        responseDelayMs: s1.responseDelayMs,
        speakingRatePct: s1.speakingRatePct,
        pitchSemitones: s1.pitchSemitones,
        bargeIn: !!s1.bargeIn,
      }));

      // 3) Attach number (no Vapi) — your API just needs creds + number
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          accountSid: creds.accountSid,
          authToken: creds.authToken,
          phoneNumber: s2.fromE164,
          agentId: buildId, // echoed in webhook URL; your incoming route can read it (optional)
        }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed.');

      // 4) Save “number -> agentId” binding to enforce exclusivity
      const map = safeGet<Record<string,string>>('voice:numberBindings', {});
      map[s2.fromE164] = buildId;
      localStorage.setItem('voice:numberBindings', JSON.stringify(map));

      setMsg(`Agent created and attached to ${s2.fromE164}`);
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
        <div className="text-xs px-3 py-1 rounded-2xl border" style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}>Step 4 of 4</div>
      </div>

      <div className="p-7 md:p-8 space-y-6" style={CARD_STYLE}>
        <div className="flex items-center gap-2 text-white/90 font-semibold">
          <Settings2 className="w-4 h-4 text-[#6af7d1]" /> Configuration
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <Li label="Name" value={s1?.name} />
          <Li label="Industry" value={s1?.industry} />
          <Li label="Language" value={s1?.language} />
          <Li label="TTS Voice" value={s1?.ttsVoice || 'Polly.Joanna'} />
          <Li label="Greeting" value={s1?.greeting} />
          <Li label="Style" value={labelStyle(s1?.speakingStyle)} />
          <Li label="Delay (ms)" value={String(s1?.responseDelayMs ?? 0)} />
          <Li label="Rate (%)" value={String(s1?.speakingRatePct ?? 100)} />
          <Li label="Pitch (st)" value={String(s1?.pitchSemitones ?? 0)} />
          <Li label="Barge-in" value={s1?.bargeIn ? 'Enabled' : 'Disabled'} />
          <Li label="From Number" value={s2?.fromE164} />
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
            <Link className="w-4 h-4" /> {loading ? 'Attaching…' : 'Create & Attach'}
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
function labelStyle(s: string) {
  if (s === 'conversational') return 'Conversational';
  if (s === 'professional') return 'Professional';
  if (s === 'newscaster') return 'Newscaster';
  return 'None';
}
function safeGet<T>(k: string, f: T): T { try { const r = localStorage.getItem(k); return r ? JSON.parse(r) as T : f; } catch { return f; } }
