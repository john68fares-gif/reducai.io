'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, Save, MessageSquare, Mic, Sliders, Wrench, BarChart3, Settings, Code2,
  Phone, Zap
} from 'lucide-react';

/* ---------- Shared look to match your app ---------- */
const UI = {
  frame: {
    background: 'rgba(13,15,17,0.92)',
    border: '1px solid rgba(106,247,209,0.18)',
    boxShadow: 'inset 0 0 18px rgba(0,0,0,0.28), 0 0 24px rgba(6,180,140,0.10)',
    borderRadius: 22,
  } as React.CSSProperties,
  card: {
    background: '#101314',
    border: '1px solid rgba(255,255,255,0.18)',
    borderRadius: 18,
    boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
  } as React.CSSProperties,
  thinBorder: '1px solid rgba(255,255,255,0.14)',
};

type VoiceBuild = {
  id: string;
  type: 'voice';
  name: string;
  model?: string;
  provider?: 'openai' | string;
  firstMessage?: string;
  systemPrompt?: string;
  temperature?: number;
  // Voice bits
  voiceProvider?: 'vapi' | 'elevenlabs' | 'openai';
  voiceName?: string;
  // Telephony bits (optional placeholders)
  twilioSid?: string;
  twilioAuth?: string;
  forwardingNumber?: string;
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
};

function nowISO() { return new Date().toISOString(); }

function loadVoiceBuild(id?: string): VoiceBuild {
  // Everything stays client-only; safe for SSR because this is a client component.
  try {
    const raw = localStorage.getItem('chatbots');
    const arr = raw ? JSON.parse(raw) : [];
    const hit = Array.isArray(arr) ? arr.find((b: any) => b.id === id) : null;
    if (hit) return hit as VoiceBuild;
  } catch {}
  // defaults for a new voice build
  return {
    id: id || String(Date.now()),
    type: 'voice',
    name: 'New Voice Assistant',
    provider: 'openai',
    model: 'gpt-4o-mini',
    firstMessage: 'Hello.',
    systemPrompt:
      'You are a polite, concise voice assistant. Keep replies short and ask one question at a time.',
    temperature: 0.4,
    voiceProvider: 'vapi',
    voiceName: 'Elliot',
    createdAt: nowISO(),
    updatedAt: nowISO(),
  };
}

function saveVoiceBuild(v: VoiceBuild) {
  try {
    const raw = localStorage.getItem('chatbots');
    const arr: any[] = raw ? JSON.parse(raw) : [];
    const i = Array.isArray(arr) ? arr.findIndex((b) => b.id === v.id) : -1;
    const withStamped: VoiceBuild = { ...v, type: 'voice', updatedAt: nowISO(), createdAt: v.createdAt || nowISO() };
    if (i >= 0) arr[i] = withStamped; else arr.unshift(withStamped);
    localStorage.setItem('chatbots', JSON.stringify(arr));
  } catch {}
}

/* Tabs for editor sections (visual only; keep it simple & fast) */
const TABS = [
  { key: 'model', label: 'Model', icon: Sliders },
  { key: 'voice', label: 'Voice', icon: Mic },
  { key: 'transcriber', label: 'Transcriber', icon: MessageSquare },
  { key: 'tools', label: 'Tools', icon: Wrench },
  { key: 'analysis', label: 'Analysis', icon: BarChart3 },
  { key: 'advanced', label: 'Advanced', icon: Settings },
  { key: 'widget', label: 'Widget', icon: Code2 },
] as const;
type TabKey = typeof TABS[number]['key'];

export default function VoiceAssistantEditor(props: {
  agentId?: string;                 // optional: if you pass it, we preload
  onBack?: () => void;              // optional back to gallery
  onSaved?: (agent: VoiceBuild) => void; // optional callback
}) {
  const [tab, setTab] = useState<TabKey>('model');
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState('');
  const [v, setV] = useState<VoiceBuild>(() => loadVoiceBuild(props.agentId));

  useEffect(() => {
    // Preload if agentId changes
    if (props.agentId) setV(loadVoiceBuild(props.agentId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.agentId]);

  function onSave() {
    setSaving(true);
    saveVoiceBuild(v);
    setSaving(false);
    setSavedToast('Saved!');
    setTimeout(() => setSavedToast(''), 1400);
    props.onSaved?.(v);
  }

  /* ---------- Simple cards per tab (practical subset) ---------- */
  const ModelTab = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div style={UI.card} className="p-4 space-y-3">
        <div className="text-white/80 text-sm">Provider</div>
        <select
          value={v.provider || 'openai'}
          onChange={(e) => setV({ ...v, provider: e.target.value as any })}
          className="h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        >
          <option value="openai">OpenAI</option>
        </select>

        <div className="text-white/80 text-sm pt-2">Model</div>
        <select
          value={v.model || 'gpt-4o-mini'}
          onChange={(e) => setV({ ...v, model: e.target.value })}
          className="h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        >
          <option value="gpt-4o-mini">gpt-4o-mini</option>
          <option value="gpt-4o">gpt-4o</option>
          <option value="gpt-4.1">gpt-4.1</option>
        </select>

        <div className="text-white/80 text-sm pt-2">First Message</div>
        <input
          value={v.firstMessage || ''}
          onChange={(e) => setV({ ...v, firstMessage: e.target.value })}
          className="w-full h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        />

        <div className="text-white/80 text-sm pt-2">System Prompt</div>
        <textarea
          rows={8}
          value={v.systemPrompt || ''}
          onChange={(e) => setV({ ...v, systemPrompt: e.target.value })}
          className="w-full rounded-[12px] bg-black/30 border border-white/20 px-3 py-2 text-white outline-none focus:border-[#6af7d1]"
        />

        <div className="text-white/80 text-sm pt-2">Temperature</div>
        <input
          type="range" min={0} max={1} step={0.1}
          value={v.temperature ?? 0.4}
          onChange={(e) => setV({ ...v, temperature: Number(e.target.value) })}
          className="w-full"
        />
        <div className="text-xs text-white/60">Current: {v.temperature?.toFixed(1)}</div>
      </div>

      <div style={UI.card} className="p-4 space-y-3">
        <div className="text-white/80 text-sm">Assistant Name</div>
        <input
          value={v.name}
          onChange={(e) => setV({ ...v, name: e.target.value })}
          className="w-full h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        />

        <div className="text-white/70 text-xs pt-2">
          Saved locally. When you click <span className="text-[#6af7d1] font-semibold">Save</span>, this build
          appears in your Voice Agents gallery.
        </div>
      </div>
    </div>
  );

  const VoiceTab = (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div style={UI.card} className="p-4 space-y-3">
        <div className="text-white/80 text-sm">Voice Provider</div>
        <select
          value={v.voiceProvider}
          onChange={(e) => setV({ ...v, voiceProvider: e.target.value as any })}
          className="h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        >
          <option value="vapi">Vapi</option>
          <option value="elevenlabs">ElevenLabs</option>
          <option value="openai">OpenAI</option>
        </select>

        <div className="text-white/80 text-sm pt-2">Voice</div>
        <input
          value={v.voiceName || ''}
          onChange={(e) => setV({ ...v, voiceName: e.target.value })}
          placeholder="Elliot"
          className="w-full h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
      </div>

      <div style={UI.card} className="p-4 space-y-3">
        <div className="text-white/80 text-sm">Telephony (optional)</div>
        <input
          placeholder="Twilio Account SID"
          value={v.twilioSid || ''}
          onChange={(e) => setV({ ...v, twilioSid: e.target.value })}
          className="w-full h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <input
          placeholder="Twilio Auth Token"
          value={v.twilioAuth || ''}
          onChange={(e) => setV({ ...v, twilioAuth: e.target.value })}
          className="w-full h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
        <input
          placeholder="Forwarding Number (optional, E.164)"
          value={v.forwardingNumber || ''}
          onChange={(e) => setV({ ...v, forwardingNumber: e.target.value })}
          className="w-full h-[42px] rounded-[12px] bg-black/30 border border-white/20 px-3 text-white outline-none focus:border-[#6af7d1]"
        />
      </div>
    </div>
  );

  const Placeholder = (title: string, body = 'Coming soon — keep editing Model & Voice and click Save.') => (
    <div style={UI.card} className="p-5">
      <div className="text-white font-medium mb-1">{title}</div>
      <div className="text-white/70 text-sm">{body}</div>
    </div>
  );

  const tabContent = useMemo(() => {
    switch (tab) {
      case 'model': return ModelTab;
      case 'voice': return VoiceTab;
      case 'transcriber': return Placeholder('Transcriber');
      case 'tools': return Placeholder('Tools');
      case 'analysis': return Placeholder('Analysis / Summary / Structured Data');
      case 'advanced': return Placeholder('Advanced settings');
      case 'widget': return Placeholder('Widget');
      default: return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, v]);

  return (
    <section className="w-full">
      <div className="w-full max-w-[1400px] mx-auto px-6 2xl:px-12 pt-6 pb-16">
        {/* Page Title (like your other screens) */}
        <div className="mb-6">
          <div className="text-[12px] text-white/55 mb-1">Edit Assistant</div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center"
                 style={{ background:'rgba(0,255,194,0.10)', border:'1px solid rgba(0,255,194,0.22)' }}>
              <Mic className="w-5 h-5 text-[#6af7d1]" />
            </div>
            <h1 className="text-2xl md:text-[28px] leading-tight">
              <span className="text-white font-semibold">{v.name || 'Voice Assistant'}</span>
              <span className="text-white/50"> — Voice</span>
            </h1>
          </div>
        </div>

        {/* Top bar actions */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={props.onBack}
            className="inline-flex items-center gap-2 px-3 h-[40px] rounded-[12px] text-white/90 hover:bg-white/10"
            style={{ border: UI.thinBorder }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 h-[40px] rounded-[15px] font-semibold transition"
            style={{ background:'#00ffc2', color:'#081011', boxShadow:'0 0 10px rgba(106,247,209,0.35)' }}
          >
            <Save className="w-4 h-4" />
            Save
          </button>
          {savedToast && (
            <span className="text-sm text-[#6af7d1] ml-2">{savedToast}</span>
          )}
        </div>

        {/* Editor frame */}
        <div style={UI.frame} className="p-4 md:p-5">
          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-4">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`inline-flex items-center gap-2 px-3 h-[36px] rounded-[12px] text-sm ${
                  tab === key ? 'bg-[#0e3e35] text-white' : 'text-white/80 hover:bg-white/5'
                }`}
                style={{ border: UI.thinBorder }}
              >
                <Icon className="w-4 h-4 text-[#6af7d1]" />
                {label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="mt-3">{tabContent}</div>
        </div>
      </div>
    </section>
  );
}
