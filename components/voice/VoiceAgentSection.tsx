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
  language: string;      // e.g. "en-US"
  ttsVoice: string;      // e.g. "Polly.Joanna" or "alice"
  fromE164: string;

  // Voice & behavior (sent to webhook)
  greeting?: string;
  speakingStyle?: 'conversational' | 'professional' | 'newscaster' | '';
  responseDelayMs?: number;   // 0..5000
  speakingRatePct?: number;   // 60..140
  pitchSemitones?: number;    // -6..+6
  bargeIn?: boolean;
};
type TwilioCreds = { accountSid: string; authToken: string } | null;

/* --------------------------- utils/store -------------------------- */
const LS_SETTINGS_KEY = 'voice:settings:backup';
const CHATBOTS_KEY = 'chatbots';
const TWILIO_CREDS_KEYS = ['telephony:twilioCreds','twilio:lastCreds'];

async function getJSON<T=any>(url: string): Promise<T> {
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
  const j = await r.json();
  return j?.ok ? j.data : j;
}
function saveLocalSettings(v: Partial<Settings>) { try { localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(v)); } catch {} }
function loadLocalSettings(): Partial<Settings> | null { try { const raw = localStorage.getItem(LS_SETTINGS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; } }
function loadTwilioCreds(): TwilioCreds {
  try {
    for (const k of TWILIO_CREDS_KEYS) {
      const raw = localStorage.getItem(k);
      if (raw) {
        const j = JSON.parse(raw);
        if (j?.accountSid && j?.authToken) return { accountSid: j.accountSid, authToken: j.authToken };
      }
    }
  } catch {}
  return null;
}
function saveTwilioCreds(creds: { accountSid: string; authToken: string }) {
  try { localStorage.setItem('telephony:twilioCreds', JSON.stringify(creds)); } catch {}
}

/* ---------- SID helpers ---------- */
function sanitizeSid(s: string) { return (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase(); }
function isValidSid(s: string) { return /^AC[A-Za-z0-9]{32}$/.test(sanitizeSid(s)); }

/* ---------------------- prompt shaper (client) -------------------- */
function shapePromptForScheduling(raw: string, opts?: { name?: string; org?: string; personaName?: string }) {
  const company = opts?.org || 'Wellness Partners';
  const persona = opts?.personaName || 'Riley';
  const agentName = opts?.name || 'Appointment Scheduling Voice Assistant';
  const clean = (s: string) => (s || '').trim();

  const lines: string[] = [];
  lines.push(`# ${agentName}`);
  lines.push('');
  lines.push('## Identity & Purpose');
  lines.push(`You are ${persona}, an appointment scheduling voice assistant for **${company}**.`);
  lines.push('');
  lines.push('## Conversation Flow');
  lines.push('- Intro → Determine need → Schedule/Reschedule/Cancel → Confirm → Wrap.');
  lines.push('');
  lines.push('## Guidelines');
  lines.push('- One question at a time; confirm dates/times/names.');
  lines.push('');
  lines.push('## Knowledge');
  lines.push('- Types, hours, prep, policies.');

  const cleaned = clean(raw);
  if (cleaned) {
    lines.push('');
    lines.push('---');
    lines.push('### Additional Business Context');
    lines.push(cleaned);
  }
  return lines.join('\n');
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
  const [nums, setNums] = useState<NumberItem[]>([]);
  const [settings, setSettings] = useState<Settings>({
    systemPrompt: '',
    language: 'en-US',
    ttsVoice: 'Polly.Joanna',
    fromE164: '',
    greeting: 'Thank you for calling. How can I help today?',
    speakingStyle: 'professional',
    responseDelayMs: 300,
    speakingRatePct: 100,
    pitchSemitones: 0,
    bargeIn: true,
  });
  const [msg, setMsg] = useState<string|null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // inline Twilio creds
  const [twilioSid, setTwilioSid] = useState<string>('');
  const [twilioToken, setTwilioToken] = useState<string>('');

  // audio tester
  const audioCtxRef = useRef<AudioContext|null>(null);
  const oscRef = useRef<OscillatorNode|null>(null);
  const gainRef = useRef<GainNode|null>(null);

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
        // creds
        const creds = loadTwilioCreds();
        if (creds) { setTwilioSid(creds.accountSid || ''); setTwilioToken(creds.authToken || ''); }
        // seed prompt (simple)
        const raw = localStorage.getItem(CHATBOTS_KEY);
        if (raw) {
          try {
            const arr = JSON.parse(raw) as any[];
            if (Array.isArray(arr) && arr[0]?.name && !(local && local.systemPrompt)) {
              const seed = `Company: ${arr[0].name}\n\n${arr[0].prompt || ''}`.trim();
              setSettings((p)=>({ ...p, systemPrompt: shapePromptForScheduling(seed, { org: arr[0].name }) }));
            }
          } catch {}
        }
      } catch {}
    })();
  }, []);

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

  function onSaveTwilio() {
    const sid = sanitizeSid(twilioSid);
    const tok = (twilioToken || '').trim();
    if (!isValidSid(sid)) { setMsg('Invalid or missing Twilio Account SID.'); return; }
    if (!tok) { setMsg('Missing Twilio Auth Token.'); return; }
    saveTwilioCreds({ accountSid: sid, authToken: tok });
    setTwilioSid(sid);
    setTwilioToken(tok);
    setMsg('Twilio credentials saved (local only).');
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
    } catch {
      saveLocalSettings(settings);
      setMsg('Agent settings saved locally.');
    } finally { setCreating(false); }
  }

  async function onAttachClick() {
    setMsg(null);
    if (!settings.fromE164) { setMsg('Select a phone number first.'); return; }

    const sidTyped = sanitizeSid(twilioSid);
    const tokTyped = (twilioToken || '').trim();
    const saved = loadTwilioCreds();
    const useSid = isValidSid(sidTyped) ? sidTyped : (saved?.accountSid || '');
    const useTok = tokTyped || (saved?.authToken || '');

    if (!isValidSid(useSid)) { setMsg('Invalid or missing Twilio Account SID.'); return; }
    if (!useTok) { setMsg('Missing Twilio Auth Token.'); return; }

    const delayMs = Math.max(0, Math.min(5000, Number(settings.responseDelayMs ?? 0)));
    const rate    = Math.max(60, Math.min(140, Number(settings.speakingRatePct ?? 100)));
    const pitch   = Math.max(-6, Math.min(6, Number(settings.pitchSemitones ?? 0)));

    try {
      setAttaching(true);
      const body = {
        // accept both flat and nested for backward compatibility
        accountSid: useSid,
        authToken: useTok,
        phoneNumber: settings.fromE164,
        credentials: { accountSid: useSid, authToken: useTok },

        // voice config for our webhook
        language: settings.language,
        voice: settings.ttsVoice,
        greeting: settings.greeting || 'Thank you for calling. How can I help today?',
        style: settings.speakingStyle || 'professional',
        delayMs,
        rate,
        pitch,
        bargeIn: !!settings.bargeIn,
      };
      const r = await fetch('/api/telephony/attach-number', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed');
      saveTwilioCreds({ accountSid: useSid, authToken: useTok });
      setMsg(`Agent live at ${settings.fromE164}`);
    } catch (e:any) {
      setMsg(e?.message || 'Attach failed.');
    } finally {
      setAttaching(false);
    }
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
          <div className="text-white/80 text-xs md:text-sm">Calls are handled with plain Twilio webhooks—no external SDK.</div>
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

              {/* Voice & behavior controls */}
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
                    onChange={(e)=>setSettings({...settings, speakingStyle: e.target.value as Settings['speakingStyle']})}
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  >
                    <option value="professional">Professional</option>
                    <option value="conversational">Conversational</option>
                    <option value="newscaster">Newscaster</option>
                    <option value="">None</option>
                  </select>
                </label>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs text-white/70">Response delay (ms)
                  <input
                    type="number" min={0} max={5000} step={50}
                    value={settings.responseDelayMs ?? 0}
                    onChange={(e)=>setSettings({...settings, responseDelayMs: Math.max(0, Math.min(5000, Number(e.target.value || 0)))})}
                    placeholder="300"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
                <label className="text-xs text-white/70">Speaking rate (%)
                  <input
                    type="number" min={60} max={140}
                    value={settings.speakingRatePct ?? 100}
                    onChange={(e)=>setSettings({...settings, speakingRatePct: Math.max(60, Math.min(140, Number(e.target.value || 100)))})}
                    placeholder="100"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
                <label className="text-xs text-white/70">Pitch (semitones)
                  <input
                    type="number" min={-6} max={6} step={1}
                    value={settings.pitchSemitones ?? 0}
                    onChange={(e)=>setSettings({...settings, pitchSemitones: Math.max(-6, Math.min(6, Number(e.target.value || 0)))})}
                    placeholder="0"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
              </div>

              <label className="text-xs text-white/70 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!settings.bargeIn}
                  onChange={(e)=>setSettings({...settings, bargeIn: e.target.checked})}
                  className="h-[16px] w-[16px] accent-[#6af7d1]"
                />
                Allow barge-in (best effort)
              </label>

              <textarea
                rows={14}
                value={settings.systemPrompt}
                onChange={(e)=>setSettings({...settings, systemPrompt: e.target.value })}
                placeholder="Paste business notes. “Improve” reshapes to a production scheduling prompt."
                className="w-full rounded-[14px] border border-white/20 bg-black/30 px-3 py-3 text-sm outline-none focus:border-[#6af7d1] text-white"
              />
              <div className="flex flex-wrap gap-2">
                <GreenButton onClick={()=>{ setSettings((p)=>({ ...p, systemPrompt: shapePromptForScheduling(p.systemPrompt) })); setMsg('Prompt re-shaped for voice scheduling.'); }}>
                  <Wand2 className="w-4 h-4 text-white" /> Improve Prompt
                </GreenButton>
                <GreenButton onClick={save}><SaveIcon className="w-4 h-4 text-white" /> Save</GreenButton>
              </div>
            </div>
          </Section>

          {/* Numbers + attach + inline Twilio creds */}
          <Section title="Number (Imported with Twilio)">
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
                    onChange={(e)=> setTwilioSid(sanitizeSid(e.target.value))}
                    placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className={`mt-1 w-full rounded-[12px] border px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white ${
                      isValidSid(twilioSid) || twilioSid.length===0 ? 'border-white/20 bg-black/30' : 'border-rose-400/60 bg-black/30'
                    }`}
                  />
                  <span className="text-[10px] text-white/50">Length: {sanitizeSid(twilioSid).length}/34</span>
                </label>
                <label className="text-xs text-white/70">Twilio Auth Token
                  <input
                    value={twilioToken}
                    onChange={(e)=> setTwilioToken(e.target.value.trim())}
                    placeholder="••••••••••••••••"
                    className="mt-1 w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <GreenButton onClick={onSaveTwilio}>Save Twilio Credentials</GreenButton>
                <GreenButton onClick={refreshNumbers}><RefreshCw className="w-4 h-4 text-white" /> Refresh Imported Numbers</GreenButton>
                <GreenButton onClick={onAttachClick} disabled={!settings.fromE164 || attaching}>
                  <LinkIcon className="w-4 h-4 text-white" />
                  {attaching ? 'Attaching…' : 'Attach Number to Agent'}
                </GreenButton>
              </div>
              <p className="text-xs text-white/60">
                Attaching updates the Twilio webhook to <code>/api/voice/twilio/incoming</code> with your voice config.
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
                Calls go through Twilio only—no third-party voice SDK.
              </div>
            </div>
          </Section>
        </div>

        {msg && (
          <div
            className="mt-6 rounded-[14px] px-4 py-3 text-sm"
            style={{ ...CARD, border: '1px solid rgba(255,193,7,0.35)', background: 'rgba(255,193,7,0.10)' }}
          >
            <span className="text-amber-200">{msg}</span>
          </div>
        )}
      </div>

      <style jsx global>{`
        body { background:#0b0c10; color:#fff; }
        select { background-color: rgba(0,0,0,.30); color: white; }
      `}</style>
    </div>
  );
}
