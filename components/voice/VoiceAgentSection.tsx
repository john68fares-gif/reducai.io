// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import {
  Phone as PhoneIcon,
} from 'lucide-react';

// ↙️ import the steps WE ALREADY CREATED
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3Prompt from '@/components/voice/steps/StepV3Prompt';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';

// If you prefer your existing StepProgress from the Builder,
// swap the local StepProgressInline below with:
// import StepProgress from '@/components/builder/StepProgress';

type WizardStep = 1 | 2 | 3 | 4;

/* --------------------------- look & feel (same vibe) --------------------------- */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
};

/* --------------------------- tiny inline progress --------------------------- */
function StepProgressInline({ current }:{ current: WizardStep }) {
  const steps: { n: WizardStep; label: string }[] = [
    { n: 1, label: 'Basics' },
    { n: 2, label: 'Telephony' },
    { n: 3, label: 'Prompt' },
    { n: 4, label: 'Overview' },
  ];
  return (
    <div className="mb-6 grid grid-cols-4 gap-2">
      {steps.map(s => (
        <div
          key={s.n}
          className="flex items-center justify-center rounded-xl px-3 py-2 text-sm"
          style={{
            background: s.n === current ? 'rgba(106,247,209,0.15)' : 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
          }}
        >
          <span className={s.n === current ? 'text-[#6af7d1]' : 'text-white/70'}>{s.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ----------------------------- main section ----------------------------- */
export default function VoiceAgentSection() {
  const [step, setStep] = useState<WizardStep>(1);

  const go    = (n: WizardStep) => setStep(n);
  const next  = () => setStep((s) => Math.min(4, (s + 1) as WizardStep));
  const back  = () => setStep((s) => Math.max(1, (s - 1) as WizardStep));

  return (
    <>
      <Head><title>Voice Agent • reduc.ai</title></Head>

      <main className="px-6 py-8" style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <PhoneIcon className="h-6 w-6 text-[#6af7d1]" />
              Voice Agent
            </h2>
            <div className="text-white/80 text-xs md:text-sm">
              Create a voice agent in steps. No third-party voice SDKs — just your Twilio webhook.
            </div>
          </div>
        </div>

        {/* Body frame */}
        <div className="relative p-6 md:p-8" style={{ ...FRAME, overflow: 'visible' }}>
          <StepProgressInline current={step} />

          <div className="grid grid-cols-1 gap-6" style={CARD}>
            <div className="p-5">
              {step === 1 && <StepV1Basics onNext={next} />}
              {step === 2 && <StepV2Telephony onBack={back} onNext={next} />}
              {step === 3 && <StepV3Prompt onBack={back} onNext={next} />}
              {step === 4 && <StepV4Overview onBack={back} />}
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        body { background:#0b0c10; color:#fff; }
        select { background-color: rgba(0,0,0,.30); color: white; }
      `}</style>
    </>
  );
}
