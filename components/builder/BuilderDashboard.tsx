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
import { supabase } from '@/lib/supabase-client';
import { s } from '@/utils/safe';

const Bot3D = dynamic(() => import('./Bot3D.client'), { ssr: false });

type Bot = {
  id: string;
  name: string;
  industry?: string;
  language?: string;
  updatedAt?: string;
  appearance?: any;
};

const SAVE_KEY = 'chatbots';
const nowISO = () => new Date().toISOString();
const fmtDate = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

function loadBots(): Bot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}
function saveBots(bots: Bot[]) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(bots));
  } catch {}
}

export default function BuilderDashboard() {
  const router = useRouter();
  const [bots, setBots] = useState<Bot[]>([]);
  const [query, setQuery] = useState('');

  useEffect(() => {
    setBots(loadBots());
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? bots.filter((b) => b.name.toLowerCase().includes(q)) : bots;
  }, [bots, query]);

  return (
    <div className="min-h-screen w-full text-white font-movatif bg-[#0b0c10]">
      <main className="flex flex-col h-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-2xl font-semibold">Builds</h1>
          <button
            onClick={() => router.push('/builder?step=1')}
            className="px-4 py-2 rounded-lg bg-[#00ffc2] text-black font-semibold shadow hover:brightness-110 transition"
          >
            Create a Build
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search projects and builds…"
            className="w-full rounded-lg bg-[#101314] text-white/95 border border-[#13312b] px-4 py-2 text-sm outline-none focus:border-[#00ffc2]"
          />
        </div>

        {/* Grid */}
        <div className="grid flex-1 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[300px]">
          {/* Create card */}
          <CreateCard onClick={() => router.push('/builder?step=1')} />

          {filtered.map((bot) => (
            <BuildCard
              key={bot.id}
              bot={bot}
              onDelete={() => {
                const next = bots.filter((b) => b.id !== bot.id);
                setBots(next);
                saveBots(next);
              }}
              onOpen={() => router.push(`/builder/${bot.id}`)}
              onCustomize={() => console.log('Customize', bot.id)}
            />
          ))}
        </div>
      </main>
    </div>
  );
}

/* -------------------- Cards -------------------- */
function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-xl border border-[#13312b] bg-[#0d0f11] flex flex-col items-center justify-center hover:border-[#00ffc2] transition"
    >
      <Plus className="w-8 h-8 mb-3 text-[#6af7d1]" />
      <div className="text-base font-medium">Create a Build</div>
      <div className="text-xs text-white/60 mt-1">Start building your AI assistant</div>
    </button>
  );
}

function BuildCard({
  bot,
  onDelete,
  onOpen,
  onCustomize,
}: {
  bot: Bot;
  onDelete: () => void;
  onOpen: () => void;
  onCustomize: () => void;
}) {
  return (
    <div className="rounded-xl border border-[#13312b] bg-[#0d0f11] flex flex-col overflow-hidden">
      {/* Preview */}
      <div className="h-32 border-b border-[#13312b] relative">
        <button
          onClick={onCustomize}
          className="absolute right-2 top-2 text-xs bg-black/40 px-2 py-1 rounded hover:bg-black/60"
        >
          Customize
        </button>
        <Bot3D className="h-full" accent="#6af7d1" />
      </div>

      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-2">
          <BotIcon className="w-4 h-4 text-[#6af7d1]" />
          <span className="font-medium text-sm truncate">{bot.name}</span>
          <button
            onClick={onDelete}
            className="ml-auto text-xs text-red-400 hover:text-red-300"
          >
            Delete
          </button>
        </div>
        <div className="text-xs text-white/50 mt-1">Updated {fmtDate(bot.updatedAt)}</div>
        <button
          onClick={onOpen}
          className="mt-auto px-3 py-1.5 rounded text-xs border border-[#13312b] hover:border-[#00ffc2] transition"
        >
          Open
          <ArrowRight className="w-3 h-3 inline ml-1" />
        </button>
      </div>
    </div>
  );
}
