// components/voice/VoiceAgentSection.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';

/**
 * IMPORTANT:
 * This assumes the step files are in the same folder:
 *   components/voice/StepProgress.tsx
 *   components/voice/Step1AIType.tsx
 *   components/voice/Step2ModelSettings.tsx
 *   components/voice/Step3PromptEditor.tsx
 *   components/voice/Step4Overview.tsx
 *
 * If they are under a different folder, change the paths below.
 */

// lazy to avoid SSR issues
const StepProgress       = dynamic(() => import('./StepProgress'),       { ssr: false });
const Step1AIType        = dynamic(() => import('./Step1AIType'),        { ssr: false });
const Step2ModelSettings = dynamic(() => import('./Step2ModelSettings'), { ssr: false });
const Step3PromptEditor  = dynamic(() => import('./Step3PromptEditor'),  { ssr: false });
const Step4Overview      = dynamic(() => import('./Step4Overview'),      { ssr: false });

type WizardStep = 1 | 2 | 3 | 4;

export default function VoiceAgentSection({
  startAt = 1,
  onExit,
}: {
  /** which step to start on (default 1) */
  startAt?: WizardStep;
  /** optional callback if your page wants to close the wizard */
  onExit?: () => void;
}) {
  const [step, setStep] = React.useState<WizardStep>(startAt);

  return (
    <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-6 pb-20 text-white">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl md:text-3xl font-semibold">Create Voice Agent</h1>
        <div className="text-xs px-3 py-1 rounded-2xl border border-white/15 bg-white/5">
          Step {step} of 4
        </div>
      </div>

      {/* progress */}
      <div className="mb-6">
        <StepProgress current={step} />
      </div>

      {/* steps */}
      {step === 1 && (
        <Step1AIType
          onNext={() => setStep(2)}
        />
      )}

      {step === 2 && (
        <Step2ModelSettings
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <Step3PromptEditor
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}

      {step === 4 && (
        <Step4Overview
          onBack={() => setStep(3)}
          onFinish={() => {
            // if the parent page wants to hide the wizard after finishing:
            onExit?.();
          }}
        />
      )}
    </div>
  );
}
