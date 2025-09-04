'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import dynamic from 'next/dynamic';
import {
  Plus,
  Bot as BotIcon,
  ArrowRight,
  Trash2,
  SlidersHorizontal,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';
import { supabase } from '@/lib/supabase-client';

const OnboardingOverlay = dynamic(() => import('../ui/OnboardingOverlay'), { ssr: false, loading: () => null });
const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false, loading: () => <div className="h-full w-full bg-black/20" /> });

class ErrorBoundary extends React.Component<{ fallback?: React.ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() { return this.state.hasError ? this.props.fallback ?? null : this.props.children as any; }
}

type Appearance = { accent?: string; [k: string]: any };
type Bot = {
  id: string; name: string; industry?: string; language?: string;
  model?: string; description?: string; prompt?: string;
  createdAt?: string; updatedAt?: string; appearance?: Appearance;
};

const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

const sortByNewest = (arr: Bot[]) =>
  arr.slice().sort((a, b) => Date.parse(b.updatedAt || b.createdAt || '0') - Date.parse(a.updatedAt || a.createdAt || '0'));

function loadBots(): Bot[] {
  if (typeof window === 'undefined') return [];
  for (const k of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;
      const out: Bot[] = arr.map((b: any) => ({
        id: b?.id ?? crypto.randomUUID(),
        name: s(b?.name, 'Untitled Bot'),
        industry: s(b?.industry),
        language: s(b?.language),
        model: s(b?.model, 'gpt-4o-mini'),
        description: s(b?.description),
        prompt: s(b?.prompt),
        createdAt: b?.createdAt ?? nowISO(),
        updatedAt: b?.updatedAt ?? b?.createdAt ?? nowISO(),
        appearance: b?.appearance ?? undefined,
      }));
      return sortByNewest(out);
    } catch {}
  }
  return [];
}
function saveBots(bots: Bot[]) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(bots)); } catch {} }

export default function BuilderDashboard() {
  const router = useRouter();
  const search = useMemo(() => new URLSearchParams((router.asPath.split('?')[1] ?? '')), [router.asPath]);
  const pathname = router.pathname;

  const [userId, setUserId] = useState('');
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || '');
      unsub = supabase.auth.onAuthStateChange((_e, session) => setUserId(session?.user?.id || ''));
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const rawStep = search.get('step');
  const step = rawStep && ['1','2','3','4'].includes(rawStep) ? rawStep : null;

  const [query, setQuery] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [customizingId, setCustomizingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const [loading, setLoading] = useState<{ on: boolean; msg?: string }>({ on: false });

  const doPhase = async (msg: string, fn: () => Promise<void> | void) => {
    setLoading({ on: true, msg });
    try { await fn(); } finally { setTimeout(() => setLoading({ on: false }), 380); }
  };

  useEffect(() => { setBots(loadBots()); }, []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bots.filter(b => b.name.toLowerCase().includes(q)) : bots;
  }, [bots, query]);

  const selectedBot = useMemo(() => bots.find(b => b.id === customizingId), [bots, customizingId]);
  const viewedBot = useMemo(() => bots.find(b => b.id === viewId), [bots, viewId]);

  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
      <main className="flex w-full min-h-screen items-stretch justify-center p-6">
        <div className="w-full max-w-[1600px] h-[calc(100vh-3rem)]">{children}</div>
      </main>
    </div>
  );

  if (step) {
    return (
      <Shell>
        <AnimatePresence mode="wait">
          <motion.div key={step} initial={{ opacity:0,y:14 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:-10 }} transition={{ duration:0.3 }}>
            {step === '1' && <Step1AIType onNext={() => setStep('2')} />}
            {step === '2' && <Step2ModelSettings onBack={() => setStep('1')} onNext={() => setStep('3')} />}
            {step === '3' && <Step3PromptEditor onBack={() => setStep('2')} onNext={() => setStep('4')} />}
            {step === '4' && <Step4Overview onBack={() => setStep('3')} onFinish={() => setStep(null)} />}
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex flex-col h-full">
        {/* header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Builds</h1>
          <button
            onClick={() => doPhase('Starting new build…', () => router.push('/builder?step=1'))}
            className="px-4 py-2 rounded-lg bg-[#00ffc2] text-black font-semibold shadow hover:brightness-110 transition"
          >
            Create a Build
          </button>
        </div>

        {/* search */}
        <div className="mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and builds…"
            className="w-full rounded-lg bg-[#101314] text-white/95 border border-[#13312b] px-5 py-3 text-[15px] outline-none focus:border-[#00ffc2]"
          />
        </div>

        {/* grid fills height */}
        <div className="flex-1 overflow-hidden">
          <div className="grid h-full grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 auto-rows-fr">
            <CreateCard onClick={() => router.push('/builder?step=1')} />
            {filtered.map((bot) => (
              <BuildCard
                key={bot.id}
                bot={bot}
                accent="#6af7d1"
                onOpen={() => setViewId(bot.id)}
                onDelete={() => {
                  const next = bots.filter(b => b.id !== bot.id);
                  setBots(next); saveBots(next);
                }}
                onCustomize={() => setCustomizingId(bot.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}

/* cards */
function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl p-6 flex flex-col items-center justify-center border border-[#13312b] bg-[#0d0f11] hover:border-[#00ffc2] transition"
    >
      <Plus className="w-10 h-10 mb-4 text-[#6af7d1]" />
      <div className="text-lg font-medium">Create a Build</div>
      <div className="text-sm text-white/60 mt-1">Start building your AI assistant</div>
    </button>
  );
}
function BuildCard({ bot, accent, onOpen, onDelete, onCustomize }: { bot: Bot; accent: string; onOpen: () => void; onDelete: () => void; onCustomize: () => void; }) {
  return (
    <div className="rounded-xl border border-[#13312b] bg-[#0d0f11] flex flex-col overflow-hidden">
      <div className="h-44 border-b border-[#13312b] relative">
        <button onClick={onCustomize} className="absolute right-3 top-3 text-xs bg-black/40 px-2 py-1 rounded">Customize</button>
        <ErrorBoundary fallback={<div className="h-full w-full bg-black/20" />}>
          {/* @ts-ignore */}
          <Bot3D className="h-full" accent={accent} />
        </ErrorBoundary>
      </div>
      <div className="p-5 flex flex-col gap-3 flex-1">
        <div className="flex items-center gap-3">
          <BotIcon className="w-5 h-5" style={{ color: accent }} />
          <div className="font-medium">{bot.name}</div>
          <button onClick={onDelete} className="ml-auto text-xs text-red-400 hover:text-red-300">Delete</button>
        </div>
        <div className="text-xs text-white/50">Updated {fmtDate(bot.updatedAt)}</div>
        <button onClick={onOpen} className="mt-auto px-3 py-2 rounded border border-[#13312b] hover:border-[#00ffc2]">Open</button>
      </div>
    </div>
  );
}
