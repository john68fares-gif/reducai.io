// components/builder/Step4Overview.tsx
'use client';

import React, { useState } from 'react';
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react';

type Step2Data = {
  name: string;
  industry: string;
  language: string;
  model: string;
  temperature: number;
  apiKeyId: string;
};

type Section = {
  id: string;
  title: string;
  content: string;
};

type Props = {
  step2: Step2Data;
  step3: Section[];
  onBack: () => void;
  onComplete: () => void;
};

export default function Step4Overview({ step2, step3, onBack, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function handleGenerate() {
    setLoading(true);

    // simulate API call / AI generation
    await new Promise((res) => setTimeout(res, 2000));

    // store chatbot in localStorage
    const stored = localStorage.getItem('chatbots.v1');
    let bots = stored ? JSON.parse(stored) : [];
    bots.push({
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...step2,
      sections: step3,
    });
    localStorage.setItem('chatbots.v1', JSON.stringify(bots));

    setLoading(false);
    setDone(true);

    // wait a bit, then redirect to dashboard
    setTimeout(() => {
      onComplete();
    }, 1200);
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0b0c10]">
      <div className="w-full max-w-3xl bg-[#0d0f11] border border-[#00ffc220] rounded-2xl shadow-[0_0_25px_rgba(0,255,194,0.15)] p-8 space-y-6">
        <h2 className="text-2xl font-bold text-white text-center">Step 4: Overview</h2>
        <p className="text-gray-400 text-center mb-6">
          Review your settings and generate your AI agent
        </p>

        {/* Step 2 Summary */}
        <div className="bg-[#0b0c10] border border-[#00ffc2] rounded-xl p-4 text-white">
          <h3 className="text-lg font-semibold mb-2 text-[#00ffc2]">General Settings</h3>
          <ul className="text-gray-300 space-y-1 text-sm">
            <li><span className="font-medium">AI Name:</span> {step2.name}</li>
            <li><span className="font-medium">Industry:</span> {step2.industry}</li>
            <li><span className="font-medium">Language:</span> {step2.language}</li>
            <li><span className="font-medium">Model:</span> {step2.model}</li>
            <li><span className="font-medium">Temperature:</span> {step2.temperature}</li>
          </ul>
        </div>

        {/* Step 3 Summary */}
        <div className="bg-[#0b0c10] border border-[#00ffc2] rounded-xl p-4 text-white">
          <h3 className="text-lg font-semibold mb-2 text-[#00ffc2]">Knowledge & Personality</h3>
          {step3.map((s) => (
            <div key={s.id} className="mb-4">
              <h4 className="font-semibold">{s.title}</h4>
              <pre className="text-gray-300 text-sm whitespace-pre-wrap mt-1">{s.content}</pre>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 px-4 py-2 bg-[#0b0c10] border border-gray-600 rounded-lg text-gray-300 hover:bg-gray-800 transition"
            disabled={loading || done}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || done}
            className={`flex items-center gap-2 px-6 py-2 rounded-lg transition ${
              loading || done
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                : 'bg-[#00ffc2] text-black hover:bg-[#00e6b0]'
            }`}
          >
            {loading && <Loader2 size={18} className="animate-spin" />}
            {done && <CheckCircle2 size={18} />}
            {loading ? 'Generating...' : done ? 'Done!' : 'Generate AI'}
          </button>
        </div>
      </div>
    </div>
  );
}
