// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Bot as BotIcon, Phone, Trash2, ArrowRight, X } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

// Wizard pieces you already have
import StepProgress from '@/components/builder/StepProgress';
import StepV1Basics from '@/components/voice/steps/StepV1Basics';
import StepV2Telephony from '@/components/voice/steps/StepV2Telephony';
import StepV3PromptA from '@/components/voice/steps/StepV3PromptA';
import StepV4Overview from '@/components/voice/steps/StepV4Overview';

// New
import VoiceAssistantEditor from './VoiceAssistantEditor';

type Agent = {
  id: string;
  name: string;
  type?: 'voice' | 'text' | string;
  language?: string;
  fromE164?: string;       // phone number if attached
  updatedAt?: string;
  createdAt?: string;
  // any extras you keep
  twilioAccountSid?: string;
  twilioAuthToken?: string;
};

const UI = {
  cardBg: 'rgba(13,15,17,0.92)',
  cardShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 0 12px rgba(106,247,209,0.04)',
  borderThin: '1px solid rgba(106,247,209,0.18)',
};

const nowISO = () => new Date().toISOString();
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.18 },
};

export default function VoiceAgentSection() {
  const [mode, setMode] = useState<'gallery' | 'wizard' | 'editor'>('gallery');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);

  // --- storage helpers
  function readAll(): any[] {
    try { return JSON.parse(localStorage.getItem('chatbots') || '[]') || []; }
    catch { return []; }
  }
  function writeAll(next: any[]) {
    try { localStorage.setItem('chatbots', JSON.stringify(next)); } catch {}
  }
  function guessVoice(b: any) {
    // legacy records: treat as voice if any voice/telephony hint is present
    return !!(b?.fromE164 || b?.twilioNumber || b?.voice || b?.voiceModel || b?.twilioAccountSid);
  }

  useEffect(() => {
    const read = () => {
      const arr = readAll();
      // normalize: ensure voice builds have type:"voice"
      const migrated = Array.isArray(arr) ? arr.map((b: any) => {
        if (!b?.type && guessVoice(b)) return { ...b, type: 'voice' };
        return b;
      }) : [];

      if (migrated.length !== arr.length || JSON.stringify(migrated) !== JSON.stringify(arr)) {
        writeAll(migrated);
      }

      const onlyVoice = migrated.filter((b: any) => (b?.type || 'voice') === 'voice');

      setAgents(
        onlyVoice
          .map((b: any) => ({
            id: b.id,
            name: b.name || 'Untitled Voice Agent',
            type: 'voice',
            language: b.language,
            fromE164: b.fromE164,
            updatedAt: b.updatedAt || b.createdAt || nowISO(),
            createdAt: b.createdAt || nowISO(),
            twilioAccountSid: b.twilioAccountSid,
            twilioAuthToken: b.twilioAuthToken,
          }))
          .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!))
      );
    };

    read();
    const onStorage = (e: StorageEvent) => e.key === 'chatbots' && read();
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
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

  const del = (id: string) => {
    try {
      const arr = readAll();
      const next = arr.filter((b: any) => b.id !== id);
      writeAll(next);
      setAgents((p) => p.filter((a) => a.id !== id));
    } catch {}
  };

  // Wizard nav
  const startWizard = () => { setMode('wizard'); setStep(1); };
  const next = () => setStep((s) => Math.min(4, (s + 1) as any));
  const back = () => setStep((s) => Math.max(1, (s - 1) as any));
  const exitWizard = () => setMode('gallery');

  // Editor nav
  const openEditor = (id: string) => { setEditingId(id); setMode('editor'); };
  const closeEditor = () => { setEditingId(null); setMode('gallery'); };

  // ====== EDITOR MODE ======
  if (mode === 'editor' && editingId) {
    return <VoiceAssistantEditor agentId={editingId} onBack={closeEditor} />;
  }

  // ====== WIZARD MODE ======
  if (mode === 'wizard') {
    return (
      <section className="w-full">
        <div className="w-full max-w-[1840px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold">Create Voice Agent</h1>
            <button
              onClick={exitWizard}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10 transition"
            >
              <X className="w-4 h-4" /> Exit setup
            </button>
          </div>

          <StepProgress current={step} className="mb-8" />

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" {...fadeUp}>
                <StepV1Basics onNext={next} />
              </motion.div>
            )}
            {step === 2 && (
              <motion.div key="s2" {...fadeUp}>
                <StepV2Telephony onBack={back} onNext={next} />
              </motion.div>
            )}
            {step === 3 && (
              <motion.div key="s3" {...fadeUp}>
                <StepV3PromptA onBack={back} onNext={next} />
              </motion.div>
            )}
            {step === 4 && (
              <motion.div key="s4" {...fadeUp}>
                <StepV4Overview onBack={back} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
    );
  }

  // ====== GALLERY MODE ======
  return (
    <section className="w-full">
      <div className="w-full max-w-[1600px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
        <motion.div {...fadeUp} className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Voice Agents</h1>
          <button
            onClick={startWizard}
            className="px-4 py-2 rounded-[10px] bg-[#00ffc2] text-black font-semibold shadow-[0_0_10px_rgba(106,247,209,0.28)] hover:brightness-110 transition"
          >
            Create Voice Agent
          </button>
        </motion.div>

        <div className="mb-8">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search voice agents…"
            className="w-full rounded-[10px] bg-[#101314] text-white/95 border border-[#13312b] px-5 py-4 text-[15px] outline-none focus:border-[#00ffc2]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
          <CreateCard onClick={startWizard} />

          {filtered.map((a) => (
            <AgentCard
              key={a.id}
              agent={a}
              onDelete={() => del(a.id)}
              onOpen={() => openEditor(a.id)}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="mt-12 text-center text-white/60">
            No voice agents yet. Click <span className="text-[#00ffc2]">Create Voice Agent</span> to get started.
          </div>
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
      style={{ background: UI.cardBg, border: UI.borderThin, boxShadow: UI.cardShadow }}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(106,247,209,0.12) 0%, transparent 70%)',
          filter: 'blur(36px)',
        }}
      />
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'rgba(0,0,0,0.18)',
          border: '1px dashed rgba(106,247,209,0.35)',
          boxShadow: 'inset 0 0 18px rgba(0,0,0,0.45), inset 0 0 6px rgba(106,247,209,0.06)',
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
}: {
  agent: Agent;
  onDelete: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="relative h-[320px] rounded-[16px] p-6 flex flex-col justify-between"
      style={{ background: UI.cardBg, border: UI.borderThin, boxShadow: UI.cardShadow }}
    >
      <div
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(36px)' }}
      />

      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(106,247,209,0.28)' }}
        >
          <BotIcon className="w-5 h-5" />
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
          {/* Show Test only if a number exists */}
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
