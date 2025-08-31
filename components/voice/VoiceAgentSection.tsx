// components/voice/VoiceAgentSection.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Phone as PhoneIcon,
  Save as SaveIcon,
  Rocket,
  Link as LinkIcon,
  RefreshCw,
  Wand2,
  Volume2,
  Square,
} from 'lucide-react';

/* --------------------------- look & feel --------------------------- */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  boxShadow: '0 0 40px rgba(0,0,0,0.7)',
  borderRadius: 30,
};
const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.30)',
  borderRadius: 20,
  boxShadow: 'inset 0 0 22px rgba(0,0,0,0.28), 0 10px 40px rgba(0,0,0,0.35)',
};
const BTN_GREEN = '#59d9b3';
const BTN_GREEN_HOVER = '#54cfa9';
const BTN_DISABLED = '#2e6f63';

/* ----------------------------- types ------------------------------ */
type NumberItem = { id: string; e164?: string; label?: string; provider?: string; status?: string };
type Option = { value: string; label: string };
type Settings = {
  systemPrompt: string;
  language: string;
  ttsVoice: string;
  fromE164: string;

  // Voice & behavior
  greeting?: string;
  speakingStyle?: 'conversational' | 'professional' | 'newscaster' | '';
  responseDelayMs?: number;
  speakingRatePct?: number;
  pitchSemitones?: number;
  bargeIn?: boolean;
};

type BotSummary = {
  id: string;
  name?: string;
  title?: string;
  language?: string;
  industry?: string;
  prompt?: string;
  notes?: string;
};

function s(v: any) { return (typeof v === 'string' ? v : '') }

/* --------------------------- utils/store -------------------------- */
const LS_SETTINGS_KEY = 'voice:settings:backup';
const CHATBOTS_KEY = 'chatbots';
const TWILIO_CREDS_KEY = 'telephony:twilioCreds';

async function getJSON<T=any>(url: string): Promise<T> {
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
  const j = await r.json();
  return j?.ok ? j.data : j;
}
function saveLocalSettings(v: Partial<Settings>) {
  try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(v)); } catch {}
}
function loadLocalSettings(): Partial<Settings> | null {
  try { const raw = localStorage.getItem(LS_SETTINGS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function loadTwilioCreds(): { accountSid: string; authToken: string } | null {
  try {
    const raw = localStorage.getItem(TWILIO_CREDS_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (j?.accountSid && j?.authToken) return { accountSid: j.accountSid, authToken: j.authToken };
    return null;
  } catch { return null; }
}

/* ---------------------- prompt shaper (client) -------------------- */
function shapePromptForScheduling(raw: string, opts?: { name?: string; org?: string; personaName?: string }) {
  const company = opts?.org || /company[:\- ]+(.+)/i.exec(raw)?.[1]?.trim() || 'Wellness Partners';
  const persona = opts?.personaName || 'Riley';
  const agentName = opts?.name || 'Appointment Scheduling Voice Assistant';
  const clean = (s: string) => (s || '').trim();

  const body = [
    `# ${agentName}`,
    '## Identity & Purpose',
    `You are ${persona}, an appointment scheduling voice assistant for **${company}**. Your purpose is to schedule, confirm, reschedule, or cancel appointments and answer brief questions with a smooth, human cadence.`,
    '## Voice & Persona',
    '- Friendly, organized, efficient',
    '- Warm but professional; patient with confused callers',
    '## Conversation Flow',
    'Start with a warm greeting → determine intent → collect details → offer times → confirm → wrap up.',
    '## Response Guidelines',
    '- Ask one question at a time; confirm dates/times explicitly.',
    '## Knowledge Base',
    '- Appointment types, hours, prep, policies.',
  ];

  if (clean(raw)) {
    body.push('---', '### Additional Business Context (from user notes)', clean(raw));
  }

  return body.join('\n');
}

/* ---------------------- tiny UI atoms ---------------------- */
function GreenButton({ children, onClick, disabled, className }:{
  children: React.ReactNode; onClick?: ()=>void; disabled?: boolean; className?: string;
}) {
  const isDisabled = !!disabled;
  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`inline-flex items-center justify-center gap-2 px-4 h-[42px] rounded-[14px] font-semibold select-none transition-colors disabled:cursor-not-allowed ${className||''}`}
      style={{
        background: isDisabled ? BTN_DISABLED : BTN_GREEN,
        color: '#ffffff',
        boxShadow: isDisabled ? 'none' : '0 1px 0 rgba(0,0,0,0.18)',
        filter: isDisabled ? 'saturate(85%) opacity(0.9)' : 'none',
      }}
      onMouseEnter={(e) => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN_HOVER; }}
      onMouseLeave={(e) => { if (!isDisabled) (e.currentTarget as HTMLButtonElement).style.background = BTN_GREEN; }}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={CARD} className="p-5">
      <div className="mb-3 font-semibold text-white flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full" style={{ background:'#6af7d1', boxShadow:'0 0 8px rgba(106,247,209,.9)'}}/>
        {title}
      </div>
      {children}
    </div>
  );
}

/* ----------------------------- component ----------------------------- */
export default function VoiceAgentSection() {
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');

  const [nums, setNums] = useState<NumberItem[]>([]);
  const [settings, setSettings] = useState<Settings>({
    systemPrompt: '',
    language: 'en-US',
    ttsVoice: 'Polly.Joanna',
    fromE164: '',

    greeting: 'Thank you for calling. How can I help today?',
    speakingStyle: 'professional',
    responseDelayMs: 400,
    speakingRatePct: 100,
    pitchSemitones: 0,
    bargeIn: true,
  });

  const [twilioSid, setTwilioSid] = useState<string>('');
  const [twilioToken, setTwilioToken] = useState<string>('');

  const [msg, setMsg] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // audio tester
  const audioCtxRef = useRef<AudioContext|null>(null);
  const oscRef = useRef<OscillatorNode|null>(null);
  const gainRef = useRef<GainNode|null>(null);

  /* -------- init: numbers, local settings, bots, creds -------- */
  useEffect(() => {
    (async () => {
      try {
        // numbers
        try {
          const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers');
          setNums(Array.isArray(list) ? list : []);
        } catch { setNums([]); }

        // settings
        const local = loadLocalSettings();
        if (local) setSettings((p) => ({ ...p, ...local }));

        // bots (builder)
        try {
          const raw = localStorage.getItem(CHATBOTS_KEY);
          const arr: BotSummary[] = raw ? JSON.parse(raw) : [];
          setBots(Array.isArray(arr) ? arr : []);
          if (Array.isArray(arr) && arr.length && !selectedBotId) {
            setSelectedBotId(arr[0].id);
            const seed = `Company: ${arr[0].name || arr[0].title || ''}\n\n${arr[0].prompt || ''}`.trim();
            if (!local?.systemPrompt) {
              setSettings((p)=>({ ...p, systemPrompt: shapePromptForScheduling(seed, { org: arr[0].name || arr[0].title || 'Company' }) }));
            }
          }
        } catch {}

        // creds
        const creds = loadTwilioCreds();
        if (creds) { setTwilioSid(creds.accountSid || ''); setTwilioToken(creds.authToken || ''); }
      } catch {}
    })();
  }, []);

  // when a bot is chosen, seed prompt/language
  useEffect(() => {
    if (!selectedBotId) return;
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;
    const ctx = [
      bot?.name || bot?.title ? `Business Name: ${bot?.name || bot?.title}` : '',
      bot?.industry ? `Industry: ${bot.industry}` : '',
      bot?.language ? `Language Pref: ${bot.language}` : '',
      bot?.notes ? `Notes: ${bot.notes}` : '',
      bot?.prompt ? `Seed Prompt:\n${bot.prompt}` : '',
    ].filter(Boolean).join('\n');
    setSettings(p => ({ ...p, systemPrompt: shapePromptForScheduling(ctx, { org: bot?.name || bot?.title || 'Company' }), language: bot?.language || p.language }));
  }, [selectedBotId, bots]);

  // number options
  const numberOptions: Option[] = useMemo(
    () => nums.map((n) => ({ value: n.e164 || '', label: (n.e164 ? n.e164 : n.id) + (n.label ? ` — ${n.label}` : '') })),
    [nums],
  );

  async function refreshNumbers() {
    try {
      const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers');
      setNums(Array.isArray(list) ? list : []);
      setMsg('Numbers refreshed.');
    } catch { setMsg('Could not refresh numbers (API).'); }
  }

  function saveTwilioCredsLocal() {
    const sid = s(twilioSid).trim().toUpperCase();
    const tok = s(twilioToken).trim();
    if (!/^AC[A-Z0-9]{32}$/.test(sid)) { setMsg('Invalid or missing Twilio Account SID.'); return; }
    if (!tok) { setMsg('Missing Twilio Auth Token.'); return; }
    try { localStorage.setItem(TWILIO_CREDS_KEY, JSON.stringify({ accountSid: sid, authToken: tok })); } catch {}
    setMsg('Twilio credentials saved (browser only).');
  }

  async function save() {
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/voice-agent', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if ((r.headers.get('content-type')||'').includes('application/json')) {
        const j = await r.json();
        if (j?.ok === false) throw new Error(j?.error || 'Failed to save.');
      }
      saveLocalSettings(settings);
      setMsg('Saved.');
    } catch (e:any) {
      saveLocalSettings(settings);
      setMsg(e?.message || 'Saved locally.');
    } finally { setSaving(false); }
  }

  async function createAgent() {
    setCreating(true); setMsg(null);
    try {
      const body = {
        fromNumber: settings.fromE164 || undefined,
        voice: settings.ttsVoice,
        language: settings.language,
        prompt: (settings.systemPrompt || '').trim(),
      };
      const r = await fetch('/api/voice/agents', {
        method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Create failed');
      setMsg(`Agent created${settings.fromE164 ? ` — live at ${settings.fromE164}` : ''}.`);
    } catch (e:any) {
      saveLocalSettings(settings);
      setMsg('Agent settings saved locally.');
    } finally { setCreating(false); }
  }

  async function onAttachClick() {
    setMsg(null);
    if (!settings.fromE164) { setMsg('Select a phone number first.'); return; }

    const sid = s(twilioSid).trim().toUpperCase();
    const tok = s(twilioToken).trim();
    const saved = loadTwilioCreds();
    const useSid = /^AC[A-Z0-9]{32}$/.test(sid) ? sid : saved?.accountSid;
    const useTok = tok ? tok : saved?.authToken;

    if (!useSid || !useTok) { setMsg('No Twilio credentials found. Enter and save them first.'); return; }

    try {
      setAttaching(true);
      const resp = await fetch('/api/telephony/attach-number', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({
          accountSid: useSid,
          authToken: useTok,
          phoneNumber: settings.fromE164,
          // voice config propagated into webhook URL:
          language: settings.language,
          voice: settings.ttsVoice,
          greeting: settings.greeting || 'Thank you for calling. How can I help today?',
          style: settings.speakingStyle || 'professional',
          delayMs: Number(settings.responseDelayMs || 0),
          rate: Number(settings.speakingRatePct || 100),
          pitch: Number(settings.pitchSemitones || 0),
          bargeIn: !!settings.bargeIn,
        }),
      });
      const j = await resp.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed');
      setMsg(`Agent live at ${settings.fromE164}`);
    } catch (e:any) { setMsg(e?.message || 'Attach failed.'); }
    finally { setAttaching(false); }
  }

  function improvePrompt() {
    setSettings((p)=>({ ...p, systemPrompt: shapePromptForScheduling(p.systemPrompt) }));
    setMsg('Prompt re-shaped for voice scheduling.');
  }

  // audio tester
  async function startTone() {
    stopTone();
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.04;
    osc.type = 'sine';
    osc.frequency.value = 880;
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start();
    audioCtxRef.current = ctx; oscRef.current = osc; gainRef.current = gain;
  }
  function stopTone() {
    try { oscRef.current?.stop(); } catch {}
    try { oscRef.current?.disconnect(); } catch {}
    try { gainRef.current?.disconnect(); } catch {}
    try { audioCtxRef.current?.close(); } catch {}
    oscRef.current = null; gainRef.current = null; audioCtxRef.current = null;
  }

  return (
    <div className="px-6 py-8" style={{ maxWidth: 980, margin:'0 auto' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
            <PhoneIcon className="h-6 w-6 text-[#6af7d1]" />
            Voice Agent
          </h2>
          <div className="text-white/80 text-xs md:text-sm">No third-party SDKs — just your number + Twilio webhooks.</div>
        </div>
        <div className="flex items-center gap-3">
          <GreenButton onClick={createAgent} disabled={creating || !settings.systemPrompt}>
            <Rocket className="w-4 h-4 text-white" />
            {creating ? 'Creating…' : 'Create Agent'}
          </GreenButton>
          <GreenButton onClick={save} disabled={saving}>
            <SaveIcon className="w-4 h-4 text-white" />
            {saving ? 'Saving…' : 'Save'}
          </GreenButton>
        </div>
      </div>

      <div className="relative p-6 md:p-8" style={{ ...FRAME, overflow:'visible' }}>
        <div className="grid grid-cols-1 gap-6">
          {/* Build selector */}
          <Section title="Choose AI (from Builder)">
            <div className="grid gap-3">
              <label className="text-xs text-white/70">AI Build
                <select
                  value={selectedBotId}
                  onChange={(e)=>setSelectedBotId(e.target.value)}
                  className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                >
                  <option value="">{bots.length ? '— Choose —' : 'No builds found'}</option>
                  {bots.map(b => (
                    <option key={b.id} value={b.id}>
                      {(b.name || b.title || 'Untitled')} {b.industry ? `— ${b.industry}` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </Section>

          {/* Prompt */}
          <Section title="Prompt (Scheduling Assistant)">
            <div className="grid gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-white/70">ASR Language
                  <input
                    value={settings.language}
                    onChange={(e)=>setSettings({...settings, language: e.target.value})}
                    placeholder="en-US"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
                <label className="text-xs text-white/70">TTS Voice
                  <input
                    value={settings.ttsVoice}
                    onChange={(e)=>setSettings({...settings, ttsVoice: e.target.value})}
                    placeholder='Polly.Joanna (or "alice")'
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
              </div>

              {/* Voice & Behavior */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-white/70">Greeting (first sentence)
                  <input
                    value={settings.greeting || ''}
                    onChange={(e)=>setSettings({...settings, greeting: e.target.value})}
                    placeholder="Thank you for calling. How can I help today?"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>

                <label className="text-xs text-white/70">Speaking style
                  <select
                    value={settings.speakingStyle || 'professional'}
                    onChange={(e)=>setSettings({...settings, speakingStyle: e.target.value as any})}
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  >
                    <option value="professional">professional</option>
                    <option value="conversational">conversational</option>
                    <option value="newscaster">newscaster</option>
                    <option value="">none</option>
                  </select>
                </label>

                <label className="text-xs text-white/70">Response delay (ms)
                  <input
                    type="number"
                    min={0} max={5000}
                    value={Number(settings.responseDelayMs || 0)}
                    onChange={(e)=>setSettings({...settings, responseDelayMs: Number(e.target.value) || 0})}
                    placeholder="300–600 is natural"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>

                <label className="text-xs text-white/70">Speaking rate (%)
                  <input
                    type="number"
                    min={60} max={140}
                    value={Number(settings.speakingRatePct || 100)}
                    onChange={(e)=>setSettings({...settings, speakingRatePct: Number(e.target.value) || 100})}
                    placeholder="95–105 for natural"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>

                <label className="text-xs text-white/70">Pitch (semitones)
                  <input
                    type="number"
                    min={-6} max={6} step={0.5}
                    value={Number(settings.pitchSemitones || 0)}
                    onChange={(e)=>setSettings({...settings, pitchSemitones: Number(e.target.value) || 0})}
                    placeholder="-1..+1 subtle"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>

                <label className="text-xs text-white/70 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={!!settings.bargeIn}
                    onChange={(e)=>setSettings({...settings, bargeIn: e.target.checked})}
                  />
                  Allow barge-in (interrupt while speaking)
                </label>
              </div>

              <textarea
                rows={14}
                value={settings.systemPrompt}
                onChange={(e)=>setSettings({...settings, systemPrompt: e.target.value })}
                placeholder="Paste your business notes or prompt. Click “Improve” to reshape into a production scheduling prompt."
                className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#6af7d1] text-white"
              />
              <div className="flex flex-wrap gap-2">
                <GreenButton onClick={improvePrompt}><Wand2 className="w-4 h-4 text-white" /> Improve Prompt</GreenButton>
                <GreenButton onClick={save}><SaveIcon className="w-4 h-4 text-white" /> Save</GreenButton>
              </div>
            </div>
          </Section>

          {/* Numbers + creds + attach */}
          <Section title="Number (Twilio)">
            <div className="grid gap-3">
              <label className="text-xs text-white/70">From Number
                <select
                  value={settings.fromE164}
                  onChange={(e)=>setSettings({...settings, fromE164: e.target.value})}
                  className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                >
                  <option value="">{nums.length ? '— Choose —' : 'No numbers imported'}</option>
                  {numberOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </label>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="text-xs text-white/70">Twilio Account SID
                  <input
                    value={twilioSid}
                    onChange={(e)=> setTwilioSid(e.target.value)}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
                <label className="text-xs text-white/70">Twilio Auth Token
                  <input
                    value={twilioToken}
                    onChange={(e)=> setTwilioToken(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <GreenButton onClick={saveTwilioCredsLocal}>Save Twilio Credentials</GreenButton>
                <GreenButton onClick={refreshNumbers}><RefreshCw className="w-4 h-4 text-white" /> Refresh Imported Numbers</GreenButton>
                <GreenButton onClick={onAttachClick} disabled={!settings.fromE164 || attaching}>
                  <LinkIcon className="w-4 h-4 text-white" />
                  {attaching ? 'Attaching…' : 'Attach Number to Agent'}
                </GreenButton>
              </div>
              <p className="text-xs text-white/60">
                Uses your Twilio creds (stored in your browser only). No Vapi. No server env for Twilio needed.
              </p>
            </div>
          </Section>

          {/* Quick Tests */}
          <Section title="Quick Tests">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-white/90 mb-2 flex items-center gap-2">
                  <Volume2 className="w-4 h-4" /> Audio Ping
                </div>
                <div className="flex gap-2">
                  <GreenButton onClick={startTone}>Play</GreenButton>
                  <GreenButton onClick={stopTone}><Square className="w-4 h-4" /> Stop</GreenButton>
                </div>
                <p className="text-xs text-white/60 mt-2">Simple tone to confirm output device.</p>
              </div>
              <div className="text-white/60 text-sm">
                Calls will go through your Twilio webhook after you attach the number.
              </div>
            </div>
          </Section>
        </div>

        {msg && (
          <div className="mt-6 rounded-[14px] px-4 py-3 text-sm"
               style={{ ...CARD, border: '1px solid rgba(255,193,7,0.35)', background: 'rgba(255,193,7,0.10)' }}>
            <span className="text-amber-200">{msg}</span>
          </div>
        )}
      </div>
    </div>
  );
}
