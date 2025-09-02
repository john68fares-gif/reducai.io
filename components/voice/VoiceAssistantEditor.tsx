// components/voice/VoiceAssistantEditor.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, Save, Phone, KeyRound, PlugZap, Settings2, Wand2,
  ChevronDown, Loader2, Check, AlertTriangle, ShieldCheck
} from 'lucide-react';

/* =========================
   Shared look & helpers
   ========================= */
const OUTER: React.CSSProperties = {
  background: '#0d0f11',
  border: '1px solid rgba(106,247,209,0.18)',
  borderRadius: 18, // less rounded (per your request)
  boxShadow: '0 28px 90px rgba(0,0,0,0.55), 0 0 24px rgba(0,255,194,0.08)', // outside shadow only
};

const CARD: React.CSSProperties = {
  background: '#101314',            // solid
  border: '1px solid rgba(255,255,255,0.16)', // thinner
  borderRadius: 16,
  boxShadow: '0 16px 36px rgba(0,0,0,0.38)',  // outside soft shadow
};

const BTN_OK = '#00ffc2';
const BTN_OK_HOVER = '#00eab3';

type VoiceAgent = {
  id: string;
  type?: 'voice' | string;
  name?: string;
  language?: string;
  model?: string;
  fromE164?: string;
  vcfg?: {
    provider?: string;
    voice?: string;
    greeting?: string;
    style?: string;
    rate?: number;
    pitch?: number;
    bargeIn?: boolean;
  };
  tcfg?: {
    accountSid?: string;
    authToken?: string;
  };
  prompt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function readAgent(id: string): VoiceAgent | null {
  try {
    const raw = localStorage.getItem('chatbots');
    const arr = raw ? JSON.parse(raw) : [];
    const got = Array.isArray(arr) ? arr.find((b: any) => b.id === id) : null;
    return got || null;
  } catch {
    return null;
  }
}

function writeAgent(upd: VoiceAgent) {
  try {
    const raw = localStorage.getItem('chatbots');
    const arr: any[] = raw ? JSON.parse(raw) : [];
    const i = arr.findIndex((b) => b.id === upd.id);
    const stamped = { ...upd, updatedAt: new Date().toISOString() };
    if (i >= 0) arr[i] = { ...arr[i], ...stamped };
    else arr.unshift(stamped);
    localStorage.setItem('chatbots', JSON.stringify(arr));
  } catch {}
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/70 mb-1">{children}</div>;
}

function Line() {
  return <div className="h-px w-full bg-white/10 my-3" />;
}

/* --------- Collapsible section ---------- */
function Section({
  title,
  icon,
  defaultOpen = true,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={CARD} className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2 text-white font-semibold">
          {icon} <span>{title}</span>
        </div>
        <ChevronDown
          className={`w-5 h-5 text-white/80 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <div className="px-6 pb-5 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------- Toast ---------- */
function Toast({ text, tone='ok', onClose }:{ text:string; tone?:'ok'|'warn'|'err'; onClose:()=>void }) {
  useEffect(()=>{ const t = setTimeout(onClose, 2000); return ()=>clearTimeout(t); },[onClose]);
  const border = tone==='ok' ? 'rgba(106,247,209,0.40)' : tone==='warn' ? 'rgba(255,220,120,0.40)' : 'rgba(255,120,120,0.40)';
  return (
    <div className="fixed bottom-6 right-6 z-[9999]">
      <div
        className="px-4 py-3 rounded-[14px] text-sm text-white/95 flex items-center gap-2"
        style={{ background:'rgba(16,19,20,0.95)', border:`1px solid ${border}`, boxShadow:'0 10px 30px rgba(0,0,0,0.45)'}}
      >
        {tone==='ok' ? <Check className="w-4 h-4 text-[#6af7d1]" /> : <AlertTriangle className="w-4 h-4 text-amber-300" />}
        <span>{text}</span>
      </div>
    </div>
  );
}

/* =========================
   Editor
   ========================= */
export default function VoiceAssistantEditor({
  agentId,
  onBack,
}: {
  agentId: string;
  onBack: () => void;
}) {
  const [agent, setAgent] = useState<VoiceAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone?: 'ok' | 'warn' | 'err' } | null>(null);
  const [attaching, setAttaching] = useState(false);

  /* form state */
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [model, setModel] = useState('gpt-4o-mini');
  const [voice, setVoice] = useState('Elliot');
  const [greeting, setGreeting] = useState('Hello! How can I help today?');
  const [style, setStyle] = useState('friendly, concise');
  const [rate, setRate] = useState(100);
  const [pitch, setPitch] = useState(0);
  const [bargeIn, setBarge] = useState(true);

  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [fromE164, setFrom] = useState('');

  useEffect(() => {
    const a = readAgent(agentId);
    setAgent(a);
    const v = a?.vcfg || {};
    setName(a?.name || '');
    setLanguage(a?.language || 'English');
    setModel(a?.model || 'gpt-4o-mini');
    setVoice(v.voice || 'Elliot');
    setGreeting(v.greeting || 'Hello! How can I help today?');
    setStyle(v.style || 'friendly, concise');
    setRate(v.rate ?? 100);
    setPitch(v.pitch ?? 0);
    setBarge(v.bargeIn ?? true);
    setFrom(a?.fromE164 || '');
    const t = a?.tcfg || {};
    setSid(t.accountSid || '');
    setToken(t.authToken || '');
  }, [agentId]);

  function saveAll() {
    if (!agent) return;
    setSaving(true);
    const next: VoiceAgent = {
      ...agent,
      type: 'voice',
      name,
      language,
      model,
      fromE164,
      vcfg: { provider: 'vapi', voice, greeting, style, rate, pitch, bargeIn },
      tcfg: { accountSid: sid, authToken: token },
    };
    writeAgent(next);
    setAgent(next);
    setSaving(false);
    setToast({ text: 'Changes saved.', tone: 'ok' });
  }

  async function attachNumber() {
    if (!sid || !token || !phone) {
      setToast({ text: 'Enter Twilio SID, Auth Token and Phone number first.', tone: 'warn' });
      return;
    }
    setAttaching(true);
    try {
      const body = {
        accountSid: sid,
        authToken: token,
        phoneNumber: phone,
        agentId,
        language,
        voice,
        greeting,
        style,
        rate,
        pitch,
        bargeIn,
      };
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed');
      setFrom(phone);
      if (agent) writeAgent({ ...agent, fromE164: phone });
      setToast({ text: 'Number attached to webhook successfully.', tone: 'ok' });
    } catch (e: any) {
      setToast({ text: e?.message || 'Attach failed', tone: 'err' });
    } finally {
      setAttaching(false);
    }
  }

  return (
    <section className="w-full font-movatif text-white">
      {/* Page title (matches other pages) */}
      <div className="w-full max-w-[1680px] mx-auto px-6 2xl:px-12 pt-8 pb-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-sm text-white/60">Edit Assistant</div>
            <h1 className="mt-1 text-[32px] md:text-[36px] tracking-tight font-semibold">
              Voice Assistant Editor
            </h1>
            <div className="text-white/65 text-sm mt-1">
              Configure model, voice, telephony, and behavior. Click <span className="text-white/90">Save</span> to persist changes.
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10 transition"
            >
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
            <button
              onClick={saveAll}
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-[14px] font-semibold"
              style={{ background: BTN_OK, color: '#0b0c10', opacity: saving ? 0.7 : 1 }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_OK_HOVER)}
              onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_OK)}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
          </div>
        </div>
      </div>

      {/* Editor body */}
      <div className="w-full max-w-[1680px] mx-auto px-6 2xl:px-12 pb-20">
        {/* Main frame */}
        <div className="p-7" style={OUTER}>
          {/* Box title (agent name stays at the top of the box, like your pattern) */}
          <div className="flex items-center justify-between mb-6">
            <div className="min-w-0">
              <div className="text-[13px] text-white/60">Assistant</div>
              <div className="text-[22px] md:text-[24px] font-semibold truncate">
                {name || 'Untitled'} <span className="text-white/50">• Voice</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-7">
              <Section title="Model & Basics" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Assistant Name</FieldLabel>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g., Riley (Voice)"
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Language</FieldLabel>
                    <input
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      placeholder="English"
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Model</FieldLabel>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    >
                      <option value="gpt-4o-mini">gpt-4o-mini (recommended)</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4.1">gpt-4.1</option>
                    </select>
                  </div>
                </div>
              </Section>

              <Section title="Voice" icon={<Wand2 className="w-4 h-4 text-[#6af7d1]" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Voice</FieldLabel>
                    <input
                      value={voice}
                      onChange={(e) => setVoice(e.target.value)}
                      placeholder="Elliot / Polly.Joanna / etc."
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Greeting</FieldLabel>
                    <input
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      placeholder="Hello! How can I help today?"
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Style</FieldLabel>
                    <input
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      placeholder="friendly, concise"
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <FieldLabel>Rate</FieldLabel>
                      <input
                        type="number"
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                        className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                      />
                    </div>
                    <div>
                      <FieldLabel>Pitch</FieldLabel>
                      <input
                        type="number"
                        value={pitch}
                        onChange={(e) => setPitch(Number(e.target.value))}
                        className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                      />
                    </div>
                    <div className="flex items-end">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={bargeIn}
                          onChange={(e) => setBarge(e.target.checked)}
                          className="accent-[#00ffc2]"
                        />
                        <span className="text-white/85 text-sm">Barge-in</span>
                      </label>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Call Behavior (summary)" icon={<ShieldCheck className="w-4 h-4 text-[#6af7d1]" />}>
                <div className="text-sm text-white/85 leading-relaxed">
                  Keep replies short and ask one question at a time. If the caller drops mid-flow, ask for a callback number.
                  You can extend this later from your prompt/behavior blocks.
                </div>
              </Section>
            </div>

            {/* Right column */}
            <div className="space-y-7">
              <Section title="Telephony (Twilio)" icon={<PlugZap className="w-4 h-4 text-[#6af7d1]" />} defaultOpen>
                <div className="grid gap-3">
                  <div>
                    <FieldLabel>Account SID</FieldLabel>
                    <input
                      value={sid}
                      onChange={(e) => setSid(e.target.value)}
                      placeholder="ACxxxxxxxx…"
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Auth Token</FieldLabel>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <Line />
                  <div>
                    <FieldLabel>Phone Number (E.164)</FieldLabel>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+15551234567"
                      className="w-full h-[44px] rounded-[14px] bg-[#101314] text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={attachNumber}
                      disabled={attaching}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[14px] font-semibold"
                      style={{ background: BTN_OK, color: '#0b0c10', opacity: attaching ? 0.7 : 1 }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_OK_HOVER)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.background = BTN_OK)}
                    >
                      {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                      Attach Number
                    </button>

                    {fromE164 && (
                      <a
                        href={`tel:${fromE164}`}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] text-sm border border-white/15 hover:bg-white/10"
                      >
                        <Phone className="w-4 h-4" /> Test
                      </a>
                    )}
                  </div>

                  {fromE164 && (
                    <div className="text-xs text-white/65">
                      Attached number: <span className="text-white/85">{fromE164}</span>
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Save" icon={<Save className="w-4 h-4 text-[#6af7d1]" />} defaultOpen={false}>
                <div className="text-sm text-white/85 mb-3">
                  Save your changes to update the local build record and timestamp it.
                </div>
                <button
                  onClick={saveAll}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-[14px] font-semibold"
                  style={{ background: BTN_OK, color: '#0b0c10', opacity: saving ? 0.7 : 1 }}
                >
                  <Save className="w-4 h-4" /> Save Changes
                </button>
              </Section>
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast text={toast.text} tone={toast.tone} onClose={() => setToast(null)} />}
    </section>
  );
}
