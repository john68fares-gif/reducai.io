'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Save, Rocket, Settings2, Cpu, FileText, KeyRound, Music,
  Waves, Library, ListChecks, MessageSquareText, Shield, Mic, Wand2,
} from 'lucide-react';
import { motion } from 'framer-motion';

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

const WRAP = 'w-full max-w-[1720px] mx-auto px-6 2xl:px-12 pt-8 pb-28';
const CARD: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)',
  borderRadius: 28,
};
const INNER: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.28)',
  borderRadius: 18,
  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.35)',
};
const ORB = { background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)', filter: 'blur(38px)' };

const TABS = ['Model', 'Voice', 'Transcriber', 'Tools', 'Analysis', 'Advanced', 'Widget'] as const;
type Tab = typeof TABS[number];

/* helpers */
function safeParse<T>(raw: string | null, fallback: T): T {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
}
function assignPath(obj: any, path: string, value: any) {
  if (!obj || typeof obj !== 'object') return;
  const parts = path.split('.');
  let cur = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (!(k in cur) || typeof cur[k] !== 'object') cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
}
function clampInt(v: any, min: number, max: number, d: number) {
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
}
function clampFloat(v: any, min: number, max: number, d: number) {
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : d;
}

export default function VoiceAssistantEditor({ id, onExit, onSaved }: Props) {
  const [bot, setBot] = useState<Bot | null>(null);
  const [tab, setTab] = useState<Tab>('Model');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const arr: Bot[] = safeParse<Bot[]>(localStorage.getItem('chatbots'), []);
      const found = arr.find((b) => String(b?.id) === String(id));
      if (found) {
        // Hard default to avoid undefined access anywhere
        setBot({
          id: String(found.id),
          name: found.name || 'Untitled',
          type: found.type || 'voice',
          industry: found.industry || '',
          language: found.language || '',
          model: found.model || 'gpt-4o-mini',
          prompt: found.prompt || '',
          fromE164: found.fromE164 || '',
          updatedAt: found.updatedAt || found.createdAt,
          createdAt: found.createdAt,
          config: { ...(found.config || {}) },
        });
      } else {
        setBot(null);
      }
    } catch {
      setBot(null);
    }
  }, [id]);

  const setCfg = (path: string, value: any) => {
    setBot((prev) => {
      if (!prev) return prev;
      const cfg = { ...(prev.config || {}) };
      assignPath(cfg, path, value);
      return { ...prev, config: cfg };
    });
  };

  const save = async () => {
    if (!bot) return;
    setSaving(true);
    try {
      const arr: Bot[] = safeParse<Bot[]>(localStorage.getItem('chatbots'), []);
      const idx = arr.findIndex((b) => String(b?.id) === String(bot.id));
      if (idx !== -1) {
        arr[idx] = { ...arr[idx], ...bot, updatedAt: new Date().toISOString() };
        localStorage.setItem('chatbots', JSON.stringify(arr));
      }
      onSaved?.();
    } finally {
      setSaving(false);
    }
  };

  if (!bot) {
    return (
      <div className="min-h-screen bg-[#0b0c10] text-white font-movatif">
        <div className={WRAP}>
          <button onClick={onExit} className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="mt-8 rounded-2xl border p-6" style={{ borderColor:'rgba(255,255,255,0.16)', background:'#101314' }}>
            <div className="text-lg font-semibold mb-1">Agent not found</div>
            <div className="text-white/70 text-sm">The item you tried to edit doesn’t exist or local data is corrupted.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white font-movatif">
      <div className={WRAP}>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22 }}
          className="flex items-center justify-between mb-6">
          <div className="min-w-0">
            <div className="text-xs text-white/60">Editor</div>
            <h1 className="text-2xl md:text-3xl font-semibold truncate">
              {bot.name} <span className="text-white/50">— Voice Assistant</span>
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onExit} className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={save} className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 font-semibold" style={{ background: '#59d9b3', color: '#0b0c10' }}>
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => {}} className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 font-semibold border border-[#2b6] hover:bg-white/10">
              <Rocket className="w-4 h-4" /> Publish
            </button>
          </div>
        </motion.div>

        <div className="flex items-center gap-2 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-[10px] text-sm transition ${t===tab ? 'bg-[#123129] text-[#6af7d1]' : 'bg-transparent text-white/80 hover:bg-white/10'}`}
              style={{ border: '1px solid rgba(106,247,209,0.24)' }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={CARD} className="p-6 rounded-[28px] relative">
          <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB} />

          {tab === 'Model' && <ModelTab bot={bot} setCfg={setCfg} />}
          {tab === 'Voice' && <VoiceTab bot={bot} setCfg={setCfg} />}
          {tab === 'Transcriber' && <TranscriberTab bot={bot} setCfg={setCfg} />}
          {tab === 'Tools' && <ToolsTab bot={bot} setCfg={setCfg} />}
          {tab === 'Analysis' && <AnalysisTab bot={bot} setCfg={setCfg} />}
          {tab === 'Advanced' && <AdvancedTab bot={bot} setCfg={setCfg} />}
          {tab === 'Widget' && <WidgetTab bot={bot} />}
        </div>
      </div>
    </div>
  );
}

/* ---------- atoms ---------- */
function Row({ label, children, icon }:{ label: string; children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={INNER} className="p-4 rounded-[18px]">
      <div className="flex items-center gap-2 text-white/90 font-semibold mb-3">{icon}{label}</div>
      {children}
    </div>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 outline-none focus:border-[#00ffc2] ${props.className || ''}`} />;
}
function Text(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full px-3 py-3 rounded-[10px] bg-[#0b0e0f] border border-white/10 outline-none focus:border-[#00ffc2] ${props.className || ''}`} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`w-full px-3 py-2 rounded-[10px] bg-[#0b0e0f] border border-white/10 outline-none focus:border-[#00ffc2] ${props.className || ''}`} />;
}
function Toggle({ label, checked, onChange }:{ label:string; checked:boolean; onChange:(v:boolean)=>void }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <button type="button" onClick={() => onChange(!checked)} className={`w-12 h-7 rounded-full relative transition ${checked ? 'bg-emerald-400/80' : 'bg-white/10'}`}>
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
      <span className="text-sm">{label}</span>
    </label>
  );
}

/* ---------- tabs ---------- */
function ModelTab({ bot, setCfg }: { bot: Bot; setCfg: (p: string, v: any) => void }) {
  const cfg = bot.config || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Row label="Model" icon={<Cpu className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Provider</div>
            <Select value={String(cfg.model?.provider ?? 'openai')} onChange={e => setCfg('model.provider', e.target.value)}>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="google">Google</option>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Model</div>
            <Select value={String(cfg.model?.name ?? 'gpt-4o-mini')} onChange={e => setCfg('model.name', e.target.value)}>
              <option value="gpt-4o-mini">GPT-4o Mini</option>
              <option value="gpt-4o">GPT-4o</option>
              <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
            </Select>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-white/60 mb-1">First Message</div>
            <Input value={String(cfg.model?.firstMessage ?? 'Hello.')} onChange={e => setCfg('model.firstMessage', e.target.value)} />
          </div>
          <div className="col-span-2">
            <div className="text-xs text-white/60 mb-1">System Prompt</div>
            <Text rows={8} value={String(cfg.model?.systemPrompt ?? bot.prompt ?? '')} onChange={e => setCfg('model.systemPrompt', e.target.value)} />
          </div>
        </div>
      </Row>

      <Row label="API" icon={<KeyRound className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Max Tokens</div>
            <Input type="number" value={Number(cfg.model?.maxTokens ?? 250)} onChange={e => setCfg('model.maxTokens', clampInt(e.target.value, 1, 4000, 250))} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Temperature</div>
            <Input type="number" step="0.1" value={Number(cfg.model?.temperature ?? 0.5)} onChange={e => setCfg('model.temperature', clampFloat(e.target.value, 0, 2, 0.5))} />
          </div>
        </div>
      </Row>

      <Row label="Description" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
        <Text rows={6} placeholder="Short description of the assistant…" value={String(bot.prompt ?? '')} onChange={e => setCfg('meta.description', e.target.value)} />
      </Row>

      <Row label="Settings" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Language</div>
            <Input value={String(bot.language ?? '')} onChange={e => setCfg('meta.language', e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Industry</div>
            <Input value={String(bot.industry ?? '')} onChange={e => setCfg('meta.industry', e.target.value)} />
          </div>
        </div>
      </Row>
    </div>
  );
}

function VoiceTab({ bot, setCfg }: { bot: Bot; setCfg: (p: string, v: any) => void }) {
  const cfg = bot.config || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Row label="Voice Configuration" icon={<Waves className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Provider</div>
            <Select value={String(cfg.voice?.provider ?? 'vapi')} onChange={e => setCfg('voice.provider', e.target.value)}>
              <option value="vapi">Vapi</option>
              <option value="11labs">ElevenLabs</option>
              <option value="polly">Polly</option>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Voice</div>
            <Select value={String(cfg.voice?.name ?? 'Elliot')} onChange={e => setCfg('voice.name', e.target.value)}>
              <option value="Elliot">Elliot</option>
              <option value="Joanna">Joanna</option>
              <option value="Alloy">Alloy</option>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Speaking Rate %</div>
            <Input type="number" value={Number(cfg.voice?.rate ?? 100)} onChange={e => setCfg('voice.rate', clampInt(e.target.value, 60, 140, 100))} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Pitch (semitones)</div>
            <Input type="number" value={Number(cfg.voice?.pitch ?? 0)} onChange={e => setCfg('voice.pitch', clampInt(e.target.value, -6, 6, 0))} />
          </div>
        </div>
      </Row>

      <Row label="Background Sound" icon={<Music className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Preset</div>
            <Select value={String(cfg.voice?.bgPreset ?? 'default')} onChange={e => setCfg('voice.bgPreset', e.target.value)}>
              <option value="default">Default</option>
              <option value="office">Office</option>
              <option value="lounge">Lounge</option>
            </Select>
          </div>
          <div className="col-span-2">
            <div className="text-xs text-white/60 mb-1">Custom URL</div>
            <Input placeholder="https://…" value={String(cfg.voice?.bgUrl ?? '')} onChange={e => setCfg('voice.bgUrl', e.target.value)} />
          </div>
        </div>
      </Row>
    </div>
  );
}

function TranscriberTab({ bot, setCfg }: { bot: Bot; setCfg: (p: string, v: any) => void }) {
  const cfg = bot.config || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Row label="Transcriber" icon={<Mic className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">Provider</div>
            <Select value={String(cfg.asr?.provider ?? 'deepgram')} onChange={e => setCfg('asr.provider', e.target.value)}>
              <option value="deepgram">Deepgram</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Model</div>
            <Select value={String(cfg.asr?.model ?? 'nova-2')} onChange={e => setCfg('asr.model', e.target.value)}>
              <option value="nova-2">Nova 2</option>
              <option value="whisper-1">Whisper 1</option>
            </Select>
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Confidence Threshold</div>
            <Input type="number" step="0.05" value={Number(cfg.asr?.threshold ?? 0.4)} onChange={e => setCfg('asr.threshold', clampFloat(e.target.value, 0, 1, 0.4))} />
          </div>
        </div>
      </Row>

      <Row label="Punctuation & Endpointing" icon={<Library className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-white/60 mb-1">On Punctuation (s)</div>
            <Input type="number" step="0.1" value={Number(cfg.asr?.onPunct ?? 0.1)} onChange={e => setCfg('asr.onPunct', clampFloat(e.target.value, 0, 3, 0.1))} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">No Punctuation (s)</div>
            <Input type="number" step="0.1" value={Number(cfg.asr?.noPunct ?? 1.5)} onChange={e => setCfg('asr.noPunct', clampFloat(e.target.value, 0, 3, 1.5))} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">On Number (s)</div>
            <Input type="number" step="0.1" value={Number(cfg.asr?.onNumber ?? 0.5)} onChange={e => setCfg('asr.onNumber', clampFloat(e.target.value, 0, 3, 0.5))} />
          </div>
        </div>
      </Row>
    </div>
  );
}

function ToolsTab({ bot, setCfg }: { bot: Bot; setCfg: (p: string, v: any) => void }) {
  const cfg = bot.config || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Row label="Predefined Functions" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <Toggle label="Enable End Call" checked={!!cfg.tools?.endCall} onChange={v => setCfg('tools.endCall', v)} />
          <Toggle label="Dial Keypad" checked={!!cfg.tools?.keypad} onChange={v => setCfg('tools.keypad', v)} />
          <div className="col-span-2">
            <div className="text-xs text-white/60 mb-1">Forwarding Number</div>
            <Input placeholder="+1…" value={String(cfg.tools?.forwardE164 ?? '')} onChange={e => setCfg('tools.forwardE164', e.target.value)} />
          </div>
        </div>
      </Row>

      <Row label="Server Hooks" icon={<Wand2 className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className="text-xs text-white/60 mb-1">Server URL</div>
            <Input placeholder="https://api.example.com/function" value={String(cfg.tools?.serverUrl ?? '')} onChange={e => setCfg('tools.serverUrl', e.target.value)} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Timeout (s)</div>
            <Input type="number" value={Number(cfg.tools?.timeout ?? 20)} onChange={e => setCfg('tools.timeout', clampInt(e.target.value, 1, 120, 20))} />
          </div>
        </div>
      </Row>
    </div>
  );
}

function AnalysisTab({ bot, setCfg }: { bot: Bot; setCfg: (p: string, v: any) => void }) {
  const cfg = bot.config || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Row label="Summary" icon={<MessageSquareText className="w-4 h-4 text-[#6af7d1]" />}>
        <Text rows={6} placeholder="You are an expert note-taker…" value={String(cfg.analysis?.summary ?? '')} onChange={e => setCfg('analysis.summary', e.target.value)} />
      </Row>
      <Row label="Success Evaluation" icon={<Library className="w-4 h-4 text-[#6af7d1]" />}>
        <Text rows={6} placeholder="You are an expert call evaluator…" value={String(cfg.analysis?.success ?? '')} onChange={e => setCfg('analysis.success', e.target.value)} />
      </Row>
      <Row label="Structured Data" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
        <Text rows={6} placeholder="Extract structured data from the call…" value={String(cfg.analysis?.structured ?? '')} onChange={e => setCfg('analysis.structured', e.target.value)} />
      </Row>
    </div>
  );
}

function AdvancedTab({ bot, setCfg }: { bot: Bot; setCfg: (p: string, v: any) => void }) {
  const cfg = bot.config || {};
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Row label="Privacy" icon={<Shield className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-2 gap-3">
          <Toggle label="HIPAA Compliance" checked={!!cfg.privacy?.hipaa} onChange={v => setCfg('privacy.hipaa', v)} />
          <Toggle label="PCI Compliance" checked={!!cfg.privacy?.pci} onChange={v => setCfg('privacy.pci', v)} />
          <Toggle label="Audio Recording" checked={!!cfg.privacy?.audio} onChange={v => setCfg('privacy.audio', v)} />
        </div>
      </Row>

      <Row label="Keypad Input" icon={<ListChecks className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="grid grid-cols-3 gap-3">
          <Toggle label="Enable Keypad" checked={!!cfg.keypad?.enable} onChange={v => setCfg('keypad.enable', v)} />
          <div>
            <div className="text-xs text-white/60 mb-1">Timeout (s)</div>
            <Input type="number" value={Number(cfg.keypad?.timeout ?? 2)} onChange={e => setCfg('keypad.timeout', clampInt(e.target.value, 0, 10, 2))} />
          </div>
          <div>
            <div className="text-xs text-white/60 mb-1">Delimiter</div>
            <Input placeholder="#" value={String(cfg.keypad?.delimiter ?? '')} onChange={e => setCfg('keypad.delimiter', e.target.value)} />
          </div>
        </div>
      </Row>
    </div>
  );
}

function WidgetTab({ bot }: { bot: Bot }) {
  return (
    <div className="space-y-4">
      <Row label="Embed Widget" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
        <div className="text-sm text-white/80">Use your public key + assistant id to embed a web widget.</div>
        <div className="mt-3" style={INNER}>
          <pre className="p-4 text-xs whitespace-pre-wrap">
{`<vapi-widget assistant-id="${bot.id}" public-key="YOUR_PUBLIC_KEY"></vapi-widget>
<script src="https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js" async></script>`}
          </pre>
        </div>
      </Row>
    </div>
  );
}
