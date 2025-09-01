// pages/voice/create.tsx
'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import StepProgress from '@/components/builder/StepProgress';
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
// import BOTH parts for Step 3 (A then B, or just whichever you’re using)
import StepV3PromptA from '@/components/voice/steps/StepV3PromptA';
import StepV3PromptB from '@/components/voice/steps/StepV3PromptB';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';
import BuilderShell from '@/components/layout/BuilderShell';

export default function VoiceCreateWizard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const next = () => setStep((s) => Math.min(4, (s + 1) as any));
  const back = () => setStep((s) => Math.max(1, (s - 1) as any));

  return (
    <>
      <Head><title>Create Voice Agent • reduc.ai</title></Head>

      <BuilderShell>
        <div className="w-full max-w-[1840px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
          <StepProgress current={step} />

          {step === 1 && <StepV1Basics onNext={next} />}
          {step === 2 && <StepV2Telephony onBack={back} onNext={next} />}

          {step === 3 && (
            <>
              {/* If you’re splitting Step 3 into A and B, show A then navigate to B (or stack them).
                  If you only use A, remove B. */}
              <StepV3PromptA onBack={back} onNext={next} />
              {/* Or route to ?step=3b etc. For now we keep it simple. */}
              {/* <div className="mt-8"><StepV3PromptB onBack={back} onNext={next} /></div> */}
            </>
          )}

          {step === 4 && <StepV4Overview onBack={back} />}
        </div>
      </BuilderShell>
    </>
  );
}
