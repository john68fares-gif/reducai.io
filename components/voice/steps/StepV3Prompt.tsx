// components/voice/steps/StepV3Prompt.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CARD_STYLE, GreenButton } from '../atoms';
import { ArrowLeft, Wand2 } from 'lucide-react';
import { shapePromptForScheduling } from '../utils/prompt';

type Props = { onBack?: () => void; onNext?: () => void };

export default function StepV3Prompt({ onBack, onNext }: Props) {
  const [prompt, setPrompt] = useState('');

  useEffect(() => {
    const s = JSON.parse(localStorage.getItem('voicebuilder:step3') || 'null');
    if (s?.prompt) { setPrompt(s.prompt); return; }

    // seed from your Builder "chatbots" array (take most recent)
    try {
      const arr = JSON.parse(localStorage.getItem('chatbots') || '[]');
      if (Array.isArray(arr) && arr.length) {
        const latest = arr[0];
        const seed = `Company: ${latest?.name || latest?.title || ''}\n\n${latest?.prompt || ''}`.trim();
        const s1 = JSON.parse(localStorage.getItem('voicebuilder:step1') || 'null');
        const shaped = shapePromptForScheduling(seed, { org: s1?.name || latest?.name || 'Company' });
        setPrompt(shaped);
      }
    } catch {}
  }, []);

  function improve() { setPrompt((p)=> shapePromptForScheduling(p)); }
  function persistAndNext() {
    try { localStorage.setItem('voicebuilder:step3', JSON.stringify({ prompt })); } catch {}
    onNext?.();
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl md:text-4xl font-semibold">Personality & Prompt</h1>
        <div className="text-xs px-3 py-1 rounded-2xl border" style={{ borderColor:'rgba(106,247,209,0.32)', background:'rgba(16,19,20,0.70)' }}>Step 3 of 4</div>
      </div>

      <div className="p-7 md:p-8" style={CARD_STYLE}>
        <textarea
          value={prompt}
          onChange={(e)=>setPrompt(e.target.value)}
          rows={18}
          className="w-full rounded-2xl bg-[#101314] border border-white/15 p-4 outline-none text-sm"
          placeholder="Paste your notes or write from scratch…"
        />
        <div className="mt-3 flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 rounded-[24px] border border-white/15 bg-transparent px-4 py-2 text-white hover:bg-white/10 transition">
            <ArrowLeft className="w-4 h-4" /> Previous
          </button>
          <div className="flex gap-2">
            <GreenButton onClick={improve}><Wand2 className="w-4 h-4" /> Improve Prompt</GreenButton>
            <GreenButton onClick={persistAndNext}>Next →</GreenButton>
          </div>
        </div>
      </div>
    </section>
  );
}
