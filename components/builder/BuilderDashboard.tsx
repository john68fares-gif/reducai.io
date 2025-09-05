'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import CustomizeModal from './CustomizeModal';
import Step1AIType from './Step1AIType';
import Step2ModelSettings from './Step2ModelSettings';
import Step3PromptEditor from './Step3PromptEditor';
import Step4Overview from './Step4Overview';

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

const STORAGE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

// Helper to safely get data from localStorage
function safeGet<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

// Helper to safely set data in localStorage
function safeSet(key: string, value: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

// Load bots from localStorage
function loadBots(): Bot[] {
  return safeGet<Bot[]>(STORAGE_KEY, []);
}

// Save bots to localStorage
function saveBots(bots: Bot[]) {
  safeSet(STORAGE_KEY, bots);
}

// Sort bots by updatedAt (newest first)
function sortByNewest(arr: Bot[]) {
  return arr.slice().sort((a, b) => {
    const dateA = Date.parse(b.updatedAt || b.createdAt || '0');
    const dateB = Date.parse(a.updatedAt || a.createdAt || '0');
    return dateA - dateB;
  });
}

export default function BuilderDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawStep = searchParams.get('step');
  
  const step = rawStep && ['1', '2', '3', '4'].includes(rawStep) ? rawStep : null;
  const [query, setQuery] = useState('');
  const [bots, setBots] = useState<Bot[]>([]);
  const [customizingId, setCustomizingId] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);

  // Load bots on component mount and listen for storage changes
  useEffect(() => {
    setBots(loadBots());
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setBots(loadBots());
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const filteredBots = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return bots;
    return bots.filter(b => b.name.toLowerCase().includes(q));
  }, [bots, query]);

  const selectedBot = useMemo(() => 
    bots.find(b => b.id === customizingId), [bots, customizingId]);
  
  const viewedBot = useMemo(() => 
    bots.find(b => b.id === viewId), [bots, viewId]);

  const setStep = (next: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next) {
      params.set('step', next);
    } else {
      params.delete('step');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  const handleDeleteBot = (id: string) => {
    const updatedBots = bots.filter(b => b.id !== id);
    setBots(updatedBots);
    saveBots(updatedBots);
  };

  if (step) {
    return (
      <div className="min-h-screen w-full text-white bg-[#0b0c10]">
        <main className="w-full min-h-screen">
          {step === '1' && <Step1AIType onNext={() => setStep('2')} />}
          {step === '2' && (
            <Step2ModelSettings 
              onBack={() => setStep('1')} 
              onNext={() => setStep('3')} 
            />
          )}
          {step === '3' && (
            <Step3PromptEditor 
              onBack={() => setStep('2')} 
              onNext={() => setStep('4')} 
            />
          )}
          {step === '4' && (
            <Step4Overview 
              onBack={() => setStep('3')} 
              onFinish={() => setStep(null)} 
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full text-white bg-[#0b0c10]">
      <main className="flex-1 w-full px-4 sm:px-6 pt-10 pb-24">
        <div className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Builds</h1>
          <button
            onClick={() => setStep('1')}
            className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
          >
            Create a Build
          </button>
        </div>

        <div className="mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and builds..."
            className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-5 py-4 text-[15px] outline-none focus:border-[#00ffc2]"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
          <CreateCard onClick={() => setStep('1')} />
          {filteredBots.map((bot) => (
            <BuildCard
              key={bot.id}
              bot={bot}
              onOpen={() => setViewId(bot.id)}
              onDelete={() => handleDeleteBot(bot.id)}
              onCustomize={() => setCustomizingId(bot.id)}
            />
          ))}
        </div>

        {filteredBots.length === 0 && (
          <div className="mt-12 text-center text-white/60">
            No builds found. Click <span className="text-[#00ffc2]">Create a Build</span> to get started.
          </div>
        )}
      </main>

      {selectedBot && (
        <CustomizeModal
          bot={selectedBot}
          onClose={() => setCustomizingId(null)}
          onApply={(appearance) => {
            const updatedBots = bots.map(b => 
              b.id === customizingId 
                ? { ...b, appearance, updatedAt: nowISO() }
                : b
            );
            setBots(updatedBots);
            saveBots(updatedBots);
            setCustomizingId(null);
          }}
        />
      )}

      {viewedBot && (
        <PromptOverlay 
          bot={viewedBot} 
          onClose={() => setViewId(null)} 
        />
      )}
    </div>
  );
}

// Sub-components remain the same as in your original code
// CreateCard, BuildCard, PromptOverlay, etc.
// [Include the rest of your sub-components here]
