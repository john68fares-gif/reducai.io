'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Rocket,
  Cpu, FileText, KeyRound, Waves, Music, Mic, Settings2,
  Landmark, ListChecks, MessageSquareText, Shield, Timer, Gauge,
  ChevronDown, ChevronRight, Wand2, Copy
} from 'lucide-react';

/* =========================== STYLE =========================== */
const WRAP = 'w-full max-w-[1720px] mx-auto px-6 2xl:px-12 pt-10 pb-28';

const CARD: React.CSSProperties = {
  background: '#0f1214', // solid surface
  border: '1px solid rgba(106,247,209,0.18)',
  borderRadius: 28,
  boxShadow: '0 18px 60px rgba(0,0,0,0.55), 0 0 18px rgba(0,255,194,0.06)', // outer glow
};
const INNER: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.22)',
  borderRadius: 16,
  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)',
};
const HEADER_GLOW: React.CSSProperties = {
  background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
  filter: 'blur(34px)',
};

const BTN_ACCENT = '#59d9b3';
const BTN_ACCENT_HOVER = '#54cfa9';

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
function copyToClipboard(text: string) { try { navigator.clipboard.writeText(text); } catch {} }

/* ======================== ATOMS ======================== */
const Input = (p: React.InputHTMLAttributes<HTMLInputElement>) =>
  <input {...p} className={`w-full px-3 py-2 rounded-[12px] bg-[#0b0e0f] border border-white/14 outline-none focus:border-[#00ffc2] ${p.className||''}`} />;
const Text = (p: React.TextareaHTMLAttributes<HTMLTextAreaElement>) =>
  <textarea {...p} className={`w-full px-3 py-3 rounded-[12px] bg-[#0b0e0f] border border-white/14 outline-none focus:border-[#00ffc2] ${p.className||''}`} />;
const Select = (p: React.SelectHTMLAttributes<HTMLSelectElement>) =>
  <select {...p} className={`w-full px-3 py-2 rounded-[12px] bg-[#0b0e0f] border border-white/14 outline-none focus:border-[#00ffc2] ${p.className||''}`} />;

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`w-12 h-7 rounded-full relative transition ${checked ? 'bg-emerald-400/80' : 'bg-white/12'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}

/* Inspiration block */
function Inspo({ title, text, onUse }:{ title: string; text: string; onUse: () => void }) {
  return (
    <div className="mt-3 rounded-[12px] border border-dashed border-white/18 p-3 bg-white/4">
      <div className="flex items-center justify-between">
        <div className="text-white/80 text-xs flex items-center gap-2">
          <Wand2 className="w-3.5 h-3.5 text-[#6af7d1]" /> {title}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => copyToClipboard(text)} className="text-xs px-2 py-1 rounded-[10px] border border-white/15 hover:bg-white/10 inline-flex items-center gap-1">
            <Copy className="w-3 h-3" /> Copy
          </button>
          <button onClick={onUse} className="text-xs px-2.5 py-1 rounded-[10px] border border-white/15 hover:bg-white/10">
            Use preset
          </button>
        </div>
      </div>
      <div className="text-white/70 text-xs mt-1 whitespace-pre-wrap">{text}</div>
    </div>
  );
}

/* Collapsible section */
function Section({
  id, title, icon, defaultOpen = true, children,
  openMap, setOpenMap,
}: {
  id: string; title: string; icon?: React.ReactNode; defaultOpen?: boolean;
  children: React.ReactNode;
  openMap: Record<string, boolean>;
  setOpenMap: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const open = openMap[id] ?? defaultOpen;
  const toggle = () => setOpenMap((m) => ({ ...m, [id]: !open }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      style={CARD}
      className="rounded-[28px] p-0 overflow-hidden"
    >
      <button
        onClick={toggle}
        className="w-full text-left px-6 md:px-7 py-4 flex items-center justify-between hover:bg-white/4"
      >
        <div className="flex items-center gap-2 text-white/90 font-semibold">
          {icon}{title}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-white/70" /> : <ChevronRight className="w-4 h-4 text-white/70" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="px-6 md:px-7 pb-6 md:pb-7"
          >
            <div className="grid gap-5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function Row({ label, children, icon }: { label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={INNER} className="rounded-[16px] p-4 md:p-5">
      <div className="flex items-center gap-2 text-white/90 font-semibold mb-3">{icon}{label}</div>
      {children}
    </div>
  );
}

/* ===================== PRESETS ===================== */
const PRESETS = {
  firstMessage: 'Hello! Thanks for calling — how can I help today?',
  systemPrompt:
`You are a friendly, concise receptionist for a small business.
- Ask one question at a time.
- Keep responses under 2–3 short sentences.
- After greeting, immediately ask the first qualifying question.
- If the caller repeats or is silent, politely re-ask once, then move on.
- If stuck, offer to connect to a teammate.`,
  summary:
`You are an expert note-taker. Summarize the call in 2–3 sentences, listing any decisions or next steps.`,
  success:
`You are an expert evaluator. Using the system prompt + transcript, decide if the goal was achieved. Return "success" or "fail" with one sentence why.`,
  structured:
`Extract:
- caller_name
- callback_number
- intent
- appointment_date (ISO if possible)
Return a compact JSON object.`,
  voicemail: 'Please call back when you’re available.',
  end: 'Thanks for your time — goodbye!',
  bgUrl: 'https://www.soundjay.com/ambient/sounds/people-in-lounge-1.mp3',
};

/* ======================== COMPONENT ======================== */
export default function VoiceAssistantEditor({ id, onExit, onSaved }: Props) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [saving, setSaving] = useState(false);

  // collapsible state
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({
    model: true, voice: true, transcriber: true, tools: true,
    analysis: true, advanced: true, widget: false,
  });
  const allOpen = Object.values(openMap).every(Boolean);
  const setAll = (v: boolean) => setOpenMap((m) => Object.fromEntries(Object.keys(m).map(k => [k, v])) as any);

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

  const quickFill = () => {
    // defaults
    setCfg('model.provider', 'openai');
    setCfg('model.name', 'gpt-4o-cluster');
    setCfg('model.firstMode', 'assistant_first');     // assistant greets once
    setCfg('model.firstMessage', PRESETS.firstMessage);
    setCfg('model.systemPrompt', PRESETS.systemPrompt);
    setCfg('model.maxTokens', 250);
    setCfg('model.temperature', 0.5);

    setCfg('voice.provider', 'vapi');
    setCfg('voice.name', 'Elliot');
    setCfg('voice.denoise', true);
    setCfg('voice.bgPreset', 'default');
    setCfg('voice.bgUrl', PRESETS.bgUrl);
    setCfg('voice.minChars', 30);

    setCfg('asr.provider', 'deepgram');
    setCfg('asr.language', 'En');
    setCfg('asr.model', 'nova-2');
    setCfg('asr.denoise', true);
    setCfg('asr.threshold', 0.4);
    setCfg('asr.numerals', true);

    setCfg('tools.endCall', true);
    setCfg('tools.keypad', true);
    setCfg('tools.forwardE164', bot?.fromE164 || '');

    setCfg('analysis.summary', PRESETS.summary);
    setCfg('analysis.summaryTimeout', 10);
    setCfg('analysis.minMsgs', 2);
    setCfg('analysis.success', PRESETS.success);
    setCfg('analysis.rubric', '');
    setCfg('analysis.successTimeout', 10);
    setCfg('analysis.structured', PRESETS.structured);
    setCfg('analysis.structuredTimeout', 10);

    setCfg('privacy.hipaa', false);
    setCfg('privacy.pci', false);
    setCfg('privacy.audio', true);
    setCfg('privacy.video', false);

    setCfg('speak.wait', 0.4);
    setCfg('speak.smart', 'off');
    setCfg('speak.onPunct', 0.1);
    setCfg('speak.noPunct', 1.5);
    setCfg('speak.onNumber', 0.5);

    setCfg('vm.provider', 'off');

    setCfg('stop.nWords', 0);
    setCfg('stop.voiceSecs', 0.2);
    setCfg('stop.backoff', 1);

    setCfg('timeout.silence', 30);
    setCfg('timeout.max', 600);

    setCfg('keypad.enable', true);
    setCfg('keypad.timeout', 2);
    setCfg('keypad.delimiter', '#');

    setCfg('msg.serverUrl', 'https://api.example.com/function');
    setCfg('msg.timeout', 20);
    setCfg('messages.voicemail', PRESETS.voicemail);
    setCfg('messages.end', PRESETS.end);
    setCfg('messages.maxIdle', 3);
    setCfg('messages.idleTimeout', 7.5);
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
          className="flex items-center justify-between mb-8 relative"
        >
          <div aria-hidden className="pointer-events-none absolute -top-[40%] -left-[28%] w-[70%] h-[70%] rounded-full" style={HEADER_GLOW} />
          <div className="min-w-0">
            <div className="text-xs text-white/60">Edit Assistant</div>
            <h1 className="text-2xl md:text-3xl font-semibold truncate">
              {bot.name} <span className="text-white/50">— Voice</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAll(!allOpen)}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10"
              title={allOpen ? 'Collapse all' : 'Expand all'}
            >
              <ChevronDown className="w-4 h-4" style={{ transform: allOpen ? 'rotate(180deg)' : 'none' }} />
              {allOpen ? 'Collapse all' : 'Expand all'}
            </button>
            <button
              onClick={quickFill}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10"
            >
              <Wand2 className="w-4 h-4" /> Quick-fill demo
            </button>
            <button onClick={onExit} className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={save}
              className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 font-semibold"
              style={{ background: BTN_ACCENT, color: 'white' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_ACCENT_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_ACCENT)}
            >
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {/* wire publish later */}}
              className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 font-semibold border border-[#2b6] hover:bg-white/10"
              style={{ color: 'white' }}
            >
              <Rocket className="w-4 h-4" /> Publish
            </button>
          </div>
        </motion.div>

        {/* Top metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div style={CARD} className="rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-white/80 mb-2"><Gauge className="w-4 h-4 text-[#6af7d1]" /> Cost</div>
            <div className="w-full h-2 rounded-full bg-white/12 overflow-hidden">
              <div className="h-full w-3/4 rounded-full" style={{ background:'#6af7d1' }} />
            </div>
            <div className="text-xs text-white/70 mt-2">~$0.1 / min</div>
          </div>
          <div style={CARD} className="rounded-[28px] p-5">
            <div className="flex items-center gap-2 text-white/80 mb-2"><Timer className="w-4 h-4 text-[#6af7d1]" /> Latency</div>
            <div className="w-full h-2 rounded-full bg-white/12 overflow-hidden">
              <div className="h-full w-[82%] rounded-full" style={{ background:'#6af7d1' }} />
            </div>
            <div className="text-xs text-white/70 mt-2">~1050 ms</div>
          </div>
        </div>

        {/* Sections */}
        <Section id="model" title="Model" icon={<Cpu className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
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
            <Input value={String(cfg.model?.firstMessage ?? '')} onChange={e=>setCfg('model.firstMessage', e.target.value)} placeholder={PRESETS.firstMessage} />
            <Inspo title="Preset" text={PRESETS.firstMessage} onUse={()=>setCfg('model.firstMessage', PRESETS.firstMessage)} />
          </Row>

          <Row label="System Prompt" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={10} placeholder="Write how your assistant should behave…" value={String(cfg.model?.systemPrompt ?? bot.prompt ?? '')} onChange={e=>setCfg('model.systemPrompt', e.target.value)} />
            <Inspo title="Example instruction" text={PRESETS.systemPrompt} onUse={()=>setCfg('model.systemPrompt', PRESETS.systemPrompt)} />
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

        <div className="h-6" />

        <Section id="voice" title="Voice" icon={<Waves className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
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
                <div className="text-xs text-white/60 mb-1">Background URL</div>
                <Input placeholder="https://…" value={String(cfg.voice?.bgUrl ?? '')} onChange={e=>setCfg('voice.bgUrl', e.target.value)} />
                <Inspo title="Preset URL" text={PRESETS.bgUrl} onUse={()=>setCfg('voice.bgUrl', PRESETS.bgUrl)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">Input Min Characters</div>
                <Input type="number" value={num(cfg.voice?.minChars, 30)} onChange={e=>setCfg('voice.minChars', clamp(num(e.target.value, 30), 0, 200))} />
              </div>
            </div>
          </Row>
        </Section>

        <div className="h-6" />

        <Section id="transcriber" title="Transcriber" icon={<Mic className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
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

        <Section id="tools" title="Tools" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
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

        <Section id="analysis" title="Analysis" icon={<Landmark className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
          <Row label="Summary" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <Text rows={6} placeholder="Prompt used to summarize the call…" value={String(cfg.analysis?.summary ?? '')} onChange={e=>setCfg('analysis.summary', e.target.value)} />
            <Inspo title="Preset" text={PRESETS.summary} onUse={()=>setCfg('analysis.summary', PRESETS.summary)} />
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
            <Text rows={6} placeholder="How to decide if the call achieved the goal…" value={String(cfg.analysis?.success ?? '')} onChange={e=>setCfg('analysis.success', e.target.value)} />
            <Inspo title="Preset" text={PRESETS.success} onUse={()=>setCfg('analysis.success', PRESETS.success)} />
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
            <Text rows={6} placeholder="What to extract from the call…" value={String(cfg.analysis?.structured ?? '')} onChange={e=>setCfg('analysis.structured', e.target.value)} />
            <Inspo title="Preset" text={PRESETS.structured} onUse={()=>setCfg('analysis.structured', PRESETS.structured)} />
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

        <Section id="advanced" title="Advanced" icon={<Shield className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
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
                <Input value={String(cfg.messages?.voicemail ?? '')} onChange={e=>setCfg('messages.voicemail', e.target.value)} placeholder={PRESETS.voicemail} />
                <Inspo title="Preset" text={PRESETS.voicemail} onUse={()=>setCfg('messages.voicemail', PRESETS.voicemail)} />
              </div>
              <div>
                <div className="text-xs text-white/60 mb-1">End Call Message</div>
                <Input value={String(cfg.messages?.end ?? '')} onChange={e=>setCfg('messages.end', e.target.value)} placeholder={PRESETS.end} />
                <Inspo title="Preset" text={PRESETS.end} onUse={()=>setCfg('messages.end', PRESETS.end)} />
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

        <Section id="widget" title="Widget" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />} openMap={openMap} setOpenMap={setOpenMap}>
          <Row label="Embed Code" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
            <pre className="text-xs whitespace-pre-wrap p-4 rounded-[12px] bg-black/40 border border-white/12">{`<vapi-widget assistant-id="${bot.id}" public-key="YOUR_PUBLIC_KEY"></vapi-widget>
<script src="https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js" async></script>`}</pre>
          </Row>
        </Section>
      </div>
    </div>
  );
}
