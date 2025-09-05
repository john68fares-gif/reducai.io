// components/builder/StepProgress.tsx
'use client';

import React from 'react';

type Props = {
  step: number; // current step (1–4)
};

const steps = [
  { id: 1, title: 'AI Type' },
  { id: 2, title: 'Model Settings' },
  { id: 3, title: 'Personality & Knowledge' },
  { id: 4, title: 'Overview' },
];

export default function StepProgress({ step }: Props) {
  return (
    <div className="w-full flex items-center justify-center mb-12">
      <div className="flex items-center gap-6">
        {steps.map((s, i) => {
          const active = s.id === step;
          const completed = s.id < step;

          return (
            <div key={s.id} className="flex items-center">
              {/* Step circle */}
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-full border-2 transition shadow-md ${
                  completed
                    ? 'bg-[#00ffc2] border-[#00ffc2] text-black shadow-[0_0_15px_rgba(0,255,194,0.7)]'
                    : active
                    ? 'border-[#00ffc2] text-[#00ffc2] shadow-[0_0_12px_rgba(0,255,194,0.5)]'
                    : 'border-gray-600 text-gray-500'
                }`}
              >
                {s.id}
              </div>

              {/* Step title */}
              <span
                className={`ml-2 text-sm font-medium ${
                  active
                    ? 'text-[#00ffc2]'
                    : completed
                    ? 'text-gray-300'
                    : 'text-gray-500'
                }`}
              >
                {s.title}
              </span>

              {/* Divider line (except after last step) */}
              {i < steps.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-3 transition ${
                    completed
                      ? 'bg-[#00ffc2] shadow-[0_0_10px_rgba(0,255,194,0.7)]'
                      : active
                      ? 'bg-[#00ffc2]/60'
                      : 'bg-gray-700'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
