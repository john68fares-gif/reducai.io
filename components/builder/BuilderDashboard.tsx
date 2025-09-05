// BuilderDashboard.tsx (fixed step + updated colors)
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  Plus, Bot as BotIcon, ArrowRight, Trash2, SlidersHorizontal, X, Copy, Download as DownloadIcon,
  FileText, Settings, MessageSquareText, Landmark, ListChecks,
} from 'lucide-react';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';
import { supabase } from '@/lib/supabase-client';
import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

const OnboardingOverlay = dynamic(() => import('../ui/OnboardingOverlay'), { ssr: false, loading: () => null });
const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-gray-100 dark:bg-[#0d0f11]" />,
});

// ---------- helpers ----------
const palette = ['#00ffc2', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[Math.abs([...id].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

export default function BuilderDashboard() {
  const router = useRouter();

  // 🔹 restore step logic
  const search = useMemo(
    () => new URLSearchParams((router.asPath.split('?')[1] ?? '')),
    [router.asPath]
  );
  const pathname = router.pathname;

  const rawStep = search.get('step');
  const step = rawStep && ['1', '2', '3', '4'].includes(rawStep) ? rawStep : null;

  const setStepParam = (next: string | null) => {
    const usp = new URLSearchParams(search.toString());
    if (next) usp.set('step', next); else usp.delete('step');
    router.replace(`${pathname}?${usp.toString()}`, undefined, { shallow: true });
  };

  // … your state hooks here (bots, query, etc.) …

  if (step) {
    return (
      <div className="min-h-screen w-full bg-white text-black dark:bg-[#0b0c10] dark:text-white">
        <main className="w-full min-h-screen">
          {step === '1' && <Step1AIType onNext={() => setStepParam('2')} />}
          {step === '2' && <Step2ModelSettings onBack={() => setStepParam('1')} onNext={() => setStepParam('3')} />}
          {step === '3' && <Step3PromptEditor onBack={() => setStepParam('2')} onNext={() => setStepParam('4')} />}
          {step === '4' && <Step4Overview onBack={() => setStepParam('3')} onFinish={() => setStepParam(null)} />}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-white text-black dark:bg-[#0b0c10] dark:text-white">
      <main className="flex-1 w-full px-4 sm:px-6 pt-10 pb-24">
        <div className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Builds</h1>
          <button
            onClick={() => router.push('/builder?step=1')}
            className="rounded-md px-4 py-2 font-semibold bg-green-400 text-black hover:bg-green-300 dark:bg-emerald-900/30 dark:text-emerald-100 dark:hover:bg-emerald-800/50 transition"
          >
            Create a Build
          </button>
        </div>

        <div className="mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and builds…"
            className="w-full rounded-md px-5 py-4 text-[15px] outline-none border border-gray-300 dark:border-gray-700 bg-white dark:bg-[#0d0f11] text-black dark:text-white"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
          <CreateCard onClick={() => router.push('/builder?step=1')} />
          {filtered.map((bot) => (
            <BuildCard
              key={bot.id}
              bot={bot}
              accent={bot.appearance?.accent || accentFor(bot.id)}
              onOpen={() => setViewId(bot.id)}
              onDelete={async () => {
                const next = bots.filter((b) => b.id !== bot.id);
                const sorted = sortByNewest(next);
                setBots(sorted);
                await saveBots(sorted);
              }}
              onCustomize={() => setCustomizingId(bot.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-gray-500 dark:text-gray-400">
            No builds found. Click <span className="text-green-500 dark:text-emerald-400">Create a Build</span> to get started.
          </div>
        )}
      </main>

      {/* Customize + PromptOverlay unchanged */}
      {selectedBot && <CustomizeModal /* … */ />}
      {viewedBot && <PromptOverlay bot={viewedBot} onClose={() => setViewId(null)} />}
      <OnboardingOverlay open={welcomeOpen} mode={mode} userId={userId} onDone={closeWelcome} />
    </div>
  );
}

/* ---------- Create Card ---------- */
function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative h-[380px] rounded-xl p-7 flex flex-col items-center justify-center transition-all bg-gray-50 dark:bg-[#0d0f11] border border-gray-300 dark:border-gray-700 shadow-sm active:scale-[0.995]"
    >
      <div className="w-20 h-20 rounded-full flex items-center justify-center mb-5 bg-gray-100 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700">
        <Plus className="w-10 h-10 text-green-500" />
      </div>
      <div className="text-lg font-semibold">Create a Build</div>
      <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">Start building your AI assistant</div>
    </button>
  );
}

/* ---------- Build Card ---------- */
function BuildCard({ bot, accent, onOpen, onDelete, onCustomize }: any) {
  return (
    <div className="relative h-[380px] rounded-xl flex flex-col justify-between bg-white dark:bg-[#0d0f11] border border-gray-300 dark:border-gray-700 shadow-sm">
      <div className="h-48 border-b border-gray-200 dark:border-gray-700 relative">
        <button
          onClick={onCustomize}
          className="absolute right-3 top-3 z-10 px-2.5 py-1.5 rounded-md text-xs bg-gray-100 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" /> Customize
        </button>
        <ErrorBoundary fallback={<div className="h-full w-full bg-gray-100 dark:bg-[#0d0f11]" />}>
          {/* @ts-ignore */}
          <Bot3D className="h-full" accent={accent} />
        </ErrorBoundary>
      </div>
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md flex items-center justify-center bg-gray-100 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700">
            <BotIcon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{bot.name}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {(bot.industry || '—') + (bot.language ? ` · ${bot.language}` : '')}
            </div>
          </div>
          <button onClick={onDelete} className="ml-auto p-1.5 rounded hover:bg-gray-100 dark:hover:bg-[#1a1d21]">
            <Trash2 className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Updated {fmtDate(bot.updatedAt || bot.createdAt)}
          </div>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md text-sm bg-gray-100 dark:bg-[#0b0c10] border border-gray-300 dark:border-gray-700"
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
