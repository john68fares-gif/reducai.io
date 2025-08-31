// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useState } from 'react';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import { X, ArrowLeft } from 'lucide-react';

/**
 * IMPORTANT:
 *  - We import YOUR voice steps that you already created:
 *      components/voice/steps/StepV1Basics.tsx
 *      components/voice/steps/StepV2Telephony.tsx
 *      components/voice/steps/StepV3Prompt.tsx
 *      components/voice/steps/StepV4Overview.tsx
 *  - We reuse the Builder StepProgress for the same visual.
 */

const StepProgress = dynamic(() => import('@/components/builder/StepProgress'), { ssr: false });

const StepV1Basics   = dynamic(() => import('@/components/voice/steps/StepV1Basics'),   { ssr: false });
const StepV2Telephony= dynamic(() => import('@/components/voice/steps/StepV2Telephony'),{ ssr: false });
const StepV3Prompt   = dynamic(() => import('@/components/voice/steps/StepV3Prompt'),   { ssr: false });
const StepV4Overview = dynamic(() => import('@/components/voice/steps/StepV4Overview'), { ssr: false });

type WizardStep = 1 | 2 | 3 | 4;

/* --- tiny styling helpers to keep your green/dark look --- */
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

const BTN = {
  green: '#59d9b3',
  greenHover: '#54cfa9',
};

export default function VoiceAgentSection() {
  // “create a build” wizard state (inside the Voice Agent section)
  const [creating, setCreating] = useState<boolean>(false);
  const [step, setStep] = useState<WizardStep>(1);

  const next = () => setStep((s) => Math.min(4, ((s as number) + 1) as WizardStep));
  const back = () => setStep((s) => Math.max(1, ((s as number) - 1) as WizardStep));
  const goTo = (n: WizardStep) => setStep(n);

  return (
    <>
      <Head><title>Voice Agent • reduc.ai</title></Head>

      <main className="px-6 py-8" style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
              Voice Agent
            </h2>
            <div className="text-white/80 text-xs md:text-sm">
              Build and attach your phone agent with Twilio — no third-party SDKs.
            </div>
          </div>

          {!creating ? (
            <button
              onClick={() => { setCreating(true); setStep(1); }}
              className="inline-flex items-center gap-2 px-4 h-[42px] rounded-[14px] font-semibold"
              style={{ background: BTN.green, color: '#fff' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN.greenHover)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN.green)}
            >
              Create a Build
            </button>
          ) : (
            <button
              onClick={() => setCreating(false)}
              className="inline-flex items-center gap-2 px-4 h-[42px] rounded-[14px] font-semibold border border-white/25 text-white"
              style={{ background: 'transparent' }}
              title="Close wizard"
            >
              <X className="w-4 h-4" /> Close
            </button>
          )}
        </div>

        {/* CREATE WIZARD (like Builder) */}
        {creating && (
          <div className="relative p-6 md:p-8" style={{ ...FRAME, overflow: 'visible' }}>
            <div className="mb-6">
              {/* matches your builder progress dots/bar */}
              <StepProgress current={step as any} />
            </div>

            {step === 1 && <StepV1Basics onNext={next} />}
            {step === 2 && <StepV2Telephony onBack={back} onNext={next} />}
            {step === 3 && <StepV3Prompt onBack={back} onNext={next} />}
            {step === 4 && <StepV4Overview onBack={back} />}

            {/* optional quick nav (click numbers) */}
            <div className="mt-6 flex gap-2 justify-center">
              {[1,2,3,4].map((n) => (
                <button
                  key={n}
                  onClick={() => goTo(n as WizardStep)}
                  className={`px-3 py-1 rounded-md text-xs ${step === n ? 'bg-[#59d9b3] text-black' : 'bg-white/10 text-white/90'}`}
                >
                  Step {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* EDITOR / ANYTHING ELSE YOU ALREADY SHOW HERE */}
        {!creating && (
          <div className="relative p-6 md:p-8" style={{ ...FRAME, overflow: 'visible' }}>
            <div className="p-5" style={CARD}>
              <div className="text-white/85 text-sm mb-2">Editor</div>
              <div className="text-white/60 text-sm">
                Use “Create a Build” to add a new voice agent. Your saved settings are kept in localStorage
                and the number is attached through <code>/api/telephony/attach-number</code>.
              </div>
              <div className="mt-4">
                <button
                  onClick={() => { setCreating(true); setStep(1); }}
                  className="inline-flex items-center gap-2 px-4 h-[38px] rounded-[12px] font-semibold"
                  style={{ background: BTN.green, color:'#000' }}
                >
                  Start Wizard
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx global>{`
        body { background:#0b0c10; color:#fff; }
        select { background-color: rgba(0,0,0,.30); color: white; }
      `}</style>
    </>
  );
}
