// components/builder/BuilderDashboard.tsx
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
  X,
  Copy,
  Download as DownloadIcon,
  FileText,
  Settings,
  MessageSquareText,
  Landmark,
  ListChecks,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';
import { s } from '@/utils/safe';
import { supabase } from '@/lib/supabase-client';

const OnboardingOverlay = dynamic(() => import('../ui/OnboardingOverlay'), {
  ssr: false,
  loading: () => null,
});

const Bot3D = dynamic(() => import('./Bot3D.client'), {
  ssr: false,
  loading: () => (
    <div
      className="h-full w-full"
      style={{
        background:
          'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))',
      }}
    />
  ),
});

class ErrorBoundary extends React.Component<
  { fallback?: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children as any;
  }
}

function LoaderOverlay({ message }: { message?: string }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.55)' }}
    >
      <div className="relative">
        <div
          className="absolute -inset-10 -z-10"
          style={{
            background:
              'radial-gradient(circle, rgba(106,247,209,0.20) 0%, transparent 70%)',
            filter: 'blur(30px)',
          }}
        />
        <div
          className="flex flex-col items-center gap-4 rounded-2xl px-8 py-7"
          style={{
            background: '#0d0f11',
            border: '1px solid rgba(106,247,209,0.35)',
            boxShadow: '0 0 30px rgba(0,0,0,0.5)',
          }}
        >
          <div
            className="h-9 w-9 animate-spin rounded-full border-2"
            style={{
              borderColor: 'rgba(106,247,209,0.35)',
              borderTopColor: '#6af7d1',
            }}
          />
          <div className="text-white/90 text-sm">
            {message || 'Loading…'}
          </div>
          <div className="text-white/50 text-[11px]">Please wait</div>
        </div>
      </div>
    </div>
  );
}

type Appearance = {
  accent?: string;
  shellColor?: string;
  bodyColor?: string;
  trimColor?: string;
  faceColor?: string;
  variant?: string;
  eyes?: string;
  head?: string;
  torso?: string;
  arms?: string;
  legs?: string;
  antenna?: boolean;
  withBody?: boolean;
  idle?: boolean;
};

type Bot = {
  id: string;
  name: string;
  industry?: string;
  language?: string;
  model?: string;
  description?: string;
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
  appearance?: Appearance;
};

const STORAGE_KEYS = ['chatbots', 'agents', 'builds'];
const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString() : '';
const sortByNewest = (arr: Bot[]) =>
  arr
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.updatedAt || b.createdAt || '0') -
        Date.parse(a.updatedAt || a.createdAt || '0')
    );

function loadBots(): Bot[] {
  if (typeof window === 'undefined') return [];
  for (const k of STORAGE_KEYS) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) continue;

      const out: Bot[] = arr.map((b: any) => ({
        id:
          b?.id ??
          (typeof crypto !== 'undefined'
            ? crypto.randomUUID()
            : String(Date.now())),
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

function saveBots(bots: Bot[]) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(bots));
  } catch {}
}

/* --------------------------- UI --------------------------- */

export default function BuilderDashboard() {
  const router = useRouter();
  const search = useMemo(
    () => new URLSearchParams(router.asPath.split('?')[1] ?? ''),
    [router.asPath]
  );
  const pathname = router.pathname;

  const [userId, setUserId] = useState<string>('');
  useEffect(() => {
    let unsub: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id || '');
      unsub = supabase.auth.onAuthStateChange(
        (_e, session) => setUserId(session?.user?.id || '')
      );
    })();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, []);

  const mode = (search.get('mode') === 'signin' ? 'signin' : 'signup') as
    | 'signup'
    | 'signin';
  const onboard = search.get('onboard') === '1';
  const forceOverlay = search.get('forceOverlay') === '1';
  const [welcomeOpen, setWelcomeOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;
    if (forceOverlay || (onboard && mode === 'signup')) setWelcomeOpen(true);
  }, [userId, forceOverlay, onboard, mode]);

  const closeWelcome = () => {
    setWelcomeOpen(false);
    try {
      localStorage.setItem(`user:${userId}:profile:completed`, '1');
    } catch {}
    const usp = new URLSearchParams(search.toString());
    usp.delete('onboard');
    usp.delete('mode');
    usp.delete('forceOverlay');
    router.replace(`${pathname}?${usp.toString()}`, undefined, {
      shallow: true,
    });
  };

  const rawStep = search.get('step');
  const step =
    rawStep && ['1', '2', '3', '4'].includes(rawStep) ? rawStep : null;

  const [query, setQuery] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [customizingId, setCustomizingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  const [loading, setLoading] = useState<{ on: boolean; msg?: string }>({
    on: false,
    msg: '',
  });

  const doPhase = async (msg: string, fn: () => Promise<void> | void) => {
    setLoading({ on: true, msg });
    try {
      await fn();
    } finally {
      setTimeout(() => setLoading({ on: false, msg: '' }), 420);
    }
  };

  useEffect(() => {
    setBots(loadBots());
    const onStorage = (e: StorageEvent) => {
      if (STORAGE_KEYS.includes(e.key || '')) setBots(loadBots());
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter((b) => b.name.toLowerCase().includes(q));
  }, [bots, query]);

  const selectedBot = useMemo(
    () => bots.find((b) => b.id === customizingId),
    [bots, customizingId]
  );
  const viewedBot = useMemo(
    () => bots.find((b) => b.id === viewId),
    [bots, viewId]
  );

  const setStep = (next: string | null) => {
    const usp = new URLSearchParams(search.toString());
    if (next) usp.set('step', next);
    else usp.delete('step');
    router.replace(`${pathname}?${usp.toString()}`, undefined, {
      shallow: true,
    });
  };

  /* --------- Fixed Shell: full width, no max-w cap --------- */
  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
      <main className="flex w-full min-h-screen items-start justify-start">
        <div className="w-full px-6 py-10">{children}</div>
      </main>
    </div>
  );

  if (step) {
    return (
      <Shell>
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 14, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.99 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="w-full"
          >
            {step === '1' && (
              <Step1AIType
                onNext={() =>
                  doPhase('Preparing model settings…', () => setStep('2'))
                }
              />
            )}
            {step === '2' && (
              <Step2ModelSettings
                onBack={() => doPhase('Going back…', () => setStep('1'))}
                onNext={() =>
                  doPhase('Opening prompt editor…', () => setStep('3'))
                }
              />
            )}
            {step === '3' && (
              <Step3PromptEditor
                onBack={() => doPhase('Returning to settings…', () =>
                  setStep('2')
                )}
                onNext={() =>
                  doPhase('Generating overview…', () => setStep('4'))
                }
              />
            )}
            {step === '4' && (
              <Step4Overview
                onBack={() => doPhase('Reopening prompt…', () => setStep('3'))}
                onFinish={() =>
                  doPhase('Finalizing build…', () => setStep(null))
                }
              />
            )}
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.div
        initial={{ opacity: 0, y: 14, scale: 0.99 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: [0.22, 0.61, 0.36, 1] }}
      >
        <div className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Builds</h1>
          <button
            onClick={() =>
              doPhase('Starting a new build…', () =>
                router.push('/builder?step=1')
              )
            }
            className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
          >
            Create a Build
          </button>
        </div>

        <div className="mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and builds…"
            className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-5 py-4 text-[15px] outline-none focus:border-[#00ffc2]"
          />
        </div>

        <motion.div
          layout
          className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7"
          transition={{ duration: 0.25 }}
        >
          <motion.div
            layout
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25, delay: 0.02 }}
          >
            <CreateCard
              onClick={() =>
                doPhase('Opening builder…', () =>
                  router.push('/builder?step=1')
                )
              }
            />
          </motion.div>

          {filtered.map((bot, i) => (
            <motion.div
              key={bot.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25, delay: 0.03 + i * 0.02 }}
            >
              <BuildCard
                bot={bot}
                accent={bot.appearance?.accent || accentFor(bot.id)}
                onOpen={() =>
                  doPhase('Opening prompt…', () => setViewId(bot.id))
                }
                onDelete={() =>
                  doPhase('Deleting build…', () => {
                    const next = bots.filter((b) => b.id !== bot.id);
                    const sorted = sortByNewest(next);
                    setBots(sorted);
                    saveBots(sorted);
                  })
                }
                onCustomize={() =>
                  doPhase('Loading customization…', () =>
                    setCustomizingId(bot.id)
                  )
                }
              />
            </motion.div>
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-white/60">
            No builds found. Click{' '}
            <span className="text-[#00ffc2]">Create a Build</span> to get
            started.
          </div>
        )}
      </motion.div>

      {/* Overlays */}
      <AnimatePresence>
        {selectedBot && !loading.on && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <CustomizeModal
              bot={selectedBot}
              onClose={() => setCustomizingId(null)}
              onApply={(ap) => {
                if (!customizingId) return;
                const next = bots.map((b) =>
                  b.id === customizingId
                    ? {
                        ...b,
                        appearance: { ...(b.appearance ?? {}), ...ap },
                        updatedAt: nowISO(),
                      }
                    : b
                );
                const sorted = sortByNewest(next);
                setBots(sorted);
                saveBots(sorted);
                setCustomizingId(null);
              }}
              onReset={() => {
                if (!customizingId) return;
                const next = bots.map((b) =>
                  b.id === customizingId
                    ? {
                        ...b,
                        appearance: undefined,
                        updatedAt: nowISO(),
                      }
                    : b
                );
                const sorted = sortByNewest(next);
                setBots(sorted);
                saveBots(sorted);
                setCustomizingId(null);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewedBot && !loading.on && (
          <motion.div
            key="promptOverlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <PromptOverlay bot={viewedBot} onClose={() => setViewId(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <OnboardingOverlay
        open={welcomeOpen}
        mode={mode}
        userId={userId}
        onDone={closeWelcome}
      />

      <AnimatePresence>
        {loading.on && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LoaderOverlay message={loading.msg} />
          </motion.div>
        )}
      </AnimatePresence>
    </Shell>
  );
}

/* --------------------------- Cards --------------------------- */

function CreateCard({ onClick }: { onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative h-[380px] rounded-[16px] p-7 flex flex-col items-center justify-center transition-all active:scale-[0.995]"
      style={{
        background: 'rgba(13,15,17,0.92)',
        border: '2px solid rgba(106,247,209,0.32)',
        boxShadow:
          'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
      }}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)',
          filter: 'blur(38px)',
        }}
      />
      {hover && (
        <div
          className="pointer-events-none absolute inset-0 rounded-[16px] animate-pulse"
          style={{
            boxShadow:
              '0 0 34px 10px rgba(106,247,209,0.25), inset 0 0 14px rgba(106,247,209,0.20)',
          }}
        />
      )}
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'rgba(0,0,0,0.18)',
          border: '2px dashed rgba(106,247,209,0.35)',
          boxShadow:
            'inset 0 0 18px rgba(0,0,0,0.45), inset 0 0 6px rgba(106,247,209,0.06)',
        }}
      >
        <Plus className="w-10 h-10" style={{ color: '#6af7d1', opacity: 0.9 }} />
      </div>
      <div className="text-[20px]">Create a Build</div>
      <div className="text-[13px] text-white/65 mt-2">
        Start building your AI assistant
      </div>
    </button>
  );
}

const palette = ['#6af7d1', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[
    Math.abs(
      [...id].reduce((h, c) => h + c.charCodeAt(0), 0) % palette.length
    )
  ];

function BuildCard({
  bot,
  accent,
  onOpen,
  onDelete,
  onCustomize,
}: {
  bot: Bot;
  accent: string;
  onOpen: () => void;
  onDelete: () => void;
  onCustomize: () => void;
}) {
  const [hover, setHover] = useState(false);
  const ap = bot.appearance || {};
  return (
    <motion.div
      className="relative h-[380px] rounded-[16px] p-0 flex flex-col justify-between group transition-all"
      style={{
        background: 'rgba(13,15,17,0.92)',
        border: '2px solid rgba(106,247,209,0.32)',
        boxShadow:
          'inset 0 0 22px rgba(0,0,0,0.28), 0 0 20px rgba(106,247,209,0.06)',
      }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 220, damping: 22 }}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
          filter: 'blur(38px)',
        }}
      />
      <div
        className="h-48 border-b border-white/10 overflow-hidden relative"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <button
          onClick={onCustomize}
          className="absolute right-3 top-3 z-10 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-[10px] text-xs border transition"
          style={{
            background: 'rgba(16,19,20,0.88)',
            border: '2px solid rgba(106,247,209,0.4)',
            boxShadow: '0 0 14px rgba(106,247,209,0.12)',
          }}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Customize
        </button>

        <ErrorBoundary
          fallback={
            <div
              className="h-full w-full"
              style={{
                background:
                  'linear-gradient(180deg, rgba(106,247,209,0.10), rgba(16,19,20,0.6))',
              }}
            />
          }
        >
          {/* @ts-ignore */}
          <Bot3D
            className="h-full"
            accent={ap.accent || accent}
            shellColor={ap.shellColor}
            bodyColor={ap.bodyColor}
            trimColor={ap.trimColor}
            faceColor={ap.faceColor}
            variant={ap.variant || 'silver'}
            eyes={ap.eyes || 'ovals'}
            head={ap.head || 'rounded'}
            torso={ap.torso || 'box'}
            arms={ap.arms ?? 'capsule'}
            legs={ap.legs ?? 'capsule'}
            antenna={
              ap.hasOwnProperty('antenna') ? Boolean((ap as any).antenna) : true
            }
            withBody={ap.hasOwnProperty('withBody') ? Boolean(ap.withBody) : true}
            idle={ap.hasOwnProperty('idle') ? Boolean(ap.idle) : hover}
          />
        </ErrorBoundary>
      </div>

      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-[10px] flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.15)',
              border: '2px solid rgba(106,247,209,0.32)',
            }}
          >
            <BotIcon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{bot.name}</div>
            <div className="text-[12px] text-white/60 truncate">
              {(bot.industry || '—') +
                (bot.language ? ` · ${bot.language}` : '')}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="ml-auto p-1.5 rounded-md hover:bg-[#ff4d4d14] transition"
            title="Delete build"
          >
            <Trash2 className="w-4 h-4 text-white/70 hover:text-[#ff7a7a]" />
          </button>
        </div>
        <div className="mt-4 flex items-end justify-between">
          <div className="text-[12px] text-white/50">
            Updated {fmtDate(bot.updatedAt || bot.createdAt)}
          </div>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] text-sm border transition hover:translate-y-[-1px]"
            style={{
              background: 'rgba(16,19,20,0.88)',
              border: '2px solid rgba(106,247,209,0.4)',
              boxShadow: '0 0 14px rgba(106,247,209,0.12)',
            }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
