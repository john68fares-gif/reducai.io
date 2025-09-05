// components/builder/Step1AIType.tsx
'use client';

import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';

type Props = {
  onNext: (type: 'sales' | 'support' | 'blank') => void;
};

export default function Step1AIType({ onNext }: Props) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c10]">
      <div className="w-full max-w-4xl bg-[#0d0f11] border border-[#00ffc220] rounded-2xl p-10 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center mb-2">Step 1: Choose AI Type</h2>
        <p className="text-gray-400 text-center mb-8">Select the type of AI agent you want to build</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div
            onClick={() => setSelected('sales')}
            className={`cursor-pointer rounded-xl p-6 border transition ${
              selected === 'sales'
                ? 'border-[#00ffc2] bg-[#0b0c10]'
                : 'border-gray-700 bg-[#0d0f11]'
            }`}
          >
            <p className="text-lg font-semibold text-white mb-2">Sales AI</p>
            <p className="text-sm text-gray-400">Convert visitors into customers with persuasive conversations.</p>
          </div>

          <div
            onClick={() => setSelected('support')}
            className={`cursor-pointer rounded-xl p-6 border transition ${
              selected === 'support'
                ? 'border-[#00ffc2] bg-[#0b0c10]'
                : 'border-gray-700 bg-[#0d0f11]'
            }`}
          >
            <p className="text-lg font-semibold text-white mb-2">Support AI</p>
            <p className="text-sm text-gray-400">Answer FAQs, handle issues, and provide 24/7 assistance.</p>
          </div>

          <div
            onClick={() => setSelected('blank')}
            className={`cursor-pointer rounded-xl p-6 border transition ${
              selected === 'blank'
                ? 'border-[#00ffc2] bg-[#0b0c10]'
                : 'border-gray-700 bg-[#0d0f11]'
            }`}
          >
            <p className="text-lg font-semibold text-white mb-2">Start Blank</p>
            <p className="text-sm text-gray-400">Fully custom AI agent without predefined flow.</p>
          </div>
        </div>

        <div className="flex justify-center mt-8">
          <button
            disabled={!selected}
            onClick={() => selected && onNext(selected as any)}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${
              selected
                ? 'bg-[#00ffc2] text-black hover:bg-[#00e6b0]'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
