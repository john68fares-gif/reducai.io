'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Save, Rocket, Cpu, FileText, KeyRound, Waves, Music, Mic, Settings2,
  Landmark, ListChecks, MessageSquareText, Shield, Timer, Gauge, ChevronDown,
} from 'lucide-react';
import { motion } from 'framer-motion';

/* =========================== STYLE =========================== */
const WRAP = 'w-full max-w-[1720px] mx-auto px-6 2xl:px-12 pt-10 pb-28';
const CARD: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)', // thin
  borderRadius: 28,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)',
};
const INNER: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.28)',
  borderRadius: 18,
  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)',
};
const ORB = { background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(36px)' };

type Props = { id: string; onExit: () => void; onSaved?: () => void };

type Bot = {
  id: string;
  name: string;
  type?: string;
  industry?: string;
  language?: string;
  model?: string;
  prompt?: string;
  fromE164?: string;
  updatedAt?: string;
  createdAt?: string;
  config?: any;
};

/* ======================== HELPERS ======================== */
function safeParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function assignPath(obj: any, path: string, value: any) {
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!cur[k] || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
const num = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);

/* ======================== ATOMS ======================== */
function Section({ title, icon, children, id }: { title: string; icon?: React.ReactNode; children: React.ReactNode; id: string }) {
  return (
    <motion.section
      id={id}
      style={CARD}
      className="rounded-[28px] p-6 md:p-7 relative"
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.22 }}
    >
      <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB} />
      <div className="flex items-center gap-2 mb-5 text-white/90 font-semibold">
        {icon}{title}
      </div>
      <div className="grid gap-5">{children}</div>
    </motion.section>
  );
}
function Row({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={INNER} className="rounded-[18px] p-4 md:p-5">
      <div className="flex items-center gap-2 text-white/90 font-semibold mb-3">{icon}{label}</div>
      {children}
    </div>
  );
}
const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 outline-none focus:border-[#00ffc2] ${p.className||''}`} />;
const Text = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={`w-full px-3 py-3 rounded-[10px] bg-[#0b0e0f] border border-white/10 outline-none focus:border-[#00ffc2] ${p.className||''}`} />;
const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className={`w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 outline-none focus:border-[#00ffc2] ${p.className||''}`} />;
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full relative transition ${checked ? 'bg-emerald-400/80' : 'bg-white/10'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}

/* ======================== COMPONENT ======================== */
export default function VoiceAssistantEditor({ id, onExit, onSaved }: Props) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const arr = safeParse<Bot[]>(localStorage.getItem('chatbots'), []);
    const found = arr.find((b) => String(b?.id) === String(id));
    if (!found) { setBot(null); return; }
    setBot({
      id: String(found.id),
      name: found.name || 'Untitled',
      type: found.type || 'voice',
      industry: found.industry || '',
      language: found.language || 'English',
      model: found.model || 'gpt-4o-mini',
      prompt: found.prompt || '',
      fromE164: found.fromE164 || '',
      updatedAt: found.updatedAt || found.createdAt || new Date().toISOString(),
      createdAt: found.createdAt || new Date().toISOString(),
      config: { ...(found.config || {}) },
    });
  }, [id]);

  const cfg = useMemo(() => bot?.config || {}, [bot]);

  const setCfg = (path: string, value: any) => {
    setBot((prev) => {
      if (!prev) return prev;
      const c = { ...(prev.config || {}) };
      assignPath(c, path, value);
      return { ...prev, config: c };
    });
  };

  const save = async () => {
    if (!bot) return;
    setSaving(true);
    try {
      const arr = safeParse<Bot[]>(localStorage.getItem('chatbots'), []);
      const i = arr.findIndex((b) => String(b?.id) === String(bot.id));
      if (i !== -1) {
        arr[i] = { ...arr[i], ...bot, updatedAt: new Date().toISOString() };
        localStorage.setItem('chatbots', JSON.stringify(arr));
      }
      onSaved?.();
    } finally { setSaving(false); }
  };

  if (!bot) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-white font-movatif">
        <div className={WRAP}>
          <button onClick={onExit} className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="mt-8" style={CARD}>
            <div className="p-6">Agent not found or data is corrupted.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white font-movatif">
      <div className={WRAP}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
          className="flex items-center justify-between mb-8"
        >
          <div className="min-w-0">
            <div className="text-xs text-white/60">Edit Assistant</div>
            <h1 className="text-2xl md:text-3xl font-semibold truncate">{bot.name} <span className="text-white/50">— Voice</span></h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExit} className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={save} className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 font-semibold" style={{ background:'#59d9b3', color:'#0b0c10' }}>
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => {}} className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 font-semibold border border-[#2b6] hover:bg-white/10">
              <Rocket className="w-4 h-4" /> Publish
            </button>
          </div>
        </motion.div>

        {/* Top metrics (Cost / Latency) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div style={CARD} className="rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-white/80 mb-2"><Gauge className="w-4 h-4 text-[#6af7d1]" /> Cost</div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-3/4 rounded-full" style={{ background:'#6af7d1' }} />
            </div>
            <div className="text-xs text-white/60 mt-2">~$0.1 / min</div>
          </div>
          <div style={CARD} className="rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-white/80 mb-2"><Timer className="w-4 h-4 text-[#6af7d1]" /> Latency</div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full w-[82%] rounded-full" style={{ background:'#6af7d1' }} />
            </div>
            <div className="text-xs text-white/60 mt-2">~1050 ms</div>
          </div>
        </div>

        {/* === MODEL === */}
        <Section id="model" title="Model" icon={<Cpu className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Provider & Model" icon={<Cpu className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Provider</div>
                <Select value={String(cfg.model?.provider ?? 'openai')} onChange={e=>setCfg('model.provider', e.target.value)}>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="google">Google</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Model</div>
                <Select value={String(cfg.model?.name ?? 'gpt-4o-cluster')} onChange={e=>setCfg('model.name', e.target.value)}>
                  <option value="gpt-4o-cluster">GPT 4o Cluster</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">First Message Mode</div>
                <Select value={String(cfg.model?.firstMode ?? 'assistant_first')} onChange={e=>setCfg('model.firstMode', e.target.value)}>
                  <option value="assistant_first">Assistant speaks first</option>
                  <option value="user_first">User speaks first</option>
                </Select>
              </div>
            </div>
          </Row>

          <Row label="First Message" icon={<MessageSquareText className="w-4 h-4 text-[#6af7d1]" />}>
            <Input value={String(cfg.model?.firstMessage ?? 'Hello.')} onChange={e=>setCfg('model.firstMessage', e.target.value)} />
          </Row>

          <Row label="System Prompt" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={10} placeholder="This is a blank template…" value={String(cfg.model?.systemPrompt ?? bot.prompt ?? '')} onChange={e=>setCfg('model.systemPrompt', e.target.value)} />
          </Row>

          <Row label="Limits" icon={<KeyRound className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Max Tokens</div>
                <Input type="number" value={num(cfg.model?.maxTokens, 250)} onChange={e=>setCfg('model.maxTokens', clamp(num(e.target.value,250), 1, 4000))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Temperature</div>
                <Input type="number" step="0.1" value={num(cfg.model?.temperature, 0.5)} onChange={e=>setCfg('model.temperature', clamp(Number(e.target.value||0), 0, 2))} />
              </div>
            </div>
          </Row>
        </Section>

        {/* spacing */}
        <div className="h-6" />

        {/* === VOICE === */}
        <Section id="voice" title="Voice" icon={<Waves className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Voice Configuration" icon={<Waves className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Provider</div>
                <Select value={String(cfg.voice?.provider ?? 'vapi')} onChange={e=>setCfg('voice.provider', e.target.value)}>
                  <option value="vapi">Vapi</option>
                  <option value="polly">Amazon Polly</option>
                  <option value="11labs">ElevenLabs</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Voice</div>
                <Select value={String(cfg.voice?.name ?? 'Elliot')} onChange={e=>setCfg('voice.name', e.target.value)}>
                  <option value="Elliot">Elliot</option>
                  <option value="Joanna">Joanna</option>
                  <option value="Alloy">Alloy</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Toggle label="Background Denoising" checked={!!cfg.voice?.denoise} onChange={v=>setCfg('voice.denoise', v)} />
              </div>
            </div>
          </Row>

          <Row label="Additional Configuration" icon={<Music className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Background Sound</div>
                <Select value={String(cfg.voice?.bgPreset ?? 'default')} onChange={e=>setCfg('voice.bgPreset', e.target.value)}>
                  <option value="default">Default</option>
                  <option value="office">Office</option>
                  <option value="lounge">Lounge</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Background Sound URL</div>
                <Input placeholder="https://…" value={String(cfg.voice?.bgUrl ?? '')} onChange={e=>setCfg('voice.bgUrl', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Input Min Characters</div>
                <Input type="number" value={num(cfg.voice?.minChars, 30)} onChange={e=>setCfg('voice.minChars', clamp(num(e.target.value, 30), 0, 200))} />
              </div>
            </div>
          </Row>
        </Section>

        <div className="h-6" />

        {/* === TRANSCRIBER === */}
        <Section id="transcriber" title="Transcriber" icon={<Mic className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Provider & Model" icon={<Mic className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Provider</div>
                <Select value={String(cfg.asr?.provider ?? 'deepgram')} onChange={e=>setCfg('asr.provider', e.target.value)}>
                  <option value="deepgram">Deepgram</option>
                  <option value="openai">OpenAI</option>
                  <option value="google">Google</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Language</div>
                <Input value={String(cfg.asr?.language ?? 'En')} onChange={e=>setCfg('asr.language', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Model</div>
                <Select value={String(cfg.asr?.model ?? 'nova-2')} onChange={e=>setCfg('asr.model', e.target.value)}>
                  <option value="nova-2">Nova 2</option>
                  <option value="whisper-1">Whisper 1</option>
                </Select>
              </div>
            </div>
          </Row>

          <Row label="Options" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Toggle label="Background Denoising Enabled" checked={!!cfg.asr?.denoise} onChange={v=>setCfg('asr.denoise', v)} />
              <div>
                <div className="text-xs text-white/60 mb-1">Confidence Threshold</div>
                <Input type="number" step="0.05" value={num(cfg.asr?.threshold, 0.4)} onChange={e=>setCfg('asr.threshold', clamp(Number(e.target.value||0), 0, 1))} />
              </div>
              <Toggle label="Use Numerals" checked={!!cfg.asr?.numerals} onChange={v=>setCfg('asr.numerals', v)} />
            </div>
          </Row>
        </Section>

        <div className="h-6" />

        {/* === TOOLS === */}
        <Section id="tools" title="Tools" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Predefined Functions" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Toggle label="Enable End Call Function" checked={!!cfg.tools?.endCall} onChange={v=>setCfg('tools.endCall', v)} />
              <Toggle label="Dial Keypad" checked={!!cfg.tools?.keypad} onChange={v=>setCfg('tools.keypad', v)} />
              <div>
                <div className="text-xs text-white/60 mb-1">Forwarding Phone Number</div>
                <Input placeholder="+1…" value={String(cfg.tools?.forwardE164 ?? '')} onChange={e=>setCfg('tools.forwardE164', e.target.value)} />
              </div>
            </div>
          </Row>
        </Section>

        <div className="h-6" />

        {/* === ANALYSIS === */}
        <Section id="analysis" title="Analysis" icon={<Landmark className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Summary" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={6} placeholder="You are an expert note-taker…" value={String(cfg.analysis?.summary ?? '')} onChange={e=>setCfg('analysis.summary', e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Summary request timeout (s)</div>
                <Input type="number" value={num(cfg.analysis?.summaryTimeout, 10)} onChange={e=>setCfg('analysis.summaryTimeout', clamp(num(e.target.value,10), 1, 60))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Min messages to trigger</div>
                <Input type="number" value={num(cfg.analysis?.minMsgs, 2)} onChange={e=>setCfg('analysis.minMsgs', clamp(num(e.target.value,2), 0, 10))} />
              </div>
            </div>
          </Row>

          <Row label="Success Evaluation" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={6} placeholder="You are an expert call evaluator…" value={String(cfg.analysis?.success ?? '')} onChange={e=>setCfg('analysis.success', e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Evaluation Rubric</div>
                <Input placeholder="(optional) rubric name" value={String(cfg.analysis?.rubric ?? '')} onChange={e=>setCfg('analysis.rubric', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Success evaluation timeout (s)</div>
                <Input type="number" value={num(cfg.analysis?.successTimeout, 10)} onChange={e=>setCfg('analysis.successTimeout', clamp(num(e.target.value,10), 1, 60))} />
              </div>
            </div>
          </Row>

          <Row label="Structured Data" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={6} placeholder="Extract structured data…" value={String(cfg.analysis?.structured ?? '')} onChange={e=>setCfg('analysis.structured', e.target.value)} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Structured data timeout (s)</div>
                <Input type="number" value={num(cfg.analysis?.structuredTimeout, 10)} onChange={e=>setCfg('analysis.structuredTimeout', clamp(num(e.target.value,10), 1, 60))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Add Property</div>
                <Input placeholder="(optional) property key" value={String(cfg.analysis?.property ?? '')} onChange={e=>setCfg('analysis.property', e.target.value)} />
              </div>
            </div>
          </Row>
        </Section>

        <div className="h-6" />

        {/* === ADVANCED === */}
        <Section id="advanced" title="Advanced" icon={<Shield className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Privacy" icon={<Shield className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Toggle label="HIPAA Compliance" checked={!!cfg.privacy?.hipaa} onChange={v=>setCfg('privacy.hipaa', v)} />
              <Toggle label="PCI Compliance" checked={!!cfg.privacy?.pci} onChange={v=>setCfg('privacy.pci', v)} />
              <Toggle label="Audio Recording" checked={!!cfg.privacy?.audio} onChange={v=>setCfg('privacy.audio', v)} />
              <Toggle label="Video Recording" checked={!!cfg.privacy?.video} onChange={v=>setCfg('privacy.video', v)} />
            </div>
          </Row>

          <Row label="Start Speaking Plan" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Wait seconds</div>
                <Input type="number" step="0.1" value={num(cfg.speak?.wait, 0.4)} onChange={e=>setCfg('speak.wait', clamp(Number(e.target.value||0), 0, 5))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Smart Endpointing</div>
                <Select value={String(cfg.speak?.smart ?? 'off')} onChange={e=>setCfg('speak.smart', e.target.value)}>
                  <option value="off">Off</option>
                  <option value="on">On</option>
                </Select>
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">On punctuation (s)</div>
                <Input type="number" step="0.1" value={num(cfg.speak?.onPunct, 0.1)} onChange={e=>setCfg('speak.onPunct', clamp(Number(e.target.value||0), 0, 3))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">No punctuation (s)</div>
                <Input type="number" step="0.1" value={num(cfg.speak?.noPunct, 1.5)} onChange={e=>setCfg('speak.noPunct', clamp(Number(e.target.value||0), 0, 3))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">On number (s)</div>
                <Input type="number" step="0.1" value={num(cfg.speak?.onNumber, 0.5)} onChange={e=>setCfg('speak.onNumber', clamp(Number(e.target.value||0), 0, 3))} />
              </div>
            </div>
          </Row>

          <Row label="Voicemail Detection" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Provider</div>
                <Select value={String(cfg.vm?.provider ?? 'off')} onChange={e=>setCfg('vm.provider', e.target.value)}>
                  <option value="off">Off</option>
                  <option value="vapi">Vapi</option>
                  <option value="google">Google</option>
                  <option value="twilio">Twilio</option>
                </Select>
              </div>
            </div>
          </Row>

          <Row label="Stop Speaking Plan" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Number of words</div>
                <Input type="number" value={num(cfg.stop?.nWords, 0)} onChange={e=>setCfg('stop.nWords', clamp(num(e.target.value,0), 0, 10))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Voice seconds</div>
                <Input type="number" step="0.1" value={num(cfg.stop?.voiceSecs, 0.2)} onChange={e=>setCfg('stop.voiceSecs', clamp(Number(e.target.value||0), 0, 0.5))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Backoff seconds</div>
                <Input type="number" step="0.1" value={num(cfg.stop?.backoff, 1)} onChange={e=>setCfg('stop.backoff', clamp(Number(e.target.value||0), 0, 10))} />
              </div>
            </div>
          </Row>

          <Row label="Call Timeout Settings" icon={<Timer className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Silence Timeout (s)</div>
                <Input type="number" value={num(cfg.timeout?.silence, 30)} onChange={e=>setCfg('timeout.silence', clamp(num(e.target.value,30), 10, 3600))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Maximum Duration (s)</div>
                <Input type="number" value={num(cfg.timeout?.max, 600)} onChange={e=>setCfg('timeout.max', clamp(num(e.target.value,600), 10, 43200))} />
              </div>
            </div>
          </Row>

          <Row label="Keypad Input Settings" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Toggle label="Enable Keypad Input" checked={!!cfg.keypad?.enable} onChange={v=>setCfg('keypad.enable', v)} />
              <div>
                <div className="text-xs text-white/60 mb-1">Timeout (s)</div>
                <Input type="number" value={num(cfg.keypad?.timeout, 2)} onChange={e=>setCfg('keypad.timeout', clamp(num(e.target.value,2), 0, 10))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Delimiter</div>
                <Input placeholder="#" value={String(cfg.keypad?.delimiter ?? '')} onChange={e=>setCfg('keypad.delimiter', e.target.value)} />
              </div>
            </div>
          </Row>

          <Row label="Messaging" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <div className="text-xs text-white/60 mb-1">Server URL</div>
                <Input placeholder="https://api.example.com/function" value={String(cfg.msg?.serverUrl ?? '')} onChange={e=>setCfg('msg.serverUrl', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Timeout (s)</div>
                <Input type="number" value={num(cfg.msg?.timeout, 20)} onChange={e=>setCfg('msg.timeout', clamp(num(e.target.value,20), 1, 120))} />
              </div>
            </div>
          </Row>

          <Row label="Authorization" icon={<KeyRound className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="text-sm text-white/70">No authentication configured.</div>
          </Row>

          <Row label="HTTP Headers" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={4} placeholder='{"x-api-key":"..."}' value={String(cfg.msg?.headers ?? '')} onChange={e=>setCfg('msg.headers', e.target.value)} />
          </Row>

          <Row label="Messages" icon={<MessageSquareText className="w-4 h-4 text-[#6af7d1]" />}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/60 mb-1">Voicemail Message</div>
                <Input value={String(cfg.messages?.voicemail ?? 'Please call back when you’re available.')} onChange={e=>setCfg('messages.voicemail', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">End Call Message</div>
                <Input value={String(cfg.messages?.end ?? 'Goodbye.')} onChange={e=>setCfg('messages.end', e.target.value)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Max Idle Messages</div>
                <Input type="number" value={num(cfg.messages?.maxIdle, 3)} onChange={e=>setCfg('messages.maxIdle', clamp(num(e.target.value,3), 1, 10))} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Idle Timeout (s)</div>
                <Input type="number" step="0.1" value={num(cfg.messages?.idleTimeout, 7.5)} onChange={e=>setCfg('messages.idleTimeout', clamp(Number(e.target.value||0), 1, 60))} />
              </div>
            </div>
          </Row>
        </Section>

        <div className="h-6" />

        {/* === WIDGET === */}
        <Section id="widget" title="Widget" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
          <Row label="Embed Code" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <pre className="text-xs whitespace-pre-wrap p-4 rounded-[12px] bg-black/30 border border-white/10">
{`<vapi-widget assistant-id="${bot.id}" public-key="YOUR_PUBLIC_KEY"></vapi-widget>
<script src="https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js" async></script>`}
            </pre>
          </Row>
        </Section>
      </div>
    </div>
  );
}
