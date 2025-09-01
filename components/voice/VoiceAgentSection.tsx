// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import StepProgress from '@/components/builder/StepProgress';
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3PromptA from '@/components/voice/steps/StepV3PromptA';
import StepV3PromptB from '@/components/voice/steps/StepV3PromptB';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';
import { Plus } from 'lucide-react';

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow:
    '0 18px 60px rgba(0,0,0,0.50), inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 28,
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';

export default function VoiceAgentSection() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const rawStep = searchParams.get('step');
  const step = rawStep && ['1', '2', '3', '4'].includes(rawStep) ? rawStep : null;

  // NEW: sub-step for Step 3 (A or B)
  const part: 'A' | 'B' = ((): 'A' | 'B' => {
    const p = (searchParams.get('part') || 'A').toUpperCase();
    return p === 'B' ? 'B' : 'A';
  })();

  const setStep = (next: string | null) => {
    const usp = new URLSearchParams(Array.from(searchParams.entries()));
    if (next) usp.set('step', next);
    else usp.delete('step');
    if (next !== '3') usp.delete('part'); // clear part when leaving step 3
    router.replace(`${pathname}?${usp.toString()}`, { scroll: false });
  };

  const setPart = (next: 'A' | 'B') => {
    const usp = new URLSearchParams(Array.from(searchParams.entries()));
    usp.set('step', '3');
    usp.set('part', next);
    router.replace(`${pathname}?${usp.toString()}`, { scroll: false });
  };

  useEffect(() => {
    try {
      if (localStorage.getItem('voicebuilder:cleanup') === '1') {
        ['voicebuilder:step1', 'voicebuilder:step2', 'voicebuilder:step3'].forEach((k) =>
          localStorage.removeItem(k)
        );
        localStorage.removeItem('voicebuilder:cleanup');
      }
    } catch {}
  }, []);

  if (step) {
    return (
      <main className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          <StepProgress current={Number(step)} />

          {step === '1' && <StepV1Basics onNext={() => setStep('2')} />}

          {step === '2' && (
            <div className="mt-8">
              <StepV2Telephony onBack={() => setStep('1')} onNext={() => setStep('3')} />
            </div>
          )}

          {step === '3' && (
            <div className="mt-8">
              {part === 'A' ? (
                <StepV3PromptA onBack={() => setStep('2')} onNext={() => setPart('B')} />
              ) : (
                <StepV3PromptB onBack={() => setPart('A')} onNext={() => setStep('4')} />
              )}
            </div>
          )}

          {step === '4' && (
            <div className="mt-8">
              <StepV4Overview onBack={() => setStep('3')} />
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    try {
                      // optionally clear drafts after finishing
                      // localStorage.removeItem('voicebuilder:step1');
                      // localStorage.removeItem('voicebuilder:step2');
                      // localStorage.removeItem('voicebuilder:step3');
                    } catch {}
                    setStep(null);
                  }}
                  className="px-5 py-2 rounded-[14px] font-semibold"
                  style={{ background: 'rgba(0,120,90,1)', color: 'white' }}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    );
  }

  // Default screen when no step is selected
  return (
    <main className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
        <header className="mb-8">
          <h1 className="text-2xl md:text-3xl font-semibold">Voice Agents</h1>
          <p className="text-white/70 mt-1">
            Create a voice agent and attach a phone number—no extra SDKs needed.
          </p>
        </header>

        <section className="relative p-6 sm:p-8" style={CARD_STYLE}>
          <div
            aria-hidden
            className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
            style={{
              background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
              filter: 'blur(38px)',
            }}
          />
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-xl font-semibold">Create a Voice Build</div>
              <div className="text-white/70 mt-1">
                Name, language & accent → connect number → prompt → review.
              </div>
            </div>
            <button
              onClick={() => setStep('1')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[14px] font-semibold transition"
              style={{
                background: BTN_GREEN,
                color: '#0b0c10',
                boxShadow: '0 0 10px rgba(106,247,209,0.28)',
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)
              }
            >
              <Plus className="w-4 h-4" />
              Create a Build
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
