// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import {
  Plus, Bot as BotIcon, ArrowRight, Trash2,
} from 'lucide-react';

import StepProgress from '@/components/builder/StepProgress';

// VOICE STEPS (already in your repo)
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3Prompt from '@/components/voice/steps/StepV3Prompt';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';

type VoiceBuild = {
  id: string;
  name: string;
  industry?: string;
  language?: string;       // e.g. en-US
  prompt?: string;
  fromE164?: string;
  type?: 'voice' | string; // filter to voice
  createdAt?: string;
  updatedAt?: string;
};

const CARD_STYLE: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '2px solid rgba(106,247,209,0.32)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
  borderRadius: 16,
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

function loadVoiceBuilds(): VoiceBuild[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('chatbots');
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr)) return [];
    return arr.filter((b: any) => !b.type || b.type === 'voice');
  } catch {
    return [];
  }
}

function saveVoiceBuilds(next: VoiceBuild[]) {
  // we only write 'chatbots' (keeping any non-voice entries as-is)
  try {
    const raw = localStorage.getItem('chatbots');
    const arr = raw ? JSON.parse(raw) : [];
    const rest = Array.isArray(arr) ? arr.filter((b: any) => b.type && b.type !== 'voice') : [];
    localStorage.setItem('chatbots', JSON.stringify([...next, ...rest]));
  } catch {}
}

export default function VoiceAgentSection() {
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [builds, setBuilds] = useState<VoiceBuild[]>([]);

  useEffect(() => {
    setBuilds(loadVoiceBuilds());
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'chatbots') setBuilds(loadVoiceBuilds());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  function startCreate() {
    // clear the temp wizard state to start fresh
    try {
      ['voicebuilder:step1', 'voicebuilder:step2', 'voicebuilder:step3'].forEach((k) => localStorage.removeItem(k));
    } catch {}
    setWizard(true);
    setStep(1);
  }

  function openForEdit(b: VoiceBuild) {
    // prefill the wizard’s localStorage keys so steps load values
    try {
      const s1 = {
        name: b.name || '',
        industry: b.industry || '',
        language: b.language || 'en-US',
        languageCode: (b.language || 'en-US').split('-')[0],
        countryIso2: (b.language || 'en-US').split('-')[1] || 'US',
      };
      localStorage.setItem('voicebuilder:step1', JSON.stringify(s1));
      if (b.fromE164) localStorage.setItem('voicebuilder:step2', JSON.stringify({ fromE164: b.fromE164 }));
      if (b.prompt) localStorage.setItem('voicebuilder:step3', JSON.stringify({ prompt: b.prompt }));
    } catch {}
    setWizard(true);
    setStep(1);
  }

  function deleteBuild(id: string) {
    const next = builds.filter((b) => b.id !== id);
    setBuilds(next);
    saveVoiceBuilds(next);
  }

  if (wizard) {
    return (
      <>
        <Head><title>Voice Agent • reduc.ai</title></Head>
        <main className="min-h-screen bg-[#0b0c10] text-white font-movatif">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
            <StepProgress current={step} />

            {step === 1 && <StepV1Basics onNext={() => setStep(2)} />}
            {step === 2 && <StepV2Telephony onBack={() => setStep(1)} onNext={() => setStep(3)} />}
            {step === 3 && <StepV3Prompt onBack={() => setStep(2)} onNext={() => setStep(4)} />}
            {step === 4 && <StepV4Overview onBack={() => setStep(3)} />}
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Head><title>Voice Agent • reduc.ai</title></Head>
      <main className="min-h-screen bg-[#0b0c10] text-white font-movatif">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-24">
          {/* Header */}
          <div className="flex items-center justify-between mb-7">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold">Voice Agent</h1>
              <div className="text-white/70 text-sm">Build and attach your phone agent with Twilio — no third-party SDKs.</div>
            </div>
            <button
              onClick={startCreate}
              className="px-4 py-2 rounded-[10px] font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] transition"
              style={{ background: BTN_GREEN, color: '#0b0c10' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
            >
              Create a Voice Agent
            </button>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
            <CreateCard onClick={startCreate} />

            {builds.map((b) => (
              <BuildCard
                key={b.id}
                bot={b}
                onOpen={() => openForEdit(b)}
                onDelete={() => deleteBuild(b.id)}
              />
            ))}
          </div>

          {builds.length === 0 && (
            <div className="mt-12 text-center text-white/60">
              No voice agents yet. Click <span className="text-[#00ffc2]">Create a Voice Agent</span> to get started.
            </div>
          )}
        </div>
      </main>
    </>
  );
}

/* ----------------- Cards ----------------- */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative h-[360px] rounded-[16px] p-7 flex flex-col items-center justify-center transition-all active:scale-[0.995]"
      style={CARD_STYLE}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)', filter: 'blur(38px)' }}
      />
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'rgba(0,0,0,0.18)',
          border: '2px dashed rgba(106,247,209,0.35)',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.45), inset 0 0 6px rgba(106,247,209,0.06)',
        }}
      >
        <Plus className="w-10 h-10" style={{ color: '#6af7d1', opacity: 0.9 }} />
      </div>
      <div className="text-[20px]">Create a Voice Agent</div>
      <div className="text-[13px] text-white/65 mt-2">Start a new phone agent build</div>
    </button>
  );
}

function BuildCard({
  bot, onOpen, onDelete,
}: {
  bot: VoiceBuild;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="relative h-[360px] rounded-[16px] p-0 flex flex-col justify-between" style={CARD_STYLE}>
      <div className="h-44 border-b border-white/10 flex items-center justify-center">
        <div
          className="w-16 h-16 rounded-[12px] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.15)', border: '2px solid rgba(106,247,209,0.32)' }}
        >
          <BotIcon className="w-7 h-7" style={{ color: '#6af7d1' }} />
        </div>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="flex items-start gap-3">
          <div className="min-w-0">
            <div className="font-semibold truncate">{bot.name || 'Untitled Voice Agent'}</div>
            <div className="text-[12px] text-white/60 truncate">
              {(bot.industry || '—') + (bot.language ? ` · ${bot.language}` : '')}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="ml-auto p-1.5 rounded-md hover:bg-[#ff4d4d14] transition"
            title="Delete"
          >
            <Trash2 className="w-4 h-4 text-white/70 hover:text-[#ff7a7a]" />
          </button>
        </div>

        <div className="mt-4 flex items-end justify-between">
          <div className="text-[12px] text-white/50">Updated {fmtDate(bot.updatedAt || bot.createdAt)}</div>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm border transition hover:translate-y-[-1px]"
            style={{ background: 'rgba(16,19,20,0.88)', border: '2px solid rgba(106,247,209,0.4)', boxShadow: '0 0 14px rgba(106,247,209,0.12)' }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
