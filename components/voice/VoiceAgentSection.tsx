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
  Globe as WidgetIcon,
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
  assistantId?: string;
  publicKey?: string;
};
type TwilioCreds = { accountSid: string; authToken: string } | null;

type Banner = { kind: 'success' | 'error' | 'info'; message: string } | null;

/* --------------------------- utils/store -------------------------- */
const LS_SETTINGS_KEY = 'voice:settings:backup';
const CHATBOTS_KEY = 'chatbots';                          // builder saves here
const TWILIO_CREDS_KEYS = ['telephony:twilioCreds','twilio:lastCreds']; // reused creds from Phone Numbers page

async function getJSON<T=any>(url: string): Promise<T> {
  const r = await fetch(url);
  const ct = r.headers.get('content-type') || '';
  if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
  const j = await r.json();
  return (j?.ok ? j.data : j) as T;
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

/* ---------------------- prompt shaper (client) -------------------- */
/** Reshape raw notes into the structured scheduling format (no verbatim copying). */
function shapePromptForScheduling(raw: string, businessContext?: string) {
  const cleaned = (raw || '').trim();
  const extra = (businessContext || '').trim();
  return [
    `# Appointment Scheduling Agent Prompt`,
    ``,
    `## Identity & Purpose`,
    `You are a voice assistant that efficiently schedules, confirms, reschedules, or cancels appointments while providing clear information and a smooth booking experience.`,
    ``,
    `## Voice & Persona`,
    `### Personality`,
    `- Friendly, organized, and efficient`,
    `- Patient and helpful, especially with elderly or confused callers`,
    `- Warm but professional; confident and competent`,
    `### Speech Characteristics`,
    `- Clear, concise language with natural contractions`,
    `- Short sentences; avoid filler`,
    `- Confirm key details back to the caller`,
    ``,
    `## Conversation Flow`,
    `### Intro`,
    `- Brief greeting and purpose; if caller states intent, respond to it immediately.`,
    `### Determination`,
    `- Identify: New, Reschedule, Cancel, or Urgent.`,
    `- Collect: full name, phone, reason for visit, preferred date/time windows.`,
    `### Scheduling`,
    `- Offer earliest suitable options; confirm date, time, practitioner (if relevant), and location.`,
    `### Confirmation & Wrap-up`,
    `- Read back details; provide prep instructions; offer SMS/email confirmation if available; close warmly.`,
    ``,
    `## Response Guidelines`,
    `- Always answer questions/objections first, then continue.`,
    `- Ask one question at a time; keep replies under 3 short sentences.`,
    `- Use bullet points for options; never guess.`,
    ``,
    `## Scenario Handling`,
    `- **New**: Capture details; propose options; confirm.`,
    `- **Urgent**: If severe, direct to emergency services; otherwise prioritize sooner slots.`,
    `- **Rescheduling**: Confirm existing appointment; gather new availability; update and confirm.`,
    `- **Insurance**: Provide general info; gather policy details if needed.`,
    ``,
    `## Knowledge Base`,
    `- Services offered; operating hours; prep/paperwork required; cancellation/no-show policy.`,
    ``,
    `## Call Management`,
    `- If call drops, call back if system allows. If human requested, offer callback and collect time.`,
    extra ? `
## Additional Business Context
${extra}` : '',
    ``,
    `---`,
    `# Source Material (reference only — do not read verbatim)`,
    cleaned ? cleaned : `No additional raw notes provided.`,
  ].filter(Boolean).join('
');
}

/* --------- try to seed prompt from last chatbot (Builder) --------- */
function trySeedFromBuilder(): { prompt: string; language?: string } | null {
  try {
    const raw = localStorage.getItem(CHATBOTS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(arr) || !arr.length) return null;
    const last = arr[arr.length - 1];
    const name = last?.name || last?.aiName || last?.title || 'Your Business';
    const industry = last?.industry || 'Healthcare';
    const lang = last?.language || last?.lang || 'en-US';
    const faq = last?.faq || last?.companyFAQ || [];
    const flow = last?.questionFlow || [];
    const personality = last?.personality || last?.tone || '';
    const notes = last?.notes || last?.rawNotes || last?.additionalContext || '';

    const businessContext = [
      `Business Name: ${name}`,
      `Industry: ${industry}`,
      `Language Pref: ${lang}`,
      personality ? `Personality: ${personality}` : '',
      Array.isArray(flow) && flow.length ? `Question Flow: ${flow.join(' | ')}` : '',
      Array.isArray(faq) && faq.length ? `FAQ: ${faq.map((f:any)=> typeof f==='string'? f : f?.q).filter(Boolean).join(' | ')}` : '',
      notes ? `Notes: ${notes}` : '',
    ].filter(Boolean).join('
');

    return { prompt: shapePromptForScheduling('', businessContext), language: lang };
  } catch {
    return null;
  }
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
  const [nums, setNums] = useState<NumberItem[]>([]);
  const [settings, setSettings] = useState<Settings>({
    systemPrompt: '',
    language: 'en-US',
    ttsVoice: 'Polly.Joanna',
    fromE164: '',
    assistantId: '',
    publicKey: '',
  });

  const [banner, setBanner] = useState<Banner>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [attaching, setAttaching] = useState(false);

  // audio tester (reliable stop)
  const audioCtxRef = useRef<AudioContext|null>(null);
  const oscRef = useRef<OscillatorNode|null>(null);
  const gainRef = useRef<GainNode|null>(null);

  function showBanner(b: Banner, ttl=3500) {
    setBanner(b);
    if (b) {
      window.clearTimeout((showBanner as any)._t);
      (showBanner as any)._t = window.setTimeout(()=> setBanner(null), ttl);
    }
  }

  // load numbers, previous settings, builder prompt
  useEffect(() => {
    (async () => {
      try {
        try {
          const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers');
          setNums(Array.isArray(list) ? list : []);
          if (!Array.isArray(list) || !list.length) showBanner({ kind:'info', message:'No numbers imported.' });
        } catch (e:any) {
          showBanner({ kind:'error', message: e?.message || 'Failed to fetch numbers.' });
          setNums([]);
        }
        const local = loadLocalSettings();
        if (local) setSettings((p) => ({ ...p, ...local }));
        // seed prompt from Builder if empty
        if (!(local?.systemPrompt)) {
          const seeded = trySeedFromBuilder();
          if (seeded) setSettings((p)=>({ ...p, systemPrompt: seeded.prompt, language: seeded.language || p.language }));
        }
      } catch {}
    })();
  }, []);

  // options
  const numberOptions: Option[] = useMemo(
    () => nums.map((n) => ({ value: n.e164 || '', label: (n.e164 ? n.e164 : n.id) + (n.label ? ` — ${n.label}` : '') })),
    [nums],
  );

  async function refreshNumbers() {
    try {
      const list = await getJSON<NumberItem[]>('/api/telephony/phone-numbers');
      setNums(Array.isArray(list) ? list : []);
      if (!Array.isArray(list) || !list.length) showBanner({ kind:'info', message:'No numbers imported.' });
      else showBanner({ kind:'success', message:'Numbers refreshed.' });
    } catch (e:any) { showBanner({ kind:'error', message: e?.message || 'Server did not return JSON.' }); }
  }

  async function save() {
    setSaving(true); showBanner(null);
    try {
      const r = await fetch('/api/voice-agent', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const j = await r.json();
        if (j?.ok === false) throw new Error(j?.error || 'Save failed.');
        showBanner({ kind:'success', message:'Settings saved.' });
      } else {
        // Server save not available, but we still persist locally
        showBanner({ kind:'info', message:'Saved locally. (Server save not available)' });
      }
    } catch (e:any) {
      showBanner({ kind:'info', message:'Saved locally. (Server save not available)' });
    } finally {
      saveLocalSettings(settings);
      setSaving(false);
    }
  }

  async function createAgent() {
    setCreating(true); showBanner(null);
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
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Create failed.');
      showBanner({ kind:'success', message:`Agent created${settings.fromE164 ? ` — live at ${settings.fromE164}` : ''}.` });
    } catch (e:any) { showBanner({ kind:'error', message: e?.message || 'Create failed.' }); }
    finally { setCreating(false); }
  }

  async function onAttachClick() {
    showBanner(null);
    if (!settings.fromE164) { showBanner({ kind:'error', message:'Select a phone number first.' }); return; }
    const creds = loadTwilioCreds();
    if (!creds) { showBanner({ kind:'error', message:'No Twilio credentials found from import. Import a number with Twilio first.' }); return; }
    try {
      setAttaching(true);
      const r = await fetch('/api/telephony/attach-number', {
        method:'POST',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ phoneNumber: settings.fromE164, credentials: creds }),
      });
      const ct = r.headers.get('content-type') || '';
      if (!ct.includes('application/json')) throw new Error('Server did not return JSON.');
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed.');
      showBanner({ kind:'success', message:`Number attached to agent: ${settings.fromE164}` });
    } catch (e:any) { showBanner({ kind:'error', message: e?.message || 'Attach failed.' }); }
    finally { setAttaching(false); }
  }

  function improvePrompt() {
    // allow extra business context from latest chatbot if present
    let extra = '';
    try {
      const raw = localStorage.getItem(CHATBOTS_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      const last = Array.isArray(arr) && arr[arr.length-1];
      if (last) {
        extra = [
          last?.name ? `Business Name: ${last.name}` : '',
          last?.industry ? `Industry: ${last.industry}` : '',
          last?.language ? `Language Pref: ${last.language}` : '',
          last?.notes ? `Notes: ${last.notes}` : '',
        ].filter(Boolean).join('
');
      }
    } catch {}
    setSettings((p)=>({ ...p, systemPrompt: shapePromptForScheduling(p.systemPrompt, extra) }));
    showBanner({ kind:'success', message:'Prompt improved.' });
  }

  // audio tester
  async function startTone() {
    stopTone(); // clean start
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

  function mountWidget() {
    if (!settings.assistantId || !settings.publicKey) { showBanner({ kind:'error', message:'Provide Assistant ID and Public Key first.' }); return; }
    const scId = 'vapi-widget-script';
    if (!document.getElementById(scId)) {
      const sc = document.createElement('script');
      sc.id = scId;
      sc.src = 'https://unpkg.com/@vapi-ai/client-sdk-react/dist/embed/widget.umd.js';
      sc.async = true; sc.type = 'text/javascript';
      document.body.appendChild(sc);
    }
    const slot = document.getElementById('widget-slot');
    if (slot && slot.childElementCount === 0) {
      const el = document.createElement('vapi-widget');
      el.setAttribute('assistant-id', settings.assistantId!);
      el.setAttribute('public-key', settings.publicKey!);
      slot.appendChild(el);
      showBanner({ kind:'success', message:'Widget mounted.' });
    }
  }

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
            <div className="text-white/80 text-xs md:text-sm">Re-use imported Twilio creds, attach a number, test, and deploy.</div>
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
                  <label className="text-xs text-white/70">Language (BCP-47)
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
                      placeholder='alice or Polly.Joanna'
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

            {/* Numbers + attach (auto creds reuse) */}
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

                <div className="flex flex-wrap gap-2">
                  <GreenButton onClick={refreshNumbers}><RefreshCw className="w-4 h-4 text-white" /> Refresh Imported Numbers</GreenButton>
                  <GreenButton onClick={onAttachClick} disabled={!settings.fromE164 || attaching}>
                    <LinkIcon className="w-4 h-4 text-white" />
                    {attaching ? 'Attaching…' : 'Attach Number to Agent'}
                  </GreenButton>
                </div>
                <p className="text-xs text-white/60">
                  Uses your Twilio creds saved during import (never asks twice).
                </p>
              </div>
            </Section>

            {/* Quick tests */}
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

                <div>
                  <div className="text-sm text-white/90 mb-2 flex items-center gap-2">
                    <WidgetIcon className="w-4 h-4" /> Browser Widget
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input
                      value={settings.assistantId || ''}
                      onChange={(e)=>setSettings({...settings, assistantId: e.target.value})}
                      placeholder="assistant-id"
                      className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                    />
                    <input
                      value={settings.publicKey || ''}
                      onChange={(e)=>setSettings({...settings, publicKey: e.target.value})}
                      placeholder="public-key"
                      className="w-full rounded-[12px] border border-white/20 bg-black/30 px-3 h-[38px] text-sm outline-none focus:border-[#6af7d1] text-white"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    <GreenButton onClick={mountWidget}>Show Widget</GreenButton>
                    <GreenButton onClick={save}><SaveIcon className="w-4 h-4 text-white" /> Save</GreenButton>
                  </div>
                  <div id="widget-slot" className="mt-3" />
                </div>
              </div>
            </Section>
          </div>

          {banner && (
            <div className="mt-6 rounded-[14px] px-4 py-3 text-sm" style={{ ...CARD,
              border: banner.kind==='success' ? '1px solid rgba(16,185,129,0.35)'
                   : banner.kind==='error' ? '1px solid rgba(244,63,94,0.35)'
                   : '1px solid rgba(255,193,7,0.35)',
              background: banner.kind==='success' ? 'rgba(16,185,129,0.10)'
                       : banner.kind==='error' ? 'rgba(244,63,94,0.10)'
                       : 'rgba(255,193,7,0.10)'
            }}>
              <span className={banner.kind==='success' ? 'text-emerald-200' : banner.kind==='error' ? 'text-rose-200' : 'text-amber-200'}>
                {banner.message}
              </span>
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
