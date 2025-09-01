// components/voice/VoiceAssistantEditor.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Save, Settings2, Cpu, FileText, MessageSquareText, Mic2, HeadphonesIcon,
  Wrench, LineChart, ShieldCheck, Code2, PhoneForwarded, Keypad, Power, Check
} from 'lucide-react';

type Bot = {
  id: string;
  name: string;
  type?: 'voice' | string;
  industry?: string;
  language?: string;
  model?: string;
  prompt?: string;           // system prompt
  createdAt?: string;
  updatedAt?: string;
  ttsVoice?: string;
  config?: {
    greeting?: string;
    speakingStyle?: string;
    responseDelayMs?: number;
    speakingRatePct?: number;
    pitchSemitones?: number;
    bargeIn?: boolean;
  };
  fromE164?: string;
  settings?: any;            // editor saves here
};

const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.96)',
  border: '2px dashed rgba(106,247,209,0.30)',
  borderRadius: 30,
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
};

const THIN_BORDER = '1px solid rgba(255,255,255,0.18)';
const OUTER_CARD: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 0 18px rgba(106,247,209,0.05)',
  borderRadius: 24,
};
const INNER_CARD: React.CSSProperties = {
  background: '#101314',
  border: THIN_BORDER,
  borderRadius: 16,
  boxShadow: 'inset 0 0 12px rgba(0,0,0,0.38)',
};
const ORB: React.CSSProperties = {
  background: 'radial-gradient(circle, rgba(106,247,209,0.10) 0%, transparent 70%)',
  filter: 'blur(38px)',
};

const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';

function s(v: any, d: any = '') { return v == null ? d : v; }
function loadBots(): Bot[] { try { return JSON.parse(localStorage.getItem('chatbots') || '[]'); } catch { return []; } }
function saveBots(arr: Bot[]) { try { localStorage.setItem('chatbots', JSON.stringify(arr)); } catch {} }

type Props = {
  bot: Bot;
  onClose: () => void;
  onSaved: (updated: Bot) => void;
};

export default function VoiceAssistantEditor({ bot, onClose, onSaved }: Props) {
  const initial = useMemo(() => ({
    modelProvider: 'OpenAI',
    model: s(bot.model, 'gpt-4o-mini'),
    firstMessage: s(bot.config?.greeting, 'Hello.'),
    systemPrompt: s(bot.prompt, 'This is a blank template with minimal defaults.'),
    maxTokens: 250,
    temperature: 0.5,

    voiceProvider: 'Vapi',
    voiceName: s(bot.ttsVoice, 'Elliot'),

    transcriberProvider: 'Deepgram',
    transcriberModel: 'Nova 2',
    transcriberLang: s(bot.language, 'en'),

    tools: {
      endCall: true,
      dialKeypad: true,
      forwardNumber: s(bot.fromE164, '') || '',
    },

    analysis: {
      summaryPrompt:
        'You are an expert note-taker. Summarize the call in 2–3 sentences.',
      successPrompt:
        'You are an expert call evaluator. Based on the transcript and system prompt, decide if objectives were met.',
      structuredDataPrompt:
        'Extract key entities mentioned during the call as JSON.',
      successTimeout: 10,
      summaryTimeout: 10,
      structuredTimeout: 10,
      minMsgsForSummary: 2,
    },

    advanced: {
      hipaa: false,
      pci: false,
      recordAudio: true,
      startSpeakingWait: 0.4,
      smartEndpointing: false,
      punctuationSecs: 0.1,
      noPunctSecs: 1.5,
      numberSecs: 0.5,
      voicemailProvider: 'Off',
      stopWords: 0,
      stopVoiceSecs: 0.2,
      backoffSecs: 1,
      silenceTimeout: 30,
      maxDuration: 600,
      keypadEnabled: true,
      keypadTimeout: 2,
      keypadDelimiter: '',
      serverUrl: 'https://api.example.com/function',
      serverTimeout: 20,
      headers: [] as Array<{ key: string; value: string }>,
      voicemailMsg: 'Please call back when you’re available.',
      endCallMsg: 'Goodbye.',
      maxIdleMsg: 3,
      idleTimeout: 7.5,
    },

    widget: {
      publicKey: '',
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [bot.id]);

  const [tab, setTab] = useState<'model'|'voice'|'transcriber'|'tools'|'analysis'|'advanced'|'widget'>('model');
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);

  useEffect(() => { setDraft(initial); setTab('model'); }, [bot.id]); // when changing bot

  const save = () => {
    setSaving(true);
    const all = loadBots();
    const idx = all.findIndex(b => b.id === bot.id);
    const updated: Bot = {
      ...bot,
      model: draft.model,
      prompt: draft.systemPrompt,
      ttsVoice: draft.voiceName,
      language: draft.transcriberLang,
      config: {
        ...bot.config,
        greeting: draft.firstMessage,
        speakingStyle: bot.config?.speakingStyle,
      },
      fromE164: draft.tools.forwardNumber || bot.fromE164,
      settings: draft,
      updatedAt: new Date().toISOString(),
    };
    if (idx >= 0) all[idx] = updated; else all.unshift(updated);
    saveBots(all);
    setSaving(false);
    setSavedToast(true);
    onSaved(updated);
    setTimeout(() => setSavedToast(false), 1600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background:'rgba(0,0,0,0.55)' }}>
      <div className="relative w-full max-w-[1280px] max-h-[92vh] flex flex-col text-white font-movatif overflow-hidden" style={FRAME}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 rounded-t-[30px]" style={{ borderBottom: '1px solid rgba(255,255,255,0.4)' }}>
          <div className="min-w-0">
            <div className="text-xl font-semibold truncate">Edit Assistant — {bot.name}</div>
            <div className="text-white/70 text-xs truncate">{bot.industry || '—'}{bot.language ? ` · ${bot.language}` : ''}</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={save}
              className="inline-flex items-center gap-2 rounded-[14px] px-3.5 py-2 text-sm"
              style={{ background: BTN_GREEN, color:'#000', boxShadow:'0 0 12px rgba(106,247,209,0.18)' }}
              onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
              onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
            >
              <Save className="w-4 h-4" /> Save
            </button>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10" aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-6 pt-4">
          <div className="flex flex-wrap gap-1.5">
            <Tab id="model"       icon={<Cpu className="w-3.5 h-3.5" />}         cur={tab} set={setTab}>Model</Tab>
            <Tab id="voice"       icon={<Mic2 className="w-3.5 h-3.5" />}         cur={tab} set={setTab}>Voice</Tab>
            <Tab id="transcriber" icon={<HeadphonesIcon className="w-3.5 h-3.5" />} cur={tab} set={setTab}>Transcriber</Tab>
            <Tab id="tools"       icon={<Wrench className="w-3.5 h-3.5" />}       cur={tab} set={setTab}>Tools</Tab>
            <Tab id="analysis"    icon={<LineChart className="w-3.5 h-3.5" />}    cur={tab} set={setTab}>Analysis</Tab>
            <Tab id="advanced"    icon={<ShieldCheck className="w-3.5 h-3.5" />}   cur={tab} set={setTab}>Advanced</Tab>
            <Tab id="widget"      icon={<Code2 className="w-3.5 h-3.5" />}        cur={tab} set={setTab}>Widget</Tab>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB} />
          {tab === 'model' && <TabModel    draft={draft} setDraft={setDraft} />}
          {tab === 'voice' && <TabVoice    draft={draft} setDraft={setDraft} />}
          {tab === 'transcriber' && <TabTranscriber draft={draft} setDraft={setDraft} />}
          {tab === 'tools' && <TabTools    draft={draft} setDraft={setDraft} />}
          {tab === 'analysis' && <TabAnalysis draft={draft} setDraft={setDraft} />}
          {tab === 'advanced' && <TabAdvanced draft={draft} setDraft={setDraft} />}
          {tab === 'widget' && <TabWidget  draft={draft} setDraft={setDraft} />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 rounded-b-[30px] flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.35)', background:'#101314' }}>
          <div className="text-xs text-white/60 inline-flex items-center gap-2"><Settings2 className="w-3.5 h-3.5" /> Thin borders, same palette as builder.</div>
          <button
            onClick={save}
            className="inline-flex items-center gap-2 rounded-[14px] px-4 py-2 text-sm"
            style={{ background: BTN_GREEN, color:'#000', boxShadow:'0 0 12px rgba(106,247,209,0.18)' }}
            onMouseEnter={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER)}
            onMouseLeave={(e)=>((e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN)}
          >
            <Save className="w-4 h-4" /> Save changes
          </button>
        </div>

        {/* saved toast */}
        {savedToast && (
          <div className="absolute bottom-5 right-6 rounded-[12px] px-3.5 py-2.5 text-sm"
               style={{ background:'rgba(16,19,20,0.95)', border:'1px solid rgba(106,247,209,0.40)', boxShadow:'0 0 14px rgba(106,247,209,0.18)' }}>
            <div className="flex items-center gap-2"><Check className="w-4 h-4 text-[#6af7d1]" /> Saved.</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------------- UI atoms ---------------- */
function Tab({
  id, cur, set, children, icon,
}: { id: any; cur: any; set: (v:any)=>void; children: React.ReactNode; icon?: React.ReactNode }) {
  const active = cur === id;
  return (
    <button
      onClick={() => set(id)}
      className="px-3 py-1.5 rounded-[12px] text-sm inline-flex items-center gap-1.5"
      style={{
        border: THIN_BORDER,
        background: active ? 'rgba(0,255,194,0.12)' : 'rgba(255,255,255,0.03)',
      }}
    >
      {icon}{children}
    </button>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}
function Card({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={OUTER_CARD} className="p-5 rounded-[24px] relative">
      <div aria-hidden className="pointer-events-none absolute -top-[28%] -left-[28%] w-[70%] h-[70%] rounded-full" style={ORB} />
      <div className="flex items-center gap-2 mb-3 text-white/90 font-semibold">{icon}{title}</div>
      <div className="grid gap-3">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={INNER_CARD} className="p-3 rounded-[16px]">
      <div className="text-xs text-white/60 mb-1">{label}</div>
      {children}
    </div>
  );
}
function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-[10px] bg-[#0b0e0f] border px-3 py-2 text-sm outline-none focus:border-[#00ffc2]`} style={{ borderColor:'rgba(255,255,255,0.18)' }} />;
}
function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className="w-full rounded-[10px] bg-[#0b0e0f] border px-3 py-2 text-sm outline-none focus:border-[#00ffc2]" style={{ borderColor:'rgba(255,255,255,0.18)' }} />;
}
function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className="w-full rounded-[10px] bg-[#0b0e0f] border px-3 py-2 text-sm outline-none focus:border-[#00ffc2]" style={{ borderColor:'rgba(255,255,255,0.18)', minHeight: 140 }} />;
}

/* ---------------- Tabs ---------------- */
function TabModel({ draft, setDraft }: any) {
  return (
    <Row>
      <Card title="Model" icon={<Cpu className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Provider">
          <Select value={draft.modelProvider} onChange={(e)=>setDraft((d:any)=>({ ...d, modelProvider: e.target.value }))}>
            <option>OpenAI</option>
            <option>Anthropic</option>
            <option>Cohere</option>
          </Select>
        </Field>
        <Field label="Model">
          <Select value={draft.model} onChange={(e)=>setDraft((d:any)=>({ ...d, model: e.target.value }))}>
            <option>gpt-4o-mini</option>
            <option>gpt-4o</option>
            <option>gpt-4o-realtime</option>
          </Select>
        </Field>
        <Field label="First Message">
          <Input value={draft.firstMessage} onChange={(e)=>setDraft((d:any)=>({ ...d, firstMessage: e.target.value }))} />
        </Field>
        <Field label="System Prompt">
          <Textarea value={draft.systemPrompt} onChange={(e)=>setDraft((d:any)=>({ ...d, systemPrompt: e.target.value }))} />
        </Field>
        <Field label="Max Tokens"><Input type="number" value={draft.maxTokens} onChange={(e)=>setDraft((d:any)=>({ ...d, maxTokens: +e.target.value }))} /></Field>
        <Field label="Temperature"><Input type="number" step="0.1" value={draft.temperature} onChange={(e)=>setDraft((d:any)=>({ ...d, temperature: +e.target.value }))} /></Field>
      </Card>

      <Card title="Preview" icon={<FileText className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Header">
          <div className="text-sm text-white/90">{draft.firstMessage}</div>
        </Field>
        <Field label="Prompt">
          <pre className="whitespace-pre-wrap text-sm leading-6">{draft.systemPrompt}</pre>
        </Field>
      </Card>
    </Row>
  );
}

function TabVoice({ draft, setDraft }: any) {
  return (
    <Row>
      <Card title="Voice Configuration" icon={<Mic2 className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Provider">
          <Select value={draft.voiceProvider} onChange={(e)=>setDraft((d:any)=>({ ...d, voiceProvider: e.target.value }))}>
            <option>Vapi</option>
            <option>ElevenLabs</option>
            <option>Amazon Polly</option>
          </Select>
        </Field>
        <Field label="Voice">
          <Select value={draft.voiceName} onChange={(e)=>setDraft((d:any)=>({ ...d, voiceName: e.target.value }))}>
            <option>Elliot</option>
            <option>Joanna</option>
            <option>Alloy</option>
          </Select>
        </Field>
      </Card>

      <Card title="Pacing & Barge-In">
        <Field label="Response Delay (ms)"><Input type="number" value={draft?.responseDelayMs ?? 600} onChange={(e)=>setDraft((d:any)=>({ ...d, responseDelayMs:+e.target.value }))} /></Field>
        <Field label="Speaking Rate (%)"><Input type="number" value={draft?.speakingRatePct ?? 100} onChange={(e)=>setDraft((d:any)=>({ ...d, speakingRatePct:+e.target.value }))} /></Field>
        <Field label="Pitch (semitones)"><Input type="number" value={draft?.pitchSemitones ?? 0} onChange={(e)=>setDraft((d:any)=>({ ...d, pitchSemitones:+e.target.value }))} /></Field>
      </Card>
    </Row>
  );
}

function TabTranscriber({ draft, setDraft }: any) {
  return (
    <Row>
      <Card title="Transcriber" icon={<HeadphonesIcon className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Provider">
          <Select value={draft.transcriberProvider} onChange={(e)=>setDraft((d:any)=>({ ...d, transcriberProvider: e.target.value }))}>
            <option>Deepgram</option>
            <option>OpenAI</option>
            <option>Google</option>
          </Select>
        </Field>
        <Field label="Model">
          <Select value={draft.transcriberModel} onChange={(e)=>setDraft((d:any)=>({ ...d, transcriberModel: e.target.value }))}>
            <option>Nova 2</option>
            <option>Whisper</option>
          </Select>
        </Field>
        <Field label="Language"><Input value={draft.transcriberLang} onChange={(e)=>setDraft((d:any)=>({ ...d, transcriberLang:e.target.value }))} /></Field>
      </Card>

      <Card title="Noise & Confidence">
        <Field label="Background denoising"><Toggle value={true} onChange={()=>{}} /></Field>
        <Field label="Confidence threshold (0..1)"><Input type="number" min={0} max={1} step="0.05" value={0.4} onChange={()=>{}}/></Field>
        <Field label="Use numerals"><Toggle value={true} onChange={()=>{}} /></Field>
      </Card>
    </Row>
  );
}

function TabTools({ draft, setDraft }: any) {
  return (
    <Row>
      <Card title="Predefined Functions" icon={<Wrench className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Enable End Call"><Toggle value={draft.tools.endCall} onChange={(v)=>setDraft((d:any)=>({ ...d, tools:{ ...d.tools, endCall:v } }))} /></Field>
        <Field label="Dial Keypad"><Toggle value={draft.tools.dialKeypad} onChange={(v)=>setDraft((d:any)=>({ ...d, tools:{ ...d.tools, dialKeypad:v } }))} /></Field>
        <Field label="Forwarding Phone Number">
          <div className="flex items-center gap-2">
            <PhoneForwarded className="w-4 h-4 text-white/60" />
            <Input placeholder="+15551234567" value={draft.tools.forwardNumber} onChange={(e)=>setDraft((d:any)=>({ ...d, tools:{ ...d.tools, forwardNumber: e.target.value } }))} />
          </div>
        </Field>
      </Card>

      <Card title="Keypad">
        <Field label="Enable keypad input"><Toggle value={true} onChange={()=>{}} /></Field>
        <Field label="Timeout (sec)"><Input type="number" value={2} onChange={()=>{}} /></Field>
        <Field label="Delimiter"><Input placeholder="#" disabled /></Field>
      </Card>
    </Row>
  );
}

function TabAnalysis({ draft, setDraft }: any) {
  return (
    <Row>
      <Card title="Summary" icon={<MessageSquareText className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Prompt"><Textarea value={draft.analysis.summaryPrompt} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, summaryPrompt:e.target.value } }))} /></Field>
        <Field label="Timeout (sec)"><Input type="number" value={draft.analysis.summaryTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, summaryTimeout:+e.target.value } }))} /></Field>
        <Field label="Min messages to trigger"><Input type="number" value={draft.analysis.minMsgsForSummary} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, minMsgsForSummary:+e.target.value } }))} /></Field>
      </Card>

      <Card title="Success Evaluation">
        <Field label="Prompt"><Textarea value={draft.analysis.successPrompt} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, successPrompt:e.target.value } }))} /></Field>
        <Field label="Timeout (sec)"><Input type="number" value={draft.analysis.successTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, successTimeout:+e.target.value } }))} /></Field>
      </Card>

      <Card title="Structured Data">
        <Field label="Prompt"><Textarea value={draft.analysis.structuredDataPrompt} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, structuredDataPrompt:e.target.value } }))} /></Field>
        <Field label="Timeout (sec)"><Input type="number" value={draft.analysis.structuredTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, analysis:{ ...d.analysis, structuredTimeout:+e.target.value } }))} /></Field>
      </Card>
    </Row>
  );
}

function TabAdvanced({ draft, setDraft }: any) {
  const A = draft.advanced;
  return (
    <Row>
      <Card title="Privacy & Recording" icon={<ShieldCheck className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="HIPAA Compliance"><Toggle value={A.hipaa} onChange={(v)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, hipaa:v } }))} /></Field>
        <Field label="PCI Compliance"><Toggle value={A.pci} onChange={(v)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, pci:v } }))} /></Field>
        <Field label="Audio Recording"><Toggle value={A.recordAudio} onChange={(v)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, recordAudio:v } }))} /></Field>
      </Card>

      <Card title="Start Speaking Plan">
        <Field label="Wait seconds"><Input type="number" step="0.1" value={A.startSpeakingWait} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, startSpeakingWait:+e.target.value } }))} /></Field>
        <Field label="Smart endpointing"><Toggle value={A.smartEndpointing} onChange={(v)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, smartEndpointing:v } }))} /></Field>
        <Field label="On punctuation seconds"><Input type="number" step="0.1" value={A.punctuationSecs} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, punctuationSecs:+e.target.value } }))} /></Field>
        <Field label="On no punctuation seconds"><Input type="number" step="0.1" value={A.noPunctSecs} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, noPunctSecs:+e.target.value } }))} /></Field>
        <Field label="On number seconds"><Input type="number" step="0.1" value={A.numberSecs} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, numberSecs:+e.target.value } }))} /></Field>
      </Card>

      <Card title="Stop Speaking Plan">
        <Field label="Number of words"><Input type="number" value={A.stopWords} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, stopWords:+e.target.value } }))} /></Field>
        <Field label="Voice seconds"><Input type="number" step="0.1" value={A.stopVoiceSecs} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, stopVoiceSecs:+e.target.value } }))} /></Field>
        <Field label="Backoff seconds"><Input type="number" step="0.1" value={A.backoffSecs} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, backoffSecs:+e.target.value } }))} /></Field>
      </Card>

      <Card title="Timeouts & Keypad">
        <Field label="Silence timeout (sec)"><Input type="number" value={A.silenceTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, silenceTimeout:+e.target.value } }))} /></Field>
        <Field label="Max duration (sec)"><Input type="number" value={A.maxDuration} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, maxDuration:+e.target.value } }))} /></Field>
        <Field label="Enable keypad"><Toggle value={A.keypadEnabled} onChange={(v)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, keypadEnabled:v } }))} /></Field>
        <Field label="Keypad timeout (sec)"><Input type="number" value={A.keypadTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, keypadTimeout:+e.target.value } }))} /></Field>
        <Field label="Delimiter (optional)"><Input value={A.keypadDelimiter} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, keypadDelimiter:e.target.value } }))} /></Field>
      </Card>

      <Card title="Messaging">
        <Field label="Server URL"><Input value={A.serverUrl} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, serverUrl:e.target.value } }))} /></Field>
        <Field label="Timeout (sec)"><Input type="number" value={A.serverTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, serverTimeout:+e.target.value } }))} /></Field>
        <Field label="HTTP Headers (key:value, one per line)">
          <Textarea
            placeholder="x-api-key: abc123"
            value={(A.headers || []).map((h:any)=>`${h.key}: ${h.value}`).join('\n')}
            onChange={(e)=>{
              const lines = e.target.value.split('\n').map(l=>l.trim()).filter(Boolean);
              const headers = lines.map(l => {
                const i = l.indexOf(':');
                return i === -1 ? { key:l, value:'' } : { key:l.slice(0,i).trim(), value:l.slice(i+1).trim() };
              });
              setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, headers } }));
            }}
          />
        </Field>
      </Card>

      <Card title="Messages">
        <Field label="Voicemail Message"><Input value={A.voicemailMsg} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, voicemailMsg:e.target.value } }))} /></Field>
        <Field label="End Call Message"><Input value={A.endCallMsg} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, endCallMsg:e.target.value } }))} /></Field>
        <Field label="Max Idle Messages"><Input type="number" value={A.maxIdleMsg} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, maxIdleMsg:+e.target.value } }))} /></Field>
        <Field label="Idle Timeout (sec)"><Input type="number" step="0.1" value={A.idleTimeout} onChange={(e)=>setDraft((d:any)=>({ ...d, advanced:{ ...d.advanced, idleTimeout:+e.target.value } }))} /></Field>
      </Card>
    </Row>
  );
}

function TabWidget({ draft, setDraft }: any) {
  const embed = `<vapi-widget assistant-id="YOUR_ID" public-key="${draft.widget.publicKey}"></vapi-widget>\n<script src="https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js" async></script>`;
  return (
    <Row>
      <Card title="Widget" icon={<Code2 className="w-4 h-4 text-[#6af7d1]" />}>
        <Field label="Public key"><Input value={draft.widget.publicKey} onChange={(e)=>setDraft((d:any)=>({ ...d, widget:{ ...d.widget, publicKey: e.target.value } }))} /></Field>
        <Field label="Embed code">
          <Textarea readOnly value={embed} />
        </Field>
      </Card>
    </Row>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v:boolean)=>void }) {
  return (
    <button type="button" onClick={()=>onChange(!value)} className="w-12 h-7 rounded-full relative transition" style={{ background: value ? 'rgba(16,185,129,0.8)' : 'rgba(255,255,255,0.10)' }}>
      <span className="absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: value ? 'translateX(20px)' : 'translateX(0)' }} />
    </button>
  );
}
