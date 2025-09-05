'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Bot as BotIcon, Phone, Trash2, ArrowRight, X, Search } from 'lucide-react';

import StepProgress from '@/components/builder/StepProgress';
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3PromptA from '@/components/voice/steps/StepV3PromptA';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';
import VoiceAssistantEditor from '@/components/voice/VoiceAssistantEditor';

import { scopedStorage, migrateLegacyKeysToUser } from '@/utils/scoped-storage';

type Agent = {
  id: string;
  name: string;
  type?: string;           // "voice"
  language?: string;
  fromE164?: string;
  updatedAt?: string;
  createdAt?: string;
};

const UI = {
  cardBg: 'var(--card)',
  border: '1px solid var(--border)',
  cardShadow: 'var(--shadow-card)',
};

const nowISO = () => new Date().toISOString();
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22 },
};

export default function VoiceAgentSection() {
  const [mode, setMode] = useState<'gallery' | 'wizard' | 'editor'>('gallery');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingId, setEditingId] = useState<string>('');

  // ====== GALLERY DATA (per-account storage) ======
  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      await migrateLegacyKeysToUser();

      const read = async () => {
        const arr = await ss.getJSON<any[]>('chatbots', []);
        const onlyVoice = Array.isArray(arr)
          ? arr.filter((b: any) => (b?.type || 'voice') === 'voice')
          : [];
        setAgents(
          onlyVoice
            .map((b: any) => ({
              id: b.id,
              name: b.name || 'Untitled',
              type: b.type || 'voice',
              language: b.language,
              fromE164: b.fromE164,
              updatedAt: b.updatedAt || b.createdAt || nowISO(),
              createdAt: b.createdAt || nowISO(),
            }))
            .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!))
        );
      };

      await read();
      const onStorage = (e: StorageEvent) => e.key?.endsWith(':chatbots') && read();
      window.addEventListener('storage', onStorage);
      return () => window.removeEventListener('storage', onStorage);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return agents;
    return agents.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        (a.fromE164 || '').toLowerCase().includes(q)
    );
  }, [agents, query]);

  const del = async (id: string) => {
    const ss = await scopedStorage();
    const arr = await ss.getJSON<any[]>('chatbots', []);
    const next = arr.filter((b: any) => b.id !== id);
    await ss.setJSON('chatbots', next);
    setAgents((p) => p.filter((a) => a.id !== id));
  };

  // ====== NAV ======
  const startWizard = () => { setMode('wizard'); setStep(1); };
  const next = () => setStep((s) => Math.min(4, (s + 1) as any));
  const back = () => setStep((s) => Math.max(1, (s - 1) as any));
  const exitWizard = () => setMode('gallery');

  const openEditor = (id: string) => { setEditingId(id); setMode('editor'); };
  const exitEditor  = () => { setEditingId(''); setMode('gallery'); };

  // ====== EDITOR ======
  if (mode === 'editor' && editingId) {
    return (
      <VoiceAssistantEditor
        id={editingId}
        onExit={exitEditor}
        onSaved={async () => {
          const ss = await scopedStorage();
          const arr = await ss.getJSON<any[]>('chatbots', []);
          const onlyVoice = Array.isArray(arr)
            ? arr.filter((b: any) => (b?.type || 'voice') === 'voice')
            : [];
          setAgents(
            onlyVoice
              .map((b: any) => ({
                id: b.id,
                name: b.name || 'Untitled',
                type: b.type || 'voice',
                language: b.language,
                fromE164: b.fromE164,
                updatedAt: b.updatedAt || b.createdAt || nowISO(),
                createdAt: b.createdAt || nowISO(),
              }))
              .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!))
          );
        }}
      />
    );
  }

  // ====== WIZARD ======
  if (mode === 'wizard') {
    return (
      <section className="w-full" style={{ color: 'var(--text)' }}>
        <div className="w-full max-w-[1840px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold">Create Voice Agent</h1>
            <button
              onClick={exitWizard}
              className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 btn-ghost hover:translate-y-[-1px] transition"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <X className="w-4 h-4" /> Exit setup
            </button>
          </div>

          <StepProgress current={step} className="mb-8" />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.20 }}>
                <StepV1Basics onNext={next} />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.20 }}>
                <StepV2Telephony onBack={back} onNext={next} />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.20 }}>
                <StepV3PromptA onBack={back} onNext={next} />
              </motion.div>
            )}
            {step === 4 && (
              <motion.div key="s4" initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-10 }} transition={{ duration:0.20 }}>
                <StepV4Overview onBack={back} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    );
  }

  // ====== GALLERY ======
  return (
    <section className="w-full" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
        <motion.div {...fadeUp} className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Voice Agents</h1>
          <button
            onClick={startWizard}
            className="px-4 py-2 rounded-[10px] btn-brand font-semibold shadow-[0_0_10px_var(--ring)] hover:brightness-110 transition"
          >
            Create Voice Agent
          </button>
        </motion.div>

        <motion.div {...fadeUp} className="mb-8">
          <div className="relative">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search voice agents…"
              className="w-full rounded-[10px] input px-5 py-4 text-[15px] outline-none focus:ring-2"
              style={{ boxShadow: 'none' }}
            />
            <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
          <CreateCard onClick={startWizard} />

          {filtered.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              onDelete={() => del(a.id)}
              onOpen={() => openEditor(a.id)}
            />
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <motion.div {...fadeUp} className="mt-12 text-center" style={{ color: 'var(--text-muted)' }}>
            No voice agents yet. Click <span style={{ color: 'var(--brand)' }}>Create Voice Agent</span> to get started.
          </motion.div>
        )}
      </div>
    </section>
  );
}

/* ---------------------------- Cards ---------------------------- */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative h-[320px] rounded-[16px] p-7 flex flex-col items-center justify-center transition-all active:scale-[0.995]"
      style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--brand-weak) 0%, transparent 70%)',
          filter: 'blur(36px)',
        }}
      />
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'var(--panel)',
          border: '1px dashed var(--brand-weak)',
          boxShadow: 'var(--shadow-soft)',
        }}
      >
        <Plus className="w-10 h-10" style={{ color: 'var(--brand)' }} />
      </div>
      <div className="text-[18px]">Create Voice Agent</div>
      <div className="text-[13px]" style={{ color: 'var(--text-muted)', marginTop: 8 }}>Start a new call agent</div>
    </button>
  );
}

function AgentCard({
  agent, onDelete, onOpen,
}: {
  agent: Agent;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="relative h-[320px] rounded-[16px] p-6 flex flex-col justify-between"
      style={{ background: UI.cardBg, border: UI.border, boxShadow: UI.cardShadow }}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle, var(--brand-weak) 0%, transparent 70%)', filter: 'blur(36px)' }}
      />

      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center"
          style={{ background: 'var(--panel)', border: '1px solid var(--brand-weak)' }}
        >
          <BotIcon className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{agent.name}</div>
          <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
            {[agent.language, agent.fromE164].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <button onClick={onDelete} className="ml-auto p-1.5 rounded-md hover:opacity-80" title="Delete">
          <Trash2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Updated {fmt(agent.updatedAt)}</div>
        <div className="flex items-center gap-2">
          {agent.fromE164 && (
            <a
              href={`tel:${agent.fromE164}`}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm"
              style={{ border: '1px solid var(--brand-weak)', background: 'var(--card)' }}
            >
              <Phone className="w-4 h-4" /> Test
            </a>
          )}
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm hover:translate-y-[-1px] transition"
            style={{ border: '1px solid var(--brand-weak)', background: 'var(--panel)' }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
