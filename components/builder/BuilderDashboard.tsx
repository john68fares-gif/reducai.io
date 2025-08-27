// components/builder/BuilderDashboard.tsx
'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';

// Load steps lazily so missing files can't crash other steps.
const Step1 = dynamic(() => import('./Step1AIType'), { ssr: false });
const Step2 = dynamic(() => import('./Step2ModelSettings'), { ssr: false });
const Step3 = dynamic(() => import('./Step3PromptEditor'), { ssr: false });
const Step4 = dynamic(() => import('./Step4Overview'), { ssr: false });

export default function BuilderDashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const step = useMemo(() => Number(params.get('step') || 0), [params]);

  const go = useCallback(
    (n: number) => {
      const q = new URLSearchParams(params?.toString() || '');
      if (n === 0) q.delete('step');
      else q.set('step', String(n));
      router.push(`/builder?${q.toString()}`);
    },
    [router, params]
  );

  if (step === 1) {
    return <Step1 onNext={() => go(2)} />;
  }
  if (step === 2) {
    return <Step2 onBack={() => go(1)} onNext={() => go(3)} />;
  }
  if (step === 3) {
    return <Step3 onBack={() => go(2)} onNext={() => go(4)} />;
  }
  if (step === 4) {
    return <Step4 onBack={() => go(3)} onFinish={() => go(0)} />;
  }

  // simple placeholder dashboard — your existing grid/cards can go here
  return (
    <div className="min-h-screen bg-[#0b0c10] text-white font-movatif">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <h1 className="text-2xl font-semibold mb-6">Builds</h1>
        <button
          onClick={() => go(1)}
          className="rounded-xl px-5 py-3 font-semibold"
          style={{
            background: '#59d9b3',
            color: '#0b0c10',
            border: '1px solid rgba(106,247,209,0.5)',
            boxShadow: '0 0 12px rgba(106,247,209,0.25)',
          }}
        >
          + Create a Build
        </button>
      </div>
    </div>
  );
}
