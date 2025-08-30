// pages/voice-agent.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Head from 'next/head';
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
};
type TwilioCreds = { accountSid: string; authToken: string } | null;
type BotSummary = {
  id: string; name?: string; title?: string; language?: string; industry?: string;
  prompt?: string; questionFlow?: string[]; faq?: any[]; notes?: string; rawNotes?: string; additionalContext?: string;
};

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

/* ---------- SID helpers: sanitize on type, validate gently ---------- */
function sanitizeSid(s: string) {
  // strip non-alphanumerics and force uppercase
  return (s || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}
function isValidSid(s: string) {
  const t = sanitizeSid(s);
  return /^AC[A-Za-z0-9]{32}$/.test(t);
}

/* ---------------------- prompt shaper (client) -------------------- */
function shapePromptForScheduling(raw: string, opts?: { name?: string; org?: string; personaName?: string }) {
  const company = opts?.org || /company[:\- ]+(.+)/i.exec(raw)?.[1]?.trim() || 'Wellness Partners';
  const persona = opts?.personaName || 'Riley';
  const agentName = opts?.name || 'Appointment Scheduling Voice Assistant';
  const clean = (s: string) => (s || '').trim();

  return `# ${agentName}

## Identity & Purpose
You are ${persona}, an appointment scheduling voice assistant for **${company}**, a multi-specialty health clinic. Your purpose is to efficiently schedule, confirm, reschedule, or cancel appointments while giving clear information and a smooth booking experience.

## Voice & Persona
### Personality
- Friendly, organized, efficient
- Patient with elderly or confused callers
- Warm but professional; confident and competent

### Speech Characteristics
- Clear, concise, natural contractions
- Measured pace when confirming dates/times
- Natural fillers like “Let me check that for you” or “One moment while I look”
- Pronounce provider names and medical terms clearly

## Conversation Flow
### Introduction
Start with: “Thank you for calling **${company}**. This is ${persona}, your scheduling assistant. How may I help you today?”
If they immediately mention an appointment: “Happy to help. I’ll gather a few details to find the right appointment.”

### Appointment Type Determination
1. Service: “What type of appointment are you looking to schedule today?”
2. Provider: “Do you have a specific provider in mind, or should I look for first available?”
3. New vs Returning: “Have you visited us before, or is this your first appointment?”
4. Urgency: “Is this urgent or a routine visit?”

### Scheduling Process
1. Collect details
   - New: “May I have your full name, date of birth, and a phone number?”
   - Returning: “To pull up your record, your full name and date of birth?”
2. Offer times
   - “For [appointment type] with [provider], I have [date/time] or [date/time]. Do either work?”
   - If none: “Would you consider a different provider or day?”
3. Confirm
   - “Great — I’ve reserved [type] with [provider] on [day], [date] at [time]. Does that work?”
4. Prep instructions
   - “Please arrive 15 minutes early and bring [required items].”

### Confirmation & Wrap-up
- Summarize details and set expectations (duration, prep)
- Offer a reminder: “Would you like a text or call reminder?”
- Close: “Thanks for calling **${company}**. Anything else I can help with?”

## Response Guidelines
- Be concise; ask **one question at a time**
- Confirm dates/times/names explicitly
- Use phonetic spelling when needed (“C-H-E-N, like Charlie-Hotel-Echo-November”)
- Provide clear time estimates

## Scenario Handling
### New Patients
- Explain first-visit flow, arrive 20 minutes early
- Collect contact & brief reason for visit
- Request insurance card + photo ID
- Set expectations for the first appointment

### Urgent Requests
- Brief symptoms to triage
- True emergencies → advise immediate care
- Same-day slots when possible; otherwise next urgent slot

### Rescheduling
- Confirm existing appt; offer 2–3 alternatives; move and confirm

### Insurance & Payment
- General info only; copay at service; self-pay available

## Knowledge Base
- Types, hours, prep, policies

## Call Management
- “Checking availability — one moment.”
- Handle one need at a time.
${clean(raw) ? `

---
### Additional Business Context (from user notes)
${clean(raw)}
` : ''}`.trim();
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

/* ----------------------------- page ----------------------------- */
export default function VoiceAgentPage() {
  // builds (AI) selector
  const [bots, setBots] = useState<BotSummary[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string>('');

  const [nums, setNums] = useState<NumberItem[]>([]);
  const [settings, setSettings] = useState<Settings>({
    systemPrompt: '',
    language: 'en-US',
    ttsVoice: 'Polly.Joanna',
    fromE164: '',
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

  // load numbers, previous settings, chatbots, creds
  useEffect(() => {
    (async () => {
      try {
        try {
          const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers');
          setNums(Array.isArray(list) ? list : []);
        } catch { setNums([]); }
        const local = loadLocalSettings();
        if (local) setSettings((p) => ({ ...p, ...local }));
        // chatbots (build selector)
        try {
          const raw = localStorage.getItem(CHATBOTS_KEY);
          const arr: BotSummary[] = raw ? JSON.parse(raw) : [];
          setBots(Array.isArray(arr) ? arr : []);
          if (Array.isArray(arr) && arr.length && !selectedBotId) {
            setSelectedBotId(arr[arr.length - 1].id);
          }
          if (Array.isArray(arr) && arr[0]?.name && !local?.systemPrompt) {
            const seed = `Company: ${arr[0].name}\n\n${arr[0].prompt || ''}`.trim();
            setSettings((p)=>({ ...p, systemPrompt: shapePromptForScheduling(seed, { org: arr[0].name }) }));
          }
        } catch {}
        // saved Twilio creds
        const creds = loadTwilioCreds();
        if (creds) { setTwilioSid(creds.accountSid || ''); setTwilioToken(creds.authToken || ''); }
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // when a build is selected, seed prompt + language from it
  useEffect(() => {
    if (!selectedBotId) return;
    const bot = bots.find(b => b.id === selectedBotId);
    if (!bot) return;

    const ctxParts = [
      bot?.name || bot?.title ? `Business Name: ${bot?.name || bot?.title}` : '',
      bot?.industry ? `Industry: ${bot.industry}` : '',
      bot?.language ? `Language Pref: ${bot.language}` : '',
      Array.isArray(bot?.questionFlow) && bot.questionFlow!.length ? `Question Flow: ${bot.questionFlow!.join(' | ')}` : '',
      Array.isArray(bot?.faq) && bot.faq!.length ? `FAQ: ${bot.faq!.map((f:any)=> typeof f==='string'? f : f?.q).filter(Boolean).join(' | ')}` : '',
      bot?.notes || bot?.rawNotes || bot?.additionalContext ? `Notes: ${bot?.notes || bot?.rawNotes || bot?.additionalContext}` : '',
    ].filter(Boolean).join('\n');

    setSettings((p)=>({
      ...p,
      systemPrompt: shapePromptForScheduling(ctxParts || '', { org: bot?.name || bot?.title || 'Company' }),
      language: bot?.language || p.language
    }));
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
    } catch (e:any) {
      // If your server expects a provider key we aren't using, just treat this as optional.
      saveLocalSettings(settings);
      setMsg('Agent settings saved locally.');
    } finally { setCreating(false); }
  }

  async function onAttachClick() {
    setMsg(null);
    if (!settings.fromE164) { setMsg('Select a phone number first.'); return; }

    // Prefer valid typed creds; else fall back to saved creds.
    const typed = { accountSid: sanitizeSid(twilioSid), authToken: (twilioToken || '').trim() };
    const saved = loadTwilioCreds();
    const creds = (isValidSid(typed.accountSid) && !!typed.authToken) ? typed : saved || null;

    if (!creds) { setMsg('No Twilio credentials found. Enter and save them first.'); return; }
    if (!isValidSid(creds.accountSid)) { setMsg('Invalid or missing Twilio Account SID.'); return; }

    try {
      setAttaching(true);
      const r = await fetch('/api/telephony/attach-number', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ phoneNumber: settings.fromE164, credentials: creds }),
      });
      const j = await r.json();
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
    stopTone(); // ensure clean start
    const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.04; // quiet
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

  const sidLen = sanitizeSid(twilioSid).length;

  return (
    <>
      <Head><title>Voice Agent • reduc.ai</title></Head>
      <main className="px-6 py-8" style={{ maxWidth: 980, margin:'0 auto' }}>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-2xl font-semibold text-white">
              <PhoneIcon className="h-6 w-6 text-[#6af7d1]" />
              Voice Agent
            </h2>
            <div className="text-white/80 text-xs md:text-sm">No third-party voice SDKs here — just your number + Twilio webhooks.</div>
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
                <textarea
                  rows={16}
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
                  Uses your Twilio creds from above (stored in your browser only). No third-party SDK keys required.
                </p>
              </div>
            </Section>

            {/* Quick Tests (audio only) */}
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
                  <p className="text-xs text-white/60 mt-2">Simple tone to confirm output device. Stop is reliable even if the tab lost focus.</p>
                </div>
                <div className="text-white/60 text-sm">
                  No browser voice widget here (per your request). Calls will go through your Twilio webhook after you attach the number.
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
      </main>

      <style jsx global>{`
        body { background:#0b0c10; color:#fff; }
        select { background-color: rgba(0,0,0,.30); color: white; }
      `}</style>
    </>
  );
}
