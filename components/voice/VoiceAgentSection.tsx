// components/voice/VoiceAgentSection.tsx
'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Plus } from 'lucide-react';

/**
 * If your step files are under: components/voice/
 *   components/voice/StepProgress.tsx
 *   components/voice/Step1AIType.tsx
 *   components/voice/Step2ModelSettings.tsx
 *   components/voice/Step3PromptEditor.tsx
 *   components/voice/Step4Overview.tsx
 * keep the imports below as-is.
 *
 * If they live under components/builder/, switch the paths accordingly.
 */

// voice versions (adjust if yours are in /builder/)
const StepProgress       = dynamic(() => import('./StepProgress'),       { ssr: false });
const Step1AIType        = dynamic(() => import('./Step1AIType'),        { ssr: false });
const Step2ModelSettings = dynamic(() => import('./Step2ModelSettings'), { ssr: false });
const Step3PromptEditor  = dynamic(() => import('./Step3PromptEditor'),  { ssr: false });
const Step4Overview      = dynamic(() => import('./Step4Overview'),      { ssr: false });

type WizardStep = 1 | 2 | 3 | 4;

export default function VoiceAgentSection({
  startWizard = false,
  onFinishWizard,
}: {
  /** start directly on the wizard (Step 1) */
  startWizard?: boolean;
  /** optional callback after Step 4 finishes */
  onFinishWizard?: () => void;
}) {
  const [mode, setMode] = React.useState<'list' | 'wizard'>(startWizard ? 'wizard' : 'list');
  const [step, setStep] = React.useState<WizardStep>(1);

  function openWizard() {
    setStep(1);
    setMode('wizard');
  }
  function exitWizard() {
    setMode('list');
    onFinishWizard?.();
  }

  return (
    <div className="w-full max-w-7xl mx-auto px-6 md:px-8 pt-8 pb-24 text-white font-movatif">
      {mode === 'list' && (
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <h1 className="text-2xl md:text-3xl font-semibold">Voice Agents</h1>

            <button
              onClick={openWizard}
              className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Voice Build
            </button>
          </div>

          {/* You can render your existing editor/list here, if any */}
          <div
            className="rounded-[16px] p-8 text-white/80"
            style={{
              background: 'rgba(13,15,17,0.92)',
              border: '2px solid rgba(106,247,209,0.32)',
              boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
            }}
          >
            This is the Voice Agent area. Click <span className="text-[#00ffc2] font-semibold">Create Voice Build</span> to start.
            {/* Replace this with your editor/testing cards if you want them visible when not in the wizard. */}
          </div>
        </div>
      )}

      {mode === 'wizard' && (
        <div>
          {/* Topbar with step counter */}
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl md:text-3xl font-semibold">Create Voice Agent</h1>
            <div className="text-xs px-3 py-1 rounded-2xl border border-white/15 bg-white/5">
              Step {step} of 4
            </div>
          </div>

          {/* Progress bar same as your Builder vibe */}
          <div className="mb-6">
            <StepProgress current={step} />
          </div>

          {/* Step views */}
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
                // when user finishes, go back to the section list (editor/home)
                exitWizard();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
