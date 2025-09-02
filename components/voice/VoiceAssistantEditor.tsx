// components/voice/VoiceAssistantEditor.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Save, Phone, KeyRound, PlugZap, Settings2, Wand2,
  ChevronDown, Loader2, Check, AlertTriangle, ShieldCheck
} from 'lucide-react';

/* ===========================
   Shared look & helpers
   =========================== */
const OUTER: React.CSSProperties = {
  background: 'rgba(13,15,17,0.92)',
  border: '1px solid rgba(106,247,209,0.18)',
  borderRadius: 22,
  boxShadow:
    '0 14px 40px rgba(0,0,0,0.55), 0 0 12px rgba(0,255,194,0.06), inset 0 0 14px rgba(0,0,0,0.25)',
};

const CARD: React.CSSProperties = {
  background: '#101314',
  border: '1px solid rgba(255,255,255,0.20)',
  borderRadius: 16,
  boxShadow: '0 6px 20px rgba(0,0,0,0.35), inset 0 0 10px rgba(0,0,0,0.25)',
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
    if (i >= 0) arr[i] = { ...arr[i], ...upd, updatedAt: new Date().toISOString() };
    else arr.unshift({ ...upd, updatedAt: new Date().toISOString() });
    localStorage.setItem('chatbots', JSON.stringify(arr));
  } catch {}
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-xs text-white/70 mb-1">{children}</div>;
}

function Line() {
  return <div className="h-px w-full bg-white/10 my-3" />;
}

/* ---------- tiny accordion ---------- */
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
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-white/5 transition"
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
            <div className="px-5 pb-5 pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- toast ---------- */
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

/* ===========================
   Editor
   =========================== */
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
        agentId: agentId,
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
      // persist
      if (agent) writeAgent({ ...agent, fromE164: phone });
      setToast({ text: 'Number attached to webhook successfully.', tone: 'ok' });
    } catch (e: any) {
      setToast({ text: e?.message || 'Attach failed', tone: 'err' });
    } finally {
      setAttaching(false);
    }
  }

  return (
    <section className="w-full">
      {/* page header */}
      <div className="w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pt-8 pb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[12px] border border-white/15 px-4 py-2 hover:bg-white/10 transition"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-3">
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

        {/* Title like other pages */}
        <div className="mb-6">
          <div className="text-sm text-white/60">Edit Assistant</div>
          <h1 className="mt-1 text-3xl md:text-[34px] font-semibold tracking-tight">
            {name || 'Untitled'} <span className="text-white/50">— Voice</span>
          </h1>
          <div className="text-white/60 text-sm mt-1">
            Configure model, voice, telephony, and behavior. Changes are saved locally until you click <span className="text-white/80">Save</span>.
          </div>
        </div>
      </div>

      {/* editor body */}
      <div className="w-full max-w-[1640px] mx-auto px-6 2xl:px-12 pb-20">
        <div
          className="p-6 md:p-7"
          style={{
            ...OUTER,
            borderRadius: 26,
            boxShadow: '0 18px 60px rgba(0,0,0,0.55), 0 0 18px rgba(0,255,194,0.06)',
          }}
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* left (wide) */}
            <div className="lg:col-span-2 space-y-6">
              <Section title="Model & Basics" icon={<Settings2 className="w-4 h-4 text-[#6af7d1]" />}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel>Assistant Name</FieldLabel>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Language</FieldLabel>
                    <input
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Model</FieldLabel>
                    <select
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
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
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Greeting</FieldLabel>
                    <input
                      value={greeting}
                      onChange={(e) => setGreeting(e.target.value)}
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Style</FieldLabel>
                    <input
                      value={style}
                      onChange={(e) => setStyle(e.target.value)}
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <FieldLabel>Rate</FieldLabel>
                      <input
                        type="number"
                        value={rate}
                        onChange={(e) => setRate(Number(e.target.value))}
                        className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                      />
                    </div>
                    <div>
                      <FieldLabel>Pitch</FieldLabel>
                      <input
                        type="number"
                        value={pitch}
                        onChange={(e) => setPitch(Number(e.target.value))}
                        className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
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
                        <span className="text-white/80 text-sm">Barge-in</span>
                      </label>
                    </div>
                  </div>
                </div>
              </Section>

              <Section title="Call Behavior (summary)" icon={<ShieldCheck className="w-4 h-4 text-[#6af7d1]" />}>
                <div className="text-sm text-white/80">
                  Keep replies short, one question at a time. Ask for a callback number if the user hangs up mid-flow.
                  You can extend this later in a Prompt tab.
                </div>
              </Section>
            </div>

            {/* right column */}
            <div className="space-y-6">
              <Section title="Telephony (Twilio)" icon={<PlugZap className="w-4 h-4 text-[#6af7d1]" />} defaultOpen>
                <div className="grid gap-3">
                  <div>
                    <FieldLabel>Account SID</FieldLabel>
                    <input
                      value={sid}
                      onChange={(e) => setSid(e.target.value)}
                      placeholder="ACxxxxxxxx…"
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <div>
                    <FieldLabel>Auth Token</FieldLabel>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>
                  <Line />
                  <div>
                    <FieldLabel>Phone Number (E.164)</FieldLabel>
                    <input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+15551234567"
                      className="w-full h-[42px] rounded-[12px] bg-black/30 text-white px-3 border border-white/15 outline-none focus:border-[#00ffc2]"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={attachNumber}
                      disabled={attaching}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-[12px] font-semibold"
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
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-[12px] text-sm border border-white/15 hover:bg-white/10"
                      >
                        <Phone className="w-4 h-4" /> Test
                      </a>
                    )}
                  </div>

                  {fromE164 && (
                    <div className="text-xs text-white/60">
                      Current attached number: <span className="text-white/80">{fromE164}</span>
                    </div>
                  )}
                </div>
              </Section>

              <Section title="Save" icon={<Save className="w-4 h-4 text-[#6af7d1]" />} defaultOpen={false}>
                <div className="text-sm text-white/80 mb-3">
                  Save your changes. This updates the local build and timestamps the change.
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
