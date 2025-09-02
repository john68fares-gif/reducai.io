// components/voice/VoiceAssistantEditor.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Save, KeyRound, Phone, Loader2 } from 'lucide-react';

/* ——— Shared look (matches your other screens) ——— */
const FRAME: React.CSSProperties = {
  background: 'rgba(13,15,17,0.95)',
  border: '2px dashed rgba(106,247,209,0.30)',
  borderRadius: 26,
  boxShadow:
    '0 28px 80px rgba(0,0,0,0.75), 0 0 26px rgba(0,255,194,0.06)',
};

const FIELD_BG = '#101314';
const FIELD_BORDER = '1px solid rgba(19,49,43,0.9)';
const FIELD_FOCUS = '#00ffc2';
const PRIMARY = '#00ffc2';
const PRIMARY_HOVER = '#00eab3';

type VoiceAgent = {
  id: string;
  type?: 'voice' | string;
  name?: string;
  language?: string;
  model?: string;
  fromE164?: string;
  vcfg?: {
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
  createdAt?: string;
  updatedAt?: string;
};

/* ——— storage helpers ——— */
function readAgent(id: string): VoiceAgent | null {
  try {
    const raw = localStorage.getItem('chatbots') || '[]';
    const arr: any[] = JSON.parse(raw);
    const got = arr.find((b) => b.id === id);
    return got || null;
  } catch {
    return null;
  }
}
function writeAgent(upd: VoiceAgent) {
  try {
    const raw = localStorage.getItem('chatbots') || '[]';
    const arr: any[] = JSON.parse(raw);
    const i = arr.findIndex((b) => b.id === upd.id);
    const next = { ...arr[i], ...upd, updatedAt: new Date().toISOString() };
    if (i >= 0) arr[i] = next;
    else arr.unshift(next);
    localStorage.setItem('chatbots', JSON.stringify(arr));
  } catch {}
}

export default function VoiceAssistantEditor({
  agentId,
  onBack,
}: {
  agentId: string;
  onBack: () => void;
}) {
  const [agent, setAgent] = useState<VoiceAgent | null>(null);
  const [saving, setSaving] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  /* form state */
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('English');
  const [model, setModel] = useState('gpt-4o-mini');

  const [voice, setVoice] = useState('Elliot');
  const [greeting, setGreeting] = useState('Hello! How can I help today?');
  const [style, setStyle] = useState('friendly, concise');
  const [rate, setRate] = useState(100);
  const [pitch, setPitch] = useState(0);
  const [bargeIn, setBargeIn] = useState(true);

  const [sid, setSid] = useState('');
  const [token, setToken] = useState('');
  const [phone, setPhone] = useState('');
  const [fromE164, setFromE164] = useState('');

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
    setBargeIn(v.bargeIn ?? true);
    setFromE164(a?.fromE164 || '');
    setSid(a?.tcfg?.accountSid || '');
    setToken(a?.tcfg?.authToken || '');
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
      vcfg: { voice, greeting, style, rate, pitch, bargeIn },
      tcfg: { accountSid: sid, authToken: token },
    };
    writeAgent(next);
    setAgent(next);
    setSaving(false);
    setToast('Changes saved.');
    setTimeout(() => setToast(null), 1800);
  }

  async function attachNumber() {
    if (!sid || !token || !phone) {
      setToast('Enter Twilio SID, Auth Token and Phone first.');
      setTimeout(() => setToast(null), 2000);
      return;
    }
    setAttaching(true);
    try {
      const r = await fetch('/api/telephony/attach-number', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
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
        }),
      });
      const j = await r.json();
      if (!j?.ok) throw new Error(j?.error || 'Attach failed');
      setFromE164(phone);
      if (agent) writeAgent({ ...agent, fromE164: phone });
      setToast('Number attached successfully.');
    } catch (e: any) {
      setToast(e?.message || 'Attach failed');
    } finally {
      setAttaching(false);
      setTimeout(() => setToast(null), 2200);
    }
  }

  return (
    <div className="w-full px-6 2xl:px-12 pb-16">
      {/* Page title (same as other steps) */}
      <div className="pt-8 pb-6">
        <div className="text-white/60 text-sm">Edit Assistant</div>
        <h1 className="mt-1 text-[34px] font-semibold tracking-tight">
          {name || 'Untitled'} <span className="text-white/50">— Voice</span>
        </h1>
      </div>

      {/* One big panel */}
      <div className="max-w-[1640px] mx-auto" style={FRAME}>
        {/* Header bar inside the frame */}
        <div className="flex items-center justify-between px-6 py-4"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.10)' }}>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 rounded-[12px] px-4 py-2 text-white hover:bg-white/10 border"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <button
            onClick={saveAll}
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-[18px] font-semibold"
            style={{
              background: PRIMARY,
              color: '#0b0c10',
              boxShadow: '0 0 12px rgba(106,247,209,0.30)',
              opacity: saving ? 0.7 : 1,
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = PRIMARY_HOVER)
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLButtonElement).style.background = PRIMARY)
            }
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {/* Basics */}
          <h3 className="text-white/90 font-semibold mb-3">Model & Basics</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Assistant name"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <input
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="Language"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (recommended)</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4.1">gpt-4.1</option>
            </select>
          </div>

          <div className="h-px my-6" style={{ background: 'rgba(255,255,255,0.10)' }} />

          {/* Voice */}
          <h3 className="text-white/90 font-semibold mb-3">Voice</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              placeholder="Voice (e.g., Elliot)"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <input
              value={greeting}
              onChange={(e) => setGreeting(e.target.value)}
              placeholder="Greeting"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Style (e.g., friendly, concise)"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <div className="grid grid-cols-3 gap-3">
              <input
                type="number"
                value={rate}
                onChange={(e) => setRate(Number(e.target.value))}
                placeholder="Rate"
                className="h-[44px] rounded-[14px] px-3 text-white outline-none"
                style={{ background: FIELD_BG, border: FIELD_BORDER }}
                onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
                onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
              />
              <input
                type="number"
                value={pitch}
                onChange={(e) => setPitch(Number(e.target.value))}
                placeholder="Pitch"
                className="h-[44px] rounded-[14px] px-3 text-white outline-none"
                style={{ background: FIELD_BG, border: FIELD_BORDER }}
                onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
                onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
              />
              <label className="inline-flex items-center gap-2 text-white/80">
                <input
                  type="checkbox"
                  checked={bargeIn}
                  onChange={(e) => setBargeIn(e.target.checked)}
                  className="accent-[#00ffc2]"
                />
                Barge-in
              </label>
            </div>
          </div>

          <div className="h-px my-6" style={{ background: 'rgba(255,255,255,0.10)' }} />

          {/* Telephony */}
          <h3 className="text-white/90 font-semibold mb-3">Telephony (Twilio)</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              value={sid}
              onChange={(e) => setSid(e.target.value)}
              placeholder="Account SID (AC…)"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Auth Token"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone (E.164, e.g., +15551234567)"
              className="h-[44px] rounded-[14px] px-3 text-white outline-none"
              style={{ background: FIELD_BG, border: FIELD_BORDER }}
              onFocus={(e)=>((e.currentTarget).style.border=`1px solid ${FIELD_FOCUS}`)}
              onBlur={(e)=>((e.currentTarget).style.border=FIELD_BORDER)}
            />
          </div>

          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={attachNumber}
              disabled={attaching}
              className="inline-flex items-center gap-2 px-5 h-[44px] rounded-[18px] font-semibold"
              style={{ background: PRIMARY, color: '#0b0c10', boxShadow: '0 0 12px rgba(106,247,209,0.30)', opacity: attaching ? 0.7 : 1 }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = PRIMARY_HOVER)
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLButtonElement).style.background = PRIMARY)
              }
            >
              {attaching ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Attach Number
            </button>

            {fromE164 && (
              <a
                href={`tel:${fromE164}`}
                className="inline-flex items-center gap-2 px-4 h-[44px] rounded-[14px] text-white border hover:bg-white/10"
                style={{ borderColor: 'rgba(255,255,255,0.15)' }}
              >
                <Phone className="w-4 h-4" /> Test
              </a>
            )}
          </div>

          {fromE164 && (
            <div className="text-xs text-white/60 mt-2">
              Current attached number: <span className="text-white/80">{fromE164}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tiny toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 px-4 py-3 rounded-[14px] text-sm text-white"
             style={{ background: 'rgba(16,19,20,0.95)', border: '1px solid rgba(0,255,194,0.35)', boxShadow: '0 18px 50px rgba(0,0,0,0.55)' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
