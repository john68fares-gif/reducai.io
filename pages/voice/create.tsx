// pages/voice/create.tsx
'use client';

import React, { useMemo, useState } from 'react';
import Head from 'next/head';
import StepProgress from '@/components/builder/StepProgress';
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3Prompt from '@/components/voice/steps/StepV3Prompt';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';

export default function VoiceCreateWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const go = (n: 1 | 2 | 3 | 4) => setStep(n);
  const next = () => setStep((s) => Math.min(4, (s + 1) as any));
  const back = () => setStep((s) => Math.max(1, (s - 1) as any));

  return (
    <>
      <Head><title>Create Voice Agent • reduc.ai</title></Head>
      <main className="min-h-screen bg-[#0b0c10] text-white font-movatif">
        <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-8 pb-24">
          <StepProgress current={step} />

          {step === 1 && <StepV1Basics onNext={next} />}
          {step === 2 && <StepV2Telephony onBack={back} onNext={next} />}
          {step === 3 && <StepV3Prompt onBack={back} onNext={next} />}
          {step === 4 && <StepV4Overview onBack={back} />}
        </div>
      </main>
    </>
  );
}
