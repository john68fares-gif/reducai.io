// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus, Bot as BotIcon, Phone, Trash2, ArrowRight, X, Edit3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Wizard steps
import StepProgress from '@/components/builder/StepProgress';
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3PromptA from '@/components/voice/steps/StepV3PromptA';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';

// Full-screen editor (make sure this file exists)
import VoiceAssistantEditor from '@/components/voice/VoiceAssistantEditor';

type Agent = {
  id: string;
  name: string;
  type?: string;
  language?: string;
  fromE164?: string;
  updatedAt?: string;
  createdAt?: string;
  industry?: string;
  model?: string;
  prompt?: string;
};

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  cardShadow:
    'inset 0 0 18px rgba(0,0,0,0.28), 0 0 16px rgba(106,247,209,0.05), 0 0 18px rgba(0,255,194,0.05)',
  orb: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)',
};

const nowISO = () => new Date().toISOString();
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');
const palette = ['#6af7d1', '#7cc3ff', '#b28bff', '#ffd68a', '#ff9db1'];
const accentFor = (id: string) =>
  palette[Math.abs([...id].reduce((h, c) => h + c.charCodeAt(0), 0)) % palette.length];

export default function VoiceAgentSection() {
  const [mode, setMode] = useState<'gallery' | 'wizard'>('gallery');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // editor state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingBot, setEditingBot] = useState<Agent | null>(null);

  // gallery data
  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem('chatbots');
        const arr = raw ? JSON.parse(raw) : [];
        const onlyVoice = Array.isArray(arr)
          ? arr.filter((b: any) => (b?.type || 'voice') === 'voice')
          : [];
        const mapped: Agent[] = onlyVoice.map((b: any) => ({
          id: b.id,
          name: b.name || 'Untitled',
          type: b.type || 'voice',
          language: b.language,
          fromE164: b.fromE164,
          updatedAt: b.updatedAt || b.createdAt || nowISO(),
          createdAt: b.createdAt || nowISO(),
          industry: b.industry,
          model: b.model,
          prompt: b.prompt,
        }));
        setAgents(mapped.sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!)));
      } catch {}
    };
    read();
    const onStorage = (e: StorageEvent) => e.key === 'chatbots' && read();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!editingId) { setEditingBot(null); return; }
    setEditingBot(agents.find(a => a.id === editingId) || null);
  }, [editingId, agents]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.fromE164 || '').toLowerCase().includes(q)
    );
  }, [agents, query]);

  const del = (id: string) => {
    try {
      const raw = localStorage.getItem('chatbots');
      const arr = raw ? JSON.parse(raw) : [];
      const next = arr.filter((b: any) => b.id !== id);
      localStorage.setItem('chatbots', JSON.stringify(next));
      setAgents((p) => p.filter((a) => a.id !== id));
    } catch {}
  };

  // wizard nav
  const startWizard = () => { setMode('wizard'); setStep(1); };
  const next = () => setStep((s) => Math.min(4, (s + 1) as any));
  const back = () => setStep((s) => Math.max(1, (s - 1) as any));
  const exitWizard = () => setMode('gallery');

  // ---------- WIZARD ----------
  if (mode === 'wizard') {
    return (
      <section className="w-full">
        <div className="w-full max-w-[1880px] mx-auto px-6 2xl:px-14 pt-8 pb-28">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="flex items-center justify-between mb-6"
          >
            <h1 className="text-2xl md:text-3xl font-semibold">Create Voice Agent</h1>
            <button
              onClick={exitWizard}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" /> Exit setup
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <StepProgress current={step} className="mb-10" />
          </motion.div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="s1"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <StepV1Basics onNext={next} />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div
                key="s2"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <StepV2Telephony onBack={back} onNext={next} />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div
                key="s3"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <StepV3PromptA onBack={back} onNext={next} />
              </motion.div>
            )}
            {step === 4 && (
              <motion.div
                key="s4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                <StepV4Overview onBack={back} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    );
  }

  // ---------- GALLERY ----------
  return (
    <section className="w-full">
      <div className="w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="flex items-center justify-between mb-7"
        >
          <h1 className="text-2xl md:text-3xl font-semibold">Voice Agents</h1>
          <button
            onClick={startWizard}
            className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
          >
            Create Voice Agent
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22 }}
          className="mb-8"
        >
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voice agents…"
            className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-5 py-4 text-[15px] outline-none focus:border-[#00ffc2]"
          />
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
          <CardShell>
            <CreateCard onClick={startWizard} />
          </CardShell>

          {filtered.map((a) => (
            <CardShell key={a.id}>
              <AgentCard
                agent={a}
                onDelete={() => del(a.id)}
                onOpen={() => setMode('wizard')}
                onEdit={() => setEditingId(a.id)}
              />
            </CardShell>
          ))}
        </div>

        {filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
            className="mt-12 text-center text-white/60"
          >
            No voice agents yet. Click <span className="text-[#00ffc2]">Create Voice Agent</span> to get started.
          </motion.div>
        )}
      </div>

      {/* Editor modal */}
      <AnimatePresence>
        {editingBot && (
          <VoiceAssistantEditor
            bot={editingBot as any}
            onClose={() => setEditingId(null)}
            onSaved={() => {
              try {
                const raw = localStorage.getItem('chatbots');
                const arr = raw ? JSON.parse(raw) : [];
                const onlyVoice = Array.isArray(arr)
                  ? arr.filter((b: any) => (b?.type || 'voice') === 'voice')
                  : [];
                const mapped: Agent[] = onlyVoice.map((b: any) => ({
                  id: b.id,
                  name: b.name || 'Untitled',
                  type: b.type || 'voice',
                  language: b.language,
                  fromE164: b.fromE164,
                  updatedAt: b.updatedAt || b.createdAt || nowISO(),
                  createdAt: b.createdAt || nowISO(),
                  industry: b.industry,
                  model: b.model,
                  prompt: b.prompt,
                }));
                setAgents(mapped.sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!)));
              } catch {}
              setEditingId(null);
            }}
          />
        )}
      </AnimatePresence>
    </section>
  );
}

/* ---------------------------- Cards ---------------------------- */

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.005 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22 }}
      className="relative rounded-[16px]"
      style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: UI.orb, filter: 'blur(36px)' }}
      />
      {children}
    </motion.div>
  );
}

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative h-[320px] rounded-[16px] p-7 flex flex-col items-center justify-center w-full active:scale-[0.995] transition-all"
    >
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'rgba(0,0,0,0.18)',
          border: '1px dashed rgba(106,247,209,0.35)',
          boxShadow:
            'inset 0 0 18px rgba(0,0,0,0.45), inset 0 0 6px rgba(106,247,209,0.06)',
        }}
      >
        <Plus className="w-10 h-10" style={{ color: '#6af7d1', opacity: 0.9 }} />
      </div>
      <div className="text-[18px]">Create Voice Agent</div>
      <div className="text-[13px] text-white/65 mt-2">Start a new call agent</div>
    </button>
  );
}

function AgentCard({
  agent,
  onDelete,
  onOpen,
  onEdit,
}: {
  agent: Agent;
  onDelete: () => void;
  onOpen: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="relative h-[320px] rounded-[16px] p-6 flex flex-col justify-between">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(106,247,209,0.28)' }}
        >
          <BotIcon className="w-5 h-5" style={{ color: accentFor(agent.id) }} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{agent.name}</div>
          <div className="text-[12px] text-white/60 truncate">
            {[agent.language, agent.fromE164].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>

        <button onClick={onDelete} className="ml-auto p-1.5 rounded-md hover:bg-[#ff4d4d14]" title="Delete">
          <Trash2 className="w-4 h-4 text-white/70 hover:text-[#ff7a7a]" />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[12px] text-white/50">Updated {fmt(agent.updatedAt)}</div>
        <div className="flex items-center gap-2">
          {agent.fromE164 && (
            <a
              href={`tel:${agent.fromE164}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm border"
              style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(0,255,194,0.06)' }}
            >
              <Phone className="w-4 h-4" /> Test
            </a>
          )}
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm border hover:translate-y-[-1px] transition"
            style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
            title="Edit"
          >
            <Edit3 className="w-4 h-4" /> Edit
          </button>
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm border hover:translate-y-[-1px] transition"
            style={{ borderColor: 'rgba(106,247,209,0.28)', background: 'rgba(16,19,20,0.90)' }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
