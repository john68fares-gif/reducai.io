'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import StepProgress from '@/components/builder/StepProgress';

// import your voice steps
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3Prompt from '@/components/voice/steps/StepV3Prompt';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';

export default function VoiceAgentSection() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  return (
    <>
      <Head><title>Voice Agent • reduc.ai</title></Head>

      {/* same container width as Builder */}
      <main className="min-h-screen bg-[#0b0c10] text-white font-movatif">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          <StepProgress current={step} />

          {step === 1 && <StepV1Basics onNext={() => setStep(2)} />}
          {step === 2 && <StepV2Telephony onBack={() => setStep(1)} onNext={() => setStep(3)} />}
          {step === 3 && <StepV3Prompt onBack={() => setStep(2)} onNext={() => setStep(4)} />}
          {step === 4 && <StepV4Overview onBack={() => setStep(3)} />}
        </div>
      </main>
    </>
  );
}
