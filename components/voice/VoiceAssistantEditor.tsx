// components/voice/edit/VoiceAssistantEditor.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Save, Phone, Settings, Gauge, MessageSquare, Wand2 } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

type VoiceBot = {
  id: string;
  name: string;
  type: 'voice';
  // model
  provider?: 'openai';
  model?: string;
  temperature?: number;
  maxTokens?: number;
  firstMessage?: string;
  systemPrompt?: string;
  files?: string[];
  // voice
  voiceProvider?: 'vapi' | string;
  voiceName?: string;
  backgroundSound?: string;
  // telephony
  fromE164?: string;
  // transcriber
  sttProvider?: 'deepgram' | string;
  sttModel?: string;
  sttLang?: string;
  // misc
  updatedAt?: string;
  createdAt?: string;
};

const wrap = 'w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pt-8 pb-24';
const panel =
  'rounded-[16px] border border-white/10 bg-[rgba(11,12,14,0.82)] shadow-[0_10px_35px_rgba(0,0,0,0.35),_0_0_80px_rgba(0,255,194,0.05)]';

const TabBtn = ({ active, children, onClick }: any) => (
  <button
    onClick={onClick}
    className={`px-3 py-2 rounded-[10px] text-sm ${active ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white'}`}
  >
    {children}
  </button>
);

function loadAll(): any[] {
  try { return JSON.parse(localStorage.getItem('chatbots') || '[]') || []; } catch { return []; }
}
function saveAll(next: any[]) {
  try { localStorage.setItem('chatbots', JSON.stringify(next)); } catch {}
}

export default function VoiceAssistantEditor({
  agentId,
  onBack,
}: {
  agentId: string;
  onBack: () => void;
}) {
  const [bot, setBot] = useState<VoiceBot | null>(null);
  const [tab, setTab] = useState<'model' | 'voice' | 'transcriber' | 'tools' | 'analysis' | 'advanced' | 'widget'>('model');
  const [saved, setSaved] = useState<string>('');

  // hydrate
  useEffect(() => {
    const arr = loadAll();
    const found = arr.find((b: any) => b.id === agentId);
    if (found) {
      if (found.type !== 'voice') found.type = 'voice';
      setBot(found as VoiceBot);
    }
  }, [agentId]);

  const save = () => {
    if (!bot) return;
    const arr = loadAll();
    const idx = arr.findIndex((b: any) => b.id === bot.id);
    const next = { ...bot, type: 'voice', updatedAt: new Date().toISOString() };
    if (idx >= 0) arr[idx] = next; else arr.unshift(next);
    saveAll(arr);
    setSaved('Saved');
    setTimeout(() => setSaved(''), 1200);
  };

  if (!bot) {
    return (
      <section className={wrap}>
        <div className="text-white/70">Voice agent not found.</div>
      </section>
    );
  }

  return (
    <section className="w-full">
      <div className={wrap}>
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div>
            <div className="text-xs text-white/60 mb-1">Edit Assistant</div>
            <div className="flex items-baseline gap-3">
              <h1 className="text-[28px] md:text-[34px] font-semibold leading-none">
                {bot.name || 'Untitled'} <span className="text-white/50 ml-2">— Voice</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onBack}
              className="rounded-[10px] px-3 py-2 border border-white/15 text-white/85 hover:bg-white/10"
              title="Back to Voice Agents"
            >
              Back
            </button>
            <button
              onClick={save}
              className="rounded-[10px] px-3 py-2 bg-[#00ffc2] text-black font-semibold shadow-[0_0_12px_rgba(106,247,209,0.35)] hover:brightness-110"
            >
              Save
            </button>
            <button
              className="rounded-[10px] px-3 py-2 bg-white/10 border border-white/15 text-white/85"
              title="Publish (stub)"
            >
              Publish
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <TabBtn active={tab === 'model'} onClick={() => setTab('model')}>Model</TabBtn>
          <TabBtn active={tab === 'voice'} onClick={() => setTab('voice')}>Voice</TabBtn>
          <TabBtn active={tab === 'transcriber'} onClick={() => setTab('transcriber')}>Transcriber</TabBtn>
          <TabBtn active={tab === 'tools'} onClick={() => setTab('tools')}>Tools</TabBtn>
          <TabBtn active={tab === 'analysis'} onClick={() => setTab('analysis')}>Analysis</TabBtn>
          <TabBtn active={tab === 'advanced'} onClick={() => setTab('advanced')}>Advanced</TabBtn>
          <TabBtn active={tab === 'widget'} onClick={() => setTab('widget')}>Widget</TabBtn>
          {!!saved && <span className="ml-auto text-xs text-[#6af7d1]">{saved}</span>}
        </div>

        {/* Panels */}
        <AnimatePresence mode="wait">
          {tab === 'model' && (
            <motion.div key="model" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6 space-y-6`}>
                <Section title="Model">
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/70">Provider</label>
                      <select
                        value={bot.provider || 'openai'}
                        onChange={(e) => setBot({ ...bot, provider: e.target.value as any })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      >
                        <option value="openai">OpenAI</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/70">Model</label>
                      <select
                        value={bot.model || 'gpt-4o-mini'}
                        onChange={(e) => setBot({ ...bot, model: e.target.value })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      >
                        <option value="gpt-4o-mini">gpt-4o-mini</option>
                        <option value="gpt-4o">gpt-4o</option>
                        <option value="gpt-4.1">gpt-4.1</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/70">Temperature (0–1)</label>
                      <input
                        type="number" step="0.1" min={0} max={1}
                        value={bot.temperature ?? 0.5}
                        onChange={(e) => setBot({ ...bot, temperature: Number(e.target.value) })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70">Max Tokens</label>
                      <input
                        type="number"
                        value={bot.maxTokens ?? 400}
                        onChange={(e) => setBot({ ...bot, maxTokens: Number(e.target.value) })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      />
                    </div>
                  </div>
                </Section>

                <Section title="Messages">
                  <div className="grid gap-3">
                    <div>
                      <label className="text-xs text-white/70">First Message</label>
                      <input
                        value={bot.firstMessage ?? ''}
                        onChange={(e) => setBot({ ...bot, firstMessage: e.target.value })}
                        placeholder="Hello — thanks for calling…"
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70">System Prompt</label>
                      <textarea
                        rows={6}
                        value={bot.systemPrompt ?? ''}
                        onChange={(e) => setBot({ ...bot, systemPrompt: e.target.value })}
                        className="w-full rounded-[12px] bg-[#101314] border border-white/15 text-white px-3 py-2"
                        placeholder="Core behavior, rules, style…"
                      />
                    </div>
                  </div>
                </Section>
              </div>
            </motion.div>
          )}

          {tab === 'voice' && (
            <motion.div key="voice" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6 space-y-6`}>
                <Section title="Voice Configuration" icon={<Phone className="w-4 h-4" />}>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/70">Provider</label>
                      <select
                        value={bot.voiceProvider || 'vapi'}
                        onChange={(e) => setBot({ ...bot, voiceProvider: e.target.value as any })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      >
                        <option value="vapi">Vapi</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/70">Voice</label>
                      <input
                        value={bot.voiceName || 'Elliot'}
                        onChange={(e) => setBot({ ...bot, voiceName: e.target.value })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      />
                    </div>
                  </div>
                </Section>
              </div>
            </motion.div>
          )}

          {tab === 'transcriber' && (
            <motion.div key="stt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6 space-y-6`}>
                <Section title="Transcriber">
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs text-white/70">Provider</label>
                      <select
                        value={bot.sttProvider || 'deepgram'}
                        onChange={(e) => setBot({ ...bot, sttProvider: e.target.value as any })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      >
                        <option value="deepgram">Deepgram</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/70">Model</label>
                      <input
                        value={bot.sttModel || 'Nova-2'}
                        onChange={(e) => setBot({ ...bot, sttModel: e.target.value })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/70">Language</label>
                      <input
                        value={bot.sttLang || 'en'}
                        onChange={(e) => setBot({ ...bot, sttLang: e.target.value })}
                        className="w-full h-[42px] rounded-[12px] bg-[#101314] border border-white/15 text-white px-3"
                      />
                    </div>
                  </div>
                </Section>
              </div>
            </motion.div>
          )}

          {tab === 'tools' && (
            <motion.div key="tools" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6`}>
                <Section title="Tools">
                  <div className="text-white/70 text-sm">You can wire custom tools/functions here later.</div>
                </Section>
              </div>
            </motion.div>
          )}

          {tab === 'analysis' && (
            <motion.div key="analysis" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6`}>
                <Section title="Analysis">
                  <div className="text-white/70 text-sm">Summary / success rubric settings placeholder.</div>
                </Section>
              </div>
            </motion.div>
          )}

          {tab === 'advanced' && (
            <motion.div key="adv" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6`}>
                <Section title="Advanced">
                  <div className="text-white/70 text-sm">Privacy, start speaking plan, voicemail detection…</div>
                </Section>
              </div>
            </motion.div>
          )}

          {tab === 'widget' && (
            <motion.div key="widget" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
              <div className={`${panel} p-6`}>
                <Section title="Widget / Embed">
                  <code className="block text-xs text-white/80 bg-black/30 rounded-[12px] border border-white/10 p-3 overflow-x-auto">
{`<vapi-widget assistant-id="${bot.id}" public-key="YOUR_PUBLIC_KEY"></vapi-widget>
<script src="https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js" async></script>`}
                  </code>
                </Section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[14px] border border-white/10 bg-black/20">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
        {icon || <Settings className="w-4 h-4 text-white/70" />}
        <div className="text-white font-medium">{title}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
