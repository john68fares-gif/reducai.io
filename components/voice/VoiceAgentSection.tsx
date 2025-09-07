// components/voice/VoiceAgentSection.tsx
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
  assistantId?: string;
  name: string;
  type?: string;           // "voice"
  language?: string;
  fromE164?: string;
  updatedAt?: string;
  createdAt?: string;
};

const BTN_GREEN = '#10b981';
const BTN_GREEN_HOVER = '#0ea473';

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22 },
};

const nowISO = () => new Date().toISOString();
const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleDateString() : '');

/* -----------------------------------------------------------
   VoiceAgentSection  (logic unchanged)
----------------------------------------------------------- */
export default function VoiceAgentSection() {
  const [mode, setMode] = useState<'gallery' | 'wizard' | 'editor'>('gallery');
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [editingId, setEditingId] = useState<string>('');

  // ====== GALLERY DATA (merged Local + Cloud, like BuilderDashboard) ======
  const [query, setQuery] = useState('');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [confirmDelId, setConfirmDelId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ss = await scopedStorage();
      await ss.ensureOwnerGuard();
      await migrateLegacyKeysToUser();

      const readMerged = async () => {
        const localArr = (() => {
          try { return JSON.parse(localStorage.getItem('chatbots') || '[]') || []; }
          catch { return []; }
        })();
        const cloudArr = await ss.getJSON<any[]>('chatbots.v1', []);

        const pick = (arr: any[]) =>
          (Array.isArray(arr) ? arr : []).filter((b) => (b?.type || 'voice') === 'voice');

        const L = pick(localArr);
        const C = pick(cloudArr);

        const map = new Map<string, any>();
        const add = (b: any) => {
          const key = String(b.assistantId || b.id || '');
          if (!key) return;
          const cur = map.get(key);
          if (!cur) map.set(key, b);
          else {
            const tNew = Date.parse(b.updatedAt || b.createdAt || nowISO());
            const tOld = Date.parse(cur.updatedAt || cur.createdAt || nowISO());
            if (tNew >= tOld) map.set(key, b);
          }
        };

        L.forEach(add);
        C.forEach(add);

        const merged = Array.from(map.values())
          .map((b: any) => ({
            id: b.id || b.assistantId,
            assistantId: b.assistantId || b.id,
            name: b.name || 'Untitled',
            type: b.type || 'voice',
            language: b.language,
            fromE164: b.fromE164,
            updatedAt: b.updatedAt || b.createdAt || nowISO(),
            createdAt: b.createdAt || nowISO(),
          }))
          .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!));

        setAgents(merged);
      };

      await readMerged();

      const onStorage = (e: StorageEvent) => {
        if (!e.key) return;
        if (e.key.endsWith(':chatbots') || e.key === 'chatbots') {
          readMerged();
        }
      };
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

  const delEverywhere = async (assistantId: string) => {
    const ss = await scopedStorage();

    try {
      const cloud = await ss.getJSON<any[]>('chatbots.v1', []);
      await ss.setJSON('chatbots.v1', (Array.isArray(cloud) ? cloud : []).filter((b) => (b.assistantId || b.id) !== assistantId));
    } catch {}

    try {
      const local = JSON.parse(localStorage.getItem('chatbots') || '[]') || [];
      const nextLocal = (Array.isArray(local) ? local : []).filter((b) => (b.assistantId || b.id) !== assistantId);
      localStorage.setItem('chatbots', JSON.stringify(nextLocal));
    } catch {}

    setAgents((prev) => prev.filter((a) => (a.assistantId || a.id) !== assistantId));
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
          const cloudArr = await ss.getJSON<any[]>('chatbots.v1', []);
          const localArr = (() => {
            try { return JSON.parse(localStorage.getItem('chatbots') || '[]') || []; } catch { return []; }
          })();

          const pick = (arr: any[]) => (Array.isArray(arr) ? arr : []).filter((b) => (b?.type || 'voice') === 'voice');
          const L = pick(localArr);
          const C = pick(cloudArr);

          const map = new Map<string, any>();
          const add = (b: any) => {
            const key = String(b.assistantId || b.id || '');
            if (!key) return;
            const cur = map.get(key);
            if (!cur) map.set(key, b);
            else {
              const tNew = Date.parse(b.updatedAt || b.createdAt || nowISO());
              const tOld = Date.parse(cur.updatedAt || cur.createdAt || nowISO());
              if (tNew >= tOld) map.set(key, b);
            }
          };
          L.forEach(add);
          C.forEach(add);

          const merged = Array.from(map.values())
            .map((b: any) => ({
              id: b.id || b.assistantId,
              assistantId: b.assistantId || b.id,
              name: b.name || 'Untitled',
              type: b.type || 'voice',
              language: b.language,
              fromE164: b.fromE164,
              updatedAt: b.updatedAt || b.createdAt || nowISO(),
              createdAt: b.createdAt || nowISO(),
            }))
            .sort((a, b) => Date.parse(b.updatedAt!) - Date.parse(a.updatedAt!));

          setAgents(merged);
        }}
      />
    );
  }

  // ====== WIZARD ======
  if (mode === 'wizard') {
    return (
      <section className="w-full voice-scope" style={{ color: 'var(--text)' }}>
        <div className="w-full max-w-[1840px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl md:text-3xl font-semibold">Create Voice Agent</h1>
            <button
              onClick={exitWizard}
              className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 transition hover:-translate-y-[1px]"
              style={{
                background: 'var(--va-card-bg)',
                border: '1px solid var(--va-border)',
                // EXPLICIT SHADOW
                boxShadow: 'var(--va-soft-shadow)',
                color: 'var(--text)',
              }}
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
    <section className="w-full voice-scope" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
      <div className="w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pt-8 pb-24">
        <motion.div {...fadeUp} className="flex items-center justify-between mb-7">
          <h1 className="text-2xl md:text-3xl font-semibold">Voice Agents</h1>
          <button
            onClick={startWizard}
            className="px-4 h-[42px] rounded-[12px] font-semibold transition hover:-translate-y-[1px]"
            style={{ background: BTN_GREEN, color: '#fff' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
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
              className="w-full rounded-[12px] px-5 h-[46px] text-[15px] outline-none"
              style={{
                background: 'var(--va-input-bg)',
                border: '1px solid var(--va-border)',
                color: 'var(--text)',
                // EXPLICIT INPUT SHADOW
                boxShadow: 'var(--va-input-shadow)',
              }}
            />
            <Search className="w-4 h-4 absolute right-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          </div>
        </motion.div>

        <motion.div {...fadeUp} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
          <CreateCard onClick={startWizard} />

          {filtered.map((a) => (
            <AgentCard
              key={a.assistantId || a.id}
              agent={a}
              onDelete={() => setConfirmDelId(String(a.assistantId || a.id))}
              onOpen={() => openEditor(String(a.id))}
            />
          ))}
        </motion.div>

        {filtered.length === 0 && (
          <motion.div {...fadeUp} className="mt-12 text-center" style={{ color: 'var(--text-muted)' }}>
            No voice agents yet. Click <span style={{ color: 'var(--brand)' }}>Create Voice Agent</span> to get started.
          </motion.div>
        )}
      </div>

      <ConfirmDelete
        open={!!confirmDelId}
        onCancel={() => setConfirmDelId(null)}
        onConfirm={async () => {
          if (confirmDelId) await delEverywhere(confirmDelId);
          setConfirmDelId(null);
        }}
      />

      {/* THE IMPORTANT PART: real, explicit shadows + glow vars */}
      <style jsx global>{`
        /* LIGHT (default) — explicit large soft shadows + brand ring */
        .voice-scope {
          --va-card-bg: #ffffff;
          --va-panel: #ffffff;
          --va-border: rgba(0,0,0,0.10);

          /* Strong visible drop shadows + faint neon ring */
          --va-soft-shadow:
            0 28px 70px rgba(0,0,0,.12),
            0 10px 26px rgba(0,0,0,.08),
            0 0 0 1px rgba(0,255,194,.06);

          --va-ring: rgba(0,255,194,.12);

          --va-input-bg: #ffffff;
          --va-input-shadow:
            inset 0 1px 0 rgba(255,255,255,.8),
            0 10px 22px rgba(0,0,0,.06);

          --va-chip-bg: rgba(0,255,194,0.06);
          --va-chip-border: rgba(0,255,194,0.18);
        }

        /* DARK — stronger drops + inner line */
        [data-theme="dark"] .voice-scope {
          --va-card-bg:
            radial-gradient(120% 180% at 50% -40%, rgba(0,255,194,.06) 0%, rgba(12,16,18,1) 42%),
            linear-gradient(180deg, #0e1213 0%, #0c1012 100%);
          --va-panel: linear-gradient(180deg, rgba(24,32,31,.86) 0%, rgba(16,22,21,.86) 100%);
          --va-border: rgba(255,255,255,0.08);

          --va-soft-shadow:
            0 36px 90px rgba(0,0,0,.60),
            0 14px 34px rgba(0,0,0,.45),
            0 0 0 1px rgba(0,255,194,.10);

          --va-ring: rgba(0,255,194,.10);

          --va-input-bg: rgba(255,255,255,.02);
          --va-input-shadow:
            inset 0 1px 0 rgba(255,255,255,.04),
            0 12px 30px rgba(0,0,0,0.38);

          --va-chip-bg: rgba(0,255,194,0.10);
          --va-chip-border: rgba(0,255,194,0.22);
        }
      `}</style>
    </section>
  );
}

/* ---------------------------- Cards (with explicit shadows & glow) ---------------------------- */

function CreateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="group relative h-[320px] rounded-[16px] p-7 flex flex-col items-center justify-center transition-all active:scale-[0.995] hover:-translate-y-[1px]"
      style={{
        background: 'var(--va-card-bg)',
        border: '1px solid var(--va-border)',
        boxShadow: 'var(--va-soft-shadow)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* radial brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--va-ring) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-5"
        style={{
          background: 'var(--va-panel)',
          border: '1px dashed var(--brand-weak)',
          boxShadow: 'var(--va-soft-shadow)',
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
      className="relative h-[320px] rounded-[16px] p-6 flex flex-col justify-between hover:-translate-y-[1px] transition"
      style={{
        background: 'var(--va-card-bg)',
        border: '1px solid var(--va-border)',
        // EXPLICIT drop shadow here too
        boxShadow: 'var(--va-soft-shadow)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* radial brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full"
        style={{
          background: 'radial-gradient(circle, var(--va-ring) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />

      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center"
          style={{ background: 'var(--va-panel)', border: '1px solid var(--brand-weak)', boxShadow: 'var(--va-soft-shadow)' }}
        >
          <BotIcon className="w-5 h-5" style={{ color: 'var(--text)' }} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">{agent.name}</div>
          <div className="text-[12px] truncate" style={{ color: 'var(--text-muted)' }}>
            {[agent.language, agent.fromE164].filter(Boolean).join(' · ') || '—'}
          </div>
        </div>
        <button onClick={onDelete} className="ml-auto p-1.5 rounded-md hover:opacity-80" title="Delete" aria-label="Delete">
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
              style={{
                border: '1px solid var(--brand-weak)',
                background: 'var(--va-card-bg)',
                boxShadow: 'var(--va-soft-shadow)',
                color: 'var(--text)',
              }}
            >
              <Phone className="w-4 h-4" /> Test
            </a>
          )}
          <button
            onClick={onOpen}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm transition hover:-translate-y-[1px]"
            style={{
              border: '1px solid var(--brand-weak)',
              background: 'var(--va-panel)',
              boxShadow: 'var(--va-soft-shadow)',
              color: 'var(--text)',
            }}
          >
            Open <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- Confirm Delete ---------------------------- */

function ConfirmDelete({
  open, onCancel, onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] grid place-items-center px-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div
        className="w-full max-w-[560px] rounded-[20px] overflow-hidden animate-[popIn_140ms_ease]"
        style={{
          background: 'var(--va-card-bg)',
          border: '1px solid var(--va-border)',
          // visible modal shadow
          boxShadow: '0 32px 90px rgba(0,0,0,.55), 0 12px 28px rgba(0,0,0,.35), 0 0 0 1px rgba(0,255,194,.08)',
          position: 'relative',
        }}
      >
        {/* subtle ring glow on modal */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-[30%] -left-[30%] w-[70%] h-[70%] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--va-ring) 0%, transparent 70%)', filter: 'blur(42px)' }}
        />
        <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--va-border)' }}>
          <div className="text-lg font-semibold" style={{ color: 'var(--text)' }}>Delete Voice Agent?</div>
          <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            This will remove the agent from your Local + Cloud workspace storage. Calls or external numbers aren’t affected.
          </div>
        </div>
        <div className="px-6 py-5 flex gap-3">
          <button
            onClick={onCancel}
            className="w-full h-[44px] rounded-[14px] font-semibold"
            style={{ background: 'var(--va-panel)', border: '1px solid var(--va-border)', color: 'var(--text)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="w-full h-[44px] rounded-[14px] font-semibold text-white"
            style={{ background: BTN_GREEN }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
          >
            Delete
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes popIn { 0% { opacity: 0; transform: scale(.98); } 100% { opacity: 1; transform: scale(1); } }
      `}</style>
    </div>
  );
}
